import db from "../db.server";
import {
  buildDetectionSettings,
  detectBotThreat,
  normalizeIpAddress,
} from "../lib/bot-detection.server";
import { authenticate } from "../shopify.server";

function normalizeShop(shop) {
  return String(shop || "").trim().toLowerCase();
}

async function readSettings(shop) {
  const normalizedShop = normalizeShop(shop);

  try {
    const rows = await db.$queryRaw`
      SELECT key, value
      FROM AppSetting
      WHERE shop = ${normalizedShop}
        AND key IN ('autoBlock', 'blockLevel', 'strictMode')
    `;
    return buildDetectionSettings(rows);
  } catch {
    return buildDetectionSettings([]);
  }
}

async function readWhitelist(shop, ipAddress) {
  const normalizedShop = normalizeShop(shop);

  try {
    const rows = await db.$queryRaw`
      SELECT ipAddress, label, notes, active
      FROM WhitelistIP
      WHERE shop = ${normalizedShop}
        AND ipAddress = ${ipAddress}
      LIMIT 1
    `;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

async function readBlocked(shop, ipAddress) {
  const normalizedShop = normalizeShop(shop);

  try {
    const rows = await db.$queryRaw`
      SELECT ipAddress, reason, source, hits, active, expiresAt, lastSeenAt
      FROM BlockedIP
      WHERE shop = ${normalizedShop}
        AND ipAddress = ${ipAddress}
      LIMIT 1
    `;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

function getRequestHeader(request, name) {
  return request.headers.get(name) ?? "";
}

function extractClientIp(request, bodyIpAddress) {
  if (bodyIpAddress) {
    return normalizeIpAddress(bodyIpAddress);
  }

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

function extractPath(request, bodyPathVisited) {
  if (bodyPathVisited != null && String(bodyPathVisited).trim()) {
    return String(bodyPathVisited);
  }

  const referer = getRequestHeader(request, "referer");
  if (referer) {
    try {
      return new URL(referer).pathname || "/";
    } catch {
      return "/";
    }
  }

  return "/";
}

function buildBlockPageUrl(request, { ipAddress, reasons, eventId }) {
  const url = new URL(request.url);
  url.pathname = "/blocked";
  url.search = "";
  url.searchParams.set(
    "reason",
    reasons?.[0] || "Suspicious traffic was detected from this session.",
  );
  url.searchParams.set("ref", `BS-${String(eventId).padStart(6, "0")}`);
  url.searchParams.set("ip", ipAddress);
  return url.toString();
}

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = normalizeShop(session.shop);

  if (request.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ipAddress = extractClientIp(request, body.ipAddress);
  const userAgent =
    String(body.userAgent ?? "") || getRequestHeader(request, "user-agent");
  const pathVisited = extractPath(request, body.pathVisited);

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [recentEvents, settings, whitelistEntry, blockedEntry] = await Promise.all([
    db.botEvent.findMany({
      where: {
        shop,
        ipAddress,
        createdAt: { gte: oneHourAgo },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    readSettings(shop),
    readWhitelist(shop, ipAddress),
    readBlocked(shop, ipAddress),
  ]);

  const result = detectBotThreat({
    ipAddress,
    userAgent,
    pathVisited,
    recentEvents,
    settings,
    whitelistEntry,
    blockedEntry,
  });

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
      ${result.threatLevel},
      ${result.actionTaken},
      ${pathVisited},
      ${result.riskScore},
      ${result.reasons.join(" | ")},
      ${body.source ? String(body.source) : "dashboard-live-scan"}
    )
    RETURNING id, createdAt
  `;
  const createdEvent = createdRows[0];

  if (result.actionTaken === "blocked") {
    try {
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
          ${result.reasons.join(" | ")},
          ${"local-engine"},
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
    } catch {
      // Ignore until migration / generate is applied.
    }
  }

  return Response.json({
    id: createdEvent.id,
    ipAddress,
    threatLevel: result.threatLevel,
    actionTaken: result.actionTaken,
    action: result.actionTaken,
    pathVisited,
    riskScore: result.riskScore,
    reasons: result.reasons,
    summary: result.summary,
    settings,
    createdAt: createdEvent.createdAt,
    blockPageUrl:
      result.actionTaken === "blocked"
        ? buildBlockPageUrl(request, {
            ipAddress,
            reasons: result.reasons,
            eventId: createdEvent.id,
          })
        : null,
  });
}
