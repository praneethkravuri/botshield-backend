/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from "react";
import * as ReactDOM from "react-dom";
import {
  BotShieldActionButton,
  BotShieldAppFrame,
  BotShieldAsyncButton,
  BotShieldBanner,
  BotShieldCard,
  BotShieldConfirmationModal,
  BotShieldEmptyState,
  BotShieldInlineHelp,
  BotShieldLoadingState,
  BotShieldNativeModal,
  BOTSHIELD_ANALYTICS_EVENT_MODAL_ID,
  BOTSHIELD_PROTECTION_MODAL_ID,
  BotShieldNativePage,
  BotShieldPageShell,
  BotShieldSaveState,
  BotShieldSelect,
  BotShieldStatusBadge,
  BotShieldTextField,
  BotShieldToggle,
  hideBotShieldModal,
  queueBotShieldModalShow,
  showBotShieldModal,
  useBotShieldToast,
} from "../design-system/BotShieldDesignSystem";
import { safeFetchJson } from "../../lib/safe-fetch";
import { toMerchantErrorMessage } from "../../lib/merchant-error-message";
import { isValidIpAddressInput } from "../../lib/ip-address";
import {
  getBillingStatusModel,
  getEmailStatus,
  getUiStatus,
} from "../../lib/ui-status";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REASON_COPY = {
  RATE_PATTERN: "Repeated visitor activity detected",
  SUSPICIOUS_USER_AGENT: "Automated browser behavior detected",
  SENSITIVE_PATH: "Sensitive storefront path",
  BLOCKLIST_MATCH: "Blocklist match",
  WHITELIST_MATCH: "Trusted visitor",
  STRICT_MODE: "Strict protection policy",
  VPN_DETECTED: "VPN or proxy traffic",
  DATACENTER_IP: "Datacenter network",
  HOSTING_PROVIDER: "Known hosting provider traffic",
  HIGH_RISK_NETWORK: "High-risk network",
  ASN_MATCH: "Known hosting provider traffic",
  NO_SIGNIFICANT_RISK: "No elevated signals",
};

function getResponseMode(model) {
  if (model?.protectionPaused) {
    return {
      label: "Paused",
      status: "paused",
      detail:
        "BotShield is recording visits, but automated responses are paused.",
    };
  }
  if (model?.autoBlock) {
    return {
      label: "Auto Block",
      status: "active",
      detail:
        "BotShield automatically blocks visitors above the active risk threshold.",
    };
  }
  return {
    label: "Monitor",
    status: "monitoring_only",
    detail: "BotShield records suspicious activity without stopping visitors.",
  };
}

function getProtectionProfile(model) {
  if (model?.strictMode || model?.blockLevel === "High") {
    return "Strict";
  }
  if (model?.blockLevel === "Low") {
    return "Relaxed";
  }
  return "Balanced";
}

function formatDate(value, fallback = "Not yet") {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString();
}

function formatDeliveryDetail(status, timestamp, fallback) {
  if (!status) return fallback;
  const statusLabel = getUiStatus(status).label;
  const deliveredAt = formatDate(timestamp);
  return `${statusLabel} \u00b7 ${deliveredAt}`;
}

function normalizeOverviewText(value) {
  return String(value || "")
    .replaceAll("\u00e2\u20ac\u201d", "\u2014")
    .replaceAll("\u00e2\u20ac\u201c", "\u2013")
    .replaceAll("\u00e2\u20ac\u2122", "\u2019")
    .replaceAll("\u00e2\u20ac\u0153", "\u201c")
    .replaceAll("\u00e2\u20ac\u009d", "\u201d")
    .replaceAll("\u00e2\u20ac\u00a2", "\u2022")
    .replaceAll("\u00c2\u00b7", "\u00b7")
    .replaceAll("\u00c2\u0020", " ");
}

// Legacy formatter kept temporarily for backwards compatibility while older
// views move to merchant-safe reason labels.
// eslint-disable-next-line no-unused-vars
function formatReasons(value) {
  const reasons = Array.isArray(value)
    ? value
    : String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
  if (!reasons.length) return "No elevated signals";
  return reasons
    .slice(0, 2)
    .map(
      (reason) =>
        REASON_COPY[reason] ||
        reason
          .toLowerCase()
          .replaceAll("_", " ")
          .replace(/\b\w/g, (character) => character.toUpperCase()),
    )
    .join(" \u00b7 ");
}

function formatMerchantReasons(value) {
  const rawReasons = Array.isArray(value)
    ? value
    : normalizeOverviewText(value)
        .split(",")
        .map((item) => item.trim());
  const reasons = rawReasons
    .flatMap((item) =>
      normalizeOverviewText(item)
        .split("|")
        .map((part) => part.trim()),
    )
    .filter(Boolean)
    .map((reason) => reason.replace(/^\[|\]$/g, "").trim())
    .map((reason) => {
      const key = reason.toUpperCase().replaceAll(" ", "_");
      if (REASON_COPY[key]) return REASON_COPY[key];
      if (/asn\s+match|asn\s+as\d+|hosting provider/i.test(reason)) {
        return "Known hosting provider traffic";
      }
      if (/rate pattern|repeated traffic|request rate/i.test(reason)) {
        return "Repeated visitor activity detected";
      }
      if (/challenge required|verification/i.test(reason)) {
        return "Verification requested";
      }
      if (/suspicious user agent|automated browser|bot/i.test(reason)) {
        return "Automated browser behavior detected";
      }
      if (/no significant risk|no elevated/i.test(reason)) {
        return "No elevated signals";
      }
      return reason
        .toLowerCase()
        .replaceAll("_", " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
    })
    .filter((reason, index, all) => all.indexOf(reason) === index);
  if (!reasons.length) return "No elevated signals";
  return reasons.slice(0, 2).join(" \u00b7 ");
}

function getOutcomeLabel(action) {
  const normalized =
    action === "whitelisted" ? "allowed" : String(action || "allowed").toLowerCase();
  return getUiStatus(normalized).label;
}

function getRiskLabel(risk) {
  if (risk === "high") return "High risk";
  if (risk === "medium") return "Medium risk";
  return "Low risk";
}

function inRecentDays(value, days, offsetDays = 0) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;
  const end = Date.now() - offsetDays * 24 * 60 * 60 * 1000;
  const start = end - days * 24 * 60 * 60 * 1000;
  return timestamp >= start && timestamp < end;
}

function hasStorefrontConnection(model) {
  return Boolean(model?.protectionStatus?.themeAppEmbedActive);
}

function hasStorefrontTraffic(model) {
  return Boolean(
    model?.protectionStatus?.storefrontReportingActive ||
      model?.protectionStatus?.lastStorefrontDecisionAt,
  );
}

function getStorefrontReportingStatus(model) {
  if (model?.protectionStatus?.storefrontReportingActive) {
    return { label: "Receiving traffic", healthy: true };
  }
  if (model?.protectionStatus?.lastStorefrontDecisionAt) {
    return { label: "Previously reporting", healthy: false };
  }
  return { label: "Waiting for traffic", healthy: false };
}

function formatDelta(current, previous) {
  if (previous === 0) return current === 0 ? "No change" : "New activity";
  const change = Math.round(((current - previous) / previous) * 100);
  return `${change > 0 ? "+" : ""}${change}% from previous 7 days`;
}

function Screen({ title, subtitle, actions, children, maxWidth = "base" }) {
  return (
    <BotShieldNativePage heading={title}>
      <BotShieldPageShell
        className={maxWidth === "full" ? "botshield-page-content--wide" : ""}
      >
        <div className="botshield-page-heading">
          <div>
            <h1 className="botshield-page-title">{title}</h1>
            {subtitle ? (
              <p className="botshield-page-subtitle">{subtitle}</p>
            ) : null}
          </div>
          {actions}
        </div>
        <s-stack gap="large">{children}</s-stack>
      </BotShieldPageShell>
    </BotShieldNativePage>
  );
}

function Metric({ label, value, detail, status }) {
  const tone =
    status === "blocked" || status === "high"
      ? "critical"
      : status === "challenged" || status === "setup_required"
        ? "warning"
        : status === "real_storefront"
          ? "info"
          : status
            ? "success"
            : "neutral";
  return (
    <div className={`botshield-metric botshield-metric--${tone}`}>
      <s-stack gap="small">
        <s-text color="subdued">{label}</s-text>
        <div className="botshield-metric-value">{value}</div>
        <s-stack direction="inline" gap="small" alignItems="center">
          {status ? <BotShieldStatusBadge status={status} /> : null}
          <s-text color="subdued">{detail}</s-text>
        </s-stack>
      </s-stack>
    </div>
  );
}

function getExecutiveStatus(model) {
  const storefrontConnected = hasStorefrontConnection(model);
  const responseMode = getResponseMode(model);
  if (model.protectionPaused) {
    return {
      label: "Paused",
      status: "paused",
      detail:
        "BotShield is still recording visits, but automatic blocking is paused.",
    };
  }
  if (!storefrontConnected) {
    return {
      label: "Setup Required",
      status: "setup_required",
      detail:
        "Enable the theme app embed to start monitoring storefront visitors.",
    };
  }
  if (model.protectionReady && responseMode.label === "Auto Block") {
    return {
      label: "Protected",
      status: "active",
      detail:
        "BotShield is evaluating real storefront traffic and blocking high-risk visitors.",
    };
  }
  return {
    label: responseMode.label === "Auto Block" ? "Protected" : "Monitoring",
    status: responseMode.status,
    detail: responseMode.detail,
  };
}

function ProtectionStatusCard({ model, actions }) {
  const executiveStatus = getExecutiveStatus(model);
  const storefrontConnected = hasStorefrontConnection(model);
  const responseMode = getResponseMode(model);
  const profile = getProtectionProfile(model);

  return (
    <BotShieldCard
      title="Protection Status"
      subtitle="The current operating state of storefront protection."
      badge={<BotShieldStatusBadge status={executiveStatus.status} />}
      actions={
        <BotShieldActionButton
          variant="primary"
          onClick={
            storefrontConnected
              ? () => actions.setPage("detection")
              : actions.openThemeEditor
          }
        >
          {storefrontConnected ? "Manage protection" : "Connect storefront"}
        </BotShieldActionButton>
      }
    >
      <s-stack gap="large">
        <s-stack gap="small">
          <div className="botshield-status-value">{executiveStatus.label}</div>
          <s-paragraph color="subdued">{executiveStatus.detail}</s-paragraph>
        </s-stack>
        <s-grid
          gridTemplateColumns="repeat(auto-fit, minmax(140px, 1fr))"
          gap="base"
        >
          <s-stack gap="small-200">
            <s-text color="subdued">Response mode</s-text>
            <s-text type="strong">{responseMode.label}</s-text>
          </s-stack>
          <s-stack gap="small-200">
            <s-text color="subdued">Protection profile</s-text>
            <s-text type="strong">{profile}</s-text>
          </s-stack>
          <s-stack gap="small-200">
            <s-text color="subdued">Sensitivity</s-text>
            <s-text type="strong">
              {model.strictMode ? "Strict Mode" : model.blockLevel}
            </s-text>
          </s-stack>
          <s-stack gap="small-200">
            <s-text color="subdued">Last storefront event</s-text>
            <s-text type="strong">
              {formatDate(
                model.protectionStatus.lastStorefrontDecisionAt,
                "Waiting for traffic",
              )}
            </s-text>
          </s-stack>
        </s-grid>
      </s-stack>
    </BotShieldCard>
  );
}

function QuickActionsCard({ model, actions }) {
  const storefrontConnected = hasStorefrontConnection(model);
  return (
    <BotShieldCard
      title="Quick Actions"
      subtitle="The most common setup and review actions."
    >
      <s-stack gap="base">
        <BotShieldActionButton
          variant={!storefrontConnected ? "primary" : "secondary"}
          onClick={actions.openThemeEditor}
        >
          Open theme editor
        </BotShieldActionButton>
        <BotShieldActionButton onClick={() => actions.setPage("detection")}>
          Manage protection
        </BotShieldActionButton>
        <BotShieldActionButton onClick={() => actions.setPage("policy")}>
          Configure alerts
        </BotShieldActionButton>
        <BotShieldActionButton onClick={() => actions.setPage("analytics")}>
          View activity
        </BotShieldActionButton>
      </s-stack>
    </BotShieldCard>
  );
}

function OutcomeCard({ label, value, description, status }) {
  return (
    <div
      className={`botshield-outcome-card botshield-outcome-card--${status || "neutral"}`}
    >
      <s-stack gap="base">
        <s-stack direction="inline" gap="small" justifyContent="space-between">
          <div className="botshield-card-label">{label}</div>
          {status ? <BotShieldStatusBadge status={status} /> : null}
        </s-stack>
        <div className="botshield-outcome-value">{value}</div>
        <s-text color="subdued">{description}</s-text>
      </s-stack>
    </div>
  );
}

function HelpStrip({ model, actions }) {
  return (
    <BotShieldCard>
      <s-stack
        direction="inline"
        gap="base"
        alignItems="center"
        justifyContent="space-between"
      >
        <s-stack direction="inline" gap="base" alignItems="center">
          <span className="botshield-rule-icon">ⓘ</span>
          <s-text>
            Not sure which setup fits your store? Start with Balanced mode and
            adjust rules after reviewing real storefront activity.
          </s-text>
        </s-stack>
        <BotShieldActionButton onClick={() => runNextSetupAction(model, actions)}>
          Get help
        </BotShieldActionButton>
      </s-stack>
    </BotShieldCard>
  );
}

function ProtectionPolicySummary({ model, draft, setDraft, actions }) {
  const executiveStatus = getExecutiveStatus(model);
  const responseMode = getResponseMode({ ...model, ...draft });
  const selectedMode = draft.strictMode
    ? "Strict"
    : draft.blockLevel === "Low" && !draft.autoBlock
      ? "Relaxed"
      : draft.blockLevel === "High"
        ? "Strict"
        : "Balanced";

  return (
    <s-grid
      gridTemplateColumns="minmax(0, 1.25fr) minmax(280px, 0.75fr)"
      gap="large"
    >
      <BotShieldCard
        title="Current protection policy"
        subtitle="The active storefront response profile merchants rely on."
        badge={<BotShieldStatusBadge status={executiveStatus.status} />}
        actions={
          <BotShieldActionButton onClick={() => actions.setPage("analytics")}>
            View activity
          </BotShieldActionButton>
        }
        accent
      >
        <s-stack gap="large">
          <div className="botshield-status-value">{executiveStatus.label}</div>
          <s-paragraph color="subdued">{executiveStatus.detail}</s-paragraph>
          <s-grid
            gridTemplateColumns="repeat(auto-fit, minmax(145px, 1fr))"
            gap="base"
          >
            <s-stack gap="small-200">
              <s-text color="subdued">Protection profile</s-text>
              <s-text type="strong">{selectedMode}</s-text>
            </s-stack>
            <s-stack gap="small-200">
              <s-text color="subdued">Response mode</s-text>
              <s-text type="strong">{responseMode.label}</s-text>
            </s-stack>
            <s-stack gap="small-200">
              <s-text color="subdued">Sensitivity</s-text>
              <s-text type="strong">
                {draft.strictMode ? "Strict Mode" : draft.blockLevel}
              </s-text>
            </s-stack>
          </s-grid>
        </s-stack>
      </BotShieldCard>

      <BotShieldCard
        title="Recommended next step"
        subtitle="Keep setup simple while the store gathers real activity."
      >
        <s-stack gap="base">
          <StatusRow
            label="Start with Balanced"
            detail="Balanced blocks suspicious behavior while reducing false positives."
            status={selectedMode === "Balanced" ? "active" : "monitoring_only"}
            action={
              selectedMode !== "Balanced" ? (
                <BotShieldActionButton
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      blockLevel: "Medium",
                      strictMode: false,
                      autoBlock: true,
                    }))
                  }
                >
                  Apply Balanced
                </BotShieldActionButton>
              ) : null
            }
          />
          <StatusRow
            label="Review real events"
            detail="Use the activity page to recover false positives and tune rules."
            status="real_storefront"
            action={
              <BotShieldActionButton onClick={() => actions.setPage("analytics")}>
                Open activity
              </BotShieldActionButton>
            }
          />
        </s-stack>
      </BotShieldCard>
    </s-grid>
  );
}

function StoreHealthCard({ model, actions }) {
  const emailReady = model.emailProviderConfigured && model.emailAlerts;
  const billingReady = Boolean(model.billingStatus?.active);
  const storefrontConnected = hasStorefrontConnection(model);
  const responseMode = getResponseMode(model);
  const trafficConnected = Boolean(
    model.protectionStatus.lastStorefrontDecisionAt,
  );

  return (
    <BotShieldCard
      title="Store Health"
      subtitle="Finish setup so BotShield can protect your storefront."
      accent
    >
      <s-stack>
        <StatusRow
          label="Theme Embed"
          detail={
            storefrontConnected
              ? "BotShield has received real storefront traffic."
              : "Enable the theme app embed so BotShield can see storefront visits."
          }
          status={storefrontConnected ? "theme_embed_connected" : "theme_embed_missing"}
          action={
            !storefrontConnected ? (
              <BotShieldActionButton onClick={actions.openThemeEditor}>
                Enable
              </BotShieldActionButton>
            ) : null
          }
        />
        <StatusRow
          label="Email Alerts"
          detail={
            emailReady
              ? `Alerts are sent to ${model.alertEmail || "the configured recipient"}.`
              : "Configure alerts so high-risk incidents reach you."
          }
          status={emailReady ? "provider_connected" : "setup_required"}
          action={
            !emailReady ? (
              <BotShieldActionButton onClick={() => actions.setPage("policy")}>
                Configure
              </BotShieldActionButton>
            ) : null
          }
        />
        <StatusRow
          label="Billing"
          detail={
            billingReady
              ? model.billingStatus.subscription?.name ||
                "Shopify billing is active."
              : "Activate the Shopify subscription to finish setup."
          }
          status={billingReady ? "active" : "setup_required"}
          action={
            !billingReady ? (
              <BotShieldActionButton onClick={() => actions.setPage("settings")}>
                Review
              </BotShieldActionButton>
            ) : null
          }
        />
        <StatusRow
          label="Auto Block"
          detail={
            responseMode.label === "Auto Block"
              ? responseMode.detail
              : "BotShield is monitoring activity without automatic blocking."
          }
          status={responseMode.status}
          action={
            !model.autoBlock ? (
              <BotShieldActionButton
                onClick={() => actions.setPage("detection")}
              >
                Turn on
              </BotShieldActionButton>
            ) : null
          }
        />
        <StatusRow
          label="Storefront Traffic"
          detail={
            trafficConnected
              ? `Last storefront visit analyzed ${formatDate(model.protectionStatus.lastStorefrontDecisionAt)}.`
              : "Visit the storefront after setup to confirm BotShield receives traffic."
          }
          status={trafficConnected ? "real_storefront" : "setup_required"}
          action={
            !trafficConnected ? (
              <BotShieldActionButton onClick={actions.openThemeEditor}>
                View steps
              </BotShieldActionButton>
            ) : null
          }
        />
      </s-stack>
    </BotShieldCard>
  );
}

function getSetupChecklistItems(model, actions = {}) {
  const emailReady = Boolean(
    model.emailProviderConfigured &&
      model.emailAlerts &&
      EMAIL_PATTERN.test(model.alertEmail || ""),
  );
  const billingReady = Boolean(model.billingStatus?.active);
  const storefrontConnected = hasStorefrontConnection(model);
  const storefrontEventsReceived = Boolean(
    model.protectionStatus.lastStorefrontDecisionAt,
  );

  return [
    {
      label: "App installed",
      detail: model.protectionStatus.appInstalled
        ? "BotShield is installed and loading inside Shopify Admin."
        : "Shopify has not confirmed an active BotShield installation.",
      complete: Boolean(model.protectionStatus.appInstalled),
      action: null,
    },
    {
      label: "Theme embed enabled",
      detail: storefrontConnected
        ? "BotShield is enabled in the published theme."
        : "Enable the theme app embed to start recording storefront activity.",
      complete: storefrontConnected,
      action: actions.openThemeEditor,
      actionLabel: "Enable",
    },
    {
      label: "Storefront events received",
      detail: storefrontEventsReceived
        ? `Last event ${formatDate(model.protectionStatus.lastStorefrontDecisionAt)}.`
        : "Visit the storefront after enabling the embed.",
      complete: storefrontEventsReceived,
      action: storefrontConnected
        ? model.protectionStatus.shop
          ? () => {
              window.open(
                `https://${model.protectionStatus.shop}`,
                "_blank",
                "noopener,noreferrer",
              );
            }
          : null
        : actions.openThemeEditor,
      actionLabel: storefrontConnected ? "Open storefront" : "Enable",
    },
    {
      label: "Billing verified",
      detail: billingReady
        ? "Shopify billing is active or verified for testing."
        : "Review the Shopify subscription setup.",
      complete: billingReady,
      action: () => actions.setPage?.("settings"),
      actionLabel: "Review",
    },
    {
      label: "Email alerts configured",
      detail: emailReady
        ? `Alerts are configured for ${model.alertEmail || "the merchant"}.`
        : "Configure the alert recipient and email provider.",
      complete: emailReady,
      action: () => actions.setPage?.("policy"),
      actionLabel: "Configure",
    },
    {
      label: "Auto Block enabled",
      detail: model.autoBlock
        ? "High-risk storefront traffic can be stopped automatically."
        : "Turn on Auto Block when you are ready to enforce protection.",
      complete: model.autoBlock,
      action: () => actions.setPage?.("detection"),
      actionLabel: "Turn on",
    },
  ];
}

function runNextSetupAction(model, actions = {}) {
  const nextItem = getSetupChecklistItems(model, actions).find(
    (item) => !item.complete && item.action,
  );
  if (nextItem?.action) {
    nextItem.action();
    return;
  }
  actions.setPage?.("dashboard");
}

function SetupProgressCard({ model, actions }) {
  const items = getSetupChecklistItems(model, actions);
  const complete = items.filter((item) => item.complete).length;

  return (
    <BotShieldCard
      title="Setup Progress"
      subtitle={`${complete} of ${items.length} completed`}
    >
      <s-stack>
        {items.map((item) => (
          <div className="botshield-checklist-row" key={item.label}>
            <s-stack direction="inline" gap="base" alignItems="start">
              <span
                className={`botshield-check-icon${
                  item.complete ? " botshield-check-icon--complete" : ""
                }`}
              >
                {item.complete ? "Done" : "Next"}
              </span>
              <s-stack gap="small-200">
                <s-text type="strong">{item.label}</s-text>
                <s-text color="subdued">{item.detail}</s-text>
              </s-stack>
            </s-stack>
            <s-stack direction="inline" gap="small" alignItems="center">
              <BotShieldStatusBadge
                status={item.complete ? "active" : "setup_required"}
                label={item.complete ? "Ready" : "Action needed"}
              />
              {!item.complete && item.action ? (
                <BotShieldActionButton onClick={item.action}>
                  {item.actionLabel}
                </BotShieldActionButton>
              ) : null}
            </s-stack>
          </div>
        ))}
      </s-stack>
    </BotShieldCard>
  );
}

function GettingStartedCard({ model, actions }) {
  const emailReady = model.emailProviderConfigured && model.emailAlerts;
  const rulesReady = Boolean(model.autoBlock || model.strictMode);
  const storefrontConnected = hasStorefrontConnection(model);
  const steps = [
    {
      label: "Enable the storefront app embed",
      detail: storefrontConnected
        ? "BotShield has received real storefront traffic."
        : "Connect BotShield so storefront visits can be evaluated.",
      complete: storefrontConnected,
      actionLabel: "Enable app embed",
      action: actions.openThemeEditor,
    },
    {
      label: "Choose your protection rules",
      detail: rulesReady
        ? "Automated protection rules are configured."
        : "Pick a protection mode and decide whether BotShield should block automatically.",
      complete: rulesReady,
      actionLabel: "Review rules",
      action: () => actions.setPage("detection"),
    },
    {
      label: "Turn on merchant alerts",
      detail: emailReady
        ? `Security alerts are configured for ${model.alertEmail || "the merchant"}.`
        : "Add an alert email so blocked and high-risk events reach the merchant.",
      complete: emailReady,
      actionLabel: "Configure alerts",
      action: () => actions.setPage("policy"),
    },
  ];
  const complete = steps.filter((step) => step.complete).length;

  return (
    <BotShieldCard
      title="Get started in 3 steps"
      subtitle={`You've completed ${complete} of ${steps.length} steps`}
      actions={
        <BotShieldStatusBadge
          status={complete === steps.length ? "active" : "setup_required"}
          label={complete === steps.length ? "Complete" : "In progress"}
        />
      }
    >
      <s-stack gap="large">
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-text>{`You've done ${complete} of ${steps.length} steps`}</s-text>
          <s-box inlineSize="100%">
            <div className="botshield-progress-track">
              <div
                className="botshield-progress-fill"
                style={{
                  width: `${Math.round((complete / steps.length) * 100)}%`,
                }}
              />
            </div>
          </s-box>
        </s-stack>
        {steps.map((step) => (
          <div className="botshield-checklist-row" key={step.label}>
            <s-stack direction="inline" gap="base" alignItems="start">
              <span
                className={`botshield-check-icon${
                  step.complete ? " botshield-check-icon--complete" : ""
                }`}
              >
                {step.complete ? "Done" : "Next"}
              </span>
              <s-stack gap="small-200">
                <s-text type="strong">{step.label}</s-text>
                <s-text color="subdued">{step.detail}</s-text>
              </s-stack>
            </s-stack>
            {!step.complete ? (
              <BotShieldActionButton onClick={step.action}>
                {step.actionLabel}
              </BotShieldActionButton>
            ) : (
              <BotShieldStatusBadge status="active" label="Done" />
            )}
          </div>
        ))}
      </s-stack>
    </BotShieldCard>
  );
}

