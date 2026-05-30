(function () {
  var root = document.getElementById("botshield-storefront-root");
  if (!root) return;

  var currentPath = window.location.pathname || root.dataset.path || "/";
  if (currentPath.indexOf("/apps/botshield/blocked") === 0) return;

  var challengeStorageKey = "botshield_challenge_token";
  var challengeToken = "";

  try {
    challengeToken = window.sessionStorage.getItem(challengeStorageKey) || "";
  } catch (error) {
    challengeToken = "";
  }

  var params = new URLSearchParams();
  params.set("path", currentPath);
  if (document.referrer) {
    params.set("referrer", document.referrer);
  }
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

      if (payload.decision === "block" && payload.blockPageUrl) {
        window.location.assign(payload.blockPageUrl);
        return;
      }

      if (payload.decision === "challenge") {
        renderChallenge(payload);
      }
    })
    .catch(function (error) {
      console.error("[botshield]", error);
    });

  function renderChallenge(payload) {
    if (document.getElementById("botshield-challenge-overlay")) return;

    var overlay = document.createElement("div");
    overlay.id = "botshield-challenge-overlay";

    var reasons = Array.isArray(payload.reasons) ? payload.reasons : [];
    var reasonsMarkup = reasons
      .slice(0, 3)
      .map(function (reason) {
        return "<li>" + escapeHtml(reason) + "</li>";
      })
      .join("");

    overlay.innerHTML =
      '<div class="botshield-challenge-card">' +
      '<div class="botshield-challenge-badge">BotShield Verification</div>' +
      "<h2>We need a quick verification</h2>" +
      "<p>This session showed signals that look unusual for a normal shopper. Confirm you want to continue to the storefront.</p>" +
      (reasonsMarkup ? '<ul class="botshield-challenge-reasons">' + reasonsMarkup + "</ul>" : "") +
      '<div class="botshield-challenge-actions">' +
      '<button type="button" class="botshield-challenge-button botshield-challenge-button--primary" id="botshield-continue-button">Continue to Store</button>' +
      '<button type="button" class="botshield-challenge-button botshield-challenge-button--secondary" id="botshield-leave-button">Leave Page</button>' +
      "</div>" +
      "</div>";

    document.body.appendChild(overlay);

    var continueButton = document.getElementById("botshield-continue-button");
    var leaveButton = document.getElementById("botshield-leave-button");

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

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
