/**
 * Real polaris.js + SSR→hydrate Fraud Orders isolation (fraudDiag A–E).
 *
 * Run: npx vite-node app/dev/fraud-polaris-embedded-diag.mjs
 */
import React from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { MemoryRouter } from "react-router";
import BotShieldEmbeddedAppProvider from "../components/BotShieldEmbeddedAppProvider.jsx";
import BotShieldAdminExperience from "../components/admin/BotShieldAdminExperience.jsx";

const POLARIS_SRC = "https://cdn.shopify.com/shopifycloud/polaris.js";
const PRIVATE_MEMBER_RE = /private member|Cannot read private member/i;
const MODES = ["A", "B", "C", "D", "E"];

const previewFraudOrders = [
  {
    id: "preview-order-1",
    name: "#1042",
    createdAt: "2026-07-07T08:00:00.000Z",
    amount: "$142.00",
    risk: "high",
    recommendation: "Review",
    fulfillmentStatus: "Unfulfilled",
    financialStatus: "Paid",
    adminUrl: "https://admin.shopify.com/store/preview/orders/1",
  },
];

function buildModel() {
  return {
    page: "fraud-orders",
    fraudOrderAccessConnected: true,
    fraudOrders: previewFraudOrders,
    fraudOrdersLoading: false,
    fraudOrdersError: null,
    fraudOrdersErrorCode: null,
    fraudOrdersLastRefreshedAt: "2026-07-07T09:00:00.000Z",
    renderAnchorMs: Date.UTC(2026, 6, 7, 9, 0, 0),
  };
}

const actions = {
  setPage: () => {},
  refresh: async () => {},
  refreshSettings: async () => {},
  refreshBilling: async () => {},
  refreshIncidents: async () => {},
  refreshFraudOrderAccess: async () => {},
  clearSimulationData: async () => {},
  openThemeEditor: () => {},
  saveSettings: async () => {},
  addBlockedIp: async () => {},
  removeBlockedIp: async () => {},
  addTrustedIp: async () => {},
  removeTrustedIp: async () => {},
  recoverIncident: async () => {},
  setIncidentFilter: () => {},
};

function FraudOrdersDiagApp({ mode }) {
  return React.createElement(
    MemoryRouter,
    { initialEntries: [`/app/fraud-orders?polarisDiag=1&fraudDiag=${mode}`] },
    React.createElement(
      BotShieldEmbeddedAppProvider,
      { apiKey: "diag-api-key" },
      React.createElement(BotShieldAdminExperience, { model: buildModel(), actions }),
    ),
  );
}

function installImperativeHooks(window) {
  const log = [];
  window.__BOTSHIELD_DIAG_LOG__ = log;

  const hookPrototype = (ModalClass) => {
    if (!ModalClass?.prototype || ModalClass.prototype.__botshieldHooked__) return;
    ModalClass.prototype.__botshieldHooked__ = true;
    for (const methodName of ["showOverlay", "hideOverlay", "show", "hide", "toggleOverlay"]) {
      const original = ModalClass.prototype[methodName];
      if (typeof original !== "function") continue;
      ModalClass.prototype[methodName] = function wrapped(...args) {
        const entry = {
          method: methodName,
          tag: this?.tagName?.toLowerCase?.(),
          id: this?.id || null,
          constructor: this?.constructor?.name || null,
          stack: new Error(`${methodName} call`).stack,
        };
        log.push(entry);
        try {
          return Reflect.apply(original, this, args);
        } catch (error) {
          log.push({
            type: "throw",
            method: methodName,
            message: error?.message || String(error),
            stack: error?.stack || null,
            callerStack: new Error("throw boundary").stack,
          });
          throw error;
        }
      };
    }
  };

  if (window.customElements.get("s-modal")) {
    hookPrototype(window.customElements.get("s-modal"));
  } else {
    window.customElements.whenDefined("s-modal").then(() => {
      hookPrototype(window.customElements.get("s-modal"));
    });
  }

  window.addEventListener("error", (event) => {
    const message = event.error?.message || event.message || "";
    if (!PRIVATE_MEMBER_RE.test(message)) return;
    log.push({
      type: "window-error",
      message,
      filename: event.filename || null,
      lineno: event.lineno || null,
      colno: event.colno || null,
      stack: event.error?.stack || null,
    });
  });
}

