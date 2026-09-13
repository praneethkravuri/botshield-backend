const defaultCancelFrame =
  typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : () => {};
const defaultRequestFrame =
  typeof requestAnimationFrame === "function"
    ? requestAnimationFrame
    : (callback) => setTimeout(callback, 0);

export function createBotShieldNativeModalLifecycleState() {
  return {
    wasNativeShown: false,
    nativeHideCompleted: false,
    fallbackHideDispatched: false,
    fallbackHideFrame: null,
    showRequest: 0,
  };
}

export function cancelScheduledFallbackHide(state, cancelFrame = defaultCancelFrame) {
  if (state.fallbackHideFrame != null) {
    cancelFrame(state.fallbackHideFrame);
    state.fallbackHideFrame = null;
  }
}

export function dispatchFallbackHideIfNeeded(state, id, hideModal) {
  if (!id || !state.wasNativeShown) {
    return false;
  }
  if (state.nativeHideCompleted || state.fallbackHideDispatched) {
    return false;
  }
  state.fallbackHideDispatched = true;
  hideModal(id);
  return true;
}

export function scheduleFallbackHide(
  state,
  id,
  hideModal,
  {
    requestFrame = defaultRequestFrame,
    cancelFrame = defaultCancelFrame,
  } = {},
) {
  cancelScheduledFallbackHide(state, cancelFrame);
  state.fallbackHideFrame = requestFrame(() => {
    state.fallbackHideFrame = null;
    dispatchFallbackHideIfNeeded(state, id, hideModal);
  });
}

export function markNativeModalShown(state, cancelFrame = defaultCancelFrame) {
  cancelScheduledFallbackHide(state, cancelFrame);
  state.nativeHideCompleted = false;
  state.fallbackHideDispatched = false;
  state.wasNativeShown = true;
  state.showRequest += 1;
  return state.showRequest;
}

export function handleNativeModalAfterHide(state, cancelFrame = defaultCancelFrame) {
  state.nativeHideCompleted = true;
  cancelScheduledFallbackHide(state, cancelFrame);
}

export function cleanupNativeModalShowRequest(state, showRequest, id, hideModal, cancelFrame) {
  if (state.showRequest === showRequest) {
    state.showRequest += 1;
  }
  cancelScheduledFallbackHide(state, cancelFrame);
  dispatchFallbackHideIfNeeded(state, id, hideModal);
}
