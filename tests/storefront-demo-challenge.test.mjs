import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("demo store can schedule a one-time delayed challenge presentation", async () => {
  const js = await readFile(
    new URL(
      "../extensions/botshield-theme-app-extension/assets/botshield-storefront-v12.js",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(js, /botshield-demo\.myshopify\.com/);
  assert.match(js, /demoChallengeDelayMs = 2000/);
  assert.match(js, /botshield_demo_challenge_seen/);
  assert.match(js, /scheduleDemoChallengePresentation/);
  assert.match(js, /demoPresentation: true/);
  assert.match(js, /Continue shopping/);
  assert.doesNotMatch(js, /Continue to store/i);
  assert.match(js, /bs-challenge-logo/);

  assert.match(js, /window\.location\.hostname === demoStoreHost/);
  assert.match(js, /cancelDemoChallengePresentation\(\)/);
  assert.match(js, /payload\.blockPageUrl/);

  const demoContinuePath = js.slice(js.indexOf("isDemoPresentation"));
  assert.match(demoContinuePath, /markDemoChallengeSeen\(\)/);
  assert.match(demoContinuePath, /overlay\.remove\(\)/);
  assert.doesNotMatch(
    demoContinuePath.slice(0, demoContinuePath.indexOf("if (payload.challengeToken)")),
    /sessionStorage\.setItem\(challengeStorageKey/,
  );
});

test("real challenge flow remains separate from demo presentation flag", async () => {
  const js = await readFile(
    new URL(
      "../extensions/botshield-theme-app-extension/assets/botshield-storefront-v12.js",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    js,
    /sessionStorage\.setItem\(challengeStorageKey, payload\.challengeToken\)/,
  );
  assert.match(js, /payload\.decision === "challenge"/);
  assert.match(js, /window\.location\.reload\(\)/);
  assert.match(js, /setItem\(demoChallengeSeenKey/);
  assert.match(js, /setItem\(challengeStorageKey, payload\.challengeToken\)/);
});
