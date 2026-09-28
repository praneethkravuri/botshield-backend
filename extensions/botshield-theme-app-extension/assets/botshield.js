/* BotShield storefront bundle botshield-14 — premium canonical asset */
(function () {
  var root = document.getElementById("botshield-storefront-root");
  if (!root) return;

  var currentPath = window.location.pathname || root.dataset.path || "/";
  if (currentPath.indexOf("/apps/botshield/blocked") === 0) return;

  var challengeStorageKey = "botshield_challenge_token";
  var demoStoreHost = "botshield-demo.myshopify.com";
  var demoBlockShowcaseDelayMs = 2000;
  var demoBlockedPageUrl = root.dataset.blockedUrl || "/apps/botshield/blocked";
  var challengeToken = "";
  var demoBlockShowcaseTimer = null;
  var realEnforcementResolved = false;
  var officialLogoUrl = root.dataset.officialLogoUrl || "";

  try {
    challengeToken = window.sessionStorage.getItem(challengeStorageKey) || "";
  } catch (error) {
    challengeToken = "";
  }

  function isDemoStore() {
    return window.location.hostname === demoStoreHost;
  }

  function cancelDemoBlockShowcase() {
    if (demoBlockShowcaseTimer) {
      window.clearTimeout(demoBlockShowcaseTimer);
      demoBlockShowcaseTimer = null;
    }
  }

  function scheduleDemoBlockShowcase() {
    if (!isDemoStore()) return;
    if (demoBlockShowcaseTimer) return;

    demoBlockShowcaseTimer = window.setTimeout(function () {
      demoBlockShowcaseTimer = null;
      if (realEnforcementResolved) return;
      window.location.assign(demoBlockedPageUrl);
    }, demoBlockShowcaseDelayMs);
  }

  if (isDemoStore()) {
    scheduleDemoBlockShowcase();
  }

  var params = new URLSearchParams();
  params.set("path", currentPath);
  if (challengeToken) {
    params.set("challenge_token", challengeToken);
  }

  var decisionUrl = (root.dataset.decisionUrl || "/apps/botshield/decision") + "?" + params.toString();

  fetch(decisionUrl, {
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
    },
  })
    .then(function (response) {
      if (!response.ok) {
        throw new Error("BotShield decision request failed.");
      }
      return response.json();
    })
    .then(function (payload) {
      if (!payload || !payload.decision) return;

      if (
        (payload.decision === "block" || payload.action === "blocked") &&
        payload.blockPageUrl
      ) {
        realEnforcementResolved = true;
        cancelDemoBlockShowcase();
        window.location.assign(payload.blockPageUrl);
        return;
      }

      if (payload.decision === "challenge" || payload.action === "challenged") {
        if (isDemoStore()) {
          return;
        }
        realEnforcementResolved = true;
        cancelDemoBlockShowcase();
        var existingOverlay = document.getElementById("botshield-challenge-overlay");
        if (existingOverlay) {
          existingOverlay.remove();
        }
        renderChallenge(payload);
        return;
      }
    })
    .catch(function (error) {
      console.error("[botshield]", error);
    });

  function challengeNetworkGraphic() {
    return (
      '<svg class="bs-challenge-network" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' +
      '<g stroke="#2C6ECB" stroke-width="1" fill="none" opacity="0.22">' +
      '<path d="M0 200 L220 260 L480 220 L720 280 L980 240 L1200 300" />' +
      '<path d="M0 540 L240 500 L520 580 L760 520 L1020 600 L1200 560" />' +
      '<path d="M120 360 L360 320 L600 380 L840 340" opacity="0.65" />' +
      "</g>" +
      '<g fill="#2C6ECB">' +
      '<circle cx="220" cy="260" r="2.5" opacity="0.38" />' +
      '<circle cx="480" cy="220" r="2" opacity="0.32" />' +
      '<circle cx="720" cy="280" r="2.5" opacity="0.36" />' +
      '<circle cx="520" cy="580" r="2" opacity="0.28" />' +
      "</g>" +
      "</svg>"
    );
  }

  function challengeLogoRings() {
    return (
      '<svg class="bs-challenge-rings" viewBox="0 0 360 360" aria-hidden="true" focusable="false">' +
      '<circle cx="180" cy="180" r="118" fill="none" stroke="#2C6ECB" stroke-width="1" opacity="0.22" stroke-dasharray="4 10" />' +
      '<circle cx="180" cy="180" r="96" fill="none" stroke="#2C6ECB" stroke-width="1" opacity="0.16" />' +
      '<circle cx="180" cy="180" r="74" fill="none" stroke="#121314" stroke-width="1" opacity="0.1" />' +
      '<path d="M72 180 H128 M232 180 H288" stroke="#2C6ECB" stroke-width="1" opacity="0.28" />' +
      "</svg>"
    );
  }

  function renderChallenge(payload) {
    if (document.getElementById("botshield-challenge-overlay")) return;

    var overlay = document.createElement("div");
    overlay.id = "botshield-challenge-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "botshield-challenge-title");
    overlay.setAttribute("data-botshield-challenge-build", "botshield-14");

    var logoMarkup = officialLogoUrl
      ? '<img class="bs-challenge-logo" src="' +
        officialLogoUrl +
        '" alt="BotShield" width="64" height="64" decoding="async" />'
      : "";

    overlay.innerHTML =
      '<div class="bs-challenge-backdrop">' +
      challengeNetworkGraphic() +
      "</div>" +
      '<div class="bs-challenge-card">' +
      '<div class="bs-challenge-decor">' +
      '<div class="bs-challenge-glow"></div>' +
      challengeLogoRings() +
      "</div>" +
      '<div class="bs-challenge-logo-shell">' +
      logoMarkup +
      "</div>" +
      '<p class="bs-challenge-brand-name">BotShield</p>' +
      '<div class="bs-challenge-eyebrow">' +
      '<span class="bs-challenge-eyebrow-line"></span>' +
      "<span>PROTECTION IN ACTION.</span>" +
      '<span class="bs-challenge-eyebrow-line"></span>' +
      "</div>" +
      '<h2 id="botshield-challenge-title">Quick security check</h2>' +
      "<p class=\"bs-challenge-body\">Please confirm you're a shopper to continue.</p>" +
      '<div class="bs-challenge-actions">' +
      '<button type="button" class="bs-challenge-button bs-challenge-button--primary" id="botshield-continue-button">Continue shopping</button>' +
      '<button type="button" class="bs-challenge-button bs-challenge-button--secondary" id="botshield-leave-button">Leave store</button>' +
      "</div>" +
      '<div class="bs-challenge-footer-divider"></div>' +
      '<p class="bs-challenge-footer">Protected by BotShield</p>' +
      "</div>";

    document.body.appendChild(overlay);

    var continueButton = document.getElementById("botshield-continue-button");
    var leaveButton = document.getElementById("botshield-leave-button");

    if (continueButton && typeof continueButton.focus === "function") {
      continueButton.focus();
    }

    continueButton.addEventListener("click", function () {
      if (payload.challengeToken) {
        try {
          window.sessionStorage.setItem(challengeStorageKey, payload.challengeToken);
        } catch (error) {
          console.warn("[botshield] unable to persist challenge token", error);
        }
      }
      window.location.reload();
    });

    leaveButton.addEventListener("click", function () {
      window.location.assign("/");
    });
  }
})();
