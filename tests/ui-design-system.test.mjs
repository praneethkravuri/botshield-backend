/* global globalThis */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { safeFetchJson } from "../app/lib/safe-fetch.js";
import {
  getBillingStatusModel,
  getEmailStatus,
  getEventSourceStatus,
  getUiStatus,
} from "../app/lib/ui-status.js";

test("merchant status mapping hides raw backend status labels", () => {
  const email = getUiStatus("provider_not_configured");
  const theme = getUiStatus("theme_embed_missing");
  const billing = getUiStatus("verification_failed");

  assert.equal(email.label, "Email provider not configured");
  assert.equal(email.tone, "warning");
  assert.equal(theme.label, "Theme embed not connected");
  assert.equal(billing.label, "Billing could not be verified");
});

test("event source mapping clearly separates real traffic and simulations", () => {
  assert.equal(
    getEventSourceStatus("storefront-proxy").label,
    "Real storefront",
  );
  assert.equal(
    getEventSourceStatus("dashboard-simulation").label,
    "Simulation",
  );
  assert.equal(
    getEventSourceStatus("dashboard-diagnostic").label,
    "Diagnostic",
  );
});

test("email and billing UI models reflect verified backend state", () => {
  assert.equal(
    getEmailStatus({ configured: false, lastStatus: null }).label,
    "Email provider not configured",
  );
  assert.equal(
    getEmailStatus({ configured: true, lastStatus: "sent" }).label,
    "Sent",
  );
  assert.equal(
    getBillingStatusModel({
      configured: true,
      active: true,
      subscription: { name: "BotShield Basic" },
    }).label,
    "Active",
  );
  assert.equal(
    getBillingStatusModel({
      configured: true,
      active: false,
      error: "Unable to verify Shopify subscription.",
    }).label,
    "Billing could not be verified",
  );
  assert.equal(
    getBillingStatusModel({
      configured: true,
      active: true,
      subscription: { name: "Reviewer", test: true },
    }).label,
    "Test plan",
  );
});

