import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBlockedPageGoBackScript,
  getExternalReferrerTarget,
  isSafeHttpUrl,
  resolveBlockedPageGoBack,
} from "../app/lib/botshield-blocked-page-go-back.js";

const STORE = "https://botshield-demo.myshopify.com";

test("isSafeHttpUrl accepts http/https and rejects unsafe protocols", () => {
  assert.equal(isSafeHttpUrl("https://www.google.com/"), true);
  assert.equal(isSafeHttpUrl("http://example.com/path"), true);
  assert.equal(isSafeHttpUrl("javascript:alert(1)"), false);
  assert.equal(isSafeHttpUrl("data:text/html,hi"), false);
  assert.equal(isSafeHttpUrl("not-a-url"), false);
  assert.equal(isSafeHttpUrl(""), false);
});

test("valid external HTTP/HTTPS referrer resolves to external navigation", () => {
  const href = getExternalReferrerTarget(
    "https://www.google.com/search?q=shop",
    STORE,
  );
  assert.equal(href, "https://www.google.com/search?q=shop");

  const action = resolveBlockedPageGoBack({
    referrer: "https://www.google.com/",
    origin: STORE,
    historyLength: 1,
  });
  assert.deepEqual(action, {
    type: "external",
    href: "https://www.google.com/",
  });
});

test("same-origin storefront referrer is ignored to avoid redirect loops", () => {
  assert.equal(
    getExternalReferrerTarget(`${STORE}/products/widget`, STORE),
    null,
  );

  const action = resolveBlockedPageGoBack({
    referrer: `${STORE}/collections/all`,
    origin: STORE,
    historyLength: 3,
  });
  assert.deepEqual(action, { type: "noop" });
});

test("no external referrer with browser history uses history.back", () => {
  const action = resolveBlockedPageGoBack({
    referrer: "",
    origin: STORE,
    historyLength: 4,
  });
  assert.deepEqual(action, { type: "historyBack" });
});

test("no external referrer and no usable history uses safe noop fallback", () => {
  const action = resolveBlockedPageGoBack({
    referrer: "",
    origin: STORE,
    historyLength: 1,
  });
  assert.deepEqual(action, { type: "noop" });
});

test("malformed and unsafe referrers are ignored safely", () => {
  assert.equal(getExternalReferrerTarget("javascript:void(0)", STORE), null);
  assert.equal(getExternalReferrerTarget("::::", STORE), null);

  const action = resolveBlockedPageGoBack({
    referrer: "javascript:alert(1)",
    origin: STORE,
    historyLength: 2,
  });
  assert.deepEqual(action, { type: "historyBack" });
});

test("inline Go Back script is navigation-only and does not bypass enforcement", () => {
  const script = buildBlockedPageGoBackScript();

  assert.match(script, /document\.referrer/);
  assert.match(script, /window\.location\.assign\(external\)/);
  assert.match(script, /window\.history\.back\(\)/);
  assert.doesNotMatch(script, /location\.assign\("\/"\)/);
  assert.doesNotMatch(script, /fetch\s*\(/);
  assert.doesNotMatch(script, /whitelist/i);
  assert.doesNotMatch(script, /blocklist/i);
  assert.doesNotMatch(script, /challengeToken/i);
  assert.doesNotMatch(script, /sessionStorage/i);
  assert.doesNotMatch(script, /localStorage/i);
  assert.doesNotMatch(script, /document\.cookie/i);
});
