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
const overviewSource = adminSource.slice(
  adminSource.indexOf("function OverviewPage"),
  adminSource.indexOf("function AnalyticsPage"),
);

test("Overview store health refresh uses a dedicated lifecycle", () => {
  assert.match(indexSource, /const refreshStoreHealth = async \(\) =>/);
  assert.match(indexSource, /storeHealthRefreshInFlight\.current/);
  assert.match(indexSource, /storeHealthRefreshing/);
  assert.match(indexSource, /storeHealthRefreshError/);
  assert.match(indexSource, /loadThemeExtensionStatus\(\{ throwOnError: true \}\)/);
  assert.match(indexSource, /loadProtectionStatus\(\{ throwOnError: true \}\)/);
  assert.match(indexSource, /loadOverviewThreatActivity\(\{ throwOnError: true \}\)/);
  assert.match(indexSource, /refreshStoreHealth,/);
});

test("Overview refresh status button shows loading and merchant feedback", () => {
  assert.match(overviewSource, /handleRefreshStoreHealth/);
  assert.match(overviewSource, /toast\.success\("Store health updated"\)/);
  assert.match(overviewSource, /disabled=\{model\.storeHealthRefreshing\}/);
  assert.match(overviewSource, /loading=\{model\.storeHealthRefreshing\}/);
  assert.match(overviewSource, /Refresh status/);
  assert.match(indexSource, /Couldn't refresh store health\./);
  assert.doesNotMatch(
    overviewSource,
    /Refresh status[\s\S]{0,220}onClick=\{storefrontSensorActive \? actions\.refresh/,
  );
});

test("Overview threat activity retry uses the same store health refresh lifecycle", () => {
  const threatErrorStart = overviewSource.indexOf("botshield-v2-chart-error");
  assert.notEqual(threatErrorStart, -1);
  const threatErrorSection = overviewSource.slice(
    threatErrorStart,
    threatErrorStart + 700,
  );
  assert.match(threatErrorSection, /handleRefreshStoreHealth/);
  assert.match(threatErrorSection, /Refresh data/);
  assert.doesNotMatch(threatErrorSection, /onClick=\{actions\.refresh\}/);
});
