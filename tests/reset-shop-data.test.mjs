import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { clearShopTestData } from "../app/lib/clear-test-data.server.js";
import {
  BILLING_SETTING_KEY_PREFIX,
  DEFAULT_MERCHANT_SETTINGS,
  isBillingSettingKey,
  resetShopBotShieldData,
  RESET_CONFIRMATION_TEXT,
  shouldDeleteAppSettingKey,
} from "../app/lib/reset-shop-data.server.js";

function createMockDb(initial = {}) {
  const botEvents = [...(initial.botEvents || [])];
  const blockedIPs = [...(initial.blockedIPs || [])];
  const whitelistIPs = [...(initial.whitelistIPs || [])];
  const appSettings = [...(initial.appSettings || [])];
  const sessions = [...(initial.sessions || [])];

  const db = {
    botEvent: {
      async deleteMany({ where }) {
        const before = botEvents.length;
        for (let index = botEvents.length - 1; index >= 0; index -= 1) {
          const event = botEvents[index];
          const shopMatch = event.shop === where.shop;
          const sourceExcluded =
            where.source?.not &&
            event.source === where.source.not;
          if (shopMatch && !sourceExcluded) {
            botEvents.splice(index, 1);
          }
        }
        return { count: before - botEvents.length };
      },
    },
    blockedIP: {
      async deleteMany({ where }) {
        const before = blockedIPs.length;
        for (let index = blockedIPs.length - 1; index >= 0; index -= 1) {
          if (blockedIPs[index].shop === where.shop) {
            blockedIPs.splice(index, 1);
          }
        }
        return { count: before - blockedIPs.length };
      },
    },
    whitelistIP: {
      async deleteMany({ where }) {
        const before = whitelistIPs.length;
        for (let index = whitelistIPs.length - 1; index >= 0; index -= 1) {
          if (whitelistIPs[index].shop === where.shop) {
            whitelistIPs.splice(index, 1);
          }
        }
        return { count: before - whitelistIPs.length };
      },
    },
    appSetting: {
      async deleteMany({ where }) {
        const before = appSettings.length;
        for (let index = appSettings.length - 1; index >= 0; index -= 1) {
          const row = appSettings[index];
          const shopMatch = row.shop === where.shop;
          const billingExcluded =
            where.NOT?.key?.startsWith === BILLING_SETTING_KEY_PREFIX &&
            row.key.startsWith(BILLING_SETTING_KEY_PREFIX);
          if (shopMatch && !billingExcluded) {
            appSettings.splice(index, 1);
          }
        }
        return { count: before - appSettings.length };
      },
      async upsert({ where, create, update }) {
        const key = where.shop_key.key;
        const shop = where.shop_key.shop;
        const existing = appSettings.find(
          (row) => row.shop === shop && row.key === key,
        );
        if (existing) {
          existing.value = update.value;
          return existing;
        }
        const row = { ...create };
        appSettings.push(row);
        return row;
      },
    },
    session: {
      async deleteMany({ where }) {
        const before = sessions.length;
        for (let index = sessions.length - 1; index >= 0; index -= 1) {
          if (sessions[index].shop === where.shop) {
            sessions.splice(index, 1);
          }
        }
        return { count: before - sessions.length };
      },
    },
    async $transaction(callback) {
      return callback(db);
    },
    _botEvents: botEvents,
    _blockedIPs: blockedIPs,
    _whitelistIPs: whitelistIPs,
    _appSettings: appSettings,
    _sessions: sessions,
  };

  return db;
}

test("schema audit helpers classify billing keys as retained settings", () => {
  assert.equal(isBillingSettingKey("billingActive"), true);
  assert.equal(isBillingSettingKey("billingPlanHandle"), true);
  assert.equal(shouldDeleteAppSettingKey("alertEmail"), true);
  assert.equal(shouldDeleteAppSettingKey("billingActive"), false);
});

test("reset deletes real storefront and simulation telemetry for the current shop", async () => {
  const db = createMockDb({
    botEvents: [
      { id: 1, shop: "alpha.myshopify.com", source: "storefront-proxy" },
      { id: 2, shop: "alpha.myshopify.com", source: "dashboard-simulation" },
      { id: 3, shop: "beta.myshopify.com", source: "storefront-proxy" },
    ],
  });

  const result = await resetShopBotShieldData(db, "Alpha.myshopify.com");

  assert.equal(result.deleted.botEvents, 2);
  assert.deepEqual(
    db._botEvents.map((event) => event.id),
    [3],
  );
});

