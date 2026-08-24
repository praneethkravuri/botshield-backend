import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildShopifyOrderAdminUrl } from "../app/lib/fraud-orders.server.js";

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
const fraudServer = await readFile(
  new URL("../app/lib/fraud-orders.server.js", import.meta.url),
  "utf8",
);

test("Fraud Orders uses Shopify-native resource queue components", () => {
  assert.match(page, /<s-table/);
  assert.match(page, /<s-table-header-row>/);
  assert.match(page, /<s-table-body>/);
  assert.match(page, /<s-search-field/);
  assert.match(page, /<s-button-group/);
  assert.match(page, /slot="secondary-actions"[\s\S]*Refresh/);
  assert.doesNotMatch(page, /FraudOrderInboxTable/);
  assert.doesNotMatch(page, /FraudOrderReviewDrawer/);
  assert.doesNotMatch(page, /ReactDOM\.createPortal/);
});

test("Fraud Orders disconnected state prompts order access instead of future-release copy", () => {
  assert.match(page, /Order access required/);
  assert.match(page, /Connect order access to review Shopify order risk/);
  assert.doesNotMatch(page, /future BotShield update/);
  assert.doesNotMatch(page, /when this feature launches/);
  assert.doesNotMatch(page, /Order review isn't available yet/);
});

test("connected Fraud Orders remains an investigation workflow", () => {
  assert.match(page, /Orders requiring attention/);
  assert.match(page, /View risk/);
  assert.match(page, /Why this order was flagged/);
  assert.match(page, /Risk assessment/);
  assert.match(page, /Open in Shopify/);
  assert.match(page, /Nothing needs review/);
  assert.match(page, /No matching orders/);
  assert.match(page, /View all orders/);
  assert.match(page, /Clear filters/);
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
  assert.match(page, /botshield-fraud-order-link/);
});

test("Fraud Orders filters and search stay scoped to supported order fields", () => {
  assert.match(page, /function filterFraudOrders/);
  assert.match(page, /function getFraudQueueEmptyState/);
  assert.match(page, /FRAUD_FILTER_EMPTY/);
  assert.match(page, /Needs review/);
  assert.match(page, /High risk/);
  assert.match(page, /Medium risk/);
  assert.match(page, /Pending fulfillment/);
  assert.match(page, /All orders/);
  assert.match(page, /order\.recommendation/);
  assert.match(page, /order\.financialStatus/);
  assert.match(page, /order\.fulfillmentStatus/);
});

test("Fraud Orders review uses native centered modal shell", () => {
  assert.match(page, /function FraudOrderReviewModal/);
  assert.match(page, /BOTSHIELD_FRAUD_REVIEW_MODAL_ID/);
  assert.match(page, /BotShieldNativeModal/);
  assert.match(page, /queueBotShieldModalShow\(BOTSHIELD_FRAUD_REVIEW_MODAL_ID\)/);
  assert.match(page, /hideBotShieldModal\(BOTSHIELD_FRAUD_REVIEW_MODAL_ID\)/);
});

test("Fraud Orders optional scope and permission flow are configured", () => {
  assert.match(shopifyConfig, /scopes = "write_app_proxy"/);
  assert.match(shopifyConfig, /optional_scopes = \[ "read_orders" \]/);
  assert.doesNotMatch(shopifyConfig, /scopes = ".*read_orders/);
  assert.match(page, /FRAUD_ORDER_ACCESS_AVAILABLE = true/);
  assert.match(page, /shopify\.scopes\.request\(\["read_orders"\]\)/);
  assert.match(page, /shopify\.scopes\.query\(\)/);
  assert.match(page, /\/api\/fraud-order-access/);
  assert.match(page, /declined-all/);
  assert.match(page, /granted-all/);
  assert.match(indexSource, /loadFraudOrders/);
  assert.match(indexSource, /\/api\/fraud-orders/);
  assert.match(indexSource, /refreshFraudOrders: loadFraudOrders/);
  assert.match(indexSource, /fraudOrdersRefreshInFlight/);
  assert.match(indexSource, /fraudOrdersLastRefreshedAt/);
  assert.match(indexSource, /fraudOrdersErrorCode/);
});

test("Fraud Orders setup derives readiness from effective Fraud Orders state", () => {
  assert.match(page, /getFraudOrdersSetupState/);
  assert.match(page, /errorCode={errorCode}/);
  assert.match(page, /setupState = getFraudOrdersSetupState/);
  assert.match(page, /introCopy/);
  assert.match(page, /summaryTitle/);
  assert.match(page, /summaryDetail/);
  assert.doesNotMatch(page, /statusLabel: orderAccessReady \? "Ready" : "Waiting"/);
  assert.doesNotMatch(page, /Review Shopify order-risk data below/);
});

test("Fraud Orders styling is scoped and responsive", () => {
  assert.match(styles, /\.botshield-fraud-setup-progress-bar/);
  assert.match(styles, /\.botshield-fraud-snapshot/);
  assert.match(styles, /\.botshield-fraud-review-hero/);
  assert.match(styles, /\.botshield-fraud-order-link/);
  assert.match(styles, /\.botshield-native-modal-body\.botshield-fraud-review-modal/);
});

test("Fraud Orders Review setup stays in Fraud Orders context", () => {
  assert.match(page, /function FraudOrderSetupDrawer/);
  assert.match(page, /BOTSHIELD_FRAUD_SETUP_MODAL_ID/);
  assert.match(page, /Connect order access/);
  assert.doesNotMatch(page, /Unavailable in this release/);
});

test("Fraud Orders KPI cards can apply queue filters when connected", () => {
  assert.match(page, /FRAUD_METRIC_FILTERS/);
  assert.match(page, /onMetricSelect=\{handleFilterChange\}/);
});

test("Fraud Orders error states use merchant-safe banners", () => {
  assert.match(page, /Order data access isn't available yet/);
  assert.match(page, /Couldn't refresh orders/);
  assert.match(page, /protected_customer_data/);
  assert.doesNotMatch(page, /GraphQL/);
});

test("Shopify admin order links stay shop-specific", () => {
  const url = buildShopifyOrderAdminUrl(
    "demo-store.myshopify.com",
    "gid://shopify/Order/1048",
  );
  assert.equal(url, "https://admin.shopify.com/store/demo-store/orders/1048");
  assert.match(page, /order\.adminUrl/);
  assert.match(page, /botshield-fraud-order-link/);
  const queryMatch = fraudServer.match(/const FRAUD_ORDERS_QUERY = `#graphql([\s\S]*?)`;/);
  assert.ok(queryMatch);
  assert.doesNotMatch(queryMatch[1], /\bemail\b/);
  assert.doesNotMatch(queryMatch[1], /\bcustomer\b/);
});
