import { BOT_EVENT_RETENTION_DAYS } from "../config/data-retention.js";
import {
  BOTSHIELD_BASIC_MONTHLY_PRICE,
  BOTSHIELD_BASIC_PLAN_NAME,
} from "./billing-state.js";
import {
  assumptionsAreConfigured,
  buildCategoryBreakdown,
  buildProjection,
  buildTrendBuckets,
  calculateEconomics,
  countSuspiciousActivity,
  enrichTrendWithEstimates,
  normalizeValueRange,
  VALUE_RANGE_OPTIONS,
} from "./value-calculations.js";
import { getValueAssumptions } from "./value-assumptions.server.js";
import {
  classifyValueEventCategory,
  isSuspiciousValueEvent,
  normalizeStorefrontEventRow,
  VALUE_PROTECTION_CATEGORIES,
} from "./value-signals.js";

function normalizeShop(shop) {
  return String(shop || "").trim().toLowerCase();
}

function startOfUtcDay(date) {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function differenceInUtcDays(later, earlier) {
  const ms = startOfUtcDay(later).getTime() - startOfUtcDay(earlier).getTime();
  return Math.max(1, Math.floor(ms / (24 * 60 * 60 * 1000)) + 1);
}

export async function buildValueDashboard(db, shop, { range = "30d", now = new Date() } = {}) {
  const normalizedShop = normalizeShop(shop);
  const normalizedRange = normalizeValueRange(range);
  const rangeConfig = VALUE_RANGE_OPTIONS[normalizedRange];
  const nowMs = now.getTime();
  const retentionDays = BOT_EVENT_RETENTION_DAYS;
  const selectedDays = rangeConfig.days;
  const effectiveHistoryDays = Math.min(selectedDays, retentionDays);
  const queryStart = new Date(nowMs - effectiveHistoryDays * 24 * 60 * 60 * 1000);

  const [events, assumptions, billingRows] = await Promise.all([
    db.botEvent.findMany({
      where: {
        shop: normalizedShop,
        source: "storefront-proxy",
        createdAt: { gte: queryStart },
      },
      select: {
        id: true,
        threatLevel: true,
        action: true,
        reasonSummary: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    getValueAssumptions(normalizedShop, db),
    db.appSetting.findMany({
      where: {
        shop: normalizedShop,
        key: { startsWith: "billing" },
      },
      select: { key: true, value: true },
    }),
  ]);
  const billingMap = new Map(billingRows.map((row) => [row.key, row.value]));

  const normalizedEvents = events.map(normalizeStorefrontEventRow);
  const suspiciousEvents = normalizedEvents.filter(isSuspiciousValueEvent);
  const interventionEvents = normalizedEvents.filter((event) =>
    ["blocked", "challenged"].includes(String(event.action || "").toLowerCase()),
  );
  const activity = countSuspiciousActivity(suspiciousEvents);
  const configured = assumptionsAreConfigured(assumptions);

  const firstEventAt = normalizedEvents[0]?.createdAt || null;
  const observedDays = firstEventAt
    ? differenceInUtcDays(now, new Date(firstEventAt))
    : 0;
  const basisDays = Math.min(
    effectiveHistoryDays,
    observedDays || effectiveHistoryDays,
  );

  const monthlyPrice = Number(
    process.env.BILLING_MONTHLY_PRICE || BOTSHIELD_BASIC_MONTHLY_PRICE,
  );
  const planName =
    billingMap.get("billingPlanName") ||
    process.env.BILLING_PLAN_NAME?.trim() ||
    BOTSHIELD_BASIC_PLAN_NAME;
  const currencyCode = "USD";

  const economics = calculateEconomics({
    activity,
    assumptions,
    monthlyPrice: Number.isFinite(monthlyPrice) ? monthlyPrice : 0,
    selectedDays: effectiveHistoryDays,
  });

  const categorizedEvents = interventionEvents.map((event) => ({
    ...event,
    categoryId: classifyValueEventCategory(event),
  }));

  const trend = enrichTrendWithEstimates(
    buildTrendBuckets({
      events: suspiciousEvents,
      rangeDays: selectedDays,
      bucketMode: rangeConfig.bucket,
      now: nowMs,
      retentionDays,
    }),
    assumptions,
    configured,
  );

  const categories = buildCategoryBreakdown(
    categorizedEvents,
    assumptions,
    configured,
    VALUE_PROTECTION_CATEGORIES,
  );

  const projection = buildProjection({
    activity,
    assumptions,
    observedDays,
    basisDays: observedDays > 0 ? Math.min(basisDays, observedDays) : 0,
    configured,
  });

  const retentionLimited = selectedDays > retentionDays;

  return {
    range: normalizedRange,
    rangeLabel: rangeConfig.label,
    selectedDays,
    effectiveHistoryDays,
    retentionDays,
    retentionLimited,
    observedDays,
    historyStart: firstEventAt ? new Date(firstEventAt).toISOString() : null,
    historyMessage:
      observedDays > 0
        ? `${observedDays} day${observedDays === 1 ? "" : "s"} of observed BotShield activity`
        : "No observed BotShield activity yet",
    retentionMessage: retentionLimited
      ? `BotShield retains storefront security events for ${retentionDays} days. Longer ranges show only retained activity.`
      : null,
    currentPlan: {
      name: planName,
      monthlyPrice: Number.isFinite(monthlyPrice) ? monthlyPrice : 0,
      currency: currencyCode,
      billingStatus: billingMap.get("billingStatus") || "configured",
      isEstimatedCost: true,
    },
    activity,
    economics,
    trend,
    categories,
    projection,
    assumptions,
    assumptionStatus: configured
      ? "merchant_configured"
      : assumptions.merchantConfigured
        ? "incomplete"
        : "not_configured",
    methodology: {
      threatsStopped:
        "Count of storefront security events with a blocked decision.",
      threatsDetected:
        "Count of suspicious storefront events with medium/high risk, blocked/challenged decisions, or known protection signals.",
      challengesIssued:
        "Count of storefront security events with a challenged decision.",
      interventions:
        "Blocked events plus challenged events. Challenges are not counted as stopped threats.",
      allocatedPlanCost:
        "Estimated plan cost for the selected period using the current monthly plan price and an average-month day rate.",
      estimatedValueProtected:
        "Estimated from blocked/challenged activity and merchant-configured assumptions. Not measured revenue.",
    },
  };
}
