import test from "node:test";
import assert from "node:assert/strict";

import {
  createUnavailableBillingState,
  deriveBillingState,
} from "../app/lib/billing-state.js";
import { resolveStorefrontDecision } from "../app/lib/storefront-decision.server.js";

const now = new Date("2026-06-21T12:00:00.000Z");

function subscription(overrides = {}) {
  return {
    billingPeriod: "EVERY_30_DAYS",
    cancelAtEndOfCycle: false,
    trialEndsAt: null,
    legacySubscriptionId: "gid://shopify/AppSubscription/123",
    currentBillingCycle: {
      startTime: "2026-06-20T00:00:00.000Z",
      endTime: "2026-07-20T00:00:00.000Z",
    },
    items: [
      {
          handle: "basic",
          description: "BotShield Basic",
        price: {
          __typename: "FlatRatePrice",
          active: true,
          currency: "USD",
          amount: "14.99",
        },
      },
    ],
    ...overrides,
  };
}

test("active Partner API subscription enables billing", () => {
  const state = deriveBillingState({
    activeSubscription: subscription(),
    checkedAt: now,
  });

  assert.equal(state.active, true);
  assert.equal(state.verified, true);
  assert.equal(state.status, "active");
  assert.equal(state.planHandle, "basic");
  assert.equal(state.subscriptionId, "gid://shopify/AppSubscription/123");
});

test("private zero-dollar test plan is tracked without charging", () => {
  const state = deriveBillingState({
    activeSubscription: subscription({
      items: [
        {
          handle: "botshield-private-test",
          description: "BotShield Test",
          price: {
            __typename: "FlatRatePrice",
            active: true,
            currency: "USD",
            amount: "0.00",
          },
        },
      ],
    }),
    checkedAt: now,
    configuredTestPlanHandle: "botshield-private-test",
  });

  assert.equal(state.active, true);
  assert.equal(state.test, true);
  assert.equal(state.planHandle, "botshield-private-test");
});

test("canceled subscription is inactive", () => {
  const state = deriveBillingState({
    activeSubscription: null,
    lifecycleEvents: [
      {
        eventType: "SUBSCRIPTION_CANCELED",
        state: "CANCELED",
        occurredAt: "2026-06-21T11:00:00.000Z",
      },
    ],
    checkedAt: now,
    previousState: {
      active: true,
      planHandle: "basic",
      planName: "BotShield Basic",
      currentPeriodEnd: "2026-07-20T00:00:00.000Z",
    },
  });

  assert.equal(state.active, false);
  assert.equal(state.status, "canceled");
});

test("frozen subscription is inactive", () => {
  const state = deriveBillingState({
    activeSubscription: null,
    lifecycleEvents: [
      {
        eventType: "SUBSCRIPTION_FROZEN",
        state: "FROZEN",
        occurredAt: "2026-06-21T11:00:00.000Z",
      },
    ],
    checkedAt: now,
  });

  assert.equal(state.active, false);
  assert.equal(state.status, "frozen");
});

test("Partner API failure fails closed for billing enforcement", () => {
  const state = createUnavailableBillingState({
    checkedAt: now,
    error: "Partner API unavailable",
  });
  const decision = resolveStorefrontDecision({
    detection: { actionTaken: "blocked", threatLevel: "high" },
    blockedEntry: { active: true },
    billingEnforcementEnabled: true,
    billingActive: state.active,
  });

  assert.equal(state.active, false);
  assert.equal(state.verified, false);
  assert.equal(state.status, "unavailable");
  assert.equal(state.error, "Partner API unavailable");
  assert.equal(decision.decision, "allow");
  assert.ok(decision.reasonCodes.includes("BILLING_INACTIVE"));
});

test("active trial is tracked as an active subscription", () => {
  const state = deriveBillingState({
    activeSubscription: subscription({
      trialEndsAt: "2026-06-28T12:00:00.000Z",
      currentBillingCycle: null,
    }),
    checkedAt: now,
  });

  assert.equal(state.active, true);
  assert.equal(state.trial, true);
  assert.equal(state.status, "trial");
  assert.equal(state.currentPeriodEnd, "2026-06-28T12:00:00.000Z");
});

test("unpaid merchant has a verified inactive state", () => {
  const state = deriveBillingState({
    activeSubscription: null,
    lifecycleEvents: [],
    checkedAt: now,
  });

  assert.equal(state.active, false);
  assert.equal(state.verified, true);
  assert.equal(state.status, "inactive");
});

test("expired billing cycle cannot remain active", () => {
  const state = deriveBillingState({
    activeSubscription: subscription({
      currentBillingCycle: {
        startTime: "2026-05-20T00:00:00.000Z",
        endTime: "2026-06-20T00:00:00.000Z",
      },
    }),
    checkedAt: now,
  });

  assert.equal(state.active, false);
  assert.equal(state.status, "expired");
});

test("scheduled cancellation stays active only through its billing cycle", () => {
  const state = deriveBillingState({
    activeSubscription: subscription({
      cancelAtEndOfCycle: true,
    }),
    checkedAt: now,
  });

  assert.equal(state.active, true);
  assert.equal(state.cancelAtEndOfCycle, true);
  assert.equal(state.status, "canceling");
});

test("unknown active plan handle is rejected safely", () => {
  const state = deriveBillingState({
    activeSubscription: subscription({
      items: [
        {
          handle: "unknown-plan",
          description: "Unknown Plan",
          price: {
            __typename: "FlatRatePrice",
            active: true,
            currency: "USD",
            amount: "14.99",
          },
        },
      ],
    }),
    checkedAt: now,
    configuredPublicPlanHandle: "basic",
    configuredTestPlanHandle: "botshield-private-test",
  });

  assert.equal(state.active, false);
  assert.equal(state.status, "invalid_plan");
  assert.match(state.error, /unknown-plan/);
});

test("redirect handle cannot override authoritative Partner API handle", () => {
  const state = deriveBillingState({
    activeSubscription: subscription(),
    checkedAt: now,
    requestedPlanHandle: "unknown-plan",
    configuredPublicPlanHandle: "basic",
  });

  assert.equal(state.planHandle, "basic");
  assert.equal(state.active, false);
  assert.equal(state.status, "invalid_plan");
  assert.match(state.error, /did not match/);
});