function RuleSummaryCard({
  title,
  status,
  description,
  action,
  count,
}) {
  const cleanIcon =
    title === "Bot Protection"
      ? "Bot"
      : title === "IP address blocklist"
        ? "IP"
        : title === "Trusted visitors"
          ? "Trust"
          : title === "Network / Proxy Protection"
            ? "Net"
            : title === "Rate Protection"
              ? "Rate"
              : title === "Page Protection"
                ? "Page"
                : "Rule";

  return (
    <div className="botshield-rule-card">
      <s-stack gap="large">
        <s-stack direction="inline" gap="base" justifyContent="space-between">
          <span className="botshield-rule-icon">{cleanIcon}</span>
          {count !== undefined ? (
            <span className="botshield-rule-count">{count}</span>
          ) : (
            <BotShieldStatusBadge status={status} />
          )}
        </s-stack>
        <s-stack gap="small">
          <s-heading>{title}</s-heading>
          <s-text color="subdued">{description}</s-text>
        </s-stack>
        {action ? <s-box paddingBlockStart="base">{action}</s-box> : null}
      </s-stack>
    </div>
  );
}


function ProtectionModeCard({ title, description, selected, onSelect }) {
  return (
    <button
      className={`botshield-mode-card${
        selected ? " botshield-mode-card--selected" : ""
      }`}
      type="button"
      onClick={onSelect}
    >
      <s-stack gap="small">
        <s-stack direction="inline" justifyContent="space-between" gap="base">
          <s-text type="strong">{title}</s-text>
          {selected ? (
            <BotShieldStatusBadge status="active" label="Selected" />
          ) : null}
        </s-stack>
        <s-text color="subdued">{description}</s-text>
      </s-stack>
    </button>
  );
}

function SupportChannelsCard() {
  const channels = [
    {
      title: "User guide",
      detail: "Setup steps, protection limits, and common troubleshooting.",
      icon: "▣",
      href: "/support",
    },
    {
      title: "Feature requests",
      detail: "Send ideas for rules, reporting, and merchant workflows.",
      icon: "↗",
      href: "mailto:support@botshieldapp.com?subject=BotShield%20feature%20request",
    },
    {
      title: "Privacy policy",
      detail: "Discover how visitor and storefront event data is handled.",
      icon: "▣",
      href: "/privacy",
    },
  ];

  return (
    <s-stack gap="large">
      <s-heading>Support Channels</s-heading>
      <BotShieldCard>
        <div className="botshield-support-grid">
          {channels.map((channel) => (
            <a
              className="botshield-support-card"
              href={channel.href}
              key={channel.title}
            >
              <s-stack gap="base" alignItems="center">
                <s-text>{channel.icon}</s-text>
                <s-text type="strong">{channel.title}</s-text>
                <s-text color="subdued">{channel.detail}</s-text>
              </s-stack>
            </a>
          ))}
        </div>
      </BotShieldCard>
      <BotShieldCard
        title="Need help?"
        subtitle="Get help with setup, incident review, or false positives. Email support@botshieldapp.com."
        actions={
          <s-stack direction="inline" gap="small">
            <BotShieldActionButton href="/support">
              Open support
            </BotShieldActionButton>
            <BotShieldActionButton href="mailto:support@botshieldapp.com">
              Send email
            </BotShieldActionButton>
          </s-stack>
        }
      />
    </s-stack>
  );
}

function InsightList({ items, emptyMessage }) {
  if (!items.length) {
    return <s-text color="subdued">{emptyMessage}</s-text>;
  }
  const highestCount = Math.max(...items.map((item) => item.count), 1);
  return (
    <s-stack>
      {items.map((item) => (
        <s-box key={item.label} paddingBlock="base" borderBlockEnd="base">
          <s-stack gap="small">
            <s-stack
              direction="inline"
              gap="base"
              justifyContent="space-between"
              alignItems="center"
            >
              <s-text type="strong">{item.label}</s-text>
              <s-text color="subdued">{item.count}</s-text>
            </s-stack>
            <s-box background="subdued" borderRadius="full" minBlockSize="4px">
              <s-box
                background="strong"
                borderRadius="full"
                minBlockSize="4px"
                inlineSize={`${Math.max(8, Math.round((item.count / highestCount) * 100))}%`}
              />
            </s-box>
          </s-stack>
        </s-box>
      ))}
    </s-stack>
  );
}

function StatusRow({ label, detail, status, action }) {
  return (
    <s-box paddingBlock="base" borderBlockEnd="base">
      <s-stack
        direction="inline"
        gap="base"
        justifyContent="space-between"
        alignItems="center"
      >
        <s-stack gap="small-200">
          <s-text type="strong">{label}</s-text>
          <s-text color="subdued">{detail}</s-text>
        </s-stack>
        <s-stack direction="inline" gap="small" alignItems="center">
          <BotShieldStatusBadge status={status} />
          {action}
        </s-stack>
      </s-stack>
    </s-box>
  );
}

function OverviewBadge({ children, muted = false }) {
  return (
    <span
      className={`botshield-overview-badge${
        muted ? " botshield-overview-badge--muted" : ""
      }`}
    >
      {children}
    </span>
  );
}

function buildOverviewThreatSeries(events, periodDays = 30) {
  const days = Array.from({ length: periodDays }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (periodDays - 1 - index));
    return {
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      allowed: 0,
      challenged: 0,
      blocked: 0,
    };
  });
  const byDay = new Map(days.map((day) => [day.key, day]));

  events.forEach((event) => {
    if (!event?.createdAt) return;
    const date = new Date(event.createdAt);
    if (Number.isNaN(date.getTime())) return;
    const day = byDay.get(date.toISOString().slice(0, 10));
    if (!day) return;
    if (event.actionTaken === "blocked") day.blocked += 1;
    else if (event.actionTaken === "challenged") day.challenged += 1;
    else day.allowed += 1;
  });
  return days;
}

const OVERVIEW_SIGNAL_GROUPS = [
  {
    label: "Automation / bot",
    codes: ["KNOWN_BOT_USER_AGENT", "SUSPICIOUS_USER_AGENT", "MISSING_USER_AGENT"],
  },
  {
    label: "Network / Proxy",
    codes: [
      "VPN_DETECTED",
      "DATACENTER_IP",
      "HOSTING_PROVIDER",
      "HIGH_RISK_NETWORK",
      "ASN_MATCH",
    ],
  },
  {
    label: "Rate abuse",
    codes: ["RATE_PATTERN", "REPEAT_OFFENDER"],
  },
  {
    label: "Suspicious paths",
    codes: ["SENSITIVE_PATH", "PATH_SCANNING"],
  },
];

function getOverviewReasonCodes(event) {
  const structured = Array.isArray(event?.reasonCodes) ? event.reasonCodes : [];
  const serialized = Array.isArray(event?.reasons)
    ? event.reasons.join(" ")
    : String(event?.reasons || "");
  const extracted = [...serialized.matchAll(/\[([A-Z0-9_]+)\]/g)].map(
    (match) => match[1],
  );
  return [...new Set([...structured, ...extracted].map((code) => String(code).toUpperCase()))];
}

function buildOverviewThreatComposition(events) {
  return OVERVIEW_SIGNAL_GROUPS.map((group) => ({
    label: group.label,
    count: events.filter((event) => {
      const codes = getOverviewReasonCodes(event);
      return group.codes.some((code) => codes.includes(code));
    }).length,
  }))
    .filter((group) => group.count > 0)
    .sort((left, right) => right.count - left.count);
}

function formatRelativeTime(value) {
  if (!value) return "No decisions recorded";
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "Time unavailable";
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (elapsedMinutes < 1) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  return `${Math.floor(elapsedHours / 24)}d ago`;
}

function formatCurrencyMinor(amountMinor, currencyCode) {
  if (!Number.isSafeInteger(Number(amountMinor)) || !currencyCode) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(Number(amountMinor) / 100);
  } catch {
    return null;
  }
}

function OverviewIcon({ name, centered = false }) {
  const icons = {
    activity: "chart-line",
    shield: "shield-check-mark",
    block: "disabled",
    verify: "shield-pending",
    network: "globe-lines",
    clock: "clock",
    rate: "gauge",
    page: "page",
    reporting: "connect",
    visitor: "person",
  };
  return (
    <span
      className="botshield-v2-icon"
      aria-hidden="true"
      style={centered ? { display: "grid", placeItems: "center" } : undefined}
    >
      <s-icon
        type={icons[name] || icons.shield}
        size="small"
        color="subdued"
        style={centered ? { display: "block", margin: "auto" } : undefined}
      />
    </span>
  );
}

function OverviewMetricCard({ label, value, detail, loading, icon }) {
  const numericValue = Number(value);
  const displayValue = Number.isFinite(numericValue)
    ? numericValue.toLocaleString()
    : "\u2014";
  return (
    <div className="botshield-v2-kpi-card" aria-busy={loading || undefined}>
      {loading ? (
        <div className="botshield-v2-skeleton" aria-label={`Loading ${label}`} />
      ) : (
        <>
          <div className="botshield-v2-kpi-topline">
            <div className="botshield-v2-kpi-label">{label}</div>
            <OverviewIcon name={icon} />
          </div>
          <div className="botshield-v2-kpi-value">{displayValue}</div>
          <div className="botshield-v2-kpi-detail">{detail}</div>
        </>
      )}
    </div>
  );
}

