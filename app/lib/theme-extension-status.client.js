import {
  BOTSHIELD_THEME_EMBED_HANDLE,
  resolveThemeAppEmbedStatus,
  THEME_EMBED_CONNECTION_STATE,
} from "./theme-extension-status.js";

export { BOTSHIELD_THEME_EMBED_HANDLE, THEME_EMBED_CONNECTION_STATE };

/**
 * Reads theme app embed activation from Shopify App Bridge (published theme only).
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
    const extensions = await extensionsApi();
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
