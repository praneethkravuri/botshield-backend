import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useMatches, useNavigate } from "react-router";
import { partitionSecurityEvents } from "../lib/event-classification";
import BotShieldAdminExperience from "../components/admin/BotShieldAdminExperience";
import { toMerchantErrorMessage } from "../lib/merchant-error-message";
import { safeFetchJson } from "../lib/safe-fetch";
import { readThemeAppEmbedStatus } from "../lib/theme-extension-status.client";
import {
  buildThemeEditorDeepLink,
  THEME_EMBED_CONNECTION_STATE,
} from "../lib/theme-extension-status.js";
import { BOTSHIELD_BASIC_MONTHLY_PRICE } from "../lib/billing-state.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getAppRouteData(matches) {
  return matches.find((match) => match.id === "routes/app")?.data || {};
}

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

export default function Index() {
  const location = useLocation();
  const navigate = useNavigate();
  const matches = useMatches();
  const appRouteData = getAppRouteData(matches);
  const shopifyApiKey =
    matches.find((match) => match.data?.apiKey)?.data?.apiKey || "";
  const [page, setPage] = useState(appRouteData.initialAdminPage ?? "dashboard");
  const [protectionEntryIntent, setProtectionEntryIntent] = useState(null);

  const [threatLevel, setThreatLevel] = useState("low");
  const [strictMode, setStrictMode] = useState(false);
  const [insight, setInsight] = useState("");
  const [recommendation, setRecommendation] = useState("");

  const [darkMode, setDarkMode] = useState(false);
  const [protectionOn, setProtectionOn] = useState(true);
  const [autoBlock, setAutoBlock] = useState(true);
  const [repeatedActivityEnabled, setRepeatedActivityEnabled] = useState(true);
  const [elevatedRateEnabled, setElevatedRateEnabled] = useState(true);
  const [burstTrafficEnabled, setBurstTrafficEnabled] = useState(true);
  const [repeatOffenderEnabled, setRepeatOffenderEnabled] = useState(true);
  const [pathScanningEnabled, setPathScanningEnabled] = useState(true);

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
  const [financialImpact, setFinancialImpact] = useState({
    status: "unavailable",
    periodDays: 30,
    currencyCode: null,
    totalAmountMinor: null,
    qualifyingOrderCount: 0,
    series: [],
    methodology: "",
    unavailableReason: "No verified financial impact data yet.",
  });
  const [overviewThreatActivity, setOverviewThreatActivity] = useState({
    periodDays: 90,
    days: [],
  });
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
    themeAppEmbedActive: false,
    themeAppEmbedConnectionState: THEME_EMBED_CONNECTION_STATE.UNAVAILABLE,
    themeAppEmbedStatus: "unavailable",
    storefrontReportingActive: false,
    lastStorefrontHeartbeatAt: null,
    lastStorefrontDecisionAt: null,
    protectionActive: false,
    protectionPaused: false,
    blocklistCount: 0,
    whitelistCount: 0,
    realEventsToday: 0,
  });
  const [notification, setNotification] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [analyticsRefreshing, setAnalyticsRefreshing] = useState(false);
  const [analyticsRefreshError, setAnalyticsRefreshError] = useState("");
  const analyticsRefreshInFlight = useRef(false);
  const [storeHealthRefreshing, setStoreHealthRefreshing] = useState(false);
  const [storeHealthRefreshError, setStoreHealthRefreshError] = useState("");
  const storeHealthRefreshInFlight = useRef(false);
  const [fraudOrderAccessConnected, setFraudOrderAccessConnected] = useState(false);
  const [fraudOrders, setFraudOrders] = useState([]);
  const [fraudOrdersLoading, setFraudOrdersLoading] = useState(false);
  const [fraudOrdersError, setFraudOrdersError] = useState(null);
  const [fraudOrdersErrorCode, setFraudOrdersErrorCode] = useState(null);
  const [fraudOrdersLastRefreshedAt, setFraudOrdersLastRefreshedAt] = useState(null);
  const fraudOrdersRefreshInFlight = useRef(false);
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
    protectionStatus.themeAppEmbedActive && protectionOn && !protectionPaused;

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

  const loadScans = async ({ bustCache = false, throwOnError = false } = {}) => {
    try {
      const url = bustCache
        ? `/api/scans?_=${Date.now()}`
        : "/api/scans";
      const res = await fetch(
        url,
        bustCache ? { cache: "no-store" } : undefined,
      );
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
          reasonCodes: Array.isArray(scan.reasonCodes) ? scan.reasonCodes : [],
          userAgent: scan.userAgent || "",
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
          networkProvider: scan.networkProvider || "",
          networkAsn: scan.networkAsn == null ? null : Number(scan.networkAsn),
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
      return nextScans;
    } catch (err) {
      console.error("Failed to load scans", err);
      recordBackendError("Activity", err);
      if (throwOnError) throw err;
      return null;
    }
  };

  const loadSettings = async ({ throwOnError = false } = {}) => {
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Settings could not be loaded.");
      const data = await res.json();
      const settings = data.settings || {};
      setAutoBlock(Boolean(settings.autoBlock));
      setStrictMode(Boolean(settings.strictMode));
      setBlockLevel(settings.blockLevel || "Medium");
      setRepeatedActivityEnabled(settings.repeatedActivityEnabled !== false);
      setElevatedRateEnabled(settings.elevatedRateEnabled !== false);
      setBurstTrafficEnabled(settings.burstTrafficEnabled !== false);
      setRepeatOffenderEnabled(settings.repeatOffenderEnabled !== false);
      setPathScanningEnabled(settings.pathScanningEnabled !== false);
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
      if (throwOnError) throw err;
    }
  };

  const loadProtectionStatus = async ({ throwOnError = false } = {}) => {
    try {
      const res = await fetch("/api/status");
      if (!res.ok) throw new Error("Protection status could not be loaded.");
      const data = await res.json();
      const status = data.status || {};
      setProtectionStatus((previous) => ({
        ...previous,
        ...status,
        themeAppEmbedActive: previous.themeAppEmbedActive,
        themeAppEmbedConnectionState: previous.themeAppEmbedConnectionState,
        themeAppEmbedStatus: previous.themeAppEmbedStatus,
      }));
      setPauseUntil(status.protectionPausedUntil || null);
      setProtectionOn(Boolean(status.protectionActive));
    } catch (err) {
      console.error("Failed to load protection status", err);
      recordBackendError("Protection status", err);
      if (throwOnError) throw err;
    }
  };

  const loadThemeExtensionStatus = async ({ throwOnError = false } = {}) => {
    try {
      const embedStatus = await readThemeAppEmbedStatus();
      setProtectionStatus((previous) => ({
        ...previous,
        ...embedStatus,
      }));
    } catch (err) {
      console.error("Failed to load theme extension status", err);
      recordBackendError("Theme app embed", err);
      if (throwOnError) throw err;
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

  const loadBillingStatus = async ({ throwOnError = false } = {}) => {
    try {
      const response = await fetch("/api/billing-status");
      if (!response.ok) throw new Error("Billing status could not be loaded.");
      const data = await response.json();
      setBillingStatus(data.billing || null);
    } catch (error) {
      console.error("Failed to load billing status", error);
      recordBackendError("Billing", error);
      if (throwOnError) throw error;
    }
  };

  const loadBlocklist = async ({ throwOnError = false } = {}) => {
    try {
      const res = await fetch("/api/blocklist");
      if (!res.ok) throw new Error("Blocklist could not be loaded.");
      const data = await res.json();
      const rows = data.blockedIps || [];
      setBlockedIPs(
        rows.map((row) => ({
          ip: row.ipAddress,
          risk: "High",
          time: row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "Unknown",
          action: row.active ? "Blocked" : "Allowed",
          reason: row.reason || "Manually blocked visitor",
          source: row.source || "BotShield",
          hits: Number(row.hits || 0),
          active: row.active !== false,
        })),
      );
    } catch (err) {
      console.error("Failed to load blocklist", err);
      recordBackendError("Blocklist", err);
      if (throwOnError) throw err;
    }
  };

  const loadWhitelist = async ({ throwOnError = false } = {}) => {
    try {
      const res = await fetch("/api/whitelist");
      if (!res.ok) throw new Error("Trusted visitors could not be loaded.");
      const data = await res.json();
      setWhitelist((data.whitelistIps || []).map((row) => row.ipAddress));
    } catch (err) {
      console.error("Failed to load whitelist", err);
      recordBackendError("Trusted visitors", err);
      if (throwOnError) throw err;
    }
  };

  const loadIncidents = async (
    filters = incidentFilters,
    { throwOnError = false } = {},
  ) => {
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
      if (throwOnError) throw error;
    } finally {
      if (requestId === incidentRequestId.current) setIncidentLoading(false);
    }
  };

  const loadFinancialImpact = async ({ throwOnError = false } = {}) => {
    try {
      const response = await fetch("/api/financial-impact");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Financial impact could not be loaded.");
      setFinancialImpact(data.impact || {
        status: "unavailable",
        periodDays: 30,
        currencyCode: null,
        totalAmountMinor: null,
        qualifyingOrderCount: 0,
        series: [],
        methodology: "",
        unavailableReason: "No verified financial impact data yet.",
      });
    } catch (error) {
      console.error("Failed to load financial impact", error);
      recordBackendError("Financial impact", error);
      if (throwOnError) throw error;
    }
  };

  const loadOverviewThreatActivity = async ({ throwOnError = false } = {}) => {
    try {
      const response = await fetch("/api/overview-threat-activity");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Threat activity could not be loaded.");
      setOverviewThreatActivity({
        periodDays: Number(data.periodDays || 90),
        days: Array.isArray(data.days) ? data.days : [],
      });
    } catch (error) {
      console.error("Failed to load Overview threat activity", error);
      recordBackendError("Threat activity", error);
      if (throwOnError) throw error;
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
    const detail = toMerchantErrorMessage(error, "Couldn't load this data.");
    setBackendErrors((current) =>
      current.includes(detail) ? current : [...current, detail],
    );
  };

  const loadFraudOrderAccess = async ({ throwOnError = false } = {}) => {
    try {
      const response = await fetch("/api/fraud-order-access", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Couldn't load order access status.");
      }
      const data = await response.json();
      setFraudOrderAccessConnected(Boolean(data.connected));
    } catch (error) {
      setFraudOrderAccessConnected(false);
      recordBackendError("Order access", error);
      if (throwOnError) throw error;
    }
  };

  const loadFraudOrders = async () => {
    if (fraudOrdersRefreshInFlight.current) return;
    fraudOrdersRefreshInFlight.current = true;
    setFraudOrdersLoading(true);
    setFraudOrdersError(null);
    setFraudOrdersErrorCode(null);
    try {
      const response = await fetch("/api/fraud-orders", { cache: "no-store" });
      const data = await response.json();
      setFraudOrderAccessConnected(Boolean(data.connected));

      if (!data.connected) {
        setFraudOrders([]);
        return;
      }

      setFraudOrders(Array.isArray(data.orders) ? data.orders : []);
      if (data.error) {
        setFraudOrdersError(data.error);
        setFraudOrdersErrorCode(data.errorCode || null);
      } else {
        setFraudOrdersLastRefreshedAt(new Date().toISOString());
      }
    } catch (error) {
      setFraudOrders([]);
      setFraudOrdersError(
        toMerchantErrorMessage(error, "Couldn't refresh orders."),
      );
      setFraudOrdersErrorCode("fetch_failed");
    } finally {
      fraudOrdersRefreshInFlight.current = false;
      setFraudOrdersLoading(false);
    }
  };

  const refreshFraudOrderConnection = async () => {
    await loadFraudOrderAccess();
    await loadFraudOrders();
  };

  const loadBackendState = async ({ throwOnError = false } = {}) => {
    await Promise.all([
      loadScans({ throwOnError }),
      loadSettings({ throwOnError }),
      loadBlocklist({ throwOnError }),
      loadWhitelist({ throwOnError }),
      loadProtectionStatus({ throwOnError }),
      loadThemeExtensionStatus({ throwOnError }),
      loadIncidents(incidentFilters, { throwOnError }),
      loadBillingStatus({ throwOnError }),
      loadFinancialImpact({ throwOnError }),
      loadOverviewThreatActivity({ throwOnError }),
      loadFraudOrderAccess({ throwOnError }),
    ]);
  };

  const refreshBackendState = async ({ throwOnError = false } = {}) => {
    setSyncing(true);
    setBackendErrors([]);
    try {
      await loadBackendState({ throwOnError });
      setLastSyncedAt(new Date().toLocaleTimeString());
    } catch (error) {
      if (throwOnError) throw error;
    } finally {
      setSyncing(false);
    }
  };

  const refreshApplicationStatus = () => refreshBackendState({ throwOnError: true });

  const refreshAnalytics = async () => {
    if (analyticsRefreshInFlight.current) return;
    analyticsRefreshInFlight.current = true;
    setAnalyticsRefreshing(true);
    setAnalyticsRefreshError("");
    try {
      await loadScans({ bustCache: true, throwOnError: true });
      setLastSyncedAt(new Date().toLocaleTimeString());
    } catch (error) {
      setAnalyticsRefreshError(
        toMerchantErrorMessage(error, "Couldn't refresh analytics."),
      );
    } finally {
      analyticsRefreshInFlight.current = false;
      setAnalyticsRefreshing(false);
    }
  };

  const refreshStoreHealth = async () => {
    if (storeHealthRefreshInFlight.current) {
      return { ok: false, skipped: true };
    }
    storeHealthRefreshInFlight.current = true;
    setStoreHealthRefreshing(true);
    setStoreHealthRefreshError("");
    try {
      await loadThemeExtensionStatus({ throwOnError: true });
      await loadProtectionStatus({ throwOnError: true });
      await loadSettings();
      await loadOverviewThreatActivity({ throwOnError: true });
      setLastSyncedAt(new Date().toLocaleTimeString());
      return { ok: true };
    } catch (error) {
      const message = toMerchantErrorMessage(
        error,
        "Couldn't refresh store health.",
      );
      setStoreHealthRefreshError(message);
      return { ok: false, error: message };
    } finally {
      storeHealthRefreshInFlight.current = false;
      setStoreHealthRefreshing(false);
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
      repeatedActivityEnabled,
      elevatedRateEnabled,
      burstTrafficEnabled,
      repeatOffenderEnabled,
      pathScanningEnabled,
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
    setRepeatedActivityEnabled(settings.repeatedActivityEnabled !== false);
    setElevatedRateEnabled(settings.elevatedRateEnabled !== false);
    setBurstTrafficEnabled(settings.burstTrafficEnabled !== false);
    setRepeatOffenderEnabled(settings.repeatOffenderEnabled !== false);
    setPathScanningEnabled(settings.pathScanningEnabled !== false);
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
      triggerAlert("Email delivery isn't configured. Contact your administrator or support.");
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
          !protectionStatus.themeAppEmbedActive &&
          protectionStatus.shop
        ) {
          const themeEditorUrl = buildThemeEditorDeepLink(
            protectionStatus.shop,
            shopifyApiKey,
          );
          if (!themeEditorUrl) {
            triggerAlert(
              "The Shopify app key is not available yet. Refresh BotShield and try again.",
            );
            break;
          }
          window.open(themeEditorUrl, "_blank", "noopener,noreferrer");
          triggerAlert(
            "Shopify theme app embeds opened. Enable BotShield and click Save.",
          );
          break;
        }
        await refreshBackendState();
        triggerAlert("Application data refreshed.");
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
      triggerAlert("Couldn't generate test traffic.");
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
      detection: "security",
      "detection-settings": "security",
      visitors: "analytics",
      "fraud-orders": "fraud-orders",
      activity: "analytics",
      incidents: "analytics",
      blocklist: "security",
      trusted: "security",
      "trusted-visitors": "security",
      policy: "settings",
      "alerts-reports": "settings",
      settings: "settings",
      billing: "settings",
      setup: "dashboard",
    };
    const pathPageMap = {
      "/app": "dashboard",
      "/app/analytics": "analytics",
      "/app/protection-rules": "security",
      "/app/fraud-orders": "fraud-orders",
      "/app/settings": "settings",
    };
    const legacyViewPathMap = {
      dashboard: "/app",
      analytics: "/app/analytics",
      rules: "/app/protection-rules",
      "protection-rules": "/app/protection-rules",
      detection: "/app/protection-rules",
      "detection-settings": "/app/protection-rules",
      visitors: "/app/analytics",
      "fraud-orders": "/app/fraud-orders",
      activity: "/app/analytics",
      incidents: "/app/analytics",
      blocklist: "/app/protection-rules",
      trusted: "/app/protection-rules",
      "trusted-visitors": "/app/protection-rules",
      policy: "/app/settings",
      "alerts-reports": "/app/settings?section=notifications",
      settings: "/app/settings",
      billing: "/app/settings?section=billing",
      setup: "/app",
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

  const skipIncidentFilterFetch = useRef(true);

  useEffect(() => {
    refreshBackendState();
  }, []);

  useEffect(() => {
    if (page !== "fraud-orders") return undefined;
    loadFraudOrders();
    return undefined;
  }, [page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (skipIncidentFilterFetch.current) {
        skipIncidentFilterFetch.current = false;
        return;
      }
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
    repeatedActivityEnabled,
    elevatedRateEnabled,
    burstTrafficEnabled,
    repeatOffenderEnabled,
    pathScanningEnabled,
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
            status: protectionStatus.themeAppEmbedActive ? "Connected" : "Setup",
            message: protectionStatus.themeAppEmbedActive
              ? "Theme app embed is active on the published theme"
              : "Enable the BotShield theme app embed in the theme editor",
          },
          {
            status: protectionStatus.storefrontReportingActive ? "Live" : "Waiting",
            message: protectionStatus.storefrontReportingActive
              ? "Recent storefront heartbeat detected"
              : "No recent storefront heartbeat",
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
      label: protectionStatus.themeAppEmbedActive
        ? "Theme embed connected"
        : "Theme embed not connected",
      active: protectionStatus.themeAppEmbedActive,
      detail: protectionStatus.themeAppEmbedStatus
        ? `Shopify status: ${protectionStatus.themeAppEmbedStatus}`
        : "enable the app embed to start protection",
      actionKey: "runtime",
    },
    {
      label: protectionStatus.storefrontReportingActive
        ? "Storefront traffic active"
        : "Storefront traffic quiet",
      active: protectionStatus.storefrontReportingActive,
      detail: protectionStatus.lastStorefrontHeartbeatAt
        ? `last heartbeat ${new Date(protectionStatus.lastStorefrontHeartbeatAt).toLocaleTimeString()}`
        : "waiting for storefront heartbeat",
      actionKey: "runtime",
    },
    {
      label: protectionPaused ? "Protection paused" : "Protection policy ready",
      active: protectionStatus.themeAppEmbedActive && !protectionPaused,
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
              billingStatus.monthlyPrice || BOTSHIELD_BASIC_MONTHLY_PRICE,
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
      value: securityPosture?.score?.score != null
        ? `${securityPosture.score.score}/100`
        : "—",
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
      complete: Boolean(protectionStatus.themeAppEmbedActive),
      detail: protectionStatus.themeAppEmbedActive
        ? "BotShield is enabled in the published theme."
        : "Enable BotShield in the Shopify theme editor.",
    },
    {
      label: "Storefront traffic received",
      complete: Boolean(protectionStatus.storefrontReportingActive),
      detail: protectionStatus.storefrontReportingActive
        ? "Recent storefront heartbeat detected."
        : "Visit the storefront after enabling the theme embed.",
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
        : "Set up email delivery before alerts can send.",
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
    const themeEditorUrl = buildThemeEditorDeepLink(
      protectionStatus.shop,
      shopifyApiKey,
    );
    if (!themeEditorUrl) {
      triggerAlert(
        "The Shopify app key is not available yet. Refresh BotShield and try again.",
      );
      return;
    }
    window.open(themeEditorUrl, "_blank", "noopener,noreferrer");
  };

  const polarisModel = {
    page,
    initialSettingsSection: appRouteData.initialSettingsSection ?? "general",
    protectionStatus,
    protectionPaused,
    protectionReady,
    autoBlock,
    strictMode,
    blockLevel,
    repeatedActivityEnabled,
    elevatedRateEnabled,
    burstTrafficEnabled,
    repeatOffenderEnabled,
    pathScanningEnabled,
    storefrontScans,
    simulatedScans,
    allowedCount,
    challengedCount,
    blockedCount,
    highRiskCount,
    securityPosture,
    billingStatus,
    financialImpact,
    overviewThreatActivity,
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
    analyticsRefreshing,
    analyticsRefreshError,
    storeHealthRefreshing,
    storeHealthRefreshError,
    readinessItems: polarisReadinessItems,
    fraudOrderAccessConnected,
    fraudOrders,
    fraudOrdersLoading,
    fraudOrdersError,
    fraudOrdersErrorCode,
    fraudOrdersLastRefreshedAt,
    protectionEntryIntent,
  };

  const openPolarisPage = (nextPage) => {
    const retiredPageMap = {
      visitors: "analytics",
      activity: "analytics",
      incidents: "analytics",
      blocklist: "security",
      trusted: "security",
      "trusted-visitors": "security",
      "alerts-reports": "settings",
      policy: "settings",
      billing: "settings",
      setup: "dashboard",
      "detection-settings": "security",
      detection: "security",
      rules: "security",
      "protection-rules": "security",
    };
    const resolvedPage = retiredPageMap[nextPage] || nextPage;
    const pageToView = {
      dashboard: "/app",
      analytics: "/app/analytics",
      security: "/app/protection-rules",
      "fraud-orders": "/app/fraud-orders",
      settings: "/app/settings",
    };
    let path = pageToView[resolvedPage] || "/app";
    if (nextPage === "billing") {
      path = "/app/settings?section=billing";
    } else if (nextPage === "alerts-reports") {
      path = "/app/settings?section=notifications";
    }
    setPage(resolvedPage);
    navigate(path, { replace: false });
  };

  const polarisActions = {
    setPage: openPolarisPage,
    openBlocklist: () => {
      setProtectionEntryIntent("blocklist");
      openPolarisPage("detection");
    },
    openTrustedVisitors: () => {
      setProtectionEntryIntent("trusted");
      openPolarisPage("detection");
    },
    openProtectionModule: (module) => {
      setProtectionEntryIntent(module);
      openPolarisPage("detection");
    },
    clearProtectionEntryIntent: () => setProtectionEntryIntent(null),
    refresh: refreshBackendState,
    refreshApplicationStatus,
    refreshFraudOrderAccess: refreshFraudOrderConnection,
    refreshFraudOrders: loadFraudOrders,
    refreshAnalytics,
    refreshStoreHealth,
    clearAnalyticsRefreshError: () => setAnalyticsRefreshError(""),
    clearStoreHealthRefreshError: () => setStoreHealthRefreshError(""),
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
      const data = await safeFetchJson("/api/diagnostic", { method: "POST" });
      await Promise.all([loadProtectionStatus(), loadSettings()]);
      return data.diagnostic;
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
      await refreshBackendState();
      return data;
    },
    recoverIncident: async (eventId, action) => {
      await safeFetchJson("/api/incident-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, action }),
      });
      await refreshBackendState();
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

  return (
    <BotShieldAdminExperience
      model={polarisModel}
      actions={polarisActions}
    />
  );
}
