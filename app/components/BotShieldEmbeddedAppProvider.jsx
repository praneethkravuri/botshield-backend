/* eslint-disable react/prop-types */
/**
 * Embedded Shopify app shell provider.
 *
 * Shopify's default AppProvider injects polaris.js as a synchronous sibling script
 * before route content. polaris.js upgrades s-* custom elements before React
 * hydrates, mutating DOM structure and causing hydration failures (#425/#418/#423).
 *
 * This provider keeps App Bridge bootstrap but loads polaris.js only after the
 * client has mounted so hydrateRoot sees the SSR DOM unchanged.
 */
import { useEffect } from "react";
import { useNavigate } from "react-router";

const POLARIS_SCRIPT_ID = "botshield-deferred-polaris";
const POLARIS_SCRIPT_SRC = "https://cdn.shopify.com/shopifycloud/polaris.js";
const APP_BRIDGE_SCRIPT_SRC = "https://cdn.shopify.com/shopifycloud/app-bridge.js";

function AppBridgeScript({ apiKey }) {
  const navigate = useNavigate();

  useEffect(() => {
    const handleNavigate = (event) => {
      const target = event.target;
      const href =
        target instanceof HTMLElement ? target.getAttribute("href") : null;
      if (href) {
        navigate(href);
      }
    };

    document.addEventListener("shopify:navigate", handleNavigate);
    return () => {
      document.removeEventListener("shopify:navigate", handleNavigate);
    };
  }, [navigate]);

  return (
    <script
      suppressHydrationWarning
      src={APP_BRIDGE_SCRIPT_SRC}
      data-api-key={apiKey}
    />
  );
}

function DeferredPolarisScript() {
  useEffect(() => {
    if (document.getElementById(POLARIS_SCRIPT_ID)) {
      return undefined;
    }

    const script = document.createElement("script");
    script.id = POLARIS_SCRIPT_ID;
    script.src = POLARIS_SCRIPT_SRC;
    script.async = true;
    document.head.appendChild(script);

    return undefined;
  }, []);

  return null;
}

export default function BotShieldEmbeddedAppProvider({ apiKey, children }) {
  return (
    <>
      <AppBridgeScript apiKey={apiKey} />
      {children}
      <DeferredPolarisScript />
    </>
  );
}
