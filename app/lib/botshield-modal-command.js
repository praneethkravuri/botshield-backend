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

export function runBotShieldModalCommand(id, command) {
  if (typeof document === "undefined" || !id) return false;
  const modal = document.getElementById(id);
  if (globalThis.__BOTSHIELD_POLARIS_DIAG__) {
    console.info("[botshield-polaris-diag]", "runBotShieldModalCommand", {
      id,
      command,
      tag: modal?.tagName?.toLowerCase?.() || null,
      constructor: modal?.constructor?.name || null,
      stack: new Error("runBotShieldModalCommand").stack,
    });
  }
  if (!modal) return false;
  if (!isUpgradedBotShieldModal(modal)) return false;

  dispatchBotShieldModalCommand(id, command);
  return true;
}
