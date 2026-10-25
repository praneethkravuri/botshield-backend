/* eslint-env node */
/** Synthetic-session acceptance checks. Requires a local preview with mocked authentication.
 * Install browser tooling outside the app: see docs/merchant-onboarding-release.md.
 * Never point this script at a merchant store or production URL.
 */
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const base =
  process.env.BOTSHIELD_ONBOARDING_BASE_URL || "http://127.0.0.1:3101";
assert.ok(
  ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "Use a local synthetic-session preview only",
);
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const output =
  process.env.BOTSHIELD_SCREENSHOTS || "/tmp/botshield-onboarding-screenshots";
const polaris = await readFile(process.env.BOTSHIELD_POLARIS_SCRIPT, "utf8");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const query = "?shop=onboarding-test.myshopify.com&host=dGVzdA&embedded=1";
const failures = [];
let checks = 0;

async function scenario(name, run) {
  try {
    await run();
    checks += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push({ name, error: error.stack });
    console.error(`FAIL ${name}: ${error.message}`);
  } finally {
    for (const context of browser.contexts())
      await context.close().catch(() => {});
  }
}
async function setup({
  state = "inactive",
  acknowledged = false,
  reducedMotion = "no-preference",
  delay = 0,
  deviceScaleFactor = 1,
} = {}) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    reducedMotion,
    deviceScaleFactor,
  });
  const model = {
    state,
    acknowledged,
    delay,
    requests: 0,
    posts: 0,
  };
  await context.addInitScript(
    ({ state }) => {
      window.__activationState = state;
      window.__activationDelay = 0;
      window.__activationCalls = 0;
      window.shopify = {
        toast: { show() {} },
        loading() {},
        saveBar: {
          show: async () => {},
          hide: async () => {},
          leaveConfirmation: async () => {},
        },
        environment: { embedded: true },
        app: {
          extensions: async () => {
            window.__activationCalls += 1;
            const state = window.__activationState;
            if (window.__activationDelay)
              await new Promise((resolve) =>
                setTimeout(resolve, window.__activationDelay),
              );
            if (state === "unavailable")
              throw new Error("Synthetic temporary failure");
            return state === "missing"
              ? []
              : [
                  {
                    type: "theme_app_extension",
                    activations: [
                      {
                        handle: "botshield-embed",
                        target: "body",
                        status:
                          state === "active"
                            ? "active"
                            : state === "unusable"
                              ? "unavailable"
                              : "available",
                      },
                    ],
                  },
                ];
          },
        },
      };
    },
    { state },
  );
  await context.route("https://**/*", (route) =>
    route.fulfill({
      contentType: route.request().url().endsWith(".css")
        ? "text/css"
        : "text/javascript",
      body: route.request().url().endsWith("/polaris.js") ? polaris : "",
    }),
  );
  await context.route("**/api/**", async (route) => {
    let payload = {};
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/onboarding") {
      if (route.request().method() === "POST") {
        model.acknowledged = true;
        model.posts += 1;
        payload = { acknowledged: true };
      } else {
        model.requests += 1;
        if (model.delay)
          await new Promise((resolve) => setTimeout(resolve, model.delay));
        payload = {
          shop:
            new URL(route.request().headers().referer).searchParams.get(
              "shop",
            ) || "onboarding-test.myshopify.com",
          acknowledged: model.acknowledged,
        };
      }
    } else if (pathname === "/api/status")
      payload = {
        status: {
          shop: "onboarding-test.myshopify.com",
          appInstalled: true,
          protectionActive: true,
        },
      };
    else if (pathname === "/api/billing-status")
      payload = { billing: { active: true } };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return { context, page, model, errors };
}
async function state(page, value) {
  await page.evaluate((value) => {
    window.__activationState = value;
  }, value);
}

