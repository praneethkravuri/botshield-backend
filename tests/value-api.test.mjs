import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildValueDashboard } from "../app/lib/value.server.js";
import { saveValueAssumptions } from "../app/lib/value-assumptions.server.js";

function createMockDb(initial = {}) {
  const botEvents = [...(initial.botEvents || [])];
  const appSettings = [...(initial.appSettings || [])];

  return {
    botEvent: {
      async findMany({ where, orderBy }) {
        let rows = botEvents.filter(
          (row) =>
            row.shop === where.shop &&
            row.source === where.source &&
            row.createdAt >= where.createdAt.gte,
        );
        if (orderBy?.createdAt === "asc") {
          rows = [...rows].sort(
            (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
          );
        }
        return rows.map(({ shop, source, ...rest }) => rest);
      },
    },
    appSetting: {
      async findMany({ where }) {
        return appSettings.filter((row) => {
          if (row.shop !== where.shop) return false;
          if (where.key?.in) return where.key.in.includes(row.key);
          if (where.key?.startsWith) {
            return String(row.key).startsWith(where.key.startsWith);
          }
          return true;
        });
      },
      async upsert({ where, create, update }) {
        const index = appSettings.findIndex(
          (row) => row.shop === where.shop_key.shop && row.key === where.shop_key.key,
        );
        if (index >= 0) {
          appSettings[index] = { ...appSettings[index], value: update.value };
          return appSettings[index];
        }
        appSettings.push(create);
        return create;
      },
    },
    async $transaction(operations) {
      return Promise.all(operations);
    },
    _botEvents: botEvents,
    _appSettings: appSettings,
  };
}

test("value API route requires admin auth and supports assumptions POST", async () => {
  const route = await readFile(
    new URL("../app/routes/api.value.jsx", import.meta.url),
    "utf8",
  );
  assert.match(route, /authenticate\.admin\(request\)/);
  assert.match(route, /buildValueDashboard/);
  assert.match(route, /saveValueAssumptions/);
  assert.match(route, /logPersonalDataAccess/);
});

test("buildValueDashboard aggregates shop-scoped storefront activity", async () => {
  const db = createMockDb({
    botEvents: [
      {
        shop: "demo.myshopify.com",
        source: "storefront-proxy",
        threatLevel: "high",
        action: "blocked",
        reasonSummary: "[KNOWN_BOT_USER_AGENT]",
        createdAt: new Date("2026-09-10T10:00:00.000Z"),
      },
      {
        shop: "demo.myshopify.com",
        source: "storefront-proxy",
        threatLevel: "medium",
        action: "challenged",
        reasonSummary: "[RATE_PATTERN]",
        createdAt: new Date("2026-09-12T10:00:00.000Z"),
      },
      {
        shop: "other.myshopify.com",
        source: "storefront-proxy",
        threatLevel: "high",
        action: "blocked",
        reasonSummary: "[KNOWN_BOT_USER_AGENT]",
        createdAt: new Date("2026-09-12T10:00:00.000Z"),
      },
    ],
    appSettings: [
      {
        shop: "demo.myshopify.com",
        key: "billingMonthlyPrice",
        value: "29",
      },
    ],
  });

  const value = await buildValueDashboard(db, "demo.myshopify.com", {
    range: "30d",
    now: new Date("2026-09-17T12:00:00.000Z"),
  });

  assert.equal(value.activity.threatsStopped, 1);
  assert.equal(value.activity.challengesIssued, 1);
  assert.equal(value.activity.threatsDetected, 2);
  assert.equal(value.retentionLimited, false);
  assert.ok(value.trend.length > 0);
  assert.ok(value.categories.length > 0);
  assert.equal(value.assumptionStatus, "not_configured");
});

test("saveValueAssumptions persists merchant settings without customer fields", async () => {
  const db = createMockDb();
  const saved = await saveValueAssumptions(
    "demo.myshopify.com",
    {
      estimatedValuePerBlockedEvent: 5,
      estimatedValuePerChallenge: 2,
      staffMinutesSavedPerIntervention: 15,
      staffHourlyCost: 40,
    },
    { dbClient: db },
  );
  assert.equal(saved.estimatedValuePerBlockedEvent, 5);
  assert.equal(saved.merchantConfigured, true);
  assert.ok(db._appSettings.some((row) => row.key === "valueAssumption_blockedEventValue"));
});

test("value page UI includes required functional sections", async () => {
  const page = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );
  const styles = await readFile(
    new URL("../app/styles/value-page.css", import.meta.url),
    "utf8",
  );

  assert.match(page, /Estimated value protected/);
  assert.match(page, /Threats stopped/);
  assert.match(page, /Protection value over time/);
  assert.match(page, /Where your value came from/);
  assert.match(page, /Your BotShield economics/);
  assert.match(page, /If your current protection rate continues/);
  assert.match(page, /Edit assumptions/);
  assert.match(page, /How calculations work/);
  assert.match(page, /Why BotShield/);
  assert.match(page, /Your value story is just getting started/);
  assert.match(page, /className="[^"]*\bbv-hero\b/);
  assert.match(page, /className="[^"]*\bbv-economics-flow\b/);
  assert.match(page, /className="[^"]*\bbv-chart\b/);
  assert.match(page, /className="[^"]*\bbv-projection-grid\b/);
  assert.match(page, /className="[^"]*\bbv-disclosure\b/);
  assert.match(page, /Set assumptions/);
  assert.match(page, /Protection behind these estimates/);
  assert.match(page, /useAnimatedNumber/);
  assert.doesNotMatch(page, /botshield-v2-chart-column/);
  assert.doesNotMatch(page, /botshield-v2-chart-label/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.doesNotMatch(page, /Cloudflare/);
});
