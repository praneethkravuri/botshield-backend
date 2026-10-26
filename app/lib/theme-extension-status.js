export const BOTSHIELD_THEME_EMBED_HANDLE = "botshield-embed";

export const THEME_EMBED_CONNECTION_STATE = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  MISSING: "missing",
  UNAVAILABLE: "unavailable",
  UNUSABLE: "unusable",
};

export function resolveThemeAppEmbedStatus(extensions) {
  if (extensions == null) {
    return {
      themeAppEmbedConnectionState: THEME_EMBED_CONNECTION_STATE.UNAVAILABLE,
      themeAppEmbedActive: false,
      themeAppEmbedStatus: "unavailable",
    };
  }

  if (!Array.isArray(extensions)) {
    return {
      themeAppEmbedConnectionState: THEME_EMBED_CONNECTION_STATE.UNAVAILABLE,
      themeAppEmbedActive: false,
      themeAppEmbedStatus: "unavailable",
    };
  }

  for (const extension of extensions) {
    if (extension?.type !== "theme_app_extension") continue;
    if (!Array.isArray(extension.activations))
      return resolveThemeAppEmbedStatus(null);
    for (const block of extension.activations) {
      if (block?.handle !== BOTSHIELD_THEME_EMBED_HANDLE) continue;
      // Shopify documents app.extensions() as published-theme only. Placement IDs
      // and Admin API theme access are neither needed nor authoritative here.
      const states = {
        active: THEME_EMBED_CONNECTION_STATE.ACTIVE,
        available: THEME_EMBED_CONNECTION_STATE.INACTIVE,
        unavailable: THEME_EMBED_CONNECTION_STATE.UNUSABLE,
      };
      const state = states[block.status];
      if (!state) return resolveThemeAppEmbedStatus(null);
      return {
        themeAppEmbedConnectionState: state,
        themeAppEmbedActive: state === THEME_EMBED_CONNECTION_STATE.ACTIVE,
        themeAppEmbedStatus: block.status,
      };
    }
  }

  return {
    themeAppEmbedConnectionState: THEME_EMBED_CONNECTION_STATE.MISSING,
    themeAppEmbedActive: false,
    themeAppEmbedStatus: "missing",
  };
}

export function getThemeEmbedConnectionView(protectionStatus = {}) {
  const state =
    protectionStatus.themeAppEmbedConnectionState ||
    (protectionStatus.themeAppEmbedActive
      ? THEME_EMBED_CONNECTION_STATE.ACTIVE
      : protectionStatus.themeAppEmbedStatus === "unavailable"
        ? THEME_EMBED_CONNECTION_STATE.UNAVAILABLE
        : protectionStatus.themeAppEmbedStatus === "missing"
          ? THEME_EMBED_CONNECTION_STATE.MISSING
          : THEME_EMBED_CONNECTION_STATE.INACTIVE);

  switch (state) {
    case THEME_EMBED_CONNECTION_STATE.ACTIVE:
      return {
        label: "Connected",
        tone: "healthy",
        description:
          "Theme app embed is active and BotShield can evaluate storefront traffic.",
        connected: true,
      };
    case THEME_EMBED_CONNECTION_STATE.INACTIVE:
      return {
        label: "Setup required",
        tone: "monitor",
        description:
          "BotShield's theme app embed is available but not active on the published theme.",
        connected: false,
      };
    case THEME_EMBED_CONNECTION_STATE.MISSING:
      return {
        label: "Extension not installed",
        tone: "monitor",
        description:
          "Shopify does not report a BotShield theme app embed for this app yet.",
        connected: false,
      };
    case THEME_EMBED_CONNECTION_STATE.UNUSABLE:
      return {
        label: "Embed unavailable",
        tone: "monitor",
        description:
          "Shopify reports that the BotShield app embed is not currently usable on the published theme.",
        connected: false,
      };
    case THEME_EMBED_CONNECTION_STATE.UNAVAILABLE:
    default:
      return {
        label: "Unable to verify",
        tone: "neutral",
        description:
          "Shopify could not verify the theme app embed status from Admin.",
        connected: false,
      };
  }
}

export function buildThemeEditorActivateAppId(
  apiKey,
  handle = BOTSHIELD_THEME_EMBED_HANDLE,
) {
  return `${String(apiKey || "").trim()}/${handle}`;
}

export function buildThemeEditorDeepLink(
  shop,
  apiKey,
  handle = BOTSHIELD_THEME_EMBED_HANDLE,
) {
  const normalizedShop = String(shop || "").trim();
  const normalizedApiKey = String(apiKey || "").trim();
  if (
    !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(normalizedShop) ||
    !normalizedApiKey
  )
    return "";
  if (!/^[a-zA-Z0-9_-]+$/.test(handle)) return "";

  return `https://${normalizedShop}/admin/themes/current/editor?context=apps&activateAppId=${encodeURIComponent(normalizedApiKey)}/${encodeURIComponent(handle)}`;
}
