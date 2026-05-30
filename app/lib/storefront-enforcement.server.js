import crypto from "node:crypto";
import db from "../db.server";
import { buildDetectionSettings, detectBotThreat, normalizeIpAddress } from "./bot-detection.server";

const CHALLENGE_TTL_MS = 15 * 60 * 1000;

function getSigningSecret() {
  return process.env.BOTSHIELD_SIGNING_SECRET || process.env.SHOPIFY_API_SECRET || "botshield-dev-secret";
}

function normalizeShop(shop) {
  return String(shop || "").trim().toLowerCase();
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
    const rows = await db.$queryRaw`
      SELECT key, value
      FROM AppSetting
      WHERE shop = ${shop}
        AND key IN ('autoBlock', 'blockLevel', 'strictMode')
    `;

    return buildDetectionSettings(rows);
  } catch {
    return buildDetectionSettings([]);
  }
}

async function readWhitelist(shop, ipAddress) {
  try {
    const rows = await db.$queryRaw`
      SELECT ipAddress, label, notes, active
      FROM WhitelistIP
      WHERE shop = ${shop}
        AND ipAddress = ${ipAddress}
      LIMIT 1
    `;

    return rows[0] ?? null;
  } catch {
    return null;
  }
}

async function readBlocked(shop, ipAddress) {
  try {
    const rows = await db.$queryRaw`
      SELECT ipAddress, reason, source, hits, active, expiresAt, lastSeenAt
      FROM BlockedIP
      WHERE shop = ${shop}
        AND ipAddress = ${ipAddress}
      LIMIT 1
    `;

    return rows[0] ?? null;
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

  return Buffer.from(JSON.stringify({ payload, signature }), "utf8").toString("base64url");
}

function verifyChallengeToken(token, { shop, ipAddress, userAgent, pathVisited }) {
  if (!token) return false;

  try {
    const decoded = JSON.parse(Buffer.from(String(token), "base64url").toString("utf8"));
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
  source,
}) {
  const createdRows = await db.$queryRaw`
    INSERT INTO BotEvent (
      shop,
      ipAddress,
      userAgent,
      threatLevel,
      action,
      path,
      riskScore,
      reasonSummary,
      source
    )
    VALUES (
      ${shop},
      ${ipAddress},
      ${userAgent},
      ${threatLevel},
      ${action},
      ${pathVisited},
      ${riskScore},
      ${reasons.join(" | ")},
      ${source}
    )
    RETURNING id, createdAt
  `;

  return createdRows[0];
}

async function upsertBlockedIp({ shop, ipAddress, reasons }) {
  const now = new Date().toISOString();

  await db.$executeRaw`
    INSERT INTO BlockedIP (
      shop,
      ipAddress,
      reason,
      source,
      hits,
      active,
      lastSeenAt,
      createdAt,
      updatedAt
    )
    VALUES (
      ${shop},
      ${ipAddress},
      ${reasons.join(" | ")},
      ${"storefront-proxy"},
      ${1},
      ${true},
      ${now},
      ${now},
      ${now}
    )
    ON CONFLICT(shop, ipAddress) DO UPDATE SET
      reason = excluded.reason,
      source = excluded.source,
      hits = BlockedIP.hits + 1,
      active = 1,
      lastSeenAt = excluded.lastSeenAt,
      updatedAt = excluded.updatedAt
  `;
}

function buildBlockedProxyUrl(request, { reason, eventId, ipAddress }) {
  const url = new URL(request.url);
  url.pathname = "/apps/botshield/blocked";
  url.search = "";
  url.searchParams.set("reason", reason || "Suspicious traffic was detected from this session.");
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
  const userAgent = getRequestHeader(request, "user-agent");
  const source = "storefront-proxy";

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [recentEvents, settings, whitelistEntry, blockedEntry] = await Promise.all([
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
  ]);

  const detection = detectBotThreat({
    ipAddress,
    userAgent,
    pathVisited,
    recentEvents,
    settings,
    whitelistEntry,
    blockedEntry,
  });

  const challengePassed = verifyChallengeToken(challengeToken, {
    shop: normalizedShop,
    ipAddress,
    userAgent,
    pathVisited,
  });

  let decision = "allow";
  if (detection.actionTaken === "blocked" || blockedEntry?.active) {
    decision = "block";
  } else if (
    (detection.threatLevel === "medium" || detection.threatLevel === "high") &&
    !challengePassed
  ) {
    decision = "challenge";
  }

  const actionForLog =
    decision === "block"
      ? "blocked"
      : decision === "challenge"
      ? "challenged"
      : "allowed";

  const event = await writeBotEvent({
    shop: normalizedShop,
    ipAddress,
    userAgent,
    threatLevel: detection.threatLevel,
    action: actionForLog,
    pathVisited,
    riskScore: detection.riskScore,
    reasons: detection.reasons,
    source,
  });

  if (decision === "block") {
    await upsertBlockedIp({
      shop: normalizedShop,
      ipAddress,
      reasons: detection.reasons,
    });
  }

  return {
    decision,
    ipAddress,
    settings,
    riskScore: detection.riskScore,
    threatLevel: detection.threatLevel,
    reasons: detection.reasons,
    summary: detection.summary,
    createdAt: event.createdAt,
    referer,
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
