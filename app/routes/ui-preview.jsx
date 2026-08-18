import { useEffect, useMemo, useState } from "react";
import process from "node:process";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { redirect } from "react-router";
import BotShieldAdminExperience from "../components/admin/BotShieldAdminExperience";

export function loader() {
  return process.env.NODE_ENV === "production" ? redirect("/app") : null;
}

const now = Date.UTC(2026, 6, 7, 9, 0, 0);
const minutesAgo = (minutes) => new Date(now - minutes * 60 * 1000).toISOString();

const previewEvents = [
  {
    id: "preview-1",
    ipAddress: "72.181.45.152",
    maskedIpAddress: "72.181.xxx.152",
    path: "/collections/sale",
    pathVisited: "/collections/sale",
    decision: "blocked",
    actionTaken: "blocked",
    threatLevel: "high",
    source: "storefront",
    reasons: ["RATE_PATTERN", "DATACENTER_IP"],
    reasonCodes: ["RATE_PATTERN", "DATACENTER_IP"],
    networkCity: "Dallas",
    networkCountry: "United States",
    createdAt: minutesAgo(8),
  },
  {
    id: "preview-2",
    ipAddress: "203.0.113.44",
    maskedIpAddress: "203.0.xxx.44",
    path: "/products/bestseller",
    pathVisited: "/products/bestseller",
    decision: "challenged",
    actionTaken: "challenged",
    threatLevel: "medium",
    source: "storefront",
    reasons: ["SUSPICIOUS_USER_AGENT"],
    reasonCodes: ["SUSPICIOUS_USER_AGENT"],
    networkCity: "Chicago",
    networkCountry: "United States",
    createdAt: minutesAgo(22),
  },
  {
    id: "preview-3",
    ipAddress: "198.51.100.12",
    maskedIpAddress: "198.51.xxx.12",
    path: "/",
    pathVisited: "/",
    decision: "allowed",
    actionTaken: "allowed",
    threatLevel: "low",
    source: "storefront",
    reasons: ["HOSTING_PROVIDER"],
    reasonCodes: ["HOSTING_PROVIDER"],
    networkCity: "Irving",
    networkCountry: "United States",
    createdAt: minutesAgo(39),
  },
  {
    id: "preview-4",
    ipAddress: "192.0.2.81",
    maskedIpAddress: "192.0.xxx.81",
    path: "/cart",
    pathVisited: "/cart",
    decision: "allowed",
    actionTaken: "allowed",
    threatLevel: "low",
    source: "storefront",
    reasons: ["NO_SIGNIFICANT_RISK"],
    reasonCodes: ["NO_SIGNIFICANT_RISK"],
    networkCity: "Austin",
    networkCountry: "United States",
    createdAt: minutesAgo(58),
  },
  {
    id: "preview-5",
    ipAddress: "203.0.113.90",
    maskedIpAddress: "203.0.xxx.90",
    path: "/search?q=discount",
    pathVisited: "/search?q=discount",
    decision: "blocked",
    actionTaken: "blocked",
    threatLevel: "high",
    source: "storefront",
    reasons: ["BLOCKLIST_MATCH"],
    reasonCodes: ["BLOCKLIST_MATCH"],
    networkCity: "Phoenix",
    networkCountry: "United States",
    createdAt: minutesAgo(82),
  },
];

function buildReadinessItems(model) {
  const emailReady = model.emailProviderConfigured && model.emailAlerts;
  return [
    {
      label: "App installed",
      detail: "BotShield is installed and available in Shopify Admin.",
      complete: true,
    },
    {
      label: "Theme embed enabled",
      detail: "The storefront theme is connected.",
      complete: model.protectionStatus.themeEmbedDetected,
    },
    {
      label: "Storefront connected",
      detail: "Real storefront events are reaching BotShield.",
      complete: Boolean(model.protectionStatus.lastStorefrontDecisionAt),
    },
    {
      label: "Protection active",
      detail: "Auto Block is enabled and enforcement is not paused.",
      complete: model.autoBlock && !model.protectionPaused,
    },
    {
      label: "Alerts configured",
      detail: emailReady
        ? `Alerts are configured for ${model.alertEmail}.`
        : "Configure alert delivery before launch.",
      complete: emailReady,
    },
    {
      label: "Billing verified",
      detail: "BotShield Basic is active for preview.",
      complete: Boolean(model.billingStatus?.active),
    },
  ];
}

function getInitialPage() {
  if (typeof window === "undefined") return "dashboard";
  const view = new URL(window.location.href).searchParams.get("view");
  const aliases = {
    rules: "detection",
    visitors: "incidents",
    settings: "policy",
  };
  return aliases[view] || view || "dashboard";
}

