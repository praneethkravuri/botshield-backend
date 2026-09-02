import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const adminSource = await readFile(
  new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
  "utf8",
);
const appIndexSource = await readFile(
  new URL("../app/routes/app._index.jsx", import.meta.url),
  "utf8",
);
const designSource = await readFile(
  new URL("../app/components/design-system/BotShieldDesignSystem.jsx", import.meta.url),
  "utf8",
);
const merchantErrorSource = await readFile(
  new URL("../app/lib/merchant-error-message.js", import.meta.url),
  "utf8",
);

const settingsSource = adminSource.slice(
  adminSource.indexOf("function SettingsPage"),
  adminSource.indexOf("export default function BotShieldAdminExperience"),
);

const approvedMerchantPaths = [
  "/app",
  "/app/analytics",
  "/app/protection-rules",
  "/app/fraud-orders",
  "/app/settings",
];

test("Settings async actions propagate loader failures instead of faking success", () => {
  assert.match(settingsSource, /refreshBilling\?\.\(\{ throwOnError: true \}\)/);
  assert.match(settingsSource, /refreshSettings\?\.\(\{ throwOnError: true \}\)/);
  assert.match(settingsSource, /refresh\?\.\(\{ throwOnError: true \}\)/);
  assert.match(settingsSource, /errorMessage="Couldn't refresh billing status\. Try again\."/);
  assert.match(settingsSource, /errorMessage="Couldn't send the test email\. Try again\."/);
  assert.match(settingsSource, /errorMessage="Couldn't send the weekly report\. Try again\."/);
});

test("Settings async controls use loading state and duplicate submission guards", () => {
  assert.match(settingsSource, /const \[saving, setSaving\] = useState\(false\)/);
  assert.match(settingsSource, /setSaving\(true\)/);
  assert.match(settingsSource, /setSaving\(false\)/);
  assert.match(settingsSource, /loading={clearingSimulation}/);
  assert.match(settingsSource, /loading={resettingBotShield}/);
  assert.match(settingsSource, /BotShieldAsyncButton/);
  assert.match(designSource, /disabled={disabled \|\| loading}/);
  assert.match(designSource, /loading={asyncAction\.loading}/);
});

test("Settings error paths use merchant-safe messages without console noise", () => {
  assert.match(settingsSource, /toMerchantErrorMessage\(/);
  assert.match(settingsSource, /setSaveError\(/);
  assert.match(settingsSource, /setBillingRefreshError\(/);
  assert.match(settingsSource, /setDiagnosticRequestError\(/);
  assert.match(settingsSource, /setSimulationRequestError\(/);
  assert.match(settingsSource, /throw error;/);
  assert.doesNotMatch(settingsSource, /console\.(log|warn|error|debug)/);
  assert.match(merchantErrorSource, /lowered\.includes\("prisma"\)/);
  assert.match(merchantErrorSource, /lowered\.includes\("stack"\)/);
});

test("Settings hub sections expose real handlers for merchant-visible actions", () => {
  assert.match(settingsSource, /SETTINGS_HUB_SECTIONS/);
  assert.match(settingsSource, /onClick=\{\(\) => selectSection\(section\.id\)\}/);
  assert.match(settingsSource, /onSave={save}/);
  assert.match(settingsSource, /actions\.setPage\("detection"\)/);
  assert.match(settingsSource, /actions\.openThemeEditor/);
  assert.match(settingsSource, /actions\.runDiagnostic/);
  assert.match(settingsSource, /actions\.runSimulation/);
  assert.match(settingsSource, /actions\.refreshApplicationStatus/);
  assert.match(settingsSource, /safeFetchJson\("\/api\/clear-test-data"/);
  assert.match(settingsSource, /safeFetchJson\("\/api\/reset-shop-data"/);
  assert.match(settingsSource, /commandFor="botshield-clear-simulation-modal"/);
  assert.match(settingsSource, /commandFor="botshield-reset-data-modal"/);
});

test("Settings navigation does not route merchants to retired in-app pages", () => {
  const retiredInAppRoutes = [
    "/app/visitors",
    "/app/activity",
    "/app/incidents",
    "/app/blocklist",
    "/app/trusted",
    "/app/alerts-reports",
    "/app/billing",
    "/app/setup",
    "/app/detection-settings",
    "/app/rules",
  ];

  for (const route of retiredInAppRoutes) {
    assert.doesNotMatch(settingsSource, new RegExp(route.replace(/\//g, "\\/")));
  }

  assert.match(appIndexSource, /retiredPageMap/);
  assert.match(appIndexSource, /detection: "security"/);
  assert.match(appIndexSource, /settings: "\/app\/settings"/);

  const settingsSetPageCalls = [...settingsSource.matchAll(/setPage\("([^"]+)"\)/g)].map(
    (match) => match[1],
  );
  for (const page of settingsSetPageCalls) {
    assert.ok(
      ["detection", "settings", "policy", "analytics", "billing", "alerts-reports"].includes(
        page,
      ) || approvedMerchantPaths.some((path) => page.includes(path)),
      `Unexpected Settings setPage target: ${page}`,
    );
  }
});

test("Settings legal links stay on approved public policy routes", () => {
  const legalLinks = [
    "/data-retention",
    "/data-use",
    "/privacy",
    "/terms",
    "/data-deletion",
  ];

  for (const href of legalLinks) {
    assert.match(settingsSource, new RegExp(`href="${href.replace(/\//g, "\\/")}"`));
  }
});
