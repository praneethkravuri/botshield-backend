import test from "node:test";
import assert from "node:assert/strict";

import { detectBotThreat } from "../app/lib/bot-detection.server.js";
import {
  getStorefrontActionForLog,
  resolveStorefrontDecision,
} from "../app/lib/storefront-decision.server.js";
import { partitionSecurityEvents } from "../app/lib/event-classification.js";
import { shouldSendIncidentAlert } from "../app/lib/incident-alerts.server.js";

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
