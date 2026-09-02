import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const designSource = await readFile(
  new URL("../app/components/design-system/BotShieldDesignSystem.jsx", import.meta.url),
  "utf8",
);
const saveBarSource = await readFile(
  new URL("../app/hooks/use-botshield-save-bar.js", import.meta.url),
  "utf8",
);
const adminSource = await readFile(
  new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
  "utf8",
);

const settingsSource = adminSource.slice(
  adminSource.indexOf("function SettingsPage"),
  adminSource.indexOf("export default function BotShieldAdminExperience"),
);

test("toast provider keeps a stable SSR and first-client render tree", () => {
  assert.match(designSource, /function BotShieldToastProvider/);
  assert.match(designSource, /const \[useAppBridgeToast, setUseAppBridgeToast\] = useState\(false\)/);
  assert.match(designSource, /setUseAppBridgeToast\(!window\.location\.pathname\.startsWith\("\/ui-preview"\)\)/);
  assert.doesNotMatch(
    designSource,
    /if \(typeof window === "undefined" \|\| isPreviewRoute\)/,
  );
});

test("App Bridge save bar and loading bridges defer browser detection until after mount", () => {
  assert.match(saveBarSource, /function SaveBarBridgeSlot/);
  assert.match(saveBarSource, /function LoadingBridgeSlot/);
  assert.match(saveBarSource, /const \[clientReady, setClientReady\] = useState\(false\)/);
  assert.match(saveBarSource, /return createElement\(SaveBarBridgeSlot, props\)/);
  assert.match(saveBarSource, /return createElement\(LoadingBridgeSlot, \{ active \}\)/);
  assert.doesNotMatch(
    saveBarSource,
    /export function BotShieldSaveBarBridge[\s\S]*?if \(!isAppBridgeEnvironment\(\)\) \{\s*return null;/,
  );
});

test("Settings hub section state syncs from URL after mount instead of during render", () => {
  assert.match(settingsSource, /const \[activeSection, setActiveSection\] = useState\("general"\)/);
  assert.match(settingsSource, /setActiveSection\(readSettingsHubSection\(\)\)/);
  assert.doesNotMatch(
    settingsSource,
    /useState\(readSettingsHubSection\)/,
  );
});
