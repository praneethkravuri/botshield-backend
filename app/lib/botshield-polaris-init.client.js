const POLARIS_SCRIPT_ID = "botshield-deferred-polaris";
const POLARIS_SCRIPT_SRC = "https://cdn.shopify.com/shopifycloud/polaris.js";

/** @type {Promise<void> | null} */
let polarisInitPromise = null;
function findExistingPolarisScript() {
  if (typeof document === "undefined") {
    return null;
  }

  return (
    document.getElementById(POLARIS_SCRIPT_ID) ||
    document.querySelector('script[src*="shopifycloud/polaris.js"]')
  );
}

function isPolarisRegistered() {
  if (typeof customElements === "undefined") {
    return false;
  }

  return Boolean(customElements.get("s-button"));
}

async function waitForPolarisRegistration() {
  if (typeof customElements === "undefined") {
    return;
  }

  await customElements.whenDefined("s-button");
}

function loadPolarisScript() {
  const existing = findExistingPolarisScript();
  if (existing) {
    if (existing.id !== POLARIS_SCRIPT_ID) {
      existing.id = POLARIS_SCRIPT_ID;
    }

    if (isPolarisRegistered()) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => {
        waitForPolarisRegistration().then(resolve).catch(reject);
      }, { once: true });
      existing.addEventListener("error", () => {
        reject(new Error("Failed to load existing polaris.js script"));
      }, { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = POLARIS_SCRIPT_ID;
    script.src = POLARIS_SCRIPT_SRC;
    script.async = true;
    script.addEventListener("load", () => {
      waitForPolarisRegistration().then(resolve).catch(reject);
    }, { once: true });
    script.addEventListener("error", () => {
      reject(new Error("Failed to load polaris.js"));
    }, { once: true });
    document.head.appendChild(script);
  });
}

/**
 * Ensures Shopify Polaris web components are registered exactly once.
 * Safe to call repeatedly while hydration-safe SSR markup is already present.
 */
export function ensurePolarisInitialized() {
  if (typeof document === "undefined") {
    return Promise.resolve();
  }

  if (isPolarisRegistered()) {
    return waitForPolarisRegistration();
  }

  if (!polarisInitPromise) {
    polarisInitPromise = loadPolarisScript().catch((error) => {
      polarisInitPromise = null;
      throw error;
    });
  }

  return polarisInitPromise;
}

export function isPolarisInitialized() {
  return isPolarisRegistered();
}

export { POLARIS_SCRIPT_ID, POLARIS_SCRIPT_SRC };
