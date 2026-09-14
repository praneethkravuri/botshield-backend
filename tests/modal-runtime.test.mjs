import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { JSDOM } from "jsdom";
import { runBotShieldModalCommand } from "../app/lib/botshield-modal-command.js";
import {
  cleanupNativeModalShowRequest,
  createBotShieldNativeModalLifecycleState,
  dispatchFallbackHideIfNeeded,
  handleNativeModalAfterHide,
  markNativeModalShown,
  scheduleFallbackHide,
} from "../app/lib/botshield-native-modal-lifecycle.js";

const designSource = fs.readFileSync(
  new URL("../app/components/design-system/BotShieldDesignSystem.jsx", import.meta.url),
  "utf8",
);
const adminSource = fs.readFileSync(
  new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
  "utf8",
);
const lifecycleSource = fs.readFileSync(
  new URL("../app/lib/botshield-native-modal-lifecycle.js", import.meta.url),
  "utf8",
);

const MODAL_ID = "botshield-protection-modal";

function installMockModalDom() {
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.customElements = dom.window.customElements;
  globalThis.HTMLElement = dom.window.HTMLElement;

  class MockPolarisModal extends dom.window.HTMLElement {
    #visible = false;

    connectedCallback() {
      this.addEventListener("command", (event) => {
        if (event.command === "--show") {
          this.#visible = true;
        }
        if (event.command === "--hide") {
          this.#visible = false;
          this.dispatchEvent(new dom.window.Event("afterhide"));
        }
      });
    }

    get visible() {
      return this.#visible;
    }
  }

  dom.window.customElements.define("s-modal", MockPolarisModal);

  dom.window.document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof dom.window.HTMLButtonElement)) return;
      const commandFor = target.getAttribute("commandfor");
      const command = target.getAttribute("command");
      if (!commandFor || !command) return;
      const modal = dom.window.document.getElementById(commandFor);
      if (!modal) return;
      const commandEvent = new dom.window.Event("command");
      commandEvent.command = command;
      modal.dispatchEvent(commandEvent);
    },
    true,
  );

  return dom;
}

function createCommandRecorder() {
  const commands = [];
  return {
    commands,
    hideModal(id) {
      commands.push({ id, command: "--hide" });
      runBotShieldModalCommand(id, "--hide");
    },
    count(command) {
      return commands.filter((entry) => entry.command === command).length;
    },
  };
}

test("runBotShieldModalCommand dispatches modal commands on upgraded s-modal instances", () => {
  installMockModalDom();
  const modal = document.createElement("s-modal");
  modal.id = "botshield-fraud-review-modal";
  document.body.appendChild(modal);

  assert.equal(runBotShieldModalCommand("botshield-fraud-review-modal", "--show"), true);
  assert.equal(modal.visible, true);

  assert.equal(runBotShieldModalCommand("botshield-fraud-review-modal", "--hide"), true);
  assert.equal(modal.visible, false);
});

test("runBotShieldModalCommand waits for upgraded s-modal instances", () => {
  installMockModalDom();
  const stale = document.createElement("div");
  stale.id = "botshield-protection-modal";
  document.body.appendChild(stale);

  assert.equal(runBotShieldModalCommand("botshield-protection-modal", "--show"), false);

  const modal = document.createElement("s-modal");
  modal.id = "botshield-protection-modal";
  stale.replaceWith(modal);

  assert.equal(runBotShieldModalCommand("botshield-protection-modal", "--show"), true);
  assert.equal(modal.visible, true);
});

function appendOverlayModal(id = "botshield-overlay-modal") {
  const modal = document.createElement("s-modal");
  modal.id = id;
  modal.showOverlay = function showOverlay() {
    modal.overlayReceiver = modal;
    modal.overlayShowCalls = (modal.overlayShowCalls || 0) + 1;
    modal._visible = true;
  };
  modal.hideOverlay = function hideOverlay() {
    modal.overlayReceiver = modal;
    modal.overlayHideCalls = (modal.overlayHideCalls || 0) + 1;
    modal._visible = false;
  };
  document.body.appendChild(modal);
  return modal;
}

