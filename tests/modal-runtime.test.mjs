import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { JSDOM } from "jsdom";
import { runBotShieldModalCommand } from "../app/lib/botshield-modal-command.js";

const designSource = fs.readFileSync(
  new URL("../app/components/design-system/BotShieldDesignSystem.jsx", import.meta.url),
  "utf8",
);
const adminSource = fs.readFileSync(
  new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
  "utf8",
);

const modalCommandSource = fs.readFileSync(
  new URL("../app/lib/botshield-modal-command.js", import.meta.url),
  "utf8",
);

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
        }
      });
    }

    showOverlay() {
      this.#visible = true;
    }

    hideOverlay() {
      this.#visible = false;
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

test("BotShieldNativeModal no longer auto-hides when open becomes false", () => {
  const nativeModalSource = designSource.slice(
    designSource.indexOf("export function BotShieldNativeModal"),
    designSource.indexOf("export function BotShieldConfirmationModal"),
  );
  assert.match(nativeModalSource, /if \(!open\) \{/);
  assert.doesNotMatch(nativeModalSource, /hideBotShieldModal\(id\)/);
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
