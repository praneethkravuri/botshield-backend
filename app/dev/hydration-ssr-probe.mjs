/**
 * Vite-node integration probe: SSR render -> hydrateRoot for embedded Overview shell.
 * Run via: npx vite-node app/dev/hydration-ssr-probe.mjs
 */
import assert from "node:assert/strict";

const React = (await import("react")).default;
const { renderToString } = await import("react-dom/server");
const { JSDOM } = await import("jsdom");
const { AppProvider } = await import("@shopify/shopify-app-react-router/react");
const { default: BotShieldAdminExperience } = await import(
  "../components/admin/BotShieldAdminExperience.jsx"
);
const { default: BotShieldAppNavigation } = await import(
  "../components/BotShieldAppNavigation.jsx"
);

const HYDRATION_ERROR =
  /hydration|did not match|Expected server HTML|Text content|418|423|425/i;
const FIXED_ANCHOR_MS = Date.UTC(2026, 6, 7, 12, 0, 0);

function buildOverviewModel() {
  return {
    page: "dashboard",
    initialSettingsSection: "general",
    renderAnchorMs: FIXED_ANCHOR_MS,
    protectionReady: true,
    protectionPaused: false,
    autoBlock: true,
    strictMode: false,
    blockLevel: "Medium",
    alertEmail: "owner@example.com",
    emailAlerts: true,
    highRiskAlertsOnly: false,
    weeklyReportsEnabled: true,
    emailProviderConfigured: true,
    blockedIPs: [],
    whitelist: [],
    storefrontScans: [],
    simulatedScans: [],
    incidents: [],
    incidentLoading: false,
    incidentFilters: { source: "real", decision: "all", risk: "all", search: "" },
    incidentCounts: {
      total: 0,
      real: 0,
      simulation: 0,
      blocked: 0,
      challenged: 0,
      allowed: 0,
      highRisk: 0,
      periodDays: 30,
    },
    allowedCount: 0,
    blockedCount: 0,
    challengedCount: 0,
    fraudOrderAccessConnected: false,
    fraudOrders: [],
    fraudOrdersLoading: false,
    protectionStatus: {
      appInstalled: true,
      themeAppEmbedActive: true,
      themeAppEmbedConnectionState: "active",
      storefrontReportingActive: true,
      protectionActive: true,
      protectionPaused: false,
      lastStorefrontDecisionAt: null,
      blocklistCount: 0,
      whitelistCount: 0,
      realEventsToday: 0,
    },
    securityPosture: null,
    billingStatus: null,
    financialImpact: {
      status: "unavailable",
      periodDays: 30,
      qualifyingOrderCount: 0,
      series: [],
      methodology: "",
      unavailableReason: "No verified financial impact data yet.",
    },
    overviewThreatActivity: { periodDays: 90, days: [] },
    backendErrors: [],
    syncing: false,
    storeHealthRefreshing: false,
    storeHealthRefreshError: "",
    protectionEntryIntent: null,
  };
}

const { MemoryRouter } = await import("react-router");

function embeddedOverviewTree() {
  return React.createElement(
    MemoryRouter,
    { initialEntries: ["/app"] },
    React.createElement(
      AppProvider,
      { embedded: true, apiKey: "test-api-key" },
      React.createElement(BotShieldAppNavigation),
      React.createElement(BotShieldAdminExperience, {
        model: buildOverviewModel(),
        actions: {},
      }),
    ),
  );
}

const tree = embeddedOverviewTree();
const serverHtml = renderToString(tree);
const serverHtmlRepeat = renderToString(tree);

assert.equal(
  serverHtml,
  serverHtmlRepeat,
  "Overview SSR output should be deterministic",
);
assert.doesNotMatch(
  serverHtml,
  /<s-stack|<s-box|<s-grid|<s-page/,
  "layout hosts should not SSR legacy polaris container tags",
);
assert.doesNotMatch(
  serverHtml,
  /<s-button|<s-badge|<s-text|<s-app-nav|<s-link/,
  "SSR-visible overview markup should not include polaris leaf tags",
);
assert.match(serverHtml, /botshield-layout-stack/);
assert.match(serverHtml, /botshield-native-page/);
assert.match(serverHtml, /botshield-polaris-button/);

process.env.NODE_ENV = "development";
const { hydrateRoot } = await import("react-dom/client");
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
  url: "https://example.test/app",
});
const container = dom.window.document.createElement("div");
container.innerHTML = serverHtml;
dom.window.document.body.appendChild(container);

const messages = [];
const originalError = console.error;
console.error = (...args) => {
  messages.push(
    args
      .map((arg) => (typeof arg === "string" ? arg : arg?.message || String(arg)))
      .join(" "),
  );
  originalError(...args);
};

globalThis.window = dom.window;
globalThis.document = dom.window.document;

try {
  hydrateRoot(container, tree);
} finally {
  console.error = originalError;
}

const hits = messages.filter((message) => HYDRATION_ERROR.test(message));
assert.equal(
  hits.length,
  0,
  `embedded Overview SSR tree should hydrate cleanly, got: ${hits.join(" | ")}`,
);

console.log("hydration-ssr-probe: embedded Overview hydrated cleanly");
process.exit(0);
