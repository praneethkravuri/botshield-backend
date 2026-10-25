import { Link, useLocation } from "react-router";
import { useThemeActivation } from "./ThemeActivationProvider.jsx";
import { mergeEmbeddedAppSearch } from "../../lib/embedded-app-navigation.js";
import "../../styles/onboarding-premium.css";

export default function SetupReminder() {
  const activation = useThemeActivation();
  const location = useLocation();
  if (!activation || activation.checking || activation.verified) return null;
  const unavailable = ["active", "unavailable"].includes(activation.state);
  return (
    <aside className="botshield-setup-reminder" aria-label="Theme activation">
      <div>
        <strong>
          {unavailable
            ? "Check your theme activation"
            : "Finish activating BotShield"}
        </strong>
        <p>
          {unavailable
            ? "Shopify activation status is unavailable. Review your setup or try checking again."
            : "Enable the app embed in your published theme to start monitoring storefront activity."}
        </p>
      </div>
      <Link to={mergeEmbeddedAppSearch("/app/onboarding", location.search)}>
        {unavailable ? "Review setup" : "Complete setup"}
        <span aria-hidden="true"> →</span>
      </Link>
    </aside>
  );
}
