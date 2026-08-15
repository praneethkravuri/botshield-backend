import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const adminSource = fs.readFileSync(
  new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
  "utf8",
);
const designSource = fs.readFileSync(
  new URL("../app/components/design-system/BotShieldDesignSystem.jsx", import.meta.url),
  "utf8",
);

test("Protection remains a control plane with four real modules", () => {
  for (const label of [
    "Bot protection",
    "Network / Proxy protection",
    "Rate protection",
    "Page protection",
  ]) assert.match(adminSource, new RegExp(label.replace("/", "\\/")));
  assert.match(adminSource, /Protection policy/);
  assert.match(adminSource, /Visitor access/);
  assert.doesNotMatch(adminSource.slice(adminSource.indexOf("function ProtectionPage"), adminSource.indexOf("function IpList")), /Threat Activity|Event Explorer|Intervention rate/);
});

test("Protection controls use existing persisted actions", () => {
  assert.match(adminSource, /actions\.saveSettings\(draft\)/);
  assert.match(adminSource, /actions\.addBlockedIp/);
  assert.match(adminSource, /actions\.removeBlockedIp/);
  assert.match(adminSource, /actions\.addTrustedIp/);
  assert.match(adminSource, /actions\.removeTrustedIp/);
  assert.match(adminSource, /ReactDOM\.createPortal/);
  assert.match(adminSource, /duplicateIp/);
  assert.match(adminSource, /already on the \$\{listLabel\}/);
  assert.match(adminSource, /Remove \{trusted \? "trusted" : "blocked"\} visitor\?/);
});

test("Protection drawers and responsive layouts are scoped locally", () => {
  assert.match(designSource, /\/\* Protection control center \*\//);
  assert.match(designSource, /\.botshield-protection-modal-backdrop/);
  assert.match(designSource, /\.botshield-protection-access-grid/);
  assert.match(designSource, /@media \(max-width: 640px\)/);
});
