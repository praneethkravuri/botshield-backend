import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("overview premium stylesheet is scoped and supports reduced motion", async () => {
  const css = await readFile(
    new URL("../app/styles/overview-premium.css", import.meta.url),
    "utf8",
  );

  assert.match(css, /\.botshield-overview-premium/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /\.bo-page-intro/);
  assert.match(css, /\.botshield-v2-status/);
  assert.match(css, /\.botshield-v2-kpi-card/);
  assert.match(css, /\.botshield-v2-health-item \.botshield-v2-icon/);
  assert.match(css, /\.botshield-v2-impact-metric \.botshield-v2-icon/);
  assert.match(css, /column-gap:\s*12px/);
  assert.match(css, /\.botshield-v2-protection-panel \.botshield-v2-protection-list/);
  assert.match(css, /grid-template-areas:[\s\S]*"icon copy"/);
  assert.match(css, /\.botshield-v2-protection-copy span[\s\S]*white-space:\s*normal/);
  assert.match(css, /\.botshield-v2-threat-summary/);
  assert.match(css, /\.botshield-v2-quick-action-row--primary > s-button/);
  assert.match(css, /grid-template-areas:[\s\S]*"cta cta"/);
  assert.doesNotMatch(css, /\.botshield-analytics-v2/);
  assert.doesNotMatch(css, /\.botshield-protection-content/);
});

test("overview premium wiring stays overview-only", async () => {
  const adminExperience = await readFile(
    new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
    "utf8",
  );
  const valuePage = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );

  assert.match(adminExperience, /overview-premium\.css/);
  assert.match(adminExperience, /OverviewAnimatedNumber/);
  assert.match(
    adminExperience,
    /className="botshield-overview-content botshield-overview-v2 botshield-overview-premium"/,
  );
  assert.match(adminExperience, /className="bo-page-intro"/);
  assert.match(adminExperience, /bo-refresh-spin/);
  assert.match(adminExperience, /reporting:\s*"chart-line"/);
  assert.doesNotMatch(
    adminExperience,
    /botshield-v2-impact-metric[\s\S]*style=\{\{\s*alignItems:\s*"center"\s*\}\}/,
  );
  assert.match(adminExperience, /className="botshield-v2-threat-summary"/);
  assert.match(
    adminExperience,
    /Review protection[\s\S]*onClick=\{\(\) => actions\.setPage\("detection"\)\}/,
  );

  assert.doesNotMatch(valuePage, /overview-premium/);
  assert.doesNotMatch(valuePage, /OverviewAnimatedNumber/);
  assert.match(
    adminExperience,
    /<BotShieldPageShell className="botshield-analytics-content botshield-analytics-v2 botshield-analytics-premium">/,
  );
  assert.match(
    adminExperience,
    /<BotShieldPageShell className="botshield-protection-content/,
  );
});

test("overview motion helper SSRs final numeric values", async () => {
  const motion = await readFile(
    new URL("../app/lib/overview-motion.jsx", import.meta.url),
    "utf8",
  );

  assert.match(motion, /useState\(target\)/);
  assert.match(motion, /prefersReducedMotion/);
  assert.match(motion, /formatHydrationStableNumber/);
  assert.doesNotMatch(motion, /Math\.random/);
  assert.doesNotMatch(motion, /Date\.now/);
});