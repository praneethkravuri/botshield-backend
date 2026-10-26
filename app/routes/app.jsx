import { Outlet, useLoaderData, useRouteError, useLocation, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import BotShieldEmbeddedAppProvider, {
  BotShieldAppNavigation,
} from "../components/BotShieldEmbeddedAppProvider";
import {
  resolveInitialAdminPage,
  resolveInitialSettingsSection,
} from "../lib/admin-route-state.server";
import { isBillingReturnRequest } from "../lib/billing-return.server";
import { ThemeActivationProvider } from "../components/onboarding/ThemeActivationProvider.jsx";
import BotShieldWorkspaceLoading, { BotShieldLoadingScreen } from "../components/BotShieldWorkspaceLoading.jsx";
import { useBotShieldPolarisReady } from "../hooks/use-botshield-polaris-ready.js";
import { useThemeActivation } from "../components/onboarding/ThemeActivationProvider.jsx";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  if (isBillingReturnRequest(request)) {
    // Billing return performs its own embedded bootstrap + authenticate flow.
    return {
      // eslint-disable-next-line no-undef
      apiKey: process.env.SHOPIFY_API_KEY || "",
      initialAdminPage: resolveInitialAdminPage(url.pathname, url.search),
      initialSettingsSection: resolveInitialSettingsSection(url.search),
      renderAnchorMs: Date.now(),
    };
  }

  const { session } = await authenticate.admin(request);

  return {
    // eslint-disable-next-line no-undef
    apiKey: process.env.SHOPIFY_API_KEY || "",
    merchantShop: session.shop,
    initialAdminPage: resolveInitialAdminPage(url.pathname, url.search),
    initialSettingsSection: resolveInitialSettingsSection(url.search),
    renderAnchorMs: Date.now(),
  };
};

export default function App() {
  const { apiKey, merchantShop } = useLoaderData();

  return (
    <BotShieldEmbeddedAppProvider apiKey={apiKey}>
      <BotShieldAppNavigation />
      <ThemeActivationProvider key={merchantShop || "billing-return"} merchantShop={merchantShop}>
        <Workspace />
      </ThemeActivationProvider>
    </BotShieldEmbeddedAppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

// Native fallback for initial client hydration; it performs no authentication work.
export function HydrateFallback() {
  return <div className="bs-workspace-loading-layer"><BotShieldLoadingScreen /></div>;
}

function Workspace() {
  const { ready, error } = useBotShieldPolarisReady();
  const activation = useThemeActivation();
  const location = useLocation();
  const navigation = useNavigation();
  // These existing flows own their presentation and bootstrap behavior.
  if (["/app/onboarding", "/app/billing-return"].includes(location.pathname)) return <Outlet />;
  return (
    <BotShieldWorkspaceLoading
      initializing={!ready || Boolean(activation?.checking || activation?.profile.loading)}
      error={error}
      navigating={navigation.state === "loading"}
    >
      <Outlet />
    </BotShieldWorkspaceLoading>
  );
}
