/* eslint-disable react/prop-types */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useBotShieldAction } from "../../hooks/use-botshield-action";
import {
  BotShieldLoadingBridge,
  BotShieldSaveBarBridge,
} from "../../hooks/use-botshield-save-bar";
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
      error: (message) => show(message, { isError: true }),
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
          --botshield-bg: transparent;
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
          --botshield-shell-max-width: 1140px;
          --botshield-shell-padding-inline: 28px;
          --botshield-shell-padding-top: 34px;
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          min-height: 100vh;
          background: var(--botshield-bg);
          padding-bottom: 48px;
          color: var(--botshield-text);
        }
        .botshield-page {
          box-sizing: border-box;
          width: 100%;
          min-width: 0;
          min-height: 100vh;
          padding-top: var(--botshield-shell-padding-top);
          padding-inline: var(--botshield-shell-padding-inline);
          background: var(--botshield-bg);
        }
        .botshield-route-shell {
          position: relative;
          width: 100%;
          min-width: 0;
          min-height: 100vh;
          box-sizing: border-box;
        }
        .botshield-route-shell s-page {
          display: block;
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
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
          width: 100%;
          max-width: var(--botshield-shell-max-width);
          margin-inline: auto;
          padding: 0 0 84px;
          min-width: 0;
          box-sizing: border-box;
        }
        .botshield-page-content--wide {
          max-width: 1480px;
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
          font-family: var(--p-font-family-sans, Inter, -apple-system, BlinkMacSystemFont, "San Francisco", "Segoe UI", Roboto, "Helvetica Neue", sans-serif);
          font-synthesis: none;
          letter-spacing: -0.01em;
          -webkit-font-smoothing: antialiased;
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
          font-weight: 450;
          letter-spacing: -0.01em;
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
          letter-spacing: -0.0111067em;
          line-height: 2;
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
        .botshield-v2-quick-actions {
          display: block;
          container-type: inline-size;
          container-name: overview-quick-actions;
        }
        .botshield-v2-quick-actions .botshield-v2-panel-header { margin-bottom: 6px; }
        .botshield-v2-quick-action-list { display: grid; margin-top: 10px; min-width: 0; }
        .botshield-v2-quick-action-row {
          display: grid;
          grid-template-columns: 32px minmax(0, 1fr) auto;
          grid-template-areas: "icon copy action";
          align-items: center;
          gap: 12px;
          min-width: 0;
          padding: 14px 0;
          border-bottom: 1px solid #ebebeb;
        }
        .botshield-v2-quick-action-row > :first-child { grid-area: icon; }
        .botshield-v2-quick-action-row > div {
          grid-area: copy;
          min-width: 0;
        }
        .botshield-v2-quick-action-row > s-button {
          grid-area: action;
          justify-self: end;
          flex-shrink: 0;
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
          max-width: none;
          overflow-wrap: normal;
        }
        .botshield-v2-quick-action-row--primary {
          margin: 4px -10px -8px;
          padding: 14px 10px 8px;
          border-radius: 8px;
          background: #f6f6f7;
        }
        /* Overview V2 art-direction pass: shared surfaces and information hierarchy. */
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
        .botshield-overview-v2 .botshield-overview-title,
        .botshield-analytics-v2 > .botshield-overview-header .botshield-overview-title,
        .botshield-protection-content .botshield-protection-header .botshield-overview-title {
          margin: 0;
          color: #111111;
          font-size: 26px;
          line-height: 1.15;
          font-weight: 700;
          letter-spacing: -0.025em;
        }
        .botshield-overview-v2 .botshield-overview-subtitle,
        .botshield-analytics-v2 > .botshield-overview-header .botshield-overview-subtitle,
        .botshield-overview-v2.botshield-settings-hub-content .botshield-overview-subtitle {
          max-width: 720px;
          font-size: 13px;
          line-height: 1.5;
        }
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
        .botshield-v2-chart-column.is-active-day:focus-visible .botshield-v2-chart-bar { opacity: .78; }
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
        @container overview-quick-actions (max-width: 520px) {
          .botshield-v2-quick-action-row {
            grid-template-columns: 32px minmax(0, 1fr);
            grid-template-areas:
              "icon copy"
              ". action";
            align-items: start;
            row-gap: 10px;
          }
          .botshield-v2-quick-action-row > s-button {
            justify-self: start;
          }
        }
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
        .botshield-analytics-controls { display: flex; flex-wrap: wrap; gap: 12px 14px; align-items: flex-end; width: 100%; min-width: 0; padding: 12px 14px 10px; border: 1px solid var(--analytics-border); border-radius: 10px; background: rgba(255,255,255,.96); box-shadow: 0 1px 2px rgba(24, 28, 31, .025), 0 6px 18px rgba(24, 28, 31, .025); }
        .botshield-analytics-period { display: inline-flex; justify-self: start; gap: 2px; padding: 3px; border: 1px solid #d7d8d9; border-radius: 9px; background: #f4f5f5; }
        .botshield-analytics-period button { min-width: 49px; padding: 7px 10px; border: 0; border-radius: 6px; background: transparent; color: #565b60; font: inherit; font-size: .8125rem; font-weight: 550; line-height: 1.125rem; cursor: pointer; }
        .botshield-analytics-period button:hover { background: #e9eaeb; color: var(--analytics-ink); }
        .botshield-analytics-period button.is-active { background: #202223; color: #fff; }
        .botshield-analytics-filter-row { display: grid; flex: 1 1 520px; grid-template-columns: minmax(0, 135px) minmax(0, 130px) minmax(0, 165px) minmax(0, 1fr) auto; gap: 9px; align-items: end; width: 100%; min-width: 0; }
        .botshield-analytics-filter-row label { display: grid; gap: 5px; min-width: 0; color: #555b60; font-size: .75rem; font-weight: 550; line-height: 1rem; }
        .botshield-analytics-filter-row select, .botshield-analytics-filter-row input { width: 100%; box-sizing: border-box; height: 36px; padding: 0 10px; border: 1px solid #c7c9cb; border-radius: 8px; background: #fff; color: var(--analytics-ink); font: inherit; font-size: .8125rem; line-height: 1.25rem; }
        .botshield-analytics-filter-row select:focus, .botshield-analytics-filter-row input:focus { outline: 2px solid #2c6ecb; outline-offset: 1px; }
        .botshield-analytics-clear, .botshield-analytics-detail-button, .botshield-analytics-pagination button { border: 0; background: transparent; color: #2c5f9e; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
        .botshield-analytics-clear { height: 34px; padding: 0 6px; }
        .botshield-analytics-filter-context { display: flex; width: 100%; gap: 7px; align-items: center; padding-top: 9px; border-top: 1px solid #e6e7e8; color: #656b70; font-size: .75rem; font-variant-numeric: tabular-nums; line-height: 1rem; }
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
        .botshield-analytics-split { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: stretch; }
        .botshield-analytics-split > .botshield-analytics-panel { height: 100%; box-sizing: border-box; }
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
        .botshield-analytics-table-wrap { width: 100%; overflow-x: auto; scrollbar-gutter: stable; }
        .botshield-analytics-table { width: 100%; border-collapse: collapse; color: #383d41; font-size: .8125rem; line-height: 1.25rem; text-align: left; }
        .botshield-analytics-table th, .botshield-analytics-table td { height: 42px; box-sizing: border-box; padding: 9px 12px; border-bottom: 1px solid #e5e7e8; vertical-align: middle; white-space: nowrap; }
        .botshield-analytics-table thead th { position: sticky; z-index: 1; top: 0; height: 38px; padding-top: 8px; padding-bottom: 8px; border-bottom-color: #d6d9da; background: #f6f7f7; color: #474d52; font-size: .6875rem; line-height: 1rem; font-weight: 650; letter-spacing: .025em; text-transform: none; }
        .botshield-analytics-outcomes-table { min-width: 720px; }
        .botshield-analytics-visitor-table { min-width: 720px; }
        .botshield-analytics-event-table { min-width: 980px; }
        .botshield-analytics-table tbody th { color: #303336; font-weight: 600; }
        .botshield-analytics-table tbody tr:hover { background: #f8f9f9; }
        .botshield-analytics-table tbody tr:last-child > * { border-bottom: 0; }
        .botshield-analytics-table td:not(:first-child), .botshield-analytics-table thead th:not(:first-child) { font-variant-numeric: tabular-nums; }
        .botshield-analytics-outcomes-table th:not(:first-child), .botshield-analytics-outcomes-table td:not(:first-child) { text-align: right; }
        .botshield-analytics-outcomes-table .botshield-analytics-rate { margin-left: auto; }
        .botshield-analytics-visitor-table th:nth-child(2), .botshield-analytics-visitor-table td:nth-child(2) { width: 78px; text-align: right; }
        .botshield-analytics-visitor-table th:nth-child(4), .botshield-analytics-visitor-table td:nth-child(4), .botshield-analytics-visitor-table th:nth-child(5), .botshield-analytics-visitor-table td:nth-child(5) { width: 112px; }
        .botshield-analytics-visitor-table th:last-child, .botshield-analytics-visitor-table td:last-child { width: 92px; text-align: right; }
        .botshield-analytics-event-table th:first-child, .botshield-analytics-event-table td:first-child { width: 150px; font-variant-numeric: tabular-nums; }
        .botshield-analytics-event-table th:nth-child(2), .botshield-analytics-event-table td:nth-child(2) { width: 104px; }
        .botshield-analytics-event-table th:nth-child(3), .botshield-analytics-event-table td:nth-child(3) { width: 170px; }
        .botshield-analytics-event-table th:nth-child(5), .botshield-analytics-event-table td:nth-child(5) { width: 120px; }
        .botshield-analytics-event-table th:nth-child(6), .botshield-analytics-event-table td:nth-child(6) { width: 110px; }
        .botshield-analytics-event-table th:last-child, .botshield-analytics-event-table td:last-child { width: 92px; text-align: right; }
        .botshield-analytics-outcome-number { display: inline-flex; min-width: 25px; justify-content: center; padding: 3px 6px; border-radius: 6px; background: #f0f1f1; font-weight: 700; }
        .botshield-analytics-outcome-number.is-blocked { color: #a93434; background: #fff0ef; }
        .botshield-analytics-outcome-number.is-challenged { color: #865d13; background: #fff5dd; }
        .botshield-analytics-outcome-number.is-allowed { color: #39704c; background: #edf7ef; }
        .botshield-analytics-rate { display: grid; grid-template-columns: 42px 72px; gap: 8px; align-items: center; min-width: 122px; }
        .botshield-analytics-event-table td:nth-child(3), .botshield-analytics-event-table td:nth-child(6) { max-width: 170px; overflow: hidden; text-overflow: ellipsis; }
        .botshield-analytics-event-table td:nth-child(4) { min-width: 260px; max-width: 360px; overflow: hidden; text-overflow: ellipsis; }
        .botshield-analytics-event-table td:nth-child(3) > span, .botshield-analytics-event-table td:nth-child(4) > span, .botshield-analytics-event-table td:nth-child(6) > span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
        .botshield-analytics-histogram > span:hover i, .botshield-analytics-histogram > span.is-peak i { background: #2f3942; }
        .botshield-analytics-axis { display: flex; justify-content: space-between; gap: 16px; color: #6a7075; font-size: .6875rem; font-variant-numeric: tabular-nums; line-height: 1rem; }
        .botshield-analytics-compact-ranking { display: grid; max-width: 760px; gap: 12px; }
        .botshield-analytics-compact-ranking > div { display: grid; grid-template-columns: minmax(125px, 1fr) minmax(80px, .9fr) 68px minmax(120px, auto); gap: 5px 10px; align-items: center; }
        .botshield-analytics-compact-ranking span { overflow: hidden; color: #303438; font-size: .8125rem; font-weight: 650; line-height: 1.25rem; text-overflow: ellipsis; white-space: nowrap; }
        .botshield-analytics-compact-ranking b, .botshield-analytics-compact-ranking small { color: #5b6166; font-size: .75rem; font-variant-numeric: tabular-nums; line-height: 1rem; text-align: right; }
        .botshield-analytics-compact-ranking em { grid-column: 2 / -1; color: #747a7f; font-size: .6875rem; font-style: normal; font-variant-numeric: tabular-nums; line-height: 1rem; text-align: right; }
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
        .botshield-analytics-summary > p { margin: 0; color: #656b70; font-size: .8125rem; line-height: 1.25rem; }
        .botshield-analytics-visitor-id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .75rem; font-variant-numeric: tabular-nums; line-height: 1rem; }
        .botshield-analytics-repeat { margin-left: 7px; padding: 2px 5px; border-radius: 5px; background: #eef3f8; color: #42617f; font-size: 8px; font-weight: 800; text-transform: uppercase; }
        .botshield-analytics-visitor-table tr.is-recurring { background: #fbfcfd; }
        .botshield-analytics-pagination { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-top: 13px; border-top: 1px solid #e7e8e9; color: var(--analytics-tertiary); font-size: .75rem; line-height: 1rem; }
        .botshield-analytics-pagination > div { display: flex; gap: 12px; align-items: center; }
        /* Final Analytics art direction: depth, hierarchy, and investigation rhythm. */
        .botshield-analytics-v2 { gap: 22px; }
        .botshield-analytics-controls {
          border-color: #d8dbdd;
          box-shadow: 0 1px 2px rgba(20, 24, 27, .035), 0 10px 28px rgba(20, 24, 27, .035);
        }
        .botshield-analytics-period button,
        .botshield-analytics-filter-row select,
        .botshield-analytics-filter-row input {
          transition: border-color 120ms ease, background-color 120ms ease, box-shadow 120ms ease, color 120ms ease;
        }
        .botshield-analytics-period button.is-active { box-shadow: 0 1px 3px rgba(20, 24, 27, .2); }
        .botshield-analytics-filter-row select:hover,
        .botshield-analytics-filter-row input:hover { border-color: #999ea2; }
        .botshield-analytics-kpis {
          border-color: #d8dbdd;
          box-shadow: 0 1px 2px rgba(20, 24, 27, .035), 0 8px 22px rgba(20, 24, 27, .025);
        }
        .botshield-analytics-kpi { position: relative; transition: background-color 130ms ease, box-shadow 130ms ease; }
        .botshield-analytics-kpi::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 2px; background: transparent; transition: background-color 130ms ease; }
        .botshield-analytics-kpi:hover { background: #fafbfb; box-shadow: inset 0 2px 0 #c5c9cc; }
        .botshield-analytics-kpi:hover::before { background: #7c8791; }
        .botshield-analytics-kpi > strong { font-weight: 680; letter-spacing: -.04em; }
        .botshield-analytics-section-label { display: flex; align-items: center; gap: 12px; margin-top: 15px; color: #555c62; letter-spacing: .09em; }
        .botshield-analytics-section-label::after { content: ""; height: 1px; flex: 1; background: #e1e3e5; }
        .botshield-analytics-panel {
          border-color: #dde0e2;
          box-shadow: 0 1px 2px rgba(20, 24, 27, .025), 0 10px 26px rgba(20, 24, 27, .025);
          transition: border-color 140ms ease, box-shadow 140ms ease;
        }
        .botshield-analytics-panel:hover { border-color: #d2d6d8; box-shadow: 0 1px 2px rgba(20, 24, 27, .035), 0 12px 30px rgba(20, 24, 27, .035); }
        .botshield-analytics-split--primary > .botshield-analytics-panel:first-child { border-top-color: #adb5bc; border-top-width: 2px; }
        .botshield-analytics-panel > header h2 { font-weight: 670; letter-spacing: -.018em; }
        .botshield-analytics-ranked-row { border-radius: 7px; transition: background-color 120ms ease; }
        .botshield-analytics-ranked-row:hover { margin-inline: -8px; padding-inline: 8px; background: #f8f9f9; }
        .botshield-analytics-bar-track { height: 7px; background: #e9ebec; box-shadow: inset 0 1px 1px rgba(20, 24, 27, .05); }
        .botshield-analytics-bar-fill { background: #53606b; box-shadow: inset 0 1px 0 rgba(255,255,255,.18); transition: filter 120ms ease, opacity 120ms ease; }
        .botshield-analytics-ranked-row:hover .botshield-analytics-bar-fill { filter: contrast(1.08); }
        .botshield-analytics-risk-row { min-height: 23px; }
        .botshield-analytics-table-wrap { border: 1px solid #e1e3e5; border-radius: 8px; background: #fff; }
        .botshield-analytics-table thead th { background: #f4f5f5; color: #41474c; }
        .botshield-analytics-table tbody tr { transition: background-color 110ms ease; }
        .botshield-analytics-table tbody tr:hover { background: #f5f7f7; }
        .botshield-analytics-table tbody tr:hover > :first-child { box-shadow: inset 2px 0 0 #8b969f; }
        .botshield-analytics-histogram { border-radius: 7px 7px 0 0; background-color: #fbfcfc; }
        .botshield-analytics-histogram i { box-shadow: inset 0 1px 0 rgba(255,255,255,.2); }
        .botshield-analytics-insight { border-left-width: 3px; box-shadow: 0 1px 2px rgba(20, 24, 27, .025); }
        .botshield-analytics-summary { border-color: #d9dcde; background: #fbfcfc; }
        .botshield-analytics-detail-button { padding: 5px 7px; border-radius: 6px; transition: color 120ms ease, background-color 120ms ease; }
        .botshield-analytics-detail-button:hover { background: #edf3f8; color: #174b7a; }
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
          .botshield-analytics-compact-ranking > div { grid-template-columns: minmax(110px, 1fr) minmax(70px, .8fr) 64px; }
          .botshield-analytics-compact-ranking small { grid-column: 1 / -1; text-align: left; }
          .botshield-analytics-compact-ranking em { grid-column: 1 / -1; text-align: left; }
          .botshield-analytics-pagination { align-items: flex-start; flex-direction: column; }
        }
        .botshield-analytics-pagination button:not(:disabled) { padding: 4px 6px; border-radius: 5px; }
        .botshield-analytics-pagination button:not(:disabled):hover { background: #edf3f8; }
        @media (prefers-reduced-motion: reduce) {
          .botshield-analytics-v2 *,
          .botshield-analytics-v2 *::before,
          .botshield-analytics-v2 *::after { transition-duration: .01ms !important; }
        }
        .botshield-protection-content {
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
        .botshield-native-modal-body {
          display: grid;
          gap: 16px;
          align-content: start;
        }
        .botshield-native-modal-body .botshield-ip-list > s-stack > s-stack:first-child > s-heading {
          display: none;
        }
        .botshield-protection-modal-intro {
          margin: 0;
        }
        .botshield-protection-modal-state {
          color: #6d7378;
          font-size: .75rem;
          line-height: 1rem;
        }
        /* Protection control center */
        .botshield-protection-content { display: grid; gap: 28px; padding-bottom: 48px; color: #24272a; }
        .botshield-protection-header { padding-bottom: 0; }
        .botshield-protection-status { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; gap: 14px; align-items: center; min-height: 78px; padding: 14px 16px; border: 1px solid #d8dadc; border-left: 3px solid #b98926; border-radius: 10px; background: #fff; box-shadow: 0 1px 2px rgba(20,24,27,.02); }
        .botshield-protection-status.is-healthy { border-left-color: #3e7954; }
        .botshield-protection-status-icon { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 8px; background: #f3f1eb; }
        .botshield-protection-status-icon .botshield-v2-icon { width: 28px; height: 28px; background: transparent; }
        .botshield-protection-status span, .botshield-protection-section-heading > span { color: #6b7176; font-size: .65625rem; font-weight: 700; line-height: .875rem; letter-spacing: .085em; text-transform: uppercase; }
        .botshield-protection-status h2 { margin: 2px 0 0; color: #232629; font-size: 1.0625rem; font-weight: 670; line-height: 1.375rem; letter-spacing: -.014em; }
        .botshield-protection-status p { margin: 2px 0 0; max-width: 720px; color: #596066; font-size: .78125rem; line-height: 1.125rem; }
        .botshield-protection-status-action { display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
        .botshield-protection-section { display: grid; gap: 11px; }
        .botshield-protection-section-heading { display: grid; gap: 2px; padding-left: 1px; }
        .botshield-protection-section-heading h2 { margin: 0; color: #24272a; font-size: 1.0625rem; font-weight: 670; line-height: 1.5rem; letter-spacing: -.014em; }
        .botshield-protection-section-heading p { margin: 0; color: #60676c; font-size: .8125rem; line-height: 1.25rem; }
        .botshield-protection-list { overflow: hidden; border: 1px solid #d8dadc; border-radius: 10px; background: #fff; box-shadow: 0 1px 2px rgba(20,24,27,.02); }
        .botshield-protection-row { display: grid; grid-template-columns: 36px minmax(0, 1fr) minmax(0, .42fr) 104px 82px; gap: 16px; align-items: center; min-height: 74px; padding: 12px 16px; border: 0; border-bottom: 1px solid #eceeef; background: #fff; transition: background-color 120ms ease; }
        .botshield-protection-row:last-child { border-bottom: 0; }
        .botshield-protection-row:hover { background: #fafafa; }
        .botshield-protection-module-icon, .botshield-protection-access-icon { display: grid; place-items: center; width: 34px; height: 34px; border: 1px solid #e4e6e7; border-radius: 8px; background: #f6f7f7; color: #444a4e; }
        .botshield-protection-module-icon .botshield-v2-icon, .botshield-protection-access-icon .botshield-v2-icon { width: 28px; height: 28px; border: 0; background: transparent; }
        .botshield-protection-row-content { min-width: 0; }
        .botshield-protection-row-title { font-size: .875rem; font-weight: 650; }
        .botshield-protection-row-copy { margin-top: 2px; font-size: .8125rem; line-height: 1.25rem; }
        .botshield-protection-row-config { display: grid; gap: 2px; min-width: 0; padding-left: 16px; border-left: 1px solid #eceeef; }
        .botshield-protection-row-config span { color: #777d82; font-size: .65625rem; line-height: .875rem; text-transform: uppercase; letter-spacing: .055em; }
        .botshield-protection-row-config strong { overflow: hidden; color: #34393d; font-size: .78125rem; font-weight: 620; line-height: 1.125rem; text-overflow: ellipsis; white-space: nowrap; }
        .botshield-protection-row-status { display: flex; align-items: center; justify-content: flex-start; min-height: 28px; }
        .botshield-protection-row-status s-badge { opacity: .82; }
        .botshield-protection-row-action { display: flex; align-items: center; justify-content: flex-end; min-height: 32px; }
        .botshield-protection-row-action s-button { width: 74px; min-width: 74px; }
        .botshield-protection-policy { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(300px, .75fr); gap: 0; overflow: hidden; border: 1px solid #d8dadc; border-radius: 10px; background: #fff; box-shadow: 0 1px 2px rgba(20,24,27,.02); }
        .botshield-protection-policy-main { display: grid; gap: 12px; padding: 18px 20px; }
        .botshield-protection-policy-main > p { margin: 0; color: #747a7f; font-size: .71875rem; line-height: 1.125rem; }
        .botshield-protection-policy-flow { display: grid; grid-template-columns: minmax(0, 1fr) 20px minmax(0, 1fr) 20px minmax(0, 1fr); gap: 8px; align-items: center; }
        .botshield-protection-policy-flow > div { display: grid; align-content: center; gap: 2px; min-width: 0; min-height: 64px; padding: 10px 12px; border: 1px solid #e4e6e7; border-radius: 8px; background: #fafafa; }
        .botshield-protection-policy-flow span { color: #73797e; font-size: .625rem; font-weight: 700; line-height: .875rem; letter-spacing: .075em; text-transform: uppercase; }
        .botshield-protection-policy-flow strong { color: #292e32; font-size: .8125rem; font-weight: 650; line-height: 1.125rem; }
        .botshield-protection-policy-flow small { overflow: hidden; color: #7a8085; font-size: .65625rem; line-height: .875rem; text-overflow: ellipsis; white-space: nowrap; }
        .botshield-protection-policy-flow > b { display: grid; place-items: center; color: #93999e; font-size: .875rem; font-weight: 500; line-height: 1; text-align: center; }
        .botshield-protection-policy-side { display: grid; gap: 14px; align-content: center; padding: 18px 20px; border-left: 1px solid #e4e6e7; background: #fcfcfc; }
        .botshield-protection-policy-side > s-button { justify-self: start; }
        .botshield-protection-policy-map { display: grid; gap: 8px; }
        .botshield-protection-policy-map > div { display: grid; grid-template-columns: 90px 1fr; gap: 10px; align-items: center; color: #4e555a; font-size: .75rem; }
        .botshield-protection-access-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .botshield-protection-access-grid article { display: grid; grid-template-columns: 34px minmax(0, 1fr) 154px; gap: 14px; align-items: center; min-height: 120px; padding: 16px; border: 1px solid #d8dadc; border-radius: 10px; background: #fff; box-shadow: 0 1px 2px rgba(20,24,27,.02); }
        .botshield-protection-access-grid article > s-button { width: 154px; justify-self: end; }
        .botshield-protection-access-content { min-width: 0; }
        .botshield-protection-access-grid h3 { margin: 0; color: #292d30; font-size: .875rem; font-weight: 650; }
        .botshield-protection-access-grid p { margin: 3px 0 10px; color: #62696e; font-size: .75rem; line-height: 1.125rem; }
        .botshield-protection-access-count { display: flex; align-items: baseline; gap: 7px; }
        .botshield-protection-access-count strong { color: #24282b; font-size: 1.375rem; font-weight: 680; line-height: 1.5rem; letter-spacing: -.025em; }
        .botshield-protection-access-count span { color: #666d72; font-size: .71875rem; font-weight: 600; line-height: 1rem; }
        .botshield-protection-drawer-section { display: grid; gap: 12px; padding: 0 0 18px; border-bottom: 1px solid #eceeef; }
        .botshield-protection-drawer-section + .botshield-protection-drawer-section { padding-top: 1px; }
        .botshield-protection-drawer-section--compact { gap: 10px; }
        .botshield-protection-drawer-section-label { color: #6b7176; font-size: .65625rem; font-weight: 700; line-height: .875rem; letter-spacing: .075em; text-transform: uppercase; }
        .botshield-protection-toggle-row { display: flex; align-items: flex-start; min-height: 44px; padding: 2px 0; }
        .botshield-protection-toggle-row > * { width: 100%; }
        .botshield-protection-decision-preview { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); overflow: hidden; border: 1px solid #e1e3e5; border-radius: 9px; background: #fafafa; }
        .botshield-protection-decision-preview > div { display: grid; gap: 3px; padding: 12px 13px; }
        .botshield-protection-decision-preview > div + div { border-left: 1px solid #e1e3e5; }
        .botshield-protection-decision-preview span { color: #72787d; font-size: .6875rem; line-height: 1rem; }
        .botshield-protection-decision-preview strong { color: #292e32; font-size: .8125rem; font-weight: 660; line-height: 1.125rem; }
        .botshield-protection-drawer-explanation { margin: 0; color: #646b70; font-size: .75rem; line-height: 1.125rem; }
        .botshield-protection-signal-note { margin: -2px 0 0; color: #616a70; font-size: .75rem; line-height: 1.125rem; }
        .botshield-protection-rate-controls { display: grid; gap: 0; overflow: hidden; border: 1px solid #e3e5e6; border-radius: 9px; background: #fff; }
        .botshield-protection-rate-controls > s-switch { display: flex; align-items: flex-start; min-height: 52px; padding: 10px 12px; }
        .botshield-protection-rate-controls > s-switch + s-switch { border-top: 1px solid #eceeef; }
        .botshield-protection-signal-list { display: grid; gap: 0; overflow: hidden; border: 1px solid #e3e5e6; border-radius: 9px; }
        .botshield-protection-signal-list > div { display: grid; gap: 2px; min-height: 50px; align-content: center; padding: 9px 12px; background: #fff; }
        .botshield-protection-signal-list > div + div { border-top: 1px solid #eceeef; }
        .botshield-protection-signal-list strong { color: #303539; font-size: .78125rem; font-weight: 640; line-height: 1.125rem; }
        .botshield-protection-signal-list span { color: #6b7277; font-size: .71875rem; line-height: 1.0625rem; }
        .botshield-protection-signal-list small { color: #7a8185; font-size: .6875rem; font-weight: 600; line-height: 1rem; }
        .botshield-protection-drawer-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border: 1px solid #e3e5e6; border-radius: 9px; background: #fafafa; }
        .botshield-protection-drawer-metrics > div { display: grid; gap: 2px; padding: 10px 11px; }
        .botshield-protection-drawer-metrics > div + div { border-left: 1px solid #e3e5e6; }
        .botshield-protection-drawer-metrics strong { color: #24292d; font-size: 1rem; font-weight: 680; line-height: 1.25rem; }
        .botshield-protection-drawer-metrics span { color: #70767b; font-size: .6875rem; line-height: 1rem; }
        .botshield-protection-current-status { display: grid; gap: 8px; }
        .botshield-protection-current-status s-badge { justify-self: start; }
        .botshield-protection-current-status span { color: #62696e; font-size: .78125rem; line-height: 1.1875rem; }
        .botshield-protection-path-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
        .botshield-protection-path-grid span { padding: 9px 10px; border: 1px solid #e3e5e6; border-radius: 8px; background: #fafafa; color: #42484c; font-size: .75rem; font-weight: 600; line-height: 1rem; }
        .botshield-protection-access-summary { display: flex; align-items: baseline; gap: 6px; padding: 2px 1px; }
        .botshield-protection-access-summary strong { color: #303539; font-size: .875rem; }
        .botshield-protection-access-summary span { color: #747a7f; font-size: .71875rem; }
        .botshield-protection-filter-empty { display: grid; gap: 3px; padding: 14px; border: 1px dashed #d7dadd; border-radius: 9px; background: #fafafa; }
        .botshield-protection-filter-empty strong { color: #3b4145; font-size: .8125rem; }
        .botshield-protection-filter-empty span { color: #73797e; font-size: .75rem; }
        .botshield-native-modal-body .botshield-visitor-access-list {
          display: flex;
          flex-direction: column;
          margin-top: 4px;
        }
        .botshield-visitor-access-record {
          padding: 14px 0;
          border-bottom: 1px solid #e4e6e7;
        }
        .botshield-visitor-access-record:last-child {
          border-bottom: 0;
        }
        .botshield-visitor-access-record-top {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: start;
          gap: 10px 12px;
        }
        .botshield-visitor-access-record-identity {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .botshield-visitor-access-record-ip {
          display: block;
          max-width: 100%;
          color: #24282b;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: .8125rem;
          font-weight: 650;
          line-height: 1.25rem;
          word-break: break-all;
        }
        .botshield-visitor-access-record-action {
          flex: 0 0 auto;
        }
        .botshield-visitor-access-record-detail {
          margin: 8px 0 0;
          color: #62696e;
          font-size: .75rem;
          line-height: 1.45;
          word-break: break-word;
          overflow-wrap: anywhere;
        }
        .botshield-visitor-access-record-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 4px 14px;
          margin-top: 6px;
          color: #747a7f;
          font-size: .6875rem;
          line-height: 1.25rem;
        }
        .botshield-visitor-access-record-meta span {
          min-width: 0;
          word-break: break-word;
          overflow-wrap: anywhere;
        }
        @media (max-width: 480px) {
          .botshield-visitor-access-record-top {
            grid-template-columns: 1fr;
          }
          .botshield-visitor-access-record-action {
            justify-self: start;
          }
        }
        .botshield-protection-save-success { padding: 10px 12px; border: 1px solid #b7d7c2; border-radius: 8px; background: #f2f8f4; color: #285b3a; font-size: .78125rem; font-weight: 620; }
        @media (max-width: 900px) {
          .botshield-protection-policy { grid-template-columns: 1fr; }
          .botshield-protection-policy-side { border-top: 1px solid #e4e6e7; border-left: 0; }
          .botshield-protection-row { grid-template-columns: 34px minmax(220px, 1fr) minmax(120px, .45fr) 96px 82px; gap: 12px; }
          .botshield-protection-access-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 760px) {
          .botshield-protection-content { gap: 22px; }
          .botshield-protection-status { grid-template-columns: 34px minmax(0, 1fr); align-items: start; }
          .botshield-protection-status-action { grid-column: 1 / -1; justify-content: flex-start; flex-wrap: wrap; }
          .botshield-protection-row { grid-template-columns: 34px minmax(0, 1fr) auto auto; gap: 8px 12px; align-items: center; padding: 14px; }
          .botshield-protection-row-content { grid-column: 2; grid-row: 1; }
          .botshield-protection-row-config { grid-column: 2; grid-row: 2; padding: 7px 0 0; border-top: 1px solid #eceeef; border-left: 0; }
          .botshield-protection-row-status { grid-column: 3; grid-row: 1 / span 2; }
          .botshield-protection-row-action { grid-column: 4; grid-row: 1 / span 2; }
          .botshield-protection-policy-flow { grid-template-columns: 1fr 16px 1fr 16px 1fr; gap: 4px; }
          .botshield-protection-policy-flow > div { padding: 9px; }
          .botshield-protection-policy-flow small { white-space: normal; }
          .botshield-protection-access-grid article { grid-template-columns: 32px minmax(0, 1fr); align-items: start; }
          .botshield-protection-access-grid article > s-button { grid-column: 2; width: auto; justify-self: start; }
        }
        @media (max-width: 520px) {
          .botshield-protection-row { grid-template-columns: 34px minmax(0, 1fr) auto; align-items: start; }
          .botshield-protection-row-content { grid-column: 2 / -1; }
          .botshield-protection-row-config { grid-column: 2 / -1; }
          .botshield-protection-row-status { grid-column: 2; grid-row: 3; }
          .botshield-protection-row-action { grid-column: 3; grid-row: 3; }
        }
        .botshield-fraud-orders-content .botshield-surface {
          padding: 20px 22px;
          box-shadow: none;
          border-color: #d4d4d4;
          border-radius: 16px;
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
          width: 100%;
          max-width: 100%;
          min-width: 0;
          overflow-x: auto;
        }
        .botshield-fraud-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 760px;
        }
        .botshield-fraud-table th,
        .botshield-fraud-table td {
          padding: 10px 12px;
          border-bottom: 1px solid #e3e5e7;
          text-align: left;
          color: var(--overview-ink);
          font-family: inherit;
          font-size: 0.8125rem;
          line-height: 1.25rem;
          vertical-align: middle;
        }
        .botshield-fraud-table th {
          background: var(--fraud-surface-muted);
          color: var(--overview-muted);
          font-size: 11px;
          font-weight: 650;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .botshield-fraud-table tr:last-child td {
          border-bottom: 0;
        }
        /* Fraud Orders: investigation-first workspace. */
        .botshield-fraud-orders-content {
          display: flex;
          flex-direction: column;
          gap: 14px;
          min-width: 0;
          --overview-green: #29845a;
          --overview-amber: #b98900;
          --overview-red: #d72c0d;
          --overview-blue: #2c6ecb;
          --overview-ink: #202223;
          --overview-muted: #6d7175;
          --fraud-border: #dfe3e8;
          --fraud-border-strong: #d8dadc;
          --fraud-surface-muted: #fafbfb;
          color: var(--overview-ink);
          font-family: var(--p-font-family-sans, Inter, -apple-system, BlinkMacSystemFont, "San Francisco", "Segoe UI", Roboto, "Helvetica Neue", sans-serif);
          font-synthesis: none;
          letter-spacing: -0.01em;
          -webkit-font-smoothing: antialiased;
          text-rendering: geometricPrecision;
        }
        .botshield-fraud-orders-content *,
        .botshield-fraud-orders-content *::before,
        .botshield-fraud-orders-content *::after {
          font-family: inherit;
        }
        .botshield-fraud-orders-content .botshield-overview-subtitle {
          max-width: 680px;
          color: var(--overview-muted);
          font-size: 13px;
          line-height: 1.5;
        }
        .botshield-fraud-orders-content .botshield-overview-title {
          font-size: 26px;
          letter-spacing: -0.025em;
        }
        .botshield-fraud-orders-content .botshield-v2-eyebrow {
          display: block;
          margin-bottom: 4px;
          font-size: 10px;
          letter-spacing: 0.075em;
        }
        .botshield-fraud-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          padding-bottom: 2px;
        }
        .botshield-fraud-status-strip {
          display: grid;
          grid-template-columns: 24px minmax(0, 1fr) auto;
          gap: 8px 12px;
          align-items: center;
          padding: 10px 14px;
          border: 1px solid var(--fraud-border);
          border-left: 3px solid #c9cccf;
          border-radius: 10px;
          background: #fff;
          box-shadow: none;
        }
        .botshield-fraud-status-strip-icon {
          display: grid;
          place-items: center;
          width: 24px;
          height: 24px;
          border-radius: 7px;
          background: #f3f1eb;
        }
        .botshield-fraud-status-strip-icon .botshield-v2-icon {
          width: 20px;
          height: 20px;
          background: transparent;
        }
        .botshield-fraud-status-strip-copy h2 {
          margin: 0;
          color: var(--overview-ink);
          font-size: 15px;
          font-weight: 650;
          line-height: 1.25rem;
          letter-spacing: -0.01em;
        }
        .botshield-fraud-status-strip-copy p {
          max-width: 640px;
          margin: 2px 0 0;
          color: var(--overview-muted);
          font-size: 12px;
          line-height: 1.375rem;
        }
        .botshield-fraud-status-strip-action {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
        }
        .botshield-fraud-snapshot {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          overflow: hidden;
          border: 1px solid var(--fraud-border);
          border-radius: 10px;
          background: #fff;
          box-shadow: none;
        }
        .botshield-fraud-snapshot-item {
          min-width: 0;
          padding: 12px 14px;
          border-right: 1px solid #e4e5e7;
        }
        .botshield-fraud-snapshot-item:last-child { border-right: 0; }
        .botshield-fraud-snapshot-item.is-interactive {
          appearance: none;
          width: 100%;
          border: 0;
          background: transparent;
          cursor: pointer;
          text-align: left;
          transition: background-color 120ms ease;
        }
        .botshield-fraud-snapshot-item.is-interactive:hover { background: #f6f6f7; }
        .botshield-fraud-snapshot-item.is-interactive:focus-visible {
          outline: 2px solid var(--overview-blue);
          outline-offset: -2px;
          z-index: 1;
        }
        .botshield-fraud-snapshot-item.is-selected {
          background: #f1f2f3;
          box-shadow: inset 0 -2px 0 #303030;
        }
        .botshield-fraud-snapshot-item.is-unavailable-metric { cursor: default; }
        .botshield-fraud-snapshot-label,
        .botshield-fraud-snapshot-value,
        .botshield-fraud-snapshot-detail { display: block; }
        .botshield-fraud-snapshot-label {
          color: var(--overview-muted);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: -0.011em;
          line-height: 1rem;
        }
        .botshield-fraud-snapshot-value {
          margin-top: 4px;
          color: var(--overview-ink);
          font-size: 22px;
          font-variant-numeric: tabular-nums;
          font-weight: 700;
          line-height: 1;
          letter-spacing: -0.03em;
        }
        .botshield-fraud-snapshot-value.is-unavailable {
          color: #8c9196;
          font-size: 1.125rem;
          font-weight: 600;
        }
        .botshield-fraud-snapshot-detail {
          margin-top: 3px;
          color: var(--overview-muted);
          font-size: 11px;
          line-height: 1.25rem;
        }
        .botshield-fraud-review-hero {
          overflow: hidden;
          margin-top: 2px;
          border: 1px solid var(--fraud-border-strong);
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04);
        }
        .botshield-fraud-section-intro {
          padding: 14px 16px 10px;
          border-bottom: 1px solid #e3e5e7;
          background: #fff;
        }
        .botshield-fraud-section-intro h2 {
          margin: 0;
          color: var(--overview-ink);
          font-size: 16px;
          font-weight: 650;
          line-height: 1.3;
          letter-spacing: -0.015em;
        }
        .botshield-fraud-section-intro p {
          max-width: 720px;
          margin: 4px 0 0;
          color: var(--overview-muted);
          font-size: 12px;
          line-height: 1.45;
        }
        .botshield-fraud-toolbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 10px 12px;
          padding: 8px 12px;
          border-bottom: 1px solid #e3e5e7;
          background: var(--fraud-surface-muted);
        }
        .botshield-fraud-filter-group {
          display: inline-flex;
          gap: 2px;
          align-items: center;
          flex: 1 1 auto;
          flex-wrap: wrap;
          min-width: 0;
          max-width: 100%;
          padding: 3px;
          border: 1px solid #d7d8d9;
          border-radius: 9px;
          background: #f4f5f5;
        }
        .botshield-fraud-filter-group button {
          appearance: none;
          white-space: nowrap;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: #565b60;
          cursor: pointer;
          font-family: inherit;
          font-size: 0.8125rem;
          font-weight: 550;
          line-height: 1.125rem;
          padding: 6px 10px;
        }
        .botshield-fraud-filter-group button:hover { background: #e9eaeb; color: var(--overview-ink); }
        .botshield-fraud-filter-group button:focus-visible,
        .botshield-fraud-toolbar input:focus-visible,
        .botshield-fraud-drawer header button:focus-visible,
        .botshield-fraud-review-link:focus-visible { outline: 2px solid var(--overview-blue); outline-offset: 2px; }
        .botshield-fraud-filter-group button.is-active {
          background: var(--overview-ink);
          color: #fff;
          box-shadow: 0 1px 2px rgba(20, 24, 27, 0.16);
        }
        .botshield-fraud-filter-group button:disabled { cursor: not-allowed; opacity: 0.72; }
        .botshield-fraud-toolbar s-search-field {
          width: min(280px, 100%);
          flex: 0 1 280px;
        }
        .botshield-fraud-search-wrap {
          width: min(280px, 100%);
          flex: 0 1 280px;
        }
        .botshield-fraud-filter-group s-button { white-space: nowrap; }
        .botshield-fraud-table-wrap {
          width: 100%;
          overflow-x: auto;
          scrollbar-gutter: stable;
        }
        .botshield-fraud-table-order {
          appearance: none;
          border: 0;
          background: transparent;
          color: var(--overview-ink);
          cursor: pointer;
          font-family: inherit;
          font-size: 0.8125rem;
          font-weight: 650;
          line-height: 1.25rem;
          padding: 0;
          text-align: left;
        }
        .botshield-fraud-table-order:hover,
        .botshield-fraud-table-order:focus-visible {
          color: var(--overview-blue);
          outline: none;
          text-decoration: underline;
        }
        .botshield-fraud-table-value {
          color: var(--overview-ink);
          font-size: 0.8125rem;
          line-height: 1.25rem;
        }
        .botshield-fraud-table-wrap s-table-row:hover {
          background: #fafbfb;
        }
        .botshield-fraud-order-link {
          color: #005bd3;
          font-weight: 650;
          text-decoration: none;
        }
        .botshield-fraud-order-link:hover { text-decoration: underline; }
        .botshield-fraud-order-signal {
          display: block;
          margin-top: 2px;
          color: #616161;
          font-size: 12px;
          line-height: 1.35;
          font-weight: 450;
        }
        .botshield-fraud-refresh-note {
          margin: 0;
          color: #616161;
          font-size: 12px;
          line-height: 1.35;
        }
        .botshield-native-modal-body.botshield-fraud-review-modal s-stack { width: 100%; }
        .botshield-fraud-investigation {
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-width: 0;
        }
        .botshield-fraud-investigation-header {
          padding-bottom: 12px;
          border-bottom: 1px solid #e3e5e7;
        }
        .botshield-fraud-investigation-title-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .botshield-fraud-investigation-title-row h3 {
          margin: 0;
          color: var(--overview-ink);
          font-size: 18px;
          font-weight: 650;
          letter-spacing: -0.02em;
          line-height: 1.25;
        }
        .botshield-fraud-investigation-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          align-items: center;
        }
        .botshield-fraud-investigation-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin: 6px 0 0;
          color: var(--overview-muted);
          font-size: 12px;
          line-height: 1.4;
        }
        .botshield-fraud-investigation-section {
          padding-top: 2px;
        }
        .botshield-fraud-investigation-section h4 {
          margin: 0 0 10px;
          color: var(--overview-muted);
          font-size: 11px;
          font-weight: 650;
          letter-spacing: 0.04em;
          line-height: 1.2;
          text-transform: uppercase;
        }
        .botshield-fraud-investigation-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px 16px;
          margin: 0;
        }
        .botshield-fraud-investigation-grid div.is-full { grid-column: 1 / -1; }
        .botshield-fraud-investigation-grid dt {
          color: var(--overview-muted);
          font-size: 11px;
          line-height: 1.3;
        }
        .botshield-fraud-investigation-grid dd {
          overflow-wrap: anywhere;
          margin: 3px 0 0;
          color: var(--overview-ink);
          font-size: 13px;
          font-weight: 580;
          line-height: 1.4;
        }
        .botshield-fraud-investigation-empty {
          margin: 0;
          color: var(--overview-muted);
          font-size: 13px;
          line-height: 1.45;
        }
        .botshield-fraud-investigation-guidance {
          padding: 12px 14px;
          border: 1px solid #e3e5e7;
          border-radius: 10px;
          background: var(--fraud-surface-muted);
        }
        .botshield-fraud-investigation-guidance p {
          margin: 0;
          color: var(--overview-ink);
          font-size: 13px;
          line-height: 1.45;
        }
        .botshield-fraud-investigation-guidance small {
          display: block;
          margin-top: 6px;
          color: var(--overview-muted);
          font-size: 11px;
          line-height: 1.35;
        }
        .botshield-fraud-investigation-source {
          margin: 0;
          color: var(--overview-muted);
          font-size: 11px;
          line-height: 1.4;
        }
        .botshield-fraud-queue-skeleton {
          display: grid;
          gap: 8px;
          width: 100%;
          max-width: 960px;
        }
        .botshield-fraud-queue-skeleton-row {
          display: grid;
          grid-template-columns: 1.2fr 0.7fr 0.7fr 0.9fr 0.9fr 0.9fr 0.6fr;
          gap: 10px;
        }
        .botshield-fraud-queue-skeleton-row span {
          display: block;
          height: 12px;
          border-radius: 999px;
          background: linear-gradient(90deg, #eceeef 0%, #f6f6f7 45%, #eceeef 100%);
          background-size: 200% 100%;
          animation: botshield-fraud-skeleton 1200ms ease-in-out infinite;
        }
        @keyframes botshield-fraud-skeleton {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
        .botshield-fraud-queue-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 112px;
          box-sizing: border-box;
          padding: 20px 24px 18px;
          text-align: center;
        }
        .botshield-fraud-queue-empty.is-compact {
          min-height: 64px;
          padding: 14px 18px 12px;
        }
        .botshield-fraud-queue-empty.is-compact p {
          margin-bottom: 8px;
        }
        .botshield-fraud-queue-empty.is-disconnected {
          border-top: 1px solid #eceeef;
        }
        .botshield-fraud-queue-empty .botshield-v2-icon {
          width: 22px;
          height: 22px;
          margin-bottom: 6px;
          background: #eceeef;
        }
        .botshield-fraud-queue-empty h3 {
          margin: 0;
          color: var(--overview-ink);
          font-size: 14px;
          font-weight: 650;
          line-height: 1.3;
        }
        .botshield-fraud-queue-empty p {
          max-width: 460px;
          margin: 5px 0 10px;
          color: var(--overview-muted);
          font-size: 12px;
          line-height: 1.45;
        }
        .botshield-fraud-queue-empty small {
          margin-top: 6px;
          color: var(--overview-muted);
          font-size: 11px;
          line-height: 1.25rem;
        }
        .botshield-fraud-queue-loading {
          display: grid;
          min-height: 180px;
          place-items: center;
          align-content: center;
          gap: 10px;
          padding: 28px;
          border: 1px solid #e4e5e7;
          border-radius: 10px;
          background: #fff;
        }
        .botshield-fraud-queue-loading p {
          margin: 0;
          color: #616161;
          font-size: 13px;
        }
        .botshield-fraud-queue-loading-spinner {
          width: 22px;
          height: 22px;
          border: 2px solid #e3e3e3;
          border-top-color: #303030;
          border-radius: 999px;
          animation: botshield-fraud-spin 700ms linear infinite;
        }
        @keyframes botshield-fraud-spin { to { transform: rotate(360deg); } }
        .botshield-fraud-drawer-source-note {
          margin-top: 10px;
          color: #737373;
          font-size: 12px;
          line-height: 1.45;
        }
        .botshield-fraud-inbox-table { min-width: 820px; }
        .botshield-fraud-inbox-order strong {
          display: block;
          color: var(--overview-ink);
          font-size: 0.8125rem;
          font-weight: 650;
          line-height: 1.25rem;
        }
        .botshield-fraud-inbox-order strong,
        .botshield-fraud-inbox-customer strong,
        .botshield-fraud-inbox-signal strong,
        .botshield-fraud-inbox-order small,
        .botshield-fraud-inbox-customer small,
        .botshield-fraud-inbox-signal small { display: block; }
        .botshield-fraud-inbox-order small,
        .botshield-fraud-inbox-customer small,
        .botshield-fraud-inbox-signal small {
          margin-top: 2px;
          color: var(--overview-muted);
          font-size: 11px;
          line-height: 1.25rem;
        }
        .botshield-fraud-inbox-signal strong {
          color: var(--overview-ink);
          font-size: 0.8125rem;
          font-weight: 600;
          line-height: 1.25rem;
        }
        .botshield-fraud-inbox-action { text-align: right; white-space: nowrap; }
        .botshield-fraud-review-link {
          appearance: none;
          border: 0;
          background: transparent;
          color: var(--overview-blue);
          cursor: pointer;
          font-family: inherit;
          font-size: 0.8125rem;
          font-weight: 650;
          line-height: 1.25rem;
          padding: 0;
          text-decoration: none;
        }
        .botshield-fraud-review-link:hover { text-decoration: underline; }
        .botshield-fraud-drawer-summary {
          padding: 14px;
          border-radius: 10px;
          background: #f6f6f7;
        }
        .botshield-fraud-drawer-summary p {
          margin: 8px 0 0;
          color: #616161;
          font-size: .8125rem;
          line-height: 1.25rem;
        }
        .botshield-fraud-drawer-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px 16px;
          margin: 0;
        }
        .botshield-fraud-drawer-grid div.is-full { grid-column: 1 / -1; }
        .botshield-fraud-drawer-grid dt,
        .botshield-fraud-drawer dt { color: #737373; font-size: 11px; line-height: 1.3; }
        .botshield-fraud-drawer-grid dd,
        .botshield-fraud-drawer dd { overflow-wrap: anywhere; margin: 3px 0 0; color: #242424; font-size: 13px; font-weight: 580; line-height: 1.4; }
        .botshield-fraud-signal-list {
          margin: 0;
          padding-left: 18px;
          color: #303030;
          font-size: .8125rem;
          line-height: 1.45;
        }
        .botshield-fraud-signal-list li + li { margin-top: 4px; }
        .botshield-fraud-polaris { gap: 18px; }
        .botshield-fraud-native-status { display: grid; grid-template-columns: 36px minmax(0,1fr) auto; gap: 14px; align-items: center; padding: 16px 18px; border: 1px solid #d8d8d8; border-radius: 12px; background: #fff; }
        .botshield-fraud-native-status-icon { display: flex; width: 34px; height: 34px; align-items: center; justify-content: center; box-sizing: border-box; border-radius: 9px; background: #f4f0e3; color: #6d5923; font-size: 18px; line-height: 1; }
        .botshield-fraud-native-status-copy p { max-width: 680px; }
        .botshield-fraud-native-queue { min-height: 0; }
        .botshield-fraud-native-empty { display: grid; grid-template-columns: 36px minmax(0,1fr) auto; gap: 14px; align-items: center; min-height: 112px; box-sizing: border-box; padding: 18px 20px; }
        .botshield-fraud-native-response { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 16px 18px; border: 1px solid #dedede; border-radius: 12px; background: #fff; }
        .botshield-fraud-orders-content--setup { gap: 24px; }
        .botshield-native-modal-body.botshield-fraud-setup-modal {
          display: block;
        }
        .botshield-fraud-setup-progress-bar {
          height: 3px;
          overflow: hidden;
          border-radius: 999px;
          background: #e3e5e7;
        }
        .botshield-fraud-setup-progress-bar span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: #8c9196;
          transition: width 160ms ease;
        }
        .botshield-fraud-setup-progress-count {
          margin: 0;
        }
        .botshield-fraud-setup-step-row {
          align-items: start;
        }
        .botshield-fraud-setup-step-status {
          justify-self: end;
          margin-top: 1px;
          text-align: right;
          white-space: nowrap;
        }
        .botshield-fraud-preview { overflow: hidden; border: 1px solid #dedede; border-radius: 14px; background: #fff; }
        .botshield-fraud-preview-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); border-top: 1px solid #e8e8e8; }
        .botshield-fraud-preview-grid article { min-width: 0; padding: 18px 20px 20px; border-right: 1px solid #e8e8e8; }
        .botshield-fraud-preview-grid article:last-child { border-right: 0; }
        .botshield-fraud-preview-grid article > span { color: #8a8a8a; font-size: 10px; font-variant-numeric: tabular-nums; font-weight: 700; letter-spacing: .08em; }
        .botshield-fraud-preview-grid h3 { margin: 8px 0 0; color: #292929; font-size: 14px; font-weight: 670; line-height: 1.35; }
        .botshield-fraud-preview-grid p { margin: 5px 0 0; color: #696969; font-size: 12px; line-height: 1.5; }
        .botshield-fraud-access-banner { display: grid; grid-template-columns: 36px minmax(0,1fr) auto; gap: 14px; align-items: center; padding: 17px 18px; border: 1px solid #e6c76a; border-radius: 13px; background: #fffdf5; }
        .botshield-fraud-access-icon, .botshield-fraud-empty-icon { display: grid; width: 34px; height: 34px; place-items: center; border-radius: 9px; background: #f3f0e7; color: #635b3a; font-size: 18px; font-weight: 700; }
        .botshield-fraud-access-banner h2 { margin: 0; color: #202223; font-size: 18px; font-weight: 650; letter-spacing: -.012em; line-height: 1.3; }
        .botshield-fraud-access-banner p { max-width: 760px; margin: 4px 0 0; color: #616161; font-size: 13px; line-height: 1.45; }
        .botshield-fraud-summary { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); overflow: hidden; border: 1px solid #dedede; border-radius: 14px; background: #fff; }
        .botshield-fraud-summary-item { min-width: 0; padding: 18px 20px; border-right: 1px solid #e5e5e5; }
        .botshield-fraud-summary-item:last-child { border-right: 0; }
        .botshield-fraud-summary-item > span, .botshield-fraud-summary-item > strong, .botshield-fraud-summary-item > small { display: block; }
        .botshield-fraud-table { min-width: 760px; }
        .botshield-fraud-table th {
          background: var(--fraud-surface-muted);
          color: var(--overview-muted);
          font-size: 11px;
          font-weight: 650;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .botshield-fraud-table th, .botshield-fraud-table td {
          padding: 10px 12px;
          vertical-align: middle;
        }
        .botshield-fraud-table tbody tr { transition: background-color 120ms ease; }
        .botshield-fraud-table tbody tr:hover { background: #fafbfb; }
        .botshield-fraud-drawer-body > section > p {
          margin: 0;
          color: #616161;
          font-size: .8125rem;
          line-height: 1.25rem;
        }
        @media (max-width: 840px) {
          .botshield-fraud-snapshot { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .botshield-fraud-snapshot-item:nth-child(2) { border-right: 0; }
          .botshield-fraud-snapshot-item:nth-child(-n+2) { border-bottom: 1px solid #e4e5e7; }
          .botshield-fraud-toolbar { align-items: stretch; }
          .botshield-fraud-search-wrap,
          .botshield-fraud-toolbar s-search-field { width: 100%; flex-basis: 100%; }
          .botshield-fraud-filter-group { width: 100%; }
          .botshield-fraud-investigation-grid { grid-template-columns: 1fr; }
          .botshield-fraud-investigation-grid div.is-full { grid-column: auto; }
          .botshield-fraud-queue-skeleton-row {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
          .botshield-fraud-queue-skeleton-row span:nth-child(n+4) { display: none; }
          .botshield-fraud-preview-grid { grid-template-columns: 1fr; }
          .botshield-fraud-preview-grid article { border-right: 0; border-bottom: 1px solid #e5e5e5; }
          .botshield-fraud-preview-grid article:last-child { border-bottom: 0; }
        }
        @media (max-width: 620px) {
          .botshield-fraud-header { align-items: flex-start; flex-direction: column; }
          .botshield-fraud-status-strip { grid-template-columns: 28px minmax(0, 1fr); align-items: start; }
          .botshield-fraud-status-strip-action { grid-column: 1 / -1; justify-content: flex-start; flex-wrap: wrap; }
          .botshield-fraud-snapshot { grid-template-columns: 1fr; }
          .botshield-fraud-snapshot-item { border-right: 0; border-bottom: 1px solid #e4e5e7; }
          .botshield-fraud-snapshot-item:last-child { border-bottom: 0; }
          .botshield-fraud-drawer-grid { grid-template-columns: 1fr; }
          .botshield-fraud-drawer-grid div.is-full { grid-column: auto; }
        }
        .botshield-fraud-risk { display: inline-flex; min-height: 22px; box-sizing: border-box; align-items: center; white-space: nowrap; border: 1px solid transparent; border-radius: 999px; padding: 3px 8px; font-size: 11px; font-weight: 650; line-height: 1.2; }
        .botshield-fraud-risk--high { border-color: #f1b8b2; background: #fee9e7; color: #8e1f16; }
        .botshield-fraud-risk--medium { border-color: #e8cc77; background: #fff4c7; color: #6f5300; }
        .botshield-fraud-risk--low { border-color: #a9d7bd; background: #e7f7ed; color: #1f5d38; }
        .botshield-fraud-risk--pending { border-color: #d7d7d7; background: #f1f1f1; color: #555; }
        .botshield-fraud-empty { display: grid; min-height: 220px; box-sizing: border-box; place-items: center; align-content: center; padding: 28px; text-align: center; }
        .botshield-fraud-empty-icon { margin-bottom: 12px; background: #eaf5ee; color: #27733e; }
        .botshield-fraud-empty h3 { margin: 0; color: #252525; font-size: 16px; font-weight: 650; }
        .botshield-fraud-empty p { max-width: 520px; margin: 6px 0 0; color: #686868; font-size: 13px; line-height: 1.5; }
        .botshield-fraud-automation-list { border-top: 1px solid #e8e8e8; }
        .botshield-fraud-automation-compact { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 18px; align-items: center; padding: 18px 20px; }
        .botshield-fraud-automation-compact h2 { margin: 0; color: #292929; font-size: 15px; font-weight: 670; line-height: 1.35; }
        .botshield-fraud-automation-compact p { max-width: 760px; margin: 5px 0 0; color: #696969; font-size: 12px; line-height: 1.45; }
        .botshield-fraud-automation-item { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 20px; align-items: center; padding: 14px 20px; border-bottom: 1px solid #ececec; }
        .botshield-fraud-automation-item:last-child { border-bottom: 0; }
        .botshield-fraud-automation-item h3 { margin: 0; color: #303030; font-size: 13px; font-weight: 650; }
        .botshield-fraud-automation-item p { max-width: 760px; margin: 3px 0 0; color: #696969; font-size: 12px; line-height: 1.4; }
        .botshield-fraud-drawer-backdrop { position: fixed; z-index: 90; inset: 0; display: flex; justify-content: flex-end; background: rgba(23,23,23,.28); }
        .botshield-fraud-drawer { display: flex; width: min(480px,100vw); height: 100%; flex-direction: column; background: #fff; box-shadow: -12px 0 36px rgba(0,0,0,.16); }
        .botshield-fraud-drawer > header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 20px 22px 17px; border-bottom: 1px solid #e3e3e3; }
        .botshield-fraud-drawer > header h2 { margin: 0; color: #202223; font-size: 19px; font-weight: 680; letter-spacing: -.015em; }
        .botshield-fraud-drawer > header p { margin: 4px 0 0; color: #686868; font-size: 12px; }
        .botshield-fraud-drawer > header button { display: grid; width: 30px; height: 30px; flex: 0 0 auto; place-items: center; border: 0; border-radius: 8px; background: transparent; color: #4a4a4a; cursor: pointer; font-size: 22px; line-height: 1; }
        .botshield-fraud-drawer > header button:hover { background: #eee; }
        .botshield-fraud-drawer-body { overflow-y: auto; padding: 18px 22px 28px; }
        .botshield-fraud-risk-summary { padding: 16px; border-radius: 11px; background: #f7f7f7; }
        .botshield-fraud-risk-summary h3 { margin: 10px 0 0; color: #262626; font-size: 16px; font-weight: 650; }
        .botshield-fraud-risk-summary p, .botshield-fraud-drawer-body > section > p { margin: 5px 0 0; color: #626262; font-size: 12px; line-height: 1.5; }
        .botshield-fraud-drawer-body > section { margin-top: 20px; padding-top: 18px; border-top: 1px solid #e7e7e7; }
        .botshield-fraud-drawer-body > section > h3 { margin: 0 0 12px; color: #3f3f3f; font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
        .botshield-fraud-drawer dl { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 14px 18px; margin: 0; }
        .botshield-fraud-drawer dl div.is-full { grid-column: 1 / -1; }
        .botshield-fraud-drawer dt { color: #737373; font-size: 11px; line-height: 1.3; }
        .botshield-fraud-drawer dd { overflow-wrap: anywhere; margin: 3px 0 0; color: #242424; font-size: 13px; font-weight: 580; line-height: 1.4; }
        .botshield-fraud-drawer > footer { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: auto; padding: 14px 22px; border-top: 1px solid #e3e3e3; background: #fafafa; }
        .botshield-fraud-open-order { border-radius: 8px; background: #303030; color: #fff; font-size: 13px; font-weight: 650; padding: 8px 12px; text-decoration: none; }
        .botshield-settings-content {
          padding-bottom: 48px;
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
        .botshield-overview-v2.botshield-settings-hub-content {
          padding-bottom: 48px;
          color: var(--overview-ink);
          font-family: var(--p-font-family-sans, Inter, -apple-system, BlinkMacSystemFont, "San Francisco", "Segoe UI", Roboto, "Helvetica Neue", sans-serif);
          font-synthesis: none;
          letter-spacing: -0.01em;
          -webkit-font-smoothing: antialiased;
        }
        .botshield-overview-v2.botshield-settings-hub-content .botshield-overview-header {
          padding-bottom: 2px;
        }
        .botshield-settings-hub-header {
          display: grid;
          gap: 12px;
          padding-bottom: 10px;
        }
        .botshield-settings-hub-header-copy {
          max-width: 720px;
        }
        .botshield-settings-hub-strip {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .botshield-settings-hub-strip-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 28px;
          padding: 0 10px;
          border: 1px solid #dfe3e8;
          border-radius: 999px;
          background: #fafbfb;
          color: var(--overview-ink);
          font-size: 11px;
          line-height: 1;
          white-space: nowrap;
        }
        .botshield-settings-hub-strip-item.is-healthy {
          border-color: #c9e3d0;
          background: #f4fbf6;
        }
        .botshield-settings-hub-strip-item.is-warning,
        .botshield-settings-hub-strip-item.is-monitor {
          border-color: #ead6a5;
          background: #fffaf0;
        }
        .botshield-settings-hub-strip-label {
          color: var(--overview-muted);
          font-weight: 600;
        }
        .botshield-settings-hub-strip-value {
          font-weight: 650;
          color: var(--overview-ink);
        }
        .botshield-settings-hub-layout {
          display: grid;
          grid-template-columns: 220px minmax(0, 1fr);
          gap: 22px;
          align-items: start;
        }
        .botshield-settings-hub-nav {
          display: grid;
          gap: 1px;
          position: sticky;
          top: 12px;
          padding: 5px;
          border: 1px solid #dfe3e8;
          border-radius: 12px;
          background: #ffffff;
          box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04);
        }
        .botshield-settings-hub-nav-item {
          display: grid;
          grid-template-columns: 28px minmax(0, 1fr);
          gap: 10px;
          align-items: center;
          width: 100%;
          min-height: 40px;
          padding: 8px 10px;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: var(--overview-muted);
          font: inherit;
          font-size: 13px;
          font-weight: 560;
          line-height: 1.25;
          text-align: left;
          cursor: pointer;
        }
        .botshield-settings-hub-nav-item .botshield-v2-icon {
          width: 24px;
          height: 24px;
        }
        .botshield-settings-hub-nav-item span {
          min-width: 0;
          color: var(--overview-ink);
        }
        .botshield-settings-hub-nav-item:hover {
          background: #f6f6f7;
        }
        .botshield-settings-hub-nav-item.is-active {
          background: #f1f2f3;
          font-weight: 650;
          box-shadow: inset 3px 0 0 var(--overview-ink);
        }
        .botshield-settings-hub-nav-item.is-danger span {
          color: var(--overview-red);
        }
        .botshield-settings-hub-nav-item.is-danger.is-active {
          background: #fff4f4;
          box-shadow: inset 2px 0 0 var(--overview-red);
        }
        .botshield-settings-hub-nav-item:focus-visible {
          outline: 2px solid var(--overview-blue);
          outline-offset: 1px;
        }
        .botshield-settings-hub-panel {
          display: grid;
          gap: 14px;
          min-width: 0;
        }
        .botshield-settings-hub-section {
          display: grid;
          gap: 12px;
        }
        .botshield-settings-hub-section-head h2 {
          margin: 6px 0 0;
          color: var(--overview-ink);
          font-size: 17px;
          line-height: 1.3;
          font-weight: 700;
          letter-spacing: -0.01em;
        }
        .botshield-settings-hub-section-head p {
          margin: 8px 0 0;
          max-width: 640px;
          color: var(--overview-muted);
          font-size: 13px;
          line-height: 1.5;
        }
        .botshield-settings-hub-group {
          display: grid;
          gap: 0;
          border: 1px solid #dfe3e8;
          border-radius: 12px;
          overflow: hidden;
          background: #ffffff;
          box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04);
        }
        .botshield-settings-hub-group.is-control {
          border: 0;
          background: transparent;
          gap: 10px;
          overflow: visible;
          box-shadow: none;
        }
        .botshield-settings-hub-subgroup {
          border: 1px solid #dfe3e8;
          border-radius: 12px;
          overflow: hidden;
          background: #fff;
          box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04);
        }
        .botshield-settings-hub-subgroup.is-operational {
          border-left: 4px solid var(--overview-green);
        }
        .botshield-settings-hub-subgroup.is-action {
          border-style: dashed;
          border-color: #dfe3e8;
          background: #fafbfb;
        }
        .botshield-settings-hub-inline-note {
          margin: 0;
          padding: 0 16px 14px;
          color: var(--overview-muted);
          font-size: 12px;
          line-height: 1.45;
        }
        .botshield-settings-hub-delivery {
          display: grid;
          gap: 10px;
        }
        .botshield-settings-hub-delivery-head h3 {
          margin: 4px 0 0;
          color: var(--overview-ink);
          font-size: 15px;
          font-weight: 700;
          line-height: 1.25;
          letter-spacing: -0.01em;
        }
        .botshield-settings-hub-delivery-body {
          border: 1px solid #dfe3e8;
          border-radius: 12px;
          background: #fafbfb;
          overflow: hidden;
        }
        .botshield-settings-hub-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(132px, auto);
          gap: 18px;
          align-items: center;
          min-height: 62px;
          padding: 12px 16px;
          border-bottom: 1px solid #e1e3e5;
        }
        .botshield-settings-hub-row.has-icon {
          grid-template-columns: 28px minmax(0, 1fr) minmax(132px, auto);
        }
        .botshield-settings-hub-row:last-child {
          border-bottom: 0;
        }
        .botshield-settings-hub-row.is-muted,
        .botshield-settings-hub-delivery-body .botshield-settings-hub-row {
          background: transparent;
        }
        .botshield-settings-hub-row.is-operational {
          min-height: 58px;
        }
        .botshield-settings-hub-row.is-secondary {
          background: #fafbfb;
        }
        .botshield-settings-hub-row.is-diagnostic {
          border-left: 4px solid var(--overview-ink);
        }
        .botshield-settings-hub-row-icon .botshield-v2-icon {
          width: 28px;
          height: 28px;
        }
        .botshield-settings-hub-row-eyebrow {
          display: block;
          margin-bottom: 2px;
          color: var(--overview-muted);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.075em;
          line-height: 1.2;
          text-transform: uppercase;
        }
        .botshield-settings-hub-row-copy h3 {
          margin: 0;
          color: var(--overview-ink);
          font-size: 15px;
          line-height: 1.25;
          font-weight: 700;
          letter-spacing: -0.01em;
        }
        .botshield-settings-hub-row-copy p {
          margin: 4px 0 0;
          color: var(--overview-muted);
          font-size: 13px;
          line-height: 1.5;
        }
        .botshield-settings-hub-row-control {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          min-width: 0;
        }
        .botshield-settings-hub-field {
          width: min(280px, 100%);
        }
        .botshield-settings-hub-field s-text-field {
          width: 100%;
        }
        .botshield-settings-hub-row-control s-text-field {
          width: min(280px, 100%);
        }
        .botshield-settings-hub-row-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
        }
        .botshield-settings-hub-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          min-height: 28px;
          padding: 0 10px;
          border: 1px solid #dfe3e8;
          border-radius: 999px;
          background: #fff;
          color: var(--overview-ink);
          font-size: 12px;
          font-weight: 650;
          line-height: 1;
          white-space: nowrap;
        }
        .botshield-settings-hub-status-pill.is-healthy {
          border-color: #c9e3d0;
          background: #f4fbf6;
        }
        .botshield-settings-hub-status-pill.is-attention {
          border-color: #ead6a5;
          background: #fffaf0;
        }
        .botshield-settings-hub-status-pill.is-neutral {
          border-color: #dfe3e8;
          background: #fafbfb;
        }
        .botshield-settings-hub-value {
          color: var(--overview-ink);
          font-size: 13px;
          font-weight: 650;
          line-height: 1.3;
          text-align: center;
        }
        .botshield-settings-hub-group.is-privacy .botshield-settings-hub-row.has-icon {
          grid-template-columns: 28px minmax(0, 1fr) 204px;
          align-items: center;
          min-height: 72px;
          padding: 14px 16px;
        }
        .botshield-settings-hub-group.is-privacy .botshield-settings-hub-row-copy p {
          max-width: 56ch;
        }
        .botshield-settings-hub-group.is-privacy .botshield-settings-hub-row-control {
          width: 204px;
          min-width: 204px;
          max-width: 204px;
          justify-content: center;
        }
        .botshield-settings-hub-fixed-action {
          display: block;
          width: 100%;
        }
        .botshield-settings-hub-legal-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          width: 100%;
          min-height: 36px;
          padding: 0 14px;
          border: 1px solid #c9cccf;
          border-radius: 8px;
          background: #ffffff;
          color: var(--overview-ink);
          font-size: 13px;
          font-weight: 650;
          line-height: 1.2;
          text-align: center;
          text-decoration: none;
          cursor: pointer;
          transition:
            background-color 120ms ease,
            border-color 120ms ease,
            box-shadow 120ms ease;
        }
        .botshield-settings-hub-legal-link:hover {
          background: #fafbfb;
          border-color: #babfc4;
        }
        .botshield-settings-hub-legal-link:focus-visible {
          outline: 2px solid var(--overview-ink);
          outline-offset: 2px;
        }
        .botshield-settings-hub-fixed-value {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          min-height: 36px;
          padding: 0 8px;
        }
        .botshield-settings-hub-meta {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          padding: 0 16px 14px;
          color: var(--overview-muted);
          font-size: 13px;
          line-height: 1.35;
        }
        .botshield-settings-hub-meta-copy {
          min-width: 0;
        }
        .botshield-settings-hub-note {
          margin: 0;
          padding: 10px 12px;
          border-bottom: 1px solid #e1e3e5;
          background: #fafbfb;
          color: var(--overview-muted);
          font-size: 13px;
          line-height: 1.4;
        }
        .botshield-settings-hub-note.is-error {
          border-color: #fed3d1;
          background: #fff4f4;
          color: var(--overview-red);
        }
        .botshield-settings-hub-section.is-panel-danger {
          display: grid;
          gap: 12px;
        }
        .botshield-settings-hub-danger {
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr) auto;
          gap: 14px 16px;
          align-items: start;
          padding: 16px;
          border: 1px solid #f1b8b5;
          border-left: 4px solid var(--overview-red);
          border-radius: 12px;
          background: #fff8f7;
        }
        .botshield-settings-hub-danger-icon .botshield-v2-icon {
          width: 34px;
          height: 34px;
          border-color: #f1b8b5;
          background: #fdeeee;
        }
        .botshield-settings-hub-danger-copy h3 {
          margin: 0;
          color: var(--overview-ink);
          font-size: 15px;
          line-height: 1.25;
          font-weight: 700;
          letter-spacing: -0.01em;
        }
        .botshield-settings-hub-danger-copy p {
          margin: 6px 0 0;
          max-width: 520px;
          color: var(--overview-muted);
          font-size: 13px;
          line-height: 1.5;
        }
        .botshield-settings-hub-danger > s-button,
        .botshield-settings-hub-danger > .botshield-settings-hub-danger-copy + s-button {
          grid-column: 3;
          align-self: center;
        }
        .botshield-overview-v2.botshield-settings-hub-content s-button:focus-visible,
        .botshield-overview-v2.botshield-settings-hub-content button:focus-visible {
          outline: 2px solid var(--overview-blue);
          outline-offset: 2px;
        }
        .botshield-settings-hub-billing-current {
          border: 1px solid #c9e3d0;
          background: #f4fbf6;
          border-radius: 12px;
          padding: 4px 0;
        }
        .botshield-settings-hub-billing-current .botshield-settings-hub-row {
          border-bottom: 0;
        }
        .botshield-settings-billing-section {
          display: grid;
          gap: 18px;
        }
        .botshield-settings-hub-plan-grid {
          display: grid;
          gap: 16px;
          align-items: stretch;
        }
        .botshield-settings-hub-plan-grid.is-count-1 {
          grid-template-columns: minmax(0, 520px);
          justify-content: center;
        }
        .botshield-settings-hub-plan-grid.is-count-2 {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .botshield-settings-hub-plan-grid.is-count-3 {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .botshield-settings-hub-plan-card {
          display: grid;
          gap: 16px;
          padding: 24px;
          border: 1px solid #dfe3e8;
          border-radius: 14px;
          background: #fff;
          box-shadow: 0 1px 0 rgba(32, 34, 35, 0.04);
        }
        .botshield-settings-hub-plan-card--current {
          border-color: #b8dcc6;
          background: linear-gradient(180deg, #f8fcf9 0%, #ffffff 38%);
          box-shadow:
            0 0 0 1px rgba(41, 132, 90, 0.08),
            0 8px 24px rgba(32, 34, 35, 0.05);
        }
        .botshield-settings-hub-plan-current-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          align-self: start;
          min-height: 28px;
          padding: 0 10px;
          border: 1px solid #c9e3d0;
          border-radius: 999px;
          background: #f4fbf6;
          color: var(--overview-ink);
          font-size: 12px;
          font-weight: 700;
          line-height: 1;
        }
        .botshield-settings-hub-plan-card-head {
          display: grid;
          gap: 8px;
        }
        .botshield-settings-hub-plan-card-head h3 {
          margin: 0;
          color: var(--overview-ink);
          font-size: 18px;
          line-height: 1.2;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .botshield-settings-hub-plan-price-row {
          display: flex;
          align-items: baseline;
          gap: 4px;
          flex-wrap: wrap;
        }
        .botshield-settings-hub-plan-price {
          margin: 0;
          color: var(--overview-ink);
          font-size: 34px;
          line-height: 1;
          font-weight: 800;
          letter-spacing: -0.04em;
        }
        .botshield-settings-hub-plan-price-suffix {
          color: var(--overview-muted);
          font-size: 15px;
          font-weight: 650;
          line-height: 1.2;
        }
        .botshield-settings-hub-plan-meta {
          margin: 0;
          color: var(--overview-green);
          font-size: 13px;
          line-height: 1.35;
          font-weight: 650;
        }
        .botshield-settings-hub-plan-copy {
          margin: 0;
          color: var(--overview-muted);
          font-size: 14px;
          line-height: 1.5;
        }
        .botshield-settings-hub-plan-divider {
          height: 1px;
          background: #e1e3e5;
        }
        .botshield-settings-hub-plan-features {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 8px;
        }
        .botshield-settings-hub-plan-features.is-checklist li {
          display: grid;
          grid-template-columns: 18px minmax(0, 1fr);
          gap: 10px;
          align-items: start;
          color: var(--overview-ink);
          font-size: 14px;
          line-height: 1.45;
        }
        .botshield-settings-hub-plan-check {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          margin-top: 1px;
          border-radius: 999px;
          background: #f4fbf6;
          color: var(--overview-green);
        }
        .botshield-settings-hub-plan-shopify-note {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin: 0;
          color: var(--overview-muted);
          font-size: 13px;
          line-height: 1.35;
        }
        .botshield-settings-hub-plan-shopify-note .botshield-v2-icon {
          width: 24px;
          height: 24px;
        }
        .botshield-settings-hub-plan-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .botshield-settings-hub-subscription-panel {
          display: grid;
          gap: 14px;
          padding: 18px 20px;
          border: 1px solid #dfe3e8;
          border-radius: 12px;
          background: #fafbfb;
        }
        .botshield-settings-hub-subscription-head {
          display: grid;
          gap: 4px;
        }
        .botshield-settings-hub-subscription-head h3 {
          margin: 0;
          color: var(--overview-ink);
          font-size: 16px;
          line-height: 1.25;
          font-weight: 700;
          letter-spacing: -0.01em;
        }
        .botshield-settings-hub-subscription-head p {
          margin: 0;
          color: var(--overview-muted);
          font-size: 13px;
          line-height: 1.45;
        }
        .botshield-settings-hub-subscription-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px 16px;
        }
        .botshield-settings-hub-subscription-item {
          display: grid;
          gap: 5px;
          min-width: 0;
        }
        .botshield-settings-hub-subscription-label {
          color: var(--overview-muted);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          line-height: 1.2;
          text-transform: uppercase;
        }
        .botshield-settings-hub-subscription-value {
          display: flex;
          align-items: center;
          min-width: 0;
        }
        .botshield-settings-hub-subscription-foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          padding-top: 12px;
          border-top: 1px solid #e1e3e5;
        }
        .botshield-settings-hub-subscription-foot p {
          margin: 0;
          color: var(--overview-muted);
          font-size: 13px;
          line-height: 1.4;
        }
        .botshield-settings-hub-dev-note {
          padding: 12px 14px;
          border: 1px solid #ead6a5;
          border-left: 3px solid var(--overview-amber);
          border-radius: 10px;
          background: #fffaf0;
        }
        .botshield-settings-hub-dev-note-copy strong {
          display: block;
          color: var(--overview-ink);
          font-size: 13px;
          line-height: 1.3;
        }
        .botshield-settings-hub-dev-note-copy p {
          margin: 4px 0 0;
          color: var(--overview-muted);
          font-size: 13px;
          line-height: 1.45;
        }
        .botshield-settings-hub-footnote {
          margin: 0;
          color: var(--overview-muted);
          font-size: 12px;
          line-height: 1.5;
        }
        @media (max-width: 980px) {
          .botshield-settings-hub-layout {
            grid-template-columns: 1fr;
          }
          .botshield-settings-hub-nav {
            position: static;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .botshield-settings-hub-plan-grid.is-count-2,
          .botshield-settings-hub-plan-grid.is-count-3 {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 640px) {
          .botshield-settings-hub-nav {
            grid-template-columns: 1fr;
          }
          .botshield-settings-hub-row {
            grid-template-columns: minmax(0, 1fr);
            gap: 10px;
            align-items: start;
          }
          .botshield-settings-hub-row.has-icon {
            grid-template-columns: 28px minmax(0, 1fr);
          }
          .botshield-settings-hub-row-control {
            justify-content: flex-start;
          }
          .botshield-settings-hub-group.is-privacy .botshield-settings-hub-row.has-icon {
            grid-template-columns: 28px minmax(0, 1fr);
          }
          .botshield-settings-hub-group.is-privacy .botshield-settings-hub-row-control {
            width: 100%;
            min-width: 0;
            max-width: none;
            justify-content: stretch;
          }
          .botshield-settings-hub-fixed-value {
            justify-content: flex-start;
            min-height: 0;
            padding: 0;
            text-align: left;
          }
          .botshield-settings-hub-group.is-privacy .botshield-settings-hub-value {
            text-align: left;
            white-space: normal;
          }
          .botshield-settings-hub-subscription-grid {
            grid-template-columns: 1fr;
          }
          .botshield-settings-hub-plan-card {
            padding: 20px;
          }
        }
        .botshield-settings-hub-billing-plans {
          display: grid;
          gap: 10px;
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
            box-shadow 120ms ease;
        }
        .botshield-outcome-card:hover {
          border-color: var(--botshield-border-strong);
          box-shadow: var(--botshield-shadow-raised);
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
            box-shadow 120ms ease;
        }
        .botshield-rule-card:hover {
          border-color: var(--botshield-border-strong);
          box-shadow: var(--botshield-shadow-raised);
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
          .botshield-page {
            --botshield-shell-padding-inline: 20px;
          }
          .botshield-settings-hub-layout {
            grid-template-columns: 1fr;
          }
          .botshield-settings-hub-nav {
            position: static;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          }
          .botshield-settings-hub-row {
            grid-template-columns: minmax(0, 1fr) auto;
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
          .botshield-page {
            --botshield-shell-padding-inline: 12px;
            --botshield-shell-padding-top: 22px;
          }
          .botshield-page-heading { display: block; }
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
          .botshield-overview-v2 .botshield-v2-quick-action-row {
            grid-template-columns: 32px minmax(0, 1fr);
            grid-template-areas:
              "icon copy"
              ". action";
            align-items: start;
            row-gap: 10px;
          }
          .botshield-overview-v2 .botshield-v2-quick-action-row > s-button {
            justify-self: start;
          }
          .botshield-analytics-header { display: block; }
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
          .botshield-settings-hub-nav {
            grid-template-columns: 1fr 1fr;
          }
          .botshield-settings-hub-row {
            grid-template-columns: 1fr;
            align-items: flex-start;
          }
          .botshield-settings-hub-row-control,
          .botshield-settings-hub-row-actions {
            width: 100%;
            justify-content: flex-start;
          }
          .botshield-settings-hub-row-control s-text-field {
            width: 100%;
          }
          .botshield-settings-hub-danger {
            grid-template-columns: 1fr;
          }
          .botshield-settings-hub-danger > s-button {
            grid-column: auto;
            justify-self: flex-start;
          }
          .botshield-settings-hub-strip {
            gap: 6px;
          }
          .botshield-settings-hub-strip-item {
            min-height: 28px;
            padding: 0 9px;
            font-size: 11px;
          }
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
    </BotShieldToastProvider>
  );
}

export function BotShieldPageShell({ className = "", children }) {
  return (
    <div className="botshield-page">
      <main
        className={`botshield-page-content${className ? ` ${className}` : ""}`.trim()}
      >
        {children}
      </main>
    </div>
  );
}

export function BotShieldNativePage({
  heading,
  children,
  primaryAction = null,
  secondaryActions = null,
}) {
  return (
    <s-page heading={heading}>
      {primaryAction}
      {secondaryActions}
      {children}
    </s-page>
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
  commandFor,
  command,
  id,
}) {
  return (
    <s-button
      id={id}
      variant={variant}
      tone={tone}
      loading={loading}
      disabled={disabled || loading}
      icon={icon}
      accessibilityLabel={accessibilityLabel}
      href={href}
      target={target}
      slot={slot}
      commandFor={commandFor}
      command={command}
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
    <s-stack gap="small-200">
      <BotShieldActionButton
        {...buttonProps}
        loading={asyncAction.loading}
        disabled={disabled}
        onClick={asyncAction.run}
      >
        {children}
      </BotShieldActionButton>
      {asyncAction.error ? (
        <s-text tone="critical" role="alert">
          {asyncAction.error}
        </s-text>
      ) : null}
    </s-stack>
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
  id = "botshield-save-bar",
  dirty,
  saving,
  onSave,
  onDiscard,
  error,
  enabled = true,
}) {
  const isPreviewRoute =
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/ui-preview");
  const shouldUseSaveBar = enabled && Boolean(id);
  const showSaveBar = shouldUseSaveBar && dirty;

  const saveBar = (
    <ui-save-bar id={id} data-discard-confirmation>
      <button type="button" variant="primary" disabled={saving} onClick={onSave}>
        Save
      </button>
      <button type="button" disabled={saving} onClick={onDiscard}>
        Discard
      </button>
    </ui-save-bar>
  );

  if (isPreviewRoute && (dirty || error)) {
    return (
      <>
        <BotShieldSaveBarBridge
          id={id}
          dirty={showSaveBar}
          enabled={shouldUseSaveBar && !isPreviewRoute}
        />
        <BotShieldLoadingBridge active={Boolean(saving) && !isPreviewRoute} />
        {saveBar}
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
                  "Preview fallback save bar. In Shopify Admin this appears in the native App Bridge save bar."}
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
      </>
    );
  }

  return (
    <>
      <BotShieldSaveBarBridge
        id={id}
        dirty={showSaveBar}
        enabled={shouldUseSaveBar && !isPreviewRoute}
      />
      <BotShieldLoadingBridge active={Boolean(saving) && !isPreviewRoute} />
      {saveBar}
    </>
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

export function BotShieldInfoModal({
  id,
  heading,
  children,
  closeLabel = "Close",
}) {
  return (
    <s-modal id={id} heading={heading}>
      <s-box padding="base">
        <s-paragraph>{children}</s-paragraph>
      </s-box>
      <s-button slot="primary-action" commandFor={id} command="--hide">
        {closeLabel}
      </s-button>
    </s-modal>
  );
}

function runBotShieldModalCommand(id, command) {
  if (typeof document === "undefined" || !id) return false;
  const modal = document.getElementById(id);
  if (!modal) return false;

  if (command === "--show") {
    if (typeof modal.showOverlay === "function") {
      modal.showOverlay();
      return true;
    }
    if (typeof modal.show === "function") {
      modal.show();
      return true;
    }
  } else if (typeof modal.hideOverlay === "function") {
    modal.hideOverlay();
    return true;
  } else if (typeof modal.hide === "function") {
    modal.hide();
    return true;
  }

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.setAttribute("command", command);
  trigger.setAttribute("commandfor", id);
  trigger.style.position = "fixed";
  trigger.style.opacity = "0";
  trigger.style.pointerEvents = "none";
  document.body.appendChild(trigger);
  trigger.click();
  document.body.removeChild(trigger);
  return true;
}

export function showBotShieldModal(id) {
  runBotShieldModalCommand(id, "--show");
}

export function queueBotShieldModalShow(id, attempts = 16) {
  if (runBotShieldModalCommand(id, "--show")) {
    return;
  }
  if (attempts <= 0) {
    return;
  }
  requestAnimationFrame(() => {
    queueBotShieldModalShow(id, attempts - 1);
  });
}

export function hideBotShieldModal(id) {
  runBotShieldModalCommand(id, "--hide");
}

export const BOTSHIELD_PROTECTION_MODAL_ID = "botshield-protection-modal";
export const BOTSHIELD_ANALYTICS_EVENT_MODAL_ID = "botshield-analytics-event-modal";
export const BOTSHIELD_FRAUD_SETUP_MODAL_ID = "botshield-fraud-setup-modal";
export const BOTSHIELD_FRAUD_REVIEW_MODAL_ID = "botshield-fraud-review-modal";

export function BotShieldNativeModal({
  id,
  heading,
  size = "base",
  open = false,
  padding = "base",
  modalPadding,
  bodyClassName = "",
  onAfterHide,
  primaryAction,
  secondaryActions,
  children,
}) {
  const wasOpenRef = useRef(false);
  const showRequestRef = useRef(0);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      showRequestRef.current += 1;
      const showRequest = showRequestRef.current;
      queueBotShieldModalShow(id);
      return () => {
        if (showRequestRef.current === showRequest) {
          showRequestRef.current += 1;
        }
      };
    }
    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      hideBotShieldModal(id);
    }
    return undefined;
  }, [id, open]);

  const handleAfterHide = () => {
    onAfterHide?.();
  };

  return (
    <s-modal
      id={id}
      heading={heading}
      size={size}
      {...(modalPadding ? { padding: modalPadding } : {})}
      onAfterhide={handleAfterHide}
    >
      <s-box
        padding={padding}
        className={`botshield-native-modal-body${bodyClassName ? ` ${bodyClassName}` : ""}`}
      >
        {children}
      </s-box>
      {primaryAction}
      {secondaryActions}
    </s-modal>
  );
}

export function BotShieldConfirmationModal({
  id,
  heading,
  children,
  confirmLabel,
  onConfirm,
  onDismiss,
  loading,
  size = "small-100",
  tone = "critical",
}) {
  const handleConfirm = async () => {
    await onConfirm?.();
    hideBotShieldModal(id);
  };

  const handleDismiss = () => {
    onDismiss?.();
    hideBotShieldModal(id);
  };

  return (
    <s-modal id={id} heading={heading} size={size}>
      <s-box padding="base">
        <s-paragraph>{children}</s-paragraph>
      </s-box>
      <s-button
        slot="primary-action"
        variant="primary"
        tone={tone}
        loading={loading}
        onClick={handleConfirm}
      >
        {confirmLabel}
      </s-button>
      <s-button slot="secondary-actions" onClick={handleDismiss}>
        Cancel
      </s-button>
    </s-modal>
  );
}
