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
const detectionSource = fs.readFileSync(
  new URL("../app/lib/bot-detection.server.js", import.meta.url),
  "utf8",
);
const controlSource = fs.readFileSync(
  new URL("../app/lib/bot-control.server.js", import.meta.url),
  "utf8",
);

const protectionPage = adminSource.slice(
  adminSource.indexOf("function ProtectionPage"),
  adminSource.indexOf("function IpList"),
);

test("Protection remains a control plane with four real modules", () => {
  for (const label of [
    "Bot Protection",
    "Network / Proxy Protection",
    "Rate Protection",
    "Page Protection",
  ]) assert.match(adminSource, new RegExp(label.replace("/", "\\/")));
  assert.match(adminSource, /Protection policy/);
  assert.match(adminSource, /Visitor access/);
  assert.doesNotMatch(protectionPage, /Threat Activity|Event Explorer|Intervention rate/);
});

test("Protection controls use existing persisted actions", () => {
  assert.match(adminSource, /actions\.saveSettings\(draft\)/);
  assert.match(adminSource, /actions\.addBlockedIp/);
  assert.match(adminSource, /actions\.removeBlockedIp/);
  assert.match(adminSource, /actions\.addTrustedIp/);
  assert.match(adminSource, /actions\.removeTrustedIp/);
  assert.match(adminSource, /BotShieldNativeModal/);
  assert.match(adminSource, /duplicateIp/);
  assert.match(adminSource, /already on the \$\{listLabel\}/);
  assert.match(protectionPage, /botshield-blocklist-remove-modal/);
  assert.match(protectionPage, /botshield-trusted-remove-modal/);
});

test("Protection profile modal has explicit persisted save and discard lifecycle", () => {
  assert.match(protectionPage, /const \[originalDraft, setOriginalDraft\]/);
  assert.match(protectionPage, /const requestClose = \(\) =>/);
  assert.match(protectionPage, /pendingTransitionRef\.current = "discard"/);
  assert.match(protectionPage, /botshield-protection-discard-modal/);
  assert.match(protectionPage, /Save changes/);
  assert.match(protectionPage, /Cancel/);
  assert.match(protectionPage, /Saving changes…/);
  assert.match(protectionPage, /Protection settings saved/);
  assert.match(protectionPage, /Couldn't save \$\{protectionModal\.title\}/);
  assert.match(protectionPage, /slot="primary-action"/);
  assert.match(protectionPage, /slot="secondary-actions"/);
  assert.match(protectionPage, /onAfterHide=\{handleProtectionModalAfterHide\}/);
  assert.doesNotMatch(protectionPage, /ReactDOM\.createPortal/);
  assert.doesNotMatch(protectionPage, /botshield-protection-drawer-header/);
  assert.doesNotMatch(protectionPage, /botshield-protection-drawer-footer/);
  assert.doesNotMatch(protectionPage, /event\.key === "Escape"/);
  assert.match(protectionPage, /dirty && protectionModal\?\.type === "profile"/);
  assert.doesNotMatch(protectionPage, /onClick=\{\(\) => setProtectionModal\(null\)\}/);
});

test("Protection profile cancel and close restore persisted draft state", () => {
  assert.match(protectionPage, /onClick=\{requestClose\}/);
  assert.match(protectionPage, /onConfirm=\{async \(\) => \{\s*setDraft\(originalDraft\);\s*closeDrawer\(\);\s*\}\}/s);
  assert.match(protectionPage, /onDismiss=\{resumeProtectionModal\}/);
  assert.match(protectionPage, /setDraft\(persisted\);\s*setOriginalDraft\(persisted\);/s);
  assert.match(protectionPage, /await actions\.saveSettings\(draft\)/);
});

test("Protection native modals sequence discard and remove confirmations without nesting", () => {
  assert.match(protectionPage, /hideBotShieldModal\(BOTSHIELD_PROTECTION_MODAL_ID\)/);
  assert.match(protectionPage, /"remove-blocklist"/);
  assert.match(protectionPage, /"remove-trusted"/);
  assert.match(protectionPage, /pendingTransitionRef\.current = "open-policy"/);
  assert.match(protectionPage, /showBotShieldModal\("botshield-protection-discard-modal"\)/);
  assert.match(protectionPage, /showBotShieldModal\("botshield-blocklist-remove-modal"\)/);
  assert.match(protectionPage, /showBotShieldModal\("botshield-trusted-remove-modal"\)/);
  assert.match(protectionPage, /onRequestRemove=\{\(ip\) => requestVisitorRemoval\(ip, false\)\}/);
  assert.match(protectionPage, /onRequestRemove=\{\(ip\) => requestVisitorRemoval\(ip, true\)\}/);
  assert.doesNotMatch(
    protectionPage.slice(protectionPage.indexOf("function IpList")),
    /BotShieldConfirmationModal/,
  );
});

test("Protection module managers use native modal sizing and actions", () => {
  assert.match(adminSource, /function getProtectionModalSize/);
  assert.match(adminSource, /return "large-100"/);
  assert.match(protectionPage, /openPolicyFromNetwork/);
  assert.match(protectionPage, /Review protection policy/);
  assert.match(protectionPage, /Connect storefront/);
  assert.match(designSource, /export function BotShieldNativeModal/);
  assert.match(designSource, /<s-modal/);
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
    "Sensitive storefront paths",
    "Risk threshold",
    "Verified activity · Last 30 days",
  ]) assert.match(adminSource, new RegExp(copy.replace("/", "\\/")));
  assert.match(adminSource, /draft\.strictMode\s*\? 35/);
  assert.match(adminSource, /draft\.blockLevel === "Low"\s*\? 90/);
  assert.match(adminSource, /draft\.blockLevel === "High"\s*\? 50/);
  assert.match(adminSource, /: 70;/);
  assert.doesNotMatch(protectionPage, /money saved|estimated savings|country blocker|verified bot/iu);
});

