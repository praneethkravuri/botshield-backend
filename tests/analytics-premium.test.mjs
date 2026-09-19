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
  assert.match(css, /--ba-workspace-max: min\(100%, 1440px\)/);
  assert.match(css, /--ba-gutter:/);
  assert.match(css, /--ba-panel-padding:/);
  assert.match(css, /\.botshield-analytics-premium > \.ba-page-intro[\s\S]*overflow: hidden/);
  assert.match(css, /\.botshield-analytics-premium > \.botshield-analytics-kpis/);
  assert.match(
    css,
    /\.botshield-analytics-premium\.botshield-analytics-v2 > \.botshield-analytics-split[\s\S]*width: 100%/,
  );
  assert.match(
    css,
    /\.botshield-analytics-split--primary[\s\S]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/,
  );
  assert.doesNotMatch(css, /box-shadow: inset 3px 0 0/);
  assert.match(
    css,
    /\.botshield-analytics-compact-ranking > div[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto auto/,
  );
  assert.match(
    css,
    /\.botshield-analytics-compact-ranking \.botshield-analytics-bar-track[\s\S]*grid-column: 1 \/ -1/,
  );
  assert.match(css, /\.botshield-analytics-compact-ranking[\s\S]*max-width: none/);
  assert.match(css, /\.botshield-analytics-table-wrap[\s\S]*overflow-x: auto/);
  assert.match(css, /\.botshield-analytics-ranked-row[\s\S]*minmax\(0,/);
  assert.match(css, /\.botshield-analytics-risk-row[\s\S]*minmax\(0, 1fr\)/);
  assert.doesNotMatch(css, /\.botshield-analytics-ranked-row:hover[\s\S]*margin-inline: -/);
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
