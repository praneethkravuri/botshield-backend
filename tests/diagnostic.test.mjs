import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildBillingCheck,
  buildDetectionEngineCheck,
  buildEmailAlertsCheck,
  buildProtectionActiveCheck,
  buildStorefrontReportingCheck,
  deriveDiagnosticOverallStatus,
  DIAGNOSTIC_CHECK_STATUS,
  getDiagnosticToastMessage,
} from "../app/lib/diagnostic-checks.server.js";

test("diagnostic overall status stays truthful across pass, attention, and unavailable mixes", () => {
  const allPassed = deriveDiagnosticOverallStatus([
    { status: DIAGNOSTIC_CHECK_STATUS.PASSED },
    { status: DIAGNOSTIC_CHECK_STATUS.PASSED },
  ]);
  assert.equal(allPassed.ok, true);
  assert.equal(allPassed.overallStatus, DIAGNOSTIC_CHECK_STATUS.PASSED);
  assert.equal(allPassed.overallLabel, "All checks passed");

  const needsAttention = deriveDiagnosticOverallStatus([
    { status: DIAGNOSTIC_CHECK_STATUS.PASSED },
    { status: DIAGNOSTIC_CHECK_STATUS.NEEDS_ATTENTION },
  ]);
  assert.equal(needsAttention.ok, false);
  assert.equal(needsAttention.overallStatus, DIAGNOSTIC_CHECK_STATUS.NEEDS_ATTENTION);

  const unavailable = deriveDiagnosticOverallStatus([
    { status: DIAGNOSTIC_CHECK_STATUS.PASSED },
    { status: DIAGNOSTIC_CHECK_STATUS.UNAVAILABLE },
  ]);
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.overallStatus, DIAGNOSTIC_CHECK_STATUS.UNAVAILABLE);
});

test("failed individual diagnostic checks are not presented as passed", () => {
  const paused = buildProtectionActiveCheck({
    protectionPaused: true,
    protectionActive: false,
  });
  assert.equal(paused.status, DIAGNOSTIC_CHECK_STATUS.NEEDS_ATTENTION);

  const inactiveBilling = buildBillingCheck(
    { enforcementEnabled: true },
    { active: false, error: "No active subscription" },
  );
  assert.equal(inactiveBilling.status, DIAGNOSTIC_CHECK_STATUS.NEEDS_ATTENTION);

  const brokenEngine = buildDetectionEngineCheck(null);
  assert.equal(brokenEngine.status, DIAGNOSTIC_CHECK_STATUS.UNAVAILABLE);
});

test("storefront reporting check distinguishes live, stale, and missing activity", () => {
  const live = buildStorefrontReportingCheck({ storefrontReportingActive: true });
  assert.equal(live.status, DIAGNOSTIC_CHECK_STATUS.PASSED);
  assert.match(live.detail, /live storefront activity within the last 15 minutes/);

  const stale = buildStorefrontReportingCheck({
    storefrontReportingActive: false,
    lastStorefrontDecisionAt: "2026-09-01T12:00:00.000Z",
  });
  assert.equal(stale.status, DIAGNOSTIC_CHECK_STATUS.NEEDS_ATTENTION);
  assert.match(stale.detail, /nothing new has been reported in the last 15 minutes/);

  const missing = buildStorefrontReportingCheck({
    storefrontReportingActive: false,
    lastStorefrontDecisionAt: null,
  });
  assert.equal(missing.status, DIAGNOSTIC_CHECK_STATUS.NEEDS_ATTENTION);
  assert.match(missing.detail, /No live storefront activity has been recorded yet/);
});

test("email alert readiness reflects real merchant settings", () => {
  const disabled = buildEmailAlertsCheck(
    { emailAlerts: false, alertEmail: "" },
    { configured: false },
  );
  assert.equal(disabled.status, DIAGNOSTIC_CHECK_STATUS.PASSED);

  const enabledMissingEmail = buildEmailAlertsCheck(
    { emailAlerts: true, alertEmail: "not-an-email" },
    { configured: true },
  );
  assert.equal(enabledMissingEmail.status, DIAGNOSTIC_CHECK_STATUS.NEEDS_ATTENTION);

  const enabledReady = buildEmailAlertsCheck(
    { emailAlerts: true, alertEmail: "merchant@example.com" },
    { configured: true },
  );
  assert.equal(enabledReady.status, DIAGNOSTIC_CHECK_STATUS.PASSED);
});

test("diagnostic toast messaging reflects actual overall status", () => {
  assert.equal(
    getDiagnosticToastMessage({
      overallStatus: DIAGNOSTIC_CHECK_STATUS.PASSED,
      overallLabel: "All checks passed",
    }),
    "All diagnostic checks passed",
  );
  assert.equal(
    getDiagnosticToastMessage({
      overallStatus: DIAGNOSTIC_CHECK_STATUS.NEEDS_ATTENTION,
      overallLabel: "Some checks need attention",
    }),
    "Some checks need attention",
  );
  assert.equal(
    getDiagnosticToastMessage({
      overallStatus: DIAGNOSTIC_CHECK_STATUS.UNAVAILABLE,
      overallLabel: "Some checks could not be completed",
    }),
    "Some checks could not be completed",
  );
});

test("diagnostic scan uses dedicated health endpoint without creating scan events", async () => {
  const appIndexSource = await readFile(
    new URL("../app/routes/app._index.jsx", import.meta.url),
    "utf8",
  );
  const diagnosticRouteSource = await readFile(
    new URL("../app/routes/api.diagnostic.jsx", import.meta.url),
    "utf8",
  );
  const adminSource = await readFile(
    new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
    "utf8",
  );
  const designSource = await readFile(
    new URL("../app/components/design-system/BotShieldDesignSystem.jsx", import.meta.url),
    "utf8",
  );

  const runDiagnosticBlock = appIndexSource.slice(
    appIndexSource.indexOf("runDiagnostic:"),
    appIndexSource.indexOf("runSimulation:"),
  );
  assert.match(runDiagnosticBlock, /\/api\/diagnostic/);
  assert.doesNotMatch(runDiagnosticBlock, /\/api\/scan/);
  assert.doesNotMatch(diagnosticRouteSource, /botEvent\.create/);
  assert.doesNotMatch(diagnosticRouteSource, /dashboard-diagnostic/);
  assert.doesNotMatch(diagnosticRouteSource, /dashboard-simulation/);

  const diagnosticsSection = adminSource.slice(
    adminSource.indexOf('if (activeSection === "diagnostics")'),
    adminSource.indexOf('title="Refresh application data"'),
  );
  assert.match(diagnosticsSection, /SettingsHubDiagnosticResults/);
  assert.match(diagnosticsSection, /diagnosticResults/);
  assert.match(diagnosticsSection, /BotShieldAsyncButton[\s\S]*Run diagnostic scan/);
  assert.match(designSource, /loading={asyncAction\.loading}/);
  assert.doesNotMatch(diagnosticsSection, /successMessage="Diagnostic completed"/);
  assert.match(diagnosticsSection, /diagnosticRequestError/);
  assert.match(diagnosticsSection, /All diagnostic checks passed/);
});

test("simulation scan remains separate from diagnostic scan wiring", async () => {
  const appIndexSource = await readFile(
    new URL("../app/routes/app._index.jsx", import.meta.url),
    "utf8",
  );
  const runSimulationBlock = appIndexSource.slice(
    appIndexSource.indexOf("runSimulation:"),
    appIndexSource.indexOf("recoverIncident:"),
  );
  assert.match(runSimulationBlock, /\/api\/scan/);
  assert.match(runSimulationBlock, /dashboard-simulation/);
});
