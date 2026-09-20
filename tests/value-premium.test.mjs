import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("value premium root and workspace geometry are scoped", async () => {
  const page = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(
    new URL("../app/styles/value-page.css", import.meta.url),
    "utf8",
  );

  assert.match(page, /botshield-value-premium/);
  assert.match(css, /\.botshield-value-premium/);
  assert.match(css, /--bv-workspace-max: 1400px/);
  assert.match(css, /max-width: min\(100%, var\(--bv-workspace-max\)\)/);
  assert.match(css, /margin-inline: auto/);
  assert.match(page, /value-page\.css/);
  assert.doesNotMatch(css, /\.botshield-overview-premium/);
  assert.doesNotMatch(css, /\.botshield-settings-premium/);
  assert.doesNotMatch(css, /\.botshield-fraud-orders-premium/);
});

test("value premium report structure uses brief and section rhythm", async () => {
  const page = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(
    new URL("../app/styles/value-page.css", import.meta.url),
    "utf8",
  );

  assert.match(page, /bv-brief/);
  assert.match(page, /bv-section/);
  assert.match(page, /bv-metric-table/);
  assert.match(page, /bv-value-formed/);
  assert.match(css, /\.bv-brief/);
  assert.match(css, /\.bv-metric-table/);
  assert.match(css, /--bv-ink: #121314/);
  assert.doesNotMatch(page, /bv-dashboard-analytics/);
  assert.doesNotMatch(page, /bv-economics-flow/);
});

test("value premium sections and terminology replace legacy marketing blocks", async () => {
  const page = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /Estimated protected value/);
  assert.match(page, /Protection value/);
  assert.match(page, /How value is formed/);
  assert.match(page, /Observed protection/);
  assert.match(page, /Financial value/);
  assert.match(page, /Outlook/);
  assert.match(page, /Your value model/);
  assert.match(page, /How calculations work/);
  assert.match(page, /Configure value model/);
  assert.match(page, /Edit assumptions/);
  assert.doesNotMatch(page, /Why BotShield/);
  assert.doesNotMatch(page, /Where your value came from/);
  assert.doesNotMatch(page, /Turn protection activity into business value/);
  assert.doesNotMatch(page, /bv-callout/);
  assert.doesNotMatch(page, /<h1[^>]*>\s*Value\s*<\/h1>/);
});

test("value premium category icon mapping covers all category ids", async () => {
  const page = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /CATEGORY_ICON_MAP/);
  assert.match(page, /"bot-protection": "block"/);
  assert.match(page, /"network-protection": "globe"/);
  assert.match(page, /"rate-protection": "activity"/);
  assert.match(page, /"page-protection": "lock"/);
  assert.match(page, /uncategorized: "info"/);
  assert.match(page, /CATEGORY_ICON_MAP\[row\.id\]/);
});

test("value premium chart is conditional and skips empty shells", async () => {
  const page = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(
    new URL("../app/styles/value-page.css", import.meta.url),
    "utf8",
  );

  assert.match(page, /hasInterventions \?/);
  assert.match(page, /hasPlotValues/);
  assert.match(page, /No stopped-threat trend yet/);
  assert.match(page, /assumptionsConfigured \?/);
  assert.match(page, /Threats stopped \(relative\)/);
  assert.match(page, /data-density=\{density\}/);
  assert.match(css, /\.bv-chart\[data-density="sparse"\]/);
  assert.match(css, /\.bv-chart\[data-density="medium"\]/);
  assert.match(css, /\.bv-chart\[data-density="dense"\]/);
  assert.doesNotMatch(page, /bv-chart-zero-plot/);
  assert.doesNotMatch(css, /\.bv-chart-zero-plot/);
});

test("value premium how-value-formed flow replaces redundant pipeline", async () => {
  const page = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(
    new URL("../app/styles/value-page.css", import.meta.url),
    "utf8",
  );

  assert.match(page, /Observed interventions/);
  assert.match(page, /Merchant value assumptions/);
  assert.match(page, /Estimated protected value/);
  assert.match(page, /bv-value-formed-arrow/);
  assert.match(css, /\.bv-value-formed/);
  assert.doesNotMatch(page, /Protection economics/);
});

test("value premium motion and reduced-motion coverage exist", async () => {
  const page = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(
    new URL("../app/styles/value-page.css", import.meta.url),
    "utf8",
  );

  assert.match(page, /useAnimatedNumber/);
  assert.match(page, /prefersReducedMotion/);
  assert.match(css, /@keyframes bv-enter/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /animation: none !important/);
});

test("value premium responsive breakpoints and icon geometry exist", async () => {
  const css = await readFile(
    new URL("../app/styles/value-page.css", import.meta.url),
    "utf8",
  );

  assert.match(css, /\.bv-icon/);
  assert.match(css, /display: inline-flex/);
  assert.match(css, /@media \(max-width: 1024px\)/);
  assert.match(css, /@media \(max-width: 768px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
});

test("value premium preserves truthful economics semantics", async () => {
  const page = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /costPerStoppedThreat == null/);
  assert.match(page, /valueToCostRatio == null/);
  assert.match(page, /estimatedValueProtected == null/);
  assert.match(page, /retentionMessage/);
  assert.match(page, /hasInterventions/);
  assert.match(page, /blocked or challenged/);
  assert.match(page, /stopped threats/);
  assert.match(page, /is-detected/);
  assert.match(page, /projectionHasActivity/);
  assert.doesNotMatch(page, /defaultAssumptions/);
  assert.doesNotMatch(page, /fake/i);
});
