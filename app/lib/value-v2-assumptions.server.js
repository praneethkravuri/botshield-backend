import {
  VALUE_V2_ASSUMPTION_DEFAULTS,
  sanitizeValueV2Assumptions,
} from "./value-v2-calculations.js";

let defaultDbPromise = null;

async function resolveDbClient(dbClient) {
  if (dbClient) return dbClient;
  if (!defaultDbPromise) {
    defaultDbPromise = import("../db.server.js").then((module) => module.default);
  }
  return defaultDbPromise;
}

const ASSUMPTION_KEYS = {
  estimatedValuePerBlockedEvent: "valueAssumption_blockedEventValue",
  estimatedValuePerChallenge: "valueAssumption_challengeEventValue",
  staffMinutesSavedPerIntervention: "valueAssumption_staffMinutesPerIntervention",
  staffHourlyCost: "valueAssumption_staffHourlyCost",
  merchantConfigured: "valueAssumption_merchantConfigured",
};

function parseStoredNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export async function getValueV2Assumptions(shop, dbClient) {
  const client = await resolveDbClient(dbClient);
  const rows = await client.appSetting.findMany({
    where: {
      shop,
      key: { in: Object.values(ASSUMPTION_KEYS) },
    },
    select: { key: true, value: true },
  });
  const map = new Map(rows.map((row) => [row.key, row.value]));

  return sanitizeValueV2Assumptions({
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
    merchantConfigured: map.get(ASSUMPTION_KEYS.merchantConfigured) === "true",
  });
}

export async function saveValueV2Assumptions(shop, input, dbClient) {
  const client = await resolveDbClient(dbClient);
  const sanitized = sanitizeValueV2Assumptions({
    ...input,
    merchantConfigured: true,
  });

  await Promise.all(
    Object.entries(ASSUMPTION_KEYS).map(([field, key]) =>
      client.appSetting.upsert({
        where: { shop_key: { shop, key } },
        create: {
          shop,
          key,
          value:
            field === "merchantConfigured"
              ? "true"
              : String(sanitized[field]),
        },
        update: {
          value:
            field === "merchantConfigured"
              ? "true"
              : String(sanitized[field]),
        },
      }),
    ),
  );

  return getValueV2Assumptions(shop, client);
}

export async function resetValueV2Assumptions(shop, dbClient) {
  const client = await resolveDbClient(dbClient);
  await Promise.all(
    Object.values(ASSUMPTION_KEYS).map((key) =>
      client.appSetting.deleteMany({ where: { shop, key } }),
    ),
  );
  return { ...VALUE_V2_ASSUMPTION_DEFAULTS };
}