test("Rate signals expose real persisted controls with clear explanations", () => {
  assert.match(adminSource, /Choose which behavioral signals contribute/);
  assert.match(adminSource, /3 recent requests from the same IP within one hour/);
  assert.match(adminSource, /6 recent requests from the same IP within one hour/);
  assert.match(adminSource, /12 recent requests from the same IP within one hour/);
  for (const setting of [
    "repeatedActivityEnabled",
    "elevatedRateEnabled",
    "burstTrafficEnabled",
    "repeatOffenderEnabled",
    "pathScanningEnabled",
  ]) {
    assert.match(adminSource, new RegExp(`checked=\\{draft\\.${setting}\\}`));
  }
  assert.match(adminSource, /Changes apply after you save/);
  for (const setting of [
    "repeatedActivityEnabled",
    "elevatedRateEnabled",
    "burstTrafficEnabled",
    "repeatOffenderEnabled",
    "pathScanningEnabled",
  ]) {
    assert.match(detectionSource, new RegExp(`settings\\.${setting}`));
    assert.match(controlSource, new RegExp(setting));
  }
});

test("Visitor access supports real-data search and removal confirmation", () => {
  assert.match(adminSource, /Search \$\{trusted \? "trusted visitors" : "blocked visitors"\}/);
  assert.match(adminSource, /placeholder="IP address, source, or reason"/);
  assert.match(adminSource, /record\.reason/);
  assert.match(adminSource, /record\.source/);
  assert.match(adminSource, /record\.time/);
  assert.match(adminSource, /function VisitorAccessRecord/);
  assert.match(adminSource, /botshield-visitor-access-record/);
  assert.match(adminSource, /botshield-visitor-access-record-detail/);
  assert.match(adminSource, /botshield-visitor-access-record-meta/);
  assert.doesNotMatch(
    adminSource.slice(adminSource.indexOf("function IpList"), adminSource.indexOf("function getSimulationCount")),
    /StatusRow/,
  );
  assert.match(adminSource, /No matching visitors/);
  assert.match(adminSource, /Changes to the \{listLabel\} are saved immediately/);
});

test("Protection modal content styles remain scoped without drawer shell CSS", () => {
  assert.match(designSource, /\/\* Protection control center \*\//);
  assert.match(designSource, /\.botshield-native-modal-body/);
  assert.match(designSource, /\.botshield-protection-access-grid/);
  assert.match(designSource, /\.botshield-visitor-access-record-top/);
  assert.match(designSource, /@media \(max-width: 640px\)/);
  assert.doesNotMatch(designSource, /\.botshield-protection-modal-backdrop/);
  assert.doesNotMatch(designSource, /\.botshield-protection-drawer-footer/);
});

test("Overview Configure deep links still open Protection module managers", () => {
  assert.match(protectionPage, /bot: openBotProtectionModule/);
  assert.match(protectionPage, /network: openNetworkProtectionModule/);
  assert.match(protectionPage, /rate: openRateProtectionModule/);
  assert.match(protectionPage, /page: openPageProtectionModule/);
  assert.match(protectionPage, /actions\.clearProtectionEntryIntent\?\.\(\)/);
  assert.match(protectionPage, /if \(guardProfileDraft\(\)\) return undefined;/);
  assert.match(protectionPage, /BOTSHIELD_PROTECTION_MODAL_ID/);
});
