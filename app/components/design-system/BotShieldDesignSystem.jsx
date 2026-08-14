/* eslint-disable react/prop-types */
import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useBotShieldAction } from "../../hooks/use-botshield-action";
import { getUiStatus } from "../../lib/ui-status";

const defaultToastValue = {
  success: () => {},
  error: () => {},
  warning: () => {},
};

const ToastContext = createContext(defaultToastValue);

export function BotShieldToastProvider({ children }) {
  const isPreviewRoute =
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/ui-preview");

  if (typeof window === "undefined" || isPreviewRoute) {
    return (
      <ToastContext.Provider value={defaultToastValue}>{children}</ToastContext.Provider>
    );
  }

  return <BrowserBotShieldToastProvider>{children}</BrowserBotShieldToastProvider>;
}

function BrowserBotShieldToastProvider({ children }) {
  const shopify = useAppBridge();
  const lastToast = useRef({ message: "", at: 0 });

  const show = useCallback(
    (message, options = {}) => {
      const now = Date.now();
      if (
        lastToast.current.message === message &&
        now - lastToast.current.at < 1200
      ) {
        return;
      }
      lastToast.current = { message, at: now };
      shopify.toast.show(message, options);
    },
    [shopify],
  );

  const value = useMemo(
    () => ({
      success: (message) => show(message),
      error: (message) => show(message, { isError: true, duration: 5000 }),
      warning: (message) => show(message, { duration: 4500 }),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  );
}

export function useBotShieldToast() {
  return useContext(ToastContext);
}

export function BotShieldAppFrame({ children }) {
  return (
    <BotShieldToastProvider>
      <style>{`
        .botshield-admin-shell {
          --botshield-bg: #f6f6f4;
          --botshield-surface: #ffffff;
          --botshield-border: #e5e5e1;
          --botshield-border-strong: #cfcfca;
          --botshield-text: #1f1f1f;
          --botshield-subdued: #5f6368;
          --botshield-muted: #727272;
          --botshield-teal: #0f766e;
          --botshield-teal-dark: #006c65;
          --botshield-teal-soft: #e8f7f3;
          --botshield-warning-soft: #fff4e5;
          --botshield-critical-soft: #fff1f2;
          --botshield-radius: 16px;
          --botshield-shadow-soft: 0 1px 0 rgba(0, 0, 0, 0.035);
          --botshield-shadow-raised: 0 1px 0 rgba(0, 0, 0, 0.045), 0 10px 28px rgba(0, 0, 0, 0.045);
          min-height: 100vh;
          background: var(--botshield-bg);
          padding-bottom: 48px;
          color: var(--botshield-text);
        }
        .botshield-page {
          min-height: 100vh;
          background: var(--botshield-bg);
        }
        .botshield-route-shell {
          position: relative;
          min-height: 100vh;
        }
        .botshield-route-transition {
          animation: botshield-route-enter 160ms cubic-bezier(0.2, 0, 0, 1);
          will-change: opacity, transform;
        }
        @keyframes botshield-route-enter {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .botshield-titlebar {
          min-height: 56px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 0 18px;
          border-bottom: 1px solid var(--botshield-border);
          background: var(--botshield-bg);
        }
        .botshield-titlebar-brand {
          display: flex;
          align-items: center;
          gap: 9px;
          color: var(--botshield-text);
          font-size: 22px;
          line-height: 1.1;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .botshield-brand-mark {
          width: 24px;
          height: 24px;
          display: inline-grid;
          place-items: center;
          border-radius: 7px;
          background: var(--botshield-teal);
          color: #ffffff;
          font-size: 16px;
          font-weight: 760;
          box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.14);
        }
        .botshield-page-content {
          width: min(1180px, calc(100vw - 64px));
          margin: 0 auto;
          padding: 36px 0 84px;
        }
        .botshield-page-content--wide {
          width: min(1480px, calc(100vw - 40px));
        }
        .botshield-page-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 28px;
          padding: 22px 24px;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(250, 250, 250, 0.96)),
            var(--botshield-surface);
          border: 1px solid var(--botshield-border);
          border-radius: 16px;
          box-shadow: var(--botshield-shadow-soft);
        }
        .botshield-page-title {
          margin: 0;
          color: var(--botshield-text);
          font-size: 30px;
          line-height: 1.15;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .botshield-page-subtitle {
          margin: 8px 0 0;
          color: var(--botshield-subdued);
          font-size: 15px;
          line-height: 1.45;
        }
        .botshield-overview-app-title {
          display: flex;
          align-items: center;
          min-height: 22px;
          margin-bottom: 2px;
          color: var(--botshield-text);
          font-size: 14px;
          line-height: 1.2;
          font-weight: 700;
        }
        .botshield-app-title-row {
          min-height: 22px;
          margin-bottom: 2px;
          color: var(--botshield-text);
          font-size: 14px;
          line-height: 1.2;
          font-weight: 700;
        }
        .botshield-overview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 4px 0 10px;
        }
        .botshield-overview-content {
          width: min(1180px, calc(100vw - 56px));
          padding-top: 34px;
        }
        .botshield-overview-content .botshield-surface {
          padding: 24px 26px;
          box-shadow: none;
          border-color: var(--botshield-border-strong);
          border-radius: 16px;
        }
        .botshield-overview-title {
          margin: 0;
          color: #111111;
          font-size: 32px;
          line-height: 1.15;
          font-weight: 700;
        }
        .botshield-protection-page-title {
          color: #111111;
          font-family: var(--p-font-family-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
          font-size: 32px;
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 1.15;
        }
        .botshield-overview-subtitle {
          margin: 8px 0 0;
          color: var(--botshield-subdued);
          font-size: 15px;
          line-height: 1.42;
          max-width: 720px;
        }
        .botshield-overview-metric-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px;
        }
        .botshield-overview-metric-card {
          min-height: 186px;
          box-sizing: border-box;
          background: #ffffff;
          border: 1px solid var(--botshield-border-strong);
          border-radius: 16px;
          box-shadow: none;
          padding: 24px;
        }
        .botshield-overview-metric-title {
          color: #667085;
          font-size: 15px;
          line-height: 1.25;
          font-weight: 650;
        }
        .botshield-overview-metric-value {
          color: #111111;
          font-size: 38px;
          line-height: 1;
          font-weight: 750;
          margin-top: 4px;
        }
        .botshield-overview-metric-label {
          color: #101828;
          font-size: 17px;
          line-height: 1.22;
          font-weight: 700;
          margin-top: 6px;
        }
        .botshield-overview-metric-helper {
          color: #667085;
          font-size: 15px;
          line-height: 1.4;
          margin-top: 2px;
        }
        .botshield-overview-middle-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.42fr) minmax(360px, 1fr);
          gap: 18px;
          align-items: stretch;
        }
        .botshield-overview-middle-grid > .botshield-surface {
          height: 100%;
        }
        .botshield-overview-action-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }
        .botshield-overview-action-grid .botshield-surface {
          min-height: 168px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .botshield-overview-row {
          padding: 14px 0;
          border-bottom: 1px solid #e3e3e3;
        }
        .botshield-overview-row:first-child {
          padding-top: 0;
        }
        .botshield-overview-row:last-child {
          padding-bottom: 0;
          border-bottom: 0;
        }
        .botshield-overview-progress {
          width: min(608px, 100%);
          height: 8px;
          margin-top: 7px;
          background: #eeeeee;
        }
        .botshield-overview-progress .botshield-progress-fill {
          background: #1f1f1f;
          opacity: 0.12;
        }
        .botshield-overview-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 22px;
          min-width: 40px;
          padding: 2px 9px;
          border-radius: 999px;
          border: 1px solid #d8d8d8;
          background: #f4f4f2;
          color: #303030;
          font-size: 12px;
          line-height: 1;
          font-weight: 650;
          white-space: nowrap;
        }
        .botshield-overview-badge--muted {
          background: #eeeeee;
          color: #5f6368;
          border-color: #e2e2e2;
        }
        .botshield-overview-v2 {
          --overview-green: #29845a;
          --overview-amber: #b98900;
          --overview-red: #d72c0d;
          --overview-blue: #2c6ecb;
          --overview-ink: #202223;
          --overview-muted: #6d7175;
        }
        .botshield-v2-icon {
          display: inline-grid;
          flex: 0 0 auto;
          width: 30px;
          height: 30px;
          place-items: center;
          border: 1px solid #e1e3e5;
          border-radius: 8px;
          background: #f7f7f8;
          color: #4a4f55;
        }
        .botshield-v2-icon svg { width: 17px; height: 17px; }
        .botshield-v2-status,
        .botshield-v2-panel,
        .botshield-v2-kpi-card {
          background: #ffffff;
          border: 1px solid #dfe3e8;
          border-radius: 12px;
          box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04);
        }
        .botshield-v2-status {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 28px;
          padding: 24px;
          border-left-width: 4px;
        }
        .botshield-v2-status--active { border-left-color: var(--overview-green); }
        .botshield-v2-status--attention { border-left-color: var(--overview-amber); }
        .botshield-v2-status--degraded { border-left-color: var(--overview-red); }
        .botshield-v2-status-copy { min-width: 0; }
        .botshield-v2-eyebrow {
          margin-bottom: 8px;
          color: var(--overview-muted);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .botshield-v2-status-heading-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .botshield-v2-status-heading-row h2,
        .botshield-v2-panel-header h2 {
          margin: 0;
          color: var(--overview-ink);
          font-size: 18px;
          line-height: 1.3;
          font-weight: 700;
          letter-spacing: -0.01em;
        }
        .botshield-v2-status-indicator {
          width: 10px;
          height: 10px;
          flex: 0 0 auto;
          border-radius: 999px;
          background: var(--overview-green);
          box-shadow: 0 0 0 4px #e3f1ea;
        }
        .botshield-v2-status--attention .botshield-v2-status-indicator {
          background: var(--overview-amber);
          box-shadow: 0 0 0 4px #fff5d6;
        }
        .botshield-v2-status--degraded .botshield-v2-status-indicator {
          background: var(--overview-red);
          box-shadow: 0 0 0 4px #fff0ed;
        }
        .botshield-v2-status-copy > p,
        .botshield-v2-panel-header p {
          margin: 7px 0 0;
          max-width: 720px;
          color: var(--overview-muted);
          font-size: 13px;
          line-height: 1.5;
        }
        .botshield-v2-status-actions {
          display: flex;
          flex: 0 0 auto;
          align-items: center;
          gap: 8px;
        }
        .botshield-v2-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }
        .botshield-v2-kpi-card {
          min-height: 122px;
          padding: 17px 20px;
          transition: border-color 160ms ease, box-shadow 160ms ease;
        }
        .botshield-v2-kpi-card:hover {
          border-color: #c9cccf;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.06);
        }
        .botshield-v2-kpi-topline {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .botshield-v2-kpi-topline .botshield-v2-icon {
          width: 27px;
          height: 27px;
          border-color: transparent;
          background: #f1f2f3;
        }
        .botshield-v2-kpi-label {
          color: var(--overview-muted);
          font-size: 13px;
          font-weight: 600;
        }
        .botshield-v2-kpi-value {
          margin-top: 10px;
          color: var(--overview-ink);
          font-size: 30px;
          line-height: 1;
          font-weight: 700;
          letter-spacing: -0.025em;
        }
        .botshield-v2-kpi-detail {
          margin-top: 8px;
          color: var(--overview-muted);
          font-size: 12px;
        }
        .botshield-v2-impact {
          display: grid;
          grid-template-columns: minmax(220px, 0.8fr) minmax(0, 2.2fr);
          gap: 28px;
          align-items: center;
          padding: 22px 24px;
          border-block: 1px solid #dfe3e8;
          background: #fafbfb;
        }
        .botshield-v2-impact-heading h2,
        .botshield-v2-composition-heading h3 {
          margin: 0;
          color: var(--overview-ink);
          font-size: 17px;
          line-height: 1.3;
          font-weight: 700;
        }
        .botshield-v2-impact-heading p,
        .botshield-v2-composition-heading p {
          margin: 5px 0 0;
          color: var(--overview-muted);
          font-size: 12px;
          line-height: 1.45;
        }
        .botshield-v2-impact-metrics {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .botshield-v2-impact-metric {
          min-width: 0;
          padding: 2px 22px;
          border-left: 1px solid #dfe3e8;
        }
        .botshield-v2-impact-metric strong {
          display: block;
          color: var(--overview-ink);
          font-size: 24px;
          line-height: 1.1;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .botshield-v2-impact-metric div {
          margin-top: 7px;
          color: var(--overview-ink);
          font-size: 12px;
          font-weight: 650;
        }
        .botshield-v2-impact-metric span {
          display: block;
          margin-top: 3px;
          color: var(--overview-muted);
          font-size: 11px;
          line-height: 1.4;
        }
        .botshield-v2-operations {
          display: grid;
          grid-template-columns: minmax(220px, 1fr) minmax(270px, 1.2fr) auto;
          align-items: center;
          gap: 0;
          padding: 12px 16px;
          border: 1px solid #dfe3e8;
          border-radius: 10px;
          background: #ffffff;
        }
        .botshield-v2-operation {
          display: flex;
          min-width: 0;
          align-items: center;
          gap: 11px;
          padding-right: 18px;
        }
        .botshield-v2-operation + .botshield-v2-operation {
          margin-left: 18px;
          padding-left: 18px;
          border-left: 1px solid #e1e3e5;
        }
        .botshield-v2-operation > div { min-width: 0; }
        .botshield-v2-operation span {
          display: block;
          color: var(--overview-muted);
          font-size: 10px;
          font-weight: 650;
          letter-spacing: .02em;
          text-transform: uppercase;
        }
        .botshield-v2-operation strong {
          display: block;
          margin-top: 2px;
          color: var(--overview-ink);
          font-size: 13px;
          line-height: 1.3;
        }
        .botshield-v2-operation time {
          margin-left: auto;
          color: var(--overview-muted);
          font-size: 10px;
          white-space: nowrap;
        }
        .botshield-v2-primary-grid,
        .botshield-v2-secondary-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.65fr) minmax(330px, 1fr);
          gap: 16px;
          align-items: stretch;
        }
        .botshield-v2-secondary-grid {
          grid-template-columns: minmax(0, 2.2fr) minmax(240px, 0.8fr);
        }
        .botshield-v2-panel {
          min-width: 0;
          padding: 20px;
        }
        .botshield-v2-panel-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 20px;
        }
        .botshield-v2-legend {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 12px;
          color: var(--overview-muted);
          font-size: 11px;
          white-space: nowrap;
        }
        .botshield-v2-legend span { display: inline-flex; align-items: center; gap: 5px; }
        .botshield-v2-legend i {
          width: 8px;
          height: 8px;
          border-radius: 2px;
        }
        .botshield-v2-legend .is-allowed,
        .botshield-v2-chart-bar .is-allowed { background: var(--overview-blue); }
        .botshield-v2-legend .is-challenged,
        .botshield-v2-chart-bar .is-challenged { background: var(--overview-amber); }
        .botshield-v2-legend .is-blocked,
        .botshield-v2-chart-bar .is-blocked { background: var(--overview-red); }
        .botshield-v2-chart {
          position: relative;
          padding: 8px 2px 0 32px;
        }
        .botshield-v2-chart-scale {
          position: absolute;
          inset: 20px auto 22px 0;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          width: 28px;
          color: #8c9196;
          font-size: 10px;
          text-align: right;
        }
        .botshield-v2-chart-bars {
          display: flex;
          align-items: flex-end;
          gap: 4px;
          height: 220px;
          padding: 12px 8px 0;
          border-bottom: 1px solid #dfe3e8;
          background-image: repeating-linear-gradient(to bottom, #f1f2f3 0, #f1f2f3 1px, transparent 1px, transparent 55px);
        }
        .botshield-v2-chart-column {
          display: flex;
          flex: 1 1 0;
          align-items: flex-end;
          height: 100%;
          min-width: 3px;
          position: relative;
          outline: none;
          margin: 0;
          padding: 0;
          border: 0;
          background: transparent;
          cursor: default;
        }
        .botshield-v2-chart-bar {
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          width: 100%;
          min-height: 0;
          overflow: hidden;
          border-radius: 3px 3px 0 0;
          transition: opacity 150ms ease;
        }
        .botshield-v2-chart-column:hover .botshield-v2-chart-bar,
        .botshield-v2-chart-column:focus-visible .botshield-v2-chart-bar { opacity: 0.72; }
        .botshield-v2-chart-column:focus-visible {
          outline: 2px solid var(--overview-blue);
          outline-offset: 2px;
        }
        .botshield-v2-chart-tooltip {
          position: absolute;
          left: 50%;
          bottom: calc(100% + 8px);
          z-index: 5;
          display: none;
          width: 176px;
          padding: 10px 12px;
          transform: translateX(-50%);
          border: 1px solid #c9cccf;
          border-radius: 8px;
          background: #202223;
          color: #ffffff;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.16);
          font-size: 11px;
        }
        .botshield-v2-chart-column:nth-child(-n+3) .botshield-v2-chart-tooltip {
          left: 0;
          transform: none;
        }
        .botshield-v2-chart-column:nth-last-child(-n+3) .botshield-v2-chart-tooltip {
          right: 0;
          left: auto;
          transform: none;
        }
        .botshield-v2-chart-column:hover .botshield-v2-chart-tooltip,
        .botshield-v2-chart-column:focus-visible .botshield-v2-chart-tooltip { display: grid; gap: 5px; }
        .botshield-v2-chart-tooltip strong { margin-bottom: 2px; font-size: 12px; }
        .botshield-v2-chart-tooltip span {
          display: grid;
          grid-template-columns: 7px 1fr auto;
          gap: 6px;
          align-items: center;
          color: #e3e5e7;
        }
        .botshield-v2-chart-tooltip i { width: 7px; height: 7px; border-radius: 2px; }
        .botshield-v2-chart-tooltip b { color: #ffffff; }
        .botshield-v2-chart-axis {
          display: flex;
          justify-content: space-between;
          padding-top: 8px;
          color: var(--overview-muted);
          font-size: 11px;
        }
        .botshield-v2-chart-skeleton { height: 220px; }
        .botshield-v2-chart-error { display: grid; gap: 12px; justify-items: start; padding: 18px 0; }
        .botshield-v2-skeleton {
          min-height: 72px;
          border-radius: 8px;
          background: linear-gradient(90deg, #f1f2f3 20%, #fafbfb 50%, #f1f2f3 80%);
          background-size: 200% 100%;
          animation: botshieldSkeleton 1.4s ease-in-out infinite;
        }
        @keyframes botshieldSkeleton {
          from { background-position: 200% 0; }
          to { background-position: -200% 0; }
        }
        .botshield-v2-composition {
          margin-top: 22px;
          padding-top: 18px;
          border-top: 1px solid #dfe3e8;
        }
        .botshield-v2-composition-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 15px;
        }
        .botshield-v2-composition-list { display: grid; gap: 11px; }
        .botshield-v2-top-signal {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 10px;
          align-items: center;
          margin-bottom: 3px;
          padding: 10px 12px;
          border-left: 3px solid var(--overview-amber);
          background: #fbfaf7;
          color: var(--overview-muted);
          font-size: 11px;
        }
        .botshield-v2-top-signal strong { color: var(--overview-ink); font-size: 12px; }
        .botshield-v2-top-signal small { white-space: nowrap; }
        .botshield-v2-composition-row {
          display: grid;
          grid-template-columns: 130px minmax(80px, 1fr) 38px 34px;
          gap: 12px;
          align-items: center;
          color: var(--overview-muted);
          font-size: 11px;
        }
        .botshield-v2-composition-row > span { color: var(--overview-ink); font-weight: 600; }
        .botshield-v2-composition-row > strong { text-align: right; color: var(--overview-ink); }
        .botshield-v2-composition-row > small { text-align: right; color: var(--overview-muted); }
        .botshield-v2-composition-track {
          height: 6px;
          overflow: hidden;
          border-radius: 999px;
          background: #ebedef;
        }
        .botshield-v2-composition-track i {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: #5c6ac4;
        }
        .botshield-v2-composition-empty {
          margin: 0;
          padding: 14px;
          border: 1px dashed #c9cccf;
          border-radius: 8px;
          color: var(--overview-muted);
          font-size: 12px;
          text-align: center;
        }
        .botshield-v2-protection-list,
        .botshield-v2-activity-list { border-top: 1px solid #ebebeb; }
        .botshield-v2-protection-row {
          display: grid;
          grid-template-columns: 32px minmax(0, 1fr) auto;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 14px 0;
          border-bottom: 1px solid #ebebeb;
        }
        .botshield-v2-protection-copy { min-width: 0; }
        .botshield-v2-protection-row:last-child { border-bottom: 0; padding-bottom: 0; }
        .botshield-v2-protection-row strong,
        .botshield-v2-activity-event strong {
          display: block;
          color: var(--overview-ink);
          font-size: 13px;
          font-weight: 650;
        }
        .botshield-v2-protection-row span,
        .botshield-v2-activity-event span {
          display: block;
          margin-top: 3px;
          color: var(--overview-muted);
          font-size: 11px;
          line-height: 1.4;
        }
        .botshield-v2-protection-action {
          display: flex;
          flex: 0 0 auto;
          align-items: center;
          gap: 8px;
        }
        .botshield-v2-activity-header,
        .botshield-v2-activity-row {
          display: grid;
          grid-template-columns: 130px 90px minmax(180px, 1fr) 132px 82px;
          align-items: center;
          gap: 14px;
        }
        .botshield-v2-activity-header {
          min-height: 34px;
          padding: 0 2px;
          border-bottom: 1px solid #dfe3e8;
          color: #8c9196;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.035em;
          text-transform: uppercase;
        }
        .botshield-v2-activity-row {
          min-height: 62px;
          border-bottom: 1px solid #ebebeb;
          transition: background 140ms ease;
        }
        .botshield-v2-activity-row:hover {
          margin-inline: -8px;
          padding-inline: 8px;
          border-radius: 6px;
          background: #f7f7f8;
        }
        .botshield-v2-activity-row:last-child { border-bottom: 0; }
        .botshield-v2-activity-row time {
          color: var(--overview-muted);
          font-size: 11px;
        }
        .botshield-v2-activity-loading { display: grid; gap: 8px; }
        .botshield-v2-activity-loading .botshield-v2-skeleton { min-height: 56px; }
        .botshield-v2-quick-actions { display: block; }
        .botshield-v2-quick-actions .botshield-v2-panel-header { margin-bottom: 6px; }
        .botshield-v2-quick-action-list { display: grid; margin-top: 10px; }
        .botshield-v2-quick-action-row {
          display: grid;
          grid-template-columns: 32px minmax(0, 1fr) auto;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 0;
          border-bottom: 1px solid #ebebeb;
        }
        .botshield-v2-quick-action-row:last-child { border-bottom: 0; padding-bottom: 0; }
        .botshield-v2-quick-action-row strong {
          display: block;
          color: var(--overview-ink);
          font-size: 12px;
          font-weight: 650;
        }
        .botshield-v2-quick-action-row span {
          display: block;
          margin-top: 3px;
          color: var(--overview-muted);
          font-size: 10px;
          line-height: 1.4;
        }
        .botshield-v2-quick-action-row--primary {
          margin: 4px -10px -8px;
          padding: 14px 10px 8px;
          border-radius: 8px;
          background: #f6f6f7;
        }
        /* Overview V2 art-direction pass: shared surfaces and information hierarchy. */
        .botshield-overview-content { width: min(1140px, calc(100vw - 56px)); }
        .botshield-overview-v2 .botshield-overview-header { padding-bottom: 2px; }
        .botshield-v2-icon {
          width: 26px;
          height: 26px;
          border: 0;
          border-radius: 6px;
          background: #f1f2f3;
        }
        .botshield-v2-icon s-icon { display: inline-flex; }
        .botshield-v2-status {
          padding: 22px 24px;
          border-radius: 10px;
          box-shadow: none;
        }
        .botshield-v2-status-copy > p { max-width: 650px; }
        .botshield-v2-kpi-grid {
          gap: 0;
          overflow: hidden;
          border: 1px solid #dfe3e8;
          border-radius: 10px;
          background: #ffffff;
        }
        .botshield-v2-kpi-card {
          min-height: 112px;
          padding: 16px 18px;
          border: 0;
          border-right: 1px solid #e4e5e7;
          border-radius: 0;
          box-shadow: none;
        }
        .botshield-v2-kpi-card:last-child { border-right: 0; }
        .botshield-v2-kpi-card:hover { border-color: #e4e5e7; box-shadow: inset 0 2px 0 #c9cccf; }
        .botshield-v2-kpi-value { margin-top: 8px; font-size: 28px; }
        .botshield-v2-kpi-detail { margin-top: 6px; }
        .botshield-v2-health {
          padding: 18px 0;
          border-block: 1px solid #dfe3e8;
        }
        .botshield-v2-section-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }
        .botshield-v2-section-heading h2 { margin: 0; font-size: 17px; line-height: 1.3; }
        .botshield-v2-health-heading { align-items: center; margin-bottom: 15px; }
        .botshield-v2-health-heading .botshield-v2-eyebrow { margin-bottom: 4px; }
        .botshield-v2-health-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .botshield-v2-health-item {
          display: grid;
          grid-template-columns: 26px minmax(0, 1fr);
          gap: 2px 10px;
          min-width: 0;
          padding: 2px 18px;
          border-left: 1px solid #e1e3e5;
        }
        .botshield-v2-health-item:first-child { padding-left: 0; border-left: 0; }
        .botshield-v2-health-item .botshield-v2-icon { grid-row: 1 / 3; }
        .botshield-v2-health-item span { color: var(--overview-muted); font-size: 11px; }
        .botshield-v2-health-item strong { overflow: hidden; color: var(--overview-ink); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
        .botshield-v2-impact { padding: 20px 0; background: transparent; }
        .botshield-v2-impact-metric {
          display: grid;
          grid-template-columns: 26px minmax(0, 1fr);
          gap: 12px;
          padding: 2px 22px;
        }
        .botshield-v2-impact-metric strong { font-size: 26px; }
        .botshield-v2-impact-metric span { margin-top: 4px; color: var(--overview-ink); font-size: 12px; font-weight: 650; }
        .botshield-v2-impact-metric small { display: block; margin-top: 3px; color: var(--overview-muted); font-size: 11px; line-height: 1.4; }
        .botshield-v2-value {
          padding: 20px 0;
          border-bottom: 1px solid #dfe3e8;
        }
        .botshield-v2-value-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
        }
        .botshield-v2-value-header h2 { margin: 0; color: var(--overview-ink); font-size: 17px; line-height: 1.3; }
        .botshield-v2-value-header > div > p { margin: 5px 0 0; color: var(--overview-muted); font-size: 12px; }
        .botshield-v2-methodology { max-width: 360px; color: var(--overview-muted); font-size: 11px; }
        .botshield-v2-methodology summary { color: #4a4f55; cursor: pointer; font-weight: 650; }
        .botshield-v2-methodology summary:focus-visible { outline: 2px solid var(--overview-blue); outline-offset: 3px; border-radius: 3px; }
        .botshield-v2-methodology p { margin: 7px 0 0; line-height: 1.5; }
        .botshield-v2-value-empty {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 15px;
          padding: 16px;
          border-radius: 8px;
          background: #f8f9f9;
        }
        .botshield-v2-value-empty h3 { margin: 0; color: var(--overview-ink); font-size: 13px; }
        .botshield-v2-value-empty p { margin: 4px 0 0; color: var(--overview-muted); font-size: 11px; line-height: 1.45; }
        .botshield-v2-value-content { display: grid; grid-template-columns: minmax(180px, .55fr) minmax(0, 1.45fr); gap: 28px; align-items: end; margin-top: 18px; }
        .botshield-v2-value-total strong { display: block; color: var(--overview-ink); font-size: 28px; line-height: 1; letter-spacing: -.025em; }
        .botshield-v2-value-total span { display: block; margin-top: 7px; color: var(--overview-muted); font-size: 11px; }
        .botshield-v2-value-chart { display: flex; align-items: flex-end; gap: 4px; height: 92px; padding: 8px 8px 0; border-bottom: 1px solid #dfe3e8; background-image: repeating-linear-gradient(to bottom, #f1f2f3 0, #f1f2f3 1px, transparent 1px, transparent 30px); }
        .botshield-v2-value-chart > span { flex: 1 1 0; min-width: 4px; max-width: 28px; border-radius: 3px 3px 0 0; background: var(--overview-green); transition: opacity 140ms ease; }
        .botshield-v2-value-chart > span:hover { opacity: .72; }
        .botshield-v2-workspace {
          overflow: hidden;
          border: 1px solid #dfe3e8;
          border-radius: 10px;
          background: #ffffff;
        }
        .botshield-v2-primary-grid,
        .botshield-v2-secondary-grid { gap: 0; }
        .botshield-v2-section { min-width: 0; padding: 21px; }
        .botshield-v2-primary-grid > .botshield-v2-section + .botshield-v2-section,
        .botshield-v2-secondary-grid > .botshield-v2-section + .botshield-v2-section { border-left: 1px solid #dfe3e8; }
        .botshield-v2-panel-header { margin-bottom: 18px; }
        .botshield-v2-monitoring-empty {
          display: flex;
          min-height: 188px;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          padding: 20px;
          border-radius: 8px;
          background: #f8f9f9;
          text-align: center;
        }
        .botshield-v2-monitoring-empty .botshield-v2-icon { margin-bottom: 9px; background: #eceeef; }
        .botshield-v2-monitoring-empty h3 { margin: 0; color: var(--overview-ink); font-size: 14px; }
        .botshield-v2-monitoring-empty p { max-width: 460px; margin: 6px 0 12px; color: var(--overview-muted); font-size: 12px; line-height: 1.45; }
        .botshield-v2-monitoring-empty small { margin-top: 8px; color: var(--overview-muted); font-size: 10px; }
        .botshield-v2-composition-empty {
          display: flex;
          align-items: center;
          gap: 9px;
          margin: 0;
          padding: 10px 0;
          border: 0;
          border-radius: 0;
          text-align: left;
        }
        .botshield-v2-composition-empty p { margin: 0; color: var(--overview-muted); font-size: 12px; }
        .botshield-v2-protection-row { gap: 12px; padding: 13px 0; }
        .botshield-v2-protection-action { gap: 6px; }
        .botshield-v2-activity-row { min-height: 58px; }
        .botshield-v2-quick-action-row { padding: 13px 0; }
        .botshield-v2-quick-action-row--primary { margin: 3px -8px -6px; padding: 12px 8px 6px; }
        /* Final Overview V2 polish */
        .botshield-overview-v2 > s-stack { gap: 18px; }
        .botshield-overview-v2 .botshield-overview-title { font-size: 26px; letter-spacing: -.025em; }
        .botshield-overview-v2 .botshield-overview-subtitle { max-width: 680px; font-size: 13px; line-height: 1.5; }
        .botshield-v2-eyebrow { margin-bottom: 5px; font-size: 10px; letter-spacing: .075em; }
        .botshield-v2-icon {
          width: 28px;
          height: 28px;
          border: 1px solid #e4e5e7;
          background: #f7f7f8;
          color: #3f4449;
        }
        .botshield-v2-icon s-icon { color: #4a4f55; }
        .botshield-v2-status { padding: 20px 22px; border-color: #d8dcdf; background: #fff; }
        .botshield-v2-status-heading-row h2 { font-size: 19px; letter-spacing: -.015em; }
        .botshield-v2-status-copy > p { margin-top: 5px; }
        .botshield-v2-kpi-card { min-height: 104px; padding: 15px 17px; }
        .botshield-v2-kpi-topline .botshield-v2-icon { width: 26px; height: 26px; border: 1px solid #e5e7e9; background: #f7f7f8; }
        .botshield-v2-kpi-label { font-size: 12px; }
        .botshield-v2-kpi-value { font-size: 29px; font-variant-numeric: tabular-nums; }
        .botshield-v2-health {
          padding: 14px 16px;
          border: 1px solid #dfe3e8;
          border-radius: 8px;
          background: #fafbfb;
        }
        .botshield-v2-health-heading { margin-bottom: 12px; }
        .botshield-v2-health-grid { padding-top: 11px; border-top: 1px solid #e1e3e5; }
        .botshield-v2-health-item { padding-inline: 15px; }
        .botshield-v2-health-item strong { display: flex; align-items: center; gap: 6px; font-size: 12px; }
        .botshield-v2-health-dot { display: inline-block; width: 7px; height: 7px; flex: 0 0 auto; border-radius: 999px; background: #b7bbc0; }
        .botshield-v2-health-dot.is-healthy { background: var(--overview-green); }
        .botshield-v2-health-dot.is-attention { background: var(--overview-amber); }
        .botshield-v2-health-dot.is-info { background: var(--overview-blue); }
        .botshield-v2-impact { gap: 22px; padding: 17px 0; }
        .botshield-v2-impact-metric { gap: 10px; padding-inline: 18px; }
        .botshield-v2-impact-metric strong { font-size: 24px; font-variant-numeric: tabular-nums; }
        .botshield-v2-value {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(320px, .8fr);
          gap: 22px;
          align-items: center;
          padding: 15px 0;
        }
        .botshield-v2-value-header { display: block; }
        .botshield-v2-value-header > div > p { max-width: 520px; }
        .botshield-v2-methodology { margin-top: 8px; }
        .botshield-v2-value-empty { margin: 0; padding: 12px 14px; }
        .botshield-v2-value-empty > strong { color: #8c9196; font-size: 24px; font-weight: 500; }
        .botshield-v2-value-empty h3 { font-size: 12px; }
        .botshield-v2-value-empty p { max-width: 500px; }
        .botshield-v2-value-content { margin-top: 0; }
        .botshield-v2-section { padding: 19px; }
        .botshield-v2-panel-header h2 { font-size: 17px; }
        .botshield-v2-threat-panel { min-height: 510px; }
        .botshield-v2-chart-controls { display: grid; justify-items: end; gap: 10px; }
        .botshield-v2-period-selector {
          display: inline-flex;
          padding: 2px;
          border: 1px solid #dfe3e8;
          border-radius: 7px;
          background: #f7f7f8;
        }
        .botshield-v2-period-selector button {
          min-width: 38px;
          padding: 5px 8px;
          border: 0;
          border-radius: 5px;
          background: transparent;
          color: #6d7175;
          cursor: pointer;
          font: inherit;
          font-size: 10px;
          font-weight: 700;
        }
        .botshield-v2-period-selector button:hover { color: #202223; background: #eceeef; }
        .botshield-v2-period-selector button.is-active { background: #fff; color: #202223; box-shadow: 0 1px 2px rgba(0,0,0,.08); }
        .botshield-v2-period-selector button:focus-visible { outline: 2px solid var(--overview-blue); outline-offset: 2px; }
        .botshield-v2-legend { gap: 10px; }
        .botshield-v2-chart { padding-top: 2px; }
        .botshield-v2-chart-bars { height: 250px; gap: 3px; padding-top: 15px; background-image: repeating-linear-gradient(to bottom, #eef0f1 0, #eef0f1 1px, transparent 1px, transparent 62px); }
        .botshield-v2-chart-bar { min-width: 2px; }
        .botshield-v2-chart-column:hover .botshield-v2-chart-bar,
        .botshield-v2-chart-column:focus-visible .botshield-v2-chart-bar { opacity: .8; filter: saturate(1.08); }
        .botshield-v2-chart-tooltip { width: 184px; padding: 11px 12px; }
        .botshield-v2-chart-tooltip .botshield-v2-tooltip-total { grid-template-columns: 1fr auto; margin-top: 3px; padding-top: 6px; border-top: 1px solid #4a4f55; color: #fff; }
        .botshield-v2-monitoring-empty { min-height: 220px; }
        .botshield-v2-composition { margin-top: 18px; padding-top: 16px; }
        .botshield-v2-protection-row { grid-template-columns: 30px minmax(0, 1fr) auto; padding: 12px 0; }
        .botshield-v2-protection-row .botshield-v2-icon { width: 27px; height: 27px; }
        .botshield-v2-protection-copy strong { font-size: 12px; }
        .botshield-v2-protection-copy span { max-width: 240px; }
        .botshield-v2-activity-header,
        .botshield-v2-activity-row { grid-template-columns: 118px 82px minmax(160px, 1fr) 118px 86px; }
        .botshield-v2-activity-row { min-height: 54px; }
        .botshield-v2-activity-event { min-width: 0; }
        .botshield-v2-activity-event span {
          overflow: hidden;
          margin-top: 0;
          color: #4a4f55;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .botshield-v2-activity-row time { font-variant-numeric: tabular-nums; }
        .botshield-v2-quick-action-row { grid-template-columns: 30px minmax(0, 1fr) auto; padding: 11px 0; }
        .botshield-v2-quick-action-row .botshield-v2-icon { width: 27px; height: 27px; }
        .botshield-v2-quick-action-row--primary { margin: 2px -7px -5px; padding: 11px 7px 5px; background: #f7f7f8; }
        /* Overview precision pass: density, sparse charts, and interaction clarity. */
        .botshield-overview-v2 > s-stack { gap: 16px; }
        .botshield-v2-status-actions s-button,
        .botshield-v2-protection-action s-button,
        .botshield-v2-quick-action-row s-button { flex: 0 0 auto; }
        .botshield-v2-kpi-card {
          position: relative;
          min-width: 0;
          transition: background-color 120ms ease, box-shadow 120ms ease;
        }
        .botshield-v2-kpi-card:hover { background: #fafbfb; box-shadow: inset 0 2px 0 #b7bbc0; }
        .botshield-v2-kpi-value { line-height: .95; letter-spacing: -.035em; }
        .botshield-v2-kpi-detail { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .botshield-v2-health { padding: 13px 15px; }
        .botshield-v2-health-item { align-items: center; gap: 3px 9px; }
        .botshield-v2-health-item .botshield-v2-icon { width: 26px; height: 26px; }
        .botshield-v2-impact-heading p { max-width: 300px; }
        .botshield-v2-impact-metric { align-items: start; }
        .botshield-v2-impact-metric .botshield-v2-icon { margin-top: 1px; }
        .botshield-v2-value { gap: 18px; padding: 14px 0; }
        .botshield-v2-methodology summary {
          width: max-content;
          max-width: 100%;
          border-bottom: 1px dotted #8c9196;
          list-style-position: inside;
          transition: color 120ms ease, border-color 120ms ease;
        }
        .botshield-v2-methodology summary:hover { color: var(--overview-ink); border-color: var(--overview-ink); }
        .botshield-v2-methodology[open] summary { color: var(--overview-ink); }
        .botshield-v2-value-empty {
          min-width: 0;
          gap: 10px;
          border: 1px solid #ebecee;
          background: #fafbfb;
        }
        .botshield-v2-value-empty > strong { width: 20px; text-align: center; }
        .botshield-v2-value-empty > div { min-width: 0; }
        .botshield-v2-panel-header { align-items: flex-start; margin-bottom: 16px; }
        .botshield-v2-chart-controls { align-content: start; }
        .botshield-v2-period-selector button { transition: color 120ms ease, background-color 120ms ease, box-shadow 120ms ease; }
        .botshield-v2-chart { padding-left: 35px; }
        .botshield-v2-chart-bars {
          gap: 2px;
          height: 232px;
          padding-inline: 10px;
          background-image: repeating-linear-gradient(to bottom, #eceeef 0, #eceeef 1px, transparent 1px, transparent 58px);
        }
        .botshield-v2-chart-column { justify-content: center; }
        .botshield-v2-chart-bar { max-width: 22px; }
        .botshield-v2-chart[data-density="sparse"] .botshield-v2-chart-bar { max-width: 16px; }
        .botshield-v2-chart[data-density="medium"] .botshield-v2-chart-bar { max-width: 19px; }
        .botshield-v2-chart-column.is-empty-day { pointer-events: none; }
        .botshield-v2-chart-column.is-active-day { cursor: help; }
        .botshield-v2-chart-column.is-active-day:hover .botshield-v2-chart-bar,
        .botshield-v2-chart-column.is-active-day:focus-visible .botshield-v2-chart-bar { opacity: .78; transform: translateY(-1px); }
        .botshield-v2-chart-bar { transition: opacity 120ms ease, transform 120ms ease; }
        .botshield-v2-chart-tooltip { line-height: 1.35; }
        .botshield-v2-chart-tooltip .is-allowed { background: var(--overview-blue); }
        .botshield-v2-chart-tooltip .is-challenged { background: var(--overview-amber); }
        .botshield-v2-chart-tooltip .is-blocked { background: var(--overview-red); }
        .botshield-v2-chart-axis { padding-inline: 2px; font-variant-numeric: tabular-nums; }
        .botshield-v2-protection-row { min-width: 0; }
        .botshield-v2-protection-copy span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .botshield-v2-protection-action { min-width: 0; }
        .botshield-v2-activity-row { padding-inline: 2px; }
        .botshield-v2-activity-row:hover { margin-inline: -6px; padding-inline: 8px; }
        .botshield-v2-activity-row:focus-within { border-radius: 6px; background: #f7f7f8; }
        .botshield-v2-quick-action-row { min-width: 0; }
        .botshield-v2-quick-action-row > div { min-width: 0; }
        .botshield-v2-quick-action-row span { max-width: 290px; }
        @media (max-width: 1024px) {
          .botshield-v2-value { grid-template-columns: 1fr; }
          .botshield-v2-value-empty { margin-top: 2px; }
          .botshield-v2-chart-bars { height: 230px; }
        }
        .botshield-overview-v2 s-button:focus-visible,
        .botshield-overview-v2 button:focus-visible {
          outline: 2px solid var(--overview-blue);
          outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          .botshield-overview-v2 *,
          .botshield-overview-v2 *::before,
          .botshield-overview-v2 *::after {
            scroll-behavior: auto !important;
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
        .botshield-analytics-content {
          width: min(1180px, calc(100vw - 56px));
          padding-top: 34px;
          font-family: var(--p-font-family-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
        }
        .botshield-analytics-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          padding: 4px 0 18px;
        }
        .botshield-analytics-tabs {
          display: flex;
          align-items: stretch;
          gap: 6px;
          min-height: 58px;
          margin-bottom: 18px;
          padding: 10px 12px 0;
          background: #ffffff;
          border: 1px solid #d4d4d4;
          border-radius: 12px;
          box-shadow: none;
        }
        .botshield-analytics-tab {
          appearance: none;
          border: 0;
          border-bottom: 2px solid transparent;
          border-radius: 8px 8px 0 0;
          background: transparent;
          color: #5f6368;
          cursor: pointer;
          font: inherit;
          font-size: 15px;
          font-weight: 700;
          line-height: 1;
          min-width: 112px;
          padding: 15px 18px 16px;
          text-align: center;
        }
        .botshield-analytics-tab:hover {
          color: #303030;
          background: #f6f6f7;
        }
        .botshield-analytics-tab--active {
          color: #303030;
          background: #f6f6f7;
          border-bottom-color: #1f1f1f;
        }
        .botshield-analytics-stat-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px;
          margin-bottom: 20px;
        }
        .botshield-analytics-stat-card {
          min-height: 126px;
          box-sizing: border-box;
          background: #ffffff;
          border: 1px solid var(--botshield-border-strong);
          border-radius: 16px;
          box-shadow: none;
          padding: 22px 24px 18px;
        }
        .botshield-analytics-stat-label {
          color: #5f6368;
          font-size: 15px;
          line-height: 1.2;
          font-weight: 700;
        }
        .botshield-analytics-stat-value {
          margin-top: 9px;
          color: #303030;
          font-size: 40px;
          line-height: 1;
          font-weight: 750;
          letter-spacing: -0.02em;
        }
        .botshield-analytics-chart-card {
          background: #ffffff;
          border: 1px solid var(--botshield-border-strong);
          border-radius: 16px;
          box-shadow: none;
          padding: 18px;
        }
        .botshield-analytics-card-title {
          margin: 0 0 12px;
          color: #303030;
          font-size: 18px;
          line-height: 1.25;
          font-weight: 700;
        }
        .botshield-analytics-chart-panel {
          background: #ffffff;
          border: 1px solid #dcdcdc;
          border-radius: 12px;
          min-height: 324px;
          padding: 18px 20px 16px;
        }
        .botshield-analytics-chart-tabs {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }
        .botshield-analytics-chart-tab {
          appearance: none;
          border: 0;
          border-radius: 12px;
          background: transparent;
          color: #303030;
          cursor: pointer;
          font: inherit;
          font-size: 15px;
          font-weight: 700;
          min-width: 160px;
          padding: 12px 16px;
          text-align: left;
        }
        .botshield-analytics-chart-tab:hover,
        .botshield-analytics-chart-tab--active {
          background: #f0f0f1;
        }
        .botshield-analytics-chart-wrap {
          position: relative;
          width: 100%;
          overflow: hidden;
        }
        .botshield-analytics-chart {
          display: block;
          width: 100%;
          height: 270px;
        }
        .botshield-analytics-axis-label {
          fill: #303030;
          font-size: 10px;
          font-weight: 500;
          font-family: var(--p-font-family-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
        }
        .botshield-analytics-axis-label--x {
          font-size: 10px;
        }
        .botshield-analytics-gridline {
          stroke: #e3e3e3;
          stroke-width: 1;
        }
        .botshield-analytics-line {
          stroke: #303030;
          stroke-width: 1.5;
        }
        .botshield-analytics-dot {
          fill: #303030;
        }
        .botshield-analytics-v2 { --analytics-ink: #24272a; --analytics-muted: #50565b; --analytics-tertiary: #62686d; --analytics-border: #e1e3e4; --analytics-type-body: .875rem; --analytics-type-small: .75rem; --analytics-type-heading: 1.0625rem; display: grid; gap: 20px; padding-bottom: 48px; color: var(--analytics-ink); font-family: var(--p-font-family-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif); font-size: var(--analytics-type-body); font-synthesis: none; -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; }
        .botshield-analytics-controls { display: flex; gap: 14px; align-items: flex-end; padding: 12px 14px; border: 1px solid var(--analytics-border); border-radius: 10px; background: rgba(255,255,255,.96); box-shadow: 0 1px 2px rgba(24, 28, 31, .025), 0 6px 18px rgba(24, 28, 31, .025); }
        .botshield-analytics-period { display: inline-flex; justify-self: start; gap: 2px; padding: 3px; border: 1px solid #d7d8d9; border-radius: 9px; background: #f4f5f5; }
        .botshield-analytics-period button { min-width: 49px; padding: 7px 10px; border: 0; border-radius: 6px; background: transparent; color: #565b60; font: inherit; font-size: .8125rem; font-weight: 550; line-height: 1.125rem; cursor: pointer; }
        .botshield-analytics-period button:hover { background: #e9eaeb; color: var(--analytics-ink); }
        .botshield-analytics-period button.is-active { background: #202223; color: #fff; }
        .botshield-analytics-filter-row { display: grid; flex: 1; grid-template-columns: 135px 130px 165px minmax(190px, 1fr) auto; gap: 9px; align-items: end; min-width: 0; }
        .botshield-analytics-filter-row label { display: grid; gap: 5px; min-width: 0; color: #555b60; font-size: .75rem; font-weight: 550; line-height: 1rem; }
        .botshield-analytics-filter-row select, .botshield-analytics-filter-row input { width: 100%; box-sizing: border-box; height: 36px; padding: 0 10px; border: 1px solid #c7c9cb; border-radius: 8px; background: #fff; color: var(--analytics-ink); font: inherit; font-size: .8125rem; line-height: 1.25rem; }
        .botshield-analytics-filter-row select:focus, .botshield-analytics-filter-row input:focus { outline: 2px solid #2c6ecb; outline-offset: 1px; }
        .botshield-analytics-clear, .botshield-analytics-detail-button, .botshield-analytics-pagination button { border: 0; background: transparent; color: #2c5f9e; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
        .botshield-analytics-clear { height: 34px; padding: 0 6px; }
        .botshield-analytics-toolbar-actions { display: flex; gap: 5px; align-items: center; min-height: 34px; }
        .botshield-analytics-toolbar-actions .botshield-action-button { min-height: 34px; }
        .botshield-analytics-clear:disabled, .botshield-analytics-pagination button:disabled { color: #a3a6a9; cursor: default; }
        .botshield-analytics-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border: 1px solid var(--analytics-border); border-radius: 10px; overflow: hidden; background: #fff; box-shadow: 0 1px 2px rgba(24, 28, 31, .025); }
        .botshield-analytics-kpi { display: grid; align-content: center; min-width: 0; min-height: 102px; padding: 15px 18px; border-right: 1px solid #e4e5e6; }
        .botshield-analytics-kpi:last-child { border-right: 0; }
        .botshield-analytics-kpi > span { color: var(--analytics-muted); font-size: .75rem; font-weight: 550; line-height: 1rem; }
        .botshield-analytics-kpi > strong { margin-top: 6px; overflow: hidden; color: var(--analytics-ink); font-size: 1.75rem; font-variant-numeric: tabular-nums; font-weight: 650; line-height: 2rem; letter-spacing: -.035em; text-overflow: ellipsis; white-space: nowrap; }
        .botshield-analytics-kpi.is-compact > strong { font-size: 1.25rem; line-height: 1.5rem; letter-spacing: -.025em; }
        .botshield-analytics-kpi > small { margin-top: 5px; color: var(--analytics-tertiary); font-size: .75rem; line-height: 1.125rem; }
        .botshield-analytics-section-label { margin: 12px 0 -8px; color: #686e73; font-size: .6875rem; font-weight: 600; line-height: 1rem; letter-spacing: .085em; text-transform: uppercase; }
        .botshield-analytics-split { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
        .botshield-analytics-split--primary { grid-template-columns: minmax(0, 1.45fr) minmax(310px, .75fr); }
        .botshield-analytics-panel { min-width: 0; padding: 19px 20px; border: 1px solid var(--analytics-border); border-radius: 10px; background: #fff; box-shadow: 0 1px 2px rgba(24, 28, 31, .018); }
        .botshield-analytics-panel > header { margin-bottom: 17px; }
        .botshield-analytics-panel > header h2 { margin: 0; color: var(--analytics-ink); font-size: var(--analytics-type-heading); line-height: 1.5rem; font-weight: 650; letter-spacing: -.012em; }
        .botshield-analytics-panel > header p { max-width: 48rem; margin: 4px 0 0; color: var(--analytics-muted); font-size: var(--analytics-type-body); line-height: 1.375rem; }
        .botshield-analytics-ranked { display: grid; gap: 13px; }
        .botshield-analytics-ranked-row { display: grid; grid-template-columns: minmax(180px, .9fr) minmax(180px, 1.4fr); gap: 16px; align-items: center; padding: 3px 0; }
        .botshield-analytics-ranked-row > div { display: grid; gap: 2px; min-width: 0; }
        .botshield-analytics-ranked-row strong { overflow: hidden; color: #292d30; font-size: .875rem; line-height: 1.25rem; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
        .botshield-analytics-ranked-row span { color: var(--analytics-tertiary); font-size: .75rem; line-height: 1rem; }
        .botshield-analytics-ranked-measure > span { text-align: right; }
        .botshield-analytics-bar-track { display: block; width: 100%; height: 8px; overflow: hidden; border-radius: 99px; background: #e8eaeb; }
        .botshield-analytics-bar-fill { display: block; height: 100%; border-radius: inherit; background: #59636e; }
        .botshield-analytics-bar-fill.is-high { background: #c04444; }
        .botshield-analytics-bar-fill.is-medium { background: #c88719; }
        .botshield-analytics-bar-fill.is-low { background: #4d8060; }
        .botshield-analytics-footnote { margin: 14px 0 0; color: var(--analytics-tertiary); font-size: .75rem; line-height: 1.125rem; }
        .botshield-analytics-risk-list { display: grid; gap: 16px; }
        .botshield-analytics-risk-total { display: flex; gap: 6px; align-items: baseline; margin: -5px 0 15px; padding-bottom: 12px; border-bottom: 1px solid #eceeef; }
        .botshield-analytics-risk-total strong { color: #25282b; font-size: 20px; }
        .botshield-analytics-risk-total span { color: var(--analytics-tertiary); font-size: .75rem; }
        .botshield-analytics-risk-row { display: grid; grid-template-columns: 8px 78px minmax(80px, 1fr) 36px 42px; gap: 10px; align-items: center; color: #3e4246; font-size: 13px; font-variant-numeric: tabular-nums; }
        .botshield-analytics-risk-row > span:last-child, .botshield-analytics-risk-row > b { text-align: right; }
        .botshield-analytics-risk-dot { width: 7px; height: 7px; border-radius: 50%; background: #4d8060; }
        .botshield-analytics-risk-dot.is-high { background: #c04444; }
        .botshield-analytics-risk-dot.is-medium { background: #c88719; }
        .botshield-analytics-table-wrap { width: 100%; overflow-x: auto; }
        .botshield-analytics-table { width: 100%; border-collapse: collapse; color: #383d41; font-size: .8125rem; line-height: 1.25rem; text-align: left; }
        .botshield-analytics-table th, .botshield-analytics-table td { height: 42px; box-sizing: border-box; padding: 9px 12px; border-bottom: 1px solid #e5e7e8; vertical-align: middle; white-space: nowrap; }
        .botshield-analytics-table thead th { height: 38px; padding-top: 8px; padding-bottom: 8px; border-bottom-color: #d6d9da; background: #f6f7f7; color: #50565b; font-size: .6875rem; line-height: 1rem; font-weight: 600; letter-spacing: .025em; text-transform: none; }
        .botshield-analytics-table tbody th { color: #303336; font-weight: 600; }
        .botshield-analytics-table tbody tr:hover { background: #f8f9f9; }
        .botshield-analytics-table tbody tr:last-child > * { border-bottom: 0; }
        .botshield-analytics-table td:not(:first-child), .botshield-analytics-table thead th:not(:first-child) { font-variant-numeric: tabular-nums; }
        .botshield-analytics-outcomes-table th:not(:first-child), .botshield-analytics-outcomes-table td:not(:first-child) { text-align: right; }
        .botshield-analytics-outcomes-table .botshield-analytics-rate { margin-left: auto; }
        .botshield-analytics-visitor-table th:nth-child(2), .botshield-analytics-visitor-table td:nth-child(2) { width: 78px; text-align: right; }
        .botshield-analytics-visitor-table th:nth-child(4), .botshield-analytics-visitor-table td:nth-child(4), .botshield-analytics-visitor-table th:nth-child(5), .botshield-analytics-visitor-table td:nth-child(5) { width: 112px; }
        .botshield-analytics-visitor-table th:last-child, .botshield-analytics-visitor-table td:last-child { width: 92px; text-align: right; }
        .botshield-analytics-event-table th:first-child, .botshield-analytics-event-table td:first-child { width: 168px; font-variant-numeric: tabular-nums; }
        .botshield-analytics-event-table th:last-child, .botshield-analytics-event-table td:last-child { width: 90px; text-align: right; }
        .botshield-analytics-outcome-number { display: inline-flex; min-width: 25px; justify-content: center; padding: 3px 6px; border-radius: 6px; background: #f0f1f1; font-weight: 700; }
        .botshield-analytics-outcome-number.is-blocked { color: #a93434; background: #fff0ef; }
        .botshield-analytics-outcome-number.is-challenged { color: #865d13; background: #fff5dd; }
        .botshield-analytics-outcome-number.is-allowed { color: #39704c; background: #edf7ef; }
        .botshield-analytics-rate { display: grid; grid-template-columns: 42px 72px; gap: 8px; align-items: center; min-width: 122px; }
        .botshield-analytics-event-table td:nth-child(3), .botshield-analytics-event-table td:nth-child(4), .botshield-analytics-event-table td:nth-child(6) { max-width: 190px; overflow: hidden; text-overflow: ellipsis; }
        .botshield-analytics-activity { display: grid; gap: 15px; }
        .botshield-analytics-activity-facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-bottom: 1px solid #e5e6e7; }
        .botshield-analytics-activity-facts > div { display: grid; gap: 4px; padding: 0 15px 13px; border-right: 1px solid #e5e6e7; }
        .botshield-analytics-activity-facts > div:first-child { padding-left: 0; }
        .botshield-analytics-activity-facts > div:last-child { border-right: 0; }
        .botshield-analytics-activity-facts span { color: var(--analytics-tertiary); font-size: .75rem; font-weight: 650; line-height: 1rem; }
        .botshield-analytics-activity-facts strong { color: #303438; font-size: .875rem; line-height: 1.25rem; }
        .botshield-analytics-histogram { display: flex; align-items: flex-end; gap: 4px; height: 88px; padding: 8px 4px 0; border-bottom: 1px solid #dfe1e2; background-image: repeating-linear-gradient(to bottom, #eff0f1 0, #eff0f1 1px, transparent 1px, transparent 29px); }
        .botshield-analytics-activity.is-sparse { max-width: 720px; }
        .botshield-analytics-activity.is-sparse .botshield-analytics-histogram { height: 46px; background-image: repeating-linear-gradient(to bottom, #eff0f1 0, #eff0f1 1px, transparent 1px, transparent 23px); }
        .botshield-analytics-histogram > span { display: flex; align-items: flex-end; flex: 1; height: 100%; min-width: 3px; }
        .botshield-analytics-histogram i { display: block; width: 100%; border-radius: 3px 3px 0 0; background: #59636e; transition: background 120ms ease; }
        .botshield-analytics-histogram > span:hover i { background: #2f3942; }
        .botshield-analytics-compact-ranking { display: grid; max-width: 760px; gap: 12px; }
        .botshield-analytics-compact-ranking > div { display: grid; grid-template-columns: minmax(125px, 1fr) minmax(80px, .9fr) 68px 92px; gap: 10px; align-items: center; }
        .botshield-analytics-compact-ranking span { overflow: hidden; color: #303438; font-size: .8125rem; font-weight: 650; line-height: 1.25rem; text-overflow: ellipsis; white-space: nowrap; }
        .botshield-analytics-compact-ranking b, .botshield-analytics-compact-ranking small { color: #5b6166; font-size: .75rem; font-variant-numeric: tabular-nums; line-height: 1rem; text-align: right; }
        .botshield-analytics-empty { display: grid; place-items: center; min-height: 112px; padding: 12px; border: 1px dashed #d8dadb; border-radius: 9px; background: #fafbfb; text-align: center; }
        .botshield-analytics-empty strong { color: #4b4f52; font-size: 12px; }
        .botshield-analytics-empty span { max-width: 430px; margin-top: 4px; color: var(--analytics-tertiary); font-size: .8125rem; line-height: 1.25rem; }
        .botshield-analytics-insight { display: flex; max-width: 820px; gap: 13px; align-items: center; padding: 15px 17px; border: 1px solid #e1e5e8; border-left: 2px solid #71869a; border-radius: 3px 9px 9px 3px; background: #f7f8f9; }
        .botshield-analytics-insight > div:last-child { display: grid; gap: 4px; }
        .botshield-analytics-insight span { color: #65707a; font-size: .6875rem; font-weight: 750; line-height: 1rem; letter-spacing: .075em; text-transform: uppercase; }
        .botshield-analytics-insight strong { color: #24282b; font-size: 1rem; font-weight: 650; line-height: 1.375rem; letter-spacing: -.01em; }
        .botshield-analytics-insight p { margin: 0; color: var(--analytics-muted); font-size: .8125rem; line-height: 1.25rem; }
        .botshield-analytics-combinations { display: grid; gap: 8px; }
        .botshield-analytics-combination { display: grid; grid-template-columns: minmax(220px, 1fr) auto; gap: 20px; align-items: center; padding: 11px 0; border-bottom: 1px solid #e7e8e9; }
        .botshield-analytics-combination:last-child { border-bottom: 0; }
        .botshield-analytics-combination-signals { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
        .botshield-analytics-combination-signals span { display: flex; gap: 6px; align-items: center; }
        .botshield-analytics-combination-signals strong { padding: 5px 8px; border: 1px solid #dfe1e2; border-radius: 7px; color: #34373a; font-size: .8125rem; line-height: 1.125rem; }
        .botshield-analytics-combination-signals b { color: #7b8186; font-size: .8125rem; }
        .botshield-analytics-combination dl { display: flex; gap: 22px; margin: 0; }
        .botshield-analytics-combination dl > div { display: grid; gap: 2px; }
        .botshield-analytics-combination dt { color: var(--analytics-tertiary); font-size: .6875rem; font-weight: 650; line-height: 1rem; }
        .botshield-analytics-combination dd { margin: 0; color: #303438; font-size: .8125rem; font-variant-numeric: tabular-nums; font-weight: 700; line-height: 1.125rem; }
        .botshield-analytics-summary { display: grid; grid-template-columns: 180px 1fr; gap: 22px; align-items: center; padding: 14px 16px; border-top: 1px solid #dfe1e2; border-bottom: 1px solid #dfe1e2; }
        .botshield-analytics-summary header span { color: var(--analytics-tertiary); font-size: .6875rem; font-weight: 700; line-height: 1rem; letter-spacing: .075em; text-transform: uppercase; }
        .botshield-analytics-summary h2 { margin: 2px 0 0; color: #2d3033; font-size: 1rem; font-weight: 600; line-height: 1.25rem; letter-spacing: -.008em; }
        .botshield-analytics-summary dl { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 15px; margin: 0; }
        .botshield-analytics-summary dl > div { display: grid; gap: 3px; min-width: 0; }
        .botshield-analytics-summary dt { color: #5b6267; font-size: .75rem; font-weight: 550; line-height: 1rem; }
        .botshield-analytics-summary dd { margin: 0; overflow: hidden; color: #25292c; font-size: .9375rem; font-weight: 600; line-height: 1.25rem; letter-spacing: -.008em; text-overflow: ellipsis; white-space: nowrap; }
        .botshield-analytics-visitor-id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .75rem; font-variant-numeric: tabular-nums; line-height: 1rem; }
        .botshield-analytics-repeat { margin-left: 7px; padding: 2px 5px; border-radius: 5px; background: #eef3f8; color: #42617f; font-size: 8px; font-weight: 800; text-transform: uppercase; }
        .botshield-analytics-visitor-table tr.is-recurring { background: #fbfcfd; }
        .botshield-analytics-pagination { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-top: 13px; border-top: 1px solid #e7e8e9; color: var(--analytics-tertiary); font-size: .75rem; line-height: 1rem; }
        .botshield-analytics-pagination > div { display: flex; gap: 12px; align-items: center; }
        .botshield-analytics-detail-backdrop { position: fixed; z-index: 1000; inset: 0; display: flex; justify-content: flex-end; background: rgba(25, 28, 30, .32); }
        .botshield-analytics-detail { width: min(440px, 92vw); height: 100%; box-sizing: border-box; overflow-y: auto; padding: 23px; background: #fff; box-shadow: -12px 0 30px rgba(0,0,0,.12); }
        .botshield-analytics-detail > header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 17px; border-bottom: 1px solid #e1e2e3; }
        .botshield-analytics-detail > header span { color: var(--analytics-tertiary); font-size: .6875rem; font-weight: 700; line-height: 1rem; letter-spacing: .075em; text-transform: uppercase; }
        .botshield-analytics-detail h2 { margin: 5px 0 0; color: #25282b; font-size: 20px; }
        .botshield-analytics-detail > header button { width: 32px; height: 32px; border: 0; border-radius: 7px; background: #f0f1f1; color: #34383b; font-size: 21px; cursor: pointer; }
        .botshield-analytics-detail dl { display: grid; gap: 0; margin: 18px 0; }
        .botshield-analytics-detail dl > div { display: grid; grid-template-columns: 125px 1fr; gap: 15px; padding: 11px 0; border-bottom: 1px solid #ededee; }
        .botshield-analytics-detail dt { color: var(--analytics-tertiary); font-size: .75rem; line-height: 1rem; }
        .botshield-analytics-detail dd { margin: 0; overflow-wrap: anywhere; color: #303438; font-size: .8125rem; font-weight: 600; line-height: 1.25rem; }
        .botshield-analytics-v2 button:focus-visible { outline: 2px solid #2c6ecb; outline-offset: 2px; }
        @media (max-width: 980px) {
          .botshield-analytics-controls { align-items: stretch; flex-direction: column; }
          .botshield-analytics-filter-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .botshield-analytics-search { grid-column: 1 / -1; }
          .botshield-analytics-clear { justify-self: start; }
          .botshield-analytics-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .botshield-analytics-kpi:nth-child(2) { border-right: 0; }
          .botshield-analytics-kpi:nth-child(-n+2) { border-bottom: 1px solid #e4e5e6; }
          .botshield-analytics-split, .botshield-analytics-split--primary { grid-template-columns: 1fr; }
          .botshield-analytics-summary { grid-template-columns: 1fr; gap: 10px; }
        }
        @media (max-width: 640px) {
          .botshield-analytics-content { width: min(100%, calc(100vw - 28px)); padding-top: 20px; }
          .botshield-analytics-header { align-items: flex-start; }
          .botshield-analytics-filter-row { grid-template-columns: 1fr; }
          .botshield-analytics-search { grid-column: auto; }
          .botshield-analytics-kpis { grid-template-columns: 1fr; }
          .botshield-analytics-kpi { min-height: 98px; border-right: 0; border-bottom: 1px solid #e4e5e6; }
          .botshield-analytics-kpi:last-child { border-bottom: 0; }
          .botshield-analytics-ranked-row { grid-template-columns: 1fr; gap: 8px; }
          .botshield-analytics-activity-facts, .botshield-analytics-summary dl { grid-template-columns: 1fr; }
          .botshield-analytics-activity-facts > div { padding: 9px 0; border-right: 0; border-bottom: 1px solid #e5e6e7; }
          .botshield-analytics-combination { grid-template-columns: 1fr; }
          .botshield-analytics-combination dl { justify-content: space-between; }
          .botshield-analytics-pagination { align-items: flex-start; flex-direction: column; }
        }
        .botshield-protection-content {
          width: min(1180px, calc(100vw - 56px));
          padding-top: 34px;
          font-family: var(--p-font-family-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
        }
        .botshield-protection-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          padding: 4px 0 22px;
        }
        .botshield-protection-card {
          box-sizing: border-box;
          background: #ffffff;
          border: 1px solid var(--botshield-border-strong);
          border-radius: 16px;
          box-shadow: none;
          padding: 22px 24px;
        }
        .botshield-protection-card-header {
          margin-bottom: 20px;
        }
        .botshield-protection-card-title {
          margin: 0;
          color: #303030;
          font-size: 17px;
          line-height: 1.25;
          font-weight: 700;
        }
        .botshield-protection-card-copy {
          margin: 10px 0 0;
          color: #616161;
          font-size: 16px;
          line-height: 1.42;
        }
        .botshield-protection-list {
          border: 1px solid #dcdcdc;
          border-radius: 12px;
          overflow: hidden;
          background: #ffffff;
        }
        .botshield-protection-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 154px;
          gap: 18px;
          align-items: center;
          min-height: 66px;
          padding: 13px 16px;
          border-bottom: 1px solid #e3e3e3;
        }
        .botshield-protection-row:last-child {
          border-bottom: 0;
        }
        .botshield-protection-row-title {
          color: #303030;
          font-size: 15px;
          line-height: 1.25;
          font-weight: 700;
        }
        .botshield-protection-row-copy {
          margin-top: 4px;
          color: #616161;
          font-size: 14px;
          line-height: 1.42;
        }
        .botshield-protection-row-actions {
          display: grid;
          grid-template-columns: 54px 82px;
          align-items: center;
          justify-content: flex-end;
          justify-items: end;
          gap: 8px;
          min-width: 154px;
          white-space: nowrap;
        }
        .botshield-protection-row-actions .botshield-overview-badge {
          min-height: 22px;
          min-width: 38px;
          padding: 2px 8px;
          background: #f3f3f3;
          border-color: #e0e0e0;
          color: #3f3f3f;
          font-size: 12px;
          font-weight: 650;
        }
        .botshield-protection-row-actions .botshield-overview-badge--muted {
          background: #eeeeee;
          color: #616161;
        }
        .botshield-protection-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 360px;
          border: 1px solid #dcdcdc;
          border-radius: 10px;
          text-align: center;
        }
        .botshield-protection-empty h3 {
          margin: 0;
          color: #303030;
          font-size: 20px;
          line-height: 1.25;
          font-weight: 700;
        }
        .botshield-protection-empty p {
          margin: 14px 0 22px;
          color: #616161;
          font-size: 16px;
          line-height: 1.45;
        }
        .botshield-protection-composer {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #e3e3e3;
        }
        .botshield-protection-composer-grid {
          display: grid;
          grid-template-columns: minmax(220px, 0.75fr) minmax(0, 1.25fr);
          gap: 24px;
          align-items: start;
          margin-top: 16px;
        }
        .botshield-protection-controls {
          display: grid;
          gap: 16px;
        }
        .botshield-protection-response {
          padding-top: 4px;
        }
        .botshield-protection-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(48, 48, 48, 0.28);
        }
        .botshield-protection-modal {
          width: min(420px, 100%);
          box-sizing: border-box;
          background: #ffffff;
          border: 1px solid #d4d4d4;
          border-radius: 14px;
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.18);
          padding: 22px;
        }
        .botshield-protection-modal--wide {
          width: min(760px, 100%);
        }
        .botshield-protection-modal-title {
          margin: 0;
          color: #303030;
          font-size: 20px;
          line-height: 1.25;
          font-weight: 700;
        }
        .botshield-protection-modal-copy {
          margin: 12px 0 20px;
          color: #616161;
          font-size: 15px;
          line-height: 1.45;
        }
        .botshield-protection-modal-body {
          display: grid;
          gap: 16px;
        }
        .botshield-protection-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
        }
        .botshield-fraud-orders-content .botshield-surface {
          padding: 20px 22px;
          box-shadow: none;
          border-color: #d4d4d4;
          border-radius: 16px;
        }
        .botshield-fraud-orders-content {
          width: min(1180px, calc(100vw - 56px));
          padding-top: 34px;
        }
        .botshield-fraud-orders-content .botshield-overview-header {
          padding-bottom: 6px;
        }
        .botshield-fraud-automation-stack {
          display: grid;
          gap: 14px;
        }
        .botshield-fraud-automation-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 20px;
          align-items: start;
        }
        .botshield-fraud-title-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .botshield-fraud-card-title {
          margin: 0;
          color: #303030;
          font-size: 18px;
          line-height: 1.25;
          font-weight: 700;
        }
        .botshield-fraud-card-copy {
          max-width: 760px;
          margin: 10px 0 0;
          color: #616161;
          font-size: 15px;
          line-height: 1.45;
        }
        .botshield-fraud-card-note {
          margin: 10px 0 0;
          color: #6b7280;
          font-size: 15px;
          line-height: 1.4;
        }
        .botshield-fraud-pill-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin: 10px 0 0;
        }
        .botshield-fraud-button-stack {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
        }
        .botshield-fraud-metric-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 20px;
        }
        .botshield-fraud-metric-card {
          min-height: 126px;
          box-sizing: border-box;
          background: #ffffff;
          border: 1px solid #dcdcdc;
          border-radius: 16px;
          padding: 22px;
        }
        .botshield-fraud-table-wrap {
          overflow-x: auto;
        }
        .botshield-fraud-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 760px;
        }
        .botshield-fraud-table th,
        .botshield-fraud-table td {
          padding: 12px 10px;
          border-bottom: 1px solid #e3e3e3;
          text-align: left;
          color: #303030;
          font-size: 14px;
          line-height: 1.4;
        }
        .botshield-fraud-table th {
          color: #616161;
          font-weight: 650;
        }
        .botshield-fraud-table tr:last-child td {
          border-bottom: 0;
        }
        .botshield-settings-content {
          width: min(1180px, calc(100vw - 56px));
          padding-top: 34px;
        }
        .botshield-settings-tabs {
          display: flex;
          gap: 6px;
          align-items: center;
          background: #ffffff;
          border: 1px solid #d4d4d4;
          border-radius: 14px;
          padding: 8px;
          margin-bottom: 18px;
        }
        .botshield-settings-tab {
          appearance: none;
          border: 0;
          border-radius: 12px;
          background: transparent;
          color: #616161;
          cursor: pointer;
          font: inherit;
          font-size: 15px;
          font-weight: 650;
          line-height: 1.2;
          padding: 10px 14px;
        }
        .botshield-settings-tab--active {
          background: #f1f1f1;
          color: #111111;
        }
        .botshield-settings-plan-grid,
        .botshield-settings-usage-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }
        .botshield-settings-usage-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
        .botshield-settings-feature-list {
          margin: 0;
          padding-left: 20px;
          color: #303030;
          font-size: 15px;
          line-height: 1.7;
        }
        .botshield-settings-info-card {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 14px;
          align-items: start;
          background: #f7f7f7;
          border: 1px solid #dcdcdc;
          border-radius: 14px;
          padding: 16px 18px;
        }
        .botshield-settings-info-card h2 {
          margin: 0;
          color: #303030;
          font-size: 16px;
          line-height: 1.3;
          font-weight: 700;
        }
        .botshield-settings-info-card p {
          margin: 4px 0 0;
          color: #616161;
          font-size: 14px;
          line-height: 1.45;
        }
        .botshield-settings-info-icon {
          width: 22px;
          height: 22px;
          border: 1px solid #c9c9c9;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #303030;
          font-size: 13px;
          font-weight: 800;
        }
        .botshield-settings-admin-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 240px;
          gap: 20px;
          align-items: stretch;
        }
        .botshield-settings-compact-empty {
          border: 1px solid #e3e3e3;
          border-radius: 14px;
          background: #fafafa;
          padding: 20px;
        }
        .botshield-settings-compact-empty h2,
        .botshield-settings-plan-card h2,
        .botshield-settings-form-section h3,
        .botshield-settings-disabled-row span:first-child {
          margin: 0;
          color: #303030;
          font-size: 16px;
          line-height: 1.3;
          font-weight: 700;
        }
        .botshield-settings-compact-empty p,
        .botshield-settings-plan-heading p {
          margin: 6px 0 0;
          color: #616161;
          font-size: 14px;
          line-height: 1.45;
        }
        .botshield-settings-inline-empty {
          margin-top: 16px;
          display: grid;
          gap: 5px;
          border-top: 1px solid #e3e3e3;
          padding-top: 14px;
        }
        .botshield-settings-inline-empty strong {
          color: #303030;
          font-size: 15px;
        }
        .botshield-settings-inline-empty span {
          color: #616161;
          font-size: 14px;
          line-height: 1.45;
        }
        .botshield-settings-status-card {
          border: 1px solid #e3e3e3;
          border-radius: 14px;
          background: #ffffff;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          justify-content: center;
        }
        .botshield-settings-status-card span:first-child {
          color: #616161;
          font-size: 13px;
          font-weight: 650;
        }
        .botshield-settings-status-card strong {
          color: #303030;
          font-size: 22px;
          line-height: 1.2;
        }
        .botshield-settings-inline-action {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
        }
        .botshield-settings-inline-action p,
        .botshield-settings-card-copy {
          margin: 0;
          color: #616161;
          font-size: 15px;
          line-height: 1.45;
        }
        .botshield-settings-card-copy--footer {
          margin-top: 16px;
          border-top: 1px solid #e3e3e3;
          padding-top: 14px;
          font-size: 14px;
        }
        .botshield-settings-plan-card {
          min-height: 342px;
          box-sizing: border-box;
          background: #ffffff;
          border: 1px solid #d4d4d4;
          border-radius: 16px;
          padding: 22px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 18px;
        }
        .botshield-settings-plan-card--current {
          border-color: #303030;
        }
        .botshield-settings-plan-heading {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
        }
        .botshield-settings-price {
          margin-top: 8px;
          color: #111111;
          font-size: 32px;
          line-height: 1.05;
          font-weight: 800;
          letter-spacing: -0.03em;
        }
        .botshield-settings-muted {
          margin: 8px 0 0;
          color: #6b7280;
          font-size: 14px;
          line-height: 1.45;
        }
        .botshield-settings-neutral-pill {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          background: #eeeeee;
          border: 1px solid #dedede;
          color: #303030;
          font-size: 12px;
          font-weight: 700;
          line-height: 1;
          padding: 6px 10px;
          white-space: nowrap;
        }
        .botshield-settings-empty-card {
          min-height: 180px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          border: 1px solid #e3e3e3;
          border-radius: 14px;
          background: #fafafa;
          padding: 32px;
        }
        .botshield-settings-empty-card h2,
        .botshield-blocking-design-form h2,
        .botshield-blocking-preview-wrap h2 {
          margin: 0;
          color: #303030;
          font-size: 18px;
          line-height: 1.25;
          font-weight: 700;
        }
        .botshield-settings-empty-card p,
        .botshield-blocking-preview-wrap p {
          margin: 8px 0 0;
          color: #616161;
          font-size: 16px;
          line-height: 1.45;
        }
        .botshield-settings-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 24px;
          align-items: center;
          padding: 16px 0;
          border-bottom: 1px solid #e3e3e3;
        }
        .botshield-settings-row:last-child {
          border-bottom: 0;
        }
        .botshield-settings-row h3 {
          margin: 0;
          color: #303030;
          font-size: 16px;
          line-height: 1.3;
          font-weight: 700;
        }
        .botshield-settings-row p {
          margin: 6px 0 0;
          color: #616161;
          font-size: 15px;
          line-height: 1.45;
        }
        .botshield-settings-row-actions,
        .botshield-settings-action-row {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
        }
        .botshield-blocking-design-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(340px, 0.9fr);
          gap: 28px;
          align-items: start;
        }
        .botshield-blocking-design-form {
          display: grid;
          gap: 18px;
        }
        .botshield-settings-form-section {
          display: grid;
          gap: 12px;
          border-bottom: 1px solid #e3e3e3;
          padding-bottom: 18px;
        }
        .botshield-settings-form-section:last-of-type {
          border-bottom: 0;
          padding-bottom: 0;
        }
        .botshield-settings-disabled-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border: 1px solid #e3e3e3;
          border-radius: 12px;
          background: #fafafa;
          padding: 12px 14px;
        }
        .botshield-settings-color-field {
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr);
          gap: 12px;
          align-items: end;
        }
        .botshield-settings-color-swatch {
          width: 34px;
          height: 34px;
          border: 1px solid #d4d4d4;
          border-radius: 10px;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.35);
        }
        .botshield-blocking-preview-wrap {
          display: grid;
          gap: 12px;
        }
        .botshield-blocking-preview {
          min-height: 342px;
          border: 1px solid #d4d4d4;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 28px;
        }
        .botshield-blocking-preview-card {
          width: min(320px, 100%);
          min-height: 190px;
          box-shadow: 0 18px 42px rgba(0, 0, 0, 0.12);
          border: 1px solid rgba(0, 0, 0, 0.08);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 26px;
          text-align: center;
        }
        .botshield-blocking-preview-icon {
          width: 48px;
          height: 48px;
          border: 3px solid currentColor;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: 800;
        }
        .botshield-blocking-preview-card strong {
          font-size: 19px;
          line-height: 1.25;
          font-weight: 800;
          letter-spacing: 0.04em;
        }
        .botshield-blocking-preview-card span {
          color: inherit;
          opacity: 0.75;
          font-size: 14px;
          line-height: 1.45;
        }
        .botshield-surface {
          box-sizing: border-box;
          background: var(--botshield-surface);
          border: 1px solid var(--botshield-border);
          border-radius: var(--botshield-radius);
          box-shadow: var(--botshield-shadow-soft);
          padding: 24px;
        }
        .botshield-surface:hover {
          border-color: var(--botshield-border-strong);
        }
        .botshield-surface--raised {
          box-shadow: var(--botshield-shadow-raised);
        }
        .botshield-surface--accent {
          background:
            linear-gradient(180deg, rgba(232, 247, 243, 0.72), rgba(255, 255, 255, 0) 58%),
            var(--botshield-surface);
          border-color: #cde7df;
        }
        .botshield-card-label {
          color: var(--botshield-subdued);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .botshield-command-center {
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(circle at 92% 12%, rgba(15, 118, 110, 0.12), transparent 30%),
            linear-gradient(180deg, #ffffff, #fbfbfb);
          border: 1px solid var(--botshield-border);
          border-radius: 18px;
          box-shadow: var(--botshield-shadow-raised);
          padding: 30px;
        }
        .botshield-command-center::before {
          content: "";
          position: absolute;
          inset: 0;
          border-top: 3px solid var(--botshield-teal);
          pointer-events: none;
        }
        .botshield-command-grid {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.65fr);
          gap: 28px;
          align-items: center;
        }
        .botshield-command-kicker {
          color: var(--botshield-subdued);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .botshield-command-title {
          margin: 8px 0 0;
          color: var(--botshield-text);
          font-size: clamp(34px, 4.8vw, 56px);
          line-height: 1;
          font-weight: 760;
          letter-spacing: -0.055em;
        }
        .botshield-command-copy {
          max-width: 680px;
          margin: 14px 0 0;
          color: var(--botshield-subdued);
          font-size: 16px;
          line-height: 1.5;
        }
        .botshield-command-evidence {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 22px;
        }
        .botshield-command-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 24px;
        }
        .botshield-command-panel {
          border: 1px solid var(--botshield-border);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.78);
          box-shadow: var(--botshield-shadow-soft);
          padding: 18px;
        }
        .botshield-command-panel-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 12px;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid var(--botshield-border);
        }
        .botshield-command-panel-row:first-child {
          padding-top: 0;
        }
        .botshield-command-panel-row:last-child {
          padding-bottom: 0;
          border-bottom: 0;
        }
        .botshield-metric {
          position: relative;
          overflow: hidden;
          min-height: 134px;
          background:
            linear-gradient(180deg, #ffffff, #fbfbfb),
            var(--botshield-surface);
          border: 1px solid var(--botshield-border);
          border-radius: var(--botshield-radius);
          box-shadow: var(--botshield-shadow-soft);
          padding: 22px;
        }
        .botshield-metric::before {
          content: "";
          position: absolute;
          inset: 0 auto 0 0;
          width: 3px;
          background: var(--botshield-muted);
        }
        .botshield-metric--success::before { background: #16a34a; }
        .botshield-metric--warning::before { background: #f59e0b; }
        .botshield-metric--critical::before { background: #dc2626; }
        .botshield-metric--info::before { background: var(--botshield-teal); }
        .botshield-metric-value {
          font-size: 34px;
          line-height: 38px;
          font-weight: 700;
          letter-spacing: -0.03em;
          color: var(--botshield-text);
        }
        .botshield-outcome-card {
          position: relative;
          overflow: hidden;
          min-height: 156px;
          background:
            linear-gradient(180deg, #ffffff, #fbfbfb),
            var(--botshield-surface);
          border: 1px solid var(--botshield-border);
          border-radius: var(--botshield-radius);
          box-shadow: var(--botshield-shadow-soft);
          padding: 26px;
          transition:
            border-color 120ms ease,
            box-shadow 120ms ease,
            transform 120ms ease;
        }
        .botshield-outcome-card:hover {
          border-color: var(--botshield-border-strong);
          box-shadow: var(--botshield-shadow-raised);
          transform: translateY(-1px);
        }
        .botshield-outcome-card::after {
          content: "";
          position: absolute;
          inset: auto 18px 16px 18px;
          height: 2px;
          border-radius: 999px;
          background: var(--botshield-teal);
          opacity: 0.18;
        }
        .botshield-outcome-card--blocked::after,
        .botshield-outcome-card--high::after {
          background: #dc2626;
          opacity: 0.24;
        }
        .botshield-outcome-card--challenged::after,
        .botshield-outcome-card--setup_required::after {
          background: #f59e0b;
          opacity: 0.24;
        }
        .botshield-outcome-value {
          position: relative;
          z-index: 1;
          color: var(--botshield-text);
          font-size: clamp(32px, 4vw, 44px);
          line-height: 1.05;
          font-weight: 760;
          letter-spacing: -0.04em;
        }
        .botshield-status-value {
          color: var(--botshield-text);
          font-size: clamp(30px, 4vw, 44px);
          line-height: 1.05;
          font-weight: 760;
          letter-spacing: -0.04em;
        }
        .botshield-checklist-row,
        .botshield-activity-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 16px;
          align-items: center;
          margin: 0 -10px;
          padding: 17px 10px;
          border-bottom: 1px solid var(--botshield-border);
          border-radius: 10px;
          transition: background 120ms ease;
        }
        .botshield-checklist-row:hover,
        .botshield-activity-row:hover {
          background: #fafafa;
        }
        .botshield-checklist-row:last-child,
        .botshield-activity-row:last-child {
          border-bottom: 0;
        }
        .botshield-check-icon {
          display: inline-grid;
          place-items: center;
          flex: 0 0 auto;
          min-width: 42px;
          height: 24px;
          padding: 0 8px;
          border-radius: 999px;
          background: #f7f7f7;
          border: 1px solid var(--botshield-border);
          color: var(--botshield-subdued);
          font-size: 12px;
          font-weight: 700;
        }
        .botshield-check-icon--complete {
          background: #ecfdf5;
          border-color: #b7e3d5;
          color: var(--botshield-teal-dark);
        }
        .botshield-rule-card {
          min-height: 214px;
          background:
            linear-gradient(180deg, #ffffff, #fbfbfb),
            var(--botshield-surface);
          border: 1px solid var(--botshield-border);
          border-radius: var(--botshield-radius);
          box-shadow: var(--botshield-shadow-soft);
          padding: 22px;
          transition:
            border-color 120ms ease,
            box-shadow 120ms ease,
            transform 120ms ease;
        }
        .botshield-rule-card:hover {
          border-color: var(--botshield-border-strong);
          box-shadow: var(--botshield-shadow-raised);
          transform: translateY(-1px);
        }
        .botshield-rule-icon {
          min-width: 52px;
          height: 52px;
          padding: 0 10px;
          display: inline-grid;
          place-items: center;
          border: 1px solid #cde7df;
          border-radius: 10px;
          background: var(--botshield-teal-soft);
          color: var(--botshield-teal-dark);
          font-size: 13px;
          font-weight: 760;
          line-height: 1;
        }
        .botshield-rule-count {
          min-width: 26px;
          height: 26px;
          display: inline-grid;
          place-items: center;
          border-radius: 999px;
          background: #f7f7f7;
          color: var(--botshield-subdued);
          font-size: 13px;
          font-weight: 700;
        }
        .botshield-mode-card,
        .botshield-support-card {
          width: 100%;
          min-height: 136px;
          text-align: start;
          background:
            linear-gradient(180deg, #ffffff, #fbfbfb),
            var(--botshield-surface);
          border: 1px solid var(--botshield-border);
          border-radius: var(--botshield-radius);
          padding: 20px;
          color: inherit;
        }
        .botshield-mode-card {
          cursor: pointer;
          transition:
            border-color 120ms ease,
            box-shadow 120ms ease,
            background 120ms ease;
        }
        .botshield-mode-card:hover {
          border-color: #a8d8cf;
          box-shadow: var(--botshield-shadow-raised);
        }
        .botshield-mode-card--selected {
          border-color: #85cbbf;
          background:
            linear-gradient(180deg, #f1fbf7, #ffffff),
            #ecfdf5;
          box-shadow: inset 0 0 0 1px rgba(12, 127, 117, 0.12);
        }
        .botshield-briefing-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 16px;
          align-items: center;
          padding: 16px 0;
          border-bottom: 1px solid var(--botshield-border);
        }
        .botshield-briefing-row:hover {
          background: #fafafa;
        }
        .botshield-briefing-row:last-child {
          border-bottom: 0;
        }
        .botshield-progress-track {
          height: 10px;
          border-radius: 999px;
          background: #e3e3e3;
          overflow: hidden;
        }
        .botshield-progress-fill {
          height: 100%;
          border-radius: inherit;
          background: var(--botshield-teal);
        }
        .botshield-info-notice {
          overflow: hidden;
          border: 1px solid #b7d7f5;
          border-radius: var(--botshield-radius);
          background: var(--botshield-surface);
          box-shadow: var(--botshield-shadow-soft);
        }
        .botshield-info-notice-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 18px;
          background: #eaf4ff;
          color: #082f49;
          font-weight: 700;
        }
        .botshield-info-notice-body {
          padding: 18px;
          color: #303030;
          line-height: 1.55;
        }
        .botshield-support-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
        }
        .botshield-support-grid > * {
          padding: 20px;
          text-align: center;
          border-right: 1px solid #e0e0e0;
        }
        .botshield-support-card {
          color: inherit;
          text-decoration: none;
        }
        .botshield-support-grid > *:last-child {
          border-right: 0;
        }
        .botshield-chat-bubble {
          display: none;
        }
        .botshield-next-action {
          border-radius: 14px;
          border: 1px solid rgba(44, 110, 203, 0.18);
          background:
            linear-gradient(135deg, rgba(44, 110, 203, 0.08), rgba(255, 255, 255, 0) 48%),
            #ffffff;
          padding: 18px;
        }
        .botshield-evidence-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          width: fit-content;
          border: 1px solid var(--botshield-border);
          border-radius: 999px;
          background: var(--botshield-surface);
          box-shadow: var(--botshield-shadow-soft);
          padding: 7px 10px;
          color: var(--botshield-subdued);
          font-size: 13px;
        }
        .botshield-evidence-chip::before {
          content: "";
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: var(--botshield-teal);
        }
        .botshield-section-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 18px;
          margin-top: 4px;
        }
        .botshield-section-title {
          margin: 0;
          color: var(--botshield-text);
          font-size: 19px;
          line-height: 1.25;
          font-weight: 700;
          letter-spacing: -0.015em;
        }
        .botshield-section-copy {
          margin: 6px 0 0;
          color: var(--botshield-subdued);
          font-size: 14px;
          line-height: 1.45;
        }
        @media (max-width: 1024px) {
          .botshield-page-content,
          .botshield-overview-content,
          .botshield-analytics-content,
          .botshield-protection-content,
          .botshield-fraud-orders-content,
          .botshield-settings-content {
            width: calc(100vw - 40px);
          }
          .botshield-overview-metric-grid,
          .botshield-analytics-stat-grid,
          .botshield-fraud-metric-grid,
          .botshield-settings-usage-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .botshield-overview-middle-grid,
          .botshield-v2-primary-grid,
          .botshield-v2-secondary-grid,
          .botshield-blocking-design-grid {
            grid-template-columns: 1fr;
          }
          .botshield-v2-impact { grid-template-columns: 1fr; gap: 18px; }
          .botshield-v2-impact-metric:first-child { border-left: 0; padding-left: 0; }
          .botshield-v2-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .botshield-v2-kpi-card:nth-child(2) { border-right: 0; }
          .botshield-v2-kpi-card:nth-child(-n+2) { border-bottom: 1px solid #e4e5e7; }
          .botshield-v2-health-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: 16px; }
          .botshield-v2-health-item:nth-child(3) { padding-left: 0; border-left: 0; }
          .botshield-v2-primary-grid > .botshield-v2-section + .botshield-v2-section,
          .botshield-v2-secondary-grid > .botshield-v2-section + .botshield-v2-section {
            border-top: 1px solid #dfe3e8;
            border-left: 0;
          }
          .botshield-v2-operations { grid-template-columns: 1fr 1fr; row-gap: 14px; }
          .botshield-v2-operations > s-button { justify-self: start; grid-column: 1 / -1; }
          .botshield-v2-activity-header,
          .botshield-v2-activity-row {
            grid-template-columns: 108px 82px minmax(150px, 1fr) 118px 76px;
            gap: 10px;
          }
          .botshield-settings-plan-grid,
          .botshield-settings-admin-grid {
            grid-template-columns: 1fr;
          }
          .botshield-protection-row {
            grid-template-columns: minmax(0, 1fr) auto;
          }
          .botshield-fraud-automation-row {
            grid-template-columns: 1fr;
          }
          .botshield-fraud-button-stack {
            justify-content: flex-start;
          }
        }
        @media (max-width: 640px) {
          .botshield-page-content,
          .botshield-page-content--wide { width: calc(100vw - 24px); padding-top: 22px; }
          .botshield-page-heading { display: block; }
          .botshield-overview-content { width: calc(100vw - 24px); padding-top: 22px; }
          .botshield-overview-header { display: block; }
          .botshield-v2-status { align-items: flex-start; flex-direction: column; }
          .botshield-v2-status-actions { width: 100%; flex-wrap: wrap; }
          .botshield-v2-kpi-grid { grid-template-columns: 1fr; }
          .botshield-v2-kpi-card,
          .botshield-v2-kpi-card:nth-child(2) { border-right: 0; border-bottom: 1px solid #e4e5e7; }
          .botshield-v2-kpi-card:last-child { border-bottom: 0; }
          .botshield-v2-health-grid { grid-template-columns: 1fr; row-gap: 0; }
          .botshield-v2-health-item,
          .botshield-v2-health-item:nth-child(3) { padding: 11px 0; border-top: 1px solid #e4e5e7; border-left: 0; }
          .botshield-v2-health-item:first-child { border-top: 0; }
          .botshield-v2-health-heading { align-items: flex-start; }
          .botshield-v2-value-header { flex-direction: column; gap: 12px; }
          .botshield-v2-value-content { grid-template-columns: 1fr; }
          .botshield-v2-impact-metrics { grid-template-columns: 1fr; }
          .botshield-v2-impact-metric {
            padding: 12px 0;
            border-left: 0;
            border-top: 1px solid #dfe3e8;
          }
          .botshield-v2-panel-header { flex-direction: column; }
          .botshield-v2-legend { justify-content: flex-start; }
          .botshield-v2-operations { grid-template-columns: 1fr; }
          .botshield-v2-operation + .botshield-v2-operation {
            margin: 0;
            padding: 12px 0 0;
            border-top: 1px solid #e1e3e5;
            border-left: 0;
          }
          .botshield-v2-operation time { display: none; }
          .botshield-v2-protection-row { grid-template-columns: 32px minmax(0, 1fr); align-items: start; }
          .botshield-v2-protection-action { grid-column: 2; flex-wrap: wrap; }
          .botshield-v2-activity-header { display: none; }
          .botshield-v2-activity-row { grid-template-columns: 1fr; padding: 14px 0; }
          .botshield-v2-activity-row time { font-weight: 600; }
          .botshield-v2-chart-bars { gap: 2px; }
          .botshield-v2-chart-tooltip { width: 154px; }
          .botshield-v2-composition-row { grid-template-columns: 100px minmax(50px, 1fr) 28px 30px; gap: 7px; }
          .botshield-v2-top-signal { grid-template-columns: 1fr; gap: 3px; }
          .botshield-v2-top-signal small { white-space: normal; }
          .botshield-v2-quick-action-row { grid-template-columns: 32px minmax(0, 1fr); align-items: start; }
          .botshield-v2-quick-action-row > s-button { grid-column: 2; justify-self: start; }
          .botshield-analytics-content { width: calc(100vw - 24px); padding-top: 22px; }
          .botshield-analytics-header { display: block; }
          .botshield-protection-content { width: calc(100vw - 24px); padding-top: 22px; }
          .botshield-protection-header { display: block; }
          .botshield-overview-metric-grid,
          .botshield-overview-middle-grid,
          .botshield-overview-action-grid,
          .botshield-analytics-stat-grid,
          .botshield-fraud-metric-grid { grid-template-columns: 1fr; }
          .botshield-protection-row,
          .botshield-protection-composer-grid { grid-template-columns: 1fr; }
          .botshield-protection-row-actions { justify-content: flex-start; }
          .botshield-fraud-automation-row { grid-template-columns: 1fr; }
          .botshield-fraud-button-stack { justify-content: flex-start; }
          .botshield-analytics-tabs { overflow-x: auto; }
          .botshield-analytics-chart-tabs { align-items: stretch; flex-direction: column; }
          .botshield-analytics-chart-tab { min-width: 0; width: 100%; }
          .botshield-analytics-chart-panel { min-height: 360px; padding: 14px; }
          .botshield-settings-tabs { overflow-x: auto; padding: 8px; }
          .botshield-settings-tab { white-space: nowrap; }
          .botshield-settings-plan-grid,
          .botshield-settings-usage-grid,
          .botshield-settings-admin-grid,
          .botshield-blocking-design-grid,
          .botshield-settings-row { grid-template-columns: 1fr; }
          .botshield-settings-row-actions,
          .botshield-settings-inline-action,
          .botshield-settings-action-row { justify-content: flex-start; }
          .botshield-command-grid { grid-template-columns: 1fr; }
          .botshield-command-center { padding: 22px; }
          .botshield-titlebar-brand { font-size: 18px; }
          .botshield-surface { padding: 16px; border-radius: 12px; }
          .botshield-metric { min-height: 112px; padding: 16px; }
          .botshield-support-grid { grid-template-columns: 1fr; }
          .botshield-support-grid > * { border-right: 0; border-bottom: 1px solid #e0e0e0; }
          .botshield-support-grid > *:last-child { border-bottom: 0; }
          .botshield-briefing-row { grid-template-columns: 1fr; }
          .botshield-checklist-row,
          .botshield-activity-row { grid-template-columns: 1fr; }
        }
      `}</style>
      <div className="botshield-admin-shell">{children}</div>
      <a
        className="botshield-chat-bubble"
        href="mailto:support@botshieldapp.com"
        aria-label="Contact BotShield support"
      >
        ▰
      </a>
    </BotShieldToastProvider>
  );
}

export function BotShieldPage({
  title,
  subtitle,
  badge,
  primaryAction,
  secondaryActions,
  banner,
  children,
}) {
  return (
    <s-page heading={title}>
      <s-stack gap="large">
        <s-stack
          direction="inline"
          gap="base"
          justifyContent="space-between"
          alignItems="center"
        >
          <BotShieldPageHeader
            title={title}
            subtitle={subtitle}
            badge={badge}
          />
          {primaryAction || secondaryActions ? (
            <s-stack direction="inline" gap="small">
              {secondaryActions}
              {primaryAction}
            </s-stack>
          ) : null}
        </s-stack>
        {banner}
        {children}
      </s-stack>
    </s-page>
  );
}

export function BotShieldPageHeader({ subtitle, badge }) {
  if (!subtitle && !badge) return null;
  return (
    <s-stack direction="inline" gap="base" alignItems="center">
      {subtitle ? <s-paragraph color="subdued">{subtitle}</s-paragraph> : null}
      {badge}
    </s-stack>
  );
}

export function BotShieldCard({
  title,
  subtitle,
  badge,
  actions,
  children,
  empty,
  loading,
  error,
  raised = false,
  accent = false,
}) {
  return (
    <div
      className={`botshield-surface${raised ? " botshield-surface--raised" : ""}${accent ? " botshield-surface--accent" : ""}`}
    >
      <s-stack gap="base">
        {title || subtitle || badge || actions ? (
          <s-stack
            direction="inline"
            gap="base"
            justifyContent="space-between"
            alignItems="start"
          >
            <s-stack gap="small-200">
              {title ? <s-heading>{title}</s-heading> : null}
              {subtitle ? (
                <s-paragraph color="subdued">{subtitle}</s-paragraph>
              ) : null}
            </s-stack>
            <s-stack direction="inline" gap="small">
              {badge}
              {actions}
            </s-stack>
          </s-stack>
        ) : null}
        {error ? (
          <BotShieldBanner tone="critical">{error}</BotShieldBanner>
        ) : null}
        {loading ? <BotShieldLoadingState /> : empty || children}
      </s-stack>
    </div>
  );
}

export function BotShieldSection({ title, description, action, children }) {
  return (
    <s-stack gap="base">
      <s-stack
        direction="inline"
        gap="base"
        justifyContent="space-between"
        alignItems="center"
      >
        <s-stack gap="small-200">
          <s-heading>{title}</s-heading>
          {description ? (
            <s-paragraph color="subdued">{description}</s-paragraph>
          ) : null}
        </s-stack>
        {action}
      </s-stack>
      {children}
    </s-stack>
  );
}

export function BotShieldMetricCard({ label, value, detail, status, loading }) {
  return (
    <s-box
      background="base"
      border="base"
      borderRadius="large"
      padding="base"
      minBlockSize="120px"
    >
      <s-stack gap="small">
        <s-text color="subdued">{label}</s-text>
        {loading ? (
          <s-spinner accessibilityLabel={`Loading ${label}`} />
        ) : (
          <s-heading>{value}</s-heading>
        )}
        <s-stack direction="inline" gap="small" alignItems="center">
          {status ? <BotShieldStatusBadge status={status} /> : null}
          {detail ? <s-text color="subdued">{detail}</s-text> : null}
        </s-stack>
      </s-stack>
    </s-box>
  );
}

export function BotShieldCommandCard({
  eyebrow,
  title,
  description,
  status,
  statusLabel,
  primaryAction,
  secondaryAction,
  children,
}) {
  return (
    <s-box background="base" border="base" borderRadius="large" padding="large">
      <s-stack gap="large">
        <s-stack
          direction="inline"
          gap="large"
          justifyContent="space-between"
          alignItems="start"
        >
          <s-stack gap="small">
            {eyebrow ? (
              <s-text color="subdued" type="strong">
                {eyebrow}
              </s-text>
            ) : null}
            <div
              style={{
                fontSize: "26px",
                lineHeight: "32px",
                fontWeight: 700,
                letterSpacing: "-0.02em",
              }}
            >
              {title}
            </div>
            {description ? (
              <s-paragraph color="subdued">{description}</s-paragraph>
            ) : null}
          </s-stack>
          {status ? (
            <BotShieldStatusBadge status={status} label={statusLabel} />
          ) : null}
        </s-stack>
        {children}
        {primaryAction || secondaryAction ? (
          <s-stack direction="inline" gap="small">
            {primaryAction}
            {secondaryAction}
          </s-stack>
        ) : null}
      </s-stack>
    </s-box>
  );
}

export function BotShieldSignalCard({ label, value, detail, status, action }) {
  return (
    <s-box
      background="base"
      border="base"
      borderRadius="large"
      padding="base"
      minBlockSize="132px"
    >
      <s-stack gap="base">
        <s-stack
          direction="inline"
          gap="small"
          justifyContent="space-between"
          alignItems="center"
        >
          <s-text color="subdued">{label}</s-text>
          {status ? <BotShieldStatusBadge status={status} /> : null}
        </s-stack>
        <s-text type="strong">{value}</s-text>
        <s-stack
          direction="inline"
          gap="small"
          justifyContent="space-between"
          alignItems="end"
        >
          <s-text color="subdued">{detail}</s-text>
          {action}
        </s-stack>
      </s-stack>
    </s-box>
  );
}

export function BotShieldOutcomeMetric({
  label,
  value,
  detail,
  status,
  loading,
}) {
  return (
    <s-box padding="base">
      <s-stack gap="small">
        <s-stack
          direction="inline"
          gap="small"
          justifyContent="space-between"
          alignItems="center"
        >
          <s-text color="subdued">{label}</s-text>
          {status ? <BotShieldStatusBadge status={status} /> : null}
        </s-stack>
        {loading ? (
          <s-spinner accessibilityLabel={`Loading ${label}`} />
        ) : (
          <div
            style={{
              fontSize: "30px",
              lineHeight: "36px",
              fontWeight: 700,
              letterSpacing: "-0.025em",
            }}
          >
            {value}
          </div>
        )}
        <s-text color="subdued">{detail}</s-text>
      </s-stack>
    </s-box>
  );
}

export function BotShieldStatusRow({ label, value, detail, status, action }) {
  return (
    <s-box paddingBlock="base" borderBlockEnd="base">
      <s-stack
        direction="inline"
        gap="base"
        justifyContent="space-between"
        alignItems="center"
      >
        <s-stack gap="small-200">
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-text type="strong">{label}</s-text>
            <BotShieldStatusBadge status={status} />
          </s-stack>
          <s-text color="subdued">{detail}</s-text>
        </s-stack>
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-text type="strong">{value}</s-text>
          {action}
        </s-stack>
      </s-stack>
    </s-box>
  );
}

export function BotShieldChecklistItem({
  index,
  label,
  detail,
  complete,
  action,
}) {
  return (
    <s-box paddingBlock="base" borderBlockEnd="base">
      <s-stack
        direction="inline"
        gap="base"
        justifyContent="space-between"
        alignItems="center"
      >
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-box
            background={complete ? "success-subdued" : "subdued"}
            borderRadius="full"
            padding="small"
            minInlineSize="36px"
          >
            <s-text type="strong">{complete ? "✓" : index}</s-text>
          </s-box>
          <s-stack gap="small-200">
            <s-text type="strong">{label}</s-text>
            <s-text color="subdued">{detail}</s-text>
          </s-stack>
        </s-stack>
        <s-stack direction="inline" gap="small" alignItems="center">
          <BotShieldStatusBadge
            status={complete ? "active" : "setup_required"}
            label={complete ? "Ready" : "Action needed"}
          />
          {action}
        </s-stack>
      </s-stack>
    </s-box>
  );
}

export function BotShieldStatusBadge({ status, label, tone }) {
  const model = getUiStatus(status);
  return <s-badge tone={tone || model.tone}>{label || model.label}</s-badge>;
}

export function BotShieldActionButton({
  children,
  onClick,
  variant = "secondary",
  tone = "auto",
  loading = false,
  disabled = false,
  icon,
  accessibilityLabel,
  href,
  target,
  slot,
}) {
  return (
    <s-button
      variant={variant}
      tone={tone}
      loading={loading}
      disabled={disabled || loading}
      icon={icon}
      accessibilityLabel={accessibilityLabel}
      href={href}
      target={target}
      slot={slot}
      onClick={onClick}
    >
      {children}
    </s-button>
  );
}

export function BotShieldAsyncButton({
  children,
  action,
  successMessage,
  errorMessage,
  onSuccess,
  onError,
  disabled,
  ...buttonProps
}) {
  const toast = useBotShieldToast();
  const asyncAction = useBotShieldAction({
    action,
    successMessage,
    errorMessage,
    toast,
    onSuccess,
    onError,
  });

  return (
    <BotShieldActionButton
      {...buttonProps}
      loading={asyncAction.loading}
      disabled={disabled}
      onClick={asyncAction.run}
    >
      {children}
    </BotShieldActionButton>
  );
}

export function BotShieldBanner({ tone = "info", title, children, action }) {
  return (
    <s-banner tone={tone} heading={title}>
      <s-stack gap="base">
        {children ? <s-paragraph>{children}</s-paragraph> : null}
        {action ? <s-stack direction="inline">{action}</s-stack> : null}
      </s-stack>
    </s-banner>
  );
}

export function BotShieldTextField({
  label,
  value,
  onChange,
  error,
  details,
  disabled,
  type = "text",
  placeholder,
  autocomplete = "off",
}) {
  return (
    <s-text-field
      label={label}
      value={value}
      error={error || ""}
      details={details || ""}
      disabled={disabled}
      type={type}
      placeholder={placeholder}
      autocomplete={autocomplete}
      onInput={(event) => onChange?.(event.currentTarget.value)}
    />
  );
}

export function BotShieldSelect({
  label,
  value,
  onChange,
  options,
  details,
  disabled,
}) {
  return (
    <s-select
      label={label}
      value={value}
      details={details || ""}
      disabled={disabled}
      onChange={(event) => onChange?.(event.currentTarget.value)}
    >
      {options.map((option) => (
        <s-option key={option.value} value={option.value}>
          {option.label}
        </s-option>
      ))}
    </s-select>
  );
}

export function BotShieldToggle({
  label,
  details,
  checked,
  onChange,
  disabled,
  error,
}) {
  return (
    <s-switch
      label={label}
      details={details || ""}
      checked={checked}
      disabled={disabled}
      error={error || ""}
      onChange={(event) => onChange?.(event.currentTarget.checked)}
    />
  );
}

export function BotShieldSaveState({
  dirty,
  saving,
  onSave,
  onDiscard,
  error,
}) {
  if (!dirty && !error) return null;
  return (
    <s-box
      background="subdued"
      border="base"
      borderRadius="large"
      padding="base"
    >
      <s-stack
        direction="inline"
        gap="base"
        justifyContent="space-between"
        alignItems="center"
      >
        <s-stack gap="small-200">
          <s-text type="strong">
            {error ? "Changes not saved" : "Unsaved changes"}
          </s-text>
          <s-text color="subdued">
            {error ||
              "Save or discard your changes before leaving this screen."}
          </s-text>
        </s-stack>
        <s-button-group>
          <s-button variant="secondary" disabled={saving} onClick={onDiscard}>
            Discard
          </s-button>
          <s-button variant="primary" loading={saving} onClick={onSave}>
            Save
          </s-button>
        </s-button-group>
      </s-stack>
    </s-box>
  );
}

export function BotShieldEmptyState({ title, description, action }) {
  return (
    <s-box
      background="subdued"
      borderRadius="large"
      padding="large"
      minBlockSize="160px"
    >
      <s-stack gap="base" alignItems="center" justifyContent="center">
        <s-icon type="empty" tone="neutral" size="large" />
        <s-heading>{title}</s-heading>
        <s-paragraph color="subdued">{description}</s-paragraph>
        {action}
      </s-stack>
    </s-box>
  );
}

export function BotShieldLoadingState({ label = "Loading BotShield" }) {
  return (
    <s-box padding="large" minBlockSize="120px">
      <s-stack gap="base" alignItems="center" justifyContent="center">
        <s-spinner accessibilityLabel={label} size="large" />
        <s-text color="subdued">{label}</s-text>
      </s-stack>
    </s-box>
  );
}

export function BotShieldInlineHelp({ children }) {
  return (
    <s-box background="subdued" borderRadius="base" padding="base">
      <s-stack direction="inline" gap="small" alignItems="start">
        <s-icon type="info" tone="info" />
        <s-text color="subdued">{children}</s-text>
      </s-stack>
    </s-box>
  );
}

export function BotShieldDangerZone({ title, description, action }) {
  return (
    <s-box
      background="base"
      border="base"
      borderColor="strong"
      borderRadius="large"
      padding="base"
    >
      <s-stack
        direction="inline"
        gap="base"
        justifyContent="space-between"
        alignItems="center"
      >
        <s-stack gap="small-200">
          <s-heading>{title}</s-heading>
          <s-paragraph color="subdued">{description}</s-paragraph>
        </s-stack>
        {action}
      </s-stack>
    </s-box>
  );
}

export function BotShieldConfirmationModal({
  id,
  heading,
  children,
  confirmLabel,
  onConfirm,
  loading,
  tone = "critical",
}) {
  return (
    <s-modal id={id} heading={heading}>
      <s-box padding="base">
        <s-paragraph>{children}</s-paragraph>
      </s-box>
      <s-button
        slot="primary-action"
        variant="primary"
        tone={tone}
        loading={loading}
        onClick={onConfirm}
      >
        {confirmLabel}
      </s-button>
      <s-button slot="secondary-actions" commandFor={id} command="--hide">
        Cancel
      </s-button>
    </s-modal>
  );
}
