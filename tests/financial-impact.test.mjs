import test from "node:test";
import assert from "node:assert/strict";

import { getEstimatedValueProtected } from "../app/lib/financial-impact.server.js";

test("financial impact stays unavailable without an auditable order store", async () => {
  const impact = await getEstimatedValueProtected({}, "example.myshopify.com");

  assert.equal(impact.status, "unavailable");
  assert.equal(impact.totalAmountMinor, null);
  assert.deepEqual(impact.series, []);
});

test("financial impact sums only verified qualifying order records", async () => {
  const records = [
    {
      shopifyOrderId: "gid://shopify/Order/1",
      evidenceReference: "fraud-decision-1",
      amountMinor: 12500,
      currencyCode: "USD",
      outcomeAt: new Date("2026-08-08T12:00:00Z"),
      verifiedAt: new Date("2026-08-08T12:05:00Z"),
    },
    {
      shopifyOrderId: "gid://shopify/Order/2",
      evidenceReference: "fraud-decision-2",
      amountMinor: 7500,
      currencyCode: "USD",
      outcomeAt: new Date("2026-08-08T15:00:00Z"),
      verifiedAt: new Date("2026-08-08T15:05:00Z"),
    },
  ];
  const db = { financialImpactEvent: { findMany: async () => records } };

  const impact = await getEstimatedValueProtected(db, "example.myshopify.com");

  assert.equal(impact.status, "available");
  assert.equal(impact.totalAmountMinor, 20000);
  assert.equal(impact.currencyCode, "USD");
  assert.equal(impact.qualifyingOrderCount, 2);
  assert.deepEqual(impact.series, [{ date: "2026-08-08", amountMinor: 20000 }]);
});

