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
          padding: "0 24px 16px",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            minHeight: "50px",
            fontFamily: "Inter, sans-serif",
            fontSize: "24px",
            lineHeight: 1.1,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "#303030",
          }}
        >
          <span
            style={{
              width: "30px",
              height: "30px",
              flex: "0 0 30px",
              borderRadius: "6px",
              overflow: "hidden",
              display: "inline-flex",
            }}
          >
            <img
              src="/botshield-logo.png"
              alt=""
              style={{
                width: "30px",
                height: "30px",
                objectFit: "cover",
                display: "block",
              }}
            />
          </span>
          <span style={{ fontFamily: "Inter, sans-serif" }}>
            BotShield: Fraud &amp; Bot Detector
          </span>
        </div>

        <div
          style={{
            width: "min(1180px, calc(100% - 24px))",
            margin: "0 auto",
            boxSizing: "border-box",
            background: "#ffffff",
            border: "1px solid #d5d5d5",
            borderRadius: "14px",
            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.12)",
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span
              style={{
                width: "40px",
                height: "40px",
                flex: "0 0 40px",
                borderRadius: "9px",
                overflow: "hidden",
                display: "inline-flex",
                boxShadow: "0 2px 7px rgba(0, 0, 0, 0.16)",
              }}
            >
              <img
                src="/botshield-logo.png"
                alt="BotShield"
                style={{
                  width: "40px",
                  height: "40px",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </span>
            <span
              style={{
                color: "#4a4a4a",
                fontSize: "15px",
                lineHeight: "20px",
                fontWeight: 400,
                letterSpacing: 0,
              }}
            >
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
              fontFamily:
                "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif",
              fontSize: "14px",
              lineHeight: "18px",
              fontWeight: 600,
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
