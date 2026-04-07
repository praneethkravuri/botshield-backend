import db from "../db.server";
import { buildDetectionSettings, normalizeIpAddress } from "./bot-detection.server";

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

export async function getAppSettings() {
  try {
    const rows = await db.$queryRaw`
      SELECT key, value
      FROM AppSetting
      WHERE key IN ('autoBlock', 'blockLevel', 'strictMode')
    `;
    return buildDetectionSettings(rows);
  } catch {
    return buildDetectionSettings([]);
  }
}

export async function saveAppSettings(input = {}) {
  const autoBlock = toBooleanString(input.autoBlock, true);
  const strictMode = toBooleanString(input.strictMode, false);
  const blockLevel = ["Low", "Medium", "High"].includes(input.blockLevel)
    ? input.blockLevel
    : "Medium";

  const now = new Date().toISOString();

  await db.$executeRaw`
    INSERT INTO AppSetting (key, value, createdAt, updatedAt)
    VALUES ('autoBlock', ${autoBlock}, ${now}, ${now})
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updatedAt = excluded.updatedAt
  `;

  await db.$executeRaw`
    INSERT INTO AppSetting (key, value, createdAt, updatedAt)
    VALUES ('strictMode', ${strictMode}, ${now}, ${now})
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updatedAt = excluded.updatedAt
  `;

  await db.$executeRaw`
    INSERT INTO AppSetting (key, value, createdAt, updatedAt)
    VALUES ('blockLevel', ${blockLevel}, ${now}, ${now})
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updatedAt = excluded.updatedAt
  `;

  return getAppSettings();
}

export async function getBlockedIps() {
  try {
    const rows = await db.$queryRaw`
      SELECT
        id,
        ipAddress,
        reason,
        source,
        hits,
        active,
        expiresAt,
        lastSeenAt,
        createdAt,
        updatedAt
      FROM BlockedIP
      ORDER BY updatedAt DESC
    `;

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

export async function upsertBlockedIp(input = {}) {
  const ipAddress = normalizeIpAddress(input.ipAddress);
  if (!ipAddress || ipAddress === "0.0.0.0") {
    throw new Error("A valid IP address is required");
  }

  const now = new Date().toISOString();
  const reason = input.reason ? String(input.reason) : "Manual block";
  const source = input.source ? String(input.source) : "dashboard";
  const active = input.active === false ? 0 : 1;
  const expiresAt = input.expiresAt ? new Date(input.expiresAt).toISOString() : null;

  await db.$executeRaw`
    INSERT INTO BlockedIP (
      ipAddress,
      reason,
      source,
      hits,
      active,
      expiresAt,
      lastSeenAt,
      createdAt,
      updatedAt
    )
    VALUES (
      ${ipAddress},
      ${reason},
      ${source},
      ${1},
      ${active},
      ${expiresAt},
      ${now},
      ${now},
      ${now}
    )
    ON CONFLICT(ipAddress) DO UPDATE SET
      reason = excluded.reason,
      source = excluded.source,
      active = excluded.active,
      expiresAt = excluded.expiresAt,
      hits = CASE
        WHEN excluded.source = 'dashboard' THEN BlockedIP.hits
        ELSE BlockedIP.hits + 1
      END,
      lastSeenAt = excluded.lastSeenAt,
      updatedAt = excluded.updatedAt
  `;

  const rows = await db.$queryRaw`
    SELECT
      id,
      ipAddress,
      reason,
      source,
      hits,
      active,
      expiresAt,
      lastSeenAt,
      createdAt,
      updatedAt
    FROM BlockedIP
    WHERE ipAddress = ${ipAddress}
    LIMIT 1
  `;

  const row = rows[0];
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

export async function removeBlockedIp(ipAddress) {
  const normalized = normalizeIpAddress(ipAddress);
  if (!normalized || normalized === "0.0.0.0") {
    throw new Error("A valid IP address is required");
  }

  await db.$executeRaw`
    DELETE FROM BlockedIP
    WHERE ipAddress = ${normalized}
  `;

  return { ok: true, ipAddress: normalized };
}

export async function getWhitelistIps() {
  try {
    const rows = await db.$queryRaw`
      SELECT
        id,
        ipAddress,
        label,
        notes,
        active,
        createdAt,
        updatedAt
      FROM WhitelistIP
      ORDER BY updatedAt DESC
    `;

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

export async function upsertWhitelistIp(input = {}) {
  const ipAddress = normalizeIpAddress(input.ipAddress);
  if (!ipAddress || ipAddress === "0.0.0.0") {
    throw new Error("A valid IP address is required");
  }

  const label = input.label ? String(input.label) : "";
  const notes = input.notes ? String(input.notes) : "";
  const active = input.active === false ? 0 : 1;
  const now = new Date().toISOString();

  await db.$executeRaw`
    INSERT INTO WhitelistIP (
      ipAddress,
      label,
      notes,
      active,
      createdAt,
      updatedAt
    )
    VALUES (
      ${ipAddress},
      ${label},
      ${notes},
      ${active},
      ${now},
      ${now}
    )
    ON CONFLICT(ipAddress) DO UPDATE SET
      label = excluded.label,
      notes = excluded.notes,
      active = excluded.active,
      updatedAt = excluded.updatedAt
  `;

  await db.$executeRaw`
    DELETE FROM BlockedIP
    WHERE ipAddress = ${ipAddress}
  `;

  const rows = await db.$queryRaw`
    SELECT
      id,
      ipAddress,
      label,
      notes,
      active,
      createdAt,
      updatedAt
    FROM WhitelistIP
    WHERE ipAddress = ${ipAddress}
    LIMIT 1
  `;

  const row = rows[0];
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

export async function removeWhitelistIp(ipAddress) {
  const normalized = normalizeIpAddress(ipAddress);
  if (!normalized || normalized === "0.0.0.0") {
    throw new Error("A valid IP address is required");
  }

  await db.$executeRaw`
    DELETE FROM WhitelistIP
    WHERE ipAddress = ${normalized}
  `;

  return { ok: true, ipAddress: normalized };
}
