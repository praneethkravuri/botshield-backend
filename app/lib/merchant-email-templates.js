import { formatReasonCodeChip } from "./simulation-result.js";

// Email-only presentation. All values come from the existing report/event payloads.
export const EMAIL_LOGO_URL = "https://botshield-backend.onrender.com/botshield-official-logo-transparent.png";
const SUPPORT = "support@botshieldapp.com";
const font = "font-family:Arial,Helvetica,sans-serif;";
const wrap = "word-wrap:break-word;overflow-wrap:anywhere;word-break:break-word;";
const ink = "#172b49";
const muted = "#53647c";

export function escapeEmailHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
const e = escapeEmailHtml;
const present = value => value !== undefined && value !== null && String(value).trim() !== "";
const count = value => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const reasonLabel = value => /^[A-Z][A-Z0-9_]*$/.test(String(value)) ? formatReasonCodeChip(value) : String(value);
const number = value => new Intl.NumberFormat("en-US").format(value);
const paragraph = text => `<p class="bs-muted" style="margin:0 0 20px;${font}font-size:15px;line-height:24px;color:${muted};${wrap}">${e(text)}</p>`;
const heading = text => `<h2 class="bs-ink" style="margin:26px 0 12px;${font}font-size:17px;line-height:24px;color:${ink};">${e(text)}</h2>`;

// Match the existing Shopify Admin app-route convention, using existing config only.
export function buildEmailDashboardUrl(shop, appHandle) {
  const store = String(shop || "").trim().toLowerCase().match(/^([a-z0-9][a-z0-9-]*)\.myshopify\.com$/);
  const handle = String(appHandle || "").trim();
  if (!store || !/^[a-z0-9][a-z0-9_-]*$/i.test(handle)) return "";
  return `https://admin.shopify.com/store/${store[1]}/apps/${encodeURIComponent(handle)}/app`;
}

function safeDashboardUrl(value) {
  try {
    const url = new URL(value);
    return url.origin === "https://admin.shopify.com" && !url.username && !url.password && !url.search && !url.hash &&
      /^\/store\/[a-z0-9][a-z0-9-]*\/apps\/[a-z0-9][a-z0-9_-]*\/app$/i.test(url.pathname) ? url.href : "";
  } catch { return ""; }
}

function date(value) {
  if (!present(value)) return "";
  if (!(value instanceof Date) && (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value))) return "";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZone: "UTC" }).format(parsed) + " UTC";
}

function detailRows(rows) {
  const available = rows.filter(([, value]) => present(value));
  return available.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;table-layout:fixed;border-collapse:collapse;">${available.map(([label, value]) => `<tr><td class="bs-muted" width="37%" valign="top" style="padding:12px 10px 12px 0;border-bottom:1px solid #e5eaf1;${font}font-size:13px;line-height:21px;color:${muted};${wrap}">${e(label)}</td><td class="bs-ink" valign="top" style="padding:12px 0;border-bottom:1px solid #e5eaf1;${font}font-size:14px;line-height:21px;color:${ink};${wrap}">${e(value)}</td></tr>`).join("")}</table>` : "";
}

