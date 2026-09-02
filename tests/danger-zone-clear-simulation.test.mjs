import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildClearTestDataWhere,
  clearShopTestData,
} from "../app/lib/clear-test-data.server.js";

const CLEAR_SIMULATION_COPY =
  "Permanently delete all simulation and test activity from BotShield. Live storefront activity, protection settings, blocklists, and trusted visitors will remain unchanged.";

function createMockDb(initialEvents = []) {
  const botEvents = [...initialEvents];

  return {
    botEvent: {
      async deleteMany({ where }) {
        const shop = where.shop;
        const before = botEvents.length;

        for (let index = botEvents.length - 1; index >= 0; index -= 1) {
          const event = botEvents[index];
          if (event.shop === shop && event.source !== "storefront-proxy") {
            botEvents.splice(index, 1);
          }
        }

        return { count: before - botEvents.length };
      },
    },
    _botEvents: botEvents,
  };
}

test("buildClearTestDataWhere scopes cleanup to the current shop and non-live sources", () => {
  assert.deepEqual(buildClearTestDataWhere("Example.myshopify.com"), {
    shop: "example.myshopify.com",
    source: { not: "storefront-proxy" },
  });
});

test("clearShopTestData deletes simulation and diagnostic test events after confirmation semantics", async () => {
  const db = createMockDb([
    { id: 1, shop: "alpha.myshopify.com", source: "dashboard-simulation" },
    { id: 2, shop: "alpha.myshopify.com", source: "diagnostic-scan" },
    { id: 3, shop: "alpha.myshopify.com", source: "storefront-proxy" },
  ]);

  const result = await clearShopTestData(db, "Alpha.myshopify.com");

  assert.equal(result.ok, true);
  assert.equal(result.deleted, 2);
  assert.deepEqual(
    db._botEvents.map((event) => event.id),
    [3],
  );
});

test("clearShopTestData preserves live storefront-proxy events", async () => {
  const db = createMockDb([
    { id: 10, shop: "alpha.myshopify.com", source: "storefront-proxy" },
    { id: 11, shop: "alpha.myshopify.com", source: "storefront-proxy" },
  ]);

  const result = await clearShopTestData(db, "alpha.myshopify.com");

  assert.equal(result.deleted, 0);
  assert.equal(db._botEvents.length, 2);
});

test("clearShopTestData does not delete another shop's simulation events", async () => {
  const db = createMockDb([
    { id: 1, shop: "alpha.myshopify.com", source: "dashboard-simulation" },
    { id: 2, shop: "beta.myshopify.com", source: "dashboard-simulation" },
    { id: 3, shop: "alpha.myshopify.com", source: "storefront-proxy" },
  ]);

  await clearShopTestData(db, "alpha.myshopify.com");

  assert.deepEqual(
    db._botEvents.map((event) => event.id),
    [2, 3],
  );
});

test("clearShopTestData is safe and idempotent when no simulation events remain", async () => {
  const db = createMockDb([
    { id: 1, shop: "alpha.myshopify.com", source: "storefront-proxy" },
  ]);

  const first = await clearShopTestData(db, "alpha.myshopify.com");
  const second = await clearShopTestData(db, "alpha.myshopify.com");

  assert.equal(first.deleted, 0);
  assert.equal(second.deleted, 0);
  assert.equal(db._botEvents.length, 1);
});

test("clear-test-data route delegates to shop-scoped server helper and preserves merchant data tables", async () => {
  const libSource = await readFile(
    new URL("../app/lib/clear-test-data.server.js", import.meta.url),
    "utf8",
  );
  const routeSource = await readFile(
    new URL("../app/routes/api.clear-test-data.jsx", import.meta.url),
    "utf8",
  );

  assert.match(libSource, /source: \{ not: "storefront-proxy" \}/);
  assert.match(routeSource, /clearShopTestData\(db, session\.shop\)/);
  assert.doesNotMatch(routeSource, /blockedIP\.deleteMany/);
  assert.doesNotMatch(routeSource, /whitelistIP\.deleteMany/);
  assert.doesNotMatch(routeSource, /appSetting\.deleteMany/);
  assert.doesNotMatch(libSource, /blockedIP\.deleteMany/);
  assert.doesNotMatch(libSource, /whitelistIP\.deleteMany/);
  assert.doesNotMatch(libSource, /appSetting\.deleteMany/);
});

