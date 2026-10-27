import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const loginRoute = new URL("../app/routes/auth.login/route.jsx", import.meta.url);
const loginErrors = new URL("../app/routes/auth.login/error.server.jsx", import.meta.url);

test("auth login keeps Shopify OAuth entry via login() without a manual shop form", async () => {
  const source = await readFile(loginRoute, "utf8");

  assert.match(source, /await login\(request\)/);
  assert.match(source, /Shopify admin|Shopify App Store/i);
  assert.doesNotMatch(source, /name="shop"/);
  assert.doesNotMatch(source, /Shop domain/i);
  assert.doesNotMatch(source, /<Form\b/);
  assert.doesNotMatch(source, /useState\(/);
});

test("auth login error copy does not prompt merchants to type a shop domain", async () => {
  const source = await readFile(loginErrors, "utf8");

  assert.doesNotMatch(source, /enter your shop domain/i);
  assert.match(source, /Shopify admin/i);
});
