import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OFFICIAL_LOGO_RELATIVE = "../../public/botshield-official-logo.png";

const BLOCK_PAGE_DESCRIPTION =
  "Suspicious or unauthorized activity was detected, so entry has been denied to protect this storefront.";

let cachedOfficialLogoDataUri = null;

function getOfficialLogoDataUri() {
  if (cachedOfficialLogoDataUri) {
    return cachedOfficialLogoDataUri;
  }

  const logoPath = join(__dirname, OFFICIAL_LOGO_RELATIVE);
  const buffer = readFileSync(logoPath);
  cachedOfficialLogoDataUri = `data:image/png;base64,${buffer.toString("base64")}`;
  return cachedOfficialLogoDataUri;
}

function renderOfficialLogo({ className, width, height, alt = "" }) {
  const src = getOfficialLogoDataUri();
  const altAttr = alt ? ` alt="${alt}"` : ' alt="" role="presentation"';
  return `<img class="${className}" src="${src}"${altAttr} width="${width}" height="${height}" decoding="async" />`;
}

function renderPerimeterGeometry() {
  return `<svg class="bs-block-perimeter bs-block-perimeter--left" viewBox="0 0 120 420" aria-hidden="true" focusable="false">
  <path d="M8 0 L8 420 M8 0 L72 0 L72 88 L8 88" fill="none" stroke="#121314" stroke-width="1.5" opacity="0.12" />
  <path d="M24 120 L24 300 L64 300" fill="none" stroke="#2C6ECB" stroke-width="1.25" opacity="0.35" />
  <circle cx="64" cy="300" r="2.5" fill="#2C6ECB" opacity="0.45" />
</svg>
<svg class="bs-block-perimeter bs-block-perimeter--right" viewBox="0 0 120 420" aria-hidden="true" focusable="false">
  <path d="M112 0 L112 420 M112 0 L48 0 L48 88 L112 88" fill="none" stroke="#121314" stroke-width="1.5" opacity="0.12" />
  <path d="M96 120 L96 300 L56 300" fill="none" stroke="#2C6ECB" stroke-width="1.25" opacity="0.35" />
  <circle cx="56" cy="300" r="2.5" fill="#2C6ECB" opacity="0.45" />
</svg>`;
}

function renderLogoRings() {
  return `<svg class="bs-block-rings" viewBox="0 0 320 320" aria-hidden="true" focusable="false">
  <circle cx="160" cy="160" r="118" fill="none" stroke="#2C6ECB" stroke-width="1" opacity="0.14" />
  <circle cx="160" cy="160" r="98" fill="none" stroke="#121314" stroke-width="1" opacity="0.08" />
  <path d="M48 160 H112 M208 160 H272" stroke="#2C6ECB" stroke-width="1" opacity="0.2" />
  <rect x="110" y="158" width="4" height="4" fill="#2C6ECB" opacity="0.35" />
  <rect x="206" y="158" width="4" height="4" fill="#2C6ECB" opacity="0.35" />
</svg>`;
}

function renderNetworkGraphic() {
  return `<svg class="bs-block-network" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <g class="bs-block-network-lines" stroke="#2C6ECB" stroke-width="1" fill="none" opacity="0.1">
    <path d="M0 180 L220 240 L480 200 L720 260 L980 220 L1200 280" />
    <path d="M0 520 L240 480 L520 560 L760 500 L1020 580 L1200 540" />
  </g>
  <g class="bs-block-network-nodes" fill="#2C6ECB">
    <circle cx="220" cy="240" r="2.5" opacity="0.18" />
    <circle cx="480" cy="200" r="2" opacity="0.14" />
    <circle cx="720" cy="260" r="2.5" opacity="0.16" />
    <circle cx="520" cy="560" r="2" opacity="0.12" />
  </g>
</svg>`;
}

