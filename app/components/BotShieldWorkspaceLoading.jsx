/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import { publicInfo } from "../config/public-info.js";
import "../styles/workspace-loading.css";

export function BotShieldLoadingScreen() {
  return (
    <div className="bs-workspace-loading" role="status" aria-live="polite" aria-atomic="true">
      <div className="bs-workspace-loading__content">
        <div className="bs-workspace-loading__mark">
          <span className="bs-workspace-loading__glow" aria-hidden="true" />
          <img src={publicInfo.logoUrl} width="208" height="256" alt="BotShield" fetchPriority="high" />
        </div>
        <p>Preparing your BotShield workspace…</p>
        <span className="bs-workspace-loading__track" aria-hidden="true"><span /></span>
      </div>
    </div>
  );
}

/** Presentation only: children stay mounted and all existing work starts immediately. */
export default function BotShieldWorkspaceLoading({ children, initializing, error = "", navigating = false }) {
  const [settled, setSettled] = useState(!initializing || Boolean(error));
  const [timedOut, setTimedOut] = useState(false);
  const [exiting, setExiting] = useState(false);
  const active = !settled && initializing && !error && !timedOut;

  useEffect(() => {
    if (!initializing || error) setSettled(true);
    if (!initializing) setTimedOut(false);
  }, [initializing, error]);

  useEffect(() => {
    if (!active) return undefined;
    // A visual watchdog, never a delay or timeout on authentication/data requests.
    const timer = setTimeout(() => {
      setTimedOut(true);
      setSettled(true);
    }, 12000);
    return () => clearTimeout(timer);
  }, [active]);

  useEffect(() => {
    if (active) {
      setExiting(true);
      return undefined;
    }
    if (error || timedOut) {
      setExiting(false);
      return undefined;
    }
    const timer = setTimeout(() => setExiting(false), 160);
    return () => clearTimeout(timer);
  }, [active, error, timedOut]);

  return (
    <>
      {(error || (timedOut && initializing)) && (
        <div className="bs-workspace-loading-error" role="alert">
          <p>{error ? "Some BotShield interface components couldn't load." : "BotShield is taking longer than expected to initialize."} You can review any available information below or refresh to try again.</p>
          <button type="button" onClick={() => window.location.reload()}>Refresh BotShield</button>
        </div>
      )}
      <div className="bs-workspace-content" inert={active ? "" : undefined} aria-hidden={active || undefined}>
        {children}
      </div>
      {(active || exiting) && (
        <div className={`bs-workspace-loading-layer${active ? "" : " is-leaving"}`} aria-hidden={!active || undefined}>
          <BotShieldLoadingScreen />
        </div>
      )}
      {settled && navigating && !error && !timedOut && (
        <div className="bs-workspace-navigation-loading" role="status" aria-live="polite">
          <span className="bs-workspace-loading__track" aria-hidden="true"><span /></span>
          <span className="bs-workspace-loading__sr-only">Loading BotShield page…</span>
        </div>
      )}
    </>
  );
}
