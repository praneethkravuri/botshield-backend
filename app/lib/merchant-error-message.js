const GENERIC_ACTION_ERROR =
  "That action couldn't be completed. Try again or refresh the page.";

export function toMerchantErrorMessage(error, fallback = GENERIC_ACTION_ERROR) {
  if (!(error instanceof Error) || !error.message) return fallback;

  const message = String(error.message).trim();
  if (!message) return fallback;

  const lowered = message.toLowerCase();
  if (
    lowered.includes("stack") ||
    lowered.includes("undefined") ||
    lowered.includes("nan") ||
    lowered.includes("process.env") ||
    lowered.includes("econnrefused") ||
    lowered.includes("prisma") ||
    lowered.includes("sql") ||
    /^\[object object\]$/i.test(message)
  ) {
    return fallback;
  }

  return message.length > 180 ? `${message.slice(0, 177)}…` : message;
}
