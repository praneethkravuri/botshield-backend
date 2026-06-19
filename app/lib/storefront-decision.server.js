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
      decision: "allowed",
      protectionPaused,
      reasonCodes: ["WHITELIST_MATCH"],
    };
  }

  if (protectionPaused) {
    return {
      decision: "allowed",
      protectionPaused: true,
      reasonCodes: ["PROTECTION_PAUSED"],
    };
  }

  if (detection.actionTaken === "blocked" || blockedEntry?.active) {
    return {
      decision: "blocked",
      protectionPaused: false,
      reasonCodes: blockedEntry?.active ? ["BLOCKLIST_MATCH"] : [],
    };
  }

  if (!autoBlock) {
    return {
      decision: "allowed",
      protectionPaused: false,
      reasonCodes: ["AUTO_BLOCK_DISABLED"],
    };
  }

  if (
    (detection.threatLevel === "medium" || detection.threatLevel === "high") &&
    !challengePassed
  ) {
    return {
      decision: "challenged",
      protectionPaused: false,
      reasonCodes: ["CHALLENGE_REQUIRED"],
    };
  }

  return {
    decision: "allowed",
    protectionPaused: false,
    reasonCodes: [],
  };
}
