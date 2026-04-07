import { isbot } from "isbot";

const DEFAULT_SETTINGS = {
  autoBlock: true,
  blockLevel: "Medium",
  strictMode: false,
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

export function buildDetectionSettings(settingRows = []) {
  const map = new Map(settingRows.map((row) => [row.key, row.value]));
  return {
    autoBlock: parseBooleanSetting(map.get("autoBlock"), DEFAULT_SETTINGS.autoBlock),
    strictMode: parseBooleanSetting(map.get("strictMode"), DEFAULT_SETTINGS.strictMode),
    blockLevel: map.get("blockLevel") || DEFAULT_SETTINGS.blockLevel,
  };
}

function scoreRequestSignals({ ipAddress, userAgent, pathVisited, recentEvents }) {
  let score = 0;
  const reasons = [];

  if (!userAgent) {
    score += 30;
    reasons.push("Missing user agent");
  }

  if (userAgent && isbot(userAgent)) {
    score += 40;
    reasons.push("Known bot-style user agent");
  }

  if (userAgent && SUSPICIOUS_UA_PATTERNS.some((pattern) => pattern.test(userAgent))) {
    score += 30;
    reasons.push("Suspicious automation signature");
  }

  if (
    pathVisited &&
    SENSITIVE_PATH_PATTERNS.some((segment) => pathVisited.toLowerCase().includes(segment))
  ) {
    score += 15;
    reasons.push("Sensitive route targeted");
  }

  const recentCount = recentEvents.length;
  if (recentCount >= 12) {
    score += 40;
    reasons.push("Burst traffic from same IP");
  } else if (recentCount >= 6) {
    score += 20;
    reasons.push("Elevated request rate");
  } else if (recentCount >= 3) {
    score += 8;
    reasons.push("Repeated traffic pattern");
  }

  const previousBlocks = recentEvents.filter((event) => event.action === "blocked").length;
  if (previousBlocks >= 3) {
    score += 35;
    reasons.push("Previously blocked multiple times");
  } else if (previousBlocks >= 1) {
    score += 15;
    reasons.push("Previously blocked");
  }

  const uniquePaths = new Set(
    recentEvents.map((event) => safeString(event.path).toLowerCase()).filter(Boolean),
  ).size;
  if (uniquePaths >= 5) {
    score += 10;
    reasons.push("Scanning multiple routes");
  }

  if (ipAddress === "0.0.0.0") {
    score += 15;
    reasons.push("Missing IP information");
  }

  return {
    score: Math.min(score, 100),
    reasons,
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
      summary: "Previously blocked IP rejected",
    };
  }

  const { score, reasons } = scoreRequestSignals({
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
    if (effectiveLevel === "Low" && score >= 45) {
      actionTaken = "blocked";
    } else if (effectiveLevel === "Medium" && score >= 70) {
      actionTaken = "blocked";
    } else if (effectiveLevel === "High" && score >= 55) {
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
