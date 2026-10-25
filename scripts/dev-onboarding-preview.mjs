/* eslint-env node */
/** Local-only synthetic session preview. Never imported by the application server. */
import express from "express";
import { createRequestHandler } from "@react-router/express";
import { fileURLToPath } from "node:url";
import {
  resolveInitialAdminPage,
  resolveInitialSettingsSection,
} from "../app/lib/admin-route-state.server.js";
import {
  assertSafeNonProductionDatabase,
  DEFAULT_LOCAL_DEVELOPMENT_DATABASE_URL,
} from "../app/lib/database-environment.server.js";

if (
  process.env.NODE_ENV === "production" ||
  process.env.BOTSHIELD_SYNTHETIC_PREVIEW !== "1"
) {
  throw new Error(
    "Synthetic preview requires BOTSHIELD_SYNTHETIC_PREVIEW=1 and a non-production environment.",
  );
}
process.env.DATABASE_URL ||= DEFAULT_LOCAL_DEVELOPMENT_DATABASE_URL;
assertSafeNonProductionDatabase();
const port = Number(process.env.BOTSHIELD_PREVIEW_PORT || 3101);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Use a local preview port between 1024 and 65535.");
// Deliberately synthetic. These values never authenticate a merchant session.
process.env.SHOPIFY_API_KEY = "local-test-api-key";
process.env.SHOPIFY_API_SECRET = "local-test-only-secret";
process.env.SHOPIFY_APP_URL = `http://127.0.0.1:${port}`;
process.env.APP_URL = process.env.SHOPIFY_APP_URL;
const build = await import("../build/server/index.js");
build.routes["routes/app"].module = {
  ...build.routes["routes/app"].module,
  loader: ({ request }) => {
    const url = new URL(request.url);
    const requestedShop =
      url.searchParams.get("shop") || "onboarding-test.myshopify.com";
    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(requestedShop))
      throw new Response("Invalid synthetic shop", { status: 400 });
    return {
      apiKey: "local-test-api-key",
      merchantShop: requestedShop,
      initialAdminPage: resolveInitialAdminPage(url.pathname, url.search),
      initialSettingsSection: resolveInitialSettingsSection(url.search),
      renderAnchorMs: Date.now(),
    };
  },
};
const app = express();
app.disable("x-powered-by");
app.use(
  express.static(fileURLToPath(new URL("../build/client", import.meta.url))),
);
app.use(express.static(fileURLToPath(new URL("../public", import.meta.url))));
app.all("*", createRequestHandler({ build, mode: "development" }));
app.listen(port, "127.0.0.1", () =>
  console.log(
    `Synthetic-session preview listening on loopback port ${port}. Authentication is mocked only in this process; use the browser acceptance runner for API fixtures.`,
  ),
);
