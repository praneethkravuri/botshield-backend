function dispatchBotShieldModalCommand(id, command) {
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.setAttribute("command", command);
  trigger.setAttribute("commandfor", id);
  trigger.style.position = "fixed";
  trigger.style.opacity = "0";
  trigger.style.pointerEvents = "none";
  document.body.appendChild(trigger);
  trigger.click();
  document.body.removeChild(trigger);
}

function isUpgradedBotShieldModal(modal) {
  if (!modal || modal.tagName?.toLowerCase() !== "s-modal") {
    return false;
  }
  const ModalClass =
    typeof customElements !== "undefined" ? customElements.get("s-modal") : null;
  return Boolean(ModalClass && modal instanceof ModalClass);
}

function invokeBotShieldModalOverlayMethod(modal, methodName) {
  const method = modal?.[methodName];
  if (typeof method !== "function") {
    return false;
  }
  try {
    Reflect.apply(method, modal, []);
    return true;
  } catch {
    return false;
  }
}

export function runBotShieldModalCommand(id, command) {
  if (typeof document === "undefined" || !id) return false;
  const modal = document.getElementById(id);
  if (!modal) return false;
  if (!isUpgradedBotShieldModal(modal)) return false;

  const overlayMethod =
    command === "--show" ? "showOverlay" : command === "--hide" ? "hideOverlay" : null;

  if (overlayMethod && invokeBotShieldModalOverlayMethod(modal, overlayMethod)) {
    return true;
  }

  dispatchBotShieldModalCommand(id, command);
  return true;
}
