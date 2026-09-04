import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const indexSource = fs.readFileSync(
  new URL("../app/routes/app._index.jsx", import.meta.url),
  "utf8",
);
const adminSource = fs.readFileSync(
  new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
  "utf8",
);
const appNavSource = fs.readFileSync(
  new URL("../app/components/BotShieldEmbeddedAppProvider.jsx", import.meta.url),
  "utf8",
);
const overviewSource = adminSource.slice(
  adminSource.indexOf("function OverviewPage"),
  adminSource.indexOf("function AnalyticsPage"),
);
const protectionSource = adminSource.slice(
  adminSource.indexOf("function ProtectionPage"),
  adminSource.indexOf("function SettingsPage"),
);

test("Overview protection Configure controls deep-link to module managers", () => {
  for (const module of ["bot", "network", "rate", "page"]) {
    assert.match(overviewSource, new RegExp(`module: "${module}"`));
  }
  assert.match(overviewSource, /openProtectionModule\?\.\(row\.module\)/);
  assert.match(indexSource, /openProtectionModule: \(module\) =>/);
  assert.match(indexSource, /setProtectionEntryIntent\(module\)/);
  assert.match(protectionSource, /bot: openBotProtectionModule/);
  assert.match(protectionSource, /createBotProtectionModalState/);
  assert.doesNotMatch(
    protectionSource.slice(
      protectionSource.indexOf("bot: openBotProtectionModule"),
      protectionSource.indexOf("network: openNetworkProtectionModule"),
    ),
    /openProfileManager/,
  );
});

test("Protection page opens existing module managers from entry intent", () => {
  assert.match(protectionSource, /bot: openBotProtectionModule/);
  assert.match(protectionSource, /network: openNetworkProtectionModule/);
  assert.match(protectionSource, /rate: openRateProtectionModule/);
  assert.match(protectionSource, /page: openPageProtectionModule/);
  assert.match(protectionSource, /actions\.clearProtectionEntryIntent\?\.\(\)/);
  assert.match(protectionSource, /if \(guardProfileDraft\(\)\) return undefined;/);
});

test("Direct Protection navigation does not auto-open module managers", () => {
  assert.match(appNavSource, /href: "\/app\/protection-rules"/);
  assert.match(appNavSource, /label: "Protection"/);
  assert.doesNotMatch(appNavSource, /protectionEntryIntent/);
  const locationSyncSource = indexSource.slice(
    indexSource.indexOf("const requestedView = new URLSearchParams(location.search).get(\"view\");"),
    indexSource.indexOf("}, [location.pathname, location.search, navigate]);") +
      "}, [location.pathname, location.search, navigate]);".length,
  );
  assert.doesNotMatch(locationSyncSource, /setProtectionEntryIntent/);
});
