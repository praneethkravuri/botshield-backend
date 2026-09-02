import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const publicRoutes = [
  "privacy.jsx",
  "terms.jsx",
  "data-use.jsx",
  "data-retention.jsx",
  "data-deletion.jsx",
  "support.jsx",
];

const engineeringPhrases =
  /JavaScript-based|production web service|startup maintenance|based on the app'?s current implementation|current Shopify compliance workflows and implementation/i;

const level1Exclusion =
  /(?:does not request|without requesting) customer[\s\S]*shipping address/i;

test("public legal routes render through the shared legal shell", async () => {
  for (const routeName of publicRoutes) {
    const source = await readFile(
      new URL(`../app/routes/${routeName}`, import.meta.url),
      "utf8",
    );
    assert.match(
      source,
      /PublicLegalShell/,
      `${routeName} must use the shared public legal shell`,
    );
    assert.match(
      source,
      /export default function/,
      `${routeName} must export a page component`,
    );
    assert.match(
      source,
      /summary=/,
      `${routeName} must provide a page summary`,
    );
  }
});

test("public legal shell exposes premium navigation, metadata, and footer", async () => {
  const shell = await readFile(
    new URL("../app/components/public/PublicLegalShell.jsx", import.meta.url),
    "utf8",
  );
  const publicInfo = await readFile(
    new URL("../app/config/public-info.js", import.meta.url),
    "utf8",
  );
  const css = await readFile(
    new URL("../app/styles/public-legal.css", import.meta.url),
    "utf8",
  );

  assert.match(shell, /public-legal-brand-mark/);
  assert.match(shell, /public-legal-nav-link/);
  assert.match(shell, /public-legal-toc/);
  assert.match(shell, /lastUpdatedDate/);
  assert.match(shell, /Privacy/);
  assert.match(shell, /Terms/);
  assert.match(shell, /Data use/);
  assert.match(shell, /Support/);
  assert.match(shell, /Data retention/);
  assert.match(shell, /Data deletion/);
  assert.match(publicInfo, /dataUseUrl: "\/data-use"/);
  assert.match(publicInfo, /dataRetentionUrl: "\/data-retention"/);
  assert.match(publicInfo, /dataDeletionUrl: "\/data-deletion"/);
  assert.match(publicInfo, /lastUpdatedDate:/);
  assert.match(css, /public-legal-fact/);
  assert.match(css, /focus-visible/);
});

test("settings data and privacy hub uses a fixed action column and valid routes", async () => {
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
  const privacySection = source.slice(
    source.indexOf('if (activeSection === "privacy")'),
    source.indexOf('if (activeSection === "diagnostics")'),
  );

  assert.match(
    privacySection,
    /How BotShield handles and protects merchant, storefront, and supported Shopify data/,
  );
  assert.match(privacySection, /SettingsHubFixedValue/);
  assert.match(privacySection, /SettingsHubFixedAction/);
  assert.match(designSystem, /botshield-settings-hub-group\.is-privacy/);
  assert.match(designSystem, /botshield-settings-hub-fixed-action/);
  assert.match(privacySection, /href="\/data-retention"/);
  assert.match(privacySection, /href="\/data-use"/);
  assert.match(privacySection, /href="\/privacy"/);
  assert.match(privacySection, /href="\/terms"/);
  assert.match(privacySection, /href="\/data-deletion"/);
  assert.match(
    privacySection,
    /Customer contact and address fields are not requested/,
  );
  assert.match(
    privacySection,
    /Uninstall removes app sessions immediately/,
  );
});

test("privacy policy stays merchant-readable and compliance-safe", async () => {
  const privacy = await readFile(
    new URL("../app/routes/privacy.jsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(privacy, engineeringPhrases);
  assert.doesNotMatch(privacy, /referrer/i);
  assert.match(
    privacy,
    /storefront security, traffic analysis,[\s\S]*threat detection,[\s\S]*merchant-managed protection tools/,
  );
  assert.match(privacy, /Data Protection Agreement/);
  assert.match(privacy, /do not sell personal data/i);
  assert.match(privacy, /merchant-configured alert email/i);
  assert.match(privacy, level1Exclusion);
  assert.match(
    privacy,
    /Uninstall removes app sessions immediately|When a merchant uninstalls BotShield, stored Shopify app sessions/,
  );
});

test("data-use, retention, and deletion pages stay aligned with implemented behavior", async () => {
  const dataUse = await readFile(
    new URL("../app/routes/data-use.jsx", import.meta.url),
    "utf8",
  );
  const dataRetention = await readFile(
    new URL("../app/routes/data-retention.jsx", import.meta.url),
    "utf8",
  );
  const dataDeletion = await readFile(
    new URL("../app/routes/data-deletion.jsx", import.meta.url),
    "utf8",
  );
  const allPublic = [dataUse, dataRetention, dataDeletion].join("\n");

  assert.doesNotMatch(allPublic, engineeringPhrases);
  assert.match(dataUse, level1Exclusion);
  assert.match(dataUse, /fetched live from Shopify/);
  assert.match(dataUse, /does not create Shopify/i);
  assert.match(dataUse, /merchant-configured alert email/i);
  assert.match(dataRetention, /deleted after[\s\S]*\{BOT_EVENT_RETENTION_DAYS\}[\s\S]*days/);
  assert.match(dataRetention, /NETWORK_INTEL_CACHE_HOURS/);
  assert.match(dataDeletion, /shop\/redact/);
  assert.match(dataDeletion, /does not[\s\S]*promise instantaneous[\s\S]*deletion/i);
  assert.match(
    dataDeletion,
    /Uninstall removes app sessions immediately|Uninstall is not full shop deletion/,
  );
  assert.doesNotMatch(dataUse, /SOC 2|ISO 27001|PCI|military-grade|penetration test/i);
});

test("public legal pages do not introduce new Shopify scopes or Level 2 fields", async () => {
  const config = await readFile(
    new URL("../shopify.app.toml", import.meta.url),
    "utf8",
  );
  const privacy = await readFile(
    new URL("../app/routes/privacy.jsx", import.meta.url),
    "utf8",
  );
  const dataUse = await readFile(
    new URL("../app/routes/data-use.jsx", import.meta.url),
    "utf8",
  );

  assert.match(config, /optional_scopes = \[ "read_orders" \]/);
  assert.doesNotMatch(config, /read_all_orders|write_orders/);
  assert.doesNotMatch(privacy, /read_all_orders|write_orders/);
  assert.doesNotMatch(dataUse, /read_all_orders|write_orders/);
  assert.match(privacy, level1Exclusion);
  assert.match(dataUse, level1Exclusion);
});
