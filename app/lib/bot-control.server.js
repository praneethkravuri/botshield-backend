import db from "../db.server";
import {
  buildDetectionSettings,
  normalizeIpAddress,
} from "./bot-detection.server";
import { getEmailProviderStatus } from "./incident-alerts.server";

function toBooleanString(value, fallback = false) {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "false") return normalized;
  }
  return fallback ? "true" : "false";
}

function parseDbBoolean(value, fallback = false) {
  if (value == null) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return fallback;
}

function normalizeShop(shop) {
  const normalized = String(shop || "")
    .trim()
    .toLowerCase();
  if (!normalized) {
    throw new Error("A valid shop is required");
  }
  return normalized;
}

export async function getAppSettings(shop) {
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
            "emailAlerts",
            "highRiskAlertsOnly",
            "alertEmail",
            "lastAlertStatus",
            "lastAlertSentAt",
            "lastAlertEventId",
            "lastAlertAttemptAt",
            "lastAlertProviderMessageId",
            "lastAlertError",
            "weeklyReportsEnabled",
            "lastWeeklyReportAt",
            "lastWeeklyReportStatus",
            "lastWeeklyReportAttemptAt",
            "lastWeeklyReportProviderMessageId",
            "lastWeeklyReportError",
          ],
        },
      },
      select: { key: true, value: true },
    });
    const detectionSettings = buildDetectionSettings(rows);
    const settingMap = new Map(rows.map((row) => [row.key, row.value]));
    return {
      ...detectionSettings,
      emailAlerts: parseDbBoolean(settingMap.get("emailAlerts"), false),
      highRiskAlertsOnly: parseDbBoolean(
        settingMap.get("highRiskAlertsOnly"),
        true,
      ),
      alertEmail: settingMap.get("alertEmail") || "",
      lastAlertStatus: settingMap.get("lastAlertStatus") || null,
      lastAlertSentAt: settingMap.get("lastAlertSentAt") || null,
      lastAlertEventId: settingMap.get("lastAlertEventId") || null,
      lastAlertAttemptAt: settingMap.get("lastAlertAttemptAt") || null,
      lastAlertProviderMessageId:
        settingMap.get("lastAlertProviderMessageId") || null,
      lastAlertError: settingMap.get("lastAlertError") || null,
      weeklyReportsEnabled: parseDbBoolean(
        settingMap.get("weeklyReportsEnabled"),
        false,
      ),
      lastWeeklyReportAt: settingMap.get("lastWeeklyReportAt") || null,
      lastWeeklyReportStatus:
        settingMap.get("lastWeeklyReportStatus") || null,
      lastWeeklyReportAttemptAt:
        settingMap.get("lastWeeklyReportAttemptAt") || null,
      lastWeeklyReportProviderMessageId:
        settingMap.get("lastWeeklyReportProviderMessageId") || null,
      lastWeeklyReportError:
        settingMap.get("lastWeeklyReportError") || null,
      emailProvider: getEmailProviderStatus(),
    };
  } catch {
    return {
      ...buildDetectionSettings([]),
      emailAlerts: false,
      highRiskAlertsOnly: true,
      alertEmail: "",
      lastAlertStatus: null,
      lastAlertSentAt: null,
      lastAlertEventId: null,
      lastAlertAttemptAt: null,
      lastAlertProviderMessageId: null,
      lastAlertError: null,
      weeklyReportsEnabled: false,
      lastWeeklyReportAt: null,
      lastWeeklyReportStatus: null,
      lastWeeklyReportAttemptAt: null,
      lastWeeklyReportProviderMessageId: null,
      lastWeeklyReportError: null,
      emailProvider: getEmailProviderStatus(),
    };
  }
}

