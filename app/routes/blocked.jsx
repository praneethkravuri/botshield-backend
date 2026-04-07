import { Link, useLocation } from "react-router";

function readSearchParam(searchParams, key, fallback = "") {
  const value = searchParams.get(key);
  return value ? String(value) : fallback;
}

export default function BlockedPage() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);

  const reason = readSearchParam(
    searchParams,
    "reason",
    "Suspicious traffic was detected from this session.",
  );
  const reference = readSearchParam(searchParams, "ref", "BS-VERIFY");
  const ipAddress = readSearchParam(searchParams, "ip", "");

  return (
    <div
      style={{
        minHeight: "100vh",
        margin: 0,
        background:
          "radial-gradient(circle at top, rgba(56,189,248,0.12), transparent 28%), linear-gradient(180deg, #08111f 0%, #0b1220 55%, #09101c 100%)",
        color: "#f8fafc",
        fontFamily:
          'Manrope, "IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        display: "grid",
        placeItems: "center",
        padding: "32px 20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "760px",
          borderRadius: "28px",
          padding: "34px",
          border: "1px solid rgba(148,163,184,0.18)",
          background: "rgba(8, 15, 28, 0.82)",
          boxShadow: "0 28px 100px rgba(2, 6, 23, 0.48)",
          backdropFilter: "blur(18px)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            padding: "8px 14px",
            borderRadius: "999px",
            border: "1px solid rgba(56,189,248,0.24)",
            background: "rgba(8, 47, 73, 0.34)",
            color: "#7dd3fc",
            fontSize: "12px",
            fontWeight: 800,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
        >
          BotShield Active Protection
        </div>

        <h1
          style={{
            margin: "22px 0 10px",
            fontSize: "clamp(36px, 6vw, 58px)",
            lineHeight: 1,
            letterSpacing: "-0.04em",
          }}
        >
          Access Denied
        </h1>

        <p
          style={{
            margin: 0,
            fontSize: "18px",
            lineHeight: 1.7,
            color: "rgba(226,232,240,0.86)",
            maxWidth: "620px",
          }}
        >
          The site owner may have set restrictions that prevent this session from
          accessing the storefront. If you believe this is a mistake, please
          contact the site owner for help.
        </p>

        <div
          style={{
            marginTop: "28px",
            display: "grid",
            gap: "14px",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          }}
        >
          <div
            style={{
              padding: "18px",
              borderRadius: "20px",
              border: "1px solid rgba(148,163,184,0.16)",
              background: "rgba(15, 23, 42, 0.72)",
            }}
          >
            <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>
              Decision
            </div>
            <div style={{ marginTop: "8px", fontSize: "22px", fontWeight: 800 }}>
              Blocked
            </div>
          </div>

          <div
            style={{
              padding: "18px",
              borderRadius: "20px",
              border: "1px solid rgba(148,163,184,0.16)",
              background: "rgba(15, 23, 42, 0.72)",
            }}
          >
            <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>
              Reference
            </div>
            <div style={{ marginTop: "8px", fontSize: "22px", fontWeight: 800 }}>
              {reference}
            </div>
          </div>

          <div
            style={{
              padding: "18px",
              borderRadius: "20px",
              border: "1px solid rgba(148,163,184,0.16)",
              background: "rgba(15, 23, 42, 0.72)",
            }}
          >
            <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>
              Session
            </div>
            <div style={{ marginTop: "8px", fontSize: "16px", fontWeight: 700 }}>
              {ipAddress || "Protected session"}
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: "20px",
            padding: "18px 20px",
            borderRadius: "20px",
            border: "1px solid rgba(239,68,68,0.18)",
            background: "rgba(69, 10, 10, 0.28)",
            color: "#fecaca",
            lineHeight: 1.7,
          }}
        >
          <strong style={{ color: "#fca5a5" }}>Reason:</strong> {reason}
        </div>

        <div
          style={{
            marginTop: "28px",
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "center",
          }}
        >
          <a
            href="mailto:support@example.com?subject=BotShield%20access%20review"
            style={{
              padding: "12px 18px",
              borderRadius: "14px",
              textDecoration: "none",
              background: "linear-gradient(135deg, #38bdf8, #2563eb)",
              color: "#eff6ff",
              fontWeight: 800,
              boxShadow: "0 14px 40px rgba(37,99,235,0.28)",
            }}
          >
            Contact Site Owner
          </a>
          <Link
            to="/"
            style={{
              padding: "12px 18px",
              borderRadius: "14px",
              textDecoration: "none",
              border: "1px solid rgba(148,163,184,0.18)",
              color: "#e2e8f0",
              background: "rgba(15,23,42,0.58)",
              fontWeight: 700,
            }}
          >
            Return
          </Link>
          <span style={{ color: "#94a3b8", fontSize: "13px" }}>
            Protected by <strong style={{ color: "#e2e8f0" }}>BotShield</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
