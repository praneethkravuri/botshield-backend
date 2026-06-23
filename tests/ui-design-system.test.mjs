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
    new Response(JSON.stringify({ delivery: { error: "Domain not verified" } }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });

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
  assert.doesNotMatch(source, /\$30|30\/month|BotShield Pro/);
});

test("Polaris dashboard presents a merchant-facing security center", async () => {
  const source = await readFile(
    new URL(
      "../app/components/admin/BotShieldAdminExperience.jsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(source, /title="Overview"/);
  assert.match(source, /Connect your storefront/);
  assert.match(source, /Setup guide/);
  assert.match(source, /Protection status/);
  assert.match(source, /Last 7 days/);
  assert.match(source, /Top threat signals/);
  assert.match(source, /Traffic origins/);
  assert.match(source, /ProtectionSummary/);
  assert.match(source, /Recent activity/);
  assert.match(source, /title="Activity"/);
  assert.match(source, /title="Protection"/);
  assert.match(source, /title="Settings"/);
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
  assert.match(source, /box-shadow/);
  assert.doesNotMatch(source, /botshield-logo/);
});

test("merchant-facing reason labels replace raw detection codes", async () => {
  const source = await readFile(
    new URL(
      "../app/components/admin/BotShieldAdminExperience.jsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(source, /Elevated request volume/);
  assert.match(source, /Hosting provider traffic/);
  assert.match(source, /Automated browser behavior/);
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

  assert.match(source, /Setup guide/);
  assert.match(source, /Open theme editor/);
  assert.match(source, /View setup/);
  assert.match(designSystem, /Action needed/);
});

test("new app shell removes custom branding and uses task-based navigation", async () => {
  const source = await readFile(
    new URL("../app/routes/app.jsx", import.meta.url),
    "utf8",
  );

  assert.match(source, />Overview</);
  assert.match(source, />Activity</);
  assert.match(source, />Protection</);
  assert.match(source, />Settings</);
  assert.match(source, />Setup</);
  assert.doesNotMatch(source, /botshield-logo|Fraud &amp; Bot Detector/);
});
