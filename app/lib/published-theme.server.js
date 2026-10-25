// No new access scope is assumed or requested here. Theme access is optional.
export async function readPublishedTheme({ session, admin }) {
  if (
    !String(session.scope || "")
      .split(",")
      .includes("read_themes")
  ) {
    return {
      publishedTheme: null,
      publishedThemeError:
        "Published-theme verification needs Shopify theme access. You can still follow the guide and explore your dashboard.",
    };
  }
  try {
    const response = await admin.graphql(`query BotShieldPublishedTheme {
      themes(first: 1, roles: [MAIN]) { nodes { id name role } }
    }`);
    const data = await response.json();
    const theme = data.data?.themes?.nodes?.find(
      (theme) => theme.role === "MAIN",
    );
    if (data.errors?.length || !theme?.id)
      throw new Error("Theme not available");
    return {
      publishedTheme: { id: theme.id, name: theme.name },
      publishedThemeError: "",
    };
  } catch {
    return {
      publishedTheme: null,
      publishedThemeError:
        "We couldn't confirm your published theme right now. Retry store details before verifying activation.",
    };
  }
}
