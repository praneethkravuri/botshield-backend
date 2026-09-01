import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  BILLING_RETURN_PATH,
  buildBillingSettingsRedirectPath,
  buildEmbeddedAdminBillingReturnUrl,
  getBillingReturnSearchParams,
  isBillingReturnRequest,
  needsBillingReturnEmbeddedBootstrap,
} from "../app/lib/billing-return.server.js";

const originalAppHandle = process.env.SHOPIFY_APP_HANDLE;

test.after(() => {
  if (originalAppHandle === undefined) {
    delete process.env.SHOPIFY_APP_HANDLE;
  } else {
    process.env.SHOPIFY_APP_HANDLE = originalAppHandle;
  }
});

function billingReturnRequest(query = "") {
  return new Request(
    `https://botshield-backend.onrender.com${BILLING_RETURN_PATH}${query ? `?${query}` : ""}`,
  );
}

test("billing return detects managed-pricing returns that need embedded bootstrap", () => {
  assert.equal(
    needsBillingReturnEmbeddedBootstrap(
      billingReturnRequest("plan_handle=basic&charge_id=123"),
    ),
    true,
  );
  assert.equal(
    needsBillingReturnEmbeddedBootstrap(
      billingReturnRequest(
        "plan_handle=basic&shop=botshield-test-2.myshopify.com&host=abc&embedded=1",
      ),
    ),
    false,
  );
});

test("billing return preserves Shopify redirect params for embedded re-entry", () => {
  const params = getBillingReturnSearchParams(
    billingReturnRequest(
      "plan_handle=basic&charge_id=123&shop=botshield-test-2.myshopify.com&host=ignored",
    ),
  );

  assert.equal(params.get("plan_handle"), "basic");
  assert.equal(params.get("charge_id"), "123");
  assert.equal(params.get("shop"), "botshield-test-2.myshopify.com");
  assert.equal(params.has("host"), false);
});

test("billing return builds the Admin embedded welcome URL", () => {
  process.env.SHOPIFY_APP_HANDLE = "botshield-1";
  const params = new URLSearchParams({
    plan_handle: "basic",
    charge_id: "123",
  });

  assert.equal(
    buildEmbeddedAdminBillingReturnUrl(
      "botshield-test-2.myshopify.com",
      params,
    ),
    "https://admin.shopify.com/store/botshield-test-2/apps/botshield-1/app/billing-return?plan_handle=basic&charge_id=123",
  );
});

test("billing return settings redirect keeps the billing section query", () => {
  assert.equal(
    buildBillingSettingsRedirectPath({ updated: true }),
    "/app/settings?section=billing&updated=true",
  );
});

test("billing return route bootstraps, authenticates, and uses embedded redirect", async () => {
  const billingReturnRoute = await readFile(
    new URL("../app/routes/app.billing-return.jsx", import.meta.url),
    "utf8",
  );
  const appShell = await readFile(
    new URL("../app/routes/app.jsx", import.meta.url),
    "utf8",
  );

  assert.match(billingReturnRoute, /needsBillingReturnEmbeddedBootstrap/);
  assert.match(billingReturnRoute, /buildEmbeddedAdminBillingReturnUrl/);
  assert.match(
    billingReturnRoute,
    /const \{ admin, session, redirect \} = await authenticate\.admin\(request\)/,
  );
  assert.match(billingReturnRoute, /await refreshBillingStatus\(/);
  assert.match(
    billingReturnRoute,
    /return redirect\(buildBillingSettingsRedirectPath\(\{ updated: true \}\)\)/,
  );
  assert.doesNotMatch(
    billingReturnRoute,
    /import \{ redirect \} from "react-router"/,
  );
  assert.doesNotMatch(
    billingReturnRoute,
    /return redirect\("\/app\/settings\?section=billing&updated=true"\)/,
  );
  assert.match(appShell, /isBillingReturnRequest\(request\)/);
  assert.match(
    appShell,
    /Billing return performs its own embedded bootstrap \+ authenticate flow/,
  );
});

test("isBillingReturnRequest matches only the billing return path", () => {
  assert.equal(
    isBillingReturnRequest(
      billingReturnRequest("plan_handle=basic&charge_id=123"),
    ),
    true,
  );
  assert.equal(
    isBillingReturnRequest(
      new Request("https://botshield-backend.onrender.com/app/settings"),
    ),
    false,
  );
});
