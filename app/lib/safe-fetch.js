export async function safeFetchJson(url, options = {}) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Network request failed: ${error.message}`
        : "Network request failed.",
    );
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : await response.text().catch(() => "");

  if (!response.ok) {
    const message =
      (typeof payload === "object" &&
        (payload?.error || payload?.message || payload?.delivery?.error)) ||
      (typeof payload === "string" && payload.trim()) ||
      (response.status === 401 || response.status === 403
        ? "Your Shopify session expired. Reload the app and try again."
        : response.status === 404
          ? "The requested BotShield action is unavailable."
          : `BotShield could not complete the request (${response.status}).`);
    throw new Error(message);
  }

  return payload;
}
