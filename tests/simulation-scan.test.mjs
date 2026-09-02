import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildSimulationResultFields,
  getSimulationResultSummary,
} from "../app/lib/simulation-result.js";

const sampleResult = {
  id: 42,
  ipAddress: "198.51.100.10",
  threatLevel: "high",
  actionTaken: "blocked",
  pathVisited: "/account/login",
  riskScore: 87,
  reasons: ["Automated client detected"],
  reasonCodes: ["BOT_UA"],
  summary: "High-risk simulation request",
  source: "dashboard-simulation",
  createdAt: "2026-09-02T01:15:00.000Z",
  simulation: true,
  enforcementApplied: false,
};

test("simulation result fields use only real backend response values", () => {
  const fields = buildSimulationResultFields(sampleResult);
  const labels = fields.map((field) => field.label);

  assert.deepEqual(labels, [
    "Activity type",
    "Recorded",
    "Decision",
    "Threat level",
    "Risk score",
    "Test IP",
    "Path",
    "Reason codes",
    "Reasons",
    "Summary",
    "Event ID",
    "Source",
    "Live enforcement",
    "Live metrics",
  ]);
  assert.equal(fields.find((field) => field.id === "decision")?.value, "blocked");
  assert.equal(fields.find((field) => field.id === "threat_level")?.value, "high");
  assert.equal(fields.find((field) => field.id === "source")?.value, "dashboard-simulation");
});

test("simulation results are clearly labeled as test activity", () => {
  assert.equal(getSimulationResultSummary(sampleResult), "Simulation blocked · high threat");
  assert.equal(
    buildSimulationResultFields(sampleResult).find((field) => field.id === "activity_type")
      ?.value,
    "Simulation test",
  );
});

test("simulation isolation fields confirm live metrics and enforcement are untouched", () => {
  const fields = buildSimulationResultFields(sampleResult);
  assert.equal(
    fields.find((field) => field.id === "enforcement")?.value,
    "Not changed",
  );
  assert.equal(
    fields.find((field) => field.id === "metrics_isolation")?.value,
    "Excluded from storefront metrics and reports",
  );
});

test("simulation scan UI renders inline results and error state", async () => {
  const adminSource = await readFile(
    new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
    "utf8",
  );
  const diagnosticsSection = adminSource.slice(
    adminSource.indexOf('if (activeSection === "diagnostics")'),
    adminSource.indexOf('title="Refresh application data"'),
  );

  assert.match(diagnosticsSection, /SettingsHubSimulationResults/);
  assert.match(diagnosticsSection, /simulationResults/);
  assert.match(diagnosticsSection, /simulationRequestError/);
  assert.match(diagnosticsSection, /Run simulation scan/);
  assert.match(diagnosticsSection, /successMessage="Simulation recorded"/);
});

test("simulation backend stores dashboard-simulation bot events and excludes live reporting", async () => {
  const scanRoute = await readFile(
    new URL("../app/routes/api.scan.jsx", import.meta.url),
    "utf8",
  );
  const clearRoute = await readFile(
    new URL("../app/routes/api.clear-test-data.jsx", import.meta.url),
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
  assert.match(clearRoute, /source: \{ not: "storefront-proxy" \}/);
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
