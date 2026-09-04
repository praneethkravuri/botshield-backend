/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { ensurePolarisInitialized } from "../lib/botshield-polaris-init.client.js";
import { mergeEmbeddedAppSearch } from "../lib/embedded-app-navigation.js";
import { BotShieldPolarisReadyContext } from "../hooks/use-botshield-polaris-ready.js";
import { useBotShieldCustomElementClick } from "../hooks/use-botshield-custom-element-click.js";

const APP_BRIDGE_SCRIPT_SRC = "https://cdn.shopify.com/shopifycloud/app-bridge.js";

function useEmbeddedAppNavigate() {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(
    (path) => {
      navigate(mergeEmbeddedAppSearch(path, location.search));
    },
    [location.search, navigate],
  );
}

function AppBridgeScript({ apiKey }) {
  const navigateEmbedded = useEmbeddedAppNavigate();

  useEffect(() => {
    const handleNavigate = (event) => {
      const target = event.target;
      const href =
        target instanceof HTMLElement ? target.getAttribute("href") : null;
      if (href) {
        event.preventDefault?.();
        navigateEmbedded(href);
      }
    };

    document.addEventListener("shopify:navigate", handleNavigate);
    return () => {
      document.removeEventListener("shopify:navigate", handleNavigate);
    };
  }, [navigateEmbedded]);

  return (
    <script
      suppressHydrationWarning
      src={APP_BRIDGE_SCRIPT_SRC}
      data-api-key={apiKey}
    />
  );
}

export function BotShieldNavLink({ href, children, rel }) {
  const navigateEmbedded = useEmbeddedAppNavigate();
  const ref = useBotShieldCustomElementClick((event) => {
    event.preventDefault?.();
    navigateEmbedded(href);
  });

  return (
    <s-link ref={ref} href={href} {...(rel ? { rel } : {})}>
      {children}
    </s-link>
  );
}

const NAV_ITEMS = [
  { href: "/app", label: "Overview" },
  { href: "/app/analytics", label: "Analytics" },
  { href: "/app/protection-rules", label: "Protection" },
  { href: "/app/fraud-orders", label: "Fraud Orders" },
  { href: "/app/settings", label: "Settings" },
];

export function BotShieldAppNavigation() {
  return (
    <s-app-nav>
      {NAV_ITEMS.map((item) => (
        <BotShieldNavLink href={item.href} key={item.href} rel={item.rel}>
          {item.label}
        </BotShieldNavLink>
      ))}
    </s-app-nav>
  );
}

export default function BotShieldEmbeddedAppProvider({ apiKey, children }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    ensurePolarisInitialized()
      .then(() => {
        if (!cancelled) {
          setReady(true);
        }
      })
      .catch((initError) => {
        if (!cancelled) {
          setError(initError?.message || "Failed to initialize Polaris");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const contextValue = useMemo(
    () => ({
      ready,
      error,
    }),
    [ready, error],
  );

  return (
    <BotShieldPolarisReadyContext.Provider value={contextValue}>
      <AppBridgeScript apiKey={apiKey} />
      {children}
    </BotShieldPolarisReadyContext.Provider>
  );
}
