import db from "../db.server";

function parseBoolean(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

export function getBillingConfiguration(shop) {
  const appHandle = process.env.SHOPIFY_APP_HANDLE?.trim() || "";
  const storeHandle = String(shop || "").split(".")[0];
  return {
    appHandle,
    configured: Boolean(appHandle),
    enforcementEnabled: parseBoolean(
      process.env.BILLING_ENFORCEMENT_ENABLED,
    ),
    planName: process.env.BILLING_PLAN_NAME?.trim() || "BotShield Pro",
    monthlyPrice: Number(process.env.BILLING_MONTHLY_PRICE || 30),
    trialDays: Number(process.env.BILLING_TRIAL_DAYS || 7),
    pricingUrl:
      appHandle && storeHandle
        ? `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`
        : null,
  };
}

export async function readBillingStatus(admin, shop) {
  const configuration = getBillingConfiguration(shop);
  try {
    const response = await admin.graphql(`#graphql
      query BotShieldBillingStatus {
        currentAppInstallation {
          activeSubscriptions {
            id
            name
            status
            test
            trialDays
            createdAt
            currentPeriodEnd
          }
        }
      }
    `);
    const payload = await response.json();
    const subscriptions =
      payload?.data?.currentAppInstallation?.activeSubscriptions || [];
    const subscription =
      subscriptions.find((item) => item.status === "ACTIVE") ||
      subscriptions[0] ||
      null;
    const active = Boolean(subscription && subscription.status === "ACTIVE");
    const checkedAt = new Date().toISOString();

    await db.$transaction(
      Object.entries({
        billingActive: active ? "true" : "false",
        billingLastCheckedAt: checkedAt,
        billingPlanName: subscription?.name || "",
        billingSubscriptionId: subscription?.id || "",
        billingTest: subscription?.test ? "true" : "false",
        billingCurrentPeriodEnd: subscription?.currentPeriodEnd || "",
      }).map(([key, value]) =>
        db.appSetting.upsert({
          where: { shop_key: { shop, key } },
          create: { shop, key, value },
          update: { value },
        }),
      ),
    );

    return {
      ...configuration,
      active,
      subscription,
      checkedAt,
      status: active ? "active" : "inactive",
    };
  } catch (error) {
    return {
      ...configuration,
      active: false,
      subscription: null,
      checkedAt: new Date().toISOString(),
      status: "unavailable",
      error:
        error instanceof Error
          ? error.message
          : "Unable to retrieve Shopify billing status.",
    };
  }
}
