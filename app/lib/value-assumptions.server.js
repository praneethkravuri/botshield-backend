import db from "../db.server.js";
import {
  DEFAULT_VALUE_ASSUMPTIONS,
  sanitizeAssumptions,
} from "./value-calculations.js";

const ASSUMPTION_KEYS = {
  estimatedValuePerBlockedEvent: "valueAssumption_blockedEventValue",
  estimatedValuePerChallenge: "valueAssumption_challengeEventValue",
  staffMinutesSavedPerIntervention: "valueAssumption_staffMinutesPerIntervention",
  staffHourlyCost: "valueAssumption_staffHourlyCost",
  merchantConfigured: "valueAssumption_merchantConfigured",
};

function normalizeShop(shop) {
  return String(shop || "").trim().toLowerCase();
}

function parseStoredNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function getValueAssumptions(shop, dbClient = db) {
  const normalizedShop = normalizeShop(shop);
  const rows = await dbClient.appSetting.findMany({
    where: {
      shop: normalizedShop,
      key: { in: Object.values(ASSUMPTION_KEYS) },
    },
    select: { key: true, value: true },
  });
  const map = new Map(rows.map((row) => [row.key, row.value]));
  const merchantConfigured =
    String(map.get(ASSUMPTION_KEYS.merchantConfigured) || "").toLowerCase() ===
    "true";

  return sanitizeAssumptions(
    {
      estimatedValuePerBlockedEvent: parseStoredNumber(
        map.get(ASSUMPTION_KEYS.estimatedValuePerBlockedEvent),
      ),
      estimatedValuePerChallenge: parseStoredNumber(
        map.get(ASSUMPTION_KEYS.estimatedValuePerChallenge),
      ),
      staffMinutesSavedPerIntervention: parseStoredNumber(
        map.get(ASSUMPTION_KEYS.staffMinutesSavedPerIntervention),
      ),
      staffHourlyCost: parseStoredNumber(map.get(ASSUMPTION_KEYS.staffHourlyCost)),
    },
    { merchantConfigured },
  );
}

export async function saveValueAssumptions(
  shop,
  input,
  { reset = false, dbClient = db } = {},
) {
  const normalizedShop = normalizeShop(shop);
  const assumptions = reset
    ? sanitizeAssumptions(DEFAULT_VALUE_ASSUMPTIONS, { merchantConfigured: false })
    : sanitizeAssumptions(input, { merchantConfigured: true });

  await dbClient.$transaction(
    Object.entries({
      [ASSUMPTION_KEYS.estimatedValuePerBlockedEvent]:
        String(assumptions.estimatedValuePerBlockedEvent),
      [ASSUMPTION_KEYS.estimatedValuePerChallenge]: String(
        assumptions.estimatedValuePerChallenge,
      ),
      [ASSUMPTION_KEYS.staffMinutesSavedPerIntervention]: String(
        assumptions.staffMinutesSavedPerIntervention,
      ),
      [ASSUMPTION_KEYS.staffHourlyCost]: String(assumptions.staffHourlyCost),
      [ASSUMPTION_KEYS.merchantConfigured]: assumptions.merchantConfigured
        ? "true"
        : "false",
    }).map(([key, value]) =>
      dbClient.appSetting.upsert({
        where: { shop_key: { shop: normalizedShop, key } },
        create: { shop: normalizedShop, key, value },
        update: { value },
      }),
    ),
  );

  return assumptions;
}
