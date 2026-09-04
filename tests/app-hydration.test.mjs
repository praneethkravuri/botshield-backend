import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const adminSource = await readFile(
  new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
  "utf8",
);
const designSource = await readFile(
  new URL("../app/components/design-system/BotShieldDesignSystem.jsx", import.meta.url),
  "utf8",
);
const polarisSource = await readFile(
  new URL("../app/components/design-system/BotShieldHydrationPolaris.jsx", import.meta.url),
  "utf8",
);
const hydrationUiSource = await readFile(
  new URL("../app/lib/hydration-safe-ui.jsx", import.meta.url),
  "utf8",
);
const appRouteSource = await readFile(
  new URL("../app/routes/app.jsx", import.meta.url),
  "utf8",
);
const appIndexSource = await readFile(
  new URL("../app/routes/app._index.jsx", import.meta.url),
  "utf8",
);
const navSource = await readFile(
  new URL("../app/components/BotShieldEmbeddedAppProvider.jsx", import.meta.url),
  "utf8",
);

const overviewSource = adminSource.slice(
  adminSource.indexOf("function OverviewPage"),
  adminSource.indexOf("function AnalyticsPage"),
);
const analyticsSource = adminSource.slice(
  adminSource.indexOf("function AnalyticsPage"),
  adminSource.indexOf("function FraudOrdersPage"),
);
const fraudOrdersSource = adminSource.slice(
  adminSource.indexOf("function FraudReviewQueueToolbar"),
  adminSource.indexOf("function ProtectionPage"),
);
const protectionSource = adminSource.slice(
  adminSource.indexOf("function ProtectionPage"),
  adminSource.indexOf("function SettingsPage"),
);
const settingsSource = adminSource.slice(
  adminSource.indexOf("function SettingsPage"),
  adminSource.indexOf("export default function BotShieldAdminExperience"),
);
const diagnosticsSettingsSource = settingsSource.slice(
  settingsSource.indexOf('if (activeSection === "diagnostics")'),
  settingsSource.indexOf('return (\n      <section className="botshield-settings-hub-section is-panel-danger"'),
);

test("app loader exposes a stable SSR render anchor timestamp", () => {
  assert.match(appRouteSource, /renderAnchorMs:\s*Date\.now\(\)/);
  assert.match(appIndexSource, /renderAnchorMs:\s*appRouteData\.renderAnchorMs/);
});

test("shared Polaris wrappers render real Shopify web components", () => {
  assert.doesNotMatch(polarisSource, /useBotShieldClientMount/);
  assert.match(polarisSource, /createPolarisComponent\("s-stack"\)/);
  assert.match(polarisSource, /BotShieldPolarisButtonComponent/);
  assert.match(polarisSource, /useBotShieldCustomElementClick/);
  assert.match(polarisSource, /createElement\("s-page"/);
  assert.doesNotMatch(polarisSource, /createLayoutHost\("stack"\)/);
  assert.doesNotMatch(polarisSource, /createLeafHost\("button"/);
});

test("embedded app route uses deferred polaris provider for hydration-safe SSR", () => {
  assert.match(appRouteSource, /BotShieldEmbeddedAppProvider apiKey=\{apiKey\}/);
  assert.doesNotMatch(appRouteSource, /AppProvider embedded apiKey=\{apiKey\}/);
});

test("hydration-safe relative time uses a stable placeholder before mount", () => {
  assert.match(hydrationUiSource, /mountedLabel = "Recent activity"/);
  assert.match(hydrationUiSource, /if \(!mounted\) return mountedLabel/);
  assert.match(hydrationUiSource, /useHydrationStableNow/);
});

test("merchant admin shell routes Polaris markup through shared wrappers", () => {
  assert.doesNotMatch(adminSource, /<s-[a-z-]+/);
  assert.match(adminSource, /BotShieldStack/);
  assert.match(adminSource, /BotShieldHydrationRelativeTime/);
  assert.match(adminSource, /formatHydrationStableDateTime/);
  assert.match(adminSource, /formatHydrationStableNumber/);
});

test("Overview uses stable render anchor for time-window calculations", () => {
  assert.match(overviewSource, /useHydrationStableNow\(model\.renderAnchorMs\)/);
  assert.match(overviewSource, /buildOverviewThreatSeries\([^\)]*now\)/);
  assert.doesNotMatch(overviewSource, /formatRelativeTime\(/);
});

test("Analytics uses stable render anchor for bucket and period math", () => {
  assert.match(analyticsSource, /const now = useHydrationStableNow\(model\.renderAnchorMs\)/);
  assert.match(analyticsSource, /const periodStart = now - periodDays/);
  assert.doesNotMatch(analyticsSource, /Date\.now\(\)/);
  assert.match(analyticsSource, /BotShieldHydrationRelativeTime/);
});

test("Protection uses stable render anchor for module activity windows", () => {
  assert.match(protectionSource, /useHydrationStableNow\(model\.renderAnchorMs\)/);
  assert.match(protectionSource, /buildModuleProtectionActivity\([\s\S]*?\bnow\b/);
});

test("embedded app route renders persistent Shopify s-app-nav during SSR", () => {
  assert.match(navSource, /<s-app-nav>/);
  assert.match(navSource, /BotShieldNavLink/);
  assert.match(navSource, /useBotShieldCustomElementClick/);
  assert.doesNotMatch(navSource, /return null;/);
});

test("Fraud Orders uses hydration-safe Polaris table and search primitives", () => {
  assert.match(fraudOrdersSource, /BotShieldSearchField/);
  assert.match(fraudOrdersSource, /BotShieldTable/);
  assert.match(fraudOrdersSource, /BotShieldTableRow/);
  assert.doesNotMatch(fraudOrdersSource, /<s-table|<s-search-field/);
});

test("Settings general and diagnostics avoid hydration-unsafe patterns", () => {
  assert.match(settingsSource, /model\.initialSettingsSection/);
  assert.match(settingsSource, /getSettingsBillingView\([^\)]*model\.renderAnchorMs\)/);
  assert.match(settingsSource, /BotShieldHydrationRelativeTime/);
  assert.doesNotMatch(settingsSource, /useState\(readSettingsHubSection\)/);
  assert.doesNotMatch(diagnosticsSettingsSource, /<s-stack|<s-text|<s-button/);
});

test("design system modals and save state defer browser-only branches", () => {
  assert.doesNotMatch(designSource, /useBotShieldClientMount/);
  assert.match(designSource, /setIsPreviewRoute\(window\.location\.pathname\.startsWith\("\/ui-preview"\)\)/);
  assert.doesNotMatch(
    designSource,
    /const isPreviewRoute =\s*\n\s*typeof window !== "undefined"/,
  );
});
