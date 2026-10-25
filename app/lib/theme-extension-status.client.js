import {
  BOTSHIELD_THEME_EMBED_HANDLE,
  resolveThemeAppEmbedStatus,
  isPublishedThemeEmbedActive,
  THEME_EMBED_CONNECTION_STATE,
} from "./theme-extension-status.js";

export { BOTSHIELD_THEME_EMBED_HANDLE, THEME_EMBED_CONNECTION_STATE };

/**
 * Reads Shopify App Bridge embed status and placements. When supplied, the
 * independently identified published theme ID is required for verification.
 */
export async function readThemeAppEmbedStatus(publishedThemeId = null) {
  if (typeof window === "undefined") {
    return resolveThemeAppEmbedStatus(null);
  }

  const extensionsApi = window.shopify?.app?.extensions;
  if (typeof extensionsApi !== "function") {
    return resolveThemeAppEmbedStatus(null);
  }

  try {
    const extensions = await extensionsApi();
    return { ...resolveThemeAppEmbedStatus(extensions),
      publishedThemeVerified: isPublishedThemeEmbedActive(extensions, publishedThemeId),
    };
  } catch (error) {
    console.error("Failed to read theme app embed status", error);
    return {
      themeAppEmbedConnectionState: THEME_EMBED_CONNECTION_STATE.UNAVAILABLE,
      themeAppEmbedActive: false,
      themeAppEmbedStatus: "unavailable",
    };
  }
}
