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
  assert.match(analyticsSource, /getAnalyticsAttackOrigin/);
  assert.match(analyticsSource, /event\.networkType/);
  assert.match(analyticsSource, /event\.networkOrg \|\| event\.networkProvider/);
});

test("Analytics controls provide supported periods and connected filters", () => {
  for (const label of ["24H", "7D", "30D", "90D"]) {
    assert.match(analyticsSource, new RegExp(`label: "${label}"`));
  }
  assert.match(analyticsSource, /decisionFilter/);
  assert.match(analyticsSource, /riskFilter/);
  assert.match(analyticsSource, /signalFilter/);
  assert.match(analyticsSource, /Clear filters/);
  assert.match(analyticsSource, /getUiStatus\(normalized\)\.label/);
  assert.doesNotMatch(analyticsSource, /setSaveSuccess/);
  assert.match(analyticsSource, /refreshAnalytics/);
  assert.match(analyticsSource, /analyticsRefreshing/);
  assert.match(analyticsSource, /Couldn't refresh analytics/);
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
  assert.match(analyticsSource, /activeActivityBuckets\.length <= 2/);
  assert.match(analyticsSource, /analyticsPercent\(row\.blocked \+ row\.challenged, row\.count\)/);
  assert.match(analyticsSource, /formatAnalyticsPath/);
  assert.match(analyticsSource, /row\.count > 1 \? <span className="botshield-analytics-repeat">Repeat/);
  assert.doesNotMatch(analyticsSource, /vs previous period/);
});

test("Analytics pairs target intelligence with recorded network origins", () => {
  assert.match(analyticsSource, /title="Most targeted storefront areas"/);
  assert.match(analyticsSource, /title="Network sources"/);
  assert.match(analyticsSource, /Network types recorded for suspicious storefront events\./);
  assert.match(analyticsSource, /No reliable network origin data was recorded during this period/);
  assert.doesNotMatch(analyticsSource, /title=\{originRows\.length \? "Threat origins"/);
});

test("Analytics preserves truthful zero values and explicit analytical context", () => {
  assert.match(analyticsSource, /value > 0 && maximum/);
  assert.match(analyticsSource, /botshield-analytics-filter-context/);
  assert.match(analyticsSource, /% of suspicious events/);
  assert.match(analyticsSource, /bucket\.blocked/);
  assert.match(analyticsSource, /bucket\.challenged/);
});

test("Analytics supplies deliberate low-data and filtered empty states", () => {
  assert.match(analyticsSource, /No recurring suspicious visitors matched this period and filter selection/);
  assert.match(analyticsSource, /No multi-signal event combinations were recorded during this period/);
  assert.match(analyticsSource, /No events match these filters\. Clear filters or choose a wider date range/);
});

test("Event Explorer details render outside the transformed route shell", () => {
  assert.match(analyticsSource, /createPortal/);
  assert.match(analyticsSource, /document\.body/);
  assert.match(analyticsSource, /aria-labelledby="analytics-event-detail-title"/);
  assert.match(analyticsSource, /Network classification/);
  assert.match(analyticsSource, /keyEvent\.key === "Escape"/);
});
