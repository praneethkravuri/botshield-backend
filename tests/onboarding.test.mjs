/* eslint-env node */
import assert from "node:assert/strict";
import test from "node:test";
import {
  shouldOfferInitialOnboarding,
  checkActivationWithTimeout,
} from "../app/lib/onboarding.js";
import {
  buildThemeEditorDeepLink,
  isPublishedThemeEmbedActive,
} from "../app/lib/theme-extension-status.js";
import { readPublishedTheme } from "../app/lib/published-theme.server.js";
import { mergeEmbeddedAppSearch } from "../app/lib/embedded-app-navigation.js";

const needsSetup = {
  pathname: "/app",
  acknowledged: false,
  state: "inactive",
  checking: false,
};
for (const state of ["inactive", "missing"]) {
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
const themeId = "gid://shopify/OnlineStoreTheme/123";
const extension = (status, themeIds = [themeId]) => [
  {
    type: "theme_app_extension",
    activations: [
      {
        handle: "botshield-embed",
        status,
        activations: themeIds.map((themeId) => ({ themeId, target: "body" })),
      },
    ],
  },
];
test("success requires the correct active embed's placement on the identified published theme", () => {
  assert.equal(isPublishedThemeEmbedActive(extension("active"), themeId), true);
  assert.equal(
    isPublishedThemeEmbedActive(extension("active", ["draft-theme"]), themeId),
    false,
  );
  assert.equal(isPublishedThemeEmbedActive(extension("active"), null), false);
  assert.equal(
    isPublishedThemeEmbedActive(extension("available"), themeId),
    false,
  );
  assert.equal(
    isPublishedThemeEmbedActive(extension("unavailable"), themeId),
    false,
  );
  assert.equal(
    isPublishedThemeEmbedActive(extension("active", []), themeId),
    false,
  );
  assert.equal(isPublishedThemeEmbedActive(null, themeId), false);
  assert.equal(
    isPublishedThemeEmbedActive(
      [
        {
          type: "theme_app_extension",
          activations: [
            {
              handle: "another-embed",
              status: "active",
              activations: [{ themeId }],
            },
          ],
        },
      ],
      themeId,
    ),
    false,
  );
});
test("missing theme permission produces an honest limitation without requesting extra scopes", async () => {
  let called = false;
  const result = await readPublishedTheme({
    session: { scope: "write_app_proxy" },
    admin: {
      graphql() {
        called = true;
      },
    },
  });
  assert.equal(called, false);
  assert.equal(result.publishedTheme, null);
  assert.match(result.publishedThemeError, /theme access/);
});
test("published-theme query uses only MAIN, with minimal merchant profile data", async () => {
  const result = await readPublishedTheme({
    session: { scope: "write_app_proxy,read_themes" },
    admin: {
      async graphql(query) {
        assert.match(query, /roles: \[MAIN\]/);
        return Response.json({
          data: {
            themes: {
              nodes: [{ id: themeId, name: "Test theme", role: "MAIN" }],
            },
          },
        });
      },
    },
  });
  assert.deepEqual(result, {
    publishedTheme: { id: themeId, name: "Test theme" },
    publishedThemeError: "",
  });
});
for (const result of [
  { errors: [{ message: "denied" }] },
  { data: { themes: { nodes: [] } } },
  { data: { themes: { nodes: [{ id: themeId, role: "UNPUBLISHED" }] } } },
]) {
  test("theme query failures and unpublished themes cannot verify the published storefront", async () => {
    const response = await readPublishedTheme({
      session: { scope: "read_themes" },
      admin: { graphql: async () => Response.json(result) },
    });
    assert.equal(response.publishedTheme, null);
  });
}
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
