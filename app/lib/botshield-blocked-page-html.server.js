import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBlockedPageGoBackScript } from "./botshield-blocked-page-go-back.js";

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
  <path d="M0 120 L0 780 L48 780 L48 520 L120 420 L48 320 L48 120 Z" fill="rgba(255,255,255,0.48)" stroke="rgba(44,110,203,0.32)" stroke-width="1.1" />
  <path d="M12 200 L12 700" fill="none" stroke="#2C6ECB" stroke-width="1.35" opacity="0.48" />
  <path d="M28 260 L92 360 L28 460" fill="none" stroke="#121314" stroke-width="1.05" opacity="0.2" />
  <circle cx="92" cy="360" r="3.25" fill="#2C6ECB" opacity="0.58" />
  <path d="M56 140 L104 88 L152 140 L104 192 Z" fill="none" stroke="rgba(44,110,203,0.38)" stroke-width="1.05" />
</svg>
<svg class="bs-block-edge bs-block-edge--right" viewBox="0 0 280 900" preserveAspectRatio="xMaxYMid slice" aria-hidden="true" focusable="false">
  <path d="M280 120 L280 780 L232 780 L232 520 L160 420 L232 320 L232 120 Z" fill="rgba(255,255,255,0.48)" stroke="rgba(44,110,203,0.32)" stroke-width="1.1" />
  <path d="M268 200 L268 700" fill="none" stroke="#2C6ECB" stroke-width="1.35" opacity="0.48" />
  <path d="M252 260 L188 360 L252 460" fill="none" stroke="#121314" stroke-width="1.05" opacity="0.2" />
  <circle cx="188" cy="360" r="3.25" fill="#2C6ECB" opacity="0.58" />
  <path d="M224 140 L176 88 L128 140 L176 192 Z" fill="none" stroke="rgba(44,110,203,0.38)" stroke-width="1.05" />
</svg>`;
}

function renderPerimeterGeometry() {
  return `<svg class="bs-block-perimeter bs-block-perimeter--left" viewBox="0 0 120 420" aria-hidden="true" focusable="false">
  <path d="M8 0 L8 420 M8 0 L72 0 L72 88 L8 88" fill="none" stroke="#121314" stroke-width="1.55" opacity="0.26" />
  <path d="M24 120 L24 300 L64 300" fill="none" stroke="#2C6ECB" stroke-width="1.45" opacity="0.58" />
  <circle cx="64" cy="300" r="3" fill="#2C6ECB" opacity="0.62" />
</svg>
<svg class="bs-block-perimeter bs-block-perimeter--right" viewBox="0 0 120 420" aria-hidden="true" focusable="false">
  <path d="M112 0 L112 420 M112 0 L48 0 L48 88 L112 88" fill="none" stroke="#121314" stroke-width="1.55" opacity="0.26" />
  <path d="M96 120 L96 300 L56 300" fill="none" stroke="#2C6ECB" stroke-width="1.45" opacity="0.58" />
  <circle cx="56" cy="300" r="3" fill="#2C6ECB" opacity="0.62" />
</svg>`;
}

function renderLogoRings() {
  return `<svg class="bs-block-rings" viewBox="0 0 360 360" aria-hidden="true" focusable="false">
  <circle cx="180" cy="180" r="138" fill="none" stroke="#2C6ECB" stroke-width="1.25" opacity="0.38" stroke-dasharray="4 10" />
  <circle cx="180" cy="180" r="118" fill="none" stroke="#2C6ECB" stroke-width="1.1" opacity="0.32" />
  <circle cx="180" cy="180" r="96" fill="none" stroke="#121314" stroke-width="1.05" opacity="0.18" />
  <path d="M42 180 H118 M242 180 H318" stroke="#2C6ECB" stroke-width="1.05" opacity="0.42" />
  <path d="M180 42 V118 M180 242 V318" stroke="#2C6ECB" stroke-width="1.05" opacity="0.32" />
  <rect x="116" y="178" width="5" height="5" fill="#2C6ECB" opacity="0.55" />
  <rect x="239" y="178" width="5" height="5" fill="#2C6ECB" opacity="0.55" />
  <circle cx="180" cy="42" r="2.75" fill="#2C6ECB" opacity="0.5" />
  <circle cx="180" cy="318" r="2.75" fill="#2C6ECB" opacity="0.45" />