async function selectStep(page, index) {
  await page.locator(".ob-progress button").nth(index).click();
  await page.waitForFunction(
    () => document.activeElement?.id === "ob-step-title",
  );
}
async function waitIdle(page) {
  await page.waitForFunction(
    () =>
      !document.querySelector("s-button[loading=true]") &&
      !document.querySelector(".is-checking"),
  );
}
async function assertOfficialLogos(page) {
  await page.waitForFunction(() => {
    const logos = [...document.querySelectorAll(".ob-official-logo")];
    return (
      logos.length > 0 &&
      logos.every(
        (logo) =>
          logo.complete &&
          logo.naturalWidth === 208 &&
          logo.naturalHeight === 256,
      )
    );
  });
  const logos = await page.locator(".ob-official-logo").evaluateAll((images) =>
    images.map((image) => {
      const bounds = image.getBoundingClientRect();
      const style = getComputedStyle(image);
      return {
        source: new URL(image.currentSrc).pathname,
        width: bounds.width,
        height: bounds.height,
        filter: style.filter,
        blend: style.mixBlendMode,
        nativeWidth: image.naturalWidth,
        nativeHeight: image.naturalHeight,
        dpr: devicePixelRatio,
      };
    }),
  );
  for (const logo of logos) {
    assert.equal(logo.source, "/botshield-official-logo-transparent.png");
    assert.equal(logo.filter, "none");
    assert.equal(logo.blend, "normal");
    if (logo.width && logo.height) {
      assert.ok(
        Math.abs(logo.width / logo.height - 208 / 256) < 0.005,
        "Official logo retains native proportions",
      );
      assert.ok(
        logo.nativeWidth >= logo.width * logo.dpr - 1,
        "Native artwork resolves horizontal device pixels",
      );
      assert.ok(
        logo.nativeHeight >= logo.height * logo.dpr - 1,
        "Native artwork resolves vertical device pixels",
      );
    }
  }
}

async function screenshot(page, name) {
  await page.addStyleTag({ content: "s-app-nav { display: none; }" });
  await page.screenshot({
    path: `${output}/${name}.png`,
    fullPage: true,
    animations: "disabled",
  });
}

