/* eslint-env node */
/* global globalThis */
import assert from "node:assert/strict";
import React, { act, useEffect } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot, createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import WorkspaceLoading from "../components/BotShieldWorkspaceLoading.jsx";

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "https://example.test/app" });
const saved = { window: globalThis.window, document: globalThis.document, act: globalThis.IS_REACT_ACT_ENVIRONMENT, timeout: globalThis.setTimeout, clear: globalThis.clearTimeout };
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const watchdogs = new Map();
let nextId = 100000;
globalThis.setTimeout = (fn, delay, ...args) => {
  if (delay === 12000) { const id = ++nextId; watchdogs.set(id, fn); return id; }
  return saved.timeout(fn, delay, ...args);
};
globalThis.clearTimeout = id => {
  if (watchdogs.has(id)) watchdogs.delete(id);
  else saved.clear(id);
};
let mounts = 0;
function Content() {
  useEffect(() => { mounts++; }, []);
  return React.createElement("button", { id: "existing-content" }, "Existing dashboard");
}
const tree = props => React.createElement(WorkspaceLoading, props, React.createElement(Content));
let root;
const container = dom.window.document.getElementById("root");
const errors = [];
try {
  const html = renderToString(tree({ initializing: true }));
  assert.match(html, /botshield-official-logo-transparent\.png/);
  assert.match(html, /Preparing your BotShield workspace/);
  assert.match(html, /inert=""/);
  assert.match(html, /Existing dashboard/);
  container.innerHTML = html;
  await act(async () => {
    root = hydrateRoot(container, tree({ initializing: true }), { onRecoverableError: e => errors.push(e.message) });
  });
  assert.deepEqual(errors, [], "Server and first client markup hydrate identically");
  assert.equal(mounts, 1, "Child work starts while loading is visible");
  const original = container.querySelector("#existing-content");
  assert.ok(container.querySelector('[aria-busy]') === null, "No fabricated protection status");
  assert.equal(container.querySelector('img').getAttribute('alt'), 'BotShield');
  await act(async () => root.render(tree({ initializing: false })));
  assert.equal(container.querySelector('.bs-workspace-content').hasAttribute('inert'), false, "Content usable immediately, without waiting for exit animation");
  assert.equal(container.querySelector('#existing-content'), original, "Content is never remounted by the loader");
  assert.equal(watchdogs.size, 0, "Readiness cancels watchdog");
  assert.ok(container.querySelector('.is-leaving[aria-hidden="true"]'));
  await act(async () => root.render(tree({ initializing: true, navigating: true })));
  assert.equal(container.querySelector('.bs-workspace-content').hasAttribute('inert'), false, "Background checks never reopen splash");
  assert.ok(container.querySelector('.bs-workspace-navigation-loading'));
  await act(async () => root.render(tree({ initializing: true, error: 'Polaris failed' })));
  assert.ok(container.querySelector('[role="alert"]'));
  assert.equal(container.querySelector('.bs-workspace-loading-layer'), null, "Errors immediately remove full-screen cover");
  await act(async () => root.unmount());

  root = createRoot(container);
  await act(async () => root.render(tree({ initializing: false })));
  assert.equal(container.querySelector('.bs-workspace-loading-layer'), null, "Fast loads have no manufactured splash");
  await act(async () => root.unmount());

  root = createRoot(container);
  await act(async () => root.render(tree({ initializing: true })));
  assert.equal(watchdogs.size, 1);
  await act(async () => { for (const callback of [...watchdogs.values()]) callback(); });
  assert.match(container.textContent, /taking longer than expected/);
  assert.equal(container.querySelector('.bs-workspace-content').hasAttribute('inert'), false);
  assert.equal(container.querySelector('.bs-workspace-loading-layer'), null, "Unresolved startup cannot keep the overlay forever");
  await act(async () => root.render(tree({ initializing: false })));
  assert.equal(container.querySelector('[role="alert"]'), null, "Late recovery removes timeout notice");
  await act(async () => root.render(tree({ initializing: true, navigating: true })));
  assert.equal(container.querySelector('[role="alert"]'), null, "Recovered boot does not show stale timeout on later checks");
  assert.ok(container.querySelector('.bs-workspace-navigation-loading'), "Navigation indicator resumes after late recovery");
  console.log('Workspace loading: SSR/hydration, immediate child mount/readiness, fast load, background navigation, errors, watchdog and recovery passed.');
} finally {
  if (root) await act(async () => root.unmount());
  globalThis.window = saved.window;
  globalThis.document = saved.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = saved.act;
  globalThis.setTimeout = saved.timeout;
  globalThis.clearTimeout = saved.clear;
  dom.window.close();
}
