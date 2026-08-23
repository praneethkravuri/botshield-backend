import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildShopifyOrderAdminUrl,
  collectRiskSignals,
  formatOrderAmount,
  formatShopifyDisplayStatus,
  isProtectedCustomerDataError,
  mapRecommendationLabel,
  mapRiskLevel,
  mapShopifyOrderNode,
  mapShopifyOrdersResponse,
  pickPrimaryAssessment,
  resolveFraudOrdersMerchantError,
} from "../app/lib/fraud-orders.server.js";

test("mapRiskLevel normalizes Shopify risk levels", () => {
  assert.equal(mapRiskLevel("HIGH"), "high");
  assert.equal(mapRiskLevel("MEDIUM"), "medium");
  assert.equal(mapRiskLevel("LOW"), "low");
  assert.equal(mapRiskLevel("PENDING"), "pending");
  assert.equal(mapRiskLevel(null), "pending");
});

test("mapRecommendationLabel maps Shopify recommendation enums", () => {
  assert.equal(mapRecommendationLabel("INVESTIGATE"), "Investigate");
  assert.equal(mapRecommendationLabel("ACCEPT"), "Accept");
  assert.equal(mapRecommendationLabel("CANCEL"), "Cancel");
  assert.equal(mapRecommendationLabel("NONE"), "Pending");
});

test("pickPrimaryAssessment prefers Shopify and highest severity", () => {
  const assessments = [
    {
      riskLevel: "LOW",
      provider: { title: "Other App" },
      facts: [{ description: "Low signal", sentiment: "NEUTRAL" }],
    },
    {
      riskLevel: "HIGH",
      provider: null,
      facts: [{ description: "Billing mismatch", sentiment: "NEGATIVE" }],
    },
  ];

  const primary = pickPrimaryAssessment(assessments);
  assert.equal(primary.riskLevel, "HIGH");
  assert.equal(primary.provider, null);
});

test("mapShopifyOrderNode maps high-risk order fields for the UI", () => {
  const mapped = mapShopifyOrderNode(
    {
      id: "gid://shopify/Order/1048",
      name: "#1048",
      createdAt: "2026-08-22T18:08:00Z",
      displayFinancialStatus: "PAID",
      displayFulfillmentStatus: "UNFULFILLED",
      email: "jordan@example.com",
      totalPriceSet: {
        shopMoney: {
          amount: "486.00",
          currencyCode: "USD",
        },
      },
      customer: {
        displayName: "Jordan Lee",
        email: "jordan@example.com",
      },
      risk: {
        recommendation: "INVESTIGATE",
        assessments: [
          {
            riskLevel: "HIGH",
            provider: null,
            facts: [
              { description: "Billing / shipping mismatch", sentiment: "NEGATIVE" },
              { description: "Unusual order velocity", sentiment: "NEGATIVE" },
            ],
          },
        ],
      },
    },
    "demo-store.myshopify.com",
  );

  assert.equal(mapped.name, "#1048");
  assert.equal(mapped.customer, "Jordan Lee");
  assert.equal(mapped.email, "jordan@example.com");
  assert.equal(mapped.amount, "$486.00");
  assert.equal(mapped.risk, "high");
  assert.equal(mapped.recommendation, "Investigate");
  assert.equal(mapped.reason, "Billing / shipping mismatch");
  assert.equal(mapped.secondarySignal, "Unusual order velocity");
  assert.equal(mapped.fulfillmentStatus, "Unfulfilled");
  assert.equal(mapped.financialStatus, "Paid");
  assert.equal(
    mapped.adminUrl,
    "https://admin.shopify.com/store/demo-store/orders/1048",
  );
  assert.equal(mapped.assessmentSource, "Shopify order risk assessment");
});

