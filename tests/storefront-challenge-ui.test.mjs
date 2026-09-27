import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("storefront challenge UI matches approved ede65cb premium experience", async () => {
  const js = await readFile(
    new URL(
      "../extensions/botshield-theme-app-extension/assets/botshield.js",
      import.meta.url,
    ),
    "utf8",
  );
  const css = await readFile(
    new URL(
      "../extensions/botshield-theme-app-extension/assets/botshield.css",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(js, /Quick security check/);
  assert.match(js, /Please confirm you're a shopper to continue/);
  assert.match(js, /Continue shopping/);
  assert.match(js, /BotShield storefront bundle botshield-10 \(ede65cb challenge UI\)/);
  assert.doesNotMatch(js, /Continue to store/i);

  const liquid = await readFile(
    new URL(
      "../extensions/botshield-theme-app-extension/blocks/botshield-embed.liquid",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(liquid, /data-storefront-build="botshield-10"/);
  assert.match(js, /Leave store/);
  assert.match(js, /Protected by BotShield/);
  assert.match(js, /botshield-challenge-brand/);
  assert.match(js, /botshield-challenge-mark/);
  assert.match(js, /sessionStorage\.setItem\(challengeStorageKey, payload\.challengeToken\)/);
  assert.match(js, /window\.location\.reload\(\)/);
  assert.match(js, /window\.location\.assign\("\/"\)/);
  assert.match(js, /aria-labelledby/);
  assert.match(js, /aria-modal/);

  assert.doesNotMatch(js, /We need a quick verification/);
  assert.doesNotMatch(js, /botshield-challenge-badge/);
  assert.doesNotMatch(js, /unusual for a normal shopper/);
  assert.doesNotMatch(js, /suspicious/i);
  assert.doesNotMatch(js, /Leave Page/);

  assert.match(css, /backdrop-filter: blur\(6px\)/);
  assert.match(css, /-webkit-backdrop-filter: blur\(6px\)/);
  assert.match(css, /background: rgba\(18, 19, 20, 0\.42\)/);
  assert.match(css, /width: min\(400px, 100%\)/);
  assert.match(css, /background: #ffffff/);
  assert.match(css, /#2c6ecb/);
  assert.match(css, /\.botshield-challenge-footer/);
  assert.match(css, /prefers-reduced-motion: reduce/);

  assert.doesNotMatch(css, /botshield-challenge-badge/);
  assert.doesNotMatch(css, /rgba\(8, 15, 28/);
  assert.doesNotMatch(css, /botshield-challenge-overlay-enter/);
});
