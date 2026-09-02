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
  assert.match(appIndexSource, /initialAdminPage/);
  assert.match(appIndexSource, /initialSettingsSection/);
});
