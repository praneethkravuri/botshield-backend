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

const OBSERVED_RANGE = "30d";
const OBSERVED_WINDOW_LABEL = "Last 30 days";

const HORIZON_OPTIONS = [
  { id: "30d", label: "30 days", shortLabel: "30D", months: 1 },
  { id: "6m", label: "6 months", shortLabel: "6M", months: 6 },
  { id: "1y", label: "1 year", shortLabel: "1Y", months: 12 },
];

const PROJECTION_MIN_OBSERVED_DAYS = 7;
const VALUE_ASSUMPTIONS_MODAL_ID = "botshield-value-v2-assumptions-modal";

const TOOLTIPS = {
  protectedValue:
    "Estimated protected value from BotShield interventions based on your assumptions.",
  netValue: "Estimated protected value minus BotShield cost for the selected period.",
  roi: "Estimated net value divided by selected-period BotShield cost.",
  valuePerDollar: "Estimated protected value returned for each $1 of BotShield spend.",
  costPerIntervention: "Selected-period BotShield cost divided by observed interventions.",
  estValuePerIntervention:
    "Estimated protected value divided by observed interventions.",
  projectedValue: "Forward-looking estimate using eligible observed activity.",
  breakEven: "Estimated interventions needed to cover BotShield cost.",
};

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

