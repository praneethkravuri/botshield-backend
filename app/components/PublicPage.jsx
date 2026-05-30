import { Link } from "react-router";
import { publicInfo } from "../config/public-info";

const pageStyle = {
  minHeight: "100vh",
  background: "#f8fafc",
  color: "#0f172a",
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  padding: "40px 20px",
};

const shellStyle = {
  width: "100%",
  maxWidth: "860px",
  margin: "0 auto",
};

const navStyle = {
  display: "flex",
  gap: "16px",
  flexWrap: "wrap",
  marginBottom: "34px",
  fontSize: "14px",
};

export function PublicPage({ title, children }) {
  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        <nav style={navStyle} aria-label={`${publicInfo.appName} public pages`}>
          <Link to="/" style={{ color: "#2563eb", fontWeight: 700 }}>
            {publicInfo.appName}
          </Link>
          <Link to={publicInfo.privacyUrl} style={{ color: "#475569" }}>
            Privacy
          </Link>
          <Link to={publicInfo.termsUrl} style={{ color: "#475569" }}>
            Terms
          </Link>
          <Link to={publicInfo.supportUrl} style={{ color: "#475569" }}>
            Support
          </Link>
        </nav>

        <article
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            padding: "32px",
            boxShadow: "0 18px 60px rgba(15, 23, 42, 0.08)",
          }}
        >
          <p
            style={{
              margin: "0 0 10px",
              color: "#64748b",
              fontSize: "14px",
              fontWeight: 700,
            }}
          >
            {publicInfo.companyName}
          </p>
          <h1
            style={{
              margin: "0 0 22px",
              fontSize: "36px",
              lineHeight: 1.15,
              letterSpacing: 0,
            }}
          >
            {title}
          </h1>
          <div style={{ fontSize: "16px", lineHeight: 1.75, color: "#334155" }}>
            {children}
          </div>
        </article>
      </div>
    </main>
  );
}