function OverviewPage({ model, actions }) {
  const toast = useBotShieldToast();
  const [threatPeriod, setThreatPeriod] = useState(30);
  const handleRefreshStoreHealth = async () => {
    const result = await actions.refreshStoreHealth?.();
    if (result?.skipped) return;
    if (result?.ok) {
      toast.success("Store health updated");
      return;
    }
  };
  const storefrontConnected = hasStorefrontConnection(model);
  const storefrontSensorActive = Boolean(model.protectionStatus?.themeAppEmbedActive);
  const storefrontReportingStatus = getStorefrontReportingStatus(model);
  const storefrontEvents = Number.isFinite(Number(model.incidentCounts?.total))
    ? Number(model.incidentCounts.total)
    : model.storefrontScans.length;
  const botsBlocked = Number.isFinite(Number(model.incidentCounts?.blocked))
    ? Number(model.incidentCounts.blocked)
    : model.blockedCount;
  const enforcementOn = Boolean(model.autoBlock && !model.protectionPaused);
  const runtimeActive = Boolean(model.protectionReady && !model.protectionPaused);
  const protectionRows = [
    {
      label: "Bot Protection",
      detail: "Detects automated browsers and bot-like behavior.",
      module: "bot",
      active: runtimeActive,
      status: runtimeActive
        ? enforcementOn
          ? "Enforcing"
          : "Monitoring"
        : model.protectionPaused
          ? "Paused"
          : "Needs setup",
      tone: runtimeActive ? (enforcementOn ? "success" : "info") : "warning",
      icon: "shield",
    },
    {
      label: "Network / Proxy Protection",
      detail: "Identifies VPN, proxy, and datacenter traffic.",
      module: "network",
      active: runtimeActive,
      status: runtimeActive
        ? "Monitoring"
        : model.protectionPaused
          ? "Paused"
          : "Needs setup",
      tone: runtimeActive ? "info" : "warning",
      icon: "network",
    },
    {
      label: "Rate Protection",
      detail: "Detects unusually frequent or repetitive visits.",
      module: "rate",
      active: runtimeActive,
      status: runtimeActive
        ? enforcementOn
          ? "Enforcing"
          : "Monitoring"
        : model.protectionPaused
          ? "Paused"
          : "Needs setup",
      tone: runtimeActive ? (enforcementOn ? "success" : "info") : "warning",
      icon: "rate",
    },
    {
      label: "Page Protection",
      detail: "Applies protection decisions through supported storefront requests.",
      module: "page",
      active: storefrontConnected && !model.protectionPaused,
      status: storefrontConnected
        ? model.protectionPaused
          ? "Paused"
          : "Connected"
        : "Needs setup",
      tone:
        storefrontConnected && !model.protectionPaused ? "success" : "warning",
      icon: "page",
    },
  ];
  const activeProtections = protectionRows.filter((row) => row.active).length;
  const storedThreatSeries = Array.isArray(model.overviewThreatActivity?.days)
    ? model.overviewThreatActivity.days.map((day) => ({
        key: day.date,
        label: new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        allowed: Number(day.allowed || 0),
        challenged: Number(day.challenged || 0),
        blocked: Number(day.blocked || 0),
      }))
    : [];
  const threatSeriesSource = storedThreatSeries.length
    ? storedThreatSeries
    : buildOverviewThreatSeries(model.storefrontScans || [], 90);
  const threatSeries = threatSeriesSource.slice(-threatPeriod);
  const activeThreatDays = threatSeries.filter(
    (day) => day.allowed || day.challenged || day.blocked,
  ).length;
  const recentStorefrontEvents = (model.storefrontScans || []).filter((event) =>
    inRecentDays(event.createdAt, 30),
  );
  const chartMaximum = Math.max(
    1,
    ...threatSeries.map((day) => day.allowed + day.challenged + day.blocked),
  );
  const hasThreatActivity = threatSeries.some(
    (day) => day.allowed || day.challenged || day.blocked,
  );
  const recentEvents = (model.storefrontScans || []).slice(0, 5);
  const suspiciousEvents = recentStorefrontEvents.filter(
    (event) =>
      ["medium", "high"].includes(String(event.threatLevel).toLowerCase()) ||
      ["blocked", "challenged"].includes(event.actionTaken),
  );
  const selectedPeriodEvents = (model.storefrontScans || []).filter((event) =>
    inRecentDays(event.createdAt, threatPeriod),
  );
  const selectedSuspiciousEvents = selectedPeriodEvents.filter(
    (event) =>
      ["medium", "high"].includes(String(event.threatLevel).toLowerCase()) ||
      ["blocked", "challenged"].includes(event.actionTaken),
  );
  const selectedThreatComposition = buildOverviewThreatComposition(
    selectedSuspiciousEvents,
  );
  const currentTopThreatSignal = selectedThreatComposition[0] || null;
  const selectedBlockedEvents = selectedPeriodEvents.filter(
    (event) => event.actionTaken === "blocked",
  ).length;
  const selectedChallengedEvents = selectedPeriodEvents.filter(
    (event) => event.actionTaken === "challenged",
  ).length;
  const lastSuspiciousEvent = selectedSuspiciousEvents.reduce(
    (latest, event) =>
      !latest || new Date(event.createdAt).getTime() > new Date(latest.createdAt).getTime()
        ? event
        : latest,
    null,
  );
  const automatedInterventions =
    Number(model.incidentCounts?.blocked || 0) +
    Number(model.incidentCounts?.challenged || 0);
  const threatComposition = buildOverviewThreatComposition(suspiciousEvents);
  const topThreatSignal = threatComposition[0] || null;
  const largestCompositionCount = Math.max(
    1,
    ...threatComposition.map((item) => item.count),
  );
  const securityImpact = [
    {
      label: "Automated interventions",
      value: automatedInterventions,
      detail: "Blocked or challenged storefront events",
    },
    {
      label: "High-risk events identified",
      value: Number(model.incidentCounts?.highRisk || 0),
      detail: "Recorded storefront events classified as high risk",
    },
  ];
  const activityError = model.backendErrors?.find((error) =>
    /activity|incident timeline/i.test(error),
  );
  const loading = Boolean(model.syncing && !model.storefrontScans?.length);
  const financialImpact = model.financialImpact || {};
  const protectedValue = formatCurrencyMinor(
    financialImpact.totalAmountMinor,
    financialImpact.currencyCode,
  );
  const hasFinancialImpact =
    financialImpact.status === "available" &&
    protectedValue &&
    Array.isArray(financialImpact.series) &&
    financialImpact.series.length > 0;
  const financialChartMaximum = hasFinancialImpact
    ? Math.max(...financialImpact.series.map((point) => Number(point.amountMinor) || 0), 1)
    : 1;
  const lastStorefrontDecisionAt = model.protectionStatus?.lastStorefrontDecisionAt;
  const protectionsNeedingAttention = protectionRows.filter((row) => !row.active).length;
  const protectionState = model.backendErrors?.length
      ? {
          label: "Degraded",
          title: "Protection data is degraded",
        tone: "critical",
        className: "botshield-v2-status--degraded",
        detail:
          "Some data could not be loaded. Protection may still be running, but this view needs attention.",
      }
    : model.protectionPaused || !storefrontConnected || !model.protectionReady
        ? {
            label: "Attention needed",
            title: "Protection needs attention",
          tone: "warning",
          className: "botshield-v2-status--attention",
          detail: model.protectionPaused
            ? "Protection is paused. Resume enforcement to restore full storefront protection."
            : !storefrontConnected
              ? "Enable the theme app embed to begin receiving and enforcing live storefront decisions."
              : protectionsNeedingAttention
                ? `${protectionsNeedingAttention} protection module${protectionsNeedingAttention === 1 ? "" : "s"} require setup before full storefront coverage is available.`
                : "Complete the remaining setup to restore full storefront coverage.",
        }
        : {
            label: "Active",
            title: "Protection is active",
          tone: "success",
          className: "botshield-v2-status--active",
          detail:
            "BotShield is connected and evaluating storefront activity using your protection settings.",
        };
  const metrics = [
    { label: "Storefront events", value: storefrontEvents, detail: "Last 30 days", icon: "activity" },
    { label: "Blocked events", value: botsBlocked, detail: "Blocked storefront decisions", icon: "block" },
    {
      label: "Challenged events",
      value: Number.isFinite(Number(model.incidentCounts?.challenged))
        ? Number(model.incidentCounts.challenged)
        : model.challengedCount,
      detail: "Verification requested on storefront decisions",
      icon: "verify",
    },
    {
      label: "Active protections",
      value: activeProtections,
      detail: `of ${protectionRows.length} available`,
      icon: "shield",
    },
  ];

  return (
    <BotShieldNativePage heading="Overview">
      <BotShieldPageShell className="botshield-overview-content botshield-overview-v2">
        <s-stack gap="large">
          <section
            className={`botshield-v2-status ${protectionState.className}`}
            aria-labelledby="botshield-protection-status-title"
          >
            <div className="botshield-v2-status-copy">
              <div className="botshield-v2-eyebrow">Protection status</div>
              <div className="botshield-v2-status-heading-row">
                <span className="botshield-v2-status-indicator" aria-hidden="true" />
                <h2 id="botshield-protection-status-title">{protectionState.title}</h2>
                <BotShieldStatusBadge
                  status={protectionState.tone}
                  label={protectionState.label}
                  tone={protectionState.tone}
                />
              </div>
              <p>{protectionState.detail}</p>
            </div>
            <div className="botshield-v2-status-actions">
              <BotShieldActionButton
                variant="primary"
                onClick={() => actions.setPage("detection")}
              >
                Manage protection
              </BotShieldActionButton>
              <BotShieldActionButton onClick={() => actions.setPage("analytics")}>
                View activity
              </BotShieldActionButton>
            </div>
          </section>

          <section className="botshield-v2-kpi-grid" aria-label="Protection metrics">
            {metrics.map((metric) => (
              <OverviewMetricCard key={metric.label} {...metric} loading={loading} />
            ))}
          </section>

          <section className="botshield-v2-health" aria-labelledby="store-health-title">
            <div className="botshield-v2-section-heading botshield-v2-health-heading">
              <div>
                <div className="botshield-v2-eyebrow">Connection status</div>
                <h2 id="store-health-title">Store health</h2>
              </div>
              <BotShieldActionButton
                disabled={model.storeHealthRefreshing}
                loading={model.storeHealthRefreshing}
                variant="tertiary"
                onClick={() => {
                  if (storefrontSensorActive) {
                    void handleRefreshStoreHealth();
                    return;
                  }
                  actions.openThemeEditor?.();
                }}
              >
                {storefrontSensorActive ? "Refresh status" : "Verify connection"}
              </BotShieldActionButton>
            </div>
            {model.storeHealthRefreshError ? (
              <BotShieldBanner tone="critical" title="Couldn't refresh store health">
                {model.storeHealthRefreshError}
              </BotShieldBanner>
            ) : null}
            <div className="botshield-v2-health-grid">
              <div className="botshield-v2-health-item">
                <OverviewIcon name="reporting" />
                <span>Storefront reporting</span>
                <strong><i className={`botshield-v2-health-dot ${storefrontReportingStatus.healthy ? "is-healthy" : "is-attention"}`} />{storefrontReportingStatus.label}</strong>
              </div>
              <div className="botshield-v2-health-item">
                <OverviewIcon name="page" />
                <span>Theme app embed</span>
                <strong><i className={`botshield-v2-health-dot ${storefrontSensorActive ? "is-healthy" : "is-attention"}`} />{storefrontSensorActive ? "Active" : "Needs setup"}</strong>
              </div>
              <div className="botshield-v2-health-item">
                <OverviewIcon name="clock" />
                <span>Last decision</span>
                <strong><i className={`botshield-v2-health-dot ${lastStorefrontDecisionAt ? "is-info" : "is-muted"}`} />{formatRelativeTime(lastStorefrontDecisionAt)}</strong>
              </div>
              <div className="botshield-v2-health-item">
                <OverviewIcon name="shield" />
                <span>Protection coverage</span>
                <strong><i className={`botshield-v2-health-dot ${activeProtections === protectionRows.length ? "is-healthy" : "is-attention"}`} />{activeProtections} / {protectionRows.length} active</strong>
              </div>
            </div>
          </section>

          <section className="botshield-v2-impact" aria-labelledby="security-impact-title">
            <div className="botshield-v2-impact-heading">
              <div className="botshield-v2-eyebrow">Protection outcomes {"\u00B7"} Last 30 days</div>
              <h2 id="security-impact-title">Security impact</h2>
              <p>Recorded protection outcomes from the last 30 days.</p>
            </div>
            <div className="botshield-v2-impact-metrics">
              {securityImpact.map((item, index) => (
                <div
                  className="botshield-v2-impact-metric"
                  key={item.label}
                  style={{ alignItems: "center" }}
                >
                  <OverviewIcon
                    name={index === 0 ? "shield" : "activity"}
                    centered
                  />
                  <div>
                    <strong>{item.value.toLocaleString()}</strong>
                    <span>{item.label}</span>
                    <small>{item.detail}</small>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="botshield-v2-value" aria-labelledby="estimated-value-title">
            <div className="botshield-v2-value-header">
              <div>
                <div className="botshield-v2-eyebrow">Financial impact {"\u00B7"} Last {financialImpact.periodDays || 30} days</div>
                <h2 id="estimated-value-title">Estimated value protected</h2>
                <p>Order value linked to qualifying protection outcomes BotShield can document.</p>
              </div>
              <details className="botshield-v2-methodology">
                <summary>How this is calculated</summary>
                <p>{financialImpact.methodology || "BotShield includes only verified Shopify order value linked to a documented qualifying protection outcome. Traffic, blocks, challenges, IP addresses, and risk scores are never assigned a monetary value."}</p>
              </details>
            </div>
            {hasFinancialImpact ? (
              <div className="botshield-v2-value-content">
                <div className="botshield-v2-value-total">
                  <strong>{protectedValue}</strong>
                  <span>{Number(financialImpact.qualifyingOrderCount || 0).toLocaleString()} verified order outcome{Number(financialImpact.qualifyingOrderCount) === 1 ? "" : "s"}</span>
                </div>
                <div className="botshield-v2-value-chart" role="img" aria-label={`Estimated value protected over the last ${financialImpact.periodDays || 30} days`}>
                  {financialImpact.series.map((point) => (
                    <span
                      key={point.date}
                      style={{ height: `${Math.max(4, (Number(point.amountMinor) / financialChartMaximum) * 100)}%` }}
                      title={`${point.date}: ${formatCurrencyMinor(point.amountMinor, financialImpact.currencyCode)}`}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="botshield-v2-value-empty">
                <OverviewIcon name="shield" />
                <strong aria-label="Value unavailable">{"\u2014"}</strong>
                <div>
                  <h3>No verified financial impact data yet</h3>
                  <p>BotShield doesn't estimate value from traffic, blocks, challenges, or risk scores.</p>
                </div>
              </div>
            )}
          </section>

          <div className="botshield-v2-workspace botshield-v2-primary-grid">
            <section className="botshield-v2-section botshield-v2-threat-panel">
              <div className="botshield-v2-panel-header">
                <div>
                  <h2>Threat activity</h2>
                  <p>Real storefront decisions recorded during the selected period.</p>
                </div>
                <div className="botshield-v2-chart-controls">
                  <div className="botshield-v2-period-selector" aria-label="Threat activity period">
                    {[7, 30, 90].map((period) => (
                      <button
                        type="button"
                        key={period}
                        className={threatPeriod === period ? "is-active" : ""}
                        aria-pressed={threatPeriod === period}
                        onClick={() => setThreatPeriod(period)}
                      >
                        {period}D
                      </button>
                    ))}
                  </div>
                  <div className="botshield-v2-legend" aria-label="Chart legend">
                    <span><i className="is-allowed" />Allowed</span>
                    <span><i className="is-challenged" />Challenged</span>
                    <span><i className="is-blocked" />Blocked</span>
                  </div>
                </div>
              </div>
              {loading ? (
                <div className="botshield-v2-chart-skeleton botshield-v2-skeleton" />
              ) : activityError ? (
                <div className="botshield-v2-chart-error">
                  <BotShieldBanner
                    tone="critical"
                    title="Threat activity could not be loaded"
                  >
                    Try refreshing to load recorded storefront decisions again.
                  </BotShieldBanner>
                  <BotShieldActionButton
                    disabled={model.storeHealthRefreshing}
                    loading={model.storeHealthRefreshing}
                    onClick={() => {
                      void handleRefreshStoreHealth();
                    }}
                  >
                    Refresh data
                  </BotShieldActionButton>
                </div>
              ) : hasThreatActivity ? (
                <div
                  className="botshield-v2-chart"
                  role="region"
                  aria-label={`${threatPeriod}-day threat activity chart. ${activeThreatDays} days contain recorded decisions.`}
                  data-density={activeThreatDays <= 3 ? "sparse" : activeThreatDays <= 12 ? "medium" : "dense"}
                >
                  <div className="botshield-v2-chart-scale" aria-hidden="true">
                    <span>{chartMaximum.toLocaleString()}</span>
                    <span>{Math.round(chartMaximum / 2).toLocaleString()}</span>
                    <span>0</span>
                  </div>
                  <div className="botshield-v2-chart-bars">
                    {threatSeries.map((day) => {
                      const total = day.allowed + day.challenged + day.blocked;
                      return (
                        <button
                          type="button"
                          className={`botshield-v2-chart-column${total ? " is-active-day" : " is-empty-day"}`}
                          key={day.key}
                          aria-label={`${day.label}: ${day.allowed} allowed, ${day.challenged} challenged, ${day.blocked} blocked, ${total} total decisions`}
                        >
                          <div
                            className="botshield-v2-chart-bar"
                            style={{
                              height: `${Math.max(total ? 6 : 0, (total / chartMaximum) * 100)}%`,
                            }}
                          >
                            <span className="is-blocked" style={{ flex: day.blocked }} />
                            <span className="is-challenged" style={{ flex: day.challenged }} />
                            <span className="is-allowed" style={{ flex: day.allowed }} />
                          </div>
                          <div className="botshield-v2-chart-tooltip" role="tooltip">
                            <strong>{day.label}</strong>
                            <span><i className="is-allowed" />Allowed <b>{day.allowed}</b></span>
                            <span><i className="is-challenged" />Challenged <b>{day.challenged}</b></span>
                            <span><i className="is-blocked" />Blocked <b>{day.blocked}</b></span>
                            <span className="botshield-v2-tooltip-total">Total decisions <b>{total}</b></span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="botshield-v2-chart-axis">
                    <span>{threatSeries[0]?.label}</span>
                    <span>{threatSeries[Math.floor((threatSeries.length - 1) / 2)]?.label}</span>
                    <span>{threatSeries[threatSeries.length - 1]?.label}</span>
                  </div>
                </div>
              ) : (
                <div className="botshield-v2-monitoring-empty">
                  <OverviewIcon name="activity" />
                  <h3>Monitoring storefront activity</h3>
                  <p>Allowed, challenged, and blocked decisions will appear as BotShield records real storefront traffic.</p>
                  <BotShieldActionButton onClick={actions.openThemeEditor}>
                    Verify connection
                  </BotShieldActionButton>
                  {lastStorefrontDecisionAt ? (
                    <small>Last decision received {formatRelativeTime(lastStorefrontDecisionAt)}</small>
                  ) : null}
                </div>
              )}

              <div className="botshield-v2-composition">
                <div className="botshield-v2-composition-heading">
                  <div>
                    <h3>Threat composition</h3>
                    <p>
                      Share of suspicious events by threat signal. Events can include multiple signals.
                    </p>
                  </div>
                  <BotShieldActionButton
                    variant="tertiary"
                    onClick={() => actions.setPage("analytics")}
                  >
                    View in Analytics
                  </BotShieldActionButton>
                </div>
                {threatComposition.length ? (
                  <div className="botshield-v2-composition-list">
                    {topThreatSignal ? (
                      <div className="botshield-v2-top-signal">
                        <span>Top threat signal</span>
                        <strong>{topThreatSignal.label}</strong>
                        <small>{topThreatSignal.count.toLocaleString()} event{topThreatSignal.count === 1 ? "" : "s"} this period</small>
                      </div>
                    ) : null}
                    {threatComposition.map((item) => (
                      <div className="botshield-v2-composition-row" key={item.label}>
                        <span>{item.label}</span>
                        <div className="botshield-v2-composition-track">
                          <i
                            style={{ width: `${(item.count / largestCompositionCount) * 100}%` }}
                          />
                        </div>
                        <strong>{item.count.toLocaleString()}</strong>
                        <small
                          title="Percentage of suspicious events containing this signal. Categories can overlap."
                          aria-label={`${suspiciousEvents.length ? Math.round((item.count / suspiciousEvents.length) * 100) : 0}% of suspicious events contained this signal; categories can overlap`}
                        >
                          {suspiciousEvents.length ? Math.round((item.count / suspiciousEvents.length) * 100) : 0}%
                        </small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="botshield-v2-composition-empty">
                    <OverviewIcon name="activity" />
                    <p>No categorized suspicious signals have been recorded for this period.</p>
                  </div>
                )}
              </div>
            </section>

            <section className="botshield-v2-section botshield-v2-protection-panel">
              <div className="botshield-v2-panel-header">
                <div>
                  <h2>Protection health</h2>
                  <p>Live status by protection module.</p>
                </div>
              </div>
              <div className="botshield-v2-protection-list">
                {protectionRows.map((row) => (
                  <div className="botshield-v2-protection-row" key={row.label}>
                    <OverviewIcon name={row.icon} centered />
                    <div className="botshield-v2-protection-copy">
                      <strong>{row.label}</strong>
                      <span>{row.detail}</span>
                    </div>
                    <div className="botshield-v2-protection-action">
                      <BotShieldStatusBadge
                        status={row.active ? "active" : "setup_required"}
                        label={row.status}
                        tone={row.tone}
                      />
                      <BotShieldActionButton
                        variant="tertiary"
                        onClick={() => actions.openProtectionModule?.(row.module)}
                      >
                        Configure
                      </BotShieldActionButton>
                    </div>
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: "14px",
                  paddingTop: "14px",
                  borderTop: "1px solid #e1e3e5",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: "13px", lineHeight: 1.35 }}>
                    Current threat summary
                  </h3>
                  <BotShieldActionButton
                    variant="tertiary"
                    onClick={() => actions.setPage("analytics")}
                  >
                    View in Analytics {"\u2192"}
                  </BotShieldActionButton>
                </div>
                {selectedSuspiciousEvents.length ? (
                  <>
                    <div style={{ marginTop: "10px" }}>
                      <span style={{ display: "block", color: "#6d7175", fontSize: "10px" }}>
                        Top threat signal
                      </span>
                      <strong style={{ display: "block", marginTop: "2px", fontSize: "12px" }}>
                        {currentTopThreatSignal?.label || "Uncategorized suspicious activity"}
                      </strong>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                        gap: "10px",
                        marginTop: "12px",
                      }}
                    >
                      {[
                        ["Suspicious events", selectedSuspiciousEvents.length],
                        ["Blocked", selectedBlockedEvents],
                        ["Challenged", selectedChallengedEvents],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <strong style={{ display: "block", fontSize: "15px" }}>
                            {Number(value).toLocaleString()}
                          </strong>
                          <span style={{ color: "#6d7175", fontSize: "10px" }}>{label}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: "12px", color: "#6d7175", fontSize: "10px" }}>
                      Last suspicious event{" "}
                      <strong style={{ color: "#202223", fontSize: "11px" }}>
                        {formatRelativeTime(lastSuspiciousEvent?.createdAt)}
                      </strong>
                    </div>
                  </>
                ) : (
                  <div style={{ marginTop: "10px" }}>
                    <strong style={{ display: "block", fontSize: "12px" }}>
                      No elevated threats detected
                    </strong>
                    <p style={{ margin: "4px 0 0", color: "#6d7175", fontSize: "11px", lineHeight: 1.45 }}>
                      No suspicious storefront activity was recorded in this period.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="botshield-v2-workspace botshield-v2-secondary-grid">
            <section className="botshield-v2-section">
              <div className="botshield-v2-panel-header">
                <div>
                  <h2>Recent security activity</h2>
                   <p>Latest storefront protection decisions.</p>
                </div>
                <BotShieldActionButton
                  variant="tertiary"
                  onClick={() => actions.setPage("analytics")}
                >
                  View all
                </BotShieldActionButton>
              </div>
              {loading ? (
                <div className="botshield-v2-activity-loading">
                  <div className="botshield-v2-skeleton" />
                  <div className="botshield-v2-skeleton" />
                  <div className="botshield-v2-skeleton" />
                </div>
              ) : recentEvents.length ? (
                <div className="botshield-v2-activity-list">
                  <div className="botshield-v2-activity-header" aria-hidden="true">
                    <span>Time</span>
                    <span>Risk</span>
                    <span>Detection reason</span>
                    <span>Decision</span>
                    <span />
                  </div>
                  {recentEvents.map((event) => (
                    <div
                      className="botshield-v2-activity-row"
                      key={event.id || `${event.createdAt}-${event.ipAddress}`}
                    >
                      <time dateTime={event.createdAt}>{formatDate(event.createdAt)}</time>
                      <div className="botshield-v2-activity-risk">
                        <BotShieldStatusBadge
                          status={event.threatLevel}
                          label={getRiskLabel(event.threatLevel)}
                        />
                      </div>
                      <div className="botshield-v2-activity-event">
                        <span title={formatMerchantReasons(event.reasonCodes || event.reasons)}>{formatMerchantReasons(event.reasonCodes || event.reasons)}</span>
                      </div>
                      <BotShieldStatusBadge
                        status={event.actionTaken}
                        label={getOutcomeLabel(event.actionTaken)}
                      />
                      <BotShieldActionButton
                        variant="tertiary"
                        onClick={() => actions.setPage("analytics")}
                      >
                        View details
                      </BotShieldActionButton>
                    </div>
                  ))}
                </div>
              ) : (
                <BotShieldEmptyState
                  title="No recent security activity"
                  description="Storefront decisions will appear here when BotShield records storefront activity."
                />
              )}
            </section>

            <section className="botshield-v2-section botshield-v2-quick-actions">
              <div className="botshield-v2-panel-header">
                <div>
                  <h2>Quick response</h2>
                  <p>Take immediate action or review your protection policy.</p>
                </div>
              </div>
              <div className="botshield-v2-quick-action-list">
                <div className="botshield-v2-quick-action-row">
                  <OverviewIcon name="block" centered />
                  <div><strong>Block an IP</strong><span>Block a known IP address from the storefront.</span></div>
                  <BotShieldActionButton onClick={actions.openBlocklist}>
                    Block an IP
                  </BotShieldActionButton>
                </div>
                <div className="botshield-v2-quick-action-row">
                  <OverviewIcon name="visitor" centered />
                  <div><strong>Trust a visitor</strong><span>Allow a trusted visitor to bypass automated checks.</span></div>
                  <BotShieldActionButton onClick={actions.openTrustedVisitors}>
                    Trust a visitor
                  </BotShieldActionButton>
                </div>
                <div className="botshield-v2-quick-action-row botshield-v2-quick-action-row--primary">
                  <OverviewIcon name="shield" centered />
                   <div><strong>Review protection</strong><span>Review active modules and enforcement settings.</span></div>
                  <BotShieldActionButton
                    variant="primary"
                    onClick={() => actions.setPage("detection")}
                  >
                    Review protection
                  </BotShieldActionButton>
                </div>
              </div>
            </section>
          </div>
        </s-stack>
      </BotShieldPageShell>
    </BotShieldNativePage>
  );
}

const ANALYTICS_PERIODS = [
  { label: "24H", days: 1 },
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

function getAnalyticsSignals(event) {
  const codes = getOverviewReasonCodes(event);
  return OVERVIEW_SIGNAL_GROUPS.filter((group) =>
    group.codes.some((code) => codes.includes(code)),
  ).map((group) => group.label);
}

function isSuspiciousAnalyticsEvent(event) {
  return (
    ["medium", "high"].includes(String(event.threatLevel).toLowerCase()) ||
    ["blocked", "challenged"].includes(event.actionTaken) ||
    getAnalyticsSignals(event).length > 0
  );
}

function analyticsPercent(value, total) {
  return total ? Math.round((value / total) * 100) : 0;
}

function AnalyticsBar({ value, maximum, tone = "neutral" }) {
  return (
    <span className="botshield-analytics-bar-track" aria-hidden="true">
      <span
        className={`botshield-analytics-bar-fill is-${tone}`}
        style={{ width: `${value > 0 && maximum ? Math.max(3, (value / maximum) * 100) : 0}%` }}
      />
    </span>
  );
}

function AnalyticsPage({ model, actions }) {
  const [periodDays, setPeriodDays] = useState(30);
  const [decisionFilter, setDecisionFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [signalFilter, setSignalFilter] = useState("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const pageSize = 25;
  const periodStart = Date.now() - periodDays * 24 * 60 * 60 * 1000;
  const periodEvents = (model.storefrontScans || []).filter((event) => {
    const timestamp = new Date(event.createdAt).getTime();
    return Number.isFinite(timestamp) && timestamp >= periodStart;
  });
  const availableSignals = [...new Set(periodEvents.flatMap(getAnalyticsSignals))];
  const filteredEvents = periodEvents.filter((event) => {
    const action = ["whitelisted"].includes(event.actionTaken)
      ? "allowed"
      : event.actionTaken;
    if (decisionFilter !== "all" && action !== decisionFilter) return false;
    if (riskFilter !== "all" && event.threatLevel !== riskFilter) return false;
    const signals = getAnalyticsSignals(event);
    if (signalFilter !== "all" && !signals.includes(signalFilter)) return false;
    const query = searchFilter.trim().toLowerCase();
    if (!query) return true;
    return [
      event.pathVisited,
      event.networkCountry,
      event.networkCity,
      event.networkOrg,
      event.networkProvider,
      formatMerchantReasons(event.reasonCodes || event.reasons),
      ...signals,
    ].some((value) => String(value || "").toLowerCase().includes(query));
  });
  const suspiciousEvents = filteredEvents.filter(isSuspiciousAnalyticsEvent);
  const interventionCount = suspiciousEvents.filter((event) =>
    ["blocked", "challenged"].includes(event.actionTaken),
  ).length;
  const highRiskCount = filteredEvents.filter(
    (event) => event.threatLevel === "high",
  ).length;
  const signalRows = availableSignals
    .map((label) => {
      const events = suspiciousEvents.filter((event) =>
        getAnalyticsSignals(event).includes(label),
      );
      return {
        label,
        events,
        count: events.length,
        blocked: events.filter((event) => event.actionTaken === "blocked").length,
        challenged: events.filter((event) => event.actionTaken === "challenged").length,
        allowed: events.filter((event) =>
          ["allowed", "whitelisted"].includes(event.actionTaken),
        ).length,
      };
    })
    .filter((row) => row.count > 0)
    .sort((left, right) => right.count - left.count);
  const topSignal = signalRows[0] || null;
  const signalMaximum = Math.max(1, ...signalRows.map((row) => row.count));
  const riskRows = ["high", "medium", "low"].map((risk) => ({
    risk,
    count: filteredEvents.filter((event) => event.threatLevel === risk).length,
  }));
  const riskMaximum = Math.max(1, ...riskRows.map((row) => row.count));
  const pathRows = [...new Set(suspiciousEvents.map((event) => event.pathVisited || "/"))]
    .map((path) => {
      const events = suspiciousEvents.filter(
        (event) => (event.pathVisited || "/") === path,
      );
      return {
        label: path,
        count: events.length,
        blocked: events.filter((event) => event.actionTaken === "blocked").length,
        challenged: events.filter((event) => event.actionTaken === "challenged").length,
      };
    })
    .sort((left, right) => right.count - left.count)
    .slice(0, 6);
  const attackOriginRows = [...new Set(suspiciousEvents.map(getAnalyticsAttackOrigin).filter(Boolean))]
    .map((origin) => {
      const events = suspiciousEvents.filter(
        (event) => getAnalyticsAttackOrigin(event) === origin,
      );
      return {
        label: origin,
        count: events.length,
        blocked: events.filter((event) => event.actionTaken === "blocked").length,
        challenged: events.filter((event) => event.actionTaken === "challenged").length,
      };
    })
    .sort((left, right) => right.count - left.count)
    .slice(0, 6);
  const visitorRows = [...new Set(suspiciousEvents.map((event) => event.ipAddress).filter(Boolean))]
    .map((ipAddress) => {
      const events = suspiciousEvents.filter((event) => event.ipAddress === ipAddress);
      const primarySignals = getAnalyticsSignals(events[0] || {});
      return {
        ipAddress,
        masked: maskAnalyticsVisitor(ipAddress),
        count: events.length,
        signal: primarySignals[0] || "Other signal",
        risk: events.some((event) => event.threatLevel === "high") ? "high" : "medium",
        outcome: events.some((event) => event.actionTaken === "blocked")
          ? "Blocked"
          : events.some((event) => event.actionTaken === "challenged")
            ? "Challenged"
            : "Allowed",
        lastSeen: events[0]?.createdAt,
      };
    })
    .sort((left, right) => right.count - left.count)
    .slice(0, 6);
  const combinations = new Map();
  suspiciousEvents.forEach((event) => {
    const signals = getAnalyticsSignals(event).sort();
    if (signals.length < 2) return;
    const key = signals.join(" + ");
    const current = combinations.get(key) || { label: key, count: 0, interventions: 0 };
    current.count += 1;
    if (["blocked", "challenged"].includes(event.actionTaken)) current.interventions += 1;
    combinations.set(key, current);
  });
  const combinationRows = [...combinations.values()]
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);
  const bucketCount = periodDays === 1 ? 24 : Math.min(periodDays, 30);
  const bucketDuration = (periodDays * 24 * 60 * 60 * 1000) / bucketCount;
  const activityBuckets = Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = new Date(Date.now() - (bucketCount - index) * bucketDuration);
    const bucketEnd = new Date(bucketStart.getTime() + bucketDuration);
    const events = suspiciousEvents.filter((event) => {
      const age = Date.now() - new Date(event.createdAt).getTime();
      return age >= (bucketCount - index - 1) * bucketDuration && age < (bucketCount - index) * bucketDuration;
    });
    return {
      index,
      count: events.length,
      blocked: events.filter((event) => event.actionTaken === "blocked").length,
      challenged: events.filter((event) => event.actionTaken === "challenged").length,
      label: formatAnalyticsBucketLabel(bucketStart, bucketEnd, periodDays),
    };
  });
  const activityMaximum = Math.max(1, ...activityBuckets.map((bucket) => bucket.count));
  const activeActivityBuckets = activityBuckets.filter((bucket) => bucket.count > 0);
  const peakActivityBucket = activeActivityBuckets.reduce(
    (peak, bucket) => (!peak || bucket.count > peak.count ? bucket : peak),
    null,
  );
  const peakBucketStart = peakActivityBucket
    ? new Date(Date.now() - (bucketCount - peakActivityBucket.index) * bucketDuration)
    : null;
  const peakBucketEnd = peakActivityBucket
    ? new Date(peakBucketStart.getTime() + bucketDuration)
    : null;
  const peakActivityLabel = peakBucketStart && peakBucketEnd
    ? periodDays === 1
      ? `${peakBucketStart.toLocaleTimeString([], { hour: "numeric" })}–${peakBucketEnd.toLocaleTimeString([], { hour: "numeric" })}`
      : peakBucketStart.toLocaleDateString([], { month: "short", day: "numeric" })
    : "—";
  const lastSuspiciousEvent = suspiciousEvents
    .slice()
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))[0];
  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / pageSize));
  const visiblePage = Math.min(page, totalPages);
  const paginatedEvents = filteredEvents.slice(
    (visiblePage - 1) * pageSize,
    visiblePage * pageSize,
  );
  const filtersActive = [decisionFilter, riskFilter, signalFilter].some(
    (value) => value !== "all",
  ) || searchFilter.trim();
  const insight = topSignal && suspiciousEvents.length
    ? `${topSignal.label} was the leading threat signal this period, appearing in ${analyticsPercent(topSignal.count, suspiciousEvents.length)}% of suspicious events.`
    : "Not enough activity to identify a pattern yet.";
  const insightTitle = topSignal && suspiciousEvents.length
    ? `${topSignal.label} dominated suspicious activity`
    : "Not enough activity for a pattern yet";
  const insightDetail = topSignal && suspiciousEvents.length
    ? `This signal appeared in ${analyticsPercent(topSignal.count, suspiciousEvents.length)}% of suspicious events during the selected period.`
    : insight;

  function clearFilters() {
    setDecisionFilter("all");
    setRiskFilter("all");
    setSignalFilter("all");
    setSearchFilter("");
    setPage(1);
  }

  return (
    <BotShieldNativePage heading="Analytics">
      <BotShieldPageShell className="botshield-analytics-content botshield-analytics-v2">
        {model.analyticsRefreshError ? (
          <BotShieldBanner tone="critical" title="Couldn't refresh analytics">
            {model.analyticsRefreshError}
          </BotShieldBanner>
        ) : null}

        {model.syncing && !model.storefrontScans?.length ? (
          <BotShieldLoadingState label="Loading analytics" />
        ) : (
          <>
        <section className="botshield-analytics-controls" aria-label="Analytics controls">
          <div className="botshield-analytics-period" aria-label="Date range">
            {ANALYTICS_PERIODS.map((period) => (
              <button
                aria-pressed={periodDays === period.days}
                className={periodDays === period.days ? "is-active" : ""}
                key={period.label}
                onClick={() => { setPeriodDays(period.days); setPage(1); }}
                type="button"
              >
                {period.label}
              </button>
            ))}
          </div>
          <div className="botshield-analytics-filter-row">
            <label htmlFor="analytics-decision-filter">Decision<select id="analytics-decision-filter" value={decisionFilter} onChange={(event) => { setDecisionFilter(event.target.value); setPage(1); }}><option value="all">All decisions</option><option value="allowed">Allowed</option><option value="challenged">Challenged</option><option value="blocked">Blocked</option></select></label>
            <label htmlFor="analytics-risk-filter">Risk<select id="analytics-risk-filter" value={riskFilter} onChange={(event) => { setRiskFilter(event.target.value); setPage(1); }}><option value="all">All risk levels</option><option value="high">High risk</option><option value="medium">Medium risk</option><option value="low">Low risk</option></select></label>
            {availableSignals.length ? <label htmlFor="analytics-signal-filter">Threat signal<select id="analytics-signal-filter" value={signalFilter} onChange={(event) => { setSignalFilter(event.target.value); setPage(1); }}><option value="all">All signals</option>{availableSignals.map((signal) => <option key={signal} value={signal}>{signal}</option>)}</select></label> : null}
            <label className="botshield-analytics-search" htmlFor="analytics-search-filter">Search<input id="analytics-search-filter" onChange={(event) => { setSearchFilter(event.target.value); setPage(1); }} placeholder="Path, reason, country, or network" type="search" value={searchFilter} /></label>
            <div className="botshield-analytics-toolbar-actions">
              <BotShieldActionButton
                disabled={model.analyticsRefreshing}
                loading={model.analyticsRefreshing}
                onClick={() => {
                  void actions.refreshAnalytics?.();
                }}
              >
                Refresh
              </BotShieldActionButton>
              {filtersActive ? <button className="botshield-analytics-clear" onClick={clearFilters} type="button">Clear filters</button> : null}
            </div>
          </div>
          <div className="botshield-analytics-filter-context" aria-live="polite">
            <span>{filteredEvents.length.toLocaleString()} event{filteredEvents.length === 1 ? "" : "s"}</span>
            <span aria-hidden="true">·</span>
            <span>{ANALYTICS_PERIODS.find((period) => period.days === periodDays)?.label}</span>
            <span aria-hidden="true">·</span>
            <span>{decisionFilter === "all" ? "All decisions" : getOutcomeLabel(decisionFilter)}</span>
          </div>
        </section>

        <section className="botshield-analytics-kpis" aria-label="Analytical metrics">
          <AnalyticsKpi label="Suspicious events" value={suspiciousEvents.length} detail="Storefront events with elevated threat signals" />
          <AnalyticsKpi label="Intervention rate" value={`${analyticsPercent(interventionCount, suspiciousEvents.length)}%`} detail="Share of suspicious events blocked or challenged" />
          <AnalyticsKpi label="Top threat signal" value={topSignal?.label || "—"} detail={topSignal ? `${topSignal.count} event${topSignal.count === 1 ? "" : "s"} in this period` : "No suspicious signals detected"} compact />
          <AnalyticsKpi label="High-risk activity" value={highRiskCount} detail="Events classified as high risk" />
        </section>

        <div className="botshield-analytics-section-label">Threat intelligence</div>
        <div className="botshield-analytics-split botshield-analytics-split--primary">
          <AnalyticsPanel title="Threat signal analysis" subtitle="Understand which detection signals are driving suspicious storefront activity.">
            {signalRows.length ? <div className="botshield-analytics-ranked">{signalRows.map((row) => { const interventionRate = analyticsPercent(row.blocked + row.challenged, row.count); return <div className="botshield-analytics-ranked-row" key={row.label}><div className="botshield-analytics-ranked-copy"><strong>{row.label}</strong><span>{row.count.toLocaleString()} event{row.count === 1 ? "" : "s"} · {analyticsPercent(row.count, suspiciousEvents.length)}% of suspicious events</span></div><div className="botshield-analytics-ranked-measure"><AnalyticsBar maximum={signalMaximum} value={row.count} /><span>{interventionRate}% intervention</span></div></div>; })}</div> : <AnalyticsEmpty text="No suspicious threat signals were detected during this period." />}
            {signalRows.length ? <p className="botshield-analytics-footnote">Events can include multiple signals, so signal percentages may total more than 100%.</p> : null}
          </AnalyticsPanel>
          <AnalyticsPanel title="Risk distribution" subtitle="Distribution of storefront activity by assessed risk level.">
            {filteredEvents.length ? <><div className="botshield-analytics-risk-total"><strong>{filteredEvents.length.toLocaleString()}</strong><span>analyzed event{filteredEvents.length === 1 ? "" : "s"}</span></div><div className="botshield-analytics-risk-list">{riskRows.map((row) => <div className="botshield-analytics-risk-row" key={row.risk}><span className={`botshield-analytics-risk-dot is-${row.risk}`} /><strong>{getRiskLabel(row.risk)}</strong><AnalyticsBar maximum={riskMaximum} tone={row.risk} value={row.count} /><b>{row.count}</b><span>{analyticsPercent(row.count, filteredEvents.length)}%</span></div>)}</div></> : <AnalyticsEmpty text="No risk activity is available for this period." />}
          </AnalyticsPanel>
        </div>

        <div className="botshield-analytics-section-label">Detection analysis</div>
        <AnalyticsPanel title="Detection outcomes" subtitle="See how each threat signal translates into protection decisions.">
          {signalRows.length ? <div className="botshield-analytics-table-wrap"><table className="botshield-analytics-table botshield-analytics-outcomes-table"><thead><tr><th>Detection signal</th><th>Detected</th><th>Blocked</th><th>Challenged</th><th>Allowed</th><th>Intervention rate</th></tr></thead><tbody>{signalRows.map((row) => { const rate = analyticsPercent(row.blocked + row.challenged, row.count); return <tr key={row.label}><th>{row.label}</th><td>{row.count}</td><td><span className="botshield-analytics-outcome-number is-blocked">{row.blocked}</span></td><td><span className="botshield-analytics-outcome-number is-challenged">{row.challenged}</span></td><td><span className="botshield-analytics-outcome-number is-allowed">{row.allowed}</span></td><td><div className="botshield-analytics-rate"><strong>{rate}%</strong><AnalyticsBar maximum={100} value={rate} /></div></td></tr>; })}</tbody></table></div> : <AnalyticsEmpty text="No detection outcomes are available for this period." />}
        </AnalyticsPanel>

        <div className="botshield-analytics-section-label">Behavior</div>
        <AnalyticsPanel title="Activity patterns" subtitle="See when suspicious storefront activity is most concentrated.">
          {suspiciousEvents.length ? <div className={`botshield-analytics-activity${activeActivityBuckets.length <= 2 ? " is-sparse" : ""}`}><div className="botshield-analytics-activity-facts"><div><span>Peak suspicious activity</span><strong>{peakActivityLabel}</strong></div><div><span>Suspicious events</span><strong>{suspiciousEvents.length.toLocaleString()}</strong></div><div><span>Last suspicious event</span><strong>{formatRelativeTime(lastSuspiciousEvent?.createdAt)}</strong></div></div><div className="botshield-analytics-histogram" role="img" aria-label={`Suspicious activity distribution across ${bucketCount} time buckets`}>{activityBuckets.map((bucket) => <span className={bucket.index === peakActivityBucket?.index ? "is-peak" : ""} key={bucket.index} title={`${bucket.label}\nSuspicious events: ${bucket.count}\nBlocked: ${bucket.blocked}\nChallenged: ${bucket.challenged}`}><i style={{ height: `${bucket.count ? Math.max(7, (bucket.count / activityMaximum) * 100) : 0}%` }} /></span>)}</div><div className="botshield-analytics-axis" aria-hidden="true"><span>{activityBuckets[0]?.label}</span><span>{activityBuckets.at(-1)?.label}</span></div></div> : <AnalyticsEmpty text="No suspicious activity recorded for this period. Try a wider date range or clear filters." />}
        </AnalyticsPanel>

        <><div className="botshield-analytics-section-label">Paths and network sources</div><div className="botshield-analytics-split"><AnalyticsPanel title="Most targeted storefront areas" subtitle="Storefront paths receiving the most suspicious activity.">{pathRows.length ? <AnalyticsCompactRanking rows={pathRows} total={suspiciousEvents.length} /> : <AnalyticsEmpty text="No targeted storefront paths were recorded during this period." />}</AnalyticsPanel><AnalyticsPanel title="Network sources" subtitle="Network types recorded for suspicious storefront events.">{attackOriginRows.length ? <AnalyticsCompactRanking rows={attackOriginRows} total={suspiciousEvents.length} /> : <AnalyticsEmpty text="No reliable network origin data was recorded during this period." />}</AnalyticsPanel></div></>

        <><div className="botshield-analytics-section-label">Visitor intelligence</div><AnalyticsPanel title="Recurring suspicious visitors" subtitle="Analyze recurring and high-risk visitor behavior using masked visitor identifiers.">{visitorRows.length ? <div className="botshield-analytics-table-wrap"><table className="botshield-analytics-table botshield-analytics-visitor-table"><thead><tr><th>Visitor</th><th>Events</th><th>Primary signal</th><th>Risk</th><th>Outcome</th><th>Last seen</th></tr></thead><tbody>{visitorRows.map((row) => <tr className={row.count > 1 ? "is-recurring" : ""} key={row.ipAddress}><th><span className="botshield-analytics-visitor-id">{row.masked}</span>{row.count > 1 ? <span className="botshield-analytics-repeat">Repeat</span> : null}</th><td>{row.count}</td><td>{row.signal}</td><td><BotShieldStatusBadge status={row.risk} label={getRiskLabel(row.risk)} /></td><td>{row.outcome}</td><td>{formatRelativeTime(row.lastSeen)}</td></tr>)}</tbody></table></div> : <AnalyticsEmpty text="No recurring suspicious visitors matched this period and filter selection." />}</AnalyticsPanel></>

        <AnalyticsPanel title="Signal combinations" subtitle="Threat signals that appear together in recorded events.">{combinationRows.length ? <div className="botshield-analytics-combinations">{combinationRows.map((row) => <div className="botshield-analytics-combination" key={row.label}><div className="botshield-analytics-combination-signals">{row.label.split(" + ").map((signal, index) => <span key={signal}>{index ? <b aria-hidden="true">+</b> : null}<strong>{signal}</strong></span>)}</div><dl><div><dt>Events</dt><dd>{row.count}</dd></div><div><dt>Share</dt><dd>{analyticsPercent(row.count, suspiciousEvents.length)}%</dd></div><div><dt>Intervention</dt><dd>{analyticsPercent(row.interventions, row.count)}%</dd></div></dl></div>)}</div> : <AnalyticsEmpty text="No multi-signal event combinations were recorded during this period." />}</AnalyticsPanel>

        <aside className="botshield-analytics-insight"><OverviewIcon name="activity" centered /><div><span>Key insight</span><strong>{insightTitle}</strong><p>{insightDetail}</p></div></aside>

        <section className="botshield-analytics-summary" aria-labelledby="analytics-summary-title"><header><span>Investigation</span><h2 id="analytics-summary-title">Investigation summary</h2></header>{suspiciousEvents.length ? <dl>{topSignal ? <div><dt>Most common signal</dt><dd>{topSignal.label}</dd></div> : null}{peakActivityBucket ? <div><dt>Highest-risk period</dt><dd>{peakActivityLabel}</dd></div> : null}{pathRows[0] ? <div><dt>Most targeted path</dt><dd>{formatAnalyticsPath(pathRows[0].label)}</dd></div> : null}{visitorRows[0] ? <div><dt>Most active visitor</dt><dd>{visitorRows[0].masked}</dd></div> : null}</dl> : <p>No suspicious activity is available to summarize for this selection.</p>}</section>

        <div className="botshield-analytics-section-label">Investigation</div>
        <AnalyticsPanel title="Event explorer" subtitle="Filter and review the storefront events behind these metrics.">
          {paginatedEvents.length ? <><div className="botshield-analytics-table-wrap"><table className="botshield-analytics-table botshield-analytics-event-table"><thead><tr><th>Time</th><th>Risk</th><th>Threat signal</th><th>Reasons</th><th>Decision</th><th>Page / path</th><th>Action</th></tr></thead><tbody>{paginatedEvents.map((event) => { const signals = getAnalyticsSignals(event); return <tr key={event.id}><td>{formatAnalyticsTimestamp(event.createdAt)}</td><td><BotShieldStatusBadge status={event.threatLevel} label={getRiskLabel(event.threatLevel)} /></td><td>{signals.join(", ") || "No elevated signal"}</td><td><span title={formatMerchantReasons(event.reasonCodes || event.reasons)}>{formatMerchantReasons(event.reasonCodes || event.reasons)}</span></td><td><BotShieldStatusBadge status={event.actionTaken} label={getOutcomeLabel(event.actionTaken)} /></td><td><span title={event.pathVisited || "/"}>{event.pathVisited || "/"}</span></td><td><button className="botshield-analytics-detail-button" onClick={() => setSelectedEvent(event)} type="button">View details</button></td></tr>; })}</tbody></table></div><div className="botshield-analytics-pagination"><span>{filteredEvents.length.toLocaleString()} matching event{filteredEvents.length === 1 ? "" : "s"}</span><div><button disabled={visiblePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button">Previous</button><span>Page {visiblePage} of {totalPages}</span><button disabled={visiblePage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} type="button">Next</button></div></div></> : <AnalyticsEmpty text={filtersActive ? "No events match these filters. Clear filters or choose a wider date range." : "No storefront events were recorded during this period."} />}
        </AnalyticsPanel>

        <AnalyticsEventDetails
          actions={actions}
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
          </>
        )}
      </BotShieldPageShell>
    </BotShieldNativePage>
  );
}

function maskAnalyticsVisitor(value) {
  const address = String(value || "");
  if (address.includes(":")) return `${address.split(":").slice(0, 2).join(":")}:…`;
  const octets = address.split(".");
  return octets.length === 4 ? `${octets[0]}.${octets[1]}.xxx.xxx` : "Masked visitor";
}

function AnalyticsKpi({ label, value, detail, compact = false }) {
  return <div className={`botshield-analytics-kpi${compact ? " is-compact" : ""}`}><span>{label}</span><strong>{typeof value === "number" ? value.toLocaleString() : value}</strong><small>{detail}</small></div>;
}

function AnalyticsPanel({ title, subtitle, children }) {
  return <section className="botshield-analytics-panel"><header><h2>{title}</h2><p>{subtitle}</p></header>{children}</section>;
}

function AnalyticsEmpty({ text }) {
  return <div className="botshield-analytics-empty"><strong>No data to display</strong><span>{text}</span></div>;
}

function AnalyticsCompactRanking({ rows, total }) {
  const maximum = Math.max(1, ...rows.map((row) => row.count));
  return <div className="botshield-analytics-compact-ranking">{rows.map((row) => <div key={row.label} title={`${row.count} suspicious event${row.count === 1 ? "" : "s"}; ${row.blocked ?? 0} blocked; ${row.challenged ?? 0} challenged; ${analyticsPercent(row.count, total)}% of suspicious events`}><span title={row.label}>{formatAnalyticsPath(row.label)}</span><AnalyticsBar maximum={maximum} value={row.count} /><b>{row.count} event{row.count === 1 ? "" : "s"}</b><small>{analyticsPercent(row.count, total)}% of suspicious events</small><em>{row.blocked ?? 0} blocked · {row.challenged ?? 0} challenged</em></div>)}</div>;
}

function formatAnalyticsPath(value) {
  return value === "/" ? "Homepage (/)" : value;
}

function formatAnalyticsTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatAnalyticsDetailTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const dateLabel = date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeLabel = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${dateLabel} · ${timeLabel}`;
}

function formatAnalyticsBucketLabel(start, end, periodDays) {
  if (periodDays === 1) {
    return `${start.toLocaleTimeString([], { hour: "numeric" })}–${end.toLocaleTimeString([], { hour: "numeric" })}`;
  }
  return start.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getAnalyticsAttackOrigin(event) {
  const networkType = String(event.networkType || "").trim().toLowerCase();
  const typeLabels = {
    hosting: "Hosting / datacenter",
    vpn: "VPN / proxy",
    proxy: "VPN / proxy",
    isp: "Residential / ISP",
    business: "Business network",
    education: "Education network",
    government: "Government network",
  };
  if (networkType) {
    return typeLabels[networkType] || networkType
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
      .join(" ");
  }
  return (
    String(event.networkOrg || event.networkProvider || "").trim() ||
    (event.networkAsn ? `AS${event.networkAsn}` : "")
  );
}

function getAnalyticsDecisionContext(event, signalLabel) {
  const decision = String(event.actionTaken || "").toLowerCase();
  const hasElevatedSignal = signalLabel !== "No elevated signal";
  if (decision === "blocked" || decision === "stopped") {
    return hasElevatedSignal
      ? `This request was blocked based on ${signalLabel.toLowerCase()}.`
      : "This request was blocked based on the recorded protection decision.";
  }
  if (decision === "challenged" || decision === "challenge") {
    return hasElevatedSignal
      ? `Verification was requested based on ${signalLabel.toLowerCase()}.`
      : "Verification was requested based on the recorded protection decision.";
  }
  return hasElevatedSignal
    ? `This request was allowed. ${signalLabel} was recorded for review.`
    : "This request was allowed because no elevated signals were recorded.";
}

function AnalyticsEventDetails({ actions, event, onClose }) {
  const requestClose = () => {
    hideBotShieldModal(BOTSHIELD_ANALYTICS_EVENT_MODAL_ID);
  };

  const signals = event ? getAnalyticsSignals(event) : [];
  const networkClassification = event ? getAnalyticsAttackOrigin(event) : "";
  const signalLabel = signals.join(", ") || "No elevated signal";
  const reason = event
    ? formatMerchantReasons(event.reasonCodes || event.reasons)
    : "";
  const decisionContext = event
    ? getAnalyticsDecisionContext(event, signalLabel)
    : "";
  const hasVisitorDetails = Boolean(
    event &&
      (event.ipAddress ||
        networkClassification ||
        event.networkCountry ||
        event.networkOrg ||
        event.networkProvider),
  );

  return (
    <BotShieldNativeModal
      bodyClassName="botshield-analytics-event-modal-body"
      heading="Event details"
      id={BOTSHIELD_ANALYTICS_EVENT_MODAL_ID}
      onAfterHide={onClose}
      open={Boolean(event)}
      secondaryActions={
        <s-button slot="secondary-actions" onClick={requestClose}>
          Close
        </s-button>
      }
      size="small-100"
    >
      {event ? (
        <>
          <p className="botshield-analytics-event-modal-meta">
            {formatAnalyticsDetailTimestamp(event.createdAt)}
          </p>
          <div className="botshield-analytics-detail-summary">
            <div>
              <BotShieldStatusBadge
                label={getOutcomeLabel(event.actionTaken)}
                status={event.actionTaken}
              />
              <strong>
                {getRiskLabel(event.threatLevel)} · {signalLabel}
              </strong>
            </div>
            <p>{decisionContext}</p>
          </div>
          <section className="botshield-analytics-detail-section">
            <h3>Detection</h3>
            <dl className="botshield-analytics-detail-grid">
              <div>
                <dt>Risk</dt>
                <dd>
                  <BotShieldStatusBadge
                    label={getRiskLabel(event.threatLevel)}
                    status={event.threatLevel}
                  />
                </dd>
              </div>
              <div>
                <dt>Decision</dt>
                <dd>
                  <BotShieldStatusBadge
                    label={getOutcomeLabel(event.actionTaken)}
                    status={event.actionTaken}
                  />
                </dd>
              </div>
              <div className="is-full">
                <dt>Threat signal</dt>
                <dd>{signalLabel}</dd>
              </div>
              <div className="is-full botshield-analytics-detail-reason">
                <dt>Detection reason</dt>
                <dd>{reason}</dd>
              </div>
            </dl>
          </section>
          <section className="botshield-analytics-detail-section">
            <h3>Request</h3>
            <dl className="botshield-analytics-detail-grid">
              <div>
                <dt>Page / path</dt>
                <dd>{event.pathVisited || "/"}</dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd>{formatAnalyticsDetailTimestamp(event.createdAt)}</dd>
              </div>
              {event.id ? (
                <div className="is-full botshield-analytics-detail-reference">
                  <dt>Event reference</dt>
                  <dd title={String(event.id)}>{String(event.id)}</dd>
                  <small>
                    Use this reference when reviewing the event or contacting
                    support.
                  </small>
                </div>
              ) : null}
            </dl>
          </section>
          {hasVisitorDetails ? (
            <section className="botshield-analytics-detail-section">
              <h3>Visitor</h3>
              <dl className="botshield-analytics-detail-grid">
                {event.ipAddress ? (
                  <div>
                    <dt>Visitor</dt>
                    <dd>{maskAnalyticsVisitor(event.ipAddress)}</dd>
                  </div>
                ) : null}
                {networkClassification ? (
                  <div>
                    <dt>Network classification</dt>
                    <dd>{networkClassification}</dd>
                  </div>
                ) : null}
                {event.networkCountry ? (
                  <div>
                    <dt>Recorded location</dt>
                    <dd>
                      {[event.networkCity, event.networkCountry]
                        .filter(Boolean)
                        .join(", ")}
                    </dd>
                  </div>
                ) : null}
                {event.networkOrg || event.networkProvider ? (
                  <div>
                    <dt>Network</dt>
                    <dd>{event.networkOrg || event.networkProvider}</dd>
                  </div>
                ) : null}
              </dl>
            </section>
          ) : null}
          {event.actionTaken === "blocked" && event.id ? (
            <div className="botshield-analytics-detail-actions">
              <BotShieldAsyncButton
                action={async () => {
                  await actions.recoverIncident(event.id, "whitelist");
                  requestClose();
                }}
                successMessage="Visitor trusted"
              >
                Trust visitor
              </BotShieldAsyncButton>
              <BotShieldAsyncButton
                action={async () => {
                  await actions.recoverIncident(event.id, "unblock");
                  requestClose();
                }}
                successMessage="IP unblocked"
              >
                Unblock IP
              </BotShieldAsyncButton>
            </div>
          ) : null}
        </>
      ) : null}
    </BotShieldNativeModal>
  );
}

const FRAUD_REVIEW_FILTERS = [
  ["needs-review", "Needs review"],
  ["high", "High risk"],
  ["medium", "Medium risk"],
  ["pending-fulfillment", "Pending fulfillment"],
  ["all", "All orders"],
];

const FRAUD_METRIC_FILTERS = {
  "Needs review": "needs-review",
  "High risk": "high",
  "Pending fulfillment": "pending-fulfillment",
  Assessed: "all",
};

const FRAUD_FILTER_EMPTY = {
  "needs-review": {
    title: "No orders currently need review",
    description: "Orders with elevated risk or Shopify recommendations will appear here when order review is available.",
  },
  high: {
    title: "No high-risk orders",
    description: "High-risk Shopify orders will appear here when order review is available.",
  },
  medium: {
    title: "No medium-risk orders",
    description: "Medium-risk orders will appear here when order review is available.",
  },
  "pending-fulfillment": {
    title: "No risky orders are currently pending fulfillment",
    description: "Risky unfulfilled orders will appear here when order review is available.",
  },
  all: {
    title: "No orders available for review",
    description: "Assessed orders will appear here when order review is available.",
  },
};

function isSupportedFraudFilter(value) {
  return FRAUD_REVIEW_FILTERS.some(([filterValue]) => filterValue === value);
}

function getFraudQueueEmptyState({
  activeFilter,
  connected,
  filteredOrders,
  onOpenSetup,
  orders,
  search,
}) {
  const filterKey = isSupportedFraudFilter(activeFilter) ? activeFilter : "needs-review";
  const filterEmpty = FRAUD_FILTER_EMPTY[filterKey] || FRAUD_FILTER_EMPTY.all;
  const trimmedSearch = String(search || "").trim();
  const safeOrders = Array.isArray(orders) ? orders : [];
  const safeFiltered = Array.isArray(filteredOrders) ? filteredOrders : [];
  const hasOrders = safeOrders.length > 0;
  const hasFiltered = safeFiltered.length > 0;

  if (!connected) {
    if (filterKey === "needs-review") {
      return {
        title: "Fraud Orders isn't available yet",
        description:
          "Order review will be available in a future BotShield update. Setup steps show what's coming.",
        actionLabel: "Review setup",
        onAction: onOpenSetup,
        variant: "disconnected",
        compact: true,
      };
    }

    return {
      title: filterEmpty.title,
      description: "Order review isn't available in this version of BotShield.",
      variant: "disconnected",
      compact: true,
    };
  }

  if (hasFiltered) return null;

  if (hasOrders && trimmedSearch) {
    return {
      title: "No orders match your filter or search",
      description: "Try a different filter or clear your search to see more orders.",
      variant: "connected",
      compact: true,
    };
  }

  return {
    title: filterEmpty.title,
    description: filterEmpty.description,
    variant: "connected",
    compact: true,
  };
}

function filterFraudOrders(orders, { activeFilter, search, needsReview, riskTone }) {
  const safeOrders = Array.isArray(orders)
    ? orders.filter((order) => order && typeof order === "object")
    : [];
  const normalizedFilter = isSupportedFraudFilter(activeFilter) ? activeFilter : "needs-review";
  const query = String(search || "").trim().toLowerCase();

  return safeOrders.filter((order) => {
    const filterMatch =
      normalizedFilter === "all"
        ? true
        : normalizedFilter === "needs-review"
          ? needsReview(order)
          : normalizedFilter === "pending-fulfillment"
            ? fraudOrderIsPendingFulfillment(order) && fraudOrderIsElevated(order)
            : riskTone(order) === normalizedFilter;

    if (!query) return filterMatch;

    const text = [
      order.name,
      order.orderName,
      order.customer,
      order.customerName,
      order.email,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return filterMatch && text.includes(query);
  });
}

const FRAUD_ORDER_ACCESS_AVAILABLE = false;

function fraudOrderAge(value) {
  if (!value) return "—";
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "—";
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (elapsedMinutes < 1) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h`;
  return `${Math.floor(elapsedHours / 24)}d`;
}

function fraudOrderPrimarySignal(order) {
  return normalizeOverviewText(order.reason || order.primarySignal || "No signal recorded");
}

function fraudOrderSecondarySignal(order) {
  const secondary = order.secondarySignal || order.secondaryReason;
  return secondary ? normalizeOverviewText(secondary) : null;
}

function fraudOrderSignalList(order) {
  const signals = [];
  const primary = order.reason || order.primarySignal;
  const secondary = order.secondarySignal || order.secondaryReason;
  if (primary) signals.push(normalizeOverviewText(primary));
  if (secondary && !signals.includes(normalizeOverviewText(secondary))) {
    signals.push(normalizeOverviewText(secondary));
  }
  if (Array.isArray(order.signals)) {
    order.signals.forEach((signal) => {
      const text = normalizeOverviewText(signal);
      if (text && !signals.includes(text)) signals.push(text);
    });
  }
  return signals;
}

function fraudOrderIsPendingFulfillment(order) {
  const status = String(order.fulfillmentStatus || "").toLowerCase();
  return !status || /unfulfilled|partial|pending|on hold|not fulfilled/.test(status);
}

function fraudOrderIsElevated(order) {
  const risk = String(order.risk || order.riskLevel || "pending").toLowerCase();
  const recommendation = String(order.recommendation || "").toLowerCase();
  return /high|medium/.test(risk) || /review|cancel|investigate/.test(recommendation);
}

function FraudOrdersPageHeader({ onRefresh }) {
  if (!onRefresh) return null;

  return (
    <header className="botshield-overview-header botshield-fraud-header">
      <BotShieldAsyncButton action={onRefresh} successMessage="Order review refreshed">
        Refresh
      </BotShieldAsyncButton>
    </header>
  );
}

function FraudOrderStatusStrip({ onSetup }) {
  return (
    <section className="botshield-fraud-status-strip" aria-labelledby="order-risk-status-title">
      <div className="botshield-fraud-status-strip-icon">
        <OverviewIcon name="shield" centered />
      </div>
      <div className="botshield-fraud-status-strip-copy">
        <span className="botshield-v2-eyebrow">Fraud Orders status</span>
        <h2 id="order-risk-status-title">Order review isn't available yet</h2>
        <p>Order review will be available in a future BotShield update. Review setup to see what's coming.</p>
      </div>
      <div className="botshield-fraud-status-strip-action">
        <BotShieldStatusBadge status="setup_required" label="Setup required" />
        <BotShieldActionButton onClick={onSetup}>Review setup</BotShieldActionButton>
      </div>
    </section>
  );
}

function FraudReviewSnapshot({
  activeFilter,
  disabled = false,
  items,
  onMetricSelect,
}) {
  return (
    <section className="botshield-fraud-snapshot" aria-label="Review snapshot">
      {items.map((item) => {
        const filterValue = FRAUD_METRIC_FILTERS[item.label];
        const interactive = !disabled && filterValue && onMetricSelect && !item.unavailable;
        const isSelected = interactive && activeFilter === filterValue;
        const className = [
          "botshield-fraud-snapshot-item",
          interactive ? "is-interactive" : "",
          isSelected ? "is-selected" : "",
          item.unavailable ? "is-unavailable-metric" : "",
        ]
          .filter(Boolean)
          .join(" ");

        const content = (
          <>
            <span className="botshield-fraud-snapshot-label">{item.label}</span>
            <strong
              className={`botshield-fraud-snapshot-value${item.unavailable ? " is-unavailable" : ""}`}
              aria-label={item.unavailable ? `${item.label} unavailable` : undefined}
            >
              {item.unavailable ? "—" : item.value}
            </strong>
            <small className="botshield-fraud-snapshot-detail">{item.detail}</small>
          </>
        );

        if (interactive) {
          return (
            <button
              aria-label={`Filter queue by ${item.label.toLowerCase()}`}
              aria-pressed={isSelected}
              className={className}
              key={item.label}
              onClick={() => onMetricSelect(filterValue)}
              type="button"
            >
              {content}
            </button>
          );
        }

        return (
          <div className={className} key={item.label}>
            {content}
          </div>
        );
      })}
    </section>
  );
}

function FraudReviewQueueToolbar({
  activeFilter,
  disabled = false,
  onFilterChange,
  onSearchChange,
  search,
  searchDisabled = false,
}) {
  const handleFilterChange = (value) => {
    if (!isSupportedFraudFilter(value)) return;
    onFilterChange?.(value);
  };

  return (
    <div className="botshield-fraud-toolbar" aria-disabled={disabled || undefined}>
      <div className="botshield-fraud-filter-group" role="tablist" aria-label="Order review views">
        {FRAUD_REVIEW_FILTERS.map(([value, label]) => (
          <button
            aria-selected={activeFilter === value}
            className={activeFilter === value ? "is-active" : ""}
            disabled={disabled}
            key={value}
            onClick={() => handleFilterChange(value)}
            role="tab"
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <input
        aria-label="Search orders, customers, or email"
        disabled={disabled || searchDisabled}
        onChange={(event) => onSearchChange?.(event.target.value)}
        placeholder="Search orders, customers, or email"
        type="search"
        value={search}
      />
    </div>
  );
}

function FraudOrderInboxTable({ orders, onReview, riskLabel, riskTone }) {
  return (
    <div className="botshield-fraud-table-wrap">
      <table className="botshield-fraud-table botshield-fraud-inbox-table">
        <thead>
          <tr>
            {[
              "Order",
              "Customer",
              "Total",
              "Risk",
              "Recommendation",
              "Fulfillment",
              "Created",
              "Action",
            ].map((heading) => (
              <th key={heading}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const secondarySignal = fraudOrderSecondarySignal(order);
            const customerName = order.customer || order.customerName;
            return (
              <tr key={order.id || order.orderId || order.name}>
                <td className="botshield-fraud-inbox-order">
                  <strong>{order.name || order.orderName || "Order"}</strong>
                </td>
                <td className="botshield-fraud-inbox-customer">
                  <strong>{customerName || "Unavailable"}</strong>
                  {order.email ? <small>{order.email}</small> : null}
                </td>
                <td>{order.amount || order.total || "Unavailable"}</td>
                <td>
                  <BotShieldStatusBadge label={riskLabel(order)} status={riskTone(order)} />
                </td>
                <td className="botshield-fraud-inbox-signal">
                  <strong>{order.recommendation || "Pending"}</strong>
                  {secondarySignal ? <small>{secondarySignal}</small> : null}
                </td>
                <td>{order.fulfillmentStatus || "Unavailable"}</td>
                <td>{formatDate(order.createdAt || order.date, "Unavailable")}</td>
                <td className="botshield-fraud-inbox-action">
                  <button
                    aria-label={`Review order ${order.name || order.orderName || ""}`.trim()}
                    className="botshield-fraud-review-link"
                    onClick={() => onReview(order)}
                    type="button"
                  >
                    Review →
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FraudOrderSetupDrawer({ connected, onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const orderAccessReady = connected;
  const steps = [
    {
      key: "installed",
      title: "BotShield installed",
      detail: "Running inside Shopify Admin.",
      status: "complete",
      statusLabel: "Complete",
    },
    {
      key: "access",
      title: "Connect order access",
      detail: "Allow BotShield to read supported Shopify order-risk information.",
      status: orderAccessReady ? "complete" : "required",
      statusLabel: orderAccessReady ? "Complete" : "Required",
      active: !orderAccessReady,
      note:
        !orderAccessReady && !FRAUD_ORDER_ACCESS_AVAILABLE
          ? "Not available in this version of BotShield yet."
          : null,
    },
    {
      key: "queue",
      title: "Review queue ready",
      detail: "Risky orders will appear here automatically after connection.",
      status: orderAccessReady ? "complete" : "waiting",
      statusLabel: orderAccessReady ? "Ready" : "Waiting",
    },
  ];
  const completedSteps = steps.filter((step) => step.status === "complete").length;
  const progressPercent = Math.round((completedSteps / steps.length) * 100);
  const connectDisabled = !FRAUD_ORDER_ACCESS_AVAILABLE || orderAccessReady;

  return ReactDOM.createPortal(
    <div
      className="botshield-fraud-drawer-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        aria-label="Fraud Orders setup"
        aria-modal="true"
        className="botshield-fraud-drawer botshield-fraud-drawer--setup"
        role="dialog"
      >
        <header className="botshield-fraud-setup-drawer-header">
          <div>
            <h2>Fraud Orders setup</h2>
            <p>See what's required for order review when this feature becomes available.</p>
          </div>
          <button aria-label="Close Fraud Orders setup" autoFocus onClick={onClose} type="button">
            ×
          </button>
        </header>
        <div className="botshield-fraud-drawer-body">
          <section
            aria-labelledby="fraud-setup-status-title"
            className={`botshield-fraud-setup-status${
              orderAccessReady ? " is-connected" : " is-required"
            }`}
          >
            <div className="botshield-fraud-setup-status-row">
              <div className="botshield-fraud-setup-status-copy">
                <span className="botshield-v2-eyebrow">Order risk</span>
                <h3 id="fraud-setup-status-title">
                  {orderAccessReady ? "Order risk connected" : "Order risk isn't connected"}
                </h3>
                <p>
                  {orderAccessReady
                    ? "Order review is connected for this store."
                    : "Order review isn't available in this version of BotShield."}
                </p>
              </div>
              <div className="botshield-fraud-setup-status-badge">
                <BotShieldStatusBadge
                  label={orderAccessReady ? "Connected" : "Setup required"}
                  status={orderAccessReady ? "active" : "setup_required"}
                />
              </div>
            </div>
          </section>

          <section aria-label="Setup progress" className="botshield-fraud-setup-checklist">
            <div className="botshield-fraud-setup-checklist-heading">
              <span className="botshield-v2-eyebrow">Setup progress</span>
              <span className="botshield-fraud-setup-progress-count">
                {completedSteps} of {steps.length} complete
              </span>
            </div>
            <div
              aria-hidden="true"
              className="botshield-fraud-setup-progress-bar"
              role="presentation"
            >
              <span style={{ width: `${progressPercent}%` }} />
            </div>
            <ol className="botshield-fraud-setup-checklist-steps">
              {steps.map((step) => (
                <li
                  className={`botshield-fraud-setup-checklist-item botshield-fraud-setup-checklist-item--${step.status}${
                    step.active ? " is-active" : ""
                  }`}
                  key={step.key}
                >
                  <span
                    aria-hidden="true"
                    className={`botshield-fraud-setup-checklist-marker botshield-fraud-setup-checklist-marker--${step.status}`}
                  >
                    {step.status === "complete" ? "✓" : step.status === "required" ? "●" : "○"}
                  </span>
                  <div className="botshield-fraud-setup-checklist-copy">
                    {step.active ? (
                      <span className="botshield-fraud-setup-step-eyebrow">Current step</span>
                    ) : null}
                    <div className="botshield-fraud-setup-checklist-topline">
                      <h4>{step.title}</h4>
                      <span
                        className={`botshield-fraud-setup-pill botshield-fraud-setup-pill--${step.status}`}
                      >
                        {step.statusLabel}
                      </span>
                    </div>
                    <p>{step.detail}</p>
                    {step.note ? (
                      <p className="botshield-fraud-setup-note" id="fraud-order-access-note">
                        {step.note}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <footer className="botshield-fraud-setup-drawer-footer">
          <BotShieldActionButton onClick={onClose}>Cancel</BotShieldActionButton>
          <span
            className="botshield-fraud-setup-connect-wrap"
            title={
              connectDisabled && !orderAccessReady && !FRAUD_ORDER_ACCESS_AVAILABLE
                ? "Order review isn't available in this version of BotShield."
                : undefined
            }
          >
            <BotShieldActionButton
              aria-describedby={
                !FRAUD_ORDER_ACCESS_AVAILABLE && !orderAccessReady
                  ? "fraud-order-access-note"
                  : undefined
              }
              disabled={connectDisabled}
              variant={connectDisabled ? "secondary" : "primary"}
            >
              {FRAUD_ORDER_ACCESS_AVAILABLE ? "Connect order access" : "Not available yet"}
            </BotShieldActionButton>
          </span>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}

function FraudOrderReviewDrawer({ order, onClose, needsReview, riskLabel, riskTone }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  if (!order || typeof document === "undefined") return null;

  const signals = fraudOrderSignalList(order);
  const customerName = order.customer || order.customerName;

  return ReactDOM.createPortal(
    <div
      className="botshield-fraud-drawer-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside aria-label="Order review details" aria-modal="true" className="botshield-fraud-drawer" role="dialog">
        <header>
          <div>
            <h2>{order.name || order.orderName || "Order details"}</h2>
            <p>
              {formatDate(order.createdAt || order.date, "Time unavailable")}
              {order.amount || order.total ? ` · ${order.amount || order.total}` : ""}
              {customerName ? ` · ${customerName}` : ""}
            </p>
          </div>
          <button aria-label="Close order details" autoFocus onClick={onClose} type="button">
            ×
          </button>
        </header>
        <div className="botshield-fraud-drawer-body">
          <div className="botshield-fraud-drawer-summary">
            <BotShieldStatusBadge label={riskLabel(order)} status={riskTone(order)} />
            <p>
              {needsReview(order)
                ? "This order has elevated risk signals that may warrant review."
                : "No elevated review requirement is indicated for this order."}
            </p>
          </div>
          <section>
            <h3>Risk assessment</h3>
            <dl className="botshield-fraud-drawer-grid">
              <div>
                <dt>Risk level</dt>
                <dd>{riskLabel(order)}</dd>
              </div>
              <div>
                <dt>Shopify recommendation</dt>
                <dd>{order.recommendation || "Pending"}</dd>
              </div>
              <div className="is-full">
                <dt>Assessment source</dt>
                <dd>{order.assessmentSource || "Shopify order risk assessment"}</dd>
              </div>
            </dl>
          </section>
          <section>
            <h3>Why this order was flagged</h3>
            {signals.length ? (
              <ul className="botshield-fraud-signal-list">
                {signals.map((signal) => (
                  <li key={signal}>{signal}</li>
                ))}
              </ul>
            ) : (
              <p>No additional risk details are available for this order.</p>
            )}
          </section>
          <section>
            <h3>Order state</h3>
            <dl className="botshield-fraud-drawer-grid">
              <div>
                <dt>Payment status</dt>
                <dd>{order.financialStatus || "Unavailable"}</dd>
              </div>
              <div>
                <dt>Fulfillment</dt>
                <dd>{order.fulfillmentStatus || "Unavailable"}</dd>
              </div>
              <div>
                <dt>Customer</dt>
                <dd>{customerName || "Unavailable"}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{order.email || "Unavailable"}</dd>
              </div>
            </dl>
          </section>
          <section>
            <h3>Investigation</h3>
            <p>
              {order.recommendation
                ? `Review Shopify's ${String(order.recommendation).toLowerCase()} recommendation and documented assessment details in Shopify Admin.`
                : "Wait for Shopify's risk assessment to finish before taking action on this order."}
            </p>
            <p className="botshield-fraud-drawer-source-note">
              Order risk data comes from Shopify. BotShield does not create Shopify risk assessments.
            </p>
          </section>
        </div>
        <footer>
          <BotShieldActionButton onClick={onClose}>Close</BotShieldActionButton>
          {order.adminUrl ? (
            <a className="botshield-fraud-open-order" href={order.adminUrl} rel="noreferrer" target="_top">
              Open in Shopify
            </a>
          ) : null}
        </footer>
      </aside>
    </div>,
    document.body,
  );
}

function FraudOrdersQueueEmpty({
  actionLabel,
  compact = false,
  description,
  icon = "activity",
  onAction,
  title,
  variant = "default",
}) {
  return (
    <div
      className={`botshield-fraud-queue-empty${variant === "connected" ? " is-connected" : ""}${
        compact ? " is-compact" : ""
      }${variant === "disconnected" ? " is-disconnected" : ""}`}
    >
      {!compact ? <OverviewIcon name={icon} centered /> : null}
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {onAction && actionLabel ? (
        <BotShieldActionButton onClick={onAction}>{actionLabel}</BotShieldActionButton>
      ) : null}
    </div>
  );
}

function FraudOrdersQueueLoading() {
  return (
    <div aria-live="polite" className="botshield-fraud-queue-loading" role="status">
      <span aria-hidden="true" className="botshield-fraud-queue-loading-spinner" />
      <p>Loading orders…</p>
    </div>
  );
}

function FraudOrdersPage({ model, actions }) {
  const [activeFilter, setActiveFilter] = useState("needs-review");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const orders = Array.isArray(model.fraudOrders) ? model.fraudOrders : [];
  const connected = Boolean(model.fraudOrderAccessConnected);
  const loading = Boolean(model.fraudOrdersLoading);
  const error = model.fraudOrdersError || null;
  const riskKey = (order) => String(order?.risk || order?.riskLevel || "pending").toLowerCase();
  const needsReview = (order) => {
    if (!order) return false;
    const risk = riskKey(order);
    const recommendation = String(order.recommendation || "").toLowerCase();
    return /high|medium/.test(risk) || /review|cancel/.test(recommendation);
  };
  const riskLabel = (order) => {
    const risk = riskKey(order);
    if (risk.includes("high")) return "High risk";
    if (risk.includes("medium")) return "Medium risk";
    if (risk.includes("low")) return "Low risk";
    return "Pending";
  };
  const riskTone = (order) => {
    const risk = riskKey(order);
    return risk.includes("high")
      ? "high"
      : risk.includes("medium")
        ? "medium"
        : risk.includes("low")
          ? "low"
          : "pending";
  };
  const metrics = orders.reduce(
    (result, order) => {
      const tone = riskTone(order);
      if (Object.prototype.hasOwnProperty.call(result, tone)) {
        result[tone] += 1;
      }
      if (needsReview(order)) result.review += 1;
      return result;
    },
    { high: 0, low: 0, medium: 0, pending: 0, review: 0 },
  );
  const pendingFulfillment = orders.filter(
    (order) => fraudOrderIsPendingFulfillment(order) && fraudOrderIsElevated(order),
  ).length;
  const filteredOrders = connected
    ? filterFraudOrders(orders, { activeFilter, search, needsReview, riskTone })
    : [];
  const refresh = async () => {
    if (typeof actions.refresh === "function") await actions.refresh();
  };
  const openSetup = () => setSetupOpen(true);
  const closeSetup = () => setSetupOpen(false);
  const handleFilterChange = (value) => {
    if (isSupportedFraudFilter(value)) setActiveFilter(value);
  };

  useEffect(() => {
    if (!selectedOrder) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setSelectedOrder(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [selectedOrder]);

  const snapshotItems = connected
    ? [
        {
          label: "Needs review",
          value: metrics.review,
          detail: "Orders awaiting merchant review",
          unavailable: false,
        },
        {
          label: "High risk",
          value: metrics.high,
          detail: "Highest-priority orders",
          unavailable: false,
        },
        {
          label: "Pending fulfillment",
          value: pendingFulfillment,
          detail: "Risky orders not yet fulfilled",
          unavailable: false,
        },
        {
          label: "Assessed",
          value: orders.length,
          detail: "Orders checked for fraud risk",
          unavailable: false,
        },
      ]
    : [
        {
          label: "Needs review",
          value: null,
          detail: "Orders awaiting merchant review",
          unavailable: true,
        },
        {
          label: "High risk",
          value: null,
          detail: "Highest-priority orders",
          unavailable: true,
        },
        {
          label: "Pending fulfillment",
          value: null,
          detail: "Risky orders not yet fulfilled",
          unavailable: true,
        },
        {
          label: "Assessed",
          value: null,
          detail: "Orders checked for fraud risk",
          unavailable: true,
        },
      ];

  const renderQueueBody = () => {
    if (loading) {
      return <FraudOrdersQueueLoading />;
    }

    if (error) {
      return (
        <BotShieldBanner
          tone="critical"
          title="Could not load Fraud Orders"
          action={<BotShieldActionButton onClick={refresh}>Retry</BotShieldActionButton>}
        >
          {error}
        </BotShieldBanner>
      );
    }

    if (connected && filteredOrders.length) {
      return (
        <FraudOrderInboxTable
          onReview={setSelectedOrder}
          orders={filteredOrders}
          riskLabel={riskLabel}
          riskTone={riskTone}
        />
      );
    }

    const emptyState = getFraudQueueEmptyState({
      activeFilter,
      connected,
      filteredOrders,
      onOpenSetup: openSetup,
      orders,
      search,
    });

    if (!emptyState) return null;

    return (
      <FraudOrdersQueueEmpty
        actionLabel={emptyState.actionLabel}
        compact={emptyState.compact}
        description={emptyState.description}
        onAction={emptyState.onAction}
        title={emptyState.title}
        variant={emptyState.variant}
      />
    );
  };

  return (
    <BotShieldNativePage heading="Fraud Orders">
      <>
        <BotShieldPageShell className="botshield-fraud-orders-content">
          <FraudOrdersPageHeader onRefresh={connected ? refresh : undefined} />

          {!connected ? <FraudOrderStatusStrip onSetup={openSetup} /> : null}

          <FraudReviewSnapshot
            activeFilter={activeFilter}
            disabled={loading}
            items={snapshotItems}
            onMetricSelect={handleFilterChange}
          />

          <section className="botshield-fraud-review-hero" aria-labelledby="fraud-review-queue-title">
            <div className="botshield-fraud-section-intro">
              <span className="botshield-v2-eyebrow">Review queue</span>
              <h2 id="fraud-review-queue-title">Orders requiring attention</h2>
              {!connected ? (
                <p>
                  Order review isn't available yet. Filters and queue preview will activate when
                  this feature launches.
                </p>
              ) : (
                <p>
                  Orders with elevated risk or Shopify recommendations that may need review.
                </p>
              )}
            </div>
            <FraudReviewQueueToolbar
              activeFilter={activeFilter}
              disabled={loading}
              onFilterChange={handleFilterChange}
              onSearchChange={setSearch}
              search={search}
              searchDisabled={!connected}
            />
            {renderQueueBody()}
          </section>
        </BotShieldPageShell>

        {setupOpen ? (
        <FraudOrderSetupDrawer connected={connected} onClose={closeSetup} />
      ) : null}

      {selectedOrder ? (
        <FraudOrderReviewDrawer
          needsReview={needsReview}
          onClose={() => setSelectedOrder(null)}
          order={selectedOrder}
          riskLabel={riskLabel}
          riskTone={riskTone}
        />
      ) : null}
    </>
    </BotShieldNativePage>
  );
}

function getProtectionModalSize(type) {
  if (type === "profile" || type === "blocklist" || type === "trusted") {
    return "large-100";
  }
  return "base";
}

function ProtectionPage({ model, actions }) {
  const toast = useBotShieldToast();
  const [protectionModal, setProtectionModal] = useState(null);
  const [blockedIpInput, setBlockedIpInput] = useState("");
  const [trustedIpInput, setTrustedIpInput] = useState("");
  const [pendingRemoval, setPendingRemoval] = useState(null);
  const [draft, setDraft] = useState({
    autoBlock: model.autoBlock,
    strictMode: model.strictMode,
    blockLevel: model.blockLevel,
    repeatedActivityEnabled: model.repeatedActivityEnabled,
    elevatedRateEnabled: model.elevatedRateEnabled,
    burstTrafficEnabled: model.burstTrafficEnabled,
    repeatOffenderEnabled: model.repeatOffenderEnabled,
    pathScanningEnabled: model.pathScanningEnabled,
  });
  const [originalDraft, setOriginalDraft] = useState({
    autoBlock: model.autoBlock,
    strictMode: model.strictMode,
    blockLevel: model.blockLevel,
    repeatedActivityEnabled: model.repeatedActivityEnabled,
    elevatedRateEnabled: model.elevatedRateEnabled,
    burstTrafficEnabled: model.burstTrafficEnabled,
    repeatOffenderEnabled: model.repeatOffenderEnabled,
    pathScanningEnabled: model.pathScanningEnabled,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const drawerOpenerRef = useRef(null);
  const pendingTransitionRef = useRef(null);

  useEffect(() => {
    if (protectionModal?.type === "profile") return;
    const persisted = {
      autoBlock: model.autoBlock,
      strictMode: model.strictMode,
      blockLevel: model.blockLevel,
      repeatedActivityEnabled: model.repeatedActivityEnabled,
      elevatedRateEnabled: model.elevatedRateEnabled,
      burstTrafficEnabled: model.burstTrafficEnabled,
      repeatOffenderEnabled: model.repeatOffenderEnabled,
      pathScanningEnabled: model.pathScanningEnabled,
    };
    setDraft(persisted);
    setOriginalDraft(persisted);
  }, [model.autoBlock, model.blockLevel, model.burstTrafficEnabled, model.elevatedRateEnabled, model.pathScanningEnabled, model.repeatOffenderEnabled, model.repeatedActivityEnabled, model.strictMode, protectionModal?.type]);

  const dirty =
    draft.autoBlock !== originalDraft.autoBlock ||
    draft.strictMode !== originalDraft.strictMode ||
    draft.blockLevel !== originalDraft.blockLevel ||
    draft.repeatedActivityEnabled !== originalDraft.repeatedActivityEnabled ||
    draft.elevatedRateEnabled !== originalDraft.elevatedRateEnabled ||
    draft.burstTrafficEnabled !== originalDraft.burstTrafficEnabled ||
    draft.repeatOffenderEnabled !== originalDraft.repeatOffenderEnabled ||
    draft.pathScanningEnabled !== originalDraft.pathScanningEnabled;

  const closeDrawer = () => {
    pendingTransitionRef.current = null;
    setProtectionModal(null);
    setSaveError("");
    setBlockedIpInput("");
    setTrustedIpInput("");
    setPendingRemoval(null);
    window.setTimeout(() => drawerOpenerRef.current?.focus?.(), 0);
  };

  const resumeProtectionModal = () => {
    if (protectionModal) {
      queueBotShieldModalShow(BOTSHIELD_PROTECTION_MODAL_ID);
    }
  };

  const handleProtectionModalAfterHide = () => {
    const transition = pendingTransitionRef.current;
    if (transition === "discard") {
      pendingTransitionRef.current = null;
      showBotShieldModal("botshield-protection-discard-modal");
      return;
    }
    if (transition === "remove-blocklist") {
      pendingTransitionRef.current = null;
      showBotShieldModal("botshield-blocklist-remove-modal");
      return;
    }
    if (transition === "remove-trusted") {
      pendingTransitionRef.current = null;
      showBotShieldModal("botshield-trusted-remove-modal");
      return;
    }
    if (transition === "open-policy") {
      pendingTransitionRef.current = null;
      const persisted = {
        autoBlock: model.autoBlock,
        strictMode: model.strictMode,
        blockLevel: model.blockLevel,
        repeatedActivityEnabled: model.repeatedActivityEnabled,
        elevatedRateEnabled: model.elevatedRateEnabled,
        burstTrafficEnabled: model.burstTrafficEnabled,
        repeatOffenderEnabled: model.repeatOffenderEnabled,
        pathScanningEnabled: model.pathScanningEnabled,
      };
      setDraft(persisted);
      setOriginalDraft(persisted);
      setSaveError("");
      setProtectionModal({
        type: "profile",
        title: "Protection policy",
        text: "Configure how BotShield responds to recorded storefront risk.",
        module: "policy",
        note:
          "This module uses BotShield's active protection profile. Changes below apply to future storefront decisions.",
      });
      window.setTimeout(
        () => queueBotShieldModalShow(BOTSHIELD_PROTECTION_MODAL_ID),
        0,
      );
      return;
    }

    if (!protectionModal || saving) return;

    if (dirty && protectionModal.type === "profile") {
      pendingTransitionRef.current = "discard";
      showBotShieldModal("botshield-protection-discard-modal");
      return;
    }

    closeDrawer();
  };

  const requestClose = () => {
    if (saving) return;
    if (dirty && protectionModal?.type === "profile") {
      pendingTransitionRef.current = "discard";
      hideBotShieldModal(BOTSHIELD_PROTECTION_MODAL_ID);
      return;
    }
    hideBotShieldModal(BOTSHIELD_PROTECTION_MODAL_ID);
  };

  const guardProfileDraft = () => {
    if (saving) return true;
    if (dirty && protectionModal?.type === "profile") {
      pendingTransitionRef.current = "discard";
      hideBotShieldModal(BOTSHIELD_PROTECTION_MODAL_ID);
      return true;
    }
    return false;
  };

  const requestVisitorRemoval = (ip, trusted) => {
    setPendingRemoval({ ip, trusted });
    pendingTransitionRef.current = trusted ? "remove-trusted" : "remove-blocklist";
    hideBotShieldModal(BOTSHIELD_PROTECTION_MODAL_ID);
  };

  const openPolicyFromNetwork = () => {
    pendingTransitionRef.current = "open-policy";
    hideBotShieldModal(BOTSHIELD_PROTECTION_MODAL_ID);
  };

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const persisted = await actions.saveSettings(draft);
      const savedDraft = {
        autoBlock: Boolean(persisted?.autoBlock ?? draft.autoBlock),
        strictMode: Boolean(persisted?.strictMode ?? draft.strictMode),
        blockLevel: persisted?.blockLevel || draft.blockLevel,
        repeatedActivityEnabled: persisted?.repeatedActivityEnabled !== false,
        elevatedRateEnabled: persisted?.elevatedRateEnabled !== false,
        burstTrafficEnabled: persisted?.burstTrafficEnabled !== false,
        repeatOffenderEnabled: persisted?.repeatOffenderEnabled !== false,
        pathScanningEnabled: persisted?.pathScanningEnabled !== false,
      };
      setDraft(savedDraft);
      setOriginalDraft(savedDraft);
      toast.success("Protection settings saved");
    } catch (error) {
      const message = toMerchantErrorMessage(
        error,
        "Couldn’t save protection settings",
      );
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  const openProfileManager = (title, text, note, module = "policy") => {
    if (guardProfileDraft()) return;
    drawerOpenerRef.current = document.activeElement;
    const persisted = {
      autoBlock: model.autoBlock,
      strictMode: model.strictMode,
      blockLevel: model.blockLevel,
      repeatedActivityEnabled: model.repeatedActivityEnabled,
      elevatedRateEnabled: model.elevatedRateEnabled,
      burstTrafficEnabled: model.burstTrafficEnabled,
      repeatOffenderEnabled: model.repeatOffenderEnabled,
      pathScanningEnabled: model.pathScanningEnabled,
    };
    setDraft(persisted);
    setOriginalDraft(persisted);
    setSaveError("");
    setProtectionModal({
      type: "profile",
      title,
      text,
      module,
      note:
        note ||
        "This module uses BotShield's active protection profile. Changes below apply to future storefront decisions.",
    });
  };

  const openStatusManager = (title, text, note, status, module) => {
    if (guardProfileDraft()) return;
    drawerOpenerRef.current = document.activeElement;
    setProtectionModal({
      type: "status",
      title,
      text,
      note,
      status,
      module,
    });
  };

  const storefrontConnected = hasStorefrontConnection(model);
  const runtimeActive = Boolean(model.protectionReady && !model.protectionPaused);
  const moduleStatus = runtimeActive
    ? { label: "Active", status: "active" }
    : model.protectionPaused
      ? { label: "Paused", status: "paused" }
      : { label: "Needs setup", status: "setup_required" };
  const pageStatus = storefrontConnected
    ? { label: model.protectionPaused ? "Paused" : "Connected", status: model.protectionPaused ? "paused" : "active" }
    : { label: "Needs setup", status: "setup_required" };
  const openBotProtectionModule = () =>
    openProfileManager(
      "Bot Protection",
      "Detects automated browsers and suspicious user-agent patterns.",
      undefined,
      "bot",
    );
  const openNetworkProtectionModule = () =>
    openStatusManager(
      "Network / Proxy Protection",
      "Uses VPN, proxy, datacenter, hosting provider, and ASN signals.",
          "Network / Proxy Protection is active when storefront traffic is evaluated. Network signal weighting follows your active protection profile.",
      moduleStatus,
      "network",
    );
  const openRateProtectionModule = () =>
    openProfileManager(
      "Rate Protection",
      "Flags unusually frequent visits from the same visitor pattern.",
      "Rate Protection uses the active protection profile. Adjust sensitivity and automated response below.",
      "rate",
    );
  const openPageProtectionModule = () =>
    openStatusManager(
      "Page Protection",
      "Redirects blocked visitors to BotShield's blocked page.",
      "Page Protection is active through the storefront theme embed and app proxy.",
      pageStatus,
      "page",
    );
  const protectionRows = [
    {
      icon: "shield",
      name: "Bot Protection",
      description: "Detects automated browsers and suspicious automation behavior.",
      configLabel: "Protection profile",
      configValue: model.strictMode ? "Strict" : model.blockLevel,
      ...moduleStatus,
      active: runtimeActive,
      action: openBotProtectionModule,
    },
    {
      icon: "network",
      name: "Network / Proxy Protection",
      description: "Identifies suspicious VPN, proxy, hosting, and datacenter traffic.",
      configLabel: "Detection",
      configValue: "Automatic",
      ...moduleStatus,
      active: runtimeActive,
      action: openNetworkProtectionModule,
    },
    {
      icon: "rate",
      name: "Rate Protection",
      description: "Detects unusually frequent or repetitive visitor activity.",
      configLabel: "Protection profile",
      configValue: model.strictMode ? "Strict" : model.blockLevel,
      ...moduleStatus,
      active: runtimeActive,
      action: openRateProtectionModule,
    },
    {
      icon: "page",
      name: "Page Protection",
      description: "Applies protection decisions across supported storefront requests.",
      configLabel: "Storefront connection",
      configValue: storefrontConnected ? "Theme embed" : "Not connected",
      ...pageStatus,
      active: storefrontConnected && !model.protectionPaused,
      action: openPageProtectionModule,
    },
  ];
  const activeProtections = protectionRows.filter((row) => row.active).length;
  const protectionHealthy = activeProtections === protectionRows.length;
  const effectiveThreshold = draft.strictMode
    ? 35
    : draft.blockLevel === "Low"
      ? 90
      : draft.blockLevel === "High"
        ? 50
        : 70;
  const interventionCount =
    Number(model.incidentCounts?.blocked || 0) +
    Number(model.incidentCounts?.challenged || 0);
  const openBlocklist = () => {
    if (guardProfileDraft()) return;
    drawerOpenerRef.current = document.activeElement;
    setBlockedIpInput("");
    setProtectionModal({
      type: "blocklist",
      title: "Blocked visitors",
      text: "Manage visitors manually prevented from accessing the storefront.",
    });
  };
  const openTrusted = () => {
    if (guardProfileDraft()) return;
    drawerOpenerRef.current = document.activeElement;
    setTrustedIpInput("");
    setProtectionModal({
      type: "trusted",
      title: "Trusted visitors",
      text: "Manage visitors allowed to bypass supported BotShield protection checks.",
    });
  };

  useEffect(() => {
    if (!model.protectionEntryIntent) return undefined;
    const intentOpeners = {
      blocklist: openBlocklist,
      trusted: openTrusted,
      bot: openBotProtectionModule,
      network: openNetworkProtectionModule,
      rate: openRateProtectionModule,
      page: openPageProtectionModule,
    };
    const openIntent = intentOpeners[model.protectionEntryIntent];
    if (!openIntent) return undefined;
    if (guardProfileDraft()) return undefined;
    openIntent();
    actions.clearProtectionEntryIntent?.();
    return undefined;
  }, [actions, dirty, model.protectionEntryIntent, protectionModal?.type]);

  if (model) {
    return (
      <BotShieldNativePage heading="Protection">
        <BotShieldPageShell className="botshield-protection-content">
        <section className={`botshield-protection-status ${protectionHealthy ? "is-healthy" : "is-attention"}`}>
          <div className="botshield-protection-status-icon"><OverviewIcon name="shield" centered /></div>
          <div>
            <span>Protection status</span>
            <h2>{protectionHealthy ? "Protection active" : "Protection needs attention"}</h2>
            <p>{model.protectionPaused ? "Protection is temporarily paused. Resume protection to restore storefront enforcement." : storefrontConnected ? "BotShield is evaluating storefront activity using your protection settings." : "Enable the theme app embed to enable full storefront coverage."}</p>
          </div>
          <div className="botshield-protection-status-action">
            <BotShieldStatusBadge status={protectionHealthy ? "active" : "setup_required"} label={`${activeProtections} of ${protectionRows.length} modules active`} />
            {!storefrontConnected ? <BotShieldActionButton onClick={actions.openThemeEditor} variant="primary">Review setup</BotShieldActionButton> : null}
          </div>
        </section>

        <section className="botshield-protection-section">
          <div className="botshield-protection-section-heading"><span>Protection modules</span><h2>Protection modules</h2><p>Configure the protection modules BotShield uses on your storefront.</p></div>
          <div className="botshield-protection-list">
            {protectionRows.map((row) => <div className="botshield-protection-row" key={row.name}>
              <div className="botshield-protection-module-icon"><OverviewIcon name={row.icon} centered /></div>
              <div className="botshield-protection-row-content">
                <div className="botshield-protection-row-title">{row.name}</div>
                <div className="botshield-protection-row-copy">{row.description}</div>
              </div>
              <div className="botshield-protection-row-config">
                <span>{row.configLabel}</span>
                <strong>{row.configValue}</strong>
              </div>
              <div className="botshield-protection-row-status"><BotShieldStatusBadge status={row.status} label={row.label} /></div>
              <div className="botshield-protection-row-action"><BotShieldActionButton onClick={row.action}>Manage</BotShieldActionButton></div>
            </div>)}
          </div>
        </section>

        <section className="botshield-protection-section">
          <div className="botshield-protection-section-heading"><span>Enforcement</span><h2>Protection policy</h2><p>Control how BotShield responds to suspicious storefront activity.</p></div>
          <div className="botshield-protection-policy">
            <div className="botshield-protection-policy-main">
              <div className="botshield-protection-policy-flow">
                <div><span>Detection</span><strong>{model.strictMode ? "Strict" : model.blockLevel} profile</strong><small>Storefront signals evaluated</small></div>
                <b aria-hidden="true">→</b>
                <div><span>Decision</span><strong>Risk classified</strong><small>Low, medium, or high</small></div>
                <b aria-hidden="true">→</b>
                <div><span>Action</span><strong>{model.autoBlock ? "Enforce" : "Record only"}</strong><small>{model.autoBlock ? "Apply configured response" : "Observe without intervention"}</small></div>
              </div>
              <p>BotShield evaluates threat signals, assigns risk, and applies your configured response.</p>
            </div>
            <div className="botshield-protection-policy-side">
              <div className="botshield-protection-policy-map"><div><BotShieldStatusBadge status="high" label="High risk" /><span>{model.autoBlock ? "Stop or request verification" : "Allow and record"}</span></div><div><BotShieldStatusBadge status="medium" label="Medium risk" /><span>{model.autoBlock ? "Request verification" : "Allow and record"}</span></div><div><BotShieldStatusBadge status="low" label="Low risk" /><span>Allow</span></div></div>
              <BotShieldActionButton onClick={() => openProfileManager("Protection policy", "Configure BotShield's shared storefront detection and response profile.")} variant="primary">Configure policy</BotShieldActionButton>
            </div>
          </div>
        </section>

        <section className="botshield-protection-section">
          <div className="botshield-protection-section-heading"><span>Access controls</span><h2>Visitor access</h2><p>Manage IP addresses BotShield should always block or trust.</p></div>
          <div className="botshield-protection-access-grid">
            <article><div className="botshield-protection-access-icon"><OverviewIcon name="block" centered /></div><div className="botshield-protection-access-content"><h3>Blocked visitors</h3><p>Visitors manually prevented from accessing the storefront.</p><div className="botshield-protection-access-count"><strong>{model.blockedIPs.length}</strong><span>Blocked visitor{model.blockedIPs.length === 1 ? "" : "s"}</span></div></div><BotShieldActionButton onClick={openBlocklist}>Manage blocklist</BotShieldActionButton></article>
            <article><div className="botshield-protection-access-icon"><OverviewIcon name="visitor" centered /></div><div className="botshield-protection-access-content"><h3>Trusted visitors</h3><p>Visitors allowed to bypass supported BotShield protection checks.</p><div className="botshield-protection-access-count"><strong>{model.whitelist.length}</strong><span>Trusted visitor{model.whitelist.length === 1 ? "" : "s"}</span></div></div><BotShieldActionButton onClick={openTrusted}>Manage trusted visitors</BotShieldActionButton></article>
          </div>
        </section>
        <BotShieldNativeModal
            heading={protectionModal?.title ?? "Protection"}
            id={BOTSHIELD_PROTECTION_MODAL_ID}
            onAfterHide={handleProtectionModalAfterHide}
            open={Boolean(protectionModal)}
            size={getProtectionModalSize(protectionModal?.type)}
            primaryAction={
              protectionModal?.type === "profile" ? (
                <s-button
                  slot="primary-action"
                  variant="primary"
                  loading={saving}
                  disabled={!dirty}
                  onClick={save}
                >
                  Save changes
                </s-button>
              ) : protectionModal?.type === "status" &&
                protectionModal.module === "network" ? (
                <s-button
                  slot="primary-action"
                  variant="primary"
                  onClick={openPolicyFromNetwork}
                >
                  Review protection policy
                </s-button>
              ) : protectionModal?.type === "status" &&
                protectionModal.module === "page" &&
                !storefrontConnected ? (
                <s-button
                  slot="primary-action"
                  variant="primary"
                  onClick={actions.openThemeEditor}
                >
                  Connect storefront
                </s-button>
              ) : null
            }
            secondaryActions={
              protectionModal?.type === "profile" ? (
                <s-button
                  slot="secondary-actions"
                  disabled={saving}
                  onClick={requestClose}
                >
                  Cancel
                </s-button>
              ) : (
                <s-button slot="secondary-actions" onClick={requestClose}>
                  Close
                </s-button>
              )
            }
          >
            {protectionModal ? (
              <s-paragraph className="botshield-protection-modal-intro" color="subdued">
                {protectionModal.text}
              </s-paragraph>
            ) : null}
            {protectionModal?.type === "profile" ? (
              <>
                {saveError ? (
                  <BotShieldBanner
                    tone="critical"
                    title={`Couldn't save ${protectionModal.title}`}
                  >
                    Your changes haven't been applied. {saveError}
                  </BotShieldBanner>
                ) : null}
                <span
                  aria-live="polite"
                  className="botshield-protection-modal-state"
                >
                  {saving
                    ? "Saving changes…"
                    : dirty
                      ? "Unsaved changes"
                      : "All changes saved"}
                </span>
                <section className="botshield-protection-drawer-section">
                  <div className="botshield-protection-drawer-section-label">
                    Protection level
                  </div>
                  <BotShieldSelect
                    label="Sensitivity"
                    value={draft.blockLevel}
                    details={
                      draft.blockLevel === "Low"
                        ? "Limits intervention to the clearest abuse signals."
                        : draft.blockLevel === "High"
                          ? "Applies the strongest supported detection profile."
                          : "Balanced detection intended for most storefronts."
                    }
                    onChange={(blockLevel) => {
                      setSaveError("");
                      setDraft((current) => ({
                        ...current,
                        blockLevel,
                        strictMode:
                          blockLevel !== "High" ? false : current.strictMode,
                      }));
                    }}
                    options={[
                      { label: "Low — fewer interventions", value: "Low" },
                      { label: "Medium — balanced protection", value: "Medium" },
                      { label: "High — strict protection", value: "High" },
                    ]}
                  />
                </section>
                <section className="botshield-protection-drawer-section">
                  <div className="botshield-protection-drawer-section-label">
                    Automation
                  </div>
                  <BotShieldToggle
                    label="Auto Block"
                    details="Automatically block visitors that exceed your risk threshold."
                    checked={draft.autoBlock}
                    onChange={(autoBlock) => {
                      setSaveError("");
                      setDraft((current) => ({ ...current, autoBlock }));
                    }}
                  />
                  <BotShieldToggle
                    label="Strict Mode"
                    details="Use High sensitivity and the strongest available rule profile."
                    checked={draft.strictMode}
                    onChange={(strictMode) => {
                      setSaveError("");
                      setDraft((current) => ({
                        ...current,
                        strictMode,
                        autoBlock: strictMode ? true : current.autoBlock,
                        blockLevel: strictMode ? "High" : current.blockLevel,
                      }));
                    }}
                  />
                </section>
                <section className="botshield-protection-drawer-section">
                  <div className="botshield-protection-drawer-section-label">
                    Effective enforcement
                  </div>
                  <div className="botshield-protection-decision-preview">
                    <div>
                      <span>Risk threshold</span>
                      <strong>{effectiveThreshold} / 100</strong>
                    </div>
                    <div>
                      <span>Response</span>
                      <strong>
                        {draft.autoBlock ? "Block matching traffic" : "Record only"}
                      </strong>
                    </div>
                  </div>
                  <p className="botshield-protection-drawer-explanation">
                    {draft.autoBlock
                      ? `Requests scoring ${effectiveThreshold} or higher are stopped by the active policy.`
                      : "Suspicious requests are recorded, but automated blocking is disabled."}
                  </p>
                </section>
                <section className="botshield-protection-drawer-section">
                  <div className="botshield-protection-drawer-section-label">
                    {protectionModal.module === "rate"
                      ? "Rate signals"
                      : protectionModal.module === "bot"
                        ? "Bot signals"
                        : "Decision flow"}
                  </div>
                  {protectionModal.module === "rate" ? (
                    <>
                      <p className="botshield-protection-signal-note">
                        Choose which behavioral signals contribute to a visitor’s
                        risk score. Changes apply after you save.
                      </p>
                      <div
                        aria-label="Rate Protection controls"
                        className="botshield-protection-rate-controls"
                      >
                        <BotShieldToggle
                          label="Repeated activity"
                          details="Adds 8 risk points after 3 recent requests from the same IP within one hour."
                          checked={draft.repeatedActivityEnabled}
                          onChange={(repeatedActivityEnabled) =>
                            setDraft((current) => ({
                              ...current,
                              repeatedActivityEnabled,
                            }))
                          }
                        />
                        <BotShieldToggle
                          label="Elevated request rate"
                          details="Adds 20 risk points after 6 recent requests from the same IP within one hour."
                          checked={draft.elevatedRateEnabled}
                          onChange={(elevatedRateEnabled) =>
                            setDraft((current) => ({
                              ...current,
                              elevatedRateEnabled,
                            }))
                          }
                        />
                        <BotShieldToggle
                          label="Burst traffic"
                          details="Adds 40 risk points after 12 recent requests from the same IP within one hour."
                          checked={draft.burstTrafficEnabled}
                          onChange={(burstTrafficEnabled) =>
                            setDraft((current) => ({
                              ...current,
                              burstTrafficEnabled,
                            }))
                          }
                        />
                        <BotShieldToggle
                          label="Repeat offender"
                          details="Adds risk when the visitor was previously blocked; 3 previous blocks apply the stronger signal."
                          checked={draft.repeatOffenderEnabled}
                          onChange={(repeatOffenderEnabled) =>
                            setDraft((current) => ({
                              ...current,
                              repeatOffenderEnabled,
                            }))
                          }
                        />
                        <BotShieldToggle
                          label="Multi-page scanning"
                          details="Adds risk when the same visitor rapidly accesses 5 or more distinct storefront paths."
                          checked={draft.pathScanningEnabled}
                          onChange={(pathScanningEnabled) =>
                            setDraft((current) => ({
                              ...current,
                              pathScanningEnabled,
                            }))
                          }
                        />
                      </div>
                    </>
                  ) : protectionModal.module === "bot" ? (
                    <div className="botshield-protection-signal-list">
                      <div>
                        <strong>Known automation</strong>
                        <span>Recognized bot-style user agents</span>
                      </div>
                      <div>
                        <strong>Automation signatures</strong>
                        <span>Headless browsers and scripted request tools</span>
                      </div>
                      <div>
                        <strong>Request integrity</strong>
                        <span>Missing user-agent or IP information</span>
                      </div>
                      <div>
                        <strong>Scanning behavior</strong>
                        <span>Repeated access across multiple storefront paths</span>
                      </div>
                    </div>
                  ) : (
                    <div className="botshield-protection-signal-list">
                      <div>
                        <strong>Detect</strong>
                        <span>Evaluate recorded storefront and network signals</span>
                      </div>
                      <div>
                        <strong>Classify</strong>
                        <span>Assign low, medium, or high risk</span>
                      </div>
                      <div>
                        <strong>Enforce</strong>
                        <span>Allow, request verification, or stop the request</span>
                      </div>
                    </div>
                  )}
                </section>
                <section className="botshield-protection-drawer-section botshield-protection-drawer-section--compact">
                  <div className="botshield-protection-drawer-section-label">
                    Verified activity · Last 30 days
                  </div>
                  <div className="botshield-protection-drawer-metrics">
                    <div>
                      <strong>{Number(model.incidentCounts?.blocked || 0)}</strong>
                      <span>Blocked</span>
                    </div>
                    <div>
                      <strong>{Number(model.incidentCounts?.challenged || 0)}</strong>
                      <span>Challenged</span>
                    </div>
                    <div>
                      <strong>{interventionCount}</strong>
                      <span>Interventions</span>
                    </div>
                  </div>
                </section>
                <BotShieldInlineHelp>{protectionModal.note}</BotShieldInlineHelp>
              </>
            ) : null}
            {protectionModal?.type === "blocklist" ? (
              <IpList
                addLabel="Add IP"
                emptyTitle="No blocked visitors yet."
                onAdd={async () => {
                  await actions.addBlockedIp(blockedIpInput);
                  setBlockedIpInput("");
                }}
                onChange={setBlockedIpInput}
                onRemove={actions.removeBlockedIp}
                onRequestRemove={(ip) => requestVisitorRemoval(ip, false)}
                rows={model.blockedIPs}
                subtitle="Manually block known abusive IP addresses."
                title="IP blocklist"
                value={blockedIpInput}
              />
            ) : null}
            {protectionModal?.type === "trusted" ? (
              <IpList
                addLabel="Trust visitor"
                emptyTitle="No trusted visitors yet."
                onAdd={async () => {
                  await actions.addTrustedIp(trustedIpInput);
                  setTrustedIpInput("");
                }}
                onChange={setTrustedIpInput}
                onRemove={actions.removeTrustedIp}
                onRequestRemove={(ip) => requestVisitorRemoval(ip, true)}
                rows={model.whitelist}
                subtitle="Allow known safe visitors, admins, agencies, and reviewed customers to bypass automated blocking."
                title="Trusted visitors"
                value={trustedIpInput}
              />
            ) : null}
            {protectionModal?.type === "status" ? (
              <>
                <section className="botshield-protection-drawer-section">
                  <div className="botshield-protection-drawer-section-label">
                    Current status
                  </div>
                  <div className="botshield-protection-current-status">
                    <BotShieldStatusBadge
                      label={protectionModal.status?.label || "Monitoring"}
                      status={protectionModal.status?.status || "monitoring_only"}
                    />
                    <span>{protectionModal.note}</span>
                  </div>
                </section>
                {protectionModal.module === "network" ? (
                  <>
                    <section className="botshield-protection-drawer-section">
                      <div className="botshield-protection-drawer-section-label">
                        Signals evaluated
                      </div>
                      <div className="botshield-protection-signal-list">
                        <div>
                          <strong>VPN / Proxy</strong>
                          <span>Known anonymizing network classifications</span>
                        </div>
                        <div>
                          <strong>Hosting / Datacenter</strong>
                          <span>Traffic originating from hosted infrastructure</span>
                        </div>
                        <div>
                          <strong>Network reputation</strong>
                          <span>Provider and ASN risk signals where available</span>
                        </div>
                      </div>
                    </section>
                    <BotShieldInlineHelp>
                      Network signals contribute to the risk score. They do not
                      identify a visitor's exact location.
                    </BotShieldInlineHelp>
                  </>
                ) : (
                  <>
                    <section className="botshield-protection-drawer-section">
                      <div className="botshield-protection-drawer-section-label">
                        Sensitive storefront paths
                      </div>
                      <div className="botshield-protection-path-grid">
                        {[
                          "Account",
                          "Login",
                          "Cart",
                          "Checkout",
                          "Admin",
                          "API routes",
                        ].map((path) => (
                          <span key={path}>{path}</span>
                        ))}
                      </div>
                    </section>
                    <BotShieldInlineHelp>
                      These paths contribute to sensitive-path threat signals when
                      accessed. Storefront enforcement applies broadly through the
                      theme app embed and app proxy.
                    </BotShieldInlineHelp>
                  </>
                )}
              </>
            ) : null}
          </BotShieldNativeModal>
        <BotShieldConfirmationModal
          confirmLabel="Discard changes"
          heading="Discard unsaved changes?"
          id="botshield-protection-discard-modal"
          onConfirm={async () => {
            setDraft(originalDraft);
            closeDrawer();
          }}
          onDismiss={resumeProtectionModal}
          tone="critical"
        >
          Your changes haven't been saved. Keep editing or discard them.
        </BotShieldConfirmationModal>
        <BotShieldConfirmationModal
          confirmLabel="Remove"
          heading="Remove blocked visitor?"
          id="botshield-blocklist-remove-modal"
          onConfirm={async () => {
            if (!pendingRemoval?.ip) return;
            await actions.removeBlockedIp(pendingRemoval.ip);
            setPendingRemoval(null);
            resumeProtectionModal();
          }}
          onDismiss={() => {
            setPendingRemoval(null);
            resumeProtectionModal();
          }}
          tone="critical"
        >
          This visitor will no longer be manually blocked.
        </BotShieldConfirmationModal>
        <BotShieldConfirmationModal
          confirmLabel="Remove"
          heading="Remove trusted visitor?"
          id="botshield-trusted-remove-modal"
          onConfirm={async () => {
            if (!pendingRemoval?.ip) return;
            await actions.removeTrustedIp(pendingRemoval.ip);
            setPendingRemoval(null);
            resumeProtectionModal();
          }}
          onDismiss={() => {
            setPendingRemoval(null);
            resumeProtectionModal();
          }}
          tone="critical"
        >
          This visitor will no longer be manually trusted.
        </BotShieldConfirmationModal>
      </BotShieldPageShell>
      </BotShieldNativePage>
    );
  }

  return (
    <Screen
      title="Protection Rules"
      subtitle="Choose how BotShield monitors, verifies, and stops risky storefront visitors."
    >
      <BotShieldSaveState
        id="botshield-protection-save-bar"
        dirty={dirty}
        saving={saving}
        error={saveError}
        onSave={save}
        onDiscard={() =>
          setDraft({
            autoBlock: model.autoBlock,
            strictMode: model.strictMode,
            blockLevel: model.blockLevel,
          })
        }
      />
      <ProtectionPolicySummary
        model={model}
        draft={draft}
        setDraft={setDraft}
        actions={actions}
      />
      <HelpStrip model={model} actions={actions} />
      <s-grid gridTemplateColumns="1fr" gap="large">
        <s-stack gap="small">
          <s-heading>Protection mode</s-heading>
          <s-paragraph color="subdued">
            Start with a recommended profile, then fine-tune sensitivity if needed.
          </s-paragraph>
        </s-stack>
        <BotShieldCard>
          <s-grid
            gridTemplateColumns="repeat(auto-fit, minmax(190px, 1fr))"
            gap="base"
          >
            <ProtectionModeCard
              title="Relaxed"
              description="Allow most visitors. Best for stores that only want to stop obvious automated abuse."
              selected={
                draft.blockLevel === "Low" &&
                !draft.strictMode &&
                !draft.autoBlock
              }
              onSelect={() =>
                setDraft((current) => ({
                  ...current,
                  blockLevel: "Low",
                  strictMode: false,
                  autoBlock: false,
                }))
              }
            />
            <ProtectionModeCard
              title="Balanced"
              description="Recommended for most stores. Blocks suspicious behavior while reducing false positives."
              selected={
                draft.blockLevel === "Medium" &&
                !draft.strictMode &&
                draft.autoBlock
              }
              onSelect={() =>
                setDraft((current) => ({
                  ...current,
                  blockLevel: "Medium",
                  strictMode: false,
                  autoBlock: true,
                }))
              }
            />
            <ProtectionModeCard
              title="Strict"
              description="Responds aggressively to risky traffic. Use when suspicious activity is elevated."
              selected={draft.blockLevel === "High" && draft.strictMode}
              onSelect={() =>
                setDraft((current) => ({
                  ...current,
                  blockLevel: "High",
                  strictMode: true,
                  autoBlock: true,
                }))
              }
            />
          </s-grid>
        </BotShieldCard>

        <s-grid
          gridTemplateColumns="minmax(220px, 1fr) minmax(0, 2fr)"
          gap="large"
        >
          <s-stack gap="small">
            <s-heading>Automated response</s-heading>
            <s-paragraph color="subdued">
              Temporarily pause blocking while reviewing a possible false
              positive. Event collection continues.
            </s-paragraph>
          </s-stack>
          <BotShieldCard
            title={
              model.protectionPaused
                ? "Automated response is paused"
                : "Automated response is active"
            }
            subtitle={
              model.protectionPaused
                ? "BotShield is still recording decisions, but new automated blocks are paused."
                : "BotShield can respond to suspicious storefront visitors based on the selected profile."
            }
            badge={
              <BotShieldStatusBadge
                status={
                  model.protectionPaused ? "paused" : getResponseMode(draft).status
                }
                label={
                  model.protectionPaused ? "Paused" : getResponseMode(draft).label
                }
              />
            }
            actions={
              model.protectionPaused ? (
                <BotShieldAsyncButton
                  action={actions.resumeProtection}
                  successMessage="Protection resumed"
                  variant="primary"
                >
                  Resume protection
                </BotShieldAsyncButton>
              ) : (
                <BotShieldAsyncButton
                  action={() => actions.pauseProtection(10)}
                  successMessage="Protection paused for 10 minutes"
                >
                  Pause for 10 minutes
                </BotShieldAsyncButton>
              )
            }
          />
        </s-grid>

        <s-stack gap="small">
          <s-heading>Active protections</s-heading>
          <s-paragraph color="subdued">
            Storefront signals BotShield uses today to evaluate visitor risk.
          </s-paragraph>
        </s-stack>
        <BotShieldCard>
          <s-grid
            gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))"
            gap="base"
          >
            <RuleSummaryCard
              title="Bot Protection"
              status="active"
              count="Active"
              description="Detects automated browsers and suspicious user-agent patterns."
            />
            <RuleSummaryCard
              title="IP address blocklist"
              status="active"
              count={model.blockedIPs.length}
              description={`${model.blockedIPs.length} blocked visitor${model.blockedIPs.length === 1 ? "" : "s"} from automatic or merchant decisions.`}
              action={
                <BotShieldActionButton
                  onClick={() =>
                    setProtectionModal({
                      type: "blocklist",
                      title: "IP blocklist",
                      text: "Manually block known abusive IP addresses.",
                    })
                  }
                >
                  Manage blocklist
                </BotShieldActionButton>
              }
            />
            <RuleSummaryCard
              title="Trusted visitors"
              status="active"
              count={model.whitelist.length}
              description={`${model.whitelist.length} trusted visitor${model.whitelist.length === 1 ? "" : "s"} can bypass automated blocks.`}
              action={
                <BotShieldActionButton
                  onClick={() =>
                    setProtectionModal({
                      type: "trusted",
                      title: "Trusted visitors",
                      text: "Allow known safe visitors, admins, agencies, and reviewed customers to bypass automated blocking.",
                    })
                  }
                >
                  Manage trusted list
                </BotShieldActionButton>
              }
            />
            <RuleSummaryCard
              title="Network / Proxy Protection"
              status="active"
              count="Enabled"
              description="Uses VPN, proxy, datacenter, hosting provider, and ASN signals."
            />
            <RuleSummaryCard
              title="Rate Protection"
              status="active"
              count="Active"
              description="Flags unusually frequent visits from the same visitor pattern."
            />
            <RuleSummaryCard
              title="Page Protection"
              status="active"
              count="Configured"
              description="Stopped visitors are redirected to BotShield's app-proxy blocked page."
            />
          </s-grid>
          <s-box paddingBlockStart="base">
            <BotShieldInlineHelp>
              BotShield protects JavaScript-enabled storefront visits through the
              theme app embed and Shopify app proxy.
            </BotShieldInlineHelp>
          </s-box>
        </BotShieldCard>

        <s-stack gap="small">
          <s-heading>Detection sensitivity</s-heading>
          <s-paragraph color="subdued">
            Fine-tune how much suspicious behavior is required before BotShield
            responds.
          </s-paragraph>
        </s-stack>
        <BotShieldCard>
          <s-stack gap="large">
            <BotShieldSelect
              label="Sensitivity"
              value={draft.blockLevel}
              onChange={(blockLevel) =>
                setDraft((current) => ({ ...current, blockLevel }))
              }
              options={[
                { label: "Low — obvious abuse only", value: "Low" },
                { label: "Medium — balanced protection", value: "Medium" },
                { label: "High — aggressive protection", value: "High" },
              ]}
            />
            <BotShieldToggle
              label="Auto Block"
              details="Automatically block visitors that exceed your risk threshold."
              checked={draft.autoBlock}
              onChange={(autoBlock) =>
                setDraft((current) => ({ ...current, autoBlock }))
              }
            />
            <BotShieldToggle
              label="Strict Mode"
              details="Use High sensitivity and the strongest available rule profile."
              checked={draft.strictMode}
              onChange={(strictMode) =>
                setDraft((current) => ({
                  ...current,
                  strictMode,
                  autoBlock: strictMode ? true : current.autoBlock,
                  blockLevel: strictMode ? "High" : current.blockLevel,
                }))
              }
            />
            <BotShieldInlineHelp>
              Low responds only to obvious abuse. Medium balances protection and
              false-positive risk. High responds to more suspicious automation.
              Strict Mode applies the strongest profile.
            </BotShieldInlineHelp>
          </s-stack>
        </BotShieldCard>

        <s-stack gap="small">
          <s-heading>Network / Proxy Protection</s-heading>
          <s-paragraph color="subdued">
            Use enriched network data to explain suspicious storefront activity.
          </s-paragraph>
        </s-stack>
        <BotShieldCard
          badge={<BotShieldStatusBadge status="active" label="Enabled" />}
        >
          <s-stack gap="base">
            <s-text>
              VPN, proxy, datacenter, hosting provider, and ASN signals
              contribute to real storefront risk scores.
            </s-text>
            <BotShieldInlineHelp>
              Network / Proxy Protection signals are approximate and do not identify a
              visitor’s exact physical location.
            </BotShieldInlineHelp>
          </s-stack>
        </BotShieldCard>

        <s-stack gap="small">
          <s-heading>Diagnostics</s-heading>
          <s-paragraph color="subdued">
            Test the decision engine without adding data to real storefront
            protection metrics.
          </s-paragraph>
        </s-stack>
        <BotShieldCard>
          <s-stack gap="base">
            <s-stack direction="inline" gap="small">
              <BotShieldAsyncButton
                action={actions.runDiagnostic}
                successMessage="Diagnostic completed"
                variant="primary"
              >
                Run diagnostic
              </BotShieldAsyncButton>
              <BotShieldAsyncButton
                action={actions.runSimulation}
                successMessage="Simulation recorded"
              >
                Record simulation
              </BotShieldAsyncButton>
            </s-stack>
            <s-text color="subdued">
              Latest result: {model.result} · Last run: {model.lastScanTime}
            </s-text>
          </s-stack>
        </BotShieldCard>
      </s-grid>
    </Screen>
  );
}

function VisitorAccessRecord({
  ip,
  reason,
  source,
  time,
  trusted,
  onRemove,
}) {
  const detail = reason || (trusted
    ? "Allowed through automated protection after review."
    : "Stopped before continuing through the storefront.");
  const showUpdated = Boolean(time && time !== "Unknown");

  return (
    <article className="botshield-visitor-access-record">
      <div className="botshield-visitor-access-record-top">
        <div className="botshield-visitor-access-record-identity">
          <span className="botshield-visitor-access-record-ip">{ip}</span>
          <BotShieldStatusBadge status={trusted ? "active" : "blocked"} />
        </div>
        <div className="botshield-visitor-access-record-action">
          <BotShieldActionButton onClick={onRemove} tone="critical">
            Remove
          </BotShieldActionButton>
        </div>
      </div>
      <p className="botshield-visitor-access-record-detail">{detail}</p>
      {source || showUpdated ? (
        <div className="botshield-visitor-access-record-meta">
          {source ? <span>Source: {source}</span> : null}
          {showUpdated ? <span>Updated: {time}</span> : null}
        </div>
      ) : null}
    </article>
  );
}

function IpList({
  title,
  subtitle,
  rows,
  value,
  onChange,
  onAdd,
  onRemove,
  onRequestRemove,
  addLabel,
  emptyTitle,
}) {
  const [filterValue, setFilterValue] = useState("");
  const trusted = title.toLowerCase().includes("trusted");
  const trimmedValue = value.trim();
  const validIp = !trimmedValue || isValidIpAddressInput(trimmedValue);
  const duplicateIp = Boolean(
    trimmedValue &&
      rows.some((row) =>
        (typeof row === "string" ? row : row.ip)
          ?.trim()
          .toLowerCase() === trimmedValue.toLowerCase(),
      ),
  );
  const listLabel = trusted ? "trusted list" : "blocklist";
  const emptyDescription = trusted
    ? "Add admins, agency partners, or reviewed customers who should bypass automated blocking."
    : "Add confirmed abusive sources only. BotShield will stop matching visitors when storefront protection runs.";
  const normalizedFilter = filterValue.trim().toLowerCase();
  const filteredRows = normalizedFilter
    ? rows.filter((row) => {
        const record = typeof row === "string" ? { ip: row } : row;
        return [record.ip, record.reason, record.source, record.action]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(normalizedFilter));
      })
    : rows;

  return (
    <s-stack className="botshield-ip-list" gap="large">
      <s-stack gap="small">
        <s-heading>{title}</s-heading>
        <s-paragraph color="subdued">{subtitle}</s-paragraph>
      </s-stack>
      <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="base">
        <s-box>
          <BotShieldTextField
            label="IP address"
            value={value}
            onChange={onChange}
            placeholder="203.0.113.10"
            error={
              !validIp
                ? "Enter a valid IPv4 or IPv6 address"
                : duplicateIp
                  ? `This IP address is already on the ${listLabel}`
                  : ""
            }
          />
        </s-box>
        <s-stack alignItems="end" justifyContent="end">
          <BotShieldAsyncButton
            action={onAdd}
            successMessage={`${title} updated`}
            variant="primary"
            disabled={!trimmedValue || !validIp || duplicateIp}
          >
            {addLabel}
          </BotShieldAsyncButton>
        </s-stack>
      </s-grid>
      {rows.length ? (
        <s-stack>
          <BotShieldTextField
            label={`Search ${trusted ? "trusted visitors" : "blocked visitors"}`}
            value={filterValue}
            onChange={setFilterValue}
            placeholder="IP address, source, or reason"
          />
          <div className="botshield-protection-access-summary">
            <strong>{filteredRows.length}</strong>
            <span>{filteredRows.length === 1 ? "matching visitor" : "matching visitors"}</span>
          </div>
          <div className="botshield-visitor-access-list">
          {filteredRows.map((row) => {
            const ip = typeof row === "string" ? row : row.ip;
            const record = typeof row === "string" ? {} : row;
            return (
              <VisitorAccessRecord
                ip={ip}
                key={ip}
                onRemove={() => onRequestRemove?.(ip)}
                reason={record.reason}
                source={record.source}
                time={record.time}
                trusted={trusted}
              />
            );
          })}
          </div>
          {!filteredRows.length ? (
            <div className="botshield-protection-filter-empty">
              <strong>No matching visitors</strong>
              <span>Try a different IP address, source, or reason.</span>
            </div>
          ) : null}
        </s-stack>
      ) : (
        <BotShieldEmptyState
          title={emptyTitle}
          description={emptyDescription}
        />
      )}
      <BotShieldInlineHelp>
        Changes to the {listLabel} are saved immediately and apply to future
        storefront decisions.
      </BotShieldInlineHelp>
    </s-stack>
  );
}

function getSimulationCount(model) {
  if (Array.isArray(model?.simulatedScans)) return model.simulatedScans.length;
  const parsed = Number(model?.simulatedScans);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatSimulationLabel(model) {
  const count = getSimulationCount(model);
  if (count <= 0) return "No simulated activity";
  return `${count.toLocaleString()} simulated event${count === 1 ? "" : "s"}`;
}

const BOTSHIELD_PUBLIC_PLAN_FEATURES = [
  "Bot Protection",
  "Network / Proxy Protection",
  "Rate Protection",
  "Page Protection",
  "IP blocklist",
  "Trusted visitors",
  "Fraud order review (coming soon)",
  "Storefront analytics",
];

function getTrialDaysRemaining(trialEndsAt) {
  if (!trialEndsAt) return null;
  const end = new Date(trialEndsAt).getTime();
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000)));
}

function getSettingsBillingView(billingStatus = {}) {
  const configuredPlanName =
    String(billingStatus.planName || "").trim() || "BotShield Basic";
  const monthlyPrice = Number.isFinite(Number(billingStatus.monthlyPrice))
    ? Number(billingStatus.monthlyPrice)
    : 14.99;
  const trialDays = Number.isFinite(Number(billingStatus.trialDays))
    ? Number(billingStatus.trialDays)
    : 7;
  const subscription = billingStatus.subscription || null;
  const active = Boolean(billingStatus.active);
  const statusModel = getBillingStatusModel(billingStatus);
  const trialRemaining = getTrialDaysRemaining(subscription?.trialEndsAt);
  const isTestPlan = Boolean(
    subscription?.test || subscription?.isTest || billingStatus.test,
  );
  const priceLabel = `$${monthlyPrice.toFixed(2)}/month`;

  const currentPlanLabel = active
    ? subscription?.name || billingStatus.planName || configuredPlanName
    : statusModel.label;

  let currentPlanDetail = statusModel.description;
  if (active) {
    currentPlanDetail = priceLabel;
    if (subscription?.trial) {
      if (trialRemaining !== null && trialRemaining > 0) {
        currentPlanDetail += ` · ${trialRemaining} trial day${
          trialRemaining === 1 ? "" : "s"
        } left`;
      } else {
        currentPlanDetail += ` · ${trialDays}-day trial`;
      }
    }
    if (subscription?.currentPeriodEnd) {
      currentPlanDetail += ` · Renews ${formatDate(subscription.currentPeriodEnd)}`;
    }
  }

  const isCurrentPublicPlan = active && !isTestPlan;

  const currentPlanTone = active
    ? isTestPlan
      ? "monitor"
      : "healthy"
    : statusModel.tone === "critical"
      ? "warning"
      : "neutral";

  return {
    configuredPlanName,
    monthlyPrice,
    trialDays,
    priceLabel,
    subscription,
    active,
    statusModel,
    trialRemaining,
    currentPlanLabel,
    currentPlanDetail,
    isCurrentPublicPlan,
    isTestPlan,
    currentPlanTone,
    pricingUrl: billingStatus.pricingUrl || null,
    configured: Boolean(billingStatus.configured),
    error: billingStatus.error || null,
    checkedAt: billingStatus.checkedAt || null,
  };
}

function getSettingsBillingPlans(billingStatus = {}) {
  const billing = getSettingsBillingView(billingStatus);

  return [
    {
      id: "basic",
      name: billing.configuredPlanName,
      monthlyPrice: billing.monthlyPrice,
      trialDays: billing.trialDays,
      description:
        "Storefront bot protection, enforcement, alerts, and analytics for one Shopify store.",
      features: BOTSHIELD_PUBLIC_PLAN_FEATURES,
      isCurrent: billing.isCurrentPublicPlan,
    },
  ];
}

function getSettingsBillingTrialLabel(billing) {
  if (billing.active && billing.subscription?.trial) {
    if (billing.trialRemaining !== null && billing.trialRemaining > 0) {
      return `${billing.trialRemaining} day${
        billing.trialRemaining === 1 ? "" : "s"
      } remaining`;
    }
    return `${billing.trialDays}-day trial active`;
  }
  if (billing.active) {
    return "Trial complete";
  }
  return `${billing.trialDays}-day trial available`;
}

function getSettingsOperationalStrip(model) {
  const responseMode = getResponseMode(model);
  const storefrontConnected = hasStorefrontConnection(model);
  const receivingTraffic = Boolean(model.protectionStatus?.storefrontReportingActive);
  const alertsEnabled = Boolean(
    model.emailAlerts && model.emailProviderConfigured && model.alertEmail,
  );

  return [
    {
      label: "Protection",
      value: model.protectionPaused ? "Paused" : responseMode.label,
      tone: model.protectionPaused
        ? "warning"
        : responseMode.status === "active"
          ? "healthy"
          : "monitor",
    },
    {
      label: "Storefront",
      value: storefrontConnected ? "Connected" : "Setup required",
      tone: storefrontConnected ? "healthy" : "warning",
    },
    {
      label: "Traffic",
      value: receivingTraffic ? "Receiving" : "Waiting",
      tone: receivingTraffic ? "healthy" : "warning",
    },
    {
      label: "Alerts",
      value: alertsEnabled ? "Enabled" : model.emailAlerts ? "Needs setup" : "Off",
      tone: alertsEnabled ? "healthy" : model.emailAlerts ? "warning" : "neutral",
    },
  ];
}

function SettingsHubIcon({ name }) {
  const icons = {
    general: "gauge",
    billing: "page",
    notifications: "clock",
    reports: "page",
    connections: "connect",
    privacy: "shield-check-mark",
    diagnostics: "chart-line",
    danger: "shield-pending",
    shield: "shield-check-mark",
    activity: "chart-line",
    link: "connect",
    lock: "shield-check-mark",
    warning: "shield-pending",
    diagnostic: "gauge",
    privacyRow: "shield-check-mark",
    connection: "globe-lines",
    email: "connect",
  };
  return (
    <span className="botshield-v2-icon" aria-hidden="true">
      <s-icon type={icons[name] || "gauge"} size="small" color="subdued" />
    </span>
  );
}

function SettingsOperationalDot({ tone = "neutral" }) {
  const healthTone =
    tone === "healthy"
      ? "is-healthy"
      : tone === "warning" || tone === "monitor"
        ? "is-attention"
        : "";
  return (
    <span
      className={`botshield-v2-health-dot${healthTone ? ` ${healthTone}` : ""}`}
      aria-hidden="true"
    />
  );
}

function SettingsHubStatusPill({ label, tone = "neutral" }) {
  const pillTone =
    tone === "healthy"
      ? "is-healthy"
      : tone === "warning" || tone === "monitor"
        ? "is-attention"
        : "is-neutral";
  const dotTone =
    tone === "healthy"
      ? "healthy"
      : tone === "warning" || tone === "monitor"
        ? tone === "monitor"
          ? "monitor"
          : "warning"
        : "neutral";
  return (
    <span className={`botshield-settings-hub-status-pill ${pillTone}`}>
      <SettingsOperationalDot tone={dotTone} />
      {label}
    </span>
  );
}

function SettingsHubRow({
  title,
  description,
  control,
  muted = false,
  variant = "default",
  icon,
  lead,
}) {
  return (
    <div
      className={`botshield-settings-hub-row${muted ? " is-muted" : ""} is-${variant}${
        icon ? " has-icon" : ""
      }`}
    >
      {icon ? (
        <div className="botshield-settings-hub-row-icon">
          <SettingsHubIcon name={icon} />
        </div>
      ) : null}
      <div className="botshield-settings-hub-row-copy">
        {lead ? <span className="botshield-settings-hub-row-eyebrow">{lead}</span> : null}
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="botshield-settings-hub-row-control">{control}</div>
    </div>
  );
}

function SettingsHubSection({ eyebrow, title, description, children, panel = "default" }) {
  return (
    <section className={`botshield-settings-hub-section is-panel-${panel}`}>
      <header className="botshield-settings-hub-section-head">
        {eyebrow ? <span className="botshield-v2-eyebrow">{eyebrow}</span> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </header>
      <div className={`botshield-settings-hub-group is-${panel}`}>{children}</div>
    </section>
  );
}

const SETTINGS_HUB_SECTIONS = [
  { id: "general", label: "General" },
  { id: "billing", label: "Plans & billing" },
  { id: "notifications", label: "Notifications" },
  { id: "reports", label: "Reports" },
  { id: "connections", label: "Connections" },
  { id: "privacy", label: "Data & privacy" },
  { id: "diagnostics", label: "App & diagnostics" },
  { id: "danger", label: "Danger zone" },
];

function readSettingsHubSection() {
  if (typeof window === "undefined") return "general";
  const section = new URLSearchParams(window.location.search).get("section");
  return SETTINGS_HUB_SECTIONS.some((item) => item.id === section)
    ? section
    : "general";
}

function SettingsPage({ model, actions }) {
  const toast = useBotShieldToast();
  const [clearingSimulation, setClearingSimulation] = useState(false);
  const [activeSection, setActiveSection] = useState(readSettingsHubSection);
  const [draft, setDraft] = useState({
    alertEmail: model.alertEmail,
    emailAlerts: model.emailAlerts,
    highRiskAlertsOnly: model.highRiskAlertsOnly,
    weeklyReportsEnabled: model.weeklyReportsEnabled,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [billingRefreshError, setBillingRefreshError] = useState("");
  const [diagnosticsError, setDiagnosticsError] = useState("");

  useEffect(() => {
    setDraft({
      alertEmail: model.alertEmail,
      emailAlerts: model.emailAlerts,
      highRiskAlertsOnly: model.highRiskAlertsOnly,
      weeklyReportsEnabled: model.weeklyReportsEnabled,
    });
  }, [
    model.alertEmail,
    model.emailAlerts,
    model.highRiskAlertsOnly,
    model.weeklyReportsEnabled,
  ]);

  useEffect(() => {
    const syncSectionFromUrl = () => setActiveSection(readSettingsHubSection());
    window.addEventListener("popstate", syncSectionFromUrl);
    return () => window.removeEventListener("popstate", syncSectionFromUrl);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const params = new URLSearchParams(window.location.search);
    if (params.get("updated") !== "true") return undefined;
    if (readSettingsHubSection() !== "billing") return undefined;

    let cancelled = false;
    const refreshAfterReturn = async () => {
      try {
        setBillingRefreshError("");
        await actions.refreshBilling?.();
        if (!cancelled) {
          toast.success("Billing status refreshed");
        }
      } catch (error) {
        if (!cancelled) {
          setBillingRefreshError(
            toMerchantErrorMessage(error, "Couldn't refresh billing status"),
          );
        }
      } finally {
        if (cancelled || typeof window === "undefined") return;
        const url = new URL(window.location.href);
        url.searchParams.delete("updated");
        window.history.replaceState(
          {},
          "",
          `${url.pathname}${url.search}${url.hash}`,
        );
      }
    };

    refreshAfterReturn();
    return () => {
      cancelled = true;
    };
  }, [actions, toast]);

  const selectSection = (sectionId) => {
    setActiveSection(sectionId);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (sectionId === "general") {
      url.searchParams.delete("section");
    } else {
      url.searchParams.set("section", sectionId);
    }
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const dirty = useMemo(
    () =>
      draft.alertEmail !== model.alertEmail ||
      draft.emailAlerts !== model.emailAlerts ||
      draft.highRiskAlertsOnly !== model.highRiskAlertsOnly ||
      draft.weeklyReportsEnabled !== model.weeklyReportsEnabled,
    [draft, model],
  );

  const responseMode = getResponseMode(model);
  const protectionProfile = getProtectionProfile(model);
  const storefrontConnected = hasStorefrontConnection(model);
  const emailStatus = getEmailStatus({
    configured: model.emailProviderConfigured,
    lastStatus: model.lastAlertStatus,
  });
  const lastAlertDetail = model.lastAlertStatus
    ? formatDeliveryDetail(model.lastAlertStatus, model.lastAlertSentAt)
    : "No alert delivery recorded yet";
  const lastReportDetail = model.lastWeeklyReportStatus
    ? formatDeliveryDetail(model.lastWeeklyReportStatus, model.lastWeeklyReportAt)
    : "No weekly report delivery recorded yet";
  const billing = getSettingsBillingView(model.billingStatus || {});
  const alertEmailValid = EMAIL_PATTERN.test(draft.alertEmail);
  const operationalStrip = getSettingsOperationalStrip(model);
  const simulationLabel = formatSimulationLabel(model);
  const protectionStateTone = model.protectionPaused
    ? "warning"
    : "healthy";
  const responseModeTone =
    responseMode.status === "active"
      ? "healthy"
      : responseMode.status === "paused"
        ? "warning"
        : "monitor";
  const testEmailDisabledReason = dirty
    ? "Save notification settings before sending a test email."
    : !draft.emailAlerts
      ? "Turn on security alerts before sending a test email."
      : !model.emailProviderConfigured
        ? "Email delivery isn't set up yet."
        : !alertEmailValid
          ? "Enter a valid alert email before sending a test email."
          : "";
  const reportDisabledReason = dirty
    ? "Save report settings before sending a manual report."
    : !draft.weeklyReportsEnabled
      ? "Turn on the weekly security report before sending one now."
      : !model.emailProviderConfigured
        ? "Email delivery isn't set up yet."
        : !alertEmailValid
          ? "Enter a valid alert email before sending a report."
          : "";

  const save = async () => {
    if (
      (draft.emailAlerts || draft.weeklyReportsEnabled) &&
      !alertEmailValid
    ) {
      setSaveError("Enter a valid alert email before saving.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      await actions.saveSettings(draft);
      toast.success("Settings saved");
    } catch (error) {
      setSaveError(
        toMerchantErrorMessage(error, "Couldn’t save settings"),
      );
    } finally {
      setSaving(false);
    }
  };

  const renderSection = () => {
    if (activeSection === "general") {
      return (
        <SettingsHubSection
          description="Live security posture and shortcuts into BotShield protection controls."
          eyebrow="General"
          panel="control"
          title="Security posture"
        >
          <div className="botshield-settings-hub-subgroup is-operational">
            <SettingsHubRow
              control={
                <SettingsHubStatusPill label={responseMode.label} tone={responseModeTone} />
              }
              description="Current storefront response mode used by BotShield."
              icon="shield"
              title="Response mode"
              variant="operational"
            />
            <SettingsHubRow
              control={
                <SettingsHubStatusPill
                  label={model.protectionPaused ? "Paused" : "Active"}
                  tone={protectionStateTone}
                />
              }
              description={
                model.protectionPaused
                  ? "Automated responses are paused until you resume protection."
                  : "BotShield is applying your protection settings."
              }
              icon="activity"
              title="Protection state"
              variant="operational"
            />
          </div>
          <div className="botshield-settings-hub-subgroup is-info">
            <SettingsHubRow
              control={<span className="botshield-settings-hub-value">{protectionProfile}</span>}
              description="Shared protection profile configured on the Protection page."
              title="Protection profile"
              variant="info"
            />
            <SettingsHubRow
              control={
                <div className="botshield-settings-hub-row-actions">
                  <span className="botshield-settings-hub-value">
                    {billing.currentPlanLabel}
                  </span>
                  <BotShieldActionButton onClick={() => selectSection("billing")}>
                    Manage plan →
                  </BotShieldActionButton>
                </div>
              }
              description="Current BotShield subscription plan for this store."
              title="Plan"
              variant="info"
            />
          </div>
          <div className="botshield-settings-hub-subgroup is-action">
            <SettingsHubRow
              control={
                <div className="botshield-settings-hub-row-actions">
                  <BotShieldActionButton onClick={() => actions.setPage("detection")}>
                    Open Protection →
                  </BotShieldActionButton>
                  {model.protectionPaused ? (
                    <BotShieldAsyncButton action={() => actions.resumeProtection()}>
                      Resume protection
                    </BotShieldAsyncButton>
                  ) : (
                    <BotShieldAsyncButton action={() => actions.pauseProtection(60)}>
                      Pause 1 hour
                    </BotShieldAsyncButton>
                  )}
                </div>
              }
              description="Manage protection modules, enforcement policy, and visitor access."
              title="Protection configuration"
              variant="action"
            />
            {model.protectionPaused ? null : (
              <p className="botshield-settings-hub-inline-note">
                Pausing stops automated responses for one hour. Storefront activity is still recorded, and you can resume anytime.
              </p>
            )}
          </div>
        </SettingsHubSection>
      );
    }

    if (activeSection === "billing") {
      const plans = getSettingsBillingPlans(model.billingStatus || {});
      const planCount = Math.min(plans.length, 3);
      const subscriptionLabel = billing.active
        ? billing.currentPlanLabel
        : "No active subscription";
      const renewalLabel = billing.subscription?.currentPeriodEnd
        ? formatDate(billing.subscription.currentPeriodEnd)
        : billing.active
          ? "Not available yet"
          : "—";
      const showDevNotice = !billing.configured;

      return (
        <section className="botshield-settings-hub-section botshield-settings-billing-section">
          <header className="botshield-settings-hub-section-head">
            <span className="botshield-v2-eyebrow">Plans & billing</span>
            <h2>Subscription plans</h2>
            <p>
              Choose the BotShield plan for this store. Payment approval and
              subscription changes are handled securely through Shopify Admin.
            </p>
          </header>

          <div className={`botshield-settings-hub-plan-grid is-count-${planCount}`}>
            {plans.map((plan) => {
              const planAction = plan.isCurrent ? (
                billing.pricingUrl ? (
                  <BotShieldActionButton href={billing.pricingUrl} target="_top">
                    Manage plan
                  </BotShieldActionButton>
                ) : (
                  <SettingsHubStatusPill label="Current plan" tone="healthy" />
                )
              ) : billing.pricingUrl ? (
                <BotShieldActionButton
                  href={billing.pricingUrl}
                  target="_top"
                  variant="primary"
                >
                  {billing.active ? "Change plan" : "Choose plan"}
                </BotShieldActionButton>
              ) : null;

              return (
                <article
                  className={`botshield-settings-hub-plan-card${
                    plan.isCurrent ? " botshield-settings-hub-plan-card--current" : ""
                  }`}
                  key={plan.id}
                >
                  {plan.isCurrent ? (
                    <div className="botshield-settings-hub-plan-current-badge">
                      <SettingsOperationalDot tone="healthy" />
                      Current plan
                    </div>
                  ) : null}
                  <div className="botshield-settings-hub-plan-card-head">
                    <h3>{plan.name}</h3>
                    <div className="botshield-settings-hub-plan-price-row">
                      <span className="botshield-settings-hub-plan-price">
                        ${plan.monthlyPrice.toFixed(2)}
                      </span>
                      <span className="botshield-settings-hub-plan-price-suffix">
                        /month
                      </span>
                    </div>
                    <p className="botshield-settings-hub-plan-meta">
                      {plan.trialDays}-day free trial
                    </p>
                    <p className="botshield-settings-hub-plan-copy">{plan.description}</p>
                  </div>
                  <div className="botshield-settings-hub-plan-actions">{planAction}</div>
                  <div
                    aria-hidden="true"
                    className="botshield-settings-hub-plan-divider"
                  />
                  <ul className="botshield-settings-hub-plan-features is-checklist">
                    {plan.features.map((feature) => (
                      <li key={feature}>
                        <span
                          aria-hidden="true"
                          className="botshield-settings-hub-plan-check"
                        >
                          <s-icon type="check" size="small" />
                        </span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="botshield-settings-hub-plan-shopify-note">
                    <SettingsHubIcon name="shield" />
                    Billed securely through Shopify
                  </p>
                </article>
              );
            })}
          </div>

          <section className="botshield-settings-hub-subscription-panel">
            <header className="botshield-settings-hub-subscription-head">
              <h3>Subscription & billing</h3>
              <p>Verified Shopify subscription details for this store.</p>
            </header>
            <div className="botshield-settings-hub-subscription-grid">
              <div className="botshield-settings-hub-subscription-item">
                <span className="botshield-settings-hub-subscription-label">
                  Current subscription
                </span>
                <span className="botshield-settings-hub-value">{subscriptionLabel}</span>
              </div>
              <div className="botshield-settings-hub-subscription-item">
                <span className="botshield-settings-hub-subscription-label">
                  Subscription status
                </span>
                <span className="botshield-settings-hub-subscription-value">
                  <SettingsHubStatusPill
                    label={billing.statusModel.label}
                    tone={
                      billing.active
                        ? billing.isTestPlan
                          ? "monitor"
                          : "healthy"
                        : "neutral"
                    }
                  />
                </span>
              </div>
              <div className="botshield-settings-hub-subscription-item">
                <span className="botshield-settings-hub-subscription-label">
                  Trial status
                </span>
                <span className="botshield-settings-hub-value">
                  {getSettingsBillingTrialLabel(billing)}
                </span>
              </div>
              <div className="botshield-settings-hub-subscription-item">
                <span className="botshield-settings-hub-subscription-label">
                  Billing cycle end
                </span>
                <span className="botshield-settings-hub-value">{renewalLabel}</span>
              </div>
            </div>
            <div className="botshield-settings-hub-subscription-foot">
              <p>
                {billing.checkedAt
                  ? `Last verified ${formatDate(billing.checkedAt)}.`
                  : "Refresh after returning from Shopify plan approval."}
              </p>
              <BotShieldAsyncButton
                action={actions.refreshBilling}
                icon="refresh"
                successMessage="Billing refreshed"
              >
                Refresh billing
              </BotShieldAsyncButton>
            </div>
          </section>

          {showDevNotice ? (
            <aside className="botshield-settings-hub-dev-note">
              <div className="botshield-settings-hub-dev-note-copy">
                <strong>Billing setup incomplete</strong>
                <p>
                  Complete Shopify billing configuration before testing plan
                  changes in this environment.
                </p>
              </div>
            </aside>
          ) : null}

          <p className="botshield-settings-hub-footnote">
            BotShield never stores card details and only marks a plan active
            after Shopify confirms the subscription.
          </p>
        </section>
      );
    }

    if (activeSection === "notifications") {
      const lastAlertSent =
        model.lastAlertStatus === "sent" || model.lastAlertStatus === "test_sent";
      return (
        <>
          <SettingsHubSection
            description="Choose where BotShield sends security alerts."
            eyebrow="Notifications"
            panel="config"
            title="Alert configuration"
          >
            {!model.emailProviderConfigured ? (
              <div className="botshield-settings-hub-note">
                Email delivery isn't set up yet. You can save settings, but messages won't send until delivery is configured.
              </div>
            ) : null}
            <SettingsHubRow
              control={
                <div className="botshield-settings-hub-field">
                  <BotShieldTextField
                    autocomplete="email"
                    error={
                      draft.alertEmail && !alertEmailValid ? "Enter a valid email address" : ""
                    }
                    label="Alert email"
                    onChange={(alertEmail) => setDraft((current) => ({ ...current, alertEmail }))}
                    placeholder="you@store.com"
                    type="email"
                    value={draft.alertEmail}
                  />
                </div>
              }
              description="Destination for security alerts and weekly reports."
              icon="email"
              title="Alert email"
              variant="config"
            />
            <SettingsHubRow
              control={
                <BotShieldToggle
                  checked={draft.emailAlerts}
                  disabled={!model.emailProviderConfigured}
                  label="Security alerts"
                  onChange={(emailAlerts) => setDraft((current) => ({ ...current, emailAlerts }))}
                />
              }
              description="Receive notifications when BotShield detects important security events."
              title="Security alerts"
              variant="config"
            />
            <SettingsHubRow
              control={
                <BotShieldToggle
                  checked={draft.highRiskAlertsOnly}
                  disabled={!model.emailProviderConfigured || !draft.emailAlerts}
                  label="High-risk alerts only"
                  onChange={(highRiskAlertsOnly) =>
                    setDraft((current) => ({ ...current, highRiskAlertsOnly }))
                  }
                />
              }
              description="Send alerts only for high-risk storefront events."
              title="High-risk alerts only"
              variant="config"
            />
          </SettingsHubSection>
          <section className="botshield-settings-hub-delivery">
            <header className="botshield-settings-hub-delivery-head">
              <span className="botshield-v2-eyebrow">Delivery status</span>
              <h3>Notification delivery</h3>
            </header>
            <div className="botshield-settings-hub-delivery-body">
              <SettingsHubRow
                control={
                  <BotShieldAsyncButton
                    action={async () => {
                      await safeFetchJson("/api/alerts/test", { method: "POST" });
                      await actions.refreshSettings();
                    }}
                    disabled={
                      dirty ||
                      !draft.emailAlerts ||
                      !model.emailProviderConfigured ||
                      !alertEmailValid
                    }
                    successMessage="Test email sent"
                    title={testEmailDisabledReason || undefined}
                  >
                    Send test email
                  </BotShieldAsyncButton>
                }
                description="Send a one-time test message to confirm delivery."
                title="Test notification"
                variant="secondary"
              />
              <SettingsHubRow
                control={
                  lastAlertSent ? (
                    <SettingsHubStatusPill label="Sent" tone="healthy" />
                  ) : (
                    <SettingsHubStatusPill
                      label={emailStatus.label}
                      tone={
                        emailStatus.tone === "success"
                          ? "healthy"
                          : emailStatus.tone === "warning"
                            ? "monitor"
                            : "neutral"
                      }
                    />
                  )
                }
                description={`Last delivery: ${lastAlertDetail}`}
                muted
                title="Last alert delivery"
                variant="delivery"
              />
              {model.lastAlertError ? (
                <div className="botshield-settings-hub-note is-error">{model.lastAlertError}</div>
              ) : null}
            </div>
          </section>
        </>
      );
    }

    if (activeSection === "reports") {
      const lastReportSent =
        model.lastWeeklyReportStatus === "sent" ||
        model.lastWeeklyReportStatus === "test_sent";
      return (
        <SettingsHubSection
          description="Configure automated weekly security summaries."
          eyebrow="Reports"
          panel="config"
          title="Weekly security report"
        >
          <SettingsHubRow
            control={
              <BotShieldToggle
                checked={draft.weeklyReportsEnabled}
                disabled={!model.emailProviderConfigured}
                label="Weekly security report"
                onChange={(weeklyReportsEnabled) =>
                  setDraft((current) => ({ ...current, weeklyReportsEnabled }))
                }
              />
            }
            description="Send a weekly summary of storefront protection activity."
            title="Weekly security report"
            variant="config"
          />
          <SettingsHubRow
            control={
              <div className="botshield-settings-hub-row-actions">
                {lastReportSent ? (
                  <SettingsHubStatusPill label="Sent" tone="healthy" />
                ) : null}
                <BotShieldAsyncButton
                  action={async () => {
                    await safeFetchJson("/api/weekly-report", { method: "POST" });
                    await actions.refreshSettings();
                  }}
                  disabled={
                    dirty ||
                    !draft.weeklyReportsEnabled ||
                    !model.emailProviderConfigured ||
                    !alertEmailValid
                  }
                  successMessage="Weekly report sent"
                  title={reportDisabledReason || undefined}
                >
                  Send report now
                </BotShieldAsyncButton>
              </div>
            }
            description={`Last report: ${lastReportDetail}`}
            title="Report delivery"
            variant="secondary"
          />
          {model.lastWeeklyReportError ? (
            <div className="botshield-settings-hub-note is-error">
              {model.lastWeeklyReportError}
            </div>
          ) : null}
        </SettingsHubSection>
      );
    }

    if (activeSection === "connections") {
      return (
        <SettingsHubSection
          description="Integration health for supported BotShield services."
          eyebrow="Connections"
          panel="connections"
          title="System connections"
        >
          <SettingsHubRow
            control={
              <SettingsHubStatusPill
                label={model.emailProviderConfigured ? "Configured" : "Setup required"}
                tone={model.emailProviderConfigured ? "healthy" : "monitor"}
              />
            }
            description="Email delivery provider used for alerts and weekly reports."
            icon="email"
            title="Email provider"
            variant="connection"
          />
          <SettingsHubRow
            control={
              <SettingsHubStatusPill
                label={storefrontConnected ? "Connected" : "Setup required"}
                tone={storefrontConnected ? "healthy" : "monitor"}
              />
            }
            description={
              storefrontConnected
                ? "Theme app embed is active and BotShield can evaluate storefront traffic."
                : "Enable the theme app embed to start recording storefront activity."
            }
            icon="connection"
            title="Storefront theme embed"
            variant="connection"
          />
          <SettingsHubRow
            control={
              <SettingsHubStatusPill
                label={model.protectionStatus?.appInstalled ? "Installed" : "Unknown"}
                tone={model.protectionStatus?.appInstalled ? "healthy" : "neutral"}
              />
            }
            description="BotShield app installation state inside Shopify Admin."
            icon="shield"
            title="Shopify app"
            variant="connection"
          />
          <SettingsHubRow
            control={
              <BotShieldActionButton
                disabled={!storefrontConnected && !model.protectionStatus?.shop}
                onClick={actions.openThemeEditor}
              >
                {storefrontConnected ? "Open theme editor" : "Connect storefront"}
              </BotShieldActionButton>
            }
            description="Review or enable the BotShield theme app embed in Shopify."
            icon="connection"
            title="Theme editor"
            variant="action"
          />
        </SettingsHubSection>
      );
    }

    if (activeSection === "privacy") {
      return (
        <SettingsHubSection
          description="How BotShield records, uses, and protects merchant and storefront data."
          eyebrow="Data & privacy"
          panel="privacy"
          title="Data handling"
        >
          <SettingsHubRow
            control={<span className="botshield-settings-hub-value">Storefront events</span>}
            description="BotShield records only the storefront protection decisions needed for analytics, alerts, and enforcement."
            icon="activity"
            title="Recorded activity"
            variant="info"
          />
          <SettingsHubRow
            control={<span className="botshield-settings-hub-value">{simulationLabel}</span>}
            description="Dashboard simulations stay separate from real storefront metrics and reports."
            icon="diagnostic"
            title="Simulation data"
            variant="info"
          />
          <SettingsHubRow
            control={
              <BotShieldActionButton href="/privacy" target="_blank">
                View privacy policy
              </BotShieldActionButton>
            }
            description="Review how BotShield processes, retains, and secures merchant data."
            icon="privacyRow"
            title="Privacy policy"
            variant="action"
          />
        </SettingsHubSection>
      );
    }

    if (activeSection === "diagnostics") {
      const trafficActive = hasStorefrontTraffic(model);
      const trafficTone = trafficActive ? "healthy" : "warning";
      return (
        <SettingsHubSection
          description="Application health checks and supported troubleshooting tools."
          eyebrow="App & diagnostics"
          panel="diagnostics"
          title="Diagnostics"
        >
          <SettingsHubRow
            control={
              <SettingsHubStatusPill
                label={trafficActive ? "Receiving traffic" : "Waiting for traffic"}
                tone={trafficTone}
              />
            }
            description={
              model.protectionStatus?.lastStorefrontDecisionAt
                ? `Last decision ${formatRelativeTime(model.protectionStatus.lastStorefrontDecisionAt)}`
                : "No recorded storefront decisions yet."
            }
            icon="activity"
            title="Storefront activity"
            variant="operational"
          />
          {(!billing.configured || billing.error) && (
            <SettingsHubRow
              control={
                <SettingsHubStatusPill
                  label="Setup required"
                  tone={billing.error ? "monitor" : "monitor"}
                />
              }
              description={
                billing.error ||
                "Complete Shopify billing setup before testing plan changes."
              }
              icon="diagnostic"
              title="Billing verification"
              variant="diagnostic"
            />
          )}
          <SettingsHubRow
            control={
              <BotShieldAsyncButton
                action={async () => {
                  await actions.runDiagnostic();
                }}
                successMessage="Diagnostic completed"
              >
                Run diagnostic scan
              </BotShieldAsyncButton>
            }
            description="Check that storefront activity is being recorded and enforcement is working."
            icon="diagnostic"
            title="Diagnostic scan"
            variant="diagnostic"
          />
          <SettingsHubRow
            control={
              <BotShieldAsyncButton
                action={async () => {
                  await actions.runSimulation();
                }}
                disabled={model.protectionPaused}
                successMessage="Simulation recorded"
                title={
                  model.protectionPaused
                    ? "Resume protection before running a simulation."
                    : undefined
                }
              >
                Run simulation scan
              </BotShieldAsyncButton>
            }
            description="Record a test event without changing live enforcement."
            icon="diagnostic"
            title="Simulation scan"
            variant="diagnostic"
          />
          <SettingsHubRow
            control={
              <BotShieldActionButton loading={model.syncing} onClick={actions.refresh}>
                Refresh status
              </BotShieldActionButton>
            }
            description="Reload settings, protection status, and recent activity."
            title="Refresh application data"
            variant="secondary"
          />
        </SettingsHubSection>
      );
    }

    return (
      <section className="botshield-settings-hub-section is-panel-danger">
        <header className="botshield-settings-hub-section-head">
          <span className="botshield-v2-eyebrow">Danger zone</span>
          <h2>Destructive actions</h2>
          <p>Permanent actions for this store. Proceed only if you understand the impact.</p>
        </header>
        <div className="botshield-settings-hub-danger">
          <div className="botshield-settings-hub-danger-icon">
            <SettingsHubIcon name="warning" />
          </div>
          <div className="botshield-settings-hub-danger-copy">
            <h3>Clear simulation data</h3>
            <p>
              Remove test events from analytics. Real storefront traffic, settings, blocklists, and
              trusted visitors are not deleted.
            </p>
          </div>
          <BotShieldActionButton
            command="--show"
            commandFor="botshield-clear-simulation-modal"
            tone="critical"
          >
            Clear simulation data
          </BotShieldActionButton>
        </div>
        <BotShieldConfirmationModal
          confirmLabel="Clear simulation data"
          heading="Clear simulation data?"
          id="botshield-clear-simulation-modal"
          loading={clearingSimulation}
          onConfirm={async () => {
            setClearingSimulation(true);
            setDiagnosticsError("");
            try {
              await safeFetchJson("/api/clear-test-data", { method: "POST" });
              await actions.refresh();
              toast.success("Simulation data cleared");
            } catch (error) {
              setDiagnosticsError(
                toMerchantErrorMessage(error, "Couldn't clear simulation data"),
              );
              throw error;
            } finally {
              setClearingSimulation(false);
            }
          }}
        >
          Remove test events from analytics. Real storefront traffic, settings, blocklists, and
          trusted visitors are not deleted.
        </BotShieldConfirmationModal>
      </section>
    );
  };

  const showSaveBar = ["notifications", "reports"].includes(activeSection);

  return (
    <BotShieldNativePage heading="Settings">
      <BotShieldPageShell className="botshield-overview-content botshield-overview-v2 botshield-settings-hub-content">
        <header className="botshield-overview-header botshield-settings-hub-header">
          <div
            aria-label="BotShield operational status"
            className="botshield-settings-hub-strip"
            role="status"
          >
            {operationalStrip.map((item) => (
              <div
                className={`botshield-settings-hub-strip-item is-${item.tone}`}
                key={item.label}
              >
                <SettingsOperationalDot tone={item.tone} />
                <span className="botshield-settings-hub-strip-label">{item.label}</span>
                <span className="botshield-settings-hub-strip-value">{item.value}</span>
              </div>
            ))}
          </div>
        </header>

        <div className="botshield-settings-hub-layout">
          <nav aria-label="Settings categories" className="botshield-settings-hub-nav">
            {SETTINGS_HUB_SECTIONS.map((section) => (
              <button
                aria-current={activeSection === section.id ? "page" : undefined}
                className={`botshield-settings-hub-nav-item${
                  activeSection === section.id ? " is-active" : ""
                }${section.id === "danger" ? " is-danger" : ""}`}
                key={section.id}
                onClick={() => selectSection(section.id)}
                type="button"
              >
                <SettingsHubIcon name={section.id} />
                <span>{section.label}</span>
              </button>
            ))}
          </nav>

          <div className="botshield-settings-hub-panel">
            {saveError && showSaveBar ? (
              <BotShieldBanner tone="critical" title="Settings not saved">
                {saveError}
              </BotShieldBanner>
            ) : null}
            {billingRefreshError && activeSection === "billing" ? (
              <BotShieldBanner tone="critical" title="Billing status unavailable">
                {billingRefreshError}
              </BotShieldBanner>
            ) : null}
            {diagnosticsError && activeSection === "danger" ? (
              <BotShieldBanner tone="critical" title="Diagnostics action failed">
                {diagnosticsError}
              </BotShieldBanner>
            ) : null}
            {renderSection()}
            {showSaveBar ? (
              <BotShieldSaveState
                id="botshield-settings-save-bar"
                dirty={dirty}
                error={saveError}
                onDiscard={() =>
                  setDraft({
                    alertEmail: model.alertEmail,
                    emailAlerts: model.emailAlerts,
                    highRiskAlertsOnly: model.highRiskAlertsOnly,
                    weeklyReportsEnabled: model.weeklyReportsEnabled,
                  })
                }
                onSave={save}
                saving={saving}
              />
            ) : null}
          </div>
        </div>
      </BotShieldPageShell>
    </BotShieldNativePage>
  );
}

export default function BotShieldAdminExperience({ model, actions }) {
  const screen =
    model.page === "security" ||
    model.page === "detection" ||
    model.page === "detection-settings" ||
    model.page === "blocklist" ||
    model.page === "trusted"
      ? "detection"
      : model.page === "fraud-orders"
        ? "fraud-orders"
        : model.page === "settings" ||
            model.page === "policy" ||
            model.page === "billing" ||
            model.page === "alerts-reports"
          ? "policy"
          : model.page === "analytics" || model.page === "incidents"
            ? "analytics"
            : "dashboard";
  const [lastScreen, setLastScreen] = useState(screen);

  useEffect(() => {
    if (screen === lastScreen) return undefined;
    setLastScreen(screen);
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
    }
    return undefined;
  }, [lastScreen, screen]);

  const routeContent = (
    <div key={screen}>
      {screen === "dashboard" ? (
        <OverviewPage model={model} actions={actions} />
      ) : null}
      {screen === "analytics" ? (
        <AnalyticsPage model={model} actions={actions} />
      ) : null}
      {screen === "fraud-orders" ? (
        <FraudOrdersPage model={model} actions={actions} />
      ) : null}
      {screen === "detection" ? (
        <ProtectionPage model={model} actions={actions} />
      ) : null}
      {screen === "policy" ? (
        <SettingsPage model={model} actions={actions} />
      ) : null}
    </div>
  );

  return (
    <BotShieldAppFrame>
      <div className="botshield-route-shell">
        {model.backendErrors?.length ? (
          <div className="botshield-page-content">
            <BotShieldBanner
              tone="critical"
              title="Some data couldn't be loaded"
            >
              {model.backendErrors.join(" ")}
            </BotShieldBanner>
          </div>
        ) : null}
        {routeContent}
      </div>
    </BotShieldAppFrame>
  );
}
