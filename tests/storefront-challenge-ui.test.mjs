import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("storefront challenge UI matches BotShield premium block-page design language", async () => {
  const js = await readFile(
    new URL(
      "../extensions/botshield-theme-app-extension/assets/botshield-storefront-v12.js",
      import.meta.url,
    ),
    "utf8",
  );
  const css = await readFile(
    new URL(
      "../extensions/botshield-theme-app-extension/assets/botshield-storefront-v12.css",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(js, /PROTECTION IN ACTION\./);
  assert.match(js, /Quick security check/);
  assert.match(js, /Please confirm you're a shopper to continue/);
  assert.match(js, /Continue shopping/);
  assert.match(js, /BotShield storefront bundle botshield-12 \(premium challenge UI\)/);
  assert.doesNotMatch(js, /Continue to store/i);

  const liquid = await readFile(
    new URL(
      "../extensions/botshield-theme-app-extension/blocks/botshield-embed.liquid",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(liquid, /data-storefront-build="botshield-12"/);
  assert.match(liquid, /botshield-storefront-v12\.js/);
  assert.match(liquid, /botshield-storefront-v12\.css/);
  assert.match(liquid, /botshield-official-logo-transparent\.png/);
  assert.match(liquid, /data-official-logo-url=/);
  assert.doesNotMatch(liquid, /botshield-storefront-v11/);
  assert.doesNotMatch(liquid, /"javascript": "botshield\.js"/);

  assert.match(js, /data-botshield-challenge-build", "botshield-12"/);
  assert.match(js, /bs-challenge-logo/);
  assert.match(js, /officialLogoUrl/);
  assert.match(js, /bs-challenge-rings/);
  assert.match(js, /bs-challenge-network/);
  assert.doesNotMatch(js, /botshield-challenge-mark/);
  assert.doesNotMatch(js, /M12 2\.25 4\.5 5\.25/);

  assert.match(js, /Leave store/);
  assert.match(js, /Protected by BotShield/);
  assert.match(js, /sessionStorage\.setItem\(challengeStorageKey, payload\.challengeToken\)/);
  assert.match(js, /window\.location\.reload\(\)/);
  assert.match(js, /window\.location\.assign\("\/"\)/);
  assert.match(js, /aria-labelledby/);
  assert.match(js, /aria-modal/);

  assert.doesNotMatch(js, /We need a quick verification/);
  assert.doesNotMatch(js, /botshield-challenge-badge/);

  assert.match(css, /backdrop-filter: blur\(10px\)/);
  assert.match(css, /\.bs-challenge-card/);
  assert.match(css, /#2c6ecb/);
  assert.match(css, /linear-gradient\(180deg, #3d7dd4/);
  assert.match(css, /\.bs-challenge-footer/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /min\(480px/);
  assert.match(css, /bs-challenge-glow-breathe/);
});
