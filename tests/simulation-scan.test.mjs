import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildSimulationResultFields,
  buildSimulationResultPresentation,
  formatReasonCodeChip,
  formatSimulationRecordedAt,
  getSimulationResultSummary,
} from "../app/lib/simulation-result.js";

const sampleResult = {
  id: 42,
  ipAddress: "198.51.100.10",
  threatLevel: "high",
  actionTaken: "allowed",
  pathVisited: "/account/login",
  riskScore: 85,
  reasons: ["Automated client detected"],
  reasonCodes: ["KNOWN_BOT_USER_AGENT", "SUSPICIOUS_USER_AGENT", "SENSITIVE_PATH"],
  summary: "High-risk simulation request",
  source: "dashboard-simulation",
  createdAt: "2026-09-02T01:52:53.911Z",
  simulation: true,
  enforcementApplied: false,
};

test("simulation presentation formats merchant-readable primary details", () => {
  const presentation = buildSimulationResultPresentation(sampleResult);

  assert.equal(presentation.summary, "Simulation allowed · High threat");
  assert.equal(
    presentation.primary.find((item) => item.id === "decision")?.value,
    "Allowed",
  );
  assert.equal(
    presentation.primary.find((item) => item.id === "threat_level")?.value,
    "High",
  );
  assert.equal(
    presentation.primary.find((item) => item.id === "risk_score")?.value,
    "85 / 100",
  );
  assert.equal(
    presentation.primary.find((item) => item.id === "path")?.value,
    "/account/login",
  );
});

test("simulation reason codes render as readable chips without changing backend values", () => {
  assert.equal(formatReasonCodeChip("KNOWN_BOT_USER_AGENT"), "Known bot user agent");
  assert.equal(formatReasonCodeChip("SENSITIVE_PATH"), "Sensitive path");

  const presentation = buildSimulationResultPresentation(sampleResult);
  assert.deepEqual(
    presentation.signals.chips.map((chip) => chip.label),
    ["Known bot user agent", "Suspicious user agent", "Sensitive path"],
  );
  assert.equal(presentation.signals.chips[0].code, "KNOWN_BOT_USER_AGENT");
});

test("simulation recorded time uses friendly local formatting", () => {
  const label = formatSimulationRecordedAt(sampleResult.createdAt);
  assert.match(label, /2026/);
  assert.doesNotMatch(label, /T01:52:53/);
});

test("simulation isolation footer confirms live enforcement and metrics are untouched", () => {
  const presentation = buildSimulationResultPresentation(sampleResult);
  assert.equal(presentation.isolation.enforcement, "Not changed");
  assert.equal(presentation.isolation.metrics, "Excluded");
  assert.match(
    presentation.isolation.message,
    /does not affect storefront enforcement, alerts, or live metrics/,
  );
});

test("simulation result fields remain derived from real backend response values", () => {
  const fields = buildSimulationResultFields(sampleResult);
  assert.equal(fields.find((field) => field.id === "decision")?.value, "Allowed");
  assert.equal(fields.find((field) => field.id === "threat_level")?.value, "High");
  assert.equal(fields.find((field) => field.id === "risk_score")?.value, "85 / 100");
  assert.equal(
    fields.find((field) => field.id === "source")?.value,
    "dashboard-simulation",
  );
});

test("simulation results are clearly labeled as test activity", () => {
  assert.equal(getSimulationResultSummary(sampleResult), "Simulation allowed · High threat");
  assert.equal(
    buildSimulationResultFields(sampleResult).find((field) => field.id === "activity_type")
      ?.value,
    "Simulation test",
  );
});

test("simulation scan UI renders polished inline results panel", async () => {
  const adminSource = await readFile(
    new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
    "utf8",
  );
  const designSource = await readFile(
    new URL("../app/components/design-system/BotShieldDesignSystem.jsx", import.meta.url),
    "utf8",
  );
  const diagnosticsSection = adminSource.slice(
    adminSource.indexOf('if (activeSection === "diagnostics")'),
    adminSource.indexOf('title="Refresh application data"'),
  );

  assert.match(diagnosticsSection, /SettingsHubSimulationResults/);
  assert.match(adminSource, /buildSimulationResultPresentation/);
  assert.match(adminSource, /botshield-settings-hub-simulation-results/);
  assert.match(adminSource, /Detection signals/);
  assert.match(adminSource, /Test details/);
  assert.match(designSource, /botshield-settings-hub-simulation-primary/);
  assert.match(designSource, /botshield-settings-hub-simulation-isolation/);
});

test("simulation backend stores dashboard-simulation bot events and excludes live reporting", async () => {
  const scanRoute = await readFile(
    new URL("../app/routes/api.scan.jsx", import.meta.url),
    "utf8",
  );
  const clearLib = await readFile(
    new URL("../app/lib/clear-test-data.server.js", import.meta.url),
    "utf8",
  );
  const enforcementSource = await readFile(
    new URL("../app/lib/storefront-enforcement.server.js", import.meta.url),
    "utf8",
  );

  assert.match(scanRoute, /dashboard-simulation/);
  assert.match(scanRoute, /botEvent\.create/);
  assert.match(scanRoute, /enforcementApplied: false/);
  assert.match(scanRoute, /source,/);
  assert.doesNotMatch(scanRoute, /lastStorefrontDecisionAt/);
  assert.doesNotMatch(enforcementSource, /dashboard-simulation/);
  assert.match(clearLib, /source: \{ not: "storefront-proxy" \}/);
});

test("simulation count in Data & privacy uses simulated scan records", async () => {
  const adminSource = await readFile(
    new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
    "utf8",
  );
  const appIndexSource = await readFile(
    new URL("../app/routes/app._index.jsx", import.meta.url),
    "utf8",
  );

  assert.match(adminSource, /getSimulationCount\(model\)/);
  assert.match(adminSource, /model\.simulatedScans/);
  assert.match(appIndexSource, /simulated: simulatedScans/);
  assert.match(appIndexSource, /simulatedScans,/);
});
