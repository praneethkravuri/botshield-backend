/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
import {
  BotShieldActionButton,
  BotShieldAppFrame,
  BotShieldAsyncButton,
  BotShieldBanner,
  BotShieldCard,
  BotShieldDangerZone,
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
  getEventSourceStatus,
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

function formatDate(value, fallback = "Not yet") {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString();
}

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

function formatDelta(current, previous) {
  if (previous === 0) return current === 0 ? "No change" : "New activity";
  const change = Math.round(((current - previous) / previous) * 100);
  return `${change > 0 ? "+" : ""}${change}% from previous 7 days`;
}

function Screen({ title, subtitle, actions, children, maxWidth = "base" }) {
  return (
    <s-page heading={title} inlineSize={maxWidth}>
      <s-stack gap="large">
        <s-stack
          direction="inline"
          gap="base"
          justifyContent="space-between"
          alignItems="center"
        >
          <s-paragraph color="subdued">{subtitle}</s-paragraph>
          {actions}
        </s-stack>
        {children}
      </s-stack>
    </s-page>
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
  if (model.protectionPaused) {
    return {
      label: "Paused",
      status: "paused",
      detail:
        "BotShield is still recording visits, but automatic blocking is paused.",
    };
  }
  if (!model.protectionStatus.themeEmbedDetected) {
    return {
      label: "Setup Required",
      status: "setup_required",
      detail:
        "Enable the theme app embed to start monitoring storefront visitors.",
    };
  }
  if (model.protectionReady && model.autoBlock) {
    return {
      label: "Protected",
      status: "active",
      detail:
        "BotShield is evaluating real storefront traffic and can respond automatically.",
    };
  }
  return {
    label: "Monitoring",
    status: "monitoring_only",
    detail:
      "BotShield is watching storefront activity without automatically blocking visitors.",
  };
}

function ProtectionStatusCard({ model, actions }) {
  const executiveStatus = getExecutiveStatus(model);

  return (
    <BotShieldCard
      title="Protection Status"
      subtitle="The current operating state of storefront protection."
      badge={<BotShieldStatusBadge status={executiveStatus.status} />}
      actions={
        <BotShieldActionButton
          variant="primary"
          onClick={
            model.protectionStatus.themeEmbedDetected
              ? () => actions.setPage("detection")
              : actions.openThemeEditor
          }
        >
          {model.protectionStatus.themeEmbedDetected
            ? "Manage protection"
            : "Connect storefront"}
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
            <s-text type="strong">
              {model.autoBlock ? "Auto Block" : "Monitoring only"}
            </s-text>
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
  return (
    <BotShieldCard
      title="Quick Actions"
      subtitle="The most common setup and review actions."
    >
      <s-stack gap="base">
        <BotShieldActionButton
          variant={!model.protectionStatus.themeEmbedDetected ? "primary" : "secondary"}
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
    <div className={`botshield-outcome-card botshield-outcome-card--${status || "neutral"}`}>
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

function StoreHealthCard({ model, actions }) {
  const emailReady = model.emailProviderConfigured && model.emailAlerts;
  const billingReady = Boolean(model.billingStatus?.active);
  const trafficConnected = Boolean(
    model.protectionStatus.lastStorefrontDecisionAt,
  );

  return (
    <BotShieldCard
      title="Store Health"
      subtitle="The setup signals that determine whether BotShield can protect the store."
      accent
    >
      <s-stack>
        <StatusRow
          label="Theme Embed"
          detail={
            model.protectionStatus.themeEmbedDetected
              ? "BotShield is installed on the active storefront theme."
              : "Enable the theme app embed so BotShield can see storefront visits."
          }
          status={
            model.protectionStatus.themeEmbedDetected
              ? "theme_embed_connected"
              : "theme_embed_missing"
          }
          action={
            !model.protectionStatus.themeEmbedDetected ? (
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
              : "Configure alerts so high-risk incidents reach the merchant."
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
              ? model.billingStatus.subscription?.name || "Shopify billing is active."
              : "Activate the Shopify subscription before charging merchants."
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
            model.autoBlock
              ? "BotShield can automatically stop visitors that cross the risk threshold."
              : "BotShield is monitoring activity without automatic blocking."
          }
          status={model.autoBlock ? "active" : "monitoring_only"}
          action={
            !model.autoBlock ? (
              <BotShieldActionButton onClick={() => actions.setPage("detection")}>
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

function SetupProgressCard({ model, actions }) {
  const emailReady = model.emailProviderConfigured && model.emailAlerts;
  const billingReady = Boolean(model.billingStatus?.active);
  const storefrontEventsReceived = Boolean(
    model.protectionStatus.lastStorefrontDecisionAt,
  );
  const items = [
    {
      label: "App installed",
      detail: "BotShield is installed and loading inside Shopify Admin.",
      complete: true,
      action: null,
    },
    {
      label: "Theme embed enabled",
      detail: model.protectionStatus.themeEmbedDetected
        ? "The storefront theme is connected."
        : "Enable the theme app embed to connect storefront traffic.",
      complete: model.protectionStatus.themeEmbedDetected,
      action: actions.openThemeEditor,
      actionLabel: "Enable",
    },
    {
      label: "Storefront events received",
      detail: storefrontEventsReceived
        ? `Last event ${formatDate(model.protectionStatus.lastStorefrontDecisionAt)}.`
        : "Visit the storefront after enabling the embed.",
      complete: storefrontEventsReceived,
      action: () => actions.setPage("setup"),
      actionLabel: "View steps",
    },
    {
      label: "Billing verified",
      detail: billingReady
        ? "Shopify billing is active or verified for testing."
        : "Review the Shopify subscription setup.",
      complete: billingReady,
      action: () => actions.setPage("billing"),
      actionLabel: "Review",
    },
    {
      label: "Email alerts configured",
      detail: emailReady
        ? `Alerts are configured for ${model.alertEmail || "the merchant"}.`
        : "Configure the alert recipient and email provider.",
      complete: emailReady,
      action: () => actions.setPage("policy"),
      actionLabel: "Configure",
    },
    {
      label: "Auto Block enabled",
      detail: model.autoBlock
        ? "High-risk storefront traffic can be stopped automatically."
        : "Turn on Auto Block when you are ready to enforce protection.",
      complete: model.autoBlock,
      action: () => actions.setPage("detection"),
      actionLabel: "Turn on",
    },
  ];
  const complete = items.filter((item) => item.complete).length;

  return (
    <BotShieldCard
      title="Setup Progress"
      subtitle={`${complete} of ${items.length} completed`}
      actions={
        <BotShieldActionButton onClick={() => actions.setPage("setup")}>
          View setup
        </BotShieldActionButton>
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
                {item.complete ? "✓" : "•"}
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

function SetupGuide({ model, actions, compact = false }) {
  const complete = model.readinessItems.filter((item) => item.complete).length;
  const visibleItems = compact
    ? model.readinessItems.filter((item) => !item.complete).slice(0, 3)
    : model.readinessItems;

  const actionFor = (item) => {
    if (item.complete) return null;
    if (item.label.includes("Theme")) {
      return (
        <BotShieldActionButton onClick={actions.openThemeEditor}>
          Open theme editor
        </BotShieldActionButton>
      );
    }
    if (
      item.label.includes("Email") ||
      item.label.includes("Alert") ||
      item.label.includes("Test email")
    ) {
      return (
        <BotShieldActionButton onClick={() => actions.setPage("policy")}>
          Configure
        </BotShieldActionButton>
      );
    }
    if (item.label.includes("Billing")) {
      return (
        <BotShieldActionButton onClick={() => actions.setPage("billing")}>
          Review
        </BotShieldActionButton>
      );
    }
    return null;
  };

  return (
    <BotShieldCard
      title="Setup guide"
      subtitle={`${complete} of ${model.readinessItems.length} steps complete`}
      actions={
        compact ? (
          <BotShieldActionButton onClick={() => actions.setPage("setup")}>
            View setup
          </BotShieldActionButton>
        ) : null
      }
    >
      <s-stack>
        {visibleItems.length ? (
          visibleItems.map((item) => (
            <StatusRow
              key={item.label}
              label={item.label}
              detail={item.detail}
              status={item.complete ? "active" : "setup_required"}
              action={actionFor(item)}
            />
          ))
        ) : (
          <BotShieldBanner tone="success" title="Setup complete">
            BotShield has verified every required setup step.
          </BotShieldBanner>
        )}
      </s-stack>
    </BotShieldCard>
  );
}

function OverviewPage({ model, actions }) {
  const showLegacyDashboardDetails = false;
  const latestEvents = model.storefrontScans.slice(0, 5);
  const protectionStatus = model.protectionPaused
    ? "paused"
    : model.protectionReady
      ? "active"
      : model.protectionStatus.themeEmbedDetected
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
      label: formatReasons([item.label]),
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
      subtitle="A calm operational summary of storefront protection."
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
      {!model.protectionStatus.themeEmbedDetected ? (
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

      <s-grid
        gridTemplateColumns="repeat(auto-fit, minmax(260px, 1fr))"
        gap="large"
      >
        <ProtectionStatusCard model={model} actions={actions} />
        <StoreHealthCard model={model} actions={actions} />
        <SetupProgressCard model={model} actions={actions} />
        <QuickActionsCard model={model} actions={actions} />
      </s-grid>

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
            recentEvents.filter((event) => event.threatLevel === "high").length
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

      {showLegacyDashboardDetails ? (
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
                model.protectionStatus.themeEmbedDetected
                  ? "theme_embed_connected"
                  : "theme_embed_missing"
              }
              action={
                !model.protectionStatus.themeEmbedDetected ? (
                  <BotShieldActionButton onClick={actions.openThemeEditor}>
                    Connect
                  </BotShieldActionButton>
                ) : null
              }
            />
            <StatusRow
              label="Automated response"
              detail={`${model.strictMode ? "Strict Mode" : `${model.blockLevel} sensitivity`} · ${model.autoBlock ? "Auto Block on" : "Monitoring only"}`}
              status={protectionStatus}
              action={
                <BotShieldActionButton onClick={() => actions.setPage("detection")}>
                  Manage
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
                <BotShieldActionButton onClick={() => actions.setPage("policy")}>
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
              status={model.billingStatus?.active ? "active" : "setup_required"}
              action={
                !model.billingStatus?.active ? (
                  <BotShieldActionButton onClick={() => actions.setPage("billing")}>
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
                <s-badge tone="info">{model.securityPosture.score.grade}</s-badge>
              ) : null}
            </s-stack>
            <s-text color="subdued">
              {model.securityPosture?.score?.suggestions?.[0] ||
                "No immediate setup improvements are required."}
            </s-text>
            <s-stack>
              {(model.securityPosture?.score?.factors || []).map((factor) => (
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
              ))}
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
            <BotShieldActionButton onClick={() => actions.setPage("incidents")}>
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
        title="Recent Security Activity"
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
                    <s-text type="strong">{formatReasons(event.reasons)}</s-text>
                    <s-text color="subdued">
                      {event.actionTaken === "blocked"
                        ? "Stopped"
                        : event.actionTaken === "challenged"
                          ? "Asked to verify"
                          : "Allowed"} on {event.pathVisited || "storefront"} ·{" "}
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
              !model.protectionStatus.themeEmbedDetected ? (
                <BotShieldActionButton onClick={actions.openThemeEditor}>
                  Open theme editor
                </BotShieldActionButton>
              ) : null
            }
          />
        )}
      </BotShieldCard>
    </Screen>
  );
}

function ActivityTable({ model, actions }) {
  if (!model.incidentLoading && !model.incidents.length) {
    return (
      <BotShieldEmptyState
        title="No activity found"
        description="Adjust the filters or wait for new storefront traffic."
      />
    );
  }
  return (
    <s-table loading={model.incidentLoading} variant="auto">
      <s-table-header-row>
        {["Time", "Visitor", "Decision", "Risk", "Signal", "Source", "Actions"].map(
          (heading) => (
            <s-table-header key={heading}>{heading}</s-table-header>
          ),
        )}
      </s-table-header-row>
      <s-table-body>
        {model.incidents.map((incident) => (
          <s-table-row key={incident.id}>
            <s-table-cell>{formatDate(incident.createdAt)}</s-table-cell>
            <s-table-cell>
              <s-stack gap="small-200">
                <s-text type="strong">{incident.maskedIpAddress}</s-text>
                <s-text color="subdued">{incident.path}</s-text>
              </s-stack>
            </s-table-cell>
            <s-table-cell>
              <BotShieldStatusBadge status={incident.decision} />
            </s-table-cell>
            <s-table-cell>
              <BotShieldStatusBadge status={incident.threatLevel} />
            </s-table-cell>
            <s-table-cell>
              <s-stack gap="small-200">
                <s-text>
                  {formatReasons(incident.reasonCodes || incident.reasons)}
                </s-text>
                <s-text color="subdued">
                  {[incident.networkCity, incident.networkCountry]
                    .filter(Boolean)
                    .join(", ") || "Location unavailable"}
                </s-text>
              </s-stack>
            </s-table-cell>
            <s-table-cell>
              <BotShieldStatusBadge
                status={getEventSourceStatus(incident.source).technicalStatus}
              />
            </s-table-cell>
            <s-table-cell>
              {incident.decision === "blocked" ? (
                <s-button-group>
                  <BotShieldAsyncButton
                    action={() => actions.recoverIncident(incident.id, "unblock")}
                    successMessage="Visitor unblocked"
                  >
                    Unblock
                  </BotShieldAsyncButton>
                  <BotShieldAsyncButton
                    action={() => actions.recoverIncident(incident.id, "whitelist")}
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
  return (
    <Screen
      title="Activity"
      subtitle="Review real storefront decisions and recover from false positives."
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
      <s-grid
        gridTemplateColumns="repeat(auto-fit, minmax(170px, 1fr))"
        gap="base"
      >
        <Metric
          label="Real storefront"
          value={model.incidentCounts.real}
          detail="Verified production events"
          status="real_storefront"
        />
        <Metric
          label="Blocked"
          value={blocked}
          detail="Requests stopped"
          status={blocked ? "blocked" : "active"}
        />
        <Metric
          label="Challenged"
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
      <BotShieldCard>
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
              { label: "Challenged", value: "challenged" },
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
      </BotShieldCard>
      <BotShieldCard
        title="Storefront decisions"
        subtitle={`${model.incidentCounts.real} real events · ${model.incidentCounts.simulation} simulations`}
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
        error instanceof Error ? error.message : "Couldn’t save protection settings";
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      title="Protection"
      subtitle="Control how BotShield evaluates and responds to storefront traffic."
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
      <s-grid gridTemplateColumns="minmax(220px, 1fr) minmax(0, 2fr)" gap="large">
        <s-stack gap="small">
          <s-heading>Protection mode</s-heading>
          <s-paragraph color="subdued">
            Pause automated blocking while investigating false positives. Event
            collection continues.
          </s-paragraph>
        </s-stack>
        <BotShieldCard
          badge={
            <BotShieldStatusBadge
              status={model.protectionPaused ? "paused" : "active"}
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
        >
          <BotShieldInlineHelp>
            Pausing prevents new automated blocks but keeps recording decisions.
          </BotShieldInlineHelp>
        </BotShieldCard>

        <s-stack gap="small">
          <s-heading>Detection profile</s-heading>
          <s-paragraph color="subdued">
            Choose the amount of suspicious behavior required before BotShield
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
        <BotShieldCard badge={<BotShieldStatusBadge status="active" label="Enabled" />}>
          <s-stack gap="base">
            <s-text>
              VPN, proxy, datacenter, hosting provider, and ASN signals contribute
              to real storefront risk scores.
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
                Generate simulation
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
  return (
    <BotShieldCard title={title} subtitle={subtitle}>
      <s-stack gap="base">
        <s-stack direction="inline" gap="base" alignItems="end">
          <BotShieldTextField
            label="IP address"
            value={value}
            onChange={onChange}
            placeholder="203.0.113.10"
          />
          <BotShieldAsyncButton
            action={onAdd}
            successMessage={`${title} updated`}
            variant="primary"
            disabled={!value.trim()}
          >
            {addLabel}
          </BotShieldAsyncButton>
        </s-stack>
        {rows.length ? (
          <s-table variant="auto">
            <s-table-header-row>
              <s-table-header>IP address</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Action</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {rows.map((row) => {
                const ip = typeof row === "string" ? row : row.ip;
                return (
                  <s-table-row key={ip}>
                    <s-table-cell>{ip}</s-table-cell>
                    <s-table-cell>
                      <BotShieldStatusBadge
                        status={title.includes("Trusted") ? "active" : "blocked"}
                        label={title.includes("Trusted") ? "Trusted" : "Blocked"}
                      />
                    </s-table-cell>
                    <s-table-cell>
                      <BotShieldAsyncButton
                        action={() => onRemove(ip)}
                        successMessage="IP removed"
                        tone="critical"
                      >
                        Remove
                      </BotShieldAsyncButton>
                    </s-table-cell>
                  </s-table-row>
                );
              })}
            </s-table-body>
          </s-table>
        ) : (
          <BotShieldEmptyState
            title={emptyTitle}
            description="Add an IP address above when needed."
          />
        )}
      </s-stack>
    </BotShieldCard>
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
  const [blockIp, setBlockIp] = useState("");
  const [trustedIp, setTrustedIp] = useState("");
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
      title="Settings"
      subtitle="Manage notifications, reports, blocked visitors, and trusted visitors."
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
      <s-grid gridTemplateColumns="minmax(220px, 1fr) minmax(0, 2fr)" gap="large">
        <s-stack gap="small">
          <s-heading>Notifications</s-heading>
          <s-paragraph color="subdued">
            Choose where and when BotShield sends security alerts.
          </s-paragraph>
        </s-stack>
        <BotShieldCard badge={<BotShieldStatusBadge status={emailStatus.technicalStatus} />}>
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
            <s-grid
              gridTemplateColumns="repeat(auto-fit, minmax(180px, 1fr))"
              gap="base"
            >
              <Metric
                label="Last alert"
                value={model.lastAlertStatus || "Not sent"}
                detail={formatDate(model.lastAlertSentAt)}
                status={
                  model.lastAlertStatus === "sent"
                    ? "sent"
                    : model.lastAlertStatus || "pending"
                }
              />
              <Metric
                label="Last weekly report"
                value={model.lastWeeklyReportStatus || "Not sent"}
                detail={formatDate(model.lastWeeklyReportAt)}
                status={
                  model.lastWeeklyReportStatus === "sent"
                    ? "sent"
                    : model.lastWeeklyReportStatus || "pending"
                }
              />
            </s-grid>
            {model.lastAlertError || model.lastWeeklyReportError ? (
              <BotShieldBanner tone="critical" title="Most recent delivery failed">
                {model.lastAlertError || model.lastWeeklyReportError}
              </BotShieldBanner>
            ) : null}
          </s-stack>
        </BotShieldCard>

        <s-stack gap="small">
          <s-heading>Subscription</s-heading>
          <s-paragraph color="subdued">
            Review the Shopify-managed BotShield plan and billing status.
          </s-paragraph>
        </s-stack>
        <BotShieldCard>
          <StatusRow
            label={model.billingStatus?.planName || "BotShield Basic"}
            detail={`$${Number(model.billingStatus?.monthlyPrice || 14.99).toFixed(2)}/month · ${Number(model.billingStatus?.trialDays || 7)}-day trial`}
            status={
              getBillingStatusModel(model.billingStatus).technicalStatus
            }
            action={
              <BotShieldActionButton onClick={() => actions.setPage("billing")}>
                Manage subscription
              </BotShieldActionButton>
            }
          />
        </BotShieldCard>
      </s-grid>

      <IpList
        title="Blocked visitors"
        subtitle="Visitors manually or automatically excluded from the storefront."
        rows={model.blockedIPs}
        value={blockIp}
        onChange={setBlockIp}
        onAdd={async () => {
          await actions.addBlockedIp(blockIp);
          setBlockIp("");
        }}
        onRemove={actions.removeBlockedIp}
        addLabel="Block IP"
        emptyTitle="No blocked visitors"
      />
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
        addLabel="Trust IP"
        emptyTitle="No trusted visitors"
      />
      <BotShieldDangerZone
        title="Clear diagnostic data"
        description="Delete diagnostic and simulated events. Real storefront activity is preserved."
        action={
          <BotShieldAsyncButton
            action={actions.clearSimulationData}
            successMessage="Diagnostic data cleared"
            tone="critical"
          >
            Clear diagnostic data
          </BotShieldAsyncButton>
        }
      />
    </Screen>
  );
}

function BillingPage({ model, actions }) {
  const status = getBillingStatusModel(model.billingStatus);
  return (
    <Screen
      title="Subscription"
      subtitle="BotShield billing is managed securely through Shopify."
      actions={
        <BotShieldAsyncButton
          action={actions.refreshBilling}
          successMessage="Billing refreshed"
          icon="refresh"
        >
          Refresh
        </BotShieldAsyncButton>
      }
    >
      <BotShieldActionButton onClick={() => actions.setPage("policy")}>
        Back to settings
      </BotShieldActionButton>
      <BotShieldCard
        title={model.billingStatus?.planName || "BotShield Basic"}
        subtitle={`$${Number(model.billingStatus?.monthlyPrice || 14.99).toFixed(2)}/month after a ${Number(model.billingStatus?.trialDays || 7)}-day trial`}
        badge={<BotShieldStatusBadge status={status.technicalStatus} />}
      >
        <s-stack gap="large">
          <StatusRow
            label="Subscription status"
            detail={
              model.billingStatus?.subscription?.name || "No active subscription"
            }
            status={status.technicalStatus}
          />
          <StatusRow
            label="Billing enforcement"
            detail="Billing enforcement remains disabled until paid and reviewer plans are verified."
            status={
              model.billingStatus?.enforcementEnabled
                ? "active"
                : "enforcement_disabled"
            }
          />
          {model.billingStatus?.pricingUrl && !model.billingStatus?.active ? (
            <BotShieldActionButton
              variant="primary"
              href={model.billingStatus.pricingUrl}
              target="_top"
            >
              Choose plan
            </BotShieldActionButton>
          ) : null}
        </s-stack>
      </BotShieldCard>
    </Screen>
  );
}

function SetupPage({ model, actions }) {
  const complete = model.readinessItems.filter((item) => item.complete).length;
  return (
    <Screen
      title="Setup"
      subtitle="Complete installation and learn how BotShield protects the storefront."
    >
      <BotShieldCard>
        <s-grid
          gridTemplateColumns="repeat(auto-fit, minmax(180px, 1fr))"
          gap="base"
        >
          <Metric
            label="Setup progress"
            value={`${complete}/${model.readinessItems.length}`}
            detail="Verified automatically"
            status={
              complete === model.readinessItems.length
                ? "active"
                : "setup_required"
            }
          />
          <Metric
            label="Storefront"
            value={
              model.protectionStatus.themeEmbedDetected
                ? "Connected"
                : "Not connected"
            }
            detail={formatDate(
              model.protectionStatus.lastStorefrontDecisionAt,
              "No storefront event yet",
            )}
            status={
              model.protectionStatus.themeEmbedDetected
                ? "theme_embed_connected"
                : "theme_embed_missing"
            }
          />
          <Metric
            label="Protection"
            value={model.protectionPaused ? "Paused" : "Active"}
            detail={model.autoBlock ? "Auto Block enabled" : "Monitoring only"}
            status={model.protectionPaused ? "paused" : "active"}
          />
        </s-grid>
      </BotShieldCard>
      <SetupGuide model={model} actions={actions} />
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
        : model.page;

  return (
    <BotShieldAppFrame>
      {screen === "dashboard" ? (
        <OverviewPage model={model} actions={actions} />
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
      {screen === "billing" ? (
        <BillingPage model={model} actions={actions} />
      ) : null}
      {screen === "setup" ? <SetupPage model={model} actions={actions} /> : null}
    </BotShieldAppFrame>
  );
}
