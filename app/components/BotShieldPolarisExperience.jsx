/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import {
  BotShieldActionButton,
  BotShieldAppFrame,
  BotShieldAsyncButton,
  BotShieldBanner,
  BotShieldCard,
  BotShieldChecklistItem,
  BotShieldCommandCard,
  BotShieldDangerZone,
  BotShieldEmptyState,
  BotShieldInlineHelp,
  BotShieldMetricCard,
  BotShieldOutcomeMetric,
  BotShieldPage,
  BotShieldSaveState,
  BotShieldSelect,
  BotShieldSignalCard,
  BotShieldStatusRow,
  BotShieldStatusBadge,
  BotShieldTextField,
  BotShieldToggle,
  useBotShieldToast,
} from "./design-system/BotShieldDesignSystem";
import { safeFetchJson } from "../lib/safe-fetch";
import {
  getBillingStatusModel,
  getEmailStatus,
  getEventSourceStatus,
  getUiStatus,
} from "../lib/ui-status";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatDate(value, fallback = "Not yet") {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString();
}

const REASON_LABELS = {
  RATE_PATTERN: "Elevated request volume detected",
  SUSPICIOUS_USER_AGENT: "Automated browser behavior detected",
  SENSITIVE_PATH: "Sensitive storefront path targeted",
  BLOCKLIST_MATCH: "Visitor matched your blocklist",
  WHITELIST_MATCH: "Visitor matched your trusted list",
  STRICT_MODE: "Strict Mode policy applied",
  VPN_DETECTED: "VPN or proxy traffic detected",
  DATACENTER_IP: "Datacenter network traffic detected",
  HOSTING_PROVIDER: "Known hosting provider traffic",
  HIGH_RISK_NETWORK: "High-risk network intelligence match",
  ASN_MATCH: "Network ownership signal detected",
  NO_SIGNIFICANT_RISK: "No suspicious behavior detected",
};

function formatReasons(reasons) {
  const list = Array.isArray(reasons)
    ? reasons
    : String(reasons || "")
        .split(",")
        .map((reason) => reason.trim())
        .filter(Boolean);
  if (!list.length) return "No elevated signal";
  return list
    .slice(0, 2)
    .map(
      (reason) =>
        REASON_LABELS[reason] ||
        reason
          .toLowerCase()
          .replaceAll("_", " ")
          .replace(/\b\w/g, (character) => character.toUpperCase()),
    )
    .join(", ");
}

function ShopifyTable({ headings, rows, loading, empty }) {
  if (!loading && rows.length === 0) return empty;
  return (
    <s-table loading={loading} variant="auto">
      <s-table-header-row>
        {headings.map((heading, index) => (
          <s-table-header
            key={heading}
            listSlot={index === 0 ? "primary" : index === 1 ? "secondary" : "labeled"}
          >
            {heading}
          </s-table-header>
        ))}
      </s-table-header-row>
      <s-table-body>
        {rows.map((cells) => (
          <s-table-row key={cells.key}>
            {cells.values.map((cell, index) => (
              <s-table-cell key={`${cells.key}-${index}`}>{cell}</s-table-cell>
            ))}
          </s-table-row>
        ))}
      </s-table-body>
    </s-table>
  );
}

function SetupBanner({ model, actions }) {
  if (!model.protectionStatus.themeEmbedDetected) {
    return (
      <BotShieldBanner
        tone="warning"
        title="Theme embed not connected"
        action={
          <BotShieldActionButton onClick={actions.openThemeEditor}>
            Open theme editor
          </BotShieldActionButton>
        }
      >
        Enable the BotShield theme app embed to activate storefront monitoring and
        automated response.
      </BotShieldBanner>
    );
  }
  if (!model.billingStatus?.active) {
    return (
      <BotShieldBanner
        tone="warning"
        title="Billing is not active"
        action={
          model.billingStatus?.pricingUrl ? (
            <BotShieldActionButton
              href={model.billingStatus.pricingUrl}
              target="_top"
            >
              Choose plan
            </BotShieldActionButton>
          ) : null
        }
      >
        BotShield remains in launch-safe monitoring mode until Shopify billing is
        configured and verified.
      </BotShieldBanner>
    );
  }
  if (!model.emailProviderConfigured) {
    return (
      <BotShieldBanner tone="warning" title="Email provider not configured">
        Verify botshieldapp.com in Resend and configure RESEND_API_KEY before
        enabling merchant alerts.
      </BotShieldBanner>
    );
  }
  if (model.protectionPaused) {
    return (
      <BotShieldBanner tone="warning" title="Protection is paused">
        BotShield is still recording storefront activity, but automated blocking is
        temporarily disabled.
      </BotShieldBanner>
    );
  }
  return (
    <BotShieldBanner tone="success" title="Storefront protection is active">
      The theme embed is connected and BotShield is evaluating real storefront
      traffic with the current policy.
    </BotShieldBanner>
  );
}

