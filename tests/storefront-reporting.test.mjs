import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStorefrontReportingCheck,
  DIAGNOSTIC_CHECK_STATUS,
} from "../app/lib/diagnostic-checks.server.js";
import {
  getLastStorefrontReportingAt,
  getStorefrontReportingFreshness,
  isStorefrontReportingActive,
  STOREFRONT_REPORTING_FRESH_MS,
} from "../app/lib/storefront-reporting.server.js";

const NOW = Date.parse("2026-09-02T01:00:00.000Z");
const RECENT = "2026-09-02T00:50:00.000Z";
const STALE = "2026-09-01T12:00:00.000Z";

test("recent live storefront reporting passes using the latest decision timestamp", () => {
  assert.equal(
    isStorefrontReportingActive(null, RECENT, NOW),
    true,
  );
  assert.equal(
    getStorefrontReportingFreshness(null, RECENT, NOW).active,
    true,
  );

  const check = buildStorefrontReportingCheck({
    storefrontReportingActive: true,
    lastStorefrontDecisionAt: RECENT,
  });
  assert.equal(check.status, DIAGNOSTIC_CHECK_STATUS.PASSED);
  assert.match(check.detail, /live storefront activity within the last 15 minutes/);
});

test("stale storefront reporting stays needs attention", () => {
  assert.equal(
    isStorefrontReportingActive(null, STALE, NOW),
    false,
  );

  const check = buildStorefrontReportingCheck({
    storefrontReportingActive: false,
    lastStorefrontDecisionAt: STALE,
  });
  assert.equal(check.status, DIAGNOSTIC_CHECK_STATUS.NEEDS_ATTENTION);
  assert.match(check.detail, /nothing new has been reported in the last 15 minutes/);
});

test("missing storefront activity stays needs attention", () => {
  const check = buildStorefrontReportingCheck({
    storefrontReportingActive: false,
    lastStorefrontDecisionAt: null,
  });
  assert.equal(check.status, DIAGNOSTIC_CHECK_STATUS.NEEDS_ATTENTION);
  assert.match(check.detail, /No live storefront activity has been recorded yet/);
});

test("reporting freshness uses the newest available storefront timestamp", () => {
  assert.equal(
    getLastStorefrontReportingAt(STALE, RECENT),
    RECENT,
  );
  assert.equal(
    isStorefrontReportingActive(STALE, RECENT, NOW),
    true,
  );
});

test("simulation scan wiring cannot update live storefront reporting timestamps", async () => {
  const { readFile } = await import("node:fs/promises");
  const scanRoute = await readFile(
    new URL("../app/routes/api.scan.jsx", import.meta.url),
    "utf8",
  );
  const enforcementSource = await readFile(
    new URL("../app/lib/storefront-enforcement.server.js", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(scanRoute, /lastStorefrontDecisionAt/);
  assert.doesNotMatch(scanRoute, /lastStorefrontHeartbeatAt/);
  assert.match(enforcementSource, /lastStorefrontDecisionAt/);
  assert.match(enforcementSource, /lastStorefrontHeartbeatAt/);
  assert.match(enforcementSource, /storefront-proxy/);
});

test("storefront reporting freshness threshold is 15 minutes", () => {
  assert.equal(STOREFRONT_REPORTING_FRESH_MS, 15 * 60 * 1000);
});
