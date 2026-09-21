export const SETTINGS_HUB_SECTION_IDS = [
  "general",
  "billing",
  "notifications",
  "reports",
  "connections",
  "privacy",
  "diagnostics",
  "danger",
];

export function resolveInitialAdminPage(pathname, search = "") {
  const requestedView = new URLSearchParams(search).get("view");
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

  if (requestedView && pageMap[requestedView]) {
    return pageMap[requestedView];
  }
  if (pathPageMap[pathname]) {
    return pathPageMap[pathname];
  }
  return "dashboard";
}

export function resolveInitialSettingsSection(search = "") {
  const section = new URLSearchParams(search).get("section");
  return SETTINGS_HUB_SECTION_IDS.includes(section) ? section : "general";
}
