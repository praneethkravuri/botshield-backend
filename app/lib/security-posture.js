import { extractReasonCodes } from "./security-events.js";

function countBy(items, selector) {
  const counts = new Map();
  for (const item of items) {
    const key = selector(item);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export function buildWeeklyReportFromEvents({
  events,
  status,
  settings,
  start,
  end,
}) {
  const allReasonCodes = events.flatMap((event) =>
    extractReasonCodes(event.reasonSummary),
  );
  return {
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    requestsAnalyzed: events.length,
    allowed: events.filter((event) =>
      ["allowed", "whitelisted"].includes(event.action),
    ).length,
    challenged: events.filter((event) => event.action === "challenged").length,
    blocked: events.filter((event) => event.action === "blocked").length,
    topThreats: countBy(
      events.filter((event) => event.threatLevel !== "low"),
      (event) => event.threatLevel,
    ).slice(0, 5),
    topReasonCodes: countBy(allReasonCodes, (code) => code).slice(0, 8),
    protectionActive: status.protectionActive,
    themeEmbedDetected: status.themeEmbedDetected,
    alertsConfigured:
      settings.emailAlerts &&
      settings.emailProvider.configured &&
      Boolean(settings.alertEmail),
  };
}

export function calculateSecurityScore({
  status,
  settings,
  report,
  reportsEnabled,
}) {
  const reportsOperational =
    reportsEnabled &&
    settings.emailAlerts &&
    settings.emailProvider.configured &&
    Boolean(settings.alertEmail);
  const factors = [
    { key: "app", label: "Shopify app installed", points: 10, earned: status.appInstalled ? 10 : 0 },
    { key: "embed", label: "Theme embed active", points: 20, earned: status.themeEmbedDetected ? 20 : 0 },
    { key: "traffic", label: "Storefront connected", points: 15, earned: status.lastStorefrontDecisionAt ? 15 : 0 },
    { key: "protection", label: "Protection active", points: 25, earned: status.protectionActive ? 25 : 0 },
    {
      key: "alerts",
      label: "Email alerting configured",
      points: 15,
      earned:
        settings.emailAlerts &&
        settings.emailProvider.configured &&
        settings.alertEmail
          ? 15
          : 0,
    },
    { key: "reports", label: "Weekly reports operational", points: 10, earned: reportsOperational ? 10 : 0 },
    { key: "evidence", label: "Real security evidence received", points: 5, earned: report.requestsAnalyzed > 0 ? 5 : 0 },
  ];
  const score = factors.reduce((total, factor) => total + factor.earned, 0);
  return {
    score,
    grade:
      score >= 90
        ? "Excellent"
        : score >= 75
          ? "Strong"
          : score >= 55
            ? "Needs attention"
            : "Setup incomplete",
    factors,
    suggestions: factors
      .filter((factor) => factor.earned < factor.points)
      .map((factor) => `Complete: ${factor.label}`),
  };
}
