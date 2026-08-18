/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from "react";
import * as ReactDOM from "react-dom";
import {
  BotShieldActionButton,
  BotShieldAppFrame,
  BotShieldAsyncButton,
  BotShieldBanner,
  BotShieldCard,
  BotShieldEmptyState,
  BotShieldInlineHelp,
  BotShieldSaveState,
  BotShieldSelect,
  BotShieldStatusBadge,
  BotShieldTextField,
  BotShieldToggle,
  useBotShieldToast,
} from "../design-system/BotShieldDesignSystem";
import { safeFetchJson } from "../../lib/safe-fetch";
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
  if (action === "blocked") return "Stopped";
  if (action === "challenged") return "Verification requested";
  return "Allowed";
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
  return Boolean(
    model?.protectionStatus?.themeEmbedDetected ||
      model?.protectionStatus?.lastStorefrontDecisionAt,
  );
}

function formatDelta(current, previous) {
  if (previous === 0) return current === 0 ? "No change" : "New activity";
  const change = Math.round(((current - previous) / previous) * 100);
  return `${change > 0 ? "+" : ""}${change}% from previous 7 days`;
}

function Screen({ title, subtitle, actions, children, maxWidth = "base" }) {
  return (
    <div className="botshield-page">
      <main
        className={`botshield-page-content${
          maxWidth === "full" ? " botshield-page-content--wide" : ""
        }`}
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
      </main>
    </div>
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
        <BotShieldActionButton onClick={() => actions.setPage("incidents")}>
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
          <BotShieldActionButton onClick={() => actions.setPage("incidents")}>
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
              <BotShieldActionButton onClick={() => actions.setPage("incidents")}>
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
              <BotShieldActionButton onClick={() => actions.setPage("billing")}>
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
        ? "Storefront traffic has been received."
        : "Enable the theme app embed to connect storefront traffic.",
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
      action: () => actions.setPage?.("billing"),
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
    title === "Bot detection"
      ? "Bot"
      : title === "IP address blocklist"
        ? "IP"
        : title === "Trusted visitors"
          ? "Trust"
          : title === "Network intelligence"
            ? "Net"
            : title === "Repeated visitor activity"
              ? "Rate"
              : title === "Blocked page"
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
  const [threatPeriod, setThreatPeriod] = useState(30);
  const storefrontConnected = hasStorefrontConnection(model);
  const storefrontSensorActive = Boolean(model.protectionStatus?.themeEmbedDetected);
  const storefrontEvents = Number.isFinite(Number(model.incidentCounts?.total))
    ? Number(model.incidentCounts.total)
    : model.storefrontScans.length;
  const botsBlocked = Number.isFinite(Number(model.incidentCounts?.blocked))
    ? Number(model.incidentCounts.blocked)
    : model.blockedCount;
  const enforcementOn = Boolean(model.autoBlock && !model.protectionPaused);
  const protectionRows = [
    {
      label: "Bot protection",
      detail: "Detects automated storefront activity.",
      active: storefrontSensorActive,
      status: storefrontSensorActive ? (enforcementOn ? "Enforcing" : "Monitoring") : "Needs setup",
      tone: storefrontSensorActive ? (enforcementOn ? "success" : "info") : "warning",
      icon: "shield",
    },
    {
      label: "Network / Proxy protection",
      detail: "Identifies suspicious network traffic.",
      active: storefrontSensorActive,
      status: storefrontSensorActive ? "Monitoring" : "Needs setup",
      tone: storefrontSensorActive ? "info" : "warning",
      icon: "network",
    },
    {
      label: "Rate protection",
      detail: "Detects unusually repetitive behavior.",
      active: storefrontSensorActive,
      status: storefrontSensorActive ? (enforcementOn ? "Enforcing" : "Monitoring") : "Needs setup",
      tone: storefrontSensorActive ? (enforcementOn ? "success" : "info") : "warning",
      icon: "rate",
    },
    {
      label: "Page protection",
      detail: "Applies protection decisions on storefront pages.",
      active: storefrontSensorActive,
      status: storefrontSensorActive ? "Connected" : "Needs setup",
      tone: storefrontSensorActive ? "success" : "warning",
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
      detail: "Blocked or challenged storefront visits",
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
          "Some security data could not be loaded. Protection may still be active, but this view requires attention.",
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
                : "Complete the remaining protection setup to fully secure storefront traffic.",
        }
        : {
            label: "Active",
            title: "Your store is protected",
          tone: "success",
          className: "botshield-v2-status--active",
          detail:
            "BotShield is connected and actively evaluating storefront traffic using your current protection policy.",
        };
  const metrics = [
    { label: "Storefront events", value: storefrontEvents, detail: "Last 30 days", icon: "activity" },
    { label: "Bots blocked", value: botsBlocked, detail: "Blocked by your protection policy", icon: "block" },
    {
      label: "Challenged visitors",
      value: Number.isFinite(Number(model.incidentCounts?.challenged))
        ? Number(model.incidentCounts.challenged)
        : model.challengedCount,
      detail: "Asked to complete verification",
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
    <div className="botshield-page">
      <main className="botshield-page-content botshield-overview-content botshield-overview-v2">
        <s-stack gap="large">
          <div className="botshield-overview-header">
            <div>
              <h1 className="botshield-overview-title">Overview</h1>
              <p className="botshield-overview-subtitle">
                Monitor storefront protection, security activity, and
                enforcement decisions from one place.
              </p>
            </div>
          </div>

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
              <BotShieldActionButton onClick={() => actions.setPage("incidents")}>
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
                <div className="botshield-v2-eyebrow">Operational telemetry</div>
                <h2 id="store-health-title">Store health</h2>
              </div>
              <BotShieldActionButton
                variant="tertiary"
                onClick={storefrontSensorActive ? actions.refresh : actions.openThemeEditor}
              >
                {storefrontSensorActive ? "Refresh status" : "Verify connection"}
              </BotShieldActionButton>
            </div>
            <div className="botshield-v2-health-grid">
              <div className="botshield-v2-health-item">
                <OverviewIcon name="reporting" />
                <span>Storefront reporting</span>
                <strong><i className={`botshield-v2-health-dot ${storefrontSensorActive ? "is-healthy" : "is-attention"}`} />{storefrontSensorActive ? "Connected" : lastStorefrontDecisionAt ? "Previously reporting" : "Needs verification"}</strong>
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
              <div className="botshield-v2-eyebrow">Verified outcomes {"\u00B7"} Last 30 days</div>
              <h2 id="security-impact-title">Security impact</h2>
              <p>Verified protection outcomes from the last 30 days.</p>
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
                <p>Verified order value linked to documented qualifying protection outcomes.</p>
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
                  <p>BotShield does not estimate value from traffic, blocked visitors, challenges, or risk scores.</p>
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
                    Refresh BotShield to load recorded storefront decisions again.
                  </BotShieldBanner>
                  <BotShieldActionButton onClick={actions.refresh}>
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
                      Share of suspicious events containing each signal. One event may contain multiple signals.
                    </p>
                  </div>
                  <BotShieldActionButton
                    variant="tertiary"
                    onClick={() => actions.setPage("incidents")}
                  >
                    Investigate
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
                  <p>Live coverage by protection module.</p>
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
                        onClick={() => actions.setPage("detection-settings")}
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
                    onClick={() => actions.setPage("incidents")}
                  >
                    Investigate {"\u2192"}
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
                  onClick={() => actions.setPage("incidents")}
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
                        onClick={() => actions.setPage("incidents")}
                      >
                        View details
                      </BotShieldActionButton>
                    </div>
                  ))}
                </div>
              ) : (
                <BotShieldEmptyState
                  title="No recent security activity"
                  description="Live visitor decisions will appear here when BotShield receives storefront traffic."
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
                  <div><strong>Block an IP</strong><span>Stop a known visitor from accessing the storefront.</span></div>
                  <BotShieldActionButton onClick={actions.openBlocklist}>
                    Block an IP
                  </BotShieldActionButton>
                </div>
                <div className="botshield-v2-quick-action-row">
                  <OverviewIcon name="visitor" centered />
                  <div><strong>Trust a visitor</strong><span>Allow a verified visitor through protection checks.</span></div>
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
      </main>
    </div>
  );
}

