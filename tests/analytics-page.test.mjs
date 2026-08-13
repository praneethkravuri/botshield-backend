import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const analyticsSource = await readFile(
  new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
  "utf8",
);
const scansSource = await readFile(
  new URL("../app/routes/api.scans.jsx", import.meta.url),
  "utf8",
);

test("Analytics is an investigation workspace rather than an Overview duplicate", () => {
  assert.match(analyticsSource, /Threat signal analysis/);
  assert.match(analyticsSource, /Detection outcomes/);
  assert.match(analyticsSource, /Activity patterns/);
  assert.match(analyticsSource, /Event explorer/);
  assert.doesNotMatch(analyticsSource, /Visitor trends/);
});

test("Analytics calculations use recorded event fields and safe denominators", () => {
  assert.match(analyticsSource, /analyticsPercent\(interventionCount, suspiciousEvents\.length\)/);
  assert.match(analyticsSource, /getOverviewReasonCodes\(event\)/);
  assert.match(analyticsSource, /event\.pathVisited/);
  assert.match(analyticsSource, /event\.networkCountry/);
  assert.match(analyticsSource, /maskAnalyticsVisitor/);
});

test("Analytics controls provide supported periods and connected filters", () => {
  for (const label of ["24H", "7D", "30D", "90D"]) {
    assert.match(analyticsSource, new RegExp(`label: "${label}"`));
  }
  assert.match(analyticsSource, /decisionFilter/);
  assert.match(analyticsSource, /riskFilter/);
  assert.match(analyticsSource, /signalFilter/);
  assert.match(analyticsSource, /Clear filters/);
});

test("scan telemetry exposes only recorded dimensions needed by Analytics", () => {
  assert.match(scansSource, /extractReasonCodes/);
  assert.match(scansSource, /userAgent: r\.userAgent/);
  assert.match(scansSource, /networkProvider: r\.networkProvider/);
  assert.match(scansSource, /networkAsn: r\.networkAsn/);
  assert.match(scansSource, /take: 250/);
});

test("Analytics premium refinement remains data-derived and adapts to sparse activity", () => {
  assert.match(analyticsSource, /Investigation summary/);
  assert.match(analyticsSource, /Peak suspicious activity/);
  assert.match(analyticsSource, /suspiciousEvents\.length <= 3/);
  assert.match(analyticsSource, /analyticsPercent\(row\.blocked \+ row\.challenged, row\.count\)/);
  assert.match(analyticsSource, /formatAnalyticsPath/);
  assert.match(analyticsSource, /row\.count > 1 \? <span className="botshield-analytics-repeat">Repeat/);
  assert.doesNotMatch(analyticsSource, /vs previous period/);
});
