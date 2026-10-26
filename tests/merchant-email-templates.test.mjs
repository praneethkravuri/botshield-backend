/* eslint-env node */
import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { buildEmailDashboardUrl, EMAIL_LOGO_URL, renderWeeklyReportEmail, renderSecurityAlertEmail, renderTestNotificationEmail } from "../app/lib/merchant-email-templates.js";

const shop = "example.myshopify.com";
const report = { periodStart: "2026-10-19T12:00:00Z", periodEnd: "2026-10-26T12:00:00Z", requestsAnalyzed: 20, blocked: 4, challenged: 2, allowed: 14, protectionActive: true, topReasonCodes: [{ label: "KNOWN_BOT_USER_AGENT", count: 4 }] };
const body = content => new JSDOM(content.html).window.document.body;
const visible = content => body(content).textContent;

test("three distinct email presentations share the official brand and support footer", () => {
  const samples = [renderWeeklyReportEmail({shop,report}), renderSecurityAlertEmail({shop,decision:"challenge",threatLevel:"medium"}), renderTestNotificationEmail({shop})];
  assert.equal(new Set(samples.map(s => body(s).querySelector('[data-email-template]').dataset.emailTemplate)).size, 3);
  for (const sample of samples) {
    assert.equal(body(sample).querySelector('img').src, EMAIL_LOGO_URL);
    assert.match(body(sample).querySelector('img').alt, /BotShield/);
    assert.match(visible(sample), /BotShield Reports/);
    assert.match(sample.text, /support@botshieldapp.com/);
    assert.equal(body(sample).querySelector('a[href="mailto:support@botshieldapp.com"]').textContent, 'support@botshieldapp.com');
  }
});

test("weekly content uses the passed metrics and real reporting interval in HTML and text", () => {
  const email = renderWeeklyReportEmail({shop,report});
  assert.match(visible(email), /Your week in security/);
  for (const [label,value] of [["Requests analyzed",20],["Blocked events",4],["Challenged events",2],["Allowed events",14]]) {
    assert.match(email.text, new RegExp(`${label}: ${value}`));
    const p = [...body(email).querySelectorAll('p')].find(el => el.textContent === label);
    assert.equal(p.nextElementSibling.textContent, String(value));
  }
  assert.match(email.text, /Oct 19, 2026/);
  assert.match(email.text, /Oct 26, 2026/);
  assert.match(email.text, /UTC.*end exclusive/);
  assert.match(email.text, /Protection: Active/);
  assert.match(email.text, /Known bot user agent: 4/);
  assert.doesNotMatch(visible(email), /money saved|risk reduction|%|revenue prevented/i);
});

test("zero activity reports keep four genuine zero totals without inventing threats", () => {
  const email=renderWeeklyReportEmail({shop,report:{requestsAnalyzed:0,blocked:0,challenged:0,allowed:0,protectionActive:false,topReasonCodes:[]}});
  assert.match(email.text,/No storefront events were recorded/);
  assert.equal([...body(email).querySelectorAll('p')].filter(p=>p.textContent==='0').length,4);
  assert.match(email.text,/Protection: Needs attention/);
  assert.match(email.text,/No reason codes recorded/);
  assert.doesNotMatch(email.text,/Reporting window/);
});

test("missing and invalid optional data is omitted without fabricated zeros, dates or status", () => {
  for (const report of [undefined,null,{}, {periodStart:'1',periodEnd:'2'}, {periodStart:'bad',periodEnd:'bad',protectionActive:null,requestsAnalyzed:-2,blocked:NaN}]) {
    const email=renderWeeklyReportEmail({shop,report});
    assert.doesNotMatch(email.text,/Reporting window|Requests analyzed:|Protection:|Invalid Date|NaN|undefined|null/);
    assert.equal(body(email).querySelector('a[href^="https:"]'),null);
  }
  const email=renderSecurityAlertEmail({shop});
  assert.doesNotMatch(email.text,/Risk score:|IP address:|Event ID:|Recorded at:|undefined|null/);
  assert.match(email.text,/Security activity recorded/);
});

test("challenge, block, and allow alerts accurately distinguish recorded decisions", () => {
  for (const [decision,title,action] of [['challenge','A request needs verification.','Challenged'],['block','A request was blocked.','Blocked'],['allow','A storefront decision was recorded.','Allowed']]) {
    const email=renderSecurityAlertEmail({shop,decision,threatLevel:'medium',riskScore:0,createdAt:'2026-10-26T12:34:56Z',eventId:'event-1'});
    assert.equal(body(email).querySelector('h1').textContent,title);
    assert.match(email.text,new RegExp(`Recorded action: ${action}`));
    assert.match(email.text,/Risk score: 0\/100/);
    assert.match(email.text,/12:34:56 UTC/);
    assert.match(email.text,/Event ID: event-1/);
    assert.doesNotMatch(email.text,/Test Notification|high-risk storefront decision|financial loss prevented/);
    if(decision==='challenge') assert.doesNotMatch(visible(email),/blocked/i);
  }
});

