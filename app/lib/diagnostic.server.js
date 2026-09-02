import db from "../db.server";
import { detectBotThreat } from "./bot-detection.server";
import { getAppSettings, getProtectionStatus } from "./bot-control.server";
import {
  getBillingConfiguration,
  readCachedBillingStatus,
} from "./billing.server";
import { getEmailProviderStatus } from "./email.server.js";
import {
  buildBillingCheck,
  buildDatabaseCheck,
  buildDetectionEngineCheck,
  buildEmailAlertsCheck,
  buildProtectionActiveCheck,
  buildProtectionSettingsCheck,
  buildStorefrontReportingCheck,
  deriveDiagnosticOverallStatus,
} from "./diagnostic-checks.server.js";

export {
  DIAGNOSTIC_CHECK_STATUS,
  buildBillingCheck,
  buildDatabaseCheck,
  buildDetectionEngineCheck,
  buildEmailAlertsCheck,
  buildProtectionActiveCheck,
  buildProtectionSettingsCheck,
  buildStorefrontReportingCheck,
  deriveDiagnosticOverallStatus,
  getDiagnosticToastMessage,
} from "./diagnostic-checks.server.js";

export async function runShopDiagnostic(shop) {
  const checks = [];
  const ranAt = new Date().toISOString();
  let settings = null;
  let protectionStatus = null;

  let databaseOk = false;
  try {
    await db.$queryRaw`SELECT 1`;
    databaseOk = true;
  } catch {
    databaseOk = false;
  }
  checks.push(buildDatabaseCheck(databaseOk));

  try {
    settings = await getAppSettings(shop);
    checks.push(buildProtectionSettingsCheck(true));
  } catch {
    checks.push(buildProtectionSettingsCheck(false));
  }

  try {
    protectionStatus = await getProtectionStatus(shop);
    checks.push(buildProtectionActiveCheck(protectionStatus));
    checks.push(buildStorefrontReportingCheck(protectionStatus));
  } catch {
    checks.push(buildProtectionActiveCheck(null));
    checks.push(buildStorefrontReportingCheck(null));
  }

  let detectionResult = null;
  try {
    detectionResult = detectBotThreat({
      ipAddress: "203.0.113.10",
      userAgent: "BotShield-Diagnostic/1.0",
      pathVisited: "/",
      recentEvents: [],
      settings: settings || {},
      whitelistEntry: null,
      blockedEntry: null,
    });
  } catch {
    detectionResult = null;
  }
  checks.push(buildDetectionEngineCheck(detectionResult));

  checks.push(buildEmailAlertsCheck(settings, getEmailProviderStatus()));

  const billingConfig = getBillingConfiguration(shop);
  let billing = null;
  try {
    billing = await readCachedBillingStatus(shop);
  } catch {
    billing = null;
  }
  checks.push(buildBillingCheck(billingConfig, billing));

  const overall = deriveDiagnosticOverallStatus(checks);

  return {
    ...overall,
    ranAt,
    checks,
  };
}
