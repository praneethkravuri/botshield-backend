import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import React, { act, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";

const BLOCKLIST_MODAL_INTRO =
  "Manage visitors manually prevented from accessing the storefront.";

const adminSource = fs.readFileSync(
  new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
  "utf8",
);
const protectionSource = adminSource.slice(
  adminSource.indexOf("function ProtectionPage"),
  adminSource.indexOf("function IpList"),
);
const indexSource = fs.readFileSync(
  new URL("../app/routes/app._index.jsx", import.meta.url),
  "utf8",
);

function installDom() {
  const dom = new JSDOM("<!DOCTYPE html><html><body><div id='root'></div></body></html>", {
    url: "https://example.test/ui-preview",
  });
  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  return dom;
}

function renderHarness(element) {
  const container = document.getElementById("root");
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  act(() => {});
  return container;
}

/**
 * Mirrors the reverted known-good ProtectionPage entry-intent + Manage handler flow.
 */
function ProtectionIntentHarness({ protectionEntryIntent, onClearIntent }) {
  const [protectionModal, setProtectionModal] = useState(null);

  const openBlocklist = () => {
    setProtectionModal({
      type: "blocklist",
      intro: BLOCKLIST_MODAL_INTRO,
    });
  };

  useEffect(() => {
    if (!protectionEntryIntent) return undefined;
    const intentOpeners = {
      blocklist: openBlocklist,
      trusted: () =>
        setProtectionModal({
          type: "trusted",
          intro: "Manage visitors allowed to bypass supported BotShield protection checks.",
        }),
    };
    const openIntent = intentOpeners[protectionEntryIntent];
    if (!openIntent) return undefined;
    openIntent();
    onClearIntent?.();
    return undefined;
  }, [protectionEntryIntent, protectionModal?.type]);

  return React.createElement(
    "div",
    null,
    React.createElement(
      "button",
      { type: "button", onClick: openBlocklist },
      "Manage blocklist",
    ),
    protectionModal
      ? React.createElement("p", { "data-testid": "protection-modal" }, protectionModal.intro)
      : null,
  );
}

/**
 * Mirrors the broken 67b2ecc manager= URL effect that mutates search params in-place.
 */
function BrokenManagerUrlHarness({ onEffectRun }) {
  const [searchParams, setSearchParams] = useState(
    () => new URLSearchParams("manager=blocklist&shop=test.myshopify.com"),
  );
  const [protectionModal, setProtectionModal] = useState(null);
  const openBlocklist = () => {
    setProtectionModal({
      type: "blocklist",
      intro: BLOCKLIST_MODAL_INTRO,
    });
  };

  useEffect(() => {
    onEffectRun?.();
    const manager = searchParams.get("manager");
    if (!manager) return undefined;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("manager");
    setSearchParams(nextParams);
    if (manager === "blocklist") openBlocklist();
    return undefined;
  }, [searchParams, protectionModal?.type]);

  return React.createElement(
    "div",
    null,
    React.createElement(
      "button",
      { type: "button", onClick: openBlocklist },
      "Manage blocklist",
    ),
    protectionModal
      ? React.createElement("p", { "data-testid": "protection-modal" }, protectionModal.intro)
      : null,
  );
}

test("known-good protection entry intent opens blocklist modal on mount", () => {
  installDom();
  let cleared = false;
  const container = renderHarness(
    React.createElement(ProtectionIntentHarness, {
      protectionEntryIntent: "blocklist",
      onClearIntent: () => {
        cleared = true;
      },
    }),
  );

  assert.ok(
    container.querySelector("[data-testid='protection-modal']"),
    "entry intent should open the blocklist modal",
  );
  assert.match(container.textContent, new RegExp(BLOCKLIST_MODAL_INTRO));
  assert.equal(cleared, true);
});

test("known-good Manage blocklist click stays interactive after entry intent", () => {
  installDom();
  const container = renderHarness(
    React.createElement(ProtectionIntentHarness, {
      protectionEntryIntent: null,
      onClearIntent: () => {},
    }),
  );

  const button = container.querySelector("button");
  assert.ok(button);
  act(() => {
    button.click();
  });
  act(() => {});

  assert.ok(
    container.querySelector("[data-testid='protection-modal']"),
    "Manage blocklist should open the modal",
  );
});

test("production recovery removes manager URL handling from ProtectionPage", () => {
  assert.match(protectionSource, /blocklist: openBlocklist/);
  assert.match(protectionSource, /trusted: openTrusted/);
  assert.doesNotMatch(protectionSource, /searchParams\.get\("manager"\)/);
  assert.doesNotMatch(protectionSource, /setSearchParams/);
  assert.match(indexSource, /setProtectionEntryIntent\("blocklist"\)/);
  assert.doesNotMatch(indexSource, /manager=/);
});

test("67b2ecc manager URL effect pattern re-executes across param replacement", () => {
  installDom();
  let effectRuns = 0;
  const container = renderHarness(
    React.createElement(BrokenManagerUrlHarness, {
      onEffectRun: () => {
        effectRuns += 1;
      },
    }),
  );

  act(() => {});
  assert.ok(
    container.querySelector("[data-testid='protection-modal']"),
    "manager URL should still attempt to open the modal once",
  );
  assert.ok(
    effectRuns >= 2,
    "manager URL stripping should retrigger the effect at least twice",
  );
});
