import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { requestLogPathname } from "../app/lib/request-log-path.server.js";

test("server uses pathname-only morgan logging instead of tiny", async () => {
  const source = await readFile(new URL("../server.js", import.meta.url), "utf8");

  assert.doesNotMatch(source, /morgan\("tiny"\)/);
  assert.match(source, /requestLogPathname/);
  assert.match(
    source,
    /:method :path :status :res\[content-length\] - :response-time ms/,
  );
});

test("requestLogPathname excludes query parameters from logged paths", () => {
  assert.equal(
    requestLogPathname({
      path: "/api/incident-list",
      url: "/api/incident-list?source=real&decision=all&risk=all&search=203.0.113.1",
    }),
    "/api/incident-list",
  );
});

test("requestLogPathname covers auth callback paths without query strings", () => {
  assert.equal(
    requestLogPathname({
      path: "/auth/callback",
      url: "/auth/callback?code=secret-code&hmac=secret-hmac&state=secret-state&host=encoded&shop=demo.myshopify.com",
    }),
    "/auth/callback",
  );
});

test("requestLogPathname falls back to url pathname when path is missing", () => {
  assert.equal(
    requestLogPathname({
      url: "/auth/login?shop=demo.myshopify.com",
    }),
    "/auth/login",
  );
});
