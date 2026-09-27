import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildBotShieldBlockedPageHtml } from "../app/lib/botshield-blocked-page-html.server.js";

test("storefront block page uses full-page Access Denied layout without bypass controls", async () => {
  const html = buildBotShieldBlockedPageHtml();
  const js = await readFile(
    new URL(
      "../extensions/botshield-theme-app-extension/assets/botshield.js",
      import.meta.url,
    ),
    "utf8",
  );
  const proxyRoute = await readFile(
    new URL("../app/routes/proxy.botshield.blocked.jsx", import.meta.url),
    "utf8",
  );
  const enforcement = await readFile(
    new URL("../app/lib/storefront-enforcement.server.js", import.meta.url),
    "utf8",
  );

  assert.match(html, /<h1 class="bs-block-title">Access Denied<\/h1>/);
  assert.match(html, /This store's security settings have restricted access to this page\./);
  assert.match(html, /BotShield: Bot Protection/);
  assert.match(html, /Protected by/);
  assert.match(html, /#2C6ECB|#2c6ecb/i);
  assert.match(html, /min-height: 100vh/);
  assert.match(html, /bs-block-page/);
  assert.doesNotMatch(html, /Continue/i);
  assert.doesNotMatch(html, /Contact Site Owner/i);
  assert.doesNotMatch(html, /Reason:/i);
  assert.doesNotMatch(html, /risk score/i);

  assert.match(js, /blockPageUrl/);
  assert.match(js, /window\.location\.assign\(payload\.blockPageUrl\)/);
  assert.match(enforcement, /\/apps\/botshield\/blocked/);
  assert.match(proxyRoute, /buildBotShieldBlockedPageHtml/);
  assert.match(proxyRoute, /authenticate\.public\.appProxy/);
});

test("challenge overlay remains separate from hard block page", async () => {
  const js = await readFile(
    new URL(
      "../extensions/botshield-theme-app-extension/assets/botshield.js",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(js, /renderChallenge/);
  assert.match(js, /Quick security check/);
  assert.match(js, /sessionStorage\.setItem\(challengeStorageKey, payload\.challengeToken\)/);
  assert.doesNotMatch(js, /Access Denied/);
});
