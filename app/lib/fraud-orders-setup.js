export function getFraudOrdersSetupState({ connected, errorCode } = {}) {
  const orderPermissionConnected = Boolean(connected);
  const protectedDataBlocked = errorCode === "protected_customer_data";
  const queueReady = orderPermissionConnected && errorCode === null;

  let protectedDataStatus = "waiting";
  let protectedDataLabel = "Waiting";
  if (!orderPermissionConnected) {
    protectedDataStatus = "waiting";
    protectedDataLabel = "Waiting";
  } else if (protectedDataBlocked) {
    protectedDataStatus = "required";
    protectedDataLabel = "Approval required";
  } else if (errorCode === null) {
    protectedDataStatus = "complete";
    protectedDataLabel = "Approved";
  } else {
    protectedDataStatus = "waiting";
    protectedDataLabel = "Waiting";
  }

  const steps = [
    {
      key: "installed",
      title: "BotShield installed",
      detail: "Running inside Shopify Admin.",
      status: "complete",
      statusLabel: "Complete",
    },
    {
      key: "access",
      title: "Connect order access",
      detail: orderPermissionConnected
        ? "BotShield can request supported Shopify order-risk information for this store."
        : "Allow BotShield to read supported Shopify order-risk information.",
      status: orderPermissionConnected ? "complete" : "required",
      statusLabel: orderPermissionConnected ? "Connected" : "Required",
      active: !orderPermissionConnected,
    },
    {
      key: "approval",
      title: "Shopify data approval",
      detail: protectedDataBlocked
        ? "Shopify must approve protected customer data access for BotShield."
        : orderPermissionConnected
          ? "Shopify protected customer data access is required for order-risk data."
          : "Available after order access is connected.",
      status:
        protectedDataStatus === "complete"
          ? "complete"
          : protectedDataStatus === "required"
            ? "required"
            : "waiting",
      statusLabel: protectedDataLabel,
      active: orderPermissionConnected && protectedDataBlocked,
    },
    {
      key: "queue",
      title: "Review queue ready",
      detail: queueReady
        ? "Risky orders from Shopify appear here for review."
        : protectedDataBlocked
          ? "The review queue opens after Shopify grants protected customer data access."
          : "Risky orders will appear here when Fraud Orders is fully ready.",
      status: queueReady ? "complete" : "waiting",
      statusLabel: queueReady ? "Ready" : "Not ready",
    },
  ];

  const completedSteps = steps.filter((step) => step.status === "complete").length;

  let introCopy =
    "Connect order access so BotShield can read supported Shopify order-risk information.";
  let summaryTitle = "Order risk access required";
  let summaryDetail =
    "BotShield will need access to supported Shopify order-risk information.";

  if (orderPermissionConnected && protectedDataBlocked) {
    introCopy =
      "Order permission is connected, but Shopify hasn't approved protected customer data access for BotShield yet. Fraud Orders will become available after Shopify grants access.";
    summaryTitle = "Shopify approval required";
    summaryDetail =
      "Order permission is connected. Waiting for Shopify protected customer data approval.";
  } else if (queueReady) {
    introCopy = "Fraud Orders is ready. Review supported Shopify order-risk data below.";
    summaryTitle = "Fraud Orders ready";
    summaryDetail = "Order review is connected and Shopify order-risk data is available.";
  } else if (orderPermissionConnected) {
    introCopy =
      "Order access is connected. Refresh Fraud Orders once Shopify order-risk data is available.";
    summaryTitle = "Order risk connected";
    summaryDetail = "Waiting for Shopify order-risk data to become available.";
  }

  return {
    steps,
    completedSteps,
    totalSteps: steps.length,
    introCopy,
    summaryTitle,
    summaryDetail,
    queueReady,
    orderPermissionConnected,
    protectedDataBlocked,
  };
}
