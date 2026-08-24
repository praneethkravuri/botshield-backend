import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  FRAUD_ORDER_READ_SCOPE,
  hasFraudOrderReadAccess,
  parseAccessScopes,
} from "../app/lib/fraud-order-access.server.js";
import { getFraudOrdersSetupState } from "../app/lib/fraud-orders-setup.js";

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

function findSetupStep(setupState, key) {
  return setupState.steps.find((step) => step.key === key);
}

test("getFraudOrdersSetupState shows permission not connected when scope is missing", () => {
  const setupState = getFraudOrdersSetupState({ connected: false, errorCode: null });

  assert.equal(setupState.orderPermissionConnected, false);
  assert.equal(setupState.queueReady, false);
  assert.equal(findSetupStep(setupState, "access").statusLabel, "Required");
  assert.equal(findSetupStep(setupState, "approval").statusLabel, "Waiting");
  assert.equal(findSetupStep(setupState, "queue").statusLabel, "Not ready");
  assert.equal(setupState.completedSteps, 1);
  assert.equal(setupState.totalSteps, 4);
  assert.match(setupState.introCopy, /Connect order access/);
  assert.doesNotMatch(setupState.introCopy, /Review Shopify order-risk data below/);
});

test("getFraudOrdersSetupState keeps queue not ready when protected customer data is unavailable", () => {
  const setupState = getFraudOrdersSetupState({
    connected: true,
    errorCode: "protected_customer_data",
  });

  assert.equal(setupState.orderPermissionConnected, true);
  assert.equal(setupState.protectedDataBlocked, true);
  assert.equal(setupState.queueReady, false);
  assert.equal(findSetupStep(setupState, "access").statusLabel, "Connected");
  assert.equal(findSetupStep(setupState, "approval").statusLabel, "Approval required");
  assert.equal(findSetupStep(setupState, "queue").statusLabel, "Not ready");
  assert.equal(setupState.completedSteps, 2);
  assert.equal(setupState.totalSteps, 4);
  assert.match(
    setupState.introCopy,
    /Order permission is connected, but Shopify hasn't approved protected customer data access/,
  );
  assert.match(setupState.introCopy, /Fraud Orders will become available after Shopify grants access/);
  assert.doesNotMatch(setupState.introCopy, /Review Shopify order-risk data below/);
  assert.notEqual(`${setupState.completedSteps} of ${setupState.totalSteps}`, "3 of 3");
});

test("getFraudOrdersSetupState marks queue ready only after successful Fraud Orders access", () => {
  const setupState = getFraudOrdersSetupState({ connected: true, errorCode: null });

  assert.equal(setupState.queueReady, true);
  assert.equal(findSetupStep(setupState, "access").statusLabel, "Connected");
  assert.equal(findSetupStep(setupState, "approval").statusLabel, "Approved");
  assert.equal(findSetupStep(setupState, "queue").statusLabel, "Ready");
  assert.equal(setupState.completedSteps, 4);
  assert.match(setupState.introCopy, /Fraud Orders is ready/);
});

test("protected customer data error can never report full setup completion", () => {
  const setupState = getFraudOrdersSetupState({
    connected: true,
    errorCode: "protected_customer_data",
  });

  assert.notEqual(setupState.completedSteps, setupState.totalSteps);
  assert.notEqual(findSetupStep(setupState, "queue").statusLabel, "Ready");
  assert.notEqual(`${setupState.completedSteps} of ${setupState.totalSteps}`, "3 of 3");
  assert.notEqual(`${setupState.completedSteps} of ${setupState.totalSteps}`, "4 of 4");
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
