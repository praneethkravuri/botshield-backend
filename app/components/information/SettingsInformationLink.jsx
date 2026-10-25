/* eslint-disable react/prop-types */
import { Link, useLocation } from "react-router";
import "../../styles/public-legal.css";
import { mergeEmbeddedAppSearch } from "../../lib/embedded-app-navigation.js";
import {
  PUBLIC_LEGAL_URLS,
  SETTINGS_INFORMATION_PATHS,
} from "../../lib/settings-information.js";

export default function SettingsInformationLink({ href, children, className }) {
  const { search } = useLocation();
  const internalPath = SETTINGS_INFORMATION_PATHS[href];

  if (internalPath) {
    return (
      <Link
        className={className}
        to={mergeEmbeddedAppSearch(internalPath, search)}
      >
        {children}
      </Link>
    );
  }

  const publicUrl = PUBLIC_LEGAL_URLS[href];
  if (!publicUrl)
    throw new Error(`Unknown Settings information destination: ${href}`);

  return (
    <a
      className={className}
      href={publicUrl}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      <span className="public-legal-sr-only"> (opens in a new tab)</span>
    </a>
  );
}
