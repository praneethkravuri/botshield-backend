import crypto from "node:crypto";
import db from "../db.server";
import {
  buildDetectionSettings,
  detectBotThreat,
  normalizeIpAddress,
} from "./bot-detection.server";
import { recordStorefrontHeartbeat } from "./bot-control.server";
import {
  sendIncidentEmail,
  shouldSendIncidentAlert,
} from "./incident-alerts.server";
import {
  getStorefrontActionForLog,
  resolveStorefrontDecision,
} from "./storefront-decision.server";
import { lookupNetworkIntelligence } from "./network-intelligence.server";
import { maybeSendDueWeeklyReport } from "./weekly-reports.server";

const CHALLENGE_TTL_MS = 15 * 60 * 1000;

function getSigningSecret() {
  return (
    process.env.BOTSHIELD_SIGNING_SECRET ||
    process.env.SHOPIFY_API_SECRET ||
    "botshield-dev-secret"
  );
}

function normalizeShop(shop) {
  return String(shop || "")
    .trim()
    .toLowerCase();
}

export function getRequestHeader(request, name) {
  return request.headers.get(name) ?? "";
}

export function extractClientIp(request) {
  const forwardedFor = getRequestHeader(request, "x-forwarded-for");
  if (forwardedFor) {
    return normalizeIpAddress(forwardedFor.split(",")[0]);
  }

  const cfIp = getRequestHeader(request, "cf-connecting-ip");
  if (cfIp) {
    return normalizeIpAddress(cfIp);
  }

  const realIp = getRequestHeader(request, "x-real-ip");
  if (realIp) {
    return normalizeIpAddress(realIp);
  }

  return normalizeIpAddress("");
}

async function readSettings(shop) {
  try {
    const rows = await db.appSetting.findMany({
      where: {
        shop,
        key: {
          in: [
            "autoBlock",
            "blockLevel",
            "strictMode",
            "protectionPausedUntil",
            "emailAlerts",
            "highRiskAlertsOnly",
            "alertEmail",
            "billingActive",
          ],
        },
      },
      select: { key: true, value: true },
    });

    const map = new Map(rows.map((row) => [row.key, row.value]));
    return {
      ...buildDetectionSettings(rows),
      emailAlerts: map.get("emailAlerts") === "true",
      highRiskAlertsOnly: map.get("highRiskAlertsOnly") !== "false",
      alertEmail: map.get("alertEmail") || "",
      billingActive: map.get("billingActive") === "true",
      billingEnforcementEnabled:
        process.env.BILLING_ENFORCEMENT_ENABLED === "true",
    };
  } catch {
    return {
      ...buildDetectionSettings([]),
      emailAlerts: false,
      highRiskAlertsOnly: true,
      alertEmail: "",
      billingActive: false,
      billingEnforcementEnabled:
        process.env.BILLING_ENFORCEMENT_ENABLED === "true",
    };
  }
}

async function readWhitelist(shop, ipAddress) {
  try {
    return await db.whitelistIP.findUnique({
      where: { shop_ipAddress: { shop, ipAddress } },
    });
  } catch {
    return null;
  }
}

