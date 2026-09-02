import { Link, useLocation } from "react-router";
import { publicInfo } from "../../config/public-info";
import "../../styles/public-legal.css";

const navItems = [
  { label: "Privacy", to: publicInfo.privacyUrl },
  { label: "Terms", to: publicInfo.termsUrl },
  { label: "Data use", to: publicInfo.dataUseUrl },
  { label: "Support", to: publicInfo.supportUrl },
];

function PublicLegalNavLink({ to, children }) {
  const location = useLocation();
  const current = location.pathname === to;

  return (
    <Link to={to} aria-current={current ? "page" : undefined}>
      {children}
    </Link>
  );
}

export function PublicLegalShell({ title, children }) {
  return (
    <div className="public-legal-page">
      <div className="public-legal-shell">
        <header className="public-legal-header">
          <Link className="public-legal-brand" to="/">
            {publicInfo.appName}
          </Link>
          <nav className="public-legal-nav" aria-label={`${publicInfo.appName} legal pages`}>
            {navItems.map((item) => (
              <PublicLegalNavLink key={item.to} to={item.to}>
                {item.label}
              </PublicLegalNavLink>
            ))}
          </nav>
        </header>

        <main className="public-legal-main">
          <article className="public-legal-card">
            <p className="public-legal-meta">{publicInfo.companyName}</p>
            <h1 className="public-legal-title">{title}</h1>
            <p className="public-legal-effective">
              Effective date: {publicInfo.effectiveDate}
            </p>
            <div className="public-legal-content">{children}</div>
          </article>

          <footer className="public-legal-footer">
            <nav className="public-legal-footer-nav" aria-label="Legal footer">
              <Link to={publicInfo.privacyUrl}>Privacy</Link>
              <Link to={publicInfo.termsUrl}>Terms</Link>
              <Link to={publicInfo.dataUseUrl}>Data use</Link>
              <Link to={publicInfo.dataRetentionUrl}>Data retention</Link>
              <Link to={publicInfo.dataDeletionUrl}>Data deletion</Link>
              <Link to={publicInfo.supportUrl}>Support</Link>
            </nav>
            <p>
              © {new Date().getFullYear()} {publicInfo.companyName}. Documentation for
              merchants using {publicInfo.appName} on Shopify.
            </p>
          </footer>
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
