/* eslint-env node */
/* global globalThis */
import assert from "node:assert/strict";
import test from "node:test";
import { buildWeeklyReportFromEvents } from "../app/lib/security-posture.js";
import { sendEmail } from "../app/lib/email.server.js";
import {
  sendIncidentEmail,
  sendTestIncidentEmail,
  sendWeeklySecurityReportEmail,
} from "../app/lib/incident-alerts.server.js";

async function captureDelivery(send, override) {
  const apiKey = process.env.RESEND_API_KEY;
  const sender = process.env.ALERT_FROM_EMAIL;
  const fetch = globalThis.fetch;
  const requests = [];
  process.env.RESEND_API_KEY = "unit-test-only-resend-key";
  if (override === undefined) delete process.env.ALERT_FROM_EMAIL;
  else process.env.ALERT_FROM_EMAIL = override;
  globalThis.fetch = async (url, options) => {
    requests.push({ url, method: options.method, body: JSON.parse(options.body) });
    return Response.json({ id: "mock-email-id" });
  };
  try {
    const result = await send();
    assert.equal(result.sent, true);
    assert.equal(result.providerMessageId, "mock-email-id");
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "https://api.resend.com/emails");
    assert.equal(requests[0].method, "POST");
    return requests[0].body;
  } finally {
    globalThis.fetch = fetch;
    if (apiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = apiKey;
    if (sender === undefined) delete process.env.ALERT_FROM_EMAIL;
    else process.env.ALERT_FROM_EMAIL = sender;
  }
}

function assertHeaders(body) {
  assert.equal(body.from, "BotShield Reports <reports@botshieldapp.com>");
  assert.equal(body.reply_to, "support@botshieldapp.com");
  assert.deepEqual(body.to, ["merchant@example.com"]);
}

test("scheduled/manual weekly report email uses reports sender and support replies", async () => {
  const body = await captureDelivery(() => sendWeeklySecurityReportEmail({
    shop: "example.myshopify.com",
    alertEmail: "merchant@example.com",
    report: { requestsAnalyzed: 20, allowed: 16, blocked: 4, challenged: 0, protectionActive: true, topReasonCodes: [{ label: "Known bot", count: 4 }] },
  }));
  assertHeaders(body);
  assert.equal(body.subject, "[BotShield] Weekly security report for example.myshopify.com");
  assert.match(body.html, /Requests analyzed/);
  assert.match(body.html, /data-email-template="weekly"/);
  assert.match(body.text, /Requests analyzed: 20/);
  assert.match(body.text, /Known bot: 4/);
});

test("security incident alert uses reports sender without changing its destination or subject", async () => {
  const body = await captureDelivery(() => sendIncidentEmail({
    shop: "example.myshopify.com", alertEmail: "merchant@example.com", ipAddress: "203.0.113.1", pathVisited: "/products/test", decision: "block", threatLevel: "high", riskScore: 90, reasonCodes: ["KNOWN_BOT_USER_AGENT"], eventId: "event-1", createdAt: "2026-10-26T00:00:00Z",
  }));
  assertHeaders(body);
  assert.equal(body.subject, "[BotShield] BLOCK incident on example.myshopify.com");
  assert.match(body.html, /KNOWN_BOT_USER_AGENT/);
  assert.match(body.html, /event-1/);
});

test("test notification uses the same transport with a distinct test-only presentation", async () => {
  const body = await captureDelivery(() => sendTestIncidentEmail({ shop: "example.myshopify.com", alertEmail: "merchant@example.com" }));
  assertHeaders(body);
  assert.equal(body.subject, "[BotShield] Test notification for example.myshopify.com");
  assert.match(body.html, /Your BotShield notifications are working/);
  assert.doesNotMatch(body.html, /TEST_ALERT|IP address|Risk score|Event ID/);
  assert.match(body.text, /This is a test notification/);
});

test("valid sender override remains supported while replies always go to support", async () => {
  const body = await captureDelivery(() => sendEmail({ to: "merchant@example.com", subject: "Unchanged subject", html: "<p>Unchanged HTML</p>", text: "Unchanged text" }), "  BotShield Override <alerts@botshieldapp.com>  ");
  assert.equal(body.from, "BotShield Override <alerts@botshieldapp.com>");
  assert.equal(body.reply_to, "support@botshieldapp.com");
  assert.deepEqual(body.to, ["merchant@example.com"]);
  assert.equal(body.subject, "Unchanged subject");
  assert.equal(body.html, "<p>Unchanged HTML</p>");
  assert.equal(body.text, "Unchanged text");
});

test("invalid sender override still falls back safely to the reports sender", async () => {
  const body = await captureDelivery(() => sendEmail({ to: "merchant@example.com", subject: "Test", html: "<p>Test</p>" }), "not-an-email");
  assertHeaders(body);
});


test("outgoing weekly and incident emails omit unverified CTAs even with a configured Dev handle", async () => {
  const originalHandle = process.env.SHOPIFY_APP_HANDLE;
  process.env.SHOPIFY_APP_HANDLE = "botshield-dev";
  const unverifiedUrl = "https://admin.shopify.com/store/example/apps/botshield-dev/app";
  try {
    const weekly = await captureDelivery(() => sendWeeklySecurityReportEmail({
      shop: "example.myshopify.com", alertEmail: "merchant@example.com", report: {}, dashboardUrl: unverifiedUrl,
    }));
    const incident = await captureDelivery(() => sendIncidentEmail({
      shop: "example.myshopify.com", alertEmail: "merchant@example.com", decision: "challenge", dashboardUrl: unverifiedUrl,
    }));
    for (const body of [weekly, incident]) {
      assertHeaders(body);
      assert.doesNotMatch(body.html, /admin\.shopify\.com|botshield-dev|Open BotShield Overview/);
      assert.doesNotMatch(body.text, /admin\.shopify\.com|botshield-dev|Open BotShield Overview/);
    }
    assert.equal(weekly.subject, "[BotShield] Weekly security report for example.myshopify.com");
    assert.equal(incident.subject, "[BotShield] CHALLENGE incident on example.myshopify.com");
  } finally {
    if (originalHandle === undefined) delete process.env.SHOPIFY_APP_HANDLE;
    else process.env.SHOPIFY_APP_HANDLE = originalHandle;
  }
});

test("the existing report builder's exact period reaches the common weekly email renderer", async () => {
  const report = buildWeeklyReportFromEvents({
    events: [], status: { protectionActive: true },
    settings: { emailAlerts: true, emailProvider: { configured: true }, alertEmail: "merchant@example.com" },
    start: new Date("2026-10-19T15:23:45.000Z"), end: new Date("2026-10-26T15:23:45.000Z"),
  });
  assert.equal(report.periodStart, "2026-10-19T15:23:45.000Z");
  assert.equal(report.periodEnd, "2026-10-26T15:23:45.000Z");
  const body = await captureDelivery(() => sendWeeklySecurityReportEmail({ shop: "example.myshopify.com", alertEmail: "merchant@example.com", report }));
  const period = "Oct 19, 2026, 15:23:45 – Oct 26, 2026, 15:23:45 · UTC (cutoff excluded)";
  assert.ok(body.html.includes(period));
  assert.ok(body.text.includes(period));
  assert.equal(report.periodStart, "2026-10-19T15:23:45.000Z");
  assert.equal(report.periodEnd, "2026-10-26T15:23:45.000Z");
});
