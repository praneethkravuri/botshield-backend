import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { BotShieldPolarisReadyContext } from "../app/hooks/use-botshield-polaris-ready.js";
import { useBotShieldCustomElementClick } from "../app/hooks/use-botshield-custom-element-click.js";

function BotShieldTestButton({ onClick, children }) {
  const buttonRef = useBotShieldCustomElementClick(onClick, {
    enabled: typeof onClick === "function",
  });

  return React.createElement(
    "s-button",
    { ref: buttonRef },
    children,
  );
}

test("ensurePolarisInitialized loads polaris.js once and waits for s-button registration", async () => {
  const dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", {
    url: "https://example.test/app",
  });

  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.customElements = window.customElements;

  const { ensurePolarisInitialized, POLARIS_SCRIPT_ID } = await import(
    "../app/lib/botshield-polaris-init.client.js"
  );

  const first = ensurePolarisInitialized();
  const script = window.document.getElementById(POLARIS_SCRIPT_ID);
  assert.ok(script, "expected deferred polaris script to be appended");
  assert.equal(script.getAttribute("src"), "https://cdn.shopify.com/shopifycloud/polaris.js");

  window.customElements.define("s-button", class SButton extends window.HTMLElement {});
  script.dispatchEvent(new window.Event("load"));

  await first;
  assert.ok(window.customElements.get("s-button"));

  await ensurePolarisInitialized();
  assert.equal(
    window.document.querySelectorAll('script[src*="shopifycloud/polaris.js"]').length,
    1,
    "expected exactly one polaris.js script tag",
  );
});

test("custom element click bridge executes handler before and after polaris-ready flip", () => {
  const dom = new JSDOM("<!DOCTYPE html><html><body><div id='root'></div></body></html>", {
    url: "https://example.test/app",
  });
  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;

  window.customElements.define(
    "s-button",
    class SButton extends window.HTMLElement {
      connectedCallback() {
        this.innerHTML = `<button type="button">${this.textContent || ""}</button>`;
      }
    },
  );

  let clicks = 0;

  function ProbeApp({ ready }) {
    return React.createElement(
      BotShieldPolarisReadyContext.Provider,
      { value: { ready, error: "" } },
      React.createElement(
        BotShieldTestButton,
        { onClick: () => { clicks += 1; } },
        "Manage protection",
      ),
    );
  }

  const container = window.document.getElementById("root");
  const tree = React.createElement(ProbeApp, { ready: false });
  container.innerHTML = renderToString(tree);
  hydrateRoot(container, tree);

  const button = container.querySelector("s-button");
  assert.ok(button, "expected s-button to render");

  button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(clicks, 1, "native click should invoke handler before polaris-ready flip");

  hydrateRoot(
    container,
    React.createElement(ProbeApp, { ready: true }),
  );

  button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(clicks, 2, "native click should still invoke handler after polaris-ready flip");
});

test("Overview Manage protection and View activity wire to setPage actions", async () => {
  const adminSource = await import("node:fs/promises").then((fs) =>
    fs.readFile(
      new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
      "utf8",
    ),
  );

  const overviewSource = adminSource.slice(
    adminSource.indexOf("function OverviewPage"),
    adminSource.indexOf("function AnalyticsPage"),
  );

  assert.match(
    overviewSource,
    /Manage protection[\s\S]*onClick=\{\(\) => actions\.setPage\("detection"\)\}/,
  );
  assert.match(
    overviewSource,
    /View activity[\s\S]*onClick=\{\(\) => actions\.setPage\("analytics"\)\}/,
  );
  assert.match(
    overviewSource,
    /Refresh status[\s\S]*handleRefreshStoreHealth/,
  );
});

test("embedded provider initializes polaris once and bridges nav clicks", async () => {
  const providerSource = await import("node:fs/promises").then((fs) =>
    fs.readFile(
      new URL("../app/components/BotShieldEmbeddedAppProvider.jsx", import.meta.url),
      "utf8",
    ),
  );
  const designSource = await import("node:fs/promises").then((fs) =>
    fs.readFile(
      new URL("../app/components/design-system/BotShieldDesignSystem.jsx", import.meta.url),
      "utf8",
    ),
  );

  assert.match(providerSource, /ensurePolarisInitialized/);
  assert.match(providerSource, /BotShieldPolarisReadyContext/);
  assert.match(providerSource, /useBotShieldCustomElementClick/);
  assert.match(providerSource, /mergeEmbeddedAppSearch/);
  assert.match(providerSource, /navigateEmbedded\(href\)/);
  assert.match(designSource, /useBotShieldCustomElementClick/);
  assert.match(designSource, /ref={buttonRef}/);
});
