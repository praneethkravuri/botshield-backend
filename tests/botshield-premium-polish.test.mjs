import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const FORBIDDEN_LAYOUT_PATTERNS = [
  /\bdisplay\s*:/,
  /\bgrid-template\s*:/,
  /\bflex\s*:/,
  /\bposition\s*:\s*fixed/,
  /\bwidth\s*:/,
  /\bheight\s*:/,
  /\bmargin\s*:/,
  /\bpadding\s*:/,
];

test("premium polish stylesheet avoids layout-affecting declarations", async () => {
  const css = await readFile(
    new URL("../app/styles/botshield-premium-polish.css", import.meta.url),
    "utf8",
  );

  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /\.botshield-analytics-v2/);
  assert.match(css, /\.botshield-overview-v2/);
  assert.match(css, /\.botshield-protection-content/);
  assert.match(css, /\.botshield-fraud-orders-content/);
  assert.match(css, /\.botshield-settings-hub-content/);

  for (const pattern of FORBIDDEN_LAYOUT_PATTERNS) {
    assert.doesNotMatch(css, pattern);
  }
});

test("premium polish is CSS-only with no admin experience markup changes", async () => {
  const designSystem = await readFile(
    new URL("../app/components/design-system/BotShieldDesignSystem.jsx", import.meta.url),
    "utf8",
  );
  const adminExperience = await readFile(
    new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
    "utf8",
  );

  assert.match(designSystem, /botshield-premium-polish\.css/);
  assert.doesNotMatch(adminExperience, /botshield-premium-polish/);
  assert.doesNotMatch(adminExperience, /bs-motion-/);
  assert.doesNotMatch(adminExperience, /AnimatedMetricNumber/);
  assert.doesNotMatch(adminExperience, /bs-motion-period-surface/);
});

test("analytics layout contracts remain unchanged", async () => {
  const adminExperience = await readFile(
    new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
    "utf8",
  );

  assert.match(
    adminExperience,
    /<BotShieldPageShell className="botshield-analytics-content botshield-analytics-v2">/,
  );
  assert.match(adminExperience, /className="botshield-analytics-kpis"/);
  assert.match(adminExperience, /className="botshield-analytics-split botshield-analytics-split--primary"/);
  assert.doesNotMatch(adminExperience, /key=\{`analytics-period-/);
});

test("value page remains untouched by premium polish pass", async () => {
  const valuePage = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );

  assert.match(valuePage, /value-page\.css/);
  assert.match(valuePage, /bv-hero/);
  assert.doesNotMatch(valuePage, /botshield-premium-polish/);
});
