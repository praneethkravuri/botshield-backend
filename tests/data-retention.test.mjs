import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  BOT_EVENT_RETENTION_DAYS,
  getBotEventRetentionCutoff,
  getNetworkIntelExpiryCutoff,
  purgeExpiredBotEvents,
  purgeExpiredNetworkIntel,
  runDataRetentionPurge,
  startDataRetentionScheduler,
} from "../app/lib/data-retention.server.js";

function createMockDb(initial = {}) {
  const botEvents = [...(initial.botEvents || [])];
  const networkIntel = [...(initial.networkIntel || [])];

  return {
    botEvent: {
      async findMany({ where, take }) {
        const cutoff = where.createdAt.lt;
        const matches = botEvents.filter((row) => row.createdAt < cutoff);
        return matches.slice(0, take).map((row) => ({ id: row.id }));
      },
      async deleteMany({ where }) {
        const ids = new Set(where.id.in);
        const before = botEvents.length;
        for (let index = botEvents.length - 1; index >= 0; index -= 1) {
          if (ids.has(botEvents[index].id)) {
            botEvents.splice(index, 1);
          }
        }
        return { count: before - botEvents.length };
      },
    },
    networkIntel: {
      async deleteMany({ where }) {
        const cutoff = where.expiresAt.lt;
        const before = networkIntel.length;
        for (let index = networkIntel.length - 1; index >= 0; index -= 1) {
          if (networkIntel[index].expiresAt < cutoff) {
            networkIntel.splice(index, 1);
          }
        }
        return { count: before - networkIntel.length };
      },
    },
    _botEvents: botEvents,
    _networkIntel: networkIntel,
  };
}

test("getBotEventRetentionCutoff uses the configured 30-day window", () => {
  const now = Date.parse("2026-08-23T00:00:00.000Z");
  const cutoff = getBotEventRetentionCutoff(now);
  assert.equal(cutoff.toISOString(), "2026-07-24T00:00:00.000Z");
  assert.equal(BOT_EVENT_RETENTION_DAYS, 30);
});

test("purgeExpiredBotEvents deletes only rows older than the retention cutoff", async () => {
  const now = Date.parse("2026-08-23T00:00:00.000Z");
  const db = createMockDb({
    botEvents: [
      { id: 1, createdAt: new Date("2026-08-22T00:00:00.000Z") },
      { id: 2, createdAt: new Date("2026-07-01T00:00:00.000Z") },
      { id: 3, createdAt: new Date("2026-06-01T00:00:00.000Z") },
    ],
  });

  const deleted = await purgeExpiredBotEvents(db, { now });
  assert.equal(deleted, 2);
  assert.deepEqual(
    db._botEvents.map((row) => row.id),
    [1],
  );
});

test("purgeExpiredNetworkIntel deletes expired cache rows", async () => {
  const now = Date.parse("2026-08-23T00:00:00.000Z");
  const db = createMockDb({
    networkIntel: [
      { id: 1, expiresAt: new Date("2026-08-24T00:00:00.000Z") },
      { id: 2, expiresAt: new Date("2026-08-22T00:00:00.000Z") },
    ],
  });

  const deleted = await purgeExpiredNetworkIntel(db, { now });
  assert.equal(deleted, 1);
  assert.deepEqual(
    db._networkIntel.map((row) => row.id),
    [1],
  );
});

test("runDataRetentionPurge reports both purge counts", async () => {
  const now = Date.parse("2026-08-23T00:00:00.000Z");
  const db = createMockDb({
    botEvents: [{ id: 1, createdAt: new Date("2026-01-01T00:00:00.000Z") }],
    networkIntel: [{ id: 1, expiresAt: new Date("2026-08-22T00:00:00.000Z") }],
  });

  const result = await runDataRetentionPurge(db, { now });
  assert.deepEqual(result, { botEventsDeleted: 1, networkIntelDeleted: 1 });
});

test("startDataRetentionScheduler can be disabled for tests", () => {
  const handle = startDataRetentionScheduler(createMockDb(), {
    enabled: false,
  });
  assert.equal(typeof handle.stop, "function");
});

test("server starts automatic retention enforcement", async () => {
  const source = await readFile(new URL("../server.js", import.meta.url), "utf8");
  assert.match(source, /startDataRetentionScheduler/);
  assert.match(source, /data-retention\.server\.js/);
});

test("server binds health routes before loading the React Router build", async () => {
  const source = await readFile(new URL("../server.js", import.meta.url), "utf8");
  const listenIndex = source.indexOf("app.listen(");
  const buildImportIndex = source.indexOf(
    "await import(pathToFileURL(buildPath)",
  );
  assert.ok(listenIndex > -1);
  assert.ok(buildImportIndex > -1);
  assert.ok(
    listenIndex < buildImportIndex,
    "app.listen must run before the React Router build import",
  );
});

test("privacy policy states automatic 30-day BotEvent retention", async () => {
  const privacy = await readFile(
    new URL("../app/routes/privacy.jsx", import.meta.url),
    "utf8",
  );
  assert.match(privacy, /automatically deleted after 30 days/);
  assert.match(privacy, /Fraud Orders[\s\S]*does not request customer name/);
  assert.match(privacy, /Data Protection Agreement/);
  assert.match(privacy, /do not sell personal data/i);
  assert.match(privacy, /Fraud Orders is a merchant[\s\S]*review workspace/);
});

test("terms reference the privacy policy as the merchant data-processing agreement", async () => {
  const terms = await readFile(
    new URL("../app/routes/terms.jsx", import.meta.url),
    "utf8",
  );
  assert.match(terms, /href="\/privacy"/);
  assert.match(terms, /Data Processing/);
  assert.match(terms, /without requesting customer name, email, phone/);
});

test("mandatory Shopify compliance webhooks are configured and implemented", async () => {
  const config = await readFile(
    new URL("../shopify.app.toml", import.meta.url),
    "utf8",
  );
  const shopRedact = await readFile(
    new URL("../app/routes/webhooks.shop.redact.jsx", import.meta.url),
    "utf8",
  );
  const customerRedact = await readFile(
    new URL("../app/routes/webhooks.customers.redact.jsx", import.meta.url),
    "utf8",
  );
  const customerDataRequest = await readFile(
    new URL("../app/routes/webhooks.customers.data_request.jsx", import.meta.url),
    "utf8",
  );

  assert.match(config, /customers\/data_request/);
  assert.match(config, /customers\/redact/);
  assert.match(config, /shop\/redact/);
  assert.match(shopRedact, /authenticate\.webhook\(request\)/);
  assert.match(shopRedact, /deleteShopScopedData/);
  assert.match(customerRedact, /authenticate\.webhook\(request\)/);
  assert.match(customerDataRequest, /authenticate\.webhook\(request\)/);
});
