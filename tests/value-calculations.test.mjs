import assert from "node:assert/strict";
import test from "node:test";
import {
  allocatePlanCostForPeriod,
  assumptionsAreConfigured,
  buildProjection,
  buildTrendBuckets,
  calculateDirectProtectedValue,
  calculateEconomics,
  calculateStaffTimeValue,
  countSuspiciousActivity,
  formatCurrency,
  normalizeValueRange,
  roundCurrency,
  sanitizeAssumptions,
} from "../app/lib/value-calculations.js";

const assumptions = {
  estimatedValuePerBlockedEvent: 2,
  estimatedValuePerChallenge: 1,
  staffMinutesSavedPerIntervention: 10,
  staffHourlyCost: 30,
  merchantConfigured: true,
};

test("normalizeValueRange falls back to 30d for invalid input", () => {
  assert.equal(normalizeValueRange("invalid"), "30d");
  assert.equal(normalizeValueRange("7d"), "7d");
  assert.equal(normalizeValueRange("12m"), "12m");
});

test("sanitizeAssumptions rejects negative and excessive values", () => {
  const sanitized = sanitizeAssumptions(
    {
      estimatedValuePerBlockedEvent: -5,
      estimatedValuePerChallenge: 999999999,
      staffMinutesSavedPerIntervention: 1000,
      staffHourlyCost: -1,
    },
    { merchantConfigured: true },
  );
  assert.equal(sanitized.estimatedValuePerBlockedEvent, 0);
  assert.equal(sanitized.estimatedValuePerChallenge, 1000000);
  assert.equal(sanitized.staffMinutesSavedPerIntervention, 480);
  assert.equal(sanitized.staffHourlyCost, 0);
});

test("assumptionsAreConfigured requires merchantConfigured and a positive input", () => {
  assert.equal(
    assumptionsAreConfigured({
      ...assumptions,
      estimatedValuePerBlockedEvent: 0,
      estimatedValuePerChallenge: 0,
      staffMinutesSavedPerIntervention: 0,
    }),
    false,
  );
  assert.equal(assumptionsAreConfigured(assumptions), true);
});

test("countSuspiciousActivity counts detected as suspicious event total", () => {
  const activity = countSuspiciousActivity([
    { action: "blocked" },
    { action: "challenged" },
    { action: "allowed", threatLevel: "high" },
  ]);
  assert.deepEqual(activity, {
    threatsDetected: 3,
    threatsStopped: 1,
    challengesIssued: 1,
    interventions: 2,
  });
});

test("calculateEconomics handles zero blocked events without Infinity", () => {
  const economics = calculateEconomics({
    activity: countSuspiciousActivity([{ action: "challenged" }]),
    assumptions,
    monthlyPrice: 29,
    selectedDays: 30,
  });
  assert.equal(economics.costPerStoppedThreat, null);
  assert.equal(Number.isFinite(economics.estimatedNetValue), true);
  assert.ok(economics.allocatedPlanCost > 0);
});

test("calculateEconomics produces value-to-cost ratio when configured", () => {
  const economics = calculateEconomics({
    activity: countSuspiciousActivity([
      { action: "blocked" },
      { action: "blocked" },
    ]),
    assumptions,
    monthlyPrice: 29,
    selectedDays: 30,
  });
  assert.ok(economics.estimatedValueProtected > 0);
  assert.ok(economics.valueToCostRatio > 0);
  assert.equal(economics.costPerStoppedThreat, roundCurrency(economics.allocatedPlanCost / 2));
});

test("allocatePlanCostForPeriod uses average month day rate", () => {
  const cost = allocatePlanCostForPeriod(30, 30);
  assert.ok(cost > 29 && cost < 31);
});

test("buildProjection requires minimum history and activity", () => {
  const blocked = buildProjection({
    activity: countSuspiciousActivity([]),
    assumptions,
    observedDays: 3,
    basisDays: 3,
    configured: true,
  });
  assert.equal(blocked.available, false);

  const active = buildProjection({
    activity: countSuspiciousActivity([{ action: "blocked" }]),
    assumptions,
    observedDays: 10,
    basisDays: 10,
    configured: true,
  });
  assert.equal(active.available, true);
  assert.ok(active.next30Days.threatsStopped >= 0);
  assert.ok(active.next12Months.estimatedValueProtected >= 0);
});

test("buildTrendBuckets respects retention-limited day counts", () => {
  const now = Date.parse("2026-09-17T12:00:00.000Z");
  const buckets = buildTrendBuckets({
    events: [{ action: "blocked", createdAt: new Date("2026-09-16T10:00:00.000Z"), threatLevel: "high" }],
    rangeDays: 90,
    bucketMode: "day",
    now,
    retentionDays: 30,
  });
  assert.equal(buckets.length, 30);
});

test("direct and staff value calculations stay finite", () => {
  const activity = countSuspiciousActivity([
    { action: "blocked" },
    { action: "challenged" },
  ]);
  const direct = calculateDirectProtectedValue(activity, assumptions);
  const staff = calculateStaffTimeValue(activity, assumptions);
  assert.equal(direct, 3);
  assert.equal(staff, 10);
  assert.equal(formatCurrency(direct), "$3.00");
});
