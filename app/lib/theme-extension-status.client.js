export const BOTSHIELD_THEME_EMBED_HANDLE = "botshield-embed";

/**
 * Reads theme app embed activation from Shopify App Bridge (published theme only).
 * Returns null when App Bridge is unavailable (preview/local).
 */
export async function readThemeAppEmbedStatus() {
  if (typeof window === "undefined") return null;

  const extensionsApi = window.shopify?.app?.extensions;
  if (typeof extensionsApi !== "function") return null;

  try {
    const extensions = await window.shopify.app.extensions();
    for (const extension of extensions || []) {
      if (extension.type !== "theme_app_extension") continue;
      for (const block of extension.activations || []) {
        if (block.handle !== BOTSHIELD_THEME_EMBED_HANDLE) continue;
        return {
          themeAppEmbedActive: block.status === "active",
          themeAppEmbedStatus: block.status || "available",
        };
      }
    }

    return {
      themeAppEmbedActive: false,
      themeAppEmbedStatus: "available",
    };
  } catch (error) {
    console.error("Failed to read theme app embed status", error);
    return null;
  }
}
