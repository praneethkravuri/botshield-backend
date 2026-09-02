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
  }
});

test("public legal shell exposes required navigation and footer links", async () => {
  const shell = await readFile(
    new URL("../app/components/public/PublicLegalShell.jsx", import.meta.url),
    "utf8",
  );
  const publicInfo = await readFile(
    new URL("../app/config/public-info.js", import.meta.url),
    "utf8",
  );

  assert.match(shell, /Privacy/);
  assert.match(shell, /Terms/);
  assert.match(shell, /Data use/);
  assert.match(shell, /Support/);
  assert.match(shell, /Data retention/);
  assert.match(shell, /Data deletion/);
  assert.match(publicInfo, /dataUseUrl: "\/data-use"/);
  assert.match(publicInfo, /dataRetentionUrl: "\/data-retention"/);
  assert.match(publicInfo, /dataDeletionUrl: "\/data-deletion"/);
});

test("settings data and privacy hub links to valid public legal routes", async () => {
  const source = await readFile(
    new URL(
      "../app/components/admin/BotShieldAdminExperience.jsx",
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
  assert.match(privacySection, /recordedActivityLabel/);
  assert.match(privacySection, /simulationLabel/);
  assert.match(privacySection, /href="\/data-retention"/);
  assert.match(privacySection, /href="\/data-use"/);
  assert.match(privacySection, /href="\/privacy"/);
  assert.match(privacySection, /href="\/terms"/);
  assert.match(privacySection, /href="\/data-deletion"/);
  assert.match(
    privacySection,
    /does not request customer name, email, phone, billing address, or shipping address/,
  );
});

test("privacy policy removes implementation jargon from the opening", async () => {
  const privacy = await readFile(
    new URL("../app/routes/privacy.jsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(privacy, /JavaScript-based/i);
  assert.match(
    privacy,
    /storefront security,[\s\S]*traffic analysis,[\s\S]*threat detection,[\s\S]*merchant-managed protection tools/,
  );
});

test("data-use and retention pages stay aligned with implemented behavior", async () => {
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

  assert.match(
    dataUse,
    /does not request customer[\s\S]*billing address, or shipping address/i,
  );
  assert.match(dataUse, /fetched live from Shopify/);
  assert.match(dataUse, /does not create Shopify/i);
  assert.match(dataRetention, /deleted after[\s\S]*\{BOT_EVENT_RETENTION_DAYS\}[\s\S]*days/);
  assert.match(dataRetention, /24-hour expiry/);
  assert.match(dataDeletion, /shop\/redact/);
  assert.match(dataDeletion, /does not[\s\S]*promise instantaneous deletion/i);
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
  assert.match(
    privacy,
    /does not request customer[\s\S]*billing address, or shipping address/i,
  );
  assert.match(
    dataUse,
    /does not request customer[\s\S]*billing address, or shipping address/i,
  );
});
