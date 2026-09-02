import { Outlet, useLoaderData, useRouteError, useNavigate } from "react-router";
import { useEffect } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import BotShieldAppNavigation from "../components/BotShieldAppNavigation";
import {
  resolveInitialAdminPage,
  resolveInitialSettingsSection,
} from "../lib/admin-route-state.server";
import { isBillingReturnRequest } from "../lib/billing-return.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  if (isBillingReturnRequest(request)) {
    // Billing return performs its own embedded bootstrap + authenticate flow.
    // eslint-disable-next-line no-undef
    return {
      apiKey: process.env.SHOPIFY_API_KEY || "",
      initialAdminPage: resolveInitialAdminPage(url.pathname, url.search),
      initialSettingsSection: resolveInitialSettingsSection(url.search),
    };
  }

  await authenticate.admin(request);

  // eslint-disable-next-line no-undef
  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    initialAdminPage: resolveInitialAdminPage(url.pathname, url.search),
    initialSettingsSection: resolveInitialSettingsSection(url.search),
  };
};

export default function App() {
  const { apiKey } = useLoaderData();
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
    return () => document.removeEventListener("shopify:navigate", handleNavigate);
  }, [navigate]);

  return (
    <AppProvider embedded apiKey={apiKey}>
      <BotShieldAppNavigation />
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
