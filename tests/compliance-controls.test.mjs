import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  logComplianceWebhook,
  logPersonalDataAccess,
} from "../app/lib/personal-data-access-audit.server.js";
import { deleteShopScopedData } from "../app/lib/shop-redact.server.js";
import { logSafeError, truncateLogMessage } from "../app/lib/safe-log.server.js";

function createMockDb(initial = {}) {
  const sessions = [...(initial.sessions || [])];
  const botEvents = [...(initial.botEvents || [])];
  const blockedIPs = [...(initial.blockedIPs || [])];
  const whitelistIPs = [...(initial.whitelistIPs || [])];
  const appSettings = [...(initial.appSettings || [])];

  const deleteMany = (rows, shop) => ({
    async deleteMany({ where }) {
      const before = rows.length;
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        if (rows[index].shop === where.shop) {
          rows.splice(index, 1);
        }
      }
      return { count: before - rows.length, shop };
    },
  });

  return {
    session: deleteMany(sessions),
    botEvent: deleteMany(botEvents),
    blockedIP: deleteMany(blockedIPs),
    whitelistIP: deleteMany(whitelistIPs),
    appSetting: deleteMany(appSettings),
    _sessions: sessions,
    _botEvents: botEvents,
    _blockedIPs: blockedIPs,
    _whitelistIPs: whitelistIPs,
    _appSettings: appSettings,
    async $transaction(operations) {
      return Promise.all(operations);
    },
  };
}

test("deleteShopScopedData removes all shop-scoped BotShield records", async () => {
  const db = createMockDb({
    sessions: [{ shop: "demo.myshopify.com" }, { shop: "other.myshopify.com" }],
    botEvents: [{ shop: "demo.myshopify.com" }],
    blockedIPs: [{ shop: "demo.myshopify.com" }],
    whitelistIPs: [{ shop: "demo.myshopify.com" }],
    appSettings: [{ shop: "demo.myshopify.com" }],
  });

  const result = await deleteShopScopedData(db, "demo.myshopify.com");
  assert.equal(result.deleted, true);
  assert.equal(result.counts.sessions, 1);
  assert.equal(result.counts.botEvents, 1);
  assert.equal(result.counts.blockedIPs, 1);
  assert.equal(result.counts.whitelistIPs, 1);
  assert.equal(result.counts.appSettings, 1);
  assert.deepEqual(db._sessions, [{ shop: "other.myshopify.com" }]);
});

test("personal data access audit logs safe metadata only", () => {
  const lines = [];
  const originalLog = console.log;
  console.log = (...args) => {
    lines.push(args.join(" "));
  };

  try {
    logPersonalDataAccess({
      shop: "demo.myshopify.com",
      resource: "fraud_orders",
      operation: "fetch",
      success: false,
      errorCode: "protected_customer_data",
    });
  } finally {
    console.log = originalLog;
  }

  assert.equal(lines.length, 1);
  assert.match(lines[0], /\[botshield-access-audit\]/);
  assert.match(lines[0], /"resource":"fraud_orders"/);
  assert.match(lines[0], /"errorCode":"protected_customer_data"/);
  assert.doesNotMatch(lines[0], /customer@example.com/);
  assert.doesNotMatch(lines[0], /"orders":/);
});

test("compliance webhook audit logs topic and outcome without payload data", () => {
  const lines = [];
  const originalLog = console.log;
  console.log = (...args) => {
    lines.push(args.join(" "));
  };

  try {
    logComplianceWebhook({
      shop: "demo.myshopify.com",
      topic: "shop/redact",
      outcome: "shop_data_deleted",
      detail: "deleted sessions=1 events=2",
    });
  } finally {
    console.log = originalLog;
  }

  assert.match(lines[0], /"event":"compliance_webhook"/);
  assert.match(lines[0], /"topic":"shop\/redact"/);
  assert.doesNotMatch(lines[0], /email/);
});

test("safe logging truncates long error messages", () => {
  const message = truncateLogMessage("x".repeat(300), 50);
  assert.equal(message.length, 50);
  assert.match(message, /…$/);
});

test("safe logging avoids dumping raw error objects", () => {
  const lines = [];
  const originalError = console.error;
  console.error = (...args) => {
    lines.push(JSON.stringify(args));
  };

  try {
    logSafeError("Fraud orders fetch failed", new Error("protected customer data"), {
      errorCode: "protected_customer_data",
      shop: "demo.myshopify.com",
    });
  } finally {
    console.error = originalError;
  }

  assert.match(lines[0], /protected customer data/);
  assert.doesNotMatch(lines[0], /stack/);
});

test("Fraud Orders API writes personal data access audit records", async () => {
  const routeSource = await readFile(
    new URL("../app/routes/api.fraud-orders.jsx", import.meta.url),
    "utf8",
  );
  assert.match(routeSource, /logPersonalDataAccess/);
  assert.match(routeSource, /resource: "fraud_orders"/);
  assert.match(routeSource, /logSafeError/);
  assert.doesNotMatch(routeSource, /console\.error\("Fraud orders fetch failed", error\)/);
});

test("compliance webhooks use audit logging and shop redact helper", async () => {
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

  assert.match(shopRedact, /deleteShopScopedData/);
  assert.match(shopRedact, /logComplianceWebhook/);
  assert.match(customerRedact, /logComplianceWebhook/);
  assert.match(customerDataRequest, /logComplianceWebhook/);
});

test("privacy and security docs support truthful PCD disclosures", async () => {
  const privacy = await readFile(
    new URL("../app/routes/privacy.jsx", import.meta.url),
    "utf8",
  );
  const practices = await readFile(
    new URL("../docs/data-protection-and-security.md", import.meta.url),
    "utf8",
  );
  const incident = await readFile(
    new URL("../docs/security-incident-response.md", import.meta.url),
    "utf8",
  );

  assert.match(privacy, /do not sell personal data/i);
  assert.match(privacy, /Fraud Orders is a merchant[\s\S]*review workspace/);
  assert.match(practices, /not.*sell personal data/i);
  assert.match(practices, /not.*claim SOC 2/i);
  assert.match(practices, /Data loss prevention/i);
  assert.match(incident, /Identification/);
  assert.match(incident, /Notification/);
});

test("Fraud Orders remains Level 1 with no read_all_orders or customer fields", async () => {
  const config = await readFile(
    new URL("../shopify.app.toml", import.meta.url),
    "utf8",
  );
  const fraudServer = await readFile(
    new URL("../app/lib/fraud-orders.server.js", import.meta.url),
    "utf8",
  );
  const schema = await readFile(
    new URL("../prisma/schema.prisma", import.meta.url),
    "utf8",
  );

  assert.match(config, /optional_scopes = \[ "read_orders" \]/);
  assert.doesNotMatch(config, /read_all_orders/);
  const queryMatch = fraudServer.match(/const FRAUD_ORDERS_QUERY = `#graphql([\s\S]*?)`;/);
  assert.ok(queryMatch);
  assert.doesNotMatch(queryMatch[1], /\bemail\b/);
  assert.doesNotMatch(queryMatch[1], /\bcustomer\b/);
  assert.doesNotMatch(schema, /model Order/);
  assert.match(fraudServer, /errorCode: merchantError.code/);
});
