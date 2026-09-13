import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProtectionManagerPath,
  parseProtectionManagerEntry,
  PROTECTION_MANAGER_QUERY_KEY,
  stripProtectionManagerSearch,
} from "../app/lib/protection-manager-entry.js";

const embeddedSearch =
  "?shop=test.myshopify.com&host=abc123&embedded=1&manager=blocklist";

test("parseProtectionManagerEntry reads manager from cold URL after sibling-route remount", () => {
  assert.equal(parseProtectionManagerEntry(embeddedSearch), "blocklist");
  assert.equal(parseProtectionManagerEntry("?manager=trusted"), "trusted");
  assert.equal(
    parseProtectionManagerEntry("?manager=trusted-visitors"),
    "trusted-visitors",
  );
  assert.equal(parseProtectionManagerEntry("?manager=bot"), null);
  assert.equal(parseProtectionManagerEntry("?shop=test.myshopify.com"), null);
});

test("buildProtectionManagerPath preserves embedded frame params", () => {
  assert.equal(
    buildProtectionManagerPath("blocklist", "?shop=test.myshopify.com&host=abc"),
    "/app/protection-rules?shop=test.myshopify.com&host=abc&manager=blocklist",
  );
  assert.equal(
    buildProtectionManagerPath("trusted", "?host=abc&shop=test.myshopify.com"),
    "/app/protection-rules?host=abc&shop=test.myshopify.com&manager=trusted",
  );
});

test("stripProtectionManagerSearch removes manager once without dropping embedded params", () => {
  assert.equal(
    stripProtectionManagerSearch(embeddedSearch),
    "?shop=test.myshopify.com&host=abc123&embedded=1",
  );
  assert.equal(stripProtectionManagerSearch("?manager=blocklist"), "");
});

test("remount simulation: fresh state with null intent still resolves manager from URL", () => {
  const remountedSearch = buildProtectionManagerPath(
    "blocklist",
    "?shop=test.myshopify.com&host=abc",
  );
  const protectionEntryIntent = null;
  const manager = parseProtectionManagerEntry(
    remountedSearch.slice(remountedSearch.indexOf("?")),
  );

  assert.equal(protectionEntryIntent, null);
  assert.equal(manager, "blocklist");
  assert.equal(PROTECTION_MANAGER_QUERY_KEY, "manager");
});
