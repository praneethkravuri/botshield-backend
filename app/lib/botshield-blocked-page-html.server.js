function renderBotShieldShieldSvg(gradientId) {
  return `<svg class="bs-block-shield-svg" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="${gradientId}" x1="44" y1="34" x2="84" y2="98" gradientUnits="userSpaceOnUse">
      <stop stop-color="#5B9AE8"/>
      <stop offset="1" stop-color="#2C6ECB"/>
    </linearGradient>
  </defs>
  <path d="M64 18 96 30V58C96 78.4 82.8 96.8 64 104C45.2 96.8 32 78.4 32 58V30L64 18Z" fill="url(#${gradientId})"/>
  <path d="M64 28 86 36V56C86 71.2 76.4 84.4 64 89.6C51.6 84.4 42 71.2 42 56V36L64 28Z" fill="rgba(255,255,255,0.22)"/>
</svg>`;
}

const BOTSHIELD_BLOCKED_PAGE_STYLE = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body {
    margin: 0;
    min-height: 100%;
    background: #fafafa;
    color: #121314;
  }
  body {
    min-height: 100vh;
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .bs-block-page {
    min-height: 100vh;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px 20px;
  }
  .bs-block-content {
    width: 100%;
    max-width: 640px;
    text-align: center;
  }
  .bs-block-hero {
    display: flex;
    justify-content: center;
    margin: 0 0 28px;
  }
  .bs-block-hero .bs-block-shield-svg {
    width: clamp(96px, 22vw, 152px);
    height: auto;
  }
  .bs-block-title {
    margin: 0 0 14px;
    font-size: clamp(26px, 5vw, 34px);
    font-weight: 650;
    line-height: 1.15;
    letter-spacing: -0.02em;
    color: #121314;
  }
  .bs-block-description {
    margin: 0 auto;
    max-width: 580px;
    font-size: clamp(14px, 2.4vw, 16px);
    line-height: 1.55;
    color: #505659;
  }
  .bs-block-brand {
    margin: 18px 0 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    line-height: 1.4;
    color: #616a71;
  }
  .bs-block-brand-row {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .bs-block-brand .bs-block-shield-svg {
    width: 20px;
    height: 20px;
  }
  .bs-block-brand-name {
    font-weight: 600;
    color: #121314;
  }
  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; transition: none !important; }
  }
`;

export function buildBotShieldBlockedPageHtml() {
  const heroShield = renderBotShieldShieldSvg("bsShieldFillHero");
  const brandShield = renderBotShieldShieldSvg("bsShieldFillBrand");

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
      <div class="bs-block-content">
        <div class="bs-block-hero">${heroShield}</div>
        <h1 class="bs-block-title">Access Denied</h1>
        <p class="bs-block-description">This store's security settings have restricted access to this page.</p>
        <div class="bs-block-brand">
          <span>Protected by</span>
          <div class="bs-block-brand-row">
            ${brandShield}
            <span class="bs-block-brand-name">BotShield: Bot Protection</span>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>`;
}

export function botShieldBlockedPageResponseHeaders() {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  };
}
