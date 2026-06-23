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
    new URL("../app/components/BotShieldPolarisExperience.jsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /14\.99/);
  assert.match(source, /trialDays \|\| 7/);
  assert.doesNotMatch(source, /\$30|30\/month|BotShield Pro/);
});

test("Polaris dashboard presents a merchant-facing security center", async () => {
  const source = await readFile(
    new URL("../app/components/BotShieldPolarisExperience.jsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /BotShield Security Center/);
  assert.match(source, /Theme App Embed Required/);
  assert.match(source, /Your storefront is protected/);
  assert.match(source, /Security outcomes/);
  assert.match(source, /Store protection overview/);
  assert.match(source, /Store setup progress/);
  assert.match(source, /Recent security activity/);
  assert.match(source, /PremiumDashboardPage/);
  assert.match(source, /Reason", "Source"/);
  assert.doesNotMatch(source, /world map/i);
});

test("merchant-facing reason labels replace raw detection codes", async () => {
  const source = await readFile(
    new URL("../app/components/BotShieldPolarisExperience.jsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /Elevated request volume detected/);
  assert.match(source, /Known hosting provider traffic/);
  assert.match(source, /Automated browser behavior detected/);
});

test("Setup experience uses verified checklist rows with contextual actions", async () => {
  const source = await readFile(
    new URL("../app/components/BotShieldPolarisExperience.jsx", import.meta.url),
    "utf8",
  );
  const designSystem = await readFile(
    new URL(
      "../app/components/design-system/BotShieldDesignSystem.jsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(source, /Launch readiness/);
  assert.match(source, /BotShieldChecklistItem/);
  assert.match(source, /Enable theme embed/);
  assert.match(designSystem, /Action needed/);
});
