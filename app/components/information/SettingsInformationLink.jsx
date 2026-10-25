/* eslint-disable react/prop-types */
import { Link, useLocation } from "react-router";
import InformationIcon from "./InformationIcon.jsx";
import "../../styles/public-legal.css";
import { mergeEmbeddedAppSearch } from "../../lib/embedded-app-navigation.js";
import {
  PUBLIC_LEGAL_URLS,
  SETTINGS_INFORMATION_PATHS,
} from "../../lib/settings-information.js";

export default function SettingsInformationLink({ href, children, className }) {
  const { search } = useLocation();
  const internalPath = SETTINGS_INFORMATION_PATHS[href];
  const content = (
    <>
      <span className="botshield-information-link-copy">
        <span className="botshield-information-link-label">{children}</span>
        <span className="botshield-information-link-destination">
          {internalPath ? "Inside BotShield" : "Official BotShield website"}
        </span>
      </span>
      <InformationIcon name={internalPath ? "arrow" : "external"} />
    </>
  );

  if (internalPath) {
    return (
      <Link
        className={className}
        data-information-destination="internal"
        to={mergeEmbeddedAppSearch(internalPath, search)}
      >
        {content}
      </Link>
    );
  }

  const publicUrl = PUBLIC_LEGAL_URLS[href];
  if (!publicUrl)
    throw new Error(`Unknown Settings information destination: ${href}`);

  return (
    <a
      className={className}
      data-information-destination="external"
      href={publicUrl}
      target="_blank"
      rel="noopener noreferrer"
    >
      {content}
      <span className="public-legal-sr-only"> (opens in a new tab)</span>
    </a>
  );
}
