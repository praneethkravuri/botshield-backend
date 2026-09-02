import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("App & diagnostics refresh status uses async button with success and error toasts", async () => {
  const adminSource = await readFile(
    new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
    "utf8",
  );
  const appIndexSource = await readFile(
    new URL("../app/routes/app._index.jsx", import.meta.url),
    "utf8",
  );
  const designSource = await readFile(
    new URL("../app/components/design-system/BotShieldDesignSystem.jsx", import.meta.url),
    "utf8",
  );

  const diagnosticsSection = adminSource.slice(
    adminSource.indexOf('if (activeSection === "diagnostics")'),
    adminSource.indexOf('title="Refresh application data"'),
  );

  assert.match(adminSource, /actions\.refreshApplicationStatus/);
  assert.match(adminSource, /successMessage="Application status refreshed"/);
  assert.match(
    adminSource,
    /errorMessage="Couldn't refresh application status\. Try again\."/,
  );
  const refreshControl = adminSource.slice(
    adminSource.indexOf("actions.refreshApplicationStatus"),
    adminSource.indexOf("actions.refreshApplicationStatus") + 500,
  );
  assert.match(refreshControl, /BotShieldAsyncButton/);
  assert.match(refreshControl, /Refresh status/);
  assert.match(appIndexSource, /refreshApplicationStatus/);
  assert.match(appIndexSource, /refreshBackendState\(\{ throwOnError: true \}\)/);
  assert.match(designSource, /loading={asyncAction\.loading}/);
});

test("refresh application status propagates loader failures instead of faking success", async () => {
  const appIndexSource = await readFile(
    new URL("../app/routes/app._index.jsx", import.meta.url),
    "utf8",
  );

  assert.match(appIndexSource, /loadBackendState = async \(\{ throwOnError = false \} = \{\}\) =>/);
  assert.match(appIndexSource, /loadSettings\(\{ throwOnError \}\)/);
  assert.match(appIndexSource, /loadProtectionStatus\(\{ throwOnError \}\)/);
  assert.match(appIndexSource, /if \(throwOnError\) throw error;/);
  assert.match(appIndexSource, /if \(throwOnError\) throw err;/);
});
