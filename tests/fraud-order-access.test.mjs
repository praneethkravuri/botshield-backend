import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  FRAUD_ORDER_READ_SCOPE,
  hasFraudOrderReadAccess,
  parseAccessScopes,
} from "../app/lib/fraud-order-access.server.js";

test("parseAccessScopes normalizes comma and space separated scopes", () => {
  assert.deepEqual(parseAccessScopes("write_app_proxy, read_orders"), [
    "write_app_proxy",
    "read_orders",
  ]);
  assert.deepEqual(parseAccessScopes("write_app_proxy read_orders"), [
    "write_app_proxy",
    "read_orders",
  ]);
  assert.deepEqual(parseAccessScopes(""), []);
  assert.deepEqual(parseAccessScopes(null), []);
});

test("hasFraudOrderReadAccess reflects read_orders in session scope", () => {
  assert.equal(hasFraudOrderReadAccess("write_app_proxy"), false);
  assert.equal(hasFraudOrderReadAccess("write_app_proxy,read_orders"), true);
  assert.equal(hasFraudOrderReadAccess("write_app_proxy read_orders"), true);
  assert.equal(FRAUD_ORDER_READ_SCOPE, "read_orders");
});

test("fraud order access API uses session scope as source of truth", async () => {
  const routeSource = await readFile(
    new URL("../app/routes/api.fraud-order-access.jsx", import.meta.url),
    "utf8",
  );

  assert.match(routeSource, /authenticate\.admin\(request\)/);
  assert.match(routeSource, /hasFraudOrderReadAccess\(session\?\.scope\)/);
  assert.match(routeSource, /connected:/);
  assert.doesNotMatch(routeSource, /admin\.graphql/);
});
