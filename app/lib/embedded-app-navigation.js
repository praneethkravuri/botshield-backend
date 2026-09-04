/**
 * Preserve embedded Shopify Admin query params when navigating between /app routes.
 * Without shop/host (and related frame params), authenticate.admin() redirects to /auth/login.
 */
export function mergeEmbeddedAppSearch(path, currentSearch = "") {
  const normalizedSearch = currentSearch.startsWith("?")
    ? currentSearch.slice(1)
    : currentSearch;
  const [pathname, pathQuery = ""] = path.split("?");
  const merged = new URLSearchParams(normalizedSearch);

  for (const [key, value] of new URLSearchParams(pathQuery)) {
    merged.set(key, value);
  }

  const query = merged.toString();
  return query ? `${pathname}?${query}` : pathname;
}
