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
  getEventSourceStatus,
} from "../../lib/ui-status";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const REASON_COPY = {
  RATE_PATTERN: "Elevated request volume",
  SUSPICIOUS_USER_AGENT: "Automated browser behavior",
  SENSITIVE_PATH: "Sensitive storefront path",
  BLOCKLIST_MATCH: "Blocklist match",
  WHITELIST_MATCH: "Trusted visitor",
  STRICT_MODE: "Strict Mode policy",
  VPN_DETECTED: "VPN or proxy traffic",
  DATACENTER_IP: "Datacenter network",
  HOSTING_PROVIDER: "Hosting provider traffic",
  HIGH_RISK_NETWORK: "High-risk network",
  ASN_MATCH: "Network ownership signal",
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
  return (
    <s-box background="base" border="base" borderRadius="large" padding="base">
      <s-stack gap="small">
        <s-text color="subdued">{label}</s-text>
        <s-heading>{value}</s-heading>
        <s-stack direction="inline" gap="small" alignItems="center">
          {status ? <BotShieldStatusBadge status={status} /> : null}
          <s-text color="subdued">{detail}</s-text>
        </s-stack>
      </s-stack>
    </s-box>
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
  const setupComplete = model.readinessItems.every((item) => item.complete);
  const latestEvents = model.storefrontScans.slice(0, 5);
  const protectionStatus = model.protectionPaused
    ? "paused"
    : model.protectionReady
      ? "active"
      : model.protectionStatus.themeEmbedDetected
        ? "monitoring_only"
        : "setup_required";

  return (
    <Screen
      title="Overview"
      subtitle="Storefront protection status and recent activity."
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

      {!setupComplete ? <SetupGuide model={model} actions={actions} compact /> : null}

      <s-grid
        gridTemplateColumns="repeat(auto-fit, minmax(180px, 1fr))"
        gap="base"
      >
        <Metric
          label="Requests analyzed"
          value={model.storefrontScans.length}
          detail="Real storefront events"
          status="real_storefront"
        />
        <Metric
          label="Allowed"
          value={model.allowedCount}
          detail="No intervention required"
          status="allowed"
        />
        <Metric
          label="Challenged"
          value={model.challengedCount}
          detail="Verification requested"
          status="challenged"
        />
        <Metric
          label="Blocked"
          value={model.blockedCount}
          detail="Requests stopped"
          status={model.blockedCount ? "blocked" : "active"}
        />
      </s-grid>

      <s-grid
        gridTemplateColumns="repeat(auto-fit, minmax(300px, 1fr))"
        gap="base"
      >
        <BotShieldCard
          title="Protection status"
          subtitle="Current storefront policy and connected services."
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
          </s-stack>
        </BotShieldCard>
      </s-grid>

      <BotShieldCard
        title="Recent activity"
        subtitle={`${model.simulatedScans.length} diagnostic and simulated events excluded`}
        actions={
          <BotShieldActionButton onClick={() => actions.setPage("incidents")}>
            View all activity
          </BotShieldActionButton>
        }
      >
        {latestEvents.length ? (
          <s-stack>
            {latestEvents.map((event) => (
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
  return (
    <Screen
      title="Setup"
      subtitle="Complete installation and learn how BotShield protects the storefront."
    >
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
