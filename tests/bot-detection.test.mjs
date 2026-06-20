import test from "node:test";
import assert from "node:assert/strict";

import { detectBotThreat } from "../app/lib/bot-detection.server.js";
import {
  getStorefrontActionForLog,
  resolveStorefrontDecision,
} from "../app/lib/storefront-decision.server.js";
import { partitionSecurityEvents } from "../app/lib/event-classification.js";
import { shouldSendIncidentAlert } from "../app/lib/incident-alerts.server.js";
import {
  getNetworkIntelSignals,
  normalizeNetworkIntel,
} from "../app/lib/network-intelligence.js";
import {
  buildWeeklyReportFromEvents,
  calculateSecurityScore,
} from "../app/lib/security-posture.js";
import {
  extractReasonCodes,
  isRecoverableBlockedIncident,
  maskIpAddress,
  matchesIncidentFilters,
  serializeSecurityEvent,
} from "../app/lib/security-events.js";

const baseRequest = {
  ipAddress: "203.0.113.10",
  userAgent: "Mozilla/5.0",
  pathVisited: "/products/example",
  recentEvents: [],
  settings: {
    autoBlock: true,
    blockLevel: "Medium",
    strictMode: false,
    protectionPausedUntil: null,
  },
};

test("whitelisted IP is always allowed", () => {
  const detection = detectBotThreat({
    ...baseRequest,
    whitelistEntry: { active: true },
  });
  const result = resolveStorefrontDecision({
    detection,
    whitelistEntry: { active: true },
  });

  assert.equal(detection.actionTaken, "whitelisted");
  assert.equal(result.decision, "allow");
  assert.ok(detection.reasonCodes.includes("WHITELIST_MATCH"));
});

test("whitelist decisions remain identifiable for dashboard reporting", () => {
  const detection = detectBotThreat({
    ...baseRequest,
    whitelistEntry: { active: true },
  });

  assert.equal(detection.actionTaken, "whitelisted");
  assert.equal(detection.threatLevel, "low");
  assert.equal(detection.riskScore, 0);
  assert.equal(
    getStorefrontActionForLog("allow", detection.reasonCodes),
    "whitelisted",
  );
});

test("blocklisted IP is blocked", () => {
  const detection = detectBotThreat({
    ...baseRequest,
    blockedEntry: { active: true },
  });
  const result = resolveStorefrontDecision({
    detection,
    blockedEntry: { active: true },
  });

  assert.equal(result.decision, "block");
  assert.ok(detection.reasonCodes.includes("BLOCKLIST_MATCH"));
});

test("suspicious user agent raises risk and emits a reason code", () => {
  const detection = detectBotThreat({
    ...baseRequest,
    userAgent: "python-requests/2.32",
  });

  assert.ok(detection.riskScore >= 30);
  assert.ok(detection.reasonCodes.includes("SUSPICIOUS_USER_AGENT"));
});

test("VPN datacenter and ASN intelligence changes real request scoring", () => {
  const networkIntel = normalizeNetworkIntel({
    is_vpn: true,
    is_datacenter: true,
    asn: { asn: 64500, org: "Example Hosting", type: "hosting" },
    datacenter: { datacenter: "Example Cloud" },
  });
  const signals = getNetworkIntelSignals(networkIntel);
  const detection = detectBotThreat({ ...baseRequest, networkIntel });

  assert.equal(networkIntel.asn, 64500);
  assert.ok(signals.reasonCodes.includes("VPN_DETECTED"));
  assert.ok(signals.reasonCodes.includes("DATACENTER_IP"));
  assert.ok(signals.reasonCodes.includes("HOSTING_PROVIDER"));
  assert.ok(signals.reasonCodes.includes("ASN_MATCH"));
  assert.ok(detection.riskScore >= 50);
  assert.ok(detection.reasonCodes.includes("ASN_MATCH"));
});

test("aggressiveness increases from Low to Medium to High to Strict", () => {
  const request = {
    ...baseRequest,
    userAgent: "curl/8.0",
    pathVisited: "/account/login",
  };

  const low = detectBotThreat({
    ...request,
    settings: { ...baseRequest.settings, blockLevel: "Low" },
  });
  const medium = detectBotThreat({
    ...request,
    settings: { ...baseRequest.settings, blockLevel: "Medium" },
  });
  const high = detectBotThreat({
    ...request,
    settings: { ...baseRequest.settings, blockLevel: "High" },
  });
  const strict = detectBotThreat({
    ...request,
    settings: {
      ...baseRequest.settings,
      blockLevel: "High",
      strictMode: true,
    },
  });

  assert.equal(low.actionTaken, "allowed");
  assert.equal(medium.actionTaken, "blocked");
  assert.equal(high.actionTaken, "blocked");
  assert.equal(strict.actionTaken, "blocked");
  assert.ok(strict.reasonCodes.includes("STRICT_MODE"));
});

test("pause logs but disables blocking", () => {
  const detection = detectBotThreat({
    ...baseRequest,
    blockedEntry: { active: true },
  });
  const result = resolveStorefrontDecision({
    detection,
    blockedEntry: { active: true },
    protectionPausedUntil: new Date(Date.now() + 60_000).toISOString(),
  });

  assert.equal(result.decision, "allow");
  assert.equal(result.protectionPaused, true);
  assert.ok(result.reasonCodes.includes("PROTECTION_PAUSED"));
});

test("disabled auto-block monitors suspicious traffic without enforcement", () => {
  const detection = detectBotThreat({
    ...baseRequest,
    userAgent: "python-requests/2.32",
    pathVisited: "/account/login",
    settings: { ...baseRequest.settings, autoBlock: false },
  });
  const result = resolveStorefrontDecision({
    detection,
    autoBlock: false,
  });

  assert.equal(result.decision, "allow");
  assert.ok(result.reasonCodes.includes("AUTO_BLOCK_DISABLED"));
});

