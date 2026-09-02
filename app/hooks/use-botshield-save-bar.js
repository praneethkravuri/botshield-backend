import { createElement, useEffect, useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";

function isPreviewRoute() {
  return (
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/ui-preview")
  );
}

export function isAppBridgeEnvironment() {
  return (
    typeof window !== "undefined" &&
    !isPreviewRoute() &&
    typeof window.shopify !== "undefined"
  );
}

async function setSaveBarVisible(shopify, id, visible) {
  const saveBar = shopify?.saveBar;
  const action = visible ? saveBar?.show : saveBar?.hide;

  if (typeof action !== "function") {
    return;
  }

  try {
    await action.call(saveBar, id);
  } catch {
    // Save bar is unavailable outside embedded Shopify Admin.
  }
}

function SaveBarBridgeInner({ id, dirty, enabled = true }) {
  const shopify = useAppBridge();

  useEffect(() => {
    if (!enabled || !id) {
      return undefined;
    }

    setSaveBarVisible(shopify, id, dirty);

    return () => {
      setSaveBarVisible(shopify, id, false);
    };
  }, [dirty, enabled, id, shopify]);

  return null;
}

function setAppBridgeLoading(shopify, isLoading) {
  const loading = shopify?.loading;
  if (!loading) {
    return;
  }

  try {
    if (typeof loading === "function") {
      loading(Boolean(isLoading));
      return;
    }

    const action = isLoading ? loading.start : loading.stop;
    if (typeof action === "function") {
      action.call(loading);
    }
  } catch {
    // Loading API is unavailable outside embedded Shopify Admin.
  }
}

function LoadingBridgeInner({ active }) {
  const shopify = useAppBridge();

  useEffect(() => {
    setAppBridgeLoading(shopify, active);

    return () => {
      setAppBridgeLoading(shopify, false);
    };
  }, [active, shopify]);

  return null;
}

function SaveBarBridgeSlot(props) {
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    setClientReady(true);
  }, []);

  if (!clientReady || !isAppBridgeEnvironment()) {
    return null;
  }

  return createElement(SaveBarBridgeInner, props);
}

function LoadingBridgeSlot({ active }) {
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    setClientReady(true);
  }, []);

  if (!clientReady || !isAppBridgeEnvironment()) {
    return null;
  }

  return createElement(LoadingBridgeInner, { active });
}

export function BotShieldSaveBarBridge(props) {
  return createElement(SaveBarBridgeSlot, props);
}

export function BotShieldLoadingBridge({ active }) {
  return createElement(LoadingBridgeSlot, { active });
}

export function BotShieldPageLoadingBridge() {
  // Full-page App Bridge loading is disabled. It crashed embedded admin when
  // Shopify exposed loading as a function instead of start/stop methods.
  return null;
}
