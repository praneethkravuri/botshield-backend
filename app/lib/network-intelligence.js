export function normalizeNetworkIntel(payload = {}) {
  const location = payload.location || payload.geo || {};
  const asn = Number(payload.asn?.asn);
  const organization =
    payload.asn?.org || payload.company?.name || payload.datacenter?.datacenter || "";
  const networkType = payload.asn?.type || payload.company?.type || "";
  const provider =
    payload.datacenter?.datacenter ||
    payload.company?.name ||
    payload.asn?.org ||
    "";
  const latitude = Number(
    location.latitude ?? location.lat ?? payload.latitude ?? payload.lat,
  );
  const longitude = Number(
    location.longitude ?? location.lon ?? payload.longitude ?? payload.lon,
  );

  return {
    asn: Number.isInteger(asn) ? asn : null,
    organization: String(organization || ""),
    networkType: String(networkType || ""),
    provider: String(provider || ""),
    country: String(
      location.country || payload.country || payload.country_name || "",
    ),
    countryCode: String(
      location.country_code ||
        location.countryCode ||
        payload.country_code ||
        payload.countryCode ||
        "",
    ).toUpperCase(),
    city: String(location.city || payload.city || ""),
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    isVpn: payload.is_vpn === true,
    isProxy: payload.is_proxy === true,
    isDatacenter: payload.is_datacenter === true,
    isTor: payload.is_tor === true,
    isAbuser: payload.is_abuser === true,
  };
}

export function getNetworkIntelSignals(intel) {
  if (!intel) return { score: 0, reasons: [], reasonCodes: [] };

  let score = 0;
  const reasons = [];
  const reasonCodes = [];

  if (intel.isTor || intel.isAbuser) {
    score += 35;
    reasons.push(
      intel.isTor ? "TOR exit network detected" : "High-risk network activity detected",
    );
    reasonCodes.push("HIGH_RISK_NETWORK");
  }
  if (intel.isProxy) {
    score += 25;
    reasons.push("Proxy exit node detected");
    reasonCodes.push("VPN_DETECTED");
  } else if (intel.isVpn) {
    score += 20;
    reasons.push("VPN exit node detected");
    reasonCodes.push("VPN_DETECTED");
  }
  if (intel.isDatacenter) {
    score += 20;
    reasons.push(
      intel.provider
        ? `Datacenter network: ${intel.provider}`
        : "Datacenter network detected",
    );
    reasonCodes.push("DATACENTER_IP");
  }
  if (intel.networkType === "hosting") {
    score += 10;
    reasons.push(
      intel.provider
        ? `Hosting provider: ${intel.provider}`
        : "Hosting provider network",
    );
    reasonCodes.push("HOSTING_PROVIDER");
  }
  if (intel.asn) {
    reasons.push(
      `ASN AS${intel.asn}${intel.organization ? ` (${intel.organization})` : ""}`,
    );
    reasonCodes.push("ASN_MATCH");
  }

  return {
    score: Math.min(score, 70),
    reasons,
    reasonCodes: [...new Set(reasonCodes)],
  };
}
