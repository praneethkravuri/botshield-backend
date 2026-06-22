const RESEND_ENDPOINT = "https://api.resend.com/emails";
const EMAIL_TIMEOUT_MS = 4_000;
const DEFAULT_FROM_EMAIL = "BotShield <support@botshieldapp.com>";

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function isValidSender(value) {
  const normalized = String(value || "").trim();
  const bracketed = normalized.match(/<([^>]+)>$/);
  return isValidEmail(bracketed ? bracketed[1] : normalized);
}

export function getResendFromEmail() {
  const configuredSender = process.env.ALERT_FROM_EMAIL?.trim();
  return isValidSender(configuredSender)
    ? configuredSender
    : DEFAULT_FROM_EMAIL;
}

export function getEmailProviderStatus() {
  const apiKeyConfigured = Boolean(process.env.RESEND_API_KEY?.trim());
  const fromEmail = getResendFromEmail();

  return {
    provider: "resend",
    configured: apiKeyConfigured && isValidSender(fromEmail),
    apiKeyConfigured,
    fromEmailConfigured: isValidSender(fromEmail),
    fromEmail,
    usingDefaultSender: !isValidSender(process.env.ALERT_FROM_EMAIL),
  };
}

export async function sendEmail({ to, subject, html, text }) {
  const recipient = String(to || "").trim();
  if (!isValidEmail(recipient)) {
    return { sent: false, status: "invalid_recipient" };
  }

  const providerStatus = getEmailProviderStatus();
  if (!providerStatus.configured) {
    return { sent: false, status: "provider_not_configured" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EMAIL_TIMEOUT_MS);

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: providerStatus.fromEmail,
        to: [recipient],
        subject,
        html,
        ...(text ? { text } : {}),
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