async function loadRealPolaris(window) {
  if (window.customElements.get("s-button")) {
    await window.customElements.whenDefined("s-modal");
    return;
  }

  await new Promise((resolve, reject) => {
    const script = window.document.createElement("script");
    script.src = POLARIS_SRC;
    script.async = false;
    script.onload = resolve;
    script.onerror = reject;
    window.document.head.appendChild(script);
  });

  await window.customElements.whenDefined("s-button");
  await window.customElements.whenDefined("s-modal");
}

async function runMode(mode) {
  const tree = React.createElement(FraudOrdersDiagApp, { mode });
  const serverHtml = renderToString(tree);

  const dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", {
    url: `https://admin.shopify.com/store/botshield-test-2/apps/botshield/app/fraud-orders?polarisDiag=1&fraudDiag=${mode}`,
    runScripts: "dangerously",
    resources: "usable",
  });

  dom.window.shopify = { toast: { show: () => {} } };
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.customElements = dom.window.customElements;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.requestAnimationFrame =
    dom.window.requestAnimationFrame?.bind(dom.window) ||
    ((callback) => dom.window.setTimeout(() => callback(Date.now()), 0));
  globalThis.cancelAnimationFrame =
    dom.window.cancelAnimationFrame?.bind(dom.window) || dom.window.clearTimeout.bind(dom.window);

  installImperativeHooks(dom.window);

  const container = dom.window.document.createElement("div");
  container.innerHTML = serverHtml;
  dom.window.document.body.appendChild(container);

  const consoleErrors = [];
  const originalConsoleError = console.error;
  console.error = (...args) => {
    consoleErrors.push(
      args.map((arg) => (typeof arg === "string" ? arg : arg?.message || String(arg))).join(" "),
    );
    originalConsoleError(...args);
  };

  process.env.NODE_ENV = "development";

  let loadError = null;
  try {
    await loadRealPolaris(dom.window);
  } catch (error) {
    loadError = error.message;
  }

  if (!loadError) {
    hydrateRoot(container, tree, {
      onRecoverableError: (error) => {
        consoleErrors.push(`recoverable:${error?.message || error}`);
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.error = originalConsoleError;

  const modal = dom.window.document.getElementById("botshield-fraud-review-modal");
  const ModalClass = dom.window.customElements.get("s-modal");
  const log = dom.window.__BOTSHIELD_DIAG_LOG__ || [];
  const privateErrors = [
    ...consoleErrors.filter((message) => PRIVATE_MEMBER_RE.test(message)),
    ...log.filter((entry) => entry.type === "window-error" || entry.type === "throw"),
  ];

  const lastImperative = [...log].reverse().find((entry) => entry.method);
  const botshieldFrame =
    lastImperative?.stack?.split("\n").find((line) => /botshield|BotShield|modal-command/i.test(line)) ||
    privateErrors[0]?.stack?.split("\n").find((line) => /botshield|BotShield|modal-command/i.test(line)) ||
    null;

  return {
    mode,
    pass: privateErrors.length === 0 && !loadError,
    loadError,
    modalPresent: Boolean(modal),
    modalTag: modal?.tagName?.toLowerCase?.() || null,
    modalConstructor: modal?.constructor?.name || null,
    modalRegistered: Boolean(ModalClass),
    modalInstanceof: Boolean(modal && ModalClass && modal instanceof ModalClass),
    privateErrorCount: privateErrors.length,
    firstPrivateError: privateErrors[0] || null,
    lastImperativeCall: lastImperative || null,
    firstBotShieldFrame: botshieldFrame,
    imperativeCallCount: log.filter((entry) => entry.method).length,
    allImperativeCalls: log.filter((entry) => entry.method),
  };
}

console.log("\n=== Fraud Orders polaris isolation (real polaris.js, SSR→hydrate) ===\n");

const results = [];
for (const mode of MODES) {
  const result = await runMode(mode);
  results.push(result);
  console.log(JSON.stringify(result, null, 2));
}

console.log("\n=== PASS/FAIL table ===");
for (const result of results) {
  console.log(`${result.mode}: ${result.pass ? "PASS" : "FAIL"} (private errors: ${result.privateErrorCount})`);
}

const firstFail = results.find((result) => !result.pass);
const lastPass = [...results].reverse().find((result) => result.pass);
if (firstFail && lastPass) {
  console.log(`\nBoundary: ${lastPass.mode} (PASS) → ${firstFail.mode} (FAIL)`);
}

process.exit(firstFail ? 1 : 0);
