export const STOREFRONT_REPORTING_FRESH_MS = 15 * 60 * 1000;

function parseTimestamp(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getLastStorefrontReportingAt(
  lastStorefrontHeartbeatAt,
  lastStorefrontDecisionAt,
) {
  const candidates = [
    parseTimestamp(lastStorefrontHeartbeatAt),
    parseTimestamp(lastStorefrontDecisionAt),
  ].filter(Boolean);

  if (!candidates.length) return null;

  return new Date(
    Math.max(...candidates.map((date) => date.getTime())),
  ).toISOString();
}

export function isStorefrontReportingActive(
  lastStorefrontHeartbeatAt,
  lastStorefrontDecisionAt,
  now = Date.now(),
  freshMs = STOREFRONT_REPORTING_FRESH_MS,
) {
  const lastReportingAt = getLastStorefrontReportingAt(
    lastStorefrontHeartbeatAt,
    lastStorefrontDecisionAt,
  );
  if (!lastReportingAt) return false;

  return now - new Date(lastReportingAt).getTime() <= freshMs;
}

export function getStorefrontReportingFreshness(
  lastStorefrontHeartbeatAt,
  lastStorefrontDecisionAt,
  now = Date.now(),
  freshMs = STOREFRONT_REPORTING_FRESH_MS,
) {
  const lastReportingAt = getLastStorefrontReportingAt(
    lastStorefrontHeartbeatAt,
    lastStorefrontDecisionAt,
  );
  const ageMs = lastReportingAt
    ? now - new Date(lastReportingAt).getTime()
    : Number.POSITIVE_INFINITY;

  return {
    lastReportingAt,
    ageMs,
    active: ageMs <= freshMs,
    freshMs,
  };
}