test("severity uses actual threat levels with distinct accessible color treatments", () => {
  for (const level of ['high','medium','low','unknown']) {
    const email=renderSecurityAlertEmail({shop,decision:'challenge',threatLevel:level});
    const pill=body(email).querySelector('.bs-pill');
    assert.equal(pill.textContent,`${level} severity`);
    assert.equal(pill.classList.contains(`bs-severity-${level}`),level!=='unknown');
  }
});

test("test notification is explicit and contains no invented incident telemetry", () => {
  const email=renderTestNotificationEmail({shop});
  assert.equal(body(email).querySelector('h1').textContent,'Your BotShield notifications are working.');
  assert.match(email.text,/This is a test notification/);
  assert.match(email.text,/does not represent a security incident/);
  assert.doesNotMatch(visible(email),/IP address|Risk score|Threat level|TEST_ALERT|Event ID|Recorded action|203\.0\./);
});

test("merchant and event values are escaped across all HTML surfaces", () => {
  const attack='"><script>alert(1)</script><img src=x onerror="alert(2)">&\' Store';
  const samples=[renderWeeklyReportEmail({shop:attack,report:{...report,topReasonCodes:[{label:attack,count:2}]}}),renderSecurityAlertEmail({shop:attack,decision:attack,threatLevel:attack,ipAddress:attack,pathVisited:attack,eventId:attack,reasonCodes:[attack]}),renderTestNotificationEmail({shop:attack})];
  for(const email of samples) {
    const doc=body(email);
    assert.equal(doc.querySelectorAll('script,iframe,[onerror],[onclick]').length,0);
    assert.equal(doc.querySelectorAll('img').length,1);
    assert.ok(doc.textContent.includes(attack));
    assert.ok(email.text.includes(attack));
  }
});

test("large values retain exact counts, long store identifiers and unusual characters",()=>{
  const name='Cedar & Wick — '+ 'LongStoreName'.repeat(15)+' <Wholesale>';
  const email=renderWeeklyReportEmail({shop:name,report:{...report,requestsAnalyzed:1234567890123}});
  assert.ok(visible(email).includes(name));
  assert.match(email.text,/Requests analyzed: 1,234,567,890,123/);
  assert.match(visible(email),/1,234,567,890,123/);
});

test("dashboard links use only the existing configured Shopify Admin route, with safe omission",()=>{
  const url=buildEmailDashboardUrl(shop,'botshield');
  assert.equal(url,'https://admin.shopify.com/store/example/apps/botshield/app');
  const email=renderWeeklyReportEmail({shop,report,dashboardUrl:url});
  assert.equal(body(email).querySelector('a[href^="https:"]').href,url);
  assert.ok(email.text.includes(url));
  for(const bad of ['javascript:alert(1)','http://admin.shopify.com/store/a/apps/b/app','https://localhost/app','https://evil.test','https://admin.shopify.com.evil.test/store/a/apps/b/app']) {
    assert.equal(body(renderSecurityAlertEmail({shop,dashboardUrl:bad})).querySelector('a[href^="http"]'),null);
  }
  for(const [store,handle] of [[shop,''],[shop,'../dev'],['attacker.example','botshield'],['<img>', 'botshield']]) assert.equal(buildEmailDashboardUrl(store,handle),'');
});

test("email HTML has inline table layout, image dimensions, no scripts/external CSS/fonts/animation, and optional dark styles",()=>{
  for(const email of [renderWeeklyReportEmail({shop,report}),renderSecurityAlertEmail({shop,decision:'block'}),renderTestNotificationEmail({shop})]) {
    const document=new JSDOM(email.html).window.document;
    assert.equal(document.documentElement.lang,'en');
    assert.ok(document.querySelector('table[role="presentation"][width="100%"]'));
    assert.ok(document.querySelector('img[width][height][alt]'));
    assert.match(email.html, /prefers-color-scheme:dark/);
    assert.match(email.html, /\[if mso\]/);
    assert.equal(document.querySelectorAll('script,link,video,canvas').length,0);
    assert.doesNotMatch(email.html, /@import|@font-face|animation:|display:grid|display:flex/);
    assert.match(email.html,/BotShield<\/p>/); // Visible wordmark remains when images are blocked.
  }
});

test("rendering never mutates report data or event details",()=>{
  const frozenReport=Object.freeze({...report,topReasonCodes:Object.freeze(report.topReasonCodes.map(item=>Object.freeze({...item})))});
  const event=Object.freeze({shop,decision:'challenge',riskScore:58,reasonCodes:Object.freeze(['RATE_PATTERN'])});
  const before=JSON.stringify({frozenReport,event});
  renderWeeklyReportEmail({shop,report:frozenReport});
  renderSecurityAlertEmail(event);
  assert.equal(JSON.stringify({frozenReport,event}),before);
});
