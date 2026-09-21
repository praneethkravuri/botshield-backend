import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("fraud orders premium stylesheet is scoped and supports reduced motion", async () => {
  const css = await readFile(
    new URL("../app/styles/fraud-orders-premium.css", import.meta.url),
    "utf8",
  );

  assert.match(css, /\.botshield-fraud-orders-premium/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /--fo-workspace-max:/);
  assert.match(css, /\.botshield-fraud-review-hero/);
  assert.match(css, /\.botshield-fraud-table-wrap[\s\S]*overflow-x: auto/);
  assert.match(
    css,
    /s-table-cell:nth-child\(3\)[\s\S]*s-badge\[tone="neutral"\]/,
  );
  assert.doesNotMatch(css, /\.botshield-analytics-premium/);
  assert.doesNotMatch(css, /\.botshield-protection-premium/);
  assert.doesNotMatch(css, /\.botshield-overview-premium/);
});

test("fraud orders premium motion contracts stay scoped and purposeful", async () => {
  const css = await readFile(
    new URL("../app/styles/fraud-orders-premium.css", import.meta.url),
    "utf8",
  );

  assert.match(css, /--fo-motion-instant:/);
  assert.match(css, /--fo-motion-fast:/);
  assert.match(css, /--fo-motion-normal:/);
  assert.match(css, /--fo-motion-slow:/);
  assert.match(css, /@keyframes fo-page-enter/);
  assert.match(css, /@keyframes fo-row-enter/);
  assert.match(
    css,
    /\.botshield-fraud-table-wrap s-table-body > s-table-row[\s\S]*animation: fo-row-enter/,
  );
  assert.match(
    css,
    /s-table-body > s-table-row:nth-child\(n \+ 9\)[\s\S]*animation-delay: 245ms/,
  );
  assert.match(
    css,
    /\.botshield-fraud-snapshot-item\.is-interactive:hover[\s\S]*translateY\(-2px\)/,
  );
  assert.match(
    css,
    /s-page:has\(\.botshield-fraud-orders-premium\) s-button\[disabled\]\[slot="secondary-actions"\]/,
  );
  assert.doesNotMatch(css, /@keyframes[\s\S]*pending[\s\S]*infinite/);
  assert.doesNotMatch(css, /\.botshield-overview-v2/);
  assert.doesNotMatch(css, /\.botshield-analytics-v2/);
  assert.doesNotMatch(css, /\.botshield-protection-content/);
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*s-table-body > s-table-row[\s\S]*animation: none !important/,
  );
});

test("fraud orders premium wiring stays fraud-only", async () => {
  const adminExperience = await readFile(
    new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
    "utf8",
  );
  const analyticsPage = adminExperience.slice(
    adminExperience.indexOf("function AnalyticsPage"),
    adminExperience.indexOf("function AnalyticsKpi"),
  );
  const protectionPage = adminExperience.slice(
    adminExperience.indexOf("function ProtectionPage"),
    adminExperience.indexOf("function IpList"),
  );
  const fraudPage = adminExperience.slice(
    adminExperience.indexOf("function FraudOrdersPage"),
    adminExperience.indexOf("function getProtectionModalSize"),
  );

  assert.match(adminExperience, /fraud-orders-premium\.css/);
  assert.match(
    adminExperience,
    /className="botshield-fraud-orders-content botshield-fraud-orders-premium"/,
  );
  const fraudTable = adminExperience.slice(
    adminExperience.indexOf("function FraudOrderResourceTable"),
    adminExperience.indexOf("function FraudOrdersPage"),
  );

  assert.match(fraudTable, /botshield-fraud-table-wrap/);
  assert.match(fraudTable, /BotShieldTableBody/);
  assert.match(fraudTable, /BotShieldTableRow/);
  assert.match(fraudTable, /riskLabel\(order\)/);
  assert.match(fraudPage, /riskLabel=\{riskLabel\}/);
  assert.match(fraudPage, /refreshFraudOrders/);
  assert.match(fraudPage, /botshield-fraud-review-hero/);
  assert.doesNotMatch(analyticsPage, /fraud-orders-premium/);
  assert.doesNotMatch(protectionPage, /fraud-orders-premium/);
});
