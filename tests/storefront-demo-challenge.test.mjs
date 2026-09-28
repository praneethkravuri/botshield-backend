import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("demo store schedules delayed redirect to the real blocked page", async () => {
  const js = await readFile(
    new URL(
      "../extensions/botshield-theme-app-extension/assets/botshield.js",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(js, /botshield-demo\.myshopify\.com/);
  assert.match(js, /demoBlockShowcaseDelayMs = 2000/);
  assert.match(js, /scheduleDemoBlockShowcase/);
  assert.match(js, /window\.location\.assign\(demoBlockedPageUrl\)/);
  assert.match(js, /dataset\.blockedUrl \|\| "\/apps\/botshield\/blocked"/);
  assert.doesNotMatch(js, /botshield_demo_challenge_seen/);
  assert.doesNotMatch(js, /demoPresentation:\s*true/);
  assert.doesNotMatch(js, /renderChallenge\(\{\s*demoPresentation/);

  assert.match(js, /window\.location\.hostname === demoStoreHost/);
  assert.match(js, /cancelDemoBlockShowcase\(\)/);
  assert.match(js, /payload\.blockPageUrl/);
});

test("demo timer starts at embed init, not after ALLOW decision response", async () => {
  const js = await readFile(
    new URL(
      "../extensions/botshield-theme-app-extension/assets/botshield.js",
      import.meta.url,
    ),
    "utf8",
  );

  const fetchIndex = js.indexOf("fetch(decisionUrl");
  assert.ok(fetchIndex > 0, "decision fetch must exist");

  assert.match(js, /if \(isDemoStore\(\)\) \{\s*scheduleDemoBlockShowcase\(\);\s*\}/);
  const initScheduleIndex = js.search(
    /if \(isDemoStore\(\)\) \{\s*scheduleDemoBlockShowcase\(\);\s*\}/,
  );
  assert.ok(initScheduleIndex > 0, "demo timer must be scheduled at storefront init");
  assert.ok(
    initScheduleIndex < fetchIndex,
    "demo timer must be scheduled before decision fetch begins",
  );

  const decisionThen = js.slice(fetchIndex);
  assert.doesNotMatch(
    decisionThen,
    /if \(isDemoStore\(\)\) \{\s*scheduleDemoBlockShowcase\(\);\s*\}/,
    "demo timer must not be deferred until after decision resolves",
  );

  assert.match(js, /realEnforcementResolved/);
  assert.match(js, /if \(realEnforcementResolved\) return;/);
});

test("demo store ignores CHALLENGE decisions so the block showcase timer can finish", async () => {
  const js = await readFile(
    new URL(
      "../extensions/botshield-theme-app-extension/assets/botshield.js",
      import.meta.url,
    ),
    "utf8",
  );

  const challengePath = js.slice(js.indexOf('payload.decision === "challenge"'));
  const demoGuard = challengePath.slice(0, challengePath.indexOf("renderChallenge(payload)"));
  assert.match(demoGuard, /if \(isDemoStore\(\)\) \{\s*return;\s*\}/);
  assert.doesNotMatch(demoGuard, /renderChallenge\(\{\s*demoPresentation/);
});

test("real enforcement cancels demo block showcase timer", async () => {
  const js = await readFile(
    new URL(
      "../extensions/botshield-theme-app-extension/assets/botshield.js",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(js, /realEnforcementResolved = true/);

  const blockPath = js.slice(js.indexOf('payload.decision === "block"'));
  assert.match(blockPath, /cancelDemoBlockShowcase\(\)/);

  const challengePath = js.slice(js.indexOf('payload.decision === "challenge"'));
  assert.match(challengePath, /if \(isDemoStore\(\)\)/);
  assert.match(challengePath, /cancelDemoBlockShowcase\(\)/);
  assert.match(challengePath, /renderChallenge\(payload\)/);
});

test("non-demo stores still render real challenge decisions", async () => {
  const js = await readFile(
    new URL(
      "../extensions/botshield-theme-app-extension/assets/botshield.js",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(js, /renderChallenge\(payload\)/);
  assert.match(js, /payload\.decision === "challenge"/);
});

test("non-demo stores skip demo block showcase init", async () => {
  const js = await readFile(
    new URL(
      "../extensions/botshield-theme-app-extension/assets/botshield.js",
      import.meta.url,
    ),
    "utf8",
  );

  const scheduleBody = js.slice(
    js.indexOf("function scheduleDemoBlockShowcase"),
    js.indexOf("if (isDemoStore()) {"),
  );
  assert.match(scheduleBody, /if \(!isDemoStore\(\)/);

  const initBlock = js.slice(
    js.indexOf("if (isDemoStore()) {"),
    js.indexOf("var params = new URLSearchParams"),
  );
  assert.match(initBlock, /scheduleDemoBlockShowcase\(\)/);
  assert.doesNotMatch(initBlock, /fetch\(/);
});

test("real challenge flow remains available for genuine security decisions", async () => {
  const js = await readFile(
    new URL(
      "../extensions/botshield-theme-app-extension/assets/botshield.js",
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
  assert.match(js, /Quick security check/);
  assert.match(js, /Continue shopping/);
});
