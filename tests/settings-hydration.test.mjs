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
const appNavSource = await readFile(
  new URL("../app/components/BotShieldAppNavigation.jsx", import.meta.url),
  "utf8",
);
const appRouteSource = await readFile(
  new URL("../app/routes/app.jsx", import.meta.url),
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

test("Shopify web component shells defer upgrade until after client mount", () => {
  assert.match(designSource, /function BotShieldNativePage/);
  assert.match(designSource, /botshield-native-page-fallback/);
  assert.match(designSource, /function BotShieldActionButton/);
  assert.match(designSource, /botshield-action-button-fallback/);
  assert.match(designSource, /function BotShieldStatusBadge/);
  assert.match(designSource, /botshield-status-badge-fallback/);
  assert.match(appNavSource, /botshield-app-nav-fallback/);
  assert.match(appNavSource, /useBotShieldClientMount/);
  assert.doesNotMatch(appRouteSource, /<s-app-nav>/);
});

test("App Bridge save bar and loading bridges defer browser detection until after mount", () => {
  assert.match(saveBarSource, /function SaveBarBridgeSlot/);
  assert.match(saveBarSource, /function LoadingBridgeSlot/);
  assert.match(saveBarSource, /const \[clientReady, setClientReady\] = useState\(false\)/);
  assert.match(saveBarSource, /return createElement\(SaveBarBridgeSlot, props\)/);
  assert.match(saveBarSource, /return createElement\(LoadingBridgeSlot, \{ active \}\)/);
});

test("Settings hub section initializes from loader-provided SSR state", () => {
  assert.match(settingsSource, /model\.initialSettingsSection/);
  assert.match(settingsSource, /BotShieldHydrationSafeRelativeTime/);
  assert.doesNotMatch(settingsSource, /useState\(readSettingsHubSection\)/);
});

test("embedded app registers Shopify navigate handling for s-link compatibility", () => {
  assert.match(appRouteSource, /shopify:navigate/);
  assert.match(appRouteSource, /document\.addEventListener\("shopify:navigate"/);
});
