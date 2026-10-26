import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const source = await readFile(new URL("../extensions/botshield-theme-app-extension/assets/botshield.js", import.meta.url), "utf8");

function run({ liquid = "false", bridge = false, search = "", host = "sarah-test.myshopify.com" } = {}) {
  const effects = [];
  const root = { dataset: { designMode: liquid, path: "/" } };
  const window = {
    Shopify: { designMode: bridge },
    location: { pathname: "/", hostname: host, search, assign: () => effects.push("redirect") },
    sessionStorage: { getItem: () => { effects.push("storage"); return ""; } },
    setTimeout: () => { effects.push("timer"); return 1; },
  };
  vm.runInNewContext(source, {
    window, document: { getElementById: () => root }, URLSearchParams,
    fetch: () => { effects.push("decision"); return new Promise(() => {}); },
  });
  return effects;
}

test("Theme Editor Liquid signal prevents all enforcement and telemetry", () => {
  assert.deepEqual(run({ liquid: "true" }), []);
});
test("Shopify designMode prevents enforcement, including demo timers", () => {
  assert.deepEqual(run({ bridge: true, host: "botshield-demo.myshopify.com" }), []);
});
test("ordinary storefront still requests a protection decision", () => {
  assert.deepEqual(run(), ["storage", "decision"]);
});
test("shopper URL parameters cannot opt out of protection", () => {
  assert.deepEqual(run({ search: "?design_mode=true&preview_theme_id=123" }), ["storage", "decision"]);
});
test("Liquid supplies Shopify's editor signal to the script", async () => {
  const liquid = await readFile(new URL("../extensions/botshield-theme-app-extension/blocks/botshield-embed.liquid", import.meta.url), "utf8");
  assert.match(liquid, /data-design-mode="{{ request.design_mode }}"/);
});
