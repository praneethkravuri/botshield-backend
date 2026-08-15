import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const adminSource = fs.readFileSync(
  new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
  "utf8",
);
const designSource = fs.readFileSync(
  new URL("../app/components/design-system/BotShieldDesignSystem.jsx", import.meta.url),
  "utf8",
);

test("Protection remains a control plane with four real modules", () => {
  for (const label of [
    "Bot protection",
    "Network / Proxy protection",
    "Rate protection",
    "Page protection",
  ]) assert.match(adminSource, new RegExp(label.replace("/", "\\/")));
  assert.match(adminSource, /Protection policy/);
  assert.match(adminSource, /Visitor access/);
  assert.doesNotMatch(adminSource.slice(adminSource.indexOf("function ProtectionPage"), adminSource.indexOf("function IpList")), /Threat Activity|Event Explorer|Intervention rate/);
});

test("Protection controls use existing persisted actions", () => {
  assert.match(adminSource, /actions\.saveSettings\(draft\)/);
  assert.match(adminSource, /actions\.addBlockedIp/);
  assert.match(adminSource, /actions\.removeBlockedIp/);
  assert.match(adminSource, /actions\.addTrustedIp/);
  assert.match(adminSource, /actions\.removeTrustedIp/);
  assert.match(adminSource, /ReactDOM\.createPortal/);
  assert.match(adminSource, /duplicateIp/);
  assert.match(adminSource, /already on the \$\{listLabel\}/);
  assert.match(adminSource, /Remove \{trusted \? "trusted" : "blocked"\} visitor\?/);
});

test("Protection profile drawer has explicit persisted save and discard lifecycle", () => {
  assert.match(adminSource, /const \[originalDraft, setOriginalDraft\]/);
  assert.match(adminSource, /const requestClose = \(\) =>/);
  assert.match(adminSource, /setConfirmDiscard\(true\)/);
  assert.match(adminSource, /Save changes/);
  assert.match(adminSource, /Cancel/);
  assert.match(adminSource, /Saving changes…/);
  assert.match(adminSource, /Settings saved/);
  assert.match(adminSource, /Couldn’t save \$\{protectionModal\.title\} settings/);
  assert.match(adminSource, /aria-label="Close"/);
  assert.match(adminSource, /event\.key === "Escape"/);
  assert.match(adminSource, /onMouseDown=\{\(event\) => \{ if \(event\.target === event\.currentTarget\) requestClose\(\); \}\}/);
});

test("Protection drawer uses a sticky action footer and local discard dialog", () => {
  assert.match(designSource, /\.botshield-protection-drawer-footer \{[^}]*flex: 0 0 auto/);
  assert.match(designSource, /\.botshield-protection-modal-body \{[^}]*overflow-y: auto/);
  assert.match(designSource, /\.botshield-protection-discard-layer/);
  assert.match(adminSource, /Discard unsaved changes\?/);
  assert.match(adminSource, /Keep editing/);
  assert.match(adminSource, /Discard changes/);
});

test("Protection V2.1 exposes only real detection and enforcement capabilities", () => {
  for (const copy of [
    "Known automation",
    "Automation signatures",
    "Burst traffic",
    "Repeat offender",
    "VPN / Proxy",
    "Hosting / Datacenter",
    "Network reputation",
    "Protected storefront areas",
    "Risk threshold",
    "Verified activity · Last 30 days",
  ]) assert.match(adminSource, new RegExp(copy.replace("/", "\\/")));
  assert.match(adminSource, /draft\.strictMode\s*\? 35/);
  assert.match(adminSource, /draft\.blockLevel === "Low"\s*\? 90/);
  assert.match(adminSource, /draft\.blockLevel === "High"\s*\? 50/);
  assert.match(adminSource, /: 70;/);
  assert.doesNotMatch(adminSource.slice(adminSource.indexOf("function ProtectionPage"), adminSource.indexOf("function IpList")), /money saved|estimated savings|country blocker|verified bot/iu);
});

test("Visitor access supports real-data search and removal confirmation", () => {
  assert.match(adminSource, /Search \$\{trusted \? "trusted visitors" : "blocked visitors"\}/);
  assert.match(adminSource, /placeholder="IP address, source, or reason"/);
  assert.match(adminSource, /record\.reason/);
  assert.match(adminSource, /record\.source/);
  assert.match(adminSource, /No matching visitors/);
});

test("Protection drawers and responsive layouts are scoped locally", () => {
  assert.match(designSource, /\/\* Protection control center \*\//);
  assert.match(designSource, /\.botshield-protection-modal-backdrop/);
  assert.match(designSource, /\.botshield-protection-access-grid/);
  assert.match(designSource, /@media \(max-width: 640px\)/);
});
