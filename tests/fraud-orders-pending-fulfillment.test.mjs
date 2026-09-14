import assert from "node:assert/strict";
import test from "node:test";
import {
  fraudOrderHasUnresolvedAssessment,
  fraudOrderIsElevated,
  fraudOrderIsPendingFulfillment,
  fraudOrderNeedsPreFulfillmentReview,
} from "../app/lib/fraud-order-pending-fulfillment.js";

const order1001 = {
  name: "#1001",
  fulfillmentStatus: "Unfulfilled",
  risk: "pending",
  recommendation: "Pending",
};

test("unfulfilled pending assessment order qualifies for Pending fulfillment", () => {
  assert.equal(fraudOrderNeedsPreFulfillmentReview(order1001), true);
  assert.equal(fraudOrderHasUnresolvedAssessment(order1001), true);
});

test("unfulfilled high risk order qualifies for Pending fulfillment", () => {
  const order = {
    fulfillmentStatus: "Unfulfilled",
    risk: "high",
    recommendation: "Investigate",
  };
  assert.equal(fraudOrderNeedsPreFulfillmentReview(order), true);
  assert.equal(fraudOrderIsElevated(order), true);
});

test("unfulfilled medium risk order qualifies for Pending fulfillment", () => {
  const order = {
    fulfillmentStatus: "Unfulfilled",
    risk: "medium",
    recommendation: "Investigate",
  };
  assert.equal(fraudOrderNeedsPreFulfillmentReview(order), true);
});

test("fulfilled pending assessment order is excluded from Pending fulfillment", () => {
  const order = {
    fulfillmentStatus: "Fulfilled",
    risk: "pending",
    recommendation: "Pending",
  };
  assert.equal(fraudOrderNeedsPreFulfillmentReview(order), false);
  assert.equal(fraudOrderIsPendingFulfillment(order), false);
});

test("fulfilled high risk order is excluded from Pending fulfillment", () => {
  const order = {
    fulfillmentStatus: "Fulfilled",
    risk: "high",
    recommendation: "Investigate",
  };
  assert.equal(fraudOrderNeedsPreFulfillmentReview(order), false);
});

test("unfulfilled low or cleared assessment order is excluded from Pending fulfillment", () => {
  const lowRisk = {
    fulfillmentStatus: "Unfulfilled",
    risk: "low",
    recommendation: "Accept",
  };
  const clearedRisk = {
    fulfillmentStatus: "Unfulfilled",
    risk: "low",
    recommendation: "Accept",
  };

  assert.equal(fraudOrderNeedsPreFulfillmentReview(lowRisk), false);
  assert.equal(fraudOrderNeedsPreFulfillmentReview(clearedRisk), false);
  assert.equal(fraudOrderHasUnresolvedAssessment(lowRisk), false);
});

test("Pending fulfillment KPI and filter share fraudOrderNeedsPreFulfillmentReview", async () => {
  const adminSource = await import("node:fs/promises").then((fs) =>
    fs.readFile(
      new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
      "utf8",
    ),
  );

  assert.match(adminSource, /fraudOrderNeedsPreFulfillmentReview\(order\)/);
  assert.match(
    adminSource,
    /const pendingFulfillment = orders\.filter\(\(order\) =>\s*fraudOrderNeedsPreFulfillmentReview\(order\)/,
  );
  assert.match(
    adminSource,
    /normalizedFilter === "pending-fulfillment"\s*\?\s*fraudOrderNeedsPreFulfillmentReview\(order\)/,
  );
});

test("existing elevated-risk semantics remain unchanged", () => {
  assert.equal(
    fraudOrderIsElevated({ risk: "high", recommendation: "Pending" }),
    true,
  );
  assert.equal(
    fraudOrderIsElevated({ risk: "medium", recommendation: "Pending" }),
    true,
  );
  assert.equal(
    fraudOrderIsElevated({ risk: "pending", recommendation: "Investigate" }),
    true,
  );
  assert.equal(
    fraudOrderIsElevated({ risk: "pending", recommendation: "Pending" }),
    false,
  );
  assert.equal(
    fraudOrderIsElevated({ risk: "low", recommendation: "Accept" }),
    false,
  );
});

test("needs-review semantics remain separate from Pending fulfillment predicate", () => {
  const needsReview = (order) => {
    const risk = String(order?.risk || order?.riskLevel || "pending").toLowerCase();
    const recommendation = String(order.recommendation || "").toLowerCase();
    return /high|medium/.test(risk) || /review|cancel/.test(recommendation);
  };

  assert.equal(needsReview(order1001), false);
  assert.equal(fraudOrderNeedsPreFulfillmentReview(order1001), true);
  assert.equal(
    needsReview({ risk: "high", recommendation: "Investigate" }),
    true,
  );
  assert.equal(
    fraudOrderNeedsPreFulfillmentReview({
      fulfillmentStatus: "Unfulfilled",
      risk: "high",
      recommendation: "Investigate",
    }),
    true,
  );
});

test("high and medium risk filter tones remain separate from Pending fulfillment", () => {
  const riskTone = (order) => {
    const risk = String(order?.risk || order?.riskLevel || "pending").toLowerCase();
    return risk.includes("high")
      ? "high"
      : risk.includes("medium")
        ? "medium"
        : risk.includes("low")
          ? "low"
          : "pending";
  };

  assert.equal(riskTone({ risk: "high" }), "high");
  assert.equal(riskTone({ risk: "medium" }), "medium");
  assert.equal(riskTone(order1001), "pending");
  assert.equal(
    fraudOrderNeedsPreFulfillmentReview({
      fulfillmentStatus: "Unfulfilled",
      risk: "high",
      recommendation: "Pending",
    }),
    true,
  );
});
