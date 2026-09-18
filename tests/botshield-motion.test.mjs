import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("shared motion CSS defines reduced-motion safeguards", async () => {
  const css = await readFile(
    new URL("../app/styles/botshield-motion.css", import.meta.url),
    "utf8",
  );

  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /--bs-motion-enter/);
  assert.match(css, /\.bs-motion-page/);
  assert.match(css, /\.botshield-analytics-v2/);
  assert.match(css, /\.botshield-protection-content/);
});

test("motion system is loaded through BotShieldAppFrame", async () => {
  const designSystem = await readFile(
    new URL("../app/components/design-system/BotShieldDesignSystem.jsx", import.meta.url),
    "utf8",
  );

  assert.match(designSystem, /botshield-motion\.css/);
});

test("admin pages use shared motion page class without changing routes", async () => {
  const adminExperience = await readFile(
    new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
    "utf8",
  );
  const valuePage = await readFile(
    new URL("../app/components/admin/ValuePage.jsx", import.meta.url),
    "utf8",
  );

  assert.match(adminExperience, /bs-motion-page/);
  assert.match(adminExperience, /AnimatedMetricNumber/);
  assert.match(adminExperience, /bs-motion-route/);
  assert.doesNotMatch(valuePage, /bs-motion-page/);
  assert.match(adminExperience, /screen === "value" \? <ValuePage \/>/);
});

test("hydration-safe animated metric initializes from target value", async () => {
  const motion = await readFile(
    new URL("../app/lib/botshield-motion.jsx", import.meta.url),
    "utf8",
  );

  assert.match(motion, /useState\(target\)/);
  assert.match(motion, /mountedRef/);
  assert.match(motion, /prefersReducedMotion/);
});
