import { mergeEmbeddedAppSearch } from "./embedded-app-navigation.js";

export const PROTECTION_MANAGER_QUERY_KEY = "manager";

const PROTECTION_MANAGER_ENTRIES = new Set([
  "blocklist",
  "trusted",
  "trusted-visitors",
]);

export function parseProtectionManagerEntry(search = "") {
  const normalized = search.startsWith("?") ? search.slice(1) : search;
  const manager = new URLSearchParams(normalized).get(
    PROTECTION_MANAGER_QUERY_KEY,
  );
  return PROTECTION_MANAGER_ENTRIES.has(manager) ? manager : null;
}

export function buildProtectionManagerPath(manager, currentSearch = "") {
  return mergeEmbeddedAppSearch(
    `/app/protection-rules?${PROTECTION_MANAGER_QUERY_KEY}=${encodeURIComponent(manager)}`,
    currentSearch,
  );
}

export function stripProtectionManagerSearch(search = "") {
  const normalized = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(normalized);
  params.delete(PROTECTION_MANAGER_QUERY_KEY);
  const query = params.toString();
  return query ? `?${query}` : "";
}
