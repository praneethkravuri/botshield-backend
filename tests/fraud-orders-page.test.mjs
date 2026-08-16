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
  assert.match(page, /Connect Shopify order risk/);
  assert.match(page, /Prioritized review queue/);
  assert.match(page, /No order data is stored or displayed/);
  assert.match(page, /Order access required/);
});

test("connected Fraud Orders remains an investigation workflow", () => {
  assert.match(page, /Fraud review queue/);
  assert.match(page, /Search order, customer, or email/);
  assert.match(page, /Review order/);
  assert.match(page, /Risk assessment/);
  assert.match(page, /Recommended next step/);
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
  assert.match(styles, /@media \(max-width: 840px\)/);
  assert.match(styles, /justify-content: center/);
});