test("medium-risk storefront traffic receives a challenge", () => {
  const detection = {
    actionTaken: "allowed",
    threatLevel: "medium",
  };
  const result = resolveStorefrontDecision({
    detection,
    autoBlock: true,
  });

  assert.equal(result.decision, "challenge");
  assert.ok(result.reasonCodes.includes("CHALLENGE_REQUIRED"));
});

test("a passed challenge allows medium-risk storefront traffic", () => {
  const detection = {
    actionTaken: "allowed",
    threatLevel: "medium",
  };
  const result = resolveStorefrontDecision({
    detection,
    autoBlock: true,
    challengePassed: true,
  });

  assert.equal(result.decision, "allow");
});

test("dashboard simulations do not pollute real storefront metrics", () => {
  const events = [
    { id: 1, source: "storefront-proxy" },
    { id: 2, source: "dashboard-simulation" },
    { id: 3, source: "dashboard-live-scan" },
  ];
  const partitioned = partitionSecurityEvents(events);

  assert.deepEqual(
    partitioned.storefront.map((event) => event.id),
    [1],
  );
  assert.deepEqual(
    partitioned.simulated.map((event) => event.id),
    [2, 3],
  );
});

test("high-risk storefront incidents trigger configured email alerts", () => {
  const result = shouldSendIncidentAlert({
    settings: {
      emailAlerts: true,
      highRiskAlertsOnly: true,
      alertEmail: "owner@example.com",
    },
    decision: "block",
    threatLevel: "high",
    recentEvents: [],
  });

  assert.deepEqual(result, {
    send: true,
    reason: "INCIDENT_ALERT_REQUIRED",
  });
});

test("alert cooldown suppresses duplicate high-risk email bursts", () => {
  const result = shouldSendIncidentAlert({
    settings: {
      emailAlerts: true,
      highRiskAlertsOnly: true,
      alertEmail: "owner@example.com",
    },
    decision: "block",
    threatLevel: "high",
    recentEvents: [
      {
        action: "blocked",
        threatLevel: "high",
        createdAt: new Date(),
      },
    ],
  });

  assert.equal(result.send, false);
  assert.equal(result.reason, "ALERT_COOLDOWN");
});

test("challenge events qualify for merchant email alerts", () => {
  const result = shouldSendIncidentAlert({
    settings: {
      emailAlerts: true,
      highRiskAlertsOnly: true,
      alertEmail: "owner@example.com",
    },
    decision: "challenge",
    threatLevel: "medium",
    recentEvents: [],
  });

  assert.equal(result.send, true);
});

test("security events expose structured reason codes and masked IPs", () => {
  const event = serializeSecurityEvent({
    id: 42,
    ipAddress: "203.0.113.27",
    threatLevel: "high",
    action: "blocked",
    path: "/account/login",
    riskScore: 90,
    reasonSummary:
      "[SUSPICIOUS_USER_AGENT] | [SENSITIVE_PATH] | Suspicious automation signature",
    source: "storefront-proxy",
    createdAt: new Date("2026-06-20T00:00:00Z"),
  });

  assert.deepEqual(extractReasonCodes(event.reasonCodes.join(" ")), []);
  assert.deepEqual(event.reasonCodes, [
    "SUSPICIOUS_USER_AGENT",
    "SENSITIVE_PATH",
  ]);
  assert.equal(event.maskedIpAddress, "203.0.xxx.27");
  assert.equal(maskIpAddress("2603:8080:c901:43b0::1"), "2603:8080:c901:…:1");
  assert.equal(matchesIncidentFilters(event, { source: "real" }), true);
  assert.equal(
    matchesIncidentFilters(event, { source: "simulation" }),
    false,
  );
  assert.equal(isRecoverableBlockedIncident(event), true);
  assert.equal(
    isRecoverableBlockedIncident({ ...event, decision: "allowed" }),
    false,
  );
});

test("weekly reports exclude simulations and summarize real decisions", () => {
  const report = buildWeeklyReportFromEvents({
    events: [
      {
        action: "allowed",
        threatLevel: "low",
        reasonSummary: "[NO_SIGNIFICANT_RISK] | Allowed",
      },
      {
        action: "blocked",
        threatLevel: "high",
        reasonSummary: "[VPN_DETECTED] | [DATACENTER_IP] | Blocked",
      },
    ],
    status: { protectionActive: true, themeEmbedDetected: true },
    settings: {
      emailAlerts: true,
      alertEmail: "owner@example.com",
      emailProvider: { configured: true },
    },
    start: new Date("2026-06-13T00:00:00Z"),
    end: new Date("2026-06-20T00:00:00Z"),
  });

  assert.equal(report.requestsAnalyzed, 2);
  assert.equal(report.allowed, 1);
  assert.equal(report.blocked, 1);
  assert.equal(report.topReasonCodes[0].count, 1);
  assert.equal(report.alertsConfigured, true);
});

test("security score is based on verified setup and production evidence", () => {
  const result = calculateSecurityScore({
    status: {
      appInstalled: true,
      themeEmbedDetected: true,
      lastStorefrontDecisionAt: "2026-06-20T00:00:00Z",
      protectionActive: true,
    },
    settings: {
      emailAlerts: true,
      alertEmail: "owner@example.com",
      emailProvider: { configured: true },
    },
    report: { requestsAnalyzed: 5 },
    reportsEnabled: true,
  });

  assert.equal(result.score, 100);
  assert.equal(result.grade, "Excellent");
  assert.deepEqual(result.suggestions, []);
});
