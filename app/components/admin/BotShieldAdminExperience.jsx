/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
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
import {
  getBillingStatusModel,
  getEmailStatus,
  getUiStatus,
} from "../../lib/ui-status";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IP_PATTERN =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.|$)){4}$|^[a-f0-9:]{3,}$/i;

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
  return `${statusLabel} · ${deliveredAt}`;
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
    .join(" · ");
}

function formatMerchantReasons(value) {
  const rawReasons = Array.isArray(value)
    ? value
    : String(value || "")
        .split(",")
        .map((item) => item.trim());
  const reasons = rawReasons
    .flatMap((item) =>
      String(item || "")
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
  return reasons.slice(0, 2).join(" · ");
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

function HelpStrip({ actions }) {
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
        <BotShieldActionButton onClick={() => actions.setPage("setup")}>
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
              <BotShieldActionButton onClick={() => actions.setPage("setup")}>
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
  const emailReady = model.emailProviderConfigured && model.emailAlerts;
  const billingReady = Boolean(model.billingStatus?.active);
  const storefrontConnected = hasStorefrontConnection(model);
  const storefrontEventsReceived = Boolean(
    model.protectionStatus.lastStorefrontDecisionAt,
  );

  return [
    {
      label: "App installed",
      detail: "BotShield is installed and loading inside Shopify Admin.",
      complete: true,
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
      action: () => actions.setPage?.("setup"),
      actionLabel: "View steps",
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

function SetupProgressCard({ model, actions, showViewSetupAction = true }) {
  const items = getSetupChecklistItems(model, actions);
  const complete = items.filter((item) => item.complete).length;

  return (
    <BotShieldCard
      title="Setup Progress"
      subtitle={`${complete} of ${items.length} completed`}
      actions={
        showViewSetupAction ? (
          <BotShieldActionButton onClick={() => actions.setPage("setup")}>
            View setup
          </BotShieldActionButton>
        ) : null
      }
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
        <BotShieldActionButton disabled={complete !== steps.length}>
          Finish
        </BotShieldActionButton>
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

function OverviewPage({ model, actions }) {
  {
    const overviewStorefrontConnected = hasStorefrontConnection(model);
    const overviewVisitorSessions = model.storefrontScans.length;
    const overviewBlockedVisitors = model.blockedCount;
    const overviewChallengedVisitors = model.challengedCount;
    const overviewActiveProtections = 6;
    const overviewPausedModules = model.protectionPaused
      ? overviewActiveProtections
      : 0;
    const overviewBillingActive = Boolean(model.billingStatus?.active);
    const overviewUsageProgress = Math.max(
      4,
      Math.min(100, overviewVisitorSessions),
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
    const overviewMetricCards = [
      {
        title: "Traffic",
        value: overviewVisitorSessions,
        label: "Visitor sessions in this cycle",
        detail: "Full visitor analytics included",
      },
      {
        title: "Protection",
        value: overviewBlockedVisitors,
        label: "Visitors blocked",
        detail: `${overviewChallengedVisitors} challenged visitors`,
      },
      {
        title: "Coverage",
        value: overviewActiveProtections,
        label: "Active protections",
        detail: `${overviewActiveProtections} core protections · ${overviewPausedModules} paused modules`,
      },
      {
        title: "Orders",
        value: 0,
        label: "Fraud orders detected",
        detail: "0 high-risk recommendations",
      },
    ];
    const overviewWorkspaceRows = [
      {
        label: "Theme app embed",
        detail: overviewStorefrontConnected
          ? "Storefront protections are live on your theme."
          : "Enable the theme app embed to start storefront protection.",
        badge: overviewStorefrontConnected ? "On" : "Setup required",
        status: overviewStorefrontConnected ? "active" : "setup_required",
      },
      {
        label: "Current plan",
        detail: "BotShield Basic covers storefront protection modules.",
        badge: overviewBillingActive ? "Basic" : "Setup required",
        status: overviewBillingActive ? "active" : "setup_required",
      },
      {
        label: "Usage progress",
        detail: `${overviewVisitorSessions} visitor sessions tracked`,
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
    const overviewCoverageRows = [
      ["Bot protection", "On", "active"],
      ["Network / Proxy", "On", "active"],
      ["Rate protection", "On", "active"],
      ["Page protection", "On", "active"],
      ["IP blocklist", "On", "active"],
      ["Trusted visitors", "On", "active"],
      ["Checkout blocking", "Off", "monitoring_only"],
    ];

    return (
      <div className="botshield-page">
        <main className="botshield-page-content botshield-overview-content">
          <s-stack gap="large">
            <div className="botshield-overview-app-title">
              <s-text type="strong">BotShield</s-text>
            </div>

            <div className="botshield-overview-header">
              <div>
                <s-heading>Overview</s-heading>
                <s-text color="subdued">
                  Track storefront protection, visitor activity, and billing
                  health from one clean control center.
                </s-text>
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
                  Create protection
                </BotShieldActionButton>
              </s-stack>
            </div>

            <div className="botshield-overview-metric-grid">
              {overviewMetricCards.map((card) => (
                <div className="botshield-overview-metric-card" key={card.title}>
                  <s-stack gap="small">
                    <s-text color="subdued">{card.title}</s-text>
                    <s-heading>{card.value}</s-heading>
                    <s-text type="strong">{card.label}</s-text>
                    <s-text color="subdued">{card.detail}</s-text>
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
                        <BotShieldStatusBadge
                          status={row.status}
                          label={row.badge}
                        />
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
                  {overviewCoverageRows.map(([label, badge, status]) => (
                    <div className="botshield-overview-row" key={label}>
                      <s-stack
                        direction="inline"
                        gap="base"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <s-text type="strong">{label}</s-text>
                        <BotShieldStatusBadge status={status} label={badge} />
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

              <BotShieldCard title="Review fraud orders">
                <s-stack gap="base">
                  <s-text color="subdued">
                    Jump into risky order review when you need order-side
                    controls and automation.
                  </s-text>
                  <div>
                    <BotShieldActionButton
                      onClick={() => actions.setPage("fraud-orders")}
                    >
                      Open fraud orders
                    </BotShieldActionButton>
                  </div>
                </s-stack>
              </BotShieldCard>

              <BotShieldCard title="Billing and settings">
                <s-stack gap="base">
                  <s-text color="subdued">
                    Manage pricing, app access, alerts, and protection settings
                    for this store.
                  </s-text>
                  <div>
                    <BotShieldActionButton
                      onClick={() => actions.setPage("detection-settings")}
                    >
                      Open settings
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
              <BotShieldActionButton onClick={() => actions.setPage("setup")}>
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
            <BotShieldActionButton onClick={() => actions.setPage("setup")}>
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
                <BotShieldActionButton onClick={() => actions.setPage("setup")}>
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

function AnalyticsPage({ model, actions }) {
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
  const highRiskEvents = model.storefrontScans.filter(
    (event) => event.threatLevel === "high",
  ).length;
  const threatSignals = (model.securityPosture?.report?.topReasonCodes || [])
    .slice(0, 6)
    .map((item) => ({
      label: formatMerchantReasons([item.label]),
      count: item.count,
    }));
  const topOrigins = model.trafficOrigins.slice(0, 6).map((origin) => ({
    label:
      [origin.city, origin.country].filter(Boolean).join(", ") ||
      "Location unavailable",
    count: origin.count,
  }));

  return (
    <Screen
      title="Analytics"
      subtitle="Understand real storefront traffic, suspicious activity, and protection outcomes."
      actions={
        <BotShieldAsyncButton
          action={actions.refresh}
          successMessage="Analytics refreshed"
          icon="refresh"
        >
          Refresh
        </BotShieldAsyncButton>
      }
    >
      <s-grid
        gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))"
        gap="large"
      >
        <OutcomeCard
          label="Visitors evaluated"
          value={model.storefrontScans.length}
          description={`Real storefront traffic. ${formatDelta(
            recentEvents.length,
            previousEvents.length,
          )}.`}
          status="real_storefront"
        />
        <OutcomeCard
          label="Threats stopped"
          value={model.blockedCount}
          description={`${recentBlocked} blocked in the last 7 days.`}
          status={model.blockedCount ? "blocked" : "active"}
        />
        <OutcomeCard
          label="Verification requested"
          value={model.challengedCount}
          description={`${recentChallenged} challenges in the last 7 days.`}
          status={model.challengedCount ? "challenged" : "active"}
        />
        <OutcomeCard
          label="High-risk activity"
          value={highRiskEvents}
          description="Events merchants may want to review."
          status={highRiskEvents ? "high" : "active"}
        />
      </s-grid>

      <s-grid
        gridTemplateColumns="repeat(auto-fit, minmax(300px, 1fr))"
        gap="large"
      >
        <BotShieldCard
          title="Top threat signals"
          subtitle="Most frequent suspicious signals from real storefront activity."
          actions={
            <BotShieldActionButton onClick={() => actions.setPage("incidents")}>
              View visitors
            </BotShieldActionButton>
          }
        >
          <InsightList
            items={threatSignals}
            emptyMessage="No elevated threat signals have been recorded yet."
          />
        </BotShieldCard>
        <BotShieldCard
          title="Traffic origins"
          subtitle="Approximate locations from enriched storefront requests."
        >
          <InsightList
            items={topOrigins}
            emptyMessage="Traffic origins appear after storefront events are enriched."
          />
        </BotShieldCard>
      </s-grid>

      <BotShieldCard
        title="Analytics source"
        subtitle="BotShield separates real production analytics from diagnostics."
      >
        <s-stack gap="base">
          <BotShieldInlineHelp>
            Analytics uses real storefront decisions recorded through the
            BotShield theme app embed and Shopify app proxy.
          </BotShieldInlineHelp>
          <BotShieldInlineHelp>
            Diagnostic scans and simulations are excluded from these analytics
            so merchant-facing numbers stay honest.
          </BotShieldInlineHelp>
        </s-stack>
      </BotShieldCard>
    </Screen>
  );
}

function FraudOrdersPage() {
  return (
    <Screen
      title="Fraud Orders"
      subtitle="Review risky order activity and fraud signals."
    >
      <BotShieldCard>
        <BotShieldEmptyState
          title="No fraud orders detected yet"
          description="Fraud order signals will appear here after BotShield has verified order-risk data. No sample or simulated orders are shown."
        />
      </BotShieldCard>
    </Screen>
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
  challenged,
  highRisk,
  model,
  actions,
}) {
  const reviewCount = blocked + challenged + highRisk;
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
              ? `${reviewCount} visitor decisions available for review`
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
  const blocked = model.incidents.filter(
    (incident) => incident.decision === "blocked",
  ).length;
  const challenged = model.incidents.filter(
    (incident) => incident.decision === "challenged",
  ).length;
  const highRisk = model.incidents.filter(
    (incident) => incident.threatLevel === "high",
  ).length;
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
        challenged={challenged}
        highRisk={highRisk}
        model={model}
        actions={actions}
      />
      <s-grid
        gridTemplateColumns="repeat(auto-fit, minmax(170px, 1fr))"
        gap="base"
      >
        <Metric
          label="Total visitors"
          value={model.incidentCounts.real}
          detail="Storefront visits analyzed"
          status="real_storefront"
        />
        <Metric
          label="Blocked visitors"
          value={blocked}
          detail="Visitors stopped"
          status={blocked ? "blocked" : "active"}
        />
        <Metric
          label="Challenged visitors"
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
        subtitle={`${model.incidentCounts.real} real storefront decisions · ${model.incidentCounts.simulation} diagnostic or simulated events excluded from storefront totals`}
      >
        <ActivityTable model={model} actions={actions} />
      </BotShieldCard>
    </Screen>
  );
}

function ProtectionPage({ model, actions }) {
  const toast = useBotShieldToast();
  const [draft, setDraft] = useState({
    autoBlock: model.autoBlock,
    strictMode: model.strictMode,
    blockLevel: model.blockLevel,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    setDraft({
      autoBlock: model.autoBlock,
      strictMode: model.strictMode,
      blockLevel: model.blockLevel,
    });
  }, [model.autoBlock, model.blockLevel, model.strictMode]);

  const dirty =
    draft.autoBlock !== model.autoBlock ||
    draft.strictMode !== model.strictMode ||
    draft.blockLevel !== model.blockLevel;

  const save = async () => {
    setSaving(true);
    setSaveError("");
    try {
      await actions.saveSettings(draft);
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
      <HelpStrip actions={actions} />
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
              description={`${model.blockedIPs.length} manually blocked visitor${model.blockedIPs.length === 1 ? "" : "s"}.`}
              action={
                <BotShieldActionButton
                  onClick={() => actions.setPage("blocklist")}
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
                  onClick={() => actions.setPage("trusted")}
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
  const trusted = title.toLowerCase().includes("trusted");
  const trimmedValue = value.trim();
  const validIp = !trimmedValue || IP_PATTERN.test(trimmedValue);
  const listLabel = trusted ? "trusted list" : "blocklist";
  const emptyDescription = trusted
    ? "Add admins, agency partners, or reviewed customers who should bypass automated blocking."
    : "Add confirmed abusive sources only. BotShield will stop matching visitors when storefront protection runs.";

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
            error={!validIp ? "Enter a valid IPv4 or IPv6 address" : ""}
          />
        </s-box>
        <s-stack alignItems="end" justifyContent="end">
          <BotShieldAsyncButton
            action={onAdd}
            successMessage={`${title} updated`}
            variant="primary"
            disabled={!trimmedValue || !validIp}
          >
            {addLabel}
          </BotShieldAsyncButton>
        </s-stack>
      </s-grid>
      {rows.length ? (
        <s-stack>
          {rows.map((row) => {
            const ip = typeof row === "string" ? row : row.ip;
            return (
              <StatusRow
                key={ip}
                label={ip}
                detail={
                  trusted
                    ? "Allowed through automated protection after review."
                    : "Stopped before continuing through the storefront."
                }
                status={trusted ? "active" : "blocked"}
                action={
                  <BotShieldAsyncButton
                    action={() => onRemove(ip)}
                    successMessage="IP removed"
                    tone="critical"
                  >
                    Remove
                  </BotShieldAsyncButton>
                }
              />
            );
          })}
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

function SettingsPage({ model, actions }) {
  const toast = useBotShieldToast();
  const [draft, setDraft] = useState({
    alertEmail: model.alertEmail,
    emailAlerts: model.emailAlerts,
    highRiskAlertsOnly: model.highRiskAlertsOnly,
    weeklyReportsEnabled: model.weeklyReportsEnabled,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

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

  const dirty = useMemo(
    () =>
      draft.alertEmail !== model.alertEmail ||
      draft.emailAlerts !== model.emailAlerts ||
      draft.highRiskAlertsOnly !== model.highRiskAlertsOnly ||
      draft.weeklyReportsEnabled !== model.weeklyReportsEnabled,
    [draft, model],
  );
  const emailStatus = getEmailStatus({
    configured: model.emailProviderConfigured,
    lastStatus: model.lastAlertStatus,
  });
  const alertReady =
    model.emailProviderConfigured &&
    draft.emailAlerts &&
    EMAIL_PATTERN.test(draft.alertEmail);
  const reportReady =
    model.emailProviderConfigured &&
    draft.weeklyReportsEnabled &&
    EMAIL_PATTERN.test(draft.alertEmail);
  const lastAlertDetail = model.lastAlertStatus
    ? formatDeliveryDetail(model.lastAlertStatus, model.lastAlertSentAt)
    : "No alert delivery recorded yet";
  const lastReportDetail = model.lastWeeklyReportStatus
    ? formatDeliveryDetail(
        model.lastWeeklyReportStatus,
        model.lastWeeklyReportAt,
      )
    : "No weekly report delivery recorded yet";

  const save = async () => {
    if (
      (draft.emailAlerts || draft.weeklyReportsEnabled) &&
      !EMAIL_PATTERN.test(draft.alertEmail)
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

  return (
    <Screen
      title="Alerts & Reports"
      subtitle="Choose where BotShield sends security notifications and weekly summaries."
    >
      <BotShieldSaveState
        dirty={dirty}
        saving={saving}
        error={saveError}
        onSave={save}
        onDiscard={() =>
          setDraft({
            alertEmail: model.alertEmail,
            emailAlerts: model.emailAlerts,
            highRiskAlertsOnly: model.highRiskAlertsOnly,
            weeklyReportsEnabled: model.weeklyReportsEnabled,
          })
        }
      />
      <s-grid
        gridTemplateColumns="minmax(0, 1.2fr) minmax(300px, 0.8fr)"
        gap="large"
      >
        <BotShieldCard
          title="Notification center"
          subtitle="Keep the right person informed when BotShield stops, verifies, or detects risky storefront traffic."
          badge={
            <BotShieldStatusBadge
              status={alertReady ? "provider_connected" : "setup_required"}
              label={alertReady && reportReady ? "Ready" : "Needs setup"}
            />
          }
          accent
        >
          <s-stack gap="large">
            <div className="botshield-status-value">
              {alertReady
                ? reportReady
                  ? "Notifications are ready"
                  : "Security alerts are ready"
                : "Notifications need setup"}
            </div>
            <s-paragraph color="subdued">
              {alertReady
                ? `BotShield will send merchant-facing security updates to ${draft.alertEmail}.`
                : "Add a recipient, enable the notifications you want, then send a test email before launch."}
            </s-paragraph>
            <s-grid
              gridTemplateColumns="repeat(auto-fit, minmax(145px, 1fr))"
              gap="base"
            >
              <s-stack gap="small-200">
                <s-text color="subdued">Provider</s-text>
                <s-text type="strong">
                  {model.emailProviderConfigured ? "Connected" : "Not configured"}
                </s-text>
              </s-stack>
              <s-stack gap="small-200">
                <s-text color="subdued">Security alerts</s-text>
                <s-text type="strong">{draft.emailAlerts ? "On" : "Off"}</s-text>
              </s-stack>
              <s-stack gap="small-200">
                <s-text color="subdued">Weekly report</s-text>
                <s-text type="strong">
                  {draft.weeklyReportsEnabled ? "On" : "Off"}
                </s-text>
              </s-stack>
            </s-grid>
          </s-stack>
        </BotShieldCard>

        <BotShieldCard
          title="Recent email activity"
          subtitle="A quick audit trail for alert and weekly report delivery."
        >
          <s-stack>
            <StatusRow
              label="Last alert"
              detail={lastAlertDetail}
              status={
                model.lastAlertStatus === "sent"
                  ? "sent"
                  : model.lastAlertStatus || "pending"
              }
            />
            <StatusRow
              label="Last weekly report"
              detail={lastReportDetail}
              status={
                model.lastWeeklyReportStatus === "sent"
                  ? "sent"
                  : model.lastWeeklyReportStatus || "pending"
              }
            />
          </s-stack>
        </BotShieldCard>
      </s-grid>
      <s-grid
        gridTemplateColumns="minmax(220px, 1fr) minmax(0, 2fr)"
        gap="large"
      >
        <s-stack gap="small">
          <s-heading>Email alerts</s-heading>
          <s-paragraph color="subdued">
            Choose where and when BotShield sends security alerts.
          </s-paragraph>
        </s-stack>
        <BotShieldCard
          title="Notification settings"
          subtitle="Changes apply to future storefront incidents and weekly reports."
          badge={<BotShieldStatusBadge status={emailStatus.technicalStatus} />}
        >
          <s-stack gap="large">
            {!model.emailProviderConfigured ? (
              <BotShieldBanner
                tone="warning"
                title="Email provider not configured"
              >
                Configure the Resend API key and verified sending domain before
                enabling merchant notifications.
              </BotShieldBanner>
            ) : null}
            <BotShieldTextField
              label="Alert email"
              value={draft.alertEmail}
              onChange={(alertEmail) =>
                setDraft((current) => ({ ...current, alertEmail }))
              }
              type="email"
              autocomplete="email"
              error={
                draft.alertEmail && !EMAIL_PATTERN.test(draft.alertEmail)
                  ? "Enter a valid email address"
                  : ""
              }
            />
            <BotShieldToggle
              label="Security alerts"
              details="Send blocked, challenged, and high-risk incident notifications."
              checked={draft.emailAlerts}
              disabled={!model.emailProviderConfigured}
              onChange={(emailAlerts) =>
                setDraft((current) => ({ ...current, emailAlerts }))
              }
            />
            <BotShieldToggle
              label="High-risk alerts only"
              details="Reduce email volume by limiting notifications to the highest-risk activity."
              checked={draft.highRiskAlertsOnly}
              onChange={(highRiskAlertsOnly) =>
                setDraft((current) => ({ ...current, highRiskAlertsOnly }))
              }
            />
            <BotShieldToggle
              label="Weekly security report"
              details={`Last report: ${formatDate(model.lastWeeklyReportAt)}`}
              checked={draft.weeklyReportsEnabled}
              disabled={!model.emailProviderConfigured}
              onChange={(weeklyReportsEnabled) =>
                setDraft((current) => ({ ...current, weeklyReportsEnabled }))
              }
            />
            <s-stack direction="inline" gap="small">
              <BotShieldAsyncButton
                action={async () => {
                  await safeFetchJson("/api/alerts/test", { method: "POST" });
                  await actions.refreshSettings();
                }}
                successMessage="Test email sent"
                disabled={
                  dirty ||
                  !draft.emailAlerts ||
                  !model.emailProviderConfigured ||
                  !EMAIL_PATTERN.test(draft.alertEmail)
                }
              >
                Send test email
              </BotShieldAsyncButton>
              <BotShieldAsyncButton
                action={async () => {
                  await safeFetchJson("/api/weekly-report", { method: "POST" });
                  await actions.refreshSettings();
                }}
                successMessage="Weekly report sent"
                disabled={
                  dirty ||
                  !draft.weeklyReportsEnabled ||
                  !model.emailProviderConfigured ||
                  !EMAIL_PATTERN.test(draft.alertEmail)
                }
              >
                Send report now
              </BotShieldAsyncButton>
            </s-stack>
            <BotShieldInlineHelp>
              BotShield uses cooldown protection so repeated incidents from the
              same pattern do not create duplicate email bursts.
            </BotShieldInlineHelp>
            <s-grid
              gridTemplateColumns="repeat(auto-fit, minmax(180px, 1fr))"
              gap="base"
            >
              <Metric
                label="Security alerts"
                value={alertReady ? "Ready" : "Needs setup"}
                detail={draft.alertEmail || "No recipient configured"}
                status={alertReady ? "provider_connected" : "setup_required"}
              />
              <Metric
                label="Weekly report"
                value={reportReady ? "Ready" : "Needs setup"}
                detail={`Last report: ${formatDate(model.lastWeeklyReportAt)}`}
                status={reportReady ? "provider_connected" : "setup_required"}
              />
            </s-grid>
            {model.lastAlertError || model.lastWeeklyReportError ? (
              <BotShieldBanner
                tone="critical"
                title="Most recent delivery failed"
              >
                {model.lastAlertError || model.lastWeeklyReportError}
              </BotShieldBanner>
            ) : null}
          </s-stack>
        </BotShieldCard>

      </s-grid>
    </Screen>
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

function SetupPage({ model, actions }) {
  const setupChecklistItems = getSetupChecklistItems(model, actions);
  const complete = setupChecklistItems.filter((item) => item.complete).length;
  const total = setupChecklistItems.length;
  const setupComplete = complete === total;
  const nextItem = setupChecklistItems.find((item) => !item.complete);
  const storefrontConnected = hasStorefrontConnection(model);
  const executiveStatus = getExecutiveStatus(model);
  const emailStatus = getEmailStatus({
    configured: model.emailProviderConfigured,
    lastStatus: model.lastAlertStatus,
  });
  const billingStatus = getBillingStatusModel(model.billingStatus || {});
  const testSteps = [
    {
      label: "Enable the theme app embed",
      detail: storefrontConnected
        ? "BotShield has received real storefront traffic from the active store."
        : "Open the theme editor, enable BotShield, save the theme, then return here.",
      complete: storefrontConnected,
      action: (
        <BotShieldActionButton onClick={actions.openThemeEditor}>
          Open theme editor
        </BotShieldActionButton>
      ),
    },
    {
      label: "Visit the storefront",
      detail:
        model.protectionStatus.lastStorefrontDecisionAt
          ? `Last storefront event: ${formatDate(model.protectionStatus.lastStorefrontDecisionAt)}`
          : "Open the storefront homepage once the embed is enabled so BotShield can receive a real visit.",
      complete: Boolean(model.protectionStatus.lastStorefrontDecisionAt),
      action: (
        <BotShieldActionButton onClick={() => actions.setPage("incidents")}>
          View visitors
        </BotShieldActionButton>
      ),
    },
    {
      label: "Configure alerts",
      detail: model.emailProviderConfigured
        ? "Email provider is configured. Send a test alert to confirm delivery."
        : "Add an alert email and verify delivery.",
      complete: model.emailProviderConfigured,
      action: (
        <BotShieldActionButton onClick={() => actions.setPage("policy")}>
          Configure alerts
        </BotShieldActionButton>
      ),
    },
    {
      label: "Confirm subscription flow",
      detail: model.billingStatus?.active
        ? "Billing is verified for this store."
        : "Review the plan, trial, and subscription status.",
      complete: Boolean(model.billingStatus?.active),
      action: (
        <BotShieldActionButton onClick={() => actions.setPage("billing")}>
          Review billing
        </BotShieldActionButton>
      ),
    },
  ];

  return (
    <Screen
      title="Setup & Help"
      subtitle="Confirm BotShield is connected, configured, and ready for real storefront protection."
      actions={
        <BotShieldAsyncButton
          action={actions.refresh}
          successMessage="Setup status refreshed"
          icon="refresh"
        >
          Refresh
        </BotShieldAsyncButton>
      }
    >
      <BotShieldCard
        title={setupComplete ? "Launch checks complete" : "Finish launch setup"}
        subtitle={
          setupComplete
            ? "Every required setup item is verified from live app data."
            : nextItem
              ? `Next step: ${nextItem.label}`
              : "Review each setup area before launch."
        }
        badge={
          <BotShieldStatusBadge
            status={setupComplete ? "active" : "setup_required"}
          />
        }
        actions={
          !storefrontConnected ? (
            <BotShieldActionButton
              variant="primary"
              onClick={actions.openThemeEditor}
            >
              Enable theme embed
            </BotShieldActionButton>
          ) : (
            <BotShieldActionButton onClick={() => actions.setPage("incidents")}>
              View visitor activity
            </BotShieldActionButton>
          )
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
              label="Setup progress"
              value={`${complete}/${total}`}
              detail={
                setupComplete
                  ? "All required items verified"
                  : `${total - complete} items remaining`
              }
              status={setupComplete ? "active" : "setup_required"}
            />
            <Metric
              label="Protection status"
              value={executiveStatus.label}
              detail={executiveStatus.detail}
              status={executiveStatus.status}
            />
            <Metric
              label="Storefront"
              value={
                storefrontConnected
                  ? "Connected"
                  : "Not connected"
              }
              detail={formatDate(
                model.protectionStatus.lastStorefrontDecisionAt,
                "No storefront event yet",
              )}
              status={
                storefrontConnected
                  ? "theme_embed_connected"
                  : "theme_embed_missing"
              }
            />
            <Metric
              label="Alerts"
              value={emailStatus.label}
              detail={
                model.lastAlertSentAt
                  ? `Last sent ${formatDate(model.lastAlertSentAt)}`
                  : "Test before launch"
              }
              status={emailStatus.technicalStatus}
            />
          </s-grid>
          {!setupComplete ? (
            <BotShieldBanner
              tone="warning"
              title="Setup is not finished yet"
              action={
                nextItem?.label?.includes("Theme") ? (
                  <BotShieldActionButton
                    variant="primary"
                    onClick={actions.openThemeEditor}
                  >
                    Open theme editor
                  </BotShieldActionButton>
                ) : null
              }
            >
              Complete the remaining checklist items before treating BotShield
              as launch-ready for a live merchant.
            </BotShieldBanner>
          ) : (
            <BotShieldBanner tone="success" title="Setup verified">
              BotShield has verified storefront connection, protection status,
              and setup readiness from production data.
            </BotShieldBanner>
          )}
        </s-stack>
      </BotShieldCard>

      <s-grid
        gridTemplateColumns="minmax(0, 1.35fr) minmax(320px, 0.65fr)"
        gap="base"
      >
        <SetupProgressCard
          model={model}
          actions={actions}
          showViewSetupAction={false}
        />
        <BotShieldCard
          title="Readiness checks"
          subtitle="Live signals BotShield can verify automatically."
        >
          <s-stack>
            <StatusRow
              label="Theme app embed"
              detail={
                storefrontConnected
                  ? "BotShield has received real storefront traffic."
                  : "Enable the embed in the active theme."
              }
              status={storefrontConnected ? "active" : "setup_required"}
              action={
                !storefrontConnected ? (
                  <BotShieldActionButton onClick={actions.openThemeEditor}>
                    Open
                  </BotShieldActionButton>
                ) : null
              }
            />
            <StatusRow
              label="Storefront traffic"
              detail={formatDate(
                model.protectionStatus.lastStorefrontDecisionAt,
                "No real storefront decision received yet.",
              )}
              status={
                model.protectionStatus.lastStorefrontDecisionAt
                  ? "active"
                  : "setup_required"
              }
            />
            <StatusRow
              label="Email alerts"
              detail={
                model.emailProviderConfigured
                  ? "Provider configured. Send a test email before launch."
                  : "Resend and alert sender must be configured."
              }
              status={emailStatus.technicalStatus}
              action={
                <BotShieldActionButton onClick={() => actions.setPage("policy")}>
                  Alerts
                </BotShieldActionButton>
              }
            />
            <StatusRow
              label="Billing"
              detail={billingStatus.description}
              status={billingStatus.technicalStatus}
              action={
                <BotShieldActionButton
                  onClick={() => actions.setPage("billing")}
                >
                  Billing
                </BotShieldActionButton>
              }
            />
          </s-stack>
        </BotShieldCard>
      </s-grid>

      <BotShieldCard
        title="Merchant setup flow"
        subtitle="The exact steps a merchant follows after installing BotShield."
      >
        <s-stack>
          {testSteps.map((step, index) => (
            <div className="botshield-checklist-row" key={step.label}>
              <s-stack direction="inline" gap="base" alignItems="start">
                <span
                  className={`botshield-check-icon${
                    step.complete ? " botshield-check-icon--complete" : ""
                  }`}
                >
                  {step.complete ? "Done" : index + 1}
                </span>
                <s-stack gap="small-200">
                  <s-text type="strong">{step.label}</s-text>
                  <s-text color="subdued">{step.detail}</s-text>
                </s-stack>
              </s-stack>
              <s-stack direction="inline" gap="small" alignItems="center">
                <BotShieldStatusBadge
                  status={step.complete ? "active" : "setup_required"}
                />
                {!step.complete ? step.action : null}
              </s-stack>
            </div>
          ))}
        </s-stack>
      </BotShieldCard>

      <BotShieldCard
        title="How BotShield works"
        subtitle="Important details about storefront protection."
      >
        <s-grid
          gridTemplateColumns="repeat(auto-fit, minmax(240px, 1fr))"
          gap="base"
        >
          <BotShieldInlineHelp>
            BotShield protects JavaScript-enabled storefront visits through the
            theme app embed and Shopify app proxy.
          </BotShieldInlineHelp>
          <BotShieldInlineHelp>
            Diagnostic scans and simulations stay separate from real storefront
            protection metrics.
          </BotShieldInlineHelp>
          <BotShieldInlineHelp>
            If a real customer is blocked by mistake, use Visitors to unblock
            or add them to Trusted Visitors.
          </BotShieldInlineHelp>
        </s-grid>
      </BotShieldCard>

      <s-grid
        gridTemplateColumns="repeat(auto-fit, minmax(240px, 1fr))"
        gap="base"
      >
        <BotShieldCard title="Support">
          <s-stack gap="base">
            <s-text color="subdued">
              Get help with setup, incidents, or false positives.
            </s-text>
            <BotShieldActionButton href="/support" target="_blank">
              Contact support
            </BotShieldActionButton>
          </s-stack>
        </BotShieldCard>
        <BotShieldCard title="Privacy">
          <s-stack gap="base">
            <s-text color="subdued">
              Review how BotShield handles merchant and storefront event data.
            </s-text>
            <BotShieldActionButton href="/privacy" target="_blank">
              View privacy policy
            </BotShieldActionButton>
          </s-stack>
        </BotShieldCard>
        <BotShieldCard title="Terms">
          <s-stack gap="base">
            <s-text color="subdued">
              Review service terms and security limitations.
            </s-text>
            <BotShieldActionButton href="/terms" target="_blank">
              View terms
            </BotShieldActionButton>
          </s-stack>
        </BotShieldCard>
      </s-grid>
      <BotShieldInlineHelp>
        BotShield evaluates JavaScript-enabled storefront visits through a theme
        app embed and Shopify app proxy. It does not provide edge-level or
        guaranteed server-side interception.
      </BotShieldInlineHelp>
    </Screen>
  );
}

export default function BotShieldAdminExperience({ model, actions }) {
  const screen =
    model.page === "security"
      ? "detection"
      : model.page === "settings"
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
      {screen === "fraud-orders" ? <FraudOrdersPage /> : null}
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
      {screen === "setup" ? (
        <SetupPage model={model} actions={actions} />
      ) : null}
    </div>
  );

  return (
    <BotShieldAppFrame>
      <div className="botshield-route-shell">{routeContent}</div>
    </BotShieldAppFrame>
  );
}
