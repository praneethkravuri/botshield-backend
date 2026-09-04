import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  resolveInitialAdminPage,
  resolveInitialSettingsSection,
} from "../app/lib/admin-route-state.server.js";

test("resolveInitialAdminPage maps supported app paths", () => {
  assert.equal(resolveInitialAdminPage("/app/settings", ""), "settings");
  assert.equal(resolveInitialAdminPage("/app/analytics", ""), "analytics");
  assert.equal(resolveInitialAdminPage("/app/protection-rules", ""), "security");
  assert.equal(resolveInitialAdminPage("/app/fraud-orders", ""), "fraud-orders");
  assert.equal(resolveInitialAdminPage("/app", ""), "dashboard");
});

test("resolveInitialSettingsSection validates settings hub sections", () => {
  assert.equal(
    resolveInitialSettingsSection("?section=diagnostics"),
    "diagnostics",
  );
  assert.equal(resolveInitialSettingsSection("?section=billing"), "billing");
  assert.equal(resolveInitialSettingsSection(""), "general");
  assert.equal(resolveInitialSettingsSection("?section=legacy"), "general");
});

test("mergeEmbeddedAppSearch preserves embedded frame params across app routes", async () => {
  const { mergeEmbeddedAppSearch } = await import(
    "../app/lib/embedded-app-navigation.js"
  );

  const embeddedSearch =
    "?shop=botshield-test-2.myshopify.com&host=abc&embedded=1&id_token=token";

  assert.equal(
    mergeEmbeddedAppSearch("/app/protection-rules", embeddedSearch),
    "/app/protection-rules?shop=botshield-test-2.myshopify.com&host=abc&embedded=1&id_token=token",
  );
  assert.equal(
    mergeEmbeddedAppSearch("/app/analytics", embeddedSearch),
    "/app/analytics?shop=botshield-test-2.myshopify.com&host=abc&embedded=1&id_token=token",
  );
  assert.equal(
    mergeEmbeddedAppSearch("/app/settings?section=billing", embeddedSearch),
    "/app/settings?shop=botshield-test-2.myshopify.com&host=abc&embedded=1&id_token=token&section=billing",
  );
  assert.equal(
    mergeEmbeddedAppSearch("/app", embeddedSearch),
    "/app?shop=botshield-test-2.myshopify.com&host=abc&embedded=1&id_token=token",
  );
});

test("embedded app nav exposes Overview first without rel=home", async () => {
  const navSource = await readFile(
    new URL("../app/components/BotShieldEmbeddedAppProvider.jsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(navSource, /rel:\s*["']home["']/);
  assert.doesNotMatch(navSource, /rel="home"/);

  const labels = [...navSource.matchAll(/label:\s*"([^"]+)"/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(labels, [
    "Overview",
    "Analytics",
    "Protection",
    "Fraud Orders",
    "Settings",
  ]);

  const hrefs = [...navSource.matchAll(/href:\s*"([^"]+)"/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(hrefs, [
    "/app",
    "/app/analytics",
    "/app/protection-rules",
    "/app/fraud-orders",
    "/app/settings",
  ]);
});

test("app loader exposes SSR route state for embedded settings URLs", async () => {
  const appRouteSource = await readFile(
    new URL("../app/routes/app.jsx", import.meta.url),
    "utf8",
  );
  const appIndexSource = await readFile(
    new URL("../app/routes/app._index.jsx", import.meta.url),
    "utf8",
  );

  assert.match(appRouteSource, /resolveInitialAdminPage/);
  assert.match(appRouteSource, /resolveInitialSettingsSection/);
  assert.match(appRouteSource, /initialAdminPage:/);
  assert.match(appRouteSource, /initialSettingsSection:/);
  assert.match(appRouteSource, /BotShieldAppNavigation/);
  assert.match(appRouteSource, /BotShieldEmbeddedAppProvider apiKey=\{apiKey\}/);
  assert.match(appIndexSource, /initialAdminPage/);
  assert.match(appIndexSource, /initialSettingsSection/);
});