test("Danger zone clear simulation requires confirmation before POST", async () => {
  const adminSource = await readFile(
    new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
    "utf8",
  );
  const designSource = await readFile(
    new URL("../app/components/design-system/BotShieldDesignSystem.jsx", import.meta.url),
    "utf8",
  );
  const dangerSection = adminSource.slice(
    adminSource.indexOf('className="botshield-settings-hub-section is-panel-danger"'),
    adminSource.indexOf('activeSection === "danger"'),
  );

  assert.match(dangerSection, /commandFor="botshield-clear-simulation-modal"/);
  assert.match(dangerSection, /command="--show"/);
  assert.doesNotMatch(
    dangerSection,
    /Clear simulation data[\s\S]{0,200}safeFetchJson\("\/api\/clear-test-data"/,
  );
  assert.match(adminSource, /heading="Clear simulation data\?"/);
  assert.match(adminSource, /confirmLabel="Clear simulation data"/);
  assert.match(designSource, /await onConfirm\?\.\(\)/);
  assert.match(designSource, /Cancel/);
});

test("Cancel and dismiss do not call the clear-test-data endpoint", async () => {
  const designSource = await readFile(
    new URL("../app/components/design-system/BotShieldDesignSystem.jsx", import.meta.url),
    "utf8",
  );

  assert.match(designSource, /export function BotShieldConfirmationModal/);
  assert.match(designSource, /const handleDismiss = \(\) => \{/);
  assert.doesNotMatch(
    designSource.match(
      /export function BotShieldConfirmationModal[\s\S]*?^}/m,
    )?.[0] || "",
    /clear-test-data/,
  );
});

test("Danger zone uses precise permanent-delete copy in section and modal", async () => {
  const adminSource = await readFile(
    new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
    "utf8",
  );

  assert.match(adminSource, /CLEAR_SIMULATION_DATA_DESCRIPTION/);
  assert.match(adminSource, new RegExp(CLEAR_SIMULATION_COPY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(
    adminSource,
    /Remove test events from analytics/,
  );
});

test("Successful clear shows success toast, refreshes state, and clears stale simulation UI", async () => {
  const adminSource = await readFile(
    new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
    "utf8",
  );
  const confirmHandler = adminSource.match(
    /onConfirm=\{async \(\) => \{[\s\S]*?finally \{\s*setClearingSimulation\(false\);\s*\}\s*\}\}/,
  )?.[0];

  assert.ok(confirmHandler);
  assert.match(confirmHandler, /safeFetchJson\("\/api\/clear-test-data"/);
  assert.match(confirmHandler, /await actions\.refresh\(\)/);
  assert.match(confirmHandler, /setSimulationResults\(null\)/);
  assert.match(confirmHandler, /toast\.success\("Simulation data cleared"\)/);
});

test("Failed clear does not show false success and surfaces retryable error feedback", async () => {
  const adminSource = await readFile(
    new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
    "utf8",
  );
  const confirmHandler = adminSource.match(
    /onConfirm=\{async \(\) => \{[\s\S]*?finally \{\s*setClearingSimulation\(false\);\s*\}\s*\}\}/,
  )?.[0];

  assert.ok(confirmHandler);
  assert.match(confirmHandler, /catch \(error\)/);
  assert.match(confirmHandler, /toast\.error\(message\)/);
  assert.match(confirmHandler, /throw error/);
  assert.doesNotMatch(
    confirmHandler.match(/catch \(error\) \{[\s\S]*?\}/)?.[0] || "",
    /toast\.success/,
  );
  assert.match(adminSource, /loading=\{clearingSimulation\}/);
  assert.match(adminSource, /title="Couldn't clear simulation data"/);
});

test("Data and privacy simulation count reflects backend simulated scans", async () => {
  const adminSource = await readFile(
    new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
    "utf8",
  );
  const appIndexSource = await readFile(
    new URL("../app/routes/app._index.jsx", import.meta.url),
    "utf8",
  );

  assert.match(adminSource, /getSimulationCount\(model\)/);
  assert.match(adminSource, /No simulated activity/);
  assert.match(adminSource, /model\.simulatedScans/);
  assert.match(appIndexSource, /simulatedScans,/);
});

test("Storefront event totals remain sourced from live storefront-proxy activity", async () => {
  const appIndexSource = await readFile(
    new URL("../app/routes/app._index.jsx", import.meta.url),
    "utf8",
  );
  const libSource = await readFile(
    new URL("../app/lib/clear-test-data.server.js", import.meta.url),
    "utf8",
  );

  assert.match(appIndexSource, /source !== "storefront-proxy"/);
  assert.match(libSource, /not: "storefront-proxy"/);
});