// Kept temporarily while Overview V2 is validated in the embedded app.
// eslint-disable-next-line no-unused-vars
function LegacyOverviewPage({ model, actions }) {
  {
    const overviewStorefrontConnected = hasStorefrontConnection(model);
    const overviewVisitorEvents = Number.isFinite(
      Number(model.incidentCounts?.total),
    )
      ? Number(model.incidentCounts.total)
      : model.storefrontScans.length;
    const overviewBlockedVisitors = Number.isFinite(
      Number(model.incidentCounts?.blocked),
    )
      ? Number(model.incidentCounts.blocked)
      : model.blockedCount;
    const overviewBillingActive = Boolean(model.billingStatus?.active);
    const overviewShopDomain =
      model.protectionStatus?.shop || "this store";
    const overviewUsageProgress = Math.max(
      4,
      Math.min(100, overviewVisitorEvents),
    );
    const overviewSetupItems = getSetupChecklistItems(model, actions);
    const overviewIncompleteSetupItems = overviewSetupItems.filter(
      (item) => !item.complete,
    );
    const overviewSetupBadgeLabel = overviewIncompleteSetupItems.length
      ? `${overviewIncompleteSetupItems.length} item${
          overviewIncompleteSetupItems.length === 1 ? "" : "s"
        }`
      : "Complete";
    const ipProtectionOn = Boolean(
      overviewStorefrontConnected && model.autoBlock && !model.protectionPaused,
    );
    const pageProtectionOn = overviewStorefrontConnected;
    const vpnProtectionOn = Boolean(
      model.securityPosture?.report?.topReasonCodes?.some((item) =>
        /VPN|DATACENTER|HOSTING_PROVIDER|ASN|HIGH_RISK_NETWORK/i.test(
          item.label,
        ),
      ),
    );
    const overviewCoverageRows = [
      ["IP protection", ipProtectionOn],
      ["Page protection", pageProtectionOn],
      ["VPN / Proxy", vpnProtectionOn],
    ];
    const overviewCoreProtections = overviewCoverageRows.filter(
      ([label, enabled]) =>
        enabled &&
        [
          "IP protection",
          "Page protection",
        ].includes(label),
    ).length;
    const overviewExtendedModules = overviewCoverageRows.filter(
      ([label, enabled]) =>
        enabled &&
        ["VPN / Proxy"].includes(label),
    ).length;
    const overviewActiveProtections =
      overviewCoreProtections + overviewExtendedModules;
    const overviewMetricCards = [
      {
        title: "Traffic",
        value: overviewVisitorEvents,
        label: "Storefront events in the last 30 days",
        detail: "Real storefront decisions only",
      },
      {
        title: "Protection",
        value: overviewBlockedVisitors,
        label: "Visitors blocked",
        detail: `${model.challengedCount} challenged visitors`,
      },
      {
        title: "Coverage",
        value: overviewActiveProtections,
        label: "Active protections",
        detail: `${overviewCoreProtections} core protections · ${overviewExtendedModules} extended modules`,
      },
    ];
    const overviewWorkspaceRows = [
      {
        label: "Theme app embed",
        detail: overviewStorefrontConnected
          ? "Storefront protections are live on your theme."
          : "Enable the theme app embed to start storefront protection.",
        badge: overviewStorefrontConnected ? "On" : "Off",
        status: overviewStorefrontConnected ? "active" : "setup_required",
      },
      {
        label: "Current plan",
        detail: overviewBillingActive
          ? `${model.billingStatus?.subscription?.name || "BotShield Basic"} covers all protection modules.`
          : "BotShield Basic covers storefront protection modules.",
        badge: overviewBillingActive
          ? model.billingStatus?.subscription?.name || "Basic"
          : "Setup required",
        status: overviewBillingActive ? "active" : "setup_required",
      },
      {
        label: "Usage progress",
        detail: `${overviewVisitorEvents} storefront events tracked in 30 days`,
        badge: "Healthy",
        status: "active",
        progress: overviewUsageProgress,
      },
      {
        label: "Setup guide",
        detail:
          "Review active protection modules and storefront readiness in one place.",
        badge: overviewSetupBadgeLabel,
        status: overviewIncompleteSetupItems.length
          ? "setup_required"
          : "active",
      },
    ];
    return (
      <div className="botshield-page">
        <main className="botshield-page-content botshield-overview-content">
          <s-stack gap="large">
            <div className="botshield-overview-header">
              <div>
                <h1 className="botshield-overview-title">Overview</h1>
                <p className="botshield-overview-subtitle">
                  Track storefront protection, visitor activity, and billing
                  health from one clean control center.
                </p>
              </div>
              <s-stack direction="inline" gap="small" alignItems="center">
                <BotShieldActionButton
                  onClick={() => actions.setPage("analytics")}
                >
                  Open analytics
                </BotShieldActionButton>
                <BotShieldActionButton
                  variant="primary"
                  onClick={() => actions.setPage("detection")}
                >
                  Manage protection
                </BotShieldActionButton>
              </s-stack>
            </div>

            <div className="botshield-overview-metric-grid">
              {overviewMetricCards.map((card) => (
                <div className="botshield-overview-metric-card" key={card.title}>
                  <s-stack gap="small">
                    <div className="botshield-overview-metric-title">
                      {card.title}
                    </div>
                    <div className="botshield-overview-metric-value">
                      {card.value}
                    </div>
                    <div className="botshield-overview-metric-label">
                      {card.label}
                    </div>
                    <div className="botshield-overview-metric-helper">
                      {card.detail}
                    </div>
                  </s-stack>
                </div>
              ))}
            </div>

            <div className="botshield-overview-middle-grid">
              <BotShieldCard
                title="Workspace status"
                subtitle="Keep an eye on storefront readiness, billing usage, and rollout progress."
              >
                <s-stack>
                  {overviewWorkspaceRows.map((row) => (
                    <div className="botshield-overview-row" key={row.label}>
                      <s-stack
                        direction="inline"
                        gap="base"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <s-stack gap="small-200">
                          <s-text type="strong">{row.label}</s-text>
                          <s-text color="subdued">{row.detail}</s-text>
                          {typeof row.progress === "number" ? (
                            <div className="botshield-progress-track botshield-overview-progress">
                              <div
                                className="botshield-progress-fill"
                                style={{ width: `${row.progress}%` }}
                              />
                            </div>
                          ) : null}
                        </s-stack>
                        <OverviewBadge>{row.badge}</OverviewBadge>
                      </s-stack>
                    </div>
                  ))}
                </s-stack>
              </BotShieldCard>

              <BotShieldCard
                title="Protection coverage"
                subtitle="See which protection types are available in this store and which ones are already active."
              >
                <s-stack>
                  {overviewCoverageRows.map(([label, enabled]) => (
                    <div className="botshield-overview-row" key={label}>
                      <s-stack
                        direction="inline"
                        gap="base"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <s-text type="strong">{label}</s-text>
                        <OverviewBadge muted={!enabled}>
                          {enabled ? "On" : "Off"}
                        </OverviewBadge>
                      </s-stack>
                    </div>
                  ))}
                </s-stack>
              </BotShieldCard>
            </div>

            <div className="botshield-overview-action-grid">
              <BotShieldCard title="Review analytics">
                <s-stack gap="base">
                  <s-text color="subdued">
                    Inspect visitor patterns, blocked traffic, and storefront
                    protection signals in more detail.
                  </s-text>
                  <div>
                    <BotShieldActionButton
                      onClick={() => actions.setPage("analytics")}
                    >
                      Open analytics
                    </BotShieldActionButton>
                  </div>
                </s-stack>
              </BotShieldCard>

              <BotShieldCard title="Billing and settings">
                <s-stack gap="base">
                  <s-text color="subdued">
                    Manage pricing, app access, and content protection for{" "}
                    {overviewShopDomain}.
                  </s-text>
                  <div>
                    <BotShieldActionButton
                      onClick={() => actions.setPage("detection-settings")}
                    >
                      Open protection
                    </BotShieldActionButton>
                  </div>
                </s-stack>
              </BotShieldCard>
            </div>
          </s-stack>
        </main>
      </div>
    );
  }

  // eslint-disable-next-line no-unreachable
  const showLegacyOverviewDetails = false;
  const latestEvents = model.storefrontScans.slice(0, 5);
  const storefrontConnected = hasStorefrontConnection(model);
  const executiveStatus = getExecutiveStatus(model);
  const responseMode = getResponseMode(model);
  const setupItems = getSetupChecklistItems(model, actions);
  const setupComplete = setupItems.filter((item) => item.complete).length;
  const emailReady = model.emailProviderConfigured && model.emailAlerts;
  const protectionStatus = model.protectionPaused
    ? "paused"
    : model.protectionReady
      ? "active"
      : storefrontConnected
        ? "monitoring_only"
        : "setup_required";
  const recentEvents = model.storefrontScans.filter((event) =>
    inRecentDays(event.createdAt, 7),
  );
  const previousEvents = model.storefrontScans.filter((event) =>
    inRecentDays(event.createdAt, 7, 7),
  );
  const recentBlocked = recentEvents.filter(
    (event) => event.actionTaken === "blocked",
  ).length;
  const recentChallenged = recentEvents.filter(
    (event) => event.actionTaken === "challenged",
  ).length;
  const threatSignals = (model.securityPosture?.report?.topReasonCodes || [])
    .slice(0, 5)
    .map((item) => ({
      label: formatMerchantReasons([item.label]),
      count: item.count,
    }));
  const topOrigins = model.trafficOrigins.slice(0, 5).map((origin) => ({
    label:
      [origin.city, origin.country].filter(Boolean).join(", ") ||
      "Location unavailable",
    count: origin.count,
  }));

  return (
    <Screen
      title="Overview"
      subtitle="Monitor storefront protection, setup readiness, and recent security activity."
      actions={
        <BotShieldAsyncButton
          action={actions.refresh}
          successMessage="Overview refreshed"
          icon="refresh"
        >
          Refresh
        </BotShieldAsyncButton>
      }
    >
      {!storefrontConnected ? (
        <BotShieldBanner
          tone="warning"
          title="Connect your storefront"
          action={
            <BotShieldActionButton
              variant="primary"
              onClick={actions.openThemeEditor}
            >
              Open theme editor
            </BotShieldActionButton>
          }
        >
          Enable the theme app embed before BotShield can receive and evaluate
          storefront visits.
        </BotShieldBanner>
      ) : model.protectionPaused ? (
        <BotShieldBanner
          tone="warning"
          title="Protection is paused"
          action={
            <BotShieldAsyncButton
              action={actions.resumeProtection}
              successMessage="Protection resumed"
              variant="primary"
            >
              Resume protection
            </BotShieldAsyncButton>
          }
        >
          Events are still recorded, but automated blocking is disabled.
        </BotShieldBanner>
      ) : null}

      <div className="botshield-command-center">
        <div className="botshield-command-grid">
          <div>
            <div className="botshield-command-kicker">Store protection</div>
            <h2 className="botshield-command-title">{executiveStatus.label}</h2>
            <p className="botshield-command-copy">{executiveStatus.detail}</p>
            <div className="botshield-command-evidence">
              <span className="botshield-evidence-chip">
                {storefrontConnected
                  ? "Storefront connected"
                  : "Storefront not connected"}
              </span>
              <span className="botshield-evidence-chip">
                {model.autoBlock ? "Auto Block active" : "Monitoring mode"}
              </span>
              <span className="botshield-evidence-chip">
                {model.emailProviderConfigured && model.emailAlerts
                  ? "Alerts configured"
                  : "Alerts need setup"}
              </span>
            </div>
            <div className="botshield-command-actions">
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
              <BotShieldActionButton onClick={() => actions.setPage("incidents")}>
                View activity
              </BotShieldActionButton>
              <BotShieldActionButton onClick={() => runNextSetupAction(model, actions)}>
                Finish setup
              </BotShieldActionButton>
            </div>
          </div>
          <div className="botshield-command-panel">
            <div className="botshield-command-panel-row">
              <s-stack gap="small-200">
                <s-text color="subdued">Visitors analyzed</s-text>
                <s-text type="strong">{model.storefrontScans.length}</s-text>
              </s-stack>
              <BotShieldStatusBadge status="real_storefront" />
            </div>
            <div className="botshield-command-panel-row">
              <s-stack gap="small-200">
                <s-text color="subdued">Response mode</s-text>
                <s-text type="strong">{responseMode.label}</s-text>
              </s-stack>
              <BotShieldStatusBadge status={responseMode.status} />
            </div>
            <div className="botshield-command-panel-row">
              <s-stack gap="small-200">
                <s-text color="subdued">Last storefront event</s-text>
                <s-text type="strong">
                  {formatDate(
                    model.protectionStatus.lastStorefrontDecisionAt,
                    "Waiting for traffic",
                  )}
                </s-text>
              </s-stack>
              <BotShieldActionButton onClick={() => actions.setPage("incidents")}>
                Review
              </BotShieldActionButton>
            </div>
          </div>
        </div>
      </div>

      <s-grid
        gridTemplateColumns="repeat(auto-fit, minmax(260px, 1fr))"
        gap="large"
      >
        <BotShieldCard
          title="Protection policy"
          subtitle="How BotShield responds to storefront visitors."
          badge={<BotShieldStatusBadge status={responseMode.status} />}
          actions={
            <BotShieldActionButton onClick={() => actions.setPage("detection")}>
              Manage
            </BotShieldActionButton>
          }
        >
          <s-stack gap="base">
            <div className="botshield-status-value">{responseMode.label}</div>
            <s-text color="subdued">{responseMode.detail}</s-text>
            <s-stack direction="inline" gap="small">
              <BotShieldStatusBadge
                status={model.strictMode ? "active" : "monitoring_only"}
                label={model.strictMode ? "Strict Mode" : model.blockLevel}
              />
              <BotShieldStatusBadge
                status={model.autoBlock ? "active" : "monitoring_only"}
                label={model.autoBlock ? "Auto Block on" : "Monitoring only"}
              />
            </s-stack>
          </s-stack>
        </BotShieldCard>
        <BotShieldCard
          title="Setup readiness"
          subtitle="Launch-critical setup items completed."
          badge={
            <BotShieldStatusBadge
              status={
                setupComplete === setupItems.length ? "active" : "setup_required"
              }
              label={`${setupComplete}/${setupItems.length} ready`}
            />
          }
          actions={
            <BotShieldActionButton onClick={() => runNextSetupAction(model, actions)}>
              Review
            </BotShieldActionButton>
          }
        >
          <s-stack gap="base">
            <div className="botshield-progress-track">
              <div
                className="botshield-progress-fill"
                style={{
                  width: `${Math.round((setupComplete / setupItems.length) * 100)}%`,
                }}
              />
            </div>
            <s-text color="subdued">
              {setupComplete === setupItems.length
                ? "BotShield is fully configured for the current launch checklist."
                : `${setupItems.length - setupComplete} setup item${
                    setupItems.length - setupComplete === 1 ? "" : "s"
                  } still need attention.`}
            </s-text>
          </s-stack>
        </BotShieldCard>
        <BotShieldCard
          title="Merchant notifications"
          subtitle="Alerts and billing status for production operation."
          badge={
            <BotShieldStatusBadge
              status={emailReady ? "active" : "setup_required"}
              label={emailReady ? "Alerts ready" : "Action needed"}
            />
          }
          actions={
            <BotShieldActionButton onClick={() => actions.setPage("policy")}>
              Configure
            </BotShieldActionButton>
          }
        >
          <s-stack>
            <StatusRow
              label="Email alerts"
              detail={
                emailReady
                  ? model.alertEmail || "Recipient configured"
                  : "Configure the provider and recipient."
              }
              status={emailReady ? "active" : "setup_required"}
            />
            <StatusRow
              label="Billing"
              detail={
                model.billingStatus?.active
                  ? model.billingStatus.subscription?.name || "Active plan"
                  : "Subscription is not verified yet."
              }
              status={model.billingStatus?.active ? "active" : "setup_required"}
            />
          </s-stack>
        </BotShieldCard>
      </s-grid>

      <div className="botshield-section-heading">
        <div>
          <h2 className="botshield-section-title">Storefront activity</h2>
          <p className="botshield-section-copy">
            Real storefront visits analyzed by BotShield. Diagnostic and
            simulated events are excluded from these totals.
          </p>
        </div>
      </div>

      <s-grid
        gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))"
        gap="large"
      >
        <OutcomeCard
          label="Visitors evaluated"
          value={model.storefrontScans.length}
          description="Real storefront visits analyzed."
          status="real_storefront"
        />
        <OutcomeCard
          label="Challenged visitors"
          value={model.challengedCount}
          description="Visitors asked to verify before continuing."
          status={model.challengedCount ? "challenged" : "active"}
        />
        <OutcomeCard
          label="Blocked visitors"
          value={model.blockedCount}
          description="Visitors stopped before continuing."
          status={model.blockedCount ? "blocked" : "active"}
        />
        <OutcomeCard
          label="Needs review"
          value={
            model.storefrontScans.filter(
              (event) => event.threatLevel === "high",
            ).length
          }
          description="High-risk events that may need merchant review."
          status={
            model.storefrontScans.some((event) => event.threatLevel === "high")
              ? "high"
              : "active"
          }
        />
      </s-grid>

      <s-grid
        gridTemplateColumns="minmax(0, 1fr) minmax(0, 1fr)"
        gap="large"
      >
        <StoreHealthCard model={model} actions={actions} />
        <SetupProgressCard model={model} actions={actions} />
      </s-grid>

      {showLegacyOverviewDetails ? (
        <s-grid
          gridTemplateColumns="repeat(auto-fit, minmax(260px, 1fr))"
          gap="large"
        >
          <ProtectionStatusCard model={model} actions={actions} />
          <GettingStartedCard model={model} actions={actions} />
          <QuickActionsCard model={model} actions={actions} />
          <StoreHealthCard model={model} actions={actions} />
        </s-grid>
      ) : null}

      {showLegacyOverviewDetails ? (
        <s-grid
          gridTemplateColumns="repeat(auto-fit, minmax(210px, 1fr))"
          gap="large"
        >
          <OutcomeCard
            label="Visitors Evaluated"
            value={model.storefrontScans.length}
            description="Real storefront visits analyzed by BotShield."
            status="real_storefront"
          />
          <OutcomeCard
            label="Threats Stopped"
            value={model.blockedCount}
            description="Visitors blocked before continuing through the storefront."
            status={model.blockedCount ? "blocked" : "active"}
          />
          <OutcomeCard
            label="Suspicious Activity"
            value={
              recentBlocked +
              recentChallenged +
              recentEvents.filter((event) => event.threatLevel === "high")
                .length
            }
            description={`Last 7 days. ${formatDelta(recentEvents.length, previousEvents.length)}.`}
            status={recentBlocked || recentChallenged ? "challenged" : "active"}
          />
          <OutcomeCard
            label="Security Health"
            value={getExecutiveStatus(model).label}
            description={
              model.securityPosture?.score?.suggestions?.[0] ||
              getExecutiveStatus(model).detail
            }
            status={getExecutiveStatus(model).status}
          />
        </s-grid>
      ) : null}

      {showLegacyOverviewDetails ? (
        <>
          <s-grid
            gridTemplateColumns="repeat(auto-fit, minmax(300px, 1fr))"
            gap="base"
          >
            <BotShieldCard
              title="Protection status"
              subtitle="Current storefront policy and connected services."
              accent
            >
              <s-stack>
                <StatusRow
                  label="Storefront connection"
                  detail={
                    model.protectionStatus.lastStorefrontDecisionAt
                      ? `Last event ${formatDate(model.protectionStatus.lastStorefrontDecisionAt)}`
                      : "Waiting for the first storefront event"
                  }
                  status={
                    storefrontConnected
                      ? "theme_embed_connected"
                      : "theme_embed_missing"
                  }
                  action={
                    !storefrontConnected ? (
                      <BotShieldActionButton onClick={actions.openThemeEditor}>
                        Connect
                      </BotShieldActionButton>
                    ) : null
                  }
                />
                <StatusRow
                  label="Automated response"
                  detail={`${model.strictMode ? "Strict Mode" : `${model.blockLevel} sensitivity`} · ${getResponseMode(model).label}`}
                  status={protectionStatus}
                  action={
                    <BotShieldActionButton
                      onClick={() => actions.setPage("detection")}
                    >
                      Manage protection
                    </BotShieldActionButton>
                  }
                />
                <StatusRow
                  label="Email notifications"
                  detail={
                    model.emailProviderConfigured
                      ? model.alertEmail || "Recipient not configured"
                      : "Email provider not configured"
                  }
                  status={
                    model.emailProviderConfigured && model.emailAlerts
                      ? "provider_connected"
                      : "setup_required"
                  }
                  action={
                    <BotShieldActionButton
                      onClick={() => actions.setPage("policy")}
                    >
                      Configure
                    </BotShieldActionButton>
                  }
                />
                <StatusRow
                  label="Subscription"
                  detail={
                    model.billingStatus?.active
                      ? model.billingStatus.subscription?.name || "Active plan"
                      : "Shopify subscription not active"
                  }
                  status={
                    model.billingStatus?.active ? "active" : "setup_required"
                  }
                  action={
                    !model.billingStatus?.active ? (
                      <BotShieldActionButton
                        onClick={() => actions.setPage("billing")}
                      >
                        Review
                      </BotShieldActionButton>
                    ) : null
                  }
                />
              </s-stack>
            </BotShieldCard>

            <BotShieldCard
              title="Security health"
              subtitle="Calculated from verified setup and real storefront evidence."
              actions={
                <BotShieldActionButton onClick={() => runNextSetupAction(model, actions)}>
                  Improve setup
                </BotShieldActionButton>
              }
            >
              <s-stack gap="base">
                <s-stack direction="inline" gap="base" alignItems="center">
                  <s-heading>
                    {model.securityPosture
                      ? `${model.securityPosture.score.score}/100`
                      : "Calculating"}
                  </s-heading>
                  {model.securityPosture?.score?.grade ? (
                    <s-badge tone="info">
                      {model.securityPosture.score.grade}
                    </s-badge>
                  ) : null}
                </s-stack>
                <s-text color="subdued">
                  {model.securityPosture?.score?.suggestions?.[0] ||
                    "No immediate setup improvements are required."}
                </s-text>
                <s-stack>
                  {(model.securityPosture?.score?.factors || []).map(
                    (factor) => (
                      <s-stack
                        key={factor.key}
                        direction="inline"
                        gap="base"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <s-text color="subdued">{factor.label}</s-text>
                        <BotShieldStatusBadge
                          status={
                            factor.earned === factor.points
                              ? "active"
                              : "setup_required"
                          }
                          label={`${factor.earned}/${factor.points}`}
                        />
                      </s-stack>
                    ),
                  )}
                </s-stack>
              </s-stack>
            </BotShieldCard>
          </s-grid>

          <s-grid
            gridTemplateColumns="repeat(auto-fit, minmax(300px, 1fr))"
            gap="base"
          >
            <BotShieldCard
              title="Top threat signals"
              subtitle="Most frequent suspicious signals from real storefront activity."
              actions={
                <BotShieldActionButton
                  onClick={() => actions.setPage("incidents")}
                >
                  Investigate
                </BotShieldActionButton>
              }
            >
              <InsightList
                items={threatSignals}
                emptyMessage="No elevated threat signals have been recorded."
              />
            </BotShieldCard>
            <BotShieldCard
              title="Traffic origins"
              subtitle="Approximate locations from enriched storefront requests."
            >
              <InsightList
                items={topOrigins}
                emptyMessage="Location intelligence appears after traffic is enriched."
              />
            </BotShieldCard>
          </s-grid>
        </>
      ) : null}

      <BotShieldCard
        title="Recent security activity"
        subtitle={`${model.simulatedScans.length} diagnostic and simulated events excluded`}
        actions={
          <BotShieldActionButton onClick={() => actions.setPage("incidents")}>
            View All Activity
          </BotShieldActionButton>
        }
      >
        {latestEvents.length ? (
          <s-stack>
            {latestEvents.map((event) => (
              <div className="botshield-activity-row" key={event.id}>
                <s-stack
                  direction="inline"
                  gap="base"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <s-stack gap="small-200">
                    <s-text type="strong">
                      {formatMerchantReasons(event.reasons)}
                    </s-text>
                    <s-text color="subdued">
                      {event.actionTaken === "blocked"
                        ? "Stopped"
                        : event.actionTaken === "challenged"
                          ? "Asked to verify"
                          : "Allowed"}{" "}
                      on {event.pathVisited || "storefront"} ·{" "}
                      {formatDate(event.createdAt)}
                    </s-text>
                  </s-stack>
                  <s-stack direction="inline" gap="small">
                    <BotShieldStatusBadge
                      status={event.actionTaken}
                      label={getOutcomeLabel(event.actionTaken)}
                    />
                    <BotShieldStatusBadge
                      status={event.threatLevel}
                      label={getRiskLabel(event.threatLevel)}
                    />
                  </s-stack>
                </s-stack>
              </div>
            ))}
          </s-stack>
        ) : (
          <BotShieldEmptyState
            title="No storefront activity yet"
            description="Enable the theme app embed and visit the storefront to begin receiving real events."
            action={
              !storefrontConnected ? (
                <BotShieldActionButton onClick={actions.openThemeEditor}>
                  Open theme editor
                </BotShieldActionButton>
              ) : null
            }
          />
        )}
      </BotShieldCard>

      <SupportChannelsCard />
    </Screen>
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
    : "More storefront activity is needed before BotShield can identify a reliable pattern.";
  const insightTitle = topSignal && suspiciousEvents.length
    ? `${topSignal.label} dominated suspicious activity`
    : "No reliable threat pattern yet";
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
    <div className="botshield-page">
      <main className="botshield-page-content botshield-analytics-content botshield-analytics-v2">
        <header className="botshield-overview-header">
          <div>
            <h1 className="botshield-overview-title">Analytics</h1>
            <p className="botshield-overview-subtitle">
              Investigate storefront threats, visitor behavior, detection signals, and protection performance.
            </p>
          </div>
        </header>

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
            <label>Decision<select value={decisionFilter} onChange={(event) => { setDecisionFilter(event.target.value); setPage(1); }}><option value="all">All decisions</option><option value="allowed">Allowed</option><option value="challenged">Challenged</option><option value="blocked">Blocked</option></select></label>
            <label>Risk<select value={riskFilter} onChange={(event) => { setRiskFilter(event.target.value); setPage(1); }}><option value="all">All risk levels</option><option value="high">High risk</option><option value="medium">Medium risk</option><option value="low">Low risk</option></select></label>
            {availableSignals.length ? <label>Threat signal<select value={signalFilter} onChange={(event) => { setSignalFilter(event.target.value); setPage(1); }}><option value="all">All signals</option>{availableSignals.map((signal) => <option key={signal} value={signal}>{signal}</option>)}</select></label> : null}
            <label className="botshield-analytics-search">Search<input onChange={(event) => { setSearchFilter(event.target.value); setPage(1); }} placeholder="Path, reason, country, or network" type="search" value={searchFilter} /></label>
            <div className="botshield-analytics-toolbar-actions">
              <BotShieldActionButton onClick={actions.refresh}>Refresh</BotShieldActionButton>
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
          <AnalyticsKpi label="Suspicious events" value={suspiciousEvents.length} detail="Events containing elevated threat signals" />
          <AnalyticsKpi label="Intervention rate" value={`${analyticsPercent(interventionCount, suspiciousEvents.length)}%`} detail="Suspicious traffic blocked or challenged" />
          <AnalyticsKpi label="Top threat signal" value={topSignal?.label || "—"} detail={topSignal ? `${topSignal.count} event${topSignal.count === 1 ? "" : "s"} in this period` : "No suspicious signals detected"} compact />
          <AnalyticsKpi label="High-risk activity" value={highRiskCount} detail="Events classified as high risk" />
        </section>

        <div className="botshield-analytics-section-label">Threat intelligence</div>
        <div className="botshield-analytics-split botshield-analytics-split--primary">
          <AnalyticsPanel title="Threat signal analysis" subtitle="Understand which detection signals are driving suspicious storefront activity.">
            {signalRows.length ? <div className="botshield-analytics-ranked">{signalRows.map((row) => { const interventionRate = analyticsPercent(row.blocked + row.challenged, row.count); return <div className="botshield-analytics-ranked-row" key={row.label}><div className="botshield-analytics-ranked-copy"><strong>{row.label}</strong><span>{row.count.toLocaleString()} event{row.count === 1 ? "" : "s"} · {analyticsPercent(row.count, suspiciousEvents.length)}% of suspicious events</span></div><div className="botshield-analytics-ranked-measure"><AnalyticsBar maximum={signalMaximum} value={row.count} /><span>{interventionRate}% intervention</span></div></div>; })}</div> : <AnalyticsEmpty text="No suspicious threat signals were detected during this period." />}
            {signalRows.length ? <p className="botshield-analytics-footnote">An event may contain multiple signals, so combined signal percentages may exceed 100%.</p> : null}
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
          {suspiciousEvents.length ? <div className={`botshield-analytics-activity${activeActivityBuckets.length <= 2 ? " is-sparse" : ""}`}><div className="botshield-analytics-activity-facts"><div><span>Peak suspicious activity</span><strong>{peakActivityLabel}</strong></div><div><span>Suspicious events</span><strong>{suspiciousEvents.length.toLocaleString()}</strong></div><div><span>Last suspicious event</span><strong>{formatRelativeTime(lastSuspiciousEvent?.createdAt)}</strong></div></div><div className="botshield-analytics-histogram" role="img" aria-label={`Suspicious activity distribution across ${bucketCount} time buckets`}>{activityBuckets.map((bucket) => <span className={bucket.index === peakActivityBucket?.index ? "is-peak" : ""} key={bucket.index} title={`${bucket.label}\nSuspicious events: ${bucket.count}\nBlocked: ${bucket.blocked}\nChallenged: ${bucket.challenged}`}><i style={{ height: `${bucket.count ? Math.max(7, (bucket.count / activityMaximum) * 100) : 0}%` }} /></span>)}</div><div className="botshield-analytics-axis" aria-hidden="true"><span>{activityBuckets[0]?.label}</span><span>{activityBuckets.at(-1)?.label}</span></div></div> : <AnalyticsEmpty text="No suspicious activity was recorded during this period. Try a wider date range or clear filters." />}
        </AnalyticsPanel>

        <><div className="botshield-analytics-section-label">Target and origin intelligence</div><div className="botshield-analytics-split"><AnalyticsPanel title="Most targeted storefront areas" subtitle="Storefront paths receiving the most suspicious activity.">{pathRows.length ? <AnalyticsCompactRanking rows={pathRows} total={suspiciousEvents.length} /> : <AnalyticsEmpty text="No targeted storefront paths were recorded during this period." />}</AnalyticsPanel><AnalyticsPanel title="Attack origins" subtitle="Recorded network classifications associated with suspicious storefront activity.">{attackOriginRows.length ? <AnalyticsCompactRanking rows={attackOriginRows} total={suspiciousEvents.length} /> : <AnalyticsEmpty text="No reliable network origin data was recorded during this period." />}</AnalyticsPanel></div></>

        <><div className="botshield-analytics-section-label">Visitor intelligence</div><AnalyticsPanel title="Recurring suspicious visitors" subtitle="Analyze recurring and high-risk visitor behavior using masked visitor identifiers.">{visitorRows.length ? <div className="botshield-analytics-table-wrap"><table className="botshield-analytics-table botshield-analytics-visitor-table"><thead><tr><th>Visitor</th><th>Events</th><th>Primary signal</th><th>Risk</th><th>Outcome</th><th>Last seen</th></tr></thead><tbody>{visitorRows.map((row) => <tr className={row.count > 1 ? "is-recurring" : ""} key={row.ipAddress}><th><span className="botshield-analytics-visitor-id">{row.masked}</span>{row.count > 1 ? <span className="botshield-analytics-repeat">Repeat</span> : null}</th><td>{row.count}</td><td>{row.signal}</td><td><BotShieldStatusBadge status={row.risk} label={getRiskLabel(row.risk)} /></td><td>{row.outcome}</td><td>{formatRelativeTime(row.lastSeen)}</td></tr>)}</tbody></table></div> : <AnalyticsEmpty text="No recurring suspicious visitors matched this period and filter selection." />}</AnalyticsPanel></>

        <AnalyticsPanel title="Signal combinations" subtitle="Threat signals that appear together in recorded events.">{combinationRows.length ? <div className="botshield-analytics-combinations">{combinationRows.map((row) => <div className="botshield-analytics-combination" key={row.label}><div className="botshield-analytics-combination-signals">{row.label.split(" + ").map((signal, index) => <span key={signal}>{index ? <b aria-hidden="true">+</b> : null}<strong>{signal}</strong></span>)}</div><dl><div><dt>Events</dt><dd>{row.count}</dd></div><div><dt>Share</dt><dd>{analyticsPercent(row.count, suspiciousEvents.length)}%</dd></div><div><dt>Intervention</dt><dd>{analyticsPercent(row.interventions, row.count)}%</dd></div></dl></div>)}</div> : <AnalyticsEmpty text="No multi-signal event combinations were recorded during this period." />}</AnalyticsPanel>

        <aside className="botshield-analytics-insight"><OverviewIcon name="activity" centered /><div><span>Key insight</span><strong>{insightTitle}</strong><p>{insightDetail}</p></div></aside>

        <section className="botshield-analytics-summary" aria-labelledby="analytics-summary-title"><header><span>Investigation</span><h2 id="analytics-summary-title">Investigation summary</h2></header>{suspiciousEvents.length ? <dl>{topSignal ? <div><dt>Most common signal</dt><dd>{topSignal.label}</dd></div> : null}{peakActivityBucket ? <div><dt>Highest-risk period</dt><dd>{peakActivityLabel}</dd></div> : null}{pathRows[0] ? <div><dt>Most targeted path</dt><dd>{formatAnalyticsPath(pathRows[0].label)}</dd></div> : null}{visitorRows[0] ? <div><dt>Most active visitor</dt><dd>{visitorRows[0].masked}</dd></div> : null}</dl> : <p>No suspicious activity is available to summarize for this selection.</p>}</section>

        <div className="botshield-analytics-section-label">Investigation</div>
        <AnalyticsPanel title="Event explorer" subtitle="Filter and inspect the storefront events behind your analytics.">
          {paginatedEvents.length ? <><div className="botshield-analytics-table-wrap"><table className="botshield-analytics-table botshield-analytics-event-table"><thead><tr><th>Time</th><th>Risk</th><th>Threat signal</th><th>Detection reason</th><th>Decision</th><th>Page / path</th><th>Action</th></tr></thead><tbody>{paginatedEvents.map((event) => { const signals = getAnalyticsSignals(event); return <tr key={event.id}><td>{formatAnalyticsTimestamp(event.createdAt)}</td><td><BotShieldStatusBadge status={event.threatLevel} label={getRiskLabel(event.threatLevel)} /></td><td>{signals.join(", ") || "No elevated signal"}</td><td><span title={formatMerchantReasons(event.reasonCodes || event.reasons)}>{formatMerchantReasons(event.reasonCodes || event.reasons)}</span></td><td><BotShieldStatusBadge status={event.actionTaken} label={getOutcomeLabel(event.actionTaken)} /></td><td><span title={event.pathVisited || "/"}>{event.pathVisited || "/"}</span></td><td><button className="botshield-analytics-detail-button" onClick={() => setSelectedEvent(event)} type="button">View details</button></td></tr>; })}</tbody></table></div><div className="botshield-analytics-pagination"><span>{filteredEvents.length.toLocaleString()} matching event{filteredEvents.length === 1 ? "" : "s"}</span><div><button disabled={visiblePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button">Previous</button><span>Page {visiblePage} of {totalPages}</span><button disabled={visiblePage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} type="button">Next</button></div></div></> : <AnalyticsEmpty text={filtersActive ? "No events match these filters. Clear filters or choose a wider date range." : "No storefront events were recorded during this period."} />}
        </AnalyticsPanel>

        {selectedEvent ? <AnalyticsEventDetails event={selectedEvent} onClose={() => setSelectedEvent(null)} /> : null}
      </main>
    </div>
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
      ? `BotShield stopped this request after recording ${signalLabel.toLowerCase()}.`
      : "BotShield stopped this request based on the recorded protection decision.";
  }
  if (decision === "challenged" || decision === "challenge") {
    return hasElevatedSignal
      ? `BotShield requested verification after recording ${signalLabel.toLowerCase()}.`
      : "BotShield requested verification based on the recorded protection decision.";
  }
  return hasElevatedSignal
    ? `BotShield allowed this request while recording ${signalLabel.toLowerCase()} for review.`
    : "BotShield allowed this request because no elevated signals were recorded.";
}

