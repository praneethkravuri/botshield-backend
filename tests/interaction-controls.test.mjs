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

const overviewSource = adminSource.slice(
  adminSource.indexOf("function OverviewPage"),
  adminSource.indexOf("function AnalyticsPage"),
);
const analyticsSource = adminSource.slice(
  adminSource.indexOf("function AnalyticsPage"),
  adminSource.indexOf("function FraudOrderSetupDrawer"),
);
const fraudSource = adminSource.slice(
  adminSource.indexOf("function FraudOrderSetupDrawer"),
  adminSource.indexOf("function ProtectionPage"),
);
const protectionSource = adminSource.slice(
  adminSource.indexOf("function ProtectionPage"),
  adminSource.indexOf("function SettingsPage"),
);
const settingsSource = adminSource.slice(
  adminSource.indexOf("function SettingsPage"),
  adminSource.indexOf("export default function BotShieldAdminExperience"),
);

test("shared modal helpers avoid silent show() no-ops", () => {
  assert.match(designSource, /export function showBotShieldModal/);
  assert.match(designSource, /export function queueBotShieldModalShow/);
  assert.match(designSource, /export function hideBotShieldModal/);
  assert.match(designSource, /runBotShieldModalCommand/);
  assert.match(designSource, /if \(!modal\) return false/);
  assert.doesNotMatch(adminSource, /getElementById\([^)]+\)\?\.show/);
});

test("Overview has no drawer close controls to regress", () => {
  assert.doesNotMatch(overviewSource, /createPortal/);
  assert.doesNotMatch(overviewSource, /requestClose/);
  assert.doesNotMatch(overviewSource, /BotShieldConfirmationModal/);
});

test("Analytics event details use native modal open and close controls", () => {
  const detailsSource = adminSource.slice(
    adminSource.indexOf("function AnalyticsEventDetails"),
    adminSource.indexOf("const FRAUD_REVIEW_FILTERS"),
  );
  assert.match(detailsSource, /function AnalyticsEventDetails/);
  assert.match(analyticsSource, /onClose=\{\(\) => setSelectedEvent\(null\)\}/);
  assert.match(detailsSource, /BotShieldNativeModal/);
  assert.match(detailsSource, /BOTSHIELD_ANALYTICS_EVENT_MODAL_ID/);
  assert.match(detailsSource, /hideBotShieldModal\(BOTSHIELD_ANALYTICS_EVENT_MODAL_ID\)/);
  assert.match(detailsSource, /onAfterHide={onClose}/);
  assert.match(detailsSource, /AnalyticsEventDetailField/);
  assert.match(detailsSource, /size="base"/);
  assert.match(detailsSource, /modalPadding="none"/);
  assert.doesNotMatch(detailsSource, /botshield-analytics-detail-backdrop/);
  assert.doesNotMatch(detailsSource, /botshield-analytics-event-modal-toolbar/);
  assert.doesNotMatch(detailsSource, /botshield-analytics-detail-grid/);
});

test("Fraud Orders drawers close without unsaved draft state", () => {
  for (const source of [fraudSource.match(/function FraudOrderSetupDrawer[\s\S]*?^}/m)?.[0], fraudSource.match(/function FraudOrderReviewDrawer[\s\S]*?^}/m)?.[0]]) {
    assert.ok(source);
    assert.match(source, /onClose/);
    assert.match(source, /event\.key === "Escape"\)/);
    assert.match(source, /event\.target === event\.currentTarget\) onClose\(\)/);
  }
  assert.match(fraudSource, /<BotShieldActionButton onClick=\{onClose\}>Cancel<\/BotShieldActionButton>/);
  assert.match(fraudSource, /<BotShieldActionButton onClick=\{onClose\}>Close<\/BotShieldActionButton>/);
});

test("Protection profile cancel and close use discard confirmation only for profile drafts", () => {
  assert.match(protectionSource, /const guardProfileDraft = \(\) =>/);
  assert.match(
    protectionSource,
    /if \(dirty && protectionModal\?\.type === "profile"\)/,
  );
  assert.match(protectionSource, /pendingTransitionRef\.current = "discard"/);
  assert.match(protectionSource, /setDraft\(originalDraft\);\s*closeDrawer\(\);/s);
  assert.match(protectionSource, /setBlockedIpInput\(""\)/);
  assert.match(protectionSource, /setTrustedIpInput\(""\)/);
  assert.doesNotMatch(protectionSource, /onClick=\{\(\) => setProtectionModal\(null\)\}/);
  assert.match(protectionSource, /onClick=\{requestClose\}/);
  assert.match(protectionSource, /BotShieldNativeModal/);
  assert.doesNotMatch(protectionSource, /accessibilityLabel="Close"/);
});

test("Protection modal switches cannot silently discard profile drafts", () => {
  assert.match(protectionSource, /if \(guardProfileDraft\(\)\) return;/);
  assert.match(protectionSource, /openBlocklist = \(\) => \{/);
  assert.match(protectionSource, /openTrusted = \(\) => \{/);
  assert.match(protectionSource, /model\.protectionEntryIntent, protectionModal\?\.type\]/);
});

test("Protection visitor removal confirmations use sequenced native modals", () => {
  assert.match(protectionSource, /requestVisitorRemoval/);
  assert.match(protectionSource, /hideBotShieldModal\(BOTSHIELD_PROTECTION_MODAL_ID\)/);
  assert.match(protectionSource, /showBotShieldModal\("botshield-blocklist-remove-modal"\)/);
  assert.match(protectionSource, /showBotShieldModal\("botshield-trusted-remove-modal"\)/);
});

test("Settings destructive confirmation uses native modal command pattern", () => {
  assert.match(settingsSource, /command="--show"/);
  assert.match(settingsSource, /commandFor="botshield-clear-simulation-modal"/);
  assert.match(settingsSource, /id="botshield-clear-simulation-modal"/);
  assert.match(
    settingsSource,
    /onDiscard=\{\(\) =>\s*setDraft\(\{/,
  );
  assert.match(settingsSource, /alertEmail: model\.alertEmail/);
});
