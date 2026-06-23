import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app?view=dashboard">Security center</s-link>
        <s-link href="/app?view=incidents">Investigations</s-link>
        <s-link href="/app?view=detection">Threat detection</s-link>
        <s-link href="/app?view=policy">Response policy</s-link>
        <s-link href="/app?view=billing">Subscription</s-link>
        <s-link href="/app?view=setup">Setup &amp; support</s-link>
      </s-app-nav>
      <div
        style={{
          background: "#f1f1f1",
          borderBottom: "1px solid #dedede",
          padding: "0 24px 18px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            minHeight: "52px",
            fontSize: "24px",
            lineHeight: 1.2,
            fontWeight: 700,
            letterSpacing: "-0.025em",
            color: "#303030",
          }}
        >
          <img
            src="/botshield-logo.png"
            alt=""
            width="34"
            height="34"
            style={{
              borderRadius: "8px",
              objectFit: "cover",
              display: "block",
            }}
          />
          <span>BotShield: Fraud &amp; Bot Detector</span>
        </div>

        <div
          style={{
            maxWidth: "1180px",
            margin: "0 auto",
            background: "#ffffff",
            border: "1px solid #d5d5d5",
            borderRadius: "14px",
            boxShadow: "0 2px 3px rgba(0, 0, 0, 0.10)",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <img
              src="/botshield-logo.png"
              alt="BotShield"
              width="42"
              height="42"
              style={{
                borderRadius: "10px",
                objectFit: "cover",
                display: "block",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.18)",
              }}
            />
            <span style={{ color: "#4a4a4a", fontSize: "15px" }}>
              Detect suspicious visitors, stop automated abuse, and protect your
              Shopify storefront.
            </span>
          </div>
          <a
            href="/app?view=setup"
            style={{
              border: "1px solid #c9c9c9",
              borderRadius: "9px",
              padding: "8px 16px",
              color: "#303030",
              background: "#ffffff",
              fontWeight: 650,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Setup now
          </a>
        </div>
      </div>
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
