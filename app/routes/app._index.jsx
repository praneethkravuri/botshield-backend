import { useEffect, useMemo, useState } from "react";

function getWeekStart(dateInput) {
  const date = new Date(dateInput);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(date);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function isSameWeek(dateInput, baseDate) {
  if (!dateInput) return false;
  return getWeekStart(dateInput).getTime() === getWeekStart(baseDate).getTime();
}

function isPreviousWeek(dateInput, baseDate) {
  if (!dateInput) return false;
  const currentWeekStart = getWeekStart(baseDate);
  const previousWeekStart = new Date(currentWeekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);
  return getWeekStart(dateInput).getTime() === previousWeekStart.getTime();
}

function AnimatedNumber({ value, prefix = "", suffix = "" }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const target = Number(value) || 0;
    let frameId;
    let startTime;
    const duration = 700;

    const tick = (time) => {
      if (!startTime) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(target * eased));

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [value]);

  return (
    <span>
      {prefix}
      {displayValue}
      {suffix}
    </span>
  );
}

function Toggle({ checked, onClick, theme }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "56px",
        height: "30px",
        borderRadius: "999px",
        border: `1px solid ${checked ? "#16a34a" : theme.border}`,
        background: checked ? "#22c55e" : theme.track,
        position: "relative",
        cursor: "pointer",
        transition: "all 0.2s ease",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "3px",
          left: checked ? "29px" : "3px",
          width: "22px",
          height: "22px",
          borderRadius: "999px",
          background: "#ffffff",
          transition: "all 0.2s ease",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        }}
      />
    </button>
  );
}

function getAssistantReply(question, context) {
  const q = question.toLowerCase();
  const {
    scansToday,
    blockedToday,
    blockedCount,
    percentHigh,
    autoBlock,
    protectionOn,
    blockLevel,
    recentBlocks,
    moneySaved,
    lastScanLabel,
    recommendation,
    insight,
  } = context;

  if (q.includes("summary") || q.includes("today")) {
    return `Today there have been ${scansToday} scans, ${blockedToday} blocked threats, and ${percentHigh}% of traffic has been high risk. Protection is ${protectionOn ? "active" : "off"} and auto-block is ${autoBlock ? "enabled" : "disabled"}.`;
  }

  if (q.includes("blocked") || q.includes("why")) {
    return `Traffic gets blocked when risk is high enough for the current rule set. Right now block level is ${blockLevel}, total blocked threats are ${blockedCount}, and recent blocked activity in the last hour is ${recentBlocks}.`;
  }

  if (q.includes("strict") || q.includes("block level")) {
    return `Current block level is ${blockLevel}. ${recommendation}`;
  }

  if (q.includes("auto block")) {
    return `Auto-block is currently ${autoBlock ? "ON" : "OFF"}. When enabled, the dashboard can automatically block risky traffic based on the selected block level.`;
  }

  if (q.includes("scan") || q.includes("last scan")) {
    return `The last recorded scan was ${lastScanLabel}. Today there have been ${scansToday} scans total.`;
  }

  if (q.includes("money") || q.includes("saved") || q.includes("revenue")) {
    return `Estimated revenue protected so far is $${moneySaved}, based on blocked suspicious traffic.`;
  }

  if (q.includes("risk") || q.includes("threat")) {
    return `${insight}`;
  }

  if (q.includes("recommend")) {
    return recommendation;
  }

  if (q.includes("help") || q.includes("what can you do")) {
    return "I can summarize traffic, explain blocked activity, describe auto-block, recommend settings, and answer questions about scans, threats, and dashboard status.";
  }

  return `Here’s the current picture: protection is ${
    protectionOn ? "active" : "not active"
  }, auto-block is ${autoBlock ? "enabled" : "disabled"}, ${blockedToday} threats were blocked today, and ${percentHigh}% of traffic is high risk. ${recommendation}`;
}

function formatCountLabel(value, singular, plural) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function joinClauses(parts) {
  return parts.filter(Boolean).join(" ");
}

function getSecurityPostureLabel(context) {
  if (context.protectionPaused) return "paused";
  if (!context.protectionOn) return "offline";
  if (context.botPressureScore >= 70 || context.percentHigh >= 45) return "under pressure";
  if (context.botPressureScore >= 40 || context.percentHigh >= 20) return "elevated";
  return "stable";
}

function buildExecutiveSummary(context) {
  const topSignal =
    context.recentBlocks > 0
      ? `${formatCountLabel(context.recentBlocks, "block", "blocks")} fired in the last hour`
      : "no recent block spike detected";

  return joinClauses([
    `Current posture is ${getSecurityPostureLabel(context)}.`,
    `Today the system processed ${formatCountLabel(context.scansToday, "scan", "scans")} and blocked ${formatCountLabel(context.blockedToday, "threat", "threats")}.`,
    `${context.percentHigh}% of observed traffic has scored high risk, bot pressure is ${context.botPressureScore}/100 (${context.botPressureLabel.toLowerCase()}), and ${topSignal}.`,
    `Protection is ${context.protectionOn ? "active" : "disabled"}, auto-block is ${context.autoBlock ? "enabled" : "disabled"}, and the operating mode is ${context.storeProtectionModeLabel}.`,
  ]);
}

function buildIncidentAnalysis(context) {
  const lastScan = context.latestThreat
    ? `The latest notable event was ${context.latestThreat.threatLevel} risk traffic from ${context.latestThreat.ipAddress} that was ${context.latestThreat.actionTaken}.`
    : "There is no recent incident record yet, so the dashboard is working from a light traffic sample.";

  const pressureReason =
    context.percentHigh >= 40 || context.recentBlocks >= 3
      ? "The main driver right now is a higher concentration of risky traffic and recent enforcement activity."
      : "The current threat mix looks controlled, with no major burst pattern in the last hour.";

  return joinClauses([
    lastScan,
    `Total enforcement count is ${context.blockedCount}, with ${formatCountLabel(context.blockedIpCount, "tracked blocked IP", "tracked blocked IPs")} and ${formatCountLabel(context.whitelistCount, "whitelisted IP", "whitelisted IPs")} on trusted lists.`,
    pressureReason,
    `The active policy is ${context.blockLevel}${context.strictMode ? " with strict mode layered on top" : ""}.`,
  ]);
}

function buildRecommendationReply(context) {
  if (context.protectionPaused) {
    return `Resume protection first. The stack is currently paused for another ${context.pauseCountdown} minute${context.pauseCountdown === 1 ? "" : "s"}, so any tuning change matters less until enforcement is back online.`;
  }

  if (!context.autoBlock && (context.percentHigh >= 20 || context.botPressureScore >= 40)) {
    return `Turn on auto-block next. Risk is elevated enough that manual review alone will be slow, and the current ${context.blockLevel} policy can start enforcing immediately once auto-block is enabled.`;
  }

  if (!context.strictMode && (context.percentHigh >= 35 || context.recentBlocks >= 3)) {
    return "Enable strict mode if you want the safer posture. The dashboard is already seeing enough risky traffic that a more aggressive enforcement profile is justified.";
  }

  if (context.blockLevel === "Low" && context.percentHigh >= 20) {
    return "Move the block level to Medium or High. Low is fine for calm traffic, but your current risk mix suggests stronger filtering would reduce manual cleanup.";
  }

  if (context.blockedToday === 0 && context.scansToday > 0 && context.percentHigh < 10) {
    return "Keep the current settings. The store looks healthy, enforcement pressure is low, and there is no signal that you need a harsher policy right now.";
  }

  return `Current recommendation: ${context.recommendation} With ${context.botPressureScore}/100 bot pressure and ${context.percentHigh}% high-risk traffic, the safest posture is ${context.strictMode ? "to keep strict mode active and continue monitoring" : `to stay on ${context.blockLevel} and watch the next traffic wave closely`}.`;
}

function buildSettingsExplanation(context) {
  return joinClauses([
    `Auto-block is ${context.autoBlock ? "on" : "off"}, strict mode is ${context.strictMode ? "on" : "off"}, and block level is ${context.blockLevel}.`,
    context.autoBlock
      ? "That means the platform can immediately enforce decisions instead of only surfacing alerts."
      : "That means the system can score traffic, but the operator still carries more of the enforcement load.",
    context.strictMode
      ? "Strict mode adds a more aggressive filter posture for elevated-risk traffic."
      : "Strict mode is currently available as your fast escalation path if the threat mix worsens.",
  ]);
}

function createAssistantMessage({
  badge = "Copilot",
  title,
  text,
  bullets = [],
  action = "",
  followUps = [],
  intent = "general",
}) {
  return {
    role: "assistant",
    badge,
    title,
    text,
    bullets,
    action,
    followUps,
    meta: { intent },
  };
}

function detectCopilotIntent(question, history = []) {
  const q = question.toLowerCase();
  const lastAssistantIntent = [...history]
    .reverse()
    .find((message) => message.role === "assistant" && message.meta?.intent)?.meta?.intent;

  if (
    lastAssistantIntent &&
    (q.includes("go deeper") ||
      q.includes("more detail") ||
      q.includes("expand") ||
      q.includes("tell me more") ||
      q.includes("more on that"))
  ) {
    return lastAssistantIntent;
  }

  if (q.includes("help") || q.includes("what can you do") || q.includes("capabilities")) {
    return "help";
  }

  if (
    q.includes("summary") ||
    q.includes("today") ||
    q.includes("overview") ||
    q.includes("status") ||
    q.includes("executive")
  ) {
    return "summary";
  }

  if (
    q.includes("blocked") ||
    q.includes("why") ||
    q.includes("incident") ||
    q.includes("attack")
  ) {
    return "incident";
  }

  if (
    q.includes("strict") ||
    q.includes("block level") ||
    q.includes("settings") ||
    q.includes("config") ||
    q.includes("auto block")
  ) {
    return "config";
  }

  if (q.includes("scan") || q.includes("last scan") || q.includes("latest")) {
    return "scan";
  }

  if (
    q.includes("money") ||
    q.includes("saved") ||
    q.includes("revenue") ||
    q.includes("impact")
  ) {
    return "revenue";
  }

  if (
    q.includes("recommend") ||
    q.includes("should i") ||
    q.includes("what should") ||
    q.includes("what do i do")
  ) {
    return "recommendation";
  }

  if (q.includes("risk") || q.includes("threat") || q.includes("pressure")) {
    return "risk";
  }

  return "summary";
}

function getAssistantCopilotReply(question, context, history = []) {
  const intent = detectCopilotIntent(question, history);

  if (intent === "help") {
    return createAssistantMessage({
      badge: "Capabilities",
      title: "BotShield Copilot",
      text: "I can act more like an operator copilot now, not just a dashboard FAQ.",
      bullets: [
        "Give live executive summaries from the current security posture.",
        "Explain why the platform blocked or allowed traffic.",
        "Compare settings and recommend the next action to take.",
        "Brief you on incident pressure, weekly movement, and commerce impact.",
      ],
      followUps: [
        "Give me an executive summary",
        "Analyze the latest incident",
        "What should I change next?",
      ],
      intent,
    });
  }

  if (intent === "incident") {
    return createAssistantMessage({
      badge: "Incident Review",
      title: "Threat Analysis",
      text: buildIncidentAnalysis(context),
      bullets: [
        context.latestThreat
          ? `Latest event: ${context.latestThreat.ipAddress} on ${context.latestThreat.pathVisited || "/"}`
          : "Latest event: no recent threat sample",
        `Blocked IP inventory: ${context.blockedIpCount}`,
        `Trusted list size: ${context.whitelistCount}`,
      ],
      action: buildRecommendationReply(context),
      followUps: [
        "Give me an executive summary",
        "Explain my current settings",
        "What should I change next?",
      ],
      intent,
    });
  }

  if (intent === "config") {
    return createAssistantMessage({
      badge: "Policy Review",
      title: "Current Protection Configuration",
      text: buildSettingsExplanation(context),
      bullets: [
        `Auto-block: ${context.autoBlock ? "Enabled" : "Disabled"}`,
        `Strict mode: ${context.strictMode ? "Enabled" : "Disabled"}`,
        `Block level: ${context.blockLevel}`,
      ],
      action: buildRecommendationReply(context),
      followUps: [
        "Should I enable strict mode?",
        "What should I change next?",
        "Analyze the latest incident",
      ],
      intent,
    });
  }

  if (intent === "scan") {
    return createAssistantMessage({
      badge: "Latest Scan",
      title: "Scan Timeline",
      text: joinClauses([
        `The latest recorded scan was ${context.lastScanLabel}.`,
        context.latestThreat
          ? `It involved ${context.latestThreat.ipAddress} on ${context.latestThreat.pathVisited || "/"} and was classified as ${context.latestThreat.threatLevel} risk with an action of ${context.latestThreat.actionTaken}.`
          : `Today there have been ${formatCountLabel(context.scansToday, "scan", "scans")} in total.`,
        `Current weekly volume is ${context.currentWeekScans} scans with ${context.currentWeekBlocked} blocked this week.`,
      ]),
      bullets: [
        `Weekly scans: ${context.currentWeekScans}`,
        `Weekly blocked: ${context.currentWeekBlocked}`,
        `Last scan label: ${context.lastScanLabel}`,
      ],
      action: buildRecommendationReply(context),
      followUps: [
        "Analyze the latest incident",
        "Give me an executive summary",
        "What should I change next?",
      ],
      intent,
    });
  }

  if (intent === "revenue") {
    return createAssistantMessage({
      badge: "Commerce Impact",
      title: "Revenue Protection View",
      text: `Estimated revenue protected is $${context.moneySaved}. That figure tracks against ${context.blockedCount} blocked events and gives operators a simple commerce-impact view of how much suspicious traffic has been intercepted.`,
      bullets: [
        `Blocked events: ${context.blockedCount}`,
        `Blocked today: ${context.blockedToday}`,
        `High-risk share: ${context.percentHigh}%`,
      ],
      action: buildRecommendationReply(context),
      followUps: [
        "Give me an executive summary",
        "Analyze the latest incident",
        "Explain my current settings",
      ],
      intent,
    });
  }

  if (intent === "recommendation") {
    return createAssistantMessage({
      badge: "Operator Guidance",
      title: "Best Next Action",
      text: buildRecommendationReply(context),
      bullets: [
        `Current mode: ${context.storeProtectionModeLabel}`,
        `Bot pressure: ${context.botPressureScore}/100`,
        `Recent blocks: ${context.recentBlocks}`,
      ],
      action: context.protectionPaused
        ? "Recommended move: resume protection before changing any other setting."
        : context.strictMode
        ? "Recommended move: keep strict mode on and monitor the next wave of traffic."
        : "Recommended move: harden the policy only if the next traffic wave confirms elevated pressure.",
      followUps: [
        "Explain my current settings",
        "Analyze the latest incident",
        "Give me an executive summary",
      ],
      intent,
    });
  }

  if (intent === "risk") {
    return createAssistantMessage({
      badge: "Risk Brief",
      title: "Threat Pressure Assessment",
      text: joinClauses([
        `${context.insight}`,
        `Bot pressure is ${context.botPressureScore}/100, which the dashboard rates as ${context.botPressureLabel.toLowerCase()}.`,
        `High-risk traffic is ${context.percentHigh}% of observed volume, with ${context.highRiskCount} high-risk events and ${context.mediumRiskCount} medium-risk events in the current data set.`,
      ]),
      bullets: [
        `High-risk events: ${context.highRiskCount}`,
        `Medium-risk events: ${context.mediumRiskCount}`,
        `Protection active: ${context.protectionOn ? "Yes" : "No"}`,
      ],
      action: buildRecommendationReply(context),
      followUps: [
        "What should I change next?",
        "Explain my current settings",
        "Analyze the latest incident",
      ],
      intent,
    });
  }

  return createAssistantMessage({
    badge: "Executive Brief",
    title: "Live Security Summary",
    text: buildExecutiveSummary(context),
    bullets: [
      `Threat pressure: ${context.botPressureScore}/100 (${context.botPressureLabel})`,
      `Blocked today: ${context.blockedToday} of ${context.scansToday} scans`,
      `Protection posture: ${context.storeProtectionModeLabel}`,
    ],
    action: buildRecommendationReply(context),
    followUps: [
      "Analyze the latest incident",
      "Explain my current settings",
      "What should I change next?",
    ],
    intent: "summary",
  });
}

