export function fraudOrderIsPendingFulfillment(order) {
  const status = String(order?.fulfillmentStatus || "").toLowerCase();
  return !status || /unfulfilled|partial|pending|on hold|not fulfilled/.test(status);
}

export function fraudOrderIsElevated(order) {
  const risk = String(order?.risk || order?.riskLevel || "pending").toLowerCase();
  const recommendation = String(order?.recommendation || "").toLowerCase();
  return /high|medium/.test(risk) || /review|cancel|investigate/.test(recommendation);
}

export function fraudOrderHasUnresolvedAssessment(order) {
  if (!order || typeof order !== "object") return false;
  const risk = String(order.risk || order.riskLevel || "pending").toLowerCase();
  const recommendation = String(order.recommendation || "").trim().toLowerCase();
  if (risk !== "pending") return false;
  return !recommendation || recommendation === "pending" || recommendation === "none";
}

export function fraudOrderNeedsPreFulfillmentReview(order) {
  return (
    fraudOrderIsPendingFulfillment(order) &&
    (fraudOrderIsElevated(order) || fraudOrderHasUnresolvedAssessment(order))
  );
}
