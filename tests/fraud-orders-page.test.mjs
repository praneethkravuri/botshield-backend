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
  assert.match(page, /Connect order risk to start reviewing orders/);
  assert.match(page, /Setup required/);
  assert.match(page, /Supported Shopify order access is not available in this BotShield release yet/);
});

test("connected Fraud Orders remains an investigation workflow", () => {
  assert.match(page, /Orders requiring attention/);
  assert.match(page, /Search orders, customers, or email/);
  assert.match(page, /Review →/);
  assert.match(page, /Why this order was flagged/);
  assert.match(page, /Risk assessment/);
  assert.match(page, /Investigation/);
  assert.match(page, /event\.key === "Escape"/);
  assert.match(page, /No orders currently need review/);
  assert.match(page, /No orders match your filter or search/);
});

test("Fraud Orders filters stay safe with zero order data", () => {
  assert.match(page, /function filterFraudOrders/);
  assert.match(page, /function getFraudQueueEmptyState/);
  assert.match(page, /FRAUD_FILTER_EMPTY/);
  assert.match(page, /No high-risk orders/);
  assert.match(page, /No medium-risk orders/);
  assert.match(page, /No risky orders are currently pending fulfillment/);
  assert.match(page, /No orders available for review/);
  assert.match(page, /disabled=\{loading\}/);
  assert.match(page, /searchDisabled=\{!connected\}/);
  assert.match(page, /onFilterChange=\{handleFilterChange\}/);
});

test("Fraud Orders does not claim unsupported production access", () => {
  assert.match(shopifyConfig, /scopes = "write_app_proxy"/);
  assert.doesNotMatch(shopifyConfig, /read_orders/);
  assert.doesNotMatch(page, /Fraud score|100% safe|Fraud confirmed/);
  assert.match(page, /FRAUD_ORDER_ACCESS_AVAILABLE = false/);
});

test("Fraud Orders styling is scoped and responsive", () => {
  assert.match(styles, /\.botshield-fraud-setup-checklist/);
  assert.match(styles, /\.botshield-fraud-setup-status/);
  assert.match(styles, /\.botshield-fraud-snapshot/);
  assert.match(styles, /\.botshield-fraud-review-hero/);
  assert.match(styles, /@media \(max-width: 840px\)/);
  assert.match(styles, /justify-content: center/);
  assert.match(styles, /\.botshield-fraud-drawer--setup \{ width: min\(500px/);
});

test("Fraud Orders Review setup stays in Fraud Orders context", () => {
  assert.match(page, /function FraudOrderSetupDrawer/);
  assert.match(page, /onSetup=\{openSetup\}/);
  assert.match(page, /Connect order access/);
  assert.match(page, /Cancel/);
  assert.match(page, /Order risk isn't connected/);
  assert.match(page, /Connect order risk to start reviewing suspicious orders/);
  assert.match(page, /botshield-fraud-setup-checklist/);
  assert.doesNotMatch(page, /View full BotShield setup/);
  assert.doesNotMatch(page, /Back to Fraud Orders/);
  assert.doesNotMatch(page, /setPage\("setup"\)/);
});

test("Fraud Orders KPI cards can apply queue filters when connected", () => {
  assert.match(page, /FRAUD_METRIC_FILTERS/);
  assert.match(page, /onMetricSelect=\{handleFilterChange\}/);
  assert.match(page, /aria-pressed=\{isSelected\}/);
  assert.match(page, /!item\.unavailable/);
});
