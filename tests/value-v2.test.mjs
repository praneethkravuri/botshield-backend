import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  assumptionsAreConfigured,
  buildValueV2DashboardPayload,
  buildValueV2Projection,
  buildValueV2Trend,
  normalizeValueV2Range,
  sanitizeValueV2Assumptions,
  VALUE_V2_RANGE_OPTIONS,
} from "../app/lib/value-v2-calculations.js";
import {
  getValueV2Assumptions,
  resetValueV2Assumptions,
  saveValueV2Assumptions,
} from "../app/lib/value-v2-assumptions.server.js";

const NOW = new Date("2026-09-20T12:00:00.000Z");

function storefrontEvent(overrides = {}) {
  return {
    source: "storefront-proxy",
    threatLevel: "high",
    action: "allowed",
    reasonSummary: "",
    createdAt: NOW,
    ...overrides,
  };
}

function buildDashboard(events, assumptions = {}, range = "30d") {
  return buildValueV2DashboardPayload({
    events,
    assumptions: {
      estimatedValuePerBlockedEvent: 0,
      estimatedValuePerChallenge: 0,
      staffMinutesSavedPerIntervention: 0,
      staffHourlyCost: 0,
      merchantConfigured: false,
      ...assumptions,
    },
    billing: { monthlyPrice: 29, planName: "BotShield Basic" },
    range,
    now: NOW,
  });
}

test("value route resolves through app.value re-export", async () => {
  const valueRoute = await readFile(
    new URL("../app/routes/app.value.jsx", import.meta.url),
    "utf8",
  );
  assert.match(valueRoute, /export \{ default \} from "\.\/app\._index"/);
});

test("navigation contains Value exactly once in intended order", async () => {
  const navSource = await readFile(
    new URL("../app/components/BotShieldEmbeddedAppProvider.jsx", import.meta.url),
    "utf8",
  );
  const labels = [...navSource.matchAll(/label:\s*"([^"]+)"/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(labels, [
    "Overview",
    "Protection",
    "Analytics",
    "Value",
    "Fraud Orders",
    "Settings",
  ]);
  assert.equal(labels.filter((label) => label === "Value").length, 1);
});

