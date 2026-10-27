import { LoginErrorType } from "@shopify/shopify-app-react-router/server";

export function loginErrorMessage(loginErrors) {
  if (loginErrors?.shop === LoginErrorType.MissingShop) {
    return {
      shop: "Open BotShield from your Shopify admin or install it from the Shopify App Store.",
    };
  }
  if (loginErrors?.shop === LoginErrorType.InvalidShop) {
    return {
      shop: "That store address is not valid. Open BotShield from your Shopify admin instead.",
    };
  }

  return {};
}
