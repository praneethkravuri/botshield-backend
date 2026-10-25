import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useMatches, useNavigate } from "react-router";
import {
  BotShieldAppFrame,
  BotShieldActionButton,
} from "../design-system/BotShieldDesignSystem";
import { useThemeActivation } from "./ThemeActivationProvider.jsx";
import { ACTIVATION_MESSAGES } from "../../lib/onboarding.js";
import { buildThemeEditorDeepLink } from "../../lib/theme-extension-status.js";
import { mergeEmbeddedAppSearch } from "../../lib/embedded-app-navigation.js";
import {
  SecurityIllustration,
  ShieldMark,
  ThemeEditorTutorial,
} from "./OnboardingIllustrations.jsx";
import "../../styles/onboarding-premium.css";

const STEPS = [
  {
    title: "Open your Theme Editor",
    short: "Open theme",
    description:
      "Choose the Shopify theme where you want to activate BotShield.",
  },
  {
    title: "Enable BotShield",
    short: "Enable & save",
    description:
      "In the Theme Editor, open App embeds, turn on BotShield, and click Save.",
  },
  {
    title: "Verify activation",
    short: "Verify setup",
    description:
      "Return to BotShield and check that your app embed is active on your published theme.",
  },
];

export default function OnboardingPage() {
  const activation = useThemeActivation();
  const { state, checking, profile, acknowledge, saveError, check } =
    activation;
  const [step, setStep] = useState(0);
  const [editorOpened, setEditorOpened] = useState(false);
  const [neededSetup, setNeededSetup] = useState(false);
  const [completionRequested, setCompletionRequested] = useState(false);
  const [paused, setPaused] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [autoContinue, setAutoContinue] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const heading = useRef(null);
  const successHeading = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const matches = useMatches();
  const apiKey = matches.find((match) => match.data?.apiKey)?.data.apiKey || "";
  const editorUrl = buildThemeEditorDeepLink(profile.shop, apiKey);
  // Activation is separate from billing, protection settings and event reporting.
  const verified = activation.verified === true && !checking;
  const success =
    verified &&
    !reviewing &&
    (neededSetup || editorOpened || completionRequested);
  const overviewPath = mergeEmbeddedAppSearch("/app", location.search);

  useEffect(() => {
    acknowledge();
    check();
  }, [acknowledge, check]);
  useEffect(() => {
    if (!profile.shop) return;
    try {
      const saved = Number(
        sessionStorage.getItem(`botshield:onboarding-step:${profile.shop}`),
      );
      if (Number.isInteger(saved) && saved >= 0 && saved < STEPS.length)
        setStep(saved);
    } catch {
      /* Private browsing can make storage unavailable; setup still works. */
    }
  }, [profile.shop]);
  useEffect(() => {
    if (!checking && ["inactive", "missing", "unusable"].includes(state))
      setNeededSetup(true);
  }, [checking, state]);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!success) return undefined;
    successHeading.current?.focus();
    if (!autoContinue) return undefined;
    const timer = setTimeout(
      () => navigate(overviewPath, { replace: true }),
      2500,
    );
    return () => clearTimeout(timer);
  }, [success, autoContinue, navigate, overviewPath]);

  function chooseStep(next) {
    setStep(next);
    if (profile.shop) {
      try {
        sessionStorage.setItem(
          `botshield:onboarding-step:${profile.shop}`,
          String(next),
        );
      } catch {
        /* Optional navigation convenience only. */
      }
    }
    requestAnimationFrame(() => heading.current?.focus());
  }
  function openEditor() {
    if (!editorUrl) return;
    window.open(editorUrl, "_blank", "noopener,noreferrer");
    setEditorOpened(true);
    chooseStep(1);
  }
  return (
    <BotShieldAppFrame>
      <div className="botshield-onboarding-frame">
        <main
          className={`botshield-onboarding${paused ? " is-motion-paused" : ""}`}
          aria-label="BotShield setup guide"
        >
          <header className="ob-topline">
            <Link className="ob-brand" to={overviewPath}>
              <span>
                <ShieldMark />
              </span>
              BotShield
              <span className="ob-brand-divider" />
              Setup guide
            </Link>
            <Link className="ob-exit" to={overviewPath}>
              Explore dashboard <span aria-hidden="true">↗</span>
            </Link>
          </header>
          {success ? (
            <section
              className="ob-success"
              aria-labelledby="ob-success-heading"
            >
              <div className="ob-success-art" aria-hidden="true">
                <div className="ob-success-halo" />
                <ShieldMark success />
                <span className="ob-particle p1" />
                <span className="ob-particle p2" />
                <span className="ob-particle p3" />
                <span className="ob-particle p4" />
              </div>
              <span className="ob-eyebrow">ACTIVATION VERIFIED</span>
              <h1 id="ob-success-heading" ref={successHeading} tabIndex={-1}>
                BotShield is activated
              </h1>
              <p>
                Your app embed is enabled on your published theme. You can now
                explore your BotShield dashboard.
              </p>
              <div
                className="ob-success-progress"
                aria-label="All three setup steps complete"
              >
                <span>✓ Open theme</span>
                <i />
                <span>✓ Enable & save</span>
                <i />
                <span>✓ Verified</span>
              </div>
              <BotShieldActionButton
                variant="primary"
                onClick={() => navigate(overviewPath, { replace: true })}
              >
                Go to Overview
              </BotShieldActionButton>
              <p className="ob-success-note" role="status">
                {autoContinue
                  ? "Taking you to Overview shortly…"
                  : "Automatic navigation paused."}
              </p>
              <div className="ob-text-actions">
                <button onClick={() => setAutoContinue((value) => !value)}>
                  {autoContinue
                    ? "Stay on this page"
                    : "Continue automatically"}
                </button>
                <button
                  onClick={() => {
                    setReviewing(true);
                    setAutoContinue(false);
                  }}
                >
                  Review setup instructions
                </button>
              </div>
              <p className="ob-footnote">
                Activation confirms your theme embed. Your subscription and
                protection settings remain separate. Analytics shows recorded
                activity when relevant events become available.
              </p>
            </section>
          ) : (
            <>
              <section className="ob-hero" aria-labelledby="ob-title">
                <div className="ob-hero-copy">
                  <span className="ob-eyebrow">
                    <i /> WELCOME TO BOTSHIELD
                  </span>
                  <h1 id="ob-title">
                    Let’s get your store
                    <br className="ob-desktop-break" /> protected
                  </h1>
                  <p>
                    Activate BotShield in your Shopify theme, verify your setup,
                    and start monitoring security activity.
                  </p>
                  <div className="ob-profile">
                    <span className="ob-profile-avatar" aria-hidden="true">
                      {profile.shop
                        ? profile.shop.slice(0, 1).toUpperCase()
                        : "B"}
                    </span>
                    <div>
                      <strong>
                        {profile.shop
                          ? `Setting up BotShield for ${profile.shop}`
                          : profile.loading
                            ? "Loading your store…"
                            : "Your Shopify storefront"}
                      </strong>
                      <span>Theme target: current published theme</span>
                    </div>
                  </div>
                </div>
                <SecurityIllustration />
              </section>
              {verified ? (
                <div className="ob-already-active" role="status">
                  <span>
                    ✓ Your published theme embed is enabled. You can review the
                    guide anytime.
                  </span>
                  <Link to={overviewPath}>Go to Overview →</Link>
                </div>
              ) : null}
              <nav className="ob-progress" aria-label="Setup steps">
                <ol>
                  {STEPS.map((item, index) => (
                    <li
                      key={item.short}
                      className={`${step === index ? "is-current" : ""}${verified || (editorOpened && index === 0) ? " is-complete" : ""}`}
                    >
                      <button
                        aria-current={step === index ? "step" : undefined}
                        onClick={() => chooseStep(index)}
                      >
                        <span className="ob-step-number">
                          {verified || (editorOpened && index === 0)
                            ? "✓"
                            : `0${index + 1}`}
                        </span>
                        <span>
                          <small>STEP {index + 1}</small>
                          <strong>{item.short}</strong>
                        </span>
                        <span className="ob-step-arrow" aria-hidden="true">
                          →
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              </nav>
              <section className="ob-workspace" aria-labelledby="ob-step-title">
                <div className="ob-instructions" key={step}>
                  <span className="ob-eyebrow">STEP {step + 1} OF 3</span>
                  <h2 id="ob-step-title" ref={heading} tabIndex={-1}>
                    {STEPS[step].title}
                  </h2>
                  <p className="ob-step-description">
                    {STEPS[step].description}
                  </p>
                  {step === 0 ? (
                    <>
                      <div className="ob-theme-choice">
                        <span className="ob-theme-icon" aria-hidden="true">
                          ▤
                        </span>
                        <div>
                          <strong>Current published theme</strong>
                          <p>Your live storefront theme</p>
                        </div>
                        <span className="ob-published">Published</span>
                      </div>
                      <BotShieldActionButton
                        variant="primary"
                        disabled={!editorUrl}
                        onClick={openEditor}
                        icon="external"
                      >
                        Open Theme Editor
                      </BotShieldActionButton>
                      <p className="ob-microcopy">
                        Opens Shopify in a new tab. Keep BotShield open here.
                      </p>
                      <p className="ob-hint">
                        We open your published theme by default. If you switch
                        to a draft in Shopify, enable BotShield again on the
                        published theme before verifying.
                      </p>
                    </>
                  ) : null}
                  {step === 1 ? (
                    <>
                      <ol className="ob-written-steps">
                        <li>
                          <span>1</span>Open <strong>App embeds</strong> in the
                          left sidebar.
                        </li>
                        <li>
                          <span>2</span>Find <strong>BotShield</strong> and turn
                          the switch on.
                        </li>
                        <li>
                          <span>3</span>Click <strong>Save</strong>, then return
                          to this tab.
                        </li>
                      </ol>
                      <div className="ob-main-actions">
                        <BotShieldActionButton
                          variant="primary"
                          onClick={() => {
                            chooseStep(2);
                            setCompletionRequested(true);
                            check();
                          }}
                        >
                          I’ve saved — check activation
                        </BotShieldActionButton>
                        <button
                          className="ob-text-button"
                          disabled={!editorUrl}
                          onClick={openEditor}
                        >
                          Open Theme Editor ↗
                        </button>
                      </div>
                    </>
                  ) : null}
                  {step === 2 ? (
                    <>
                      <div
                        className={`ob-verification${checking ? " is-checking" : ""}${verified ? " is-verified" : ""}`}
                      >
                        <span className="ob-status-symbol" aria-hidden="true">
                          {checking ? "◌" : verified ? "✓" : "◇"}
                        </span>
                        <div>
                          <strong>
                            {checking
                              ? "Checking your theme activation..."
                              : ACTIVATION_MESSAGES[state]}
                          </strong>
                          {state === "unavailable" &&
                          activation.lastVerifiedState ? (
                            <p>
                              Last verified result:{" "}
                              {activation.lastVerifiedState}. This is not a
                              current confirmation.
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="ob-main-actions">
                        <BotShieldActionButton
                          variant="primary"
                          loading={checking}
                          onClick={() => {
                            setCompletionRequested(true);
                            check();
                          }}
                        >
                          {state === "unavailable"
                            ? "Retry activation check"
                            : "Check activation"}
                        </BotShieldActionButton>
                        <button
                          className="ob-text-button"
                          disabled={!editorUrl}
                          onClick={openEditor}
                        >
                          Open Theme Editor ↗
                        </button>
                      </div>
                      <p className="ob-hint">
                        Return to BotShield after saving. We recheck when this
                        tab becomes visible. Opening the editor alone does not
                        confirm activation.
                      </p>
                      {verified ? (
                        <BotShieldActionButton
                          onClick={() => {
                            setReviewing(false);
                            setAutoContinue(true);
                          }}
                        >
                          View activation confirmation
                        </BotShieldActionButton>
                      ) : null}
                    </>
                  ) : null}
                  {profile.loading ? (
                    <p role="status">Loading store details…</p>
                  ) : null}
                  {profile.error ? (
                    <div className="ob-inline-error" role="status">
                      <p>{profile.error}</p>
                      <button onClick={activation.loadProfile}>
                        Retry store details
                      </button>
                    </div>
                  ) : null}
                  {saveError ? (
                    <div className="ob-inline-error" role="status">
                      <p>{saveError}</p>
                      <button onClick={acknowledge}>
                        Retry saving guide visit
                      </button>
                    </div>
                  ) : null}
                  <details className="ob-written">
                    <summary>View written instructions</summary>
                    <ol>
                      <li>
                        Open the current published theme using Open Theme
                        Editor.
                      </li>
                      <li>
                        Select App embeds, find BotShield, and turn its switch
                        on.
                      </li>
                      <li>
                        Click Save in Shopify. Close the editor tab and return
                        to BotShield.
                      </li>
                      <li>Select Verify setup, then Check activation.</li>
                    </ol>
                    <p>
                      To deactivate later, turn the same app embed switch off
                      and save.
                    </p>
                    <p>
                      BotShield is a body-target app embed on storefront pages
                      where the theme renders it. It has no configurable Theme
                      Editor settings. It does not add an embed to Shopify
                      checkout. Manage protection preferences in BotShield’s
                      existing Protection and Settings pages.
                    </p>
                  </details>
                </div>
                <div className="ob-visual-panel">
                  <div className="ob-visual-heading">
                    <span className="ob-eyebrow">A QUICK WALKTHROUGH</span>
                    <span className="ob-tutorial-label">
                      Illustrated tutorial
                    </span>
                  </div>
                  <ThemeEditorTutorial
                    step={step}
                    paused={paused || reducedMotion}
                    replayKey={replayKey}
                  />
                  <div className="ob-tutorial-controls">
                    <p>
                      {reducedMotion
                        ? "Static preview · reduced motion enabled"
                        : "Open. Enable. Save. You’re in control."}
                    </p>
                    <div>
                      <button
                        aria-pressed={paused || reducedMotion}
                        disabled={reducedMotion}
                        onClick={() => setPaused((value) => !value)}
                      >
                        {paused || reducedMotion
                          ? "Play tutorial"
                          : "Pause tutorial"}
                      </button>
                      <button
                        disabled={reducedMotion}
                        onClick={() => {
                          setReplayKey((value) => value + 1);
                          setPaused(false);
                        }}
                      >
                        Replay
                      </button>
                    </div>
                  </div>
                  <div className="ob-visual-note">
                    <span aria-hidden="true">◇</span>
                    <p>
                      <strong>Your theme, your control.</strong> The animation
                      is a guide. Only Shopify’s activation information can
                      verify your setup.
                    </p>
                  </div>
                </div>
              </section>
              <footer className="ob-footer">
                <p>
                  <span aria-hidden="true">◇</span> No changes to your
                  subscription or protection preferences.
                </p>
                <Link
                  to={mergeEmbeddedAppSearch(
                    "/app/settings?section=connections",
                    location.search,
                  )}
                >
                  Connections & settings →
                </Link>
              </footer>
              <div className="ob-sr-only" role="status" aria-live="polite">
                {checking
                  ? "Checking your theme activation..."
                  : ACTIVATION_MESSAGES[state]}{" "}
                {verified ? "Published theme activation verified." : ""}
              </div>
            </>
          )}
        </main>
      </div>
    </BotShieldAppFrame>
  );
}