function getPreviewBillingStatus() {
  const base = {
    configured: true,
    active: true,
    planName: "BotShield Basic",
    monthlyPrice: 14.99,
    trialDays: 7,
    enforcementEnabled: false,
    pricingUrl: "https://admin.shopify.com/store/preview/charges/botshield/pricing_plans",
    subscription: {
      name: "BotShield Basic",
      status: "ACTIVE",
      trial: true,
      trialEndsAt: new Date(now + 5 * 24 * 60 * 60 * 1000).toISOString(),
      currentPeriodEnd: new Date(now + 25 * 24 * 60 * 60 * 1000).toISOString(),
    },
  };

  if (typeof window === "undefined") return base;

  const variant = new URL(window.location.href).searchParams.get("billing");
  if (variant === "inactive") {
    return {
      ...base,
      active: false,
      subscription: null,
      error: null,
    };
  }
  if (variant === "test") {
    return {
      ...base,
      active: true,
      test: true,
      subscription: {
        name: "BotShield Reviewer Plan",
        status: "ACTIVE",
        test: true,
        currentPeriodEnd: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    };
  }
  if (variant === "unverified") {
    return {
      ...base,
      active: false,
      error: "Unable to verify Shopify subscription.",
      subscription: null,
    };
  }
  return base;
}

function getPreviewFraudConnected() {
  if (typeof window === "undefined") return false;
  return new URL(window.location.href).searchParams.get("connected") === "1";
}

const previewFraudOrders = [
  {
    id: "preview-order-1",
    name: "#1048",
    customer: "Jordan Lee",
    email: "jordan@example.com",
    amount: "$486.00",
    risk: "high",
    recommendation: "Investigate",
    reason: "Billing / shipping mismatch",
    secondarySignal: "Unusual order velocity",
    fulfillmentStatus: "Unfulfilled",
    financialStatus: "Paid",
    createdAt: minutesAgo(8),
    adminUrl: "#",
  },
  {
    id: "preview-order-2",
    name: "#1042",
    customer: "Morgan Patel",
    email: "morgan@example.com",
    amount: "$284.00",
    risk: "medium",
    recommendation: "Review",
    reason: "Elevated network signal",
    secondarySignal: "First-time high-value order",
    fulfillmentStatus: "Unfulfilled",
    financialStatus: "Authorized",
    createdAt: minutesAgo(42),
    adminUrl: "#",
  },
  {
    id: "preview-order-3",
    name: "#1031",
    customer: "Alex Rivera",
    email: "alex@example.com",
    amount: "$56.00",
    risk: "low",
    recommendation: "Accept",
    reason: "No elevated signals",
    fulfillmentStatus: "Fulfilled",
    financialStatus: "Paid",
    createdAt: minutesAgo(720),
    adminUrl: "#",
  },
];

export const headers = () => ({
  "X-Robots-Tag": "noindex, nofollow",
});

export default function UiPreview() {
  const [page, setPage] = useState(() => getInitialPage());
  const [blockedIPs, setBlockedIPs] = useState(["203.0.113.90"]);
  const [whitelist, setWhitelist] = useState(["198.51.100.25"]);
  const [settings, setSettings] = useState({
    autoBlock: true,
    strictMode: false,
    blockLevel: "Medium",
    protectionPaused: false,
    alertEmail: "owner@example.com",
    emailAlerts: true,
    highRiskAlertsOnly: false,
    weeklyReportsEnabled: true,
  });
  const [incidentFilters, setIncidentFilters] = useState({
    source: "real",
    decision: "all",
    risk: "all",
    search: "",
  });

  useEffect(() => {
    const syncPage = () => setPage(getInitialPage());
    syncPage();
    window.addEventListener("popstate", syncPage);
    return () => window.removeEventListener("popstate", syncPage);
  }, []);

  const model = useMemo(() => {
    const filteredIncidents = previewEvents.filter((event) => {
      if (
        incidentFilters.decision !== "all" &&
        event.decision !== incidentFilters.decision
      ) {
        return false;
      }
      if (
        incidentFilters.risk !== "all" &&
        event.threatLevel !== incidentFilters.risk
      ) {
        return false;
      }
      if (incidentFilters.search) {
        const haystack = [
          event.maskedIpAddress,
          event.path,
          event.networkCity,
          event.networkCountry,
          ...(event.reasonCodes || []),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(incidentFilters.search.toLowerCase());
      }
      return true;
    });

    const base = {
      page,
      protectionReady: true,
      protectionPaused: settings.protectionPaused,
      autoBlock: settings.autoBlock,
      strictMode: settings.strictMode,
      blockLevel: settings.blockLevel,
      result: "Preview mode ready",
      lastScanTime: "Preview data",
      alertEmail: settings.alertEmail,
      emailAlerts: settings.emailAlerts,
      highRiskAlertsOnly: settings.highRiskAlertsOnly,
      weeklyReportsEnabled: settings.weeklyReportsEnabled,
      emailProviderConfigured: true,
      lastAlertStatus: "sent",
      lastAlertSentAt: minutesAgo(8),
      lastWeeklyReportStatus: "sent",
      lastWeeklyReportAt: minutesAgo(180),
      lastAlertError: "",
      lastWeeklyReportError: "",
      blockedIPs,
      whitelist,
      storefrontScans: previewEvents,
      simulatedScans: [],
      incidents: filteredIncidents,
      incidentLoading: false,
      incidentFilters,
      incidentCounts: {
        total: previewEvents.length,
        real: previewEvents.length,
        simulation: 0,
        blocked: previewEvents.filter((event) => event.decision === "blocked").length,
        challenged: previewEvents.filter(
          (event) => event.decision === "challenged",
        ).length,
        allowed: previewEvents.filter((event) => event.decision === "allowed").length,
        highRisk: previewEvents.filter((event) => event.threatLevel === "high").length,
        periodDays: 30,
      },
      allowedCount: previewEvents.filter((event) => event.decision === "allowed")
        .length,
      blockedCount: previewEvents.filter((event) => event.decision === "blocked")
        .length,
      challengedCount: previewEvents.filter(
        (event) => event.decision === "challenged",
      ).length,
      trafficOrigins: [
        { city: "Dallas", country: "United States", count: 2 },
        { city: "Chicago", country: "United States", count: 1 },
        { city: "Irving", country: "United States", count: 1 },
        { city: "Austin", country: "United States", count: 1 },
      ],
      fraudOrderAccessConnected: getPreviewFraudConnected(),
      fraudOrders: getPreviewFraudConnected() ? previewFraudOrders : [],
      fraudOrderFilterEnabled: false,
      protectionStatus: {
        appInstalled: true,
        themeEmbedDetected: true,
        protectionActive: true,
        protectionPaused: settings.protectionPaused,
        policyReady: true,
        lastStorefrontDecisionAt: previewEvents[0].createdAt,
        blocklistCount: blockedIPs.length,
        whitelistCount: whitelist.length,
        realEventsToday: previewEvents.length,
      },
      securityPosture: {
        score: {
          score: 92,
          grade: "Launch ready preview",
          suggestions: [
            "Review blocked visitors weekly and keep alert delivery enabled.",
          ],
          factors: [
            { label: "Theme embed enabled", complete: true },
            { label: "Storefront traffic received", complete: true },
            { label: "Alerts configured", complete: true },
            { label: "Auto Block enabled", complete: settings.autoBlock },
          ],
        },
        report: {
          topReasonCodes: [
            { label: "RATE_PATTERN", count: 2 },
            { label: "DATACENTER_IP", count: 1 },
            { label: "SUSPICIOUS_USER_AGENT", count: 1 },
          ],
        },
      },
      billingStatus: getPreviewBillingStatus(),
    };

    return {
      ...base,
      readinessItems: buildReadinessItems(base),
    };
  }, [blockedIPs, incidentFilters, page, settings, whitelist]);

  const navigatePreview = (nextPage) => {
    setPage(nextPage);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("view", nextPage);
      window.history.pushState({}, "", url.toString());
      window.scrollTo(0, 0);
    }
  };

  const actions = {
    setPage: navigatePreview,
    refresh: async () => {},
    refreshSettings: async () => {},
    refreshBilling: async () => {},
    refreshIncidents: async () => {},
    clearSimulationData: async () => {},
    openThemeEditor: () => navigatePreview("dashboard"),
    saveSettings: async (nextSettings) => {
      setSettings((current) => ({ ...current, ...nextSettings }));
    },
    addBlockedIp: async (ip) => {
      if (!ip) return;
      setBlockedIPs((current) => (current.includes(ip) ? current : [ip, ...current]));
    },
    removeBlockedIp: async (ip) => {
      setBlockedIPs((current) => current.filter((item) => item !== ip));
    },
    addTrustedIp: async (ip) => {
      if (!ip) return;
      setWhitelist((current) => (current.includes(ip) ? current : [ip, ...current]));
    },
    removeTrustedIp: async (ip) => {
      setWhitelist((current) => current.filter((item) => item !== ip));
    },
    recoverIncident: async (incidentId, action) => {
      const incident = previewEvents.find((event) => event.id === incidentId);
      if (!incident?.ipAddress) return;
      if (action === "whitelist") {
        setWhitelist((current) =>
          current.includes(incident.ipAddress)
            ? current
            : [incident.ipAddress, ...current],
        );
      }
      if (action === "unblock") {
        setBlockedIPs((current) =>
          current.filter((item) => item !== incident.ipAddress),
        );
      }
    },
    setIncidentFilter: (key, value) => {
      setIncidentFilters((current) => ({ ...current, [key]: value }));
    },
  };

  return (
    <AppProvider embedded={false}>
      <BotShieldAdminExperience model={model} actions={actions} />
    </AppProvider>
  );
}
