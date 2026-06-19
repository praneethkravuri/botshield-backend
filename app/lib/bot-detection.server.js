import { isbot } from "isbot";

const DEFAULT_SETTINGS = {
  autoBlock: true,
  blockLevel: "Medium",
  strictMode: false,
  protectionPausedUntil: null,
};

const SENSITIVE_PATH_PATTERNS = [
  "/account",
  "/login",
  "/cart",
  "/checkout",
  "/admin",
  "/api",
];

const SUSPICIOUS_UA_PATTERNS = [
  /curl/i,
  /wget/i,
  /python/i,
  /axios/i,
  /headless/i,
  /playwright/i,
  /puppeteer/i,
  /selenium/i,
  /phantom/i,
  /httpclient/i,
];

function safeString(value, fallback = "") {
  if (value == null) return fallback;
  return String(value);
}

export function normalizeIpAddress(ipAddress) {
  const raw = safeString(ipAddress).trim();
  if (!raw) return "0.0.0.0";
  return raw.replace(/^::ffff:/, "");
}

function parseBooleanSetting(value, fallback) {
  if (value == null) return fallback;
  const normalized = String(value).toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
}

function parseDateSetting(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function buildDetectionSettings(settingRows = []) {
  const map = new Map(settingRows.map((row) => [row.key, row.value]));
  return {
    autoBlock: parseBooleanSetting(map.get("autoBlock"), DEFAULT_SETTINGS.autoBlock),
    strictMode: parseBooleanSetting(map.get("strictMode"), DEFAULT_SETTINGS.strictMode),
    blockLevel: map.get("blockLevel") || DEFAULT_SETTINGS.blockLevel,
    protectionPausedUntil: parseDateSetting(map.get("protectionPausedUntil")),
  };
}

function scoreRequestSignals({ ipAddress, userAgent, pathVisited, recentEvents }) {
  let score = 0;
  const reasons = [];
  const reasonCodes = [];

  if (!userAgent) {
    score += 30;
    reasons.push("Missing user agent");
    reasonCodes.push("MISSING_USER_AGENT");
  }

  if (userAgent && isbot(userAgent)) {
    score += 40;
    reasons.push("Known bot-style user agent");
    reasonCodes.push("KNOWN_BOT_USER_AGENT");
  }

  if (userAgent && SUSPICIOUS_UA_PATTERNS.some((pattern) => pattern.test(userAgent))) {
    score += 30;
    reasons.push("Suspicious automation signature");
    reasonCodes.push("SUSPICIOUS_USER_AGENT");
  }

  if (
    pathVisited &&
    SENSITIVE_PATH_PATTERNS.some((segment) => pathVisited.toLowerCase().includes(segment))
  ) {
    score += 15;
    reasons.push("Sensitive route targeted");
    reasonCodes.push("SENSITIVE_PATH");
  }

  const recentCount = recentEvents.length;
  if (recentCount >= 12) {
    score += 40;
    reasons.push("Burst traffic from same IP");
    reasonCodes.push("RATE_PATTERN");
  } else if (recentCount >= 6) {
    score += 20;
    reasons.push("Elevated request rate");
    reasonCodes.push("RATE_PATTERN");
  } else if (recentCount >= 3) {
    score += 8;
    reasons.push("Repeated traffic pattern");
    reasonCodes.push("RATE_PATTERN");
  }

  const previousBlocks = recentEvents.filter((event) => event.action === "blocked").length;
  if (previousBlocks >= 3) {
    score += 35;
    reasons.push("Previously blocked multiple times");
    reasonCodes.push("REPEAT_OFFENDER");
  } else if (previousBlocks >= 1) {
    score += 15;
    reasons.push("Previously blocked");
    reasonCodes.push("REPEAT_OFFENDER");
  }

  const uniquePaths = new Set(
    recentEvents.map((event) => safeString(event.path).toLowerCase()).filter(Boolean),
  ).size;
  if (uniquePaths >= 5) {
    score += 10;
    reasons.push("Scanning multiple routes");
    reasonCodes.push("PATH_SCANNING");
  }

  if (ipAddress === "0.0.0.0") {
    score += 15;
    reasons.push("Missing IP information");
    reasonCodes.push("MISSING_IP");
  }

  return {
    score: Math.min(score, 100),
    reasons,
    reasonCodes: [...new Set(reasonCodes)],
  };
}

export function detectBotThreat({
  ipAddress,
  userAgent,
  pathVisited,
  recentEvents = [],
  settings = DEFAULT_SETTINGS,
  whitelistEntry = null,
  blockedEntry = null,
}) {
  const normalizedIp = normalizeIpAddress(ipAddress);
  const normalizedPath = safeString(pathVisited, "/");
  const normalizedUserAgent = safeString(userAgent);

  if (whitelistEntry?.active) {
    return {
      ipAddress: normalizedIp,
      pathVisited: normalizedPath,
      userAgent: normalizedUserAgent,
      riskScore: 0,
      threatLevel: "low",
      actionTaken: "whitelisted",
      reasons: ["Trusted whitelist entry"],
      reasonCodes: ["WHITELIST_MATCH"],
      summary: "Trusted traffic allowed",
    };
  }

  if (blockedEntry?.active) {
    return {
      ipAddress: normalizedIp,
      pathVisited: normalizedPath,
      userAgent: normalizedUserAgent,
      riskScore: 100,
      threatLevel: "high",
      actionTaken: "blocked",
      reasons: ["IP is on the blocklist"],
      reasonCodes: ["BLOCKLIST_MATCH"],
      summary: "Previously blocked IP rejected",
    };
  }

  const { score, reasons, reasonCodes } = scoreRequestSignals({
    ipAddress: normalizedIp,
    userAgent: normalizedUserAgent,
    pathVisited: normalizedPath,
    recentEvents,
  });

  let threatLevel = "low";
  if (score >= 75) {
    threatLevel = "high";
  } else if (score >= 40) {
    threatLevel = "medium";
  }

  const effectiveLevel = settings.strictMode ? "High" : settings.blockLevel;

  let actionTaken = "allowed";
  if (settings.autoBlock) {
    if (settings.strictMode && score >= 35) {
      actionTaken = "blocked";
      reasonCodes.push("STRICT_MODE");
    } else if (effectiveLevel === "Low" && score >= 90) {
      actionTaken = "blocked";
    } else if (effectiveLevel === "Medium" && score >= 70) {
      actionTaken = "blocked";
    } else if (effectiveLevel === "High" && score >= 50) {
      actionTaken = "blocked";
    }
  }

  return {
    ipAddress: normalizedIp,
    pathVisited: normalizedPath,
    userAgent: normalizedUserAgent,
    riskScore: score,
    threatLevel,
    actionTaken,
    reasons: reasons.length ? reasons : ["No significant risk signals detected"],
    reasonCodes: reasonCodes.length ? [...new Set(reasonCodes)] : ["NO_SIGNIFICANT_RISK"],
    summary:
      actionTaken === "blocked"
        ? "Traffic blocked by detection engine"
        : threatLevel === "high"
        ? "High-risk traffic detected"
        : threatLevel === "medium"
        ? "Suspicious traffic detected"
        : "Traffic allowed",
  };
}