test("Value page renders independently via dedicated component", async () => {
  const page = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );
  const adminExperience = await readFile(
    new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /export default function ValuePage/);
  assert.match(page, /safeFetchJson\(`\/api\/value/);
  assert.match(adminExperience, /import ValuePage from "\.\/ValuePage\.jsx"/);
  assert.match(adminExperience, /screen === "value" \? <ValuePage \/>/);
});

test("zero-data state keeps unavailable financial values as em dash", () => {
  const dashboard = buildDashboard([]);
  assert.equal(dashboard.activity.threatsDetected, 0);
  assert.equal(dashboard.activity.threatsBlocked, 0);
  assert.equal(dashboard.activity.challengesIssued, 0);
  assert.equal(dashboard.activity.interventions, 0);
  assert.equal(dashboard.assumptionsConfigured, false);
  assert.equal(dashboard.economics.estimatedValueProtected, null);
  assert.equal(dashboard.economics.estimatedNetValue, null);
  assert.equal(dashboard.projection.eligible, false);
});

test("detected-only state does not count detected as stopped", () => {
  const dashboard = buildDashboard([
    storefrontEvent({ action: "allowed", threatLevel: "high" }),
    storefrontEvent({ action: "allowed", threatLevel: "medium" }),
  ]);
  assert.equal(dashboard.activity.threatsDetected, 2);
  assert.equal(dashboard.activity.threatsBlocked, 0);
  assert.equal(dashboard.activity.challengesIssued, 0);
  assert.equal(dashboard.activity.interventions, 0);
  assert.equal(dashboard.activity.threatsStopped, 0);
});

test("blocked activity state counts blocked and interventions", () => {
  const dashboard = buildDashboard([
    storefrontEvent({
      action: "blocked",
      reasonSummary: "[KNOWN_BOT_USER_AGENT] Suspicious user agent",
    }),
  ]);
  assert.equal(dashboard.activity.threatsBlocked, 1);
  assert.equal(dashboard.activity.interventions, 1);
  assert.equal(dashboard.activity.threatsStopped, 1);
  assert.ok(dashboard.drivers.length > 0);
});

test("challenged activity state counts challenged and interventions", () => {
  const dashboard = buildDashboard([
    storefrontEvent({ action: "challenged", reasonSummary: "VPN_DETECTED" }),
  ]);
  assert.equal(dashboard.activity.challengesIssued, 1);
  assert.equal(dashboard.activity.interventions, 1);
  assert.equal(dashboard.activity.threatsStopped, 0);
});

test("assumptions unconfigured state leaves estimated values unavailable", () => {
  const dashboard = buildDashboard(
    [storefrontEvent({ action: "blocked" })],
    { merchantConfigured: false },
  );
  assert.equal(dashboard.assumptionsConfigured, false);
  assert.equal(dashboard.economics.estimatedValueProtected, null);
  assert.equal(dashboard.economics.estimatedNetValue, null);
  assert.equal(dashboard.economics.valueToCostRatio, null);
});

test("assumptions configured state calculates estimated values", () => {
  const dashboard = buildDashboard(
    [
      storefrontEvent({ action: "blocked" }),
      storefrontEvent({ action: "challenged" }),
    ],
    {
      merchantConfigured: true,
      estimatedValuePerBlockedEvent: 10,
      estimatedValuePerChallenge: 5,
    },
  );
  assert.equal(dashboard.assumptionsConfigured, true);
  assert.equal(dashboard.economics.estimatedValueProtected, 15);
  assert.equal(typeof dashboard.economics.estimatedNetValue, "number");
  assert.equal(typeof dashboard.economics.valueToCostRatio, "number");
});

test("estimated values are clearly distinguished in Value UI", async () => {
  const page = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /Estimated protected value/);
  assert.match(page, /vv2-semantic-status/);
  assert.match(page, /Estimated net value/);
  assert.match(page, /Estimated ROI/);
  assert.match(page, /Est\. value \/ cost/);
  assert.match(page, /formatFinancial/);
  assert.match(page, /formatValueToCostRatio/);
});

test("flagship-v4 build marker is present on Value root", async () => {
  const page = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /data-value-ui-revision="flagship-v4"/);
  assert.match(page, /data-value-layout="executive-equation-impact"/);
});

test("impact chart keeps observed event counts separate from financial estimates", async () => {
  const page = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );

  const chartBody = page.slice(
    page.indexOf("function ValueImpactChartBody"),
    page.indexOf("function AssumptionsModal"),
  );
  assert.match(chartBody, /bucket\.interventions/);
  assert.match(chartBody, /Blocked/);
  assert.match(chartBody, /Challenged/);
  assert.doesNotMatch(chartBody, /estimatedValueProtected/);
  assert.doesNotMatch(chartBody, /formatValueV2Currency/);
});

test("Value outlook uses a compact projected comparison table", async () => {
  const page = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(
    new URL("../app/styles/value-v2-page.css", import.meta.url),
    "utf8",
  );

  assert.match(page, /vv2-outlook-table/);
  assert.match(page, /Current-plan 12-month cost/);
  assert.match(css, /\.vv2-outlook-table-head/);
  assert.match(css, /\.vv2-outlook-row/);
});

test("interventions equal blocked plus challenged", () => {
  const dashboard = buildDashboard([
    storefrontEvent({ action: "blocked" }),
    storefrontEvent({ action: "challenged" }),
    storefrontEvent({ action: "allowed", threatLevel: "high" }),
  ]);
  assert.equal(
    dashboard.activity.interventions,
    dashboard.activity.threatsBlocked + dashboard.activity.challengesIssued,
  );
});

test("unavailable financial values render em dash in UI helper", async () => {
  const page = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /if \(!configured \|\| value == null\) return "—"/);
});

test("true measured zero renders 0 for observed counts", async () => {
  const page = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /formatCount\(activity\.threatsBlocked\)/);
  const dashboard = buildDashboard([]);
  assert.equal(dashboard.activity.threatsBlocked, 0);
});

test("projection eligibility requires meaningful intervention history", () => {
  const sparseTrend = buildValueV2Trend(
    [storefrontEvent({ action: "blocked", createdAt: NOW })],
    30,
    NOW,
  );
  const sparse = buildValueV2Projection({
    activity: { threatsBlocked: 1, challengesIssued: 0, interventions: 1 },
    trend: sparseTrend,
    rangeDays: 30,
    assumptions: { merchantConfigured: true, estimatedValuePerBlockedEvent: 5 },
    assumptionsConfigured: true,
  });
  assert.equal(sparse.eligible, false);

  const denseEvents = Array.from({ length: 8 }, (_, index) =>
    storefrontEvent({
      action: "blocked",
      createdAt: new Date(NOW.getTime() - index * 24 * 60 * 60 * 1000),
    }),
  );
  const denseTrend = buildValueV2Trend(denseEvents, 30, NOW);
  const dense = buildValueV2Projection({
    activity: { threatsBlocked: 8, challengesIssued: 0, interventions: 8 },
    trend: denseTrend,
    rangeDays: 30,
    assumptions: { merchantConfigured: true, estimatedValuePerBlockedEvent: 5 },
    assumptionsConfigured: true,
  });
  assert.equal(dense.eligible, true);
});

test("projection is explicitly labeled in UI", async () => {
  const page = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /Value outlook/);
  assert.match(page, /vv2-projected-badge/);
  assert.match(page, /vv2-outlook-table/);
  assert.match(page, />Projected</);
});

test("observed ranges are limited to 7d and 30d without fake long history", () => {
  assert.deepEqual(
    VALUE_V2_RANGE_OPTIONS.map((option) => option.id),
    ["7d", "30d"],
  );
  assert.equal(normalizeValueV2Range("90d"), "30d");
  assert.equal(normalizeValueV2Range("12m"), "30d");
});

test("assumptions save and reset persist through app settings", async () => {
  const appSettings = [];
  const db = {
    appSetting: {
      findMany: async ({ where }) =>
        appSettings.filter(
          (row) =>
            row.shop === where.shop &&
            where.key.in.includes(row.key),
        ),
      upsert: async ({ where, create, update }) => {
        const index = appSettings.findIndex(
          (row) => row.shop === where.shop_key.shop && row.key === where.shop_key.key,
        );
        if (index >= 0) {
          appSettings[index] = { ...appSettings[index], value: update.value };
          return appSettings[index];
        }
        appSettings.push(create);
        return create;
      },
      deleteMany: async ({ where }) => {
        const before = appSettings.length;
        for (let index = appSettings.length - 1; index >= 0; index -= 1) {
          if (
            appSettings[index].shop === where.shop &&
            where.key &&
            appSettings[index].key === where.key
          ) {
            appSettings.splice(index, 1);
          }
        }
        return { count: before - appSettings.length };
      },
    },
  };

  const saved = await saveValueV2Assumptions(
    "demo.myshopify.com",
    {
      estimatedValuePerBlockedEvent: 12,
      estimatedValuePerChallenge: 4,
    },
    db,
  );
  assert.equal(saved.estimatedValuePerBlockedEvent, 12);
  assert.equal(saved.merchantConfigured, true);

  const loaded = await getValueV2Assumptions("demo.myshopify.com", db);
  assert.equal(loaded.estimatedValuePerBlockedEvent, 12);

  const reset = await resetValueV2Assumptions("demo.myshopify.com", db);
  assert.equal(reset.merchantConfigured, false);
});

test("period switching and refresh are wired in Value UI", async () => {
  const page = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /RANGE_OPTIONS/);
  assert.match(page, /setRange\(option\.id\)/);
  assert.match(page, /loadValue\(range\)/);
  assert.match(page, /aria-label="Refresh Value data"/);
});

test("API error and recovery states are handled in Value UI", async () => {
  const page = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );
  const apiRoute = await readFile(
    new URL("../app/routes/api.value.jsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /Couldn't load Value dashboard/);
  assert.match(page, /BotShieldBanner tone="critical"/);
  assert.match(apiRoute, /authenticate\.admin\(request\)/);
  assert.match(apiRoute, /buildValueV2Dashboard/);
});

test("responsive and accessibility contracts exist in Value CSS and UI", async () => {
  const css = await readFile(
    new URL("../app/styles/value-v2-page.css", import.meta.url),
    "utf8",
  );
  const page = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );

  assert.match(css, /@media \(max-width: 1024px\)/);
  assert.match(css, /@media \(max-width: 768px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(page, /aria-labelledby/);
  assert.match(page, /aria-pressed/);
  assert.match(page, /aria-label="Observed period"/);
});

test("Value CSS is isolated from locked page styles", async () => {
  const css = await readFile(
    new URL("../app/styles/value-v2-page.css", import.meta.url),
    "utf8",
  );
  const page = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );
  const adminExperience = await readFile(
    new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
    "utf8",
  );

  assert.match(css, /\.botshield-value-v2/);
  assert.doesNotMatch(css, /\.botshield-overview-premium/);
  assert.doesNotMatch(css, /\.botshield-analytics-premium/);
  assert.doesNotMatch(css, /\.botshield-protection-content/);
  assert.match(page, /value-v2-page\.css/);
  assert.doesNotMatch(adminExperience, /value-v2-page\.css/);
});

test("locked page implementations remain unchanged aside from Value routing", async () => {
  const adminExperience = await readFile(
    new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
    "utf8",
  );

  assert.match(adminExperience, /function OverviewPage/);
  assert.match(adminExperience, /function AnalyticsPage/);
  assert.match(adminExperience, /function ProtectionPage/);
  assert.match(adminExperience, /function FraudOrdersPage/);
  assert.match(adminExperience, /function SettingsPage/);
  assert.match(adminExperience, /overview-premium\.css/);
  assert.match(adminExperience, /analytics-premium\.css/);
  assert.match(adminExperience, /fraud-orders-premium\.css/);
});

test("Value page includes required information architecture sections", async () => {
  const page = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /Your BotShield value/);
  assert.match(page, /Protection impact/);
  assert.match(page, /vv2-impact-rail/);
  assert.match(page, /Value drivers/);
  assert.match(page, /Value outlook/);
  assert.match(page, /How Value is calculated/);
  assert.match(page, /No interventions this period/);
  assert.match(page, /vv2-dual-grid/);
  assert.match(page, /vv2-equation-card/);
  assert.match(page, /Set assumptions/);
  assert.match(page, /Save assumptions/);
  assert.match(page, /Cancel/);
  assert.match(page, /Data window/);
  assert.match(page, /Current-plan 12-month cost/);
  assert.doesNotMatch(page, /Protection efficiency/);
  assert.doesNotMatch(page, /Annualized estimate/);
  assert.doesNotMatch(page, /deriveAnnualizedEstimates/);
  assert.doesNotMatch(page, /Why BotShield/);
});

test("sanitize assumptions rejects negative defaults and keeps zero baseline", () => {
  const sanitized = sanitizeValueV2Assumptions({
    estimatedValuePerBlockedEvent: -10,
    estimatedValuePerChallenge: 999999999,
    staffMinutesSavedPerIntervention: -1,
    staffHourlyCost: -5,
    merchantConfigured: false,
  });
  assert.equal(sanitized.estimatedValuePerBlockedEvent, 0);
  assert.equal(sanitized.estimatedValuePerChallenge, 1_000_000);
  assert.equal(assumptionsAreConfigured(sanitized), false);
});

test("value server layer queries storefront events and billing status", async () => {
  const serverSource = await readFile(
    new URL("../app/lib/value-v2.server.js", import.meta.url),
    "utf8",
  );
  assert.match(serverSource, /source: "storefront-proxy"/);
  assert.match(serverSource, /readCachedBillingStatus/);
  assert.match(serverSource, /buildValueV2DashboardPayload/);
  assert.match(serverSource, /BOT_EVENT_RETENTION_DAYS/);

  const dashboard = buildDashboard(
    [
      storefrontEvent({
        action: "blocked",
        reasonSummary: "[KNOWN_BOT_USER_AGENT] Suspicious user agent",
      }),
      storefrontEvent({
        action: "challenged",
        threatLevel: "medium",
        reasonSummary: "[VPN_DETECTED] VPN detected",
      }),
      storefrontEvent({ action: "allowed", threatLevel: "high" }),
    ],
  );
  assert.equal(dashboard.activity.threatsDetected, 3);
  assert.equal(dashboard.activity.threatsBlocked, 1);
  assert.equal(dashboard.activity.challengesIssued, 1);
  assert.equal(dashboard.activity.interventions, 2);
  assert.ok(dashboard.trend.length > 0);
  assert.ok(dashboard.drivers.length > 0);
});

test("production build script remains available for Value verification", async () => {
  const pkg = await readFile(new URL("../package.json", import.meta.url), "utf8");
  assert.match(pkg, /"build": "react-router build"/);
});

test("Value premium visual layer keeps isolated styling contracts", async () => {
  const css = await readFile(
    new URL("../app/styles/value-v2-page.css", import.meta.url),
    "utf8",
  );
  const page = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );

  assert.match(css, /max-width: 1260px/);
  assert.match(css, /--vv2-hero-bg: #141824/);
  assert.doesNotMatch(css, /backdrop-filter/);
  assert.doesNotMatch(css, /glassmorphism/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /\.vv2-enter/);
  assert.match(css, /\.vv2-value-flow/);
  assert.match(css, /\.vv2-macro-card/);
  assert.match(css, /\.vv2-dual-grid/);
  assert.match(css, /\.vv2-impact-rail/);
  assert.match(css, /\.vv2-impact-layout/);
  assert.match(page, /Understand the business impact of BotShield protection/);
  assert.match(page, /Observed \+ estimated/);
  assert.match(page, /vv2-driver-fill/);
  assert.match(page, /ValueInlineState/);
  assert.match(page, /deriveEstimatedRoi/);
  assert.match(page, /data-value-ui-revision="flagship-v4"/);
  assert.match(page, /data-value-layout="executive-equation-impact"/);
  assert.doesNotMatch(page, /Value economics/);
  assert.doesNotMatch(page, /deriveAnnualizedEstimates/);
});
