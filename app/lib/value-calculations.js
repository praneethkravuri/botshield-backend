/** Average calendar month length used for plan-cost allocation. */
export const AVERAGE_MONTH_DAYS = 365 / 12;

export const VALUE_RANGE_OPTIONS = {
  "7d": { days: 7, bucket: "day", label: "7D" },
  "30d": { days: 30, bucket: "day", label: "30D" },
  "90d": { days: 90, bucket: "day", label: "90D" },
  "12m": { days: 365, bucket: "month", label: "12M" },
};

export const VALUE_ASSUMPTION_LIMITS = {
  estimatedValuePerBlockedEvent: { min: 0, max: 1_000_000 },
  estimatedValuePerChallenge: { min: 0, max: 1_000_000 },
  staffMinutesSavedPerIntervention: { min: 0, max: 480 },
  staffHourlyCost: { min: 0, max: 1_000_000 },
};

export const DEFAULT_VALUE_ASSUMPTIONS = {
  estimatedValuePerBlockedEvent: 0,
  estimatedValuePerChallenge: 0,
  staffMinutesSavedPerIntervention: 0,
  staffHourlyCost: 0,
  merchantConfigured: false,
};

export function normalizeValueRange(range) {
  const normalized = String(range || "30d").trim().toLowerCase();
  return VALUE_RANGE_OPTIONS[normalized] ? normalized : "30d";
}

export function clampNumber(value, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}

export function sanitizeAssumptions(input = {}, { merchantConfigured = false } = {}) {
  const sanitized = {
    estimatedValuePerBlockedEvent: clampNumber(
      input.estimatedValuePerBlockedEvent,
      VALUE_ASSUMPTION_LIMITS.estimatedValuePerBlockedEvent.min,
      VALUE_ASSUMPTION_LIMITS.estimatedValuePerBlockedEvent.max,
    ),
    estimatedValuePerChallenge: clampNumber(
      input.estimatedValuePerChallenge,
      VALUE_ASSUMPTION_LIMITS.estimatedValuePerChallenge.min,
      VALUE_ASSUMPTION_LIMITS.estimatedValuePerChallenge.max,
    ),
    staffMinutesSavedPerIntervention: clampNumber(
      input.staffMinutesSavedPerIntervention,
      VALUE_ASSUMPTION_LIMITS.staffMinutesSavedPerIntervention.min,
      VALUE_ASSUMPTION_LIMITS.staffMinutesSavedPerIntervention.max,
    ),
    staffHourlyCost: clampNumber(
      input.staffHourlyCost,
      VALUE_ASSUMPTION_LIMITS.staffHourlyCost.min,
      VALUE_ASSUMPTION_LIMITS.staffHourlyCost.max,
    ),
    merchantConfigured: Boolean(merchantConfigured),
  };
  return sanitized;
}

export function assumptionsAreConfigured(assumptions) {
  if (!assumptions?.merchantConfigured) return false;
  return (
    assumptions.estimatedValuePerBlockedEvent > 0 ||
    assumptions.estimatedValuePerChallenge > 0 ||
    (assumptions.staffMinutesSavedPerIntervention > 0 &&
      assumptions.staffHourlyCost > 0)
  );
}

export function countActivity(events = []) {
  let threatsDetected = 0;
  let threatsStopped = 0;
  let challengesIssued = 0;

  for (const event of events) {
    const action = String(event.action || "").toLowerCase();
    if (action === "blocked") threatsStopped += 1;
    if (action === "challenged") challengesIssued += 1;
    if (
      action === "blocked" ||
      action === "challenged" ||
      ["medium", "high"].includes(String(event.threatLevel || "").toLowerCase())
    ) {
      threatsDetected += 1;
    }
  }

  return {
    threatsDetected,
    threatsStopped,
    challengesIssued,
    interventions: threatsStopped + challengesIssued,
  };
}

export function countSuspiciousActivity(suspiciousEvents = []) {
  let threatsStopped = 0;
  let challengesIssued = 0;

  for (const event of suspiciousEvents) {
    const action = String(event.action || "").toLowerCase();
    if (action === "blocked") threatsStopped += 1;
    if (action === "challenged") challengesIssued += 1;
  }

  return {
    threatsDetected: suspiciousEvents.length,
    threatsStopped,
    challengesIssued,
    interventions: threatsStopped + challengesIssued,
  };
}

export function allocatePlanCostForPeriod(monthlyPrice, selectedDays) {
  const price = clampNumber(
    monthlyPrice,
    0,
    Number.MAX_SAFE_INTEGER,
  );
  const days = clampNumber(selectedDays, 0, 366);
  if (price <= 0 || days <= 0) return 0;
  return roundCurrency((price * days) / AVERAGE_MONTH_DAYS);
}

