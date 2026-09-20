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
  lock: "lock",
  globe: "globe-lines",
  activity: "chart-line",
  block: "disabled",
  page: "page",
};

const CATEGORY_ICON_MAP = {
  "bot-protection": "block",
  "network-protection": "globe",
  "rate-protection": "activity",
  "page-protection": "lock",
  uncategorized: "info",
};

function ValueIcon({ name }) {
  return (
    <span className="bv-icon" aria-hidden="true">
      <BotShieldIcon
        type={VALUE_ICONS[name] || VALUE_ICONS.shield}
        size="small"
        color="subdued"
      />
    </span>
  );
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useAnimatedNumber(target, { duration = 580, enabled = true } = {}) {
  const [display, setDisplay] = useState(
    enabled && !prefersReducedMotion() ? 0 : target,
  );
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
  const maxBlocked = useMemo(
    () => Math.max(1, ...trend.map((bucket) => bucket.blocked || 0)),
    [trend],
  );

  const chartMaximum = useMemo(() => {
    if (assumptionsConfigured) {
      const values = trend.map((bucket) => bucket.estimatedValueProtected || 0);
      return Math.max(1, ...values, 0);
    }
    return Math.max(1, ...trend.map((bucket) => bucket.blocked || 0));
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
          <ValueIcon name="trend" />
        </div>
        <h3>No protection activity yet</h3>
        <p>
          Protection trends appear when BotShield records blocked or challenged
          storefront activity in this period.
        </p>
      </div>
    );
  }

  return (
    <div className="bv-chart-wrap">
      <div className="bv-chart-legend" aria-label="Chart legend">
        {assumptionsConfigured ? (
          <>
            <span>
              <i className="is-value" aria-hidden="true" />
              Estimated value protected
            </span>
            <span>
              <i className="is-blocked" aria-hidden="true" />
              Threats stopped (relative)
            </span>
          </>
        ) : (
          <span>
            <i className="is-blocked" aria-hidden="true" />
            Threats stopped
          </span>
        )}
      </div>
      <div className="bv-chart-scroll">
        <div
          className="bv-chart"
          role="img"
          aria-label={`Protection and value trend with ${activeDays} active periods`}
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
              const blockedHeight = ((bucket.blocked || 0) / chartMaximum) * 100;
              const valueHeight = assumptionsConfigured
                ? ((bucket.estimatedValueProtected || 0) / chartMaximum) * 100
                : 0;
              const blockedContextHeight = assumptionsConfigured
                ? ((bucket.blocked || 0) / maxBlocked) * 28
                : 0;
              const primaryHeight = assumptionsConfigured
                ? Math.max(valueHeight, bucket.blocked > 0 ? 4 : 0, blockedContextHeight)
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
                    {assumptionsConfigured && blockedContextHeight > 0 ? (
                      <span
                        className="is-blocked is-context"
                        style={{ flex: blockedContextHeight }}
                      />
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
      </div>
      {!assumptionsConfigured ? (
        <p className="bv-chart-note">
          Configure your value model to overlay estimated financial value on observed
          protection activity.
        </p>
      ) : null}
    </div>
  );
}

function ValueDrivers({ categories, currency, configured, hasInterventions }) {
  if (!hasInterventions) {
    return (
      <div className="bv-inline-empty">
        <ValueIcon name="shield" />
        <div>
          <strong>No intervention-based value drivers yet</strong>
          <p>
            Value drivers appear after BotShield records blocked or challenged
            protection activity.
          </p>
        </div>
      </div>
    );
  }

  if (!categories.length) {
    return (
      <div className="bv-inline-empty">
        <ValueIcon name="info" />
        <div>
          <strong>No categorized interventions yet</strong>
          <p>
            Category breakdown appears when protection events include recognizable
            BotShield reason signals.
          </p>
        </div>
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
              <ValueIcon name={CATEGORY_ICON_MAP[row.id] || "info"} />
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
    <BotShieldNativeModal id={VALUE_ASSUMPTIONS_MODAL_ID} heading="Value model">
      <BotShieldStack gap="base">
        <BotShieldParagraph color="subdued">
          Configure how BotShield translates observed protection activity into
          estimated financial impact. These inputs are merchant-defined estimates
          only — actual savings may vary.
        </BotShieldParagraph>
        <div className="bv-assumption-field">
          <BotShieldTextField
            label="Estimated value per blocked event (USD)"
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
            Your estimate of the business value of preventing one blocked threat.
          </p>
        </div>
        <div className="bv-assumption-field">
          <BotShieldTextField
            label="Estimated value per challenged event (USD)"
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
            Your estimate of the value created by challenging suspicious traffic.
          </p>
        </div>
        <div className="bv-assumption-field">
          <BotShieldTextField
            label="Staff minutes saved per intervention (minutes)"
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
            Estimated manual review or response time avoided per blocked or
            challenged event.
          </p>
        </div>
        <div className="bv-assumption-field">
          <BotShieldTextField
            label="Estimated staff hourly cost (USD)"
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
            Approximate hourly staff cost used to value time savings.
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
            Reset to defaults
          </BotShieldPolarisButton>
        </BotShieldStack>
      </BotShieldStack>
    </BotShieldNativeModal>
  );
}

function ValueModelSummary({ assumptions, configured, onEdit }) {
  return (
    <div className="bv-model-grid">
      <div className="bv-model-status">
        <span className={`bv-semantic-badge${configured ? " is-configured" : ""}`}>
          {configured ? "Merchant configured" : "Not configured"}
        </span>
        <p>
          Estimated financial impact is calculated from observed BotShield protection
          activity using these merchant-defined assumptions.
        </p>
        <BotShieldPolarisButton variant="secondary" onClick={onEdit}>
          Edit assumptions
        </BotShieldPolarisButton>
      </div>
      <dl className="bv-model-fields">
        <div>
          <dt>Value per blocked event</dt>
          <dd>{formatCurrency(assumptions.estimatedValuePerBlockedEvent || 0, "USD")}</dd>
        </div>
        <div>
          <dt>Value per challenge</dt>
          <dd>{formatCurrency(assumptions.estimatedValuePerChallenge || 0, "USD")}</dd>
        </div>
        <div>
          <dt>Staff minutes saved</dt>
          <dd>{assumptions.staffMinutesSavedPerIntervention || 0} min</dd>
        </div>
        <div>
          <dt>Staff hourly cost</dt>
          <dd>{formatCurrency(assumptions.staffHourlyCost || 0, "USD")}</dd>
        </div>
      </dl>
    </div>
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
  const activity = payload?.activity;
  const hasActivity =
    activity &&
    (activity.threatsStopped > 0 ||
      activity.challengesIssued > 0 ||
      activity.threatsDetected > 0);
  const hasInterventions = activity && activity.interventions > 0;

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
      <BotShieldPageShell className="botshield-value-content botshield-value-premium">
        <div className="botshield-value-dashboard">
          <header className="bv-command-bar bv-animate-enter">
            <div className="bv-command-copy">
              <p className="bv-command-lead">
                Understand the business impact of your BotShield protection.
              </p>
            </div>
            <div className="bv-command-actions">
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
                <ValueIcon name="refresh" />
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

              <section aria-labelledby="value-hero-title" className="bv-hero bv-animate-enter bv-animate-enter-delay-1">
                <div className="bv-hero-inner">
                  <div className="bv-hero-primary">
                    <div className="bv-hero-heading">
                      <span className="bv-semantic-badge is-estimated">Estimated</span>
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
                          <p className="bv-hero-context">
                            Based on observed storefront protection activity and your
                            configured value model.
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="bv-hero-amount is-unavailable" aria-live="polite">
                            —
                          </p>
                          <p className="bv-hero-context">
                            Financial estimates are unavailable until a value model is
                            configured.
                          </p>
                          <p className="bv-hero-setup-copy">
                            Add your assumptions to translate observed protection activity
                            into estimated business value.
                          </p>
                          <span className="bv-hero-cta">
                            <BotShieldPolarisButton variant="primary" onClick={openAssumptions}>
                              Set assumptions
                            </BotShieldPolarisButton>
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="bv-hero-metrics" aria-label="Value summary metrics">
                    <div className="bv-hero-metric is-observed">
                      <span className="bv-hero-metric-label">BotShield cost</span>
                      <span className="bv-hero-metric-value">
                        <AnimatedCurrency
                          amount={payload.economics.allocatedPlanCost}
                          currency={currency}
                          enabled={animateValues}
                        />
                      </span>
                    </div>
                    <div className="bv-hero-metric is-observed">
                      <span className="bv-hero-metric-label">Threats stopped</span>
                      <span className="bv-hero-metric-value">
                        <AnimatedCount
                          enabled={animateValues}
                          value={payload.activity.threatsStopped}
                        />
                      </span>
                    </div>
                    <div className="bv-hero-metric is-observed">
                      <span className="bv-hero-metric-label">Interventions</span>
                      <span className="bv-hero-metric-value">
                        <AnimatedCount
                          enabled={animateValues}
                          value={payload.activity.interventions}
                        />
                      </span>
                    </div>
                    <div className="bv-hero-metric is-observed">
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
                    <div className="bv-hero-metric is-estimated">
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
                    <div className="bv-hero-metric is-estimated">
                      <span className="bv-hero-metric-label">Value-to-cost</span>
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
                <div className="bv-inline-empty bv-animate-enter bv-animate-enter-delay-2">
                  <ValueIcon name="shield" />
                  <div>
                    <strong>No protection activity recorded yet</strong>
                    <p>
                      BotShield needs storefront protection activity before it can
                      summarize business impact for this period.
                    </p>
                  </div>
                </div>
              ) : null}

              {!configured && hasActivity ? (
                <div className="bv-callout bv-animate-enter bv-animate-enter-delay-2">
                  <ValueIcon name="settings" />
                  <div>
                    <strong>Configure your value model</strong>
                    <p>
                      Observed protection activity is available below. Estimated
                      financial metrics unlock after you set merchant assumptions.
                    </p>
                  </div>
                </div>
              ) : null}

              <section
                aria-labelledby="value-economics-title"
                className="bv-surface bv-animate-enter bv-animate-enter-delay-2"
              >
                <div className="bv-section-head">
                  <div>
                    <h2 id="value-economics-title">Protection economics</h2>
                    <p>How plan cost compares to observed interventions and estimated value.</p>
                  </div>
                </div>
                <div className="bv-economics-flow">
                  <div className="bv-flow-step is-cost">
                    <span className="bv-flow-step-icon">
                      <ValueIcon name="cost" />
                    </span>
                    <span className="bv-semantic-badge is-observed">Observed</span>
                    <span className="bv-flow-step-label">BotShield cost</span>
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
                  <div className="bv-flow-step is-interventions">
                    <span className="bv-flow-step-icon">
                      <ValueIcon name="shield" />
                    </span>
                    <span className="bv-semantic-badge is-observed">Observed</span>
                    <span className="bv-flow-step-label">Protection interventions</span>
                    <span className="bv-flow-step-value">
                      <AnimatedCount
                        enabled={animateValues}
                        value={payload.activity.interventions}
                      />
                    </span>
                  </div>
                  <span aria-hidden="true" className="bv-flow-arrow">
                    →
                  </span>
                  <div className={`bv-flow-step is-protected${configured ? "" : " is-locked"}`}>
                    <span className="bv-flow-step-icon">
                      <ValueIcon name="trend" />
                    </span>
                    <span className="bv-semantic-badge is-estimated">Estimated</span>
                    <span className="bv-flow-step-label">Estimated value protected</span>
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
                  <div className={`bv-flow-step is-net${configured ? "" : " is-locked"}`}>
                    <span className="bv-flow-step-icon">
                      <ValueIcon name="trend" />
                    </span>
                    <span className="bv-semantic-badge is-estimated">Estimated</span>
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
                    <ValueIcon name="trend" />
                    {payload.economics.valueToCostRatio}× estimated value-to-cost
                  </div>
                ) : null}
              </section>

              <section
                aria-labelledby="value-chart-title"
                className="bv-surface bv-animate-enter bv-animate-enter-delay-3"
              >
                <div className="bv-section-head">
                  <div>
                    <h2 id="value-chart-title">Protection &amp; value trend</h2>
                    <p>
                      {configured
                        ? "Observed threats stopped with estimated value protected across the selected period."
                        : "Observed protection activity over time. Configure your value model for financial estimates."}
                    </p>
                  </div>
                </div>
                <ValueProtectionChart
                  assumptionsConfigured={configured}
                  currency={currency}
                  trend={payload.trend}
                />
              </section>

              <section
                aria-labelledby="value-drivers-title"
                className="bv-surface bv-animate-enter bv-animate-enter-delay-3"
              >
                <div className="bv-section-head">
                  <div>
                    <h2 id="value-drivers-title">Value drivers</h2>
                    <p>
                      Protection categories contributing to your observed interventions
                      and estimated value.
                    </p>
                  </div>
                </div>
                <ValueDrivers
                  categories={payload.categories}
                  configured={configured}
                  currency={currency}
                  hasInterventions={hasInterventions}
                />
              </section>

              <section
                aria-labelledby="value-evidence-title"
                className="bv-surface bv-surface-compact bv-animate-enter bv-animate-enter-delay-4"
              >
                <div className="bv-section-head">
                  <div>
                    <span className="bv-semantic-badge is-observed">Observed</span>
                    <h2 id="value-evidence-title">Protection evidence</h2>
                    <p>
                      These are observed storefront protection events. Financial values
                      elsewhere on this page are estimates based on your configured
                      assumptions.
                    </p>
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
                  <div className="bv-basis-item">
                    <span className="bv-basis-label">Interventions</span>
                    <span className="bv-basis-value">
                      <AnimatedCount
                        enabled={animateValues}
                        value={payload.activity.interventions}
                      />
                    </span>
                  </div>
                </div>
              </section>

              <section
                aria-labelledby="value-outlook-title"
                className="bv-surface bv-animate-enter bv-animate-enter-delay-4"
              >
                <div className="bv-section-head">
                  <div>
                    <span className="bv-semantic-badge is-projected">Projected</span>
                    <h2 id="value-outlook-title">Value outlook</h2>
                    <p>
                      Projected protection activity if the currently observed rate
                      continues.
                    </p>
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
                            <strong>
                              <AnimatedCount
                                enabled={animateValues}
                                value={payload.projection.next30Days.threatsStopped}
                              />
                            </strong>
                          </div>
                          <div className="bv-projection-metric">
                            <span>Projected interventions</span>
                            <strong>
                              <AnimatedCount
                                enabled={animateValues}
                                value={payload.projection.next30Days.interventions}
                              />
                            </strong>
                          </div>
                          <div className="bv-projection-metric is-highlight">
                            <span>Projected estimated value</span>
                            <strong>
                              {payload.projection.next30Days.estimatedValueProtected == null
                                ? "—"
                                : (
                                  <AnimatedCurrency
                                    amount={
                                      payload.projection.next30Days.estimatedValueProtected
                                    }
                                    currency={currency}
                                    enabled={animateValues}
                                  />
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
                            <strong>
                              <AnimatedCount
                                enabled={animateValues}
                                value={payload.projection.next12Months.threatsStopped}
                              />
                            </strong>
                          </div>
                          <div className="bv-projection-metric">
                            <span>Projected interventions</span>
                            <strong>
                              <AnimatedCount
                                enabled={animateValues}
                                value={payload.projection.next12Months.interventions}
                              />
                            </strong>
                          </div>
                          <div className="bv-projection-metric is-highlight">
                            <span>Projected estimated value</span>
                            <strong>
                              {payload.projection.next12Months.estimatedValueProtected == null
                                ? "—"
                                : (
                                  <AnimatedCurrency
                                    amount={
                                      payload.projection.next12Months.estimatedValueProtected
                                    }
                                    currency={currency}
                                    enabled={animateValues}
                                  />
                                )}
                            </strong>
                          </div>
                        </div>
                      </article>
                    </div>
                    <p className="bv-projection-basis">{payload.projection.basisLabel}</p>
                    {!configured ? (
                      <BotShieldActionButton onClick={openAssumptions}>
                        Configure value model
                      </BotShieldActionButton>
                    ) : null}
                  </>
                ) : (
                  <div className="bv-inline-empty">
                    <ValueIcon name="info" />
                    <div>
                      <strong>Projection unavailable</strong>
                      <p>{payload.projection.reason}</p>
                      {!configured ? (
                        <BotShieldActionButton onClick={openAssumptions}>
                          Configure value model
                        </BotShieldActionButton>
                      ) : null}
                    </div>
                  </div>
                )}
              </section>

              <section
                aria-labelledby="value-model-title"
                className="bv-surface bv-animate-enter bv-animate-enter-delay-4"
              >
                <div className="bv-section-head">
                  <h2 id="value-model-title">Your value model</h2>
                </div>
                <ValueModelSummary
                  assumptions={payload.assumptions}
                  configured={configured}
                  onEdit={openAssumptions}
                />
              </section>

              <section className="bv-surface bv-surface-muted bv-animate-enter bv-animate-enter-delay-4">
                <details className="bv-disclosure">
                  <summary>How calculations work</summary>
                  <div className="bv-disclosure-body">
                    <div>
                      <h4>Observed</h4>
                      <ul>
                        <li>Actual BotShield storefront protection activity</li>
                        <li>Blocked, challenged, detected, and intervention counts</li>
                        <li>Allocated plan cost for the selected period</li>
                      </ul>
                    </div>
                    <div>
                      <h4>Estimated</h4>
                      <ul>
                        <li>
                          Financial values calculated from merchant assumptions and
                          observed interventions
                        </li>
                        <li>
                          Estimated value protected = blocked value + challenged value
                          + staff time savings
                        </li>
                        <li>
                          Estimated net value = estimated value protected minus
                          allocated plan cost
                        </li>
                      </ul>
                    </div>
                    <div>
                      <h4>Projected</h4>
                      <ul>
                        <li>
                          Future extrapolations based on available observed activity
                          when enough history exists
                        </li>
                        <li>Projections are not guarantees of future results</li>
                      </ul>
                    </div>
                    <div>
                      <h4>Retention</h4>
                      <ul>
                        <li>
                          Historical observed activity is limited by BotShield&apos;s
                          existing retention policy
                        </li>
                        <li>
                          Longer ranges may include fewer retained days than the
                          selected period label suggests
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
