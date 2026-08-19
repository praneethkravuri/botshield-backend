import { useEffect } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";

function isPreviewRoute() {
  return (
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/ui-preview")
  );
}

export function useBotShieldSaveBar({ id, dirty, enabled = true }) {
  const shopify = useAppBridge();

  useEffect(() => {
    if (isPreviewRoute() || !enabled || !id || !shopify?.saveBar) {
      return undefined;
    }

    const sync = async () => {
      try {
        if (dirty) {
          await shopify.saveBar.show(id);
        } else {
          await shopify.saveBar.hide(id);
        }
      } catch {
        // Save bar is unavailable outside embedded Shopify Admin.
      }
    };

    sync();

    return () => {
      shopify.saveBar.hide(id).catch(() => {});
    };
  }, [dirty, enabled, id, shopify]);
}

export function useBotShieldLoadingIndicator(active) {
  const shopify = useAppBridge();

  useEffect(() => {
    if (isPreviewRoute() || !shopify?.loading) {
      return undefined;
    }

    if (active) {
      shopify.loading.start().catch(() => {});
    } else {
      shopify.loading.stop().catch(() => {});
    }

    return () => {
      shopify.loading.stop().catch(() => {});
    };
  }, [active, shopify]);
}

export function useBotShieldPageLoading(active) {
  return useBotShieldLoadingIndicator(active);
}
