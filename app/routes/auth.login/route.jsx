import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { useLoaderData } from "react-router";
import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";

async function beginShopifyLogin(request) {
  const loginErrors = await login(request);
  return loginErrorMessage(loginErrors);
}

export const loader = async ({ request }) => {
  const errors = await beginShopifyLogin(request);
  return { errors };
};

export const action = async ({ request }) => {
  const errors = await beginShopifyLogin(request);
  return { errors };
};

export default function Auth() {
  const { errors } = useLoaderData();

  return (
    <AppProvider embedded={false}>
      <s-page>
        <s-section heading="Open BotShield from Shopify">
          <p>
            BotShield is installed and opened from your Shopify admin. Use Apps in
            your store admin, or install BotShield from the Shopify App Store. Shopify
            signs you in with your store credentials; this app does not use a separate
            login or shop-domain form.
          </p>
          {errors.shop ? (
            <p role="alert">
              <strong>{errors.shop}</strong>
            </p>
          ) : null}
          <p>
            <a href="https://admin.shopify.com/" rel="noopener noreferrer">
              Go to Shopify admin
            </a>
          </p>
        </s-section>
      </s-page>
    </AppProvider>
  );
}
