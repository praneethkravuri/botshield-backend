import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { partitionSecurityEvents } from "../lib/event-classification";
import BotShieldAdminExperience from "../components/admin/BotShieldAdminExperience";
import { safeFetchJson } from "../lib/safe-fetch";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatDateForPolaris(value) {
  if (!value) return "not yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "not yet" : date.toLocaleString();
}

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
    return `BotShield does not estimate revenue without verified commerce attribution. The defensible evidence currently available is ${blockedCount} blocked storefront events.`;
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
      badge: "Protection Evidence",
      title: "Verified Storefront Impact",
      text: `BotShield has recorded ${context.blockedCount} blocked storefront events. Revenue attribution is intentionally not estimated until verified commerce data is available.`,
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
  getSmallButtonStyle,
  getRiskBadgeStyle,
  getActionBadgeStyle,
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
  incidents,
  incidentCounts,
  incidentFilters,
  setIncidentFilters,
  handleIncidentRecovery,
  incidentLoading,
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "14px",
            alignItems: "flex-start",
            flexWrap: "wrap",
            marginBottom: "16px",
          }}
        >
          <div>
            <h3 style={{ margin: 0, color: theme.text }}>Security Incident Timeline</h3>
            <p style={{ color: theme.muted, margin: "6px 0 0", fontSize: "13px" }}>
              PostgreSQL-backed storefront evidence. IPs are masked in the merchant view.
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <span style={getRiskBadgeStyle("normal")}>{incidentCounts.real} real</span>
            <span style={getRiskBadgeStyle("balanced")}>
              {incidentCounts.simulation} simulations
            </span>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "10px",
            marginBottom: "16px",
          }}
        >
          <select
            value={incidentFilters.source}
            onChange={(event) =>
              setIncidentFilters((current) => ({
                ...current,
                source: event.target.value,
              }))
            }
            style={{
              padding: "10px 12px",
              borderRadius: "12px",
              border: `1px solid ${theme.border}`,
              background: theme.inputBg,
              color: theme.text,
            }}
          >
            <option value="real">Real storefront</option>
            <option value="simulation">Simulations</option>
            <option value="all">All sources</option>
          </select>
          <select
            value={incidentFilters.decision}
            onChange={(event) =>
              setIncidentFilters((current) => ({
                ...current,
                decision: event.target.value,
              }))
            }
            style={{
              padding: "10px 12px",
              borderRadius: "12px",
              border: `1px solid ${theme.border}`,
              background: theme.inputBg,
              color: theme.text,
            }}
          >
            <option value="all">All decisions</option>
            <option value="blocked">Blocked</option>
            <option value="challenged">Challenged</option>
            <option value="allowed">Allowed</option>
            <option value="whitelisted">Whitelisted</option>
          </select>
          <select
            value={incidentFilters.risk}
            onChange={(event) =>
              setIncidentFilters((current) => ({
                ...current,
                risk: event.target.value,
              }))
            }
            style={{
              padding: "10px 12px",
              borderRadius: "12px",
              border: `1px solid ${theme.border}`,
              background: theme.inputBg,
              color: theme.text,
            }}
          >
            <option value="all">All risk levels</option>
            <option value="high">High risk</option>
            <option value="medium">Medium risk</option>
            <option value="low">Low risk</option>
          </select>
          <input
            value={incidentFilters.search}
            onChange={(event) =>
              setIncidentFilters((current) => ({
                ...current,
                search: event.target.value,
              }))
            }
            placeholder="Search reasons, path, IP"
            style={{
              padding: "10px 12px",
              borderRadius: "12px",
              border: `1px solid ${theme.border}`,
              background: theme.inputBg,
              color: theme.text,
              minWidth: 0,
            }}
          />
        </div>

        {incidentLoading ? (
          <p style={{ color: theme.muted, marginBottom: 0 }}>Loading incidents…</p>
        ) : incidents.length === 0 ? (
          <p style={{ color: theme.muted, marginBottom: 0 }}>
            No incidents match the selected filters.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {incidents.slice(0, 50).map((incident) => (
              <div
                key={incident.id}
                style={{
                  padding: "14px",
                  borderRadius: "16px",
                  border: `1px solid ${theme.border}`,
                  background: theme.surfaceAlt,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                    <strong style={{ color: theme.text }}>
                      {incident.maskedIpAddress}
                    </strong>
                    <span style={getActionBadgeStyle(incident.decision)}>
                      {incident.decision}
                    </span>
                    <span style={getRiskBadgeStyle(incident.threatLevel)}>
                      Risk {incident.riskScore}/100
                    </span>
                    <span style={{ color: theme.muted, fontSize: "11px", fontWeight: 700 }}>
                      {incident.source === "storefront-proxy" ? "REAL" : "SIMULATION"}
                    </span>
                  </div>
                  <span style={{ color: theme.muted, fontSize: "13px" }}>
                    {incident.createdAt
                      ? new Date(incident.createdAt).toLocaleString()
                      : "Unknown time"}
                  </span>
                </div>
                <div style={{ color: theme.muted, fontSize: "13px", marginTop: "6px" }}>
                  Path: {incident.path}
                </div>
                {incident.networkCountry || incident.networkCity ? (
                  <div style={{ color: theme.muted, fontSize: "12px", marginTop: "6px" }}>
                    Approximate origin: {[incident.networkCity, incident.networkCountry].filter(Boolean).join(", ")}
                  </div>
                ) : null}
                {incident.networkAsn || incident.networkOrg ? (
                  <div style={{ color: theme.muted, fontSize: "12px", marginTop: "6px" }}>
                    Network: {incident.networkAsn ? `AS${incident.networkAsn}` : "ASN unknown"}
                    {incident.networkOrg ? ` · ${incident.networkOrg}` : ""}
                    {incident.networkType ? ` · ${incident.networkType}` : ""}
                    {incident.networkProvider &&
                    incident.networkProvider !== incident.networkOrg
                      ? ` · ${incident.networkProvider}`
                      : ""}
                  </div>
                ) : null}
                {incident.reasonCodes?.length ? (
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "10px" }}>
                    {incident.reasonCodes.map((code) => (
                      <span
                        key={code}
                        style={{
                          border: `1px solid ${theme.border}`,
                          borderRadius: "999px",
                          padding: "4px 8px",
                          color: theme.text,
                          fontSize: "11px",
                          fontFamily: '"IBM Plex Mono", monospace',
                        }}
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                ) : null}
                {incident.reasonSummary ? (
                  <div style={{ color: theme.muted, fontSize: "12px", marginTop: "6px", lineHeight: 1.6 }}>
                    {incident.reasonSummary}
                  </div>
                ) : null}
                {incident.source === "storefront-proxy" &&
                incident.decision === "blocked" ? (
                  <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => handleIncidentRecovery(incident, "unblock")}
                      style={getSmallButtonStyle("success")}
                    >
                      Unblock
                    </button>
                    <button
                      type="button"
                      onClick={() => handleIncidentRecovery(incident, "whitelist")}
                      style={getSmallButtonStyle("neutral")}
                    >
                      Whitelist
                    </button>
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
  emailProviderConfigured,
  handleSendTestAlert,
  lastAlertStatus,
  lastAlertSentAt,
  lastAlertError,
  emailProviderStatus,
  weeklyReportsEnabled,
  setWeeklyReportsEnabled,
  handleSendWeeklyReport,
  lastWeeklyReportStatus,
  lastWeeklyReportAt,
  lastWeeklyReportError,
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
              <span style={{ color: theme.text }}>Email alerts</span>
              <Toggle checked={emailAlerts} onClick={handleEmailAlertsToggle} theme={theme} />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: theme.text }}>SMS alerts</span>
              <span style={{ color: theme.muted, fontSize: "12px", fontWeight: 700 }}>
                Not implemented
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
              <span style={{ color: theme.text }}>Alert triggers</span>
              <span style={{ color: theme.muted, fontSize: "12px", textAlign: "right" }}>
                Blocked, challenged, and high-risk events
              </span>
            </div>
            <div style={{ color: emailProviderConfigured ? theme.successText : theme.muted, fontSize: "12px" }}>
              {emailProviderConfigured
                ? "Email provider connected"
                : `Email delivery needs ${[
                    !emailProviderStatus.apiKeyConfigured && "RESEND_API_KEY",
                    !emailProviderStatus.fromEmailConfigured && "ALERT_FROM_EMAIL",
                  ]
                    .filter(Boolean)
                    .join(" and ")} on Render`}
            </div>
            <button
              type="button"
              onClick={handleSendTestAlert}
              disabled={!emailAlerts || !emailProviderConfigured}
              style={{
                ...getPrimaryButtonStyle(),
                opacity: !emailAlerts || !emailProviderConfigured ? 0.55 : 1,
                cursor: !emailAlerts || !emailProviderConfigured ? "not-allowed" : "pointer",
              }}
            >
              Send Test Email
            </button>
            <div style={{ color: theme.muted, fontSize: "12px", lineHeight: 1.6 }}>
              Last delivery: {lastAlertStatus || "No delivery attempted"}
              {lastAlertSentAt
                ? ` · ${new Date(lastAlertSentAt).toLocaleString()}`
                : ""}
            </div>
            {lastAlertError ? (
              <div style={{ color: theme.dangerText, fontSize: "12px", lineHeight: 1.6 }}>
                Last delivery error: {lastAlertError}
              </div>
            ) : null}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: theme.text }}>Weekly Security Report</span>
              <Toggle
                checked={weeklyReportsEnabled}
                onClick={() => setWeeklyReportsEnabled(!weeklyReportsEnabled)}
                theme={theme}
              />
            </div>
            <button
              type="button"
              onClick={handleSendWeeklyReport}
              disabled={!weeklyReportsEnabled || !emailProviderConfigured}
              style={{
                ...getPrimaryButtonStyle(),
                opacity: !weeklyReportsEnabled || !emailProviderConfigured ? 0.55 : 1,
                cursor: !weeklyReportsEnabled || !emailProviderConfigured ? "not-allowed" : "pointer",
              }}
            >
              Send Weekly Report Now
            </button>
            <div style={{ color: theme.muted, fontSize: "12px", lineHeight: 1.6 }}>
              Last weekly report: {lastWeeklyReportStatus || "No report attempted"}
              {lastWeeklyReportAt
                ? ` · ${new Date(lastWeeklyReportAt).toLocaleString()}`
                : ""}
            </div>
            {lastWeeklyReportError ? (
              <div style={{ color: theme.dangerText, fontSize: "12px", lineHeight: 1.6 }}>
                Last report error: {lastWeeklyReportError}
              </div>
            ) : null}
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
  const location = useLocation();
  const navigate = useNavigate();
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
  const [emailAlerts, setEmailAlerts] = useState(false);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [highRiskAlertsOnly, setHighRiskAlertsOnly] = useState(true);
  const [alertEmail, setAlertEmail] = useState("");
  const [emailProviderConfigured, setEmailProviderConfigured] = useState(false);
  const [emailProviderStatus, setEmailProviderStatus] = useState({
    apiKeyConfigured: false,
    fromEmailConfigured: false,
  });
  const [lastAlertStatus, setLastAlertStatus] = useState(null);
  const [lastAlertSentAt, setLastAlertSentAt] = useState(null);
  const [lastAlertError, setLastAlertError] = useState(null);
  const [weeklyReportsEnabled, setWeeklyReportsEnabled] = useState(false);
  const [lastWeeklyReportStatus, setLastWeeklyReportStatus] = useState(null);
  const [lastWeeklyReportAt, setLastWeeklyReportAt] = useState(null);
  const [lastWeeklyReportError, setLastWeeklyReportError] = useState(null);
  const [securityPosture, setSecurityPosture] = useState(null);
  const [billingStatus, setBillingStatus] = useState(null);
  const [backendErrors, setBackendErrors] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [incidentCounts, setIncidentCounts] = useState({
    total: 0,
    real: 0,
    simulation: 0,
    blocked: 0,
    challenged: 0,
    allowed: 0,
    highRisk: 0,
    periodDays: 30,
  });
  const [incidentLoading, setIncidentLoading] = useState(false);
  const incidentRequestId = useRef(0);
  const [incidentFilters, setIncidentFilters] = useState({
    source: "real",
    decision: "all",
    risk: "all",
    search: "",
  });
  const [pauseUntil, setPauseUntil] = useState(null);
  const [protectionStatus, setProtectionStatus] = useState({
    shop: "",
    appInstalled: true,
    themeEmbedDetected: false,
    lastStorefrontDecisionAt: null,
    protectionActive: false,
    protectionPaused: false,
    blocklistCount: 0,
    whitelistCount: 0,
    realEventsToday: 0,
  });
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
    operations: false,
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
  const protectionReady =
    protectionStatus.themeEmbedDetected && protectionOn && !protectionPaused;

  useEffect(() => {
    if (threatLevel === "high") {
      setInsight("High-risk traffic detected");
      setRecommendation("Enable Strict Mode immediately");
    } else if (threatLevel === "medium") {
      setInsight("Suspicious activity detected");
      setRecommendation("Consider enabling Strict Mode");
    } else {
      setInsight("No high-risk threats detected today");
      setRecommendation("All systems normal");
    }
  }, [threatLevel]);

  const theme = darkMode
    ? {
        bg: "#09111f",
        sidebar: "#0b1424",
        surface: "#111c2f",
        surfaceAlt: "#0d1728",
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
        shadow: "0 18px 42px rgba(2, 6, 23, 0.36)",
        softShadow: "0 8px 24px rgba(2, 6, 23, 0.22)",
        accent: "#38bdf8",
        accentStrong: "#2563eb",
        accentSoft: "rgba(56, 189, 248, 0.16)",
        glass: "none",
      }
    : {
        bg: "#f4f6f8",
        sidebar: "#ffffff",
        surface: "#ffffff",
        surfaceAlt: "#f8fafc",
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
        shadow: "0 18px 42px rgba(15, 23, 42, 0.1)",
        softShadow: "0 6px 20px rgba(15, 23, 42, 0.07)",
        accent: "#0ea5e9",
        accentStrong: "#1d4ed8",
        accentSoft: "rgba(14, 165, 233, 0.12)",
        glass: "none",
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
      e.currentTarget.style.transform = "translateY(-2px)";
      e.currentTarget.style.boxShadow = theme.shadow;
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.transform = "translateY(0)";
      e.currentTarget.style.boxShadow = theme.softShadow;
    },
  };

  const cardStyle = {
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    backdropFilter: theme.glass,
    WebkitBackdropFilter: theme.glass,
    borderRadius: "18px",
    padding: "20px",
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

    if (normalized === "challenged") {
      return {
        color: darkMode ? "#fde68a" : "#92400e",
        backgroundColor: darkMode ? "#3b2a07" : "#fef3c7",
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
      if (!res.ok) throw new Error("Security activity could not be loaded.");
      const data = await res.json();
      const nextScans = (data.scans || []).map((scan, index) => ({
          id: scan.id ?? index,
          ipAddress: scan.ipAddress || "Unknown",
          threatLevel: String(scan.threatLevel || "low").toLowerCase(),
          actionTaken: String(scan.actionTaken || "allowed").toLowerCase(),
          pathVisited: scan.pathVisited || "/",
          riskScore: Number(scan.riskScore || 0),
          reasons: scan.reasons || "",
          source: scan.source || "dashboard-diagnostic",
          networkCountry: scan.networkCountry || "",
          networkCountryCode: scan.networkCountryCode || "",
          networkCity: scan.networkCity || "",
          networkLatitude:
            scan.networkLatitude == null ? null : Number(scan.networkLatitude),
          networkLongitude:
            scan.networkLongitude == null ? null : Number(scan.networkLongitude),
          networkOrg: scan.networkOrg || "",
          networkType: scan.networkType || "",
          createdAt: scan.createdAt || null,
        }));
      setScans(nextScans);
      const diagnostics = nextScans.filter(
        (scan) => scan.source !== "storefront-proxy",
      );
      setTotalScans(diagnostics.length);
      setBlocked(
        diagnostics.filter((scan) => scan.actionTaken === "blocked").length,
      );
    } catch (err) {
      console.error("Failed to load scans", err);
      recordBackendError("Activity", err);
    }
  };

  const loadSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Settings could not be loaded.");
      const data = await res.json();
      const settings = data.settings || {};
      setAutoBlock(Boolean(settings.autoBlock));
      setStrictMode(Boolean(settings.strictMode));
      setBlockLevel(settings.blockLevel || "Medium");
      setPauseUntil(settings.protectionPausedUntil || null);
      setProtectionOn(
        !settings.protectionPausedUntil ||
          new Date(settings.protectionPausedUntil).getTime() <= Date.now(),
      );
      setEmailAlerts(Boolean(settings.emailAlerts));
      setHighRiskAlertsOnly(settings.highRiskAlertsOnly !== false);
      setAlertEmail(settings.alertEmail || "");
      setEmailProviderConfigured(Boolean(settings.emailProvider?.configured));
      setEmailProviderStatus({
        apiKeyConfigured: Boolean(settings.emailProvider?.apiKeyConfigured),
        fromEmailConfigured: Boolean(
          settings.emailProvider?.fromEmailConfigured,
        ),
      });
      setLastAlertStatus(settings.lastAlertStatus || null);
      setLastAlertSentAt(settings.lastAlertSentAt || null);
      setLastAlertError(settings.lastAlertError || null);
      setWeeklyReportsEnabled(Boolean(settings.weeklyReportsEnabled));
      setLastWeeklyReportStatus(settings.lastWeeklyReportStatus || null);
      setLastWeeklyReportAt(settings.lastWeeklyReportAt || null);
      setLastWeeklyReportError(settings.lastWeeklyReportError || null);
    } catch (err) {
      console.error("Failed to load settings", err);
      recordBackendError("Settings", err);
    }
  };

  const loadProtectionStatus = async () => {
    try {
      const res = await fetch("/api/status");
      if (!res.ok) throw new Error("Protection status could not be loaded.");
      const data = await res.json();
      const status = data.status || {};
      setProtectionStatus((previous) => ({ ...previous, ...status }));
      setPauseUntil(status.protectionPausedUntil || null);
      setProtectionOn(Boolean(status.protectionActive));
    } catch (err) {
      console.error("Failed to load protection status", err);
      recordBackendError("Protection status", err);
    }
  };

  const loadSecurityPosture = async () => {
    try {
      const response = await fetch("/api/security-posture");
      if (!response.ok) throw new Error("Security posture could not be loaded.");
      const data = await response.json();
      setSecurityPosture(data.posture || null);
    } catch (error) {
      console.error("Failed to load security posture", error);
      recordBackendError("Security posture", error);
    }
  };

  const loadBillingStatus = async () => {
    try {
      const response = await fetch("/api/billing-status");
      if (!response.ok) throw new Error("Billing status could not be loaded.");
      const data = await response.json();
      setBillingStatus(data.billing || null);
    } catch (error) {
      console.error("Failed to load billing status", error);
      recordBackendError("Billing", error);
    }
  };

  const loadBlocklist = async () => {
    try {
      const res = await fetch("/api/blocklist");
      if (!res.ok) throw new Error("Blocklist could not be loaded.");
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
      recordBackendError("Blocklist", err);
    }
  };

  const loadWhitelist = async () => {
    try {
      const res = await fetch("/api/whitelist");
      if (!res.ok) throw new Error("Trusted visitors could not be loaded.");
      const data = await res.json();
      setWhitelist((data.whitelistIps || []).map((row) => row.ipAddress));
    } catch (err) {
      console.error("Failed to load whitelist", err);
      recordBackendError("Trusted visitors", err);
    }
  };

  const loadIncidents = async (filters = incidentFilters) => {
    const requestId = ++incidentRequestId.current;
    setIncidentLoading(true);
    try {
      const params = new URLSearchParams({
        source: filters.source,
        decision: filters.decision,
        risk: filters.risk,
        search: filters.search,
      });
      const response = await fetch(`/api/incident-list?${params.toString()}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to load incidents.");
      }
      if (requestId !== incidentRequestId.current) return;
      setIncidents(data.events || []);
      setIncidentCounts(
        data.counts || {
          total: 0,
          real: 0,
          simulation: 0,
          blocked: 0,
          challenged: 0,
          allowed: 0,
          highRisk: 0,
          periodDays: 30,
        },
      );
    } catch (error) {
      if (requestId !== incidentRequestId.current) return;
      console.error("Failed to load incidents", error);
      recordBackendError("Incident timeline", error);
    } finally {
      if (requestId === incidentRequestId.current) setIncidentLoading(false);
    }
  };

  const saveMerchantMetadata = async (nextNotes, nextTags) => {
    const response = await fetch("/api/merchant-metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        analystNotes: nextNotes,
        trustedTags: nextTags,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Failed to save merchant metadata.");
    }
    setTeamNotes(data.analystNotes || {});
    setTrustedTags(data.trustedTags || {});
    return data;
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

  const recordBackendError = (area, error) => {
    const detail = error instanceof Error ? error.message : "Request failed.";
    const message = `${area}: ${detail}`;
    setBackendErrors((current) =>
      current.includes(message) ? current : [...current, message],
    );
  };

  const loadBackendState = async () => {
    await Promise.all([
      loadScans(),
      loadSettings(),
      loadBlocklist(),
      loadWhitelist(),
      loadProtectionStatus(),
      loadIncidents(),
      loadSecurityPosture(),
      loadBillingStatus(),
    ]);
  };

  const refreshBackendState = async () => {
    setSyncing(true);
    setBackendErrors([]);
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
      protectionPausedUntil: pauseUntil,
      emailAlerts,
      highRiskAlertsOnly,
      alertEmail,
      weeklyReportsEnabled,
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
    setPauseUntil(settings.protectionPausedUntil || null);
    setProtectionOn(
      !settings.protectionPausedUntil ||
        new Date(settings.protectionPausedUntil).getTime() <= Date.now(),
    );
    setEmailAlerts(Boolean(settings.emailAlerts));
    setHighRiskAlertsOnly(settings.highRiskAlertsOnly !== false);
    setAlertEmail(settings.alertEmail || "");
    setEmailProviderConfigured(Boolean(settings.emailProvider?.configured));
    setEmailProviderStatus({
      apiKeyConfigured: Boolean(settings.emailProvider?.apiKeyConfigured),
      fromEmailConfigured: Boolean(settings.emailProvider?.fromEmailConfigured),
    });
    setLastAlertStatus(settings.lastAlertStatus || null);
    setLastAlertSentAt(settings.lastAlertSentAt || null);
    setLastAlertError(settings.lastAlertError || null);
    setWeeklyReportsEnabled(Boolean(settings.weeklyReportsEnabled));
    setLastWeeklyReportStatus(settings.lastWeeklyReportStatus || null);
    setLastWeeklyReportAt(settings.lastWeeklyReportAt || null);
    setLastWeeklyReportError(settings.lastWeeklyReportError || null);

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
        source: "dashboard-diagnostic",
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
      }

      await Promise.all([loadScans(), loadBlocklist(), loadWhitelist(), loadSettings()]);
      triggerAlert(`Diagnostic scan complete. Threat ${String(data.threatLevel || "unknown").toUpperCase()} was ${String(actionLabel).toUpperCase()}. No storefront enforcement was changed.`);
    } catch (err) {
      console.error(err);
      triggerAlert("Error connecting to backend.");
    }
  };

  const handleEmailAlertsToggle = () => {
    if (!emailProviderConfigured && !emailAlerts) {
      triggerAlert("Email delivery requires RESEND_API_KEY and ALERT_FROM_EMAIL on Render.");
      return;
    }
    setEmailAlerts((prev) => {
      const nextValue = !prev;
      triggerAlert(`Email alerts ${nextValue ? "enabled" : "disabled"}.`);
      return nextValue;
    });
  };

  const handleSmsAlertsToggle = () => {
    setSmsAlerts(false);
    triggerAlert("SMS alerts are not implemented in this MVP.");
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
        if (
          !protectionStatus.themeEmbedDetected &&
          protectionStatus.shop
        ) {
          window.open(
            `https://${protectionStatus.shop}/admin/themes/current/editor?context=apps&activateAppId=d4fd10812566b17d9d99ed95e0978ada/botshield-theme-embed`,
            "_blank",
            "noopener,noreferrer",
          );
          triggerAlert(
            "Shopify theme app embeds opened. Enable BotShield and click Save.",
          );
          break;
        }
        await refreshBackendState();
        triggerAlert("Runtime refreshed from the live backend.");
        break;
      case "autoblock":
        await handleAutoBlockToggle();
        break;
      case "evidence":
        openDashboardWorkspace("deepDive", "Evidence workspace opened.");
        break;
      case "billing":
        if (billingStatus?.pricingUrl) {
          window.open(
            billingStatus.pricingUrl,
            "_blank",
            "noopener,noreferrer",
          );
          triggerAlert("Shopify billing plans opened in a new tab.");
        } else {
          triggerAlert(
            "Billing must first be configured in the Shopify Partner Dashboard.",
          );
        }
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
        openDashboardWorkspace("deepDive", "Evidence workspace opened to review verified storefront security events.");
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
        openDashboardWorkspace("deepDive", "Threat pressure evidence opened.");
        break;
      case "blocked":
        openDashboardWorkspace("deepDive", "Recent enforcement evidence opened.");
        break;
      case "mode":
        openSettingsWorkspace("Protection policy settings opened.");
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
          await resumeProtectionNow();
        } else {
          await handlePauseProtection(10);
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

  const handleScan = async () => {
    if (!protectionOn || protectionPaused) {
      triggerAlert("Protection is paused. Resume runtime protection before running a simulated scan.");
      return;
    }

    const risks = ["low", "medium", "high"];
    const risk = risks[Math.floor(Math.random() * 3)];
    const fakeIP =
      "198.51.100." +
      Math.floor(Math.random() * 255) +
      Math.max(1, Math.floor(Math.random() * 254));
    const simulatedUserAgent =
      risk === "high"
        ? "python-requests/2.32 BotShield-Simulation"
        : risk === "medium"
          ? "HeadlessChrome BotShield-Simulation"
          : "Mozilla/5.0 BotShield-Simulation";
    const simulatedPath =
      risk === "low" ? "/products/test" : risk === "medium" ? "/cart" : "/account/login";

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ipAddress: fakeIP,
          userAgent: simulatedUserAgent,
          pathVisited: simulatedPath,
          source: "dashboard-simulation",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Simulation failed.");
      }

      await loadScans();
      setThreatLevel(String(data.threatLevel || risk).toLowerCase());
      setLastScanTime(new Date().toLocaleTimeString());
      setResult(
        `Simulation: ${data.threatLevel || risk} risk, ${data.actionTaken || data.action}`,
      );
      triggerAlert(
        `Simulation recorded. It is excluded from real storefront metrics.`,
      );
    } catch (err) {
      console.error("Failed to generate test traffic", err);
      triggerAlert("Failed to generate backend test traffic.");
    }
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

  const handleSaveNote = async () => {
    if (!selectedNoteIp || !noteInput.trim()) {
      triggerAlert("Select an IP and add a note before saving.");
      return;
    }
    try {
      const nextNotes = {
        ...teamNotes,
        [selectedNoteIp]: noteInput.trim(),
      };
      await saveMerchantMetadata(nextNotes, trustedTags);
      setNoteInput("");
      triggerAlert(`Saved note for ${selectedNoteIp}.`);
    } catch (error) {
      triggerAlert(
        error instanceof Error ? error.message : "Failed to save note.",
      );
    }
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

  const handleSaveTrustedTag = async () => {
    if (!selectedTrustedTagIp || !trustedTagInput.trim()) {
      triggerAlert("Select an IP and enter a trusted tag before saving.");
      return;
    }

    try {
      const nextTags = {
        ...trustedTags,
        [selectedTrustedTagIp]: trustedTagInput.trim(),
      };
      await saveMerchantMetadata(teamNotes, nextTags);
      triggerAlert(`Updated trusted tag for ${selectedTrustedTagIp}.`);
      setSelectedTrustedTagIp("");
      setTrustedTagInput("");
    } catch (error) {
      triggerAlert(
        error instanceof Error ? error.message : "Failed to save trusted tag.",
      );
    }
  };

  const handleCancelTrustedTag = () => {
    setSelectedTrustedTagIp("");
    setTrustedTagInput("");
    triggerAlert("Trusted tag editor closed.");
  };

  const handlePauseProtection = async (minutes) => {
    const resumeAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    try {
      await persistProtectionSettings(
        { protectionPausedUntil: resumeAt },
        {
          message: `Protection paused for ${minutes} minutes. Storefront decisions will still be logged but not blocked.`,
        },
      );
    } catch (err) {
      console.error("Failed to pause protection", err);
      triggerAlert("Failed to pause protection.");
    }
  };

  const resumeProtectionNow = async () => {
    try {
      await persistProtectionSettings(
        { protectionPausedUntil: null },
        { message: "Protection resumed." },
      );
    } catch (err) {
      console.error("Failed to resume protection", err);
      triggerAlert("Failed to resume protection.");
    }
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
          emailAlerts,
          highRiskAlertsOnly,
          alertEmail,
          weeklyReportsEnabled,
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

  const handleSendTestAlert = async () => {
    try {
      const response = await fetch("/api/alerts/test", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || data.delivery?.error || "Test email failed.");
      }
      await loadSettings();
      triggerAlert(`Test email sent to ${alertEmail}.`);
    } catch (error) {
      triggerAlert(error instanceof Error ? error.message : "Test email failed.");
    }
  };

  const handleSendWeeklyReport = async () => {
    try {
      const response = await fetch("/api/weekly-report", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          data.delivery?.error ||
            `Weekly report not sent: ${data.delivery?.status || "delivery failed"}`,
        );
      }
      await Promise.all([loadSettings(), loadSecurityPosture()]);
      triggerAlert(`Weekly report sent to ${alertEmail}.`);
    } catch (error) {
      triggerAlert(
        error instanceof Error ? error.message : "Weekly report failed.",
      );
    }
  };

  const handleIncidentRecovery = async (incident, action) => {
    try {
      const response = await fetch("/api/incident-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: incident.id, action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Recovery action failed.");
      }

      await Promise.all([
        loadIncidents(),
        loadBlocklist(),
        loadWhitelist(),
        loadProtectionStatus(),
      ]);
      triggerAlert(
        action === "whitelist"
          ? `Whitelisted ${incident.maskedIpAddress} from incident ${incident.id}.`
          : `Unblocked ${incident.maskedIpAddress} from incident ${incident.id}.`,
      );
    } catch (error) {
      triggerAlert(
        error instanceof Error ? error.message : "Recovery action failed.",
      );
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
      setThreatLevel(parsed.threatLevel ?? "low");
      setInsight(parsed.insight ?? "");
      setRecommendation(parsed.recommendation ?? "");
      setDarkMode(parsed.darkMode ?? false);
      setHistory(parsed.history ?? []);
      setLastScanTime(parsed.lastScanTime ?? "No scans yet");
      setResult(parsed.result ?? "No scans yet");
      setSelectedTrustedTagIp(parsed.selectedTrustedTagIp ?? "");
      setTrustedTagInput(parsed.trustedTagInput ?? "");
    }
  }, []);

  useEffect(() => {
    const requestedView = new URLSearchParams(location.search).get("view");
    const pageMap = {
      dashboard: "dashboard",
      analytics: "analytics",
      rules: "security",
      "protection-rules": "security",
      visitors: "incidents",
      "fraud-orders": "analytics",
      activity: "incidents",
      incidents: "incidents",
      detection: "security",
      blocklist: "settings",
      trusted: "settings",
      "trusted-visitors": "settings",
      policy: "settings",
      "alerts-reports": "settings",
      settings: "settings",
      billing: "billing",
      setup: "setup",
    };
    const pathPageMap = {
      "/app": "dashboard",
      "/app/analytics": "analytics",
      "/app/protection-rules": "security",
      "/app/visitors": "incidents",
      "/app/fraud-orders": "analytics",
      "/app/blocklist": "settings",
      "/app/trusted-visitors": "settings",
      "/app/alerts-reports": "settings",
      "/app/billing": "billing",
      "/app/settings": "settings",
      "/app/setup": "setup",
    };
    const legacyViewPathMap = {
      dashboard: "/app",
      analytics: "/app/analytics",
      rules: "/app/protection-rules",
      "protection-rules": "/app/protection-rules",
      visitors: "/app/visitors",
      "fraud-orders": "/app/analytics",
      activity: "/app/visitors",
      incidents: "/app/visitors",
      detection: "/app/protection-rules",
      blocklist: "/app/settings",
      trusted: "/app/settings",
      "trusted-visitors": "/app/settings",
      policy: "/app/settings",
      "alerts-reports": "/app/settings?tab=general",
      settings: "/app/settings",
      billing: "/app/billing",
      setup: "/app/setup",
    };
    if (requestedView && pageMap[requestedView]) {
      setPage(pageMap[requestedView]);
      navigate(legacyViewPathMap[requestedView], { replace: true });
    } else if (pathPageMap[location.pathname]) {
      setPage(pathPageMap[location.pathname]);
    } else {
      setPage("dashboard");
    }
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    const dataToSave = {
      threatLevel,
      insight,
      recommendation,
      darkMode,
      history,
      lastScanTime,
      result,
      selectedTrustedTagIp,
      trustedTagInput,
    };

    localStorage.setItem("botshield_dashboard_data", JSON.stringify(dataToSave));
  }, [
    threatLevel,
    insight,
    recommendation,
    darkMode,
    history,
    lastScanTime,
    result,
    selectedTrustedTagIp,
    trustedTagInput,
  ]);

  useEffect(() => {
    refreshBackendState();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadIncidents(incidentFilters);
    }, 250);
    return () => clearTimeout(timer);
  }, [
    incidentFilters.source,
    incidentFilters.decision,
    incidentFilters.risk,
    incidentFilters.search,
  ]);

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
      refreshBackendState();
      triggerAlert("The protection pause expired.");
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

  const { storefront: storefrontScans, simulated: simulatedScans } =
    partitionSecurityEvents(scans);
  const blockedCount = storefrontScans.filter(
    (scan) => scan.actionTaken === "blocked",
  ).length;
  const allowedCount = storefrontScans.filter(
    (scan) => scan.actionTaken === "allowed",
  ).length;
  const moneySaved = 0;

  const blockedToday = storefrontScans.filter(
    (scan) =>
      scan.actionTaken === "blocked" &&
      scan.createdAt &&
      new Date(scan.createdAt).toDateString() === new Date().toDateString(),
  ).length;

  const scansToday = storefrontScans.filter(
    (scan) =>
      scan.createdAt &&
      new Date(scan.createdAt).toDateString() === new Date().toDateString(),
  ).length;

  const recentBlocks = storefrontScans.filter((scan) => {
    if (!scan.createdAt) return false;
    const diff = Date.now() - new Date(scan.createdAt).getTime();
    return scan.actionTaken === "blocked" && diff <= 60 * 60 * 1000;
  }).length;

  const lastScan = storefrontScans[0];
  const latestKnownIp = blockedIPs[0]?.ip || scans[0]?.ipAddress || "";
  const lastScanLabel =
    lastScan?.createdAt
      ? new Date(lastScan.createdAt).toLocaleTimeString()
      : "No scans yet";

  const highRiskCount = storefrontScans.filter(
    (scan) => scan.threatLevel === "high",
  ).length;
  const mediumRiskCount = storefrontScans.filter(
    (scan) => scan.threatLevel === "medium",
  ).length;
  const percentHigh = storefrontScans.length
    ? Math.round((highRiskCount / storefrontScans.length) * 100)
    : 0;
  const threatTrendWidth = `${Math.min(Math.max(storefrontScans.length * 10, 8), 100)}%`;
  const recentThreats = storefrontScans.slice(0, 5);

  const currentWeekScans = storefrontScans.filter(
    (scan) => scan.createdAt && isSameWeek(scan.createdAt, new Date()),
  ).length;

  const previousWeekScans = storefrontScans.filter(
    (scan) => scan.createdAt && isPreviousWeek(scan.createdAt, new Date()),
  ).length;

  const currentWeekBlocked = storefrontScans.filter(
    (scan) =>
      scan.createdAt &&
      scan.actionTaken === "blocked" &&
      isSameWeek(scan.createdAt, new Date()),
  ).length;

  const previousWeekBlocked = storefrontScans.filter(
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

  const lowRiskCount = storefrontScans.filter(
    (scan) => scan.threatLevel === "low",
  ).length;
  const challengedCount = storefrontScans.filter(
    (scan) => scan.actionTaken === "challenged",
  ).length;
  const whitelistedCount = storefrontScans.filter(
    (scan) => scan.actionTaken === "whitelisted",
  ).length;
  const verifiedInterventions = blockedCount + challengedCount;
  const geolocatedStorefrontEvents = storefrontScans.filter(
    (scan) =>
      scan.networkLatitude != null &&
      scan.networkLongitude != null &&
      Number.isFinite(Number(scan.networkLatitude)) &&
      Number.isFinite(Number(scan.networkLongitude)),
  );
  const geolocatedThreatEvents = geolocatedStorefrontEvents.filter(
    (scan) =>
      scan.threatLevel === "high" ||
      scan.threatLevel === "medium" ||
      scan.actionTaken === "blocked" ||
      scan.actionTaken === "challenged",
  );
  const trafficOrigins = Array.from(
    geolocatedStorefrontEvents.reduce((origins, scan) => {
      const latitude = Number(scan.networkLatitude);
      const longitude = Number(scan.networkLongitude);
      const countryCode = scan.networkCountryCode || "";
      const country = scan.networkCountry || countryCode || "Unknown";
      const city = scan.networkCity || "";
      const key = `${countryCode || country}:${latitude.toFixed(2)}:${longitude.toFixed(2)}`;
      const current = origins.get(key) || {
        key,
        latitude,
        longitude,
        countryCode,
        country,
        city,
        count: 0,
        threatCount: 0,
        allowed: 0,
        blocked: 0,
        challenged: 0,
        latestAt: null,
        highestRiskScore: 0,
      };
      const isThreat =
        scan.threatLevel === "high" ||
        scan.threatLevel === "medium" ||
        scan.actionTaken === "blocked" ||
        scan.actionTaken === "challenged";
      current.count += 1;
      current.threatCount += isThreat ? 1 : 0;
      current.allowed += scan.actionTaken === "allowed" ? 1 : 0;
      current.blocked += scan.actionTaken === "blocked" ? 1 : 0;
      current.challenged += scan.actionTaken === "challenged" ? 1 : 0;
      current.highestRiskScore = Math.max(
        current.highestRiskScore,
        Number(scan.riskScore || 0),
      );
      if (
        scan.createdAt &&
        (!current.latestAt ||
          new Date(scan.createdAt).getTime() >
            new Date(current.latestAt).getTime())
      ) {
        current.latestAt = scan.createdAt;
      }
      origins.set(key, current);
      return origins;
    }, new Map()).values(),
  ).sort(
    (a, b) =>
      b.threatCount - a.threatCount ||
      b.count - a.count,
  );
  const geolocatedCountryCount = new Set(
    trafficOrigins.map((origin) => origin.countryCode || origin.country),
  ).size;
  const geographyCoverage = storefrontScans.length
    ? Math.round(
        (geolocatedStorefrontEvents.length / storefrontScans.length) * 100,
      )
    : 0;
  const latestGeolocatedEvent = geolocatedStorefrontEvents[0] || null;
  const leadingThreatOrigin =
    trafficOrigins.find((origin) => origin.threatCount > 0) || null;
  const maxThreatCount = Math.max(
    lowRiskCount,
    mediumRiskCount,
    highRiskCount,
    1,
  );

  const maxActionCount = Math.max(
    allowedCount,
    blockedCount,
    challengedCount + whitelistedCount,
    1,
  );

  const lowThreatWidth = (lowRiskCount / maxThreatCount) * 100 + "%";
  const mediumThreatWidth = (mediumRiskCount / maxThreatCount) * 100 + "%";
  const highThreatWidth = (highRiskCount / maxThreatCount) * 100 + "%";

  const allowedActionWidth = (allowedCount / maxActionCount) * 100 + "%";
  const blockedActionWidth = (blockedCount / maxActionCount) * 100 + "%";
  const whitelistedActionWidth =
    ((challengedCount + whitelistedCount) / maxActionCount) * 100 + "%";

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
    moneySaved: 0,
    lastScanLabel,
    botPressureScore,
    botPressureLabel,
    currentWeekScans,
    currentWeekBlocked,
    pauseCountdown,
    latestThreat: storefrontScans[0]
      ? {
          ipAddress: storefrontScans[0].ipAddress,
          threatLevel: storefrontScans[0].threatLevel,
          actionTaken: storefrontScans[0].actionTaken,
          pathVisited: storefrontScans[0].pathVisited,
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
    storefrontScans.length > 0
      ? storefrontScans.slice(0, 3).map((scan) => ({
          status: scan.actionTaken === "blocked" ? "Blocked" : "Allowed",
          message: `${scan.ipAddress} ${scan.actionTaken} (${scan.threatLevel})`,
        }))
      : [
          { status: "Waiting", message: "No storefront traffic received yet" },
          {
            status: protectionStatus.themeEmbedDetected ? "Connected" : "Setup",
            message: protectionStatus.themeEmbedDetected
              ? "Theme embed heartbeat detected"
              : "Theme embed not detected",
          },
        ];

  const recentThreatFeed =
    storefrontScans.length > 0
      ? storefrontScans
          .slice(0, 3)
          .map((scan) => `• ${scan.threatLevel} threat from ${scan.ipAddress}`)
      : [
          "• No real storefront events received",
          `• ${simulatedScans.length} simulation event${simulatedScans.length === 1 ? "" : "s"} excluded`,
        ];

  const storeProtectionMode = strictMode
    ? {
        badge: "high",
        label: "Aggressive",
        description: "Strict blocking is active for suspicious traffic.",
      }
    : blockLevel === "Low"
    ? {
        badge: "normal",
        label: "Normal",
        description: "Light protection focused on obvious abuse.",
      }
    : blockLevel === "Medium"
    ? {
        badge: "balanced",
        label: "Balanced",
        description: "Balanced protection for everyday store traffic.",
      }
    : {
        badge: "high",
        label: "Aggressive",
        description: "Stronger rules for elevated threat conditions.",
      };

  const systemStatusItems = [
    {
      label: "Shopify app installed",
      active: protectionStatus.appInstalled,
      detail: "authenticated admin connection",
      actionKey: "runtime",
    },
    {
      label: protectionStatus.themeEmbedDetected
        ? "Theme embed connected"
        : "Theme embed not connected",
      active: protectionStatus.themeEmbedDetected,
      detail: protectionStatus.lastStorefrontDecisionAt
        ? `last event ${new Date(protectionStatus.lastStorefrontDecisionAt).toLocaleTimeString()}`
        : "enable the app embed to start protection",
      actionKey: "runtime",
    },
    {
      label: protectionPaused ? "Protection paused" : "Protection policy ready",
      active: protectionStatus.themeEmbedDetected && !protectionPaused,
      detail: protectionPaused
        ? `resumes in ${pauseCountdown}m`
        : autoBlock
          ? "auto-block enabled"
          : "monitoring without auto-block",
      actionKey: "autoblock",
    },
    {
      label:
        storefrontScans.length === 0
          ? "No storefront traffic yet"
          : highRiskCount > 0
            ? "Threats detected"
            : "No high-risk events",
      active: storefrontScans.length > 0,
      detail:
        storefrontScans.length > 0
          ? `${protectionStatus.realEventsToday} real events today`
          : `${simulatedScans.length} simulations excluded`,
      actionKey: "evidence",
    },
    {
      label: `${protectionStatus.blocklistCount} blocklisted`,
      active: true,
      detail: `${protectionStatus.whitelistCount} whitelisted`,
      actionKey: "evidence",
    },
    {
      label: `${protectionStatus.realEventsToday} real events today`,
      active: protectionStatus.realEventsToday > 0,
      detail: `${simulatedScans.length} simulations excluded`,
      actionKey: "evidence",
    },
    {
      label: billingStatus?.active
        ? "Billing Active"
        : billingStatus?.configured
          ? "Billing Approval Required"
          : "Billing Setup Required",
      active: Boolean(billingStatus?.active),
      detail: billingStatus?.active
        ? billingStatus.subscription?.name || "paid Shopify plan"
        : billingStatus?.configured
          ? `${billingStatus.planName || "BotShield Basic"} at $${Number(
              billingStatus.monthlyPrice || 14.99,
            ).toFixed(2)}/month awaiting approval`
          : "configure Shopify App Pricing",
      actionKey: "billing",
    },
  ];
  const primarySystemStatusItems = systemStatusItems.filter((_, index) =>
    [0, 1, 2, 6].includes(index),
  );

  const navItems = [
    {
      key: "dashboard",
      label: "Dashboard",
      eyebrow: "Control",
      icon: "01",
    },
    {
      key: "security",
      label: "Security",
      eyebrow: "Detection",
      icon: "02",
    },
    {
      key: "settings",
      label: "Settings",
      eyebrow: "Policy",
      icon: "03",
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
      label: "Storefront Events",
      value: `${storefrontScans.length}`,
      detail: `${blockedCount} blocked, ${simulatedScans.length} simulations excluded`,
      actionKey: "blocked",
    },
    {
      label: "Runtime Mode",
      value: strictMode ? "Aggressive" : storeProtectionMode.label.replace(/[^\w\s]/g, "").trim(),
      detail: autoBlock ? "automated enforcement" : "manual oversight",
      actionKey: "mode",
    },
  ];
  const merchantMetrics = [
    {
      label: "Requests analyzed today",
      value: scansToday,
      detail: "Verified storefront traffic",
      actionKey: "scansToday",
    },
    {
      label: "Threats blocked today",
      value: blockedToday,
      detail: autoBlock ? "Automated response enabled" : "Monitoring only",
      actionKey: "blocked",
    },
    {
      label: "High-risk traffic",
      value: `${percentHigh}%`,
      detail: `${highRiskCount} high-risk event${highRiskCount === 1 ? "" : "s"}`,
      actionKey: "hostileShare",
    },
    {
      label: "Security score",
      value: securityPosture ? `${securityPosture.score.score}/100` : "—",
      detail: securityPosture?.score?.grade || "Calculating posture",
      actionKey: "runtimeStatus",
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

  const polarisReadinessItems = [
    {
      label: "Shopify app installed",
      complete: Boolean(protectionStatus.appInstalled),
      detail: "The embedded admin app is authenticated.",
    },
    {
      label: "Theme app embed enabled",
      complete: Boolean(protectionStatus.themeEmbedDetected),
      detail: protectionStatus.themeEmbedDetected
        ? "The storefront connection is active."
        : "Enable BotShield in the Shopify theme editor.",
    },
    {
      label: "Storefront events received",
      complete: storefrontScans.length > 0,
      detail:
        storefrontScans.length > 0
          ? `${storefrontScans.length} real storefront events recorded.`
          : "Visit the storefront after enabling the theme embed.",
    },
    {
      label: "Protection active",
      complete: Boolean(protectionReady),
      detail: protectionPaused
        ? "Protection is paused; events are still recorded."
        : autoBlock
          ? "Automated response is enabled."
          : "Monitoring is active without automated blocking.",
    },
    {
      label: "Email provider connected",
      complete: Boolean(emailProviderConfigured),
      detail: emailProviderConfigured
        ? "Resend is available for alerts and reports."
        : "Configure RESEND_API_KEY and verify botshieldapp.com.",
    },
    {
      label: "Alert email configured",
      complete: EMAIL_PATTERN.test(alertEmail),
      detail: alertEmail || "Add the merchant alert recipient.",
    },
    {
      label: "Test email delivered",
      complete: lastAlertStatus === "sent",
      detail:
        lastAlertStatus === "sent"
          ? `Last sent ${formatDateForPolaris(lastAlertSentAt)}.`
          : "Send a test email after configuring alerts.",
    },
    {
      label: "Billing verified",
      complete: Boolean(billingStatus?.active),
      detail: billingStatus?.active
        ? billingStatus.subscription?.name || "Shopify subscription active."
        : "Complete Shopify App Pricing and subscription verification.",
    },
  ];

  const openThemeEditor = () => {
    if (!protectionStatus.shop) {
      triggerAlert(
        "The Shopify store domain is not available yet. Refresh BotShield and try again.",
      );
      return;
    }
    window.open(
      `https://${protectionStatus.shop}/admin/themes/current/editor?context=apps&activateAppId=d4fd10812566b17d9d99ed95e0978ada/botshield-theme-embed`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const polarisModel = {
    page,
    protectionStatus,
    protectionPaused,
    protectionReady,
    autoBlock,
    strictMode,
    blockLevel,
    storefrontScans,
    simulatedScans,
    allowedCount,
    challengedCount,
    blockedCount,
    highRiskCount,
    securityPosture,
    billingStatus,
    backendErrors,
    incidents,
    incidentCounts,
    incidentLoading,
    incidentFilters,
    emailAlerts,
    highRiskAlertsOnly,
    alertEmail,
    emailProviderConfigured,
    emailProviderStatus,
    lastAlertStatus,
    lastAlertSentAt,
    lastAlertError,
    weeklyReportsEnabled,
    lastWeeklyReportStatus,
    lastWeeklyReportAt,
    lastWeeklyReportError,
    blockedIPs,
    whitelist,
    trafficOrigins,
    result,
    lastScanTime,
    syncing,
    readinessItems: polarisReadinessItems,
  };

  const openPolarisPage = (nextPage) => {
    const retiredPageMap = {
      blocklist: "settings",
      trusted: "settings",
      "trusted-visitors": "settings",
      "alerts-reports": "settings",
      policy: "settings",
    };
    const resolvedPage = retiredPageMap[nextPage] || nextPage;
    const pageToView = {
      dashboard: "/app",
      analytics: "/app/analytics",
      security: "/app/protection-rules",
      detection: "/app/protection-rules",
      incidents: "/app/visitors",
      "fraud-orders": "/app/analytics",
      blocklist: "/app/settings",
      trusted: "/app/settings",
      "trusted-visitors": "/app/settings",
      settings: "/app/settings",
      policy: "/app/settings",
      "detection-settings": "/app/protection-rules",
      billing: "/app/billing",
      setup: "/app/setup",
      "alerts-reports": "/app/settings?tab=general",
    };
    const path = pageToView[resolvedPage] || "/app";
    setPage(resolvedPage);
    navigate(path, { replace: false });
  };

  const polarisActions = {
    setPage: openPolarisPage,
    refresh: refreshBackendState,
    openThemeEditor,
    refreshSettings: loadSettings,
    refreshBilling: loadBillingStatus,
    refreshIncidents: () => loadIncidents(incidentFilters),
    setIncidentFilter: (key, value) =>
      setIncidentFilters((current) => ({ ...current, [key]: value })),
    saveSettings: (overrides) => persistProtectionSettings(overrides),
    pauseProtection: (minutes) =>
      persistProtectionSettings({
        protectionPausedUntil: new Date(
          Date.now() + minutes * 60 * 1000,
        ).toISOString(),
      }),
    resumeProtection: () =>
      persistProtectionSettings({ protectionPausedUntil: null }),
    runDiagnostic: async () => {
      const data = await runLiveScanRequest();
      const actionLabel = data.action ?? data.actionTaken ?? "unknown";
      setResult(`Diagnostic: ${data.threatLevel} risk, ${actionLabel}`);
      setLastScanTime(new Date().toLocaleTimeString());
      await refreshBackendState();
      return data;
    },
    runSimulation: async () => {
      const risks = ["low", "medium", "high"];
      const risk = risks[Math.floor(Math.random() * risks.length)];
      const data = await safeFetchJson("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ipAddress: `198.51.100.${Math.max(1, Math.floor(Math.random() * 254))}`,
          userAgent:
            risk === "high"
              ? "python-requests/2.32 BotShield-Simulation"
              : "HeadlessChrome BotShield-Simulation",
          pathVisited: risk === "high" ? "/account/login" : "/cart",
          source: "dashboard-simulation",
        }),
      });
      setResult(
        `Simulation: ${data.threatLevel || risk} risk, ${data.actionTaken || data.action}`,
      );
      setLastScanTime(new Date().toLocaleTimeString());
      await loadScans();
      return data;
    },
    recoverIncident: async (eventId, action) => {
      await safeFetchJson("/api/incident-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, action }),
      });
      await Promise.all([
        loadIncidents(incidentFilters),
        loadBlocklist(),
        loadWhitelist(),
        loadProtectionStatus(),
      ]);
    },
    addBlockedIp: async (ipAddress) => {
      await addBlockedIp(ipAddress, "Manual block from policy settings");
      await Promise.all([loadBlocklist(), loadProtectionStatus()]);
    },
    removeBlockedIp: async (ipAddress) => {
      await safeFetchJson("/api/blocklist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ipAddress }),
      });
      await Promise.all([loadBlocklist(), loadProtectionStatus()]);
    },
    addTrustedIp: async (ipAddress) => {
      await safeFetchJson("/api/whitelist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ipAddress,
          label: "Trusted visitor",
          notes: "Added from policy settings",
          active: true,
        }),
      });
      await Promise.all([loadWhitelist(), loadProtectionStatus()]);
    },
    removeTrustedIp: async (ipAddress) => {
      await safeFetchJson("/api/whitelist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ipAddress }),
      });
      await Promise.all([loadWhitelist(), loadProtectionStatus()]);
    },
    clearSimulationData: async () => {
      await safeFetchJson("/api/clear-test-data", { method: "POST" });
      await refreshBackendState();
    },
  };

  if (page !== "legacy") {
    return (
      <BotShieldAdminExperience
        model={polarisModel}
        actions={polarisActions}
      />
    );
  }

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
          display: "none",
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
          display: "none",
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
          display: "none",
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
      <div className="botshield-shell" style={{ display: "flex" }}>
        <div
          className="botshield-sidebar"
          style={{
            width: "220px",
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
          className="botshield-main"
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
            {primarySystemStatusItems.map((item) => (
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
              <div style={{ ...cardStyle, marginBottom: "20px", display: "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "20px", alignItems: "center", flexWrap: "wrap" }}>
                  <div>
                    <p style={statLabelStyle}>Security Readiness</p>
                    <h3 style={{ margin: "8px 0 0", color: theme.text, fontSize: "28px" }}>
                      {securityPosture ? `${securityPosture.score.score}/100` : "Loading"}
                    </h3>
                    <div style={{ color: theme.muted, marginTop: "6px" }}>
                      {securityPosture?.score?.grade || "Calculating from production status"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", maxWidth: "720px" }}>
                    {(securityPosture?.checklist || []).map((item) => (
                      <span
                        key={item.key}
                        style={{
                          border: `1px solid ${item.complete ? theme.accentSoft : theme.border}`,
                          background: item.complete ? theme.successBg : theme.surfaceAlt,
                          color: item.complete ? theme.successText : theme.muted,
                          padding: "7px 10px",
                          borderRadius: "999px",
                          fontSize: "12px",
                          fontWeight: 700,
                        }}
                      >
                        {item.complete ? "✓" : "○"} {item.label}
                      </span>
                    ))}
                  </div>
                </div>
                {securityPosture?.score?.suggestions?.length ? (
                  <div style={{ color: theme.muted, fontSize: "12px", marginTop: "12px" }}>
                    Next improvement: {securityPosture.score.suggestions[0]}
                  </div>
                ) : null}
              </div>
              <div style={{ ...cardStyle, marginBottom: "20px", display: "none" }}>
                <p style={statLabelStyle}>Next Step</p>
                <h3 style={{ margin: "8px 0 10px", color: theme.text, fontSize: "22px" }}>
                  {securityPosture?.score?.suggestions?.[0] ||
                    "BotShield is ready for storefront monitoring"}
                </h3>
                <div
                  style={{
                    marginTop: "10px",
                    padding: "12px 14px",
                    borderRadius: "14px",
                    background: theme.surfaceAlt,
                    border: `1px solid ${theme.border}`,
                    color: theme.muted,
                    fontSize: "12px",
                    lineHeight: 1.6,
                  }}
                >
                  Theme-embed protection monitors JavaScript-enabled storefront
                  sessions. Diagnostic scans remain separate from production
                  security metrics.
                </div>
                <div style={{ marginTop: "14px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <a href="/support" target="_blank" rel="noreferrer" style={getSecondaryButtonStyle()}>
                    Support
                  </a>
                  <a href="/privacy" target="_blank" rel="noreferrer" style={getSecondaryButtonStyle()}>
                    Privacy
                  </a>
                  <a href="/terms" target="_blank" rel="noreferrer" style={getSecondaryButtonStyle()}>
                    Terms
                  </a>
                  {!billingStatus?.active && billingStatus?.pricingUrl ? (
                    <a href={billingStatus.pricingUrl} target="_blank" rel="noreferrer" style={getPrimaryButtonStyle()}>
                      Choose Plan
                    </a>
                  ) : null}
                </div>
              </div>
              <div style={{ ...monoLabelStyle, marginBottom: "12px" }}>Overview</div>

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
                        <div style={{ ...monoLabelStyle, marginBottom: "8px" }}>Security Operations</div>
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
                          Verified storefront telemetry
                        </div>
                      </div>
                    </div>
                    <h1 style={{ ...displayHeadingStyle, margin: 0, fontSize: "38px", lineHeight: 1.04 }}>
                      {protectionReady
                        ? "Your storefront is protected"
                        : "Finish setup to activate protection"}
                    </h1>
                    <p style={{ margin: "12px 0 0 0", color: theme.muted, fontSize: "15px", lineHeight: 1.8, maxWidth: "720px" }}>
                      {protectionReady
                        ? "BotShield is evaluating real storefront traffic and applying your active protection policy."
                        : "Complete the remaining readiness steps, then BotShield can monitor and respond to storefront threats."}
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
                        background: protectionReady
                          ? theme.successBg
                          : theme.dangerBg,
                        color: protectionReady
                            ? theme.successText
                            : theme.dangerText,
                        padding: "9px 14px",
                        borderRadius: "999px",
                        fontWeight: 700,
                        fontSize: "12px",
                      }}
                    >
                      {!protectionStatus.themeEmbedDetected
                        ? "Protection pending setup"
                        : protectionPaused
                        ? `Protection paused ${pauseCountdown}m`
                        : protectionReady
                        ? "Protection active"
                        : "Protection disabled"}
                    </span>
                  </div>
                </div>
                <div style={{ color: theme.text, fontSize: "24px", fontWeight: 750, letterSpacing: "-0.035em", lineHeight: 1.25, marginTop: "22px", maxWidth: "900px" }}>
                  {blockedToday > 0
                    ? `${blockedToday} suspicious request${blockedToday === 1 ? "" : "s"} blocked today.`
                    : scansToday > 0
                    ? `${scansToday} real storefront request${scansToday === 1 ? "" : "s"} evaluated today.`
                    : protectionStatus.themeEmbedDetected
                      ? "Theme embed detected. Waiting for the first real storefront decision."
                      : "Protection pending setup: enable the BotShield theme app embed."}
                </div>
                <div style={{ color: theme.muted, fontSize: "14px", lineHeight: 1.8, marginTop: "12px", maxWidth: "880px" }}>
                  {percentHigh > 0
                    ? `${percentHigh}% of observed traffic has scored high risk. The current operating mode is ${strictMode ? "strict enforcement" : `${blockLevel.toLowerCase()} policy enforcement`}, with ${recentBlocks} recent block${recentBlocks === 1 ? "" : "s"} in the last hour.`
                    : "Live metrics will populate as storefront traffic is evaluated."}
                </div>
                <div className="botshield-metric-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px", marginTop: "20px" }}>
                  {merchantMetrics.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => handleDashboardSurfaceAction(item.actionKey)}
                      style={{
                        ...buttonBaseStyle,
                        padding: "14px 16px",
                        borderRadius: "14px",
                        border: `1px solid ${theme.border}`,
                        background: theme.surfaceAlt,
                        color: theme.text,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                      {...pressHandlers}
                    >
                      <div style={{ ...monoLabelStyle, marginBottom: "6px" }}>{item.label}</div>
                      <div style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "-0.025em" }}>{item.value}</div>
                      <div style={{ color: theme.muted, fontSize: "12px", lineHeight: 1.55, marginTop: "4px" }}>{item.detail}</div>
                    </button>
                  ))}
                </div>
                {securityPosture?.score?.suggestions?.[0] ? (
                  <div
                    style={{
                      marginTop: "14px",
                      padding: "12px 14px",
                      borderRadius: "12px",
                      background: theme.surfaceAlt,
                      border: `1px solid ${theme.border}`,
                      color: theme.muted,
                      fontSize: "13px",
                      lineHeight: 1.55,
                    }}
                  >
                    <strong style={{ color: theme.text }}>Next step:</strong>{" "}
                    {securityPosture.score.suggestions[0]}
                  </div>
                ) : null}
              </div>

              <div
                style={{
                  ...cardStyle,
                  padding: "20px",
                  borderRadius: "22px",
                  marginBottom: "14px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center", flexWrap: "wrap", marginBottom: "14px" }}>
                  <div>
                    <div style={{ ...monoLabelStyle, marginBottom: "6px" }}>Traffic intelligence</div>
                    <h2 style={{ ...displayHeadingStyle, margin: 0, fontSize: "24px" }}>Where storefront traffic is coming from</h2>
                    <p style={{ margin: "7px 0 0", color: theme.muted, fontSize: "12px", lineHeight: 1.6, maxWidth: "680px" }}>
                      Approximate city and country intelligence from real storefront requests. Simulations are excluded.
                    </p>
                  </div>
                  <span
                    style={{
                      padding: "7px 10px",
                      borderRadius: "999px",
                      background: protectionReady ? theme.successBg : theme.surfaceAlt,
                      border: `1px solid ${protectionReady ? theme.successText : theme.border}`,
                      color: protectionReady ? theme.successText : theme.text,
                      fontSize: "10px",
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    {protectionReady ? "Live intelligence" : "Awaiting setup"}
                  </span>
                </div>

                <div
                  className="botshield-location-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1.45fr) minmax(280px, 0.75fr)",
                    gap: "12px",
                    alignItems: "stretch",
                  }}
                >
                  <div
                    style={{
                      padding: "16px",
                      borderRadius: "18px",
                      background: theme.surfaceAlt,
                      border: `1px solid ${theme.border}`,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginBottom: "12px" }}>
                      <div style={monoLabelStyle}>Observed locations</div>
                      <span style={{ color: theme.muted, fontSize: "10px", fontWeight: 750 }}>
                        {geographyCoverage}% coverage
                      </span>
                    </div>
                    {trafficOrigins.length ? (
                      <div style={{ display: "grid", gap: "8px" }}>
                        {trafficOrigins.slice(0, 5).map((origin, index) => (
                          <div
                            key={origin.key}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: "12px",
                              alignItems: "center",
                              padding: "10px 11px",
                              borderRadius: "12px",
                              background: theme.surface,
                              border: `1px solid ${theme.border}`,
                            }}
                          >
                            <div style={{ display: "flex", gap: "9px", alignItems: "center", minWidth: 0 }}>
                              <span
                                style={{
                                  width: "30px",
                                  height: "30px",
                                  borderRadius: "10px",
                                  display: "grid",
                                  placeItems: "center",
                                  flexShrink: 0,
                                  color: origin.threatCount > 0 ? "#e11d48" : theme.accent,
                                  background: origin.threatCount > 0 ? "rgba(244,63,94,0.12)" : theme.accentSoft,
                                  fontSize: "11px",
                                  fontWeight: 850,
                                }}
                              >
                                {origin.countryCode || index + 1}
                              </span>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ color: theme.text, fontSize: "13px", fontWeight: 780, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {[origin.city, origin.country].filter(Boolean).join(", ")}
                                </div>
                                <div style={{ color: theme.muted, fontSize: "10px", marginTop: "3px" }}>
                                  {origin.threatCount > 0
                                    ? `${origin.threatCount} suspicious · highest risk ${origin.highestRiskScore}/100`
                                    : `${origin.allowed} allowed · no elevated signal`}
                                </div>
                              </div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <div style={{ color: theme.text, fontWeight: 850, fontSize: "14px" }}>{origin.count}</div>
                              <div style={{ color: theme.muted, fontSize: "9px", marginTop: "2px" }}>requests</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div
                        style={{
                          minHeight: "150px",
                          display: "grid",
                          placeItems: "center",
                          textAlign: "center",
                          padding: "20px",
                          borderRadius: "14px",
                          background: theme.surface,
                          border: `1px dashed ${theme.border}`,
                        }}
                      >
                        <div>
                          <div style={{ color: theme.text, fontSize: "13px", fontWeight: 800 }}>
                            No location intelligence yet
                          </div>
                          <div style={{ color: theme.muted, fontSize: "11px", lineHeight: 1.55, marginTop: "5px", maxWidth: "280px" }}>
                            BotShield will add city and country details as verified storefront requests arrive.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "grid", gap: "10px" }}>
                    {[
                      {
                        label: "Latest observed location",
                        value: latestGeolocatedEvent
                          ? [latestGeolocatedEvent.networkCity, latestGeolocatedEvent.networkCountry]
                              .filter(Boolean)
                              .join(", ")
                          : "Waiting for traffic",
                        detail: latestGeolocatedEvent?.createdAt
                          ? `Last seen ${new Date(latestGeolocatedEvent.createdAt).toLocaleString()}`
                          : "No verified location recorded yet",
                        tone: "neutral",
                      },
                      {
                        label: "Leading suspicious origin",
                        value: leadingThreatOrigin
                          ? [leadingThreatOrigin.city, leadingThreatOrigin.country]
                              .filter(Boolean)
                              .join(", ")
                          : "No elevated location",
                        detail: leadingThreatOrigin
                          ? `${leadingThreatOrigin.threatCount} suspicious · ${leadingThreatOrigin.blocked} blocked`
                          : "No location-based threat concentration detected",
                        tone: leadingThreatOrigin ? "danger" : "success",
                      },
                      {
                        label: "Verified response",
                        value: `${verifiedInterventions} intervention${verifiedInterventions === 1 ? "" : "s"}`,
                        detail: `${blockedCount} blocked · ${challengedCount} challenged · ${geolocatedCountryCount} countr${geolocatedCountryCount === 1 ? "y" : "ies"}`,
                        tone: verifiedInterventions > 0 ? "accent" : "neutral",
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        style={{
                          padding: "14px",
                          borderRadius: "16px",
                          background:
                            item.tone === "danger"
                              ? theme.dangerBg
                              : item.tone === "success"
                              ? theme.successBg
                              : theme.surfaceAlt,
                          border: `1px solid ${
                            item.tone === "danger"
                              ? theme.dangerText
                              : item.tone === "success"
                              ? theme.successText
                              : theme.border
                          }`,
                        }}
                      >
                        <div style={{ ...monoLabelStyle, fontSize: "9px" }}>{item.label}</div>
                        <div style={{ color: theme.text, fontSize: "15px", fontWeight: 820, marginTop: "7px", lineHeight: 1.35 }}>
                          {item.value}
                        </div>
                        <div style={{ color: theme.muted, fontSize: "10px", lineHeight: 1.5, marginTop: "4px" }}>
                          {item.detail}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: "12px", color: theme.muted, fontSize: "11px", lineHeight: 1.6 }}>
                  Locations are approximate and may identify a VPN, proxy, or hosting facility. Revenue savings stay hidden until verified commerce attribution can support a defensible figure.
                </div>
              </div>

              {dashboardSections.operations ? (
                <>
              <div
                style={{
                  background: theme.surface,
                  color: theme.text,
                  padding: "16px 18px",
                  borderRadius: "16px",
                  marginBottom: "20px",
                  transition: "all 0.2s ease",
                  border: `1px solid ${theme.border}`,
                  boxShadow: theme.softShadow,
                }}
              >
                <span style={monoLabelStyle}>Recommended action</span>
                <div style={{ marginTop: "8px", fontWeight: 750 }}>{recommendation}</div>

                {threatLevel !== "low" && (
                  <button
                    onClick={enableStrictMode}
                    style={{
                      marginLeft: "12px",
                      padding: "6px 12px",
                      background: theme.accentStrong,
                      color: "#ffffff",
                      border: `1px solid ${theme.accentStrong}`,
                      borderRadius: "10px",
                      cursor: "pointer",
                    }}
                  >
                    Enable Strict Mode
                  </button>
                )}

                <div style={{ marginTop: "10px", color: theme.muted, fontSize: "13px" }}>
                  Current posture: {strictMode ? "Strict Mode active" : `${blockLevel} protection active`}
                </div>

                <div style={{ marginTop: "6px", color: theme.muted, fontSize: "13px" }}>
                  Strict Mode: {strictMode ? "On" : "Off"}
                </div>
              </div>

              <div
                className="botshield-workspace-grid"
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
                    A cleaner operating view for policy state, verified storefront events, and setup confidence without forcing merchants into analyst-level detail.
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
                        background: protectionReady
                          ? theme.successBg
                          : theme.dangerBg,
                        color: protectionReady
                            ? theme.successText
                            : theme.dangerText,
                        padding: "8px 12px",
                        borderRadius: "12px",
                        fontWeight: 600,
                        fontSize: "13px",
                      }}
                    >
                      {!protectionStatus.themeEmbedDetected
                        ? "Protection Pending Setup"
                        : protectionPaused
                        ? `Paused ${pauseCountdown}m`
                        : protectionReady
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
                        Run Diagnostic Scan
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
                    Verified Protection Evidence
                  </p>
                  <h3 style={{ margin: "10px 0 0 0", fontSize: "22px", letterSpacing: "-0.04em" }}>Real Storefront Events</h3>
                  <p style={{ fontSize: "42px", fontWeight: "bold", margin: "14px 0 0 0", letterSpacing: "-0.06em" }}>
                    <AnimatedNumber value={storefrontScans.length} />
                  </p>
                  <p style={{ fontSize: "14px", color: theme.muted, marginTop: "10px", maxWidth: "420px", lineHeight: 1.7 }}>
                    Decisions received through the Shopify storefront app proxy.
                    Simulated dashboard traffic is excluded.
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
                </>
              ) : null}

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
                  <p style={statLabelStyle}>Storefront Evaluations</p>
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
                        Real storefront events only. Dashboard simulations are excluded.
                      </p>
                    </div>
                    <span style={{ color: theme.text, fontWeight: 700, fontSize: "13px" }}>{storefrontScans.length} events</span>
                  </div>
                  <div style={{ marginTop: "18px", display: "grid", gap: "14px" }}>
                    {[
                      { label: "Low risk", value: lowRiskCount, width: lowThreatWidth, color: "#22c55e" },
                      { label: "Medium risk", value: mediumRiskCount, width: mediumThreatWidth, color: "#f59e0b" },
                      { label: "High risk", value: highRiskCount, width: highThreatWidth, color: "#ef4444" },
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
                className="botshield-workspace-grid"
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
                    <div style={{ ...monoLabelStyle, marginBottom: "8px" }}>Workspace</div>
                    <div style={{ color: theme.text, fontWeight: 800, fontSize: "18px", letterSpacing: "-0.03em" }}>
                      Operations
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
                    <div style={{ ...monoLabelStyle, marginBottom: "8px" }}>Workspace</div>
                    <div style={{ color: theme.text, fontWeight: 800, fontSize: "18px", letterSpacing: "-0.03em" }}>
                      Incident review
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
                    <div style={{ ...monoLabelStyle, marginBottom: "8px" }}>Workspace</div>
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
                        background: protectionReady ? theme.successBg : theme.dangerBg,
                        color: protectionReady ? theme.successText : theme.dangerText,
                        fontSize: "12px",
                        fontWeight: 700,
                      }}
                    >
                      {protectionReady
                        ? "Active"
                        : protectionStatus.themeEmbedDetected
                          ? "Paused"
                          : "Setup Required"}
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
                        {protectionReady
                          ? "Active"
                          : protectionStatus.themeEmbedDetected
                            ? "Paused"
                            : "Embed Missing"}
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
                    Real storefront activity from the last seven days. Simulations are excluded.
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
                      <span style={{ color: theme.muted }}>Requests analyzed</span>
                      <strong style={{ color: theme.text }}>{securityPosture?.report?.requestsAnalyzed ?? 0}</strong>
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
                      <span style={{ color: theme.muted }}>Allowed / challenged</span>
                      <strong style={{ color: theme.text }}>
                        {securityPosture?.report?.allowed ?? 0} / {securityPosture?.report?.challenged ?? 0}
                      </strong>
                    </button>
                    <button
                      type="button"
                      onClick={(event) => { event.stopPropagation(); handleDashboardSurfaceAction("delta"); }}
                      style={interactiveCardButtonStyle({
                        padding: "14px 16px",
                        borderRadius: "18px",
                        background: (securityPosture?.report?.blocked || 0) > 0 ? theme.dangerBg : theme.successBg,
                        border: `1px solid ${theme.border}`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      })}
                    >
                      <span style={{ color: (securityPosture?.report?.blocked || 0) > 0 ? theme.dangerText : theme.successText }}>Blocked</span>
                      <strong style={{ color: (securityPosture?.report?.blocked || 0) > 0 ? theme.dangerText : theme.successText }}>
                        {securityPosture?.report?.blocked ?? 0}
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
                      {emailAlerts && emailProviderConfigured
                        ? "Delivery Enabled"
                        : emailProviderConfigured
                          ? "Delivery Disabled"
                          : "Provider Not Configured"}
                    </span>
                    <span style={getRiskBadgeStyle(highRiskAlertsOnly ? "balanced" : "normal")}>
                      Blocked · Challenged · High Risk
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
                    <div style={{ color: theme.muted, fontSize: "12px", lineHeight: 1.6 }}>
                      Last delivery: {lastAlertStatus || "No delivery attempted"}
                      {lastAlertSentAt
                        ? ` · ${new Date(lastAlertSentAt).toLocaleString()}`
                        : ""}
                    </div>
                    <button onClick={handleSaveSettings} style={getPrimaryButtonStyle()} {...pressHandlers}>
                      Apply Alert Profile
                    </button>
                    <button
                      type="button"
                      onClick={handleSendTestAlert}
                      disabled={!emailAlerts || !emailProviderConfigured}
                      style={{
                        ...getSecondaryButtonStyle(),
                        opacity: !emailAlerts || !emailProviderConfigured ? 0.55 : 1,
                        cursor: !emailAlerts || !emailProviderConfigured ? "not-allowed" : "pointer",
                      }}
                    >
                      Send Test Email
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
                        Run Diagnostic Scan
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
                  <p style={statLabelStyle}>Real Storefront Events</p>
                  <h2 style={statValueStyle}>
                    <AnimatedNumber value={storefrontScans.length} />
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
                    Diagnostic Simulations
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
                    Simulated Blocks
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
                      <span style={{ color: theme.text }}>{lowRiskCount}</span>
                    </div>
                    <div style={{ width: "100%", height: "12px", backgroundColor: theme.track, borderRadius: "999px", overflow: "hidden" }}>
                      <div style={{ width: lowThreatWidth, height: "100%", backgroundColor: "#22c55e", animation: "trendSweep 0.8s ease both", transformOrigin: "left center" }} />
                    </div>
                  </div>

                  <div style={{ marginBottom: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{ color: theme.text }}>Medium</span>
                      <span style={{ color: theme.text }}>{mediumRiskCount}</span>
                    </div>
                    <div style={{ width: "100%", height: "12px", backgroundColor: theme.track, borderRadius: "999px", overflow: "hidden" }}>
                      <div style={{ width: mediumThreatWidth, height: "100%", backgroundColor: "#f59e0b", animation: "trendSweep 0.8s ease both", transformOrigin: "left center" }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{ color: theme.text }}>High</span>
                      <span style={{ color: theme.text }}>{highRiskCount}</span>
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
                      <span style={{ color: theme.text }}>{allowedCount}</span>
                    </div>
                    <div style={{ width: "100%", height: "12px", backgroundColor: theme.track, borderRadius: "999px", overflow: "hidden" }}>
                      <div style={{ width: allowedActionWidth, height: "100%", backgroundColor: "#22c55e", animation: "trendSweep 0.8s ease both", transformOrigin: "left center" }} />
                    </div>
                  </div>

                  <div style={{ marginBottom: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{ color: theme.text }}>Blocked</span>
                      <span style={{ color: theme.text }}>{blockedCount}</span>
                    </div>
                    <div style={{ width: "100%", height: "12px", backgroundColor: theme.track, borderRadius: "999px", overflow: "hidden" }}>
                      <div style={{ width: blockedActionWidth, height: "100%", backgroundColor: "#ef4444", animation: "trendSweep 0.8s ease both", transformOrigin: "left center" }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{ color: theme.text }}>Whitelisted</span>
                      <span style={{ color: theme.text }}>{challengedCount + whitelistedCount}</span>
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
                        Run Diagnostic Scan
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
                        No real storefront events received yet. Enable the theme embed and visit the storefront. Test traffic is labeled as simulation.
                      </p>
                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                        <button onClick={handleBackendScan} style={getPrimaryButtonStyle()} {...pressHandlers}>
                          Run Diagnostic Scan
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
                          <th style={{ padding: "12px 10px", fontSize: "14px", color: theme.text }}>
                            Source
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
                            <td style={{ padding: "12px 10px", fontSize: "12px", color: theme.muted }}>
                              {scan.source === "storefront-proxy"
                                ? "STOREFRONT"
                                : "SIMULATION"}
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
              getSmallButtonStyle={getSmallButtonStyle}
              getRiskBadgeStyle={getRiskBadgeStyle}
              getActionBadgeStyle={getActionBadgeStyle}
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
              incidents={incidents}
              incidentCounts={incidentCounts}
              incidentFilters={incidentFilters}
              setIncidentFilters={setIncidentFilters}
              handleIncidentRecovery={handleIncidentRecovery}
              incidentLoading={incidentLoading}
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
              emailProviderConfigured={emailProviderConfigured}
              handleSendTestAlert={handleSendTestAlert}
              lastAlertStatus={lastAlertStatus}
              lastAlertSentAt={lastAlertSentAt}
              lastAlertError={lastAlertError}
              emailProviderStatus={emailProviderStatus}
              weeklyReportsEnabled={weeklyReportsEnabled}
              setWeeklyReportsEnabled={setWeeklyReportsEnabled}
              handleSendWeeklyReport={handleSendWeeklyReport}
              lastWeeklyReportStatus={lastWeeklyReportStatus}
              lastWeeklyReportAt={lastWeeklyReportAt}
              lastWeeklyReportError={lastWeeklyReportError}
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

          .botshield-main {
            min-width: 0;
          }

          @media (max-width: 980px) {
            .botshield-shell {
              display: block !important;
            }

            .botshield-sidebar {
              width: auto !important;
              min-height: auto !important;
              border-right: 0 !important;
              border-bottom: 1px solid ${theme.border} !important;
            }

            .botshield-main {
              padding: 18px !important;
            }

            .botshield-metric-grid,
            .botshield-workspace-grid,
            .botshield-location-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }
          }

          @media (max-width: 640px) {
            .botshield-metric-grid,
            .botshield-workspace-grid,
            .botshield-location-grid {
              grid-template-columns: 1fr !important;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              scroll-behavior: auto !important;
            }
          }
        `}
      </style>
    </div>
  );
}
