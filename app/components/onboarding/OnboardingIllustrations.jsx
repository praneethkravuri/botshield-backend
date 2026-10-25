/* eslint-disable react/prop-types */
import { publicInfo } from "../../config/public-info.js";

// Use the existing, transparent official artwork unchanged. Native dimensions
// reserve the correct aspect ratio; all motion belongs to surrounding elements.
export function OfficialBotShieldLogo() {
  return (
    <img
      className="ob-official-logo"
      src={publicInfo.logoUrl}
      width="208"
      height="256"
      alt=""
      decoding="async"
    />
  );
}

export function ActivationCheckmark() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        className="ob-check"
        d="m8 16 5 5 11-12"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SecurityIllustration() {
  return (
    <div className="ob-security-art" aria-hidden="true">
      <div className="ob-orbit ob-orbit-one" />
      <div className="ob-orbit ob-orbit-two" />
      <div className="ob-security-node ob-node-one">◇</div>
      <div className="ob-security-node ob-node-two">+</div>
      <svg className="ob-storefront" viewBox="0 0 300 200" fill="none">
        <rect
          x="39"
          y="65"
          width="222"
          height="117"
          rx="12"
          fill="white"
          stroke="#becde5"
        />
        <path d="m49 23-20 42h242l-20-42H49Z" fill="#e8efff" stroke="#becde5" />
        <path
          d="M29 65h242v9c0 12-15 17-24 6-10 11-25 10-33 0-9 11-24 10-32 0-10 10-23 10-32 0-9 10-23 10-32 0-9 10-24 11-33 0-10 11-24 10-32 0-10 11-24 6-24-6v-9Z"
          fill="#dce8ff"
          stroke="#becde5"
        />
        <rect x="61" y="107" width="65" height="49" rx="6" fill="#f0f5ff" />
        <path d="M76 131h34m-17-16v32" stroke="#a9bfe5" strokeWidth="2" />
        <rect x="159" y="106" width="58" height="76" rx="5" fill="#f0f5ff" />
        <circle cx="204" cy="146" r="2" fill="#8ca8d7" />
      </svg>
      <div className="ob-scan-line" />
      <div className="ob-hero-logo">
        <OfficialBotShieldLogo />
      </div>
      <span className="ob-art-caption">
        <i /> Built for your storefront
      </span>
    </div>
  );
}

export function ThemeEditorTutorial({ step, paused, replayKey }) {
  return (
    <div
      key={replayKey}
      className={`ob-tutorial ob-tutorial-step-${step}${paused ? " is-paused" : ""}`}
      aria-hidden="true"
    >
      {step === 0 ? (
        <div className="ob-theme-launch">
          <span className="ob-demo-shopify">Your Shopify store</span>
          <div className="ob-launch-header">
            <strong>Online Store</strong>
            <span>Themes</span>
          </div>
          <div className="ob-launch-preview">
            <span />
            <i />
            <i />
          </div>
          <div className="ob-launch-theme">
            <div>
              <strong>Current theme</strong>
              <span>Published</span>
            </div>
            <b>
              Customize <span>↗</span>
            </b>
          </div>
        </div>
      ) : null}
      <div className="ob-editor-top">
        <span>
          <i />
          <i />
          <i />
        </span>
        <b>Theme Editor</b>
        <span className="ob-demo-save">
          Save <span>✓</span>
        </span>
      </div>
      <div className="ob-editor-body">
        <div className="ob-editor-sidebar">
          <span className="ob-demo-tab">▦ &nbsp; Sections</span>
          <span className="ob-demo-tab ob-demo-embeds">
            ◇ &nbsp; App embeds
          </span>
          <div className="ob-demo-embed">
            <div className="ob-tutorial-logo">
              <OfficialBotShieldLogo />
            </div>
            <strong>BotShield</strong>
            <span className="ob-demo-toggle">
              <i />
            </span>
          </div>
          <div className="ob-demo-lines">
            <i />
            <i />
            <i />
          </div>
          <span className="ob-demo-saved">✓ &nbsp; Changes saved</span>
        </div>
        <div className="ob-editor-preview">
          <div className="ob-preview-nav" />
          <div className="ob-preview-hero">
            <span />
            <i />
          </div>
          <div className="ob-preview-products">
            <i />
            <i />
            <i />
          </div>
          <span className="ob-preview-caption">Your storefront preview</span>
        </div>
      </div>
      <svg
        className="ob-demo-cursor"
        width="23"
        height="28"
        viewBox="0 0 23 28"
      >
        <path
          d="m3 2 16 14-8 1-4 8L3 2Z"
          fill="#172c50"
          stroke="white"
          strokeWidth="2"
        />
      </svg>
      <span className="ob-demo-caption">
        Illustration only · does not change your theme
      </span>
    </div>
  );
}
