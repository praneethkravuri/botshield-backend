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

function ValueIcon({ name, tone = "neutral" }) {
  return (
    <span className={`bv-icon bv-icon-${tone}`} aria-hidden="true">
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

  const hasPlotValues = trend.some(
    (bucket) =>
      bucket.blocked > 0 ||
      bucket.challenged > 0 ||
      (assumptionsConfigured && (bucket.estimatedValueProtected || 0) > 0),
  );

  const density =
    trend.length <= 7 ? "sparse" : trend.length <= 31 ? "medium" : "dense";

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

  if (!hasPlotValues) {
    return null;
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
          aria-label={`Protection and value trend across ${trend.length} periods`}
          data-density={density}
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

function ValueDrivers({ categories, currency, configured }) {
  if (!categories.length) {
    return (
      <p className="bv-section-note is-inline">
        Category breakdown appears when protection events include recognizable
        BotShield reason signals.
      </p>
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

const VALUE_MODEL_PARAMS = [
  {
    id: "blocked",
    label: "Value per blocked event",
    icon: "block",
    format: (assumptions) =>
      formatCurrency(assumptions.estimatedValuePerBlockedEvent || 0, "USD"),
    help: "Business value assigned to each blocked threat.",
  },
  {
    id: "challenge",
    label: "Value per challenge",
    icon: "shield",
    format: (assumptions) =>
      formatCurrency(assumptions.estimatedValuePerChallenge || 0, "USD"),
    help: "Business value assigned to each challenged event.",
  },
  {
    id: "minutes",
    label: "Staff minutes saved",
    icon: "settings",
    format: (assumptions) => `${assumptions.staffMinutesSavedPerIntervention || 0} min`,
    help: "Manual review time avoided per intervention.",
  },
  {
    id: "hourly",
    label: "Staff hourly cost",
    icon: "cost",
    format: (assumptions) => formatCurrency(assumptions.staffHourlyCost || 0, "USD"),
    help: "Hourly staff cost used for time-savings estimates.",
  },
];

function projectionHasActivity(projection) {
  if (!projection?.available) return false;
  const windows = [projection.next30Days, projection.next12Months];
  return windows.some(
    (window) =>
      (window?.threatsStopped || 0) > 0 || (window?.interventions || 0) > 0,
  );
}

function ValueModelSummary({ assumptions, configured, onEdit }) {
  return (
    <div className="bv-model-surface">
      <div className="bv-model-head">
        <h2 id="value-model-title">Your value model</h2>
        <span className={`bv-status${configured ? " is-configured" : " is-unconfigured"}`}>
          {configured ? "Configured" : "Not configured"}
        </span>
      </div>
      <table className="bv-model-table">
        <tbody>
          {VALUE_MODEL_PARAMS.map((param) => (
            <tr key={param.id}>
              <th scope="row">{param.label}</th>
              <td>{param.format(assumptions)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="bv-model-actions">
        <BotShieldPolarisButton variant="secondary" onClick={onEdit}>
          Edit assumptions
        </BotShieldPolarisButton>
      </div>
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
  const rangeLabel =
    RANGE_OPTIONS.find((option) => option.id === range)?.label || range;

  return (
    <BotShieldNativePage heading="Value">
      <BotShieldPageShell className="botshield-value-content botshield-value-premium">
        <div className="botshield-value-dashboard">
          <header className="bv-header bv-animate-enter">
            <div className="bv-header-copy">
              <h2>Protection value</h2>
              <p className="bv-header-lead">
                Connect BotShield&apos;s observed protection activity to measurable
                business impact.
              </p>
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
                <p className="bv-retention-note">
                  <ValueIcon name="info" />
                  <span>{payload.retentionMessage}</span>
                </p>
              ) : null}

              <section aria-labelledby="value-brief-title" className="bv-brief bv-animate-enter">
                <div className="bv-brief-top">
                  <div className="bv-brief-primary">
                    <p className="bv-brief-label" id="value-brief-title">
                      Estimated protected value
                    </p>
                    {configured ? (
                      <p className="bv-brief-amount is-value" aria-live="polite">
                        <AnimatedCurrency
                          amount={payload.economics.estimatedValueProtected}
                          currency={currency}
                          enabled={animateValues}
                        />
                      </p>
                    ) : (
                      <>
                        <p className="bv-brief-amount is-unavailable" aria-live="polite">
                          —
                        </p>
                        <p className="bv-brief-status">Value model not configured</p>
                        <p className="bv-brief-copy">
                          Configure assumptions to translate observed interventions into
                          estimated business value.
                        </p>
                        <span className="bv-brief-cta">
                          <BotShieldPolarisButton variant="primary" onClick={openAssumptions}>
                            Configure value model
                          </BotShieldPolarisButton>
                        </span>
                      </>
                    )}
                  </div>
                  <div className="bv-brief-cost">
                    <span className="bv-brief-cost-label">BotShield cost</span>
                    <span className="bv-brief-cost-value">
                      <AnimatedCurrency
                        amount={payload.economics.allocatedPlanCost}
                        currency={currency}
                        enabled={animateValues}
                      />
                    </span>
                    <span className="bv-brief-cost-period">
                      Current {rangeLabel} period
                    </span>
                  </div>
                </div>
                <div className="bv-brief-bottom">
                  <div className="bv-brief-row">
                    <span className="bv-brief-row-label">Observed protection</span>
                    <div className="bv-brief-metrics">
                      <div className="bv-brief-metric is-detected">
                        <span>Detected</span>
                        <strong>
                          <AnimatedCount
                            enabled={animateValues}
                            value={payload.activity.threatsDetected}
                          />
                        </strong>
                      </div>
                      <div className="bv-brief-metric">
                        <span>Stopped</span>
                        <strong>
                          <AnimatedCount
                            enabled={animateValues}
                            value={payload.activity.threatsStopped}
                          />
                        </strong>
                      </div>
                      <div className="bv-brief-metric">
                        <span>Interventions</span>
                        <strong>
                          <AnimatedCount
                            enabled={animateValues}
                            value={payload.activity.interventions}
                          />
                        </strong>
                      </div>
                    </div>
                  </div>
                  <div className="bv-brief-row">
                    <span className="bv-brief-row-label">Estimated economics</span>
                    <div className="bv-brief-metrics">
                      <div className="bv-brief-metric">
                        <span>Net value</span>
                        <strong>
                          {configured ? (
                            <AnimatedCurrency
                              amount={payload.economics.estimatedNetValue}
                              currency={currency}
                              enabled={animateValues}
                            />
                          ) : (
                            "—"
                          )}
                        </strong>
                      </div>
                      <div className="bv-brief-metric">
                        <span>Value-to-cost</span>
                        <strong>
                          {payload.economics.valueToCostRatio == null
                            ? "—"
                            : `${payload.economics.valueToCostRatio}×`}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section aria-labelledby="value-formed-title" className="bv-section bv-animate-enter">
                <h2 id="value-formed-title">How value is formed</h2>
                <div className="bv-value-formed">
                  <div className="bv-value-formed-step">
                    <span>Observed interventions</span>
                    <strong>
                      <AnimatedCount
                        enabled={animateValues}
                        value={payload.activity.interventions}
                      />
                    </strong>
                  </div>
                  <span aria-hidden="true" className="bv-value-formed-arrow">
                    →
                  </span>
                  <div className="bv-value-formed-step">
                    <span>Merchant value assumptions</span>
                    <strong>{configured ? "Configured" : "Not configured"}</strong>
                  </div>
                  <span aria-hidden="true" className="bv-value-formed-arrow">
                    →
                  </span>
                  <div className="bv-value-formed-step">
                    <span>Estimated protected value</span>
                    <strong>
                      {configured ? (
                        <AnimatedCurrency
                          amount={payload.economics.estimatedValueProtected}
                          currency={currency}
                          enabled={animateValues}
                        />
                      ) : (
                        "—"
                      )}
                    </strong>
                  </div>
                </div>
              </section>

              <section
                aria-labelledby="value-observed-title"
                className="bv-section bv-animate-enter"
              >
                <div className="bv-section-head">
                  <h2 id="value-observed-title">Observed protection</h2>
                </div>
                <p className="bv-section-lead">
                  Security activity recorded during the selected period.
                </p>
                <ul className="bv-metric-table">
                  <li className="bv-metric-row is-detected">
                    <span>Detected suspicious activity</span>
                    <strong>
                      <AnimatedCount
                        enabled={animateValues}
                        value={payload.activity.threatsDetected}
                      />
                    </strong>
                  </li>
                  <li className="bv-metric-row">
                    <span>Blocked</span>
                    <strong>
                      <AnimatedCount
                        enabled={animateValues}
                        value={payload.activity.threatsStopped}
                      />
                    </strong>
                  </li>
                  <li className="bv-metric-row">
                    <span>Challenged</span>
                    <strong>
                      <AnimatedCount
                        enabled={animateValues}
                        value={payload.activity.challengesIssued}
                      />
                    </strong>
                  </li>
                  <li className="bv-metric-row">
                    <span>Total interventions</span>
                    <strong>
                      <AnimatedCount
                        enabled={animateValues}
                        value={payload.activity.interventions}
                      />
                    </strong>
                  </li>
                </ul>
                <p className="bv-section-note is-inline">
                  Detected activity is evidence of suspicious traffic. Only blocked and
                  challenged events count as interventions or stopped threats.
                </p>
              </section>

              {hasInterventions ? (
                <section
                  aria-labelledby="value-chart-title"
                  className="bv-section bv-animate-enter"
                >
                  <div className="bv-section-head">
                    <h2 id="value-chart-title">Protection activity trend</h2>
                  </div>
                  <ValueProtectionChart
                    assumptionsConfigured={configured}
                    currency={currency}
                    trend={payload.trend}
                  />
                </section>
              ) : (
                <section aria-labelledby="value-activity-title" className="bv-section bv-animate-enter">
                  <div className="bv-activity-context">
                    <h3 id="value-activity-title">No stopped-threat trend yet</h3>
                    <p>
                      BotShield has detected{" "}
                      <strong>
                        <AnimatedCount
                          enabled={animateValues}
                          value={payload.activity.threatsDetected}
                        />
                      </strong>{" "}
                      suspicious events in this period, but none were blocked or
                      challenged. Trend reporting for stopped threats will appear after
                      an intervention is recorded.
                    </p>
                  </div>
                </section>
              )}

              <section
                aria-labelledby="value-financial-title"
                className="bv-section bv-animate-enter"
              >
                <div className="bv-section-head">
                  <h2 id="value-financial-title">Financial value</h2>
                  {!configured ? (
                    <span className="bv-status is-unconfigured">Value model not configured</span>
                  ) : null}
                </div>
                <ul className="bv-metric-table">
                  <li className="bv-metric-row">
                    <span>Estimated protected value</span>
                    <strong>
                      {configured ? (
                        <AnimatedCurrency
                          amount={payload.economics.estimatedValueProtected}
                          currency={currency}
                          enabled={animateValues}
                        />
                      ) : (
                        "—"
                      )}
                    </strong>
                  </li>
                  <li className="bv-metric-row">
                    <span>Estimated net value</span>
                    <strong>
                      {configured ? (
                        <AnimatedCurrency
                          amount={payload.economics.estimatedNetValue}
                          currency={currency}
                          enabled={animateValues}
                        />
                      ) : (
                        "—"
                      )}
                    </strong>
                  </li>
                  <li className="bv-metric-row">
                    <span>Value-to-cost</span>
                    <strong>
                      {payload.economics.valueToCostRatio == null
                        ? "—"
                        : `${payload.economics.valueToCostRatio}×`}
                    </strong>
                  </li>
                  <li className="bv-metric-row">
                    <span>Cost per stopped threat</span>
                    <strong>
                      {payload.economics.costPerStoppedThreat == null
                        ? "—"
                        : (
                          <AnimatedCurrency
                            amount={payload.economics.costPerStoppedThreat}
                            currency={currency}
                            enabled={animateValues}
                          />
                        )}
                    </strong>
                  </li>
                </ul>
                {!configured ? (
                  <>
                    <p className="bv-section-note">
                      Financial estimates remain unavailable until merchant assumptions
                      are configured.
                    </p>
                    <BotShieldPolarisButton variant="primary" onClick={openAssumptions}>
                      Configure value model
                    </BotShieldPolarisButton>
                  </>
                ) : null}
                {hasInterventions ? (
                  <>
                    <p className="bv-section-lead">Value drivers</p>
                    <ValueDrivers
                      categories={payload.categories}
                      configured={configured}
                      currency={currency}
                    />
                  </>
                ) : (
                  <p className="bv-section-note is-inline">
                    Value drivers will appear after blocked or challenged activity is
                    recorded.
                  </p>
                )}
              </section>

              <section
                aria-labelledby="value-outlook-title"
                className="bv-section bv-animate-enter"
              >
                <div className="bv-section-head">
                  <h2 id="value-outlook-title">Outlook</h2>
                  <span className="bv-status is-projected">Projected</span>
                </div>
                {payload.projection.available ? (
                  projectionHasActivity(payload.projection) ? (
                    <>
                      <table className="bv-outlook-table">
                        <thead>
                          <tr>
                            <th scope="col" />
                            <th scope="col">30 days</th>
                            <th scope="col">12 months</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>Threats stopped</td>
                            <td>
                              <strong>
                                <AnimatedCount
                                  enabled={animateValues}
                                  value={payload.projection.next30Days.threatsStopped}
                                />
                              </strong>
                            </td>
                            <td>
                              <strong>
                                <AnimatedCount
                                  enabled={animateValues}
                                  value={payload.projection.next12Months.threatsStopped}
                                />
                              </strong>
                            </td>
                          </tr>
                          <tr>
                            <td>Interventions</td>
                            <td>
                              <strong>
                                <AnimatedCount
                                  enabled={animateValues}
                                  value={payload.projection.next30Days.interventions}
                                />
                              </strong>
                            </td>
                            <td>
                              <strong>
                                <AnimatedCount
                                  enabled={animateValues}
                                  value={payload.projection.next12Months.interventions}
                                />
                              </strong>
                            </td>
                          </tr>
                          <tr>
                            <td>Estimated value</td>
                            <td>
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
                            </td>
                            <td>
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
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      <p className="bv-outlook-basis">{payload.projection.basisLabel}</p>
                    </>
                  ) : (
                    <>
                      <p className="bv-outlook-empty">
                        Projections are available but currently show zero stopped-threat
                        activity at the observed rate. Interventions must be recorded
                        before forward estimates become meaningful.
                      </p>
                      <p className="bv-outlook-basis">{payload.projection.basisLabel}</p>
                    </>
                  )
                ) : (
                  <p className="bv-outlook-empty">{payload.projection.reason}</p>
                )}
                {!configured && payload.projection.available ? (
                  <button className="bv-text-action" onClick={openAssumptions} type="button">
                    Configure value model
                  </button>
                ) : null}
              </section>

              <section aria-labelledby="value-model-title" className="bv-section bv-animate-enter">
                <ValueModelSummary
                  assumptions={payload.assumptions}
                  configured={configured}
                  onEdit={openAssumptions}
                />
              </section>

              <section className="bv-section bv-animate-enter">
                <details className="bv-disclosure">
                  <summary>
                    <span className="bv-disclosure-label">
                      <ValueIcon name="info" />
                      How calculations work
                    </span>
                  </summary>
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
