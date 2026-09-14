const VISITOR_ACCESS_IPV6_DISPLAY_MAX = 28;

function isIpv4Address(value) {
  const parts = String(value || "").trim().split(".");
  return (
    parts.length === 4 &&
    parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
  );
}

export function formatVisitorAccessIpPresentation(value) {
  const full = String(value || "").trim();
  if (!full) {
    return { full, display: full, version: null, truncated: false };
  }

  const version = isIpv4Address(full)
    ? "ipv4"
    : full.includes(":")
      ? "ipv6"
      : null;

  if (version !== "ipv6" || full.length <= VISITOR_ACCESS_IPV6_DISPLAY_MAX) {
    return { full, display: full, version, truncated: false };
  }

  const segments = full.split(":");
  const display =
    segments.length > 4
      ? `${segments.slice(0, 3).join(":")}:…:${segments.slice(-2).join(":")}`
      : `${full.slice(0, 18)}…${full.slice(-8)}`;

  return {
    full,
    display,
    version,
    truncated: display !== full,
  };
}

export function isValidIpAddressInput(value) {
  const input = String(value || "").trim();
  if (!input) return false;

  const ipv4Parts = input.split(".");
  if (ipv4Parts.length === 4) {
    return ipv4Parts.every(
      (part) => /^\d{1,3}$/.test(part) && Number(part) <= 255,
    );
  }

  if (!input.includes(":") || /[^0-9a-f:]/i.test(input)) return false;
  if ((input.match(/::/g) || []).length > 1) return false;

  const [left = "", right = ""] = input.split("::");
  const groups = (side) => (side ? side.split(":") : []);
  const allGroups = [...groups(left), ...groups(right)];
  if (allGroups.some((group) => !/^[0-9a-f]{1,4}$/i.test(group))) return false;

  return input.includes("::")
    ? allGroups.length < 8
    : allGroups.length === 8;
}
