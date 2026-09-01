import db from "../db.server";
import {
  BOTSHIELD_BASIC_MONTHLY_PRICE,
  BOTSHIELD_BASIC_PLAN_NAME,
  BOTSHIELD_BASIC_TRIAL_DAYS,
  createUnavailableBillingState,
  deriveBillingState,
} from "./billing-state";

const DEFAULT_REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const PARTNER_API_TIMEOUT_MS = 8_000;
const refreshes = new Map();

function parseBoolean(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function normalizeShop(shop) {
  return String(shop || "").trim().toLowerCase();
}

function parseDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function getRefreshIntervalMs() {
  const value = Number(process.env.BILLING_REFRESH_INTERVAL_MS);
  return Number.isFinite(value) && value >= 60_000
    ? value
    : DEFAULT_REFRESH_INTERVAL_MS;
}

export function getBillingConfiguration(shop) {
  const appHandle = process.env.SHOPIFY_APP_HANDLE?.trim() || "";
  const storeHandle = normalizeShop(shop).split(".")[0];
  const partnerOrganizationId =
    process.env.SHOPIFY_PARTNER_ORG_ID?.trim() || "";
  const partnerAccessToken =
    process.env.SHOPIFY_PARTNER_ACCESS_TOKEN?.trim() || "";
  const partnerAppId = process.env.SHOPIFY_PARTNER_APP_ID?.trim() || "";
  const partnerApiVersion =
    process.env.SHOPIFY_PARTNER_API_VERSION?.trim() || "2026-07";

  return {
    appHandle,
    configured: Boolean(
      appHandle &&
        partnerOrganizationId &&
        partnerAccessToken &&
        partnerAppId,
    ),
    partnerOrganizationId,
    partnerAccessToken,
    partnerAppId,
    partnerApiVersion,
    publicPlanHandle:
      process.env.SHOPIFY_PUBLIC_PLAN_HANDLE?.trim() || "basic",
    testPlanHandle:
      process.env.SHOPIFY_TEST_PLAN_HANDLE?.trim() || "",
    enforcementEnabled: parseBoolean(
      process.env.BILLING_ENFORCEMENT_ENABLED,
    ),
    planName:
      process.env.BILLING_PLAN_NAME?.trim() || BOTSHIELD_BASIC_PLAN_NAME,
    monthlyPrice: Number(
      process.env.BILLING_MONTHLY_PRICE || BOTSHIELD_BASIC_MONTHLY_PRICE,
    ),
    trialDays: Number(process.env.BILLING_TRIAL_DAYS || BOTSHIELD_BASIC_TRIAL_DAYS),
    pricingUrl:
      appHandle && storeHandle
        ? `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`
        : null,
  };
}

async function readBillingRows(shop) {
  const rows = await db.appSetting.findMany({
    where: {
      shop,
      key: { startsWith: "billing" },
    },
    select: { key: true, value: true },
  });
  return new Map(rows.map((row) => [row.key, row.value]));
}

function stateFromRows(rows) {
  return {
    active: rows.get("billingActive") === "true",
    verified: rows.get("billingVerified") === "true",
    status: rows.get("billingStatus") || "inactive",
    planHandle: rows.get("billingPlanHandle") || "",
    planName: rows.get("billingPlanName") || "",
    subscriptionId: rows.get("billingSubscriptionId") || "",
    test: rows.get("billingTest") === "true",
    trial: rows.get("billingTrial") === "true",
    trialEndsAt: rows.get("billingTrialEndsAt") || null,
    cancelAtEndOfCycle:
      rows.get("billingCancelAtEndOfCycle") === "true",
    currentPeriodStart:
      rows.get("billingCurrentPeriodStart") || null,
    currentPeriodEnd: rows.get("billingCurrentPeriodEnd") || null,
    billingPeriod: rows.get("billingPeriod") || null,
    latestEventType: rows.get("billingLatestEventType") || null,
    latestEventAt: rows.get("billingLatestEventAt") || null,
    checkedAt: rows.get("billingLastCheckedAt") || null,
    error: rows.get("billingLastError") || null,
    shopId: rows.get("billingShopId") || "",
  };
}

async function persistBillingState(shop, state, shopId) {
  const values = {
    billingActive: state.active ? "true" : "false",
    billingVerified: state.verified ? "true" : "false",
    billingStatus: state.status,
    billingPlanHandle: state.planHandle || "",
    billingPlanName: state.planName || "",
    billingSubscriptionId: state.subscriptionId || "",
    billingTest: state.test ? "true" : "false",
    billingTrial: state.trial ? "true" : "false",
    billingTrialEndsAt: state.trialEndsAt || "",
    billingCancelAtEndOfCycle: state.cancelAtEndOfCycle
      ? "true"
      : "false",
    billingCurrentPeriodStart: state.currentPeriodStart || "",
    billingCurrentPeriodEnd: state.currentPeriodEnd || "",
    billingPeriod: state.billingPeriod || "",
    billingLatestEventType: state.latestEventType || "",
    billingLatestEventAt: state.latestEventAt || "",
    billingLastCheckedAt: state.checkedAt,
    billingLastError: state.error || "",
    ...(shopId ? { billingShopId: shopId } : {}),
  };

  await db.$transaction(
    Object.entries(values).map(([key, value]) =>
      db.appSetting.upsert({
        where: { shop_key: { shop, key } },
        create: { shop, key, value },
        update: { value },
      }),
    ),
  );
}

async function resolveShopId(admin, shop, storedShopId) {
  if (storedShopId) return storedShopId;
  if (!admin) {
    throw new Error(
      `Shopify shop ID has not been recorded for ${shop}. Open the BotShield dashboard once before enabling billing enforcement.`,
    );
  }

  const response = await admin.graphql(`#graphql
    query BotShieldBillingShopId {
      shop {
        id
      }
    }
  `);
  const payload = await response.json();
  const shopId = payload?.data?.shop?.id;
  if (!shopId) {
    throw new Error("Unable to resolve the Shopify shop ID.");
  }
  return shopId;
}

async function queryPartnerBilling(configuration, shopId) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    PARTNER_API_TIMEOUT_MS,
  );
  const endpoint = `https://partners.shopify.com/${encodeURIComponent(
    configuration.partnerOrganizationId,
  )}/api/${configuration.partnerApiVersion}/graphql.json`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": configuration.partnerAccessToken,
      },
      signal: controller.signal,
      body: JSON.stringify({
        query: `#graphql
          query BotShieldPartnerBilling($appId: ID!, $shopId: ID!) {
            activeSubscription(appId: $appId, shopId: $shopId) {
              billingPeriod
              cancelAtEndOfCycle
              trialEndsAt
              legacySubscriptionId
              currentBillingCycle {
                startTime
                endTime
              }
              items {
                handle
                description
                price {
                  __typename
                  active
                  currency
                  ... on FlatRatePrice {
                    amount
                  }
                }
              }
            }
            events(
              filter: {
                subjectId: $appId
                shopId: $shopId
                eventTypes: [
                  SUBSCRIPTION_CREATED
                  SUBSCRIPTION_UPDATED
                  SUBSCRIPTION_CANCELLATION_SCHEDULED
                  SUBSCRIPTION_CANCELED
                  SUBSCRIPTION_FROZEN
                  SUBSCRIPTION_UNFROZEN
                ]
              }
              first: 10
            ) {
              edges {
                node {
                  eventType
                  occurredAt
                  ... on SubscriptionStatus {
                    state
                    cancelEffectiveOn
                    plan {
                      handle
                      billingPeriod
                      trialDays
                    }
                  }
                }
              }
            }
          }
        `,
        variables: {
          appId: configuration.partnerAppId,
          shopId,
        },
      }),
    });
    const payload = await response.json();
    if (!response.ok || payload?.errors?.length) {
      const message =
        payload?.errors?.map((error) => error.message).join("; ") ||
        `Partner API returned ${response.status}.`;
      throw new Error(message);
    }
    return payload?.data || {};
  } finally {
    clearTimeout(timeout);
  }
}

