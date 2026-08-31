const MAX_LOG_MESSAGE_LENGTH = 240;

export function truncateLogMessage(value, maxLength = MAX_LOG_MESSAGE_LENGTH) {
  const message = String(value || "").replace(/\s+/g, " ").trim();
  if (!message) return "";
  if (message.length <= maxLength) return message;
  return `${message.slice(0, maxLength - 1)}…`;
}

export function logSafeError(prefix, error, metadata = {}) {
  const message =
    error instanceof Error
      ? truncateLogMessage(error.message)
      : truncateLogMessage(error);
  console.error(prefix, {
    ...metadata,
    message: message || "unknown_error",
  });
}

export function logSafeWarning(prefix, metadata = {}) {
  console.warn(prefix, metadata);
}
