import { extractReasonCodes } from "./security-events.js";

export const VALUE_V2_CATEGORIES = [
  {
    id: "bot-protection",
    label: "Automated abuse",
    codes: [
      "KNOWN_BOT_USER_AGENT",
      "SUSPICIOUS_USER_AGENT",
      "MISSING_USER_AGENT",
    ],
  },
  {
    id: "network-protection",
    label: "Suspicious traffic",
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
    label: "Rate abuse",
    codes: ["RATE_PATTERN", "REPEAT_OFFENDER"],
  },
  {
    id: "page-protection",
    label: "Sensitive paths",
    codes: ["SENSITIVE_PATH", "PATH_SCANNING"],
  },
];

const STOREFRONT_SOURCE = "storefront-proxy";
const DETECTED_LEVELS = new Set(["medium", "high"]);

export function isStorefrontEvent(event) {
  return String(event?.source || "") === STOREFRONT_SOURCE;
}

export function isDetectedEvent(event) {
  return DETECTED_LEVELS.has(String(event?.threatLevel || "").toLowerCase());
}

export function isBlockedEvent(event) {
  return String(event?.action || "") === "blocked";
}

export function isChallengedEvent(event) {
  return String(event?.action || "") === "challenged";
}

export function isInterventionEvent(event) {
  return isBlockedEvent(event) || isChallengedEvent(event);
}

export function classifyValueV2Category(event) {
  const codes = extractReasonCodes(event?.reasonSummary || "");
  for (const category of VALUE_V2_CATEGORIES) {
    if (codes.some((code) => category.codes.includes(code))) {
      return category.id;
    }
  }
  return "uncategorized";
}

export function normalizeValueV2EventRow(row) {
  return {
    action: String(row?.action || ""),
    threatLevel: String(row?.threatLevel || "").toLowerCase(),
    reasonSummary: String(row?.reasonSummary || ""),
    createdAt: row?.createdAt ? new Date(row.createdAt) : null,
    source: String(row?.source || ""),
  };
}