export async function saveAppSettings(shop, input = {}) {
  const normalizedShop = normalizeShop(shop);
  const autoBlock = toBooleanString(input.autoBlock, true);
  const strictMode = toBooleanString(input.strictMode, false);
  const blockLevel = ["Low", "Medium", "High"].includes(input.blockLevel)
    ? input.blockLevel
    : "Medium";
  const protectionPausedUntil = input.protectionPausedUntil
    ? new Date(input.protectionPausedUntil)
    : null;
  const normalizedPause =
    protectionPausedUntil && !Number.isNaN(protectionPausedUntil.getTime())
      ? protectionPausedUntil.toISOString()
      : "";
  const emailAlerts = toBooleanString(input.emailAlerts, false);
  const highRiskAlertsOnly = toBooleanString(
    input.highRiskAlertsOnly,
    true,
  );
  const alertEmail = String(input.alertEmail || "").trim();
  const weeklyReportsEnabled = toBooleanString(
    input.weeklyReportsEnabled,
    false,
  );

  if (
    emailAlerts === "true" &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(alertEmail)
  ) {
    throw new Error("A valid alert email is required when email alerts are enabled");
  }

  await db.$transaction(
    Object.entries({
      autoBlock,
      strictMode,
      blockLevel,
      protectionPausedUntil: normalizedPause,
      emailAlerts,
      highRiskAlertsOnly,
      alertEmail,
      weeklyReportsEnabled,
    }).map(([key, value]) =>
      db.appSetting.upsert({
        where: { shop_key: { shop: normalizedShop, key } },
        create: { shop: normalizedShop, key, value },
        update: { value },
      }),
    ),
  );

  return getAppSettings(normalizedShop);
}

export async function recordStorefrontHeartbeat(shop, occurredAt = new Date()) {
  const normalizedShop = normalizeShop(shop);
  const value = occurredAt.toISOString();

  await db.appSetting.upsert({
    where: {
      shop_key: { shop: normalizedShop, key: "lastStorefrontHeartbeatAt" },
    },
    create: {
      shop: normalizedShop,
      key: "lastStorefrontHeartbeatAt",
      value,
    },
    update: { value },
  });

  return value;
}

