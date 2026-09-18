import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("protection premium stylesheet is scoped and supports reduced motion", async () => {
  const css = await readFile(
    new URL("../app/styles/protection-premium.css", import.meta.url),
    "utf8",
  );

  assert.match(css, /\.botshield-protection-premium/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /\.bp-page-intro/);
  assert.match(css, /\.botshield-protection-status/);
  assert.match(css, /--bp-graphite:/);
  assert.match(css, /\.botshield-protection-status\.is-healthy \.botshield-protection-status-icon/);
  assert.match(css, /--bp-hero-ink:/);
  assert.match(css, /\.botshield-protection-row\.is-active/);
  assert.match(css, /\.botshield-visitor-access-record/);
  assert.doesNotMatch(css, /\.botshield-overview-premium/);
  assert.doesNotMatch(css, /\.botshield-analytics-v2/);
});

test("protection premium wiring stays protection-only", async () => {
  const adminExperience = await readFile(
    new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
    "utf8",
  );
  const valuePage = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );
  const protectionPage = adminExperience.slice(
    adminExperience.indexOf("function ProtectionPage"),
    adminExperience.indexOf("function IpList"),
  );

  assert.match(adminExperience, /protection-premium\.css/);
  assert.match(
    adminExperience,
    /className="botshield-protection-content botshield-protection-premium"/,
  );
  assert.match(protectionPage, /className="bp-page-intro"/);
  assert.match(protectionPage, /botshield-protection-row\$\{row\.active \? " is-active" : ""\}/);
  assert.match(protectionPage, /onClick=\{row\.action\}>Manage<\/BotShieldActionButton>/);
  assert.match(protectionPage, /showBotShieldModal\("botshield-protection-discard-modal"\)/);
  assert.match(protectionPage, /onAfterHide=\{handleProtectionModalAfterHide\}/);

  assert.doesNotMatch(valuePage, /protection-premium/);
  assert.match(
    adminExperience,
    /className="botshield-overview-content botshield-overview-v2 botshield-overview-premium"/,
  );
});