function publicBillingResult(configuration, state) {
  return {
    appHandle: configuration.appHandle,
    configured: configuration.configured,
    enforcementEnabled: configuration.enforcementEnabled,
    planName: configuration.planName,
    monthlyPrice: configuration.monthlyPrice,
    trialDays: configuration.trialDays,
    pricingUrl: configuration.pricingUrl,
    ...state,
    subscription: state.active
      ? {
          id: state.subscriptionId || null,
          name: state.planName,
          handle: state.planHandle,
          status: state.status.toUpperCase(),
          test: state.test,
          trial: state.trial,
          trialEndsAt: state.trialEndsAt,
          cancelAtEndOfCycle: state.cancelAtEndOfCycle,
          currentPeriodEnd: state.currentPeriodEnd,
        }
      : null,
  };
}

export async function readCachedBillingStatus(shop) {
  const normalizedShop = normalizeShop(shop);
  const configuration = getBillingConfiguration(normalizedShop);
  const rows = await readBillingRows(normalizedShop);
  return publicBillingResult(configuration, stateFromRows(rows));
}

export async function refreshBillingStatus({
  admin = null,
  shop,
  planHandle = "",
} = {}) {
  const normalizedShop = normalizeShop(shop);
  const configuration = getBillingConfiguration(normalizedShop);
  const rows = await readBillingRows(normalizedShop);
  const previousState = stateFromRows(rows);
  const checkedAt = new Date();
  let shopId = previousState.shopId;

  try {
    if (!configuration.configured) {
      throw new Error(
        "Shopify Partner API billing variables are not fully configured.",
      );
    }
    shopId = await resolveShopId(
      admin,
      normalizedShop,
      previousState.shopId,
    );
    const data = await queryPartnerBilling(configuration, shopId);
    const state = deriveBillingState({
      activeSubscription: data.activeSubscription,
      lifecycleEvents:
        data.events?.edges?.map((edge) => edge.node) || [],
      checkedAt,
      requestedPlanHandle: planHandle,
      configuredPublicPlanHandle: configuration.publicPlanHandle,
      configuredTestPlanHandle: configuration.testPlanHandle,
      configuredPlanName: configuration.planName,
      previousState,
    });
    await persistBillingState(normalizedShop, state, shopId);
    console.log(
      `[botshield-billing] shop=${normalizedShop} status=${state.status} active=${state.active} test=${state.test} trial=${state.trial} verified=true`,
    );
    return publicBillingResult(configuration, state);
  } catch (error) {
    const state = createUnavailableBillingState({
      checkedAt,
      planHandle: planHandle || previousState.planHandle,
      error:
        error instanceof Error
          ? error.message
          : "Unable to verify Shopify subscription.",
    });
    await persistBillingState(normalizedShop, state, shopId);
    console.warn(
      `[botshield-billing] shop=${normalizedShop} status=unavailable active=false verified=false`,
    );
    return publicBillingResult(configuration, state);
  }
}

export async function refreshBillingStatusIfStale(shop) {
  const normalizedShop = normalizeShop(shop);
  const configuration = getBillingConfiguration(normalizedShop);
  const cached = await readCachedBillingStatus(normalizedShop);

  if (!configuration.enforcementEnabled) return cached;

  const lastCheckedAt = parseDate(cached.checkedAt);
  const fresh =
    lastCheckedAt &&
    Date.now() - lastCheckedAt.getTime() < getRefreshIntervalMs();
  if (fresh) return cached;

  if (!refreshes.has(normalizedShop)) {
    refreshes.set(
      normalizedShop,
      refreshBillingStatus({ shop: normalizedShop }).finally(() => {
        refreshes.delete(normalizedShop);
      }),
    );
  }
  return refreshes.get(normalizedShop);
}
