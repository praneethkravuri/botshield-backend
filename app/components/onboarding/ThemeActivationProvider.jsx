/* eslint-disable react/prop-types */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router";
import { readThemeAppEmbedStatus } from "../../lib/theme-extension-status.client.js";
import { checkActivationWithTimeout } from "../../lib/onboarding.js";
import { safeFetchJson } from "../../lib/safe-fetch.js";

const ThemeActivationContext = createContext(null);

export function ThemeActivationProvider({ children, merchantShop }) {
  const location = useLocation();
  const [status, setStatus] = useState({
    state: "unavailable",
    checking: true,
    lastVerifiedState: null,
    verified: false,
  });
  const [profile, setProfile] = useState({
    shop: "",
    acknowledged: null,
    loading: true,
    error: "",
  });
  const [saveError, setSaveError] = useState("");
  const inFlight = useRef(null);
  const acknowledgmentRequest = useRef(null);
  const acknowledgedThisSession = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(false);

  const check = useCallback(() => {
    if (inFlight.current) return inFlight.current;
    const version = ++generation.current;
    setStatus((current) => ({ ...current, checking: true, verified: false }));
    setProfile((current) => ({ ...current, loading: true }));
    const current = () => mounted.current && version === generation.current;
    const request = (async () => {
      // Read the published theme on every check; merchants can switch themes in the editor.
      let data = null;
      try {
        data = await safeFetchJson("/api/onboarding", {
          signal: AbortSignal.timeout(10000),
        });
        if (
          typeof data?.acknowledged !== "boolean" ||
          !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(data?.shop || "") ||
          (merchantShop && data.shop !== merchantShop)
        ) {
          throw new Error("Store setup response is invalid");
        }
        if (current())
          setProfile({
            ...data,
            shop: data.shop || "",
            acknowledged:
              acknowledgedThisSession.current || Boolean(data.acknowledged),
            loading: false,
            error: "",
          });
      } catch {
        data = null;
        if (current())
          setProfile((previous) => ({
            ...previous,
            publishedTheme: null,
            loading: false,
            error:
              "Store setup details couldn't be loaded. You can still use BotShield.",
          }));
      }
      if (!current()) return;
      const result = await checkActivationWithTimeout(() =>
        readThemeAppEmbedStatus(data?.publishedTheme?.id),
      ).catch(() => ({ themeAppEmbedConnectionState: "unavailable" }));
      if (!current()) return;
      const state = result.themeAppEmbedConnectionState;
      setStatus((previous) => ({
        state,
        checking: false,
        verified: result.publishedThemeVerified === true,
        lastVerifiedState:
          state === "unavailable" ? previous.lastVerifiedState : state,
      }));
      return result;
    })().finally(() => {
      if (version === generation.current) inFlight.current = null;
    });
    inFlight.current = request;
    return request;
  }, [merchantShop]);

  const acknowledge = useCallback(() => {
    if (acknowledgmentRequest.current) return acknowledgmentRequest.current;
    acknowledgedThisSession.current = true;
    setProfile((current) => ({ ...current, acknowledged: true }));
    setSaveError("");
    acknowledgmentRequest.current = safeFetchJson("/api/onboarding", {
      method: "POST",
      signal: AbortSignal.timeout(10000),
    })
      .catch(() => {
        if (mounted.current)
          setSaveError(
            "We couldn't save your guide visit. Setup may appear again next time. Retry saving when you're ready.",
          );
      })
      .finally(() => {
        acknowledgmentRequest.current = null;
      });
    return acknowledgmentRequest.current;
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      inFlight.current = null;
    };
  }, []);
  useEffect(() => {
    // Billing return owns its bootstrap; don't introduce requests into that flow.
    if (location.pathname === "/app/billing-return") return undefined;
    check();
    const onReturn = () => {
      if (document.visibilityState !== "hidden") check();
    };
    const onBridgeReady = () => check();
    const bridge = document.querySelector(
      'script[src="https://cdn.shopify.com/shopifycloud/app-bridge.js"]',
    );
    bridge?.addEventListener("load", onBridgeReady);
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      bridge?.removeEventListener("load", onBridgeReady);
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [check, location.pathname]);

  useEffect(() => {
    if (
      status.state === "active" &&
      !status.checking &&
      profile.acknowledged === false
    )
      acknowledge();
  }, [status.state, status.checking, profile.acknowledged, acknowledge]);

  const value = useMemo(
    () => ({
      ...status,
      profile,
      check,
      acknowledge,
      saveError,
      loadProfile: check,
    }),
    [status, profile, check, acknowledge, saveError],
  );
  return (
    <ThemeActivationContext.Provider value={value}>
      {children}
    </ThemeActivationContext.Provider>
  );
}

export function useThemeActivation() {
  return useContext(ThemeActivationContext);
}
