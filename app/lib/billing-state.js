export const BOTSHIELD_BASIC_MONTHLY_PRICE = 29;
export const BOTSHIELD_BASIC_TRIAL_DAYS = 7;
export const BOTSHIELD_BASIC_PLAN_NAME = "BotShield Basic";

function asDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getLatestLifecycleEvent(events = []) {
  return [...events]
    .filter(
      (event) =>
        event &&
        (String(event.eventType || "").startsWith("SUBSCRIPTION_") ||
          event.state),
    )
    .sort(
      (left, right) =>
        (asDate(right.occurredAt)?.getTime() || 0) -
        (asDate(left.occurredAt)?.getTime() || 0),
    )[0] || null;
}

function getFlatRateAmount(item) {
  const amount = item?.price?.amount;
  const parsed = Number(amount);
  return Number.isFinite(parsed) ? parsed : null;
}

function inactiveLifecycleStatus(latestEvent, previousState, now) {
  const eventType = latestEvent?.eventType || "";
  const eventState = latestEvent?.state || "";

  if (
    eventType === "SUBSCRIPTION_FROZEN" ||
    eventState === "FROZEN"
  ) {
    return "frozen";
  }
  if (
    eventType === "SUBSCRIPTION_CANCELED" ||
    eventState === "CANCELED"
  ) {
    return "canceled";
  }

  const previousEnd = asDate(previousState?.currentPeriodEnd);
  if (
    previousState?.active === true &&
    previousEnd &&
    previousEnd.getTime() <= now.getTime()
  ) {
    return "expired";
  }

  return "inactive";
}

export function createUnavailableBillingState({
  checkedAt = new Date(),
  error = "Unable to verify Shopify subscription.",
  planHandle = "",
} = {}) {
  return {
    active: false,
    verified: false,
    status: "unavailable",
    planHandle,
    planName: "",
    subscriptionId: "",
    test: false,
    trial: false,
    trialEndsAt: null,
    cancelAtEndOfCycle: false,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    billingPeriod: null,
    latestEventType: null,
    latestEventAt: null,
    checkedAt: checkedAt.toISOString(),
    error,
  };
}

export function deriveBillingState({
  activeSubscription,
  lifecycleEvents = [],
  checkedAt = new Date(),
  requestedPlanHandle = "",
  configuredPublicPlanHandle = "basic",
  configuredTestPlanHandle = "",
  configuredPlanName = "BotShield Basic",
  previousState = null,
} = {}) {
  const now = checkedAt instanceof Date ? checkedAt : new Date(checkedAt);
  const latestEvent = getLatestLifecycleEvent(lifecycleEvents);

  if (!activeSubscription) {
    return {
      active: false,
      verified: true,
      status: inactiveLifecycleStatus(latestEvent, previousState, now),
      planHandle: requestedPlanHandle || previousState?.planHandle || "",
      planName: previousState?.planName || "",
      subscriptionId: "",
      test: false,
      trial: false,
      trialEndsAt: null,
      cancelAtEndOfCycle: false,
      currentPeriodStart: null,
      currentPeriodEnd: previousState?.currentPeriodEnd || null,
      billingPeriod: null,
      latestEventType: latestEvent?.eventType || null,
      latestEventAt: latestEvent?.occurredAt || null,
      checkedAt: now.toISOString(),
      error: null,
    };
  }

  const items = activeSubscription.items || [];
  const primaryItem = items[0] || null;
  const itemHandle = primaryItem?.handle || "";
  const planHandle = itemHandle || requestedPlanHandle;
  const knownPublicPlan =
    Boolean(configuredPublicPlanHandle) &&
    planHandle === configuredPublicPlanHandle;
  const knownTestPlan =
    Boolean(configuredTestPlanHandle) &&
    planHandle === configuredTestPlanHandle;
  const trialEndsAt = asDate(activeSubscription.trialEndsAt);
  const inTrial = Boolean(
    trialEndsAt && trialEndsAt.getTime() > now.getTime(),
  );
  const currentPeriodStart =
    activeSubscription.currentBillingCycle?.startTime || null;
  const currentPeriodEnd =
    activeSubscription.currentBillingCycle?.endTime ||
    activeSubscription.trialEndsAt ||
    null;
  const periodEndDate = asDate(currentPeriodEnd);
  const expired = Boolean(
    !inTrial && periodEndDate && periodEndDate.getTime() <= now.getTime(),
  );
  const cancelAtEndOfCycle =
    activeSubscription.cancelAtEndOfCycle === true;
  const latestState = latestEvent?.state || "";
  const frozen =
    latestEvent?.eventType === "SUBSCRIPTION_FROZEN" ||
    latestState === "FROZEN";
  const canceled =
    latestEvent?.eventType === "SUBSCRIPTION_CANCELED" ||
    latestState === "CANCELED";
  const zeroDollarPlan = items.some(
    (item) => getFlatRateAmount(item) === 0,
  );
  const test =
    zeroDollarPlan ||
    knownTestPlan;
  const knownPlan = knownPublicPlan || knownTestPlan;
  const handleMismatch =
    Boolean(requestedPlanHandle && itemHandle) &&
    requestedPlanHandle !== itemHandle;
  const active =
    !expired &&
    !frozen &&
    !canceled &&
    knownPlan &&
    !handleMismatch;

  let status = "active";
  if (!active) {
    status = frozen
      ? "frozen"
      : canceled
        ? "canceled"
        : expired
          ? "expired"
          : "invalid_plan";
  } else if (inTrial) {
    status = "trial";
  } else if (cancelAtEndOfCycle) {
    status = "canceling";
  }

  return {
    active,
    verified: true,
    status,
    planHandle,
    planName:
      primaryItem?.description ||
      previousState?.planName ||
      configuredPlanName,
    subscriptionId: activeSubscription.legacySubscriptionId || "",
    test,
    trial: inTrial,
    trialEndsAt: trialEndsAt?.toISOString() || null,
    cancelAtEndOfCycle,
    currentPeriodStart,
    currentPeriodEnd,
    billingPeriod: activeSubscription.billingPeriod || null,
    latestEventType: latestEvent?.eventType || null,
    latestEventAt: latestEvent?.occurredAt || null,
    checkedAt: now.toISOString(),
    error: !knownPlan
      ? `Unknown Shopify plan handle: ${planHandle || "missing"}`
      : handleMismatch
        ? "Shopify redirect plan handle did not match the active Partner API subscription."
        : null,
  };
}