test("runBotShieldModalCommand uses receiver-bound showOverlay when available", () => {
  installMockModalDom();
  const modal = appendOverlayModal();

  assert.equal(runBotShieldModalCommand(modal.id, "--show"), true);
  assert.equal(modal.overlayShowCalls, 1);
  assert.equal(modal.overlayReceiver, modal);
  assert.equal(modal._visible, true);
});

test("runBotShieldModalCommand uses receiver-bound hideOverlay when available", () => {
  installMockModalDom();
  const modal = appendOverlayModal();
  modal._visible = true;

  assert.equal(runBotShieldModalCommand(modal.id, "--hide"), true);
  assert.equal(modal.overlayHideCalls, 1);
  assert.equal(modal.overlayReceiver, modal);
  assert.equal(modal._visible, false);
});

test("runBotShieldModalCommand preserves overlay receiver through Reflect.apply", () => {
  installMockModalDom();
  const modal = document.createElement("s-modal");
  modal.id = "botshield-receiver-modal";
  let receiverAtCallTime = null;
  modal.showOverlay = function showOverlay() {
    receiverAtCallTime = this;
  };
  document.body.appendChild(modal);

  assert.equal(runBotShieldModalCommand(modal.id, "--show"), true);
  assert.equal(receiverAtCallTime, modal);
});

test("runBotShieldModalCommand falls back to commandFor when showOverlay throws", () => {
  installMockModalDom();
  const modal = document.createElement("s-modal");
  modal.id = "botshield-throwing-show-modal";
  modal.showOverlay = function showOverlay() {
    throw new Error("detached overlay failure");
  };
  document.body.appendChild(modal);

  assert.equal(runBotShieldModalCommand(modal.id, "--show"), true);
  assert.equal(modal.visible, true);
});

test("runBotShieldModalCommand falls back to commandFor when hideOverlay throws", () => {
  installMockModalDom();
  const modal = document.createElement("s-modal");
  modal.id = "botshield-throwing-hide-modal";
  modal.hideOverlay = function hideOverlay() {
    throw new Error("detached overlay failure");
  };
  document.body.appendChild(modal);

  runBotShieldModalCommand(modal.id, "--show");
  assert.equal(modal.visible, true);

  assert.equal(runBotShieldModalCommand(modal.id, "--hide"), true);
  assert.equal(modal.visible, false);
});

test("runBotShieldModalCommand falls back to commandFor when overlay methods are missing", () => {
  installMockModalDom();
  const modal = document.createElement("s-modal");
  modal.id = "botshield-command-only-modal";
  document.body.appendChild(modal);

  assert.equal(runBotShieldModalCommand(modal.id, "--show"), true);
  assert.equal(modal.visible, true);

  assert.equal(runBotShieldModalCommand(modal.id, "--hide"), true);
  assert.equal(modal.visible, false);
});

test("BotShieldNativeModal wires guarded fallback hide lifecycle", () => {
  const nativeModalSource = designSource.slice(
    designSource.indexOf("export function BotShieldNativeModal"),
    designSource.indexOf("export function BotShieldConfirmationModal"),
  );
  assert.match(nativeModalSource, /createBotShieldNativeModalLifecycleState/);
  assert.match(nativeModalSource, /cleanupNativeModalShowRequest/);
  assert.match(nativeModalSource, /handleNativeModalAfterHide/);
  assert.match(lifecycleSource, /fallbackHideDispatched/);
  assert.match(lifecycleSource, /nativeHideCompleted/);
});

test("open -> normal close via afterhide dispatches exactly one hide", () => {
  installMockModalDom();
  const modal = document.createElement("s-modal");
  modal.id = MODAL_ID;
  document.body.appendChild(modal);

  const recorder = createCommandRecorder();
  const lifecycle = createBotShieldNativeModalLifecycleState();
  const showRequest = markNativeModalShown(lifecycle);

  runBotShieldModalCommand(MODAL_ID, "--show");
  assert.equal(modal.visible, true);

  recorder.hideModal(MODAL_ID);
  handleNativeModalAfterHide(lifecycle);
  assert.equal(modal.visible, false);

  cleanupNativeModalShowRequest(lifecycle, showRequest, MODAL_ID, recorder.hideModal);

  assert.equal(recorder.count("--hide"), 1);
});

