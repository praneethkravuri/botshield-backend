import { useCallback, useRef, useState } from "react";
import { toMerchantErrorMessage } from "../lib/merchant-error-message";

function normalizeError(error, fallback) {
  return toMerchantErrorMessage(error, fallback);
}

export function useBotShieldAction({
  action,
  successMessage,
  errorMessage = "BotShield could not complete that action.",
  toast,
  onSuccess,
  onError,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  const run = useCallback(
    async (...args) => {
      if (inFlight.current) return null;
      inFlight.current = true;
      setLoading(true);
      setError("");
      try {
        const result = await action(...args);
        if (successMessage) toast?.success(successMessage);
        await onSuccess?.(result);
        return result;
      } catch (caught) {
        const message = normalizeError(caught, errorMessage);
        setError(message);
        await onError?.(caught);
        return null;
      } finally {
        inFlight.current = false;
        setLoading(false);
      }
    },
    [action, errorMessage, onError, onSuccess, successMessage],
  );

  return { run, loading, error, clearError: () => setError("") };
}
