/* BotShield storefront bundle botshield-9 */
(function () {
  var root = document.getElementById("botshield-storefront-root");
  if (!root) return;

  var currentPath = window.location.pathname || root.dataset.path || "/";
  if (currentPath.indexOf("/apps/botshield/blocked") === 0) return;

  var challengeStorageKey = "botshield_challenge_token";
  var demoChallengeSeenKey = "botshield_demo_challenge_seen";
  var demoStoreHost = "botshield-demo.myshopify.com";
  var demoChallengeDelayMs = 2000;
  var challengeToken = "";
  var demoChallengeTimer = null;

  try {
    challengeToken = window.sessionStorage.getItem(challengeStorageKey) || "";
  } catch (error) {
    challengeToken = "";
  }

  function isDemoStore() {
    return window.location.hostname === demoStoreHost;
  }

  function hasSeenDemoChallenge() {
    try {
      return window.sessionStorage.getItem(demoChallengeSeenKey) === "1";
    } catch (error) {
      return false;
    }
  }

  function markDemoChallengeSeen() {
    try {
      window.sessionStorage.setItem(demoChallengeSeenKey, "1");
    } catch (error) {
      console.warn("[botshield] unable to persist demo challenge flag", error);
    }
  }

  function cancelDemoChallengePresentation() {
    if (demoChallengeTimer) {
      window.clearTimeout(demoChallengeTimer);
      demoChallengeTimer = null;
    }
  }

  function scheduleDemoChallengePresentation() {
    if (!isDemoStore() || hasSeenDemoChallenge()) return;
    if (demoChallengeTimer) return;

    demoChallengeTimer = window.setTimeout(function () {
      demoChallengeTimer = null;
      if (document.getElementById("botshield-challenge-overlay")) return;
      if (hasSeenDemoChallenge()) return;
      renderChallenge({ demoPresentation: true });
    }, demoChallengeDelayMs);
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
        cancelDemoChallengePresentation();
        window.location.assign(payload.blockPageUrl);
        return;
      }

      if (payload.decision === "challenge" || payload.action === "challenged") {
        cancelDemoChallengePresentation();
        renderChallenge(payload);
        return;
      }

      if (isDemoStore()) {
        scheduleDemoChallengePresentation();
      }
    })
    .catch(function (error) {
      console.error("[botshield]", error);
    });

  function renderChallenge(payload) {
    if (document.getElementById("botshield-challenge-overlay")) return;

    var isDemoPresentation = Boolean(payload && payload.demoPresentation);

    var overlay = document.createElement("div");
    overlay.id = "botshield-challenge-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "botshield-challenge-title");

    overlay.innerHTML =
      '<div class="botshield-challenge-card">' +
      '<div class="botshield-challenge-brand">' +
      '<svg class="botshield-challenge-mark" aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" focusable="false">' +
      '<path d="M12 2.25 4.5 5.25v5.25c0 5.003 3.456 9.666 7.5 10.875 4.044-1.209 7.5-5.872 7.5-10.875V5.25L12 2.25Z" fill="currentColor"/>' +
      "</svg>" +
      '<span class="botshield-challenge-brand-name">BotShield</span>' +
      "</div>" +
      '<h2 id="botshield-challenge-title">Quick security check</h2>' +
      "<p class=\"botshield-challenge-body\">Please confirm you're a shopper to continue.</p>" +
      '<div class="botshield-challenge-actions">' +
      '<button type="button" class="botshield-challenge-button botshield-challenge-button--primary" id="botshield-continue-button">Continue shopping</button>' +
      '<button type="button" class="botshield-challenge-button botshield-challenge-button--secondary" id="botshield-leave-button">Leave store</button>' +
      "</div>" +
      '<p class="botshield-challenge-footer">Protected by BotShield</p>' +
      "</div>";

    document.body.appendChild(overlay);

    var continueButton = document.getElementById("botshield-continue-button");
    var leaveButton = document.getElementById("botshield-leave-button");

    if (continueButton && typeof continueButton.focus === "function") {
      continueButton.focus();
    }

    continueButton.addEventListener("click", function () {
      if (isDemoPresentation) {
        markDemoChallengeSeen();
        overlay.remove();
        return;
      }

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
      if (isDemoPresentation) {
        markDemoChallengeSeen();
      }
      window.location.assign("/");
    });
  }

})();
