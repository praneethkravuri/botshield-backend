export const DIAGNOSTIC_CHECK_STATUS = {
  PASSED: "passed",
  NEEDS_ATTENTION: "needs_attention",
  UNAVAILABLE: "unavailable",
};

function makeCheck(id, name, status, detail = "") {
  return { id, name, status, detail };
}

export function deriveDiagnosticOverallStatus(checks) {
  if (!checks.length) {
    return {
      ok: false,
      overallStatus: DIAGNOSTIC_CHECK_STATUS.UNAVAILABLE,
      overallLabel: "Diagnostic checks could not be completed",
    };
  }

  if (checks.some((check) => check.status === DIAGNOSTIC_CHECK_STATUS.UNAVAILABLE)) {
    return {
      ok: false,
      overallStatus: DIAGNOSTIC_CHECK_STATUS.UNAVAILABLE,
      overallLabel: "Some checks could not be completed",
    };
  }

  if (
    checks.some((check) => check.status === DIAGNOSTIC_CHECK_STATUS.NEEDS_ATTENTION)
  ) {
    return {
      ok: false,
      overallStatus: DIAGNOSTIC_CHECK_STATUS.NEEDS_ATTENTION,
      overallLabel: "Some checks need attention",
    };
  }

  return {
    ok: true,
    overallStatus: DIAGNOSTIC_CHECK_STATUS.PASSED,
    overallLabel: "All checks passed",
  };
}

export function buildDatabaseCheck(databaseOk) {
  if (databaseOk) {
    return makeCheck(
      "database",
      "Database connection",
      DIAGNOSTIC_CHECK_STATUS.PASSED,
      "BotShield can read and write store data.",
    );
  }

  return makeCheck(
    "database",
    "Database connection",
    DIAGNOSTIC_CHECK_STATUS.UNAVAILABLE,
    "BotShield could not reach the application database.",
  );
}

export function buildProtectionSettingsCheck(settingsLoaded) {
  if (settingsLoaded) {
    return makeCheck(
      "protection_settings",
      "Protection settings",
      DIAGNOSTIC_CHECK_STATUS.PASSED,
      "Store protection settings loaded successfully.",
    );
  }

  return makeCheck(
    "protection_settings",
    "Protection settings",
    DIAGNOSTIC_CHECK_STATUS.UNAVAILABLE,
    "Protection settings could not be loaded.",
  );
}

export function buildProtectionActiveCheck(protectionStatus) {
  if (!protectionStatus) {
    return makeCheck(
      "protection_active",
      "Protection status",
      DIAGNOSTIC_CHECK_STATUS.UNAVAILABLE,
      "Protection status could not be verified.",
    );
  }

  if (protectionStatus.protectionPaused) {
    return makeCheck(
      "protection_active",
      "Protection status",
      DIAGNOSTIC_CHECK_STATUS.NEEDS_ATTENTION,
      "Protection is temporarily paused.",
    );
  }

  if (!protectionStatus.protectionActive) {
    return makeCheck(
      "protection_active",
      "Protection status",
      DIAGNOSTIC_CHECK_STATUS.NEEDS_ATTENTION,
      "Protection is not actively enforcing storefront decisions.",
    );
  }

  return makeCheck(
    "protection_active",
    "Protection status",
    DIAGNOSTIC_CHECK_STATUS.PASSED,
    "Protection is active and enforcing according to your settings.",
  );
}

import {
  STOREFRONT_REPORTING_FRESH_MS,
} from "./storefront-reporting.server.js";

export function buildStorefrontReportingCheck(protectionStatus) {
  if (!protectionStatus) {
    return makeCheck(
      "storefront_reporting",
      "Storefront reporting",
      DIAGNOSTIC_CHECK_STATUS.UNAVAILABLE,
      "Storefront reporting status could not be verified.",
    );
  }

  const freshMinutes = Math.round(STOREFRONT_REPORTING_FRESH_MS / (60 * 1000));

  if (protectionStatus.storefrontReportingActive) {
    return makeCheck(
      "storefront_reporting",
      "Storefront reporting",
      DIAGNOSTIC_CHECK_STATUS.PASSED,
      `BotShield recorded live storefront activity within the last ${freshMinutes} minutes.`,
    );
  }

  if (protectionStatus.lastStorefrontDecisionAt) {
    return makeCheck(
      "storefront_reporting",
      "Storefront reporting",
      DIAGNOSTIC_CHECK_STATUS.NEEDS_ATTENTION,
      `Storefront activity was recorded previously, but nothing new has been reported in the last ${freshMinutes} minutes.`,
    );
  }

  return makeCheck(
    "storefront_reporting",
    "Storefront reporting",
    DIAGNOSTIC_CHECK_STATUS.NEEDS_ATTENTION,
    "No live storefront activity has been recorded yet. Enable the theme app embed and visit your storefront.",
  );
}