test("safeFetchJson returns readable provider errors", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ delivery: { error: "Domain not verified" } }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      },
    );

  try {
    await assert.rejects(
      () => safeFetchJson("/api/alerts/test", { method: "POST" }),
      /Domain not verified/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Polaris experience uses current BotShield Basic pricing", async () => {
  const source = await readFile(
    new URL(
      "../app/components/admin/BotShieldAdminExperience.jsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(source, /14\.99/);
  assert.match(source, /billingStatus\.trialDays\)[\s\S]*?: 7/);
  assert.doesNotMatch(source, /\$30|30\/month|BotShield Pro\b/);
});

test("Polaris dashboard presents a merchant-facing security center", async () => {
  const source = await readFile(
    new URL(
      "../app/components/admin/BotShieldAdminExperience.jsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(source, /heading="Overview"/);
  assert.match(source, /Monitor storefront protection, security activity/);
  assert.match(source, /Protected/);
  assert.match(source, /Monitoring/);
  assert.match(source, /Setup Required/);
  assert.match(source, /Paused/);
  assert.match(source, /Challenged visitors/);
  assert.match(source, /Blocked visitors/);
  assert.match(source, /Needs review/);
  assert.match(source, /Store health/);
  assert.match(source, /Response mode/);
  assert.match(source, /Recent security activity/);
  assert.match(source, /View activity/);
  assert.match(source, /actions\.setPage\("analytics"\)/);
  assert.match(source, /heading="Analytics"/);
  assert.match(source, /Event explorer/);
  assert.match(source, /heading="Fraud Orders"/);
  assert.match(source, /Review queue/);
  assert.match(source, /heading="Protection"/);
  assert.match(source, /Changes to the \{listLabel\}/);
  assert.match(source, /title="Protection Rules"/);
  assert.match(source, /Current protection policy/);
  assert.match(source, /Recommended next step/);
  assert.match(source, /Protection mode/);
  assert.match(source, /Automated response is active/);
  assert.match(source, /Active protections/);
  assert.match(source, /Bot detection/);
  assert.match(source, /Network intelligence/);
  assert.match(source, /Storefront signals BotShield uses today/);
  assert.match(source, /type: "blocklist"/);
  assert.match(source, /await actions\.addBlockedIp\(blockedIpInput\)/);
  assert.match(source, /type: "trusted"/);
  assert.match(source, /await actions\.addTrustedIp\(trustedIpInput\)/);
  assert.match(source, /type: "profile"/);
  assert.match(source, /actions\.saveSettings\(draft\)/);
  assert.match(source, /filterFraudOrders/);
  assert.match(source, /Fraud Orders setup/);
  assert.match(source, /No risky orders are currently pending fulfillment/);
  assert.match(source, /Manage protection preferences/);
  assert.match(source, /botshield-overview-v2 botshield-settings-hub-content/);
  assert.match(source, /botshield-v2-health-dot/);
  assert.match(source, /formatSimulationLabel/);
  assert.match(source, /botshield-settings-hub/);
  assert.match(source, /SETTINGS_HUB_SECTIONS/);
  assert.match(source, /Plans & billing/);
  assert.match(source, /Subscription plans/);
  assert.match(source, /getSettingsBillingView/);
  assert.match(source, /getSettingsBillingPlans/);
  assert.match(source, /Send test email/);
  assert.match(source, /Weekly security report/);
  assert.doesNotMatch(source, /Notification center/);
  assert.doesNotMatch(source, /Recent email activity/);
  assert.doesNotMatch(source, /Security alerts are ready/);
  assert.doesNotMatch(source, /title="Alerts & Reports"/);
  assert.doesNotMatch(source, /title="Visitor Activity"/);
  assert.doesNotMatch(source, /title="Blocklist"/);
  assert.doesNotMatch(source, /title="Trusted Visitors"/);
  assert.doesNotMatch(source, /Filter activity/);
  assert.doesNotMatch(source, /Visitor decisions/);
  assert.doesNotMatch(source, /Readiness checks/);
  assert.doesNotMatch(source, /Merchant setup flow/);
  assert.doesNotMatch(source, /Launch checklist/);
  assert.doesNotMatch(source, /Reviewer test plan/);
  assert.doesNotMatch(source, /Partner API credentials/);
  assert.doesNotMatch(source, /billing enforcement/i);
  assert.doesNotMatch(source, /BotShield Fraud & Bot Detector/);
  assert.doesNotMatch(source, /botshield-titlebar-brand/);
  assert.doesNotMatch(source, /world map/i);
});

test("admin design system provides elevated SaaS surfaces without branding", async () => {
  const source = await readFile(
    new URL(
      "../app/components/design-system/BotShieldDesignSystem.jsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(source, /botshield-surface--raised/);
  assert.match(source, /botshield-metric--critical/);
  assert.match(source, /botshield-mode-card/);
  assert.match(source, /botshield-support-card/);
  assert.match(source, /#0f766e/i);
  assert.match(source, /#ecfdf5/i);
  assert.match(source, /box-shadow/);
  assert.match(source, /botshield-settings-hub-layout/);
  assert.match(source, /botshield-settings-hub-nav-item/);
  assert.match(source, /botshield-route-shell/);
  assert.doesNotMatch(source, /botshield-route-transition/);
  assert.doesNotMatch(source, /botshield-route-progress/);
  assert.doesNotMatch(source, /botshield-route-loading-pill/);
  assert.doesNotMatch(source, /botshield-logo/);
});

test("admin navigation moves immediately to the top of the next page", async () => {
  const source = await readFile(
    new URL(
      "../app/components/admin/BotShieldAdminExperience.jsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(source, /window\.scrollTo\(0, 0\)/);
  assert.doesNotMatch(source, /routeBusy/);
  assert.doesNotMatch(source, /Opening \{/);
  assert.doesNotMatch(source, /botshield-route-transition/);
});

test("merchant-facing reason labels replace raw detection codes", async () => {
  const source = await readFile(
    new URL(
      "../app/components/admin/BotShieldAdminExperience.jsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(source, /Repeated visitor activity detected/);
  assert.match(source, /Known hosting provider traffic/);
  assert.match(source, /Automated browser behavior detected/);
  assert.match(source, /formatMerchantReasons/);
  assert.match(source, /asn\\s\+match\|asn\\s\+as\\d\+/);
  assert.match(source, /rate pattern\|repeated traffic\|request rate/);
});

test("Setup checklist stays on supported pages with contextual actions", async () => {
  const source = await readFile(
    new URL(
      "../app/components/admin/BotShieldAdminExperience.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const designSystem = await readFile(
    new URL(
      "../app/components/design-system/BotShieldDesignSystem.jsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.doesNotMatch(source, /Setup & Help/);
  assert.doesNotMatch(source, /Finish launch setup/);
  assert.doesNotMatch(source, /Merchant setup flow/);
  assert.doesNotMatch(source, /How BotShield works/);
  assert.doesNotMatch(source, /setPage\("setup"\)/);
  assert.match(source, /getSetupChecklistItems/);
  assert.match(source, /runNextSetupAction/);
  assert.match(source, /BotShield is enabled in the published theme/);
  assert.match(source, /Open theme editor/);
  assert.match(source, /Setup Progress/);
  assert.match(designSystem, /Action needed/);
});

test("new app shell keeps a simplified Shopify-native app navigation", async () => {
  const source = await readFile(
    new URL("../app/routes/app.jsx", import.meta.url),
    "utf8",
  );

  assert.match(source, />Analytics</);
  assert.match(source, />Protection</);
  assert.match(source, /Overview/);
  assert.match(source, />Fraud Orders</);
  assert.match(source, />Settings</);
  assert.match(source, /href="\/app"/);
  assert.match(source, /href="\/app\/analytics"/);
  assert.match(source, /href="\/app\/protection-rules"/);
  assert.match(source, /href="\/app\/fraud-orders"/);
  assert.match(source, /href="\/app\/settings"/);
  assert.match(source, /rel="home"/);
  assert.doesNotMatch(source, />Protection Rules</);
  assert.doesNotMatch(source, />Visitors</);
  assert.doesNotMatch(source, />Blocklist</);
  assert.doesNotMatch(source, />Trusted Visitors</);
  assert.doesNotMatch(source, />Alerts & Reports</);
  assert.doesNotMatch(source, />Billing</);
  assert.doesNotMatch(source, />Setup & Help</);
  assert.doesNotMatch(source, /href="\/app\/blocklist"/);
  assert.doesNotMatch(source, /href="\/app\/visitors"/);
  assert.doesNotMatch(source, /href="\/app\/trusted-visitors"/);
  assert.doesNotMatch(source, /href="\/app\/alerts-reports"/);
  assert.doesNotMatch(source, /href="\/app\/billing"/);
  assert.doesNotMatch(source, /href="\/app\/setup"/);
  assert.doesNotMatch(source, /href="\/app\?view=/);
  assert.doesNotMatch(source, /botshield-logo|Fraud &amp; Bot Detector/);
});

test("dashboard routes use real paths with legacy query compatibility", async () => {
  const source = await readFile(
    new URL("../app/routes/app._index.jsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /dashboard: "dashboard"/);
  assert.match(source, /analytics: "analytics"/);
  assert.match(source, /rules: "security"/);
  assert.match(source, /"protection-rules": "security"/);
  assert.match(source, /visitors: "analytics"/);
  assert.match(source, /"fraud-orders": "fraud-orders"/);
  assert.match(source, /blocklist: "security"/);
  assert.match(source, /trusted: "security"/);
  assert.match(source, /"trusted-visitors": "security"/);
  assert.match(source, /settings: "settings"/);
  assert.match(source, /activity: "analytics"/);
  assert.match(source, /incidents: "analytics"/);
  assert.match(source, /"\/app\/protection-rules": "security"/);
  assert.match(source, /"\/app\/analytics": "analytics"/);
  assert.match(source, /"\/app\/fraud-orders": "fraud-orders"/);
  assert.match(source, /"\/app\/settings": "settings"/);
  assert.doesNotMatch(source, /"\/app\/visitors": "incidents"/);
  assert.match(source, /retiredPageMap/);
  assert.match(source, /setup: "dashboard"/);
  assert.match(source, /legacyViewPathMap/);
  assert.match(source, /visitors: "\/app\/analytics"/);
  assert.match(source, /incidents: "\/app\/analytics"/);
  assert.match(source, /useLocation/);
  assert.match(source, /\[location\.pathname, location\.search, navigate\]/);
  assert.match(source, /setPage\("dashboard"\)/);
  assert.match(source, /navigate\(legacyViewPathMap\[requestedView\], \{ replace: true \}\)/);
  assert.match(source, /navigate\(path, \{ replace: false \}\)/);
  assert.doesNotMatch(source, /navigate\(`\/app\?view=/);
  assert.doesNotMatch(source, /setPage\(parsed\.page/);
  assert.doesNotMatch(source, /page !== "legacy"/);
});

test("root app URL opens the embedded overview instead of standalone login", async () => {
  const source = await readFile(
    new URL("../app/routes/_index/route.jsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /redirect\("\/app"\)/);
  assert.doesNotMatch(source, /redirect\("\/auth\/login"\)/);
});

test("dashboard totals use exact 30-day storefront counts", async () => {
  const apiSource = await readFile(
    new URL("../app/routes/api.incident-list.jsx", import.meta.url),
    "utf8",
  );
  const uiSource = await readFile(
    new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
    "utf8",
  );

  assert.match(apiSource, /thirtyDaysAgo/);
  assert.match(apiSource, /source: "storefront-proxy"/);
  assert.match(apiSource, /total: real/);
  assert.match(apiSource, /periodDays: 30/);
  assert.match(uiSource, /label: "Storefront events"[\s\S]*detail: "Last 30 days"/);
  assert.doesNotMatch(uiSource, /Visitor sessions in this cycle/);
});

test("clearing simulation data preserves real storefront and merchant data", async () => {
  const source = await readFile(
    new URL("../app/routes/api.clear-test-data.jsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /source: \{ not: "storefront-proxy" \}/);
  assert.doesNotMatch(source, /blockedIP\.deleteMany/);
  assert.doesNotMatch(source, /whitelistIP\.deleteMany/);
  assert.doesNotMatch(source, /appSetting\.deleteMany/);
});

test("save bar uses App Bridge ui-save-bar with preview fallback", async () => {
  const designSource = await readFile(
    new URL(
      "../app/components/design-system/BotShieldDesignSystem.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const hookSource = await readFile(
    new URL("../app/hooks/use-botshield-save-bar.js", import.meta.url),
    "utf8",
  );
  const adminSource = await readFile(
    new URL(
      "../app/components/admin/BotShieldAdminExperience.jsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(designSource, /<ui-save-bar id=\{id\} data-discard-confirmation>/);
  assert.match(designSource, /BotShieldSaveBarBridge/);
  assert.match(designSource, /BotShieldLoadingBridge/);
  assert.match(hookSource, /setSaveBarVisible/);
  assert.match(hookSource, /saveBar\?\.show/);
  assert.match(hookSource, /typeof loading === "function"/);
  assert.match(hookSource, /loading\.start/);
  assert.match(hookSource, /isAppBridgeEnvironment/);
  assert.match(adminSource, /id="botshield-settings-save-bar"/);
  assert.match(adminSource, /id="botshield-protection-save-bar"/);
});

test("destructive settings actions use App Bridge confirmation modal", async () => {
  const adminSource = await readFile(
    new URL(
      "../app/components/admin/BotShieldAdminExperience.jsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(adminSource, /botshield-clear-simulation-modal/);
  assert.match(adminSource, /BotShieldConfirmationModal/);
  assert.match(adminSource, /botshield-protection-discard-modal/);
  assert.match(adminSource, /botshield-blocklist-remove-modal/);
  assert.match(adminSource, /botshield-trusted-remove-modal/);
  assert.doesNotMatch(adminSource, /window\.confirm\(/);
});

test("supported pages use Shopify native page chrome", async () => {
  const designSource = await readFile(
    new URL(
      "../app/components/design-system/BotShieldDesignSystem.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const adminSource = await readFile(
    new URL(
      "../app/components/admin/BotShieldAdminExperience.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const hookSource = await readFile(
    new URL("../app/hooks/use-botshield-save-bar.js", import.meta.url),
    "utf8",
  );

  assert.match(designSource, /export function BotShieldNativePage/);
  assert.match(designSource, /<s-page heading=\{heading\}>/);
  assert.doesNotMatch(adminSource, /BotShieldPageLoadingBridge active=\{Boolean\(model\.syncing\)\}/);
  assert.match(hookSource, /export function BotShieldPageLoadingBridge/);
  assert.match(hookSource, /return null;/);
  for (const heading of [
    'heading="Overview"',
    'heading="Analytics"',
    'heading="Fraud Orders"',
    'heading="Protection"',
    'heading="Settings"',
  ]) {
    assert.match(adminSource, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("supported pages share one stable outer page shell geometry", async () => {
  const designSource = await readFile(
    new URL(
      "../app/components/design-system/BotShieldDesignSystem.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const adminSource = await readFile(
    new URL(
      "../app/components/admin/BotShieldAdminExperience.jsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(designSource, /export function BotShieldPageShell/);
  assert.match(designSource, /--botshield-shell-max-width: 1140px/);
  assert.match(designSource, /--botshield-shell-padding-inline: 28px/);
  assert.match(designSource, /--botshield-shell-padding-top: 34px/);
  assert.match(designSource, /max-width: var\(--botshield-shell-max-width\)/);
  assert.match(designSource, /padding-top: var\(--botshield-shell-padding-top\)/);
  assert.match(designSource, /padding-inline: var\(--botshield-shell-padding-inline\)/);
  assert.doesNotMatch(designSource, /min\(1180px, calc\(100vw - 56px\)\)/);
  assert.doesNotMatch(designSource, /min\(1140px, calc\(100vw - 56px\)\)/);

  for (const pageClass of [
    "botshield-overview-content botshield-overview-v2",
    "botshield-analytics-content botshield-analytics-v2",
    "botshield-protection-content",
    "botshield-fraud-orders-content",
    "botshield-overview-content botshield-overview-v2 botshield-settings-hub-content",
  ]) {
    assert.match(adminSource, new RegExp(`<BotShieldPageShell className="${pageClass.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  }
});

test("Overview quick response rows stack actions before text is crushed", async () => {
  const designSource = await readFile(
    new URL(
      "../app/components/design-system/BotShieldDesignSystem.jsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(designSource, /container-name: overview-quick-actions/);
  assert.match(designSource, /grid-template-areas: "icon copy action"/);
  assert.match(designSource, /@container overview-quick-actions \(max-width: 520px\)/);
  assert.match(designSource, /"icon copy"\s+"\. action"/);
  assert.doesNotMatch(designSource, /\.botshield-v2-quick-action-row span \{ max-width: 290px/);
});