export function calculateDirectProtectedValue(activity, assumptions) {
  const blocked = activity.threatsStopped || 0;
  const challenged = activity.challengesIssued || 0;
  return (
    blocked * (assumptions.estimatedValuePerBlockedEvent || 0) +
    challenged * (assumptions.estimatedValuePerChallenge || 0)
  );
}

export function calculateStaffTimeValue(activity, assumptions) {
  const interventions = activity.interventions || 0;
  const minutes = assumptions.staffMinutesSavedPerIntervention || 0;
  const hourly = assumptions.staffHourlyCost || 0;
  if (interventions <= 0 || minutes <= 0 || hourly <= 0) return 0;
  return roundCurrency(((interventions * minutes) / 60) * hourly);
}

export function calculateEconomics({
  activity,
  assumptions,
  monthlyPrice,
  selectedDays,
}) {
  const allocatedPlanCost = allocatePlanCostForPeriod(monthlyPrice, selectedDays);
  const configured = assumptionsAreConfigured(assumptions);
  const directProtectedValue = configured
    ? calculateDirectProtectedValue(activity, assumptions)
    : 0;
  const staffTimeValue = configured
    ? calculateStaffTimeValue(activity, assumptions)
    : 0;
  const estimatedValueProtected = roundCurrency(
    directProtectedValue + staffTimeValue,
  );
  const estimatedNetValue = roundCurrency(
    estimatedValueProtected - allocatedPlanCost,
  );
  const valueToCostRatio =
    configured && allocatedPlanCost > 0
      ? roundRatio(estimatedValueProtected / allocatedPlanCost)
      : null;
  const costPerStoppedThreat =
    activity.threatsStopped > 0 && allocatedPlanCost >= 0
      ? roundCurrency(allocatedPlanCost / activity.threatsStopped)
      : null;

  return {
    allocatedPlanCost,
    estimatedValueProtected,
    estimatedNetValue,
    valueToCostRatio,
    costPerStoppedThreat,
    assumptionsConfigured: configured,
  };
}

export function buildTrendBuckets({
  events = [],
  rangeDays,
  bucketMode = "day",
  now = Date.now(),
  retentionDays,
}) {
  const effectiveDays = Math.min(rangeDays, retentionDays);
  const end = new Date(now);
  end.setUTCHours(0, 0, 0, 0);

  if (bucketMode === "month") {
    const months = Math.max(1, Math.ceil(effectiveDays / 30));
    const buckets = [];
    for (let index = months - 1; index >= 0; index -= 1) {
      const start = new Date(end);
      start.setUTCDate(1);
      start.setUTCMonth(start.getUTCMonth() - index);
      const key = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
      buckets.push({
        key,
        label: start.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        }),
        startMs: start.getTime(),
        endMs: null,
        blocked: 0,
        challenged: 0,
        detected: 0,
        estimatedValueProtected: 0,
      });
    }
    for (let index = 0; index < buckets.length; index += 1) {
      const next = buckets[index + 1];
      buckets[index].endMs = next ? next.startMs : now + 1;
    }
    for (const event of events) {
      const timestamp = new Date(event.createdAt).getTime();
      if (!Number.isFinite(timestamp)) continue;
      const bucket = buckets.find(
        (entry) => timestamp >= entry.startMs && timestamp < entry.endMs,
      );
      if (!bucket) continue;
      applyEventToBucket(bucket, event);
    }
    return buckets;
  }

  const buckets = [];
  for (let index = effectiveDays - 1; index >= 0; index -= 1) {
    const day = new Date(end);
    day.setUTCDate(day.getUTCDate() - index);
    const key = day.toISOString().slice(0, 10);
    buckets.push({
      key,
      label: day.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
      startMs: day.getTime(),
      endMs: day.getTime() + 24 * 60 * 60 * 1000,
      blocked: 0,
      challenged: 0,
      detected: 0,
      estimatedValueProtected: 0,
    });
  }
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const event of events) {
    const timestamp = new Date(event.createdAt).getTime();
    if (!Number.isFinite(timestamp)) continue;
    const key = new Date(timestamp).toISOString().slice(0, 10);
    const bucket = byKey.get(key);
    if (!bucket) continue;
    applyEventToBucket(bucket, event);
  }
  return buckets;
}

function applyEventToBucket(bucket, event) {
  const action = String(event.action || "").toLowerCase();
  if (action === "blocked") bucket.blocked += 1;
  if (action === "challenged") bucket.challenged += 1;
  if (
    action === "blocked" ||
    action === "challenged" ||
    ["medium", "high"].includes(String(event.threatLevel || "").toLowerCase())
  ) {
    bucket.detected += 1;
  }
}

