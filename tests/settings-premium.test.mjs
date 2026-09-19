import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const SECTION_IDS = [
  "general",
  "billing",
  "notifications",
  "reports",
  "connections",
  "privacy",
  "diagnostics",
  "danger",
];

test("settings premium stylesheet is scoped with motion and reduced-motion support", async () => {
  const css = await readFile(
    new URL("../app/styles/settings-premium.css", import.meta.url),
    "utf8",
  );

  assert.match(css, /\.botshield-settings-premium/);
  assert.match(css, /--settings-workspace-max:/);
  assert.match(css, /--settings-motion-fast:/);
  assert.match(css, /@keyframes settings-section-enter/);
  assert.match(css, /@keyframes settings-page-enter/);
  assert.match(
    css,
    /\.botshield-settings-hub-panel > \.botshield-settings-hub-section[\s\S]*settings-section-enter/,
  );
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /@media \(max-width: 980px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(
    css,
    /\.botshield-settings-hub-nav-item \.botshield-v2-icon[\s\S]*display: inline-flex[\s\S]*align-items: center[\s\S]*justify-content: center/,
  );
  assert.match(
    css,
    /\.botshield-settings-hub-nav-item:hover > span:not\(\.botshield-v2-icon\)/,
  );
  assert.doesNotMatch(css, /\.botshield-overview-premium/);
  assert.doesNotMatch(css, /\.botshield-analytics-premium/);
  assert.doesNotMatch(css, /\.botshield-fraud-orders-premium/);
  assert.doesNotMatch(css, /\.botshield-settings-hub-danger[^}]*animation:[^}]*infinite/);
  assert.doesNotMatch(css, /@keyframes settings-danger/);
});

test("settings premium wiring keeps all eight sections and left navigation", async () => {
  const adminExperience = await readFile(
    new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
    "utf8",
  );
  const settingsPage = adminExperience.slice(
    adminExperience.indexOf("function SettingsPage"),
    adminExperience.indexOf("export default function BotShieldAdminExperience"),
  );

  assert.match(adminExperience, /settings-premium\.css/);
  assert.match(
    adminExperience,
    /className="botshield-overview-content botshield-overview-v2 botshield-settings-hub-content botshield-settings-premium"/,
  );
  assert.match(settingsPage, /SETTINGS_HUB_SECTIONS/);
  assert.match(settingsPage, /botshield-settings-hub-nav/);
  assert.match(settingsPage, /botshield-settings-hub-nav-item/);
  assert.match(settingsPage, /is-panel-danger/);
  assert.match(settingsPage, /botshield-clear-simulation-modal/);
  assert.match(settingsPage, /botshield-reset-data-modal/);
  assert.match(settingsPage, /refreshBilling/);
  assert.match(settingsPage, /runDiagnostic/);
  assert.match(settingsPage, /runSimulation/);

  const settingsHubConfig = adminExperience.slice(
    adminExperience.indexOf("const SETTINGS_HUB_SECTIONS"),
    adminExperience.indexOf("function readSettingsHubSection"),
  );

  for (const sectionId of SECTION_IDS) {
    assert.match(settingsHubConfig, new RegExp(`id: "${sectionId}"`));
  }
});