function layout({ kind, label, title, preheader, shop, body, lines, dashboardUrl, note }) {
  const url = safeDashboardUrl(dashboardUrl);
  const cta = url ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px;"><tr><td bgcolor="#245bdb" style="border-radius:8px;mso-padding-alt:14px 20px;"><a href="${e(url)}" style="display:inline-block;padding:14px 20px;${font}font-size:14px;line-height:20px;font-weight:bold;color:#ffffff;text-decoration:none;">Open BotShield Overview</a></td></tr></table>` : "";
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${e(label)} | BotShield</title>
<style>@media (prefers-color-scheme:dark){.bs-page{background-color:#111b2b!important}.bs-surface{background-color:#19273b!important}.bs-panel{background-color:#21324a!important}.bs-ink{color:#f0f4fc!important}.bs-muted{color:#c4d0e2!important}.bs-link{color:#9dbbff!important}.bs-pill{background-color:#293d59!important;color:#edf3ff!important}.bs-surface,.bs-panel,.bs-ink,.bs-muted{border-color:#354760!important}.bs-logo{background-color:#ffffff!important}.bs-severity-high{background-color:#492b30!important;color:#ffd9d3!important}.bs-severity-medium{background-color:#403619!important;color:#ffe4a3!important}.bs-severity-low{background-color:#223b5e!important;color:#d9e6ff!important}}</style></head>
<body class="bs-page" style="margin:0;padding:0;background-color:#f3f6fa;${font}-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${e(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f3f6fa" class="bs-page" style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:28px 12px;">
<!--[if mso]><table role="presentation" width="620" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bs-surface" bgcolor="#ffffff" data-email-template="${kind}" style="width:100%;max-width:620px;table-layout:fixed;border:1px solid #e0e7f0;border-radius:16px;border-collapse:separate;">
<tr><td style="padding:24px 22px 22px;border-bottom:1px solid #e5eaf1;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;table-layout:fixed;"><tr><td width="60" valign="middle"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td class="bs-logo" bgcolor="#ffffff" style="padding:6px;border-radius:10px;"><img src="${EMAIL_LOGO_URL}" width="39" height="48" alt="BotShield logo" style="display:block;width:39px;height:48px;border:0;"></td></tr></table></td><td valign="middle" style="padding-left:12px;${wrap}"><p class="bs-ink" style="margin:0;${font}font-size:20px;line-height:26px;font-weight:bold;color:${ink};">BotShield</p><p class="bs-muted" style="margin:4px 0 0;${font}font-size:12px;line-height:18px;color:${muted};">${e(label)}</p></td></tr></table></td></tr>
<tr><td style="padding:28px 22px 30px;${wrap}"><p class="bs-link" style="margin:0 0 12px;${font}font-size:11px;line-height:17px;font-weight:bold;letter-spacing:1px;color:#245bdb;text-transform:uppercase;">${e(label)}</p><h1 class="bs-ink" style="margin:0 0 18px;${font}font-size:29px;line-height:36px;letter-spacing:-0.5px;color:${ink};${wrap}">${e(title)}</h1>
${present(shop) ? `<p class="bs-muted" style="margin:0 0 24px;${font}font-size:13px;line-height:21px;color:${muted};${wrap}">Store<br><strong class="bs-ink" style="font-size:14px;color:${ink};">${e(shop)}</strong></p>` : ""}
${body}${cta}</td></tr>
<tr><td class="bs-panel" bgcolor="#f7f9fc" style="padding:22px;border-top:1px solid #e5eaf1;border-radius:0 0 16px 16px;${wrap}"><p class="bs-ink" style="margin:0 0 8px;${font}font-size:13px;line-height:20px;font-weight:bold;color:${ink};">BotShield Reports</p><p class="bs-muted" style="margin:0 0 10px;${font}font-size:12px;line-height:19px;color:${muted};">${e(note)}</p><p class="bs-muted" style="margin:0;${font}font-size:12px;line-height:20px;color:${muted};">Questions? Reply to this email or contact<br><a class="bs-link" href="mailto:${SUPPORT}" style="color:#245bdb;text-decoration:underline;">${SUPPORT}</a></p></td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
  const text = ["BotShield | " + label, title, present(shop) ? "Store: " + shop : "", ...lines, url ? "Open BotShield Overview: " + url : "", "BotShield Reports", note, "Questions? Reply to this email or contact " + SUPPORT].filter(present).join("\n\n");
  return { html, text };
}

function metricCards(metrics) {
  if (!metrics.length) return "";
  let html = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;table-layout:fixed;border-collapse:collapse;">';
  for (let i = 0; i < metrics.length; i += 2) {
    html += "<tr>" + metrics.slice(i, i + 2).map(([label, value]) => `<td width="50%" valign="top" style="padding:5px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bs-panel" bgcolor="#f5f8fd" style="width:100%;table-layout:fixed;border:1px solid #e1e8f3;border-radius:10px;"><tr><td style="padding:16px 12px;${wrap}"><p class="bs-muted" style="margin:0 0 10px;height:36px;${font}font-size:12px;line-height:18px;color:${muted};">${e(label)}</p><p class="bs-ink" style="margin:0;${font}font-size:27px;line-height:34px;font-weight:bold;letter-spacing:-0.5px;color:${ink};word-break:break-all;overflow-wrap:anywhere;">${e(number(value))}</p></td></tr></table></td>`).join("") + (i + 1 === metrics.length ? '<td width="50%"></td>' : "") + "</tr>";
  }
  return html + "</table>";
}

export function renderWeeklyReportEmail({ shop, report: suppliedReport, dashboardUrl } = {}) {
  const report = suppliedReport || {};
  const metrics = [["Requests analyzed", report.requestsAnalyzed], ["Blocked events", report.blocked], ["Challenged events", report.challenged], ["Allowed events", report.allowed]].filter(([, value]) => count(value));
  const period = date(report.periodStart) && date(report.periodEnd) && new Date(report.periodStart) < new Date(report.periodEnd) ? `${date(report.periodStart)} — ${date(report.periodEnd)} (end exclusive)` : "";
  const status = typeof report.protectionActive === "boolean" ? (report.protectionActive ? "Active" : "Needs attention") : "";
  const reasons = Array.isArray(report.topReasonCodes) ? report.topReasonCodes.filter(item => item && present(item.label) && count(item.count)).map(item => ({ label: reasonLabel(item.label), count: item.count })) : null;
  const intro = report.requestsAnalyzed === 0 ? "No storefront events were recorded in this report." : "A summary of recorded storefront activity.";
  const reasonHtml = reasons === null ? "" : heading("Top recorded reasons") + (reasons.length ? `<table width="100%" cellpadding="0" cellspacing="0" style="width:100%;table-layout:fixed;border-collapse:collapse;"><caption class="bs-muted" style="text-align:left;padding-bottom:12px;${font}font-size:12px;line-height:19px;color:${muted};">Recorded reason codes; one event can have more than one reason.</caption><thead><tr><th class="bs-muted" align="left" scope="col" style="padding:9px 0;border-bottom:1px solid #e5eaf1;${font}font-size:12px;color:${muted};">Recorded reason</th><th class="bs-muted" align="right" width="70" scope="col" style="padding:9px 0;border-bottom:1px solid #e5eaf1;${font}font-size:12px;color:${muted};">Count</th></tr></thead><tbody>${reasons.map(item => `<tr><td class="bs-ink" style="padding:12px 10px 12px 0;border-bottom:1px solid #e5eaf1;${font}font-size:13px;line-height:20px;color:${ink};${wrap}">${e(item.label)}</td><td class="bs-ink" align="right" style="padding:12px 0;border-bottom:1px solid #e5eaf1;${font}font-size:14px;color:${ink};word-break:break-all;">${e(number(item.count))}</td></tr>`).join("")}</tbody></table>` : paragraph("No reason codes recorded in this report."));
  return layout({ kind: "weekly", label: "Weekly Security Report", title: "Your week in security.", preheader: "Your recorded storefront activity, protection status, and top recorded reasons.", shop, dashboardUrl,
    body: (period ? paragraph("Reporting window: " + period) : "") + paragraph(intro) + metricCards(metrics) + (status ? heading("Protection status") + detailRows([["Protection", status]]) : "") + reasonHtml,
    lines: [period ? "Reporting window: " + period : "", intro, ...metrics.map(([label, value]) => `${label}: ${number(value)}`), status ? "Protection: " + status : "", reasons === null ? "" : "Top recorded reasons (one event may have multiple reasons):\n" + (reasons.length ? reasons.map(item => `${item.label}: ${number(item.count)}`).join("\n") : "No reason codes recorded in this report.")],
    note: "Based on recorded storefront-proxy activity. Simulation events are excluded." });
}

export function renderSecurityAlertEmail(input = {}) {
  const decision = String(input.decision || "").toLowerCase();
  const titles = { block: "A request was blocked.", blocked: "A request was blocked.", challenge: "A request needs verification.", challenged: "A request needs verification.", allow: "A storefront decision was recorded.", allowed: "A storefront decision was recorded." };
  const actions = { block: "Blocked", blocked: "Blocked", challenge: "Challenged", challenged: "Challenged", allow: "Allowed", allowed: "Allowed" };
  const severity = String(input.threatLevel || "").toLowerCase();
  const tones = { high: ["#fff2f0", "#9c3027"], medium: ["#fff7e5", "#805600"], low: ["#edf4ff", "#254e93"] };
  const tone = tones[severity] || ["#f0f3f8", muted];
  const score = typeof input.riskScore === "number" && Number.isFinite(input.riskScore) && input.riskScore >= 0 && input.riskScore <= 100 ? `${input.riskScore}/100` : "";
  const rows = [["Recorded action", actions[decision] || input.decision], ["Threat level", input.threatLevel], ["Risk score", score], ["IP address", input.ipAddress], ["Path", input.pathVisited], ["Recorded at", date(input.createdAt)], ["Event ID", input.eventId]].filter(([, value]) => present(value));
  const reasons = Array.isArray(input.reasonCodes) ? input.reasonCodes.filter(present) : [];
  const severityHtml = present(input.threatLevel) ? `<p style="margin:0 0 20px;"><span class="bs-pill ${tones[severity] ? "bs-severity-" + severity : ""}" style="display:inline-block;max-width:100%;box-sizing:border-box;padding:7px 12px;border-radius:6px;background-color:${tone[0]};color:${tone[1]};${font}font-size:12px;line-height:18px;font-weight:bold;${wrap}">${e(input.threatLevel)} severity</span></p>` : "";
  return layout({ kind: "alert", label: "Security Alert", title: titles[decision] || "Security activity recorded.", preheader: "Details of a recorded BotShield storefront decision.", shop: input.shop, dashboardUrl: input.dashboardUrl,
    body: severityHtml + paragraph("Review the recorded decision and its supporting details below.") + detailRows(rows) + (reasons.length ? heading("Recorded reasons") + `<ul class="bs-ink" style="margin:0;padding-left:20px;${font}font-size:13px;line-height:23px;color:${ink};${wrap}">${reasons.map(reason => `<li>${e(reason)}</li>`).join("")}</ul>` : ""),
    lines: ["Review the recorded decision and its supporting details below.", ...rows.map(([label, value]) => `${label}: ${value}`), reasons.length ? "Recorded reasons:\n" + reasons.join("\n") : ""],
    note: "Recorded security telemetry only. This notification does not estimate financial impact." });
}

export function renderTestNotificationEmail({ shop } = {}) {
  const message = "This is a test notification from BotShield. It checks email delivery only; it does not represent a security incident or affect your store's security metrics.";
  return layout({ kind: "test", label: "Test Notification", title: "Your BotShield notifications are working.", preheader: "A test of your BotShield email notifications. No security event is represented.", shop,
    body: paragraph(message) + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bs-panel" bgcolor="#f0f5ff" style="width:100%;border:1px solid #dbe6fb;border-radius:10px;"><tr><td style="padding:22px 18px;"><p class="bs-link" style="margin:0 0 8px;${font}font-size:11px;line-height:17px;font-weight:bold;letter-spacing:1px;color:#245bdb;">DELIVERY CHECK</p><p class="bs-ink" style="margin:0;${font}font-size:16px;line-height:24px;font-weight:bold;color:${ink};">This message is a test.</p></td></tr></table>`,
    lines: [message, "Delivery check: This message is a test."], note: "A delivery test only. Your existing notification preferences and protection settings are unchanged." });
}
