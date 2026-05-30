import { authenticate } from "../shopify.server";

function readSearchParam(searchParams, key, fallback = "") {
  const value = searchParams.get(key);
  return value ? String(value) : fallback;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function loader({ request }) {
  await authenticate.public.appProxy(request);

  const url = new URL(request.url);
  const reason = readSearchParam(
    url.searchParams,
    "reason",
    "Suspicious traffic was detected from this session.",
  );
  const reference = readSearchParam(url.searchParams, "ref", "BS-VERIFY");
  const ipAddress = readSearchParam(url.searchParams, "ip", "Protected session");

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>BotShield Access Denied</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        background: radial-gradient(circle at top, rgba(56,189,248,0.12), transparent 28%), linear-gradient(180deg, #08111f 0%, #0b1220 55%, #09101c 100%);
        color: #f8fafc;
        font-family: Manrope, "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
        display: grid;
        place-items: center;
        padding: 32px 20px;
      }
      .card {
        width: 100%;
        max-width: 760px;
        border-radius: 28px;
        padding: 34px;
        border: 1px solid rgba(148,163,184,0.18);
        background: rgba(8, 15, 28, 0.82);
        box-shadow: 0 28px 100px rgba(2, 6, 23, 0.48);
        backdrop-filter: blur(18px);
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 8px 14px;
        border-radius: 999px;
        border: 1px solid rgba(56,189,248,0.24);
        background: rgba(8, 47, 73, 0.34);
        color: #7dd3fc;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }
      h1 {
        margin: 22px 0 10px;
        font-size: clamp(36px, 6vw, 58px);
        line-height: 1;
        letter-spacing: -0.04em;
      }
      p {
        margin: 0;
        font-size: 18px;
        line-height: 1.7;
        color: rgba(226,232,240,0.86);
      }
      .grid {
        margin-top: 28px;
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }
      .cell, .reason {
        padding: 18px;
        border-radius: 20px;
        border: 1px solid rgba(148,163,184,0.16);
        background: rgba(15, 23, 42, 0.72);
      }
      .label {
        font-size: 11px;
        color: #94a3b8;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .value {
        margin-top: 8px;
        font-size: 22px;
        font-weight: 800;
      }
      .reason {
        margin-top: 20px;
        border-color: rgba(239,68,68,0.18);
        background: rgba(69, 10, 10, 0.28);
        color: #fecaca;
        line-height: 1.7;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="badge">BotShield Active Protection</div>
      <h1>Access Denied</h1>
      <p>The site owner may have set restrictions that prevent this session from accessing the storefront.</p>
      <div class="grid">
        <div class="cell">
          <div class="label">Decision</div>
          <div class="value">Blocked</div>
        </div>
        <div class="cell">
          <div class="label">Reference</div>
          <div class="value">${escapeHtml(reference)}</div>
        </div>
        <div class="cell">
          <div class="label">Session</div>
          <div class="value" style="font-size: 16px;">${escapeHtml(ipAddress)}</div>
        </div>
      </div>
      <div class="reason"><strong>Reason:</strong> ${escapeHtml(reason)}</div>
    </div>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
