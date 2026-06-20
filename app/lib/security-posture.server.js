import db from "../db.server";
import { getAppSettings, getProtectionStatus } from "./bot-control.server";
import {
  buildWeeklyReportFromEvents,
  calculateSecurityScore,
} from "./security-posture";

export async function buildWeeklySecurityReport(shop, now = new Date()) {
  const end = new Date(now);
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [events, status, settings] = await Promise.all([
    db.botEvent.findMany({
      where: {
        shop,
        source: "storefront-proxy",
        createdAt: { gte: start, lt: end },
      },
      orderBy: { createdAt: "desc" },
    }),
    getProtectionStatus(shop),
    getAppSettings(shop),
  ]);

  return buildWeeklyReportFromEvents({ events, status, settings, start, end });
}

export async function getMerchantSecurityPosture(shop) {
  const [status, settings, report] = await Promise.all([
    getProtectionStatus(shop),
    getAppSettings(shop),
    buildWeeklySecurityReport(shop),
  ]);
  const reportsEnabled = settings.weeklyReportsEnabled === true;
  return {
    status,
    settings,
    report,
    score: calculateSecurityScore({
      status,
      settings,
      report,
      reportsEnabled,
    }),
    checklist: [
      { key: "app", label: "App installed", complete: status.appInstalled },
      {
        key: "embed",
        label: "Theme embed enabled",
        complete: status.themeEmbedDetected,
      },
      {
        key: "connected",
        label: "Storefront connected",
        complete: Boolean(status.lastStorefrontDecisionAt),
      },
      {
        key: "events",
        label: "Events received",
        complete: report.requestsAnalyzed > 0,
      },
      {
        key: "protection",
        label: "Protection active",
        complete: status.protectionActive,
      },
      {
        key: "alerts",
        label: "Alerting configured",
        complete: report.alertsConfigured,
      },
      {
        key: "reports",
        label: "Weekly reports configured",
        complete: reportsEnabled,
      },
    ],
  };
}
