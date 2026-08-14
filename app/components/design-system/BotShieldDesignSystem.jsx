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
   …22160 tokens truncated…ection: column; }
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
        â–°
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
            <s-text type="strong">{complete ? "âœ“" : index}</s-text>
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