const BOTSHIELD_BLOCKED_PAGE_STYLE = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body {
    margin: 0;
    min-height: 100%;
    background: #F8FAFC;
    color: #121314;
  }
  body {
    min-height: 100vh;
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  .bs-block-page {
    position: relative;
    isolation: isolate;
    min-height: 100vh;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(24px, 5vw, 56px) clamp(20px, 4vw, 32px);
    overflow: hidden;
  }
  .bs-block-bg {
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
  }
  .bs-block-vignette {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 70% 55% at 50% 38%, rgba(44, 110, 203, 0.11) 0%, transparent 62%),
      radial-gradient(ellipse 130% 100% at 50% 50%, transparent 40%, rgba(18, 19, 20, 0.05) 100%),
      linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 45%, #F3F6F9 100%);
  }
  .bs-block-grid {
    position: absolute;
    inset: -25%;
    opacity: 0.4;
    background-image:
      linear-gradient(rgba(44, 110, 203, 0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(44, 110, 203, 0.04) 1px, transparent 1px);
    background-size: 56px 56px;
    mask-image: radial-gradient(ellipse 75% 65% at 50% 42%, black 20%, transparent 78%);
    animation: bs-block-grid-drift 100s linear infinite;
  }
  .bs-block-network {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0.85;
    animation: bs-block-network-drift 85s linear infinite;
  }
  .bs-block-perimeter {
    position: absolute;
    top: 50%;
    width: clamp(48px, 8vw, 96px);
    height: auto;
    transform: translateY(-50%);
    opacity: 0.85;
  }
  .bs-block-perimeter--left { left: clamp(0px, 2vw, 24px); }
  .bs-block-perimeter--right { right: clamp(0px, 2vw, 24px); }
  .bs-block-stage {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 720px;
    text-align: center;
    animation: bs-block-stage-enter 600ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .bs-block-logo-shell {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto clamp(20px, 4vw, 28px);
    width: min(100%, 340px);
    min-height: clamp(120px, 26vw, 260px);
    animation: bs-block-logo-enter 620ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .bs-block-rings {
    position: absolute;
    width: min(92%, 320px);
    height: auto;
    animation: bs-block-rings-drift 120s linear infinite;
  }
  .bs-block-glow {
    position: absolute;
    width: clamp(150px, 36vw, 300px);
    aspect-ratio: 1;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(91, 158, 232, 0.42) 0%, rgba(44, 110, 203, 0.14) 45%, transparent 72%);
    filter: blur(3px);
    animation: bs-block-glow-breathe 6s ease-in-out infinite;
  }
  .bs-block-logo {
    position: relative;
    z-index: 1;
    display: block;
    object-fit: contain;
  }
  .bs-block-logo--hero {
    width: clamp(108px, 20vw, 220px);
    height: auto;
    max-height: 220px;
  }
  .bs-block-logo--footer {
    width: 28px;
    height: 28px;
    flex-shrink: 0;
  }
  .bs-block-eyebrow {
    margin: 0 0 clamp(14px, 3vw, 20px);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    font-size: clamp(10px, 2vw, 12px);
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #2C6ECB;
    animation: bs-block-fade-up 540ms cubic-bezier(0.22, 1, 0.36, 1) 100ms both;
  }
  .bs-block-eyebrow-line {
    display: block;
    width: clamp(28px, 8vw, 48px);
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(44, 110, 203, 0.45), transparent);
  }
  .bs-block-title {
    margin: 0 0 clamp(14px, 3vw, 18px);
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: center;
    gap: 0.28em;
    font-size: clamp(32px, 6.5vw, 52px);
    font-weight: 700;
    line-height: 1.08;
    letter-spacing: -0.03em;
    animation: bs-block-fade-up 540ms cubic-bezier(0.22, 1, 0.36, 1) 180ms both;
  }
  .bs-block-title-access { color: #121314; }
  .bs-block-title-denied { color: #2C6ECB; }
  .bs-block-description {
    margin: 0 auto clamp(22px, 4vw, 28px);
    max-width: 580px;
    font-size: clamp(15px, 2.6vw, 18px);
    line-height: 1.6;
    color: #505659;
    animation: bs-block-fade-up 540ms cubic-bezier(0.22, 1, 0.36, 1) 260ms both;
  }
  .bs-block-actions {
    margin: 0 0 clamp(26px, 5vw, 36px);
    animation: bs-block-fade-up 540ms cubic-bezier(0.22, 1, 0.36, 1) 320ms both;
  }
  .bs-block-back-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
    padding: 10px 22px;
    border: 1px solid rgba(44, 110, 203, 0.28);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.92);
    color: #121314;
    font: inherit;
    font-size: 15px;
    font-weight: 500;
    line-height: 1.2;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(18, 19, 20, 0.05);
    transition: background 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  }
  .bs-block-back-button:hover {
    background: #FFFFFF;
    border-color: rgba(44, 110, 203, 0.42);
    box-shadow: 0 2px 8px rgba(44, 110, 203, 0.1);
  }
  .bs-block-back-button:focus-visible {
    outline: 2px solid #2C6ECB;
    outline-offset: 3px;
  }
  .bs-block-back-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
  .bs-block-divider {
    margin: 0 auto clamp(18px, 4vw, 24px);
    width: min(140px, 36%);
    height: 1px;
    border: 0;
    background: linear-gradient(90deg, transparent, rgba(44, 110, 203, 0.32), transparent);
    animation: bs-block-fade-up 540ms cubic-bezier(0.22, 1, 0.36, 1) 380ms both;
  }
  .bs-block-brand {
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    font-size: 13px;
    line-height: 1.45;
    color: #616A71;
    animation: bs-block-fade-up 540ms cubic-bezier(0.22, 1, 0.36, 1) 440ms both;
  }
  .bs-block-brand-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #8A9299;
  }
  .bs-block-brand-row {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .bs-block-brand-divider {
    width: 1px;
    height: 28px;
    background: rgba(44, 110, 203, 0.22);
  }
  .bs-block-brand-name {
    font-weight: 600;
    font-size: 15px;
    color: #121314;
    text-align: left;
  }
  @keyframes bs-block-grid-drift {
    from { transform: translate3d(0, 0, 0); }
    to { transform: translate3d(-56px, -56px, 0); }
  }
  @keyframes bs-block-network-drift {
    from { transform: translate3d(0, 0, 0); }
    to { transform: translate3d(-1.5%, -1%, 0); }
  }
  @keyframes bs-block-rings-drift {
    from { transform: rotate(0deg); }
    to { transform: rotate(4deg); }
  }
  @keyframes bs-block-glow-breathe {
    0%, 100% { opacity: 0.7; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.05); }
  }
  @keyframes bs-block-logo-enter {
    from { opacity: 0; transform: scale(0.96) translateY(10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
  @keyframes bs-block-stage-enter {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes bs-block-fade-up {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @media (max-width: 640px) {
    .bs-block-perimeter { opacity: 0.35; width: 40px; }
    .bs-block-rings { opacity: 0.65; }
  }
  @media (prefers-reduced-motion: reduce) {
    .bs-block-grid,
    .bs-block-network,
    .bs-block-glow,
    .bs-block-rings {
      animation: none !important;
    }
    .bs-block-stage,
    .bs-block-logo-shell,
    .bs-block-eyebrow,
    .bs-block-title,
    .bs-block-description,
    .bs-block-actions,
    .bs-block-divider,
    .bs-block-brand {
      animation: none !important;
      opacity: 1 !important;
      transform: none !important;
    }
    .bs-block-back-button { transition: none; }
  }
`;

const BLOCK_PAGE_GO_BACK_SCRIPT = `
(function () {
  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.assign("/");
  }
  var button = document.getElementById("bs-block-go-back");
  if (button) {
    button.addEventListener("click", goBack);
  }
})();
`.trim();

export function buildBotShieldBlockedPageHtml() {
  const heroLogo = renderOfficialLogo({
    className: "bs-block-logo bs-block-logo--hero",
    width: 220,
    height: 220,
    alt: "BotShield",
  });
  const footerLogo = renderOfficialLogo({
    className: "bs-block-logo bs-block-logo--footer",
    width: 28,
    height: 28,
    alt: "",
  });

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Access Denied · BotShield</title>
    <style>${BOTSHIELD_BLOCKED_PAGE_STYLE}</style>
  </head>
  <body>
    <main class="bs-block-page">
      <div class="bs-block-bg" aria-hidden="true">
        <div class="bs-block-vignette"></div>
        <div class="bs-block-grid"></div>
        ${renderNetworkGraphic()}
        ${renderPerimeterGeometry()}
      </div>
      <div class="bs-block-stage">
        <div class="bs-block-logo-shell">
          <div class="bs-block-glow"></div>
          ${renderLogoRings()}
          ${heroLogo}
        </div>
        <p class="bs-block-eyebrow">
          <span class="bs-block-eyebrow-line" aria-hidden="true"></span>
          <span>PROTECTION IN ACTION.</span>
          <span class="bs-block-eyebrow-line" aria-hidden="true"></span>
        </p>
        <h1 class="bs-block-title">
          <span class="bs-block-title-access">Access</span>
          <span class="bs-block-title-denied">Denied</span>
        </h1>
        <p class="bs-block-description">${BLOCK_PAGE_DESCRIPTION}</p>
        <div class="bs-block-actions">
          <button type="button" class="bs-block-back-button" id="bs-block-go-back">
            <svg class="bs-block-back-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Go Back
          </button>
        </div>
        <hr class="bs-block-divider" />
        <footer class="bs-block-brand">
          <span class="bs-block-brand-label">Protected by</span>
          <div class="bs-block-brand-row">
            ${footerLogo}
            <span class="bs-block-brand-divider" aria-hidden="true"></span>
            <span class="bs-block-brand-name">BotShield: Bot Protection</span>
          </div>
        </footer>
      </div>
    </main>
    <script>${BLOCK_PAGE_GO_BACK_SCRIPT}<\/script>
  </body>
</html>`;
}

export function botShieldBlockedPageResponseHeaders() {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  };
}