test("reset clears blocked and trusted visitors for the current shop", async () => {
  const db = createMockDb({
    blockedIPs: [
      { shop: "alpha.myshopify.com", ipAddress: "1.1.1.1" },
      { shop: "beta.myshopify.com", ipAddress: "2.2.2.2" },
    ],
    whitelistIPs: [
      { shop: "alpha.myshopify.com", ipAddress: "3.3.3.3" },
      { shop: "beta.myshopify.com", ipAddress: "4.4.4.4" },
    ],
  });

  const result = await resetShopBotShieldData(db, "alpha.myshopify.com");

  assert.equal(result.deleted.blockedIPs, 1);
  assert.equal(result.deleted.whitelistIPs, 1);
  assert.equal(db._blockedIPs.length, 1);
  assert.equal(db._whitelistIPs.length, 1);
});

test("reset clears incident and alert history settings while restoring merchant defaults", async () => {
  const db = createMockDb({
    appSettings: [
      { shop: "alpha.myshopify.com", key: "autoBlock", value: "false" },
      { shop: "alpha.myshopify.com", key: "alertEmail", value: "alerts@example.com" },
      { shop: "alpha.myshopify.com", key: "lastAlertStatus", value: "sent" },
      { shop: "alpha.myshopify.com", key: "lastStorefrontDecisionAt", value: "2026-09-01T00:00:00.000Z" },
      { shop: "alpha.myshopify.com", key: "billingActive", value: "true" },
      { shop: "alpha.myshopify.com", key: "billingPlanHandle", value: "basic" },
    ],
  });

  await resetShopBotShieldData(db, "alpha.myshopify.com");

  const settings = new Map(
    db._appSettings
      .filter((row) => row.shop === "alpha.myshopify.com")
      .map((row) => [row.key, row.value]),
  );

  assert.equal(settings.get("autoBlock"), DEFAULT_MERCHANT_SETTINGS.autoBlock);
  assert.equal(settings.get("alertEmail"), "");
  assert.equal(settings.get("emailAlerts"), "false");
  assert.equal(settings.get("weeklyReportsEnabled"), "false");
  assert.equal(settings.get("lastAlertStatus"), undefined);
  assert.equal(settings.get("lastStorefrontDecisionAt"), undefined);
  assert.equal(settings.get("billingActive"), "true");
  assert.equal(settings.get("billingPlanHandle"), "basic");
});

test("reset preserves Shopify session records and billing subscription state", async () => {
  const db = createMockDb({
    sessions: [{ id: "offline_alpha", shop: "alpha.myshopify.com" }],
    appSettings: [
      { shop: "alpha.myshopify.com", key: "billingActive", value: "true" },
      { shop: "alpha.myshopify.com", key: "billingSubscriptionId", value: "sub_123" },
    ],
  });

  await resetShopBotShieldData(db, "alpha.myshopify.com");

  assert.equal(db._sessions.length, 1);
  assert.equal(
    db._appSettings.find((row) => row.key === "billingSubscriptionId")?.value,
    "sub_123",
  );
});

test("reset cannot affect another shop's BotShield data", async () => {
  const db = createMockDb({
    botEvents: [{ id: 1, shop: "beta.myshopify.com", source: "storefront-proxy" }],
    blockedIPs: [{ shop: "beta.myshopify.com", ipAddress: "9.9.9.9" }],
    whitelistIPs: [{ shop: "beta.myshopify.com", ipAddress: "8.8.8.8" }],
    appSettings: [{ shop: "beta.myshopify.com", key: "alertEmail", value: "keep@example.com" }],
  });

  await resetShopBotShieldData(db, "alpha.myshopify.com");

  assert.equal(db._botEvents.length, 1);
  assert.equal(db._blockedIPs.length, 1);
  assert.equal(db._whitelistIPs.length, 1);
  assert.equal(db._appSettings[0].value, "keep@example.com");
});

