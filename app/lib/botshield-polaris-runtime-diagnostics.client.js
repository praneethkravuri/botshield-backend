const LOG_PREFIX = "[botshield-polaris-diag]";
const IMPERATIVE_METHODS = ["showOverlay", "hideOverlay", "show", "hide", "toggleOverlay"];

function describeElement(element) {
  if (!element) return null;
  const ModalClass =
    typeof customElements !== "undefined" ? customElements.get("s-modal") : null;
  return {
    tag: element.tagName?.toLowerCase?.() || String(element.tagName),
    id: element.id || null,
    constructor: element.constructor?.name || "unknown",
    modalRegistered: Boolean(ModalClass),
    modalInstanceof: Boolean(ModalClass && element instanceof ModalClass),
  };
}

function formatStack(error) {
  if (!error) return "";
  if (typeof error === "string") return error;
  return error.stack || String(error);
}

function logEvent(type, detail) {
  const entry = {
    at: new Date().toISOString(),
    type,
    ...detail,
  };
  globalThis.__BOTSHIELD_POLARIS_DIAG__ ||= { events: [], errors: [] };
  globalThis.__BOTSHIELD_POLARIS_DIAG__.events.push(entry);
  console.info(LOG_PREFIX, type, detail);
}

function wrapImperativeMethod(prototype, methodName) {
  if (!prototype || typeof prototype[methodName] !== "function") return;
  const original = prototype[methodName];
  prototype[methodName] = function wrappedBotShieldPolarisMethod(...args) {
    const elementInfo = describeElement(this);
    logEvent("imperative-call", {
      method: methodName,
      element: elementInfo,
      argsLength: args.length,
      stack: new Error(`${methodName} invocation`).stack,
    });
    try {
      return Reflect.apply(original, this, args);
    } catch (error) {
      logEvent("imperative-throw", {
        method: methodName,
        element: elementInfo,
        message: error?.message || String(error),
        stack: formatStack(error),
        callerStack: new Error("imperative throw boundary").stack,
      });
      throw error;
    }
  };
}

function installModalPrototypeHooks() {
  const ModalClass = customElements.get("s-modal");
  if (!ModalClass?.prototype) return false;
  for (const methodName of IMPERATIVE_METHODS) {
    wrapImperativeMethod(ModalClass.prototype, methodName);
  }
  logEvent("modal-prototype-hooked", {
    methods: IMPERATIVE_METHODS,
    constructor: ModalClass.name,
  });
  return true;
}

function observeModalElements() {
  const seen = new WeakSet();
  const inspect = (element, reason) => {
    if (!element || seen.has(element)) return;
    seen.add(element);
    logEvent("modal-element-seen", {
      reason,
      element: describeElement(element),
    });
  };

  for (const element of document.querySelectorAll("s-modal")) {
    inspect(element, "initial-query");
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.tagName?.toLowerCase() === "s-modal") inspect(node, "mutation-added");
        for (const modal of node.querySelectorAll?.("s-modal") || []) {
          inspect(modal, "mutation-descendant");
        }
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function installGlobalErrorCapture() {
  window.addEventListener("error", (event) => {
    const message = event.error?.message || event.message || "unknown error";
    if (!/private member/i.test(message) && !/polaris/i.test(String(event.filename || ""))) {
      return;
    }
    const entry = {
      at: new Date().toISOString(),
      message,
      filename: event.filename || null,
      lineno: event.lineno || null,
      colno: event.colno || null,
      stack: formatStack(event.error),
    };
    globalThis.__BOTSHIELD_POLARIS_DIAG__ ||= { events: [], errors: [] };
    globalThis.__BOTSHIELD_POLARIS_DIAG__.errors.push(entry);
    console.error(LOG_PREFIX, "window-error", entry);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const message = event.reason?.message || String(event.reason || "unknown rejection");
    if (!/private member/i.test(message)) return;
    logEvent("unhandled-rejection", {
      message,
      stack: formatStack(event.reason),
    });
  });
}

export async function installBotShieldPolarisRuntimeDiagnostics() {
  if (typeof window === "undefined" || globalThis.__BOTSHIELD_POLARIS_DIAG_INSTALLED__) {
    return;
  }
  globalThis.__BOTSHIELD_POLARIS_DIAG_INSTALLED__ = true;
  installGlobalErrorCapture();
  observeModalElements();

  if (typeof customElements !== "undefined") {
    if (customElements.get("s-modal")) {
      installModalPrototypeHooks();
    } else {
      customElements.whenDefined("s-modal").then(() => {
        installModalPrototypeHooks();
      });
    }
  }

  logEvent("installed", {
    href: window.location.href,
    modalRegisteredInitially: Boolean(customElements?.get?.("s-modal")),
  });
}

export function wrapBotShieldModalCommand(runBotShieldModalCommand) {
  return function wrappedRunBotShieldModalCommand(id, command) {
    const modal = typeof document !== "undefined" ? document.getElementById(id) : null;
    logEvent("botshield-modal-command", {
      id,
      command,
      element: describeElement(modal),
      stack: new Error("runBotShieldModalCommand").stack,
    });
    return runBotShieldModalCommand(id, command);
  };
}
