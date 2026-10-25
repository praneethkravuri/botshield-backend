/* eslint-disable react/prop-types */
import { useCallback, useRef } from "react";
import { Link, useLocation } from "react-router";
import { BotShieldAppFrame } from "../design-system/BotShieldDesignSystem.jsx";
import { publicInfo } from "../../config/public-info.js";
import { mergeEmbeddedAppSearch } from "../../lib/embedded-app-navigation.js";
import { SECURITY_PRIVACY_SETTINGS_PATH } from "../../lib/settings-information.js";
import {
  findInformationScrollRoot,
  useEmbeddedInformationNavigation,
} from "../../hooks/useEmbeddedInformationNavigation.js";
import SettingsInformationLink from "./SettingsInformationLink.jsx";
import InformationIcon from "./InformationIcon.jsx";
import "../../styles/public-legal.css";
import "../../styles/embedded-information.css";

export function EmbeddedInformationRelatedLinks({ links }) {
  return (
    <nav
      className="public-legal-related botshield-information-related"
      aria-label="Related documents"
    >
      <h2>Related documents</h2>
      <ul>
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

function SectionLinks({ sections, activeId, selectSection }) {
  return (
    <ol className="botshield-information-section-links">
      {sections.map(({ id, label }, index) => (
        <li key={id}>
          <a
            href={`#${id}`}
            aria-current={activeId === id ? "location" : undefined}
            onClick={(event) => selectSection(event, id)}
          >
            <span
              className="botshield-information-section-number"
              aria-hidden="true"
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <span>{label}</span>
          </a>
        </li>
      ))}
    </ol>
  );
}

function InformationDocument({ title, summary, sections, children }) {
  const { pathname, search } = useLocation();
  const contentRef = useRef(null);
  const { activeId, selectSection } = useEmbeddedInformationNavigation(
    sections,
    contentRef,
  );
  const focusHeading = useCallback((heading) => {
    if (!heading || window.location.hash) return;
    heading.focus({ preventScroll: true });
    const scrollRoot = findInformationScrollRoot(heading);
    (scrollRoot || window).scrollTo({ top: 0, behavior: "instant" });
  }, []);
  const activeLabel = sections.find(({ id }) => id === activeId)?.label;

  return (
    <main
      className="public-legal-page botshield-information"
      aria-labelledby="information-title"
    >
      <div className="botshield-information-workspace">
        <Link
          className="botshield-information-back"
          to={mergeEmbeddedAppSearch(SECURITY_PRIVACY_SETTINGS_PATH, search)}
        >
          <InformationIcon name="back" /> Back to Security &amp; Privacy
        </Link>
        <header className="botshield-information-header">
          <div className="botshield-information-page-icon">
            <InformationIcon
              name={pathname.endsWith("data-retention") ? "clock" : "database"}
            />
          </div>
          <div className="botshield-information-header-copy">
            <p className="botshield-information-eyebrow">
              Settings / Security &amp; Privacy
            </p>
            <h1 id="information-title" ref={focusHeading} tabIndex={-1}>
              {title}
            </h1>
            <p className="botshield-information-description">{summary}</p>
            <dl className="botshield-information-dates">
              <div>
                <dt>Effective date</dt>
                <dd>{publicInfo.effectiveDate}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>{publicInfo.lastUpdatedDate}</dd>
              </div>
            </dl>
          </div>
        </header>
        <div className="botshield-information-layout">
          <nav
            className="botshield-information-sidebar"
            aria-label="On this page"
          >
            <p className="botshield-information-nav-label">On this page</p>
            <SectionLinks
              sections={sections}
              activeId={activeId}
              selectSection={selectSection}
            />
          </nav>
          <details className="botshield-information-mobile-nav">
            <summary>
              <span>
                <span className="botshield-information-nav-label">
                  On this page
                </span>
                <span className="botshield-information-mobile-current">
                  {activeLabel}
                </span>
              </span>
              <InformationIcon name="chevron" />
            </summary>
            <nav aria-label="On this page">
              <SectionLinks
                sections={sections}
                activeId={activeId}
                selectSection={selectSection}
              />
            </nav>
          </details>
          <article
            className="public-legal-article botshield-information-body"
            ref={contentRef}
            aria-labelledby="information-title"
          >
            <div className="public-legal-content">{children}</div>
          </article>
        </div>
      </div>
    </main>
  );
}

export default function EmbeddedInformationShell(props) {
  return (
    <BotShieldAppFrame>
      <InformationDocument {...props} />
    </BotShieldAppFrame>
  );
}
