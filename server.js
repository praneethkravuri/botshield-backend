import "dotenv/config";
import compression from "compression";
import express from "express";
import morgan from "morgan";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequestListener } from "@mjackson/node-fetch-server";
import { createRequestHandler } from "@react-router/express";
import prisma from "./app/db.server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";
const appUrl = (
  process.env.SHOPIFY_APP_URL ||
  process.env.APP_URL ||
  ""
).replace(/\/+$/, "");
const expectedShopifyApiKey = "d4fd10812566b17d9d99ed95e0978ada";
const expectedAppUrl = "https://botshield-backend.onrender.com";

if (appUrl) {
  process.env.SHOPIFY_APP_URL = appUrl;
  process.env.APP_URL = appUrl;
}

const buildPath = path.resolve(__dirname, "build/server/index.js");
const build = await import(pathToFileURL(buildPath).href);

const assetsBuildDirectory = path.resolve(
  __dirname,
  build.assetsBuildDirectory || "build/client",
);
const publicPath = build.publicPath || "/";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", true);
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }
  next();
});

if (process.env.NODE_ENV === "production") {
  app.use(compression());
}

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      ok: true,
      database: "connected",
      emailProviderConfigured: Boolean(
        process.env.RESEND_API_KEY?.trim() &&
          process.env.ALERT_FROM_EMAIL?.trim(),
      ),
    });
  } catch {
    res.status(503).json({ ok: false, database: "unavailable" });
  }
});

app.get("/health/config", (_req, res) => {
  const shopifyApiKey = process.env.SHOPIFY_API_KEY || "";
  const shopifyAppUrl = (process.env.SHOPIFY_APP_URL || "").replace(/\/+$/, "");
  const publicAppUrl = (process.env.APP_URL || "").replace(/\/+$/, "");
  const scopesConfiguredExplicitly = Boolean(process.env.SCOPES?.trim());
  const scopes = process.env.SCOPES?.trim() || "write_app_proxy";
  const tunnelDomain = ["try", "cloudflare.com"].join("");

  res.status(200).json({
    ok: true,
    shopifyApiKeyConfigured: Boolean(shopifyApiKey),
    shopifyApiKeyMatchesBotshield4: shopifyApiKey === expectedShopifyApiKey,
    shopifyAppUrl,
    shopifyAppUrlMatchesRender: shopifyAppUrl === expectedAppUrl,
    appUrl: publicAppUrl,
    appUrlMatchesRender: publicAppUrl === expectedAppUrl,
    scopes,
    scopesConfiguredExplicitly,
    scopesMatchConfig: scopes === "write_app_proxy",
    databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
    shopifyApiSecretConfigured: Boolean(process.env.SHOPIFY_API_SECRET),
    resendApiKeyConfigured: Boolean(process.env.RESEND_API_KEY?.trim()),
    alertFromEmailConfigured: Boolean(process.env.ALERT_FROM_EMAIL?.trim()),
    networkIntelligenceKeyConfigured: Boolean(process.env.IPAPI_IS_KEY?.trim()),
    shopifyAppHandleConfigured: Boolean(
      process.env.SHOPIFY_APP_HANDLE?.trim(),
    ),
    shopifyPublicPlanHandle:
      process.env.SHOPIFY_PUBLIC_PLAN_HANDLE?.trim() || "basic",
    shopifyPartnerBillingConfigured: Boolean(
      process.env.SHOPIFY_PARTNER_ORG_ID?.trim() &&
        process.env.SHOPIFY_PARTNER_ACCESS_TOKEN?.trim() &&
        process.env.SHOPIFY_PARTNER_APP_ID?.trim(),
    ),
    supportEmailConfigured: Boolean(process.env.VITE_SUPPORT_EMAIL?.trim()),
    billingEnforcementEnabled:
      process.env.BILLING_ENFORCEMENT_ENABLED === "true",
    cloudflareUrlPresent:
      shopifyAppUrl.includes(tunnelDomain) ||
      publicAppUrl.includes(tunnelDomain),
  });
});

app.use(
  path.posix.join(publicPath, "assets"),
  express.static(path.join(assetsBuildDirectory, "assets"), {
    immutable: true,
    maxAge: "1y",
  }),
);
app.use(publicPath, express.static(assetsBuildDirectory));
app.use(express.static(path.join(__dirname, "public"), { maxAge: "1h" }));
app.use(morgan("tiny"));

if (build.fetch) {
  app.all("*", createRequestListener(build.fetch));
} else {
  app.all(
    "*",
    createRequestHandler({
      build,
      mode: process.env.NODE_ENV,
    }),
  );
}

const server = app.listen(port, host, () => {
  console.log(`[botshield] listening on http://${host}:${port}`);
});

["SIGTERM", "SIGINT"].forEach((signal) => {
  process.once(signal, () => {
    server.close((error) => {
      if (error) {
        console.error(error);
        process.exit(1);
      }
      prisma
        .$disconnect()
        .catch(() => {})
        .finally(() => process.exit(0));
    });
  });
});
