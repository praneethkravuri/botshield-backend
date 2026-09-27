import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OFFICIAL_LOGO_TRANSPARENT_RELATIVE =
  "../../public/botshield-official-logo-transparent.png";
const OFFICIAL_LOGO_FALLBACK_RELATIVE =
  "../../public/botshield-official-logo.png";

const BLOCK_PAGE_DESCRIPTION =
  "Suspicious or unauthorized activity was detected, so entry has been denied to protect this storefront.";

let cachedOfficialLogoDataUri = null;

function getOfficialLogoDataUri() {
  if (cachedOfficialLogoDataUri) {
    return cachedOfficialLogoDataUri;
  }

  const transparentPath = join(__dirname, OFFICIAL_LOGO_TRANSPARENT_RELATIVE);
  const fallbackPath = join(__dirname, OFFICIAL_LOGO_FALLBACK_RELATIVE);
  const logoPath = existsSync(transparentPath) ? transparentPath : fallbackPath;
  const buffer = readFileSync(logoPath);
  const isPng =
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  const mime = isPng ? "image/png" : "image/jpeg";
  cachedOfficialLogoDataUri = `data:${mime};base64,${buffer.toString("base64")}`;
  return cachedOfficialLogoDataUri;
}

function renderOfficialLogo({ className, width, height, alt = "" }) {
  const src = getOfficialLogoDataUri();
  const altAttr = alt ? ` alt="${alt}"` : ' alt="" role="presentation"';
  return `<img class="${className}" src="${src}"${altAttr} width="${width}" height="${height}" decoding="async" />`;
}

function renderSideFrames() {
  return `<svg class="bs-block-edge bs-block-edge--left" viewBox="0 0 280 900" preserveAspectRatio="xMinYMid slice" aria-hidden="true" focusable="false">
  <path d="M0 120 L0 780 L48 780 L48 520 L120 420 L48 320 L48 120 Z" fill="rgba(255,255,255,0.42)" stroke="rgba(44,110,203,0.22)" stroke-width="1" />
  <path d="M12 200 L12 700" fill="none" stroke="#2C6ECB" stroke-width="1.25" opacity="0.38" />
  <path d="M28 260 L92 360 L28 460" fill="none" stroke="#121314" stroke-width="1" opacity="0.14" />
  <circle cx="92" cy="360" r="3" fill="#2C6ECB" opacity="0.5" />
  <path d="M56 140 L104 88 L152 140 L104 192 Z" fill="none" stroke="rgba(44,110,203,0.28)" stroke-width="1" />
</svg>
<svg class="bs-block-edge bs-block-edge--right" viewBox="0 0 280 900" preserveAspectRatio="xMaxYMid slice" aria-hidden="true" focusable="false">
  <path d="M280 120 L280 780 L232 780 L232 520 L160 420 L232 320 L232 120 Z" fill="rgba(255,255,255,0.42)" stroke="rgba(44,110,203,0.22)" stroke-width="1" />
  <path d="M268 200 L268 700" fill="none" stroke="#2C6ECB" stroke-width="1.25" opacity="0.38" />
  <path d="M252 260 L188 360 L252 460" fill="none" stroke="#121314" stroke-width="1" opacity="0.14" />
  <circle cx="188" cy="360" r="3" fill="#2C6ECB" opacity="0.5" />
  <path d="M224 140 L176 88 L128 140 L176 192 Z" fill="none" stroke="rgba(44,110,203,0.28)" stroke-width="1" />
</svg>`;
}

function renderPerimeterGeometry() {
  return `<svg class="bs-block-perimeter bs-block-perimeter--left" viewBox="0 0 120 420" aria-hidden="true" focusable="false">
  <path d="M8 0 L8 420 M8 0 L72 0 L72 88 L8 88" fill="none" stroke="#121314" stroke-width="1.5" opacity="0.18" />
  <path d="M24 120 L24 300 L64 300" fill="none" stroke="#2C6ECB" stroke-width="1.35" opacity="0.48" />
  <circle cx="64" cy="300" r="2.75" fill="#2C6ECB" opacity="0.55" />
</svg>
<svg class="bs-block-perimeter bs-block-perimeter--right" viewBox="0 0 120 420" aria-hidden="true" focusable="false">
  <path d="M112 0 L112 420 M112 0 L48 0 L48 88 L112 88" fill="none" stroke="#121314" stroke-width="1.5" opacity="0.18" />
  <path d="M96 120 L96 300 L56 300" fill="none" stroke="#2C6ECB" stroke-width="1.35" opacity="0.48" />
  <circle cx="56" cy="300" r="2.75" fill="#2C6ECB" opacity="0.55" />
</svg>`;
}

