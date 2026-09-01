export const BILLING_RETURN_PATH = "/app/billing-return";
export const BILLING_SETTINGS_PATH = "/app/settings";

const BILLING_RETURN_PARAM_KEYS = ["plan_handle", "charge_id", "shop"];

export function isBillingReturnRequest(request) {
  return new URL(request.url).pathname === BILLING_RETURN_PATH;
}

export function getBillingReturnSearchParams(request) {
  const url = new URL(request.url);
  const params = new URLSearchParams();
  for (const key of BILLING_RETURN_PARAM_KEYS) {
    const value = url.searchParams.get(key)?.trim();
    if (value) params.set(key, value);
  }
  return params;
}

/**
 * Managed App Pricing approves charges outside the embedded iframe. Shopify then
 * loads the welcome link without embedded=1, which breaks authenticate.admin()
 * unless we re-enter the app through Admin embedded navigation first.
 */
export function needsBillingReturnEmbeddedBootstrap(request) {
  const url = new URL(request.url);
  if (url.pathname !== BILLING_RETURN_PATH) return false;
  return url.searchParams.get("embedded") !== "1";
}

export function buildEmbeddedAdminBillingReturnUrl(shop, returnParams) {
  const appHandle = process.env.SHOPIFY_APP_HANDLE?.trim() || "";
  const storeHandle = String(shop || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .replace(/\.myshopify\.com$/, "");

  if (!appHandle || !storeHandle) return null;

  const url = new URL(
    `https://admin.shopify.com/store/${encodeURIComponent(storeHandle)}/apps/${encodeURIComponent(appHandle)}${BILLING_RETURN_PATH}`,
  );

  for (const [key, value] of returnParams.entries()) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

export function buildBillingSettingsRedirectPath({ updated = true } = {}) {
  const params = new URLSearchParams({ section: "billing" });
  if (updated) params.set("updated", "true");
  return `${BILLING_SETTINGS_PATH}?${params.toString()}`;
}
