import { BOT_EVENT_RETENTION_DAYS } from "../config/data-retention.js";
import {
  VALUE_V2_CATEGORIES,
  classifyValueV2Category,
  isBlockedEvent,
  isChallengedEvent,
  isDetectedEvent,
  isInterventionEvent,
  isStorefrontEvent,
  normalizeValueV2EventRow,
} from "./value-v2-signals.js";

export const VALUE_V2_RANGE_OPTIONS = [
  { id: "7d", label: "7D", days: 7 },
  { id: "30d", label: "30D", days: 30 },
];

export const VALUE_V2_ASSUMPTION_DEFAULTS = {
  estimatedValuePerBlockedEvent: 0,
  estimatedValuePerChallenge: 0,
  staffMinutesSavedPerIntervention: 0,
  staffHourlyCost: 0,
  merchantConfigured: false,
};

const AVG_MONTH_DAYS = 365 / 12;
const PROJECTION_MIN_OBSERVED_DAYS = 7;
const PROJECTION_MIN_INTERVENTIONS = 1;

export function normalizeValueV2Range(range) {
  const match = VALUE_V2_RANGE_OPTIONS.find((option) => option.id === range);
  return match?.id || "30d";
}

export function getValueV2RangeDays(range) {
  const normalized = normalizeValueV2Range(range);
  return VALUE_V2_RANGE_OPTIONS.find((option) => option.id === normalized)?.days || 30;
}

export function sanitizeValueV2Assumptions(input = {}) {
  const clamp = (value, max = 1_000_000) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return 0;
    return Math.min(numeric, max);
  };

  return {
    estimatedValuePerBlockedEvent: clamp(input.estimatedValuePerBlockedEvent),
    estimatedValuePerChallenge: clamp(input.estimatedValuePerChallenge),
    staffMinutesSavedPerIntervention: clamp(
      input.staffMinutesSavedPerIntervention,
      10_000,
    ),
    staffHourlyCost: clamp(input.staffHourlyCost),
    merchantConfigured: Boolean(input.merchantConfigured),
  };
}

export function assumptionsAreConfigured(assumptions) {
  const safe = sanitizeValueV2Assumptions(assumptions);
  if (!safe.merchantConfigured) return false;
  return (
    safe.estimatedValuePerBlockedEvent > 0 ||
    safe.estimatedValuePerChallenge > 0 ||
    (safe.staffMinutesSavedPerIntervention > 0 && safe.staffHourlyCost > 0)
  );
}

export function allocatePlanCostForPeriod(monthlyPrice, selectedDays) {
  const price = Number(monthlyPrice);
  const days = Number(selectedDays);
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(days) || days <= 0) {
    return 0;
  }
  return (price / AVG_MONTH_DAYS) * days;
}

export function formatValueV2Currency(amount, currencyCode = "USD") {
  const numeric = Number(amount);
  const safe = Number.isFinite(numeric) ? numeric : 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe);
  } catch {
    return `$${safe.toFixed(2)}`;
  }
}

function countActivity(events) {
  let detected = 0;
  let blocked = 0;
  let challenged = 0;

  for (const raw of events) {
    const event = normalizeValueV2EventRow(raw);
    if (!isStorefrontEvent(event)) continue;
    if (isDetectedEvent(event)) detected += 1;
    if (isBlockedEvent(event)) blocked += 1;
    if (isChallengedEvent(event)) challenged += 1;
  }

  return {
    threatsDetected: detected,
    threatsBlocked: blocked,
    challengesIssued: challenged,
    interventions: blocked + challenged,
    threatsStopped: blocked,
  };
}

function directProtectedValue(activity, assumptions) {
  const safe = sanitizeValueV2Assumptions(assumptions);
  return (
    activity.threatsBlocked * safe.estimatedValuePerBlockedEvent +
    activity.challengesIssued * safe.estimatedValuePerChallenge
  );
}

function staffTimeValue(activity, assumptions) {
  const safe = sanitizeValueV2Assumptions(assumptions);
  if (
    safe.staffMinutesSavedPerIntervention <= 0 ||
    safe.staffHourlyCost <= 0 ||
    activity.interventions <= 0
  ) {
    return 0;
  }
  const hoursSaved =
    (activity.interventions * safe.staffMinutesSavedPerIntervention) / 60;
  return hoursSaved * safe.staffHourlyCost;
}

