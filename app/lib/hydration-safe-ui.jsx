/* eslint-disable react/prop-types */
import { useBotShieldClientMount } from "../hooks/use-botshield-client-mount";
import {
  formatHydrationStableDateTime,
  formatHydrationStableNumber,
  HYDRATION_STABLE_LOCALE,
  HYDRATION_STABLE_TIME_ZONE,
} from "./hydration-safe-format.js";

export {
  formatHydrationStableDateTime,
  formatHydrationStableNumber,
  HYDRATION_STABLE_LOCALE,
  HYDRATION_STABLE_TIME_ZONE,
};

export function formatRelativeTimeFrom(value, nowMs, emptyLabel = "No decisions recorded") {
  if (!value) return emptyLabel;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "Time unavailable";
  const elapsedMinutes = Math.max(0, Math.floor((nowMs - timestamp) / 60000));
  if (elapsedMinutes < 1) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  return `${Math.floor(elapsedHours / 24)}d ago`;
}

export function useHydrationStableNow(anchorMs = 0) {
  const mounted = useBotShieldClientMount();
  return mounted ? Date.now() : Number(anchorMs) || 0;
}

export function BotShieldHydrationRelativeTime({
  value,
  emptyLabel = "No decisions recorded",
  mountedLabel = "Recent activity",
}) {
  const mounted = useBotShieldClientMount();
  if (!value) return emptyLabel;
  if (!mounted) return mountedLabel;
  return formatRelativeTimeFrom(value, Date.now(), emptyLabel);
}

export function BotShieldHydrationNumber({ value }) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "—";
  return formatHydrationStableNumber(numericValue);
}
