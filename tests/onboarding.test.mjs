/* eslint-env node */
import assert from "node:assert/strict";
import test from "node:test";
import {
  shouldOfferInitialOnboarding,
  checkActivationWithTimeout,
} from "../app/lib/onboarding.js";
import {
  buildThemeEditorDeepLink,
  resolveThemeAppEmbedStatus,
  getThemeEmbedConnectionView,
} from "../app/lib/theme-extension-status.js";
import { readThemeAppEmbedStatus } from "../app/lib/theme-extension-status.client.js";
import { mergeEmbeddedAppSearch } from "../app/lib/embedded-app-navigation.js";

const needsSetup = {
  pathname: "/app",
  acknowledged: false,
  state: "inactive",
  checking: false,
};
for (const state of ["inactive", "missing", "unusable"]) {
  test(`first authenticated Overview visit offers setup for ${state}`, () => {
    assert.equal(shouldOfferInitialOnboarding({ ...needsSetup, state }), true);
  });
}
for (const state of ["active", "unavailable"]) {
  test(`${state} does not force onboarding`, () => {
    assert.equal(shouldOfferInitialOnboarding({ ...needsSetup, state }), false);
  });
}
for (const pathname of [
  "/app/onboarding",
  "/app/billing-return",
  "/auth/callback",
  "/webhooks/app/uninstalled",
  "/privacy",
  "/app/settings",
  "/app/analytics",
]) {
  test(`initial setup routing leaves ${pathname} alone`, () => {
    assert.equal(
      shouldOfferInitialOnboarding({ ...needsSetup, pathname }),
      false,
    );
  });
}
test("returning merchants and an unavailable profile retain dashboard access", () => {
  for (const acknowledged of [true, null])
    assert.equal(
      shouldOfferInitialOnboarding({ ...needsSetup, acknowledged }),
      false,
    );
});
test("billing parameters, explicit legacy views and unresolved checks do not redirect", () => {
  for (const search of ["?view=billing", "?charge_id=123"])
    assert.equal(
      shouldOfferInitialOnboarding({ ...needsSetup, search }),
      false,
    );
  assert.equal(
    shouldOfferInitialOnboarding({ ...needsSetup, checking: true }),
    false,
  );
});
test("onboarding / Overview navigation preserves Shopify frame and session parameters", () => {
  const search = "?shop=alpha.myshopify.com&host=YWxwaGE&embedded=1&locale=en";
  for (const path of ["/app/onboarding", "/app"]) {
    const result = new URL(
      mergeEmbeddedAppSearch(path, search),
      "https://example.test",
    );
    assert.equal(result.pathname, path);
    assert.equal(result.searchParams.get("shop"), "alpha.myshopify.com");
    assert.equal(result.searchParams.get("host"), "YWxwaGE");
    assert.equal(result.searchParams.get("embedded"), "1");
  }
});
test("Theme Editor targets the authenticated shop's current published theme", () => {
  const result = new URL(
    buildThemeEditorDeepLink("alpha.myshopify.com", "test-key"),
  );
  assert.equal(result.origin, "https://alpha.myshopify.com");
  assert.equal(result.pathname, "/admin/themes/current/editor");
  assert.equal(result.searchParams.get("context"), "apps");
  assert.equal(
    result.searchParams.get("activateAppId"),
    "test-key/botshield-embed",
  );
});
test("Theme Editor rejects unsafe shops and handles and safely encodes app IDs", () => {
  for (const shop of [
    "alpha.myshopify.com@evil.test",
    "alpha.myshopify.com/path",
    "https://alpha.myshopify.com",
    "",
    "evil.test",
  ])
    assert.equal(buildThemeEditorDeepLink(shop, "key"), "");
  assert.equal(
    buildThemeEditorDeepLink("alpha.myshopify.com", "key", "../other"),
    "",
  );
  assert.equal(
    new URL(
      buildThemeEditorDeepLink("alpha.myshopify.com", "key&context=evil"),
    ).searchParams.get("activateAppId"),
    "key&context=evil/botshield-embed",
  );
});
const extension = (status) => [
  {
    type: "theme_app_extension",
    activations: [{ handle: "botshield-embed", status }],
  },
];
test("documented published-theme active status verifies without theme IDs or additional scopes", () => {
  const result = resolveThemeAppEmbedStatus(extension("active"));
  assert.equal(result.themeAppEmbedActive, true);
  assert.equal(result.themeAppEmbedConnectionState, "active");
  assert.equal(getThemeEmbedConnectionView(result).connected, true);
});
test("available means the published embed has not been activated", () => {
  const result = resolveThemeAppEmbedStatus(extension("available"));
  assert.equal(result.themeAppEmbedActive, false);
  assert.equal(result.themeAppEmbedConnectionState, "inactive");
  assert.equal(result.themeAppEmbedStatus, "available");
});
test("Shopify's unavailable embed is unusable, distinct from a failed verification call", () => {
  const result = resolveThemeAppEmbedStatus(extension("unavailable"));
  assert.equal(result.themeAppEmbedActive, false);
  assert.equal(result.themeAppEmbedConnectionState, "unusable");
  assert.equal(getThemeEmbedConnectionView(result).label, "Embed unavailable");
  assert.notEqual(
    result.themeAppEmbedConnectionState,
    resolveThemeAppEmbedStatus(null).themeAppEmbedConnectionState,
  );
});
test("a different embed, extension type, or unknown status can never verify BotShield", () => {
  assert.equal(
    resolveThemeAppEmbedStatus([
      {
        type: "theme_app_extension",
        activations: [{ handle: "another-embed", status: "active" }],
      },
    ]).themeAppEmbedActive,
    false,
  );
  assert.equal(
    resolveThemeAppEmbedStatus([
      {
        type: "ui_extension",
        activations: [{ handle: "botshield-embed", status: "active" }],
      },
    ]).themeAppEmbedActive,
    false,
  );
  assert.equal(
    resolveThemeAppEmbedStatus(extension("unknown"))
      .themeAppEmbedConnectionState,
    "unavailable",
  );
});
test("missing and malformed activation data remain safe and unverified", () => {
  for (const data of [
    null,
    {},
    [],
    [{ type: "theme_app_extension", activations: {} }],
  ]) {
    assert.equal(resolveThemeAppEmbedStatus(data).themeAppEmbedActive, false);
  }
});
test("the client uses only App Bridge and preserves its API receiver", async () => {
  const previous = global.window;
  const api = {
    async extensions() {
      assert.equal(this, api);
      return extension("active");
    },
  };
  global.window = { shopify: { app: api } };
  try {
    assert.equal((await readThemeAppEmbedStatus()).themeAppEmbedActive, true);
  } finally {
    if (previous === undefined) delete global.window;
    else global.window = previous;
  }
});
test("a rejected App Bridge call is unable to verify, never an unusable embed or success", async () => {
  const previous = global.window;
  const originalError = console.error;
  global.window = {
    shopify: {
      app: {
        extensions: async () => {
          throw new Error("Synthetic failure");
        },
      },
    },
  };
  console.error = () => {};
  try {
    assert.equal(
      (await readThemeAppEmbedStatus()).themeAppEmbedConnectionState,
      "unavailable",
    );
  } finally {
    console.error = originalError;
    if (previous === undefined) delete global.window;
    else global.window = previous;
  }
});
test("bounded activation checks report timeout and ignore a late resolution", async () => {
  let resolve;
  const pending = new Promise((r) => {
    resolve = r;
  });
  await assert.rejects(
    checkActivationWithTimeout(() => pending, 5),
    /timed out/,
  );
  resolve({ state: "active" });
  assert.equal(
    await checkActivationWithTimeout(async () => "inactive"),
    "inactive",
  );
});
test("activation request failure propagates for the caller's unavailable state", async () => {
  await assert.rejects(
    checkActivationWithTimeout(() => Promise.reject(new Error("offline"))),
    /offline/,
  );
});

test("guide acknowledgment is isolated by authenticated shop and never stores activation", async () => {
  const { acknowledgeGuide, readGuideAcknowledgment } =
    await import("../app/lib/onboarding.server.js");
  const records = new Map();
  const key = ({ shop_key: { shop, key } }) => `${shop}:${key}`;
  const database = {
    appSetting: {
      async findUnique({ where }) {
        return records.get(key(where));
      },
      async upsert({ where, create, update }) {
        assert.deepEqual(Object.keys(create).sort(), ["key", "shop", "value"]);
        assert.equal(create.value, "acknowledged");
        assert.equal(update.value, "acknowledged");
        records.set(key(where), create);
      },
    },
  };
  await acknowledgeGuide("alpha.myshopify.com", database);
  assert.equal(
    await readGuideAcknowledgment("alpha.myshopify.com", database),
    true,
  );
  assert.equal(
    await readGuideAcknowledgment("beta.myshopify.com", database),
    false,
  );
  await acknowledgeGuide("alpha.myshopify.com", database);
  assert.equal(records.size, 1);
});
