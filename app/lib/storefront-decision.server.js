export function resolveStorefrontDecision({
  detection,
  blockedEntry = null,
  whitelistEntry = null,
  challengePassed = false,
  autoBlock = true,
  protectionPausedUntil = null,
  now = Date.now(),
}) {
  const pauseTime = protectionPausedUntil
    ? new Date(protectionPausedUntil).getTime()
    : 0;
  const protectionPaused = Number.isFinite(pauseTime) && pauseTime > now;

  if (whitelistEntry?.active) {
    return {
      decision: "allow",
      protectionPaused,
      reasonCodes: ["WHITELIST_MATCH"],
    };
  }

  if (protectionPaused) {
    return {
      decision: "allow",
      protectionPaused: true,
      reasonCodes: ["PROTECTION_PAUSED"],
    };
  }

  if (detection.actionTaken === "blocked" || blockedEntry?.active) {
    return {
      decision: "block",
      protectionPaused: false,
      reasonCodes: blockedEntry?.active ? ["BLOCKLIST_MATCH"] : [],
    };
  }

  if (!autoBlock) {
    return {
      decision: "allow",
      protectionPaused: false,
      reasonCodes: ["AUTO_BLOCK_DISABLED"],
    };
  }

  if (
    (detection.threatLevel === "medium" || detection.threatLevel === "high") &&
    !challengePassed
  ) {
    return {
      decision: "challenge",
      protectionPaused: false,
      reasonCodes: ["CHALLENGE_REQUIRED"],
    };
  }

  return {
    decision: "allow",
    protectionPaused: false,
    reasonCodes: [],
  };
}

export function getStorefrontActionForLog(decision, reasonCodes = []) {
  if (reasonCodes.includes("WHITELIST_MATCH")) return "whitelisted";
  if (decision === "block") return "blocked";
  if (decision === "challenge") return "challenged";
  return "allowed";
}