export function enrichTrendWithEstimates(buckets, assumptions, configured) {
  if (!configured) {
    return buckets.map((bucket) => ({
      ...bucket,
      estimatedValueProtected: null,
    }));
  }
  return buckets.map((bucket) => ({
    ...bucket,
    estimatedValueProtected: roundCurrency(
      bucket.blocked * (assumptions.estimatedValuePerBlockedEvent || 0) +
        bucket.challenged * (assumptions.estimatedValuePerChallenge || 0) +
        (bucket.blocked + bucket.challenged > 0
          ? calculateStaffTimeValue(
              {
                interventions: bucket.blocked + bucket.challenged,
              },
              assumptions,
            )
          : 0),
    ),
  }));
}

export function buildCategoryBreakdown(
  events = [],
  assumptions,
  configured,
  categoryDefinitions = [],
) {
  const totals = Object.fromEntries(
    categoryDefinitions.map((category) => [
      category.id,
      {
        id: category.id,
        label: category.label,
        blocked: 0,
        challenged: 0,
        detected: 0,
        interventions: 0,
        shareOfInterventions: null,
        estimatedValueProtected: null,
      },
    ]),
  );
  totals.uncategorized = {
    id: "uncategorized",
    label: "Other protection signals",
    blocked: 0,
    challenged: 0,
    detected: 0,
    interventions: 0,
    shareOfInterventions: null,
    estimatedValueProtected: null,
  };

  for (const event of events) {
    const categoryId = event.categoryId || "uncategorized";
    const bucket = totals[categoryId] || totals.uncategorized;
    const action = String(event.action || "").toLowerCase();
    bucket.interventions += action === "blocked" || action === "challenged" ? 1 : 0;
    if (action === "blocked") bucket.blocked += 1;
    if (action === "challenged") bucket.challenged += 1;
    if (
      action === "blocked" ||
      action === "challenged" ||
      ["medium", "high"].includes(String(event.threatLevel || "").toLowerCase())
    ) {
      bucket.detected += 1;
    }
  }

  const interventionTotal = Object.values(totals).reduce(
    (sum, row) => sum + row.interventions,
    0,
  );

  return Object.values(totals)
    .filter((row) => row.interventions > 0 || row.detected > 0)
    .map((row) => ({
      ...row,
      shareOfInterventions:
        interventionTotal > 0
          ? Math.round((row.interventions / interventionTotal) * 100)
          : null,
      estimatedValueProtected:
        configured && row.interventions > 0
          ? roundCurrency(
              row.blocked * (assumptions.estimatedValuePerBlockedEvent || 0) +
                row.challenged * (assumptions.estimatedValuePerChallenge || 0) +
                calculateStaffTimeValue(
                  { interventions: row.interventions },
                  assumptions,
                ),
            )
          : null,
    }));
}

export function buildProjection({
  activity,
  assumptions,
  observedDays,
  basisDays,
  configured,
}) {
  const minimumHistoryDays = 7;
  const hasMeaningfulActivity =
    activity.interventions > 0 || activity.threatsDetected > 0;
  if (
    observedDays < minimumHistoryDays ||
    basisDays <= 0 ||
    !hasMeaningfulActivity
  ) {
    return {
      available: false,
      reason:
        observedDays < minimumHistoryDays
          ? "Not enough history to generate a reliable projection yet."
          : "Not enough protection activity to generate a reliable projection yet.",
      basisDays: observedDays,
      next30Days: null,
      next12Months: null,
    };
  }

  const daily = {
    threatsStopped: activity.threatsStopped / basisDays,
    interventions: activity.interventions / basisDays,
    threatsDetected: activity.threatsDetected / basisDays,
  };

  const projectActivity = (days) => ({
    threatsStopped: roundCount(daily.threatsStopped * days),
    interventions: roundCount(daily.interventions * days),
    threatsDetected: roundCount(daily.threatsDetected * days),
  });

  const next30Activity = projectActivity(30);
  const next365Activity = projectActivity(365);

  const estimateForActivity = (projectedActivity) => {
    if (!configured) return null;
    return roundCurrency(
      calculateDirectProtectedValue(projectedActivity, assumptions) +
        calculateStaffTimeValue(projectedActivity, assumptions),
    );
  };

  return {
    available: true,
    reason: null,
    basisDays,
    basisLabel: `Based on ${basisDays} day${basisDays === 1 ? "" : "s"} of available activity`,
    next30Days: {
      ...next30Activity,
      estimatedValueProtected: estimateForActivity(next30Activity),
    },
    next12Months: {
      ...next365Activity,
      estimatedValueProtected: estimateForActivity(next365Activity),
    },
  };
}

export function roundCurrency(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100) / 100;
}

export function roundRatio(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 10) / 10;
}

export function roundCount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed);
}

export function formatCurrency(amount, currencyCode = "USD") {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed)) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(parsed);
  } catch {
    return `$${roundCurrency(parsed).toFixed(2)}`;
  }
}
