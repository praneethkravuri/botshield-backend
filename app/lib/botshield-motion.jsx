import { useEffect, useRef, useState } from "react";
import { formatHydrationStableNumber } from "./hydration-safe-format.js";

export function prefersReducedMotion() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useAnimatedNumber(target, { duration = 520, enabled = true } = {}) {
  const [display, setDisplay] = useState(target);
  const mountedRef = useRef(false);
  const previousRef = useRef(target);
  const frameRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
  }, []);

  useEffect(() => {
    if (!mountedRef.current || !enabled || prefersReducedMotion()) {
      setDisplay(target);
      previousRef.current = target;
      return undefined;
    }

    const from = previousRef.current;
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(from + (target - from) * eased);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        previousRef.current = target;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [target, enabled, duration]);

  return display;
}

export function AnimatedMetricNumber({
  value,
  enabled = true,
  formatter = formatHydrationStableNumber,
}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "\u2014";
  const animated = useAnimatedNumber(numeric, { enabled, duration: 520 });
  return formatter(Math.round(animated));
}
