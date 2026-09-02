import db from "../db.server";
import {
  buildDetectionSettings,
  detectBotThreat,
  normalizeIpAddress,
} from "../lib/bot-detection.server";
import { authenticate } from "../shopify.server";

function normalizeShop(shop) {
  return String(shop || "")
    .trim()
    .toLowerCase();
}

async function readSettings(shop) {
  const normalizedShop = normalizeShop(shop);

  try {
    const rows = await db.appSetting.findMany({
      where: {
        shop: normalizedShop,
        key: {
          in: [
            "autoBlock",
            "blockLevel",
            "strictMode",
            "protectionPausedUntil",
          ],
        },
      },
      select: { key: true, value: true },
    });
    return buildDetectionSettings(rows);
  } catch {
    return buildDetectionSettings([]);
  }
}

async function readWhitelist(shop, ipAddress) {
  const normalizedShop = normalizeShop(shop);

  try {
    return await db.whitelistIP.findUnique({
      where: { shop_ipAddress: { shop: normalizedShop, ipAddress } },
    });
  } catch {
    return null;
  }
}

async function readBlocked(shop, ipAddress) {
  const normalizedShop = normalizeShop(shop);

  try {
    return await db.blockedIP.findFirst({
      where: {
        shop: normalizedShop,
        ipAddress,
        active: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
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
  const source =
    body.source === "dashboard-simulation"
      ? "dashboard-simulation"
      : "dashboard-diagnostic";

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [recentEvents, settings, whitelistEntry, blockedEntry] =
    await Promise.all([
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

  const createdEvent = await db.botEvent.create({
    data: {
      shop,
      ipAddress,
      userAgent,
      threatLevel: result.threatLevel,
      action: result.actionTaken,
      path: pathVisited,
      riskScore: result.riskScore,
      reasonSummary: [
        ...(result.reasonCodes || []).map((code) => `[${code}]`),
        ...result.reasons,
      ].join(" | "),
      source,
    },
  });

  return Response.json({
    id: createdEvent.id,
    ipAddress,
    threatLevel: result.threatLevel,
    actionTaken: result.actionTaken,
    action: result.actionTaken,
    pathVisited,
    riskScore: result.riskScore,
    reasons: result.reasons,
    reasonCodes: result.reasonCodes,
    summary: result.summary,
    settings,
    source,
    createdAt: createdEvent.createdAt,
    simulation: true,
    enforcementApplied: false,
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
