import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("analytics premium stylesheet is scoped and supports reduced motion", async () => {
  const css = await readFile(
    new URL("../app/styles/analytics-premium.css", import.meta.url),
    "utf8",
  );

  assert.match(css, /\.botshield-analytics-premium/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /\.ba-page-intro/);
  assert.match(css, /\.ba-primary-chart/);
  assert.match(css, /\.ba-event-explorer-panel/);
  assert.match(css, /--ba-teal:/);
  assert.match(css, /--ba-radius-panel:/);
  assert.match(css, /--ba-workspace-max:/);
  assert.match(css, /\.botshield-analytics-premium > \.ba-page-intro/);
  assert.match(css, /\.botshield-analytics-premium > \.botshield-analytics-kpis/);
  assert.match(css, /@keyframes ba-bar-width/);
  assert.match(css, /select:has\(option:checked:not\(\[value="all"\]\)\)/);
  assert.match(css, /\.ba-event-explorer-panel/);
  assert.doesNotMatch(css, /\.botshield-overview-premium/);
  assert.doesNotMatch(css, /\.botshield-protection-premium/);
});

test("analytics premium wiring stays analytics-only", async () => {
  const adminExperience = await readFile(
    new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
    "utf8",
  );
  const valuePage = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );
  const protectionPage = adminExperience.slice(
    adminExperience.indexOf("function ProtectionPage"),
    adminExperience.indexOf("function IpList"),
  );
  const analyticsPage = adminExperience.slice(
    adminExperience.indexOf("function AnalyticsPage"),
    adminExperience.indexOf("function AnalyticsKpi"),
  );

  assert.match(adminExperience, /analytics-premium\.css/);
  assert.match(
    adminExperience,
    /className="botshield-analytics-content botshield-analytics-v2 botshield-analytics-premium"/,
  );
  assert.match(analyticsPage, /className="ba-page-intro"/);
  assert.match(analyticsPage, /className="ba-primary-chart"/);
  assert.match(analyticsPage, /className="ba-event-explorer-panel"/);
  assert.match(analyticsPage, /await actions\.refreshAnalytics\?\.\(\)/);
  assert.match(analyticsPage, /setSelectedEvent\(event\)/);
  assert.match(analyticsPage, /animateNumber label="Suspicious events"/);
  assert.match(adminExperience, /OverviewAnimatedNumber value={value}/);

  assert.doesNotMatch(valuePage, /analytics-premium/);
  assert.doesNotMatch(protectionPage, /analytics-premium/);
});
