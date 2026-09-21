/* eslint-disable react/prop-types */
import { useCallback, useEffect, useState } from "react";
import { formatHydrationStableNumber } from "../../lib/hydration-safe-format.js";
import { safeFetchJson } from "../../lib/safe-fetch.js";
import {
  allocatePlanCostForPeriod,
  formatValueV2Currency,
} from "../../lib/value-v2-calculations.js";
import "../../styles/value-v2-page.css";
import {
  BotShieldParagraph,
  BotShieldPolarisButton,
  BotShieldStack,
} from "../design-system/BotShieldHydrationPolaris.jsx";
import {
  BotShieldBanner,
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
];

const PROJECTION_MIN_OBSERVED_DAYS = 7;
const VALUE_ASSUMPTIONS_MODAL_ID = "botshield-value-v2-assumptions-modal";

function formatCount(value) {
  return formatHydrationStableNumber(Number(value) || 0);
}

function formatFinancial(value, currency, configured) {
  if (!configured || value == null) return "—";
  return formatValueV2Currency(value, currency);
}

function formatPerUnit(value, currency, available) {
  if (!available || value == null || !Number.isFinite(value)) return "—";
  return formatValueV2Currency(value, currency);
}

function formatRoiPercent(value, configured) {
  if (!configured || value == null || !Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 10) / 10;
  const prefix = rounded < 0 ? "−" : "";
  return `${prefix}${Math.abs(rounded)}%`;
}

function deriveCostPerIntervention(allocatedPlanCost, interventions) {
  if (interventions <= 0 || allocatedPlanCost == null) return null;
  return allocatedPlanCost / interventions;
}

function deriveEstValuePerIntervention(
  estimatedValueProtected,
  interventions,
  configured,
) {
  if (!configured || estimatedValueProtected == null || interventions <= 0) {
    return null;
  }
  return estimatedValueProtected / interventions;
}

function deriveEstimatedRoi(estimatedNetValue, allocatedPlanCost, configured) {
  if (!configured || estimatedNetValue == null || allocatedPlanCost <= 0) {
    return null;
  }
  return (estimatedNetValue / allocatedPlanCost) * 100;
}

function deriveProjectionNetValue(
  estimatedValueProtected,
  windowDays,
  monthlyPrice,
  configured,
) {
  if (!configured || estimatedValueProtected == null || monthlyPrice == null) {
    return null;
  }
  const windowCost =
    windowDays >= 365
      ? monthlyPrice * 12
      : allocatePlanCostForPeriod(monthlyPrice, windowDays);
  return Number((estimatedValueProtected - windowCost).toFixed(2));
}

function countObservedInterventionDays(trend) {
  return trend.filter((bucket) => bucket.interventions > 0).length;
}

function hasTrendActivity(trend) {
  return trend.some(
    (bucket) =>
      bucket.blocked > 0 ||
      bucket.challenged > 0 ||
      (bucket.estimatedValueProtected || 0) > 0,
  );
}

function ValueInlineState({ icon, title, children }) {
  return (
    <div className="vv2-inline-state">
      <span aria-hidden="true" className="vv2-inline-icon">
        {icon}
      </span>
      <div>
        <strong>{title}</strong>
        {children}
      </div>
    </div>
  );
}

