import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  BOTSHIELD_THEME_EMBED_HANDLE,
  buildThemeEditorActivateAppId,
  buildThemeEditorDeepLink,
  getThemeEmbedConnectionView,
  resolveThemeAppEmbedStatus,
  THEME_EMBED_CONNECTION_STATE,
} from "../app/lib/theme-extension-status.js";

const SHOPIFY_API_KEY = "d4fd10812566b17d9d99ed95e0978ada";

test("theme embed handle matches the app embed block filename", () => {
  assert.equal(BOTSHIELD_THEME_EMBED_HANDLE, "botshield-embed");
});

test("theme editor activation URL uses the shared botshield-embed handle", () => {
  assert.equal(
    buildThemeEditorActivateAppId(SHOPIFY_API_KEY),
    `${SHOPIFY_API_KEY}/botshield-embed`,
  );
  assert.equal(
    buildThemeEditorDeepLink("demo.myshopify.com", SHOPIFY_API_KEY),
    `https://demo.myshopify.com/admin/themes/current/editor?context=apps&activateAppId=${SHOPIFY_API_KEY}/botshield-embed`,
  );
});

test("active theme app embed resolves to Connected", () => {
  const status = resolveThemeAppEmbedStatus([
    {
      type: "theme_app_extension",
      activations: [{ handle: "botshield-embed", status: "active" }],
    },
  ]);
  const view = getThemeEmbedConnectionView(status);

  assert.equal(status.themeAppEmbedConnectionState, THEME_EMBED_CONNECTION_STATE.ACTIVE);
  assert.equal(status.themeAppEmbedActive, true);
  assert.equal(view.label, "Connected");
  assert.equal(view.connected, true);
});

test("inactive theme app embed resolves to Setup required", () => {
  const status = resolveThemeAppEmbedStatus([
    {
      type: "theme_app_extension",
      activations: [{ handle: "botshield-embed", status: "available" }],
    },
  ]);
  const view = getThemeEmbedConnectionView(status);

  assert.equal(status.themeAppEmbedConnectionState, THEME_EMBED_CONNECTION_STATE.INACTIVE);
  assert.equal(status.themeAppEmbedActive, false);
  assert.equal(view.label, "Setup required");
  assert.equal(view.connected, false);
});

test("missing theme app extension resolves to Extension not installed", () => {
  const status = resolveThemeAppEmbedStatus([]);
  const view = getThemeEmbedConnectionView(status);

  assert.equal(status.themeAppEmbedConnectionState, THEME_EMBED_CONNECTION_STATE.MISSING);
  assert.equal(status.themeAppEmbedActive, false);
  assert.equal(view.label, "Extension not installed");
});

test("unverifiable App Bridge state resolves to Unable to verify", () => {
  const status = resolveThemeAppEmbedStatus(null);
  const view = getThemeEmbedConnectionView(status);

  assert.equal(
    status.themeAppEmbedConnectionState,
    THEME_EMBED_CONNECTION_STATE.UNAVAILABLE,
  );
  assert.equal(status.themeAppEmbedActive, false);
  assert.equal(view.label, "Unable to verify");
});

test("storefront traffic is not used to infer theme embed connectivity", async () => {
  const adminSource = await readFile(
    new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
    "utf8",
  );
  const indexSource = await readFile(
    new URL("../app/routes/app._index.jsx", import.meta.url),
    "utf8",
  );

  assert.match(adminSource, /getThemeEmbedConnectionView\(model\?\.protectionStatus\)/);
  assert.doesNotMatch(
    adminSource.match(/function hasStorefrontConnection[\s\S]*?\}/)?.[0] || "",
    /storefrontReportingActive/,
  );
  assert.doesNotMatch(indexSource, /botshield-theme-embed/);
  assert.match(indexSource, /buildThemeEditorDeepLink/);
  assert.match(adminSource, /getThemeEmbedConnectionView\(/);
});
