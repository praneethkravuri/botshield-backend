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

// Calendar labels are reserved for exact UTC-midnight boundaries. Rolling or
// partial windows retain their actual times and explicitly identify the cutoff.
function reportPeriod(start, end) {
  if (!date(start) || !date(end)) return "";
  const a = new Date(start), b = new Date(end);
  if (a >= b) return "";
  const midnight = d => d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
  const day = d => new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(d);
  if (midnight(a) && midnight(b)) {
    // Query end is exclusive: use the last included calendar date.
    const last = new Date(b.getTime() - 1);
    const month = d => new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(d);
    let label;
    if (a.getUTCFullYear() !== last.getUTCFullYear()) label = `${day(a)}–${day(last)}`;
    else if (a.getUTCMonth() !== last.getUTCMonth()) label = `${month(a)} ${a.getUTCDate()}–${month(last)} ${last.getUTCDate()}, ${last.getUTCFullYear()}`;
    else label = a.getUTCDate() === last.getUTCDate() ? day(a) : `${month(a)} ${a.getUTCDate()}–${last.getUTCDate()}, ${last.getUTCFullYear()}`;
    return label + " · UTC";
  }
  const stamp = d => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", ...(d.getUTCSeconds() || d.getUTCMilliseconds() ? { second: "2-digit" } : {}), ...(d.getUTCMilliseconds() ? { fractionalSecondDigits: 3 } : {}), hourCycle: "h23", timeZone: "UTC" }).format(d);
  return `${stamp(a)} → before ${stamp(b)} · UTC`;
}

function detailRows(rows) {
  const available = rows.filter(([, value]) => present(value));
  return available.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bs-panel" bgcolor="#f6f9fe" style="width:100%;table-layout:fixed;border:1px solid #dce6f3;border-radius:10px;border-collapse:separate;">${available.map(([label, value]) => `<tr><td class="bs-muted" width="37%" valign="top" style="padding:14px 12px;border-bottom:1px solid #e5eaf1;${font}font-size:13px;line-height:21px;color:${muted};${wrap}">${e(label)}</td><td class="bs-ink" valign="top" style="padding:14px 12px;border-bottom:1px solid #e5eaf1;${font}font-size:14px;line-height:21px;color:${ink};${wrap}">${e(value)}</td></tr>`).join("")}</table>` : "";
}

