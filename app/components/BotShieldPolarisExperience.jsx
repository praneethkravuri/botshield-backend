/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import {
  BotShieldActionButton,
  BotShieldAppFrame,
  BotShieldAsyncButton,
  BotShieldBanner,
  BotShieldCard,
  BotShieldDangerZone,
  BotShieldEmptyState,
  BotShieldInlineHelp,
  BotShieldMetricCard,
  BotShieldPage,
  BotShieldSaveState,
  BotShieldSelect,
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
      primaryAction={primaryAction}
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
      <s-grid
        gridTemplateColumns="repeat(auto-fit, minmax(190px, 1fr))"
        gap="base"
      >
        <BotShieldMetricCard
          label="Requests analyzed"
          value={model.storefrontScans.length}
          detail="Real storefront events"
          loading={model.syncing && model.storefrontScans.length === 0}
        />
        <BotShieldMetricCard
          label="Allowed"
          value={model.allowedCount}
          status="allowed"
        />
        <BotShieldMetricCard
          label="Challenged"
          value={model.challengedCount}
          status="challenged"
        />
        <BotShieldMetricCard
          label="Blocked"
          value={model.blockedCount}
          status="blocked"
        />
        <BotShieldMetricCard
          label="High-risk events"
          value={model.highRiskCount}
          status={model.highRiskCount ? "high" : "low"}
        />
        <BotShieldMetricCard
          label="Security score"
          value={
            model.securityPosture
              ? `${model.securityPosture.score.score}/100`
              : "Calculating"
          }
          detail={model.securityPosture?.score?.grade || "Verified setup score"}
        />
      </s-grid>

      <BotShieldCard
        title="Protection readiness"
        subtitle="Every status below is backed by production data."
      >
        <s-grid
          gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))"
          gap="base"
        >
          {model.readinessItems.map((item) => (
            <s-box
              key={item.label}
              background="subdued"
              borderRadius="large"
              padding="base"
            >
              <s-stack gap="small">
                <BotShieldStatusBadge
                  status={item.complete ? "active" : "setup_required"}
                  label={item.complete ? "Complete" : "Needs attention"}
                />
                <s-text type="strong">{item.label}</s-text>
                <s-text color="subdued">{item.detail}</s-text>
              </s-stack>
            </s-box>
          ))}
        </s-grid>
      </BotShieldCard>

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
          headings={["Time", "Visitor and path", "Decision", "Risk", "Source"]}
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

function IncidentsPage({ model, actions }) {
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
      title="Incidents"
      subtitle="Review suspicious storefront activity and take recovery actions."
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
        title="Security incident timeline"
        subtitle={`${model.incidentCounts.real} real events · ${model.incidentCounts.simulation} simulations`}
      >
        <ShopifyTable
          loading={model.incidentLoading}
          headings={["Time", "Visitor", "Decision", "Risk", "Source", "Actions"]}
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
      title="Detection settings"
      subtitle="Control how BotShield identifies suspicious storefront visitors."
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

      <BotShieldCard
        title="Protection mode"
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
        title="Detection sensitivity"
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
            details="Uses the strongest rule profile and enables automated response."
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
      title="Policy settings"
      subtitle="Manage alerts, reports, blocklists, and trusted visitors."
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
      title="Billing"
      subtitle="Manage your BotShield plan and trial."
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
      <BotShieldCard
        title={model.billingStatus?.planName || "BotShield Basic"}
        subtitle={`$${Number(model.billingStatus?.monthlyPrice || 14.99).toFixed(2)}/month · ${Number(model.billingStatus?.trialDays || 7)}-day trial`}
        badge={<BotShieldStatusBadge status={status.technicalStatus} />}
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
          {model.billingStatus?.pricingUrl ? (
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
    </BotShieldPage>
  );
}

function SetupPage({ model, actions }) {
  return (
    <BotShieldPage
      title="Setup and help"
      subtitle="Complete setup and understand what BotShield protects."
    >
      <BotShieldCard title="Protection setup">
        <s-stack gap="base">
          {model.readinessItems.map((item) => (
            <s-box key={item.label} background="subdued" borderRadius="large" padding="base">
              <s-stack
                direction="inline"
                gap="base"
                justifyContent="space-between"
                alignItems="center"
              >
                <s-stack gap="small-200">
                  <s-text type="strong">{item.label}</s-text>
                  <s-text color="subdued">{item.detail}</s-text>
                </s-stack>
                <BotShieldStatusBadge
                  status={item.complete ? "active" : "setup_required"}
                />
              </s-stack>
            </s-box>
          ))}
          {!model.protectionStatus.themeEmbedDetected ? (
            <BotShieldActionButton variant="primary" onClick={actions.openThemeEditor}>
              Open theme editor
            </BotShieldActionButton>
          ) : null}
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