function DashboardPage({ model, actions }) {
  const protectionStatus = model.protectionPaused
    ? "paused"
    : model.protectionReady
      ? "active"
      : model.protectionStatus.themeEmbedDetected
        ? "monitoring_only"
        : "setup_required";
  const protectionTitle = model.protectionPaused
    ? "Protection is paused"
    : model.protectionReady
      ? "Your storefront is protected"
      : model.protectionStatus.themeEmbedDetected
        ? "Storefront monitoring is connected"
        : "Finish connecting your storefront";
  const protectionDescription = model.protectionPaused
    ? "BotShield is recording decisions but will not automatically block visitors until protection resumes."
    : model.protectionReady
      ? `BotShield is evaluating real storefront traffic with ${model.blockLevel.toLowerCase()} sensitivity${model.strictMode ? " and strict mode" : ""}.`
      : model.protectionStatus.themeEmbedDetected
        ? "Real traffic is being recorded. Turn on automated response when your policy is ready."
        : "Enable the theme app embed so BotShield can begin evaluating real storefront visits.";
  const primaryAction = !model.protectionStatus.themeEmbedDetected ? (
    <BotShieldActionButton variant="primary" onClick={actions.openThemeEditor}>
      Finish setup
    </BotShieldActionButton>
  ) : (
    <BotShieldActionButton variant="primary" onClick={() => actions.setPage("incidents")}>
      View incidents
    </BotShieldActionButton>
  );

  const recentRows = model.storefrontScans.slice(0, 8).map((event) => ({
    key: event.id,
    values: [
      formatDate(event.createdAt),
      <s-stack gap="small-200" key="visitor">
        <s-text type="strong">{event.ipAddress}</s-text>
        <s-text color="subdued">{event.pathVisited}</s-text>
      </s-stack>,
      <BotShieldStatusBadge key="decision" status={event.actionTaken} />,
      <BotShieldStatusBadge key="risk" status={event.threatLevel} />,
      <s-text key="reason" color="subdued">
        {formatReasons(event.reasonCodes || event.reasons)}
      </s-text>,
      <BotShieldStatusBadge
        key="source"
        status={getEventSourceStatus(event.source).technicalStatus}
      />,
    ],
  }));

  return (
    <BotShieldPage
      title="BotShield"
      subtitle="Monitor suspicious storefront traffic and respond to bot activity."
      badge={
        <BotShieldStatusBadge
          status={
            model.protectionReady
              ? "active"
              : model.protectionPaused
                ? "paused"
                : "setup_required"
          }
        />
      }
      secondaryActions={
        <BotShieldAsyncButton
          action={actions.refresh}
          successMessage="BotShield status refreshed"
          icon="refresh"
        >
          Refresh
        </BotShieldAsyncButton>
      }
      banner={<SetupBanner model={model} actions={actions} />}
    >
      <BotShieldCommandCard
        eyebrow="Protection overview"
        title={protectionTitle}
        description={protectionDescription}
        status={protectionStatus}
        primaryAction={primaryAction}
        secondaryAction={
          model.protectionStatus.themeEmbedDetected ? (
            <BotShieldActionButton onClick={() => actions.setPage("detection")}>
              Review policy
            </BotShieldActionButton>
          ) : null
        }
      >
        <s-grid
          gridTemplateColumns="repeat(auto-fit, minmax(150px, 1fr))"
          gap="base"
        >
          <s-stack gap="small-200">
            <s-text color="subdued">Real events</s-text>
            <s-heading>{model.storefrontScans.length}</s-heading>
          </s-stack>
          <s-stack gap="small-200">
            <s-text color="subdued">Threats stopped</s-text>
            <s-heading>{model.blockedCount + model.challengedCount}</s-heading>
          </s-stack>
          <s-stack gap="small-200">
            <s-text color="subdued">Security score</s-text>
            <s-heading>
              {model.securityPosture
                ? `${model.securityPosture.score.score}/100`
                : "Calculating"}
            </s-heading>
          </s-stack>
        </s-grid>
      </BotShieldCommandCard>

      <s-grid
        gridTemplateColumns="repeat(auto-fit, minmax(210px, 1fr))"
        gap="base"
      >
        <BotShieldSignalCard
          label="Storefront connection"
          value={
            model.protectionStatus.themeEmbedDetected ? "Connected" : "Not connected"
          }
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
        />
        <BotShieldSignalCard
          label="Automated response"
          value={model.autoBlock ? "Auto Block on" : "Monitoring only"}
          detail={`${model.blockLevel} sensitivity${model.strictMode ? " · Strict mode" : ""}`}
          status={model.autoBlock ? "active" : "monitoring_only"}
        />
        <BotShieldSignalCard
          label="Email alerts"
          value={model.emailAlerts ? "Alerts enabled" : "Alerts off"}
          detail={
            model.emailProviderConfigured
              ? model.alertEmail || "Recipient not set"
              : "Resend needs configuration"
          }
          status={
            model.emailProviderConfigured && model.emailAlerts
              ? "provider_connected"
              : "provider_not_configured"
          }
        />
        <BotShieldSignalCard
          label="Shopify billing"
          value={
            model.billingStatus?.active
              ? model.billingStatus.subscription?.name || "Plan active"
              : "Plan not active"
          }
          detail={
            model.billingStatus?.active
              ? "Subscription verified"
              : "Complete App Pricing setup"
          }
          status={model.billingStatus?.active ? "active" : "setup_required"}
        />
      </s-grid>

      <s-grid gridTemplateColumns="minmax(0, 2fr) minmax(280px, 1fr)" gap="base">
        <BotShieldCard
          title="Activity snapshot"
          subtitle="Verified storefront decisions only."
        >
          <s-grid
            gridTemplateColumns="repeat(auto-fit, minmax(145px, 1fr))"
            gap="base"
          >
            <BotShieldMetricCard label="Allowed" value={model.allowedCount} status="allowed" />
            <BotShieldMetricCard label="Challenged" value={model.challengedCount} status="challenged" />
            <BotShieldMetricCard label="Blocked" value={model.blockedCount} status="blocked" />
            <BotShieldMetricCard
              label="High risk"
              value={model.highRiskCount}
              status={model.highRiskCount ? "high" : "low"}
            />
          </s-grid>
        </BotShieldCard>
        <BotShieldCard
          title="Setup progress"
          subtitle={`${model.readinessItems.filter((item) => item.complete).length} of ${model.readinessItems.length} checks ready`}
          actions={
            <BotShieldActionButton onClick={() => actions.setPage("setup")}>
              View setup
            </BotShieldActionButton>
          }
        >
          <s-stack gap="small">
            {model.readinessItems.slice(0, 4).map((item) => (
              <s-stack
                key={item.label}
                direction="inline"
                gap="small"
                justifyContent="space-between"
                alignItems="center"
              >
                <s-text color={item.complete ? "subdued" : "base"}>{item.label}</s-text>
                <BotShieldStatusBadge
                  status={item.complete ? "active" : "setup_required"}
                  label={item.complete ? "Ready" : "Required"}
                />
              </s-stack>
            ))}
          </s-stack>
        </BotShieldCard>
      </s-grid>

      <BotShieldCard
        title="Recent storefront activity"
        subtitle={`${model.simulatedScans.length} diagnostic or simulated event${model.simulatedScans.length === 1 ? "" : "s"} excluded from these results.`}
        actions={
          <BotShieldActionButton onClick={() => actions.setPage("incidents")}>
            View all
          </BotShieldActionButton>
        }
      >
        <ShopifyTable
          headings={["Time", "Visitor and path", "Decision", "Risk", "Reason", "Source"]}
          rows={recentRows}
          empty={
            <BotShieldEmptyState
              title="No storefront events yet"
              description="Visit the storefront after enabling the theme app embed. Real activity will appear here."
              action={
                !model.protectionStatus.themeEmbedDetected ? (
                  <BotShieldActionButton onClick={actions.openThemeEditor}>
                    Open theme editor
                  </BotShieldActionButton>
                ) : null
              }
            />
          }
        />
      </BotShieldCard>

      <BotShieldCard
        title="Traffic locations"
        subtitle="Approximate city and country intelligence from verified storefront requests."
      >
        {model.trafficOrigins.length ? (
          <s-grid
            gridTemplateColumns="repeat(auto-fit, minmax(210px, 1fr))"
            gap="base"
          >
            {model.trafficOrigins.slice(0, 6).map((origin) => (
              <s-box
                key={origin.key}
                background="subdued"
                borderRadius="large"
                padding="base"
              >
                <s-stack gap="small">
                  <s-stack
                    direction="inline"
                    gap="small"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <s-text type="strong">
                      {[origin.city, origin.country].filter(Boolean).join(", ")}
                    </s-text>
                    <s-badge tone={origin.threatCount > 0 ? "warning" : "info"}>
                      {origin.count} request{origin.count === 1 ? "" : "s"}
                    </s-badge>
                  </s-stack>
                  <s-text color="subdued">
                    {origin.threatCount > 0
                      ? `${origin.threatCount} suspicious · ${origin.blocked} blocked`
                      : "No elevated signal observed"}
                  </s-text>
                </s-stack>
              </s-box>
            ))}
          </s-grid>
        ) : (
          <BotShieldEmptyState
            title="No location intelligence yet"
            description="City and country details appear after verified storefront requests are enriched."
          />
        )}
      </BotShieldCard>

      <BotShieldInlineHelp>
        BotShield uses a Shopify theme app embed and JavaScript-based storefront
        integration. It is not an edge WAF, and visitors who do not execute
        JavaScript may not be evaluated by the theme script.
      </BotShieldInlineHelp>
    </BotShieldPage>
  );
}