function layout({ kind, label, title, preheader, shop, body, lines, dashboardUrl, note }) {
  const url = safeDashboardUrl(dashboardUrl);
  const cta = url ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px;"><tr><td bgcolor="#245bdb" style="border-radius:8px;mso-padding-alt:14px 20px;"><a href="${e(url)}" style="display:inline-block;padding:14px 20px;${font}font-size:14px;line-height:20px;font-weight:bold;color:#ffffff;text-decoration:none;">Open BotShield Overview</a></td></tr></table>` : "";
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${e(label)} | BotShield</title>
<style>@media (prefers-color-scheme:dark){.bs-page{background-color:#111b2b!important}.bs-surface{background-color:#19273b!important}.bs-panel{background-color:#21324a!important}.bs-ink{color:#f0f4fc!important}.bs-muted{color:#c4d0e2!important}.bs-link{color:#9dbbff!important}.bs-pill{background-color:#293d59!important;color:#edf3ff!important}.bs-surface,.bs-panel,.bs-ink,.bs-muted{border-color:#354760!important}.bs-logo{background-color:#ffffff!important}.bs-brand{background-color:#102742!important}.bs-accent-blue{border-top-color:#428dff!important}.bs-accent-red{border-top-color:#f28c87!important}.bs-accent-amber{border-top-color:#e8ba54!important}.bs-accent-teal{border-top-color:#55c6b3!important}.bs-severity-high{background-color:#492b30!important;color:#ffd9d3!important}.bs-severity-medium{background-color:#403619!important;color:#ffe4a3!important}.bs-severity-low{background-color:#223b5e!important;color:#d9e6ff!important}}</style></head>
<body class="bs-page" style="margin:0;padding:0;background-color:#f3f6fa;${font}-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${e(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f3f6fa" class="bs-page" style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:28px 12px;">
<!--[if mso]><table role="presentation" width="620" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bs-surface" bgcolor="#ffffff" data-email-template="${kind}" style="width:100%;max-width:620px;table-layout:fixed;border:1px solid #e0e7f0;border-radius:16px;border-collapse:separate;">
<tr><td height="5" bgcolor="#087cff" style="height:5px;font-size:0;line-height:0;border-radius:16px 16px 0 0;">&nbsp;</td></tr><tr><td class="bs-brand" bgcolor="#102742" style="padding:26px 22px;border-bottom:3px solid #24c5da;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;table-layout:fixed;"><tr><td width="60" valign="middle"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td class="bs-logo" bgcolor="#ffffff" style="padding:6px;border-radius:10px;"><img src="${EMAIL_LOGO_URL}" width="39" height="48" alt="BotShield logo" style="display:block;width:39px;height:48px;border:0;"></td></tr></table></td><td valign="middle" style="padding-left:12px;${wrap}"><p style="margin:0;${font}font-size:22px;line-height:28px;font-weight:bold;letter-spacing:-0.4px;color:#ffffff;">BotShield</p><p style="margin:5px 0 0;${font}font-size:12px;line-height:18px;color:#c9e4ff;">${e(label)}</p></td></tr></table></td></tr>
<tr><td style="padding:30px 22px 32px;${wrap}"><p class="bs-link" style="margin:0 0 12px;${font}font-size:11px;line-height:17px;font-weight:bold;letter-spacing:1px;color:#245bdb;text-transform:uppercase;">${e(label)}</p><h1 class="bs-ink" style="margin:0 0 18px;${font}font-size:28px;line-height:35px;letter-spacing:-0.5px;color:${ink};${wrap}">${e(title)}</h1>
${present(shop) ? `<p class="bs-muted" style="margin:0 0 24px;${font}font-size:13px;line-height:21px;color:${muted};${wrap}">Store<br><strong class="bs-ink" style="font-size:14px;color:${ink};">${e(shop)}</strong></p>` : ""}
${body}${cta}</td></tr>
<tr><td class="bs-panel" bgcolor="#eef4fb" style="padding:22px;border-top:3px solid #d5e7fa;border-radius:0 0 16px 16px;${wrap}"><p class="bs-ink" style="margin:0 0 8px;${font}font-size:13px;line-height:20px;font-weight:bold;color:${ink};">BotShield Reports</p><p class="bs-muted" style="margin:0 0 10px;${font}font-size:12px;line-height:19px;color:${muted};">${e(note)}</p><p class="bs-muted" style="margin:0;${font}font-size:12px;line-height:20px;color:${muted};">Questions? Reply to this email or contact<br><a class="bs-link" href="mailto:${SUPPORT}" style="color:#245bdb;text-decoration:underline;">${SUPPORT}</a></p></td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
  const text = ["BotShield | " + label, title, present(shop) ? "Store: " + shop : "", ...lines, url ? "Open BotShield Overview: " + url : "", "BotShield Reports", note, "Questions? Reply to this email or contact " + SUPPORT].filter(present).join("\n\n");
  return { html, text };
}

function metricCards(metrics) {
  const accents = { "Requests analyzed": ["blue", "#2676eb"], "Blocked events": ["red", "#c65353"], "Challenged events": ["amber", "#a16c08"], "Allowed events": ["teal", "#138575"] };
  if (!metrics.length) return "";
  let html = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;table-layout:fixed;border-collapse:collapse;">';
  for (let i = 0; i < metrics.length; i += 2) {
    html += "<tr>" + metrics.slice(i, i + 2).map(([label, value]) => `<td width="50%" valign="top" style="padding:5px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bs-panel bs-accent-${accents[label][0]}" bgcolor="#f6f9fe" style="width:100%;table-layout:fixed;border:1px solid #dce6f3;border-top:3px solid ${accents[label][1]};border-radius:10px;"><tr><td style="padding:20px 12px;${wrap}"><p class="bs-muted" style="margin:0 0 10px;height:36px;${font}font-size:12px;line-height:18px;color:${muted};">${e(label)}</p><p class="bs-ink" style="margin:0;${font}font-size:29px;line-height:36px;font-weight:bold;letter-spacing:-0.5px;color:${ink};word-break:break-all;overflow-wrap:anywhere;">${e(number(value))}</p></td></tr></table></td>`).join("") + (i + 1 === metrics.length ? '<td width="50%"></td>' : "") + "</tr>";
  }
  return html + "</table>";
}

export function renderWeeklyReportEmail({ shop, report: suppliedReport, dashboardUrl } = {}) {
  const report = suppliedReport || {};
  const metrics = [["Requests analyzed", report.requestsAnalyzed], ["Blocked events", report.blocked], ["Challenged events", report.challenged], ["Allowed events", report.allowed]].filter(([, value]) => count(value));
  const period = reportPeriod(report.periodStart, report.periodEnd);
  const status = typeof report.protectionActive === "boolean" ? (report.protectionActive ? "Active" : "Needs attention") : "";
  const reasons = Array.isArray(report.topReasonCodes) ? report.topReasonCodes.filter(item => item && present(item.label) && count(item.count)).map(item => ({ label: reasonLabel(item.label), count: item.count })) : null;
  const intro = report.requestsAnalyzed === 0 ? "No storefront events were recorded in this report." : "A summary of recorded storefront activity.";
  const reasonHtml = reasons === null ? "" : heading("Top recorded reasons") + (reasons.length ? `<table width="100%" cellpadding="0" cellspacing="0" style="width:100%;table-layout:fixed;border-collapse:collapse;"><caption class="bs-muted" style="text-align:left;padding-bottom:12px;${font}font-size:12px;line-height:19px;color:${muted};">Recorded reason codes; one event can have more than one reason.</caption><thead><tr><th class="bs-muted" align="left" scope="col" style="padding:9px 0;border-bottom:1px solid #e5eaf1;${font}font-size:12px;color:${muted};">Recorded reason</th><th class="bs-muted" align="right" width="70" scope="col" style="padding:9px 0;border-bottom:1px solid #e5eaf1;${font}font-size:12px;color:${muted};">Count</th></tr></thead><tbody>${reasons.map(item => `<tr><td class="bs-ink" style="padding:14px 12px;border-bottom:1px solid #e5eaf1;${font}font-size:13px;line-height:20px;color:${ink};${wrap}">${e(item.label)}</td><td class="bs-ink" align="right" style="padding:14px 12px;border-bottom:1px solid #e5eaf1;${font}font-size:14px;color:${ink};word-break:break-all;">${e(number(item.count))}</td></tr>`).join("")}</tbody></table>` : paragraph("No reason codes recorded in this report."));
  return layout({ kind: "weekly", label: "Weekly Security Report", title: "Your week in security.", preheader: "Your recorded storefront activity, protection status, and top recorded reasons.", shop, dashboardUrl,
    body: (period ? paragraph("Reporting window: " + period) : "") + paragraph(intro) + metricCards(metrics) + (status ? heading("Protection status") + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bs-panel" bgcolor="${report.protectionActive ? "#eef9f5" : "#fff7e5"}" style="width:100%;border:1px solid #d6e6e4;border-left:4px solid ${report.protectionActive ? "#138575" : "#a16c08"};border-radius:8px;"><tr><td style="padding:17px 16px;"><p class="bs-muted" style="margin:0 0 5px;${font}font-size:12px;line-height:18px;color:${muted};">Protection</p><p class="bs-ink" style="margin:0;${font}font-size:17px;line-height:24px;font-weight:bold;color:${ink};">${e(status)}</p></td></tr></table>` : "") + reasonHtml,
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
    body: severityHtml + paragraph("Review the recorded decision and its supporting details below.") + (rows.length ? heading("Incident details") + detailRows(rows) : "") + (reasons.length ? heading("Recorded reasons") + `<ul class="bs-ink" style="margin:0;padding-left:20px;${font}font-size:13px;line-height:23px;color:${ink};${wrap}">${reasons.map(reason => `<li>${e(reason)}</li>`).join("")}</ul>` : ""),
    lines: ["Review the recorded decision and its supporting details below.", ...rows.map(([label, value]) => `${label}: ${value}`), reasons.length ? "Recorded reasons:\n" + reasons.join("\n") : ""],
    note: "Recorded security telemetry only. This notification does not estimate financial impact." });
}

export function renderTestNotificationEmail({ shop } = {}) {
  const message = "This is a test notification from BotShield. It checks email delivery only; it does not represent a security incident or affect your store's security metrics.";
  return layout({ kind: "test", label: "Test Notification", title: "Your BotShield notifications are working.", preheader: "A test of your BotShield email notifications. No security event is represented.", shop,
    body: paragraph(message) + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bs-panel" bgcolor="#edf9f6" style="width:100%;border:1px solid #cae7df;border-top:3px solid #138575;border-radius:10px;"><tr><td style="padding:25px 18px;"><p class="bs-link" style="margin:0 0 8px;${font}font-size:11px;line-height:17px;font-weight:bold;letter-spacing:1px;color:#245bdb;">DELIVERY CHECK</p><p class="bs-ink" style="margin:0;${font}font-size:16px;line-height:24px;font-weight:bold;color:${ink};">This message is a test.</p></td></tr></table>`,
    lines: [message, "Delivery check: This message is a test."], note: "A delivery test only. Your existing notification preferences and protection settings are unchanged." });
}