test("mapShopifyOrderNode handles medium-risk and low-risk orders", () => {
  const medium = mapShopifyOrderNode(
    {
      id: "gid://shopify/Order/1042",
      name: "#1042",
      createdAt: "2026-08-22T17:00:00Z",
      displayFinancialStatus: "AUTHORIZED",
      displayFulfillmentStatus: "UNFULFILLED",
      totalPriceSet: { shopMoney: { amount: "284.00", currencyCode: "USD" } },
      risk: {
        recommendation: "INVESTIGATE",
        assessments: [{ riskLevel: "MEDIUM", provider: null, facts: [] }],
      },
    },
    "demo-store.myshopify.com",
  );
  const low = mapShopifyOrderNode(
    {
      id: "gid://shopify/Order/1031",
      name: "#1031",
      createdAt: "2026-08-22T10:00:00Z",
      displayFinancialStatus: "PAID",
      displayFulfillmentStatus: "FULFILLED",
      totalPriceSet: { shopMoney: { amount: "56.00", currencyCode: "USD" } },
      risk: {
        recommendation: "ACCEPT",
        assessments: [{ riskLevel: "LOW", provider: null, facts: [] }],
      },
    },
    "demo-store.myshopify.com",
  );

  assert.equal(medium.risk, "medium");
  assert.equal(low.risk, "low");
  assert.equal(low.recommendation, "Accept");
});

test("mapShopifyOrderNode handles orders without risk assessments", () => {
  const mapped = mapShopifyOrderNode(
    {
      id: "gid://shopify/Order/1001",
      name: "#1001",
      createdAt: "2026-08-22T09:00:00Z",
      displayFinancialStatus: "PAID",
      displayFulfillmentStatus: "FULFILLED",
      totalPriceSet: { shopMoney: { amount: "20.00", currencyCode: "USD" } },
      risk: {
        recommendation: "NONE",
        assessments: [],
      },
    },
    "demo-store.myshopify.com",
  );

  assert.equal(mapped.risk, "pending");
  assert.equal(mapped.recommendation, "Pending");
  assert.equal(mapped.reason, null);
  assert.deepEqual(mapped.signals, []);
});

test("mapShopifyOrdersResponse maps zero-order GraphQL payloads", () => {
  const orders = mapShopifyOrdersResponse(
    { data: { orders: { edges: [] } } },
    "demo-store.myshopify.com",
  );
  assert.deepEqual(orders, []);
});

test("protected customer data GraphQL errors map to merchant-safe responses", () => {
  assert.equal(
    isProtectedCustomerDataError(
      "This app is not approved to access the Order object. See customer_data for more details.",
    ),
    true,
  );

  const resolved = resolveFraudOrdersMerchantError(
    new Error("This app is not approved to access the Order object."),
  );
  assert.equal(resolved.code, "protected_customer_data");
  assert.equal(resolved.status, 403);
  assert.match(resolved.message, /protected customer data access is approved/);
});

test("fraud orders API guards on session scope and uses Admin GraphQL", async () => {
  const routeSource = await readFile(
    new URL("../app/routes/api.fraud-orders.jsx", import.meta.url),
    "utf8",
  );
  const indexSource = await readFile(
    new URL("../app/routes/app._index.jsx", import.meta.url),
    "utf8",
  );
  const adminSource = await readFile(
    new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
    "utf8",
  );

  assert.match(routeSource, /authenticate\.admin\(request\)/);
  assert.match(routeSource, /hasFraudOrderReadAccess\(session\?\.scope\)/);
  assert.match(routeSource, /connected: false/);
  assert.match(routeSource, /fetchFraudOrders\(admin, session\.shop\)/);
  assert.match(indexSource, /\/api\/fraud-orders/);
  assert.match(indexSource, /loadFraudOrders/);
  assert.match(indexSource, /refreshFraudOrders: loadFraudOrders/);
  assert.match(indexSource, /page !== "fraud-orders"/);
  assert.match(adminSource, /actions\.refreshFraudOrders/);
  assert.match(adminSource, /No orders found/);
});

test("display helpers stay null-safe", () => {
  assert.equal(formatShopifyDisplayStatus("PARTIALLY_FULFILLED"), "Partially Fulfilled");
  assert.equal(formatOrderAmount("12.5", "USD"), "$12.50");
  assert.equal(buildShopifyOrderAdminUrl("demo-store.myshopify.com", null), null);
  assert.deepEqual(collectRiskSignals(undefined), []);
});
