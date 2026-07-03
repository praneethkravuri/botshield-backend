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
  assert.match(source, /trialDays \|\| 7/);
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

  assert.match(source, /title="Dashboard"/);
  assert.match(source, /Monitor storefront protection, setup readiness/);
  assert.match(source, /Protection Status/);
  assert.match(source, /Quick Actions/);
  assert.match(source, /Protected/);
  assert.match(source, /Monitoring/);
  assert.match(source, /Setup Required/);
  assert.match(source, /Paused/);
  assert.match(source, /Storefront activity/);
  assert.match(source, /Visitors evaluated/);
  assert.match(source, /Challenged visitors/);
  assert.match(source, /Blocked visitors/);
  assert.match(source, /Needs review/);
  assert.match(source, /Store Health/);
  assert.match(source, /Setup Progress/);
  assert.match(source, /Response mode/);
  assert.match(source, /Recent security activity/);
  assert.match(source, /Support Channels/);
  assert.match(source, /title="Visitor Activity"/);
  assert.match(source, /Review queue/);
  assert.match(source, /Next best action/);
  assert.match(source, /Filter activity/);
  assert.match(source, /Visitor decisions/);
  assert.match(source, /title="Blocklist"/);
  assert.match(source, /title="Trusted Visitors"/);
  assert.match(source, /Manual blocking/);
  assert.match(source, /When to block/);
  assert.match(source, /Trusted access/);
  assert.match(source, /False-positive recovery/);
  assert.match(source, /Blocked visitors/);
  assert.match(source, /High-risk visitors/);
  assert.match(source, /title="Protection Rules"/);
  assert.match(source, /Current protection policy/);
  assert.match(source, /Recommended next step/);
  assert.match(source, /Protection mode/);
  assert.match(source, /Active protections/);
  assert.match(source, /VPN, proxy, and datacenter traffic/);
  assert.match(source, /title="Alerts & Reports"/);
  assert.match(source, /Alert delivery/);
  assert.match(source, /Delivery proof/);
  assert.match(source, /Notification settings/);
  assert.match(source, /Current plan/);
  assert.match(source, /Subscription details/);
  assert.match(source, /What happens next/);
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
  assert.match(source, /botshield-route-shell/);
  assert.match(source, /botshield-route-transition/);
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
  assert.match(source, /botshield-route-transition/);
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

test("Setup experience uses verified checklist rows with contextual actions", async () => {
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

  assert.match(source, /Setup & Help/);
  assert.match(source, /Finish setup/);
  assert.match(source, /Launch readiness/);
  assert.match(source, /Verify protection in 4 steps/);
  assert.match(source, /How BotShield works/);
  assert.doesNotMatch(source, /Reviewer and merchant guidance/);
  assert.doesNotMatch(source, /before submitting/i);
  assert.doesNotMatch(source, /before recording/i);
  assert.match(source, /getUiReadinessItems/);
  assert.match(source, /Storefront traffic has been received/);
  assert.match(source, /Open theme editor/);
  assert.match(source, /View visitor activity/);
  assert.match(designSystem, /Action needed/);
});

test("new app shell removes custom branding and uses task-based navigation", async () => {
  const source = await readFile(
    new URL("../app/routes/app.jsx", import.meta.url),
    "utf8",
  );

  assert.match(source, />Overview</);
  assert.match(source, />Protection Rules</);
  assert.match(source, />Visitors</);
  assert.match(source, />Blocklist</);
  assert.match(source, />Trusted Visitors</);
  assert.match(source, />Alerts & Reports</);
  assert.match(source, />Billing</);
  assert.match(source, />Settings</);
  assert.match(source, />Setup & Help</);
  assert.match(source, /href="\/app"/);
  assert.match(source, /href="\/app\/protection-rules"/);
  assert.match(source, /href="\/app\/visitors"/);
  assert.match(source, /href="\/app\/blocklist"/);
  assert.match(source, /href="\/app\/trusted-visitors"/);
  assert.doesNotMatch(source, /href="\/app\?view=/);
  assert.doesNotMatch(source, /botshield-logo|Fraud &amp; Bot Detector/);
});

test("dashboard routes use real paths with legacy query compatibility", async () => {
  const source = await readFile(
    new URL("../app/routes/app._index.jsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /dashboard: "dashboard"/);
  assert.match(source, /rules: "security"/);
  assert.match(source, /"protection-rules": "security"/);
  assert.match(source, /visitors: "incidents"/);
  assert.match(source, /blocklist: "blocklist"/);
  assert.match(source, /trusted: "trusted"/);
  assert.match(source, /"trusted-visitors": "trusted"/);
  assert.match(source, /settings: "detection-settings"/);
  assert.match(source, /activity: "incidents"/);
  assert.match(source, /incidents: "incidents"/);
  assert.match(source, /"\/app\/protection-rules": "security"/);
  assert.match(source, /"\/app\/visitors": "incidents"/);
  assert.match(source, /"\/app\/blocklist": "blocklist"/);
  assert.match(source, /"\/app\/trusted-visitors": "trusted"/);
  assert.match(source, /legacyViewPathMap/);
  assert.match(source, /useLocation/);
  assert.match(source, /\[location\.pathname, location\.search, navigate\]/);
  assert.match(source, /setPage\("dashboard"\)/);
  assert.match(source, /navigate\(legacyViewPathMap\[requestedView\], \{ replace: true \}\)/);
  assert.match(source, /navigate\(path, \{ replace: false \}\)/);
  assert.doesNotMatch(source, /navigate\(`\/app\?view=/);
  assert.doesNotMatch(source, /setPage\(parsed\.page/);
});
