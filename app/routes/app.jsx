import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import BotShieldEmbeddedAppProvider, {
  BotShieldAppNavigation,
} from "../components/BotShieldEmbeddedAppProvider";
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
      renderAnchorMs: Date.now(),
    };
  }

  await authenticate.admin(request);

  // eslint-disable-next-line no-undef
  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    initialAdminPage: resolveInitialAdminPage(url.pathname, url.search),
    initialSettingsSection: resolveInitialSettingsSection(url.search),
    renderAnchorMs: Date.now(),
  };
};

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <BotShieldEmbeddedAppProvider apiKey={apiKey}>
      <BotShieldAppNavigation />
      <Outlet />
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
