import db from "../db.server";
import { getAppSettings } from "./bot-control.server";
import { sendWeeklySecurityReportEmail } from "./incident-alerts.server";
import { buildWeeklySecurityReport } from "./security-posture.server";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

async function saveReportStatus(shop, delivery, sentAt = new Date()) {
  const values = {
    lastWeeklyReportAttemptAt: sentAt.toISOString(),
    lastWeeklyReportStatus: delivery.status,
    lastWeeklyReportProviderMessageId: delivery.providerMessageId || "",
    lastWeeklyReportError: delivery.error || "",
    ...(delivery.sent ? { lastWeeklyReportAt: sentAt.toISOString() } : {}),
  };
  await db.$transaction(
    Object.entries(values).map(([key, value]) =>
      db.appSetting.upsert({
        where: { shop_key: { shop, key } },
        create: { shop, key, value },
        update: { value },
      }),
    ),
  );
}

export async function sendWeeklySecurityReport(shop) {
  const [settings, report] = await Promise.all([
    getAppSettings(shop),
    buildWeeklySecurityReport(shop),
  ]);

  if (!settings.weeklyReportsEnabled) {
    return { sent: false, status: "weekly_reports_disabled", report };
  }
  if (!settings.alertEmail) {
    return { sent: false, status: "alert_email_missing", report };
  }

  const delivery = await sendWeeklySecurityReportEmail({
    shop,
    alertEmail: settings.alertEmail,
    report,
  });
  await saveReportStatus(shop, delivery);
  console.log(
    `[botshield-weekly-report] shop=${shop} status=${delivery.status} sent=${delivery.sent} requests=${report.requestsAnalyzed} blocked=${report.blocked} challenged=${report.challenged}`,
  );
  return { ...delivery, report };
}

export async function maybeSendDueWeeklyReport(shop, now = new Date()) {
  const settings = await getAppSettings(shop);
  if (!settings.weeklyReportsEnabled) {
    return { sent: false, status: "weekly_reports_disabled" };
  }

  const lastSent = settings.lastWeeklyReportAt
    ? new Date(settings.lastWeeklyReportAt).getTime()
    : 0;
  if (Number.isFinite(lastSent) && now.getTime() - lastSent < WEEK_MS) {
    return { sent: false, status: "not_due" };
  }
  const lastAttempt = settings.lastWeeklyReportAttemptAt
    ? new Date(settings.lastWeeklyReportAttemptAt).getTime()
    : 0;
  if (
    Number.isFinite(lastAttempt) &&
    now.getTime() - lastAttempt < 24 * 60 * 60 * 1000
  ) {
    return { sent: false, status: "attempt_cooldown" };
  }

  return sendWeeklySecurityReport(shop);
}
