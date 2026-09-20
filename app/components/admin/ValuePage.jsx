/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatHydrationStableNumber } from "../../lib/hydration-safe-format.js";
import { safeFetchJson } from "../../lib/safe-fetch.js";
import { formatCurrency } from "../../lib/value-calculations.js";
import "../../styles/value-page.css";
import {
  BotShieldIcon,
  BotShieldParagraph,
  BotShieldPolarisButton,
  BotShieldStack,
} from "../design-system/BotShieldHydrationPolaris.jsx";
import {
  BotShieldActionButton,
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
  { id: "90d", label: "90D" },
  { id: "12m", label: "12M" },
];

const VALUE_ASSUMPTIONS_MODAL_ID = "botshield-value-assumptions-modal";

const VALUE_ICONS = {
  shield: "shield-check-mark",
  cost: "credit-card",
  trend: "chart-line",
  settings: "settings",
  info: "info",
  refresh: "refresh",
  shop: "store",
  lock: "lock",
  person: "person",
  globe: "globe-lines",
  activity: "chart-line",
  block: "disabled",
};

function ValueIcon({ name, centered = false }) {
  return (
    <span
      className="bv-icon"
      aria-hidden="true"
      style={centered ? { display: "grid", placeItems: "center" } : undefined}
    >
      <BotShieldIcon
        type={VALUE_ICONS[name] || VALUE_ICONS.shield}
        size="small"
        color="subdued"
        style={centered ? { display: "block", margin: "auto" } : undefined}
      />
    </span>
  );
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useAnimatedNumber(target, { duration = 580, enabled = true } = {}) {
  const [display, setDisplay] = useState(enabled && !prefersReducedMotion() ? 0 : target);
  const frameRef = useRef(null);

  useEffect(() => {
    if (!enabled || prefersReducedMotion()) {
      setDisplay(target);
      return undefined;
    }

    const from = display;
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(from + (target - from) * eased);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, enabled, duration]);

  return display;
}

function AnimatedCount({ value, enabled = true }) {
  const numeric = Number(value);
  const safe = Number.isFinite(numeric) ? numeric : 0;
  const animated = useAnimatedNumber(safe, { enabled });
  return formatHydrationStableNumber(Math.round(animated));
}

function AnimatedCurrency({ amount, currency, enabled = true }) {
  const numeric = Number(amount);
  const safe = Number.isFinite(numeric) ? numeric : 0;
  const animated = useAnimatedNumber(safe, { enabled });
  return formatCurrency(animated, currency);
}

function ValueProtectionChart({ trend, currency, assumptionsConfigured }) {
  const chartMaximum = useMemo(() => {
    const values = trend.map((bucket) =>
      Math.max(
        bucket.blocked,
        assumptionsConfigured ? bucket.estimatedValueProtected || 0 : 0,
      ),
    );
    return Math.max(1, ...values);
  }, [assumptionsConfigured, trend]);

  const activeDays = trend.filter(
    (bucket) =>
      bucket.blocked > 0 ||
      bucket.challenged > 0 ||
      (assumptionsConfigured && (bucket.estimatedValueProtected || 0) > 0),
  ).length;

  if (!trend.length) {
    return (
      <div className="bv-chart-empty">
        <div className="bv-chart-empty-icon">
          <ValueIcon name="trend" centered />
        </div>
        <h3>No protection activity yet</h3>
        <p>
          BotShield will chart protection value over time as storefront security
          activity is recorded.
        </p>
      </div>
    );
  }

  return (
    <div className="bv-chart-wrap">
      <div className="bv-chart-legend" aria-label="Chart legend">
        {assumptionsConfigured ? (
          <span>
            <i className="is-value" aria-hidden="true" />
            Estimated value protected
          </span>
        ) : null}
        <span>
          <i className="is-blocked" aria-hidden="true" />
          Threats stopped
        </span>
      </div>
      <div
        className="bv-chart"
        role="img"
        aria-label={`Protection value chart with ${activeDays} active periods`}
        data-density={activeDays <= 3 ? "sparse" : activeDays <= 12 ? "medium" : "dense"}
      >
        <div className="bv-chart-scale" aria-hidden="true">
          <span>
            {assumptionsConfigured
              ? formatCurrency(chartMaximum, currency)
              : formatHydrationStableNumber(chartMaximum)}
          </span>
          <span>
            {assumptionsConfigured
              ? formatCurrency(chartMaximum / 2, currency)
              : formatHydrationStableNumber(Math.round(chartMaximum / 2))}
          </span>
          <span>{assumptionsConfigured ? formatCurrency(0, currency) : "0"}</span>
        </div>
        <div className="bv-chart-bars">
          {trend.map((bucket) => {
            const valueHeight = assumptionsConfigured
              ? ((bucket.estimatedValueProtected || 0) / chartMaximum) * 100
              : 0;
            const blockedHeight = (bucket.blocked / chartMaximum) * 100;
            const primaryHeight = assumptionsConfigured
              ? Math.max(valueHeight, blockedHeight > 0 ? 4 : 0)
              : Math.max(blockedHeight, bucket.blocked > 0 ? 6 : 0);

            return (
              <button
                type="button"
                className="bv-chart-col"
                key={bucket.key}
                aria-label={`${bucket.label}: ${bucket.blocked} stopped, ${bucket.challenged} challenged${
                  assumptionsConfigured
                    ? `, ${formatCurrency(bucket.estimatedValueProtected || 0, currency)} estimated value`
                    : ""
                }`}
              >
                <div
                  className="bv-chart-bar-stack"
                  style={{ height: `${primaryHeight}%` }}
                >
                  {assumptionsConfigured && valueHeight > 0 ? (
                    <span className="is-value" style={{ flex: valueHeight }} />
                  ) : null}
                  {!assumptionsConfigured && blockedHeight > 0 ? (
                    <span className="is-blocked" style={{ flex: blockedHeight }} />
                  ) : null}
                </div>
                <div className="bv-chart-tooltip" role="tooltip">
                  <strong>{bucket.label}</strong>
                  <span>
                    Threats stopped <b>{bucket.blocked}</b>
                  </span>
                  <span>
                    Challenges <b>{bucket.challenged}</b>
                  </span>
                  {assumptionsConfigured ? (
                    <span>
                      Est. value{" "}
                      <b>{formatCurrency(bucket.estimatedValueProtected || 0, currency)}</b>
                    </span>
                  ) : (
                    <span>Set assumptions for financial estimates</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <div className="bv-chart-axis" aria-hidden="true">
          <span>{trend[0]?.label}</span>
          <span>{trend[Math.floor((trend.length - 1) / 2)]?.label}</span>
          <span>{trend[trend.length - 1]?.label}</span>
        </div>
      </div>
      {!assumptionsConfigured ? (
        <p className="bv-projection-basis" style={{ marginTop: 12 }}>
          Configure savings assumptions to overlay estimated financial value on this
          chart.
        </p>
      ) : null}
    </div>
  );
}

function CategoryBreakdown({ categories, currency, configured }) {
  if (!categories.length) {
    return (
      <div className="bv-empty">
        <div className="bv-empty-icon">
          <ValueIcon name="shield" centered />
        </div>
        <h3>No categorized protection yet</h3>
        <p>
          Category breakdown appears when BotShield records protection activity
          across bot, rate, network, and page defenses.
        </p>
      </div>
    );
  }

  const maxShare = Math.max(
    1,
    ...categories.map((row) => row.shareOfInterventions || 0),
  );

  return (
    <div className="bv-breakdown-list">
      {categories.map((row) => (
        <div className="bv-breakdown-row" key={row.id}>
          <div className="bv-breakdown-label">
            <span className="bv-breakdown-icon">
              <ValueIcon name={row.id === "bot" ? "block" : row.id === "rate" ? "activity" : "globe"} centered />
            </span>
            {row.label}
          </div>
          <div className="bv-breakdown-track" aria-hidden="true">
            <div
              className="bv-breakdown-fill"
              style={{
                width: `${Math.max(4, ((row.shareOfInterventions || 0) / maxShare) * 100)}%`,
              }}
            />
          </div>
          <div className="bv-breakdown-meta">
            <strong>{row.interventions} interventions</strong>
            <span>
              {row.shareOfInterventions == null ? "—" : `${row.shareOfInterventions}%`}
              {configured && row.estimatedValueProtected != null
                ? ` · ${formatCurrency(row.estimatedValueProtected, currency)}`
                : ""}
            </span>
          </div>
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
          Customize how BotShield estimates financial impact for your business.
          These inputs are used only to estimate financial impact. Actual savings
          may vary.
        </BotShieldParagraph>
        <div>
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
          <p className="bv-assumption-field-help">
            Dollar value you assign to each harmful event BotShield blocks.
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
          <p className="bv-assumption-field-help">
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
          <p className="bv-assumption-field-help">
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
          <p className="bv-assumption-field-help">
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
  const [rangeTransition, setRangeTransition] = useState(false);
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
      setRangeTransition(false);
    }
  }, [range]);

  useEffect(() => {
    void loadValue(range);
  }, [loadValue, range]);

  const handleRangeChange = (nextRange) => {
    if (nextRange === range) return;
    setRangeTransition(true);
    setRange(nextRange);
  };

  const currency = payload?.currentPlan?.currency || "USD";
  const configured = payload?.economics?.assumptionsConfigured;
  const hasActivity =
    payload &&
    (payload.activity.threatsStopped > 0 || payload.activity.threatsDetected > 0);

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

  const animateValues = Boolean(payload) && !loading && !rangeTransition;

  return (
    <BotShieldNativePage heading="Value">
      <BotShieldPageShell className="botshield-value-content">
        <div className="botshield-value-dashboard">
          {/* ── Header ── */}
          <header className="bv-header bv-animate-enter">
            <div className="bv-header-copy">
              <h1>Value</h1>
              <p>See the business impact of your BotShield protection.</p>
            </div>
            <div className="bv-header-actions">
              <div className="bv-period" aria-label="Value period">
                {RANGE_OPTIONS.map((option) => (
                  <button
                    aria-pressed={range === option.id}
                    className={range === option.id ? "is-active" : ""}
                    key={option.id}
                    onClick={() => handleRangeChange(option.id)}
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
                className={`bv-refresh-btn${loading ? " is-spinning" : ""}`}
                disabled={loading}
                onClick={() => loadValue(range)}
                type="button"
              >
                <ValueIcon name="refresh" centered />
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
              className={`bv-value-transition${rangeTransition ? " is-updating" : ""}`}
            >
              {payload.retentionMessage ? (
                <BotShieldBanner tone="info" title="Retention limit">
                  {payload.retentionMessage}
                </BotShieldBanner>
              ) : null}

              {/* ── Hero ── */}
              <section
                aria-labelledby="value-hero-title"
                className="bv-hero bv-animate-enter bv-animate-enter-delay-1"
              >
                <div className="bv-hero-inner">
                  <div className="bv-hero-top">
                    <div>
                      <p className="bv-hero-label" id="value-hero-title">
                        Estimated value protected
                      </p>
                      {configured ? (
                        <>
                          <p className="bv-hero-amount is-emphasis" aria-live="polite">
                            <AnimatedCurrency
                              amount={payload.economics.estimatedValueProtected}
                              currency={currency}
                              enabled={animateValues}
                            />
                          </p>
                          <p className="bv-hero-support">
                            Based on your observed BotShield protection activity and
                            configured savings assumptions.
                          </p>
                        </>
                      ) : (
                        <div className="bv-hero-empty">
                          <p className="bv-hero-amount" aria-hidden="true">
                            —
                          </p>
                          <p className="bv-hero-support">
                            Set your savings assumptions to calculate financial impact.
                          </p>
                          <span className="bv-hero-cta">
                            <BotShieldPolarisButton variant="primary" onClick={openAssumptions}>
                              Set assumptions
                            </BotShieldPolarisButton>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bv-hero-metrics" aria-label="Value summary metrics">
                    <div className="bv-hero-metric">
                      <span className="bv-hero-metric-label">BotShield cost</span>
                      <span className="bv-hero-metric-value">
                        <AnimatedCurrency
                          amount={payload.economics.allocatedPlanCost}
                          currency={currency}
                          enabled={animateValues}
                        />
                      </span>
                    </div>
                    <div className="bv-hero-metric">
                      <span className="bv-hero-metric-label">Threats stopped</span>
                      <span className="bv-hero-metric-value">
                        <AnimatedCount
                          enabled={animateValues}
                          value={payload.activity.threatsStopped}
                        />
                      </span>
                    </div>
                    <div className="bv-hero-metric">
                      <span className="bv-hero-metric-label">Cost per stopped threat</span>
                      <span className="bv-hero-metric-value">
                        {payload.economics.costPerStoppedThreat == null
                          ? "—"
                          : (
                            <AnimatedCurrency
                              amount={payload.economics.costPerStoppedThreat}
                              currency={currency}
                              enabled={animateValues}
                            />
                          )}
                      </span>
                    </div>
                    <div className="bv-hero-metric">
                      <span className="bv-hero-metric-label">Estimated net value</span>
                      <span className="bv-hero-metric-value">
                        {configured ? (
                          <AnimatedCurrency
                            amount={payload.economics.estimatedNetValue}
                            currency={currency}
                            enabled={animateValues}
                          />
                        ) : (
                          "—"
                        )}
                      </span>
                    </div>
                    <div className="bv-hero-metric">
                      <span className="bv-hero-metric-label">Estimated value-to-cost</span>
                      <span className="bv-hero-metric-value">
                        {payload.economics.valueToCostRatio == null
                          ? "—"
                          : `${payload.economics.valueToCostRatio}×`}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {!hasActivity ? (
                <div className="bv-empty bv-animate-enter bv-animate-enter-delay-2">
                  <div className="bv-empty-icon">
                    <ValueIcon name="shield" centered />
                  </div>
                  <h3>Your value story is just getting started</h3>
                  <p>
                    BotShield needs protection activity before it can calculate
                    business impact.
                  </p>
                </div>
              ) : null}

              {!configured && hasActivity ? (
                <div className="bv-empty bv-animate-enter bv-animate-enter-delay-2">
                  <div className="bv-empty-icon">
                    <ValueIcon name="settings" centered />
                  </div>
                  <h3>Turn protection activity into business value</h3>
                  <p>Set your assumptions to estimate the financial impact of BotShield.</p>
                  <BotShieldPolarisButton variant="primary" onClick={openAssumptions}>
                    Set assumptions
                  </BotShieldPolarisButton>
                </div>
              ) : null}

              {/* ── Economics flow ── */}
              <section
                aria-labelledby="value-economics-title"
                className="bv-surface bv-animate-enter bv-animate-enter-delay-2"
              >
                <div className="bv-section-head">
                  <div>
                    <h2 id="value-economics-title">Your BotShield economics</h2>
                    <p>How your plan cost compares to estimated protection value.</p>
                  </div>
                </div>
                <div className="bv-economics-flow">
                  <div className="bv-flow-step is-cost">
                    <span className="bv-flow-step-icon">
                      <ValueIcon name="cost" centered />
                    </span>
                    <span className="bv-flow-step-label">You paid</span>
                    <span className="bv-flow-step-value">
                      <AnimatedCurrency
                        amount={payload.economics.allocatedPlanCost}
                        currency={currency}
                        enabled={animateValues}
                      />
                    </span>
                  </div>
                  <span aria-hidden="true" className="bv-flow-arrow">
                    →
                  </span>
                  <div className="bv-flow-step is-protected">
                    <span className="bv-flow-step-icon">
                      <ValueIcon name="shield" centered />
                    </span>
                    <span className="bv-flow-step-label">BotShield protected</span>
                    <span className="bv-flow-step-value">
                      {configured ? (
                        <AnimatedCurrency
                          amount={payload.economics.estimatedValueProtected}
                          currency={currency}
                          enabled={animateValues}
                        />
                      ) : (
                        "—"
                      )}
                    </span>
                  </div>
                  <span aria-hidden="true" className="bv-flow-arrow">
                    →
                  </span>
                  <div className="bv-flow-step is-net">
                    <span className="bv-flow-step-icon">
                      <ValueIcon name="trend" centered />
                    </span>
                    <span className="bv-flow-step-label">Estimated net value</span>
                    <span className="bv-flow-step-value">
                      {configured ? (
                        <AnimatedCurrency
                          amount={payload.economics.estimatedNetValue}
                          currency={currency}
                          enabled={animateValues}
                        />
                      ) : (
                        "—"
                      )}
                    </span>
                  </div>
                </div>
                {payload.economics.valueToCostRatio != null ? (
                  <div className="bv-efficiency-badge">
                    <ValueIcon name="trend" centered />
                    {payload.economics.valueToCostRatio}× estimated value-to-cost
                  </div>
                ) : null}
              </section>

              {/* ── Chart ── */}
              <section
                aria-labelledby="value-chart-title"
                className="bv-surface bv-animate-enter bv-animate-enter-delay-3"
              >
                <div className="bv-section-head">
                  <div>
                    <h2 id="value-chart-title">Protection value over time</h2>
                    <p>
                      {configured
                        ? "Estimated value protected across the selected period."
                        : "Protection activity over time. Configure assumptions for financial estimates."}
                    </p>
                  </div>
                </div>
                <ValueProtectionChart
                  assumptionsConfigured={configured}
                  currency={currency}
                  trend={payload.trend}
                />
              </section>

              {/* ── Category breakdown ── */}
              <section
                aria-labelledby="value-breakdown-title"
                className="bv-surface bv-animate-enter bv-animate-enter-delay-3"
              >
                <div className="bv-section-head">
                  <div>
                    <h2 id="value-breakdown-title">Where your value came from</h2>
                    <p>Protection categories contributing to your estimated value.</p>
                  </div>
                </div>
                <CategoryBreakdown
                  categories={payload.categories}
                  configured={configured}
                  currency={currency}
                />
              </section>

              {/* ── Protection basis (de-emphasized) ── */}
              <section
                aria-labelledby="value-basis-title"
                className="bv-surface bv-surface-muted bv-surface-compact bv-animate-enter bv-animate-enter-delay-4"
              >
                <div className="bv-section-head" style={{ marginBottom: 12 }}>
                  <div>
                    <h2 id="value-basis-title">Protection behind these estimates</h2>
                    <p>Observed storefront activity supporting the financial model.</p>
                  </div>
                </div>
                <div className="bv-basis">
                  <div className="bv-basis-item is-primary">
                    <span className="bv-basis-label">Blocked</span>
                    <span className="bv-basis-value">
                      <AnimatedCount
                        enabled={animateValues}
                        value={payload.activity.threatsStopped}
                      />
                    </span>
                  </div>
                  <div className="bv-basis-item">
                    <span className="bv-basis-label">Challenged</span>
                    <span className="bv-basis-value">
                      <AnimatedCount
                        enabled={animateValues}
                        value={payload.activity.challengesIssued}
                      />
                    </span>
                  </div>
                  <div className="bv-basis-item">
                    <span className="bv-basis-label">Detected</span>
                    <span className="bv-basis-value">
                      <AnimatedCount
                        enabled={animateValues}
                        value={payload.activity.threatsDetected}
                      />
                    </span>
                  </div>
                </div>
              </section>

              {/* ── Projections ── */}
              <section
                aria-labelledby="value-projection-title"
                className="bv-surface bv-animate-enter bv-animate-enter-delay-4"
              >
                <div className="bv-section-head">
                  <div>
                    <h2 id="value-projection-title">
                      If your current protection rate continues
                    </h2>
                  </div>
                </div>
                {payload.projection.available ? (
                  <>
                    <div className="bv-projection-grid">
                      <article className="bv-projection-card">
                        <h3>Next 30 days</h3>
                        <div className="bv-projection-metrics">
                          <div className="bv-projection-metric">
                            <span>Projected threats stopped</span>
                            <strong>{payload.projection.next30Days.threatsStopped}</strong>
                          </div>
                          <div className="bv-projection-metric">
                            <span>Projected interventions</span>
                            <strong>{payload.projection.next30Days.interventions}</strong>
                          </div>
                          <div className="bv-projection-metric is-highlight">
                            <span>Projected estimated value</span>
                            <strong>
                              {payload.projection.next30Days.estimatedValueProtected == null
                                ? "—"
                                : formatCurrency(
                                    payload.projection.next30Days.estimatedValueProtected,
                                    currency,
                                  )}
                            </strong>
                          </div>
                        </div>
                      </article>
                      <article className="bv-projection-card">
                        <h3>Next 12 months</h3>
                        <div className="bv-projection-metrics">
                          <div className="bv-projection-metric">
                            <span>Projected threats stopped</span>
                            <strong>{payload.projection.next12Months.threatsStopped}</strong>
                          </div>
                          <div className="bv-projection-metric">
                            <span>Projected interventions</span>
                            <strong>{payload.projection.next12Months.interventions}</strong>
                          </div>
                          <div className="bv-projection-metric is-highlight">
                            <span>Projected estimated value</span>
                            <strong>
                              {payload.projection.next12Months.estimatedValueProtected == null
                                ? "—"
                                : formatCurrency(
                                    payload.projection.next12Months.estimatedValueProtected,
                                    currency,
                                  )}
                            </strong>
                          </div>
                        </div>
                      </article>
                    </div>
                    <p className="bv-projection-basis">{payload.projection.basisLabel}</p>
                    {!configured ? (
                      <BotShieldActionButton onClick={openAssumptions}>
                        Set assumptions
                      </BotShieldActionButton>
                    ) : null}
                  </>
                ) : (
                  <div className="bv-empty" style={{ border: 0, background: "transparent", padding: "12px 0" }}>
                    <p>{payload.projection.reason}</p>
                    {!configured ? (
                      <BotShieldActionButton onClick={openAssumptions}>
                        Set assumptions
                      </BotShieldActionButton>
                    ) : null}
                  </div>
                )}
              </section>

              {/* ── Methodology ── */}
              <section className="bv-surface bv-surface-muted bv-animate-enter bv-animate-enter-delay-4">
                <details className="bv-disclosure">
                  <summary>How calculations work</summary>
                  <div className="bv-disclosure-body">
                    <div>
                      <h4>Observed data</h4>
                      <ul>
                        <li>Blocked and challenged storefront activity</li>
                        <li>Protection category from BotShield reason codes</li>
                        <li>Current plan price and selected period</li>
                        <li>Observed history within retention limits</li>
                      </ul>
                    </div>
                    <div>
                      <h4>Estimates</h4>
                      <ul>
                        <li>
                          Estimated value protected = blocked value + challenged value
                          + staff time savings
                        </li>
                        <li>
                          Estimated net value = estimated value protected minus
                          allocated plan cost
                        </li>
                        <li>
                          Projections extrapolate from observed daily rates when enough
                          history exists
                        </li>
                      </ul>
                    </div>
                    <p className="bv-disclosure-footer">
                      Financial impact is estimated from BotShield activity and your
                      configured assumptions. Actual savings may vary.
                    </p>
                  </div>
                </details>
              </section>

              {/* ── Why BotShield ── */}
              <section
                aria-labelledby="value-why-title"
                className="bv-surface bv-animate-enter bv-animate-enter-delay-4"
              >
                <div className="bv-section-head">
                  <h2 id="value-why-title">Why BotShield</h2>
                </div>
                <div className="bv-why-grid">
                  <article className="bv-why-card">
                    <span className="bv-why-icon">
                      <ValueIcon name="shop" centered />
                    </span>
                    <h3>Shopify-focused</h3>
                    <p>Built for Shopify storefront protection workflows.</p>
                  </article>
                  <article className="bv-why-card">
                    <span className="bv-why-icon">
                      <ValueIcon name="info" centered />
                    </span>
                    <h3>Transparent impact</h3>
                    <p>See protection activity alongside understandable estimates.</p>
                  </article>
                  <article className="bv-why-card">
                    <span className="bv-why-icon">
                      <ValueIcon name="person" centered />
                    </span>
                    <h3>Merchant control</h3>
                    <p>Configure assumptions and protection rules on your terms.</p>
                  </article>
                  <article className="bv-why-card">
                    <span className="bv-why-icon">
                      <ValueIcon name="cost" centered />
                    </span>
                    <h3>Simple economics</h3>
                    <p>Understand cost relative to observed protection value.</p>
                  </article>
                </div>
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
