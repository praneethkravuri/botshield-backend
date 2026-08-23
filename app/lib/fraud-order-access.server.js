export const FRAUD_ORDER_READ_SCOPE = "read_orders";

export function parseAccessScopes(scope) {
  if (!scope) return [];
  return String(scope)
    .split(/[,\s]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function hasFraudOrderReadAccess(scope) {
  return parseAccessScopes(scope).includes(FRAUD_ORDER_READ_SCOPE);
}
