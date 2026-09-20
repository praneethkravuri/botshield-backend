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
  assert.match(css, /--bv-workspace-max: 1440px/);
  assert.match(css, /max-width: min\(100%, var\(--bv-workspace-max\)\)/);
  assert.match(css, /margin-inline: auto/);
  assert.match(page, /value-page\.css/);
  assert.doesNotMatch(css, /\.botshield-overview-premium/);
  assert.doesNotMatch(css, /\.botshield-settings-premium/);
  assert.doesNotMatch(css, /\.botshield-fraud-orders-premium/);
});

test("value premium sections and terminology replace legacy marketing blocks", async () => {
  const page = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /Estimated value protected/);
  assert.match(page, /Protection economics/);
  assert.match(page, /Protection &amp; value trend/);
  assert.match(page, /Value drivers/);
  assert.match(page, /Protection evidence/);
  assert.match(page, /Value outlook/);
  assert.match(page, /Your value model/);
  assert.match(page, /How calculations work/);
  assert.match(page, /Observed/);
  assert.match(page, /Estimated/);
  assert.match(page, /Projected/);
  assert.match(page, /Edit assumptions/);
  assert.match(page, /Set assumptions/);
  assert.doesNotMatch(page, /Why BotShield/);
  assert.doesNotMatch(page, /Where your value came from/);
  assert.doesNotMatch(page, /Turn protection activity into business value/);
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

test("value premium chart legend matches rendered series logic", async () => {
  const page = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(
    new URL("../app/styles/value-page.css", import.meta.url),
    "utf8",
  );

  assert.match(page, /assumptionsConfigured \?/);
  assert.match(page, /Estimated value protected/);
  assert.match(page, /Threats stopped \(relative\)/);
  assert.match(page, /className="is-value"/);
  assert.match(page, /className="is-blocked is-context"/);
  assert.match(page, /data-density=\{/);
  assert.match(css, /\.bv-chart\[data-density="sparse"\]/);
  assert.match(css, /\.bv-chart\[data-density="medium"\]/);
  assert.match(css, /\.bv-chart\[data-density="dense"\]/);
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
  assert.match(css, /@keyframes bv-page-enter/);
  assert.match(css, /@keyframes bv-flow-reveal/);
  assert.match(css, /@keyframes bv-chart-draw/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /animation: none !important/);
});

test("value premium responsive breakpoints and icon geometry exist", async () => {
  const css = await readFile(
    new URL("../app/styles/value-page.css", import.meta.url),
    "utf8",
  );

  assert.match(css, /\.bv-icon/);
  assert.match(css, /width: 18px/);
  assert.match(css, /@media \(max-width: 1200px\)/);
  assert.match(css, /@media \(max-width: 980px\)/);
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
  assert.doesNotMatch(page, /defaultAssumptions/);
  assert.doesNotMatch(page, /fake/i);
});