export function calculateValueV2Economics({
  activity,
  assumptions,
  allocatedPlanCost,
  assumptionsConfigured,
}) {
  const estimatedDirect = assumptionsConfigured
    ? directProtectedValue(activity, assumptions)
    : null;
  const estimatedStaff = assumptionsConfigured
    ? staffTimeValue(activity, assumptions)
    : null;
  const estimatedValueProtected =
    assumptionsConfigured && estimatedDirect != null && estimatedStaff != null
      ? estimatedDirect + estimatedStaff
      : null;
  const estimatedNetValue =
    assumptionsConfigured && estimatedValueProtected != null
      ? estimatedValueProtected - allocatedPlanCost
      : null;
  const valueToCostRatio =
    assumptionsConfigured &&
    estimatedValueProtected != null &&
    allocatedPlanCost > 0
      ? Number((estimatedValueProtected / allocatedPlanCost).toFixed(2))
      : null;

  return {
    allocatedPlanCost,
    estimatedValueProtected,
    estimatedNetValue,
    valueToCostRatio,
    assumptionsConfigured,
  };
}

function startOfUtcDay(date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function formatBucketLabel(date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function buildValueV2Trend(events, rangeDays, now = new Date()) {
  const end = startOfUtcDay(now);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (rangeDays - 1));

  const buckets = [];
  for (let index = 0; index < rangeDays; index += 1) {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + index);
    buckets.push({
      key: day.toISOString().slice(0, 10),
      label: formatBucketLabel(day),
      blocked: 0,
      challenged: 0,
      interventions: 0,
      estimatedValueProtected: 0,
    });
  }

  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  for (const raw of events) {
    const event = normalizeValueV2EventRow(raw);
    if (!isStorefrontEvent(event) || !event.createdAt) continue;
    const key = startOfUtcDay(event.createdAt).toISOString().slice(0, 10);
    const bucket = bucketMap.get(key);
    if (!bucket) continue;
    if (isBlockedEvent(event)) bucket.blocked += 1;
    if (isChallengedEvent(event)) bucket.challenged += 1;
    bucket.interventions = bucket.blocked + bucket.challenged;
  }

  return buckets;
}

export function applyTrendEstimates(trend, activity, assumptions, assumptionsConfigured) {
  if (!assumptionsConfigured) return trend;

  const safe = sanitizeValueV2Assumptions(assumptions);
  return trend.map((bucket) => ({
    ...bucket,
    estimatedValueProtected:
      bucket.blocked * safe.estimatedValuePerBlockedEvent +
      bucket.challenged * safe.estimatedValuePerChallenge,
  }));
}

export function buildValueV2Drivers(events, assumptions, assumptionsConfigured) {
  const totals = new Map(
    VALUE_V2_CATEGORIES.map((category) => [
      category.id,
      {
        id: category.id,
        label: category.label,
        blocked: 0,
        challenged: 0,
        interventions: 0,
      },
    ]),
  );

  for (const raw of events) {
    const event = normalizeValueV2EventRow(raw);
    if (!isStorefrontEvent(event) || !isInterventionEvent(event)) continue;
    const categoryId = classifyValueV2Category(event);
    const row = totals.get(categoryId) || totals.get("uncategorized");
    if (!row) continue;
    if (isBlockedEvent(event)) row.blocked += 1;
    if (isChallengedEvent(event)) row.challenged += 1;
    row.interventions = row.blocked + row.challenged;
  }

  const drivers = [...totals.values()].filter((row) => row.interventions > 0);
  const maxInterventions = Math.max(1, ...drivers.map((row) => row.interventions));

  return drivers
    .map((row) => {
      const estimatedValueProtected = assumptionsConfigured
        ? row.blocked * sanitizeValueV2Assumptions(assumptions).estimatedValuePerBlockedEvent +
          row.challenged * sanitizeValueV2Assumptions(assumptions).estimatedValuePerChallenge
        : null;
      return {
        ...row,
        shareOfInterventions: Math.round((row.interventions / maxInterventions) * 100),
        estimatedValueProtected,
      };
    })
    .sort((left, right) => right.interventions - left.interventions);
}

function countObservedDaysWithInterventions(trend) {
  return trend.filter((bucket) => bucket.interventions > 0).length;
}

