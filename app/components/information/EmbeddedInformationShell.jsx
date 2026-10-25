/* eslint-disable react/prop-types */
import { useCallback } from "react";
import { Link, useLocation } from "react-router";
import { BotShieldAppFrame } from "../design-system/BotShieldDesignSystem.jsx";
import { publicInfo } from "../../config/public-info.js";
import { mergeEmbeddedAppSearch } from "../../lib/embedded-app-navigation.js";
import { SECURITY_PRIVACY_SETTINGS_PATH } from "../../lib/settings-information.js";
import SettingsInformationLink from "./SettingsInformationLink.jsx";
import "../../styles/public-legal.css";
import "../../styles/embedded-information.css";

export function EmbeddedInformationRelatedLinks({ links }) {
  return (
    <nav className="public-legal-related" aria-label="Related documents">
      <p className="public-legal-related-title">Related documents</p>
      <ul className="public-legal-related-list">
        {links.map(({ href, label }) => (
          <li key={href}>
            <SettingsInformationLink href={href}>
              {label}
            </SettingsInformationLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function EmbeddedInformationShell({
  title,
  summary,
  sections,
  children,
}) {
  const { search } = useLocation();
  const focusHeading = useCallback((heading) => {
    if (!heading) return;
    heading.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, []);

  return (
    <BotShieldAppFrame>
      <main className="public-legal-page botshield-information">
        <div className="public-legal-shell">
          <Link
            className="botshield-information-back"
            to={mergeEmbeddedAppSearch(SECURITY_PRIVACY_SETTINGS_PATH, search)}
          >
            ← Back to Security &amp; Privacy
          </Link>
          <header className="public-legal-page-header">
            <p className="public-legal-kicker">
              Settings · Security &amp; Privacy
            </p>
            <h1 className="public-legal-title" ref={focusHeading} tabIndex={-1}>
              {title}
            </h1>
            <p className="public-legal-summary">{summary}</p>
            <div className="public-legal-dates">
              <span>Effective date: {publicInfo.effectiveDate}</span>
              <span>Last updated: {publicInfo.lastUpdatedDate}</span>
            </div>
          </header>
          <nav
            className="botshield-information-contents"
            aria-label="On this page"
          >
            {sections.map(({ id, label }) => (
              <a key={id} href={`#${id}`}>
                {label}
              </a>
            ))}
          </nav>
          <article className="public-legal-article">
            <div className="public-legal-content">{children}</div>
          </article>
        </div>
      </main>
    </BotShieldAppFrame>
  );
}
