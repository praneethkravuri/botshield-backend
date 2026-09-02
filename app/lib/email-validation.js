export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidAlertEmail(value) {
  return EMAIL_PATTERN.test(String(value || "").trim());
}
