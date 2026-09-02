import { Link, useLocation } from "react-router";
import { usePublicLegalScrollSpy } from "../../hooks/usePublicLegalScrollSpy";
import { publicInfo } from "../../config/public-info";
import "../../styles/public-legal.css";

const headerNavItems = [
  { label: "Privacy", to: publicInfo.privacyUrl },
  { label: "Terms", to: publicInfo.termsUrl },
  { label: "Data use", to: publicInfo.dataUseUrl },
  { label: "Support", to: publicInfo.supportUrl },
];

const footerNavItems = [
  { label: "Privacy", to: publicInfo.privacyUrl },
  { label: "Terms", to: publicInfo.termsUrl },
  { label: "Data use", to: publicInfo.dataUseUrl },
  { label: "Data retention", to: publicInfo.dataRetentionUrl },
  { label: "Data deletion", to: publicInfo.dataDeletionUrl },
  { label: "Support", to: publicInfo.supportUrl },
];

function PublicLegalNavLink({ to, children }) {
  const location = useLocation();
  const current = location.pathname === to;

  return (
    <Link
      to={to}
      className={`public-legal-nav-link${current ? " is-active" : ""}`}
      aria-current={current ? "page" : undefined}
    >
      {children}
    </Link>
  );
}

function PublicLegalTableOfContents({ sections, activeId }) {
  if (!sections.length) return null;

  return (
    <aside className="public-legal-toc" aria-label="On this page">
      <p className="public-legal-toc-title">On this page</p>
      <nav>
        <ul>
          {sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className={activeId === section.id ? "is-active" : undefined}
                aria-current={activeId === section.id ? "location" : undefined}
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

export function PublicLegalShell({ title, summary, sections = [], children }) {
  const sectionIds = sections.map((section) => section.id);
  const activeId = usePublicLegalScrollSpy(sectionIds);
  const hasToc = sections.length > 0;

  return (
    <div className="public-legal-page">
      <a className="public-legal-skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="public-legal-shell">
        <header className="public-legal-header">
          <Link className="public-legal-brand" to="/privacy">
            <span className="public-legal-brand-mark" aria-hidden="true" />
            <span className="public-legal-brand-text">{publicInfo.appName}</span>
          </Link>
          <nav className="public-legal-nav" aria-label={`${publicInfo.appName} trust and legal pages`}>
            {headerNavItems.map((item) => (
              <PublicLegalNavLink key={item.to} to={item.to}>
                {item.label}
              </PublicLegalNavLink>
            ))}
          </nav>
        </header>

        <main className="public-legal-main" id="main-content" tabIndex={-1}>
          <div className="public-legal-frame">
            <header className="public-legal-page-header">
              <p className="public-legal-kicker">Trust &amp; Legal</p>
              <h1 className="public-legal-title">{title}</h1>
              {summary ? <p className="public-legal-summary">{summary}</p> : null}
              <div className="public-legal-dates">
                <span>Effective date: {publicInfo.effectiveDate}</span>
                {publicInfo.lastUpdatedDate ? (
                  <span>Last updated: {publicInfo.lastUpdatedDate}</span>
                ) : null}
              </div>
            </header>

            <div className={`public-legal-layout${hasToc ? " has-toc" : ""}`}>
              {hasToc ? (
                <PublicLegalTableOfContents sections={sections} activeId={activeId} />
              ) : null}

              <article className="public-legal-article">
                <div className="public-legal-content">{children}</div>
              </article>
            </div>

            <footer className="public-legal-frame-footer">
              <div className="public-legal-frame-footer-brand">
                <p className="public-legal-footer-name">{publicInfo.appName}</p>
                <p className="public-legal-footer-copy">
                  Trust, privacy, and data documentation for merchants using BotShield on Shopify.
                </p>
              </div>
              <nav className="public-legal-footer-nav" aria-label="Legal footer">
                {footerNavItems.map((item) => (
                  <Link key={item.to} to={item.to}>
                    {item.label}
                  </Link>
                ))}
              </nav>
              <p className="public-legal-footer-meta">
                Questions: <PublicSupportEmailLink />
              </p>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

export function PublicSupportEmailLink() {
  if (publicInfo.supportEmail === "SUPPORT_EMAIL_NOT_CONFIGURED") {
    return (
      <strong>the support address published in the Shopify App Store listing</strong>
    );
  }

  return (
    <a href={`mailto:${publicInfo.supportEmail}`}>{publicInfo.supportEmail}</a>
  );
}