function formatValueToCostRatio(ratio, configured) {
  if (!configured || ratio == null || !Number.isFinite(ratio)) return "—";
  const rounded = Math.round(ratio * 10) / 10;
  if (rounded >= 1000) {
    return `${Math.round(rounded).toLocaleString("en-US")}×`;
  }
  if (Number.isInteger(rounded)) {
    return `${rounded}×`;
  }
  return `${rounded.toFixed(1)}×`;
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

function deriveBreakEvenInterventions(
  allocatedPlanCost,
  estValuePerIntervention,
  configured,
) {
  if (
    !configured ||
    estValuePerIntervention == null ||
    estValuePerIntervention <= 0 ||
    allocatedPlanCost <= 0
  ) {
    return null;
  }
  return Math.ceil(allocatedPlanCost / estValuePerIntervention);
}

function countObservedInterventionDays(trend) {
  return trend.filter((bucket) => bucket.interventions > 0).length;
}

function deriveProjectionBasisDays(trend, rangeDays) {
  const observedInterventionDays = countObservedInterventionDays(trend);
  return Math.max(1, Math.min(rangeDays, observedInterventionDays || rangeDays));
}

function deriveHorizonPlanSpend(monthlyPrice, horizonId) {
  if (monthlyPrice == null || !Number.isFinite(monthlyPrice)) return null;
  const option = HORIZON_OPTIONS.find((entry) => entry.id === horizonId);
  if (!option) return null;
  return Number((monthlyPrice * option.months).toFixed(2));
}

function deriveHorizonProjection(payload, horizonId, configured) {
  const { projection, activity, assumptions, trend, observedWindowDays } = payload;
  const planSpend = deriveHorizonPlanSpend(payload.currentPlan?.monthlyPrice, horizonId);

  if (!projection?.eligible) {
    return {
      planSpend,
      financialAvailable: false,
      buildingMessage:
        "More eligible protection activity is needed before BotShield can project financial impact for this horizon.",
    };
  }

  let window = null;
  if (horizonId === "30d") {
    window = projection.next30Days;
  } else if (horizonId === "1y") {
    window = projection.next12Months;
  } else if (horizonId === "6m") {
    const basisDays = deriveProjectionBasisDays(trend, observedWindowDays);
    const dailyInterventions = activity.interventions / basisDays;
    const dailyValue = configured
      ? (activity.threatsBlocked / basisDays) * assumptions.estimatedValuePerBlockedEvent +
        (activity.challengesIssued / basisDays) * assumptions.estimatedValuePerChallenge
      : null;
    window = {
      projectedInterventions: Math.round(dailyInterventions * 180),
      estimatedValueProtected:
        configured && dailyValue != null
          ? Number((dailyValue * 180).toFixed(2))
          : null,
    };
  }

  const estimatedValueProtected = configured ? window?.estimatedValueProtected ?? null : null;
  const projectedNetValue =
    configured && estimatedValueProtected != null && planSpend != null
      ? Number((estimatedValueProtected - planSpend).toFixed(2))
      : null;
  const projectedRoi =
    configured && projectedNetValue != null && planSpend > 0
      ? (projectedNetValue / planSpend) * 100
      : null;
  const projectedValueToCost =
    configured && estimatedValueProtected != null && planSpend > 0
      ? Number((estimatedValueProtected / planSpend).toFixed(2))
      : null;

  return {
    planSpend,
    financialAvailable: configured && estimatedValueProtected != null,
    buildingMessage: configured
      ? null
      : "Configure assumptions to unlock projected financial estimates.",
    projectedInterventions: window?.projectedInterventions ?? null,
    estimatedValueProtected,
    projectedNetValue,
    projectedRoi,
    projectedValueToCost,
  };
}

function hasObservedChartActivity(trend) {
  return trend.some(
    (bucket) => bucket.blocked > 0 || bucket.challenged > 0 || bucket.interventions > 0,
  );
}

function ValueTooltip({ tip, children }) {
  return (
    <span className="vv2-tooltip-wrap">
      {children}
      <button
        aria-label={tip}
        className="vv2-tooltip-trigger"
        type="button"
      >
        <svg aria-hidden="true" fill="none" height="12" viewBox="0 0 12 12" width="12">
          <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M6 5.2v3.3M6 3.6h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" />
        </svg>
      </button>
      <span className="vv2-tooltip-bubble" role="tooltip">
        {tip}
      </span>
    </span>
  );
}

function ValueMetric({
  label,
  value,
  tip,
  large = false,
  positive = false,
  strong = false,
  unavailable = false,
  sublabel,
}) {
  const labelNode = tip ? (
    <ValueTooltip tip={tip}>
      <span className="vv2-metric-label">{label}</span>
    </ValueTooltip>
  ) : (
    <span className="vv2-metric-label">{label}</span>
  );

  return (
    <div className={`vv2-metric${large ? " is-large" : ""}`}>
      {labelNode}
      <strong
        className={`vv2-metric-value vv2-metric-reveal${positive ? " is-positive" : ""}${
          strong ? " is-strong" : ""
        }${unavailable ? " is-unavailable" : ""}`}
      >
        {value}
      </strong>
      {sublabel ? <span className="vv2-metric-sublabel">{sublabel}</span> : null}
    </div>
  );
}

function ValueObservedChart({ trend, observationLabel, empty = false }) {
  if (empty) {
    return (
      <div className="vv2-observed-chart vv2-chart-inactive">
        <div className="vv2-chart-head">
          <div>
            <h3>Protection activity</h3>
            <p>{observationLabel}</p>
          </div>
        </div>
        <div className="vv2-chart-inactive-body" aria-hidden="true">
          <div className="vv2-chart-inactive-grid" />
          <div className="vv2-chart-inactive-line" />
          {trend.slice(0, 7).map((bucket) => (
            <span className="vv2-chart-inactive-dot" key={bucket.key} />
          ))}
        </div>
        <p className="vv2-chart-inactive-copy">
          No interventions recorded in the last 30 days.
        </p>
      </div>
    );
  }

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
      <ValueObservedChart
        empty={!hasActivity}
        observationLabel={observationLabel}
        trend={trend}
      />
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

function EstimateReadiness({
  monthlyPrice,
  configured,
  interventions,
  observedInterventionDays,
  projectionEligible,
  onConfigure,
}) {
  const checks = [
    {
      id: "plan",
      label: "Plan detected",
      complete: monthlyPrice != null,
    },
    {
      id: "assumptions",
      label: "Configure assumptions",
      complete: configured,
      action: !configured ? onConfigure : null,
    },
    {
      id: "activity",
      label: "Record intervention activity",
      complete: interventions > 0,
    },
    {
      id: "history",
      label: `Build ${PROJECTION_MIN_OBSERVED_DAYS} days of eligible history`,
      complete: observedInterventionDays >= PROJECTION_MIN_OBSERVED_DAYS,
      detail:
        observedInterventionDays > 0 &&
        observedInterventionDays < PROJECTION_MIN_OBSERVED_DAYS
          ? `${observedInterventionDays} of ${PROJECTION_MIN_OBSERVED_DAYS} days`
          : null,
    },
    {
      id: "projection",
      label: "Projection ready",
      complete: projectionEligible,
      detail: projectionEligible ? null : "Building estimate",
    },
  ];

  const currentIndex = checks.findIndex((check) => !check.complete);

  return (
    <section aria-labelledby="vv2-readiness-title" className="vv2-readiness">
      <h2 className="vv2-band-title" id="vv2-readiness-title">
        Estimate readiness
      </h2>
      <ol className="vv2-readiness-path">
        {checks.map((check, index) => {
          const state = check.complete
            ? "is-complete"
            : index === currentIndex
              ? "is-current"
              : "is-pending";
          return (
            <li className={`vv2-readiness-step ${state}`} key={check.id}>
              <span aria-hidden="true" className="vv2-readiness-node">
                {check.complete ? "✓" : index === currentIndex ? "●" : "○"}
              </span>
              <div className="vv2-readiness-copy">
                <span>{check.label}</span>
                {check.detail ? <small>{check.detail}</small> : null}
                {check.action ? (
                  <button
                    className="vv2-btn vv2-btn-primary vv2-btn-compact"
                    onClick={check.action}
                    type="button"
                  >
                    Set assumptions
                  </button>
                ) : null}
              </div>
              {index < checks.length - 1 ? (
                <span aria-hidden="true" className="vv2-readiness-connector" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
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
  const [horizon, setHorizon] = useState("30d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState(null);
  const [assumptionDraft, setAssumptionDraft] = useState(null);
  const [savingAssumptions, setSavingAssumptions] = useState(false);

  const loadValue = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await safeFetchJson(
        `/api/value?range=${encodeURIComponent(OBSERVED_RANGE)}`,
      );
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
  }, []);

  useEffect(() => {
    void loadValue();
  }, [loadValue]);

  const currency = payload?.currency || "USD";
  const configured = payload?.assumptionsConfigured;
  const economics = payload?.economics;
  const activity = payload?.activity;
  const monthlyPrice = payload?.currentPlan?.monthlyPrice;
  const planName = payload?.currentPlan?.name;
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
  const breakEvenInterventions = economics
    ? deriveBreakEvenInterventions(
        economics.allocatedPlanCost,
        estValuePerIntervention,
        configured,
      )
    : null;

  const horizonProjection = payload
    ? deriveHorizonProjection(payload, horizon, configured)
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
      await loadValue();
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
      await loadValue();
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

  const monthlyPlanLabel =
    monthlyPrice != null ? `${formatValueV2Currency(monthlyPrice, currency)} / month` : "—";

  return (
    <BotShieldNativePage heading="Value">
      <BotShieldPageShell className="botshield-value-v2-content">
        <div
          className="botshield-value-v2"
          data-value-layout="executive-spatial-roi"
          data-value-ui-revision="flagship-v7"
        >
          <header className="vv2-header">
            <div className="vv2-header-copy">
              <div className="vv2-header-title-row">
                <h1>Value</h1>
                {monthlyPrice != null ? (
                  <span className="vv2-plan-chip">
                    Current plan • {formatValueV2Currency(monthlyPrice, currency)} / month
                  </span>
                ) : null}
              </div>
              <p>Understand the financial impact of BotShield protection.</p>
            </div>
            <div className="vv2-header-actions">
              <button className="vv2-btn vv2-btn-secondary" onClick={openAssumptions} type="button">
                Edit assumptions
              </button>
              <button
                aria-label="Refresh Value data"
                className={`vv2-btn vv2-btn-icon${loading ? " is-spinning" : ""}`}
                disabled={loading}
                onClick={() => loadValue()}
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
            <div className={`vv2-page-content${loading ? " is-loading" : ""}`}>
              {payload.retentionMessage ? (
                <p className="vv2-retention-note">{payload.retentionMessage}</p>
              ) : null}

              <section
                aria-labelledby="vv2-command-title"
                className="vv2-command-center vv2-enter vv2-stage-1"
              >
                <div className="vv2-command-head">
                  <div>
                    <h2 className="vv2-band-title" id="vv2-command-title">
                      ROI command center
                    </h2>
                    <p className="vv2-command-subtitle">
                      {planName ? `${planName} • ` : ""}
                      {OBSERVED_WINDOW_LABEL} observed window
                    </p>
                  </div>
                  {!configured ? (
                    <button className="vv2-btn vv2-btn-primary" onClick={openAssumptions} type="button">
                      Set assumptions
                    </button>
                  ) : null}
                </div>

                <div className="vv2-command-grid">
                  <div className="vv2-command-primary">
                    <ValueMetric
                      label="Estimated protected value"
                      large
                      positive={configured && (economics.estimatedValueProtected || 0) > 0}
                      strong={configured && economics.estimatedValueProtected != null}
                      unavailable={!configured || economics.estimatedValueProtected == null}
                      tip={TOOLTIPS.protectedValue}
                      value={formatFinancial(
                        economics.estimatedValueProtected,
                        currency,
                        configured,
                      )}
                    />
                    <div className="vv2-command-secondary">
                      <ValueMetric
                        label="Estimated net value"
                        strong={configured && economics.estimatedNetValue != null}
                        unavailable={!configured || economics.estimatedNetValue == null}
                        tip={TOOLTIPS.netValue}
                        value={formatFinancial(
                          economics.estimatedNetValue,
                          currency,
                          configured,
                        )}
                      />
                      <ValueMetric
                        label="Estimated ROI"
                        strong={configured && estimatedRoi != null}
                        unavailable={!configured || estimatedRoi == null}
                        tip={TOOLTIPS.roi}
                        value={formatRoiPercent(estimatedRoi, configured)}
                      />
                      <ValueMetric
                        label="Est. value / $1 spent"
                        strong={configured && economics.valueToCostRatio != null}
                        unavailable={!configured || economics.valueToCostRatio == null}
                        tip={TOOLTIPS.valuePerDollar}
                        value={formatValueToCostRatio(economics.valueToCostRatio, configured)}
                      />
                    </div>
                  </div>

                  <div aria-label="Plan economics" className="vv2-command-plan">
                    <p className="vv2-plan-rail">Plan economics</p>
                    <ValueMetric
                      label="Current plan"
                      strong={monthlyPrice != null}
                      value={monthlyPlanLabel}
                    />
                    <ValueMetric
                      label="Selected period cost"
                      strong
                      value={formatValueV2Currency(economics.allocatedPlanCost, currency)}
                    />
                    <ValueMetric
                      label="Interventions"
                      strong
                      value={formatCount(activity.interventions)}
                    />
                    <div className="vv2-plan-compact">
                      <ValueMetric
                        label="Cost / intervention"
                        strong={costPerIntervention != null}
                        unavailable={costPerIntervention == null}
                        tip={TOOLTIPS.costPerIntervention}
                        value={formatPerUnit(costPerIntervention, currency, costPerIntervention != null)}
                      />
                      <ValueMetric
                        label="Est. value / intervention"
                        strong={configured && estValuePerIntervention != null}
                        unavailable={!configured || estValuePerIntervention == null}
                        tip={TOOLTIPS.estValuePerIntervention}
                        value={formatPerUnit(estValuePerIntervention, currency, configured)}
                      />
                      <ValueMetric
                        label="Break even"
                        strong={breakEvenInterventions != null}
                        unavailable={breakEvenInterventions == null}
                        tip={TOOLTIPS.breakEven}
                        value={
                          breakEvenInterventions != null
                            ? `${formatCount(breakEvenInterventions)} intervention${
                                breakEvenInterventions === 1 ? "" : "s"
                              }`
                            : "—"
                        }
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section aria-labelledby="vv2-horizon-title" className="vv2-horizon vv2-enter vv2-stage-2">
                <div className="vv2-horizon-head">
                  <div>
                    <h2 className="vv2-band-title" id="vv2-horizon-title">
                      Value horizon
                    </h2>
                    <p>See plan spend and eligible projected value over time.</p>
                  </div>
                  <div className="vv2-horizon-tabs" aria-label="Value projection horizon">
                    {HORIZON_OPTIONS.map((option) => (
                      <button
                        aria-pressed={horizon === option.id}
                        className={horizon === option.id ? "is-active" : ""}
                        key={option.id}
                        onClick={() => setHorizon(option.id)}
                        type="button"
                      >
                        {option.label}
                      </button>
                    ))}
                    <span
                      aria-hidden="true"
                      className="vv2-horizon-indicator"
                      style={{
                        transform: `translateX(${
                          HORIZON_OPTIONS.findIndex((option) => option.id === horizon) * 100
                        }%)`,
                      }}
                    />
                  </div>
                </div>

                {monthlyPrice != null ? (
                  <div aria-label="Plan spend" className="vv2-plan-spend-strip">
                    <span className="vv2-metric-label">Plan spend</span>
                    <div className="vv2-plan-spend-items">
                      <div className={horizon === "30d" ? "is-active" : ""}>
                        <span>Monthly</span>
                        <strong>{formatValueV2Currency(monthlyPrice, currency)}</strong>
                      </div>
                      <div className={horizon === "6m" ? "is-active" : ""}>
                        <span>6 months</span>
                        <strong>{formatValueV2Currency(monthlyPrice * 6, currency)}</strong>
                      </div>
                      <div className={horizon === "1y" ? "is-active" : ""}>
                        <span>12 months</span>
                        <strong>{formatValueV2Currency(monthlyPrice * 12, currency)}</strong>
                      </div>
                    </div>
                  </div>
                ) : null}

                <p className="vv2-horizon-summary-label">Selected horizon summary</p>
                <div className="vv2-horizon-body vv2-horizon-swap" key={`horizon-${horizon}`}>
                  <div className="vv2-horizon-metrics">
                    <ValueMetric
                      label="Plan spend"
                      strong={horizonProjection?.planSpend != null}
                      value={
                        horizonProjection?.planSpend != null
                          ? formatValueV2Currency(horizonProjection.planSpend, currency)
                          : "—"
                      }
                    />
                    <ValueMetric
                      label="Projected interventions"
                      strong={
                        horizonProjection?.financialAvailable &&
                        horizonProjection?.projectedInterventions != null
                      }
                      unavailable={
                        !horizonProjection?.financialAvailable ||
                        horizonProjection?.projectedInterventions == null
                      }
                      value={
                        horizonProjection?.financialAvailable &&
                        horizonProjection?.projectedInterventions != null
                          ? formatCount(horizonProjection.projectedInterventions)
                          : "—"
                      }
                    />
                    <ValueMetric
                      label="Est. protected value"
                      strong={
                        horizonProjection?.financialAvailable &&
                        horizonProjection?.estimatedValueProtected != null
                      }
                      unavailable={
                        !horizonProjection?.financialAvailable ||
                        horizonProjection?.estimatedValueProtected == null
                      }
                      tip={TOOLTIPS.projectedValue}
                      value={formatFinancial(
                        horizonProjection?.estimatedValueProtected,
                        currency,
                        horizonProjection?.financialAvailable,
                      )}
                    />
                    <ValueMetric
                      label="Est. net value"
                      strong={
                        horizonProjection?.financialAvailable &&
                        horizonProjection?.projectedNetValue != null
                      }
                      unavailable={
                        !horizonProjection?.financialAvailable ||
                        horizonProjection?.projectedNetValue == null
                      }
                      value={formatFinancial(
                        horizonProjection?.projectedNetValue,
                        currency,
                        horizonProjection?.financialAvailable,
                      )}
                    />
                    <ValueMetric
                      label="Est. ROI"
                      strong={
                        horizonProjection?.financialAvailable &&
                        horizonProjection?.projectedRoi != null
                      }
                      unavailable={
                        !horizonProjection?.financialAvailable ||
                        horizonProjection?.projectedRoi == null
                      }
                      value={formatRoiPercent(
                        horizonProjection?.projectedRoi,
                        horizonProjection?.financialAvailable,
                      )}
                    />
                    <ValueMetric
                      label="Value / cost"
                      strong={
                        horizonProjection?.financialAvailable &&
                        horizonProjection?.projectedValueToCost != null
                      }
                      unavailable={
                        !horizonProjection?.financialAvailable ||
                        horizonProjection?.projectedValueToCost == null
                      }
                      value={formatValueToCostRatio(
                        horizonProjection?.projectedValueToCost,
                        horizonProjection?.financialAvailable,
                      )}
                    />
                  </div>
                  {!horizonProjection?.financialAvailable && horizonProjection?.buildingMessage ? (
                    <div className="vv2-horizon-building">
                      <strong>Building estimate</strong>
                      <p>{horizonProjection.buildingMessage}</p>
                    </div>
                  ) : null}
                </div>
              </section>

              <section aria-labelledby="vv2-plan-value-title" className="vv2-plan-value vv2-enter vv2-stage-3">
                <h2 className="vv2-band-title" id="vv2-plan-value-title">
                  Plan vs value
                </h2>
                <div className="vv2-pv-flow" key={`pv-${configured}-${economics.estimatedValueProtected ?? "na"}`}>
                  <div className="vv2-pv-node vv2-pv-step-1">
                    <span className="vv2-metric-label">Plan spend</span>
                    <strong className="is-strong">{monthlyPlanLabel}</strong>
                  </div>
                  <span aria-hidden="true" className="vv2-pv-connector vv2-pv-line vv2-pv-step-2" />
                  <div className="vv2-pv-node vv2-pv-step-3">
                    <span className="vv2-metric-label">Est. protected value</span>
                    <strong
                      className={
                        configured && economics.estimatedValueProtected != null
                          ? "is-strong is-positive"
                          : "is-unavailable"
                      }
                    >
                      {formatFinancial(
                        economics.estimatedValueProtected,
                        currency,
                        configured,
                      )}
                    </strong>
                  </div>
                  <span aria-hidden="true" className="vv2-pv-connector vv2-pv-line vv2-pv-step-4" />
                  <div className="vv2-pv-node is-outcome vv2-pv-step-5">
                    <span className="vv2-metric-label">Est. net value</span>
                    <strong
                      className={
                        configured && economics.estimatedNetValue != null
                          ? "is-strong"
                          : "is-unavailable"
                      }
                    >
                      {formatFinancial(economics.estimatedNetValue, currency, configured)}
                    </strong>
                  </div>
                  <div className="vv2-pv-ratio vv2-pv-step-6">
                    <span className="vv2-metric-label">Value / cost</span>
                    <strong
                      className={
                        configured && economics.valueToCostRatio != null
                          ? "is-strong"
                          : "is-unavailable"
                      }
                    >
                      {formatValueToCostRatio(economics.valueToCostRatio, configured)}
                    </strong>
                  </div>
                </div>
              </section>

              <section
                aria-labelledby="vv2-observed-title"
                className="vv2-analytics-band vv2-enter vv2-stage-4"
              >
                <div className="vv2-band-head">
                  <h2 className="vv2-band-title" id="vv2-observed-title">
                    Observed protection
                  </h2>
                  <span className="vv2-window-label">{OBSERVED_WINDOW_LABEL}</span>
                </div>
                <ValueObservedSection
                  activity={activity}
                  observationLabel={OBSERVED_WINDOW_LABEL}
                  trend={payload.trend}
                />
              </section>

              <div className="vv2-lower-band vv2-enter vv2-stage-5">
                <section aria-labelledby="vv2-drivers-title" className="vv2-drivers-pane">
                  <div className="vv2-pane-head">
                    <h2 className="vv2-band-title" id="vv2-drivers-title">
                      Value drivers
                    </h2>
                    <p>Intervention categories ranked by observed activity.</p>
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
                              <span>{formatCount(row.interventions)} interventions</span>
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
                            {configured ? (
                              <strong className="vv2-driver-value">
                                {formatFinancial(
                                  row.estimatedValueProtected,
                                  currency,
                                  configured,
                                )}
                              </strong>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="vv2-drivers-empty">
                      <strong>No value drivers yet</strong>
                      <p>Drivers appear after BotShield records intervention activity.</p>
                      <div aria-hidden="true" className="vv2-drivers-placeholder">
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                  )}
                </section>

                <EstimateReadiness
                  configured={configured}
                  interventions={activity.interventions}
                  monthlyPrice={monthlyPrice}
                  observedInterventionDays={observedInterventionDays}
                  onConfigure={openAssumptions}
                  projectionEligible={payload.projection.eligible}
                />
              </div>

              <section className="vv2-methodology vv2-enter vv2-stage-5">
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
                  <div className="vv2-disclosure-grid">
                    <div>
                      <h4>Observed</h4>
                      <p>Actual BotShield storefront protection activity.</p>
                    </div>
                    <div>
                      <h4>Estimated</h4>
                      <p>Observed activity combined with merchant assumptions.</p>
                    </div>
                    <div>
                      <h4>Projected</h4>
                      <p>Eligible observed activity extended through the established projection model.</p>
                    </div>
                    <div>
                      <h4>Plan cost</h4>
                      <p>Current Shopify subscription pricing.</p>
                    </div>
                  </div>
                  <p className="vv2-disclosure-trust">
                    Estimates are not guaranteed savings.
                  </p>
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
