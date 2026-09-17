/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatHydrationStableNumber } from "../../lib/hydration-safe-format.js";
import { safeFetchJson } from "../../lib/safe-fetch.js";
import { formatCurrency } from "../../lib/value-calculations.js";
import {
  BotShieldParagraph,
  BotShieldPolarisButton,
  BotShieldStack,
  BotShieldText,
} from "../design-system/BotShieldHydrationPolaris.jsx";
import {
  BotShieldActionButton,
  BotShieldBanner,
  BotShieldCard,
  BotShieldEmptyState,
  BotShieldLoadingState,
  BotShieldNativeModal,
  BotShieldNativePage,
  BotShieldPageShell,
  BotShieldTextField,
  hideBotShieldModal,
  showBotShieldModal,
  useBotShieldToast,
} from "../design-system/BotShieldDesignSystem";

const RANGE_OPTIONS = [
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "12m", label: "12M" },
];

const VALUE_ASSUMPTIONS_MODAL_ID = "botshield-value-assumptions-modal";

function ValueMetricCard({ label, value, detail }) {
  return (
    <div className="botshield-v2-kpi-card">
      <span className="botshield-v2-kpi-label">{label}</span>
      <strong className="botshield-v2-kpi-value">{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

function ValueTrendChart({ trend, currency, assumptionsConfigured }) {
  const maxValue = Math.max(
    1,
    ...trend.map((bucket) =>
      Math.max(
        bucket.blocked,
        bucket.challenged,
        assumptionsConfigured ? bucket.estimatedValueProtected || 0 : 0,
      ),
    ),
  );

  if (!trend.length) {
    return (
      <BotShieldParagraph color="subdued">
        No protection activity recorded for this period.
      </BotShieldParagraph>
    );
  }

  return (
    <div className="botshield-v2-chart" role="list" aria-label="Protection value over time">
      {trend.map((bucket) => (
        <div
          className="botshield-v2-chart-column"
          key={bucket.key}
          role="listitem"
          tabIndex={0}
        >
          <div className="botshield-v2-chart-bar">
            <span
              className="is-blocked"
              style={{ height: `${Math.max(4, (bucket.blocked / maxValue) * 100)}%` }}
            />
          </div>
          <div className="botshield-v2-chart-tooltip">
            <strong>{bucket.label}</strong>
            <span>
              Blocked: <b>{bucket.blocked}</b>
            </span>
            <span>
              Challenges: <b>{bucket.challenged}</b>
            </span>
            <span>
              Detected: <b>{bucket.detected}</b>
            </span>
            {assumptionsConfigured ? (
              <span>
                Estimated value protected:{" "}
                <b>{formatCurrency(bucket.estimatedValueProtected || 0, currency)}</b>
              </span>
            ) : (
              <span>Configure assumptions to estimate value.</span>
            )}
          </div>
          <span className="botshield-v2-chart-label">{bucket.label}</span>
        </div>
      ))}
    </div>
  );
}

function AssumptionsModal({ draft, setDraft, onSave, onReset, saving }) {
  return (
    <BotShieldNativeModal id={VALUE_ASSUMPTIONS_MODAL_ID} heading="Savings assumptions">
      <BotShieldStack gap="base">
        <BotShieldParagraph color="subdued">
          Financial impact is estimated from BotShield protection activity and your
          configured assumptions. Actual savings may vary.
        </BotShieldParagraph>
        <BotShieldTextField
          label="Estimated value per blocked harmful event ($)"
          type="number"
          min="0"
          value={String(draft.estimatedValuePerBlockedEvent ?? 0)}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              estimatedValuePerBlockedEvent: event.target.value,
            }))
          }
        />
        <BotShieldTextField
          label="Estimated value per challenged harmful event ($)"
          type="number"
          min="0"
          value={String(draft.estimatedValuePerChallenge ?? 0)}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              estimatedValuePerChallenge: event.target.value,
            }))
          }
        />
        <BotShieldTextField
          label="Staff time saved per intervention (minutes)"
          type="number"
          min="0"
          value={String(draft.staffMinutesSavedPerIntervention ?? 0)}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              staffMinutesSavedPerIntervention: event.target.value,
            }))
          }
        />
        <BotShieldTextField
          label="Estimated staff hourly cost ($)"
          type="number"
          min="0"
          value={String(draft.staffHourlyCost ?? 0)}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              staffHourlyCost: event.target.value,
            }))
          }
        />
        <BotShieldStack direction="inline" gap="base">
          <BotShieldPolarisButton
            variant="primary"
            disabled={saving}
            onClick={onSave}
          >
            Save
          </BotShieldPolarisButton>
          <BotShieldPolarisButton
            variant="secondary"
            disabled={saving}
            onClick={() => hideBotShieldModal(VALUE_ASSUMPTIONS_MODAL_ID)}
          >
            Cancel
          </BotShieldPolarisButton>
          <BotShieldPolarisButton
            variant="tertiary"
            disabled={saving}
            onClick={onReset}
          >
            Reset to defaults
          </BotShieldPolarisButton>
        </BotShieldStack>
      </BotShieldStack>
    </BotShieldNativeModal>
  );
}

