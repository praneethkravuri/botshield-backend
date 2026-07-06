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
          --botshield-bg: #f1f1f1;
          --botshield-surface: #ffffff;
          --botshield-border: #e3e3e3;
          --botshield-border-strong: #c9cccf;
          --botshield-text: #303030;
          --botshield-subdued: #616161;
          --botshield-muted: #8a8a8a;
          --botshield-teal: #0f766e;
          --botshield-teal-dark: #006c65;
          --botshield-teal-soft: #e8f7f3;
          --botshield-warning-soft: #fff4e5;
          --botshield-critical-soft: #fff1f2;
          --botshield-radius: 12px;
          --botshield-shadow-soft: 0 1px 0 rgba(0, 0, 0, 0.05);
          --botshield-shadow-raised: 0 1px 0 rgba(0, 0, 0, 0.06), 0 8px 22px rgba(0, 0, 0, 0.045);
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
          width: min(1160px, calc(100vw - 64px));
          margin: 0 auto;
          padding: 32px 0 80px;
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
          margin-bottom: -2px;
          color: var(--botshield-text);
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
          padding-top: 30px;
        }
        .botshield-overview-content .botshield-surface {
          padding: 24px 27px;
          box-shadow: none;
          border-color: #d4d4d4;
          border-radius: 16px;
        }
        .botshield-overview-title {
          margin: 0;
          color: #111111;
          font-size: 32px;
          line-height: 1.15;
          font-weight: 700;
        }
        .botshield-overview-subtitle {
          margin: 8px 0 0;
          color: #616161;
          font-size: 17px;
          line-height: 1.42;
        }
        .botshield-overview-metric-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px;
        }
        .botshield-overview-metric-card {
          min-height: 216px;
          box-sizing: border-box;
          background: #ffffff;
          border: 1px solid #d4d4d4;
          border-radius: 16px;
          box-shadow: none;
          padding: 28px 26px;
        }
        .botshield-overview-metric-title {
          color: #667085;
          font-size: 15px;
          line-height: 1.25;
          font-weight: 650;
        }
        .botshield-overview-metric-value {
          color: #111111;
          font-size: 40px;
          line-height: 1;
          font-weight: 750;
          margin-top: 4px;
        }
        .botshield-overview-metric-label {
          color: #101828;
          font-size: 18px;
          line-height: 1.22;
          font-weight: 700;
          margin-top: 6px;
        }
        .botshield-overview-metric-helper {
          color: #667085;
          font-size: 16px;
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
          min-height: 184px;
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
          min-height: 24px;
          min-width: 42px;
          padding: 3px 9px;
          border-radius: 999px;
          border: 1px solid #d8d8d8;
          background: #f5f5f5;
          color: #303030;
          font-size: 13px;
          line-height: 1;
          font-weight: 650;
          white-space: nowrap;
        }
        .botshield-overview-badge--muted {
          background: #eeeeee;
          color: #5f6368;
          border-color: #e2e2e2;
        }
        .botshield-analytics-content {
          width: min(1180px, calc(100vw - 56px));
          padding-top: 30px;
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
          min-height: 64px;
          margin-bottom: 18px;
          padding: 12px 14px 0;
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
          min-height: 116px;
          box-sizing: border-box;
          background: #ffffff;
          border: 1px solid #d4d4d4;
          border-radius: 12px;
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
          border: 1px solid #d4d4d4;
          border-radius: 14px;
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
          min-height: 340px;
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
          height: 286px;
        }
        .botshield-analytics-axis-label {
          fill: #303030;
          font-size: 8px;
          font-weight: 500;
          font-family: var(--p-font-family-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
        }
        .botshield-analytics-axis-label--x {
          font-size: 8px;
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
        .botshield-protection-content {
          width: min(1180px, calc(100vw - 56px));
          padding-top: 30px;
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
          border: 1px solid #d4d4d4;
          border-radius: 16px;
          box-shadow: none;
          padding: 20px 22px;
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
          margin: 18px 0 0;
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
          min-height: 62px;
          padding: 12px 16px;
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
        .botshield-surface {
          box-sizing: border-box;
          background: var(--botshield-surface);
          border: 1px solid var(--botshield-border);
          border-radius: var(--botshield-radius);
          box-shadow: var(--botshield-shadow-soft);
          padding: 28px;
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
        @media (max-width: 640px) {
          .botshield-page-content,
          .botshield-page-content--wide { width: calc(100vw - 24px); padding-top: 22px; }
          .botshield-page-heading { display: block; }
          .botshield-overview-content { width: calc(100vw - 24px); padding-top: 22px; }
          .botshield-overview-header { display: block; }
          .botshield-analytics-content { width: calc(100vw - 24px); padding-top: 22px; }
          .botshield-analytics-header { display: block; }
          .botshield-protection-content { width: calc(100vw - 24px); padding-top: 22px; }
          .botshield-protection-header { display: block; }
          .botshield-overview-metric-grid,
          .botshield-overview-middle-grid,
          .botshield-overview-action-grid,
          .botshield-analytics-stat-grid { grid-template-columns: 1fr; }
          .botshield-protection-row,
          .botshield-protection-composer-grid { grid-template-columns: 1fr; }
          .botshield-protection-row-actions { justify-content: flex-start; }
          .botshield-analytics-tabs { overflow-x: auto; }
          .botshield-analytics-chart-tabs { align-items: stretch; flex-direction: column; }
          .botshield-analytics-chart-tab { min-width: 0; width: 100%; }
          .botshield-analytics-chart-panel { min-height: 360px; padding: 14px; }
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
