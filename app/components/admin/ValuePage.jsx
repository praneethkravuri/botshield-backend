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

function hasObservedChartActivity(trend) {
  return trend.some(
    (bucket) => bucket.blocked > 0 || bucket.challenged > 0 || bucket.interventions > 0,
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

function ValueObservedChart({ trend, observationLabel }) {
  const maximum = Math.max(1, ...trend.map((bucket) => bucket.interventions));

  return (
    <div className="vv2-observed-chart">
      <div className="vv2-chart-head">
        <div>
          <h3>Protection activity</h3>
          <p>{observationLabel}</p>
        </div>
        <div className="vv2-chart-legend" aria-label="Chart legend">
          <span>
            <i className="is-blocked" aria-hidden="true" />
            Blocked
          </span>
          <span>
            <i className="is-challenged" aria-hidden="true" />
            Challenged
          </span>
          <span>
            <i className="is-interventions" aria-hidden="true" />
            Interventions
          </span>
        </div>
      </div>
      <div className="vv2-chart" role="group" aria-label="Protection activity chart">
        <div className="vv2-chart-scale" aria-hidden="true">
          <span>{formatCount(maximum)}</span>
          <span>{formatCount(Math.round(maximum / 2))}</span>
          <span>0</span>
        </div>
        <div className="vv2-chart-bars">
          {trend.map((bucket) => {
            const blockedHeight = (bucket.blocked / maximum) * 100;
            const challengedHeight = (bucket.challenged / maximum) * 100;
            const stackHeight = Math.max(
              blockedHeight + challengedHeight,
              bucket.interventions > 0 ? 4 : 0,
            );

            return (
              <button
                type="button"
                className="vv2-chart-col"
                key={bucket.key}
                aria-label={`${bucket.label}: ${bucket.blocked} blocked, ${bucket.challenged} challenged, ${bucket.interventions} interventions`}
              >
                <div
                  className="vv2-chart-bar-stack"
                  style={{ height: `${stackHeight}%` }}
                >
                  {challengedHeight > 0 ? (
                    <span className="is-challenged" style={{ flex: challengedHeight }} />
                  ) : null}
                  {blockedHeight > 0 ? (
                    <span className="is-blocked" style={{ flex: blockedHeight }} />
                  ) : null}
                </div>
                <span className="vv2-chart-tooltip" role="tooltip">
                  <strong>{bucket.label}</strong>
                  <span>
                    Blocked <b>{formatCount(bucket.blocked)}</b>
                  </span>
                  <span>
                    Challenged <b>{formatCount(bucket.challenged)}</b>
                  </span>
                  <span>
                    Interventions <b>{formatCount(bucket.interventions)}</b>
                  </span>
                </span>
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
  );
}

function ValueObservedSection({ trend, activity, observationLabel }) {
  const hasActivity = hasObservedChartActivity(trend);

  return (
    <div className="vv2-analytics-layout">
      {hasActivity ? (
        <ValueObservedChart observationLabel={observationLabel} trend={trend} />
      ) : (
        <div className="vv2-chart-empty">
          <p>No intervention activity to chart for this period.</p>
        </div>
      )}
      <aside aria-label="Observed summary" className="vv2-observed-summary">
        <h3>Observed summary</h3>
        <dl>
          <div className="is-detected">
            <dt>Detected</dt>
            <dd>{formatCount(activity.threatsDetected)}</dd>
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
            <dt>Interventions</dt>
            <dd>{formatCount(activity.interventions)}</dd>
          </div>
        </dl>
        <p className="vv2-observed-note">
          Detected is observed activity. Interventions are blocked or challenged activity.
        </p>
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
        <div
          className="botshield-value-v2"
          data-value-layout="light-financial-dashboard"
          data-value-ui-revision="flagship-v5"
        >
          <header className="vv2-header">
            <div className="vv2-header-copy">
              <h1>Value</h1>
              <p>Understand the business impact of BotShield protection.</p>
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

              {activity.interventions === 0 ? (
                <div className="vv2-zero-band vv2-enter">
                  <p className="vv2-zero-band-message">
                    No protection interventions recorded in this period.
                  </p>
                  <div className="vv2-zero-band-grid">
                    <div className="vv2-zero-band-item">
                      <span className="vv2-metric-label">BotShield cost</span>
                      <strong>
                        {formatValueV2Currency(economics.allocatedPlanCost, currency)}
                      </strong>
                    </div>
                    {!configured ? (
                      <div className="vv2-zero-band-item">
                        <span className="vv2-metric-label">Financial estimates</span>
                        <button
                          className="vv2-btn vv2-btn-primary vv2-btn-compact"
                          onClick={openAssumptions}
                          type="button"
                        >
                          Set assumptions
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <section
                aria-labelledby="vv2-financial-title"
                className="vv2-viewport-split vv2-enter"
              >
                <div className="vv2-financial-panel">
                  <p className="vv2-metric-label" id="vv2-financial-title">
                    Estimated protected value
                  </p>
                  <p
                    className={`vv2-hero-amount vv2-metric-reveal${
                      configured &&
                      (economics.estimatedValueProtected || 0) > 0
                        ? " is-positive"
                        : ""
                    }`}
                    aria-live="polite"
                  >
                    {formatFinancial(
                      economics.estimatedValueProtected,
                      currency,
                      configured,
                    )}
                  </p>
                  <div className="vv2-financial-secondary">
                    <div className="vv2-financial-secondary-item">
                      <span className="vv2-metric-label">Estimated net value</span>
                      <strong className="vv2-metric-reveal">
                        {formatFinancial(economics.estimatedNetValue, currency, configured)}
                      </strong>
                    </div>
                    <div className="vv2-financial-secondary-item">
                      <span className="vv2-metric-label">Estimated ROI</span>
                      <strong className="vv2-metric-reveal">
                        {formatRoiPercent(estimatedRoi, configured)}
                      </strong>
                    </div>
                  </div>
                </div>
                <div aria-label="BotShield economics" className="vv2-economics-panel">
                  <p className="vv2-metric-label">BotShield cost</p>
                  <p className="vv2-cost-amount">
                    {formatValueV2Currency(economics.allocatedPlanCost, currency)}
                  </p>
                  <dl className="vv2-economics-stats">
                    <div>
                      <dt>Interventions</dt>
                      <dd>{formatCount(activity.interventions)}</dd>
                    </div>
                    <div>
                      <dt>Cost / intervention</dt>
                      <dd>
                        {formatPerUnit(costPerIntervention, currency, costPerIntervention != null)}
                      </dd>
                    </div>
                    <div>
                      <dt>Est. value / intervention</dt>
                      <dd>
                        {formatPerUnit(estValuePerIntervention, currency, configured)}
                      </dd>
                    </div>
                  </dl>
                </div>
              </section>

              <section
                aria-label="Business value equation"
                className="vv2-business-equation vv2-enter"
              >
                <div className="vv2-equation-track" key={`equation-${range}`}>
                  <div className="vv2-equation-cell vv2-eq-step-1">
                    <span className="vv2-metric-label">BotShield cost</span>
                    <strong>{formatValueV2Currency(economics.allocatedPlanCost, currency)}</strong>
                  </div>
                  <span aria-hidden="true" className="vv2-equation-op vv2-eq-step-2">
                    +
                  </span>
                  <div className="vv2-equation-cell vv2-eq-step-3">
                    <span className="vv2-metric-label">Protection activity</span>
                    <strong>
                      {formatCount(activity.interventions)}{" "}
                      {activity.interventions === 1 ? "intervention" : "interventions"}
                    </strong>
                  </div>
                  <span aria-hidden="true" className="vv2-equation-op vv2-equation-arrow vv2-eq-step-4">
                    →
                  </span>
                  <div className="vv2-equation-cell vv2-eq-step-5">
                    <span className="vv2-metric-label">Estimated protected value</span>
                    <strong>
                      {formatFinancial(
                        economics.estimatedValueProtected,
                        currency,
                        configured,
                      )}
                    </strong>
                  </div>
                  <span aria-hidden="true" className="vv2-equation-op vv2-equation-arrow vv2-eq-step-6">
                    →
                  </span>
                  <div className="vv2-equation-cell is-outcome vv2-eq-step-7">
                    <span className="vv2-metric-label">Estimated net value</span>
                    <strong>
                      {formatFinancial(economics.estimatedNetValue, currency, configured)}
                    </strong>
                  </div>
                </div>
              </section>

              <section
                aria-labelledby="vv2-observed-title"
                className="vv2-analytics-band vv2-enter"
              >
                <div className="vv2-band-head">
                  <h2 className="vv2-band-title" id="vv2-observed-title">
                    Observed protection
                  </h2>
                  <span className="vv2-window-label">{payload.observationLabel}</span>
                </div>
                <ValueObservedSection
                  activity={activity}
                  observationLabel={payload.observationLabel}
                  trend={payload.trend}
                />
              </section>

              <div className="vv2-lower-band vv2-enter">
                <section aria-labelledby="vv2-drivers-title" className="vv2-drivers-pane">
                  <div className="vv2-pane-head">
                    <h2 className="vv2-band-title" id="vv2-drivers-title">
                      Value drivers
                    </h2>
                    <p>Estimated contribution by intervention category.</p>
                  </div>
                  {payload.drivers.length ? (
                    <div className="vv2-drivers-grid">
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
                            <div className="vv2-driver-main">
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
                              <span className="vv2-driver-share">{share}%</span>
                            </div>
                            <strong className="vv2-driver-value">
                              {formatFinancial(
                                row.estimatedValueProtected,
                                currency,
                                configured,
                              )}
                            </strong>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <ValueInlineState icon="·" title="No value drivers yet">
                      <p>
                        Drivers appear after BotShield records intervention activity.
                      </p>
                    </ValueInlineState>
                  )}
                </section>

                <section aria-labelledby="vv2-outlook-title" className="vv2-outlook-pane">
                  <div className="vv2-pane-head">
                    <div>
                      <h2 className="vv2-band-title" id="vv2-outlook-title">
                        Projected outlook
                      </h2>
                      <p>Forward-looking estimates only.</p>
                    </div>
                    <span className="vv2-projected-badge">Projected</span>
                  </div>
                  {payload.projection.eligible ? (
                    <>
                      <div className="vv2-outlook-table">
                        <div className="vv2-outlook-table-head" aria-hidden="true">
                          <span>Window</span>
                          <span>Interventions</span>
                          <span>Protected</span>
                          <span>Net value</span>
                        </div>
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
                          <div className="vv2-outlook-row" key={label}>
                            <h3>{label}</h3>
                            <div data-label="Interventions">
                              <strong>{formatCount(window.projectedInterventions)}</strong>
                            </div>
                            <div data-label="Protected">
                              <strong>
                                {formatFinancial(
                                  window.estimatedValueProtected,
                                  currency,
                                  configured,
                                )}
                              </strong>
                            </div>
                            <div data-label="Net value">
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
                          </div>
                        ))}
                      </div>
                      {monthlyPrice != null ? (
                        <div className="vv2-outlook-cost">
                          <span>Current-plan 12-month cost</span>
                          <strong>{formatValueV2Currency(monthlyPrice * 12, currency)}</strong>
                        </div>
                      ) : null}
                      <p className="vv2-outlook-basis">
                        Based on eligible observed activity and configured assumptions.
                      </p>
                    </>
                  ) : (
                    <ValueInlineState icon="→" title="Building your outlook">
                      <p>
                        More intervention history is needed before BotShield can estimate
                        future value.
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
              </div>

              <section className="vv2-methodology vv2-enter">
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
                      <p>BotShield directly measured these protection events.</p>
                    </div>
                    <div>
                      <h4>Estimated</h4>
                      <p>
                        Financial values use observed activity plus the merchant&apos;s configured
                        assumptions.
                      </p>
                    </div>
                    <div>
                      <h4>Projected</h4>
                      <p>
                        Forward-looking values appear only when enough eligible intervention
                        history exists.
                      </p>
                    </div>
                    <div>
                      <h4>Data window</h4>
                      <p>
                        Raw BotEvent history is constrained by the existing 30-day retention
                        policy.
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
