import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { JSDOM } from "jsdom";
import { hydrateRoot } from "react-dom/client";
import {
  BotShieldAppFrame,
  BOTSHIELD_ADMIN_STYLES,
} from "../components/design-system/BotShieldDesignSystem.jsx";

const tree = React.createElement(
  BotShieldAppFrame,
  null,
  React.createElement("div", { className: "botshield-route-shell" }, "Overview"),
);

const serverHtml = renderToString(tree);
const styleMatch = serverHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/);

console.log("SSR style content length:", styleMatch?.[1]?.length ?? 0);

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
const container = dom.window.document.createElement("div");
container.innerHTML = serverHtml;
dom.window.document.body.appendChild(container);

const domStyle = container.querySelector("style");
console.log("DOM style innerHTML length before hydrate:", domStyle?.innerHTML?.length ?? 0);
console.log(
  "DOM matches exported CSS:",
  domStyle?.innerHTML === BOTSHIELD_ADMIN_STYLES,
);

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
dom.window.shopify = { toast: { show: () => {} } };

try {
  hydrateRoot(container, tree);
} finally {
  console.error = originalError;
}

const styleMismatch = messages.some((message) =>
  /Text content did not match[\s\S]*botshield-admin-shell/i.test(message),
);

console.log("style text-node hydration mismatch:", styleMismatch);
assert.equal(styleMismatch, false, "style boundary must hydrate without text mismatch");
assert.ok(BOTSHIELD_ADMIN_STYLES.includes("botshield-admin-shell"));
assert.ok(serverHtml.includes("botshield-admin-shell"));
