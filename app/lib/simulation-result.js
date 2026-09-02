const REASON_CODE_CHIP_LABELS = {
  KNOWN_BOT_USER_AGENT: "Known bot user agent",
  SUSPICIOUS_USER_AGENT: "Suspicious user agent",
  MISSING_USER_AGENT: "Missing user agent",
  MISSING_IP: "Missing IP address",
  SENSITIVE_PATH: "Sensitive path",
  PATH_SCANNING: "Path scanning",
  RATE_PATTERN: "Repeated activity",
  REPEAT_OFFENDER: "Repeat offender",
  STRICT_MODE: "Strict protection policy",
  VPN_DETECTED: "VPN or proxy traffic",
  DATACENTER_IP: "Datacenter network",
  HOSTING_PROVIDER: "Hosting provider traffic",
  HIGH_RISK_NETWORK: "High-risk network",
  ASN_MATCH: "Hosting provider traffic",
  BLOCKLIST_MATCH: "Blocklist match",
  WHITELIST_MATCH: "Trusted visitor",
  BILLING_INACTIVE: "Billing inactive",
  PROTECTION_PAUSED: "Protection paused",
  AUTO_BLOCK_DISABLED: "Auto-block disabled",
  CHALLENGE_REQUIRED: "Challenge required",
  NO_SIGNIFICANT_RISK: "No elevated signals",
  BOT_UA: "Bot user agent",
};

const DECISION_LABELS = {
  allowed: "Allowed",
  blocked: "Blocked",
  challenged: "Challenged",
  monitored: "Monitored",
  whitelisted: "Allowed",
};

function capitalize(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

function formatDecisionLabel(action) {
  const normalized =
    action === "whitelisted" ? "allowed" : String(action || "").trim().toLowerCase();
  return DECISION_LABELS[normalized] || capitalize(normalized);
}

function formatThreatLevelLabel(threatLevel) {
  return capitalize(threatLevel);
}

function formatRiskScoreLabel(riskScore) {
  if (riskScore == null || riskScore === "") return null;
  return `${riskScore} / 100`;
}

export function formatReasonCodeChip(code) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized) return "";
  if (REASON_CODE_CHIP_LABELS[normalized]) {
    return REASON_CODE_CHIP_LABELS[normalized];
  }
  return normalized
    .split("_")
    .filter(Boolean)
    .map((part) => capitalize(part))
    .join(" ");
}

export function formatSimulationRecordedAt(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getSimulationResultSummary(result) {
  if (!result) return "Simulation recorded";
  const decision = formatDecisionLabel(result.actionTaken ?? result.action);
  const threat = formatThreatLevelLabel(result.threatLevel);
  if (decision && threat) {
    return `Simulation ${decision.toLowerCase()} · ${threat} threat`;
  }
  if (decision) return `Simulation ${decision.toLowerCase()}`;
  return "Simulation recorded";
}

function getSimulationSignalNarrative(result) {
  const summary = String(result?.summary || "").trim();
  if (summary) return summary;

  const reasons = (result?.reasons || [])
    .map((reason) => String(reason || "").trim())
    .filter(Boolean);
  if (reasons.length) return reasons.join(" · ");

  return "";
}

export function buildSimulationResultPresentation(result) {
  if (!result) return null;

  const decision = formatDecisionLabel(result.actionTaken ?? result.action);
  const threatLevel = formatThreatLevelLabel(result.threatLevel);
  const riskScore = formatRiskScoreLabel(result.riskScore);
  const path = result.pathVisited ? String(result.pathVisited) : null;
  const signalChips = (result.reasonCodes || [])
    .map((code) => ({
      code: String(code),
      label: formatReasonCodeChip(code),
    }))
    .filter((chip) => chip.label);
  const narrative = getSimulationSignalNarrative(result);

  return {
    summary: getSimulationResultSummary(result),
    recordedAtLabel: formatSimulationRecordedAt(result.createdAt),
    exactRecordedAt: result.createdAt || null,
    primary: [
      decision
        ? {
            id: "decision",
            label: "Decision",
            value: decision,
            badgeStatus:
              String(result.actionTaken ?? result.action ?? "allowed").toLowerCase() ===
              "blocked"
                ? "blocked"
                : "allowed",
          }
        : null,
      threatLevel
        ? {
            id: "threat_level",
            label: "Threat level",
            value: threatLevel,
            badgeStatus: String(result.threatLevel || "low").toLowerCase(),
          }
        : null,
      riskScore
        ? {
            id: "risk_score",
            label: "Risk score",
            value: riskScore,
          }
        : null,
      path
        ? {
            id: "path",
            label: "Path",
            value: path,
          }
        : null,
    ].filter(Boolean),
    signals: {
      chips: signalChips,
      narrative,
    },
    metadata: [
      result.ipAddress
        ? { id: "test_ip", label: "Test IP", value: String(result.ipAddress) }
        : null,
      result.id != null
        ? { id: "event_id", label: "Event ID", value: `#${result.id}` }
        : null,
      result.source
        ? { id: "source", label: "Source", value: String(result.source) }
        : null,
      result.createdAt
        ? {
            id: "recorded_at_exact",
            label: "Recorded",
            value: formatSimulationRecordedAt(result.createdAt),
            exactValue: String(result.createdAt),
          }
        : null,
    ].filter(Boolean),
    isolation: {
      enforcement: result.enforcementApplied === false ? "Not changed" : null,
      metrics: result.simulation === true ? "Excluded" : null,
      message:
        result.simulation === true
          ? "This simulation does not affect storefront enforcement, alerts, or live metrics."
          : null,
    },
  };
}

// Kept for compatibility with existing tests that assert field extraction behavior.
export function buildSimulationResultFields(result) {
  const presentation = buildSimulationResultPresentation(result);
  if (!presentation) return [];

  const fields = [
    {
      id: "activity_type",
      label: "Activity type",
      value: "Simulation test",
    },
  ];

  if (presentation.recordedAtLabel) {
    fields.push({
      id: "recorded_at",
      label: "Recorded",
      value: presentation.recordedAtLabel,
    });
  }

  for (const item of presentation.primary) {
    fields.push({
      id: item.id,
      label: item.label,
      value: item.value,
    });
  }

  if (presentation.signals.chips.length) {
    fields.push({
      id: "reason_codes",
      label: "Reason codes",
      value: presentation.signals.chips.map((chip) => chip.label).join(", "),
    });
  }

  if (presentation.signals.narrative) {
    fields.push({
      id: "reasons",
      label: "Reasons",
      value: presentation.signals.narrative,
    });
  }

  for (const item of presentation.metadata) {
    if (item.id !== "recorded_at_exact") {
      fields.push({
        id: item.id,
        label: item.label,
        value: item.value,
      });
    }
  }

  if (presentation.isolation.enforcement) {
    fields.push({
      id: "enforcement",
      label: "Live enforcement",
      value: presentation.isolation.enforcement,
    });
  }

  if (presentation.isolation.metrics) {
    fields.push({
      id: "metrics_isolation",
      label: "Live metrics",
      value: "Excluded from storefront metrics and reports",
    });
  }

  return fields;
}
