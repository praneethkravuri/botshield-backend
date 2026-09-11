import { useEffect, useRef } from "react";
import { useBotShieldPolarisReady } from "./use-botshield-polaris-ready.js";

/**
 * Bind input handlers after Polaris upgrades s-* hosts so React property writes
 * do not hit the wrong receiver during custom-element hydration.
 */
export function useBotShieldCustomElementInput(onInput, { enabled = true, value = "" } = {}) {
  const elementRef = useRef(null);
  const { ready } = useBotShieldPolarisReady();

  useEffect(() => {
    const element = elementRef.current;
    if (!enabled || !element) {
      return undefined;
    }

    if (typeof value === "string" && element.value !== value) {
      element.value = value;
    }

    if (typeof onInput !== "function") {
      return undefined;
    }

    const handler = (event) => {
      onInput(event);
    };

    element.addEventListener("input", handler);
    return () => {
      element.removeEventListener("input", handler);
    };
  }, [enabled, onInput, ready, value]);

  return elementRef;
}
