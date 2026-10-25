import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { RouterProvider, createMemoryRouter } from "react-router";
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import { readFile } from "node:fs/promises";
import {
  PUBLIC_LEGAL_URLS,
  SETTINGS_INFORMATION_PATHS,
} from "../app/lib/settings-information.js";

let vite;
let InformationLink;
const pages = {};
const embeddedSearch =
  "?shop=test.myshopify.com&host=encoded-admin-host&embedded=1&section=privacy&view=analytics";

before(async () => {
  vite = await createServer({
    server: { middlewareMode: true },
    appType: "custom",
  });
  InformationLink = (
    await vite.ssrLoadModule(
      "/app/components/information/SettingsInformationLink.jsx",
    )
  ).default;
  for (const slug of ["data-use", "data-retention"]) {
    pages[slug] = {
      internal: (
        await vite.ssrLoadModule(`/app/routes/app.information.${slug}.jsx`)
      ).default,
      public: (await vite.ssrLoadModule(`/app/routes/${slug}.jsx`)).default,
    };
  }
});

after(async () => {
  await vite?.close();
});

function render(element, path = `/app/settings${embeddedSearch}`) {
  const router = createMemoryRouter([{ path: "*", element }], {
    initialEntries: [path],
  });
  const html = renderToStaticMarkup(
    React.createElement(RouterProvider, { router }),
  );
  router.dispose();
  return new JSDOM(html).window.document;
}

test("all five Settings controls choose internal app routes or established public legal URLs", async () => {
  const adminSource = await readFile(
    new URL(
      "../app/components/admin/BotShieldAdminExperience.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const privacySection = adminSource.slice(
    adminSource.indexOf('if (activeSection === "privacy")'),
    adminSource.indexOf('if (activeSection === "diagnostics")'),
  );
  const controls = [
    ...privacySection.matchAll(
      /<SettingsHubLegalLink href="([^"]+)">\s*([^<]+?)\s*<\/SettingsHubLegalLink>/g,
    ),
  ];
  assert.equal(controls.length, 5);
  for (const [, href, label] of controls) {
    const document = render(
      React.createElement(InformationLink, { href }, label),
    );
    const link = document.querySelector("a");
    assert.ok(link.textContent.includes(label));
    assert.ok(!link.href.includes("onrender.com"));
    if (SETTINGS_INFORMATION_PATHS[href]) {
      const url = new URL(link.href, "https://app.test");
      assert.equal(url.pathname, SETTINGS_INFORMATION_PATHS[href]);
      for (const key of ["shop", "host", "embedded"]) {
        assert.equal(
          url.searchParams.get(key),
          new URLSearchParams(embeddedSearch).get(key),
        );
      }
      assert.equal(link.getAttribute("target"), null);
    } else {
      assert.equal(link.href, PUBLIC_LEGAL_URLS[href]);
      assert.equal(link.target, "_blank");
      assert.match(link.rel, /noopener/);
      assert.match(link.textContent, /opens in a new tab/);
      assert.equal(new URL(link.href).search, "");
    }
  }
});

test("internal documents preserve public policy content, provide back navigation, and keep related links safe", () => {
  for (const [slug, components] of Object.entries(pages)) {
    const internal = render(
      React.createElement(components.internal),
      `/app/information/${slug}${embeddedSearch}`,
    );
    const publicDocument = render(
      React.createElement(components.public),
      `/${slug}`,
    );
    // Compare the actual rendered policy paragraphs, lists and category tables.
    for (const selector of [
      ".public-legal-section",
      ".public-legal-data-grid",
    ]) {
      assert.deepEqual(
        [...internal.querySelectorAll(selector)].map(
          (node) => node.textContent,
        ),
        [...publicDocument.querySelectorAll(selector)].map(
          (node) => node.textContent,
        ),
      );
    }
    assert.equal(internal.querySelectorAll("h1").length, 1);
    const back = new URL(
      internal.querySelector(".botshield-information-back").href,
      "https://app.test",
    );
    assert.equal(back.pathname, "/app/settings");
    assert.equal(back.searchParams.get("section"), "privacy");
    assert.equal(back.searchParams.get("view"), "settings");
    assert.equal(back.searchParams.get("host"), "encoded-admin-host");
    for (const anchor of internal.querySelectorAll(
      ".botshield-information-contents a",
    )) {
      assert.ok(internal.getElementById(anchor.getAttribute("href").slice(1)));
    }
    for (const link of internal.querySelectorAll(".public-legal-related a")) {
      const url = new URL(link.href, "https://app.test");
      assert.ok(
        url.pathname.startsWith("/app/") || url.hostname === "botshieldapp.com",
      );
      assert.ok(!link.href.includes("onrender.com"));
    }
  }
});

