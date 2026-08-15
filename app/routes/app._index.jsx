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

  return `Hereâ€™s the current picture: protection is ${
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
    background: blockLevel === l…62962 tokens truncated…SecurityBlockAction={handleSecurityBlockAction}
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
                Ã—
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
                                <span style={{ color: "#38bdf8" }}>â€¢</span>
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

