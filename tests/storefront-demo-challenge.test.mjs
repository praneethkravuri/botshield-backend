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
  assert.match(js, /PROTECTION IN ACTION\./);

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

test("demo timer starts at embed init, not after ALLOW decision response", async () => {
  const js = await readFile(
    new URL(
      "../extensions/botshield-theme-app-extension/assets/botshield-storefront-v12.js",
      import.meta.url,
    ),
    "utf8",
  );

  const fetchIndex = js.indexOf("fetch(decisionUrl");
  assert.ok(fetchIndex > 0, "decision fetch must exist");

  assert.match(
    js,
    /if \(isDemoStore\(\)\) \{\s*scheduleDemoChallengePresentation\(\);\s*\}/,
  );
  const initScheduleIndex = js.search(
    /if \(isDemoStore\(\)\) \{\s*scheduleDemoChallengePresentation\(\);\s*\}/,
  );
  assert.ok(initScheduleIndex > 0, "demo timer must be scheduled at storefront init");
  assert.ok(
    initScheduleIndex < fetchIndex,
    "demo timer must be scheduled before decision fetch begins",
  );

  const decisionThen = js.slice(fetchIndex);
  assert.doesNotMatch(
    decisionThen,
    /if \(isDemoStore\(\)\) \{\s*scheduleDemoChallengePresentation\(\);\s*\}/,
    "demo timer must not be deferred until after decision resolves",
  );

  assert.match(js, /realEnforcementResolved/);
  assert.match(js, /if \(realEnforcementResolved\) return;/);
});

test("real enforcement cancels demo timer and overrides demo overlay", async () => {
  const js = await readFile(
    new URL(
      "../extensions/botshield-theme-app-extension/assets/botshield-storefront-v12.js",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(js, /removeDemoOverlayIfPresent/);
  assert.match(js, /realEnforcementResolved = true/);
  assert.match(js, /removeDemoOverlayIfPresent\(\)/);
  assert.match(js, /data-demo-presentation", "true"/);

  const blockPath = js.slice(js.indexOf('payload.decision === "block"'));
  assert.match(blockPath, /cancelDemoChallengePresentation\(\)/);
  assert.match(blockPath, /removeDemoOverlayIfPresent\(\)/);

  const challengePath = js.slice(js.indexOf('payload.decision === "challenge"'));
  assert.match(challengePath, /existingOverlay\.remove\(\)/);
  assert.match(challengePath, /renderChallenge\(payload\)/);
});

test("challenge overlay cannot duplicate and non-demo stores skip demo timer init", async () => {
  const js = await readFile(
    new URL(
      "../extensions/botshield-theme-app-extension/assets/botshield-storefront-v12.js",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(js, /if \(document\.getElementById\("botshield-challenge-overlay"\)\) return;/);

  const scheduleBody = js.slice(
    js.indexOf("function scheduleDemoChallengePresentation"),
    js.indexOf("if (isDemoStore()) {"),
  );
  assert.match(scheduleBody, /if \(!isDemoStore\(\)/);

  const initBlock = js.slice(
    js.indexOf("if (isDemoStore()) {"),
    js.indexOf("var params = new URLSearchParams"),
  );
  assert.match(initBlock, /scheduleDemoChallengePresentation\(\)/);
  assert.doesNotMatch(initBlock, /fetch\(/);
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