async function readBlocked(shop, ipAddress) {
  try {
    return await db.blockedIP.findFirst({
      where: {
        shop,
        ipAddress,
        active: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
  } catch {
    return null;
  }
}

function createChallengeToken({ shop, ipAddress, userAgent, pathVisited }) {
  const expiresAt = Date.now() + CHALLENGE_TTL_MS;
  const payload = JSON.stringify({
    shop,
    ipAddress,
    userAgent,
    pathVisited,
    expiresAt,
  });

  const signature = crypto
    .createHmac("sha256", getSigningSecret())
    .update(payload)
    .digest("hex");

  return Buffer.from(JSON.stringify({ payload, signature }), "utf8").toString(
    "base64url",
  );
}

function verifyChallengeToken(
  token,
  { shop, ipAddress, userAgent, pathVisited },
) {
  if (!token) return false;

  try {
    const decoded = JSON.parse(
      Buffer.from(String(token), "base64url").toString("utf8"),
    );
    const payload = String(decoded.payload || "");
    const signature = String(decoded.signature || "");

    if (!payload || !signature) return false;

    const expectedSignature = crypto
      .createHmac("sha256", getSigningSecret())
      .update(payload)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    const actualBuffer = Buffer.from(signature, "utf8");

    if (expectedBuffer.length !== actualBuffer.length) return false;
    if (!crypto.timingSafeEqual(expectedBuffer, actualBuffer)) return false;

    const parsed = JSON.parse(payload);
    if (parsed.expiresAt < Date.now()) return false;

    return (
      parsed.shop === shop &&
      parsed.ipAddress === ipAddress &&
      parsed.userAgent === userAgent &&
      parsed.pathVisited === pathVisited
    );
  } catch {
    return false;
  }
}

async function writeBotEvent({
  shop,
  ipAddress,
  userAgent,
  threatLevel,
  action,
  pathVisited,
  riskScore,
  reasons,
  reasonCodes = [],
  source,
  networkIntel,
}) {
  return db.botEvent.create({
    data: {
      shop,
      ipAddress,
      userAgent,
      threatLevel,
      action,
      path: pathVisited,
      riskScore,
      reasonSummary: [
        ...reasonCodes.map((code) => `[${code}]`),
        ...reasons,
      ].join(" | "),
      source,
      networkAsn: networkIntel?.asn ?? null,
      networkOrg: networkIntel?.organization || null,
      networkType: networkIntel?.networkType || null,
      networkProvider: networkIntel?.provider || null,
    },
  });
}

async function upsertBlockedIp({ shop, ipAddress, reasons }) {
  const now = new Date();

  await db.blockedIP.upsert({
    where: { shop_ipAddress: { shop, ipAddress } },
    create: {
      shop,
      ipAddress,
      reason: reasons.join(" | "),
      source: "storefront-proxy",
      hits: 1,
      active: true,
      lastSeenAt: now,
    },
    update: {
      reason: reasons.join(" | "),
      source: "storefront-proxy",
      hits: { increment: 1 },
      active: true,
      lastSeenAt: now,
    },
  });
}

function buildBlockedProxyUrl(request, { reason, eventId, ipAddress }) {
  const url = new URL(request.url);
  url.pathname = "/apps/botshield/blocked";
  url.search = "";
  url.searchParams.set(
    "reason",
    reason || "Suspicious traffic was detected from this session.",
  );
  url.searchParams.set("ref", `BS-${String(eventId).padStart(6, "0")}`);
  url.searchParams.set("ip", ipAddress);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

export async function evaluateStorefrontRequest(request, shop) {
  const normalizedShop = normalizeShop(shop);
  const ipAddress = extractClientIp(request);
  const url = new URL(request.url);
  const pathVisited = url.searchParams.get("path") || "/";
  const challengeToken = url.searchParams.get("challenge_token") || "";
  const referer = getRequestHeader(request, "referer");
  const userAgent =
    getRequestHeader(request, "user-agent") ||
    url.searchParams.get("client_user_agent") ||
    "";
  const source = "storefront-proxy";
  const receivedAt = new Date();

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [recentEvents, settings, whitelistEntry, blockedEntry, networkLookup] =
    await Promise.all([
      db.botEvent.findMany({
        where: {
          shop: normalizedShop,
          ipAddress,
          createdAt: { gte: oneHourAgo },
        },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
      readSettings(normalizedShop),
      readWhitelist(normalizedShop, ipAddress),
      readBlocked(normalizedShop, ipAddress),
      lookupNetworkIntelligence(ipAddress),
    ]);
  const networkIntel = networkLookup.intel;

  const detection = detectBotThreat({
    ipAddress,
    userAgent,
    pathVisited,
    recentEvents,
    settings,
    whitelistEntry,
    blockedEntry,
    networkIntel,
  });

  const challengePassed = verifyChallengeToken(challengeToken, {
    shop: normalizedShop,
    ipAddress,
    userAgent,
    pathVisited,
  });

  const resolution = resolveStorefrontDecision({
    detection,
    blockedEntry,
    whitelistEntry,
    challengePassed,
    autoBlock: settings.autoBlock,
    protectionPausedUntil: settings.protectionPausedUntil,
    billingEnforcementEnabled: settings.billingEnforcementEnabled,
    billingActive: settings.billingActive,
  });
  const decision = resolution.decision;
  const reasonCodes = [
    ...new Set([...(detection.reasonCodes || []), ...resolution.reasonCodes]),
  ];

  const actionForLog = getStorefrontActionForLog(decision, reasonCodes);

  const event = await writeBotEvent({
    shop: normalizedShop,
    ipAddress,
    userAgent,
    threatLevel: detection.threatLevel,
    action: actionForLog,
    pathVisited,
    riskScore: detection.riskScore,
    reasons: detection.reasons,
    reasonCodes,
    source,
    networkIntel,
  });

  if (decision === "block" && !resolution.protectionPaused) {
    await upsertBlockedIp({
      shop: normalizedShop,
      ipAddress,
      reasons: detection.reasons,
    });
  }

  await db.$transaction([
    db.appSetting.upsert({
      where: {
        shop_key: {
          shop: normalizedShop,
          key: "lastStorefrontDecisionAt",
        },
      },
      create: {
        shop: normalizedShop,
        key: "lastStorefrontDecisionAt",
        value: receivedAt.toISOString(),
      },
      update: { value: receivedAt.toISOString() },
    }),
  ]);
  await recordStorefrontHeartbeat(normalizedShop, receivedAt);

  const alertDecision = shouldSendIncidentAlert({
    settings,
    decision,
    threatLevel: detection.threatLevel,
    pathVisited,
    recentEvents,
  });
  let alertDelivery = {
    sent: false,
    status: alertDecision.reason.toLowerCase(),
  };

  if (alertDecision.send) {
    alertDelivery = await sendIncidentEmail({
      shop: normalizedShop,
      alertEmail: settings.alertEmail,
      ipAddress,
      pathVisited,
      decision,
      threatLevel: detection.threatLevel,
      riskScore: detection.riskScore,
      reasonCodes,
      eventId: event.id,
      createdAt: event.createdAt.toISOString(),
    });
  }

  if (alertDecision.send) {
    const alertTimestamp = new Date().toISOString();
    const deliverySettings = {
      lastAlertStatus: alertDelivery.status,
      lastAlertAttemptAt: alertTimestamp,
      lastAlertEventId: String(event.id),
      lastAlertProviderMessageId: alertDelivery.providerMessageId || "",
      lastAlertError: alertDelivery.error || "",
      ...(alertDelivery.sent ? { lastAlertSentAt: alertTimestamp } : {}),
    };
    await db.$transaction(
      Object.entries(deliverySettings).map(([key, value]) =>
        db.appSetting.upsert({
          where: { shop_key: { shop: normalizedShop, key } },
          create: { shop: normalizedShop, key, value },
          update: { value },
        }),
      ),
    );
  }

  if (alertDecision.send || alertDelivery.status === "provider_not_configured") {
    console.log(
      `[botshield-alert] shop=${normalizedShop} event=${event.id} status=${alertDelivery.status} sent=${alertDelivery.sent}`,
    );
  }

  maybeSendDueWeeklyReport(normalizedShop).catch((error) => {
    console.error(
      `[botshield-weekly-report] shop=${normalizedShop} status=error message=${error instanceof Error ? error.message : "unknown"}`,
    );
  });

  console.log(
    `[botshield-intel] shop=${normalizedShop} event=${event.id} status=${networkLookup.status} asn=${networkIntel?.asn || "unknown"} vpn=${Boolean(networkIntel?.isVpn || networkIntel?.isProxy)} datacenter=${Boolean(networkIntel?.isDatacenter)}`,
  );

  return {
    decision,
    action: actionForLog,
    eventId: event.id,
    ipAddress,
    settings,
    riskScore: detection.riskScore,
    threatLevel: detection.threatLevel,
    reasons: detection.reasons,
    reasonCodes,
    summary: detection.summary,
    createdAt: event.createdAt,
    protectionPaused: resolution.protectionPaused,
    alertDelivery: {
      sent: alertDelivery.sent,
      status: alertDelivery.status,
    },
    referer,
    networkIntelligence: networkIntel
      ? {
          asn: networkIntel.asn,
          organization: networkIntel.organization,
          type: networkIntel.networkType,
          provider: networkIntel.provider,
          vpn: Boolean(networkIntel.isVpn || networkIntel.isProxy),
          datacenter: networkIntel.isDatacenter,
        }
      : null,
    challengeToken:
      decision === "challenge"
        ? createChallengeToken({
            shop: normalizedShop,
            ipAddress,
            userAgent,
            pathVisited,
          })
        : null,
    blockPageUrl:
      decision === "block"
        ? buildBlockedProxyUrl(request, {
            reason: detection.reasons[0],
            eventId: event.id,
            ipAddress,
          })
        : null,
  };
}