try {
  await scenario(
    "first-install routing, editor URL, instructions, focus, pause and manual verification",
    async () => {
      const { context, page, model, errors } = await setup();
      await page.goto(`${base}/app${query}`);
      await page.waitForURL("**/app/onboarding?**");
      await page.waitForFunction(() =>
        document
          .querySelector(".ob-profile strong")
          ?.textContent.includes("onboarding-test"),
      );
      await assertOfficialLogos(page);
      assert.equal(await page.locator(".ob-official-logo").count(), 5);
      await screenshot(page, "welcome-desktop");
      assert.equal(new URL(page.url()).searchParams.get("host"), "dGVzdA");
      assert.equal(await page.locator(".ob-success").count(), 0);
      await page
        .getByRole("button", { name: "Pause tutorial", exact: true })
        .click();
      assert.equal(
        await page
          .locator(".ob-demo-toggle")
          .evaluate((node) => getComputedStyle(node).animationPlayState),
        "paused",
      );
      assert.equal(
        await page
          .locator(".ob-welcome-logo")
          .evaluate(
            (node) => getComputedStyle(node, "::before").animationPlayState,
          ),
        "paused",
      );
      await page.getByRole("button", { name: "Replay", exact: true }).click();
      assert.equal(
        await page
          .locator(".ob-demo-toggle")
          .evaluate((node) => getComputedStyle(node).animationPlayState),
        "running",
      );
      const popupPromise = page.waitForEvent("popup");
      await page
        .getByRole("button", { name: "Open Theme Editor", exact: true })
        .click();
      const popup = await popupPromise;
      await popup.waitForLoadState();
      const editor = new URL(popup.url());
      assert.equal(editor.hostname, "onboarding-test.myshopify.com");
      assert.equal(editor.pathname, "/admin/themes/current/editor");
      assert.equal(
        editor.searchParams.get("activateAppId"),
        "local-test-api-key/botshield-embed",
      );
      await popup.close();
      assert.equal(
        await page.locator(".ob-success").count(),
        0,
        "Opening editor must never complete onboarding",
      );
      assert.equal(
        await page.locator("#ob-step-title").innerText(),
        "Enable BotShield",
      );
      await screenshot(page, "enable-and-save-desktop");
      await page
        .getByText("View written instructions", { exact: true })
        .click();
      assert.ok(await page.locator("details").evaluate((node) => node.open));
      await selectStep(page, 2);
      assert.equal(
        await page.evaluate(() => document.activeElement?.id),
        "ob-step-title",
      );
      await screenshot(page, "verify-inactive-desktop");
      assert.match(
        await page.locator(".ob-verification").innerText(),
        /not yet enabled/,
      );
      await state(page, "unavailable");
      await page
        .getByRole("button", { name: "Check activation", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Retry activation check", exact: true })
        .waitFor();
      await screenshot(page, "verify-unavailable-desktop");
      assert.equal(await page.locator(".ob-success").count(), 0);
      await state(page, "missing");
      await page
        .getByRole("button", { name: "Retry activation check", exact: true })
        .click();
      await page
        .getByText("Shopify could not find the BotShield app embed.", {
          exact: true,
        })
        .first()
        .waitFor();
      await state(page, "unusable");
      await page
        .getByRole("button", { name: "Check activation", exact: true })
        .click();
      await page
        .getByText(
          "Shopify reports that the BotShield app embed is not currently usable.",
          { exact: true },
        )
        .first()
        .waitFor();
      assert.equal(await page.locator(".ob-success").count(), 0);
      await screenshot(page, "verify-unusable-desktop");
      await state(page, "active");
      await page.evaluate(() => {
        window.__activationDelay = 1000;
      });
      await page
        .getByRole("button", { name: "Check activation", exact: true })
        .click();
      await page.locator(".is-checking").waitFor();
      await screenshot(page, "verification-checking");
      await page.locator(".ob-success").waitFor();
      await assertOfficialLogos(page);
      assert.equal(
        await page.locator(".ob-success .ob-official-logo").count(),
        1,
      );
      await screenshot(page, "verified-success");
      await page.waitForURL((url) => url.pathname === "/app");
      assert.equal(new URL(page.url()).searchParams.get("host"), "dGVzdA");
      await page.waitForTimeout(900);
      assert.equal(await page.locator(".botshield-setup-reminder").count(), 0);
      await screenshot(page, "overview-after-onboarding");
      await page.reload();
      await page.waitForTimeout(1000);
      assert.equal(new URL(page.url()).pathname, "/app");
      assert.ok(model.posts >= 1);
      assert.deepEqual(errors, []);
      await context.close();
    },
  );
  await scenario(
    "returning active merchants, intentional review and Settings entry",
    async () => {
      const { context, page, errors } = await setup({
        state: "active",
        acknowledged: true,
      });
      await page.goto(`${base}/app${query}`);
      await page.waitForTimeout(800);
      assert.equal(new URL(page.url()).pathname, "/app");
      await page.goto(`${base}/app/settings${query}&section=connections`);
      await page
        .getByRole("button", { name: "Setup guide", exact: true })
        .click();
      await page.waitForURL("**/app/onboarding?**");
      await page.locator(".ob-already-active").waitFor();
      await page.waitForTimeout(2800);
      assert.equal(
        new URL(page.url()).pathname,
        "/app/onboarding",
        "Intentional review stays open",
      );
      await page.getByRole("link", { name: "Explore dashboard" }).click();
      await page.waitForURL((url) => url.pathname === "/app");
      await page.goBack();
      assert.equal(new URL(page.url()).pathname, "/app/onboarding");
      assert.deepEqual(errors, []);
      await context.close();
    },
  );
  await scenario(
    "disabled returning merchant keeps Overview and sees reminder",
    async () => {
      const { context, page } = await setup({ acknowledged: true });
      await page.goto(`${base}/app${query}`);
      await page.getByRole("link", { name: /Complete setup/ }).waitFor();
      assert.equal(new URL(page.url()).pathname, "/app");
      await page.getByRole("link", { name: /Complete setup/ }).click();
      await page.waitForURL("**/app/onboarding?**");
      await page.getByRole("link", { name: "Explore dashboard" }).click();
      await page.waitForURL((url) => url.pathname === "/app");
      await page.reload();
      await page.getByRole("link", { name: /Complete setup/ }).waitFor();
      assert.equal(new URL(page.url()).pathname, "/app");
      await context.close();
    },
  );
  await scenario(
    "return-to-tab check, request deduplication and stale-success invalidation",
    async () => {
      const { context, page, model } = await setup({ acknowledged: true });
      await page.goto(`${base}/app/onboarding${query}`);
      await selectStep(page, 2);
      await waitIdle(page);
      model.delay = 600;
      const before = model.requests;
      await page.evaluate(() => {
        window.dispatchEvent(new Event("focus"));
        window.dispatchEvent(new Event("focus"));
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await page.waitForTimeout(900);
      assert.equal(model.requests - before, 1);
      await state(page, "active");
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await page.locator(".ob-success").waitFor();
      await page
        .getByRole("button", { name: "Stay on this page", exact: true })
        .click();
      await state(page, "unavailable");
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await page
        .getByRole("button", { name: "Retry activation check", exact: true })
        .waitFor();
      assert.equal(await page.locator(".ob-success").count(), 0);
      assert.match(
        await page.locator(".ob-verification").innerText(),
        /Last verified result: active/,
      );
      await page.waitForTimeout(2700);
      assert.equal(new URL(page.url()).pathname, "/app/onboarding");
      await context.close();
    },
  );
  await scenario(
    "return during an in-flight check schedules a fresh scope-free result",
    async () => {
      const { context, page, errors } = await setup({ acknowledged: true });
      await page.goto(`${base}/app/onboarding${query}`);
      await selectStep(page, 2);
      await waitIdle(page);
      const beforeCalls = await page.evaluate(() => window.__activationCalls);
      await page.evaluate(() => {
        window.__activationDelay = 700;
      });
      await page
        .getByRole("button", { name: "Check activation", exact: true })
        .click();
      await page.waitForFunction(
        (count) => window.__activationCalls > count,
        beforeCalls,
      );
      await state(page, "active");
      await page.evaluate(() => {
        window.dispatchEvent(new Event("focus"));
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await page.locator(".ob-success").waitFor();
      assert.ok(
        await page.evaluate(
          (count) => window.__activationCalls >= count + 2,
          beforeCalls,
        ),
      );
      assert.deepEqual(errors, []);
      await context.close();
    },
  );
  await scenario(
    "App Bridge readiness after the initial unavailable read triggers a fresh check",
    async () => {
      const { context, page } = await setup({
        state: "unavailable",
        acknowledged: true,
        delay: 600,
      });
      await page.goto(`${base}/app/onboarding${query}`);
      await page.waitForFunction(() => window.__activationCalls >= 1);
      await state(page, "active");
      await page.evaluate(() =>
        document
          .querySelector(
            'script[src="https://cdn.shopify.com/shopifycloud/app-bridge.js"]',
          )
          .dispatchEvent(new Event("load")),
      );
      await page.locator(".ob-already-active").waitFor();
      assert.ok(await page.evaluate(() => window.__activationCalls >= 2));
      await context.close();
    },
  );
  await scenario(
    "scope-free App Bridge activation completes without theme IDs or permission prompts",
    async () => {
      const { context, page } = await setup({ state: "inactive" });
      const unexpectedRequests = [];
      page.on("request", (request) => {
        if (/graphql|oauth|request.*scope|themes\.json/.test(request.url()))
          unexpectedRequests.push(request.url());
      });
      await page.goto(`${base}/app/onboarding${query}`);
      await selectStep(page, 2);
      await waitIdle(page);
      await state(page, "active");
      await page
        .getByRole("button", { name: "Check activation", exact: true })
        .click();
      await page.locator(".ob-success").waitFor();
      assert.deepEqual(unexpectedRequests, []);
      assert.doesNotMatch(
        await page.locator("main").innerText(),
        /theme access|permission/,
      );
      await screenshot(page, "scope-free-activation-success");
      await page.waitForURL((url) => url.pathname === "/app");
      await context.close();
    },
  );
  await scenario(
    "profile save failure allows dashboard exit without a redirect loop",
    async () => {
      const { context, page } = await setup();
      await context.route("**/api/onboarding", async (route) => {
        if (route.request().method() === "POST")
          return route.fulfill({
            status: 503,
            contentType: "application/json",
            body: '{"error":"Synthetic failure"}',
          });
        return route.fallback();
      });
      await page.goto(`${base}/app/onboarding${query}`);
      await page
        .getByRole("button", { name: "Retry saving guide visit", exact: true })
        .waitFor();
      await page.getByRole("link", { name: "Explore dashboard" }).click();
      await page.waitForURL((url) => url.pathname === "/app");
      await page.waitForTimeout(800);
      assert.equal(new URL(page.url()).pathname, "/app");
      await context.close();
    },
  );
  await scenario("route refresh restores the selected guide step", async () => {
    const { context, page } = await setup({ acknowledged: true });
    await page.goto(`${base}/app/onboarding${query}`);
    await page.waitForFunction(() =>
      document
        .querySelector(".ob-profile strong")
        ?.textContent.includes("onboarding-test"),
    );
    await selectStep(page, 2);
    await page.reload();
    await page
      .getByRole("heading", { name: "Verify activation", exact: true })
      .waitFor();
    assert.equal(
      new URL(page.url()).searchParams.get("shop"),
      "onboarding-test.myshopify.com",
    );
    await context.close();
  });
  await scenario(
    "embedded content frame fits a simulated Shopify Admin content area",
    async () => {
      const { context, page } = await setup({ acknowledged: true });
      // Shopify's production frame-ancestors policy correctly rejects a localhost parent.
      // Adapt only the synthetic response header for this local layout exercise.
      await context.route("**/app/onboarding?**", async (route) => {
        const response = await route.fetch();
        const headers = {
          ...response.headers(),
          "content-security-policy": "frame-ancestors 'self'",
        };
        await route.fulfill({ response, headers });
      });
      await context.route(`${base}/__synthetic-admin`, (route) =>
        route.fulfill({
          contentType: "text/html",
          body: `<html><body style="margin:0"><iframe title="Simulated Shopify Admin content" style="border:0;width:1024px;height:900px" src="${base}/app/onboarding${query}"></iframe></body></html>`,
        }),
      );
      await page.goto(`${base}/__synthetic-admin`);
      const frame = page.frameLocator("iframe");
      await frame
        .getByRole("heading", { name: /Let’s get your store/ })
        .waitFor();
      assert.ok(
        await frame
          .locator("html")
          .evaluate((node) => node.scrollWidth <= innerWidth),
      );
      await screenshot(page, "simulated-shopify-admin-content-area");
      await context.close();
    },
  );
  await scenario(
    "official transparent logo stays sharp and undistorted at 3x device pixel ratio",
    async () => {
      const { context, page, errors } = await setup({
        acknowledged: true,
        deviceScaleFactor: 3,
        reducedMotion: "reduce",
      });
      await page.goto(`${base}/app/onboarding${query}`);
      await assertOfficialLogos(page);
      await screenshot(page, "official-brand-desktop-3x");
      await page.setViewportSize({ width: 390, height: 950 });
      await assertOfficialLogos(page);
      assert.ok(await page.locator(".ob-welcome-logo img").isVisible());
      await screenshot(page, "official-brand-mobile-3x");
      await selectStep(page, 2);
      await waitIdle(page);
      await state(page, "active");
      await page
        .getByRole("button", { name: "Check activation", exact: true })
        .click();
      await page.locator(".ob-success").waitFor();
      await page
        .getByRole("button", { name: "Stay on this page", exact: true })
        .click();
      await assertOfficialLogos(page);
      await screenshot(page, "official-brand-success-3x");
      assert.deepEqual(errors, []);
      await context.close();
    },
  );
  await scenario(
    "all required viewport widths and reduced motion, keyboard, accessibility",
    async () => {
      const { context, page, errors } = await setup({
        acknowledged: true,
        reducedMotion: "reduce",
      });
      await page.goto(`${base}/app/onboarding${query}`);
      await page.waitForFunction(() =>
        document
          .querySelector(".ob-profile strong")
          ?.textContent.includes("onboarding-test"),
      );
      for (const width of [1440, 1280, 1024, 768, 390, 360]) {
        await page.setViewportSize({ width, height: 950 });
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `No horizontal overflow at ${width}`,
        );
        for (const step of [0, 1, 2]) {
          await selectStep(page, step);
          assert.ok(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            `Step ${step + 1} fits ${width}`,
          );
        }
        await selectStep(page, 0);
        await assertOfficialLogos(page);
        await screenshot(page, `onboarding-${width}-reduced-motion`);
        if (width === 390) {
          await selectStep(page, 1);
          await screenshot(page, "enable-and-save-mobile");
          await selectStep(page, 2);
          await screenshot(page, "verify-activation-mobile");
        }
      }
      assert.equal(
        await page
          .locator(".ob-demo-toggle")
          .evaluate((node) => getComputedStyle(node).animationName),
        "none",
      );
      await selectStep(page, 0);
      await page.locator(".ob-progress button").first().focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Enter");
      await page
        .getByRole("heading", { name: "Enable BotShield", exact: true })
        .waitFor();
      assert.equal(
        await page.locator("#ob-step-title").innerText(),
        "Enable BotShield",
      );
      if (process.env.AXE_MODULE) {
        const { default: AxeBuilder } = await import(process.env.AXE_MODULE);
        const results = [];
        for (const width of [1280, 360]) {
          await page.setViewportSize({ width, height: 950 });
          for (const step of [0, 1, 2]) {
            await selectStep(page, step);
            const result = await new AxeBuilder({ page })
              .include(".botshield-onboarding")
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze();
            results.push({
              width,
              step: step + 1,
              violations: result.violations,
            });
          }
        }
        await import("node:fs/promises").then((fs) =>
          fs.writeFile(
            `${output}/axe-results.json`,
            JSON.stringify(results, null, 2),
          ),
        );
        assert.deepEqual(
          results
            .filter((result) => result.violations.length)
            .map((result) => ({
              width: result.width,
              step: result.step,
              violations: result.violations.map((v) => ({
                id: v.id,
                targets: v.nodes.map((n) => n.target),
              })),
            })),
          [],
        );
      }
      assert.deepEqual(errors, []);
      await context.close();
    },
  );
} finally {
  await browser.close();
}
console.log(
  JSON.stringify(
    {
      passed: checks,
      failed: failures.length,
      failures,
      screenshots: pathToFileURL(output).href,
    },
    null,
    2,
  ),
);
if (failures.length) process.exitCode = 1;
