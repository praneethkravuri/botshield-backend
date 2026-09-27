import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("storefront challenge UI uses reassuring premium copy and preserved actions", async () => {
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
  assert.match(js, /BotShield storefront bundle botshield-9/);
  assert.doesNotMatch(js, /Continue to store/);

  const liquid = await readFile(
    new URL(
      "../extensions/botshield-theme-app-extension/blocks/botshield-embed.liquid",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(liquid, /data-storefront-build="botshield-9"/);
  assert.match(js, /Leave store/);
  assert.match(js, /Protected by BotShield/);
  assert.match(js, /sessionStorage\.setItem\(challengeStorageKey, payload\.challengeToken\)/);
  assert.match(js, /window\.location\.reload\(\)/);
  assert.match(js, /window\.location\.assign\("\/"\)/);
  assert.match(js, /aria-labelledby/);

  assert.doesNotMatch(js, /We need a quick verification/);
  assert.doesNotMatch(js, /unusual for a normal shopper/);
  assert.doesNotMatch(js, /suspicious/i);

  assert.match(css, /#2c6ecb/);
  assert.match(css, /backdrop-filter/);
  assert.match(css, /\.botshield-challenge-footer/);
});
