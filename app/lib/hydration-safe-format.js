export const HYDRATION_STABLE_LOCALE = "en-US";
export const HYDRATION_STABLE_TIME_ZONE = "UTC";

export function formatHydrationStableDateTime(value, fallback = "Not yet", options = {}) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString(HYDRATION_STABLE_LOCALE, {
    timeZone: HYDRATION_STABLE_TIME_ZONE,
    ...options,
  });
}

export function formatHydrationStableNumber(value) {
  return Number(value).toLocaleString(HYDRATION_STABLE_LOCALE);
}
