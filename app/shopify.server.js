import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const BOTSHIELD_API_KEY = "d4fd10812566b17d9d99ed95e0978ada";
const BOTSHIELD_APP_URL = "https://botshield-backend.onrender.com";

const readEnv = (name) => process.env[name]?.trim() || "";

const apiKey = readEnv("SHOPIFY_API_KEY");
const apiSecretKey = readEnv("SHOPIFY_API_SECRET");
const appUrl = (readEnv("SHOPIFY_APP_URL") || readEnv("APP_URL")).replace(
  /\/+$/,
  "",
);
const scopes = (readEnv("SCOPES") || "write_app_proxy")
  .split(",")
  .map((scope) => scope.trim())
  .filter(Boolean);

if (process.env.NODE_ENV === "production") {
  const invalid = [];
  const tunnelDomain = ["try", "cloudflare.com"].join("");

  if (!apiKey || apiKey.startsWith("your_")) invalid.push("SHOPIFY_API_KEY");
  else if (apiKey !== BOTSHIELD_API_KEY) {
    invalid.push("SHOPIFY_API_KEY does not match botshield-4");
  }
  if (!apiSecretKey || apiSecretKey.startsWith("your_"))
    invalid.push("SHOPIFY_API_SECRET");
  if (!appUrl || appUrl.includes("ngrok") || appUrl.includes(tunnelDomain)) {
    invalid.push("SHOPIFY_APP_URL");
  } else if (appUrl !== BOTSHIELD_APP_URL) {
    invalid.push("SHOPIFY_APP_URL does not match the Render backend");
  }
  if (!readEnv("DATABASE_URL")) invalid.push("DATABASE_URL");

  if (invalid.length) {
    throw new Error(
      `Missing or invalid production env vars: ${invalid.join(", ")}`,
    );
  }
}

const shopify = shopifyApp({
  apiKey,
  apiSecretKey,
  apiVersion: ApiVersion.April26,
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
export const apiVersion = ApiVersion.April26;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
