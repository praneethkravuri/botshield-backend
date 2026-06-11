import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const readEnv = (name) => process.env[name]?.trim() || "";

const apiKey = readEnv("SHOPIFY_API_KEY");
const apiSecretKey = readEnv("SHOPIFY_API_SECRET");
const appUrl = (readEnv("SHOPIFY_APP_URL") || readEnv("APP_URL")).replace(/\/+$/, "");
const scopes = readEnv("SCOPES")
  .split(",")
  .map((scope) => scope.trim())
  .filter(Boolean);

if (process.env.NODE_ENV === "production") {
  const missing = [];
  const tunnelDomain = ["try", "cloudflare.com"].join("");

  if (!apiKey || apiKey.startsWith("your_")) missing.push("SHOPIFY_API_KEY");
  if (!apiSecretKey || apiSecretKey.startsWith("your_")) missing.push("SHOPIFY_API_SECRET");
  if (!appUrl || appUrl.includes("ngrok") || appUrl.includes(tunnelDomain)) {
    missing.push("SHOPIFY_APP_URL");
  }
  if (!scopes.length) missing.push("SCOPES");

  if (missing.length) {
    throw new Error(
      `Missing or placeholder Shopify production env vars: ${missing.join(", ")}`,
    );
  }
}

const shopify = shopifyApp({
  apiKey,
  apiSecretKey,
  apiVersion: ApiVersion.October25,
  scopes,
  appUrl,
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
