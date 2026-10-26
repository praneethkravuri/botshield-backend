/* eslint-env node */
// Local artifact generation only. Does not import the sender, API keys, or database.
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { renderWeeklyReportEmail, renderSecurityAlertEmail, renderTestNotificationEmail } from "../app/lib/merchant-email-templates.js";

const directory = fileURLToPath(new URL("../docs/email-previews/", import.meta.url));
await mkdir(directory, { recursive: true });
const shop = "cedar-and-wick-preview.myshopify.com";
// Entirely fictional, representative sample data. No guessed dashboard URL is used.
const samples = {
  weekly: renderWeeklyReportEmail({ shop, report: {
    periodStart: "2026-10-19T00:00:00Z", periodEnd: "2026-10-26T00:00:00Z",
    requestsAnalyzed: 18420, blocked: 386, challenged: 72, allowed: 17962,
    protectionActive: true,
    topReasonCodes: [{ label: "KNOWN_BOT_USER_AGENT", count: 214 }, { label: "RATE_PATTERN", count: 172 }, { label: "CHALLENGE_REQUIRED", count: 72 }],
  } }),
  alert: renderSecurityAlertEmail({ shop, decision: "challenge", threatLevel: "medium", riskScore: 58, ipAddress: "203.0.113.42", pathVisited: "/collections/new-arrivals", createdAt: "2026-10-26T14:32:10Z", eventId: "preview-event-0042", reasonCodes: ["RATE_PATTERN", "CHALLENGE_REQUIRED"] }),
  test: renderTestNotificationEmail({ shop }),
};
const notice = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:12px;background-color:#ede9fe;color:#34236b;font:12px/18px Arial,sans-serif;">PREVIEW ONLY · Fictional sample data · Not sent</td></tr></table>';
for (const [name, content] of Object.entries(samples)) {
  const html = content.html.replace(/(<body[^>]*>)/, "$1" + notice);
  await writeFile(`${directory}${name}.html`, html);
  await writeFile(`${directory}${name}.txt`, "PREVIEW ONLY — Fictional sample data. Not sent.\n\n" + content.text + "\n");
}
await writeFile(`${directory}index.html`, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BotShield email design review — preview only</title></head><body style="margin:32px;font:16px/1.6 Arial,sans-serif;color:#172b49;background:#f3f6fa;"><h1>BotShield merchant emails</h1><p><strong>PREVIEW ONLY.</strong> All store identities, events, dates and metrics in these samples are fictional. No emails were sent.</p><p>Outgoing dashboard CTAs are safely omitted pending verification of the production Shopify Admin destination. Fictional preview stores have no dashboard link.</p>${Object.keys(samples).map(name => `<section style="margin:32px 0;"><h2>${name === "weekly" ? "Weekly Security Report" : name === "alert" ? "Security Alert — challenged, medium severity" : "Test Notification"}</h2><p><a href="${name}.html">HTML preview</a> · <a href="${name}.txt">Plain text</a> · <a href="${name}-desktop.png">Desktop</a> · <a href="${name}-mobile.png">320px mobile</a> · <a href="${name}-dark.png">Dark-mode browser preview</a></p></section>`).join("")}<p>Browser captures demonstrate layout only. They do not verify actual Gmail, Outlook, Apple Mail or their proprietary dark-mode transformations.</p></body></html>`);
console.log("Generated three HTML/plain-text previews. Fictional data only; no email delivery performed.");