export function buildDetectionEngineCheck(detectionResult) {
  if (detectionResult?.threatLevel && detectionResult?.actionTaken) {
    return makeCheck(
      "detection_engine",
      "Detection engine",
      DIAGNOSTIC_CHECK_STATUS.PASSED,
      `Engine evaluated a sample request (${detectionResult.threatLevel} risk, ${detectionResult.actionTaken}). No storefront event was recorded.`,
    );
  }

  return makeCheck(
    "detection_engine",
    "Detection engine",
    DIAGNOSTIC_CHECK_STATUS.UNAVAILABLE,
    "Detection engine could not evaluate a sample request.",
  );
}

export function buildEmailAlertsCheck(settings, emailProvider) {
  if (!settings) {
    return makeCheck(
      "email_alerts",
      "Email alerts",
      DIAGNOSTIC_CHECK_STATUS.UNAVAILABLE,
      "Email alert settings could not be verified.",
    );
  }

  if (!settings.emailAlerts) {
    return makeCheck(
      "email_alerts",
      "Email alerts",
      DIAGNOSTIC_CHECK_STATUS.PASSED,
      "Email alerts are disabled.",
    );
  }

  const hasValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.alertEmail || "");
  if (!emailProvider?.configured) {
    return makeCheck(
      "email_alerts",
      "Email alerts",
      DIAGNOSTIC_CHECK_STATUS.NEEDS_ATTENTION,
      "Email alerts are enabled but delivery is not configured on the server.",
    );
  }

  if (!hasValidEmail) {
    return makeCheck(
      "email_alerts",
      "Email alerts",
      DIAGNOSTIC_CHECK_STATUS.NEEDS_ATTENTION,
      "Email alerts are enabled but no valid alert email is saved.",
    );
  }

  return makeCheck(
    "email_alerts",
    "Email alerts",
    DIAGNOSTIC_CHECK_STATUS.PASSED,
    `Alerts are enabled for ${settings.alertEmail}.`,
  );
}

export function buildBillingCheck(billingConfig, billing) {
  if (!billingConfig.enforcementEnabled) {
    return makeCheck(
      "billing",
      "Billing subscription",
      DIAGNOSTIC_CHECK_STATUS.PASSED,
      "Billing enforcement is disabled for this environment.",
    );
  }

  if (!billing) {
    return makeCheck(
      "billing",
      "Billing subscription",
      DIAGNOSTIC_CHECK_STATUS.UNAVAILABLE,
      "Billing status could not be verified.",
    );
  }

  if (billing.active) {
    return makeCheck(
      "billing",
      "Billing subscription",
      DIAGNOSTIC_CHECK_STATUS.PASSED,
      "An active subscription allows storefront protection.",
    );
  }

  return makeCheck(
    "billing",
    "Billing subscription",
    DIAGNOSTIC_CHECK_STATUS.NEEDS_ATTENTION,
    billing.error || "No active subscription was found while billing enforcement is enabled.",
  );
}

export function getDiagnosticToastMessage(diagnostic) {
  if (!diagnostic) return "Diagnostic could not be completed.";
  if (diagnostic.overallStatus === DIAGNOSTIC_CHECK_STATUS.PASSED) {
    return "All diagnostic checks passed";
  }
  if (diagnostic.overallStatus === DIAGNOSTIC_CHECK_STATUS.NEEDS_ATTENTION) {
    return diagnostic.overallLabel || "Some diagnostic checks need attention";
  }
  return diagnostic.overallLabel || "Diagnostic could not be completed";
}
