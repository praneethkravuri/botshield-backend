import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(
  new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
  "utf8",
);
const indexSource = await readFile(
  new URL("../app/routes/app._index.jsx", import.meta.url),
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
  assert.match(page, /Order review isn't available yet/);
  assert.match(page, /Orders requiring attention/);
  assert.match(page, /Order review isn't available in this version of BotShield/);
  assert.match(page, /Setup required/);
});

test("connected Fraud Orders remains an investigation workflow", () => {
  assert.match(page, /Orders requiring attention/);
  assert.match(page, /Search orders/);
  assert.match(page, /Review →/);
  assert.match(page, /Why this order was flagged/);
  assert.match(page, /Risk assessment/);
  assert.match(page, /Investigation/);
  assert.match(page, /Open in Shopify/);
  assert.match(page, /event\.key === "Escape"/);
  assert.match(page, /No orders currently need review/);
  assert.match(page, /No orders match your filter or search/);
});

test("Fraud Orders UI does not surface customer-identifying fields", () => {
  assert.doesNotMatch(page, /Search orders, customers, or email/);
  assert.doesNotMatch(page, /order\.customer/);
  assert.doesNotMatch(page, /order\.customerName/);
  assert.doesNotMatch(page, /order\.email/);
  assert.doesNotMatch(page, /"Customer"/);
  assert.doesNotMatch(page, /<dt>Customer<\/dt>/);
  assert.doesNotMatch(page, /<dt>Email<\/dt>/);
  assert.match(page, /order\.name \|\| order\.orderName/);
  assert.match(page, /botshield-fraud-open-order/);
});

test("Fraud Orders filters stay safe with zero order data", () => {
  assert.match(page, /function filterFraudOrders/);
  assert.match(page, /function getFraudQueueEmptyState/);
  assert.match(page, /FRAUD_FILTER_EMPTY/);
  assert.match(page, /No high-risk orders/);
  assert.match(page, /No medium-risk orders/);
  assert.match(page, /No risky orders are currently pending fulfillment/);
  assert.match(page, /No orders found/);
  assert.match(page, /disabled=\{loading\}/);
  assert.match(page, /searchDisabled=\{!connected\}/);
  assert.match(page, /onFilterChange=\{handleFilterChange\}/);
});

test("Fraud Orders optional scope and permission flow are configured", () => {
  assert.match(shopifyConfig, /scopes = "write_app_proxy"/);
  assert.match(shopifyConfig, /optional_scopes = \[ "read_orders" \]/);
  assert.doesNotMatch(shopifyConfig, /scopes = ".*read_orders/);
  assert.doesNotMatch(page, /Fraud score|100% safe|Fraud confirmed/);
  assert.match(page, /FRAUD_ORDER_ACCESS_AVAILABLE = true/);
  assert.match(page, /shopify\.scopes\.request\(\["read_orders"\]\)/);
  assert.match(page, /shopify\.scopes\.query\(\)/);
  assert.match(page, /\/api\/fraud-order-access/);
  assert.match(page, /declined-all/);
  assert.match(page, /granted-all/);
  assert.match(indexSource, /loadFraudOrders/);
  assert.match(indexSource, /\/api\/fraud-orders/);
  assert.match(indexSource, /refreshFraudOrders: loadFraudOrders/);
  assert.match(indexSource, /refreshFraudOrderAccess: refreshFraudOrderConnection/);
  assert.match(indexSource, /fraudOrderAccessConnected,/);
  assert.doesNotMatch(indexSource, /fraudOrderAccessConnected: false/);
});

test("Fraud Orders setup keeps review queue ready once order access is connected", () => {
  assert.match(page, /Risky orders from Shopify appear here for review\./);
  assert.match(page, /statusLabel: orderAccessReady \? "Ready" : "Waiting"/);
  assert.match(page, /statusLabel: orderAccessReady \? "Connected" : "Required"/);
  assert.match(page, /status: orderAccessReady \? "complete" : "waiting"/);
});

test("Fraud Orders styling is scoped and responsive", () => {
  assert.match(styles, /\.botshield-fraud-setup-progress-bar/);
  assert.match(styles, /\.botshield-fraud-setup-step-row/);
  assert.match(styles, /\.botshield-fraud-snapshot/);
  assert.match(styles, /\.botshield-fraud-review-hero/);
  assert.match(styles, /@media \(max-width: 840px\)/);
  assert.match(styles, /\.botshield-native-modal-body\.botshield-fraud-setup-modal/);
  assert.match(page, /size="base"/);
  assert.match(page, /type="check"/);
  assert.match(page, /type="circle-dashed"/);
  assert.match(page, /<s-divider/);
  assert.match(page, /slot="secondary-actions"/);
  assert.match(page, /botshield-fraud-setup-checklist/);
  assert.match(page, /botshield-fraud-setup-progress-count/);
});

test("Fraud Orders Review setup stays in Fraud Orders context", () => {
  assert.match(page, /function FraudOrderSetupDrawer/);
  assert.match(page, /BotShieldNativeModal/);
  assert.match(page, /BOTSHIELD_FRAUD_SETUP_MODAL_ID/);
  assert.match(page, /onSetup=\{openSetup\}/);
  assert.match(page, /Connect order access/);
  assert.match(page, />Close<\/BotShieldActionButton>/);
  assert.match(page, /Order risk access required/);
  assert.match(
    page,
    /Connect order access so BotShield can read supported Shopify order-risk information\./,
  );
  assert.match(page, /botshield-fraud-setup-checklist/);
  assert.match(page, /botshield-fraud-setup-progress-count/);
  assert.doesNotMatch(page, /Unavailable in this release/);
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
