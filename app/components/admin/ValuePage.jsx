/* eslint-disable react/prop-types */
import { useCallback, useEffect, useState } from "react";
import { formatHydrationStableNumber } from "../../lib/hydration-safe-format.js";
import { safeFetchJson } from "../../lib/safe-fetch.js";
import { formatValueV2Currency } from "../../lib/value-v2-calculations.js";
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

const VALUE_ASSUMPTIONS_MODAL_ID = "botshield-value-v2-assumptions-modal";

function formatCount(value) {
  return formatHydrationStableNumber(Number(value) || 0);
}

function formatFinancial(value, currency, configured) {
  if (!configured || value == null) return "—";
  return formatValueV2Currency(value, currency);
}

function formatRatio(value, configured) {
  if (!configured || value == null) return "—";
  return `${value}×`;
}

function hasTrendActivity(trend) {
  return trend.some(
    (bucket) =>
      bucket.blocked > 0 ||
      bucket.challenged > 0 ||
      (bucket.estimatedValueProtected || 0) > 0,
  );
}

function ValueTrendSection({ trend, currency, assumptionsConfigured }) {
  if (!hasTrendActivity(trend)) {
    const detected = trend.reduce(
      (sum, bucket) => sum + (bucket.detected || 0),
      0,
    );
    return (
      <div className="vv2-zero-state">
        <div>
          <h3>No protection interventions in this period</h3>
          <p>
            BotShield detected activity during this window, but none of it was
            blocked or challenged.
          </p>
          <p className="vv2-zero-state-note">
            Detected activity is not counted as stopped protection.
          </p>
        </div>
      </div>
    );
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
    <div className="vv2-chart-wrap">
      <div className="vv2-chart-legend" aria-label="Chart legend">
        <span>
          <i className="is-blocked" aria-hidden="true" />
          Blocked (observed)
        </span>
        <span>
          <i className="is-challenged" aria-hidden="true" />
          Challenged (observed)
        </span>
        {assumptionsConfigured ? (
          <span>
            <i className="is-estimated" aria-hidden="true" />
            Estimated protected value
          </span>
        ) : null}
      </div>
      <div
        className="vv2-chart"
        role="img"
        aria-label="Protection value over time chart"
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
              <p>Understand the measurable business impact of your BotShield protection.</p>
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
              <BotShieldPolarisButton variant="secondary" onClick={openAssumptions}>
                Edit assumptions
              </BotShieldPolarisButton>
              <button
                aria-label="Refresh Value dashboard"
                className={`vv2-refresh-btn${loading ? " is-spinning" : ""}`}
                disabled={loading}
                onClick={() => loadValue(range)}
                type="button"
              >
                ↻
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
            <>
              {payload.retentionMessage ? (
                <p className="vv2-retention-note">{payload.retentionMessage}</p>
              ) : null}

              <section aria-labelledby="vv2-executive-title" className="vv2-executive">
                <div className="vv2-executive-top">
                  <p className="vv2-executive-label" id="vv2-executive-title">
                    Estimated value protected
                  </p>
                  <div className="vv2-executive-value-row">
                    <p
                      className={`vv2-executive-value${configured ? "" : " is-unavailable"}`}
                      aria-live="polite"
                    >
                      {formatFinancial(
                        payload.economics.estimatedValueProtected,
                        currency,
                        configured,
                      )}
                    </p>
                    {configured ? (
                      <span className="vv2-estimated-tag">Estimated</span>
                    ) : null}
                  </div>
                  {!configured ? (
                    <>
                      <p className="vv2-executive-support">
                        Add your assumptions to estimate the financial impact of BotShield.
                      </p>
                      <BotShieldPolarisButton variant="primary" onClick={openAssumptions}>
                        Set assumptions
                      </BotShieldPolarisButton>
                    </>
                  ) : (
                    <p className="vv2-executive-support">
                      Based on observed BotShield protection activity and your configured
                      assumptions.
                    </p>
                  )}
                </div>
                <div className="vv2-executive-rail" aria-label="Executive summary metrics">
                  <div className="vv2-executive-metric">
                    <span className="vv2-metric-label">BotShield cost</span>
                    <span className="vv2-metric-value">
                      {formatValueV2Currency(payload.economics.allocatedPlanCost, currency)}
                    </span>
                  </div>
                  <div className="vv2-executive-metric">
                    <span className="vv2-metric-label">Blocked</span>
                    <span className="vv2-metric-value">
                      {formatCount(payload.activity.threatsBlocked)}
                    </span>
                  </div>
                  <div className="vv2-executive-metric">
                    <span className="vv2-metric-label">Challenged</span>
                    <span className="vv2-metric-value">
                      {formatCount(payload.activity.challengesIssued)}
                    </span>
                  </div>
                  <div className="vv2-executive-metric">
                    <span className="vv2-metric-label">Estimated net value</span>
                    <span className="vv2-metric-value">
                      {formatFinancial(
                        payload.economics.estimatedNetValue,
                        currency,
                        configured,
                      )}
                    </span>
                  </div>
                </div>
              </section>

              <section aria-labelledby="vv2-evidence-title" className="vv2-section">
                <div className="vv2-section-head">
                  <h2 id="vv2-evidence-title">Protection evidence</h2>
                  <p>What BotShield actually observed and acted on during this period.</p>
                </div>
                <div className="vv2-evidence-strip">
                  <div className="vv2-evidence-item is-detected">
                    <span className="vv2-metric-label">Detected</span>
                    <span className="vv2-metric-value">
                      {formatCount(payload.activity.threatsDetected)}
                    </span>
                  </div>
                  <div className="vv2-evidence-item is-blocked">
                    <span className="vv2-metric-label">Blocked</span>
                    <span className="vv2-metric-value">
                      {formatCount(payload.activity.threatsBlocked)}
                    </span>
                  </div>
                  <div className="vv2-evidence-item">
                    <span className="vv2-metric-label">Challenged</span>
                    <span className="vv2-metric-value">
                      {formatCount(payload.activity.challengesIssued)}
                    </span>
                  </div>
                  <div className="vv2-evidence-item">
                    <span className="vv2-metric-label">Interventions</span>
                    <span className="vv2-metric-value">
                      {formatCount(payload.activity.interventions)}
                    </span>
                  </div>
                </div>
                {payload.activity.threatsDetected > 0 ? (
                  <p className="vv2-evidence-note">
                    Detected activity represents observed suspicious activity. Only blocked
                    activity is counted as stopped.
                  </p>
                ) : null}
              </section>

              <section aria-labelledby="vv2-economics-title" className="vv2-section">
                <div className="vv2-section-head">
                  <h2 id="vv2-economics-title">Value economics</h2>
                </div>
                <div className="vv2-economics-flow">
                  <div className="vv2-flow-step">
                    <span className="vv2-metric-label">BotShield cost</span>
                    <span className="vv2-metric-value">
                      {formatValueV2Currency(payload.economics.allocatedPlanCost, currency)}
                    </span>
                  </div>
                  <span aria-hidden="true" className="vv2-flow-arrow">
                    →
                  </span>
                  <div className="vv2-flow-step">
                    <span className="vv2-metric-label">Estimated protected value</span>
                    <span className="vv2-metric-value">
                      {formatFinancial(
                        payload.economics.estimatedValueProtected,
                        currency,
                        configured,
                      )}
                    </span>
                  </div>
                  <span aria-hidden="true" className="vv2-flow-arrow">
                    →
                  </span>
                  <div className="vv2-flow-step">
                    <span className="vv2-metric-label">Estimated net value</span>
                    <span className="vv2-metric-value">
                      {formatFinancial(
                        payload.economics.estimatedNetValue,
                        currency,
                        configured,
                      )}
                    </span>
                  </div>
                </div>
                <div className="vv2-economics-meta">
                  <span>
                    Value / cost{" "}
                    <strong>
                      {formatRatio(payload.economics.valueToCostRatio, configured)}
                    </strong>
                  </span>
                  {!configured ? (
                    <BotShieldPolarisButton variant="tertiary" onClick={openAssumptions}>
                      Set assumptions
                    </BotShieldPolarisButton>
                  ) : null}
                </div>
              </section>

              <section aria-labelledby="vv2-trend-title" className="vv2-section">
                <div className="vv2-section-head">
                  <h2 id="vv2-trend-title">Protection value over time</h2>
                  <p>
                    {configured
                      ? "Observed interventions with estimated value overlay."
                      : "Observed BotShield interventions across the selected period."}
                  </p>
                </div>
                {hasTrendActivity(payload.trend) ? (
                  <ValueTrendSection
                    assumptionsConfigured={configured}
                    currency={currency}
                    trend={payload.trend}
                  />
                ) : (
                  <div className="vv2-zero-state">
                    <div>
                      <h3>No protection interventions in this period</h3>
                      {payload.activity.threatsDetected > 0 ? (
                        <>
                          <p>
                            BotShield detected {formatCount(payload.activity.threatsDetected)}{" "}
                            relevant events, but none were blocked or challenged.
                          </p>
                          <p className="vv2-zero-state-note">
                            Detected activity is not counted as stopped protection.
                          </p>
                        </>
                      ) : (
                        <p>
                          Protection value over time appears when BotShield records blocked
                          or challenged storefront activity.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </section>

              <section aria-labelledby="vv2-drivers-title" className="vv2-section">
                <div className="vv2-section-head">
                  <h2 id="vv2-drivers-title">Value drivers</h2>
                  <p>What produced the estimated value during this period.</p>
                </div>
                {payload.drivers.length ? (
                  <div className="vv2-drivers-list">
                    {payload.drivers.map((row) => (
                      <div className="vv2-driver-row" key={row.id}>
                        <strong>{row.label}</strong>
                        <span>
                          {formatCount(row.blocked)} blocked · {formatCount(row.challenged)}{" "}
                          challenged
                        </span>
                        <div className="vv2-driver-meta">
                          <strong>
                            {formatFinancial(
                              row.estimatedValueProtected,
                              currency,
                              configured,
                            )}
                          </strong>
                          <span>{formatCount(row.interventions)} interventions</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="vv2-zero-state">
                    <div>
                      <h3>No value drivers yet</h3>
                      <p>
                        Value drivers appear after BotShield records blocked or challenged
                        activity that can be categorized.
                      </p>
                    </div>
                  </div>
                )}
              </section>

              <section aria-labelledby="vv2-projection-title" className="vv2-section">
                <div className="vv2-section-head">
                  <h2 id="vv2-projection-title">Projected impact</h2>
                </div>
                {payload.projection.eligible ? (
                  <>
                    <div className="vv2-projection-grid">
                      {[payload.projection.next30Days, payload.projection.next12Months].map(
                        (window) => (
                          <article className="vv2-projection-card" key={window.label}>
                            <span className="vv2-projection-tag">Projection</span>
                            <h3>{window.label}</h3>
                            <div className="vv2-projection-metric">
                              <span>Projected stopped activity</span>
                              <strong>{formatCount(window.projectedStopped)}</strong>
                            </div>
                            <div className="vv2-projection-metric">
                              <span>Projected interventions</span>
                              <strong>{formatCount(window.projectedInterventions)}</strong>
                            </div>
                            <div className="vv2-projection-metric">
                              <span>Estimated protected value</span>
                              <strong>
                                {formatFinancial(
                                  window.estimatedValueProtected,
                                  currency,
                                  configured,
                                )}
                              </strong>
                            </div>
                          </article>
                        ),
                      )}
                    </div>
                    <p className="vv2-projection-basis">{payload.projection.basisLabel}</p>
                  </>
                ) : (
                  <div className="vv2-zero-state">
                    <div>
                      <h3>Not enough protection activity to project yet</h3>
                      <p>{payload.projection.reason}</p>
                    </div>
                  </div>
                )}
              </section>

              <section className="vv2-section vv2-section-disclosure">
                <details className="vv2-disclosure">
                  <summary>
                    <span className="vv2-disclosure-label">How Value is calculated</span>
                    <span aria-hidden="true" className="vv2-disclosure-chevron" />
                  </summary>
                  <div className="vv2-disclosure-body">
                    <div>
                      <h4>Observed metrics</h4>
                      <ul>
                        <li>Detected: medium- and high-risk storefront events</li>
                        <li>Blocked: requests BotShield blocked</li>
                        <li>Challenged: requests BotShield challenged</li>
                        <li>Interventions: blocked + challenged</li>
                      </ul>
                    </div>
                    <div>
                      <h4>Estimated metrics</h4>
                      <ul>
                        <li>
                          Estimated protected value combines blocked value, challenged value,
                          and optional staff time savings from your assumptions
                        </li>
                        <li>Estimated net value subtracts allocated BotShield plan cost</li>
                        <li>
                          Projections extrapolate from observed daily intervention rates when
                          enough history exists
                        </li>
                      </ul>
                    </div>
                    <p>
                      Financial estimates depend on merchant-configured assumptions and do not
                      represent independently verified savings.
                    </p>
                  </div>
                </details>
              </section>
            </>
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
