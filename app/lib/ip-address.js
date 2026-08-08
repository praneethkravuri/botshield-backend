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
