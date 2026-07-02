const STATUS_MAP = {
  active: {
    label: "Active",
    tone: "success",
    description: "Protection is active.",
  },
  inactive: {
    label: "Inactive",
    tone: "neutral",
    description: "This feature is not active.",
  },
  paused: {
    label: "Paused",
    tone: "warning",
    description: "Protection is temporarily paused.",
  },
  monitoring_only: {
    label: "Monitoring only",
    tone: "warning",
    description: "Traffic is recorded without automated blocking.",
  },
  setup_required: {
    label: "Setup required",
    tone: "warning",
    description: "Complete setup to activate this feature.",
  },
  theme_embed_missing: {
    label: "Theme embed not connected",
    tone: "warning",
    description: "Enable the theme app embed to receive storefront traffic.",
  },
  theme_embed_connected: {
    label: "Theme embed connected",
    tone: "success",
    description: "BotShield is connected to the storefront.",
  },
  provider_connected: {
    label: "Email provider connected",
    tone: "success",
    description: "BotShield can send merchant email.",
  },
  provider_not_configured: {
    label: "Email provider not configured",
    tone: "warning",
    description: "Add a Resend API key and verify the sending domain.",
  },
  provider_error: {
    label: "Email delivery error",
    tone: "critical",
    description: "The email provider rejected the most recent request.",
  },
  sent: {
    label: "Sent",
    tone: "success",
    description: "The message was accepted for delivery.",
  },
  test_sent: {
    label: "Test sent",
    tone: "success",
    description: "The test email was accepted for delivery.",
  },
  test_failed: {
    label: "Test failed",
    tone: "critical",
    description: "The test email could not be sent.",
  },
  trial: {
    label: "Trial",
    tone: "info",
    description: "The merchant is currently in a trial period.",
  },
  test_plan: {
    label: "Test plan",
    tone: "info",
    description: "A private reviewer or development plan is active.",
  },
  canceled: {
    label: "Canceled",
    tone: "critical",
    description: "The subscription has been canceled.",
  },
  frozen: {
    label: "Frozen",
    tone: "critical",
    description: "Shopify has frozen this subscription.",
  },
  verification_failed: {
    label: "Billing could not be verified",
    tone: "critical",
    description: "BotShield could not confirm the Shopify subscription.",
  },
  enforcement_disabled: {
    label: "Billing enforcement disabled",
    tone: "warning",
    description: "Billing enforcement remains disabled during launch testing.",
  },
  allowed: {
    label: "Allowed",
    tone: "success",
    description: "The request was allowed.",
  },
  blocked: {
    label: "Blocked",
    tone: "critical",
    description: "The request was blocked.",
  },
  challenged: {
    label: "Verification requested",
    tone: "warning",
    description: "The visitor was asked to complete a challenge.",
  },
  high: {
    label: "High risk",
    tone: "critical",
    description: "The request matched high-risk signals.",
  },
  medium: {
    label: "Medium risk",
    tone: "warning",
    description: "The request matched suspicious signals.",
  },
  low: {
    label: "Low risk",
    tone: "success",
    description: "The request had a low risk score.",
  },
  real_storefront: {
    label: "Real storefront",
    tone: "info",
    description: "This event came from the storefront app proxy.",
  },
  diagnostic: {
    label: "Diagnostic",
    tone: "neutral",
    description: "This event was created by a diagnostic scan.",
  },
  simulation: {
    label: "Simulation",
    tone: "neutral",
    description: "This event was simulated and excluded from production metrics.",
  },
  healthy: {
    label: "Healthy",
    tone: "success",
    description: "The service is operating normally.",
  },
  degraded: {
    label: "Needs attention",
    tone: "warning",
    description: "One or more checks need attention.",
  },
  pending: {
    label: "Pending",
    tone: "info",
    description: "This status is still being verified.",
  },
  unknown: {
    label: "Unknown",
    tone: "neutral",
    description: "Status is not available.",
  },
};

export function getUiStatus(status) {
  const key = String(status || "unknown").trim().toLowerCase();
  return {
    technicalStatus: key,
    ...(STATUS_MAP[key] || {
      label: key
        .replaceAll("_", " ")
        .replace(/\b\w/g, (character) => character.toUpperCase()),
      tone: "neutral",
      description: "Status information is available in the technical details.",
    }),
  };
}

export function getEventSourceStatus(source) {
  if (["storefront", "storefront-proxy"].includes(source)) {
    return getUiStatus("real_storefront");
  }
  if (String(source || "").includes("simulation")) return getUiStatus("simulation");
  return getUiStatus("diagnostic");
}

export function getEmailStatus({ configured, lastStatus }) {
  if (!configured) return getUiStatus("provider_not_configured");
  if (lastStatus === "sent") return getUiStatus("sent");
  if (lastStatus && ["provider_error", "delivery_error", "timeout"].includes(lastStatus)) {
    return getUiStatus("provider_error");
  }
  return getUiStatus("provider_connected");
}

export function getBillingStatusModel(billing) {
  if (!billing?.configured) return getUiStatus("setup_required");
  if (billing?.verificationError) return getUiStatus("verification_failed");
  if (billing?.subscription?.isTest) return getUiStatus("test_plan");
  if (billing?.subscription?.trialDaysRemaining > 0) return getUiStatus("trial");
  if (billing?.active) return getUiStatus("active");
  return getUiStatus(billing?.subscription?.status || "inactive");
}
