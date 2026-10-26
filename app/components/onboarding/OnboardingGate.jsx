/* eslint-disable react/prop-types */
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { useThemeActivation } from "./ThemeActivationProvider.jsx";
import { shouldOfferInitialOnboarding } from "../../lib/onboarding.js";
import { mergeEmbeddedAppSearch } from "../../lib/embedded-app-navigation.js";

export default function OnboardingGate({ children }) {
  const activation = useThemeActivation();
  const initialResolved = useRef(false);
  if (activation && !activation.profile.loading && !activation.checking)
    initialResolved.current = true;
  const location = useLocation();
  const navigate = useNavigate();
  const offer =
    activation &&
    shouldOfferInitialOnboarding({
      ...location,
      acknowledged: activation.profile.acknowledged,
      state: activation.state,
      checking: activation.checking,
    });
  const waiting =
    activation &&
    !initialResolved.current &&
    activation.profile.acknowledged !== true &&
    location.pathname === "/app" &&
    !new URLSearchParams(location.search).has("view") &&
    (activation.profile.loading ||
      (activation.profile.acknowledged !== true && activation.checking));
  useEffect(() => {
    if (offer)
      navigate(mergeEmbeddedAppSearch("/app/onboarding", location.search), {
        replace: true,
      });
  }, [offer, navigate, location.search]);
  if (waiting || offer)
    return (
      <main className="botshield-onboarding-loading" aria-busy="true">
        <p role="status">Preparing your BotShield workspace…</p>
      </main>
    );
  return children;
}