test("direct route loads, client navigation, document changes, and back to Settings work under an authenticated parent", async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: "https://app.test/app/settings",
  });
  const saved = {
    window: globalThis.window,
    document: globalThis.document,
    act: globalThis.IS_REACT_ACT_ENVIRONMENT,
  };
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.scrollTo = () => {};
  dom.window.shopify = { toast: { show() {} } };
  let authenticatedLoads = 0;
  const routes = [
    {
      path: "/app",
      // A synthetic authenticated session; real Shopify authentication is not bypassed in application code.
      loader: () => {
        authenticatedLoads++;
        return {};
      },
      children: [
        {
          path: "settings",
          element: React.createElement(
            InformationLink,
            { href: "/data-use" },
            "View data use",
          ),
        },
        ...Object.entries(pages).map(([slug, components]) => ({
          path: `information/${slug}`,
          element: React.createElement(components.internal),
        })),
      ],
    },
  ];
  let root;
  let router;
  try {
    for (const slug of Object.keys(pages)) {
      // A new router models a full refresh directly on each URL.
      router = createMemoryRouter(routes, {
        initialEntries: [`/app/information/${slug}${embeddedSearch}`],
      });
      root = createRoot(dom.window.document.getElementById("root"));
      await act(async () => {
        root.render(React.createElement(RouterProvider, { router }));
      });
      assert.equal(router.state.errors, null);
      assert.ok(dom.window.document.querySelector("h1"));
      assert.equal(dom.window.document.activeElement.tagName, "H1");
      const back = dom.window.document.querySelector(
        ".botshield-information-back",
      );
      await act(async () => {
        back.dispatchEvent(
          new dom.window.MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            button: 0,
          }),
        );
      });
      assert.equal(router.state.location.pathname, "/app/settings");
      assert.equal(
        new URLSearchParams(router.state.location.search).get("section"),
        "privacy",
      );
      await act(async () => {
        dom.window.document
          .querySelector("a")
          .dispatchEvent(
            new dom.window.MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              button: 0,
            }),
          );
      });
      assert.equal(router.state.location.pathname, "/app/information/data-use");
      assert.equal(
        dom.window.document.querySelector("h1").textContent,
        "Data Use",
      );
      const retention = [
        ...dom.window.document.querySelectorAll(".public-legal-related a"),
      ].find((a) => a.textContent === "Data retention");
      await act(async () => {
        retention.dispatchEvent(
          new dom.window.MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            button: 0,
          }),
        );
      });
      assert.equal(
        router.state.location.pathname,
        "/app/information/data-retention",
      );
      assert.equal(
        dom.window.document.querySelector("h1").textContent,
        "Data Retention",
      );
      await act(async () => root.unmount());
      root = null;
      router.dispose();
    }
    assert.ok(authenticatedLoads >= 2);
  } finally {
    if (root) await act(async () => root.unmount());
    router?.dispose();
    globalThis.window = saved.window;
    globalThis.document = saved.document;
    globalThis.IS_REACT_ACT_ENVIRONMENT = saved.act;
    dom.window.close();
  }
});