</svg>`;
}

function renderFloorReflection() {
  return `<div class="bs-block-floor" aria-hidden="true">
  <svg class="bs-block-floor-rings" viewBox="0 0 1200 280" preserveAspectRatio="xMidYMax meet" focusable="false">
    <ellipse cx="600" cy="280" rx="520" ry="72" fill="none" stroke="#2C6ECB" stroke-width="1.15" opacity="0.24" />
    <ellipse cx="600" cy="280" rx="420" ry="58" fill="none" stroke="#2C6ECB" stroke-width="1.1" opacity="0.3" />
    <ellipse cx="600" cy="280" rx="320" ry="44" fill="none" stroke="#121314" stroke-width="1" opacity="0.14" />
    <path d="M80 278 Q600 210 1120 278" fill="none" stroke="rgba(44,110,203,0.34)" stroke-width="1.65" />
    <path d="M200 278 L200 240 M1000 278 L1000 240" stroke="#2C6ECB" stroke-width="1.05" opacity="0.32" />
  </svg>
  <div class="bs-block-floor-glow"></div>
</div>`;
}

function renderNetworkGraphic() {
  return `<svg class="bs-block-network" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <g class="bs-block-network-lines" stroke="#2C6ECB" stroke-width="1.05" fill="none" opacity="0.3">
    <path d="M0 180 L220 240 L480 200 L720 260 L980 220 L1200 280" />
    <path d="M0 520 L240 480 L520 560 L760 500 L1020 580 L1200 540" />
    <path d="M120 320 L360 280 L600 340 L840 300 L1080 360" opacity="0.72" />
  </g>
  <g class="bs-block-network-nodes" fill="#2C6ECB">
    <circle cx="220" cy="240" r="3.25" opacity="0.48" />
    <circle cx="480" cy="200" r="2.75" opacity="0.42" />
    <circle cx="720" cy="260" r="3.25" opacity="0.46" />
    <circle cx="520" cy="560" r="2.75" opacity="0.38" />
    <circle cx="360" cy="280" r="2.25" opacity="0.4" />
    <circle cx="840" cy="300" r="2.25" opacity="0.38" />
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
    min-height: 100dvh;
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  .bs-block-page {
    position: relative;
    isolation: isolate;
    min-height: 100vh;
    min-height: 100dvh;
    width: 100%;
    max-width: 100vw;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(20px, 3.5vh, 56px) clamp(20px, 4vw, 32px);
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior-y: contain;
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
      radial-gradient(ellipse 64% 50% at 50% 32%, rgba(91, 158, 232, 0.22) 0%, transparent 58%),
      radial-gradient(ellipse 72% 58% at 50% 36%, rgba(44, 110, 203, 0.18) 0%, transparent 62%),
      radial-gradient(ellipse 130% 100% at 50% 50%, transparent 38%, rgba(18, 19, 20, 0.06) 100%),
      radial-gradient(ellipse 90% 40% at 50% 100%, rgba(44, 110, 203, 0.1) 0%, transparent 55%),
      linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 45%, #F3F6F9 100%);
  }
  .bs-block-grid {
    position: absolute;
    inset: -25%;
    opacity: 0.78;
    background-image:
      linear-gradient(rgba(44, 110, 203, 0.085) 1px, transparent 1px),
      linear-gradient(90deg, rgba(44, 110, 203, 0.085) 1px, transparent 1px);
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
  .bs-block-floor {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: clamp(120px, 22vh, 220px);
    pointer-events: none;
    overflow: hidden;
  }
  .bs-block-floor-rings {
    position: absolute;
    left: 50%;
    bottom: 0;
    width: min(1200px, 140vw);
    height: auto;
    transform: translateX(-50%);
    opacity: 0.95;
  }
  .bs-block-floor-glow {
    position: absolute;
    left: 50%;
    bottom: 0;
    width: min(760px, 88vw);
    height: 72px;
    transform: translateX(-50%);
    background: radial-gradient(ellipse 85% 100% at 50% 100%, rgba(74, 154, 255, 0.32) 0%, rgba(44, 110, 203, 0.18) 38%, transparent 74%);
    filter: blur(10px);
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
    max-width: 860px;
    text-align: center;
    animation: bs-block-stage-enter 600ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .bs-block-logo-shell {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto clamp(24px, 4.5vw, 36px);
    width: min(100%, 440px);
    min-height: clamp(160px, min(30vw, 26vh), 360px);
    animation: bs-block-logo-enter 620ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .bs-block-rings {
    position: absolute;
    width: min(98%, 420px);
    height: auto;
    animation: bs-block-rings-drift 120s linear infinite;
  }
  .bs-block-glow {
    position: absolute;
    width: clamp(200px, 44vw, 400px);
    aspect-ratio: 1;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(91, 158, 232, 0.62) 0%, rgba(44, 110, 203, 0.28) 44%, transparent 76%);
    filter: blur(5px);
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
    width: clamp(160px, 28vw, 340px);
    height: auto;
    max-height: 340px;
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
    font-size: clamp(42px, 7vw, 76px);
    font-weight: 700;
    line-height: 1.06;
    letter-spacing: -0.035em;
    animation: bs-block-fade-up 540ms cubic-bezier(0.22, 1, 0.36, 1) 180ms both;
  }
  .bs-block-title-access { color: #0A0B0D; }
  .bs-block-title-denied {
    color: #2C6ECB;
    background: linear-gradient(180deg, #5BA3FF 0%, #3588F0 38%, #2C6ECB 62%, #1E5FBC 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .bs-block-description {
    margin: 0 auto clamp(26px, 4.5vw, 34px);
    max-width: 680px;
    font-size: clamp(16px, 2.5vw, 20px);
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
    min-height: 52px;
    min-width: min(320px, 100%);
    padding: 14px 36px;
    border: 1px solid rgba(30, 95, 188, 0.45);
    border-radius: 999px;
    background: linear-gradient(180deg, #4A9AFF 0%, #2C7BE8 46%, #1E5FBC 100%);
    color: #ffffff;
    font: inherit;
    font-size: 17px;
    font-weight: 600;
    line-height: 1.2;
    cursor: pointer;
    box-shadow:
      0 1px 2px rgba(18, 19, 20, 0.1),
      0 10px 32px rgba(44, 110, 203, 0.44),
      0 0 24px rgba(74, 154, 255, 0.22),
      0 0 0 1px rgba(255, 255, 255, 0.12) inset;
    transition: background 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
  }
  .bs-block-back-button:hover {
    background: linear-gradient(180deg, #5BA3FF 0%, #3588F0 46%, #245AA8 100%);
    border-color: rgba(74, 154, 255, 0.55);
    box-shadow:
      0 2px 4px rgba(18, 19, 20, 0.1),
      0 14px 40px rgba(44, 110, 203, 0.52),
      0 0 28px rgba(74, 154, 255, 0.28),
      0 0 0 1px rgba(255, 255, 255, 0.14) inset;
    transform: translateY(-1px);
  }
  .bs-block-back-button:active {
    transform: translateY(0);
    background: linear-gradient(180deg, #3588F0 0%, #245AA8 52%, #1A4F96 100%);
    box-shadow:
      0 1px 2px rgba(18, 19, 20, 0.12),
      0 6px 20px rgba(44, 110, 203, 0.38),
      0 0 0 1px rgba(255, 255, 255, 0.1) inset;
  }
  .bs-block-back-button:focus-visible {
    outline: 2px solid #4A9AFF;
    outline-offset: 3px;
    box-shadow:
      0 1px 2px rgba(18, 19, 20, 0.1),
      0 10px 32px rgba(44, 110, 203, 0.44),
      0 0 0 3px rgba(74, 154, 255, 0.35);
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
    gap: 16px;
    font-size: 14px;
    line-height: 1.45;
    color: #616A71;
    animation: bs-block-fade-up 540ms cubic-bezier(0.22, 1, 0.36, 1) 440ms both;
  }
  .bs-block-brand-label {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #7A8289;
  }
  .bs-block-brand-row {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    flex-wrap: wrap;
  }
  .bs-block-brand-text {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    text-align: left;
  }
  .bs-block-brand-name {
    font-weight: 700;
    font-size: 17px;
    color: #121314;
    letter-spacing: -0.01em;
  }
  .bs-block-brand-tag {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #616A71;
  }
  @media (min-width: 1024px) {
    .bs-block-title {
      font-size: clamp(62px, 5.4vw, 80px);
    }
    .bs-block-back-button {
      min-height: 54px;
      padding: 15px 40px;
    }
  }
  @media (max-height: 860px) and (min-width: 641px) {
    .bs-block-page {
      align-items: center;
      padding-top: clamp(12px, 2.2vh, 28px);
      padding-bottom: clamp(16px, 2.8vh, 32px);
    }
    .bs-block-logo-shell {
      margin-bottom: clamp(12px, 2vh, 22px);
      min-height: clamp(120px, 21vh, 280px);
      width: min(100%, 400px);
    }
    .bs-block-logo--hero {
      width: clamp(136px, min(22vw, 19vh), 280px);
      max-height: min(280px, 24vh);
    }
    .bs-block-glow {
      width: clamp(160px, min(38vw, 36vh), 320px);
    }
    .bs-block-rings {
      width: min(92%, 380px);
    }
    .bs-block-eyebrow {
      margin-bottom: clamp(10px, 1.6vh, 16px);
      gap: 10px;
    }
    .bs-block-title {
      margin-bottom: clamp(10px, 1.6vh, 16px);
      font-size: clamp(34px, min(5.6vw, 6.4vh), 62px);
    }
    .bs-block-description {
      margin-bottom: clamp(16px, 2.4vh, 24px);
      font-size: clamp(15px, 2.2vw, 18px);
      line-height: 1.55;
    }
    .bs-block-actions {
      margin-bottom: clamp(16px, 2.6vh, 26px);
    }
    .bs-block-divider {
      margin-bottom: clamp(12px, 2vh, 18px);
    }
    .bs-block-brand {
      gap: 10px;
    }
    .bs-block-edge {
      height: min(78vh, 640px);
    }
  }
  @media (max-height: 720px) and (min-width: 641px) {
    .bs-block-logo-shell {
      min-height: clamp(96px, 17vh, 200px);
    }
    .bs-block-logo--hero {
      width: clamp(120px, min(19vw, 17vh), 200px);
      max-height: min(200px, 20vh);
    }
    .bs-block-title {
      font-size: clamp(30px, min(5vw, 5.6vh), 52px);
    }
    .bs-block-actions {
      margin-bottom: clamp(12px, 2vh, 20px);
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
    .bs-block-edge { width: 72px; opacity: 0.62; }
    .bs-block-perimeter { opacity: 0.62; width: 44px; }
    .bs-block-network { opacity: 0.88; }
    .bs-block-floor-rings { opacity: 0.82; }
    .bs-block-rings { opacity: 0.82; }
    .bs-block-back-button:hover { transform: none; }
    .bs-block-back-button:active { transform: none; }
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

export function buildBotShieldBlockedPageHtml() {
  const goBackScript = buildBlockedPageGoBackScript();
  const heroLogo = renderOfficialLogo({
    className: "bs-block-logo bs-block-logo--hero",
    width: 340,
    height: 340,
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
        ${renderFloorReflection()}
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
          <span class="bs-block-brand-label">
            <span class="bs-block-eyebrow-line" aria-hidden="true"></span>
            PROTECTED BY
            <span class="bs-block-eyebrow-line" aria-hidden="true"></span>
          </span>
          <div class="bs-block-brand-row">
            ${footerLogo}
            <div class="bs-block-brand-text">
              <span class="bs-block-brand-name">BotShield</span>
              <span class="bs-block-brand-tag">BOT PROTECTION</span>
            </div>
          </div>
        </footer>
      </div>
    </main>
    <script>${goBackScript}</script>
  </body>
</html>`;
}

export function botShieldBlockedPageResponseHeaders() {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  };
}
