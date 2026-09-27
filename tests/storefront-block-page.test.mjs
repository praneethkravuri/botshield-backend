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

  assert.match(html, /<main class="bs-block-page">/);
  assert.match(html, /<h1 class="bs-block-title">/);
  assert.match(html, /bs-block-title-access">Access</);
  assert.match(html, /bs-block-title-denied">Denied</);
  assert.match(html, /PROTECTION IN ACTION\./);
  assert.match(
    html,
    /Suspicious or unauthorized activity was detected, so entry has been denied to protect this storefront\./,
  );
  assert.match(html, /id="bs-block-go-back"/);
  assert.match(html, /Go Back/);
  assert.match(html, /window\.history\.back\(\)/);
  assert.match(html, /window\.location\.assign\("\/"\)/);
  assert.match(html, /BotShield: Bot Protection/);
  assert.match(html, /Protected by/);
  assert.match(html, /alt="BotShield"/);
  assert.match(html, /data:image\/png;base64,/);
  assert.match(html, /bs-block-logo--hero/);
  assert.match(html, /#2C6ECB|#2c6ecb/i);
  assert.match(html, /min-height: 100vh/);
  assert.match(html, /prefers-reduced-motion: reduce/);
  assert.match(html, /<meta name="robots" content="noindex, nofollow" \/>/);

  assert.doesNotMatch(html, /bs-block-shield-svg/);
  assert.doesNotMatch(html, /botshield-app-icon/);
  assert.doesNotMatch(html, /Continue to store/i);
  assert.doesNotMatch(html, /\bContinue\b/i);
  assert.doesNotMatch(html, /Leave store/i);
  assert.doesNotMatch(html, /Contact Site Owner/i);
  assert.doesNotMatch(html, /Reason:/i);
  assert.doesNotMatch(html, /risk score/i);
  assert.doesNotMatch(html, /\bref=BS-/i);
  assert.doesNotMatch(html, /searchParams\.get\("ip"\)/);
  assert.doesNotMatch(html, /challengePassed/i);
  assert.doesNotMatch(html, /whitelist/i);
  assert.doesNotMatch(html, /sessionStorage/i);
  assert.doesNotMatch(html, /Quick security check/i);

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
  assert.match(
    js,
    /sessionStorage\.setItem\(challengeStorageKey, payload\.challengeToken\)/,
  );
  assert.doesNotMatch(js, /Access Denied/);
});
