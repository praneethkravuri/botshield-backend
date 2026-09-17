import { extractReasonCodes } from "./security-events.js";

export const VALUE_PROTECTION_CATEGORIES = [
  {
    id: "bot-protection",
    label: "Bot protection",
    codes: [
      "KNOWN_BOT_USER_AGENT",
      "SUSPICIOUS_USER_AGENT",
      "MISSING_USER_AGENT",
    ],
  },
  {
    id: "network-protection",
    label: "Network protection",
    codes: [
      "VPN_DETECTED",
      "DATACENTER_IP",
      "HOSTING_PROVIDER",
      "HIGH_RISK_NETWORK",
      "ASN_MATCH",
    ],
  },
  {
    id: "rate-protection",
    label: "Rate protection",
    codes: ["RATE_PATTERN", "REPEAT_OFFENDER"],
  },
  {
    id: "page-protection",
    label: "Page protection",
    codes: ["SENSITIVE_PATH", "PATH_SCANNING"],
  },
];

export function getEventReasonCodes(event) {
  if (Array.isArray(event?.reasonCodes) && event.reasonCodes.length) {
    return [...new Set(event.reasonCodes.map((code) => String(code).toUpperCase()))];
  }
  return extractReasonCodes(event?.reasonSummary || "");
}

export function isSuspiciousValueEvent(event) {
  const threatLevel = String(event?.threatLevel || "").toLowerCase();
  const action = String(event?.action || event?.actionTaken || "").toLowerCase();
  return (
    ["medium", "high"].includes(threatLevel) ||
    ["blocked", "challenged"].includes(action) ||
    getEventReasonCodes(event).some((code) =>
      VALUE_PROTECTION_CATEGORIES.some((category) =>
        category.codes.includes(code),
      ),
    )
  );
}

export function classifyValueEventCategory(event) {
  const codes = getEventReasonCodes(event);
  for (const category of VALUE_PROTECTION_CATEGORIES) {
    if (category.codes.some((code) => codes.includes(code))) {
      return category.id;
    }
  }
  return "uncategorized";
}

export function normalizeStorefrontEventRow(row) {
  return {
    id: row.id,
    threatLevel: row.threatLevel,
    action: row.action,
    reasonSummary: row.reasonSummary,
    reasonCodes: getEventReasonCodes(row),
    createdAt: row.createdAt,
  };
}
