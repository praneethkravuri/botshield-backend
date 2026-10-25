// Guide acknowledgment is navigation metadata, never proof of theme activation.
export const ONBOARDING_GUIDE_KEY = "onboarding.guideAcknowledged.v1";

export function shouldOfferInitialOnboarding({
  pathname,
  search = "",
  acknowledged,
  state,
  checking,
}) {
  const params = new URLSearchParams(search);
  return (
    pathname === "/app" &&
    !params.has("view") &&
    !params.has("charge_id") &&
    acknowledged === false &&
    !checking &&
    ["inactive", "missing"].includes(state)
  );
}

export const ACTIVATION_MESSAGES = {
  active: "BotShield app embed is enabled.",
  inactive: "BotShield is not yet enabled on your published theme.",
  missing: "Shopify could not find the BotShield app embed.",
  unavailable: "We couldn't verify your theme activation right now.",
};

// Bound an unavailable App Bridge call; a late resolution cannot overwrite a newer check.
export async function checkActivationWithTimeout(read, timeoutMs = 10000) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(read),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Activation check timed out")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