test("open -> unmount before afterhide dispatches one fallback hide", () => {
  installMockModalDom();
  const modal = document.createElement("s-modal");
  modal.id = MODAL_ID;
  document.body.appendChild(modal);

  const recorder = createCommandRecorder();
  const lifecycle = createBotShieldNativeModalLifecycleState();
  const showRequest = markNativeModalShown(lifecycle);
  runBotShieldModalCommand(MODAL_ID, "--show");
  assert.equal(modal.visible, true);

  cleanupNativeModalShowRequest(lifecycle, showRequest, MODAL_ID, recorder.hideModal);

  assert.equal(recorder.count("--hide"), 1);
  assert.equal(modal.visible, false);
});

test("open -> React open=false without native close dispatches one fallback hide", () => {
  installMockModalDom();
  const modal = document.createElement("s-modal");
  modal.id = MODAL_ID;
  document.body.appendChild(modal);

  const recorder = createCommandRecorder();
  const lifecycle = createBotShieldNativeModalLifecycleState();
  const showRequest = markNativeModalShown(lifecycle);
  runBotShieldModalCommand(MODAL_ID, "--show");
  assert.equal(modal.visible, true);

  cleanupNativeModalShowRequest(lifecycle, showRequest, MODAL_ID, recorder.hideModal);

  assert.equal(recorder.count("--hide"), 1);
  assert.equal(modal.visible, false);
});

test("normal close path does not duplicate hide commands", () => {
  installMockModalDom();
  const modal = document.createElement("s-modal");
  modal.id = MODAL_ID;
  document.body.appendChild(modal);

  const recorder = createCommandRecorder();
  const lifecycle = createBotShieldNativeModalLifecycleState();
  const showRequest = markNativeModalShown(lifecycle);

  runBotShieldModalCommand(MODAL_ID, "--show");
  recorder.hideModal(MODAL_ID);
  handleNativeModalAfterHide(lifecycle);

  cleanupNativeModalShowRequest(lifecycle, showRequest, MODAL_ID, recorder.hideModal);

  assert.equal(recorder.count("--hide"), 1);
});

test("deferred fallback hide runs once when scheduled explicitly", () => {
  const lifecycle = createBotShieldNativeModalLifecycleState();
  lifecycle.wasNativeShown = true;
  let hideCount = 0;

  scheduleFallbackHide(lifecycle, MODAL_ID, () => {
    hideCount += 1;
  }, {
    requestFrame: (callback) => {
      callback();
      return 1;
    },
    cancelFrame: () => {},
  });

  assert.equal(hideCount, 1);
  scheduleFallbackHide(lifecycle, MODAL_ID, () => {
    hideCount += 1;
  }, {
    requestFrame: (callback) => {
      callback();
      return 1;
    },
    cancelFrame: () => {},
  });
  assert.equal(hideCount, 1);
});

test("subsequent modal can open after fallback teardown", () => {
  installMockModalDom();
  const modal = document.createElement("s-modal");
  modal.id = MODAL_ID;
  document.body.appendChild(modal);

  const recorder = createCommandRecorder();
  const lifecycle = createBotShieldNativeModalLifecycleState();
  let showRequest = markNativeModalShown(lifecycle);
  runBotShieldModalCommand(MODAL_ID, "--show");

  cleanupNativeModalShowRequest(lifecycle, showRequest, MODAL_ID, recorder.hideModal);
  assert.equal(modal.visible, false);
  assert.equal(recorder.count("--hide"), 1);

  showRequest = markNativeModalShown(lifecycle);
  runBotShieldModalCommand(MODAL_ID, "--show");

  assert.equal(modal.visible, true);
  assert.equal(recorder.count("--hide"), 1);
  assert.equal(
    runBotShieldModalCommand(MODAL_ID, "--show"),
    true,
    "modal should accept a subsequent native show",
  );
  assert.equal(modal.visible, true);
});