function PremiumSetupBanner({ model, actions }) {
  if (!model.protectionStatus.themeEmbedDetected) {
    return (
      <BotShieldBanner
        tone="warning"
        title="Theme App Embed Required"
        action={
          <s-button-group>
            <BotShieldActionButton variant="primary" onClick={actions.openThemeEditor}>
              Open Theme Editor
            </BotShieldActionButton>
            <BotShieldActionButton onClick={() => actions.setPage("setup")}>
              View Setup Guide
            </BotShieldActionButton>
          </s-button-group>
        }
      >
        BotShield cannot fully monitor storefront visitors until the BotShield
        theme app embed is enabled.
      </BotShieldBanner>
    );
  }
  if (model.protectionPaused) {
    return (
      <BotShieldBanner tone="warning" title="Automated protection is paused">
        Storefront activity is still recorded, but BotShield will not automatically
        block visitors until protection resumes.
      </BotShieldBanner>
    );
  }
  if (!model.billingStatus?.active) {
    return (
      <BotShieldBanner
        tone="info"
        title="Complete your Shopify subscription"
        action={
          <BotShieldActionButton onClick={() => actions.setPage("billing")}>
            Review billing
          </BotShieldActionButton>
        }
      >
        Protection is operating in launch-safe mode while Shopify billing is being
        configured.
      </BotShieldBanner>
    );
  }
  if (!model.emailProviderConfigured || !model.emailAlerts) {
    return (
      <BotShieldBanner
        tone="info"
        title="Finish configuring security notifications"
        action={
          <BotShieldActionButton onClick={() => actions.setPage("policy")}>
            Configure alerts
          </BotShieldActionButton>
        }
      >
        Connect email alerts so blocked and high-risk activity reaches the merchant
        immediately.
      </BotShieldBanner>
    );
  }
  return null;
}