function SecurityPage({
  theme,
  darkMode,
  cardStyle,
  buttonBaseStyle,
  getPrimaryButtonStyle,
  getSecondaryButtonStyle,
  getDangerButtonStyle,
  getRiskBadgeStyle,
  scans,
  blockedIPs,
  blockLevel,
  handleBlockLevelChange,
  autoBlock,
  handleAutoBlockToggle,
  strictMode,
  handleStrictModeToggle,
  handleBackendScan,
  handleSecurityBlockAction,
  handleSecurityWhitelistAction,
  liveSecurityLogs,
  recentThreatFeed,
  storeProtectionMode,
  blockedCount,
  recentBlocks,
}) {
  const threatLevelButtonStyle = (level) => ({
    ...buttonBaseStyle,
    padding: "10px 14px",
    borderRadius: "12px",
    border: `1px solid ${blockLevel === level ? "#22c55e" : theme.border}`,
    background: blockLevel === level ? (theme.successBg || "#ecfdf3") : theme.surface,
    color: blockLevel === level ? (theme.successText || "#166534") : theme.text,
    cursor: "pointer",
    fontWeight: 700,
    transition: "all 0.2s ease",
  });

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <div style={cardStyle}>
        <div style={{ fontWeight: 800, color: theme.text, marginBottom: "14px" }}>
          Threat Sensitivity
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button onClick={() => handleBlockLevelChange("Low")} style={threatLevelButtonStyle("Low")}>
            Low
          </button>
          <button onClick={() => handleBlockLevelChange("Medium")} style={threatLevelButtonStyle("Medium")}>
            Medium
          </button>
          <button onClick={() => handleBlockLevelChange("High")} style={threatLevelButtonStyle("High")}>
            High
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
        }}
      >
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0, color: theme.text }}>Core Controls</h3>

          <div
            style={{
              display: "grid",
              gap: "16px",
              marginBottom: "18px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
              <div>
                <div style={{ fontWeight: 700, color: theme.text }}>Auto Block Toggle</div>
                <div style={{ color: theme.muted, fontSize: "13px" }}>Automatically block risky traffic</div>
              </div>
              <Toggle checked={autoBlock} onClick={handleAutoBlockToggle} theme={theme} />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
              <div>
                <div style={{ fontWeight: 700, color: theme.text }}>Strict Mode</div>
                <div style={{ color: theme.muted, fontSize: "13px" }}>
                  Enable aggressive suspicious traffic blocking
                </div>
              </div>
              <Toggle checked={strictMode} onClick={handleStrictModeToggle} theme={theme} />
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
            <button onClick={handleBackendScan} style={getPrimaryButtonStyle()}>
              Scan Now
            </button>
            <button onClick={handleSecurityBlockAction} style={getDangerButtonStyle()}>
              Block IP
            </button>
            <button onClick={handleSecurityWhitelistAction} style={getSecondaryButtonStyle()}>
              Whitelist IP
            </button>
          </div>

          <div
            style={{
              padding: "14px",
              borderRadius: "14px",
              border: `1px solid ${theme.border}`,
              background: theme.surfaceAlt,
            }}
          >
            <div style={{ fontWeight: 700, color: theme.text, marginBottom: "8px" }}>
              Current Protection Mode
            </div>
            <span style={getRiskBadgeStyle(storeProtectionMode.badge)}>
              {storeProtectionMode.label}
            </span>
            <div style={{ color: theme.muted, fontSize: "13px", marginTop: "8px" }}>
              {storeProtectionMode.description}
            </div>
          </div>
        </div>

        <div
          style={{
            ...cardStyle,
            background: theme.surface,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: darkMode
                ? "radial-gradient(circle at 84% 18%, rgba(56,189,248,0.12), transparent 26%)"
                : "radial-gradient(circle at 84% 18%, rgba(14,165,233,0.10), transparent 26%)",
            }}
          />
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}>
              <div>
                <h3 style={{ marginTop: 0, marginBottom: "6px", color: theme.text }}>Security Summary</h3>
                <p style={{ margin: 0, color: theme.muted, fontSize: "13px", lineHeight: 1.7 }}>
                  Live policy posture, enforcement state, and tracked runtime activity.
                </p>
              </div>
              <span style={getRiskBadgeStyle(strictMode ? "high" : blockLevel)}>
                {strictMode ? "Strict policy" : `${blockLevel} policy`}
              </span>
            </div>

            <div
              style={{
                marginTop: "18px",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
              }}
            >
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "16px",
                  background: theme.surfaceAlt,
                  border: `1px solid ${theme.border}`,
                }}
              >
                <div style={{ color: theme.muted, fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>
                  Auto Block
                </div>
                <div style={{ color: theme.text, fontWeight: 800, fontSize: "20px", marginTop: "8px" }}>
                  {autoBlock ? "Enabled" : "Disabled"}
                </div>
              </div>

              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "16px",
                  background: theme.surfaceAlt,
                  border: `1px solid ${theme.border}`,
                }}
              >
                <div style={{ color: theme.muted, fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>
                  Strict Mode
                </div>
                <div style={{ color: theme.text, fontWeight: 800, fontSize: "20px", marginTop: "8px" }}>
                  {strictMode ? "Active" : "Standby"}
                </div>
              </div>

              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "16px",
                  background: theme.surfaceAlt,
                  border: `1px solid ${theme.border}`,
                }}
              >
                <div style={{ color: theme.muted, fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>
                  Total Blocked
                </div>
                <div style={{ color: theme.text, fontWeight: 800, fontSize: "20px", marginTop: "8px" }}>
                  {blockedCount}
                </div>
              </div>

              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "16px",
                  background: theme.surfaceAlt,
                  border: `1px solid ${theme.border}`,
                }}
              >
                <div style={{ color: theme.muted, fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>
                  Tracked IPs
                </div>
                <div style={{ color: theme.text, fontWeight: 800, fontSize: "20px", marginTop: "8px" }}>
                  {blockedIPs.length}
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: "14px",
                padding: "14px 16px",
                borderRadius: "18px",
                background: theme.surfaceAlt,
                border: `1px solid ${theme.border}`,
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ color: theme.muted, fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>
                  Blocked Last Hour
                </div>
                <div style={{ color: theme.text, fontWeight: 800, fontSize: "24px", marginTop: "6px" }}>
                  {recentBlocks}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: theme.muted, fontSize: "12px" }}>
                  Enforcement posture
                </div>
                <div style={{ color: recentBlocks > 0 ? theme.dangerText : theme.successText, fontWeight: 800, marginTop: "6px" }}>
                  {recentBlocks > 0 ? "Elevated" : "Stable"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
        }}
      >
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0, color: theme.text }}>Live Logs</h3>
          <div style={{ display: "grid", gap: "10px" }}>
            {liveSecurityLogs.map((item, index) => (
              <div
                key={`${item.message}-${index}`}
                style={{
                  padding: "12px",
                  borderRadius: "12px",
                  border: `1px solid ${theme.border}`,
                  background: theme.surfaceAlt,
                  transition: "all 0.2s ease",
                }}
              >
                <strong>{item.status}</strong> <span style={{ color: theme.text }}>{item.message}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={{ marginTop: 0, color: theme.text }}>Recent Threats</h3>
          <div style={{ display: "grid", gap: "10px" }}>
            {recentThreatFeed.map((item, index) => (
              <div
                key={`${item}-${index}`}
                style={{
                  padding: "12px",
                  borderRadius: "12px",
                  border: `1px solid ${theme.border}`,
                  background: theme.surfaceAlt,
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, color: theme.text }}>Recent Security Records</h3>
        {scans.length === 0 ? (
          <p style={{ color: theme.muted, marginBottom: 0 }}>Security events will appear here as traffic is scanned.</p>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {scans.slice(0, 8).map((scan) => (
              <div
                key={scan.id}
                style={{
                  padding: "12px",
                  borderRadius: "12px",
                  border: `1px solid ${theme.border}`,
                  background: theme.surfaceAlt,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                  <strong style={{ color: theme.text }}>{scan.ipAddress}</strong>
                  <span style={{ color: theme.muted, fontSize: "13px" }}>
                    {scan.createdAt ? new Date(scan.createdAt).toLocaleString() : "Unknown time"}
                  </span>
                </div>
                <div style={{ color: theme.muted, fontSize: "13px", marginTop: "6px" }}>
                  Threat: {scan.threatLevel} | Action: {scan.actionTaken} | Path: {scan.pathVisited}
                </div>
                {scan.reasons ? (
                  <div style={{ color: theme.muted, fontSize: "12px", marginTop: "6px", lineHeight: 1.6 }}>
                    Reason: {scan.reasons}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsPage({
  theme,
  cardStyle,
  inputStyle,
  selectStyle,
  getPrimaryButtonStyle,
  emailAlerts,
  handleEmailAlertsToggle,
  smsAlerts,
  handleSmsAlertsToggle,
  highRiskAlertsOnly,
  handleHighRiskAlertsOnlyToggle,
  alertEmail,
  setAlertEmail,
  blockLevel,
  handleBlockLevelChange,
  autoBlock,
  handleAutoBlockToggle,
  strictMode,
  handleStrictModeToggle,
  storeProtectionMode,
  handleSaveSettings,
}) {
  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <div style={cardStyle}>
        <h2 style={{ marginTop: 0, color: theme.text }}>Policy Settings</h2>
        <p style={{ color: theme.muted, marginBottom: 0 }}>
          Configure alert routing, automation, and storefront protection policy.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
        }}
      >
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0, color: theme.text }}>Alert Routing</h3>

          <div style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", color: theme.muted, fontSize: "13px", marginBottom: "8px" }}>
              Alert Email
            </label>
            <input
              value={alertEmail}
              onChange={(e) => setAlertEmail(e.target.value)}
              style={{ ...inputStyle, width: "100%", minWidth: 0 }}
              placeholder="Email address"
            />
          </div>

          <div style={{ display: "grid", gap: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: theme.text }}>📧 Email Alerts</span>
              <Toggle checked={emailAlerts} onClick={handleEmailAlertsToggle} theme={theme} />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: theme.text }}>📱 SMS Alerts</span>
              <Toggle checked={smsAlerts} onClick={handleSmsAlertsToggle} theme={theme} />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: theme.text }}>🚨 High Risk Alerts Only</span>
              <Toggle
                checked={highRiskAlertsOnly}
                onClick={handleHighRiskAlertsOnlyToggle}
                theme={theme}
              />
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={{ marginTop: 0, color: theme.text }}>Protection Policy</h3>

          <div style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", color: theme.muted, fontSize: "13px", marginBottom: "8px" }}>
              Block Level
            </label>
            <select
              value={blockLevel}
              onChange={(e) => handleBlockLevelChange(e.target.value)}
              style={{ ...selectStyle, width: "100%", minWidth: 0, marginTop: 0 }}
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>

          <div style={{ display: "grid", gap: "14px", marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: theme.text }}>Auto Block</span>
              <Toggle checked={autoBlock} onClick={handleAutoBlockToggle} theme={theme} />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: theme.text }}>Strict Mode</span>
              <Toggle checked={strictMode} onClick={handleStrictModeToggle} theme={theme} />
            </div>
          </div>

          <div
            style={{
              padding: "14px",
              borderRadius: "14px",
              border: `1px solid ${theme.border}`,
              background: theme.surfaceAlt,
            }}
          >
            <div style={{ fontWeight: 700, color: theme.text, marginBottom: "8px" }}>
              Store protection mode
            </div>
            <div style={{ color: theme.text }}>{storeProtectionMode.label}</div>
            <div style={{ color: theme.muted, fontSize: "13px", marginTop: "4px" }}>
              {storeProtectionMode.description}
            </div>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <button onClick={handleSaveSettings} style={getPrimaryButtonStyle()}>
          Save Settings
        </button>
      </div>
    </div>
  );
}

export default function Index() {
  const [page, setPage] = useState("dashboard");

  const [threatLevel, setThreatLevel] = useState("low");
  const [strictMode, setStrictMode] = useState(false);
  const [insight, setInsight] = useState("");
  const [recommendation, setRecommendation] = useState("");

  const [darkMode, setDarkMode] = useState(false);
  const [protectionOn, setProtectionOn] = useState(true);
  const [autoBlock, setAutoBlock] = useState(true);

  const [totalScans, setTotalScans] = useState(0);
  const [blocked, setBlocked] = useState(0);
  const [blockedIPs, setBlockedIPs] = useState([]);
  const [history, setHistory] = useState([]);
  const [scans, setScans] = useState([]);
  const [lastScanTime, setLastScanTime] = useState("No scans yet");
  const [result, setResult] = useState("No scans yet");
  const [searchTerm, setSearchTerm] = useState("");
  const [whitelist, setWhitelist] = useState([]);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [highRiskAlertsOnly, setHighRiskAlertsOnly] = useState(false);
  const [alertEmail, setAlertEmail] = useState("owner@store.com");
  const [pauseUntil, setPauseUntil] = useState(null);
  const [notification, setNotification] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [teamNotes, setTeamNotes] = useState({});
  const [trustedTags, setTrustedTags] = useState({});
  const [selectedNoteIp, setSelectedNoteIp] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [selectedTrustedTagIp, setSelectedTrustedTagIp] = useState("");
  const [trustedTagInput, setTrustedTagInput] = useState("");
  const [blockLevel, setBlockLevel] = useState("Medium");

  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      badge: "Copilot",
      title: "BotShield Copilot",
      text: "I can brief you like a real security operator now. Ask for an executive summary, incident review, risk pressure assessment, settings guidance, or the next move to take.",
      bullets: [
        "Use the quick prompts to get live operator-style answers.",
        "Ask follow-up questions and I will keep the thread focused.",
      ],
      followUps: [
        "Give me an executive summary",
        "Analyze the latest incident",
        "What should I change next?",
      ],
      meta: { intent: "help" },
    },
  ]);
  const [dashboardSections, setDashboardSections] = useState({
    operations: true,
    analyst: false,
    deepDive: false,
  });

  const [threatCounts, setThreatCounts] = useState({
    Low: 0,
    Medium: 0,
    High: 0,
  });

  const [actionCounts, setActionCounts] = useState({
    Allowed: 0,
    Blocked: 0,
    Whitelisted: 0,
  });

  const protectionPaused = pauseUntil && new Date(pauseUntil).getTime() > Date.now();

  useEffect(() => {
    if (threatLevel === "high") {
      setInsight("🚨 High-risk traffic detected!");
      setRecommendation("Enable Strict Mode immediately");
    } else if (threatLevel === "medium") {
      setInsight("🟡 Suspicious activity detected");
      setRecommendation("Consider enabling Strict Mode");
    } else {
      setInsight("🟢 No high-risk threats detected today");
      setRecommendation("All systems normal");
    }
  }, [threatLevel]);

  const theme = darkMode
    ? {
        bg: "linear-gradient(180deg, #09111f 0%, #0b1324 44%, #070d18 100%)",
        sidebar: "rgba(7, 15, 28, 0.72)",
        surface: "rgba(15, 23, 42, 0.74)",
        surfaceAlt: "rgba(9, 16, 31, 0.78)",
        border: "rgba(148, 163, 184, 0.18)",
        text: "#f8fafc",
        muted: "#94a3b8",
        hover: "rgba(37, 99, 235, 0.12)",
        heroStart: "#081225",
        heroEnd: "#16213f",
        successBg: "rgba(6, 78, 59, 0.28)",
        successText: "#6ee7b7",
        dangerBg: "rgba(127, 29, 29, 0.24)",
        dangerText: "#fda4af",
        inputBg: "rgba(8, 15, 29, 0.88)",
        tableHead: "rgba(10, 17, 32, 0.92)",
        track: "rgba(30, 41, 59, 0.88)",
        shadow: "0 24px 70px rgba(2, 6, 23, 0.52)",
        softShadow: "0 18px 38px rgba(8, 15, 29, 0.32)",
        accent: "#38bdf8",
        accentStrong: "#2563eb",
        accentSoft: "rgba(56, 189, 248, 0.16)",
        glass: "blur(18px)",
      }
    : {
        bg: "linear-gradient(180deg, #f3f6fb 0%, #f7f9fc 42%, #eef3f9 100%)",
        sidebar: "rgba(255, 255, 255, 0.7)",
        surface: "rgba(255, 255, 255, 0.78)",
        surfaceAlt: "rgba(248, 250, 252, 0.92)",
        border: "rgba(148, 163, 184, 0.28)",
        text: "#0f172a",
        muted: "#64748b",
        hover: "rgba(37, 99, 235, 0.07)",
        heroStart: "#07152b",
        heroEnd: "#16345c",
        successBg: "rgba(16, 185, 129, 0.12)",
        successText: "#047857",
        dangerBg: "rgba(239, 68, 68, 0.12)",
        dangerText: "#b91c1c",
        inputBg: "rgba(255, 255, 255, 0.88)",
        tableHead: "rgba(241, 245, 249, 0.96)",
        track: "rgba(226, 232, 240, 0.96)",
        shadow: "0 24px 60px rgba(15, 23, 42, 0.12)",
        softShadow: "0 18px 34px rgba(15, 23, 42, 0.1)",
        accent: "#0ea5e9",
        accentStrong: "#1d4ed8",
        accentSoft: "rgba(14, 165, 233, 0.12)",
        glass: "blur(16px)",
      };

  const buttonBaseStyle = {
    transition: "all 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
    transform: "scale(1)",
  };

  const pressHandlers = {
    onMouseDown: (e) => {
      e.currentTarget.style.transform = "scale(0.97)";
    },
    onMouseUp: (e) => {
      e.currentTarget.style.transform = "scale(1)";
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.transform = "scale(1)";
    },
  };

  const cardHoverHandlers = {
    onMouseEnter: (e) => {
      e.currentTarget.style.transform = "translateY(-6px) scale(1.01)";
      e.currentTarget.style.boxShadow = theme.shadow;
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.transform = "translateY(0)";
      e.currentTarget.style.boxShadow = theme.softShadow;
    },
  };

  const cardStyle = {
    background: darkMode
      ? "linear-gradient(180deg, rgba(15, 23, 42, 0.82), rgba(8, 15, 29, 0.84))"
      : "linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(248, 250, 252, 0.92))",
    border: `1px solid ${theme.border}`,
    backdropFilter: theme.glass,
    WebkitBackdropFilter: theme.glass,
    borderRadius: "26px",
    padding: "22px",
    boxShadow: theme.softShadow,
    transition: "all 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
    position: "relative",
    overflow: "hidden",
  };

  const statCardStyle = {
    ...cardStyle,
    padding: "18px",
  };

  const statLabelStyle = {
    margin: 0,
    fontSize: "11px",
    color: theme.muted,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    fontWeight: 700,
  };

  const statValueStyle = {
    margin: "10px 0 0 0",
    fontSize: "34px",
    fontWeight: 800,
    letterSpacing: "-0.05em",
    color: theme.text,
  };

  const sectionDividerStyle = {
    border: "none",
    borderTop: `1px solid ${theme.border}`,
    margin: "24px 0",
  };

  const displayHeadingStyle = {
    fontFamily: '"Manrope", "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif',
    letterSpacing: "-0.045em",
    color: theme.text,
  };

  const monoLabelStyle = {
    fontFamily: '"IBM Plex Mono", "Space Mono", ui-monospace, monospace',
    fontSize: "11px",
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    fontWeight: 700,
    color: theme.muted,
  };

  const tableCell = {
    padding: "14px 12px",
    borderBottom: `1px solid ${theme.border}`,
    textAlign: "left",
    fontSize: "14px",
    verticalAlign: "middle",
    color: theme.text,
  };

  const inputStyle = {
    padding: "12px 14px",
    borderRadius: "14px",
    border: `1px solid ${theme.border}`,
    backgroundColor: theme.inputBg,
    minWidth: "220px",
    fontSize: "14px",
    outline: "none",
    color: theme.text,
    boxShadow: `inset 0 1px 0 ${theme.accentSoft}`,
  };

  const selectStyle = {
    padding: "12px 14px",
    borderRadius: "14px",
    border: `1px solid ${theme.border}`,
    backgroundColor: theme.inputBg,
    minWidth: "220px",
    marginTop: "8px",
    fontSize: "14px",
    color: theme.text,
  };

  const getPrimaryButtonStyle = () => ({
    ...buttonBaseStyle,
    padding: "12px 18px",
    borderRadius: "16px",
    border: `1px solid ${theme.accentSoft}`,
    background: `linear-gradient(135deg, ${theme.accentStrong}, ${theme.accent})`,
    backgroundSize: "180% 180%",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: "700",
    boxShadow: `0 12px 28px ${theme.accentSoft}`,
    letterSpacing: "-0.01em",
    animation: "gradientShift 8s ease infinite",
  });

  const getSecondaryButtonStyle = () => ({
    ...buttonBaseStyle,
    padding: "12px 18px",
    borderRadius: "16px",
    border: `1px solid ${theme.border}`,
    background: darkMode
      ? "linear-gradient(180deg, rgba(15,23,42,0.86), rgba(8,15,29,0.82))"
      : "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(241,245,249,0.9))",
    backgroundSize: "160% 160%",
    color: theme.text,
    cursor: "pointer",
    fontWeight: "700",
    backdropFilter: theme.glass,
    boxShadow: theme.softShadow,
    animation: "gradientShift 12s ease infinite",
  });

  const getDangerButtonStyle = () => ({
    ...buttonBaseStyle,
    padding: "12px 18px",
    borderRadius: "14px",
    border: `1px solid ${darkMode ? "rgba(251, 113, 133, 0.32)" : "rgba(239, 68, 68, 0.18)"}`,
    backgroundColor: theme.dangerBg,
    color: theme.dangerText,
    cursor: "pointer",
    fontWeight: "700",
  });

  const getSmallButtonStyle = (type) => {
    if (type === "danger") {
      return {
        ...buttonBaseStyle,
        padding: "5px 10px",
        borderRadius: "10px",
        border: `1px solid ${darkMode ? "#7f1d1d" : "#fecaca"}`,
        backgroundColor: darkMode ? "#3b0d0d" : "#fee2e2",
        color: darkMode ? "#fecaca" : "#991b1b",
        cursor: "pointer",
        fontWeight: "700",
        fontSize: "12px",
      };
    }

    if (type === "success") {
      return {
        ...buttonBaseStyle,
        padding: "5px 10px",
        borderRadius: "10px",
        border: `1px solid ${darkMode ? "#14532d" : "#bbf7d0"}`,
        backgroundColor: darkMode ? "#052e1a" : "#dcfce7",
        color: darkMode ? "#86efac" : "#166534",
        cursor: "pointer",
        fontWeight: "700",
        fontSize: "12px",
      };
    }

    return {
      ...buttonBaseStyle,
      padding: "5px 10px",
      borderRadius: "10px",
      border: `1px solid ${theme.border}`,
      backgroundColor: theme.surface,
      color: theme.text,
      cursor: "pointer",
      fontWeight: "700",
      fontSize: "12px",
    };
  };

  const getRiskBadgeStyle = (risk) => {
    const normalized = String(risk).toLowerCase();

    if (normalized === "low" || normalized === "normal") {
      return {
        background: darkMode ? "#052e1a" : "#ecfdf5",
        color: darkMode ? "#86efac" : "#027a48",
        padding: "6px 12px",
        borderRadius: "999px",
        fontWeight: 600,
        display: "inline-block",
      };
    }

    if (normalized === "medium" || normalized === "balanced") {
      return {
        background: darkMode ? "#3b2a07" : "#fef3c7",
        color: darkMode ? "#fde68a" : "#b45309",
        padding: "6px 12px",
        borderRadius: "999px",
        fontWeight: 600,
        display: "inline-block",
      };
    }

    return {
      background: darkMode ? "#3b0d0d" : "#fee2e2",
      color: darkMode ? "#fca5a5" : "#b42318",
      padding: "6px 12px",
      borderRadius: "999px",
      fontWeight: 600,
      display: "inline-block",
    };
  };

  const getActionBadgeStyle = (action) => {
    const normalized = String(action).toLowerCase();

    if (normalized === "blocked") {
      return {
        color: darkMode ? "#fca5a5" : "#991b1b",
        backgroundColor: darkMode ? "#3b0d0d" : "#fee2e2",
        padding: "5px 12px",
        borderRadius: "999px",
        display: "inline-block",
        fontWeight: "bold",
      };
    }

    if (normalized === "whitelisted") {
      return {
        color: darkMode ? "#93c5fd" : "#1d4ed8",
        backgroundColor: darkMode ? "#172554" : "#dbeafe",
        padding: "5px 12px",
        borderRadius: "999px",
        display: "inline-block",
        fontWeight: "bold",
      };
    }

    return {
      color: darkMode ? "#86efac" : "#166534",
      backgroundColor: darkMode ? "#052e1a" : "#dcfce7",
      padding: "5px 12px",
      borderRadius: "999px",
      display: "inline-block",
      fontWeight: "bold",
    };
  };

  const getRevealStyle = (index) => ({
    animation: "fadeUp 0.55s ease both",
    animationDelay: `${index * 0.05}s`,
  });

  const loadScans = async () => {
    try {
      const res = await fetch("/api/scans");
      const data = await res.json();
      setScans(
        (data.scans || []).map((scan, index) => ({
          id: scan.id ?? index,
          ipAddress: scan.ipAddress || "Unknown",
          threatLevel: String(scan.threatLevel || "low").toLowerCase(),
          actionTaken: String(scan.actionTaken || "allowed").toLowerCase(),
          pathVisited: scan.pathVisited || "/",
          riskScore: Number(scan.riskScore || 0),
          reasons: scan.reasons || "",
          source: scan.source || "dashboard-live-scan",
          createdAt: scan.createdAt || null,
        })),
      );
    } catch (err) {
      console.error("Failed to load scans", err);
    }
  };

  const loadSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) return;
      const data = await res.json();
      const settings = data.settings || {};
      setAutoBlock(Boolean(settings.autoBlock));
      setStrictMode(Boolean(settings.strictMode));
      setBlockLevel(settings.blockLevel || "Medium");
    } catch (err) {
      console.error("Failed to load settings", err);
    }
  };

  const loadBlocklist = async () => {
    try {
      const res = await fetch("/api/blocklist");
      if (!res.ok) return;
      const data = await res.json();
      const rows = data.blockedIps || [];
      setBlockedIPs(
        rows.map((row) => ({
          ip: row.ipAddress,
          risk: "High",
          time: row.updatedAt ? new Date(row.updatedAt).toLocaleTimeString() : "Unknown",
          action: row.active ? "Blocked" : "Allowed",
        })),
      );
    } catch (err) {
      console.error("Failed to load blocklist", err);
    }
  };

  const loadWhitelist = async () => {
    try {
      const res = await fetch("/api/whitelist");
      if (!res.ok) return;
      const data = await res.json();
      setWhitelist((data.whitelistIps || []).map((row) => row.ipAddress));
    } catch (err) {
      console.error("Failed to load whitelist", err);
    }
  };

  const clearTestData = async () => {
    try {
      const res = await fetch("/api/clear-test-data", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        triggerAlert(err.error || "Failed to clear test data.");
        return;
      }
      await refreshBackendState();
    } catch (err) {
      console.error(err);
      triggerAlert("Failed to clear test data.");
    }
  };

  const triggerAlert = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(""), 3500);
  };

  const loadBackendState = async () => {
    await Promise.all([
      loadScans(),
      loadSettings(),
      loadBlocklist(),
      loadWhitelist(),
    ]);
  };

  const refreshBackendState = async () => {
    setSyncing(true);
    try {
      await loadBackendState();
      setLastSyncedAt(new Date().toLocaleTimeString());
    } finally {
      setSyncing(false);
    }
  };

  const addBlockedIp = async (ipAddress, reason = "Manual block from dashboard") => {
    const response = await fetch("/api/blocklist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ipAddress,
        reason,
        source: "dashboard",
        active: true,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Failed to block IP.");
    }

    return data;
  };

  const persistProtectionSettings = async (
    overrides = {},
    options = {},
  ) => {
    const nextSettings = {
      autoBlock,
      strictMode,
      blockLevel,
      ...overrides,
    };

    const response = await fetch("/api/settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(nextSettings),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Failed to save protection settings.");
    }

    const settings = data.settings || nextSettings;
    setAutoBlock(Boolean(settings.autoBlock));
    setStrictMode(Boolean(settings.strictMode));
    setBlockLevel(settings.blockLevel || "Medium");

    await refreshBackendState();

    if (options.message) {
      triggerAlert(options.message);
    }

    return settings;
  };

  const handleAutoBlockToggle = async () => {
    try {
      await persistProtectionSettings(
        { autoBlock: !autoBlock },
        { message: `Auto-block ${!autoBlock ? "enabled" : "disabled"}.` },
      );
    } catch (err) {
      console.error("Failed to toggle auto-block", err);
      triggerAlert("Failed to update auto-block.");
    }
  };

  const handleStrictModeToggle = async () => {
    try {
      const nextStrictMode = !strictMode;
      await persistProtectionSettings(
        {
          strictMode: nextStrictMode,
          blockLevel: nextStrictMode ? "High" : blockLevel,
          autoBlock: nextStrictMode ? true : autoBlock,
        },
        { message: `Strict mode ${nextStrictMode ? "enabled" : "disabled"}.` },
      );
    } catch (err) {
      console.error("Failed to toggle strict mode", err);
      triggerAlert("Failed to update strict mode.");
    }
  };

  const handleBlockLevelChange = async (nextBlockLevel) => {
    try {
      await persistProtectionSettings(
        { blockLevel: nextBlockLevel },
        { message: `Protection level set to ${nextBlockLevel}.` },
      );
    } catch (err) {
      console.error("Failed to update block level", err);
      triggerAlert("Failed to update protection level.");
    }
  };

  const applyThreatScenario = (nextThreatLevel) => {
    setThreatLevel(nextThreatLevel);

    if (nextThreatLevel === "high") {
      triggerAlert("High-risk scenario lens enabled. The dashboard is now focused on aggressive threat conditions.");
      return;
    }

    if (nextThreatLevel === "medium") {
      triggerAlert("Medium-risk scenario lens enabled. The dashboard is now tuned to suspicious traffic patterns.");
      return;
    }

    triggerAlert("Low-risk scenario lens enabled. The dashboard is now showing the healthier operating posture.");
  };

  const runLiveScanRequest = async () => {
    const candidateIp =
      blockedIPs[0]?.ip ||
      scans[0]?.ipAddress ||
      "";

    const response = await fetch("/api/scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ipAddress: candidateIp,
        userAgent: navigator.userAgent,
        pathVisited: window.location.pathname,
        source: "dashboard-live-scan",
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Scan request failed.");
    }

    return data;
  };

  const handleBackendScan = async () => {
    try {
      const data = await runLiveScanRequest();

      const actionLabel = data.action ?? data.actionTaken ?? "unknown";
      const threat = String(data.threatLevel || "low").toLowerCase();

      setResult(`Threat: ${data.threatLevel} | Action: ${actionLabel}`);
      setLastScanTime(new Date().toLocaleTimeString());
      setTotalScans((prev) => prev + 1);
      setThreatLevel(threat);

      if (String(actionLabel).toLowerCase() === "blocked") {
        setBlocked((prev) => prev + 1);
        if (emailAlerts) {
          triggerAlert(`Email alert sent to ${alertEmail} for blocked traffic.`);
        }
      }

      await Promise.all([loadScans(), loadBlocklist(), loadWhitelist(), loadSettings()]);
      triggerAlert(`Live scan complete. Threat ${String(data.threatLevel || "unknown").toUpperCase()} was ${String(actionLabel).toUpperCase()}.`);
    } catch (err) {
      console.error(err);
      triggerAlert("Error connecting to backend.");
    }
  };

  const handleEmailAlertsToggle = () => {
    setEmailAlerts((prev) => {
      const nextValue = !prev;
      triggerAlert(`Email alerts ${nextValue ? "enabled" : "disabled"}.`);
      return nextValue;
    });
  };

  const handleSmsAlertsToggle = () => {
    setSmsAlerts((prev) => {
      const nextValue = !prev;
      triggerAlert(`SMS alerts ${nextValue ? "enabled" : "disabled"}.`);
      return nextValue;
    });
  };

  const handleHighRiskAlertsOnlyToggle = () => {
    setHighRiskAlertsOnly((prev) => {
      const nextValue = !prev;
      triggerAlert(nextValue ? "Alerts limited to high-risk events." : "Alerts will include broader suspicious activity.");
      return nextValue;
    });
  };

  const handleDarkModeToggle = () => {
    setDarkMode((prev) => {
      const nextValue = !prev;
      triggerAlert(`${nextValue ? "Dark" : "Light"} mode enabled.`);
      return nextValue;
    });
  };

  const handleOpenNoteForIp = (ip) => {
    setDashboardSections((prev) => ({
      ...prev,
      analyst: true,
    }));
    setSelectedNoteIp(ip);
    setNoteInput(teamNotes[ip] || "");
    triggerAlert(`Analyst workspace opened for ${ip}.`);
  };

  const openDashboardWorkspace = (sectionKey, message) => {
    setPage("dashboard");
    setDashboardSections((prev) => ({
      ...prev,
      [sectionKey]: true,
    }));
    if (message) {
      triggerAlert(message);
    }
  };

  const openSecurityWorkspace = (message) => {
    setPage("security");
    if (message) {
      triggerAlert(message);
    }
  };

  const openSettingsWorkspace = (message) => {
    setPage("settings");
    if (message) {
      triggerAlert(message);
    }
  };

  const handleSystemStatusAction = async (actionKey) => {
    switch (actionKey) {
      case "runtime":
        await refreshBackendState();
        triggerAlert("Runtime refreshed from the live backend.");
        break;
      case "autoblock":
        await handleAutoBlockToggle();
        break;
      case "evidence":
        openDashboardWorkspace("deepDive", "Evidence workspace opened.");
        break;
      default:
        break;
    }
  };

  const handleCommandDeckAction = async (actionKey) => {
    switch (actionKey) {
      case "pressure":
        openSecurityWorkspace("Security workspace opened for live pressure review.");
        break;
      case "revenue":
        openDashboardWorkspace("deepDive", "Evidence workspace opened to review protected revenue drivers.");
        break;
      case "mode":
        await enableStrictMode();
        break;
      default:
        break;
    }
  };

  const handleRuntimeChipAction = async (actionKey) => {
    switch (actionKey) {
      case "pressure":
        applyThreatScenario(botPressureScore >= 70 ? "high" : botPressureScore >= 40 ? "medium" : "low");
        break;
      case "blocked":
        openDashboardWorkspace("deepDive", "Recent enforcement evidence opened.");
        break;
      case "mode":
        await enableStrictMode();
        break;
      default:
        break;
    }
  };

  const handleDashboardSurfaceAction = async (actionKey) => {
    switch (actionKey) {
      case "livePosture":
        openSecurityWorkspace("Live posture moved into the Security workspace.");
        break;
      case "enforcement":
        openSettingsWorkspace("Policy settings opened for enforcement controls.");
        break;
      case "impact":
        openDashboardWorkspace("deepDive", "Business impact opened with deeper evidence.");
        break;
      case "threatsStopped":
        openDashboardWorkspace("deepDive", "Threat evidence opened.");
        break;
      case "scansToday":
        await handleBackendScan();
        break;
      case "hostileShare":
        applyThreatScenario(percentHigh >= 30 ? "high" : percentHigh >= 10 ? "medium" : "low");
        break;
      case "recentEnforcement":
        openDashboardWorkspace("deepDive", "Recent enforcement timeline opened.");
        break;
      case "mitigation":
        openDashboardWorkspace("deepDive", "Mitigation evidence opened.");
        break;
      case "coverage":
        await refreshBackendState();
        triggerAlert("Traffic coverage refreshed.");
        break;
      case "allowed":
        openSecurityWorkspace("Security records opened for allowed traffic review.");
        break;
      case "blocked":
        openDashboardWorkspace("deepDive", "Blocked traffic evidence opened.");
        break;
      case "threatSurface":
        openDashboardWorkspace("deepDive", "Threat surface evidence opened.");
        break;
      case "pressureMeter":
        openSecurityWorkspace("Threat pressure opened in the Security workspace.");
        break;
      case "runtimeStatus":
        await refreshBackendState();
        triggerAlert("Runtime status refreshed.");
        break;
      case "threatState":
        openDashboardWorkspace("deepDive", "Threat state evidence opened.");
        break;
      case "protection":
        if (protectionPaused || !protectionOn) {
          resumeProtectionNow();
        } else {
          handlePauseProtection(10);
        }
        break;
      case "automation":
        await handleAutoBlockToggle();
        break;
      case "weeklyReport":
        openDashboardWorkspace("deepDive", "Comparative evidence opened.");
        break;
      case "thisWeek":
        openDashboardWorkspace("deepDive", "This week's scan evidence opened.");
        break;
      case "lastWeek":
        openDashboardWorkspace("deepDive", "Last week's comparative evidence opened.");
        break;
      case "delta":
        openSecurityWorkspace("Security workspace opened to inspect enforcement movement.");
        break;
      case "policyRule":
        openSettingsWorkspace("Policy settings opened from the rule grid.");
        break;
      default:
        break;
    }
  };

  const handleScan = () => {
    if (!protectionOn || protectionPaused) {
      triggerAlert("Protection is paused. Resume runtime protection before running a simulated scan.");
      return;
    }

    const effectiveBlockLevel = strictMode ? "High" : blockLevel;
    const risks = ["low", "medium", "high"];
    const risk = risks[Math.floor(Math.random() * 3)];
    const fakeIP =
      "192.168." +
      Math.floor(Math.random() * 255) +
      "." +
      Math.floor(Math.random() * 255);
    const time = new Date().toLocaleTimeString();

    let action = "Allowed";
    let message = "";

    if (risk === "low") {
      message = "No bots detected";
    } else if (risk === "medium") {
      message = "1 suspicious visitor detected";
    } else {
      message = "High-risk visitor detected";
    }

    if (whitelist.includes(fakeIP)) {
      action = "Whitelisted";
      message = "Whitelisted IP bypassed blocking";
    } else {
      const shouldBlock =
        autoBlock &&
        ((effectiveBlockLevel === "Low" && risk !== "low") ||
          (effectiveBlockLevel === "Medium" && risk === "high") ||
          (effectiveBlockLevel === "High" && risk !== "low"));

      if (shouldBlock) {
        action = "Blocked";
        setBlocked((prev) => prev + 1);
        if (emailAlerts && (!highRiskAlertsOnly || risk === "high")) {
          triggerAlert(`Email alert sent to ${alertEmail} for blocked IP ${fakeIP}.`);
        }
      }
    }

    const riskLabel = risk.charAt(0).toUpperCase() + risk.slice(1);
    const newRow = { ip: fakeIP, risk: riskLabel, time, action };
    const historyText = `${message} (${riskLabel}) - ${fakeIP} - ${time}`;

    setBlockedIPs((prev) => [newRow, ...prev].slice(0, 10));
    setHistory((prev) => [historyText, ...prev].slice(0, 5));
    setTotalScans((prev) => prev + 1);
    setThreatLevel(risk);
    setLastScanTime(time);
    setResult(historyText);

    setThreatCounts((prev) => ({
      ...prev,
      [riskLabel]: prev[riskLabel] + 1,
    }));

    setActionCounts((prev) => ({
      ...prev,
      [action]: prev[action] + 1,
    }));

    triggerAlert(`Simulated ${riskLabel.toLowerCase()}-risk traffic. Result: ${action}.`);
  };

  const handleManualAction = async (index) => {
    const current = blockedIPs[index];
    if (!current) return;

    try {
      if (current.action === "Allowed") {
        await addBlockedIp(current.ip, "Manual block from dashboard");
      } else if (current.action === "Blocked") {
        const response = await fetch("/api/blocklist", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ipAddress: current.ip,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to unblock IP.");
        }
      }

      await refreshBackendState();
      triggerAlert(
        current.action === "Allowed"
          ? `Blocked ${current.ip}.`
          : `Unblocked ${current.ip}.`,
      );
    } catch (err) {
      console.error("Failed to update manual action", err);
      triggerAlert("Unable to update block action.");
    }
  };

  const handleWhitelist = async (ip) => {
    try {
      const response = await fetch("/api/whitelist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ipAddress: ip,
          label: "Trusted traffic",
          notes: "Added from dashboard",
          active: true,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        triggerAlert(data.error || "Failed to whitelist IP.");
        return;
      }

      await refreshBackendState();
      triggerAlert(`Whitelisted ${ip}.`);
    } catch (err) {
      console.error("Failed to whitelist IP", err);
      triggerAlert("Failed to whitelist IP.");
    }
  };

  const handleRemoveWhitelist = async (ip) => {
    try {
      const response = await fetch("/api/whitelist", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ipAddress: ip,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        triggerAlert(data.error || "Failed to remove whitelist IP.");
        return;
      }

      await refreshBackendState();
      triggerAlert(`Removed ${ip} from whitelist.`);
    } catch (err) {
      console.error("Failed to remove whitelist IP", err);
      triggerAlert("Failed to remove whitelist IP.");
    }
  };

  const handleClearAll = async () => {
    try {
      await clearTestData();
      setBlockedIPs([]);
      setHistory([]);
      setBlocked(0);
      setTotalScans(0);
      setThreatLevel("low");
      setLastScanTime("No scans yet");
      setResult("No scans yet");
      setWhitelist([]);
      setThreatCounts({ Low: 0, Medium: 0, High: 0 });
      setActionCounts({ Allowed: 0, Blocked: 0, Whitelisted: 0 });
      setTeamNotes({});
      setTrustedTags({});
      setSelectedTrustedTagIp("");
      setTrustedTagInput("");
      triggerAlert("Threat history and test data cleared.");
    } catch (err) {
      console.error("Failed to clear data", err);
      triggerAlert("Failed to clear data.");
    }
  };

  const handleSaveNote = () => {
    if (!selectedNoteIp || !noteInput.trim()) {
      triggerAlert("Select an IP and add a note before saving.");
      return;
    }
    setTeamNotes((prev) => ({
      ...prev,
      [selectedNoteIp]: noteInput.trim(),
    }));
    setNoteInput("");
    triggerAlert(`Saved note for ${selectedNoteIp}.`);
  };

  const handleAddTrustedTag = (ip) => {
    setDashboardSections((prev) => ({
      ...prev,
      analyst: true,
    }));
    setSelectedTrustedTagIp(ip);
    setTrustedTagInput(trustedTags[ip] || "");
    triggerAlert(`Trust registry opened for ${ip}.`);
  };

  const handleSaveTrustedTag = () => {
    if (!selectedTrustedTagIp || !trustedTagInput.trim()) {
      triggerAlert("Select an IP and enter a trusted tag before saving.");
      return;
    }

    setTrustedTags((prev) => ({
      ...prev,
      [selectedTrustedTagIp]: trustedTagInput.trim(),
    }));
    triggerAlert(`Updated trusted tag for ${selectedTrustedTagIp}.`);
    setSelectedTrustedTagIp("");
    setTrustedTagInput("");
  };

  const handleCancelTrustedTag = () => {
    setSelectedTrustedTagIp("");
    setTrustedTagInput("");
    triggerAlert("Trusted tag editor closed.");
  };

  const handlePauseProtection = (minutes) => {
    const resumeAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    setPauseUntil(resumeAt);
    setProtectionOn(false);
    triggerAlert(`Protection paused for ${minutes} minutes.`);
  };

  const resumeProtectionNow = () => {
    setPauseUntil(null);
    setProtectionOn(true);
    triggerAlert("Protection resumed and runtime enforcement is active again.");
  };

  const enableStrictMode = async () => {
    setProtectionOn(true);
    setEmailAlerts(true);

    try {
      await persistProtectionSettings(
        {
          autoBlock: true,
          strictMode: true,
          blockLevel: "High",
        },
        { message: "Strict mode enabled. Protection is now fully hardened." },
      );
    } catch (err) {
      console.error("Failed to enable strict mode", err);
      triggerAlert("Strict mode could not be enabled.");
    }
  };

  const handleSaveSettings = async () => {
    if (emailAlerts && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(alertEmail)) {
      triggerAlert("Enter a valid alert email before saving settings.");
      return;
    }

    try {
      await persistProtectionSettings(
        {
          autoBlock,
          strictMode,
          blockLevel,
        },
        {
          message: `Settings saved. Alerts are ${emailAlerts ? "enabled" : "disabled"} and protection is running in ${strictMode ? "Strict" : blockLevel} mode.`,
        },
      );
    } catch (err) {
      console.error("Failed to save settings", err);
      triggerAlert("Failed to save settings.");
    }
  };

  const handleSecurityBlockAction = async () => {
    if (blockedIPs.length > 0) {
      try {
        await addBlockedIp(blockedIPs[0].ip, "Manual block from security controls");
        await refreshBackendState();
        triggerAlert(`Block action triggered for ${blockedIPs[0].ip}.`);
      } catch (err) {
        console.error("Failed to block IP", err);
        triggerAlert("Failed to block IP.");
      }
    } else if (scans.length > 0) {
      const candidateIp = scans[0].ipAddress;
      try {
        await addBlockedIp(candidateIp, "Manual block from security controls");
        await refreshBackendState();
        triggerAlert(`Block action triggered for ${candidateIp}.`);
      } catch (err) {
        console.error("Failed to block IP", err);
        triggerAlert("Failed to block IP.");
      }
    } else {
      try {
        const data = await runLiveScanRequest();
        const candidateIp = data.ipAddress || "203.0.113.42";
        await addBlockedIp(candidateIp, "Manual block from security controls");
        await refreshBackendState();
        triggerAlert(`Scanned and blocked ${candidateIp}.`);
      } catch (err) {
        console.error("Failed to scan and block IP", err);
        triggerAlert("Unable to scan and block traffic.");
      }
    }
  };

  const handleSecurityWhitelistAction = async () => {
    if (blockedIPs.length > 0) {
      await handleWhitelist(blockedIPs[0].ip);
    } else if (scans.length > 0) {
      await handleWhitelist(scans[0].ipAddress);
    } else {
      try {
        const data = await runLiveScanRequest();
        const candidateIp = data.ipAddress || "203.0.113.42";
        await handleWhitelist(candidateIp);
      } catch (err) {
        console.error("Failed to scan and whitelist IP", err);
        triggerAlert("Unable to scan and whitelist traffic.");
      }
    }
  };

  useEffect(() => {
    const savedData = localStorage.getItem("botshield_dashboard_data");
    if (savedData) {
      const parsed = JSON.parse(savedData);
      setPage(parsed.page ?? "dashboard");
      setThreatLevel(parsed.threatLevel ?? "low");
      setStrictMode(parsed.strictMode ?? false);
      setInsight(parsed.insight ?? "");
      setRecommendation(parsed.recommendation ?? "");
      setDarkMode(parsed.darkMode ?? false);
      setProtectionOn(parsed.protectionOn ?? true);
      setAutoBlock(parsed.autoBlock ?? true);
      setBlockLevel(parsed.blockLevel ?? "Medium");
      setTotalScans(parsed.totalScans ?? 0);
      setBlocked(parsed.blocked ?? 0);
      setBlockedIPs(parsed.blockedIPs ?? []);
      setHistory(parsed.history ?? []);
      setLastScanTime(parsed.lastScanTime ?? "No scans yet");
      setResult(parsed.result ?? "No scans yet");
      setWhitelist(parsed.whitelist ?? []);
      setThreatCounts(parsed.threatCounts ?? { Low: 0, Medium: 0, High: 0 });
      setActionCounts(
        parsed.actionCounts ?? { Allowed: 0, Blocked: 0, Whitelisted: 0 },
      );
      setEmailAlerts(parsed.emailAlerts ?? true);
      setSmsAlerts(parsed.smsAlerts ?? false);
      setHighRiskAlertsOnly(parsed.highRiskAlertsOnly ?? false);
      setAlertEmail(parsed.alertEmail ?? "owner@store.com");
      setPauseUntil(parsed.pauseUntil ?? null);
      setTeamNotes(parsed.teamNotes ?? {});
      setTrustedTags(parsed.trustedTags ?? {});
      setSelectedTrustedTagIp(parsed.selectedTrustedTagIp ?? "");
      setTrustedTagInput(parsed.trustedTagInput ?? "");
    }
  }, []);

  useEffect(() => {
    const dataToSave = {
      page,
      threatLevel,
      strictMode,
      insight,
      recommendation,
      darkMode,
      protectionOn,
      autoBlock,
      blockLevel,
      totalScans,
      blocked,
      blockedIPs,
      history,
      lastScanTime,
      result,
      whitelist,
      threatCounts,
      actionCounts,
      emailAlerts,
      smsAlerts,
      highRiskAlertsOnly,
      alertEmail,
      pauseUntil,
      teamNotes,
      trustedTags,
      selectedTrustedTagIp,
      trustedTagInput,
    };

    localStorage.setItem("botshield_dashboard_data", JSON.stringify(dataToSave));
  }, [
    page,
    threatLevel,
    strictMode,
    insight,
    recommendation,
    darkMode,
    protectionOn,
    autoBlock,
    blockLevel,
    totalScans,
    blocked,
    blockedIPs,
    history,
    lastScanTime,
    result,
    whitelist,
    threatCounts,
    actionCounts,
    emailAlerts,
    smsAlerts,
    highRiskAlertsOnly,
    alertEmail,
    pauseUntil,
    teamNotes,
    trustedTags,
    selectedTrustedTagIp,
    trustedTagInput,
  ]);

  useEffect(() => {
    refreshBackendState();
  }, []);

  useEffect(() => {
    if (!pauseUntil) return;

    const remaining = new Date(pauseUntil).getTime() - Date.now();
    if (remaining <= 0) {
      setPauseUntil(null);
      setProtectionOn(true);
      return;
    }

    const timer = setTimeout(() => {
      setPauseUntil(null);
      setProtectionOn(true);
      triggerAlert("Protection has been automatically re-enabled.");
    }, remaining);

    return () => clearTimeout(timer);
  }, [pauseUntil]);

  const filteredIPs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return blockedIPs;

    return blockedIPs.filter(
      (row) =>
        row.ip.toLowerCase().includes(term) ||
        row.risk.toLowerCase().includes(term) ||
        row.action.toLowerCase().includes(term),
    );
  }, [blockedIPs, searchTerm]);

  const blockedCount = scans.filter((scan) => scan.actionTaken === "blocked").length;
  const allowedCount = scans.filter((scan) => scan.actionTaken === "allowed").length;
  const moneySaved = blockedCount * 5;

  const blockedToday = scans.filter(
    (scan) =>
      scan.actionTaken === "blocked" &&
      scan.createdAt &&
      new Date(scan.createdAt).toDateString() === new Date().toDateString(),
  ).length;

  const scansToday = scans.filter(
    (scan) =>
      scan.createdAt &&
      new Date(scan.createdAt).toDateString() === new Date().toDateString(),
  ).length;

  const recentBlocks = scans.filter((scan) => {
    if (!scan.createdAt) return false;
    const diff = Date.now() - new Date(scan.createdAt).getTime();
    return scan.actionTaken === "blocked" && diff <= 60 * 60 * 1000;
  }).length;

  const lastScan = scans[0];
  const latestKnownIp = blockedIPs[0]?.ip || scans[0]?.ipAddress || "";
  const lastScanLabel =
    lastScan?.createdAt
      ? new Date(lastScan.createdAt).toLocaleTimeString()
      : "No scans yet";

  const highRiskCount = scans.filter((scan) => scan.threatLevel === "high").length;
  const mediumRiskCount = scans.filter((scan) => scan.threatLevel === "medium").length;
  const percentHigh = scans.length ? Math.round((highRiskCount / scans.length) * 100) : 0;
  const threatTrendWidth = `${Math.min(Math.max(scans.length * 10, 8), 100)}%`;
  const recentThreats = scans.slice(0, 5);

  const currentWeekScans = scans.filter(
    (scan) => scan.createdAt && isSameWeek(scan.createdAt, new Date()),
  ).length;

  const previousWeekScans = scans.filter(
    (scan) => scan.createdAt && isPreviousWeek(scan.createdAt, new Date()),
  ).length;

  const currentWeekBlocked = scans.filter(
    (scan) =>
      scan.createdAt &&
      scan.actionTaken === "blocked" &&
      isSameWeek(scan.createdAt, new Date()),
  ).length;

  const previousWeekBlocked = scans.filter(
    (scan) =>
      scan.createdAt &&
      scan.actionTaken === "blocked" &&
      isPreviousWeek(scan.createdAt, new Date()),
  ).length;

  const weeklyDelta = currentWeekBlocked - previousWeekBlocked;

  const botPressureScore = Math.min(
    100,
    highRiskCount * 22 + mediumRiskCount * 10 + blockedToday * 12 + recentBlocks * 8,
  );

  const botPressureLabel =
    botPressureScore >= 70
      ? "Critical"
      : botPressureScore >= 40
      ? "Elevated"
      : "Stable";

  const maxThreatCount = Math.max(
    threatCounts.Low,
    threatCounts.Medium,
    threatCounts.High,
    1,
  );

  const maxActionCount = Math.max(
    actionCounts.Allowed,
    actionCounts.Blocked,
    actionCounts.Whitelisted,
    1,
  );

  const lowThreatWidth = (threatCounts.Low / maxThreatCount) * 100 + "%";
  const mediumThreatWidth = (threatCounts.Medium / maxThreatCount) * 100 + "%";
  const highThreatWidth = (threatCounts.High / maxThreatCount) * 100 + "%";

  const allowedActionWidth = (actionCounts.Allowed / maxActionCount) * 100 + "%";
  const blockedActionWidth = (actionCounts.Blocked / maxActionCount) * 100 + "%";
  const whitelistedActionWidth =
    (actionCounts.Whitelisted / maxActionCount) * 100 + "%";

  const riskBadgeLabel =
    threatLevel === "low"
      ? "LOW RISK"
      : threatLevel === "medium"
      ? "MEDIUM RISK"
      : "HIGH RISK";

  const pauseCountdown = protectionPaused
    ? Math.max(0, Math.ceil((new Date(pauseUntil).getTime() - Date.now()) / 60000))
    : 0;

  const assistantContext = {
    scansToday,
    blockedToday,
    blockedCount,
    percentHigh,
    highRiskCount,
    mediumRiskCount,
    autoBlock,
    protectionOn,
    protectionPaused,
    blockLevel,
    strictMode,
    recentBlocks,
    blockedIpCount: blockedIPs.length,
    whitelistCount: whitelist.length,
    moneySaved,
    lastScanLabel,
    botPressureScore,
    botPressureLabel,
    currentWeekScans,
    currentWeekBlocked,
    pauseCountdown,
    latestThreat: scans[0]
      ? {
          ipAddress: scans[0].ipAddress,
          threatLevel: scans[0].threatLevel,
          actionTaken: scans[0].actionTaken,
          pathVisited: scans[0].pathVisited,
        }
      : null,
    storeProtectionModeLabel: strictMode
      ? "Aggressive Mode"
      : blockLevel === "Low"
      ? "Normal Mode"
      : blockLevel === "Medium"
      ? "Balanced Mode"
      : "Aggressive Mode",
    recommendation,
    insight,
  };

  const liveSecurityLogs =
    scans.length > 0
      ? scans.slice(0, 3).map((scan) => ({
          status: scan.actionTaken === "blocked" ? "🔴" : "🟢",
          message: `${scan.ipAddress} ${scan.actionTaken} (${scan.threatLevel})`,
        }))
      : [
          { status: "🟢", message: "System initialized" },
          { status: "🟢", message: "Monitoring traffic" },
          { status: "🟡", message: "Waiting for activity..." },
        ];

  const recentThreatFeed =
    scans.length > 0
      ? scans.slice(0, 3).map((scan) => `• ${scan.threatLevel} threat from ${scan.ipAddress}`)
      : [
          "• Suspicious IP detected (simulated)",
          "• Bot pattern flagged",
          "• Rate limit triggered",
        ];

  const storeProtectionMode = strictMode
    ? {
        badge: "high",
        label: "🔴 Aggressive Mode",
        description: "Strict blocking is active for suspicious traffic.",
      }
    : blockLevel === "Low"
    ? {
        badge: "normal",
        label: "🟢 Normal Mode",
        description: "Light protection focused on obvious abuse.",
      }
    : blockLevel === "Medium"
    ? {
        badge: "balanced",
        label: "🟡 Balanced Mode",
        description: "Balanced protection for everyday store traffic.",
      }
    : {
        badge: "high",
        label: "🔴 Aggressive Mode",
        description: "Stronger rules for elevated threat conditions.",
      };

  const systemStatusItems = [
    {
      label: "🟢 System Healthy",
      active: protectionOn,
      detail: protectionOn && !protectionPaused ? "runtime online" : "limited runtime",
      actionKey: "runtime",
    },
    {
      label: "⚡ Auto Protection Active",
      active: autoBlock,
      detail: autoBlock ? "real-time enforcement" : "manual enforcement",
      actionKey: "autoblock",
    },
    {
      label: highRiskCount > 0 ? "🚨 Threats Detected" : "🛡️ No Threats Detected",
      active: highRiskCount === 0,
      detail: highRiskCount > 0 ? `${highRiskCount} high-risk events` : "no critical pressure",
      actionKey: "evidence",
    },
  ];

  const navItems = [
    {
      key: "dashboard",
      label: "Dashboard",
      eyebrow: "Control",
      icon: "◈",
    },
    {
      key: "security",
      label: "Security",
      eyebrow: "Detection",
      icon: "◌",
    },
    {
      key: "settings",
      label: "Settings",
      eyebrow: "Policy",
      icon: "△",
    },
  ];

  const quickFabricStats = [
    {
      label: "Pressure",
      value: `${botPressureScore}/100`,
    },
    {
      label: "Mode",
      value: strictMode ? "Strict" : blockLevel,
    },
    {
      label: "Sync",
      value: syncing ? "Live" : lastSyncedAt ? "Fresh" : "Standby",
    },
  ];

  const commandDeckStats = [
    {
      label: "Threat Pressure",
      value: botPressureLabel,
      detail: `${botPressureScore}/100 live score`,
      actionKey: "pressure",
    },
    {
      label: "Revenue Shielded",
      value: `$${moneySaved}`,
      detail: `${blockedCount} threats intercepted`,
      actionKey: "revenue",
    },
    {
      label: "Runtime Mode",
      value: strictMode ? "Aggressive" : storeProtectionMode.label.replace(/[^\w\s]/g, "").trim(),
      detail: autoBlock ? "automated enforcement" : "manual oversight",
      actionKey: "mode",
    },
  ];

  const navButtonStyle = (targetPage) => ({
    width: "100%",
    textAlign: "left",
    padding: "14px 14px",
    borderRadius: "18px",
    border: `1px solid ${page === targetPage ? theme.accentSoft : "transparent"}`,
    background:
      page === targetPage
        ? darkMode
          ? "linear-gradient(135deg, rgba(37, 99, 235, 0.24), rgba(56, 189, 248, 0.16))"
          : "linear-gradient(135deg, rgba(29, 78, 216, 0.12), rgba(14, 165, 233, 0.08))"
        : theme.surfaceAlt,
    color: page === targetPage ? theme.text : theme.muted,
    fontWeight: page === targetPage ? 700 : 500,
    cursor: "pointer",
    transition: "all 0.2s ease",
    boxShadow: page === targetPage ? `0 10px 22px ${theme.accentSoft}` : "none",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  });

  const dashboardSectionButtonStyle = (isOpen) => ({
    width: "100%",
    border: `1px solid ${isOpen ? theme.accentSoft : theme.border}`,
    background: isOpen
      ? darkMode
        ? "linear-gradient(180deg, rgba(15,23,42,0.9), rgba(8,15,29,0.88))"
        : "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(248,250,252,0.9))"
      : theme.surface,
    color: theme.text,
    borderRadius: "22px",
    padding: "16px 18px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    cursor: "pointer",
    boxShadow: isOpen ? theme.softShadow : "none",
    transition: "all 0.2s ease",
    textAlign: "left",
  });

  const interactiveCardButtonStyle = (baseStyle) => ({
    ...baseStyle,
    width: "100%",
    textAlign: "left",
    fontFamily: "inherit",
    color: theme.text,
    cursor: "pointer",
  });

  const scenarioButtonStyle = (level) => {
    const isActive = threatLevel === level;
    return {
      ...buttonBaseStyle,
      padding: "14px 16px",
      borderRadius: "18px",
      border: `1px solid ${isActive ? theme.accentSoft : theme.border}`,
      background: isActive
        ? darkMode
          ? "linear-gradient(135deg, rgba(14,165,233,0.2), rgba(37,99,235,0.14))"
          : "linear-gradient(135deg, rgba(14,165,233,0.12), rgba(37,99,235,0.08))"
        : theme.surface,
      color: theme.text,
      cursor: "pointer",
      display: "grid",
      gap: "6px",
      minWidth: "180px",
      boxShadow: isActive ? `0 18px 34px ${theme.accentSoft}` : theme.softShadow,
      textAlign: "left",
    };
  };

  const toggleDashboardSection = (sectionKey) => {
    setDashboardSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const sendChatMessage = (messageText) => {
    const trimmed = messageText.trim();
    if (!trimmed) return;

    const userMessage = { role: "user", text: trimmed };
    const reply = getAssistantCopilotReply(trimmed, assistantContext, chatMessages);

    setChatMessages((prev) => [
      ...prev,
      userMessage,
      reply,
    ]);

    setChatInput("");
    setChatOpen(true);
  };

  return (
    <div
      style={{
        background: theme.bg,
        minHeight: "100vh",
        color: theme.text,
        fontFamily:
          '"IBM Plex Sans", "Manrope", ui-sans-serif, system-ui, sans-serif',
        transition: "background 0.3s ease, color 0.3s ease",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            darkMode
              ? "radial-gradient(circle at 12% 18%, rgba(56,189,248,0.16), transparent 24%), radial-gradient(circle at 78% 12%, rgba(37,99,235,0.18), transparent 26%), radial-gradient(circle at 62% 76%, rgba(16,185,129,0.12), transparent 24%)"
              : "radial-gradient(circle at 10% 16%, rgba(14,165,233,0.16), transparent 24%), radial-gradient(circle at 80% 10%, rgba(59,130,246,0.12), transparent 24%), radial-gradient(circle at 70% 72%, rgba(16,185,129,0.10), transparent 20%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "7%",
          left: "-4%",
          width: "320px",
          height: "320px",
          borderRadius: "999px",
          background: darkMode ? "rgba(56,189,248,0.10)" : "rgba(14,165,233,0.12)",
          filter: "blur(48px)",
          pointerEvents: "none",
          animation: "ambientDrift 18s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "24%",
          right: "-6%",
          width: "360px",
          height: "360px",
          borderRadius: "999px",
          background: darkMode ? "rgba(37,99,235,0.10)" : "rgba(29,78,216,0.10)",
          filter: "blur(56px)",
          pointerEvents: "none",
          animation: "ambientDrift 22s ease-in-out infinite reverse",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "8%",
          left: "32%",
          width: "280px",
          height: "280px",
          borderRadius: "999px",
          background: darkMode ? "rgba(16,185,129,0.08)" : "rgba(16,185,129,0.10)",
          filter: "blur(50px)",
          pointerEvents: "none",
          animation: "ambientDrift 26s ease-in-out infinite",
        }}
      />
      <div style={{ display: "flex" }}>
        <div
          style={{
            width: "240px",
            borderRight: `1px solid ${theme.border}`,
            padding: "24px 20px",
            background: theme.sidebar,
            minHeight: "100vh",
            backdropFilter: theme.glass,
            WebkitBackdropFilter: theme.glass,
            boxShadow: "inset -1px 0 0 rgba(255,255,255,0.03)",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div
            style={{
              padding: "8px 4px 14px",
              borderBottom: `1px solid ${theme.border}`,
            }}
          >
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <div
                style={{
                  width: "46px",
                  height: "46px",
                  borderRadius: "12px",
                  display: "grid",
                  placeItems: "center",
                  background: darkMode
                    ? "rgba(255,255,255,0.03)"
                    : "rgba(255,255,255,0.8)",
                  border: `1px solid ${darkMode ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)"}`,
                  boxShadow: darkMode
                    ? "0 8px 18px rgba(2,6,23,0.18)"
                    : "0 8px 16px rgba(148,163,184,0.12)",
                  overflow: "hidden",
                  flexShrink: 0,
                }}
              >
                <img
                  src="/botshield-logo-transparent.png"
                  alt="BotShield logo"
                  style={{
                    width: "38px",
                    height: "38px",
                    objectFit: "contain",
                    display: "block",
                  }}
                />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p
                  style={{
                    margin: 0,
                    color: theme.muted,
                    fontSize: "9px",
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    lineHeight: 1.2,
                  }}
                >
                  Adaptive Security
                </p>
                <h3
                  style={{
                    margin: "4px 0 0 0",
                    color: theme.text,
                    fontSize: "20px",
                    letterSpacing: "-0.04em",
                    lineHeight: 1,
                  }}
                >
                  BotShield
                </h3>
                <div
                  style={{
                    marginTop: "4px",
                    color: theme.muted,
                    fontSize: "11px",
                    fontWeight: 500,
                  }}
                >
                  Storefront defense
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: "18px", display: "grid", gap: "8px" }}>
            {navItems.map((item) => (
              <button key={item.key} onClick={() => setPage(item.key)} style={navButtonStyle(item.key)}>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <div
                    style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "12px",
                      display: "grid",
                      placeItems: "center",
                      background:
                        page === item.key
                          ? `linear-gradient(135deg, ${theme.accentStrong}, ${theme.accent})`
                          : theme.surfaceAlt,
                      color: page === item.key ? "#ffffff" : theme.text,
                      fontWeight: 800,
                      boxShadow: page === item.key ? `0 10px 18px ${theme.accentSoft}` : "none",
                    }}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <div style={{ ...monoLabelStyle, fontSize: "10px", marginBottom: "4px" }}>{item.eyebrow}</div>
                    <div style={{ color: page === item.key ? theme.text : theme.muted, fontWeight: 700 }}>
                      {item.label}
                    </div>
                  </div>
                </div>
                <span style={{ color: page === item.key ? theme.text : theme.muted, fontSize: "18px" }}>›</span>
              </button>
            ))}
          </div>

          <div
            style={{
              marginTop: "24px",
              paddingTop: "20px",
              borderTop: `1px solid ${theme.border}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ color: theme.text, fontWeight: 600, fontSize: "14px" }}>
                Dark Mode
              </span>
              <Toggle checked={darkMode} onClick={handleDarkModeToggle} theme={theme} />
            </div>
          </div>

          <div
            style={{
              marginTop: "24px",
              padding: "16px",
              borderRadius: "20px",
              background: darkMode
                ? "linear-gradient(160deg, rgba(8,15,29,0.92), rgba(15,23,42,0.82))"
                : "linear-gradient(160deg, rgba(255,255,255,0.84), rgba(239,246,255,0.78))",
              border: `1px solid ${theme.border}`,
              boxShadow: theme.softShadow,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                background: darkMode
                  ? "radial-gradient(circle at 78% 16%, rgba(56,189,248,0.12), transparent 22%)"
                  : "radial-gradient(circle at 78% 16%, rgba(56,189,248,0.08), transparent 22%)",
              }}
            />
            <p
              style={{
                ...monoLabelStyle,
                margin: 0,
              }}
            >
              Runtime Signal
            </p>
            <div
              style={{
                marginTop: "10px",
                display: "grid",
                gap: "10px",
              }}
            >
              {quickFabricStats.map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    padding: "10px 12px",
                    borderRadius: "14px",
                    background: theme.surfaceAlt,
                    border: `1px solid ${theme.border}`,
                  }}
                >
                  <span style={{ color: theme.muted, fontWeight: 700, fontSize: "12px" }}>{item.label}</span>
                  <span style={{ color: theme.text, fontWeight: 800 }}>{item.value}</span>
                </div>
              ))}
            </div>
            <div
              style={{
                width: "100%",
                height: "8px",
                borderRadius: "999px",
                background: theme.track,
                overflow: "hidden",
                marginTop: "10px",
                position: "relative",
              }}
            >
              <div
                style={{
                  width: `${botPressureScore}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #22c55e, #38bdf8, #2563eb)",
                  boxShadow: "0 0 18px rgba(56,189,248,0.35)",
                  animation: "telemetryPulse 3.6s ease-in-out infinite",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.32), transparent)",
                  transform: "translateX(-100%)",
                  animation: "signalSweep 4.6s linear infinite",
                }}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            padding: "28px",
            animation: "fadeIn 0.4s ease-in-out",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div
            style={{
              ...cardStyle,
              ...getRevealStyle(0),
              marginBottom: "20px",
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {systemStatusItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => handleSystemStatusAction(item.actionKey)}
                style={{
                  padding: "10px 13px",
                  borderRadius: "14px",
                  background: item.active
                    ? darkMode
                      ? "rgba(14, 165, 233, 0.1)"
                      : "rgba(14, 165, 233, 0.08)"
                    : theme.surfaceAlt,
                  color: item.active ? theme.text : theme.text,
                  border: `1px solid ${item.active ? theme.accentSoft : theme.border}`,
                  fontWeight: 700,
                  fontSize: "13px",
                  transition: "all 0.2s ease",
                  minWidth: "180px",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ fontWeight: 800 }}>{item.label}</div>
                <div style={{ color: theme.muted, fontSize: "12px", marginTop: "4px" }}>
                  {item.detail}
                </div>
              </button>
            ))}
          </div>

          {notification ? (
            <div
              style={{
                marginBottom: "18px",
                background: darkMode ? "#172554" : "#dbeafe",
                color: darkMode ? "#bfdbfe" : "#1d4ed8",
                padding: "12px 16px",
                borderRadius: "12px",
                border: `1px solid ${darkMode ? "#1d4ed8" : "#93c5fd"}`,
                animation: "slideInDown 0.35s ease both",
              }}
            >
              {notification}
            </div>
          ) : null}

          {page === "dashboard" && (
            <>
              <div style={{ ...monoLabelStyle, marginBottom: "12px" }}>Executive Brief</div>

              <div
                style={{
                  ...cardStyle,
                  padding: "26px 28px",
                  borderRadius: "28px",
                  marginBottom: "14px",
                  transition: "all 0.2s ease",
                  background: darkMode
                    ? "linear-gradient(160deg, rgba(8,15,29,0.98), rgba(15,23,42,0.9))"
                    : "linear-gradient(160deg, rgba(255,255,255,0.98), rgba(241,245,249,0.92))",
                  border: `1px solid ${theme.accentSoft}`,
                  boxShadow: theme.shadow,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    background: darkMode
                      ? "radial-gradient(circle at 18% 22%, rgba(56,189,248,0.16), transparent 20%), radial-gradient(circle at 82% 20%, rgba(37,99,235,0.14), transparent 18%)"
                      : "radial-gradient(circle at 18% 22%, rgba(56,189,248,0.1), transparent 20%), radial-gradient(circle at 82% 20%, rgba(37,99,235,0.08), transparent 18%)",
                    animation: "ambientFloat 14s ease-in-out infinite",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: "28px",
                    right: "28px",
                    top: "98px",
                    height: "1px",
                    background: darkMode
                      ? "linear-gradient(90deg, transparent, rgba(56,189,248,0.28), transparent)"
                      : "linear-gradient(90deg, transparent, rgba(14,165,233,0.18), transparent)",
                    animation: "signalSweep 8s linear infinite",
                    pointerEvents: "none",
                  }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 540px" }}>
                    <div style={{ display: "flex", gap: "16px", alignItems: "center", marginBottom: "12px", flexWrap: "wrap" }}>
                      <div
                        style={{
                          width: "72px",
                          height: "72px",
                          borderRadius: "24px",
                          display: "grid",
                          placeItems: "center",
                          background: darkMode
                            ? "linear-gradient(160deg, rgba(8,15,29,0.96), rgba(15,23,42,0.92))"
                            : "linear-gradient(160deg, rgba(255,255,255,0.98), rgba(239,246,255,0.92))",
                          border: `1px solid ${theme.accentSoft}`,
                          boxShadow: `0 20px 42px ${theme.accentSoft}`,
                          overflow: "hidden",
                          flexShrink: 0,
                        }}
                      >
                        <img
                          src="/botshield-logo-transparent.png"
                          alt="BotShield logo mark"
                          style={{
                            width: "60px",
                            height: "60px",
                            objectFit: "contain",
                            display: "block",
                          }}
                        />
                      </div>
                      <div>
                        <div style={{ ...monoLabelStyle, marginBottom: "8px" }}>Merchant Proof</div>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "8px 12px",
                            borderRadius: "999px",
                            background: theme.surfaceAlt,
                            border: `1px solid ${theme.border}`,
                            color: theme.text,
                            fontSize: "12px",
                            fontWeight: 800,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                          }}
                        >
                          BotShield Commerce Defense
                        </div>
                      </div>
                    </div>
                    <h1 style={{ ...displayHeadingStyle, margin: 0, fontSize: "42px", lineHeight: 0.98 }}>
                      BotShield Command Center
                    </h1>
                    <p style={{ margin: "12px 0 0 0", color: theme.muted, fontSize: "15px", lineHeight: 1.8, maxWidth: "720px" }}>
                      A trust-first commerce security surface built to show value quickly, stay readable under pressure, and make policy decisions feel calm.
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end", alignItems: "flex-start" }}>
                    <span
                      style={{
                        background: theme.surfaceAlt,
                        color: theme.text,
                        padding: "9px 14px",
                        borderRadius: "999px",
                        border: `1px solid ${theme.border}`,
                        fontWeight: 700,
                        fontSize: "12px",
                      }}
                    >
                      {syncing ? "Syncing live" : lastSyncedAt ? `Synced ${lastSyncedAt}` : "Awaiting first sync"}
                    </span>
                    <span
                      style={{
                        background:
                          protectionOn && !protectionPaused ? theme.successBg : theme.dangerBg,
                        color:
                          protectionOn && !protectionPaused
                            ? theme.successText
                            : theme.dangerText,
                        padding: "9px 14px",
                        borderRadius: "999px",
                        fontWeight: 700,
                        fontSize: "12px",
                      }}
                    >
                      {protectionPaused
                        ? `Protection paused ${pauseCountdown}m`
                        : protectionOn
                        ? "Protection active"
                        : "Protection disabled"}
                    </span>
                    <div
                      style={{
                        minWidth: "230px",
                        padding: "16px",
                        borderRadius: "20px",
                        background: darkMode
                          ? "linear-gradient(160deg, rgba(8,15,29,0.84), rgba(15,23,42,0.74))"
                          : "linear-gradient(160deg, rgba(255,255,255,0.88), rgba(248,250,252,0.8))",
                        border: `1px solid ${theme.border}`,
                        boxShadow: theme.softShadow,
                      }}
                    >
                      <div style={{ ...monoLabelStyle, marginBottom: "10px" }}>Brand Identity</div>
                      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                        <div
                          style={{
                            width: "50px",
                            height: "50px",
                            borderRadius: "16px",
                            display: "grid",
                            placeItems: "center",
                            background: theme.surfaceAlt,
                            border: `1px solid ${theme.accentSoft}`,
                            overflow: "hidden",
                            flexShrink: 0,
                          }}
                        >
                          <img
                            src="/botshield-logo-transparent.png"
                            alt="BotShield"
                            style={{
                              width: "42px",
                              height: "42px",
                              objectFit: "contain",
                              display: "block",
                            }}
                          />
                        </div>
                        <div>
                          <div style={{ color: theme.text, fontWeight: 800, letterSpacing: "-0.03em" }}>
                            Trusted storefront defense
                          </div>
                          <div style={{ color: theme.muted, fontSize: "12px", lineHeight: 1.6, marginTop: "4px" }}>
                            Branded protection for operators, merchants, and blocked-session flows.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ color: theme.text, fontSize: "30px", fontWeight: 800, letterSpacing: "-0.05em", lineHeight: 1.18, marginTop: "22px", maxWidth: "900px" }}>
                  {blockedToday > 0
                    ? `BotShield stopped ${blockedToday} suspicious threat${blockedToday === 1 ? "" : "s"} today before they could create storefront noise.`
                    : scansToday > 0
                    ? `BotShield monitored ${scansToday} live request${scansToday === 1 ? "" : "s"} today and your store is operating from a controlled security posture.`
                    : "BotShield is live, synced, and ready to turn storefront traffic into visible protection proof."}
                </div>
                <div style={{ color: theme.muted, fontSize: "14px", lineHeight: 1.8, marginTop: "12px", maxWidth: "880px" }}>
                  {percentHigh > 0
                    ? `${percentHigh}% of observed traffic has scored high risk. The current operating mode is ${strictMode ? "strict enforcement" : `${blockLevel.toLowerCase()} policy enforcement`}, with ${recentBlocks} recent block${recentBlocks === 1 ? "" : "s"} in the last hour.`
                    : "As traffic builds, BotShield will translate raw security activity into merchant-level outcomes so the value of the app is obvious in seconds."}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px", marginTop: "20px" }}>
                  {[
                    {
                      key: "low",
                      eyebrow: "Calm lens",
                      title: "Healthy traffic",
                      detail: "Focus the board on stable storefront conditions.",
                    },
                    {
                      key: "medium",
                      eyebrow: "Review lens",
                      title: "Suspicious traffic",
                      detail: "Surface suspicious patterns and tuning signals.",
                    },
                    {
                      key: "high",
                      eyebrow: "Defense lens",
                      title: "Attack pressure",
                      detail: "Prioritize enforcement and hardening decisions.",
                    },
                  ].map((lens) => (
                    <button
                      key={lens.key}
                      onClick={() => applyThreatScenario(lens.key)}
                      style={scenarioButtonStyle(lens.key)}
                      {...pressHandlers}
                    >
                      <div style={{ ...monoLabelStyle, marginBottom: "2px" }}>{lens.eyebrow}</div>
                      <div style={{ fontSize: "17px", fontWeight: 800, letterSpacing: "-0.03em" }}>{lens.title}</div>
                      <div style={{ color: theme.muted, fontSize: "12px", lineHeight: 1.6 }}>{lens.detail}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div
                style={{
                  background: darkMode
                    ? "linear-gradient(135deg, rgba(8,15,29,0.96), rgba(15,23,42,0.9))"
                    : "linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.92))",
                  color: "white",
                  padding: "18px 20px",
                  borderRadius: "18px",
                  marginBottom: "20px",
                  transition: "all 0.2s ease",
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow: "0 18px 36px rgba(2,6,23,0.22)",
                }}
              >
                <strong>Recommended Next Move:</strong> {recommendation}

                {threatLevel !== "low" && (
                  <button
                    onClick={enableStrictMode}
                    style={{
                      marginLeft: "12px",
                      padding: "6px 12px",
                      background: "#22c55e",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                  >
                    Enable Strict Mode
                  </button>
                )}

                <div style={{ marginTop: "10px", color: "#cbd5e1" }}>
                  Current posture: {strictMode ? "Strict Mode active" : `${blockLevel} protection active`}
                </div>

                <div style={{ marginTop: "10px" }}>
                  Strict Mode: {strictMode ? "🟢 ON" : "⚪ OFF"}
                </div>
              </div>

              <div
                style={{
                  marginBottom: "20px",
                  display: "grid",
                  gridTemplateColumns: "1.1fr 0.9fr",
                  gap: "16px",
                  alignItems: "stretch",
                }}
              >
                <div>
                  <p
                    style={{
                      ...monoLabelStyle,
                      margin: 0,
                    }}
                  >
                    Operating Layer
                  </p>
                  <h2 style={{ ...displayHeadingStyle, margin: "6px 0 0 0", fontSize: "34px" }}>Runtime Overview</h2>
                  <p style={{ margin: "10px 0 0 0", color: theme.muted, fontSize: "14px", lineHeight: 1.8, maxWidth: "540px" }}>
                    A cleaner operating view for policy state, revenue protection, and live sync confidence without forcing merchants into analyst-level detail.
                  </p>
                </div>

                <div
                  style={{
                    ...cardStyle,
                    padding: "16px 18px",
                    display: "grid",
                    gap: "14px",
                  }}
                >
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <span
                      style={{
                        background: darkMode
                          ? "rgba(8,15,29,0.8)"
                          : "rgba(255,255,255,0.74)",
                        color: theme.text,
                        padding: "8px 12px",
                        borderRadius: "12px",
                        border: `1px solid ${theme.border}`,
                        fontWeight: 600,
                        fontSize: "13px",
                      }}
                    >
                      {syncing
                        ? "Syncing..."
                        : lastSyncedAt
                        ? `Synced ${lastSyncedAt}`
                        : "Awaiting sync"}
                    </span>

                    <span
                      style={{
                        background:
                          protectionOn && !protectionPaused ? theme.successBg : theme.dangerBg,
                        color:
                          protectionOn && !protectionPaused
                            ? theme.successText
                            : theme.dangerText,
                        padding: "8px 12px",
                        borderRadius: "12px",
                        fontWeight: 600,
                        fontSize: "13px",
                      }}
                    >
                      {protectionPaused
                        ? `Paused ${pauseCountdown}m`
                        : protectionOn
                        ? "Protection Active"
                        : "Protection Disabled"}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px" }}>
                    {commandDeckStats.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => handleCommandDeckAction(item.actionKey)}
                        style={interactiveCardButtonStyle({
                          padding: "12px",
                          borderRadius: "16px",
                          background: theme.surfaceAlt,
                          border: `1px solid ${theme.border}`,
                        })}
                      >
                        <div style={{ ...monoLabelStyle, fontSize: "10px", marginBottom: "8px" }}>{item.label}</div>
                        <div style={{ color: theme.text, fontWeight: 800, fontSize: "18px", letterSpacing: "-0.03em" }}>
                          {item.value}
                        </div>
                        <div style={{ color: theme.muted, fontSize: "12px", marginTop: "6px", lineHeight: 1.5 }}>
                          {item.detail}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <button onClick={refreshBackendState} style={getSecondaryButtonStyle()} {...pressHandlers}>
                      Refresh Runtime
                    </button>

                    <button onClick={enableStrictMode} style={getPrimaryButtonStyle()} {...pressHandlers}>
                      Harden Now
                    </button>
                  </div>
                </div>
              </div>

              <div
                style={{
                  ...getRevealStyle(1),
                  ...cardStyle,
                  color: theme.text,
                  padding: "24px",
                  borderRadius: "28px",
                  marginBottom: "20px",
                  position: "relative",
                  overflow: "hidden",
                  background: darkMode
                    ? "linear-gradient(160deg, rgba(8,15,29,0.94), rgba(15,23,42,0.86))"
                    : "linear-gradient(160deg, rgba(255,255,255,0.94), rgba(248,250,252,0.88))",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      darkMode
                        ? "radial-gradient(circle at 12% 18%, rgba(56,189,248,0.14), transparent 22%), radial-gradient(circle at 80% 12%, rgba(59,130,246,0.12), transparent 24%)"
                        : "radial-gradient(circle at 12% 18%, rgba(56,189,248,0.1), transparent 22%), radial-gradient(circle at 80% 12%, rgba(59,130,246,0.08), transparent 24%)",
                    pointerEvents: "none",
                  }}
                />
                <div
                  style={{
                    position: "relative",
                    display: "grid",
                    gridTemplateColumns: "1.15fr 0.85fr",
                    gap: "22px",
                    alignItems: "stretch",
                  }}
                >
                  <div>
                    <p style={{ ...monoLabelStyle, margin: 0 }}>Live Operations</p>
                    <h2 style={{ ...displayHeadingStyle, margin: "12px 0 0 0", fontSize: "34px", lineHeight: 1 }}>
                      Security posture at a glance
                    </h2>
                    <p style={{ marginTop: "12px", color: theme.muted, fontSize: "14px", lineHeight: 1.8, maxWidth: "560px" }}>
                      A cleaner operating view for live enforcement, traffic pressure, and runtime actions without repeating the same story twice.
                    </p>

                    <div
                      style={{
                        marginTop: "18px",
                        display: "flex",
                        gap: "10px",
                        flexWrap: "wrap",
                      }}
                    >
                      <button type="button" onClick={() => handleRuntimeChipAction("pressure")} style={{ padding: "8px 12px", borderRadius: "999px", background: darkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.05)", fontSize: "12px", fontWeight: 700, border: `1px solid ${theme.border}`, color: theme.text, cursor: "pointer" }}>
                        {botPressureLabel} pressure
                      </button>
                      <button type="button" onClick={() => handleRuntimeChipAction("blocked")} style={{ padding: "8px 12px", borderRadius: "999px", background: darkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.05)", fontSize: "12px", fontWeight: 700, border: `1px solid ${theme.border}`, color: theme.text, cursor: "pointer" }}>
                        {blockedToday} blocked today
                      </button>
                      <button type="button" onClick={() => handleRuntimeChipAction("mode")} style={{ padding: "8px 12px", borderRadius: "999px", background: darkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.05)", fontSize: "12px", fontWeight: 700, border: `1px solid ${theme.border}`, color: theme.text, cursor: "pointer" }}>
                        {strictMode ? "strict enforcement" : "adaptive enforcement"}
                      </button>
                    </div>

                    <div
                      style={{
                        marginTop: "18px",
                        display: "flex",
                        gap: "10px",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        onClick={handleBackendScan}
                        style={getPrimaryButtonStyle()}
                        {...pressHandlers}
                      >
                        Run Live Scan
                      </button>

                      <button
                        onClick={handleScan}
                        style={getSecondaryButtonStyle()}
                        {...pressHandlers}
                      >
                        Generate Test Traffic
                      </button>

                      <button
                        onClick={() => handlePauseProtection(10)}
                        style={getSecondaryButtonStyle()}
                        {...pressHandlers}
                      >
                        Pause 10m
                      </button>

                      <button
                        onClick={() => handlePauseProtection(30)}
                        style={getSecondaryButtonStyle()}
                        {...pressHandlers}
                      >
                        Pause 30m
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: "12px",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleDashboardSurfaceAction("livePosture")}
                      style={interactiveCardButtonStyle({
                        padding: "18px",
                        borderRadius: "22px",
                        background: theme.surfaceAlt,
                        border: `1px solid ${theme.border}`,
                      })}
                    >
                      <div style={{ ...monoLabelStyle, marginBottom: "10px" }}>
                        Live posture
                      </div>
                      <div style={{ marginTop: "10px", display: "flex", justifyContent: "space-between", gap: "12px" }}>
                        <div>
                          <div style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-0.05em" }}>{botPressureScore}</div>
                          <div style={{ color: theme.muted, fontSize: "13px" }}>Pressure score</div>
                        </div>
                        <div>
                          <div style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-0.05em" }}>{blockedToday}</div>
                          <div style={{ color: theme.muted, fontSize: "13px" }}>Blocked today</div>
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDashboardSurfaceAction("enforcement")}
                      style={interactiveCardButtonStyle({
                        padding: "18px",
                        borderRadius: "22px",
                        background: theme.surfaceAlt,
                        border: `1px solid ${theme.border}`,
                      })}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
                        <span style={{ ...monoLabelStyle }}>
                          Enforcement
                        </span>
                        <span style={{ color: theme.text, fontSize: "13px", fontWeight: 700 }}>
                          {strictMode ? "Strict" : "Adaptive"}
                        </span>
                      </div>
                      <div style={{ marginTop: "12px", display: "grid", gap: "10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", color: theme.text, fontSize: "14px" }}>
                          <span>Auto Block</span>
                          <strong>{autoBlock ? "Enabled" : "Disabled"}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", color: theme.text, fontSize: "14px" }}>
                          <span>Policy</span>
                          <strong>{strictMode ? "High" : blockLevel}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", color: theme.text, fontSize: "14px" }}>
                          <span>Last Scan</span>
                          <strong>{lastScanLabel}</strong>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.2fr 0.8fr",
                  gap: "20px",
                  marginBottom: "20px",
                }}
              >
                <div
                  onClick={() => handleDashboardSurfaceAction("impact")}
                  style={{
                    ...getRevealStyle(3),
                    background: darkMode
                      ? "linear-gradient(180deg, rgba(15,23,42,0.94), rgba(8,15,29,0.9))"
                      : "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(241,245,249,0.92))",
                    color: theme.text,
                    borderRadius: "26px",
                    padding: "28px",
                    boxShadow: theme.softShadow,
                    border: `1px solid ${theme.border}`,
                    position: "relative",
                    overflow: "hidden",
                    cursor: "pointer",
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleDashboardSurfaceAction("impact");
                    }
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: "18px",
                      right: "20px",
                      width: "120px",
                      height: "54px",
                      opacity: 0.9,
                      pointerEvents: "none",
                    }}
                  >
                    <svg viewBox="0 0 120 54" width="120" height="54" fill="none">
                      <path
                        d="M2 42C18 42 18 26 34 26C50 26 50 48 66 48C82 48 82 13 98 13C106 13 112 20 118 20"
                        stroke={darkMode ? "rgba(56,189,248,0.8)" : "rgba(14,165,233,0.7)"}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M2 42C18 42 18 26 34 26C50 26 50 48 66 48C82 48 82 13 98 13C106 13 112 20 118 20"
                        stroke="rgba(255,255,255,0.18)"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <p style={{ margin: 0, color: theme.muted, fontSize: "12px", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700 }}>
                    Business Impact
                  </p>
                  <h3 style={{ margin: "10px 0 0 0", fontSize: "22px", letterSpacing: "-0.04em" }}>Protected Revenue Estimate</h3>
                  <p style={{ fontSize: "42px", fontWeight: "bold", margin: "14px 0 0 0", letterSpacing: "-0.06em" }}>
                    <AnimatedNumber value={moneySaved} prefix="$" />
                  </p>
                  <p style={{ fontSize: "14px", color: theme.muted, marginTop: "10px", maxWidth: "420px", lineHeight: 1.7 }}>
                    Estimated storefront value preserved by intercepting abusive
                    traffic before it reached conversion-critical flows.
                  </p>
                  <div style={{ marginTop: "18px", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px" }}>
                    <button type="button" onClick={(event) => { event.stopPropagation(); handleDashboardSurfaceAction("threatsStopped"); }} style={interactiveCardButtonStyle({ padding: "12px 14px", borderRadius: "16px", background: theme.surfaceAlt, border: `1px solid ${theme.border}` })}>
                      <div style={{ color: theme.muted, fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>
                        Threats stopped
                      </div>
                      <div style={{ marginTop: "8px", color: theme.text, fontWeight: 800, fontSize: "18px" }}>
                        {blockedCount}
                      </div>
                    </button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); handleDashboardSurfaceAction("scansToday"); }} style={interactiveCardButtonStyle({ padding: "12px 14px", borderRadius: "16px", background: theme.surfaceAlt, border: `1px solid ${theme.border}` })}>
                      <div style={{ color: theme.muted, fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>
                        Scans today
                      </div>
                      <div style={{ marginTop: "8px", color: theme.text, fontWeight: 800, fontSize: "18px" }}>
                        {scansToday}
                      </div>
                    </button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); handleDashboardSurfaceAction("hostileShare"); }} style={interactiveCardButtonStyle({ padding: "12px 14px", borderRadius: "16px", background: theme.surfaceAlt, border: `1px solid ${theme.border}` })}>
                      <div style={{ color: theme.muted, fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>
                        Hostile share
                      </div>
                      <div style={{ marginTop: "8px", color: theme.text, fontWeight: 800, fontSize: "18px" }}>
                        {percentHigh}%
                      </div>
                    </button>
                  </div>
                </div>

                <button type="button" onClick={() => handleDashboardSurfaceAction("recentEnforcement")} style={interactiveCardButtonStyle({ ...cardStyle, ...getRevealStyle(4) })} {...cardHoverHandlers}>
                  <p style={statLabelStyle}>Recent Enforcement</p>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-end" }}>
                    <h2
                      style={{
                        ...statValueStyle,
                        animation: recentBlocks > 0 ? "pulse 1.5s ease-in-out infinite" : "none",
                      }}
                    >
                      <AnimatedNumber value={recentBlocks} />
                    </h2>
                    <span style={{ color: recentBlocks > 0 ? theme.dangerText : theme.successText, fontSize: "13px", fontWeight: 700 }}>
                      {recentBlocks > 0 ? "Elevated" : "Quiet"}
                    </span>
                  </div>
                  <div
                    style={{
                      marginTop: "14px",
                      padding: "14px 16px",
                      borderRadius: "18px",
                      background: theme.surfaceAlt,
                      border: `1px solid ${theme.border}`,
                    }}
                  >
                    <div style={{ color: theme.text, fontWeight: 700 }}>Last 60 minutes</div>
                    <div style={{ color: theme.muted, fontSize: "13px", marginTop: "6px", lineHeight: 1.6 }}>
                      Recent enforcement pressure is surfaced here so operators can see when mitigation intensity starts rising.
                    </div>
                  </div>
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: "16px",
                  marginBottom: "24px",
                  alignItems: "stretch",
                }}
              >
                <button
                  type="button"
                  onClick={() => handleDashboardSurfaceAction("mitigation")}
                  style={interactiveCardButtonStyle({
                    ...statCardStyle,
                    ...getRevealStyle(4),
                    minHeight: "190px",
                    padding: "22px",
                    background: darkMode
                      ? "linear-gradient(160deg, rgba(15,23,42,0.92), rgba(8,15,29,0.86))"
                      : "linear-gradient(160deg, rgba(255,255,255,0.96), rgba(239,246,255,0.88))",
                  })}
                  {...cardHoverHandlers}
                >
                  <p style={statLabelStyle}>Mitigation Pulse</p>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-end" }}>
                    <div>
                      <h2 style={statValueStyle}>
                        <AnimatedNumber value={blockedToday} />
                      </h2>
                      <div style={{ marginTop: "10px", color: theme.muted, fontSize: "13px" }}>
                        Threats blocked today
                      </div>
                    </div>
                    <span style={{ color: recentBlocks > 0 ? theme.dangerText : theme.successText, fontSize: "13px", fontWeight: 700 }}>
                      {recentBlocks > 0 ? "Hot" : "Stable"}
                    </span>
                  </div>
                  <div
                    style={{
                      marginTop: "18px",
                      padding: "14px 16px",
                      borderRadius: "18px",
                      background: theme.surfaceAlt,
                      border: `1px solid ${theme.border}`,
                    }}
                  >
                    <div style={{ color: theme.text, fontWeight: 700 }}>Last hour</div>
                    <div style={{ color: theme.muted, fontSize: "13px", marginTop: "6px", lineHeight: 1.6 }}>
                      {recentBlocks} enforcement action{recentBlocks === 1 ? "" : "s"} triggered in the last 60 minutes.
                    </div>
                  </div>
                </button>

                <div
                  onClick={() => handleDashboardSurfaceAction("coverage")}
                  style={{
                    ...statCardStyle,
                    ...getRevealStyle(5),
                    minHeight: "190px",
                    padding: "22px",
                    cursor: "pointer",
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleDashboardSurfaceAction("coverage");
                    }
                  }}
                  {...cardHoverHandlers}
                >
                  <p style={statLabelStyle}>Traffic Coverage</p>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-end" }}>
                    <div>
                      <h2 style={statValueStyle}>
                        <AnimatedNumber value={scansToday} />
                      </h2>
                      <div style={{ marginTop: "10px", color: theme.muted, fontSize: "13px" }}>
                        Live request evaluations today
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: theme.muted, fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700 }}>
                        Last scan
                      </div>
                      <div style={{ color: theme.text, fontWeight: 800, fontSize: "18px", letterSpacing: "-0.03em", marginTop: "8px" }}>
                        {lastScanLabel}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      marginTop: "18px",
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "12px",
                    }}
                  >
                    <button type="button" onClick={(event) => { event.stopPropagation(); handleDashboardSurfaceAction("allowed"); }} style={interactiveCardButtonStyle({ padding: "12px 14px", borderRadius: "16px", background: theme.surfaceAlt, border: `1px solid ${theme.border}` })}>
                      <div style={{ color: theme.muted, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>
                        Allowed
                      </div>
                      <div style={{ color: theme.text, fontWeight: 800, fontSize: "20px", marginTop: "8px" }}>
                        {allowedCount}
                      </div>
                    </button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); handleDashboardSurfaceAction("blocked"); }} style={interactiveCardButtonStyle({ padding: "12px 14px", borderRadius: "16px", background: theme.surfaceAlt, border: `1px solid ${theme.border}` })}>
                      <div style={{ color: theme.muted, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>
                        Blocked
                      </div>
                      <div style={{ color: theme.text, fontWeight: 800, fontSize: "20px", marginTop: "8px" }}>
                        {blockedCount}
                      </div>
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    ...statCardStyle,
                    ...getRevealStyle(7),
                    minHeight: "190px",
                    padding: "22px",
                    background: darkMode
                      ? "linear-gradient(160deg, rgba(6,18,37,0.94), rgba(15,23,42,0.88))"
                      : "linear-gradient(160deg, rgba(239,246,255,0.96), rgba(255,255,255,0.92))",
                  }}
                  {...cardHoverHandlers}
                >
                  <p style={statLabelStyle}>Risk Posture</p>
                  <div
                    style={{
                      marginTop: "8px",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "16px",
                      alignItems: "flex-end",
                    }}
                  >
                    <div>
                      <h2 style={statValueStyle}>
                        <AnimatedNumber value={percentHigh} suffix="%" />
                      </h2>
                      <div style={{ marginTop: "10px", color: theme.muted, fontSize: "13px" }}>
                        Share of hostile traffic
                      </div>
                    </div>
                    <span style={{ color: botPressureScore >= 70 ? theme.dangerText : botPressureScore >= 40 ? "#f59e0b" : theme.successText, fontSize: "13px", fontWeight: 700 }}>
                      {botPressureLabel}
                    </span>
                  </div>
                  <div
                    style={{
                      marginTop: "18px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                      padding: "14px 16px",
                      borderRadius: "18px",
                      background: theme.surfaceAlt,
                      border: `1px solid ${theme.border}`,
                    }}
                  >
                    <div>
                      <div style={{ color: theme.muted, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>
                        Auto block
                      </div>
                      <div style={{ color: theme.text, fontWeight: 800, marginTop: "6px" }}>
                        {autoBlock ? "Enabled" : "Disabled"}
                      </div>
                    </div>
                    <Toggle checked={autoBlock} onClick={handleAutoBlockToggle} theme={theme} />
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.1fr 0.9fr",
                  gap: "20px",
                  marginBottom: "20px",
                }}
              >
                <button type="button" onClick={() => handleDashboardSurfaceAction("threatSurface")} style={interactiveCardButtonStyle({ ...cardStyle, ...getRevealStyle(9) })} {...cardHoverHandlers}>
                  <p style={{ ...statLabelStyle, marginBottom: "12px" }}>Threat Surface</p>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-end" }}>
                    <div>
                      <h3 style={{ margin: 0, color: theme.text, fontSize: "26px", letterSpacing: "-0.04em" }}>
                        Live threat distribution
                      </h3>
                      <p style={{ margin: "10px 0 0 0", color: theme.muted, fontSize: "13px", lineHeight: 1.7, maxWidth: "460px" }}>
                        A compact view of how risky traffic is distributing across the current runtime sample.
                      </p>
                    </div>
                    <span style={{ color: theme.text, fontWeight: 700, fontSize: "13px" }}>{scans.length} scans</span>
                  </div>
                  <div style={{ marginTop: "18px", display: "grid", gap: "14px" }}>
                    {[
                      { label: "Low risk", value: threatCounts.Low, width: lowThreatWidth, color: "#22c55e" },
                      { label: "Medium risk", value: threatCounts.Medium, width: mediumThreatWidth, color: "#f59e0b" },
                      { label: "High risk", value: threatCounts.High, width: highThreatWidth, color: "#ef4444" },
                    ].map((row) => (
                      <div key={row.label}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                          <span style={{ color: theme.text, fontWeight: 600 }}>{row.label}</span>
                          <span style={{ color: theme.muted, fontWeight: 700 }}>{row.value}</span>
                        </div>
                        <div style={{ width: "100%", height: "10px", background: theme.track, borderRadius: "999px", overflow: "hidden" }}>
                          <div style={{ width: row.width, height: "100%", background: row.color, borderRadius: "999px" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </button>

                <button type="button" onClick={() => handleDashboardSurfaceAction("pressureMeter")} style={interactiveCardButtonStyle({ ...cardStyle, ...getRevealStyle(10) })} {...cardHoverHandlers}>
                  <p style={statLabelStyle}>Pressure Meter</p>
                  <div
                    style={{
                      width: "72px",
                      height: "72px",
                      borderRadius: "999px",
                      marginTop: "4px",
                      display: "grid",
                      placeItems: "center",
                      background: darkMode
                        ? "radial-gradient(circle, rgba(56,189,248,0.18), rgba(15,23,42,0.02) 70%)"
                        : "radial-gradient(circle, rgba(14,165,233,0.12), rgba(255,255,255,0.02) 70%)",
                      boxShadow: darkMode
                        ? "0 0 36px rgba(56,189,248,0.14)"
                        : "0 0 30px rgba(14,165,233,0.1)",
                      animation: "telemetryPulse 4.2s ease-in-out infinite",
                    }}
                  >
                    <div
                      style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "999px",
                        background: botPressureScore >= 70 ? "#ef4444" : botPressureScore >= 40 ? "#f59e0b" : "#22c55e",
                      }}
                    />
                  </div>
                  <h2 style={statValueStyle}>
                    <AnimatedNumber value={botPressureScore} />
                  </h2>
                  <div
                    style={{
                      width: "100%",
                      height: "10px",
                      background: theme.track,
                      borderRadius: "999px",
                      overflow: "hidden",
                      marginTop: "10px",
                    }}
                  >
                    <div
                      style={{
                        width: `${botPressureScore}%`,
                        height: "100%",
                        background:
                          botPressureScore >= 70
                            ? "#ef4444"
                            : botPressureScore >= 40
                            ? "#f59e0b"
                            : "#22c55e",
                        animation: "trendSweep 0.9s ease both",
                        transformOrigin: "left center",
                      }}
                    />
                  </div>
                  <p style={{ color: theme.muted, fontSize: "13px", marginBottom: 0, marginTop: "10px", lineHeight: 1.7 }}>
                    {botPressureLabel} pressure with {highRiskCount} high-risk event{highRiskCount === 1 ? "" : "s"} and {mediumRiskCount} medium-risk event{mediumRiskCount === 1 ? "" : "s"} in the current data set.
                  </p>
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: "14px",
                  marginBottom: "24px",
                }}
              >
                <button
                  onClick={() => toggleDashboardSection("operations")}
                  style={dashboardSectionButtonStyle(dashboardSections.operations)}
                >
                  <div>
                    <div style={{ ...monoLabelStyle, marginBottom: "8px" }}>Operating Mode</div>
                    <div style={{ color: theme.text, fontWeight: 800, fontSize: "18px", letterSpacing: "-0.03em" }}>
                      Command
                    </div>
                    <div style={{ color: theme.muted, fontSize: "13px", marginTop: "6px", lineHeight: 1.6 }}>
                      Policy actions, alerts, and runtime control.
                    </div>
                  </div>
                  <span style={{ color: dashboardSections.operations ? theme.accent : theme.muted, fontSize: "12px", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                    {dashboardSections.operations ? "Active" : "Open"}
                  </span>
                </button>

                <button
                  onClick={() => toggleDashboardSection("analyst")}
                  style={dashboardSectionButtonStyle(dashboardSections.analyst)}
                >
                  <div>
                    <div style={{ ...monoLabelStyle, marginBottom: "8px" }}>Operating Mode</div>
                    <div style={{ color: theme.text, fontWeight: 800, fontSize: "18px", letterSpacing: "-0.03em" }}>
                      Review
                    </div>
                    <div style={{ color: theme.muted, fontSize: "13px", marginTop: "6px", lineHeight: 1.6 }}>
                      Notes, trust signals, and operator review tools.
                    </div>
                  </div>
                  <span style={{ color: dashboardSections.analyst ? theme.accent : theme.muted, fontSize: "12px", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                    {dashboardSections.analyst ? "Active" : "Open"}
                  </span>
                </button>

                <button
                  onClick={() => toggleDashboardSection("deepDive")}
                  style={dashboardSectionButtonStyle(dashboardSections.deepDive)}
                >
                  <div>
                    <div style={{ ...monoLabelStyle, marginBottom: "8px" }}>Operating Mode</div>
                    <div style={{ color: theme.text, fontWeight: 800, fontSize: "18px", letterSpacing: "-0.03em" }}>
                      Evidence
                    </div>
                    <div style={{ color: theme.muted, fontSize: "13px", marginTop: "6px", lineHeight: 1.6 }}>
                      Raw logs, evidence tables, and traffic distributions.
                    </div>
                  </div>
                  <span style={{ color: dashboardSections.deepDive ? theme.accent : theme.muted, fontSize: "12px", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                    {dashboardSections.deepDive ? "Active" : "Open"}
                  </span>
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "20px",
                  marginBottom: "20px",
                }}
              >
                <div onClick={() => handleDashboardSurfaceAction("runtimeStatus")} style={{ ...cardStyle, ...getRevealStyle(11), cursor: "pointer" }} role="button" tabIndex={0} onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleDashboardSurfaceAction("runtimeStatus");
                  }
                }} {...cardHoverHandlers}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}>
                    <div>
                      <p style={statLabelStyle}>Runtime Status</p>
                      <h3 style={{ margin: "8px 0 0 0", color: theme.text, fontSize: "24px", letterSpacing: "-0.04em" }}>
                        Store Status
                      </h3>
                    </div>
                    <span
                      style={{
                        padding: "8px 12px",
                        borderRadius: "999px",
                        background: protectionOn && !protectionPaused ? theme.successBg : theme.dangerBg,
                        color: protectionOn && !protectionPaused ? theme.successText : theme.dangerText,
                        fontSize: "12px",
                        fontWeight: 700,
                      }}
                    >
                      {protectionOn && !protectionPaused ? "Operational" : "Limited"}
                    </span>
                  </div>

                  <div
                    style={{
                      marginTop: "18px",
                      display: "grid",
                      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                      gap: "12px",
                    }}
                  >
                    <button
                      type="button"
                      onClick={(event) => { event.stopPropagation(); handleDashboardSurfaceAction("threatState"); }}
                      style={interactiveCardButtonStyle({
                        padding: "14px",
                        borderRadius: "18px",
                        background: theme.surfaceAlt,
                        border: `1px solid ${theme.border}`,
                      })}
                    >
                      <div style={{ color: theme.muted, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>
                        Threat State
                      </div>
                      <div style={{ marginTop: "8px", color: theme.text, fontWeight: 700 }}>
                        {highRiskCount === 0 ? "Stable" : "Contained"}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(event) => { event.stopPropagation(); handleDashboardSurfaceAction("protection"); }}
                      style={interactiveCardButtonStyle({
                        padding: "14px",
                        borderRadius: "18px",
                        background: theme.surfaceAlt,
                        border: `1px solid ${theme.border}`,
                      })}
                    >
                      <div style={{ color: theme.muted, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>
                        Protection
                      </div>
                      <div style={{ marginTop: "8px", color: theme.text, fontWeight: 700 }}>
                        {protectionOn && !protectionPaused ? "Fully Active" : "Paused"}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(event) => { event.stopPropagation(); handleDashboardSurfaceAction("automation"); }}
                      style={interactiveCardButtonStyle({
                        padding: "14px",
                        borderRadius: "18px",
                        background: theme.surfaceAlt,
                        border: `1px solid ${theme.border}`,
                      })}
                    >
                      <div style={{ color: theme.muted, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>
                        Automation
                      </div>
                      <div style={{ marginTop: "8px", color: theme.text, fontWeight: 700 }}>
                        {autoBlock ? "Active" : "Manual"}
                      </div>
                    </button>
                  </div>

                  <div style={{ marginTop: "16px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <button onClick={refreshBackendState} style={getSecondaryButtonStyle()} {...pressHandlers}>
                      Refresh Runtime
                    </button>
                    <button onClick={enableStrictMode} style={getPrimaryButtonStyle()} {...pressHandlers}>
                      Harden Now
                    </button>
                  </div>
                </div>

                <div onClick={() => handleDashboardSurfaceAction("weeklyReport")} style={{ ...cardStyle, ...getRevealStyle(12), cursor: "pointer" }} role="button" tabIndex={0} onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleDashboardSurfaceAction("weeklyReport");
                  }
                }} {...cardHoverHandlers}>
                  <p style={statLabelStyle}>Comparative Activity</p>
                  <h3 style={{ margin: "8px 0 0 0", color: theme.text, fontSize: "24px", letterSpacing: "-0.04em" }}>
                    Weekly Report
                  </h3>
                  <div style={{ marginTop: "10px", color: theme.muted, fontSize: "13px", lineHeight: 1.6 }}>
                    Weekly movement across scan volume and enforcement intensity.
                  </div>
                  <div style={{ marginTop: "18px", display: "grid", gap: "12px" }}>
                    <button
                      type="button"
                      onClick={(event) => { event.stopPropagation(); handleDashboardSurfaceAction("thisWeek"); }}
                      style={interactiveCardButtonStyle({
                        padding: "14px 16px",
                        borderRadius: "18px",
                        background: theme.surfaceAlt,
                        border: `1px solid ${theme.border}`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      })}
                    >
                      <span style={{ color: theme.muted }}>This week scans</span>
                      <strong style={{ color: theme.text }}>{currentWeekScans}</strong>
                    </button>
                    <button
                      type="button"
                      onClick={(event) => { event.stopPropagation(); handleDashboardSurfaceAction("lastWeek"); }}
                      style={interactiveCardButtonStyle({
                        padding: "14px 16px",
                        borderRadius: "18px",
                        background: theme.surfaceAlt,
                        border: `1px solid ${theme.border}`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      })}
                    >
                      <span style={{ color: theme.muted }}>Last week scans</span>
                      <strong style={{ color: theme.text }}>{previousWeekScans}</strong>
                    </button>
                    <button
                      type="button"
                      onClick={(event) => { event.stopPropagation(); handleDashboardSurfaceAction("delta"); }}
                      style={interactiveCardButtonStyle({
                        padding: "14px 16px",
                        borderRadius: "18px",
                        background: weeklyDelta >= 0 ? theme.dangerBg : theme.successBg,
                        border: `1px solid ${theme.border}`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      })}
                    >
                      <span style={{ color: weeklyDelta >= 0 ? theme.dangerText : theme.successText }}>Blocked delta</span>
                      <strong style={{ color: weeklyDelta >= 0 ? theme.dangerText : theme.successText }}>
                        {weeklyDelta >= 0 ? "+" : ""}
                        {weeklyDelta}
                      </strong>
                    </button>
                  </div>
                </div>
              </div>

              {dashboardSections.operations ? (
                <>
              <div style={{ ...cardStyle, ...getRevealStyle(13), marginBottom: "20px" }} {...cardHoverHandlers}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
                  <div>
                    <p style={statLabelStyle}>Policy Engine</p>
                    <h3 style={{ margin: "8px 0 0 0", color: theme.text, fontSize: "24px", letterSpacing: "-0.04em" }}>
                      Auto Block Rules
                    </h3>
                  </div>
                  <span style={getRiskBadgeStyle(strictMode ? "high" : blockLevel)}>
                    {strictMode ? "Strict Policy" : `${blockLevel} Policy`}
                  </span>
                </div>

                <div
                  style={{
                    marginTop: "18px",
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    gap: "12px",
                  }}
                >
                  {[ 
                    { title: "High-risk suppression", detail: "Immediate deny on critical traffic", active: autoBlock },
                    { title: "Trusted traffic bypass", detail: "Whitelist entries skip enforcement", active: whitelist.length > 0 },
                    { title: "Path anomaly watch", detail: "Sensitive route targeting is monitored", active: true },
                    { title: "Repeat offender control", detail: "Recurring IPs escalate faster", active: blockedIPs.length > 0 },
                  ].map((rule) => (
                    <button
                      key={rule.title}
                      type="button"
                      onClick={() => handleDashboardSurfaceAction("policyRule")}
                      style={interactiveCardButtonStyle({
                        padding: "16px",
                        borderRadius: "18px",
                        background: theme.surfaceAlt,
                        border: `1px solid ${rule.active ? theme.accentSoft : theme.border}`,
                        boxShadow: rule.active ? `0 10px 22px ${theme.accentSoft}` : "none",
                      })}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
                        <strong style={{ color: theme.text, fontSize: "14px", lineHeight: 1.35 }}>{rule.title}</strong>
                        <span style={{ color: rule.active ? theme.successText : theme.muted, fontSize: "12px", fontWeight: 700 }}>
                          {rule.active ? "Live" : "Idle"}
                        </span>
                      </div>
                      <p style={{ color: theme.muted, fontSize: "13px", margin: "10px 0 0 0", lineHeight: 1.6 }}>
                        {rule.detail}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "20px",
                  marginBottom: "20px",
                }}
              >
                <div style={{ ...cardStyle, ...getRevealStyle(14) }} {...cardHoverHandlers}>
                  <p style={statLabelStyle}>Alert Routing</p>
                  <h3 style={{ margin: "8px 0 0 0", color: theme.text, fontSize: "24px", letterSpacing: "-0.04em" }}>
                    Email Alerts
                  </h3>
                  <div style={{ marginTop: "14px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <span style={getRiskBadgeStyle(emailAlerts ? "normal" : "high")}>
                      {emailAlerts ? "Delivery Enabled" : "Delivery Disabled"}
                    </span>
                    <span style={getRiskBadgeStyle(highRiskAlertsOnly ? "balanced" : "normal")}>
                      {highRiskAlertsOnly ? "High-risk Only" : "All Incidents"}
                    </span>
                  </div>
                  <input
                    value={alertEmail}
                    onChange={(e) => setAlertEmail(e.target.value)}
                    style={{ ...inputStyle, width: "100%", minWidth: 0, marginTop: "16px", marginBottom: "12px" }}
                    placeholder="Email address"
                  />
                  <div style={{ display: "grid", gap: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: theme.text, fontWeight: 600 }}>Email delivery</span>
                      <Toggle checked={emailAlerts} onClick={handleEmailAlertsToggle} theme={theme} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: theme.text, fontWeight: 600 }}>High-risk only</span>
                      <Toggle checked={highRiskAlertsOnly} onClick={handleHighRiskAlertsOnlyToggle} theme={theme} />
                    </div>
                    <button onClick={handleSaveSettings} style={getPrimaryButtonStyle()} {...pressHandlers}>
                      Apply Alert Profile
                    </button>
                  </div>
                </div>

                <div style={{ ...cardStyle, ...getRevealStyle(15) }} {...cardHoverHandlers}>
                  <p style={statLabelStyle}>Controlled Pause</p>
                  <h3 style={{ margin: "8px 0 0 0", color: theme.text, fontSize: "24px", letterSpacing: "-0.04em" }}>
                    Suspend Protection Timer
                  </h3>
                  <div
                    style={{
                      marginTop: "16px",
                      padding: "14px 16px",
                      borderRadius: "18px",
                      background: protectionPaused ? theme.dangerBg : theme.surfaceAlt,
                      border: `1px solid ${theme.border}`,
                    }}
                  >
                    <div style={{ color: protectionPaused ? theme.dangerText : theme.text, fontWeight: 700 }}>
                      {protectionPaused ? `Protection resumes in ${pauseCountdown} minutes` : "Protection is active with no scheduled pause"}
                    </div>
                    <div style={{ color: theme.muted, fontSize: "13px", marginTop: "6px" }}>
                      Use a short pause only during debugging or controlled maintenance windows.
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <button
                      onClick={() => handlePauseProtection(10)}
                      style={getSecondaryButtonStyle()}
                      {...pressHandlers}
                    >
                      Pause 10m
                    </button>
                    <button
                      onClick={() => handlePauseProtection(30)}
                      style={getSecondaryButtonStyle()}
                      {...pressHandlers}
                    >
                      Pause 30m
                    </button>
                    <button
                      onClick={resumeProtectionNow}
                      style={getPrimaryButtonStyle()}
                      {...pressHandlers}
                    >
                      Resume Now
                    </button>
                  </div>
                </div>
              </div>
                </>
              ) : null}

              {dashboardSections.analyst ? (
                <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "20px",
                  marginBottom: "20px",
                }}
              >
                <div style={{ ...cardStyle, ...getRevealStyle(16) }} {...cardHoverHandlers}>
                  <p style={statLabelStyle}>Analyst Workspace</p>
                  <h3 style={{ margin: "8px 0 0 0", color: theme.text, fontSize: "24px", letterSpacing: "-0.04em" }}>Team Notes</h3>
                  <select
                    value={selectedNoteIp}
                    onChange={(e) => setSelectedNoteIp(e.target.value)}
                    style={{ ...selectStyle, width: "100%", minWidth: 0, marginTop: 0 }}
                  >
                    <option value="">Select an IP</option>
                    {blockedIPs.map((row) => (
                      <option key={row.ip + row.time} value={row.ip}>
                        {row.ip}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Add a note for the team"
                    style={{
                      marginTop: "12px",
                      width: "100%",
                      minHeight: "100px",
                      padding: "12px",
                      borderRadius: "12px",
                      border: `1px solid ${theme.border}`,
                      background: theme.inputBg,
                      color: theme.text,
                      resize: "vertical",
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={handleSaveNote}
                    style={{ ...getPrimaryButtonStyle(), marginTop: "12px" }}
                    {...pressHandlers}
                  >
                    Save Note
                  </button>
                </div>

                <div style={{ ...cardStyle, ...getRevealStyle(17) }} {...cardHoverHandlers}>
                  <p style={statLabelStyle}>Trust Registry</p>
                  <h3 style={{ margin: "8px 0 0 0", color: theme.text, fontSize: "24px", letterSpacing: "-0.04em" }}>Trusted IP Tags</h3>
                  <div
                    style={{
                      marginTop: "14px",
                      padding: "14px",
                      borderRadius: "16px",
                      border: `1px solid ${theme.border}`,
                      background: theme.surfaceAlt,
                    }}
                  >
                    <div style={{ color: theme.muted, fontSize: "12px", marginBottom: "8px" }}>
                      Trusted IP
                    </div>
                    <select
                      value={selectedTrustedTagIp}
                      onChange={(e) => setSelectedTrustedTagIp(e.target.value)}
                      style={{ ...selectStyle, width: "100%", minWidth: 0, marginTop: 0 }}
                    >
                      <option value="">Select an IP</option>
                      {blockedIPs.map((row) => (
                        <option key={row.ip + row.time} value={row.ip}>
                          {row.ip}
                        </option>
                      ))}
                    </select>
                    <input
                      value={trustedTagInput}
                      onChange={(e) => setTrustedTagInput(e.target.value)}
                      placeholder="VIP customer, partner, internal QA..."
                      style={{ ...inputStyle, width: "100%", minWidth: 0, marginTop: "12px" }}
                    />
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "12px" }}>
                      <button
                        onClick={handleSaveTrustedTag}
                        style={getPrimaryButtonStyle()}
                        {...pressHandlers}
                      >
                        Save Trusted Tag
                      </button>
                      {(selectedTrustedTagIp || trustedTagInput) ? (
                        <button
                          onClick={handleCancelTrustedTag}
                          style={getSecondaryButtonStyle()}
                          {...pressHandlers}
                        >
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {Object.keys(trustedTags).length === 0 ? (
                    <div style={{ marginTop: "14px" }}>
                      <p style={{ color: theme.muted, margin: 0 }}>No trusted IP tags yet.</p>
                      {latestKnownIp ? (
                        <button
                          onClick={() => handleAddTrustedTag(latestKnownIp)}
                          style={{ ...getSecondaryButtonStyle(), marginTop: "12px" }}
                          {...pressHandlers}
                        >
                          Tag Latest IP
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    Object.entries(trustedTags).map(([ip, tag]) => (
                      <div
                        key={ip}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "10px 0",
                          borderBottom: `1px solid ${theme.border}`,
                        }}
                      >
                        <span>{ip}</span>
                        <span
                          style={{
                            background: darkMode ? "#172554" : "#dbeafe",
                            color: darkMode ? "#bfdbfe" : "#1d4ed8",
                            padding: "4px 10px",
                            borderRadius: "999px",
                            fontSize: "12px",
                            fontWeight: 700,
                          }}
                        >
                          {tag}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
                </>
              ) : null}

              {dashboardSections.deepDive ? (
                <>
              <div
                style={{
                  ...getRevealStyle(18),
                  background: "linear-gradient(160deg, rgba(5,11,23,0.96), rgba(15,23,42,0.94))",
                  borderRadius: "28px",
                  padding: "24px",
                  marginBottom: "20px",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow: "0 24px 48px rgba(2,6,23,0.26)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ margin: 0, color: "rgba(148,163,184,0.8)", fontSize: "12px", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>
                      Event Stream
                    </p>
                    <h3 style={{ margin: "8px 0 0 0", fontSize: "28px", letterSpacing: "-0.05em" }}>Live Activity</h3>
                  </div>
                  <span
                    style={{
                      padding: "8px 12px",
                      borderRadius: "999px",
                      background: "rgba(56,189,248,0.14)",
                      border: "1px solid rgba(56,189,248,0.18)",
                      color: "#bae6fd",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    Streaming
                  </span>
                </div>

                {recentThreats.length === 0 ? (
                  <div style={{ marginTop: "18px" }}>
                    <p style={{ color: "#9ca3af", margin: 0 }}>
                      No activity yet. Run a live scan or generate test traffic to populate the event stream.
                    </p>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "14px" }}>
                      <button onClick={handleBackendScan} style={getPrimaryButtonStyle()} {...pressHandlers}>
                        Run Live Scan
                      </button>
                      <button onClick={handleScan} style={getSecondaryButtonStyle()} {...pressHandlers}>
                        Generate Test Traffic
                      </button>
                    </div>
                  </div>
                ) : (
                  recentThreats.map((scan, index) => (
                    <div
                      key={scan.id}
                      style={{
                        marginTop: index === 0 ? "18px" : "10px",
                        padding: "16px 18px",
                        borderRadius: "20px",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        fontSize: "14px",
                        color: "#d1d5db",
                        display: "grid",
                        gridTemplateColumns: "1.4fr 0.9fr 0.9fr 0.9fr",
                        gap: "12px",
                        animation:
                          index === 0 ? "rowFlash 1.4s ease" : "fadeIn 0.35s ease both",
                      }}
                    >
                      <span>
                        {scan.actionTaken === "blocked" ? "BLOCKED" : "ALLOWED"} {scan.ipAddress}
                      </span>
                      <span>{scan.threatLevel}</span>
                      <span>{scan.actionTaken}</span>
                      <span>
                        {scan.createdAt
                          ? new Date(scan.createdAt).toLocaleTimeString()
                          : "Just now"}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "16px",
                  marginBottom: "24px",
                }}
              >
                <div style={{ ...statCardStyle, ...getRevealStyle(19) }} {...cardHoverHandlers}>
                  <p style={statLabelStyle}>Total Traffic</p>
                  <h2 style={statValueStyle}>
                    <AnimatedNumber value={scans.length} />
                  </h2>
                </div>

                <div style={{ ...statCardStyle, ...getRevealStyle(20) }} {...cardHoverHandlers}>
                  <p style={statLabelStyle}>Threats Blocked</p>
                  <h2 style={statValueStyle}>
                    <AnimatedNumber value={blockedCount} />
                  </h2>
                </div>

                <div style={{ ...statCardStyle, ...getRevealStyle(21) }} {...cardHoverHandlers}>
                  <p style={statLabelStyle}>Allowed Visitors</p>
                  <h2 style={statValueStyle}>
                    <AnimatedNumber value={allowedCount} />
                  </h2>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "16px",
                  flexWrap: "wrap",
                  marginBottom: "20px",
                }}
              >
                <div style={{ ...statCardStyle, ...getRevealStyle(22), flex: 1, minWidth: "180px" }} {...cardHoverHandlers}>
                  <div style={{ color: theme.muted, fontSize: "13px", fontWeight: "600" }}>
                    Total Scans
                  </div>
                  <div style={{ fontSize: "30px", fontWeight: "800", marginTop: "8px" }}>
                    <AnimatedNumber value={totalScans} />
                  </div>
                </div>

                <div style={{ ...statCardStyle, ...getRevealStyle(23), flex: 1, minWidth: "180px" }} {...cardHoverHandlers}>
                  <div style={{ color: theme.muted, fontSize: "13px", fontWeight: "600" }}>
                    Threat Level
                  </div>
                  <div style={{ marginTop: "12px" }}>
                    <span style={getRiskBadgeStyle(threatLevel)}>{riskBadgeLabel}</span>
                  </div>
                </div>

                <div style={{ ...statCardStyle, ...getRevealStyle(24), flex: 1, minWidth: "180px" }} {...cardHoverHandlers}>
                  <div style={{ color: theme.muted, fontSize: "13px", fontWeight: "600" }}>
                    Blocked Visitors
                  </div>
                  <div style={{ fontSize: "30px", fontWeight: "800", marginTop: "8px" }}>
                    <AnimatedNumber value={blocked} />
                  </div>
                </div>
              </div>

              <hr style={sectionDividerStyle} />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "20px",
                  marginBottom: "20px",
                }}
              >
                <div style={{ ...cardStyle, ...getRevealStyle(25) }} {...cardHoverHandlers}>
                  <h3 style={{ fontSize: "16px", fontWeight: "600", marginTop: 0, marginBottom: "18px" }}>
                    Threat Distribution
                  </h3>

                  <div style={{ marginBottom: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{ color: theme.text }}>Low</span>
                      <span style={{ color: theme.text }}>{threatCounts.Low}</span>
                    </div>
                    <div style={{ width: "100%", height: "12px", backgroundColor: theme.track, borderRadius: "999px", overflow: "hidden" }}>
                      <div style={{ width: lowThreatWidth, height: "100%", backgroundColor: "#22c55e", animation: "trendSweep 0.8s ease both", transformOrigin: "left center" }} />
                    </div>
                  </div>

                  <div style={{ marginBottom: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{ color: theme.text }}>Medium</span>
                      <span style={{ color: theme.text }}>{threatCounts.Medium}</span>
                    </div>
                    <div style={{ width: "100%", height: "12px", backgroundColor: theme.track, borderRadius: "999px", overflow: "hidden" }}>
                      <div style={{ width: mediumThreatWidth, height: "100%", backgroundColor: "#f59e0b", animation: "trendSweep 0.8s ease both", transformOrigin: "left center" }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{ color: theme.text }}>High</span>
                      <span style={{ color: theme.text }}>{threatCounts.High}</span>
                    </div>
                    <div style={{ width: "100%", height: "12px", backgroundColor: theme.track, borderRadius: "999px", overflow: "hidden" }}>
                      <div style={{ width: highThreatWidth, height: "100%", backgroundColor: "#ef4444", animation: "trendSweep 0.8s ease both", transformOrigin: "left center" }} />
                    </div>
                  </div>
                </div>

                <div style={{ ...cardStyle, ...getRevealStyle(26) }} {...cardHoverHandlers}>
                  <h2 style={{ marginTop: 0, marginBottom: "18px" }}>Action Distribution</h2>

                  <div style={{ marginBottom: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{ color: theme.text }}>Allowed</span>
                      <span style={{ color: theme.text }}>{actionCounts.Allowed}</span>
                    </div>
                    <div style={{ width: "100%", height: "12px", backgroundColor: theme.track, borderRadius: "999px", overflow: "hidden" }}>
                      <div style={{ width: allowedActionWidth, height: "100%", backgroundColor: "#22c55e", animation: "trendSweep 0.8s ease both", transformOrigin: "left center" }} />
                    </div>
                  </div>

                  <div style={{ marginBottom: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{ color: theme.text }}>Blocked</span>
                      <span style={{ color: theme.text }}>{actionCounts.Blocked}</span>
                    </div>
                    <div style={{ width: "100%", height: "12px", backgroundColor: theme.track, borderRadius: "999px", overflow: "hidden" }}>
                      <div style={{ width: blockedActionWidth, height: "100%", backgroundColor: "#ef4444", animation: "trendSweep 0.8s ease both", transformOrigin: "left center" }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{ color: theme.text }}>Whitelisted</span>
                      <span style={{ color: theme.text }}>{actionCounts.Whitelisted}</span>
                    </div>
                    <div style={{ width: "100%", height: "12px", backgroundColor: theme.track, borderRadius: "999px", overflow: "hidden" }}>
                      <div style={{ width: whitelistedActionWidth, height: "100%", backgroundColor: "#3b82f6", animation: "trendSweep 0.8s ease both", transformOrigin: "left center" }} />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ ...cardStyle, ...getRevealStyle(27), marginBottom: "20px" }} {...cardHoverHandlers}>
                <h2 style={{ marginTop: 0, marginBottom: "14px" }}>Protection Controls</h2>

                <p style={{ color: theme.text }}>
                  <strong>Status:</strong>{" "}
                  {protectionPaused
                    ? `Paused for ${pauseCountdown} more minutes`
                    : protectionOn
                    ? "Protection Active"
                    : "Protection Disabled"}
                </p>

                <p style={{ color: theme.text }}>
                  <strong>Auto Block:</strong>{" "}
                  {autoBlock ? "Auto Blocking ON" : "Auto Blocking OFF"}
                </p>

                <p style={{ color: theme.text }}>
                  <strong>Block Level:</strong> {blockLevel}
                </p>

                <select
                  value={blockLevel}
                  onChange={(e) => handleBlockLevelChange(e.target.value)}
                  style={selectStyle}
                >
                  <option value="Low">Low (block medium and high)</option>
                  <option value="Medium">Medium (block high only)</option>
                  <option value="High">High (strict high-risk blocking)</option>
                </select>
              </div>

              <div style={{ ...cardStyle, ...getRevealStyle(28), marginBottom: "20px" }} {...cardHoverHandlers}>
                <h2 style={{ marginTop: 0, marginBottom: "14px" }}>Security Overview</h2>
                <p style={{ color: theme.text }}>
                  <strong>Last Scan:</strong> {result}
                </p>
                <p style={{ color: theme.text }}>
                  <strong>Last Scan Time:</strong> {lastScanTime}
                </p>

                <button
                  onClick={handleBackendScan}
                  style={getPrimaryButtonStyle()}
                  {...pressHandlers}
                >
                  Scan for Bots
                </button>
              </div>

              <div style={{ ...cardStyle, ...getRevealStyle(29), marginBottom: "20px" }} {...cardHoverHandlers}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    flexWrap: "wrap",
                    marginBottom: "14px",
                  }}
                >
                  <h2 style={{ margin: 0 }}>Blocked IP Table</h2>

                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <input
                      type="text"
                      placeholder="Search IP / risk / action"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={inputStyle}
                    />
                    <button
                      onClick={handleClearAll}
                      style={getDangerButtonStyle()}
                      {...pressHandlers}
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {filteredIPs.length === 0 ? (
                  <div>
                    <p style={{ color: theme.muted }}>
                      No blocked or suspicious IPs are being tracked yet. Run a scan to start building the enforcement table.
                    </p>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                      <button onClick={handleBackendScan} style={getPrimaryButtonStyle()} {...pressHandlers}>
                        Run Live Scan
                      </button>
                      <button onClick={handleScan} style={getSecondaryButtonStyle()} {...pressHandlers}>
                        Generate Test Traffic
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "10px" }}>
                      <thead>
                        <tr style={{ backgroundColor: theme.tableHead }}>
                          <th style={tableCell}>IP Address</th>
                          <th style={tableCell}>Risk</th>
                          <th style={tableCell}>Time</th>
                          <th style={tableCell}>Action</th>
                          <th style={tableCell}>Trusted Tag</th>
                          <th style={tableCell}>Notes</th>
                          <th style={tableCell}>Manual Control</th>
                          <th style={tableCell}>Whitelist</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredIPs.map((row, index) => (
                          <tr
                            key={index}
                            style={{
                              borderBottom: `1px solid ${theme.border}`,
                              transition: "background 0.2s",
                              background: "transparent",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = theme.hover;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                            }}
                          >
                            <td style={tableCell}>{row.ip}</td>
                            <td style={tableCell}>
                              <span style={getRiskBadgeStyle(row.risk)}>
                                {row.risk.toUpperCase()} RISK
                              </span>
                            </td>
                            <td style={tableCell}>{row.time}</td>
                            <td style={tableCell}>
                              <span style={getActionBadgeStyle(row.action)}>{row.action}</span>
                            </td>
                            <td style={tableCell}>
                              {trustedTags[row.ip] ? (
                                <span
                                  style={{
                                    background: darkMode ? "#172554" : "#dbeafe",
                                    color: darkMode ? "#bfdbfe" : "#1d4ed8",
                                    padding: "4px 10px",
                                    borderRadius: "999px",
                                    fontSize: "12px",
                                    fontWeight: 700,
                                  }}
                                >
                                  {trustedTags[row.ip]}
                                </span>
                              ) : (
                                <button
                                  style={getSmallButtonStyle("neutral")}
                                  onClick={() => handleAddTrustedTag(row.ip)}
                                  {...pressHandlers}
                                >
                                  Add Tag
                                </button>
                              )}
                            </td>
                            <td style={tableCell}>
                              {teamNotes[row.ip] ? (
                                <span>{teamNotes[row.ip]}</span>
                              ) : (
                                <button
                                  style={getSmallButtonStyle("neutral")}
                                  onClick={() => handleOpenNoteForIp(row.ip)}
                                  {...pressHandlers}
                                >
                                  Add Note
                                </button>
                              )}
                            </td>
                            <td style={tableCell}>
                              {row.action === "Whitelisted" ? (
                                <span style={{ color: "#3b82f6", fontWeight: "700" }}>
                                  Protected
                                </span>
                              ) : row.action === "Allowed" ? (
                                <button
                                  style={getSmallButtonStyle("danger")}
                                  onClick={() => {
                                    const originalIndex = blockedIPs.findIndex(
                                      (item) =>
                                        item.ip === row.ip &&
                                        item.time === row.time &&
                                        item.risk === row.risk &&
                                        item.action === row.action,
                                    );
                                    handleManualAction(originalIndex);
                                  }}
                                  {...pressHandlers}
                                >
                                  Block
                                </button>
                              ) : (
                                <button
                                  style={getSmallButtonStyle("success")}
                                  onClick={() => {
                                    const originalIndex = blockedIPs.findIndex(
                                      (item) =>
                                        item.ip === row.ip &&
                                        item.time === row.time &&
                                        item.risk === row.risk &&
                                        item.action === row.action,
                                    );
                                    handleManualAction(originalIndex);
                                  }}
                                  {...pressHandlers}
                                >
                                  Unblock
                                </button>
                              )}
                            </td>
                            <td style={tableCell}>
                              {whitelist.includes(row.ip) ? (
                                <button
                                  style={getSmallButtonStyle("neutral")}
                                  onClick={() => handleRemoveWhitelist(row.ip)}
                                  {...pressHandlers}
                                >
                                  Remove
                                </button>
                              ) : (
                                <button
                                  style={getSmallButtonStyle("neutral")}
                                  onClick={() => handleWhitelist(row.ip)}
                                  {...pressHandlers}
                                >
                                  Whitelist
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "20px",
                  marginBottom: "20px",
                }}
              >
                <div style={{ ...cardStyle, ...getRevealStyle(30), marginBottom: 0 }} {...cardHoverHandlers}>
                  <h2 style={{ marginTop: 0, marginBottom: "14px" }}>Whitelisted IPs</h2>

                  {whitelist.length === 0 ? (
                    <div>
                      <p style={{ color: theme.muted, margin: 0 }}>No whitelisted IPs yet.</p>
                      {latestKnownIp ? (
                        <button
                          onClick={() => handleWhitelist(latestKnownIp)}
                          style={{ ...getSecondaryButtonStyle(), marginTop: "12px" }}
                          {...pressHandlers}
                        >
                          Whitelist Latest IP
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <ul style={{ paddingLeft: "20px", marginBottom: 0, color: theme.text }}>
                      {whitelist.map((ip, index) => (
                        <li key={index} style={{ marginBottom: "10px" }}>
                          {ip}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div style={{ ...cardStyle, ...getRevealStyle(31), marginBottom: 0 }} {...cardHoverHandlers}>
                  <h2 style={{ marginTop: 0, marginBottom: "14px" }}>Saved Team Notes</h2>

                  {Object.keys(teamNotes).length === 0 ? (
                    <div>
                      <p style={{ color: theme.muted, margin: 0 }}>No notes saved yet.</p>
                      {latestKnownIp ? (
                        <button
                          onClick={() => handleOpenNoteForIp(latestKnownIp)}
                          style={{ ...getSecondaryButtonStyle(), marginTop: "12px" }}
                          {...pressHandlers}
                        >
                          Add Note to Latest IP
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    Object.entries(teamNotes).map(([ip, note]) => (
                      <div
                        key={ip}
                        style={{
                          padding: "10px 0",
                          borderBottom: `1px solid ${theme.border}`,
                        }}
                      >
                        <strong>{ip}</strong>
                        <p style={{ margin: "6px 0 0 0", color: theme.muted }}>{note}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div style={{ ...cardStyle, ...getRevealStyle(32) }} {...cardHoverHandlers}>
                <h2
                  style={{
                    marginTop: 0,
                    marginBottom: "16px",
                    fontSize: "20px",
                    fontWeight: "600",
                  }}
                >
                  Scan History
                </h2>

                <button
                  onClick={clearTestData}
                  style={getDangerButtonStyle()}
                  {...pressHandlers}
                >
                  Clear Test Data
                </button>

                <div style={{ ...cardStyle, marginTop: "20px" }} {...cardHoverHandlers}>
                  <div style={{ marginBottom: "12px" }}>
                    <h3 style={{ margin: 0 }}>Recent Activity</h3>
                    <p style={{ color: theme.muted, fontSize: "14px", marginTop: "4px" }}>
                      Latest bot detection and visitor scans
                    </p>
                  </div>

                  {scans.length === 0 ? (
                    <div>
                      <p style={{ color: theme.muted }}>
                        No threats detected yet. Run a live scan or generate test traffic to start building evidence.
                      </p>
                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                        <button onClick={handleBackendScan} style={getPrimaryButtonStyle()} {...pressHandlers}>
                          Run Live Scan
                        </button>
                        <button onClick={handleScan} style={getSecondaryButtonStyle()} {...pressHandlers}>
                          Generate Test Traffic
                        </button>
                      </div>
                    </div>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr
                          style={{
                            textAlign: "left",
                            borderBottom: `1px solid ${theme.border}`,
                            background: theme.tableHead,
                          }}
                        >
                          <th style={{ padding: "12px 10px", fontSize: "14px", color: theme.text }}>
                            IP
                          </th>
                          <th style={{ padding: "12px 10px", fontSize: "14px", color: theme.text }}>
                            Threat
                          </th>
                          <th style={{ padding: "12px 10px", fontSize: "14px", color: theme.text }}>
                            Action
                          </th>
                          <th style={{ padding: "12px 10px", fontSize: "14px", color: theme.text }}>
                            Path
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {scans.slice(0, 8).map((scan) => (
                          <tr
                            key={scan.id}
                            title={scan.reasons ? `${scan.reasons} | Score ${scan.riskScore}` : `Score ${scan.riskScore}`}
                            style={{
                              borderBottom: `1px solid ${theme.border}`,
                              transition: "background 0.2s",
                              background: "transparent",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = theme.hover;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                            }}
                          >
                            <td style={{ padding: "12px 10px", fontSize: "14px", color: theme.text }}>
                              {scan.ipAddress}
                            </td>
                            <td style={{ padding: "12px 10px", fontSize: "14px" }}>
                              <span style={getRiskBadgeStyle(scan.threatLevel)}>
                                {scan.threatLevel.toUpperCase()} RISK
                              </span>
                            </td>
                            <td style={{ padding: "12px 10px", fontSize: "14px" }}>
                              <span style={getActionBadgeStyle(scan.actionTaken)}>
                                {scan.actionTaken}
                              </span>
                            </td>
                            <td style={{ padding: "12px 10px", fontSize: "14px", color: theme.text }}>
                              {scan.pathVisited}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
                </>
              ) : null}
            </>
          )}

          {page === "security" && (
            <SecurityPage
              theme={theme}
              darkMode={darkMode}
              cardStyle={cardStyle}
              buttonBaseStyle={buttonBaseStyle}
              getPrimaryButtonStyle={getPrimaryButtonStyle}
              getSecondaryButtonStyle={getSecondaryButtonStyle}
              getDangerButtonStyle={getDangerButtonStyle}
              getRiskBadgeStyle={getRiskBadgeStyle}
              scans={scans}
              blockedIPs={blockedIPs}
              blockLevel={blockLevel}
              handleBlockLevelChange={handleBlockLevelChange}
              autoBlock={autoBlock}
              handleAutoBlockToggle={handleAutoBlockToggle}
              strictMode={strictMode}
              handleStrictModeToggle={handleStrictModeToggle}
              handleBackendScan={handleBackendScan}
              handleSecurityBlockAction={handleSecurityBlockAction}
              handleSecurityWhitelistAction={handleSecurityWhitelistAction}
              liveSecurityLogs={liveSecurityLogs}
              recentThreatFeed={recentThreatFeed}
              storeProtectionMode={storeProtectionMode}
              blockedCount={blockedCount}
              recentBlocks={recentBlocks}
            />
          )}

          {page === "settings" && (
            <SettingsPage
              theme={theme}
              cardStyle={cardStyle}
              inputStyle={inputStyle}
              selectStyle={selectStyle}
              getPrimaryButtonStyle={getPrimaryButtonStyle}
              emailAlerts={emailAlerts}
              handleEmailAlertsToggle={handleEmailAlertsToggle}
              smsAlerts={smsAlerts}
              handleSmsAlertsToggle={handleSmsAlertsToggle}
              highRiskAlertsOnly={highRiskAlertsOnly}
              handleHighRiskAlertsOnlyToggle={handleHighRiskAlertsOnlyToggle}
              alertEmail={alertEmail}
              setAlertEmail={setAlertEmail}
              blockLevel={blockLevel}
              handleBlockLevelChange={handleBlockLevelChange}
              autoBlock={autoBlock}
              handleAutoBlockToggle={handleAutoBlockToggle}
              strictMode={strictMode}
              handleStrictModeToggle={handleStrictModeToggle}
              storeProtectionMode={storeProtectionMode}
              handleSaveSettings={handleSaveSettings}
            />
          )}
        </div>
      </div>

      <div
        style={{
          position: "fixed",
          right: "24px",
          bottom: "24px",
          width: chatOpen ? "360px" : "auto",
          zIndex: 50,
          transition: "all 0.25s ease",
        }}
      >
        {chatOpen ? (
          <div
            style={{
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              borderRadius: "24px",
              boxShadow: theme.shadow,
              overflow: "hidden",
              backdropFilter: theme.glass,
              WebkitBackdropFilter: theme.glass,
            }}
          >
            <div
              style={{
                background: `linear-gradient(135deg, ${theme.heroStart}, ${theme.heroEnd})`,
                color: "#ffffff",
                padding: "16px 18px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: "14px" }}>Security Assistant</div>
                <div style={{ fontSize: "12px", opacity: 0.78, marginTop: "2px" }}>
                  Open only when you want help
                </div>
              </div>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                aria-label="Close security assistant"
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "999px",
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#ffffff",
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "20px",
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: "14px" }}>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                  marginBottom: "12px",
                }}
              >
                {[
                  "Give me an executive summary",
                  "Analyze the latest incident",
                  "What should I change next?",
                  "Explain my current settings",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendChatMessage(prompt)}
                    style={{
                      border: `1px solid ${theme.border}`,
                      background: theme.surfaceAlt,
                      color: theme.text,
                      borderRadius: "999px",
                      padding: "8px 12px",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              <div
                style={{
                  height: "280px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  paddingRight: "4px",
                }}
              >
                {chatMessages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    style={{
                      alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                      maxWidth: message.role === "user" ? "86%" : "100%",
                      background:
                        message.role === "user"
                          ? darkMode
                            ? "#1d4ed8"
                            : "#dbeafe"
                          : "linear-gradient(180deg, rgba(15,23,42,0.96), rgba(9,16,31,0.92))",
                      color:
                        message.role === "user"
                          ? darkMode
                            ? "#eff6ff"
                            : "#1e3a8a"
                          : "#e2e8f0",
                      border: `1px solid ${
                        message.role === "user"
                          ? darkMode
                            ? "#2563eb"
                            : "#93c5fd"
                          : "rgba(56, 189, 248, 0.22)"
                      }`,
                      borderRadius: message.role === "user" ? "14px" : "18px",
                      padding: message.role === "user" ? "10px 12px" : "14px 14px 12px 14px",
                      fontSize: "13px",
                      lineHeight: 1.55,
                      boxShadow:
                        message.role === "user"
                          ? "none"
                          : "0 18px 40px rgba(2, 8, 23, 0.32), inset 0 1px 0 rgba(255,255,255,0.03)",
                    }}
                  >
                    {message.role === "user" ? (
                      message.text
                    ) : (
                      <div style={{ display: "grid", gap: "10px" }}>
                        {message.badge ? (
                          <div
                            style={{
                              display: "inline-flex",
                              width: "fit-content",
                              padding: "4px 10px",
                              borderRadius: "999px",
                              background: "rgba(56, 189, 248, 0.12)",
                              border: "1px solid rgba(56, 189, 248, 0.18)",
                              color: "#7dd3fc",
                              fontSize: "11px",
                              letterSpacing: "0.12em",
                              textTransform: "uppercase",
                              fontFamily: '"IBM Plex Mono", monospace',
                              fontWeight: 700,
                            }}
                          >
                            {message.badge}
                          </div>
                        ) : null}

                        {message.title ? (
                          <div
                            style={{
                              color: "#f8fafc",
                              fontSize: "16px",
                              fontWeight: 700,
                              letterSpacing: "-0.02em",
                            }}
                          >
                            {message.title}
                          </div>
                        ) : null}

                        <div style={{ color: "#cbd5e1", lineHeight: 1.7 }}>{message.text}</div>

                        {message.bullets?.length ? (
                          <div style={{ display: "grid", gap: "7px" }}>
                            {message.bullets.map((bullet) => (
                              <div
                                key={bullet}
                                style={{
                                  display: "flex",
                                  gap: "8px",
                                  alignItems: "flex-start",
                                  color: "#e2e8f0",
                                }}
                              >
                                <span style={{ color: "#38bdf8" }}>•</span>
                                <span>{bullet}</span>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {message.action ? (
                          <div
                            style={{
                              padding: "10px 12px",
                              borderRadius: "14px",
                              background: "rgba(37, 99, 235, 0.14)",
                              border: "1px solid rgba(59, 130, 246, 0.2)",
                              color: "#dbeafe",
                            }}
                          >
                            {message.action}
                          </div>
                        ) : null}

                        {message.followUps?.length ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                            {message.followUps.map((prompt) => (
                              <button
                                key={prompt}
                                onClick={() => sendChatMessage(prompt)}
                                style={{
                                  border: "1px solid rgba(125, 211, 252, 0.18)",
                                  background: "rgba(15, 23, 42, 0.8)",
                                  color: "#e2e8f0",
                                  borderRadius: "999px",
                                  padding: "7px 10px",
                                  fontSize: "11px",
                                  cursor: "pointer",
                                  transition: "all 0.2s ease",
                                }}
                              >
                                {prompt}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ marginTop: "12px", display: "flex", gap: "10px" }}>
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      sendChatMessage(chatInput);
                    }
                  }}
                  placeholder="Ask for a briefing, recommendation, or incident analysis"
                  style={{
                    flex: 1,
                    padding: "11px 12px",
                    borderRadius: "12px",
                    border: `1px solid ${theme.border}`,
                    background: theme.inputBg,
                    color: theme.text,
                    outline: "none",
                    fontSize: "13px",
                  }}
                />
                <button
                  onClick={() => sendChatMessage(chatInput)}
                  style={getPrimaryButtonStyle()}
                  {...pressHandlers}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            aria-label="Open security assistant"
            style={{
              border: `1px solid ${theme.border}`,
              background: `linear-gradient(135deg, ${theme.heroStart}, ${theme.heroEnd})`,
              color: "#ffffff",
              borderRadius: "999px",
              boxShadow: theme.shadow,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "14px 18px",
              fontWeight: 800,
              fontSize: "13px",
              letterSpacing: "0.01em",
            }}
          >
            <span
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "999px",
                display: "grid",
                placeItems: "center",
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.14)",
                fontSize: "16px",
                lineHeight: 1,
              }}
            >
              +
            </span>
            <span>Open Assistant</span>
          </button>
        )}
      </div>

      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap');

          * {
            box-sizing: border-box;
          }

          ::selection {
            background: rgba(56, 189, 248, 0.28);
            color: inherit;
          }

          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }

          @keyframes fadeUp {
            from {
              opacity: 0;
              transform: translateY(14px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes slideInDown {
            from {
              opacity: 0;
              transform: translateY(-14px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes trendSweep {
            from {
              transform: scaleX(0);
            }
            to {
              transform: scaleX(1);
            }
          }

          @keyframes pulse {
            0% {
              transform: scale(1);
              box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.35);
            }
            70% {
              transform: scale(1.03);
              box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
            }
            100% {
              transform: scale(1);
              box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
            }
          }

          @keyframes rowFlash {
            0% {
              background: rgba(59, 130, 246, 0.28);
            }
            100% {
              background: transparent;
            }
          }

          @keyframes ambientFloat {
            0% {
              transform: translate3d(0, 0, 0) scale(1);
            }
            50% {
              transform: translate3d(0, -10px, 0) scale(1.02);
            }
            100% {
              transform: translate3d(0, 0, 0) scale(1);
            }
          }

          @keyframes telemetryPulse {
            0% {
              opacity: 0.82;
              transform: scale(1);
            }
            50% {
              opacity: 1;
              transform: scale(1.04);
            }
            100% {
              opacity: 0.82;
              transform: scale(1);
            }
          }

          @keyframes signalSweep {
            0% {
              transform: translateX(-100%);
              opacity: 0;
            }
            20% {
              opacity: 1;
            }
            80% {
              opacity: 1;
            }
            100% {
              transform: translateX(100%);
              opacity: 0;
            }
          }

          @keyframes ambientDrift {
            0% {
              transform: translate3d(0, 0, 0) scale(1);
              opacity: 0.72;
            }
            33% {
              transform: translate3d(18px, -16px, 0) scale(1.08);
              opacity: 0.92;
            }
            66% {
              transform: translate3d(-14px, 10px, 0) scale(0.96);
              opacity: 0.78;
            }
            100% {
              transform: translate3d(0, 0, 0) scale(1);
              opacity: 0.72;
            }
          }

          @keyframes gradientShift {
            0% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
            100% {
              background-position: 0% 50%;
            }
          }
        `}
      </style>
    </div>
  );
}