function ValueTrendSection({
  trend,
  currency,
  assumptionsConfigured,
  activity,
  economics,
}) {
  if (!hasTrendActivity(trend)) {
    return null;
  }

  const maximum = Math.max(
    1,
    ...trend.map((bucket) =>
      Math.max(
        bucket.blocked,
        bucket.challenged,
        assumptionsConfigured ? bucket.estimatedValueProtected || 0 : 0,
      ),
    ),
  );

  return (
    <div className="vv2-impact-layout">
      <div className="vv2-chart-wrap">
        <div className="vv2-chart-legend" aria-label="Chart legend">
          <span>
            <i className="is-blocked" aria-hidden="true" />
            Blocked
          </span>
          <span>
            <i className="is-challenged" aria-hidden="true" />
            Challenged
          </span>
          {assumptionsConfigured ? (
            <span>
              <i className="is-estimated" aria-hidden="true" />
              Est. protected value
            </span>
          ) : null}
        </div>
        <div
          className="vv2-chart"
          role="img"
          aria-label="Protection impact chart"
        >
          <div className="vv2-chart-scale" aria-hidden="true">
            <span>
              {assumptionsConfigured
                ? formatValueV2Currency(maximum, currency)
                : formatCount(maximum)}
            </span>
            <span>
              {assumptionsConfigured
                ? formatValueV2Currency(maximum / 2, currency)
                : formatCount(Math.round(maximum / 2))}
            </span>
            <span>{assumptionsConfigured ? formatValueV2Currency(0, currency) : "0"}</span>
          </div>
          <div className="vv2-chart-bars">
            {trend.map((bucket) => {
              const blockedHeight = (bucket.blocked / maximum) * 100;
              const challengedHeight = (bucket.challenged / maximum) * 100;
              const estimatedHeight = assumptionsConfigured
                ? ((bucket.estimatedValueProtected || 0) / maximum) * 100
                : 0;
              const stackHeight = assumptionsConfigured
                ? Math.max(estimatedHeight, blockedHeight + challengedHeight)
                : Math.max(blockedHeight + challengedHeight, bucket.blocked > 0 ? 4 : 0);

              return (
                <button
                  type="button"
                  className="vv2-chart-col"
                  key={bucket.key}
                  aria-label={`${bucket.label}: ${bucket.blocked} blocked, ${bucket.challenged} challenged${
                    assumptionsConfigured
                      ? `, ${formatValueV2Currency(bucket.estimatedValueProtected || 0, currency)} estimated`
                      : ""
                  }`}
                  title={`${bucket.label}: ${bucket.blocked} blocked, ${bucket.challenged} challenged`}
                >
                  <div
                    className="vv2-chart-bar-stack"
                    style={{ height: `${stackHeight}%` }}
                  >
                    {assumptionsConfigured && estimatedHeight > 0 ? (
                      <span className="is-estimated" style={{ flex: estimatedHeight }} />
                    ) : null}
                    {challengedHeight > 0 ? (
                      <span className="is-challenged" style={{ flex: challengedHeight }} />
                    ) : null}
                    {blockedHeight > 0 ? (
                      <span className="is-blocked" style={{ flex: blockedHeight }} />
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="vv2-chart-axis" aria-hidden="true">
            <span>{trend[0]?.label}</span>
            <span>{trend[Math.floor((trend.length - 1) / 2)]?.label}</span>
            <span>{trend[trend.length - 1]?.label}</span>
          </div>
        </div>
      </div>
      <aside aria-label="Period summary" className="vv2-period-summary">
        <h3>Period summary</h3>
        <dl>
          <div>
            <dt>Interventions</dt>
            <dd>{formatCount(activity.interventions)}</dd>
          </div>
          <div>
            <dt>Blocked</dt>
            <dd>{formatCount(activity.threatsBlocked)}</dd>
          </div>
          <div>
            <dt>Challenged</dt>
            <dd>{formatCount(activity.challengesIssued)}</dd>
          </div>
          <div>
            <dt>Est. protected value</dt>
            <dd>
              {formatFinancial(
                economics.estimatedValueProtected,
                currency,
                assumptionsConfigured,
              )}
            </dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}

function AssumptionsModal({ draft, setDraft, onSave, onReset, saving }) {
  return (
    <BotShieldNativeModal id={VALUE_ASSUMPTIONS_MODAL_ID} heading="Value assumptions">
      <BotShieldStack gap="base">
        <BotShieldParagraph color="subdued">
          These assumptions are used only to estimate business value. They do
          not change how BotShield protects your store.
        </BotShieldParagraph>
        <div>
          <BotShieldTextField
            label="Estimated value per blocked event ($)"
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
          <p className="vv2-assumption-field-help">
            Dollar value you assign to each blocked harmful event.
          </p>
        </div>
        <div>
          <BotShieldTextField
            label="Estimated value per challenged event ($)"
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
          <p className="vv2-assumption-field-help">
            Estimated benefit when BotShield challenges suspicious visitors.
          </p>
        </div>
        <div>
          <BotShieldTextField
            label="Staff minutes saved per intervention"
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
          <p className="vv2-assumption-field-help">
            Time your team would spend handling each protection event manually.
          </p>
        </div>
        <div>
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
          <p className="vv2-assumption-field-help">
            Blended hourly cost used to estimate staff time savings.
          </p>
        </div>
        <BotShieldStack direction="inline" gap="base">
          <BotShieldPolarisButton variant="primary" disabled={saving} onClick={onSave}>
            Save assumptions
          </BotShieldPolarisButton>
          <BotShieldPolarisButton
            variant="secondary"
            disabled={saving}
            onClick={() => hideBotShieldModal(VALUE_ASSUMPTIONS_MODAL_ID)}
          >
            Cancel
          </BotShieldPolarisButton>
          <BotShieldPolarisButton variant="tertiary" disabled={saving} onClick={onReset}>
            Reset
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

  const currency = payload?.currency || "USD";
  const configured = payload?.assumptionsConfigured;
  const economics = payload?.economics;
  const activity = payload?.activity;
  const monthlyPrice = payload?.currentPlan?.monthlyPrice;
  const observedInterventionDays = payload
    ? countObservedInterventionDays(payload.trend)
    : 0;

  const costPerIntervention = economics
    ? deriveCostPerIntervention(economics.allocatedPlanCost, activity?.interventions || 0)
    : null;
  const estValuePerIntervention = economics
    ? deriveEstValuePerIntervention(
        economics.estimatedValueProtected,
        activity?.interventions || 0,
        configured,
      )
    : null;
  const estimatedRoi = economics
    ? deriveEstimatedRoi(
        economics.estimatedNetValue,
        economics.allocatedPlanCost,
        configured,
      )
    : null;

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
      toast.success("Value assumptions saved");
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
      toast.success("Value assumptions reset");
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
    <BotShieldNativePage heading="Value">
      <BotShieldPageShell className="botshield-value-v2-content">
        <div className="botshield-value-v2">
          <header className="vv2-header">
            <div className="vv2-header-copy">
              <h1>Value</h1>
              <p>See what BotShield protection is worth to your business.</p>
            </div>
            <div className="vv2-header-actions">
              <div className="vv2-period" aria-label="Observed period">
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
              <button className="vv2-btn vv2-btn-secondary" onClick={openAssumptions} type="button">
                Edit assumptions
              </button>
              <button
                aria-label="Refresh Value data"
                className={`vv2-btn vv2-btn-icon${loading ? " is-spinning" : ""}`}
                disabled={loading}
                onClick={() => loadValue(range)}
                title="Refresh Value data"
                type="button"
              >
                <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 16 16" width="16">
                  <path
                    d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M13.5 3.5V7H10"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                  />
                </svg>
              </button>
            </div>
          </header>

          {error ? (
            <BotShieldBanner tone="critical" title="Couldn't load Value dashboard">
              {error}
            </BotShieldBanner>
          ) : null}

          {loading && !payload ? (
            <BotShieldLoadingState label="Loading Value dashboard" />
          ) : null}

          {payload ? (
            <div
              className={`vv2-page-content${loading ? " is-loading" : ""}`}
              key={range}
            >
              {payload.retentionMessage ? (
                <p className="vv2-retention-note">{payload.retentionMessage}</p>
              ) : null}

              <section aria-labelledby="vv2-executive-title" className="vv2-executive vv2-enter">
                <div className="vv2-executive-head">
                  <span className="vv2-semantic-status">
                    <i aria-hidden="true" className="vv2-semantic-dot" />
                    Observed + estimated
                  </span>
                </div>
                <div className="vv2-executive-main">
                  <div className="vv2-executive-primary">
                    <p className="vv2-executive-label" id="vv2-executive-title">
                      Estimated protected value
                    </p>
                    <div className="vv2-executive-value-row">
                      <p
                        className={`vv2-executive-value vv2-hero-reveal${
                          configured &&
                          (economics.estimatedValueProtected || 0) > 0
                            ? " is-positive"
                            : configured
                              ? ""
                              : " is-unavailable"
                        }`}
                        aria-live="polite"
                      >
                        {formatFinancial(
                          economics.estimatedValueProtected,
                          currency,
                          configured,
                        )}
                      </p>
                    </div>
                    <p className="vv2-executive-support">
                      {configured
                        ? "Estimated from observed protection and your assumptions."
                        : "Set assumptions to estimate financial impact."}
                    </p>
                    {!configured ? (
                      <button
                        className="vv2-btn vv2-btn-primary vv2-btn-hero"
                        onClick={openAssumptions}
                        type="button"
                      >
                        Set assumptions
                      </button>
                    ) : null}
                  </div>
                  <div aria-hidden="true" className="vv2-executive-divider" />
                  <div className="vv2-executive-outcomes" aria-label="Executive outcomes">
                    <div className="vv2-outcome-metric">
                      <span className="vv2-metric-label">Estimated net value</span>
                      <span className="vv2-metric-value vv2-hero-reveal">
                        {formatFinancial(economics.estimatedNetValue, currency, configured)}
                      </span>
                    </div>
                    <div className="vv2-outcome-metric">
                      <span className="vv2-metric-label">Estimated ROI</span>
                      <span className="vv2-metric-value vv2-hero-reveal">
                        {formatRoiPercent(estimatedRoi, configured)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="vv2-executive-rail" aria-label="Executive summary metrics">
                  <div className="vv2-executive-metric">
                    <span className="vv2-metric-label">BotShield cost</span>
                    <span className="vv2-metric-value">
                      {formatValueV2Currency(economics.allocatedPlanCost, currency)}
                    </span>
                  </div>
                  <div className="vv2-executive-metric">
                    <span className="vv2-metric-label">Interventions</span>
                    <span className="vv2-metric-value">
                      {formatCount(activity.interventions)}
                    </span>
                  </div>
                  <div className="vv2-executive-metric">
                    <span className="vv2-metric-label">Cost / intervention</span>
                    <span className="vv2-metric-value">
                      {formatPerUnit(costPerIntervention, currency, costPerIntervention != null)}
                    </span>
                  </div>
                  <div className="vv2-executive-metric">
                    <span className="vv2-metric-label">Est. value / intervention</span>
                    <span className="vv2-metric-value">
                      {formatPerUnit(estValuePerIntervention, currency, configured)}
                    </span>
                  </div>
                </div>
              </section>

              <section aria-labelledby="vv2-flow-title" className="vv2-value-flow-section vv2-enter">
                <div className="vv2-flow-head">
                  <h2 className="vv2-flow-heading" id="vv2-flow-title">
                    Your BotShield value
                  </h2>
                  <p className="vv2-flow-helper">
                    From subscription cost to estimated business impact.
                  </p>
                </div>
                <div className="vv2-value-flow" key={`flow-${range}`}>
                  <div className="vv2-flow-node vv2-flow-step-1">
                    <span className="vv2-flow-marker" aria-hidden="true" />
                    <span className="vv2-flow-label">You paid</span>
                    <strong>{formatValueV2Currency(economics.allocatedPlanCost, currency)}</strong>
                  </div>
                  <span aria-hidden="true" className="vv2-flow-connector vv2-flow-step-2" />
                  <div className="vv2-flow-node vv2-flow-step-3">
                    <span className="vv2-flow-marker" aria-hidden="true" />
                    <span className="vv2-flow-label">BotShield intervened</span>
                    <strong>
                      {formatCount(activity.interventions)}{" "}
                      {activity.interventions === 1 ? "time" : "times"}
                    </strong>
                  </div>
                  <span aria-hidden="true" className="vv2-flow-connector vv2-flow-step-4" />
                  <div className="vv2-flow-node vv2-flow-step-5">
                    <span className="vv2-flow-marker" aria-hidden="true" />
                    <span className="vv2-flow-label">Est. protected</span>
                    <strong>
                      {formatFinancial(
                        economics.estimatedValueProtected,
                        currency,
                        configured,
                      )}
                    </strong>
                  </div>
                  <span aria-hidden="true" className="vv2-flow-connector vv2-flow-step-6" />
                  <div className="vv2-flow-node vv2-flow-step-7 is-outcome">
                    <span className="vv2-flow-marker" aria-hidden="true" />
                    <span className="vv2-flow-label">Est. net value</span>
                    <strong>
                      {formatFinancial(economics.estimatedNetValue, currency, configured)}
                    </strong>
                  </div>
                </div>
              </section>

              <section aria-labelledby="vv2-efficiency-title" className="vv2-section vv2-section-open vv2-enter">
                <div className="vv2-section-head vv2-section-head-compact">
                  <h2 id="vv2-efficiency-title">Protection efficiency</h2>
                  <p className="vv2-section-note">
                    Observed protection activity for this period.
                  </p>
                </div>
                <div className="vv2-efficiency-rail">
                  <div className="vv2-efficiency-item is-detected">
                    <span className="vv2-metric-label">Detected</span>
                    <span className="vv2-metric-value">{formatCount(activity.threatsDetected)}</span>
                  </div>
                  <div className="vv2-efficiency-item">
                    <span className="vv2-metric-label">Blocked</span>
                    <span className="vv2-metric-value">{formatCount(activity.threatsBlocked)}</span>
                  </div>
                  <div className="vv2-efficiency-item">
                    <span className="vv2-metric-label">Challenged</span>
                    <span className="vv2-metric-value">{formatCount(activity.challengesIssued)}</span>
                  </div>
                  <div className="vv2-efficiency-item">
                    <span className="vv2-metric-label">Interventions</span>
                    <span className="vv2-metric-value">{formatCount(activity.interventions)}</span>
                  </div>
                </div>
                <div className="vv2-efficiency-secondary">
                  <div>
                    <span className="vv2-metric-label">Cost / intervention</span>
                    <span className="vv2-metric-value-sm">
                      {formatPerUnit(costPerIntervention, currency, costPerIntervention != null)}
                    </span>
                  </div>
                  <div>
                    <span className="vv2-metric-label">Est. value / intervention</span>
                    <span className="vv2-metric-value-sm">
                      {formatPerUnit(estValuePerIntervention, currency, configured)}
                    </span>
                  </div>
                </div>
                <p className="vv2-efficiency-footnote">
                  Detected is observed activity. Interventions are blocked or challenged activity.
                </p>
              </section>

              <section aria-labelledby="vv2-trend-title" className="vv2-section vv2-section-open vv2-enter">
                <div className="vv2-section-head vv2-section-head-compact">
                  <h2 id="vv2-trend-title">Protection impact</h2>
                  <p className="vv2-section-note">Interventions across the selected period.</p>
                </div>
                {hasTrendActivity(payload.trend) ? (
                  <ValueTrendSection
                    activity={activity}
                    assumptionsConfigured={configured}
                    currency={currency}
                    economics={economics}
                    trend={payload.trend}
                  />
                ) : (
                  <>
                    <div aria-hidden="true" className="vv2-section-divider" />
                    <ValueInlineState icon="—" title="No interventions yet">
                      <p>
                        Impact history appears after BotShield blocks or challenges activity.
                      </p>
                    </ValueInlineState>
                  </>
                )}
              </section>

              <section aria-labelledby="vv2-drivers-title" className="vv2-section vv2-section-open vv2-enter">
                <div className="vv2-section-head vv2-section-head-compact">
                  <h2 id="vv2-drivers-title">Value drivers</h2>
                  <p className="vv2-section-note">
                    What contributed to estimated protection value.
                  </p>
                </div>
                {payload.drivers.length ? (
                  <div className="vv2-drivers-list">
                    {payload.drivers.map((row, index) => {
                      const share =
                        activity.interventions > 0
                          ? Math.round((row.interventions / activity.interventions) * 100)
                          : 0;
                      return (
                        <div
                          className={`vv2-driver-row${index === 0 ? " is-top" : ""}`}
                          key={row.id}
                        >
                          <div className="vv2-driver-label">
                            <strong>{row.label}</strong>
                            <span>{formatCount(row.interventions)}</span>
                          </div>
                          <div className="vv2-driver-bar-wrap">
                            <div aria-hidden="true" className="vv2-driver-track">
                              <span
                                className="vv2-driver-fill"
                                style={{ width: `${share}%` }}
                              />
                            </div>
                          </div>
                          <div className="vv2-driver-meta">
                            <span className="vv2-driver-share">{share}%</span>
                            <strong>
                              {formatFinancial(
                                row.estimatedValueProtected,
                                currency,
                                configured,
                              )}
                            </strong>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <ValueInlineState icon="·" title="No value drivers yet">
                    <p>
                      Drivers appear after blocked or challenged activity can be categorized.
                    </p>
                  </ValueInlineState>
                )}
              </section>

              <section
                aria-labelledby="vv2-outlook-title"
                className="vv2-section vv2-section-open vv2-outlook-section vv2-enter"
              >
                <div className="vv2-section-head vv2-section-head-compact">
                  <h2 id="vv2-outlook-title">Value outlook</h2>
                  <span className="vv2-projected-badge">Projected</span>
                </div>
                {payload.projection.eligible ? (
                  <>
                    <div className="vv2-outlook-grid">
                      {[
                        {
                          window: payload.projection.next30Days,
                          days: 30,
                          label: "Next 30 days",
                        },
                        {
                          window: payload.projection.next12Months,
                          days: 365,
                          label: "Next 12 months",
                        },
                      ].map(({ window, days, label }) => (
                        <article className="vv2-outlook-card" key={label}>
                          <span className="vv2-outlook-tag">Projected</span>
                          <h3>{label}</h3>
                          <div className="vv2-outlook-metric">
                            <span>Projected interventions</span>
                            <strong>{formatCount(window.projectedInterventions)}</strong>
                          </div>
                          <div className="vv2-outlook-metric">
                            <span>Estimated protected value</span>
                            <strong>
                              {formatFinancial(
                                window.estimatedValueProtected,
                                currency,
                                configured,
                              )}
                            </strong>
                          </div>
                          <div className="vv2-outlook-metric">
                            <span>Estimated net value</span>
                            <strong>
                              {formatFinancial(
                                deriveProjectionNetValue(
                                  window.estimatedValueProtected,
                                  days,
                                  monthlyPrice,
                                  configured,
                                ),
                                currency,
                                configured,
                              )}
                            </strong>
                          </div>
                          {days >= 365 && monthlyPrice != null ? (
                            <div className="vv2-outlook-metric">
                              <span>Est. BotShield cost</span>
                              <strong>
                                {formatValueV2Currency(monthlyPrice * 12, currency)}
                              </strong>
                            </div>
                          ) : null}
                        </article>
                      ))}
                    </div>
                    <p className="vv2-outlook-basis">{payload.projection.basisLabel}</p>
                  </>
                ) : (
                  <ValueInlineState icon="→" title="Building your outlook">
                    <p>
                      BotShield needs more intervention activity before it can estimate future
                      value.
                    </p>
                    {observedInterventionDays > 0 &&
                    observedInterventionDays < PROJECTION_MIN_OBSERVED_DAYS ? (
                      <p className="vv2-inline-context">
                        {observedInterventionDays} of {PROJECTION_MIN_OBSERVED_DAYS} observed
                        days with intervention activity.
                      </p>
                    ) : null}
                  </ValueInlineState>
                )}
              </section>

              <section className="vv2-section vv2-section-disclosure vv2-enter">
                <details className="vv2-disclosure">
                  <summary>
                    <span className="vv2-disclosure-label-wrap">
                      <span aria-hidden="true" className="vv2-disclosure-icon">
                        i
                      </span>
                      <span className="vv2-disclosure-label">How Value is calculated</span>
                    </span>
                    <span aria-hidden="true" className="vv2-disclosure-chevron" />
                  </summary>
                  <div className="vv2-disclosure-body">
                    <div>
                      <h4>Observed</h4>
                      <p>What BotShield directly measured during the selected period.</p>
                    </div>
                    <div>
                      <h4>Estimated</h4>
                      <p>
                        Financial values derived from merchant assumptions and observed
                        protection activity.
                      </p>
                    </div>
                    <div>
                      <h4>Projected</h4>
                      <p>
                        Forward estimates derived from eligible observed activity when enough
                        intervention history exists.
                      </p>
                    </div>
                    <div>
                      <h4>Retention</h4>
                      <p>
                        Observed Value history is constrained by the existing BotEvent retention
                        window.
                      </p>
                    </div>
                  </div>
                </details>
              </section>
            </div>
          ) : null}
        </div>
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
