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
          <span className="botshield-rule-icon">â“˜</span>
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
          …47652 tokens truncated…atus.pricingUrl}
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
  const emailReady = Boolean(
    model.emailProviderConfigured &&
      model.emailAlerts &&
      EMAIL_PATTERN.test(model.alertEmail || ""),
  );
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
      action: model.protectionStatus.shop ? (
        <BotShieldActionButton
          href={`https://${model.protectionStatus.shop}`}
          target="_blank"
        >
          Open storefront
        </BotShieldActionButton>
      ) : null,
    },
    {
      label: "Configure alerts",
      detail: emailReady
        ? "Email alerts are configured with a valid recipient."
        : "Add an alert email and verify delivery.",
      complete: emailReady,
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
      : model.page === "fraud-orders"
        ? "analytics"
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

