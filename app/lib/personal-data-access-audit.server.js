const ACCESS_LOG_PREFIX = "[botshield-access-audit]";

function writeAccessRecord(record) {
  console.log(
    ACCESS_LOG_PREFIX,
    JSON.stringify({
      timestamp: new Date().toISOString(),
      ...record,
    }),
  );
}

export function logPersonalDataAccess({
  shop,
  resource,
  operation,
  success,
  errorCode = null,
  actor = "merchant_session",
}) {
  writeAccessRecord({
    event: "personal_data_access",
    shop: shop || "unknown",
    resource,
    operation,
    success: Boolean(success),
    errorCode,
    actor,
  });
}

export function logComplianceWebhook({
  shop,
  topic,
  outcome = "acknowledged",
  detail = null,
}) {
  writeAccessRecord({
    event: "compliance_webhook",
    shop: shop || "unknown",
    topic: topic || "unknown",
    outcome,
    detail,
  });
}
