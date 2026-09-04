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



test("Shopify hydration-safe shells keep approved s-page and s-button markup", () => {

  assert.match(designSource, /function BotShieldNativePage/);

  assert.match(designSource, /<s-page heading=\{heading\}>/);

  assert.match(designSource, /function BotShieldActionButton/);

  assert.match(designSource, /<s-button/);

  assert.match(designSource, /useBotShieldCustomElementClick/);

  assert.match(appRouteSource, /BotShieldAppNavigation/);

  assert.doesNotMatch(appRouteSource, /return null;/);

});



const asyncButtonSource = designSource.slice(

  designSource.indexOf("export function BotShieldAsyncButton"),

  designSource.indexOf("export function BotShieldBanner"),

);



const diagnosticsSettingsSource = settingsSource.slice(

  settingsSource.indexOf('if (activeSection === "diagnostics")'),

  settingsSource.indexOf('return (\n      <section className="botshield-settings-hub-section is-panel-danger"'),

);



test("BotShieldAsyncButton uses a stable Polaris stack wrapper on SSR and client", () => {

  assert.doesNotMatch(asyncButtonSource, /useBotShieldClientMount/);

  assert.doesNotMatch(asyncButtonSource, /botshield-async-button-fallback/);

  assert.match(asyncButtonSource, /<BotShieldStack gap="small-200">/);

  assert.match(asyncButtonSource, /<BotShieldText tone="critical" role="alert">/);

});



test("BotShieldAsyncButton preserves loading and error behavior after mount", () => {

  assert.match(asyncButtonSource, /loading={asyncAction\.loading}/);

  assert.match(asyncButtonSource, /onClick={asyncAction\.run}/);

  assert.match(asyncButtonSource, /<BotShieldText tone="critical" role="alert">/);

});



test("Settings diagnostics uses BotShieldAsyncButton for scan actions", () => {

  assert.match(diagnosticsSettingsSource, /BotShieldAsyncButton/);

  assert.match(diagnosticsSettingsSource, /Run diagnostic scan/);

  assert.match(diagnosticsSettingsSource, /Run simulation scan/);

  assert.match(diagnosticsSettingsSource, /Refresh status/);

  assert.match(diagnosticsSettingsSource, /actions\.runDiagnostic/);

  assert.match(diagnosticsSettingsSource, /actions\.runSimulation/);

  assert.match(diagnosticsSettingsSource, /actions\.refreshApplicationStatus/);

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

  assert.match(settingsSource, /BotShieldHydrationRelativeTime/);

  assert.match(adminSource, /BotShieldStack/);

  assert.match(adminSource, /formatHydrationStableDateTime/);

  assert.doesNotMatch(settingsSource, /useState\(readSettingsHubSection\)/);

});



test("embedded app defers polaris.js until after hydration", async () => {

  assert.match(appRouteSource, /BotShieldEmbeddedAppProvider apiKey=\{apiKey\}/);

  const providerSource = await readFile(

    new URL("../app/components/BotShieldEmbeddedAppProvider.jsx", import.meta.url),

    "utf8",

  );

  assert.match(providerSource, /ensurePolarisInitialized/);

});

