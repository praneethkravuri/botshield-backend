export const BOTSHIELD_THEME_EMBED_HANDLE = "botshield-embed";

export const THEME_EMBED_CONNECTION_STATE = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  MISSING: "missing",
  UNAVAILABLE: "unavailable",
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

  let sawThemeExtension = false;

  for (const extension of extensions) {
    if (extension?.type !== "theme_app_extension") continue;
    sawThemeExtension = true;

    for (const block of extension.activations || []) {
      if (block?.handle !== BOTSHIELD_THEME_EMBED_HANDLE) continue;

      const active = block.status === "active";
      return {
        themeAppEmbedConnectionState: active
          ? THEME_EMBED_CONNECTION_STATE.ACTIVE
          : THEME_EMBED_CONNECTION_STATE.INACTIVE,
        themeAppEmbedActive: active,
        themeAppEmbedStatus: block.status || "inactive",
      };
    }
  }

  if (!sawThemeExtension) {
    return {
      themeAppEmbedConnectionState: THEME_EMBED_CONNECTION_STATE.MISSING,
      themeAppEmbedActive: false,
      themeAppEmbedStatus: "missing",
    };
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
  if (!normalizedShop || !normalizedApiKey) return "";

  return `https://${normalizedShop}/admin/themes/current/editor?context=apps&activateAppId=${buildThemeEditorActivateAppId(
    normalizedApiKey,
    handle,
  )}`;
}