export function buildValueV2Projection({
  activity,
  trend,
  rangeDays,
  assumptions,
  assumptionsConfigured,
}) {
  const observedInterventionDays = countObservedDaysWithInterventions(trend);
  const hasMeaningfulActivity = activity.interventions >= PROJECTION_MIN_INTERVENTIONS;
  const hasSufficientWindow = observedInterventionDays >= PROJECTION_MIN_OBSERVED_DAYS;

  const basisDays = Math.max(1, Math.min(rangeDays, observedInterventionDays || rangeDays));
  const basisLabel = `Projected from ${basisDays} day${
    basisDays === 1 ? "" : "s"
  } of observed BotShield activity.`;

  if (!hasMeaningfulActivity || !hasSufficientWindow) {
    return {
      available: false,
      eligible: false,
      reason:
        "Not enough protection activity to project yet. Projections require meaningful blocked or challenged activity across the observed period.",
      basisLabel,
      next30Days: null,
      next12Months: null,
    };
  }

  const dailyBlocked = activity.threatsBlocked / basisDays;
  const dailyInterventions = activity.interventions / basisDays;
  const safe = sanitizeValueV2Assumptions(assumptions);
  const dailyValue =
    assumptionsConfigured
      ? dailyBlocked * safe.estimatedValuePerBlockedEvent +
        (activity.challengesIssued / basisDays) * safe.estimatedValuePerChallenge
      : null;

  const next30Days = {
    label: "Next 30 days",
    projectedStopped: Math.round(dailyBlocked * 30),
    projectedInterventions: Math.round(dailyInterventions * 30),
    estimatedValueProtected:
      assumptionsConfigured && dailyValue != null
        ? Number((dailyValue * 30).toFixed(2))
        : null,
  };

  const next12Months = {
    label: "Next 12 months",
    projectedStopped: Math.round(dailyBlocked * 365),
    projectedInterventions: Math.round(dailyInterventions * 365),
    estimatedValueProtected:
      assumptionsConfigured && dailyValue != null
        ? Number((dailyValue * 365).toFixed(2))
        : null,
  };

  return {
    available: true,
    eligible: true,
    reason: null,
    basisLabel,
    next30Days,
    next12Months,
  };
}

export function buildValueV2DashboardPayload({
  events,
  assumptions,
  billing,
  range,
  now = new Date(),
}) {
  const rangeId = normalizeValueV2Range(range);
  const rangeDays = getValueV2RangeDays(rangeId);
  const retentionDays = BOT_EVENT_RETENTION_DAYS;
  const effectiveDays = Math.min(rangeDays, retentionDays);
  const cutoff = new Date(now.getTime() - effectiveDays * 24 * 60 * 60 * 1000);

  const periodEvents = events.filter((event) => {
    const createdAt = event?.createdAt ? new Date(event.createdAt) : null;
    return createdAt && createdAt >= cutoff && isStorefrontEvent(event);
  });

  const activity = countActivity(periodEvents);
  const assumptionsConfigured = assumptionsAreConfigured(assumptions);
  const monthlyPrice = Number(billing?.monthlyPrice);
  const currency = "USD";
  const allocatedPlanCost = allocatePlanCostForPeriod(
    Number.isFinite(monthlyPrice) ? monthlyPrice : 0,
    effectiveDays,
  );

  const economics = calculateValueV2Economics({
    activity,
    assumptions,
    allocatedPlanCost,
    assumptionsConfigured,
  });

  let trend = buildValueV2Trend(periodEvents, effectiveDays, now);
  trend = applyTrendEstimates(trend, activity, assumptions, assumptionsConfigured);

  const drivers = buildValueV2Drivers(periodEvents, assumptions, assumptionsConfigured);
  const projection = buildValueV2Projection({
    activity,
    trend,
    rangeDays: effectiveDays,
    assumptions,
    assumptionsConfigured,
  });

  return {
    range: rangeId,
    observedWindowDays: effectiveDays,
    retentionDays,
    retentionLimited: rangeDays > retentionDays,
    observationLabel: `${effectiveDays}-day observed window`,
    currency,
    currentPlan: {
      name: billing?.planName || "BotShield Basic",
      currency,
      monthlyPrice: Number.isFinite(monthlyPrice) ? monthlyPrice : null,
    },
    assumptions: sanitizeValueV2Assumptions(assumptions),
    assumptionsConfigured,
    activity,
    economics,
    trend,
    drivers,
    projection,
  };
}