export async function getProtectionStatus(shop) {
  const normalizedShop = normalizeShop(shop);
  const [settings, metadata, blocklistCount, whitelistCount, realEventsToday] =
    await Promise.all([
      getAppSettings(normalizedShop),
      db.appSetting.findMany({
        where: {
          shop: normalizedShop,
          key: {
            in: ["lastStorefrontHeartbeatAt", "lastStorefrontDecisionAt"],
          },
        },
        select: { key: true, value: true },
      }),
      db.blockedIP.count({
        where: { shop: normalizedShop, active: true },
      }),
      db.whitelistIP.count({
        where: { shop: normalizedShop, active: true },
      }),
      db.botEvent.count({
        where: {
          shop: normalizedShop,
          source: "storefront-proxy",
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

  const metadataMap = new Map(metadata.map((row) => [row.key, row.value]));
  const lastHeartbeatAt = metadataMap.get("lastStorefrontHeartbeatAt") || null;
  const lastDecisionAt = metadataMap.get("lastStorefrontDecisionAt") || null;
  const heartbeatAge = lastHeartbeatAt
    ? Date.now() - new Date(lastHeartbeatAt).getTime()
    : Number.POSITIVE_INFINITY;
  const themeEmbedDetected = heartbeatAge <= 15 * 60 * 1000;
  const protectionPaused =
    Boolean(settings.protectionPausedUntil) &&
    new Date(settings.protectionPausedUntil).getTime() > Date.now();

  return {
    shop: normalizedShop,
    appInstalled: true,
    themeEmbedDetected,
    lastStorefrontHeartbeatAt: lastHeartbeatAt,
    lastStorefrontDecisionAt: lastDecisionAt,
    protectionActive: themeEmbedDetected && !protectionPaused,
    protectionPaused,
    protectionPausedUntil: settings.protectionPausedUntil,
    blocklistCount,
    whitelistCount,
    realEventsToday,
  };
}

export async function getBlockedIps(shop) {
  const normalizedShop = normalizeShop(shop);

  try {
    const rows = await db.blockedIP.findMany({
      where: { shop: normalizedShop },
      orderBy: { updatedAt: "desc" },
    });

    return rows.map((row) => ({
      id: row.id,
      ipAddress: row.ipAddress,
      reason: row.reason ?? "",
      source: row.source ?? "local-engine",
      hits: row.hits ?? 0,
      active: parseDbBoolean(row.active, true),
      expiresAt: row.expiresAt,
      lastSeenAt: row.lastSeenAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  } catch {
    return [];
  }
}

export async function upsertBlockedIp(shop, input = {}) {
  const normalizedShop = normalizeShop(shop);
  const ipAddress = normalizeIpAddress(input.ipAddress);
  if (!ipAddress || ipAddress === "0.0.0.0") {
    throw new Error("A valid IP address is required");
  }

  const now = new Date();
  const reason = input.reason ? String(input.reason) : "Manual block";
  const source = input.source ? String(input.source) : "dashboard";
  const active = input.active !== false;
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;

  const row = await db.blockedIP.upsert({
    where: { shop_ipAddress: { shop: normalizedShop, ipAddress } },
    create: {
      shop: normalizedShop,
      ipAddress,
      reason,
      source,
      hits: 1,
      active,
      expiresAt,
      lastSeenAt: now,
    },
    update: {
      reason,
      source,
      active,
      expiresAt,
      hits: source === "dashboard" ? undefined : { increment: 1 },
      lastSeenAt: now,
    },
  });
  return {
    id: row.id,
    ipAddress: row.ipAddress,
    reason: row.reason ?? "",
    source: row.source ?? "dashboard",
    hits: row.hits ?? 0,
    active: parseDbBoolean(row.active, true),
    expiresAt: row.expiresAt,
    lastSeenAt: row.lastSeenAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function removeBlockedIp(shop, ipAddress) {
  const normalizedShop = normalizeShop(shop);
  const normalized = normalizeIpAddress(ipAddress);
  if (!normalized || normalized === "0.0.0.0") {
    throw new Error("A valid IP address is required");
  }

  await db.blockedIP.deleteMany({
    where: { shop: normalizedShop, ipAddress: normalized },
  });

  return { ok: true, ipAddress: normalized };
}

export async function getWhitelistIps(shop) {
  const normalizedShop = normalizeShop(shop);

  try {
    const rows = await db.whitelistIP.findMany({
      where: { shop: normalizedShop },
      orderBy: { updatedAt: "desc" },
    });

    return rows.map((row) => ({
      id: row.id,
      ipAddress: row.ipAddress,
      label: row.label ?? "",
      notes: row.notes ?? "",
      active: parseDbBoolean(row.active, true),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  } catch {
    return [];
  }
}

export async function upsertWhitelistIp(shop, input = {}) {
  const normalizedShop = normalizeShop(shop);
  const ipAddress = normalizeIpAddress(input.ipAddress);
  if (!ipAddress || ipAddress === "0.0.0.0") {
    throw new Error("A valid IP address is required");
  }

  const label = input.label ? String(input.label) : "";
  const notes = input.notes ? String(input.notes) : "";
  const active = input.active !== false;

  const [row] = await db.$transaction([
    db.whitelistIP.upsert({
      where: { shop_ipAddress: { shop: normalizedShop, ipAddress } },
      create: {
        shop: normalizedShop,
        ipAddress,
        label,
        notes,
        active,
      },
      update: { label, notes, active },
    }),
    db.blockedIP.deleteMany({
      where: { shop: normalizedShop, ipAddress },
    }),
  ]);
  return {
    id: row.id,
    ipAddress: row.ipAddress,
    label: row.label ?? "",
    notes: row.notes ?? "",
    active: parseDbBoolean(row.active, true),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function removeWhitelistIp(shop, ipAddress) {
  const normalizedShop = normalizeShop(shop);
  const normalized = normalizeIpAddress(ipAddress);
  if (!normalized || normalized === "0.0.0.0") {
    throw new Error("A valid IP address is required");
  }

  await db.whitelistIP.deleteMany({
    where: { shop: normalizedShop, ipAddress: normalized },
  });

  return { ok: true, ipAddress: normalized };
}