function renderLogoRings() {
  return `<svg class="bs-block-rings" viewBox="0 0 360 360" aria-hidden="true" focusable="false">
  <circle cx="180" cy="180" r="138" fill="none" stroke="#2C6ECB" stroke-width="1.15" opacity="0.26" stroke-dasharray="4 10" />
  <circle cx="180" cy="180" r="118" fill="none" stroke="#2C6ECB" stroke-width="1" opacity="0.2" />
  <circle cx="180" cy="180" r="96" fill="none" stroke="#121314" stroke-width="1" opacity="0.12" />
  <path d="M42 180 H118 M242 180 H318" stroke="#2C6ECB" stroke-width="1" opacity="0.32" />
  <path d="M180 42 V118 M180 242 V318" stroke="#2C6ECB" stroke-width="1" opacity="0.22" />
  <rect x="116" y="178" width="5" height="5" fill="#2C6ECB" opacity="0.45" />
  <rect x="239" y="178" width="5" height="5" fill="#2C6ECB" opacity="0.45" />
  <circle cx="180" cy="42" r="2.5" fill="#2C6ECB" opacity="0.4" />
  <circle cx="180" cy="318" r="2.5" fill="#2C6ECB" opacity="0.35" />
</svg>`;
}

function renderNetworkGraphic() {
  return `<svg class="bs-block-network" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <g class="bs-block-network-lines" stroke="#2C6ECB" stroke-width="1" fill="none" opacity="0.2">
    <path d="M0 180 L220 240 L480 200 L720 260 L980 220 L1200 280" />
    <path d="M0 520 L240 480 L520 560 L760 500 L1020 580 L1200 540" />
    <path d="M120 320 L360 280 L600 340 L840 300 L1080 360" opacity="0.65" />
  </g>
  <g class="bs-block-network-nodes" fill="#2C6ECB">
    <circle cx="220" cy="240" r="3" opacity="0.38" />
    <circle cx="480" cy="200" r="2.5" opacity="0.32" />
    <circle cx="720" cy="260" r="3" opacity="0.36" />
    <circle cx="520" cy="560" r="2.5" opacity="0.28" />
    <circle cx="360" cy="280" r="2" opacity="0.3" />
    <circle cx="840" cy="300" r="2" opacity="0.28" />
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
      radial-gradient(ellipse 62% 48% at 50% 34%, rgba(91, 158, 232, 0.16) 0%, transparent 58%),
      radial-gradient(ellipse 70% 55% at 50% 38%, rgba(44, 110, 203, 0.14) 0%, transparent 62%),
      radial-gradient(ellipse 130% 100% at 50% 50%, transparent 40%, rgba(18, 19, 20, 0.06) 100%),
      linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 45%, #F3F6F9 100%);
  }
  .bs-block-grid {
    position: absolute;
    inset: -25%;
    opacity: 0.62;
    background-image:
      linear-gradient(rgba(44, 110, 203, 0.065) 1px, transparent 1px),
      linear-gradient(90deg, rgba(44, 110, 203, 0.065) 1px, transparent 1px);
    background-size: 56px 56px;
    mask-image: radial-gradient(ellipse 80% 70% at 50% 42%, black 18%, transparent 82%);
    animation: bs-block-grid-drift 100s linear infinite;
  }
  .bs-block-network {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 1;
    animation: bs-block-network-drift 85s linear infinite;
  }
  .bs-block-edge {
    position: absolute;
    top: 50%;
    width: clamp(120px, 18vw, 220px);
    height: min(88vh, 720px);
    transform: translateY(-50%);
    pointer-events: none;
  }
  .bs-block-edge--left { left: 0; }
  .bs-block-edge--right { right: 0; }
  .bs-block-perimeter {
    position: absolute;
    top: 50%;
    width: clamp(56px, 9vw, 108px);
    height: auto;
    transform: translateY(-50%);
    opacity: 1;
  }
  .bs-block-perimeter--left { left: clamp(8px, 3vw, 36px); }
  .bs-block-perimeter--right { right: clamp(8px, 3vw, 36px); }
  .bs-block-stage {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 780px;
    text-align: center;
    animation: bs-block-stage-enter 600ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .bs-block-logo-shell {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto clamp(24px, 4.5vw, 32px);
    width: min(100%, 380px);
    min-height: clamp(160px, 28vw, 300px);
    animation: bs-block-logo-enter 620ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .bs-block-rings {
    position: absolute;
    width: min(96%, 360px);
    height: auto;
    animation: bs-block-rings-drift 120s linear infinite;
  }
  .bs-block-glow {
    position: absolute;
    width: clamp(180px, 40vw, 340px);
    aspect-ratio: 1;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(91, 158, 232, 0.5) 0%, rgba(44, 110, 203, 0.2) 42%, transparent 74%);
    filter: blur(4px);
    animation: bs-block-glow-breathe 6s ease-in-out infinite;
  }
  .bs-block-logo {
    position: relative;
    z-index: 1;
    display: block;
    object-fit: contain;
    background: transparent;
  }
  .bs-block-logo--hero {
    width: clamp(140px, 22vw, 228px);
    height: auto;
    max-height: 228px;
  }
  .bs-block-logo--footer {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
  }
  .bs-block-eyebrow {
    margin: 0 0 clamp(16px, 3vw, 22px);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    font-size: clamp(11px, 1.6vw, 13px);
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
    margin: 0 0 clamp(16px, 3vw, 22px);
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: center;
    gap: 0.28em;
    font-size: clamp(34px, 5.8vw, 58px);
    font-weight: 700;
    line-height: 1.08;
    letter-spacing: -0.03em;
    animation: bs-block-fade-up 540ms cubic-bezier(0.22, 1, 0.36, 1) 180ms both;
  }
  .bs-block-title-access { color: #121314; }
  .bs-block-title-denied { color: #2C6ECB; }
  .bs-block-description {
    margin: 0 auto clamp(26px, 4.5vw, 32px);
    max-width: 620px;
    font-size: clamp(16px, 2.4vw, 19px);
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
    gap: 10px;
    min-height: 44px;
    padding: 11px 26px;
    border: 1px solid rgba(44, 110, 203, 0.32);
    border-radius: 11px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(248, 250, 252, 0.94) 100%);
    color: #121314;
    font: inherit;
    font-size: 16px;
    font-weight: 500;
    line-height: 1.2;
    cursor: pointer;
    box-shadow:
      0 1px 2px rgba(18, 19, 20, 0.06),
      0 4px 14px rgba(44, 110, 203, 0.08);
    transition: background 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
  }
  .bs-block-back-button:hover {
    background: #FFFFFF;
    border-color: rgba(44, 110, 203, 0.48);
    box-shadow:
      0 2px 4px rgba(18, 19, 20, 0.06),
      0 6px 18px rgba(44, 110, 203, 0.12);
    transform: translateY(-1px);
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
    gap: 14px;
    font-size: 14px;
    line-height: 1.45;
    color: #616A71;
    animation: bs-block-fade-up 540ms cubic-bezier(0.22, 1, 0.36, 1) 440ms both;
  }
  .bs-block-brand-label {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #7A8289;
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
    font-size: 16px;
    color: #121314;
    text-align: left;
  }
  @media (min-width: 1024px) {
    .bs-block-title {
      font-size: clamp(52px, 4.2vw, 64px);
    }
    .bs-block-back-button {
      min-height: 46px;
      padding: 12px 28px;
    }
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
    .bs-block-edge { width: 72px; opacity: 0.55; }
    .bs-block-perimeter { opacity: 0.55; width: 44px; }
    .bs-block-rings { opacity: 0.75; }
    .bs-block-back-button:hover { transform: none; }
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
    width: 228,
    height: 228,
    alt: "BotShield",
  });
  const footerLogo = renderOfficialLogo({
    className: "bs-block-logo bs-block-logo--footer",
    width: 32,
    height: 32,
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
        ${renderSideFrames()}
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
