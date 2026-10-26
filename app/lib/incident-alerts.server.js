import { getEmailProviderStatus, sendEmail } from "./email.server.js";
import { buildEmailDashboardUrl, renderSecurityAlertEmail, renderTestNotificationEmail, renderWeeklyReportEmail } from "./merchant-email-templates.js";

const ALERT_COOLDOWN_MS = 15 * 60 * 1000;

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

export { getEmailProviderStatus };

export function shouldSendIncidentAlert({
  settings,
  decision,
  threatLevel,
  pathVisited = "",
  recentEvents = [],
  now = Date.now(),
}) {
  if (!settings?.emailAlerts) {
    return { send: false, reason: "EMAIL_ALERTS_DISABLED" };
  }

  if (!isValidEmail(settings.alertEmail)) {
    return { send: false, reason: "ALERT_EMAIL_MISSING" };
  }

  const highRiskIncident =
    threatLevel === "high" || decision === "block";
  const suspiciousIncident =
    highRiskIncident || decision === "challenge" || threatLevel === "medium";

  if (!suspiciousIncident) {
    return { send: false, reason: "LOW_RISK_EVENT" };
  }

  const expectedAction =
    decision === "block"
      ? "blocked"
      : decision === "challenge"
        ? "challenged"
        : null;
  const duplicateIncident = recentEvents.some((event) => {
    const createdAt = new Date(event.createdAt).getTime();
    if (!Number.isFinite(createdAt) || now - createdAt > ALERT_COOLDOWN_MS) {
      return false;
    }

    const samePath =
      !pathVisited || !event.path || String(event.path) === String(pathVisited);
    const sameIncidentType = expectedAction
      ? event.action === expectedAction
      : event.threatLevel === threatLevel;
    return samePath && sameIncidentType;
  });

  if (duplicateIncident) {
    return { send: false, reason: "ALERT_COOLDOWN" };
  }

  return { send: true, reason: "INCIDENT_ALERT_REQUIRED" };
}

export async function sendIncidentEmail(input) {
  const content = renderSecurityAlertEmail({
    ...input,
    dashboardUrl: buildEmailDashboardUrl(input.shop, process.env.SHOPIFY_APP_HANDLE),
  });
  return sendEmail({
    to: input.alertEmail,
    subject: `[BotShield] ${input.decision.toUpperCase()} incident on ${input.shop}`,
    ...content,
  });
}

export async function sendWeeklySecurityReportEmail({ shop, alertEmail, report }) {
  const content = renderWeeklyReportEmail({
    shop,
    report,
    dashboardUrl: buildEmailDashboardUrl(shop, process.env.SHOPIFY_APP_HANDLE),
  });
  return sendEmail({
    to: alertEmail,
    subject: `[BotShield] Weekly security report for ${shop}`,
    ...content,
  });
}

export async function sendTestIncidentEmail({ shop, alertEmail }) {
  return sendEmail({
    to: alertEmail,
    // Preserve the established subject and delivery contract; the body is test-only.
    subject: `[BotShield] TEST incident on ${shop}`,
    ...renderTestNotificationEmail({ shop }),
  });
}
