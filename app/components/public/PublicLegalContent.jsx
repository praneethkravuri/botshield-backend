import { Link } from "react-router";

export function PublicLegalSection({ id, title, children }) {
  return (
    <section className="public-legal-section" id={id} aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>{title}</h2>
      {children}
    </section>
  );
}

export function PublicLegalFact({ title, children }) {
  return (
    <div className="public-legal-fact" role="note">
      {title ? <p className="public-legal-fact-title">{title}</p> : null}
      <div className="public-legal-fact-body">{children}</div>
    </div>
  );
}

export function PublicLegalDataGrid({ rows }) {
  if (!rows?.length) return null;

  return (
    <dl className="public-legal-data-grid">
      {rows.map((row) => (
        <div className="public-legal-data-grid-row" key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PublicLegalRelatedLinks({ links }) {
  if (!links?.length) return null;

  return (
    <nav className="public-legal-related" aria-label="Related documents">
      <p className="public-legal-related-title">Related documents</p>
      <ul className="public-legal-related-list">
        {links.map((link) => (
          <li key={link.href}>
            <Link to={link.href}>{link.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
