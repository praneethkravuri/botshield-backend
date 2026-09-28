/**
 * Pure navigation resolution for the storefront blocked page "Go Back" control.
 * Navigation only — never changes enforcement, trust, or blocklist state.
 */

export function isSafeHttpUrl(urlString) {
  if (typeof urlString !== "string" || !urlString.trim()) {
    return false;
  }
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * @param {string | undefined | null} referrer
 * @param {string} pageOrigin e.g. window.location.origin on the storefront
 * @returns {string | null} external referrer href, or null if same-origin / invalid
 */
export function getExternalReferrerTarget(referrer, pageOrigin) {
  if (!referrer || typeof referrer !== "string") {
    return null;
  }
  if (!isSafeHttpUrl(referrer)) {
    return null;
  }
  try {
    const ref = new URL(referrer);
    const page = new URL(pageOrigin);
    if (ref.origin === page.origin) {
      return null;
    }
    return ref.href;
  } catch {
    return null;
  }
}

export function isSameOriginReferrer(referrer, pageOrigin) {
  if (!referrer || typeof referrer !== "string") {
    return false;
  }
  if (!isSafeHttpUrl(referrer)) {
    return false;
  }
  try {
    return new URL(referrer).origin === new URL(pageOrigin).origin;
  } catch {
    return false;
  }
}

/**
 * @param {{ referrer?: string | null, origin: string, historyLength: number }} options
 * @returns {{ type: "external", href: string } | { type: "historyBack" } | { type: "noop" }}
 */
export function resolveBlockedPageGoBack({ referrer, origin, historyLength }) {
  const external = getExternalReferrerTarget(referrer, origin);
  if (external) {
    return { type: "external", href: external };
  }
  if (isSameOriginReferrer(referrer, origin)) {
    return { type: "noop" };
  }
  if (typeof historyLength === "number" && historyLength > 1) {
    return { type: "historyBack" };
  }
  return { type: "noop" };
}

export function buildBlockedPageGoBackScript() {
  return `
(function () {
  function isSafeHttpUrl(value) {
    if (typeof value !== "string" || !value.trim()) {
      return false;
    }
    try {
      var url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (e) {
      return false;
    }
  }
  function getExternalReferrerTarget(referrer, pageOrigin) {
    if (!referrer || typeof referrer !== "string") {
      return null;
    }
    if (!isSafeHttpUrl(referrer)) {
      return null;
    }
    try {
      var ref = new URL(referrer);
      var page = new URL(pageOrigin);
      if (ref.origin === page.origin) {
        return null;
      }
      return ref.href;
    } catch (e) {
      return null;
    }
  }
  function isSameOriginReferrer(referrer, pageOrigin) {
    if (!referrer || typeof referrer !== "string") {
      return false;
    }
    if (!isSafeHttpUrl(referrer)) {
      return false;
    }
    try {
      return new URL(referrer).origin === new URL(pageOrigin).origin;
    } catch (e) {
      return false;
    }
  }
  function goBack() {
    var external = getExternalReferrerTarget(
      document.referrer,
      window.location.origin
    );
    if (external) {
      window.location.assign(external);
      return;
    }
    if (
      isSameOriginReferrer(
        document.referrer,
        window.location.origin
      )
    ) {
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
  }
  var button = document.getElementById("bs-block-go-back");
  if (button) {
    button.addEventListener("click", goBack);
  }
})();
`.trim();
}
