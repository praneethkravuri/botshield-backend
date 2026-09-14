import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { JSDOM } from "jsdom";
import { runBotShieldModalCommand } from "../app/lib/botshield-modal-command.js";

const adminSource = fs.readFileSync(
  new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
  "utf8",
);
const modalCommandSource = fs.readFileSync(
  new URL("../app/lib/botshield-modal-command.js", import.meta.url),
  "utf8",
);
const designSource = fs.readFileSync(
  new URL("../app/components/design-system/BotShieldDesignSystem.jsx", import.meta.url),
  "utf8",
);
const hydrationPolarisSource = fs.readFileSync(
  new URL("../app/components/design-system/BotShieldHydrationPolaris.jsx", import.meta.url),
  "utf8",
);
const customElementInputSource = fs.readFileSync(
  new URL("../app/hooks/use-botshield-custom-element-input.js", import.meta.url),
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
    commandLog = [];

    connectedCallback() {
      this.addEventListener("command", (event) => {
        this.commandLog.push(event.command);
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

test("runBotShieldModalCommand prefers receiver-bound overlay calls before command dispatch", () => {
  assert.match(modalCommandSource, /Reflect\.apply\(method, modal, \[\]\)/);
  assert.match(modalCommandSource, /invokeBotShieldModalOverlayMethod/);
  assert.match(modalCommandSource, /dispatchBotShieldModalCommand/);
});

test("detached overlay methods throw the production private-member failure class", () => {
  installMockModalDom();
  const modal = document.createElement("s-modal");
  modal.id = "botshield-fraud-review-modal";
  document.body.appendChild(modal);

  const detachedHide = modal.hideOverlay;
  assert.throws(
    () => detachedHide(),
    /private member|Cannot read private member|Cannot set properties of undefined/i,
  );
});

test("runBotShieldModalCommand uses receiver-bound overlay methods when available", () => {
  installMockModalDom();
  const modal = document.createElement("s-modal");
  modal.id = "botshield-fraud-review-modal";
  document.body.appendChild(modal);

  let overlayReads = 0;
  const originalShow = modal.showOverlay;
  const originalHide = modal.hideOverlay;
  modal.showOverlay = function trackedShowOverlay() {
    overlayReads += 1;
    return originalShow.call(this);
  };
  modal.hideOverlay = function trackedHideOverlay() {
    overlayReads += 1;
    return originalHide.call(this);
  };

  assert.equal(runBotShieldModalCommand("botshield-fraud-review-modal", "--show"), true);
  assert.equal(modal.visible, true);
  assert.equal(overlayReads, 1);

  assert.equal(runBotShieldModalCommand("botshield-fraud-review-modal", "--hide"), true);
  assert.equal(modal.visible, false);
  assert.equal(overlayReads, 2);
  assert.deepEqual(modal.commandLog, []);
});

test("runBotShieldModalCommand falls back to command dispatch when overlay methods throw", () => {
  installMockModalDom();
  const modal = document.createElement("s-modal");
  modal.id = "botshield-fraud-review-modal";
  modal.showOverlay = function showOverlay() {
    throw new Error("detached overlay failure");
  };
  modal.hideOverlay = function hideOverlay() {
    throw new Error("detached overlay failure");
  };
  document.body.appendChild(modal);

  assert.equal(runBotShieldModalCommand("botshield-fraud-review-modal", "--show"), true);
  assert.equal(modal.visible, true);
  assert.deepEqual(modal.commandLog, ["--show"]);

  assert.equal(runBotShieldModalCommand("botshield-fraud-review-modal", "--hide"), true);
  assert.equal(modal.visible, false);
  assert.deepEqual(modal.commandLog, ["--show", "--hide"]);
});

test("Fraud review modal primary action uses supported commandFor hide pattern", () => {
  const fraudReviewModal = adminSource.slice(
    adminSource.indexOf("function FraudOrderReviewModal"),
    adminSource.indexOf("function getFraudDiagMode"),
  );

  assert.match(fraudReviewModal, /commandFor=\{BOTSHIELD_FRAUD_REVIEW_MODAL_ID\}/);
  assert.match(fraudReviewModal, /command="--hide"/);
  assert.doesNotMatch(
    fraudReviewModal,
    /primaryAction[\s\S]*hideBotShieldModal\(BOTSHIELD_FRAUD_REVIEW_MODAL_ID\)/,
  );
});

test("BotShieldNativeModal listens for afterhide natively instead of React onAfterhide prop", () => {
  const nativeModalSource = designSource.slice(
    designSource.indexOf("export function BotShieldNativeModal"),
    designSource.indexOf("export function BotShieldConfirmationModal"),
  );

  assert.match(nativeModalSource, /addEventListener\("afterhide"/);
  assert.doesNotMatch(nativeModalSource, /onAfterhide=\{handleAfterHide\}/);
});

test("BotShieldSearchField binds input after Polaris upgrade instead of React value/onInput props", () => {
  const searchFieldSource = hydrationPolarisSource.slice(
    hydrationPolarisSource.indexOf("export function BotShieldSearchField"),
    hydrationPolarisSource.indexOf("export function BotShieldTextField"),
  );

  assert.match(searchFieldSource, /useBotShieldCustomElementInput/);
  assert.match(searchFieldSource, /ref=\{inputRef\}/);
  assert.doesNotMatch(searchFieldSource, /<s-search-field[\s\S]*\bvalue=\{/);
  assert.doesNotMatch(searchFieldSource, /<s-search-field[\s\S]*\bonInput=\{/);
  assert.match(customElementInputSource, /addEventListener\("input"/);
  assert.match(customElementInputSource, /useBotShieldPolarisReady/);
});

test("embedded App Bridge hide path fails when overlay methods are detached", async () => {
  installMockModalDom();
  window.shopify = {
    _internal: {
      modal: {
        async hide(id) {
          const target = document.getElementById(id);
          const detached = target.hideOverlay;
          detached();
        },
      },
    },
  };

  const modal = document.createElement("s-modal");
  modal.id = "botshield-fraud-review-modal";
  document.body.appendChild(modal);

  await assert.rejects(
    () => window.shopify._internal.modal.hide("botshield-fraud-review-modal"),
    /private member|Cannot read private member|Cannot set properties of undefined/i,
  );
});