export default function ValuePage() {
  const toast = useBotShieldToast();
  const [range, setRange] = useState("30d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState(null);
  const [assumptionDraft, setAssumptionDraft] = useState(null);
  const [savingAssumptions, setSavingAssumptions] = useState(false);
  const [methodologyOpen, setMethodologyOpen] = useState(false);

  const loadValue = useCallback(async (nextRange = range) => {
    setLoading(true);
    setError("");
    try {
      const data = await safeFetchJson(`/api/value?range=${encodeURIComponent(nextRange)}`);
      if (!data?.ok || !data.value) {
        throw new Error(data?.error || "Couldn't load Value dashboard.");
      }
      setPayload(data.value);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Couldn't load Value dashboard.",
      );
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void loadValue(range);
  }, [loadValue, range]);

  const currency = payload?.currentPlan?.currency || "USD";
  const configured = payload?.economics?.assumptionsConfigured;
  const heroValue = useMemo(() => {
    if (!payload) return "—";
    if (!configured) return "Set assumptions";
    return formatCurrency(payload.economics.estimatedValueProtected, currency);
  }, [configured, currency, payload]);

  const openAssumptions = () => {
    setAssumptionDraft({
      estimatedValuePerBlockedEvent:
        payload?.assumptions?.estimatedValuePerBlockedEvent ?? 0,
      estimatedValuePerChallenge:
        payload?.assumptions?.estimatedValuePerChallenge ?? 0,
      staffMinutesSavedPerIntervention:
        payload?.assumptions?.staffMinutesSavedPerIntervention ?? 0,
      staffHourlyCost: payload?.assumptions?.staffHourlyCost ?? 0,
    });
    showBotShieldModal(VALUE_ASSUMPTIONS_MODAL_ID);
  };

  const saveAssumptions = async () => {
    setSavingAssumptions(true);
    try {
      const response = await safeFetchJson("/api/value", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimatedValuePerBlockedEvent: Number(
            assumptionDraft.estimatedValuePerBlockedEvent || 0,
          ),
          estimatedValuePerChallenge: Number(
            assumptionDraft.estimatedValuePerChallenge || 0,
          ),
          staffMinutesSavedPerIntervention: Number(
            assumptionDraft.staffMinutesSavedPerIntervention || 0,
          ),
          staffHourlyCost: Number(assumptionDraft.staffHourlyCost || 0),
        }),
      });
      if (!response?.ok) {
        throw new Error(response?.error || "Couldn't save assumptions.");
      }
      hideBotShieldModal(VALUE_ASSUMPTIONS_MODAL_ID);
      toast.success("Savings assumptions saved");
      await loadValue(range);
    } catch (saveError) {
      toast.error(
        saveError instanceof Error
          ? saveError.message
          : "Couldn't save assumptions.",
      );
    } finally {
      setSavingAssumptions(false);
    }
  };

  const resetAssumptions = async () => {
    setSavingAssumptions(true);
    try {
      const response = await safeFetchJson("/api/value", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: true }),
      });
      if (!response?.ok) {
        throw new Error(response?.error || "Couldn't reset assumptions.");
      }
      hideBotShieldModal(VALUE_ASSUMPTIONS_MODAL_ID);
      toast.success("Savings assumptions reset");
      await loadValue(range);
    } catch (resetError) {
      toast.error(
        resetError instanceof Error
          ? resetError.message
          : "Couldn't reset assumptions.",
      );
    } finally {
      setSavingAssumptions(false);
    }
  };

  return (
    <BotShieldNativePage
      heading="Value"
      secondaryActions={
        <BotShieldPolarisButton
          slot="secondary-actions"
          variant="secondary"
          onClick={openAssumptions}
        >
          Edit assumptions
        </BotShieldPolarisButton>
      }
    >
      <BotShieldPageShell className="botshield-value-content">
        <div className="botshield-page-heading">
          <div>
            <p className="botshield-page-subtitle">
              See the business impact of your BotShield protection.
            </p>
          </div>
        </div>

        <div className="botshield-analytics-controls" aria-label="Value period">
          <div className="botshield-analytics-period">
            {RANGE_OPTIONS.map((option) => (
              <button
                aria-pressed={range === option.id}
                className={range === option.id ? "is-active" : ""}
                key={option.id}
                onClick={() => setRange(option.id)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
          <BotShieldActionButton disabled={loading} onClick={() => loadValue(range)}>
            {loading ? "Refreshing…" : "Refresh"}
          </BotShieldActionButton>
        </div>

        {error ? (
          <BotShieldBanner tone="critical" title="Couldn't load Value dashboard">
            {error}
          </BotShieldBanner>
        ) : null}

        {loading && !payload ? (
          <BotShieldLoadingState label="Loading Value dashboard" />
        ) : null}

        {payload ? (
          <BotShieldStack gap="large">
            {payload.retentionMessage ? (
              <BotShieldBanner tone="info" title="Retention limit">
                {payload.retentionMessage}
              </BotShieldBanner>
            ) : null}

            <section className="botshield-v2-value" aria-labelledby="value-hero-title">
              <div className="botshield-v2-value-header">
                <div>
                  <div className="botshield-v2-eyebrow">{payload.historyMessage}</div>
                  <h2 id="value-hero-title">Estimated value protected</h2>
                  <p>
                    Based on your BotShield protection activity and savings assumptions.
                  </p>
                </div>
              </div>
              <div className="botshield-v2-value-content">
                <div className="botshield-v2-value-total">
                  <strong>{heroValue}</strong>
                  <span>
                    {configured
                      ? `${payload.assumptionStatus === "merchant_configured" ? "Merchant-configured assumptions" : "Assumptions incomplete"}`
                      : "Configure savings assumptions to estimate financial impact."}
                  </span>
                </div>
              </div>
            </section>

            {payload.activity.threatsDetected === 0 &&
            payload.activity.threatsStopped === 0 ? (
              <BotShieldEmptyState
                title="Your value story is just getting started"
                description="BotShield needs protection activity before it can calculate your business impact."
              />
            ) : null}

            <section className="botshield-v2-kpi-grid" aria-label="Value KPIs">
              <ValueMetricCard
                detail="Storefront events actually blocked"
                label="Threats stopped"
                value={formatHydrationStableNumber(payload.activity.threatsStopped)}
              />
              <ValueMetricCard
                detail={
                  payload.currentPlan.isEstimatedCost
                    ? "Estimated plan cost for selected period"
                    : "Current plan cost"
                }
                label="BotShield cost"
                value={formatCurrency(payload.economics.allocatedPlanCost, currency)}
              />
              <ValueMetricCard
                detail="BotShield cost divided by blocked events"
                label="Cost per stopped threat"
                value={
                  payload.economics.costPerStoppedThreat == null
                    ? "—"
                    : formatCurrency(payload.economics.costPerStoppedThreat, currency)
                }
              />
              <ValueMetricCard
                detail="Estimated protected value minus BotShield cost"
                label="Estimated net value"
                value={
                  configured
                    ? formatCurrency(payload.economics.estimatedNetValue, currency)
                    : "—"
                }
              />
            </section>

            <BotShieldCard title="Protection activity context">
              <div className="botshield-v2-kpi-grid">
                <ValueMetricCard
                  detail="Suspicious storefront events recorded"
                  label="Threats detected"
                  value={formatHydrationStableNumber(payload.activity.threatsDetected)}
                />
                <ValueMetricCard
                  detail="Verification challenges issued to visitors"
                  label="Challenges issued"
                  value={formatHydrationStableNumber(payload.activity.challengesIssued)}
                />
                <ValueMetricCard
                  detail="Blocked plus challenged events"
                  label="Protection interventions"
                  value={formatHydrationStableNumber(payload.activity.interventions)}
                />
              </div>
            </BotShieldCard>

            <BotShieldCard title="Protection value over time">
              <ValueTrendChart
                assumptionsConfigured={configured}
                currency={currency}
                trend={payload.trend}
              />
            </BotShieldCard>

            <BotShieldCard title="Where your value came from">
              {payload.categories.length ? (
                <div className="botshield-analytics-table-wrap">
                  <table className="botshield-analytics-table">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Interventions</th>
                        <th>Share</th>
                        <th>Estimated value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payload.categories.map((row) => (
                        <tr key={row.id}>
                          <th>{row.label}</th>
                          <td>{row.interventions}</td>
                          <td>
                            {row.shareOfInterventions == null
                              ? "—"
                              : `${row.shareOfInterventions}%`}
                          </td>
                          <td>
                            {row.estimatedValueProtected == null
                              ? "—"
                              : formatCurrency(row.estimatedValueProtected, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <BotShieldParagraph color="subdued">
                  No categorized protection activity recorded for this period.
                </BotShieldParagraph>
              )}
            </BotShieldCard>

            <BotShieldCard title="Your BotShield economics">
              <BotShieldStack gap="small-200">
                <BotShieldText>
                  Current plan:{" "}
                  {formatCurrency(payload.currentPlan.monthlyPrice, currency)}/month
                </BotShieldText>
                <BotShieldText>
                  Estimated plan cost for selected period:{" "}
                  {formatCurrency(payload.economics.allocatedPlanCost, currency)}
                </BotShieldText>
                <BotShieldText>
                  Estimated value protected:{" "}
                  {configured
                    ? formatCurrency(payload.economics.estimatedValueProtected, currency)
                    : "—"}
                </BotShieldText>
                <BotShieldText>
                  Estimated net value:{" "}
                  {configured
                    ? formatCurrency(payload.economics.estimatedNetValue, currency)
                    : "—"}
                </BotShieldText>
                <BotShieldText>
                  Estimated value-to-cost:{" "}
                  {payload.economics.valueToCostRatio == null
                    ? "—"
                    : `${payload.economics.valueToCostRatio}×`}
                </BotShieldText>
                <BotShieldText>
                  Cost per stopped threat:{" "}
                  {payload.economics.costPerStoppedThreat == null
                    ? "—"
                    : formatCurrency(payload.economics.costPerStoppedThreat, currency)}
                </BotShieldText>
              </BotShieldStack>
            </BotShieldCard>

            <BotShieldCard title="If your current protection rate continues">
              {payload.projection.available ? (
                <BotShieldStack gap="base">
                  <BotShieldParagraph color="subdued">
                    {payload.projection.basisLabel}
                  </BotShieldParagraph>
                  <BotShieldText>
                    Next 30 days — projected threats stopped:{" "}
                    {payload.projection.next30Days.threatsStopped}
                  </BotShieldText>
                  <BotShieldText>
                    Next 30 days — projected interventions:{" "}
                    {payload.projection.next30Days.interventions}
                  </BotShieldText>
                  <BotShieldText>
                    Next 30 days — projected estimated value protected:{" "}
                    {payload.projection.next30Days.estimatedValueProtected == null
                      ? "—"
                      : formatCurrency(
                          payload.projection.next30Days.estimatedValueProtected,
                          currency,
                        )}
                  </BotShieldText>
                  <BotShieldText>
                    Next 12 months — projected threats stopped:{" "}
                    {payload.projection.next12Months.threatsStopped}
                  </BotShieldText>
                  <BotShieldText>
                    Next 12 months — projected interventions:{" "}
                    {payload.projection.next12Months.interventions}
                  </BotShieldText>
                  <BotShieldText>
                    Next 12 months — projected estimated value protected:{" "}
                    {payload.projection.next12Months.estimatedValueProtected == null
                      ? "—"
                      : formatCurrency(
                          payload.projection.next12Months.estimatedValueProtected,
                          currency,
                        )}
                  </BotShieldText>
                </BotShieldStack>
              ) : (
                <BotShieldParagraph color="subdued">
                  {payload.projection.reason}
                </BotShieldParagraph>
              )}
            </BotShieldCard>

            <BotShieldCard title="How calculations work">
              <button
                aria-expanded={methodologyOpen}
                className="botshield-analytics-clear"
                onClick={() => setMethodologyOpen((open) => !open)}
                type="button"
              >
                {methodologyOpen ? "Hide details" : "Show details"}
              </button>
              {methodologyOpen ? (
                <BotShieldStack gap="small-200">
                  <BotShieldText>
                    <strong>Observed BotShield data</strong>
                  </BotShieldText>
                  <BotShieldParagraph color="subdued">
                    Blocked events, challenged events, selected period, and current
                    plan cost come from BotShield storefront security activity and
                    billing configuration.
                  </BotShieldParagraph>
                  <BotShieldText>
                    <strong>Estimates</strong>
                  </BotShieldText>
                  <BotShieldParagraph color="subdued">
                    Estimated value protected, estimated net value, and projections
                    are calculated from your configured assumptions. Financial impact
                    is estimated from BotShield protection activity and your savings
                    assumptions. Actual savings may vary.
                  </BotShieldParagraph>
                </BotShieldStack>
              ) : null}
            </BotShieldCard>

            <BotShieldCard title="Why BotShield">
              <BotShieldStack gap="small-200">
                <BotShieldText>
                  <strong>Shopify-focused</strong> — Built around Shopify storefront
                  protection and merchant workflows.
                </BotShieldText>
                <BotShieldText>
                  <strong>Transparent impact</strong> — See protection activity
                  alongside understandable business-value estimates.
                </BotShieldText>
                <BotShieldText>
                  <strong>Merchant control</strong> — Manage protection rules,
                  blocked visitors, and trusted visitors directly.
                </BotShieldText>
                <BotShieldText>
                  <strong>Simple protection economics</strong> — Understand what
                  BotShield costs relative to observed protection activity.
                </BotShieldText>
              </BotShieldStack>
            </BotShieldCard>
          </BotShieldStack>
        ) : null}
      </BotShieldPageShell>

      {assumptionDraft ? (
        <AssumptionsModal
          draft={assumptionDraft}
          onReset={() => void resetAssumptions()}
          onSave={() => void saveAssumptions()}
          saving={savingAssumptions}
          setDraft={setAssumptionDraft}
        />
      ) : null}
    </BotShieldNativePage>
  );
}