function AnalyticsEventDetails({ event, onClose }) {
  const signals = getAnalyticsSignals(event);
  const networkClassification = getAnalyticsAttackOrigin(event);
  const signalLabel = signals.join(", ") || "No elevated signal";
  const reason = formatMerchantReasons(event.reasonCodes || event.reasons);
  const decisionContext = getAnalyticsDecisionContext(event, signalLabel);
  const hasVisitorDetails = Boolean(
    event.ipAddress || networkClassification || event.networkCountry || event.networkOrg || event.networkProvider,
  );

  useEffect(() => {
    const handleKeyDown = (keyEvent) => {
      if (keyEvent.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return ReactDOM.createPortal(
    <div className="botshield-analytics-detail-backdrop" role="presentation" onMouseDown={(mouseEvent) => { if (mouseEvent.target === mouseEvent.currentTarget) onClose(); }}>
      <section aria-labelledby="analytics-event-detail-title" aria-modal="true" className="botshield-analytics-detail" role="dialog">
        <header>
          <div>
            <h2 id="analytics-event-detail-title">Event details</h2>
            <p>{formatAnalyticsDetailTimestamp(event.createdAt)}</p>
          </div>
          <button aria-label="Close event details" autoFocus onClick={onClose} type="button">×</button>
        </header>
        <div className="botshield-analytics-detail-summary">
          <div>
            <BotShieldStatusBadge status={event.actionTaken} label={getOutcomeLabel(event.actionTaken)} />
            <strong>{getRiskLabel(event.threatLevel)} · {signalLabel}</strong>
          </div>
          <p>{decisionContext}</p>
        </div>
        <div className="botshield-analytics-detail-section">
          <h3>Detection</h3>
          <dl className="botshield-analytics-detail-grid">
            <div><dt>Risk</dt><dd><BotShieldStatusBadge status={event.threatLevel} label={getRiskLabel(event.threatLevel)} /></dd></div>
            <div><dt>Decision</dt><dd><BotShieldStatusBadge status={event.actionTaken} label={getOutcomeLabel(event.actionTaken)} /></dd></div>
            <div className="is-full"><dt>Threat signal</dt><dd>{signalLabel}</dd></div>
            <div className="is-full botshield-analytics-detail-reason"><dt>Detection reason</dt><dd>{reason}</dd></div>
          </dl>
        </div>
        <div className="botshield-analytics-detail-section">
          <h3>Request</h3>
          <dl className="botshield-analytics-detail-grid">
            <div><dt>Page / path</dt><dd>{event.pathVisited || "/"}</dd></div>
            <div><dt>Time</dt><dd>{formatAnalyticsDetailTimestamp(event.createdAt)}</dd></div>
            {event.id ? <div className="is-full botshield-analytics-detail-reference"><dt>Event reference</dt><dd title={String(event.id)}>{String(event.id)}</dd><small>Use this reference when investigating or contacting support.</small></div> : null}
          </dl>
        </div>
        {hasVisitorDetails ? <div className="botshield-analytics-detail-section">
          <h3>Visitor</h3>
          <dl className="botshield-analytics-detail-grid">
            {event.ipAddress ? <div><dt>Visitor</dt><dd>{maskAnalyticsVisitor(event.ipAddress)}</dd></div> : null}
            {networkClassification ? <div><dt>Network classification</dt><dd>{networkClassification}</dd></div> : null}
            {event.networkCountry ? <div><dt>Recorded location</dt><dd>{[event.networkCity, event.networkCountry].filter(Boolean).join(", ")}</dd></div> : null}
            {event.networkOrg || event.networkProvider ? <div><dt>Network</dt><dd>{event.networkOrg || event.networkProvider}</dd></div> : null}
          </dl>
        </div> : null}
      </section>
    </div>,
    document.body,
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
    description: "Orders with elevated risk or review recommendations will appear here.",
  },
  high: {
    title: "No high-risk orders",
    description: "High-risk Shopify orders will appear here when order access is connected.",
  },
  medium: {
    title: "No medium-risk orders",
    description: "Medium-risk orders will appear here when order access is connected.",
  },
  "pending-fulfillment": {
    title: "No risky orders are currently pending fulfillment",
    description: "Risky unfulfilled orders will appear here when order access is connected.",
  },
  all: {
    title: "No orders available for review",
    description: "Assessed orders will appear here when order access is connected.",
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
        title: "Connect order risk to start reviewing orders",
        description:
          "Supported Shopify order access is required before elevated-risk orders can appear here.",
        actionLabel: "Review setup",
        onAction: onOpenSetup,
        variant: "disconnected",
        compact: true,
      };
    }

    return {
      title: filterEmpty.title,
      description: "Order risk access is not connected yet.",
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
  return (
    <header className="botshield-overview-header botshield-fraud-header">
      <div>
        <h1 className="botshield-overview-title">Fraud Orders</h1>
        <p className="botshield-overview-subtitle">
          Review risky Shopify orders, understand why they were flagged, and investigate them before fulfillment.
        </p>
      </div>
      {onRefresh ? (
        <BotShieldAsyncButton action={onRefresh} successMessage="Order review refreshed">
          Refresh
        </BotShieldAsyncButton>
      ) : null}
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
        <span className="botshield-v2-eyebrow">Order risk status</span>
        <h2 id="order-risk-status-title">Order risk needs setup</h2>
        <p>Connect supported Shopify order access to review elevated-risk orders.</p>
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
          ? "Not available in this BotShield release yet."
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
            <p>Connect order risk to start reviewing suspicious orders.</p>
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
                  Connect supported Shopify order access to begin reviewing elevated-risk orders.
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
                ? "Order access isn't available in this release."
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
              Connect order access
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
                ? "This order may require review before fulfillment."
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
              <p>No additional risk signals are available for this order.</p>
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
                ? `Review Shopify's ${String(order.recommendation).toLowerCase()} recommendation and documented assessment facts before fulfilling this order.`
                : "Wait for the risk assessment to complete before making a fulfillment decision."}
            </p>
            <p className="botshield-fraud-drawer-source-note">
              Risk information shown here comes from Shopify. BotShield does not generate Shopify
              order risk assessments.
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
      <p>Loading order risk assessments…</p>
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
    <>
      <div className="botshield-page">
        <main className="botshield-page-content botshield-fraud-orders-content">
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
              {!connected ? null : (
                <p>
                  Prioritized orders with elevated fraud signals or recommendations that may need
                  review before fulfillment.
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
        </main>
      </div>

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
  );
}

// Retained only to keep older preview snapshots readable. No active route or
// navigation exposes this screen until Shopify order-risk syncing exists.
// eslint-disable-next-line no-unused-vars
function FraudOrdersDisconnected({ onOpenSetup }) {
  return <FraudOrdersPage model={{ fraudOrderAccessConnected: false, fraudOrders: [] }} actions={{}} />;
}

// Kept temporarily for older preview snapshots; it is not rendered.
// eslint-disable-next-line no-unused-vars
function LegacyFraudOrdersPage({ model, actions }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const fraudOrders = Array.isArray(model.fraudOrders) ? model.fraudOrders : [];
  const fraudOrderAutoBlock = Boolean(model.fraudOrderAutoBlock);
  const fraudOrderAutoCancel = Boolean(model.fraudOrderAutoCancel);
  const fraudOrderRestock = model.fraudOrderRestock !== false;
  const fraudOrderNotifyCustomer = Boolean(model.fraudOrderNotifyCustomer);
  const fraudOrderFilterEnabled = model.fraudOrderFilterEnabled !== false;
  const orderMetrics = fraudOrders.reduce(
    (summary, order) => {
      const risk = String(order.risk || order.riskLevel || "").toLowerCase();
      if (risk.includes("high")) summary.high += 1;
      else if (risk.includes("medium")) summary.medium += 1;
      else if (risk.includes("low")) summary.low += 1;
      return summary;
    },
    { high: 0, low: 0, medium: 0 },
  );

  return (
    <div className="botshield-page">
      <main className="botshield-page-content botshield-overview-content botshield-fraud-orders-content">
        <div className="botshield-protection-header">
          <div>
            <h1 className="botshield-overview-title botshield-protection-page-title">
              Fraud Orders
            </h1>
            <p className="botshield-overview-subtitle">
              Review risky Shopify orders and automate follow-up actions when
              fraud risk is high.
            </p>
          </div>
          <BotShieldActionButton
            onClick={() => setHelpOpen(true)}
            variant="primary"
          >
            Get help
          </BotShieldActionButton>
        </div>

        <section className="botshield-fraud-automation-stack">
          <BotShieldCard>
            <div className="botshield-fraud-automation-row">
              <div>
                <div className="botshield-fraud-title-row">
                  <h2 className="botshield-fraud-card-title">
                    Auto-block visitors placing fraud orders
                  </h2>
                  <span
                    className={`botshield-overview-badge${
                      fraudOrderAutoBlock
                        ? ""
                        : " botshield-overview-badge--muted"
                    }`}
                  >
                    {fraudOrderAutoBlock ? "On" : "Off"}
                  </span>
                </div>
                <p className="botshield-fraud-card-copy">
                  When Shopify recommends canceling a high-risk order,
                  BotShield can automatically add that order&apos;s IP to managed IP
                  blocking.
                </p>
                <p className="botshield-fraud-card-note">
                  High-risk threshold uses Shopify fraud recommendation: Cancel.
                </p>
              </div>
              <BotShieldAsyncButton
                action={() =>
                  actions.saveFraudOrderSettings({
                    fraudOrderAutoBlock: !fraudOrderAutoBlock,
                  })
                }
                successMessage={
                  fraudOrderAutoBlock
                    ? "Auto-block turned off"
                    : "Auto-block turned on"
                }
                variant="primary"
              >
                {fraudOrderAutoBlock ? "Turn off" : "Turn on"}
              </BotShieldAsyncButton>
            </div>
          </BotShieldCard>

          <BotShieldCard>
            <div className="botshield-fraud-automation-row">
              <div>
                <div className="botshield-fraud-title-row">
                  <h2 className="botshield-fraud-card-title">
                    Auto-cancel high-risk orders
                  </h2>
                  <span
                    className={`botshield-overview-badge${
                      fraudOrderAutoCancel
                        ? ""
                        : " botshield-overview-badge--muted"
                    }`}
                  >
                    {fraudOrderAutoCancel ? "On" : "Off"}
                  </span>
                </div>
                <p className="botshield-fraud-card-copy">
                  Automatically send Shopify&apos;s fraud cancel action when the
                  recommendation is Cancel.
                </p>
                <div className="botshield-fraud-pill-row">
                  <span
                    className={`botshield-overview-badge${
                      fraudOrderRestock
                        ? ""
                        : " botshield-overview-badge--muted"
                    }`}
                  >
                    Restock {fraudOrderRestock ? "On" : "Off"}
                  </span>
                  <span
                    className={`botshield-overview-badge${
                      fraudOrderNotifyCustomer
                        ? ""
                        : " botshield-overview-badge--muted"
                    }`}
                  >
                    Notify customer {fraudOrderNotifyCustomer ? "On" : "Off"}
                  </span>
                </div>
              </div>
              <div className="botshield-fraud-button-stack">
                <BotShieldAsyncButton
                  action={() =>
                    actions.saveFraudOrderSettings({
                      fraudOrderRestock: !fraudOrderRestock,
                    })
                  }
                  successMessage={
                    fraudOrderRestock ? "Restock disabled" : "Restock enabled"
                  }
                >
                  {fraudOrderRestock ? "Disable restock" : "Enable restock"}
                </BotShieldAsyncButton>
                <BotShieldAsyncButton
                  action={() =>
                    actions.saveFraudOrderSettings({
                      fraudOrderNotifyCustomer: !fraudOrderNotifyCustomer,
                    })
                  }
                  successMessage={
                    fraudOrderNotifyCustomer
                      ? "Customer notification disabled"
                      : "Customer notification enabled"
                  }
                >
                  {fraudOrderNotifyCustomer ? "Disable notify" : "Enable notify"}
                </BotShieldAsyncButton>
                <BotShieldAsyncButton
                  action={() =>
                    actions.saveFraudOrderSettings({
                      fraudOrderAutoCancel: !fraudOrderAutoCancel,
                    })
                  }
                  successMessage={
                    fraudOrderAutoCancel
                      ? "Auto-cancel turned off"
                      : "Auto-cancel turned on"
                  }
                  variant="primary"
                >
                  {fraudOrderAutoCancel ? "Turn off" : "Turn on"}
                </BotShieldAsyncButton>
              </div>
            </div>
          </BotShieldCard>

          <BotShieldCard>
            <div className="botshield-fraud-automation-row">
              <div>
                <div className="botshield-fraud-title-row">
                  <h2 className="botshield-fraud-card-title">Fraud filter</h2>
                  <span
                    className={`botshield-overview-badge${
                      fraudOrderFilterEnabled
                        ? ""
                        : " botshield-overview-badge--muted"
                    }`}
                  >
                    {fraudOrderFilterEnabled ? "On" : "Off"}
                  </span>
                </div>
                <p className="botshield-fraud-card-copy">
                  Turn on the fraud filter to sync Shopify fraud
                  recommendations, review risky orders, and trigger follow-up
                  actions from the analytics screen.
                </p>
              </div>
              <BotShieldAsyncButton
                action={() =>
                  actions.saveFraudOrderSettings({
                    fraudOrderFilterEnabled: !fraudOrderFilterEnabled,
                  })
                }
                successMessage={
                  fraudOrderFilterEnabled
                    ? "Fraud filter turned off"
                    : "Fraud filter turned on"
                }
              >
                {fraudOrderFilterEnabled ? "Turn off" : "Turn on"}
              </BotShieldAsyncButton>
            </div>
          </BotShieldCard>
        </section>

        <BotShieldCard title="Overview">
          <div className="botshield-fraud-metric-grid">
            {[
              ["Total order", fraudOrders.length],
              ["Total low risk order", orderMetrics.low],
              ["Total medium risk order", orderMetrics.medium],
              ["Total high risk order", orderMetrics.high],
            ].map(([label, value]) => (
              <div className="botshield-fraud-metric-card" key={label}>
                <div className="botshield-overview-metric-title">{label}</div>
                <div className="botshield-overview-metric-value">{value}</div>
              </div>
            ))}
          </div>
        </BotShieldCard>

        <BotShieldCard title="Risky orders">
          {fraudOrders.length ? (
            <div className="botshield-fraud-table-wrap">
              <table className="botshield-fraud-table">
                <thead>
                  <tr>
                    {[
                      "Order",
                      "Customer",
                      "Risk",
                      "Recommendation",
                      "Reason",
                      "Date",
                      "Action",
                    ].map((heading) => (
                      <th key={heading}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fraudOrders.map((order) => (
                    <tr key={order.id || order.orderId || order.name}>
                      <td>{order.name || order.orderName || "Order"}</td>
                      <td>{order.customer || order.customerName || "—"}</td>
                      <td>{order.risk || order.riskLevel || "Review"}</td>
                      <td>{order.recommendation || "Review"}</td>
                      <td>{order.reason || "Shopify fraud signal"}</td>
                      <td>{order.date || order.createdAt || "—"}</td>
                      <td>—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <BotShieldEmptyState
              title="No risky orders yet"
              description="BotShield will show Shopify fraud recommendations here when risky orders are detected."
              action={
                <BotShieldAsyncButton
                  action={actions.refresh}
                  successMessage="Fraud orders refreshed"
                >
                  Refresh orders
                </BotShieldAsyncButton>
              }
            />
          )}
        </BotShieldCard>

        {helpOpen ? (
          <div
            aria-modal="true"
            className="botshield-protection-modal-backdrop"
            role="dialog"
          >
            <div className="botshield-protection-modal">
              <h2 className="botshield-protection-modal-title">
                Fraud Orders help
              </h2>
              <p className="botshield-protection-modal-copy">
                Fraud Orders will show Shopify order-risk recommendations when
                order-side fraud syncing is connected. Today, BotShield&apos;s active
                protection is focused on storefront visitor decisions.
              </p>
              <BotShieldActionButton
                onClick={() => setHelpOpen(false)}
                variant="primary"
              >
                Close
              </BotShieldActionButton>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function ActivityTable({ model, actions }) {
  if (!model.incidentLoading && !model.incidents.length) {
    const realOnly = model.incidentFilters.source === "real";
    return (
      <BotShieldEmptyState
        title={
          realOnly
            ? "No storefront visitors match these filters."
            : "No visitor activity matches these filters."
        }
        description={
          realOnly
            ? "New storefront decisions will appear here after visitors load your store."
            : "Try changing the filters or search term."
        }
      />
    );
  }
  return (
    <s-table loading={model.incidentLoading} variant="auto">
      <s-table-header-row>
        {[
          "Visitor",
          "Time",
          "Outcome",
          "Risk",
          "Reason",
          "Location",
          "Actions",
        ].map((heading) => (
          <s-table-header key={heading}>{heading}</s-table-header>
        ))}
      </s-table-header-row>
      <s-table-body>
        {model.incidents.map((incident) => (
          <s-table-row key={incident.id}>
            <s-table-cell>
              <s-stack gap="small-200">
                <s-text type="strong">{incident.maskedIpAddress}</s-text>
                <s-text color="subdued">{incident.path || "Storefront"}</s-text>
              </s-stack>
            </s-table-cell>
            <s-table-cell>
              <s-text color="subdued">{formatDate(incident.createdAt)}</s-text>
            </s-table-cell>
            <s-table-cell>
              <BotShieldStatusBadge
                status={incident.decision}
                label={getOutcomeLabel(incident.decision)}
              />
            </s-table-cell>
            <s-table-cell>
              <BotShieldStatusBadge
                status={incident.threatLevel}
                label={getRiskLabel(incident.threatLevel)}
              />
            </s-table-cell>
            <s-table-cell>
              {formatMerchantReasons(incident.reasonCodes || incident.reasons)}
            </s-table-cell>
            <s-table-cell>
              {[incident.networkCity, incident.networkCountry]
                .filter(Boolean)
                .join(", ") || "Location unavailable"}
            </s-table-cell>
            <s-table-cell>
              {incident.decision === "blocked" ? (
                <s-button-group>
                  <BotShieldAsyncButton
                    action={() =>
                      actions.recoverIncident(incident.id, "unblock")
                    }
                    successMessage="Visitor unblocked"
                  >
                    Unblock
                  </BotShieldAsyncButton>
                  <BotShieldAsyncButton
                    action={() =>
                      actions.recoverIncident(incident.id, "whitelist")
                    }
                    successMessage="Visitor trusted"
                  >
                    Trust
                  </BotShieldAsyncButton>
                </s-button-group>
              ) : null}
            </s-table-cell>
          </s-table-row>
        ))}
      </s-table-body>
    </s-table>
  );
}

function ActivityInvestigationSummary({
  blocked,
  model,
  actions,
}) {
  const reviewCount = model.incidents.filter(
    (incident) =>
      incident.threatLevel === "high" ||
      incident.decision === "blocked" ||
      incident.decision === "challenged",
  ).length;
  const latestReviewEvent =
    model.incidents.find(
      (incident) =>
        incident.threatLevel === "high" ||
        incident.decision === "blocked" ||
        incident.decision === "challenged",
    ) || model.incidents[0];
  const trafficLabel =
    model.incidentFilters.source === "simulation"
      ? "Simulation data"
      : model.incidentFilters.source === "all"
        ? "Real and simulated data"
        : "Real storefront traffic";

  return (
    <s-grid
      gridTemplateColumns="minmax(0, 1.2fr) minmax(300px, 0.8fr)"
      gap="large"
    >
      <BotShieldCard
        title="Review queue"
        subtitle="Visitors that may need a merchant decision."
        badge={
          <BotShieldStatusBadge
            status={reviewCount ? "challenged" : "active"}
            label={reviewCount ? "Review recommended" : "No urgent review"}
          />
        }
        accent
      >
        <s-stack gap="large">
          <div className="botshield-status-value">
            {reviewCount
              ? `${reviewCount} decisions in this view may need review`
              : "No urgent issues"}
          </div>
          <s-paragraph color="subdued">
            {reviewCount
              ? "Review blocked, challenged, and high-risk visitors to confirm BotShield is responding correctly."
              : "BotShield has not found urgent storefront activity in the current view."}
          </s-paragraph>
          <s-grid
            gridTemplateColumns="repeat(auto-fit, minmax(140px, 1fr))"
            gap="base"
          >
            <s-stack gap="small-200">
              <s-text color="subdued">Current view</s-text>
              <s-text type="strong">{trafficLabel}</s-text>
            </s-stack>
            <s-stack gap="small-200">
              <s-text color="subdued">Real events</s-text>
              <s-text type="strong">{model.incidentCounts.real}</s-text>
            </s-stack>
            <s-stack gap="small-200">
              <s-text color="subdued">Simulations</s-text>
              <s-text type="strong">{model.incidentCounts.simulation}</s-text>
            </s-stack>
          </s-grid>
        </s-stack>
      </BotShieldCard>

      <BotShieldCard
        title="Next best action"
        subtitle="Fast recovery tools for false positives."
      >
        <s-stack>
          <StatusRow
            label="Review risky visitors"
            detail={
              latestReviewEvent
                ? `${getOutcomeLabel(latestReviewEvent.decision)} · ${formatMerchantReasons(latestReviewEvent.reasonCodes || latestReviewEvent.reasons)}`
                : "No visitor decisions match the current filters."
            }
            status={
              latestReviewEvent?.threatLevel === "high"
                ? "high"
                : latestReviewEvent?.decision || "active"
            }
            action={
              <BotShieldActionButton
                onClick={() => {
                  actions.setIncidentFilter("source", "real");
                  actions.setIncidentFilter("decision", "all");
                  actions.setIncidentFilter("risk", "high");
                }}
              >
                Show high risk
              </BotShieldActionButton>
            }
          />
          <StatusRow
            label="Recover false positives"
            detail="Blocked visitors can be unblocked or added to trusted visitors from the table."
            status={blocked ? "blocked" : "active"}
            action={
              <BotShieldActionButton
                onClick={() => {
                  actions.setIncidentFilter("source", "real");
                  actions.setIncidentFilter("decision", "blocked");
                  actions.setIncidentFilter("risk", "all");
                }}
              >
                Show blocked
              </BotShieldActionButton>
            }
          />
        </s-stack>
      </BotShieldCard>
    </s-grid>
  );
}

function ActivityPage({ model, actions }) {
  const blocked = Number(model.incidentCounts?.blocked || 0);
  const challenged = Number(model.incidentCounts?.challenged || 0);
  const highRisk = Number(model.incidentCounts?.highRisk || 0);
  const setActivityTab = (decision, risk = "all") => {
    actions.setIncidentFilter("source", "real");
    actions.setIncidentFilter("decision", decision);
    actions.setIncidentFilter("risk", risk);
  };

  return (
    <Screen
      title="Visitor Activity"
      subtitle="Review storefront decisions, suspicious visitors, and false-positive recovery."
      maxWidth="full"
      actions={
        <BotShieldAsyncButton
          action={actions.refreshIncidents}
          successMessage="Activity refreshed"
          icon="refresh"
        >
          Refresh
        </BotShieldAsyncButton>
      }
    >
      <ActivityInvestigationSummary
        blocked={blocked}
        model={model}
        actions={actions}
      />
      <s-grid
        gridTemplateColumns="repeat(auto-fit, minmax(170px, 1fr))"
        gap="base"
      >
        <Metric
          label="Storefront events"
          value={model.incidentCounts.total}
          detail="Last 30 days"
          status="real_storefront"
        />
        <Metric
          label="Blocked events"
          value={blocked}
          detail="Last 30 days"
          status={blocked ? "blocked" : "active"}
        />
        <Metric
          label="Challenged events"
          value={challenged}
          detail="Verification requested"
          status={challenged ? "challenged" : "active"}
        />
        <Metric
          label="High risk"
          value={highRisk}
          detail="Events requiring review"
          status={highRisk ? "high" : "low"}
        />
      </s-grid>
      <BotShieldCard
        title="Filter activity"
        subtitle="Focus the table on the visitors you want to review."
      >
        <s-stack gap="base">
          <s-stack direction="inline" gap="small" alignItems="center">
            <BotShieldActionButton onClick={() => setActivityTab("all")}>
              All visitors
            </BotShieldActionButton>
            <BotShieldActionButton onClick={() => setActivityTab("blocked")}>
              Blocked visitors
            </BotShieldActionButton>
            <BotShieldActionButton onClick={() => setActivityTab("challenged")}>
              Verification requested
            </BotShieldActionButton>
            <BotShieldActionButton onClick={() => setActivityTab("allowed")}>
              Allowed visitors
            </BotShieldActionButton>
            <BotShieldActionButton
              onClick={() => setActivityTab("all", "high")}
            >
              High-risk visitors
            </BotShieldActionButton>
          </s-stack>
          <s-grid
            gridTemplateColumns="repeat(auto-fit, minmax(180px, 1fr))"
            gap="base"
          >
            <BotShieldSelect
              label="Source"
              value={model.incidentFilters.source}
              onChange={(value) => actions.setIncidentFilter("source", value)}
              options={[
                { label: "Real storefront", value: "real" },
                { label: "Simulations", value: "simulation" },
                { label: "All sources", value: "all" },
              ]}
            />
            <BotShieldSelect
              label="Decision"
              value={model.incidentFilters.decision}
              onChange={(value) => actions.setIncidentFilter("decision", value)}
              options={[
                { label: "All decisions", value: "all" },
                { label: "Allowed", value: "allowed" },
                { label: "Verification requested", value: "challenged" },
                { label: "Blocked", value: "blocked" },
              ]}
            />
            <BotShieldSelect
              label="Risk"
              value={model.incidentFilters.risk}
              onChange={(value) => actions.setIncidentFilter("risk", value)}
              options={[
                { label: "All risk levels", value: "all" },
                { label: "Low", value: "low" },
                { label: "Medium", value: "medium" },
                { label: "High", value: "high" },
              ]}
            />
            <BotShieldTextField
              label="Search"
              value={model.incidentFilters.search}
              onChange={(value) => actions.setIncidentFilter("search", value)}
              placeholder="IP, path, location, or signal"
            />
          </s-grid>
        </s-stack>
      </BotShieldCard>
      <BotShieldCard
        title="Visitor decisions"
        subtitle={`${model.incidentCounts.total} real storefront decisions in the last 30 days · ${model.incidentCounts.simulation} diagnostic or simulated events excluded`}
      >
        <ActivityTable model={model} actions={actions} />
      </BotShieldCard>
    </Screen>
  );
}

function ProtectionPage({ model, actions }) {
  const toast = useBotShieldToast();
  const [protectionModal, setProtectionModal] = useState(null);
  const [blockedIpInput, setBlockedIpInput] = useState("");
  const [trustedIpInput, setTrustedIpInput] = useState("");
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
  const [saveSuccess, setSaveSuccess] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const closeButtonRef = useRef(null);
  const drawerOpenerRef = useRef(null);

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
    setProtectionModal(null);
    setConfirmDiscard(false);
    setSaveError("");
    setSaveSuccess("");
    window.setTimeout(() => drawerOpenerRef.current?.focus?.(), 0);
  };

  const requestClose = () => {
    if (saving) return;
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    closeDrawer();
  };

  const discardAndClose = () => {
    setDraft(originalDraft);
    closeDrawer();
  };

  useEffect(() => {
    if (!protectionModal) return undefined;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dirty, protectionModal, saving]);

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setSaveError("");
    setSaveSuccess("");
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
      setSaveSuccess("Settings saved");
      toast.success("Protection settings saved");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Couldn’t save protection settings";
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const openProfileManager = (title, text, note, module = "policy") => {
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
    setSaveSuccess("");
    setConfirmDiscard(false);
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

  const storefrontConnected = Boolean(model.protectionStatus?.themeEmbedDetected);
  const runtimeActive = Boolean(model.protectionReady && !model.protectionPaused);
  const moduleStatus = runtimeActive
    ? { label: "Active", status: "active" }
    : model.protectionPaused
      ? { label: "Paused", status: "attention" }
      : { label: "Needs setup", status: "setup_required" };
  const pageStatus = storefrontConnected
    ? { label: model.protectionPaused ? "Paused" : "Connected", status: model.protectionPaused ? "attention" : "active" }
    : { label: "Needs setup", status: "setup_required" };
  const protectionRows = [
    {
      icon: "shield",
      name: "Bot protection",
      description: "Detects automated browsers and suspicious automation behavior.",
      configLabel: "Protection profile",
      configValue: model.strictMode ? "Strict" : model.blockLevel,
      ...moduleStatus,
      active: runtimeActive,
      action: () =>
        openProfileManager(
          "Bot protection",
          "Detects automated browsers and suspicious user-agent patterns.",
          undefined,
          "bot",
        ),
    },
    {
      icon: "network",
      name: "Network / Proxy protection",
      description: "Identifies suspicious VPN, proxy, hosting, and datacenter traffic.",
      configLabel: "Detection",
      configValue: "Automatic",
      ...moduleStatus,
      active: runtimeActive,
      action: () =>
        openStatusManager(
          "Network / Proxy protection",
          "Uses VPN, proxy, datacenter, hosting provider, and ASN signals.",
          "Network intelligence is active when storefront traffic is evaluated. Per-module network risk weighting is controlled by the active protection profile.",
          moduleStatus,
          "network",
        ),
    },
    {
      icon: "rate",
      name: "Rate protection",
      description: "Detects unusually frequent or repetitive visitor activity.",
      configLabel: "Protection profile",
      configValue: model.strictMode ? "Strict" : model.blockLevel,
      ...moduleStatus,
      active: runtimeActive,
      action: () =>
        openProfileManager(
          "Rate protection",
          "Flags unusually frequent visits from the same visitor pattern.",
          "Rate protection uses the active protection profile. Adjust sensitivity and automated response below.",
          "rate",
        ),
    },
    {
      icon: "page",
      name: "Page protection",
      description: "Applies protection decisions across supported storefront requests.",
      configLabel: "Storefront connection",
      configValue: storefrontConnected ? "Theme embed" : "Not connected",
      ...pageStatus,
      active: storefrontConnected && !model.protectionPaused,
      action: () =>
        openStatusManager(
          "Page protection",
          "Redirects stopped visitors to BotShield's blocked page.",
          "Page protection is active through the storefront theme embed and app proxy.",
          pageStatus,
          "page",
        ),
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
  const openBlocklist = () => setProtectionModal({ type: "blocklist", title: "Blocked visitors", text: "Manage visitors manually prevented from accessing the storefront." });
  const openTrusted = () => setProtectionModal({ type: "trusted", title: "Trusted visitors", text: "Manage visitors allowed to bypass supported BotShield protection checks." });

  if (model) {
    return (
      <div className="botshield-page">
      <main className="botshield-page-content botshield-protection-content">
        <div className="botshield-protection-header">
          <div>
            <h1 className="botshield-overview-title botshield-protection-page-title">
              Protection
            </h1>
            <p className="botshield-overview-subtitle">
              Configure how BotShield detects and responds to suspicious storefront traffic.
            </p>
          </div>
        </div>

        <section className={`botshield-protection-status ${protectionHealthy ? "is-healthy" : "is-attention"}`}>
          <div className="botshield-protection-status-icon"><OverviewIcon name="shield" centered /></div>
          <div>
            <span>Protection status</span>
            <h2>{protectionHealthy ? "Protection active" : "Protection needs attention"}</h2>
            <p>{model.protectionPaused ? "Protection is temporarily paused. Resume protection to restore storefront enforcement." : storefrontConnected ? "BotShield is evaluating storefront traffic using your configured protection rules." : "Connect the storefront theme app embed before full storefront coverage is available."}</p>
          </div>
          <div className="botshield-protection-status-action">
            <BotShieldStatusBadge status={protectionHealthy ? "active" : "setup_required"} label={`${activeProtections} of ${protectionRows.length} modules active`} />
            {!storefrontConnected ? <BotShieldActionButton onClick={actions.openThemeEditor} variant="primary">Review setup</BotShieldActionButton> : null}
          </div>
        </section>

        <section className="botshield-protection-section">
          <div className="botshield-protection-section-heading"><span>Protection modules</span><h2>Protection modules</h2><p>Configure the detection layers BotShield uses to protect your storefront.</p></div>
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
          <div className="botshield-protection-section-heading"><span>Enforcement</span><h2>Protection policy</h2><p>Control how BotShield responds when suspicious traffic is detected.</p></div>
          <div className="botshield-protection-policy">
            <div className="botshield-protection-policy-main">
              <div className="botshield-protection-policy-flow">
                <div><span>Detection</span><strong>{model.strictMode ? "Strict" : model.blockLevel} profile</strong><small>Storefront signals evaluated</small></div>
                <b aria-hidden="true">→</b>
                <div><span>Decision</span><strong>Risk classified</strong><small>Low, medium, or high</small></div>
                <b aria-hidden="true">→</b>
                <div><span>Action</span><strong>{model.autoBlock ? "Enforce" : "Record only"}</strong><small>{model.autoBlock ? "Apply configured response" : "Observe without intervention"}</small></div>
              </div>
              <p>BotShield evaluates recorded signals, classifies risk, and applies the configured storefront response.</p>
            </div>
            <div className="botshield-protection-policy-side">
              <div className="botshield-protection-policy-map"><div><BotShieldStatusBadge status="high" label="High risk" /><span>{model.autoBlock ? "Stop or request verification" : "Allow and record"}</span></div><div><BotShieldStatusBadge status="medium" label="Medium risk" /><span>{model.autoBlock ? "Request verification" : "Allow and record"}</span></div><div><BotShieldStatusBadge status="low" label="Low risk" /><span>Allow</span></div></div>
              <BotShieldActionButton onClick={() => openProfileManager("Protection policy", "Configure BotShield's shared storefront detection and response profile.")} variant="primary">Configure policy</BotShieldActionButton>
            </div>
          </div>
        </section>

        <section className="botshield-protection-section">
          <div className="botshield-protection-section-heading"><span>Access controls</span><h2>Visitor access</h2><p>Manage visitors that BotShield should always block or trust.</p></div>
          <div className="botshield-protection-access-grid">
            <article><div className="botshield-protection-access-icon"><OverviewIcon name="block" centered /></div><div className="botshield-protection-access-content"><h3>Blocked visitors</h3><p>Visitors manually prevented from accessing the storefront.</p><div className="botshield-protection-access-count"><strong>{model.blockedIPs.length}</strong><span>Blocked visitor{model.blockedIPs.length === 1 ? "" : "s"}</span></div></div><BotShieldActionButton onClick={openBlocklist}>Manage blocklist</BotShieldActionButton></article>
            <article><div className="botshield-protection-access-icon"><OverviewIcon name="visitor" centered /></div><div className="botshield-protection-access-content"><h3>Trusted visitors</h3><p>Visitors allowed to bypass supported BotShield protection checks.</p><div className="botshield-protection-access-count"><strong>{model.whitelist.length}</strong><span>Trusted visitor{model.whitelist.length === 1 ? "" : "s"}</span></div></div><BotShieldActionButton onClick={openTrusted}>Manage trusted visitors</BotShieldActionButton></article>
          </div>
        </section>
        {protectionModal && typeof document !== "undefined" ? ReactDOM.createPortal((
          <div
            aria-modal="true"
            className="botshield-protection-modal-backdrop"
            role="dialog"
            aria-labelledby="botshield-protection-drawer-title"
            onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}
          >
            <div
              className={`botshield-protection-modal${
                ["profile", "blocklist", "trusted", "create"].includes(
                  protectionModal.type,
                )
                  ? " botshield-protection-modal--wide"
                  : ""
              }`}
            >
              <header className="botshield-protection-drawer-header"><div><h2 className="botshield-protection-modal-title" id="botshield-protection-drawer-title">{protectionModal.title}</h2><p className="botshield-protection-modal-copy">{protectionModal.text}</p></div><button aria-label="Close" ref={closeButtonRef} disabled={saving} onClick={requestClose} type="button">×</button></header>
              {protectionModal.type === "profile" ? (
                <div className="botshield-protection-modal-body">
                  {saveError ? <BotShieldBanner tone="critical" title={`Couldn’t save ${protectionModal.title} settings`}>Your changes haven’t been applied. {saveError}</BotShieldBanner> : null}
                  {saveSuccess ? <div className="botshield-protection-save-success" role="status">{saveSuccess}</div> : null}
                  <section className="botshield-protection-drawer-section">
                    <div className="botshield-protection-drawer-section-label">Protection level</div>
                  <BotShieldSelect
                    label="Sensitivity"
                    value={draft.blockLevel}
                    details={draft.blockLevel === "Low" ? "Limits intervention to the clearest abuse signals." : draft.blockLevel === "High" ? "Applies the strongest supported detection profile." : "Balanced detection intended for most storefronts."}
                    onChange={(blockLevel) => {
                      setSaveError("");
                      setSaveSuccess("");
                      setDraft((current) => ({ ...current, blockLevel, strictMode: blockLevel !== "High" ? false : current.strictMode }));
                    }}
                    options={[
                      { label: "Low — fewer interventions", value: "Low" },
                      { label: "Medium — balanced protection", value: "Medium" },
                      { label: "High — strict protection", value: "High" },
                    ]}
                  />
                  </section>
                  <section className="botshield-protection-drawer-section">
                    <div className="botshield-protection-drawer-section-label">Automation</div>
                  <BotShieldToggle
                    label="Auto Block"
                    details="Automatically block requests that cross the active risk threshold."
                    checked={draft.autoBlock}
                    onChange={(autoBlock) => {
                      setSaveError("");
                      setSaveSuccess("");
                      setDraft((current) => ({ ...current, autoBlock }));
                    }}
                  />
                  <BotShieldToggle
                    label="Strict Mode"
                    details="Use High sensitivity and the strongest available rule profile."
                    checked={draft.strictMode}
                    onChange={(strictMode) => {
                      setSaveError("");
                      setSaveSuccess("");
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
                    <div className="botshield-protection-drawer-section-label">Effective enforcement</div>
                    <div className="botshield-protection-decision-preview">
                      <div><span>Risk threshold</span><strong>{effectiveThreshold} / 100</strong></div>
                      <div><span>Response</span><strong>{draft.autoBlock ? "Stop matching traffic" : "Record only"}</strong></div>
                    </div>
                    <p className="botshield-protection-drawer-explanation">
                      {draft.autoBlock
                        ? `Requests scoring ${effectiveThreshold} or higher are stopped by the active policy.`
                        : "Suspicious requests are recorded, but automated blocking is disabled."}
                    </p>
                  </section>
                  <section className="botshield-protection-drawer-section">
                    <div className="botshield-protection-drawer-section-label">
                      {protectionModal.module === "rate" ? "Rate signals" : protectionModal.module === "bot" ? "Bot signals" : "Decision flow"}
                    </div>
                    {protectionModal.module === "rate" ? (
                      <>
                        <p className="botshield-protection-signal-note">
                          Choose which behavioral signals contribute to a visitor’s risk score. Changes apply after you save.
                        </p>
                        <div className="botshield-protection-rate-controls" aria-label="Rate protection controls">
                          <BotShieldToggle label="Repeated activity" details="Adds 8 risk points after 3 recent requests from the same IP within one hour." checked={draft.repeatedActivityEnabled} onChange={(repeatedActivityEnabled) => setDraft((current) => ({ ...current, repeatedActivityEnabled }))} />
                          <BotShieldToggle label="Elevated request rate" details="Adds 20 risk points after 6 recent requests from the same IP within one hour." checked={draft.elevatedRateEnabled} onChange={(elevatedRateEnabled) => setDraft((current) => ({ ...current, elevatedRateEnabled }))} />
                          <BotShieldToggle label="Burst traffic" details="Adds 40 risk points after 12 recent requests from the same IP within one hour." checked={draft.burstTrafficEnabled} onChange={(burstTrafficEnabled) => setDraft((current) => ({ ...current, burstTrafficEnabled }))} />
                          <BotShieldToggle label="Repeat offender" details="Adds risk when the visitor was previously blocked; 3 previous blocks apply the stronger signal." checked={draft.repeatOffenderEnabled} onChange={(repeatOffenderEnabled) => setDraft((current) => ({ ...current, repeatOffenderEnabled }))} />
                          <BotShieldToggle label="Multi-page scanning" details="Adds risk when the same visitor rapidly accesses 5 or more distinct storefront paths." checked={draft.pathScanningEnabled} onChange={(pathScanningEnabled) => setDraft((current) => ({ ...current, pathScanningEnabled }))} />
                        </div>
                      </>
                    ) : protectionModal.module === "bot" ? (
                      <div className="botshield-protection-signal-list">
                        <div><strong>Known automation</strong><span>Recognized bot-style user agents</span></div>
                        <div><strong>Automation signatures</strong><span>Headless browsers and scripted request tools</span></div>
                        <div><strong>Request integrity</strong><span>Missing user-agent or IP information</span></div>
                        <div><strong>Scanning behavior</strong><span>Repeated access across multiple storefront paths</span></div>
                      </div>
                    ) : (
                      <div className="botshield-protection-signal-list">
                        <div><strong>Detect</strong><span>Evaluate recorded storefront and network signals</span></div>
                        <div><strong>Classify</strong><span>Assign low, medium, or high risk</span></div>
                        <div><strong>Enforce</strong><span>Allow, request verification, or stop the request</span></div>
                      </div>
                    )}
                  </section>
                  <section className="botshield-protection-drawer-section botshield-protection-drawer-section--compact">
                    <div className="botshield-protection-drawer-section-label">Verified activity · Last 30 days</div>
                    <div className="botshield-protection-drawer-metrics">
                      <div><strong>{Number(model.incidentCounts?.blocked || 0)}</strong><span>Blocked</span></div>
                      <div><strong>{Number(model.incidentCounts?.challenged || 0)}</strong><span>Challenged</span></div>
                      <div><strong>{interventionCount}</strong><span>Interventions</span></div>
                    </div>
                  </section>
                  <BotShieldInlineHelp>
                    {protectionModal.note}
                  </BotShieldInlineHelp>
                </div>
              ) : null}
              {protectionModal.type === "blocklist" ? (
                <div className="botshield-protection-modal-body">
                  <IpList
                    title="IP blocklist"
                    subtitle="Manually block known abusive IP addresses."
                    rows={model.blockedIPs}
                    value={blockedIpInput}
                    onChange={setBlockedIpInput}
                    onAdd={async () => {
                      await actions.addBlockedIp(blockedIpInput);
                      setBlockedIpInput("");
                    }}
                    onRemove={actions.removeBlockedIp}
                    addLabel="Add IP"
                    emptyTitle="No blocked visitors yet."
                  />
                  <div className="botshield-protection-modal-actions">
                    <BotShieldActionButton
                      onClick={() => setProtectionModal(null)}
                    >
                      Close
                    </BotShieldActionButton>
                  </div>
                </div>
              ) : null}
              {protectionModal.type === "trusted" ? (
                <div className="botshield-protection-modal-body">
                  <IpList
                    title="Trusted visitors"
                    subtitle="Allow known safe visitors, admins, agencies, and reviewed customers to bypass automated blocking."
                    rows={model.whitelist}
                    value={trustedIpInput}
                    onChange={setTrustedIpInput}
                    onAdd={async () => {
                      await actions.addTrustedIp(trustedIpInput);
                      setTrustedIpInput("");
                    }}
                    onRemove={actions.removeTrustedIp}
                    addLabel="Trust visitor"
                    emptyTitle="No trusted visitors yet."
                  />
                  <div className="botshield-protection-modal-actions">
                    <BotShieldActionButton
                      onClick={() => setProtectionModal(null)}
                    >
                      Close
                    </BotShieldActionButton>
                  </div>
                </div>
              ) : null}
              {protectionModal.type === "status" ? (
                <div className="botshield-protection-modal-body">
                  <section className="botshield-protection-drawer-section">
                    <div className="botshield-protection-drawer-section-label">Current status</div>
                    <div className="botshield-protection-current-status">
                      <BotShieldStatusBadge status={protectionModal.status?.status || "monitoring_only"} label={protectionModal.status?.label || "Monitoring"} />
                      <span>{protectionModal.note}</span>
                    </div>
                  </section>
                  {protectionModal.module === "network" ? (
                    <>
                      <section className="botshield-protection-drawer-section">
                        <div className="botshield-protection-drawer-section-label">Signals evaluated</div>
                        <div className="botshield-protection-signal-list">
                          <div><strong>VPN / Proxy</strong><span>Known anonymizing network classifications</span></div>
                          <div><strong>Hosting / Datacenter</strong><span>Traffic originating from hosted infrastructure</span></div>
                          <div><strong>Network reputation</strong><span>Provider and ASN risk signals where available</span></div>
                        </div>
                      </section>
                      <BotShieldInlineHelp>Network intelligence contributes to the real request risk score. It does not claim a visitor’s exact physical location.</BotShieldInlineHelp>
                      <div className="botshield-protection-modal-actions"><BotShieldActionButton onClick={() => openProfileManager("Protection policy", "Configure how BotShield responds to recorded storefront risk.")}>Review protection policy</BotShieldActionButton></div>
                    </>
                  ) : (
                    <>
                      <section className="botshield-protection-drawer-section">
                        <div className="botshield-protection-drawer-section-label">Protected storefront areas</div>
                        <div className="botshield-protection-path-grid">
                          {["Account", "Login", "Cart", "Checkout", "Admin", "API routes"].map((path) => <span key={path}>{path}</span>)}
                        </div>
                      </section>
                      <BotShieldInlineHelp>BotShield applies storefront decisions through the theme app embed and Shopify app proxy. Shopify-controlled surfaces remain subject to Shopify platform limitations.</BotShieldInlineHelp>
                      <div className="botshield-protection-modal-actions">
                        {!storefrontConnected ? <BotShieldActionButton onClick={actions.openThemeEditor} variant="primary">Connect storefront</BotShieldActionButton> : null}
                        <BotShieldActionButton onClick={requestClose}>Close</BotShieldActionButton>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
              {!protectionModal.type ? (
                <BotShieldActionButton
                  onClick={() => setProtectionModal(null)}
                  variant="primary"
                >
                  Close
                </BotShieldActionButton>
              ) : null}
              {protectionModal.type === "profile" ? (
                <footer className="botshield-protection-drawer-footer">
                  <span className="botshield-protection-drawer-state" aria-live="polite">
                    {saving ? "Saving changes…" : dirty ? "Unsaved changes" : saveSuccess || "All changes saved"}
                  </span>
                  <div>
                    <BotShieldActionButton onClick={requestClose} disabled={saving}>Cancel</BotShieldActionButton>
                    <BotShieldActionButton onClick={save} variant="primary" loading={saving} disabled={!dirty}>Save changes</BotShieldActionButton>
                  </div>
                </footer>
              ) : null}
              {confirmDiscard ? (
                <div className="botshield-protection-discard-layer" role="alertdialog" aria-modal="true" aria-labelledby="botshield-discard-title">
                  <div className="botshield-protection-discard-dialog">
                    <h3 id="botshield-discard-title">Discard unsaved changes?</h3>
                    <p>Your updates haven’t been saved. You can keep editing or discard them.</p>
                    <div>
                      <BotShieldActionButton onClick={() => setConfirmDiscard(false)}>Keep editing</BotShieldActionButton>
                      <BotShieldActionButton onClick={discardAndClose} variant="primary" tone="critical">Discard changes</BotShieldActionButton>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ), document.body) : null}
      </main>
      </div>
    );
  }

  return (
    <Screen
      title="Protection Rules"
      subtitle="Choose how BotShield monitors, verifies, and stops risky storefront visitors."
    >
      <BotShieldSaveState
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
              description="Responds aggressively to risky traffic. Use when the store is under attack."
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
              title="Bot detection"
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
              title="Network intelligence"
              status="active"
              count="Enabled"
              description="Uses VPN, proxy, datacenter, hosting provider, and ASN signals."
            />
            <RuleSummaryCard
              title="Repeated visitor activity"
              status="active"
              count="Active"
              description="Flags unusually frequent visits from the same visitor pattern."
            />
            <RuleSummaryCard
              title="Blocked page"
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
              details="Automatically block requests that cross the active risk threshold."
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
          <s-heading>Network intelligence</s-heading>
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
              Network intelligence is approximate and does not identify a
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

function IpList({
  title,
  subtitle,
  rows,
  value,
  onChange,
  onAdd,
  onRemove,
  addLabel,
  emptyTitle,
}) {
  const [pendingRemoval, setPendingRemoval] = useState("");
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
    <s-stack gap="large">
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
          {filteredRows.map((row) => {
            const ip = typeof row === "string" ? row : row.ip;
            const record = typeof row === "string" ? {} : row;
            return (
              <StatusRow
                key={ip}
                label={ip}
                detail={
                  [
                    record.reason || (trusted
                      ? "Allowed through automated protection after review."
                      : "Stopped before continuing through the storefront."),
                    record.source ? `Source: ${record.source}` : "",
                    record.time && record.time !== "Unknown" ? `Updated: ${record.time}` : "",
                  ].filter(Boolean).join(" · ")
                }
                status={trusted ? "active" : "blocked"}
                action={
                  <BotShieldAsyncButton
                    action={() => setPendingRemoval(ip)}
                    tone="critical"
                  >
                    Remove
                  </BotShieldAsyncButton>
                }
              />
            );
          })}
          {!filteredRows.length ? (
            <div className="botshield-protection-filter-empty">
              <strong>No matching visitors</strong>
              <span>Try a different IP address, source, or reason.</span>
            </div>
          ) : null}
          {pendingRemoval ? (
            <div className="botshield-protection-remove-confirm" role="alert">
              <div>
                <strong>Remove {trusted ? "trusted" : "blocked"} visitor?</strong>
                <p>
                  This visitor will no longer be manually {trusted ? "trusted" : "blocked"}.
                </p>
              </div>
              <div>
                <BotShieldActionButton onClick={() => setPendingRemoval("")}>Cancel</BotShieldActionButton>
                <BotShieldAsyncButton
                  action={async () => {
                    await onRemove(pendingRemoval);
                    setPendingRemoval("");
                  }}
                  successMessage="IP removed"
                  tone="critical"
                >
                  Remove
                </BotShieldAsyncButton>
              </div>
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

function getSettingsOperationalStrip(model) {
  const responseMode = getResponseMode(model);
  const storefrontConnected = hasStorefrontConnection(model);
  const receivingTraffic = Boolean(model.protectionStatus?.lastStorefrontDecisionAt);
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
    <span className="botshield-settings-hub-icon" aria-hidden="true">
      <s-icon type={icons[name] || "gauge"} size="small" color="subdued" />
    </span>
  );
}

function SettingsOperationalDot({ tone = "neutral" }) {
  return <span className={`botshield-settings-hub-dot is-${tone}`} aria-hidden="true" />;
}

function SettingsHubStatusPill({ label, tone = "neutral" }) {
  return (
    <span className={`botshield-settings-hub-status-pill is-${tone}`}>
      <SettingsOperationalDot tone={tone} />
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
  const [activeSection, setActiveSection] = useState(readSettingsHubSection);
  const [draft, setDraft] = useState({
    alertEmail: model.alertEmail,
    emailAlerts: model.emailAlerts,
    weeklyReportsEnabled: model.weeklyReportsEnabled,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    setDraft({
      alertEmail: model.alertEmail,
      emailAlerts: model.emailAlerts,
      weeklyReportsEnabled: model.weeklyReportsEnabled,
    });
  }, [model.alertEmail, model.emailAlerts, model.weeklyReportsEnabled]);

  useEffect(() => {
    const syncSectionFromUrl = () => setActiveSection(readSettingsHubSection());
    window.addEventListener("popstate", syncSectionFromUrl);
    return () => window.removeEventListener("popstate", syncSectionFromUrl);
  }, []);

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
  const planName = model.billingStatus?.planName || "BotShield Basic";
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
        ? "Email delivery is not configured in this environment."
        : !alertEmailValid
          ? "Enter a valid alert email before sending a test email."
          : "";
  const reportDisabledReason = dirty
    ? "Save report settings before sending a manual report."
    : !draft.weeklyReportsEnabled
      ? "Turn on the weekly security report before sending one now."
      : !model.emailProviderConfigured
        ? "Email delivery is not configured in this environment."
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
      const message =
        error instanceof Error ? error.message : "Couldn’t save settings";
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const renderSection = () => {
    if (activeSection === "general") {
      return (
        <SettingsHubSection
          description="Operational posture and shortcuts into BotShield protection controls."
          eyebrow="General"
          panel="control"
          title="Control center"
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
                  ? "Automated storefront responses are paused until you resume protection."
                  : "BotShield is applying your configured storefront protection policy."
              }
              icon="activity"
              title="Protection state"
              variant="operational"
            />
          </div>
          <div className="botshield-settings-hub-subgroup is-info">
            <SettingsHubRow
              control={<span className="botshield-settings-hub-value">{protectionProfile}</span>}
              description="Shared detection profile configured on the Protection page."
              title="Protection profile"
              variant="info"
            />
            <SettingsHubRow
              control={<span className="botshield-settings-hub-value">{planName}</span>}
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
                    Open Protection
                  </BotShieldActionButton>
                  {model.protectionPaused ? (
                    <BotShieldActionButton onClick={() => actions.resumeProtection()}>
                      Resume protection
                    </BotShieldActionButton>
                  ) : (
                    <BotShieldActionButton onClick={() => actions.pauseProtection(60)}>
                      Pause 1 hour
                    </BotShieldActionButton>
                  )}
                </div>
              }
              description="Manage detection modules, enforcement policy, and visitor access on Protection."
              title="Protection configuration"
              variant="action"
            />
            {model.protectionPaused ? null : (
              <p className="botshield-settings-hub-inline-note">
                Pause temporarily stops automated storefront responses for one hour. Monitoring
                continues and protection can be resumed at any time.
              </p>
            )}
          </div>
        </SettingsHubSection>
      );
    }

    if (activeSection === "notifications") {
      return (
        <>
          <SettingsHubSection
            description="Configure where BotShield sends security notifications."
            eyebrow="Notifications"
            panel="config"
            title="Email alerts"
          >
            {!model.emailProviderConfigured ? (
              <div className="botshield-settings-hub-note">
                Email delivery is not configured for this environment. Alert settings can be saved,
                but messages will not send until the provider is configured.
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
                    label=""
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
                  label=""
                  onChange={(emailAlerts) => setDraft((current) => ({ ...current, emailAlerts }))}
                />
              }
              description="Receive notifications when BotShield detects important security events."
              title="Security alerts"
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
                description={`Last delivery: ${lastAlertDetail}`}
                title="Test notification"
                variant="delivery"
              />
              <div className="botshield-settings-hub-meta">
                <BotShieldStatusBadge
                  label={emailStatus.label}
                  status={emailStatus.technicalStatus}
                />
                <span className="botshield-settings-hub-meta-copy">
                  {emailStatus.description}
                </span>
              </div>
              {model.lastAlertError ? (
                <div className="botshield-settings-hub-note is-error">{model.lastAlertError}</div>
              ) : null}
            </div>
          </section>
        </>
      );
    }

    if (activeSection === "reports") {
      return (
        <>
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
                  label=""
                  onChange={(weeklyReportsEnabled) =>
                    setDraft((current) => ({ ...current, weeklyReportsEnabled }))
                  }
                />
              }
              description="Send a weekly summary of recorded storefront protection activity."
              title="Weekly security report"
              variant="config"
            />
          </SettingsHubSection>
          <section className="botshield-settings-hub-delivery">
            <header className="botshield-settings-hub-delivery-head">
              <span className="botshield-v2-eyebrow">Delivery status</span>
              <h3>Report delivery</h3>
            </header>
            <div className="botshield-settings-hub-delivery-body">
              <SettingsHubRow
                control={
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
                }
                description={`Last report: ${lastReportDetail}`}
                title="Manual report"
                variant="delivery"
              />
              {model.lastWeeklyReportError ? (
                <div className="botshield-settings-hub-note is-error">
                  {model.lastWeeklyReportError}
                </div>
              ) : null}
            </div>
          </section>
        </>
      );
    }

    if (activeSection === "connections") {
      return (
        <SettingsHubSection
          description="Live connection health for supported BotShield services."
          eyebrow="Connections"
          panel="connections"
          title="System connections"
        >
          <SettingsHubRow
            control={
              <BotShieldStatusBadge
                label={model.emailProviderConfigured ? "Configured" : "Not configured"}
                status={model.emailProviderConfigured ? "active" : "setup_required"}
              />
            }
            description="Email delivery provider used for alerts and weekly reports."
            icon="email"
            title="Email provider"
            variant="connection"
          />
          <SettingsHubRow
            control={
              <BotShieldStatusBadge
                label={storefrontConnected ? "Connected" : "Setup required"}
                status={storefrontConnected ? "active" : "setup_required"}
              />
            }
            description={
              storefrontConnected
                ? "Theme app embed is active and BotShield can evaluate storefront traffic."
                : "Enable the theme app embed to connect storefront protection."
            }
            icon="connection"
            title="Storefront theme embed"
            variant="connection"
          />
          <SettingsHubRow
            control={
              <BotShieldStatusBadge
                label={model.protectionStatus?.appInstalled ? "Installed" : "Unknown"}
                status={model.protectionStatus?.appInstalled ? "active" : "monitoring_only"}
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
            lead="Storefront"
            title="Theme editor"
            variant="action"
          />
        </SettingsHubSection>
      );
    }

    if (activeSection === "privacy") {
      return (
        <SettingsHubSection
          description="How BotShield handles merchant and storefront data."
          eyebrow="Data & privacy"
          panel="privacy"
          title="Data handling"
        >
          <SettingsHubRow
            control={<span className="botshield-settings-hub-value">Storefront events</span>}
            description="BotShield records storefront protection decisions needed for analytics, alerts, and enforcement."
            icon="activity"
            title="Recorded activity"
            variant="info"
          />
          <SettingsHubRow
            control={<span className="botshield-settings-hub-value">{simulationLabel}</span>}
            description="Dashboard simulations are kept separate from real storefront metrics."
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
            description="Review how BotShield processes and retains merchant data."
            icon="privacyRow"
            title="Privacy policy"
            variant="action"
          />
        </SettingsHubSection>
      );
    }

    if (activeSection === "diagnostics") {
      const trafficTone = storefrontConnected ? "healthy" : "warning";
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
                label={storefrontConnected ? "Receiving traffic" : "Not connected"}
                tone={trafficTone}
              />
            }
            description={
              model.protectionStatus?.lastStorefrontDecisionAt
                ? `Last storefront decision ${formatRelativeTime(model.protectionStatus.lastStorefrontDecisionAt)}`
                : "No recorded storefront decisions yet."
            }
            icon="activity"
            title="Storefront activity"
            variant="operational"
          />
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
            description="Verify storefront reporting and BotShield enforcement behavior."
            icon="diagnostic"
            title="Diagnostic scan"
            variant="diagnostic"
          />
          <SettingsHubRow
            control={
              <BotShieldActionButton loading={model.syncing} onClick={actions.refresh}>
                Refresh status
              </BotShieldActionButton>
            }
            description="Reload settings, protection status, and recent activity from the backend."
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
          <p>Supported destructive actions for this store.</p>
        </header>
        <div className="botshield-settings-hub-danger">
          <div className="botshield-settings-hub-danger-icon">
            <SettingsHubIcon name="warning" />
          </div>
          <div className="botshield-settings-hub-danger-copy">
            <h3>Clear simulation data</h3>
            <p>
              Remove dashboard simulation events from BotShield analytics. Real storefront traffic,
              settings, blocklists, and trusted visitors are not deleted.
            </p>
          </div>
          <BotShieldAsyncButton
            action={async () => {
              if (
                typeof window !== "undefined" &&
                !window.confirm(
                  "Clear all dashboard simulation data? Real storefront records will not be deleted.",
                )
              ) {
                return;
              }
              await safeFetchJson("/api/clear-test-data", { method: "POST" });
              await actions.refresh();
            }}
            successMessage="Simulation data cleared"
            tone="critical"
          >
            Clear simulation data
          </BotShieldAsyncButton>
        </div>
      </section>
    );
  };

  const showSaveBar = ["notifications", "reports"].includes(activeSection);

  return (
    <div className="botshield-page">
      <main className="botshield-page-content botshield-settings-hub-content">
        <header className="botshield-settings-hub-header">
          <div className="botshield-settings-hub-header-copy">
            <h1 className="botshield-overview-title">Settings</h1>
            <p className="botshield-overview-subtitle">
              Manage protection preferences, alerts, connections, and BotShield system
              configuration.
            </p>
          </div>
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
            {renderSection()}
            {showSaveBar ? (
              <BotShieldSaveState
                dirty={dirty}
                error={saveError}
                onDiscard={() =>
                  setDraft({
                    alertEmail: model.alertEmail,
                    emailAlerts: model.emailAlerts,
                    weeklyReportsEnabled: model.weeklyReportsEnabled,
                  })
                }
                onSave={save}
                saving={saving}
              />
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}

// Retained only for old preview snapshots. Its display-only controls are not
// exposed by the active application.
// eslint-disable-next-line no-unused-vars
function SettingsPageV2({ model, actions }) {
  const readSettingsTab = () => {
    if (typeof window === "undefined") return "general";
    const tab = new URLSearchParams(window.location.search).get("tab");
    return [
      "general",
      "pricing",
      "content-protection",
      "blocking-design",
    ].includes(tab)
      ? tab
      : "general";
  };
  const [activeTab, setActiveTab] = useState("general");
  const [helpOpen, setHelpOpen] = useState(false);
  const [blockingDraft, setBlockingDraft] = useState({
    template: "denied",
    headline: "Access denied",
    message: "This store is not available in your region.",
    borderRadius: "18",
    backdropColor: "#EEF1F4",
    cardColor: "#FFFFFF",
    textColor: "#111827",
    accentColor: "#D90606",
  });
  const tabOptions = [
    ["general", "General"],
    ["pricing", "Pricing"],
    ["content-protection", "Content Protection"],
    ["blocking-design", "Blocking Design"],
  ];
  const planName = model.billingStatus?.planName || "BotShield Basic";
  const monthlyPrice = Number.isFinite(Number(model.billingStatus?.monthlyPrice))
    ? Number(model.billingStatus.monthlyPrice)
    : 14.99;
  const trialDays = Number.isFinite(Number(model.billingStatus?.trialDays))
    ? Number(model.billingStatus.trialDays)
    : 7;
  const subscription = model.billingStatus?.subscription || {};
  const billingActive = Boolean(model.billingStatus?.active);
  const billingStatus = getBillingStatusModel(model.billingStatus || {});
  const visitorCount = Number.isFinite(Number(model.incidentCounts?.total))
    ? Number(model.incidentCounts.total)
    : Array.isArray(model.storefrontScans)
      ? model.storefrontScans.length
      : 0;
  const hexPattern = /^#[0-9a-f]{6}$/i;
  const colorKeys = [
    "backdropColor",
    "cardColor",
    "textColor",
    "accentColor",
  ];
  const hasInvalidColor = colorKeys.some(
    (key) => !hexPattern.test(blockingDraft[key]),
  );
  const setSettingsTab = (tab) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.pushState({}, "", `${url.pathname}${url.search}`);
    }
  };
  const updateBlockingDraft = (key, value) =>
    setBlockingDraft((current) => ({ ...current, [key]: value }));
  const resetBlockingDraft = () =>
    setBlockingDraft({
      template: "denied",
      headline: "Access denied",
      message: "This store is not available in your region.",
      borderRadius: "18",
      backdropColor: "#EEF1F4",
      cardColor: "#FFFFFF",
      textColor: "#111827",
      accentColor: "#D90606",
    });
  const contentProtectionControlsReady = false;
  const blockingDesignSaveReady = false;

  useEffect(() => {
    setActiveTab(readSettingsTab());
  }, []);

  const pageTitle =
    activeTab === "pricing"
      ? "Pricing"
      : activeTab === "content-protection"
        ? "Content protection settings"
        : activeTab === "blocking-design"
          ? "Blocking template settings"
          : "General settings";
  const pageSubtitle =
    activeTab === "pricing"
      ? "Review plans, traffic usage, and Shopify billing status."
      : activeTab === "content-protection"
        ? "Protect storefront content by limiting selection, right click, inspect, and copy shortcuts."
        : activeTab === "blocking-design"
          ? "Manage default storefront blocking overlay templates and styles."
          : "Manage admin-safe storefront access links and general storefront controls.";

  return (
    <div className="botshield-page">
      <main className="botshield-page-content botshield-overview-content botshield-settings-content">
        <div className="botshield-protection-header">
          <div>
            <h1 className="botshield-overview-title botshield-protection-page-title">
              {pageTitle}
            </h1>
            <p className="botshield-overview-subtitle">{pageSubtitle}</p>
          </div>
          {activeTab === "content-protection" ? (
            <BotShieldActionButton onClick={() => setHelpOpen(true)}>
              Get help
            </BotShieldActionButton>
          ) : null}
        </div>

        <div className="botshield-settings-tabs" role="tablist">
          {tabOptions.map(([id, label]) => (
            <button
              aria-selected={activeTab === id}
              className={`botshield-settings-tab${
                activeTab === id ? " botshield-settings-tab--active" : ""
              }`}
              key={id}
              onClick={() => setSettingsTab(id)}
              role="tab"
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === "general" ? (
          <s-stack gap="large">
            <BotShieldCard title="Admin access URL">
              <div className="botshield-settings-admin-grid">
                <div className="botshield-settings-compact-empty">
                  <h2>Admin access URL</h2>
                  <p>
                    Generate a private storefront access URL for admins,
                    agencies, and trusted reviewers.
                  </p>
                  <div className="botshield-settings-inline-empty">
                    <strong>No admin access URL yet</strong>
                    <span>
                      Admin access URL generation is not connected yet. Use
                      Trusted Visitors from Protection for reviewed admin or
                      agency IPs until this workflow is connected.
                    </span>
                  </div>
                </div>
                <div className="botshield-settings-status-card">
                  <span>Access status</span>
                  <strong>Not connected</strong>
                  <span className="botshield-settings-neutral-pill">
                    Setup required
                  </span>
                </div>
              </div>
            </BotShieldCard>
            <BotShieldCard title="Trusted access fallback">
              <div className="botshield-settings-inline-action">
                <p>
                  Use Trusted Visitors in Protection to allow reviewed admin,
                  agency, or customer IPs.
                </p>
                <BotShieldActionButton
                  onClick={() => actions.setPage("detection")}
                  variant="primary"
                >
                  Open Protection
                </BotShieldActionButton>
              </div>
            </BotShieldCard>
          </s-stack>
        ) : null}

        {activeTab === "pricing" ? (
          <s-stack gap="large">
            {!billingActive || subscription.isTest ? (
              <div className="botshield-settings-info-card">
                <div className="botshield-settings-info-icon">i</div>
                <div>
                  <h2>Development store testing access enabled</h2>
                  <p>
                    This partner development store has paid features enabled for
                    testing. Billing approval is not required until the store
                    moves to a paid Shopify plan.
                  </p>
                </div>
              </div>
            ) : null}
            <div className="botshield-settings-plan-grid">
              <div className="botshield-settings-plan-card">
                <div>
                  <h2>Free</h2>
                  <div className="botshield-settings-price">$0/mo</div>
                </div>
                <ul className="botshield-settings-feature-list">
                  <li>Basic storefront protection</li>
                  <li>Limited visitor analytics</li>
                  <li>Basic page blocking</li>
                  <li>Fraud order insights</li>
                </ul>
                <p className="botshield-settings-muted">
                  Downgrades are managed through Shopify billing and are not
                  connected in BotShield yet.
                </p>
              </div>
              <div className="botshield-settings-plan-card botshield-settings-plan-card--current">
                <div className="botshield-settings-plan-heading">
                  <div>
                    <h2>{planName}</h2>
                    <div className="botshield-settings-price">
                      ${monthlyPrice.toFixed(2)}/mo
                    </div>
                    <p>{trialDays}-day trial</p>
                  </div>
                  <span className="botshield-settings-neutral-pill">
                    Current plan
                  </span>
                </div>
                <ul className="botshield-settings-feature-list">
                  <li>Bot protection</li>
                  <li>Network / Proxy protection</li>
                  <li>Rate protection</li>
                  <li>Page protection</li>
                  <li>IP blocklist</li>
                  <li>Trusted visitors</li>
                  <li>Fraud order insights</li>
                  <li>Full visitor analytics</li>
                </ul>
                <p className="botshield-settings-muted">Your current plan.</p>
              </div>
            </div>
            <BotShieldCard
              title="Usage this billing cycle"
              badge={
                <span className="botshield-settings-neutral-pill">
                  {billingActive
                    ? subscription.name || planName
                    : subscription.isTest
                      ? "Development plan"
                      : "Setup required"}
                </span>
              }
              actions={
                <BotShieldAsyncButton
                  action={actions.refreshBilling}
                  successMessage="Billing refreshed"
                >
                  Refresh billing
                </BotShieldAsyncButton>
              }
            >
              <div className="botshield-settings-usage-grid">
                <Metric
                  label="Visitors this cycle"
                  value={visitorCount}
                  detail="Real storefront sessions tracked"
                  status="active"
                />
                <Metric
                  label="Included visitors"
                  value="Unlimited"
                  detail="No hard visitor limit is configured"
                  status="monitoring_only"
                />
                <Metric
                  label="Subscription price"
                  value={`$${monthlyPrice.toFixed(2)}/mo`}
                  detail={planName}
                  status={billingStatus.technicalStatus}
                />
                <Metric
                  label="Billing cycle end"
                  value={
                    subscription.currentPeriodEnd
                      ? formatDate(subscription.currentPeriodEnd)
                      : "Not available"
                  }
                  detail={
                    subscription.currentPeriodEnd
                      ? billingStatus.description
                      : "Complete setup to activate this feature"
                  }
                  status={billingStatus.technicalStatus}
                />
              </div>
            </BotShieldCard>
          </s-stack>
        ) : null}

        {activeTab === "content-protection" ? (
          <s-stack gap="large">
            <div className="botshield-settings-info-card">
              <div className="botshield-settings-info-icon">i</div>
              <div>
                <h2>Browser-side protection</h2>
                <p>
                  These protections run in the visitor&apos;s browser. They
                  reduce casual copying, but no frontend-only solution can fully
                  stop determined users.
                </p>
              </div>
            </div>
            <BotShieldCard title="Protection controls">
              {[
                [
                  "Protect content",
                  "Prevent visitors from selecting storefront text and dragging product images.",
                ],
                [
                  "Deactivate right click",
                  "Disable the browser context menu across the storefront to reduce casual copying.",
                ],
                [
                  "Deactivate shortcuts",
                  "Block common copy, save, print, and source-view keyboard shortcuts outside editable fields.",
                  "Includes Ctrl/Cmd + C, X, S, A, P, U and common inspect combinations.",
                ],
                [
                  "Deactivate inspect",
                  "Apply best-effort browser-side protections against Inspect Element and source-view shortcuts.",
                  "Determined users can still access page source with advanced tools.",
                ],
              ].map(([label, detail, helper]) => (
                <div className="botshield-settings-row" key={label}>
                  <div>
                    <h3>{label}</h3>
                    <p>{detail}</p>
                    {helper ? (
                      <p className="botshield-settings-muted">{helper}</p>
                    ) : null}
                  </div>
                  <div className="botshield-settings-row-actions">
                    <span className="botshield-settings-neutral-pill">Off</span>
                    <BotShieldToggle
                      label=""
                      checked={false}
                      disabled={!contentProtectionControlsReady}
                    />
                  </div>
                </div>
              ))}
              <p className="botshield-settings-card-copy botshield-settings-card-copy--footer">
                Content protection controls are prepared for the storefront
                script integration and are currently display-only.
              </p>
            </BotShieldCard>
          </s-stack>
        ) : null}

        {activeTab === "blocking-design" ? (
          <BotShieldCard>
            <div className="botshield-blocking-design-grid">
              <div className="botshield-blocking-design-form">
                <h2>Template editor</h2>
                <BotShieldSelect
                  label="Template"
                  value={blockingDraft.template}
                  options={[
                    { label: "Denied", value: "denied" },
                    { label: "Blocked", value: "blocked" },
                    { label: "Restricted", value: "restricted" },
                  ]}
                  onChange={(template) =>
                    updateBlockingDraft("template", template)
                  }
                  details="Choose the default blocking overlay template."
                />
                <BotShieldTextField
                  label="Headline"
                  value={blockingDraft.headline}
                  onChange={(headline) =>
                    updateBlockingDraft("headline", headline)
                  }
                />
                <BotShieldTextField
                  label="Message"
                  value={blockingDraft.message}
                  onChange={(message) =>
                    updateBlockingDraft("message", message)
                  }
                />
                <BotShieldTextField
                  label="Border radius"
                  value={blockingDraft.borderRadius}
                  onChange={(borderRadius) =>
                    updateBlockingDraft("borderRadius", borderRadius)
                  }
                  details="px"
                />
                {[
                  ["Backdrop color", "backdropColor"],
                  ["Card color", "cardColor"],
                  ["Text color", "textColor"],
                  ["Accent color", "accentColor"],
                ].map(([label, key]) => (
                  <div className="botshield-settings-color-field" key={key}>
                    <span
                      className="botshield-settings-color-swatch"
                      style={{
                        background: hexPattern.test(blockingDraft[key])
                          ? blockingDraft[key]
                          : "#ffffff",
                      }}
                    />
                    <BotShieldTextField
                      label={label}
                      value={blockingDraft[key]}
                      error={
                        hexPattern.test(blockingDraft[key])
                          ? ""
                          : "Enter a valid HEX color"
                      }
                      onChange={(value) => updateBlockingDraft(key, value)}
                    />
                  </div>
                ))}
                <div className="botshield-settings-action-row">
                  <BotShieldActionButton
                    disabled={!blockingDesignSaveReady || hasInvalidColor}
                    variant="primary"
                  >
                    Save changes
                  </BotShieldActionButton>
                  <BotShieldActionButton onClick={resetBlockingDraft}>
                    Reset to default
                  </BotShieldActionButton>
                  <BotShieldActionButton onClick={resetBlockingDraft}>
                    Cancel
                  </BotShieldActionButton>
                </div>
                <p className="botshield-settings-muted">
                  {hasInvalidColor
                    ? "Fix invalid HEX colors before these settings can be saved."
                    : "Blocking design settings are prepared for the storefront blocking overlay and are currently display-only."}
                </p>
              </div>
              <div className="botshield-blocking-preview-wrap">
                <h2>Live preview</h2>
                <p>Preview how the overlay will appear on your storefront.</p>
                <div
                  className="botshield-blocking-preview"
                  style={{ background: blockingDraft.backdropColor }}
                >
                  <div
                    className="botshield-blocking-preview-card"
                    style={{
                      background: blockingDraft.cardColor,
                      borderRadius: `${Number(blockingDraft.borderRadius) || 18}px`,
                      color: blockingDraft.textColor,
                    }}
                  >
                    <div
                      className="botshield-blocking-preview-icon"
                      style={{ borderColor: blockingDraft.accentColor }}
                    >
                      !
                    </div>
                    <strong>{blockingDraft.headline.toUpperCase()}</strong>
                    <span>{blockingDraft.message}</span>
                  </div>
                </div>
              </div>
            </div>
          </BotShieldCard>
        ) : null}

        {helpOpen ? (
          <div
            aria-modal="true"
            className="botshield-protection-modal-backdrop"
            role="dialog"
          >
            <div className="botshield-protection-modal">
              <h2 className="botshield-protection-modal-title">
                Content protection help
              </h2>
              <p className="botshield-protection-modal-copy">
                Content protection is browser-side protection. It can discourage
                casual copying, but it should not be marketed as server-side
                theft prevention or guaranteed anti-scraping protection.
              </p>
              <BotShieldActionButton
                onClick={() => setHelpOpen(false)}
                variant="primary"
              >
                Close
              </BotShieldActionButton>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function BlocklistPage({ model, actions }) {
  const [blockIp, setBlockIp] = useState("");

  return (
    <Screen
      title="Blocklist"
      subtitle="Stop specific visitors when you have confirmed they should not continue through the storefront."
    >
      <s-grid
        gridTemplateColumns="minmax(0, 1.2fr) minmax(280px, 0.8fr)"
        gap="large"
      >
        <BotShieldCard
          title="Manual blocklist"
          subtitle="A focused override for known abusive sources and confirmed attack traffic."
          badge={
            <BotShieldStatusBadge
              status={model.blockedIPs.length ? "blocked" : "monitoring_only"}
              label={`${model.blockedIPs.length} blocked`}
            />
          }
          accent
        >
          <s-stack gap="large">
            <div className="botshield-status-value">
              {model.blockedIPs.length
                ? `${model.blockedIPs.length} blocked`
                : "No blocked visitors yet"}
            </div>
            <s-paragraph color="subdued">
              Matching visitors are stopped before continuing through the
              storefront app-proxy flow when BotShield protection runs.
            </s-paragraph>
          </s-stack>
        </BotShieldCard>
        <BotShieldCard
          title="Block safely"
          subtitle="Use manual blocking carefully so real customers are not affected."
        >
          <s-stack>
            <StatusRow
              label="Confirmed abusive source"
              detail="Use for repeated scrapers, hostile automation, test abuse, or a reviewed attack source."
              status="blocked"
            />
            <StatusRow
              label="False-positive guardrail"
              detail="Use Trusted Visitors instead when a real customer, admin, or partner was blocked by mistake."
              status="monitoring_only"
              action={
                <BotShieldActionButton onClick={() => actions.setPage("trusted")}>
                  Open trusted visitors
                </BotShieldActionButton>
              }
            />
          </s-stack>
        </BotShieldCard>
      </s-grid>

      <BotShieldCard
        title="Manage blocked visitors"
        subtitle="Add or remove IP addresses from the manual blocklist."
      >
        <IpList
          title="Blocked visitors"
          subtitle="Visitors BotShield should stop when they match a real storefront request."
          rows={model.blockedIPs}
          value={blockIp}
          onChange={setBlockIp}
          onAdd={async () => {
            await actions.addBlockedIp(blockIp);
            setBlockIp("");
          }}
          onRemove={actions.removeBlockedIp}
          addLabel="Block visitor"
          emptyTitle="No blocked visitors yet."
        />
      </BotShieldCard>
      <BotShieldInlineHelp>
        Blocked visitors may still appear in Shopify analytics because Shopify
        records some storefront activity independently. BotShield stops them at
        the storefront app-proxy flow when JavaScript enforcement runs.
      </BotShieldInlineHelp>
    </Screen>
  );
}

function TrustedVisitorsPage({ model, actions }) {
  const [trustedIp, setTrustedIp] = useState("");

  return (
    <Screen
      title="Trusted Visitors"
      subtitle="Recover false positives and allow reviewed visitors to pass through automated protection."
    >
      <s-grid
        gridTemplateColumns="minmax(0, 1.2fr) minmax(280px, 0.8fr)"
        gap="large"
      >
        <BotShieldCard
          title="Trusted access"
          subtitle="A safe allowlist for admins, agencies, partners, and reviewed customers."
          badge={
            <BotShieldStatusBadge
              status={model.whitelist.length ? "active" : "monitoring_only"}
              label={`${model.whitelist.length} trusted`}
            />
          }
          accent
        >
          <s-stack gap="large">
            <div className="botshield-status-value">
              {model.whitelist.length
                ? `${model.whitelist.length} trusted`
                : "No trusted visitors yet"}
            </div>
            <s-paragraph color="subdued">
              Trusted visitors are still recorded for visibility, but automated
              blocking lets them continue through the storefront.
            </s-paragraph>
          </s-stack>
        </BotShieldCard>
        <BotShieldCard
          title="Recovery workflow"
          subtitle="Use trust rules after reviewing an event and confirming the visitor is legitimate."
        >
          <s-stack>
            <StatusRow
              label="Known internal access"
              detail="Add admins, agencies, partners, or testing devices that should not be interrupted."
              status="active"
            />
            <StatusRow
              label="Recover a real visitor"
              detail="If BotShield stopped a legitimate visitor, trust their IP after reviewing the activity."
              status="challenged"
              action={
                <BotShieldActionButton onClick={() => actions.setPage("incidents")}>
                  Review activity
                </BotShieldActionButton>
              }
            />
          </s-stack>
        </BotShieldCard>
      </s-grid>

      <BotShieldCard
        title="Manage trusted visitors"
        subtitle="Add or remove IP addresses from the trusted visitor list."
        accent
      >
        <IpList
          title="Trusted visitors"
          subtitle="Trusted IPs bypass automated blocking."
          rows={model.whitelist}
          value={trustedIp}
          onChange={setTrustedIp}
          onAdd={async () => {
            await actions.addTrustedIp(trustedIp);
            setTrustedIp("");
          }}
          onRemove={actions.removeTrustedIp}
          addLabel="Trust visitor"
          emptyTitle="No trusted visitors yet."
        />
      </BotShieldCard>
      <BotShieldInlineHelp>
        Trusted visitors are still recorded for visibility, so merchants keep an
        audit trail while avoiding repeat false positives.
      </BotShieldInlineHelp>
    </Screen>
  );
}

function BillingPage({ model, actions }) {
  const status = getBillingStatusModel(model.billingStatus);
  const planName = model.billingStatus?.planName || "BotShield Basic";
  const monthlyPrice = Number(model.billingStatus?.monthlyPrice || 14.99);
  const trialDays = Number(model.billingStatus?.trialDays || 7);
  const subscriptionName =
    model.billingStatus?.subscription?.name || "No active subscription";
  const billingActive = Boolean(model.billingStatus?.active);
  const trialRemaining =
    model.billingStatus?.subscription?.trialDaysRemaining ?? null;
  const planDetail = `${planName} · $${monthlyPrice.toFixed(2)}/month · ${trialDays}-day trial`;
  return (
    <Screen
      title="Subscription"
      subtitle="Review plan access, Shopify billing verification, and what happens before activation."
      actions={
        <s-stack direction="inline" gap="small">
          <BotShieldAsyncButton
            action={actions.refreshBilling}
            successMessage="Billing refreshed"
            icon="refresh"
          >
            Refresh billing
          </BotShieldAsyncButton>
        </s-stack>
      }
    >
      <BotShieldCard
        title="Billing overview"
        subtitle={
          billingActive
            ? "Shopify has verified the active subscription for this store."
            : "BotShield is ready for billing activation through Shopify."
        }
        badge={<BotShieldStatusBadge status={status.technicalStatus} />}
        actions={
          model.billingStatus?.pricingUrl && !billingActive ? (
            <BotShieldActionButton
              variant="primary"
              href={model.billingStatus.pricingUrl}
              target="_top"
            >
              Choose plan
            </BotShieldActionButton>
          ) : null
        }
        raised
        accent
      >
        <s-stack gap="large">
          <s-grid
            gridTemplateColumns="repeat(auto-fit, minmax(190px, 1fr))"
            gap="base"
          >
            <Metric
              label="Current plan"
              value={planName}
              detail={`$${monthlyPrice.toFixed(2)}/month`}
              status={status.technicalStatus}
            />
            <Metric
              label="Trial"
              value={`${trialDays} days`}
              detail={
                trialRemaining !== null
                  ? `${trialRemaining} days remaining`
                  : "Configured plan trial"
              }
              status={trialRemaining > 0 ? "trial" : "active"}
            />
            <Metric
              label="Billing status"
              value={billingActive ? "Verified" : "Needs activation"}
              detail={status.description}
              status={status.technicalStatus}
            />
            <Metric
              label="Protection"
              value={billingActive ? "Full access" : "Monitoring"}
              detail={
                billingActive
                  ? "Plan access is verified for this store."
                  : "Keep monitoring available until the Shopify plan is approved."
              }
              status={billingActive ? "active" : "monitoring_only"}
            />
          </s-grid>
          {!billingActive ? (
            <BotShieldBanner tone="warning" title="Billing is not fully verified">
              Activate the Shopify subscription before charging live merchants
              or turning on paid-plan access controls.
            </BotShieldBanner>
          ) : (
            <BotShieldBanner tone="success" title="Billing verification passed">
              BotShield can confirm the Shopify subscription state for this
              store.
            </BotShieldBanner>
          )}
        </s-stack>
      </BotShieldCard>

      <s-grid
        gridTemplateColumns="minmax(0, 1.2fr) minmax(320px, 0.8fr)"
        gap="base"
      >
        <BotShieldCard
          title="Plan details"
          subtitle="The plan merchants approve in Shopify."
        >
          <s-stack>
          <StatusRow
            label="Subscription status"
              detail={subscriptionName}
            status={status.technicalStatus}
          />
            <StatusRow
              label="Plan"
              detail={planDetail}
              status={status.technicalStatus}
            />
            <StatusRow
              label="Trial"
              detail={
                trialRemaining !== null
                  ? `${trialRemaining} days remaining`
                  : `${trialDays}-day trial`
              }
              status={trialRemaining > 0 ? "trial" : status.technicalStatus}
            />
          </s-stack>
        </BotShieldCard>
        <BotShieldCard
          title="Activation checklist"
          subtitle="Keep launch behavior clear while billing is being finalized."
        >
          <s-stack>
            <StatusRow
              label="Subscription"
              detail={
                billingActive
                  ? "Your BotShield subscription is active."
                  : "Choose the Shopify plan to activate billing."
              }
              status={billingActive ? "active" : "setup_required"}
              action={
                model.billingStatus?.pricingUrl && !billingActive ? (
                  <BotShieldActionButton
                    href={model.billingStatus.pricingUrl}
                    target="_top"
                  >
                    Choose plan
                  </BotShieldActionButton>
                ) : null
              }
            />
            <StatusRow
              label="Billing provider"
              detail="Plan approval, trial, and subscription changes are handled by Shopify."
              status="active"
            />
            <StatusRow
              label="Safe fallback"
              detail="If billing cannot be verified, BotShield stays in monitoring-only mode."
              status="monitoring_only"
            />
          </s-stack>
        </BotShieldCard>
      </s-grid>
    </Screen>
  );
}

export default function BotShieldAdminExperience({ model, actions }) {
  const screen =
    model.page === "security"
      ? "detection"
      : model.page === "fraud-orders"
        ? "fraud-orders"
      : model.page === "settings"
        ? "policy"
        : ["alerts-reports"].includes(model.page)
          ? "policy"
        : model.page === "detection-settings"
          ? "detection-settings"
          : model.page;
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
    <div className="botshield-route-transition" key={screen}>
      {screen === "dashboard" ? (
        <OverviewPage model={model} actions={actions} />
      ) : null}
      {screen === "analytics" ? (
        <AnalyticsPage model={model} actions={actions} />
      ) : null}
      {screen === "fraud-orders" ? (
        <FraudOrdersPage model={model} actions={actions} />
      ) : null}
      {screen === "incidents" ? (
        <ActivityPage model={model} actions={actions} />
      ) : null}
      {screen === "detection" ? (
        <ProtectionPage model={model} actions={actions} />
      ) : null}
      {screen === "policy" ? (
        <SettingsPage model={model} actions={actions} />
      ) : null}
      {screen === "blocklist" ? (
        <BlocklistPage model={model} actions={actions} />
      ) : null}
      {screen === "trusted" ? (
        <TrustedVisitorsPage model={model} actions={actions} />
      ) : null}
      {screen === "detection-settings" ? (
        <ProtectionPage model={model} actions={actions} />
      ) : null}
      {screen === "billing" ? (
        <BillingPage model={model} actions={actions} />
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
              title="Some BotShield data could not be loaded"
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
