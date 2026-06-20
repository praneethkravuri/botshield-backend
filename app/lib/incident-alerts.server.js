const RESEND_ENDPOINT = "https://api.resend.com/emails";
const ALERT_TIMEOUT_MS = 4_000;
const ALERT_COOLDOWN_MS = 15 * 60 * 1000;

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getEmailProviderStatus() {
  const apiKeyConfigured = Boolean(process.env.RESEND_API_KEY?.trim());
  const fromEmailConfigured = isValidEmail(process.env.ALERT_FROM_EMAIL);

  return {
    provider: "resend",
    configured: apiKeyConfigured && fromEmailConfigured,
    apiKeyConfigured,
    fromEmailConfigured,
  };
}

export function shouldSendIncidentAlert({
  settings,
  decision,
  threatLevel,
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

  if (settings.highRiskAlertsOnly && !highRiskIncident) {
    return { send: false, reason: "HIGH_RISK_ONLY" };
  }

  if (!suspiciousIncident) {
    return { send: false, reason: "LOW_RISK_EVENT" };
  }

  const duplicateIncident = recentEvents.some((event) => {
    const createdAt = new Date(event.createdAt).getTime();
    if (!Number.isFinite(createdAt) || now - createdAt > ALERT_COOLDOWN_MS) {
      return false;
    }

    return (
      event.action === "blocked" ||
      event.action === "challenged" ||
      event.threatLevel === "high"
    );
  });

  if (duplicateIncident) {
    return { send: false, reason: "ALERT_COOLDOWN" };
  }

  return { send: true, reason: "INCIDENT_ALERT_REQUIRED" };
}

function buildIncidentHtml({
  shop,
  ipAddress,
  pathVisited,
  decision,
  threatLevel,
  riskScore,
  reasonCodes,
  eventId,
  createdAt,
}) {
  return `<!doctype html>
<html>
  <body style="font-family:Arial,sans-serif;background:#f8fafc;color:#0f172a;padding:24px">
    <div style="max-width:640px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px">
      <h1 style="margin-top:0">BotShield security incident</h1>
      <p>BotShield recorded a high-risk storefront decision for <strong>${escapeHtml(shop)}</strong>.</p>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px 0;color:#64748b">Decision</td><td><strong>${escapeHtml(decision)}</strong></td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Threat level</td><td>${escapeHtml(threatLevel)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Risk score</td><td>${escapeHtml(riskScore)}/100</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">IP address</td><td>${escapeHtml(ipAddress)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Path</td><td>${escapeHtml(pathVisited)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Reason codes</td><td>${escapeHtml(reasonCodes.join(", "))}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Event ID</td><td>${escapeHtml(eventId)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Time</td><td>${escapeHtml(createdAt)}</td></tr>
      </table>
      <p style="margin-bottom:0;color:#64748b;font-size:13px">This alert contains observed security telemetry only. It does not estimate revenue impact.</p>
    </div>
  </body>
</html>`;
}

export async function sendIncidentEmail(input) {
  const providerStatus = getEmailProviderStatus();
  if (!providerStatus.configured) {
    return { sent: false, status: "provider_not_configured" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ALERT_TIMEOUT_MS);

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.ALERT_FROM_EMAIL.trim(),
        to: [input.alertEmail.trim()],
        subject: `[BotShield] ${input.decision.toUpperCase()} incident on ${input.shop}`,
        html: buildIncidentHtml(input),
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        sent: false,
        status: "provider_error",
        providerStatus: response.status,
        error: payload?.message || "Email provider rejected the request.",
      };
    }

    return {
      sent: true,
      status: "sent",
      providerMessageId: payload?.id || null,
    };
  } catch (error) {
    return {
      sent: false,
      status: error?.name === "AbortError" ? "timeout" : "delivery_error",
      error: error instanceof Error ? error.message : "Email delivery failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendTestIncidentEmail({ shop, alertEmail }) {
  return sendIncidentEmail({
    shop,
    alertEmail,
    ipAddress: "Test notification",
    pathVisited: "/",
    decision: "test",
    threatLevel: "test",
    riskScore: 0,
    reasonCodes: ["TEST_ALERT"],
    eventId: "TEST",
    createdAt: new Date().toISOString(),
  });
}
