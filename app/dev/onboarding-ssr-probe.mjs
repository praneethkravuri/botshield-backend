/* eslint-env node */
/* global globalThis */
/** Actual onboarding SSR -> hydrateRoot probe, with synthetic session and App Bridge. */
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider, Outlet } from "react-router";
import { JSDOM } from "jsdom";
import OnboardingPage from "../components/onboarding/OnboardingPage.jsx";
import { ThemeActivationProvider } from "../components/onboarding/ThemeActivationProvider.jsx";

function tree() {
  const router = createMemoryRouter(
    [
      {
        id: "routes/app",
        path: "/app",
        element: React.createElement(
          ThemeActivationProvider,
          null,
          React.createElement(Outlet),
        ),
        children: [
          { path: "onboarding", element: React.createElement(OnboardingPage) },
        ],
      },
    ],
    {
      initialEntries: [
        "/app/onboarding?shop=ssr-test.myshopify.com&host=dGVzdA&embedded=1",
      ],
      hydrationData: {
        loaderData: { "routes/app": { apiKey: "local-test-key" } },
      },
    },
  );
  return React.createElement(RouterProvider, { router });
}
const html = renderToString(tree());
assert.match(html, /Let’s get your store/);
assert.match(
  new JSDOM(html).window.document.querySelector("main").textContent,
  /STEP 1 OF 3/,
);
assert.doesNotMatch(html, /BotShield is activated/);
const dom = new JSDOM(
  `<!doctype html><html><body><div id="root">${html}</div></body></html>`,
  { url: "https://example.test/app/onboarding" },
);
const originalFetch = globalThis.fetch;
const originalError = console.error;
const errors = [];
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
dom.window.matchMedia = () => ({
  matches: true,
  addEventListener() {},
  removeEventListener() {},
});
dom.window.shopify = {
  app: {
    extensions: async () => [
      {
        type: "theme_app_extension",
        activations: [
          { handle: "botshield-embed", status: "available", activations: [] },
        ],
      },
    ],
  },
};
globalThis.fetch = async () =>
  Response.json({
    shop: "ssr-test.myshopify.com",
    acknowledged: false,
  });
console.error = (...args) =>
  errors.push(args.map((value) => value?.message || String(value)).join(" "));
let root;
try {
  root = hydrateRoot(dom.window.document.getElementById("root"), tree(), {
    onRecoverableError: (error) => errors.push(error.message),
  });
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.deepEqual(
    errors.filter((error) =>
      /hydration|did not match|server HTML|text content|418|423|425/i.test(
        error,
      ),
    ),
    [],
  );
  assert.match(dom.window.document.body.textContent, /ssr-test.myshopify.com/);
  console.log(
    "Onboarding SSR and hydration passed (synthetic session, reduced motion).",
  );
} finally {
  root?.unmount();
  globalThis.fetch = originalFetch;
  console.error = originalError;
  dom.window.close();
}
