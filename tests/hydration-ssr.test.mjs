import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { JSDOM } from "jsdom";

function registerPolarisUpgrade(window) {
  if (window.customElements.get("s-stack")) {
    return;
  }

  class PolarisLikeStack extends window.HTMLElement {
    connectedCallback() {
      if (this.dataset.upgraded === "1") {
        return;
      }
      this.dataset.upgraded = "1";
      const wrapper = window.document.createElement("div");
      wrapper.setAttribute("data-polaris-upgraded", "1");
      wrapper.innerHTML = this.innerHTML;
      this.innerHTML = "";
      this.appendChild(wrapper);
    }
  }

  window.customElements.define("s-stack", PolarisLikeStack);
}

function upgradePolarisHosts(document) {
  registerPolarisUpgrade(document.defaultView);
  for (const element of document.querySelectorAll("s-stack")) {
    element.connectedCallback?.();
  }
}

function MixedOverviewTree({ useLayoutDiv = false }) {
  const Stack = useLayoutDiv ? "div" : "s-stack";
  return React.createElement(
    Stack,
    {
      "data-testid": "stack",
      className: useLayoutDiv ? "botshield-layout-stack" : undefined,
    },
    React.createElement(
      "section",
      { className: "botshield-v2-status" },
      React.createElement("h2", null, "Protection is active"),
      React.createElement("p", null, "BotShield is connected."),
    ),
    React.createElement(
      "button",
      { type: "button", className: "botshield-v2-period-button" },
      "30 days",
    ),
  );
}

test("polaris pre-hydration DOM mutation changes s-stack child structure", () => {
  const tree = React.createElement(MixedOverviewTree, { useLayoutDiv: false });
  const serverHtml = renderToString(tree);

  assert.match(serverHtml, /<s-stack[^>]*><section/);

  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
    url: "https://example.test/app",
  });

  const container = dom.window.document.createElement("div");
  container.innerHTML = serverHtml;
  dom.window.document.body.appendChild(container);
  upgradePolarisHosts(dom.window.document);

  assert.match(
    container.innerHTML,
    /data-polaris-upgraded="1"/,
    "expected polaris-like upgrade to wrap s-stack children before hydration",
  );
  assert.doesNotMatch(
    container.innerHTML,
    /<s-stack[^>]*><section/,
    "expected polaris upgrade to remove direct section child from s-stack",
  );
});

test("layout div hosts keep direct child structure under polaris mutation", () => {
  const tree = React.createElement(MixedOverviewTree, { useLayoutDiv: true });
  const serverHtml = renderToString(tree);

  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
    url: "https://example.test/app",
  });

  const container = dom.window.document.createElement("div");
  container.innerHTML = serverHtml;
  dom.window.document.body.appendChild(container);
  upgradePolarisHosts(dom.window.document);

  assert.match(
    container.innerHTML,
    /class="botshield-layout-stack"[^>]*><section/,
    "layout div hosts should preserve direct React child structure",
  );
});

test("overview HTML leaf hosts survive polaris-like pre-hydration DOM mutation", () => {
  function OverviewSnippet() {
    return React.createElement(
      "div",
      {
        className: "botshield-layout-stack",
        "data-botshield-layout": "stack",
        style: { display: "flex", flexDirection: "column", gap: "18px" },
      },
      React.createElement(
        "section",
        { className: "botshield-v2-status" },
        React.createElement("h2", null, "Protection is active"),
        React.createElement(
          "span",
          {
            className: "botshield-polaris-badge",
            "data-botshield-polaris-leaf": "badge",
          },
          "Active",
        ),
      ),
      React.createElement(
        "button",
        {
          className: "botshield-polaris-button",
          "data-botshield-polaris-leaf": "button",
          "data-variant": "primary",
          type: "button",
        },
        "Manage protection",
      ),
    );
  }

  const tree = React.createElement(OverviewSnippet);
  const serverHtml = renderToString(tree);
  assert.match(serverHtml, /botshield-polaris-button/);
  assert.doesNotMatch(serverHtml, /<s-button/);

  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
    url: "https://example.test/app",
  });
  const container = dom.window.document.createElement("div");
  container.innerHTML = serverHtml;
  dom.window.document.body.appendChild(container);
  upgradePolarisHosts(dom.window.document);

  const messages = [];
  const originalError = console.error;
  console.error = (...args) => {
    messages.push(
      args
        .map((arg) => (typeof arg === "string" ? arg : arg?.message || String(arg)))
        .join(" "),
    );
  };

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  process.env.NODE_ENV = "development";
  try {
    hydrateRoot(container, tree);
  } finally {
    console.error = originalError;
  }

  const hits = messages.filter((message) =>
    /hydration|did not match|Expected server HTML|418|423|425/i.test(message),
  );
  assert.equal(hits.length, 0, hits.join(" | "));
});

