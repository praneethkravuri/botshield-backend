import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("value dashboard stylesheet is scoped to Value page", async () => {
  const page = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(
    new URL("../app/styles/value-page.css", import.meta.url),
    "utf8",
  );

  assert.match(page, /botshield-value-content/);
  assert.match(page, /botshield-value-dashboard/);
  assert.match(page, /value-page\.css/);
  assert.match(css, /\.botshield-value-dashboard/);
  assert.doesNotMatch(page, /botshield-value-premium/);
  assert.doesNotMatch(css, /\.botshield-overview-premium/);
  assert.doesNotMatch(css, /\.botshield-settings-premium/);
  assert.doesNotMatch(css, /\.botshield-fraud-orders-premium/);
});

test("value dashboard sections and hero layout exist", async () => {
  const page = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(
    new URL("../app/styles/value-page.css", import.meta.url),
    "utf8",
  );

  assert.match(page, /bv-hero/);
  assert.match(page, /bv-economics-flow/);
  assert.match(page, /bv-projection-grid/);
  assert.match(page, /Protection value over time/);
  assert.match(page, /Where your value came from/);
  assert.match(page, /Your BotShield economics/);
  assert.match(css, /\.bv-hero/);
  assert.match(css, /\.bv-economics-flow/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test("value dashboard chart legend matches rendered series logic", async () => {
  const page = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /hasPlotValues/);
  assert.match(page, /assumptionsConfigured \?/);
  assert.match(page, /Estimated value protected/);
  assert.match(page, /Threats stopped/);
  assert.match(page, /No stopped-threat activity in this period/);
  assert.match(page, /className="is-value"/);
  assert.match(page, /className="is-blocked"/);
});

test("value dashboard preserves truthful economics semantics", async () => {
  const page = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /costPerStoppedThreat == null/);
  assert.match(page, /valueToCostRatio == null/);
  assert.match(page, /retentionMessage/);
  assert.match(page, /is-detected/);
  assert.match(page, /projectionHasActivity/);
  assert.match(page, /estimatedValueProtected == null/);
  assert.doesNotMatch(page, /defaultAssumptions/);
  assert.doesNotMatch(page, /fake/i);
});

test("value dashboard motion helpers exist", async () => {
  const page = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /useAnimatedNumber/);
  assert.match(page, /prefersReducedMotion/);
});