function PremiumDashboardPage({ model, actions }) {
  const readinessComplete = model.readinessItems.filter(
    (item) => item.complete,
  ).length;
  const stoppedCount = model.blockedCount + model.challengedCount;
  const protectionStatus = model.protectionPaused
    ? "paused"
    : model.protectionReady
      ? "active"
      : "monitoring_only";

  return (
    <BotShieldPage
      title="Welcome to BotShield"
      subtitle="Storefront bot protection, monitoring, and incident response."
      secondaryActions={
        <s-button-group>
          <BotShieldActionButton onClick={() => actions.setPage("incidents")}>
            Visitor activity
          </BotShieldActionButton>
          <BotShieldAsyncButton
            action={actions.refresh}
            successMessage="BotShield refreshed"
            icon="refresh"
          >
            Refresh
          </BotShieldAsyncButton>
        </s-button-group>
      }
      banner={<PremiumSetupBanner model={model} actions={actions} />}
    >
      <s-box
        background="base"
        border="base"
        borderRadius="large"
        padding="large-500"
      >
        <s-stack gap="base">
          <s-badge tone="success">Storefront security</s-badge>
          <div
            style={{
              fontSize: "32px",
              lineHeight: "38px",
              fontWeight: 750,
              letterSpacing: "-0.035em",
            }}
          >
            BotShield: Fraud &amp; Bot Detector
          </div>
          <s-paragraph color="subdued">
            Detect suspicious visitors, stop automated abuse, and monitor your
            Shopify storefront from one place.
          </s-paragraph>
        </s-stack>
      </s-box>

      <BotShieldCard>
        <s-stack>
          <BotShieldStatusRow
            label="Enable app embed on theme"
            value={
              model.protectionStatus.themeEmbedDetected ? "Enabled" : "Disabled"
            }
            detail={
              model.protectionStatus.themeEmbedDetected
                ? "BotShield is connected to your active storefront theme."
                : "Required before storefront visitors can be monitored."
            }
            status={
              model.protectionStatus.themeEmbedDetected
                ? "theme_embed_connected"
                : "theme_embed_missing"
            }
            action={
              <BotShieldActionButton onClick={actions.openThemeEditor}>
                Open theme editor
              </BotShieldActionButton>
            }
          />
          <BotShieldStatusRow
            label="BotShield protection status"
            value={
              model.protectionPaused
                ? "Paused"
                : model.protectionReady
                  ? "On"
                  : "Monitoring"
            }
            detail={
              model.protectionPaused
                ? "Decisions are logged, but automated blocking is disabled."
                : `${model.blockLevel} sensitivity${model.strictMode ? " with Strict Mode" : ""}.`
            }
            status={protectionStatus}
            action={
              model.protectionPaused ? (
                <BotShieldAsyncButton
                  action={actions.resumeProtection}
                  successMessage="Protection resumed"
                >
                  Resume
                </BotShieldAsyncButton>
              ) : (
                <BotShieldActionButton onClick={() => actions.setPage("detection")}>
                  View settings
                </BotShieldActionButton>
              )
            }
          />
          <BotShieldStatusRow
            label="Store setup"
            value={`${readinessComplete}/${model.readinessItems.length}`}
            detail="Verified installation, connection, alerting, and billing checks."
            status={
              readinessComplete === model.readinessItems.length
                ? "active"
                : "setup_required"
            }
            action={
              <BotShieldActionButton onClick={() => actions.setPage("setup")}>
                View details
              </BotShieldActionButton>
            }
          />
        </s-stack>
      </BotShieldCard>

      <BotShieldCard
        title="Overview"
        subtitle="Tracked by BotShield · Real storefront activity only"
      >
        <s-grid
          gridTemplateColumns="repeat(auto-fit, minmax(300px, 1fr))"
          gap="base"
        >
          <s-stack gap="base">
            <s-box background="base" border="base" borderRadius="large" padding="base">
              <s-stack gap="large">
                <s-text color="subdued">Suspicious visitors detected</s-text>
                <div
                  style={{
                    fontSize: "36px",
                    lineHeight: "40px",
                    fontWeight: 700,
                    letterSpacing: "-0.03em",
                  }}
                >
                  {model.highRiskCount}
                </div>
                <s-stack direction="inline" justifyContent="space-between">
                  <s-text color="subdued">
                    {model.storefrontScans.length
                      ? `${Math.round((model.highRiskCount / model.storefrontScans.length) * 100)}% of analyzed traffic`
                      : "No real storefront traffic yet"}
                  </s-text>
                  <BotShieldActionButton onClick={() => actions.setPage("incidents")}>
                    View activity
                  </BotShieldActionButton>
                </s-stack>
              </s-stack>
            </s-box>
            <s-box background="base" border="base" borderRadius="large" padding="base">
              <s-stack gap="large">
                <s-text color="subdued">Threats stopped</s-text>
                <div
                  style={{
                    fontSize: "36px",
                    lineHeight: "40px",
                    fontWeight: 700,
                    letterSpacing: "-0.03em",
                  }}
                >
                  {stoppedCount}
                </div>
                <s-stack direction="inline" justifyContent="space-between">
                  <s-text color="subdued">
                    {model.blockedCount} blocked · {model.challengedCount} challenged
                  </s-text>
                  <BotShieldActionButton onClick={() => actions.setPage("incidents")}>
                    View incidents
                  </BotShieldActionButton>
                </s-stack>
              </s-stack>
            </s-box>
          </s-stack>

          <s-box background="base" border="base" borderRadius="large" padding="base">
            <s-stack gap="base">
              <s-heading>Bot protection</s-heading>
              <BotShieldStatusRow
                label="Storefront monitoring"
                value={
                  model.protectionStatus.themeEmbedDetected ? "On" : "Off"
                }
                detail="Receives real visitor decisions through the theme app embed."
                status={
                  model.protectionStatus.themeEmbedDetected
                    ? "active"
                    : "setup_required"
                }
              />
              <BotShieldStatusRow
                label="Auto Block"
                value={model.autoBlock ? "On" : "Off"}
                detail="Automatically responds when the risk threshold is reached."
                status={model.autoBlock ? "active" : "monitoring_only"}
              />
              <BotShieldStatusRow
                label="Strict Mode"
                value={model.strictMode ? "On" : "Off"}
                detail="Applies BotShield's strongest detection profile."
                status={model.strictMode ? "active" : "inactive"}
              />
              <BotShieldStatusRow
                label="Email alerts"
                value={
                  model.emailProviderConfigured && model.emailAlerts ? "On" : "Off"
                }
                detail="Sends blocked, challenged, and high-risk incident notices."
                status={
                  model.emailProviderConfigured && model.emailAlerts
                    ? "active"
                    : "setup_required"
                }
              />
              <BotShieldActionButton onClick={() => actions.setPage("detection")}>
                View protection settings
              </BotShieldActionButton>
            </s-stack>
          </s-box>
        </s-grid>
      </BotShieldCard>

      <BotShieldCard
        title="Recent storefront activity"
        subtitle="Latest verified decisions from the live storefront."
        actions={
          <BotShieldActionButton onClick={() => actions.setPage("incidents")}>
            View all
          </BotShieldActionButton>
        }
      >
        {model.storefrontScans.length ? (
          <s-stack>
            {model.storefrontScans.slice(0, 4).map((event) => (
              <s-box key={event.id} paddingBlock="base" borderBlockEnd="base">
                <s-stack
                  direction="inline"
                  gap="base"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <s-stack gap="small-200">
                    <s-text type="strong">{formatReasons(event.reasons)}</s-text>
                    <s-text color="subdued">
                      {event.ipAddress} · {event.pathVisited} ·{" "}
                      {formatDate(event.createdAt)}
                    </s-text>
                  </s-stack>
                  <s-stack direction="inline" gap="small">
                    <BotShieldStatusBadge status={event.threatLevel} />
                    <BotShieldStatusBadge status={event.actionTaken} />
                  </s-stack>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        ) : (
          <BotShieldEmptyState
            title="No storefront activity yet"
            description="Enable the theme app embed and visit the storefront to begin receiving real events."
            action={
              <BotShieldActionButton onClick={actions.openThemeEditor}>
                Open theme editor
              </BotShieldActionButton>
            }
          />
        )}
      </BotShieldCard>

      <s-grid
        gridTemplateColumns="repeat(auto-fit, minmax(240px, 1fr))"
        gap="base"
      >
        <BotShieldCard title="Contact support">
          <s-stack gap="base">
            <s-text color="subdued">
              Get help with setup, false positives, or storefront protection.
            </s-text>
            <BotShieldActionButton href="/support" target="_blank">
              Contact support
            </BotShieldActionButton>
          </s-stack>
        </BotShieldCard>
        <BotShieldCard title="Setup guide">
          <s-stack gap="base">
            <s-text color="subdued">
              Follow the verified setup checklist and connect every protection
              service.
            </s-text>
            <BotShieldActionButton onClick={() => actions.setPage("setup")}>
              View setup guide
            </BotShieldActionButton>
          </s-stack>
        </BotShieldCard>
        <BotShieldCard title="Run a diagnostic">
          <s-stack gap="base">
            <s-text color="subdued">
              Test BotShield without mixing diagnostic events into production
              metrics.
            </s-text>
            <BotShieldAsyncButton
              action={actions.runDiagnostic}
              successMessage="Diagnostic scan completed"
            >
              Run diagnostic
            </BotShieldAsyncButton>
          </s-stack>
        </BotShieldCard>
      </s-grid>

      <BotShieldInlineHelp>
        BotShield uses a Shopify theme app embed and JavaScript-based storefront
        integration. It is not an edge WAF, and visitors who do not execute
        JavaScript may not be evaluated by the theme script.
      </BotShieldInlineHelp>
    </BotShieldPage>
  );
}

function IncidentsPage({ model, actions }) {
  const blockedIncidents = model.incidents.filter(
    (incident) => incident.decision === "blocked",
  ).length;
  const challengedIncidents = model.incidents.filter(
    (incident) => incident.decision === "challenged",
  ).length;
  const highRiskIncidents = model.incidents.filter(
    (incident) => incident.threatLevel === "high",
  ).length;
  const rows = model.incidents.map((incident) => ({
    key: incident.id,
    values: [
      formatDate(incident.createdAt),
      <s-stack gap="small-200" key="visitor">
        <s-text type="strong">{incident.maskedIpAddress}</s-text>
        <s-text color="subdued">{incident.path}</s-text>
      </s-stack>,
      <BotShieldStatusBadge key="decision" status={incident.decision} />,
      <BotShieldStatusBadge key="risk" status={incident.threatLevel} />,
      <s-stack gap="small-200" key="signal">
        <s-text>{formatReasons(incident.reasonCodes || incident.reasons)}</s-text>
        <s-text color="subdued">
          {[incident.networkCity, incident.networkCountry]
            .filter(Boolean)
            .join(", ") ||
            "Location unavailable"}
        </s-text>
      </s-stack>,
      <BotShieldStatusBadge
        key="source"
        status={getEventSourceStatus(incident.source).technicalStatus}
      />,
      <s-stack direction="inline" gap="small" key="actions">
        {incident.decision === "blocked" ? (
          <>
            <BotShieldAsyncButton
              action={() => actions.recoverIncident(incident.id, "unblock")}
              successMessage="IP removed from blocklist"
            >
              Unblock
            </BotShieldAsyncButton>
            <BotShieldAsyncButton
              action={() => actions.recoverIncident(incident.id, "whitelist")}
              successMessage="IP added to trusted visitors"
            >
              Trust
            </BotShieldAsyncButton>
          </>
        ) : null}
      </s-stack>,
    ],
  }));

  return (
    <BotShieldPage
      title="Investigation Center"
      subtitle="Understand suspicious storefront activity and recover quickly from false positives."
      badge={<BotShieldStatusBadge status="real_storefront" />}
      secondaryActions={
        <BotShieldAsyncButton
          action={actions.refreshIncidents}
          successMessage="Incidents refreshed"
          icon="refresh"
        >
          Refresh
        </BotShieldAsyncButton>
      }
    >
      <BotShieldCard
        title="Incident overview"
        subtitle="Current filtered results, separated from diagnostic and simulated activity."
      >
        <s-grid
          gridTemplateColumns="repeat(auto-fit, minmax(170px, 1fr))"
          gap="base"
        >
          <BotShieldOutcomeMetric
            label="Real incidents"
            value={model.incidentCounts.real}
            detail="Verified storefront events"
            status="real_storefront"
          />
          <BotShieldOutcomeMetric
            label="Blocked"
            value={blockedIncidents}
            detail="Visitors stopped by active policy"
            status={blockedIncidents ? "blocked" : "active"}
          />
          <BotShieldOutcomeMetric
            label="Challenged"
            value={challengedIncidents}
            detail="Visitors asked to verify"
            status={challengedIncidents ? "challenged" : "active"}
          />
          <BotShieldOutcomeMetric
            label="High risk"
            value={highRiskIncidents}
            detail="Events requiring attention"
            status={highRiskIncidents ? "high" : "low"}
          />
        </s-grid>
      </BotShieldCard>

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
            placeholder="IP, path, location, or reason"
          />
        </s-grid>
      </BotShieldCard>

      <BotShieldCard
        title="Security activity"
        subtitle={`${model.incidentCounts.real} real events · ${model.incidentCounts.simulation} simulations. Technical detail stays available without overwhelming the overview.`}
      >
        <ShopifyTable
          loading={model.incidentLoading}
          headings={["Time", "Visitor", "Decision", "Risk", "Signal", "Source", "Actions"]}
          rows={rows}
          empty={
            <BotShieldEmptyState
              title="No incidents yet"
              description="BotShield will show suspicious storefront activity here after traffic is analyzed."
            />
          }
        />
      </BotShieldCard>
    </BotShieldPage>
  );
}

function DetectionPage({ model, actions }) {
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
      toast.success("Detection settings saved");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Couldn’t save detection settings";
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <BotShieldPage
      title="Threat Detection"
      subtitle="Control how BotShield identifies suspicious storefront visitors and automated abuse."
      badge={
        <BotShieldStatusBadge
          status={
            model.protectionPaused
              ? "paused"
              : model.protectionReady
                ? "active"
                : "monitoring_only"
          }
        />
      }
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

      <BotShieldCommandCard
        eyebrow="Active policy"
        title={`${draft.blockLevel} sensitivity${draft.strictMode ? " with Strict Mode" : ""}`}
        description={
          draft.autoBlock
            ? "BotShield can automatically respond when real storefront traffic crosses the active risk threshold."
            : "BotShield is evaluating and recording traffic without automatically blocking visitors."
        }
        status={
          model.protectionPaused
            ? "paused"
            : draft.autoBlock
              ? "active"
              : "monitoring_only"
        }
        primaryAction={
          dirty ? (
            <BotShieldActionButton variant="primary" loading={saving} onClick={save}>
              Save policy
            </BotShieldActionButton>
          ) : null
        }
      >
        <s-grid
          gridTemplateColumns="repeat(auto-fit, minmax(160px, 1fr))"
          gap="base"
        >
          <s-stack gap="small-200">
            <s-text color="subdued">Sensitivity</s-text>
            <s-text type="strong">{draft.blockLevel}</s-text>
          </s-stack>
          <s-stack gap="small-200">
            <s-text color="subdued">Automated response</s-text>
            <s-text type="strong">{draft.autoBlock ? "Enabled" : "Off"}</s-text>
          </s-stack>
          <s-stack gap="small-200">
            <s-text color="subdued">Strict Mode</s-text>
            <s-text type="strong">{draft.strictMode ? "Enabled" : "Off"}</s-text>
          </s-stack>
        </s-grid>
      </BotShieldCommandCard>

      <BotShieldCard
        title="Protection controls"
        subtitle="Pause only when investigating a false positive. Events continue to be recorded while paused."
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
          Pausing disables automated blocking but does not stop decision logging.
        </BotShieldInlineHelp>
      </BotShieldCard>

      <BotShieldCard
        title="Detection profile"
        subtitle="Higher sensitivity responds to more suspicious automation signals."
      >
        <s-stack gap="large">
          <BotShieldSelect
            label="Protection level"
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
            label="Strict mode"
            details="Uses the strongest rule profile, High sensitivity, and automated response."
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
          <BotShieldToggle
            label="Auto Block"
            details="Automatically block requests that exceed the active policy threshold."
            checked={draft.autoBlock}
            onChange={(autoBlock) =>
              setDraft((current) => ({ ...current, autoBlock }))
            }
          />
        </s-stack>
      </BotShieldCard>

      <BotShieldCard
        title="Network intelligence"
        subtitle="VPN, proxy, datacenter, hosting provider, and ASN signals influence real storefront risk scores."
        badge={<BotShieldStatusBadge status="active" label="Enabled" />}
      >
        <BotShieldInlineHelp>
          Network signals supplement BotShield’s rules. They do not identify a
          visitor’s exact physical location.
        </BotShieldInlineHelp>
      </BotShieldCard>

      <BotShieldCard
        title="Diagnostic tools"
        subtitle="Diagnostics are clearly separated from real storefront protection metrics."
        actions={
          <s-button-group>
            <BotShieldAsyncButton
              action={actions.runDiagnostic}
              successMessage="Diagnostic scan completed"
              variant="primary"
            >
              Run diagnostic scan
            </BotShieldAsyncButton>
            <BotShieldAsyncButton
              action={actions.runSimulation}
              successMessage="Simulation recorded"
            >
              Generate simulation
            </BotShieldAsyncButton>
          </s-button-group>
        }
      >
        <s-stack gap="small">
          <s-text type="strong">Latest diagnostic</s-text>
          <s-text color="subdued">{model.result}</s-text>
          <s-text color="subdued">Last run: {model.lastScanTime}</s-text>
        </s-stack>
      </BotShieldCard>
    </BotShieldPage>
  );
}

function PolicyPage({ model, actions }) {
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

  const dirty =
    draft.alertEmail !== model.alertEmail ||
    draft.emailAlerts !== model.emailAlerts ||
    draft.highRiskAlertsOnly !== model.highRiskAlertsOnly ||
    draft.weeklyReportsEnabled !== model.weeklyReportsEnabled;
  const emailError =
    draft.alertEmail && !EMAIL_PATTERN.test(draft.alertEmail)
      ? "Enter a valid email address"
      : "";
  const emailStatus = getEmailStatus({
    configured: model.emailProviderConfigured,
    lastStatus: model.lastAlertStatus,
  });

  const save = async () => {
    if ((draft.emailAlerts || draft.weeklyReportsEnabled) && !EMAIL_PATTERN.test(draft.alertEmail)) {
      setSaveError("Enter a valid alert email before saving.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      await actions.saveSettings(draft);
      toast.success("Policy settings saved");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Couldn’t save policy settings";
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const blockedRows = model.blockedIPs.map((row) => ({
    key: row.ip,
    values: [
      row.ip,
      <BotShieldStatusBadge key="status" status="blocked" />,
      row.time,
      <BotShieldAsyncButton
        key="remove"
        action={() => actions.removeBlockedIp(row.ip)}
        successMessage="IP removed from blocklist"
        tone="critical"
      >
        Remove
      </BotShieldAsyncButton>,
    ],
  }));
  const trustedRows = model.whitelist.map((ip) => ({
    key: ip,
    values: [
      ip,
      <BotShieldStatusBadge key="status" status="active" label="Trusted" />,
      <BotShieldAsyncButton
        key="remove"
        action={() => actions.removeTrustedIp(ip)}
        successMessage="IP removed from trusted visitors"
        tone="critical"
      >
        Remove
      </BotShieldAsyncButton>,
    ],
  }));

  return (
    <BotShieldPage
      title="Response Policy"
      subtitle="Choose how BotShield notifies you, responds to incidents, and handles trusted visitors."
      badge={<BotShieldStatusBadge status={emailStatus.technicalStatus} />}
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

      {!model.emailProviderConfigured ? (
        <BotShieldBanner tone="warning" title="Email provider not configured">
          Add RESEND_API_KEY in Render and verify botshieldapp.com in Resend before
          sending merchant alerts.
        </BotShieldBanner>
      ) : null}

      <BotShieldCommandCard
        eyebrow="Notification status"
        title={
          model.emailProviderConfigured
            ? draft.emailAlerts
              ? "Security alerts are enabled"
              : "Email delivery is connected"
            : "Connect Resend to activate alerts"
        }
        description={
          model.emailProviderConfigured
            ? draft.alertEmail
              ? `Security notices and reports are configured for ${draft.alertEmail}.`
              : "Add a recipient before enabling alerts or weekly reports."
            : "BotShield will keep recording incidents, but it cannot notify the merchant until the provider is configured."
        }
        status={emailStatus.technicalStatus}
        primaryAction={
          dirty ? (
            <BotShieldActionButton variant="primary" loading={saving} onClick={save}>
              Save notification policy
            </BotShieldActionButton>
          ) : null
        }
      >
        <s-grid
          gridTemplateColumns="repeat(auto-fit, minmax(170px, 1fr))"
          gap="base"
        >
          <s-stack gap="small-200">
            <s-text color="subdued">Provider</s-text>
            <s-text type="strong">
              {model.emailProviderConfigured ? "Resend connected" : "Not configured"}
            </s-text>
          </s-stack>
          <s-stack gap="small-200">
            <s-text color="subdued">Incident alerts</s-text>
            <s-text type="strong">{draft.emailAlerts ? "Enabled" : "Off"}</s-text>
          </s-stack>
          <s-stack gap="small-200">
            <s-text color="subdued">Weekly reports</s-text>
            <s-text type="strong">
              {draft.weeklyReportsEnabled ? "Enabled" : "Off"}
            </s-text>
          </s-stack>
          <s-stack gap="small-200">
            <s-text color="subdued">Last delivery</s-text>
            <s-text type="strong">
              {getUiStatus(model.lastAlertStatus || "pending").label}
            </s-text>
          </s-stack>
        </s-grid>
      </BotShieldCommandCard>

      <BotShieldCard
        title="Email alerts"
        subtitle="Send alerts when BotShield records blocked, challenged, or high-risk storefront activity."
        badge={<BotShieldStatusBadge status={emailStatus.technicalStatus} />}
      >
        <s-stack gap="large">
          <BotShieldTextField
            label="Alert email"
            value={draft.alertEmail}
            onChange={(alertEmail) =>
              setDraft((current) => ({ ...current, alertEmail }))
            }
            type="email"
            autocomplete="email"
            error={emailError}
            details="Security alerts and weekly reports are sent to this address."
          />
          <BotShieldToggle
            label="Email alerts"
            details="Notify the merchant about blocked, challenged, and high-risk events."
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
          <s-grid
            gridTemplateColumns="repeat(auto-fit, minmax(180px, 1fr))"
            gap="base"
          >
            <BotShieldMetricCard
              label="Last delivery"
              value={getUiStatus(model.lastAlertStatus || "pending").label}
              detail={formatDate(model.lastAlertSentAt)}
            />
            <BotShieldMetricCard
              label="Provider"
              value={model.emailProviderConfigured ? "Resend connected" : "Not configured"}
              status={model.emailProviderConfigured ? "active" : "setup_required"}
            />
          </s-grid>
          {model.lastAlertError ? (
            <BotShieldBanner tone="critical" title="Most recent delivery failed">
              {model.lastAlertError}
            </BotShieldBanner>
          ) : null}
          <s-button-group>
            <BotShieldAsyncButton
              action={async () => {
                await safeFetchJson("/api/alerts/test", { method: "POST" });
                await actions.refreshSettings();
              }}
              successMessage="Test email sent"
              errorMessage="Couldn’t send test email"
              variant="primary"
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
              errorMessage="Couldn’t send weekly report"
              disabled={
                dirty ||
                !draft.weeklyReportsEnabled ||
                !model.emailProviderConfigured ||
                !EMAIL_PATTERN.test(draft.alertEmail)
              }
            >
              Send report now
            </BotShieldAsyncButton>
          </s-button-group>
        </s-stack>
      </BotShieldCard>

      <BotShieldCard
        title="Weekly reports"
        subtitle="Send a recurring summary built only from real storefront events."
        badge={
          <BotShieldStatusBadge
            status={draft.weeklyReportsEnabled ? "active" : "inactive"}
          />
        }
      >
        <BotShieldToggle
          label="Weekly security reports"
          details={`Last report: ${formatDate(model.lastWeeklyReportAt)}`}
          checked={draft.weeklyReportsEnabled}
          disabled={!model.emailProviderConfigured}
          onChange={(weeklyReportsEnabled) =>
            setDraft((current) => ({ ...current, weeklyReportsEnabled }))
          }
        />
      </BotShieldCard>

      <BotShieldCard title="Blocked IPs" subtitle="Manually and automatically blocked visitors.">
        <s-stack gap="base">
          <s-stack direction="inline" gap="base" alignItems="end">
            <BotShieldTextField
              label="IP address"
              value={blockIp}
              onChange={setBlockIp}
              placeholder="203.0.113.10"
            />
            <BotShieldAsyncButton
              action={async () => {
                await actions.addBlockedIp(blockIp);
                setBlockIp("");
              }}
              successMessage="IP blocked"
              variant="primary"
              disabled={!blockIp.trim()}
            >
              Add IP
            </BotShieldAsyncButton>
          </s-stack>
          <ShopifyTable
            headings={["IP address", "Status", "Updated", "Action"]}
            rows={blockedRows}
            empty={
              <BotShieldEmptyState
                title="No blocked IPs"
                description="IPs blocked manually or automatically will appear here."
              />
            }
          />
        </s-stack>
      </BotShieldCard>

      <BotShieldCard
        title="Trusted IPs"
        subtitle="Trusted IPs are excluded from automated blocking."
      >
        <s-stack gap="base">
          <s-stack direction="inline" gap="base" alignItems="end">
            <BotShieldTextField
              label="IP address"
              value={trustedIp}
              onChange={setTrustedIp}
              placeholder="203.0.113.10"
            />
            <BotShieldAsyncButton
              action={async () => {
                await actions.addTrustedIp(trustedIp);
                setTrustedIp("");
              }}
              successMessage="IP added to trusted visitors"
              variant="primary"
              disabled={!trustedIp.trim()}
            >
              Add trusted IP
            </BotShieldAsyncButton>
          </s-stack>
          <ShopifyTable
            headings={["IP address", "Status", "Action"]}
            rows={trustedRows}
            empty={
              <BotShieldEmptyState
                title="No trusted IPs"
                description="Add trusted IPs to avoid accidental blocking."
              />
            }
          />
        </s-stack>
      </BotShieldCard>

      <BotShieldDangerZone
        title="Clear simulation data"
        description="Removes diagnostic and simulation events only. Real storefront events are preserved."
        action={
          <BotShieldAsyncButton
            action={actions.clearSimulationData}
            successMessage="Simulation data cleared"
            tone="critical"
          >
            Clear simulations
          </BotShieldAsyncButton>
        }
      />
    </BotShieldPage>
  );
}

function BillingPage({ model, actions }) {
  const status = getBillingStatusModel(model.billingStatus);
  return (
    <BotShieldPage
      title="Subscription"
      subtitle="Manage BotShield Basic securely through Shopify."
      badge={<BotShieldStatusBadge status={status.technicalStatus} />}
      secondaryActions={
        <BotShieldAsyncButton
          action={actions.refreshBilling}
          successMessage="Billing status refreshed"
          icon="refresh"
        >
          Refresh billing
        </BotShieldAsyncButton>
      }
    >
      <BotShieldCommandCard
        eyebrow="BotShield subscription"
        title={model.billingStatus?.planName || "BotShield Basic"}
        description={`$${Number(model.billingStatus?.monthlyPrice || 14.99).toFixed(2)} per month after a ${Number(model.billingStatus?.trialDays || 7)}-day trial. Managed securely through Shopify.`}
        status={status.technicalStatus}
        primaryAction={
          model.billingStatus?.pricingUrl && !model.billingStatus?.active ? (
            <BotShieldActionButton
              variant="primary"
              href={model.billingStatus.pricingUrl}
              target="_top"
            >
              Start plan
            </BotShieldActionButton>
          ) : null
        }
      >
        <s-stack gap="large">
          <s-grid
            gridTemplateColumns="repeat(auto-fit, minmax(180px, 1fr))"
            gap="base"
          >
            <BotShieldMetricCard
              label="Current plan"
              value={model.billingStatus?.subscription?.name || "No active plan"}
            />
            <BotShieldMetricCard
              label="Subscription"
              value={status.label}
              status={status.technicalStatus}
            />
            <BotShieldMetricCard
              label="Billing enforcement"
              value={model.billingStatus?.enforcementEnabled ? "Enabled" : "Disabled"}
              status={
                model.billingStatus?.enforcementEnabled
                  ? "active"
                  : "enforcement_disabled"
              }
            />
          </s-grid>
          {!model.billingStatus?.active ? (
            <BotShieldBanner tone="warning" title="Billing is not active">
              Choose BotShield Basic in Shopify App Pricing. Billing enforcement
              should remain disabled until the paid and reviewer plans are verified.
            </BotShieldBanner>
          ) : null}
        </s-stack>
      </BotShieldCommandCard>
    </BotShieldPage>
  );
}

function SetupPage({ model, actions }) {
  const actionForItem = (item) => {
    if (item.complete) return null;
    if (item.label.includes("Theme")) {
      return (
        <BotShieldActionButton onClick={actions.openThemeEditor}>
          Enable
        </BotShieldActionButton>
      );
    }
    if (item.label.includes("Email") || item.label.includes("Alert")) {
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
  const readyCount = model.readinessItems.filter((item) => item.complete).length;

  return (
    <BotShieldPage
      title="Setup & Support"
      subtitle="Finish connecting BotShield and understand exactly how storefront protection works."
    >
      <BotShieldCommandCard
        eyebrow="Launch readiness"
        title={
          readyCount === model.readinessItems.length
            ? "BotShield setup is complete"
            : `${model.readinessItems.length - readyCount} setup steps need attention`
        }
        description={`${readyCount} of ${model.readinessItems.length} checks are backed by verified production data.`}
        status={
          readyCount === model.readinessItems.length ? "active" : "setup_required"
        }
        primaryAction={
          !model.protectionStatus.themeEmbedDetected ? (
            <BotShieldActionButton variant="primary" onClick={actions.openThemeEditor}>
              Enable theme embed
            </BotShieldActionButton>
          ) : null
        }
      />
      <BotShieldCard
        title="Protection setup"
        subtitle="Complete these steps in order. BotShield verifies each one automatically."
      >
        <s-stack>
          {model.readinessItems.map((item, index) => (
            <BotShieldChecklistItem
              key={item.label}
              index={index + 1}
              label={item.label}
              detail={item.detail}
              complete={item.complete}
              action={actionForItem(item)}
            />
          ))}
        </s-stack>
      </BotShieldCard>
      <BotShieldCard title="Support and legal">
        <s-stack direction="inline" gap="base">
          <BotShieldActionButton href="/support" target="_blank">
            Support
          </BotShieldActionButton>
          <BotShieldActionButton href="/privacy" target="_blank">
            Privacy policy
          </BotShieldActionButton>
          <BotShieldActionButton href="/terms" target="_blank">
            Terms of service
          </BotShieldActionButton>
        </s-stack>
      </BotShieldCard>
      <BotShieldInlineHelp>
        BotShield provides storefront bot monitoring, challenge, and automated
        response through a theme app embed and app proxy. It does not provide
        edge-level or guaranteed server-side interception.
      </BotShieldInlineHelp>
    </BotShieldPage>
  );
}

export default function BotShieldPolarisExperience({ model, actions }) {
  const screen =
    model.page === "security"
      ? "detection"
      : model.page === "settings"
        ? "policy"
        : model.page;

  return (
    <BotShieldAppFrame>
      <s-box paddingBlockStart="base">
        {screen === "dashboard" ? (
          <PremiumDashboardPage model={model} actions={actions} />
        ) : null}
        {screen === "dashboard-legacy" ? (
          <DashboardPage model={model} actions={actions} />
        ) : null}
        {screen === "incidents" ? (
          <IncidentsPage model={model} actions={actions} />
        ) : null}
        {screen === "detection" ? (
          <DetectionPage model={model} actions={actions} />
        ) : null}
        {screen === "policy" ? <PolicyPage model={model} actions={actions} /> : null}
        {screen === "billing" ? <BillingPage model={model} actions={actions} /> : null}
        {screen === "setup" ? <SetupPage model={model} actions={actions} /> : null}
      </s-box>
    </BotShieldAppFrame>
  );
}