test("official AppProvider injects polaris.js and app shell avoids SSR leaf polaris tags", async () => {
  const appProviderSource = await readFile(
    new URL(
      "../node_modules/@shopify/shopify-app-react-router/dist/esm/react/components/AppProvider/AppProvider.mjs",
      import.meta.url,
    ),
    "utf8",
  );
  const polarisSource = await readFile(
    new URL("../app/components/design-system/BotShieldHydrationPolaris.jsx", import.meta.url),
    "utf8",
  );
  const appRouteSource = await readFile(
    new URL("../app/routes/app.jsx", import.meta.url),
    "utf8",
  );
  assert.match(appProviderSource, /shopifycloud\/polaris\.js/);
  assert.match(appRouteSource, /BotShieldEmbeddedAppProvider apiKey=\{apiKey\}/);
  assert.doesNotMatch(appRouteSource, /AppProvider embedded apiKey=\{apiKey\}/);
  assert.match(polarisSource, /BotShieldPolarisButtonComponent/);
  assert.match(polarisSource, /useBotShieldCustomElementClick/);
  assert.match(polarisSource, /createElement\("s-page"/);
});

test("shared Polaris wrappers render real Shopify web components", async () => {
  const polarisSource = await readFile(
    new URL("../app/components/design-system/BotShieldHydrationPolaris.jsx", import.meta.url),
    "utf8",
  );

  assert.match(polarisSource, /createPolarisComponent\("s-stack"\)/);
  assert.match(polarisSource, /createElement\("s-page"/);
  assert.match(polarisSource, /BotShieldPolarisButtonComponent/);
  assert.match(polarisSource, /useBotShieldCustomElementClick/);
  assert.match(polarisSource, /createPolarisComponent\("s-badge"\)/);
  assert.doesNotMatch(polarisSource, /createLayoutHost\("stack"\)/);
  assert.doesNotMatch(polarisSource, /createLeafHost\("button"/);
});

test("BotShieldAppFrame injects admin CSS with hydration-safe style markup", async () => {
  const designSource = await readFile(
    new URL(
      "../app/components/design-system/BotShieldDesignSystem.jsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(designSource, /export const BOTSHIELD_ADMIN_STYLES = `/);
  assert.match(
    designSource,
    /dangerouslySetInnerHTML=\{\{ __html: BOTSHIELD_ADMIN_STYLES \}\}/,
  );
  assert.match(designSource, /BOTSHIELD_ADMIN_STYLES[\s\S]*botshield-admin-shell/);
  assert.doesNotMatch(
    designSource,
    /BotShieldAppFrame[\s\S]{0,260}<style>\{/,
  );
});

test("style text children are forbidden and dangerouslySetInnerHTML hydrates admin CSS", () => {
  const css =
    ".botshield-admin-shell { color: #1f1f1f; } .botshield-route-shell s-page { display: block; } .botshield-titlebar > span { color: inherit; }";

  const innerHtmlTree = React.createElement(
    "div",
    null,
    React.createElement("style", {
      dangerouslySetInnerHTML: { __html: css },
    }),
  );

  const serverHtml = renderToString(innerHtmlTree);
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  const container = dom.window.document.createElement("div");
  container.innerHTML = serverHtml;
  dom.window.document.body.appendChild(container);

  const messages = [];
  const originalError = console.error;
  console.error = (...args) => {
    messages.push(
      args
        .map((arg) => (typeof arg === "string" ? arg : arg?.message || String(arg)))
        .join(" "),
    );
    originalError(...args);
  };

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;

  try {
    hydrateRoot(container, innerHtmlTree);
  } finally {
    console.error = originalError;
  }

  const styleMismatch = messages.some((message) =>
    /Text content did not match[\s\S]*botshield-admin-shell/i.test(message),
  );

  assert.equal(
    styleMismatch,
    false,
    "expected dangerouslySetInnerHTML style boundary to hydrate cleanly",
  );
  assert.match(serverHtml, /botshield-admin-shell/);
});
