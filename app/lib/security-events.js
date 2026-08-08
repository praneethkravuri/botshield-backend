export function extractReasonCodes(reasonSummary = "") {
  return [...String(reasonSummary).matchAll(/\[([A-Z0-9_]+)\]/g)].map(
    (match) => match[1],
  );
}

export function stripReasonCodes(reasonSummary = "") {
  return String(reasonSummary)
    .replace(/\[[A-Z0-9_]+\]\s*\|?\s*/g, "")
    .trim();
}

export function maskIpAddress(ipAddress = "") {
  const value = String(ipAddress).trim();
  if (!value) return "Unknown";

  if (value.includes(":")) {
    const segments = value.split(":");
    return `${segments.slice(0, 3).join(":")}:…:${segments.at(-1) || ""}`;
  }

  const octets = value.split(".");
  if (octets.length === 4) {
    return `${octets[0]}.${octets[1]}.xxx.${octets[3]}`;
  }

  return value;
}

export function serializeSecurityEvent(event) {
  return {
    id: event.id,
    ipAddress: event.ipAddress,
    maskedIpAddress: maskIpAddress(event.ipAddress),
    threatLevel: event.threatLevel,
    decision: event.action,
    path: event.path || "/",
    riskScore: event.riskScore || 0,
    reasonCodes: extractReasonCodes(event.reasonSummary),
    reasonSummary: stripReasonCodes(event.reasonSummary),
    source: event.source || "local-engine",
    networkAsn: event.networkAsn || null,
    networkOrg: event.networkOrg || "",
    networkType: event.networkType || "",
    networkProvider: event.networkProvider || "",
    networkCountry: event.networkCountry || "",
    networkCountryCode: event.networkCountryCode || "",
    networkCity: event.networkCity || "",
    networkLatitude: event.networkLatitude ?? null,
    networkLongitude: event.networkLongitude ?? null,
    createdAt: event.createdAt,
  };
}

export function matchesIncidentFilters(event, filters = {}) {
  if (filters.source && filters.source !== "all") {
    const isReal = event.source === "storefront-proxy";
    if (filters.source === "real" && !isReal) return false;
    if (filters.source === "simulation" && isReal) return false;
  }

  if (filters.decision && filters.decision !== "all") {
    const allowedMatch =
      filters.decision === "allowed" &&
      ["allowed", "whitelisted"].includes(event.decision);
    if (!allowedMatch && event.decision !== filters.decision) return false;
  }

  if (
    filters.risk &&
    filters.risk !== "all" &&
    event.threatLevel !== filters.risk
  ) {
    return false;
  }

  const search = String(filters.search || "").trim().toLowerCase();
  if (!search) return true;

  return [
    event.maskedIpAddress,
    event.ipAddress,
    event.decision,
    event.threatLevel,
    event.path,
    event.reasonSummary,
    event.networkOrg,
    event.networkType,
    event.networkProvider,
    event.networkCountry,
    event.networkCountryCode,
    event.networkCity,
    ...(event.reasonCodes || []),
  ].some((value) => String(value || "").toLowerCase().includes(search));
}

export function isRecoverableBlockedIncident(event) {
  return (
    event?.source === "storefront-proxy" &&
    event?.decision === "blocked" &&
    Number.isInteger(Number(event?.id))
  );
}
