import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(
  new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
  "utf8",
);
const styles = await readFile(
  new URL("../app/components/design-system/BotShieldDesignSystem.jsx", import.meta.url),
  "utf8",
);
const shopifyConfig = await readFile(
  new URL("../shopify.app.toml", import.meta.url),
  "utf8",
);

test("Fraud Orders uses a dedicated disconnected experience", () => {
  assert.match(page, /if \(!connected\)/);
  assert.match(page, /Order risk needs setup/);
  assert.match(page, /Orders requiring attention/);
  assert.match(page, /Connect order risk to begin reviewing orders/);
  assert.match(page, /Setup required/);
  assert.match(page, /No demo or simulated orders are shown/);
});

test("connected Fraud Orders remains an investigation workflow", () => {
  assert.match(page, /Orders requiring attention/);
  assert.match(page, /Search orders, customers, or email/);
  assert.match(page, /Review →/);
  assert.match(page, /Why flagged/);
  assert.match(page, /Risk assessment/);
  assert.match(page, /Why this order was flagged/);
  assert.match(page, /Investigation/);
  assert.match(page, /event\.key === "Escape"/);
});

test("Fraud Orders does not claim unsupported production access", () => {
  assert.match(shopifyConfig, /scopes = "write_app_proxy"/);
  assert.doesNotMatch(shopifyConfig, /read_orders/);
  assert.doesNotMatch(page, /Fraud score|100% safe|Fraud confirmed/);
});

test("Fraud Orders styling is scoped and responsive", () => {
  assert.match(styles, /\.botshield-fraud-setup-card/);
  assert.match(styles, /\.botshield-fraud-preview-grid/);
  assert.match(styles, /\.botshield-fraud-snapshot/);
  assert.match(styles, /\.botshield-fraud-review-hero/);
  assert.match(styles, /@media \(max-width: 840px\)/);
  assert.match(styles, /justify-content: center/);
});

test("Fraud Orders Review setup stays in Fraud Orders context", () => {
  assert.match(page, /function FraudOrderSetupDrawer/);
  assert.match(page, /onOpenSetup=\{openSetup\}/);
  assert.match(page, /View full BotShield setup/);
  assert.match(page, /Back to Fraud Orders/);
  const disconnectedBlock = page.slice(
    page.indexOf("function FraudOrdersDisconnected"),
    page.indexOf("function FraudOrdersPage"),
  );
  assert.doesNotMatch(disconnectedBlock, /setPage\("setup"\)/);
});