test("Protection Manage flow stays usable after one modal open/close cycle", () => {
  installMockModalDom();
  const modal = document.createElement("s-modal");
  modal.id = MODAL_ID;
  document.body.appendChild(modal);

  const manageButton = document.createElement("button");
  manageButton.type = "button";
  manageButton.id = "manage-blocklist-probe";
  manageButton.textContent = "Manage blocklist";
  let manageClicks = 0;
  manageButton.addEventListener("click", () => {
    manageClicks += 1;
  });
  document.body.appendChild(manageButton);

  const recorder = createCommandRecorder();
  const lifecycle = createBotShieldNativeModalLifecycleState();
  const showRequest = markNativeModalShown(lifecycle);
  runBotShieldModalCommand(MODAL_ID, "--show");

  cleanupNativeModalShowRequest(lifecycle, showRequest, MODAL_ID, recorder.hideModal);
  assert.equal(modal.visible, false);

  manageButton.click();
  assert.equal(manageClicks, 1, "Manage blocklist should remain clickable after modal teardown");
});

test("dispatchFallbackHideIfNeeded only hides once", () => {
  const lifecycle = createBotShieldNativeModalLifecycleState();
  lifecycle.wasNativeShown = true;
  let hideCount = 0;

  assert.equal(
    dispatchFallbackHideIfNeeded(lifecycle, MODAL_ID, () => {
      hideCount += 1;
    }),
    true,
  );
  assert.equal(
    dispatchFallbackHideIfNeeded(lifecycle, MODAL_ID, () => {
      hideCount += 1;
    }),
    false,
  );
  assert.equal(hideCount, 1);
});

test("modal shells provide accessibilityLabel for scroll-box modals", () => {
  assert.match(designSource, /accessibilityLabel=\{accessibilityLabel \?\? heading\}/);
  assert.match(designSource, /export function BotShieldNativeModal/);
  assert.match(designSource, /export function BotShieldConfirmationModal/);
  assert.match(designSource, /export function BotShieldTypedConfirmationModal/);
  assert.match(designSource, /export function BotShieldInfoModal/);

  const modalMarkers = [
    "BOTSHIELD_ANALYTICS_EVENT_MODAL_ID",
    "BOTSHIELD_ANALYTICS_BLOCK_VISITOR_MODAL_ID",
    "BOTSHIELD_ANALYTICS_UNBLOCK_VISITOR_MODAL_ID",
    "BOTSHIELD_ANALYTICS_REMOVE_TRUSTED_MODAL_ID",
    "BOTSHIELD_FRAUD_SETUP_MODAL_ID",
    "BOTSHIELD_FRAUD_REVIEW_MODAL_ID",
    "BOTSHIELD_PROTECTION_MODAL_ID",
    "botshield-protection-discard-modal",
    "botshield-blocklist-remove-modal",
    "botshield-trusted-remove-modal",
    "botshield-clear-simulation-modal",
    "botshield-reset-data-modal",
  ];

  for (const marker of modalMarkers) {
    assert.match(adminSource, new RegExp(marker));
  }
});

test("Fraud Orders review opens through native modal open state", () => {
  const fraudReviewModal = adminSource.slice(
    adminSource.indexOf("function FraudOrderReviewModal"),
    adminSource.indexOf("function FraudOrdersPage"),
  );
  assert.match(fraudReviewModal, /open=\{Boolean\(order\)\}/);
  assert.doesNotMatch(
    adminSource.slice(
      adminSource.indexOf("function FraudOrdersPage"),
      adminSource.indexOf("function getProtectionModalSize"),
    ),
    /queueBotShieldModalShow\(BOTSHIELD_FRAUD_REVIEW_MODAL_ID\)/,
  );
});