test("clear simulation data still only removes non-live test telemetry", async () => {
  const db = createMockDb({
    botEvents: [
      { id: 1, shop: "alpha.myshopify.com", source: "storefront-proxy" },
      { id: 2, shop: "alpha.myshopify.com", source: "dashboard-simulation" },
    ],
    blockedIPs: [{ shop: "alpha.myshopify.com", ipAddress: "1.1.1.1" }],
    appSettings: [{ shop: "alpha.myshopify.com", key: "alertEmail", value: "alerts@example.com" }],
  });

  await clearShopTestData(db, "alpha.myshopify.com");

  assert.deepEqual(
    db._botEvents.map((event) => event.id),
    [1],
  );
  assert.equal(db._blockedIPs.length, 1);
  assert.equal(db._appSettings[0].value, "alerts@example.com");
});

test("reset route is authenticated, shop-scoped, and never deletes Shopify-owned tables", async () => {
  const routeSource = await readFile(
    new URL("../app/routes/api.reset-shop-data.jsx", import.meta.url),
    "utf8",
  );
  const libSource = await readFile(
    new URL("../app/lib/reset-shop-data.server.js", import.meta.url),
    "utf8",
  );

  assert.match(routeSource, /authenticate\.admin/);
  assert.match(routeSource, /resetShopBotShieldData\(db, session\.shop\)/);
  assert.doesNotMatch(libSource, /session\.deleteMany/);
  assert.doesNotMatch(libSource, /networkIntel\.deleteMany/);
  assert.doesNotMatch(routeSource, /order\.deleteMany/);
  assert.doesNotMatch(routeSource, /customer\.deleteMany/);
});

test("danger zone reset UI requires RESET confirmation and refreshes state on success", async () => {
  const adminSource = await readFile(
    new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
    "utf8",
  );
  const designSource = await readFile(
    new URL("../app/components/design-system/BotShieldDesignSystem.jsx", import.meta.url),
    "utf8",
  );

  assert.match(adminSource, /Reset BotShield data/);
  assert.match(adminSource, /commandFor="botshield-reset-data-modal"/);
  assert.match(adminSource, /BotShieldTypedConfirmationModal/);
  assert.match(adminSource, /confirmationText="RESET"/);
  assert.match(adminSource, /safeFetchJson\("\/api\/reset-shop-data"/);
  assert.match(adminSource, /toast\.success\("BotShield data reset"\)/);
  assert.match(adminSource, /await actions\.refresh\(\)/);
  assert.match(designSource, /disabled=\{!confirmed \|\| loading\}/);
  assert.match(designSource, /if \(!confirmed \|\| loading\) return;/);
});

test("failed reset does not show success toast", async () => {
  const adminSource = await readFile(
    new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
    "utf8",
  );
  const resetHandler = adminSource.match(
    /id="botshield-reset-data-modal"[\s\S]*?onConfirm=\{async \(\) => \{[\s\S]*?finally \{\s*setResettingBotShield\(false\);\s*\}\s*\}\}/,
  )?.[0];

  assert.ok(resetHandler);
  assert.match(resetHandler, /catch \(error\)/);
  assert.match(resetHandler, /toast\.error\(message\)/);
  assert.match(resetHandler, /throw error/);
  assert.doesNotMatch(
    resetHandler.match(/catch \(error\) \{[\s\S]*?\}/)?.[0] || "",
    /toast\.success/,
  );
});

test("clear simulation and reset actions remain separate in Danger zone copy", async () => {
  const adminSource = await readFile(
    new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
    "utf8",
  );

  assert.match(
    adminSource,
    /Delete simulation and test activity from BotShield\. Live storefront activity and your protection settings, blocked visitors, and trusted visitors are not affected\./,
  );
  assert.match(
    adminSource,
    /Permanently erase this store's BotShield activity, security history, visitor lists, and custom protection settings/,
  );
  assert.match(adminSource, /RESET_CONFIRMATION_TEXT|confirmationText="RESET"/);
  assert.equal(RESET_CONFIRMATION_TEXT, "RESET");
});

test("re-running reset with empty shop data remains safe", async () => {
  const db = createMockDb({
    appSettings: [
      { shop: "alpha.myshopify.com", key: "billingActive", value: "true" },
    ],
  });

  const first = await resetShopBotShieldData(db, "alpha.myshopify.com");
  const second = await resetShopBotShieldData(db, "alpha.myshopify.com");

  assert.equal(first.deleted.botEvents, 0);
  assert.equal(second.deleted.botEvents, 0);
  assert.equal(
    db._appSettings.find((row) => row.key === "autoBlock")?.value,
    DEFAULT_MERCHANT_SETTINGS.autoBlock,
  );
});
