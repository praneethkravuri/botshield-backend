import "dotenv/config";
import compression from "compression";
import express from "express";
import morgan from "morgan";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequestListener } from "@mjackson/node-fetch-server";
import { createRequestHandler } from "@react-router/express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";
const appUrl = (process.env.APP_URL || process.env.SHOPIFY_APP_URL || "").replace(/\/$/, "");

if (appUrl && !process.env.SHOPIFY_APP_URL) {
  process.env.SHOPIFY_APP_URL = appUrl;
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

if (process.env.NODE_ENV === "production") {
  app.use(compression());
}

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
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
      process.exit(0);
    });
  });
});
