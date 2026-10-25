import {
  BOTSHIELD_THEME_EMBED_HANDLE,
  resolveThemeAppEmbedStatus,
  THEME_EMBED_CONNECTION_STATE,
} from "./theme-extension-status.js";

export { BOTSHIELD_THEME_EMBED_HANDLE, THEME_EMBED_CONNECTION_STATE };

/** Shopify's App API reports activation for the published theme without extra scopes.
 * https://shopify.dev/docs/api/app-home/latest/apis/authentication-and-data/app-api
 */
export async function readThemeAppEmbedStatus() {
  if (typeof window === "undefined") {
    return resolveThemeAppEmbedStatus(null);
  }

  const extensionsApi = window.shopify?.app?.extensions;
  if (typeof extensionsApi !== "function") {
    return resolveThemeAppEmbedStatus(null);
  }

  try {
    const extensions = await extensionsApi.call(window.shopify.app);
    return resolveThemeAppEmbedStatus(extensions);
  } catch (error) {
    console.error("Failed to read theme app embed status", error);
    return {
      themeAppEmbedConnectionState: THEME_EMBED_CONNECTION_STATE.UNAVAILABLE,
      themeAppEmbedActive: false,
      themeAppEmbedStatus: "unavailable",
    };
  }
}
