import { useEffect, useRef } from "react";
import { useBotShieldPolarisReady } from "./use-botshield-polaris-ready.js";

/**
 * Polaris upgrades s-* hosts after hydration. React 18 property/event bindings on
 * those hosts can be lost during upgrade, so mirror critical handlers natively.
 */
export function useBotShieldCustomElementClick(onClick, { enabled = true } = {}) {
  const elementRef = useRef(null);
  const { ready } = useBotShieldPolarisReady();

  useEffect(() => {
    const element = elementRef.current;
    if (!enabled || !element || typeof onClick !== "function") {
      return undefined;
    }

    const handler = (event) => {
      onClick(event);
    };

    element.addEventListener("click", handler);
    return () => {
      element.removeEventListener("click", handler);
    };
  }, [enabled, onClick, ready]);

  return elementRef;
}
