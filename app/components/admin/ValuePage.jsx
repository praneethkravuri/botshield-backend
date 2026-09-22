/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatHydrationStableNumber } from "../../lib/hydration-safe-format.js";
import { safeFetchJson } from "../../lib/safe-fetch.js";
import {
  assumptionsAreConfigured,
  calculateValueV2Economics,
  formatValueV2Currency,
  sanitizeValueV2Assumptions,
} from "../../lib/value-v2-calculations.js";
import "../../styles/value-v2-page.css";
import {
  BotShieldBanner,
  BotShieldLoadingState,
  BotShieldNativeModal,
  BotShieldNativePage,
  BotShieldPageShell,
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
    "Estimated protected value from your saved assumptions applied to observed BotShield activity.",
  netValue: "Estimated protected value minus BotShield cost for the selected period.",
  roi: "Estimated ROI uses your saved assumptions and BotShield's selected-period cost.",
  valuePerDollar: "Estimated protected value per $1 of BotShield cost.",
  costPerIntervention: "Selected-period BotShield cost divided by observed interventions.",
  estValuePerIntervention:
    "Estimated protected value divided by observed interventions.",
  projectedValue: "Forward-looking estimate using eligible observed activity and your assumptions.",
  breakEven:
    "Estimated interventions required for protected value to equal BotShield cost, based on your assumptions.",
  editAssumptions:
    "Review the business assumptions used for your financial estimates.",
};

function buildAssumptionDraftFromPayload(payload) {
  return {
    estimatedValuePerBlockedEvent:
      payload?.assumptions?.estimatedValuePerBlockedEvent ?? 0,
    estimatedValuePerChallenge:
      payload?.assumptions?.estimatedValuePerChallenge ?? 0,
    staffMinutesSavedPerIntervention:
      payload?.assumptions?.staffMinutesSavedPerIntervention ?? 0,
    staffHourlyCost: payload?.assumptions?.staffHourlyCost ?? 0,
  };
}

function isAssumptionFieldInvalid(value) {
  const numeric = Number(value);
  return !Number.isFinite(numeric) || numeric < 0;
}

function deriveAssumptionPreview(draft, activity, allocatedPlanCost) {
  const assumptions = sanitizeValueV2Assumptions({
    estimatedValuePerBlockedEvent: Number(draft?.estimatedValuePerBlockedEvent || 0),
    estimatedValuePerChallenge: Number(draft?.estimatedValuePerChallenge || 0),
    staffMinutesSavedPerIntervention: Number(
      draft?.staffMinutesSavedPerIntervention || 0,
    ),
    staffHourlyCost: Number(draft?.staffHourlyCost || 0),
    merchantConfigured: true,
  });
  const configured = assumptionsAreConfigured(assumptions);
  const blockedValue =
    activity.threatsBlocked * assumptions.estimatedValuePerBlockedEvent;
  const challengedValue =
    activity.challengesIssued * assumptions.estimatedValuePerChallenge;
  const staffValue =
    assumptions.staffMinutesSavedPerIntervention > 0 &&
    assumptions.staffHourlyCost > 0 &&
    activity.interventions > 0
      ? ((activity.interventions * assumptions.staffMinutesSavedPerIntervention) /
          60) *
        assumptions.staffHourlyCost
      : 0;
  const economics = calculateValueV2Economics({
    activity,
    assumptions,
    allocatedPlanCost,
    assumptionsConfigured: configured,
  });

  return {
    assumptions,
    configured,
    blockedValue,
    challengedValue,
    staffValue,
    economics,
  };
}

function resolvePlanDisplayName(planName) {
  const trimmed = String(planName || "").trim();
  return trimmed || "Current plan";
}

function deriveValueStatus({ configured, interventions, projectionEligible, estimateAvailable }) {
  if (!configured) {
    return { id: "needs-assumptions", label: "Needs assumptions" };
  }
  if (interventions <= 0) {
    return { id: "observing", label: "Observing" };
  }
  if (!estimateAvailable && !projectionEligible) {
    return { id: "building-history", label: "Building history" };
  }
  if (estimateAvailable && !projectionEligible) {
    return { id: "estimate-available", label: "Estimate available" };
  }
  if (projectionEligible) {
    return { id: "projection-available", label: "Projection available" };
  }
  return { id: "observing", label: "Observing" };
}

function resolveUnavailableReason(metricId, context) {
  const {
    configured,
    interventions,
    allocatedPlanCost,
    projectionEligible,
    horizonFinancialAvailable,
  } = context;

  switch (metricId) {
    case "protectedValue":
      if (!configured) {
        return "Configure financial assumptions to estimate protected value.";
      }
      return "Add assumed values for blocked events, challenged events, or staff time savings.";
    case "netValue":
      if (!configured) {
        return "Configure assumptions first. Net value requires an estimated protected value.";
      }
      return "Net value appears once estimated protected value is available.";
    case "roi":
      if (!configured) {
        return "Configure assumptions to calculate ROI.";
      }
      if (!(allocatedPlanCost > 0)) {
        return "ROI requires a positive selected-period BotShield cost.";
      }
      return "ROI appears once estimated net value is available.";
    case "valuePerDollar":
      if (!configured) {
        return "Configure assumptions to calculate value per $1 spent.";
      }
      if (!(allocatedPlanCost > 0)) {
        return "Value per $1 spent requires a positive selected-period BotShield cost.";
      }
      return "Value per $1 spent appears once estimated protected value is available.";
    case "costPerIntervention":
      if (interventions <= 0) {
        return "Cost per intervention appears after at least one intervention is recorded.";
      }
      return "Cost per intervention requires a valid selected-period BotShield cost.";
    case "estValuePerIntervention":
      if (!configured) {
        return "Configure assumptions to estimate value per intervention.";
      }
      if (interventions <= 0) {
        return "Value per intervention appears after at least one intervention is recorded.";
      }
      return "Value per intervention requires an estimated protected value.";
    case "breakEven":
      if (!configured) {
        return "Configure assumptions to estimate break-even interventions.";
      }
      if (interventions <= 0) {
        return "Break-even appears after interventions and estimated value per intervention exist.";
      }
      return "Break-even requires a positive estimated value per intervention.";
    case "projectedInterventions":
      if (!projectionEligible) {
        return "Projection unlocks after enough eligible intervention history is recorded.";
      }
      return "Projected interventions appear when projection is eligible.";
    case "projectedProtectedValue":
      if (!configured) {
        return "Configure assumptions to unlock projected financial estimates.";
      }
      if (!projectionEligible) {
        return "Projection unlocks after enough eligible intervention history is recorded.";
      }
      return "Projected protected value appears when projection is eligible.";
    case "projectedNetValue":
    case "projectedRoi":
    case "projectedValueToCost":
      if (!configured) {
        return "Configure assumptions to unlock projected financial estimates.";
      }
      if (!horizonFinancialAvailable) {
        return "Projected financial values appear when projection is eligible for this horizon.";
      }
      return "Projected value appears when enough eligible history exists.";
    default:
      return "This metric is unavailable until required data is present.";
  }
}

function formatDataThrough(isoDate) {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

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
  unavailableTip,
  eyebrow,
  provenanceChip,
  large = false,
  positive = false,
  negative = false,
  strong = false,
  unavailable = false,
  sublabel,
  helpText,
  align = "left",
  settleKey,
}) {
  const effectiveTip = unavailable && unavailableTip ? unavailableTip : tip;
  const labelNode = effectiveTip ? (
    <ValueTooltip tip={effectiveTip}>
      <span className="vv2-metric-label">{label}</span>
    </ValueTooltip>
  ) : (
    <span className="vv2-metric-label">{label}</span>
  );

  return (
    <div
      className={`vv2-metric${large ? " is-large" : ""}${
        align === "right" ? " is-align-right" : ""
      }${effectiveTip ? " has-tooltip" : ""}`}
    >
      {eyebrow ? <span className="vv2-eyebrow">{eyebrow}</span> : null}
      <div className="vv2-metric-label-row">
        {labelNode}
        {provenanceChip ? (
          <span className="vv2-provenance-chip">{provenanceChip}</span>
        ) : null}
      </div>
      <strong
        className={`vv2-metric-value vv2-metric-reveal${positive ? " is-positive" : ""}${
          negative ? " is-negative" : ""
        }${strong ? " is-strong" : ""}${
          unavailable ? " is-unavailable" : ""
        }${settleKey ? " is-settling" : ""}`}
        key={settleKey ? `${label}-${settleKey}` : undefined}
      >
        {value}
      </strong>
      {helpText ? <span className="vv2-metric-help">{helpText}</span> : null}
      {sublabel ? <span className="vv2-metric-sublabel">{sublabel}</span> : null}
    </div>
  );
}

function ProtectionDeliveredStrip({ activity }) {
  return (
    <div aria-label="Protection delivered" className="vv2-protection-delivered">
      <span className="vv2-eyebrow">Protection delivered</span>
      <div className="vv2-protection-delivered-row">
        <div>
          <span className="vv2-metric-label">Detected</span>
          <strong>{formatCount(activity.threatsDetected)}</strong>
        </div>
        <div>
          <span className="vv2-metric-label">Blocked</span>
          <strong>{formatCount(activity.threatsBlocked)}</strong>
        </div>
        <div>
          <span className="vv2-metric-label">Challenged</span>
          <strong>{formatCount(activity.challengesIssued)}</strong>
        </div>
        <div>
          <span className="vv2-metric-label">Interventions</span>
          <strong>{formatCount(activity.interventions)}</strong>
        </div>
      </div>
      <p className="vv2-metric-help">
        Observed BotShield activity in the last 30 days — separate from estimated financial impact.
      </p>
    </div>
  );
}

function LiveDataTrustRail({
  configured,
  interventions,
  monthlyPrice,
  currency,
  projectionEligible,
  latestObservedAt,
  refreshing,
}) {
  const dataThrough = formatDataThrough(latestObservedAt);
  const items = ["Live shop data"];

  if (monthlyPrice != null) {
    items.push(`Current plan • ${formatValueV2Currency(monthlyPrice, currency)}/mo`);
  }

  items.push("Last 30 days observed");
  items.push(configured ? "Assumptions configured" : "Assumptions need setup");
  items.push(`${formatCount(interventions)} interventions`);
  items.push(projectionEligible ? "Projection ready" : "Projection building");

  return (
    <div
      aria-label="Live data trust rail"
      className={`vv2-trust-rail${refreshing ? " is-refreshing" : ""}`}
    >
      {items.map((item, index) => (
        <span className="vv2-trust-item" key={item}>
          {index > 0 ? <span aria-hidden="true" className="vv2-trust-dot" /> : null}
          {item}
        </span>
      ))}
      {dataThrough ? (
        <>
          <span aria-hidden="true" className="vv2-trust-dot" />
          <span className="vv2-trust-item">Data through {dataThrough}</span>
        </>
      ) : null}
    </div>
  );
}

function ValueStatusBadge({ status }) {
  return (
    <span className={`vv2-value-status is-${status.id}`} data-value-status={status.id}>
      <span aria-hidden="true" className="vv2-value-status-dot" />
      Value status · {status.label}
    </span>
  );
}

function CalculationMethodology({
  configured,
  assumptions,
  currency,
  activity,
  economics,
  retentionDays,
  billingVerified,
  onEditAssumptions,
}) {
  const showTrace =
    configured &&
    economics.estimatedValueProtected != null &&
    economics.allocatedPlanCost != null;

  return (
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
        <div className="vv2-disclosure-body">
          <div className="vv2-disclosure-grid">
            <div>
              <h4>Observed data</h4>
              <p>What BotShield directly measured from storefront protection activity.</p>
            </div>
            <div>
              <h4>Assumptions</h4>
              <p>Merchant-configured inputs used to translate activity into estimated value.</p>
            </div>
            <div>
              <h4>Estimated protected value</h4>
              <p>
                Blocked and challenged events multiplied by your assumed values, plus optional
                staff time savings.
              </p>
            </div>
            <div>
              <h4>Net value</h4>
              <p>Estimated protected value minus selected-period BotShield cost.</p>
            </div>
            <div>
              <h4>ROI</h4>
              <p>Estimated net value divided by selected-period BotShield cost.</p>
            </div>
            <div>
              <h4>Value / $1</h4>
              <p>Estimated protected value divided by selected-period BotShield cost.</p>
            </div>
            <div>
              <h4>Projections</h4>
              <p>
                Unlock after meaningful intervention activity across at least 7 eligible days.
                Uses normalized daily rates from observed history.
              </p>
            </div>
            <div>
              <h4>Data window</h4>
              <p>
                Observed BotShield activity is retained for {retentionDays} days. Value uses the
                last 30 days.
              </p>
            </div>
            <div>
              <h4>Plan cost</h4>
              <p>
                {billingVerified
                  ? "Comes from your current Shopify billing information."
                  : "Based on configured Shopify billing pricing for your shop."}
              </p>
            </div>
          </div>

          <div className="vv2-assumptions-used">
            <h4>Assumptions used</h4>
            {configured ? (
              <>
                <dl className="vv2-assumptions-used-list">
                  <div>
                    <dt>Estimated value per blocked event</dt>
                    <dd>
                      {formatValueV2Currency(assumptions.estimatedValuePerBlockedEvent, currency)}
                    </dd>
                  </div>
                  <div>
                    <dt>Estimated value per challenged event</dt>
                    <dd>
                      {formatValueV2Currency(assumptions.estimatedValuePerChallenge, currency)}
                    </dd>
                  </div>
                  <div>
                    <dt>Staff minutes saved per intervention</dt>
                    <dd>{formatCount(assumptions.staffMinutesSavedPerIntervention)}</dd>
                  </div>
                  <div>
                    <dt>Staff hourly cost</dt>
                    <dd>{formatValueV2Currency(assumptions.staffHourlyCost, currency)}</dd>
                  </div>
                </dl>
                <button
                  className="vv2-btn vv2-btn-secondary vv2-btn-compact"
                  onClick={onEditAssumptions}
                  type="button"
                >
                  Edit assumptions
                </button>
              </>
            ) : (
              <>
                <p>Financial assumptions have not been configured.</p>
                <button
                  className="vv2-btn vv2-btn-secondary vv2-btn-compact"
                  onClick={onEditAssumptions}
                  type="button"
                >
                  Set assumptions
                </button>
              </>
            )}
          </div>

          {showTrace ? (
            <div aria-label="Calculation path" className="vv2-calc-trace">
              <div>
                <span className="vv2-metric-label">Observed</span>
                <strong>{formatCount(activity.interventions)} interventions</strong>
              </div>
              <span aria-hidden="true" className="vv2-calc-trace-op">
                +
              </span>
              <div>
                <span className="vv2-metric-label">Your assumptions</span>
                <strong>Configured merchant inputs</strong>
              </div>
              <span aria-hidden="true" className="vv2-calc-trace-op">
                =
              </span>
              <div>
                <span className="vv2-metric-label">Est. protected value</span>
                <strong>
                  {formatFinancial(economics.estimatedValueProtected, currency, configured)}
                </strong>
              </div>
              <span aria-hidden="true" className="vv2-calc-trace-op">
                −
              </span>
              <div>
                <span className="vv2-metric-label">BotShield cost</span>
                <strong>{formatValueV2Currency(economics.allocatedPlanCost, currency)}</strong>
              </div>
              <span aria-hidden="true" className="vv2-calc-trace-op">
                =
              </span>
              <div>
                <span className="vv2-metric-label">Est. net value</span>
                <strong>{formatFinancial(economics.estimatedNetValue, currency, configured)}</strong>
              </div>
            </div>
          ) : null}

          <p className="vv2-disclosure-trust">Estimates are not guaranteed savings.</p>
        </div>
      </details>
    </section>
  );
}

function ValuePeriodSnapshot({ economics, currency, configured }) {
  if (!configured || economics.estimatedValueProtected == null) {
    return null;
  }

  return (
    <div aria-label="Value snapshot for this period" className="vv2-value-snapshot">
      <span className="vv2-eyebrow">This period</span>
      <div className="vv2-value-snapshot-row">
        <div>
          <span className="vv2-metric-label">BotShield cost</span>
          <strong>{formatValueV2Currency(economics.allocatedPlanCost, currency)}</strong>
        </div>
        <div>
          <span className="vv2-metric-label">Estimated protected value</span>
          <strong className="is-positive">
            {formatFinancial(economics.estimatedValueProtected, currency, configured)}
          </strong>
        </div>
        <div>
          <span className="vv2-metric-label">Estimated net value</span>
          <strong>
            {formatFinancial(economics.estimatedNetValue, currency, configured)}
          </strong>
        </div>
      </div>
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
        <span className="vv2-eyebrow">Observed</span>
        <h3>Observed summary</h3>
        <dl>
          <div className="is-detected">
            <dt>Detected</dt>
            <dd>{formatCount(activity.threatsDetected)}</dd>
          </div>
          <div className="is-blocked">
            <dt>Blocked</dt>
            <dd>{formatCount(activity.threatsBlocked)}</dd>
          </div>
          <div className="is-challenged">
            <dt>Challenged</dt>
            <dd>{formatCount(activity.challengesIssued)}</dd>
          </div>
          <div className="is-interventions">
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
  deferAssumptionsCta = false,
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
      <span className="vv2-eyebrow">Readiness</span>
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
                  deferAssumptionsCta ? (
                    <button
                      className="vv2-link-btn"
                      onClick={check.action}
                      type="button"
                    >
                      Set assumptions
                    </button>
                  ) : (
                    <button
                      className="vv2-btn vv2-btn-primary vv2-btn-compact"
                      onClick={check.action}
                      type="button"
                    >
                      Set assumptions
                    </button>
                  )
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

function AssumptionInputField({
  id,
  label,
  helper,
  prefix,
  suffix,
  value,
  onChange,
  invalid,
}) {
  return (
    <div className={`vv2-assumption-input${invalid ? " is-invalid" : ""}`}>
      <label className="vv2-assumption-input-label" htmlFor={id}>
        {label}
      </label>
      <div className="vv2-assumption-input-control">
        {prefix ? (
          <span aria-hidden="true" className="vv2-assumption-affix">
            {prefix}
          </span>
        ) : null}
        <input
          aria-invalid={invalid || undefined}
          autoComplete="off"
          id={id}
          inputMode="decimal"
          min="0"
          onChange={onChange}
          step="any"
          type="number"
          value={value}
        />
        {suffix ? (
          <span aria-hidden="true" className="vv2-assumption-affix">
            {suffix}
          </span>
        ) : null}
      </div>
      {helper ? <p className="vv2-assumption-input-help">{helper}</p> : null}
      {invalid ? (
        <p className="vv2-assumption-input-error">Enter a valid non-negative number.</p>
      ) : null}
    </div>
  );
}

function AssumptionsPreview({
  activity,
  allocatedPlanCost,
  currency,
  draft,
  previewTick,
}) {
  const preview = useMemo(
    () => deriveAssumptionPreview(draft, activity, allocatedPlanCost),
    [activity, allocatedPlanCost, draft],
  );
  const { assumptions, configured, blockedValue, challengedValue, staffValue, economics } =
    preview;
  const hasInterventions = activity.interventions > 0;
  const showBlockedRow =
    assumptions.estimatedValuePerBlockedEvent > 0 && activity.threatsBlocked > 0;
  const showChallengedRow =
    assumptions.estimatedValuePerChallenge > 0 && activity.challengesIssued > 0;
  const showStaffRow =
    assumptions.staffMinutesSavedPerIntervention > 0 &&
    assumptions.staffHourlyCost > 0 &&
    activity.interventions > 0;

  return (
    <aside aria-label="Live estimate preview" className="vv2-assumptions-preview vv2-assumptions-modal-enter-preview">
      <span className="vv2-eyebrow">Live estimate preview</span>
      <p className="vv2-assumptions-preview-lead">
        Using your last 30 days of BotShield activity
      </p>

      <dl className="vv2-assumptions-preview-activity">
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

      {!hasInterventions ? (
        <div className="vv2-assumptions-preview-empty-state">
          <strong>No interventions yet</strong>
          <p>
            BotShield hasn&apos;t recorded an eligible intervention in the last 30 days.
          </p>
          <p>
            Your assumptions can still be saved and will apply automatically as eligible
            protection activity is recorded.
          </p>
        </div>
      ) : null}

      {configured && hasInterventions ? (
        <div className="vv2-assumptions-preview-formula">
          {showBlockedRow ? (
            <div className="vv2-preview-formula-row" key={`blocked-${previewTick}`}>
              <span>Blocked value</span>
              <strong>
                {formatCount(activity.threatsBlocked)} ×{" "}
                {formatValueV2Currency(assumptions.estimatedValuePerBlockedEvent, currency)}
              </strong>
              <strong className="vv2-preview-formula-result">
                {formatValueV2Currency(blockedValue, currency)}
              </strong>
            </div>
          ) : null}
          {showChallengedRow ? (
            <div className="vv2-preview-formula-row" key={`challenged-${previewTick}`}>
              <span>Challenged value</span>
              <strong>
                {formatCount(activity.challengesIssued)} ×{" "}
                {formatValueV2Currency(assumptions.estimatedValuePerChallenge, currency)}
              </strong>
              <strong className="vv2-preview-formula-result">
                {formatValueV2Currency(challengedValue, currency)}
              </strong>
            </div>
          ) : null}
          {showStaffRow ? (
            <div className="vv2-preview-formula-row" key={`staff-${previewTick}`}>
              <span>Staff time</span>
              <strong>
                {formatCount(activity.interventions)} ×{" "}
                {formatCount(assumptions.staffMinutesSavedPerIntervention)} min @{" "}
                {formatValueV2Currency(assumptions.staffHourlyCost, currency)}/hr
              </strong>
              <strong className="vv2-preview-formula-result">
                {formatValueV2Currency(staffValue, currency)}
              </strong>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="vv2-assumptions-preview-total">
        <span className="vv2-metric-label">Estimated protected value</span>
        <strong
          className={`vv2-preview-value${previewTick ? " is-updating" : ""}`}
          key={`preview-total-${previewTick}`}
        >
          {configured && hasInterventions && economics.estimatedValueProtected != null
            ? formatValueV2Currency(economics.estimatedValueProtected, currency)
            : "—"}
        </strong>
        <p className="vv2-assumptions-preview-note">
          Based on the assumptions currently entered above.
        </p>
      </div>
    </aside>
  );
}

function AssumptionsModal({
  activity,
  allocatedPlanCost,
  currency,
  draft,
  open,
  onClose,
  onReset,
  onSave,
  saving,
  setDraft,
}) {
  const [previewTick, setPreviewTick] = useState(0);
  const fieldInvalid = {
    estimatedValuePerBlockedEvent: isAssumptionFieldInvalid(
      draft.estimatedValuePerBlockedEvent,
    ),
    estimatedValuePerChallenge: isAssumptionFieldInvalid(draft.estimatedValuePerChallenge),
    staffMinutesSavedPerIntervention: isAssumptionFieldInvalid(
      draft.staffMinutesSavedPerIntervention,
    ),
    staffHourlyCost: isAssumptionFieldInvalid(draft.staffHourlyCost),
  };
  const hasInvalidFields = Object.values(fieldInvalid).some(Boolean);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPreviewTick((current) => current + 1);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [draft]);

  return (
    <BotShieldNativeModal
      accessibilityLabel="Value assumptions"
      bodyClassName="vv2-assumptions-modal-shell"
      heading="Value assumptions"
      id={VALUE_ASSUMPTIONS_MODAL_ID}
      onAfterHide={onClose}
      open={open}
      padding="none"
      size="large"
    >
      <div className="vv2-assumptions-modal vv2-assumptions-modal-v11">
        <p className="vv2-assumptions-modal-subtitle vv2-assumptions-modal-enter-subtitle">
          Define how BotShield should estimate the business value of your protection activity.
        </p>

        <div
          aria-label="Why assumptions are needed"
          className="vv2-assumptions-trust-strip vv2-assumptions-modal-enter-trust"
        >
          <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 16 16" width="16">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M8 7v4M8 5.5h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" />
          </svg>
          <div>
            <p>BotShield measures protection activity automatically.</p>
            <p>
              These assumptions tell BotShield what that activity may be worth to your
              business.
            </p>
            <small>Financial results are estimates based on the values you provide.</small>
          </div>
        </div>

        <div className="vv2-assumptions-modal-body">
          <div className="vv2-assumptions-modal-columns">
            <div className="vv2-assumptions-modal-left">
              <section className="vv2-assumptions-section vv2-assumptions-modal-enter-protection">
                <h3 className="vv2-assumptions-section-title">Protection value</h3>
                <p className="vv2-assumptions-section-lead">
                  Estimate the business value associated with BotShield handling harmful or
                  suspicious activity.
                </p>
                <div className="vv2-assumptions-field-grid">
                  <AssumptionInputField
                    helper="Estimated value protected when BotShield blocks one harmful event."
                    id="vv2-assumption-blocked"
                    invalid={fieldInvalid.estimatedValuePerBlockedEvent}
                    label="Blocked harmful event"
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        estimatedValuePerBlockedEvent: event.target.value,
                      }))
                    }
                    prefix="$"
                    value={String(draft.estimatedValuePerBlockedEvent ?? 0)}
                  />
                  <AssumptionInputField
                    helper="Estimated value associated with one suspicious event BotShield challenges."
                    id="vv2-assumption-challenged"
                    invalid={fieldInvalid.estimatedValuePerChallenge}
                    label="Challenged event"
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        estimatedValuePerChallenge: event.target.value,
                      }))
                    }
                    prefix="$"
                    value={String(draft.estimatedValuePerChallenge ?? 0)}
                  />
                </div>
              </section>

              <section className="vv2-assumptions-section vv2-assumptions-modal-enter-staff">
                <h3 className="vv2-assumptions-section-title">Staff time value</h3>
                <p className="vv2-assumptions-section-lead">
                  Optionally include time your team may save when BotShield handles an
                  intervention.
                </p>
                <div className="vv2-assumptions-field-grid">
                  <AssumptionInputField
                    helper="Estimated manual review or response time avoided per intervention."
                    id="vv2-assumption-minutes"
                    invalid={fieldInvalid.staffMinutesSavedPerIntervention}
                    label="Minutes saved per intervention"
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        staffMinutesSavedPerIntervention: event.target.value,
                      }))
                    }
                    suffix="min"
                    value={String(draft.staffMinutesSavedPerIntervention ?? 0)}
                  />
                  <AssumptionInputField
                    helper="Used only to estimate the value of staff time saved."
                    id="vv2-assumption-hourly"
                    invalid={fieldInvalid.staffHourlyCost}
                    label="Staff hourly cost"
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        staffHourlyCost: event.target.value,
                      }))
                    }
                    prefix="$"
                    value={String(draft.staffHourlyCost ?? 0)}
                  />
                </div>
              </section>
            </div>

            <AssumptionsPreview
              activity={activity}
              allocatedPlanCost={allocatedPlanCost}
              currency={currency}
              draft={draft}
              previewTick={previewTick}
            />
          </div>
        </div>

        <footer className="vv2-assumptions-modal-footer vv2-assumptions-modal-enter-footer">
          <button
            className="vv2-btn vv2-btn-tertiary"
            disabled={saving}
            onClick={onReset}
            type="button"
          >
            Reset
          </button>
          <div className="vv2-assumptions-modal-footer-actions">
            <button
              className="vv2-btn vv2-btn-secondary"
              disabled={saving}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="vv2-btn vv2-btn-primary vv2-btn-save-assumptions"
              disabled={saving || hasInvalidFields}
              onClick={onSave}
              type="button"
            >
              {saving ? (
                <>
                  <span aria-hidden="true" className="vv2-btn-spinner" />
                  Saving…
                </>
              ) : (
                "Save assumptions"
              )}
            </button>
          </div>
        </footer>
      </div>
    </BotShieldNativeModal>
  );
}

export default function ValuePage() {
  const toast = useBotShieldToast();
  const assumptionsOpenerRef = useRef(null);
  const [horizon, setHorizon] = useState("30d");
  const [horizonPress, setHorizonPress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState(null);
  const [assumptionsModalOpen, setAssumptionsModalOpen] = useState(false);
  const [assumptionDraft, setAssumptionDraft] = useState(null);
  const [savingAssumptions, setSavingAssumptions] = useState(false);
  const [dataSettleKey, setDataSettleKey] = useState(0);

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

  const closeAssumptions = useCallback(() => {
    setAssumptionsModalOpen(false);
    const opener = assumptionsOpenerRef.current;
    if (opener && typeof opener.focus === "function") {
      requestAnimationFrame(() => opener.focus());
    }
  }, []);

  const openAssumptions = useCallback(
    (event) => {
      if (!payload) {
        return;
      }
      assumptionsOpenerRef.current = event?.currentTarget ?? null;
      setAssumptionDraft(buildAssumptionDraftFromPayload(payload));
      setAssumptionsModalOpen(true);
    },
    [payload],
  );

  const saveAssumptions = async () => {
    if (
      isAssumptionFieldInvalid(assumptionDraft?.estimatedValuePerBlockedEvent) ||
      isAssumptionFieldInvalid(assumptionDraft?.estimatedValuePerChallenge) ||
      isAssumptionFieldInvalid(assumptionDraft?.staffMinutesSavedPerIntervention) ||
      isAssumptionFieldInvalid(assumptionDraft?.staffHourlyCost)
    ) {
      toast.error("Enter valid non-negative numbers for all assumption fields.");
      return;
    }

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
      closeAssumptions();
      toast.success("Value assumptions saved");
      setDataSettleKey((current) => current + 1);
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
      closeAssumptions();
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

  const planDisplayName = resolvePlanDisplayName(planName);
  const monthlyPlanLabel =
    monthlyPrice != null ? `${formatValueV2Currency(monthlyPrice, currency)} / month` : "—";
  const estimateAvailable =
    configured && economics?.estimatedValueProtected != null;
  const valueStatus = payload
    ? deriveValueStatus({
        configured,
        interventions: activity?.interventions || 0,
        projectionEligible: payload.projection?.eligible,
        estimateAvailable,
      })
    : null;
  const metricContext = {
    configured,
    interventions: activity?.interventions || 0,
    allocatedPlanCost: economics?.allocatedPlanCost || 0,
    projectionEligible: payload?.projection?.eligible,
    horizonFinancialAvailable: horizonProjection?.financialAvailable,
  };
  const billingVerified = payload?.currentPlan?.billingVerified;

  return (
    <BotShieldNativePage heading="Value">
      <BotShieldPageShell className="botshield-value-v2-content">
        <div
          className="botshield-value-v2"
          data-value-layout="assumptions-experience-v11"
          data-value-ui-revision="flagship-v11"
        >
          <header className="vv2-header vv2-header-enter">
            <div className="vv2-header-copy vv2-header-enter-copy">
              <div className="vv2-header-title-row">
                <h1 className="vv2-header-enter-title">Value</h1>
                {monthlyPrice != null ? (
                  <span className="vv2-plan-chip vv2-header-enter-chip">
                    {planDisplayName} • {formatValueV2Currency(monthlyPrice, currency)} / month
                  </span>
                ) : null}
              </div>
              <p className="vv2-header-enter-subtitle">
                Understand the financial impact of BotShield protection.
              </p>
            </div>
            <div className="vv2-header-actions vv2-header-enter-actions">
              <button
                className="vv2-btn vv2-btn-secondary"
                onClick={openAssumptions}
                title={TOOLTIPS.editAssumptions}
                type="button"
              >
                Edit assumptions
              </button>
              {loading && payload ? (
                <span aria-live="polite" className="vv2-refresh-label">
                  Refreshing…
                </span>
              ) : null}
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
            <div
              className={`vv2-page-content${
                loading && payload ? " is-refreshing" : ""
              }${loading && !payload ? " is-loading" : ""}${
                dataSettleKey ? " is-data-settling" : ""
              }`}
            >
              {payload.retentionMessage ? (
                <p className="vv2-retention-note">{payload.retentionMessage}</p>
              ) : null}

              <LiveDataTrustRail
                configured={configured}
                currency={currency}
                interventions={activity.interventions}
                latestObservedAt={payload.latestObservedAt}
                monthlyPrice={monthlyPrice}
                projectionEligible={payload.projection.eligible}
                refreshing={loading && Boolean(payload)}
              />

              <section
                aria-labelledby="vv2-command-title"
                className="vv2-command-center vv2-enter vv2-stage-1"
              >
                <span aria-hidden="true" className="vv2-command-accent" />
                <div className="vv2-command-head">
                  <div>
                    {valueStatus ? <ValueStatusBadge status={valueStatus} /> : null}
                    <h2 className="vv2-band-title" id="vv2-command-title">
                      ROI command center
                    </h2>
                    <p className="vv2-command-subtitle">
                      {planName?.trim() ? `${planName} • ` : ""}
                      {OBSERVED_WINDOW_LABEL} observed window
                      {billingVerified ? " · From Shopify billing" : ""}
                    </p>
                  </div>
                  {!configured ? (
                    <button className="vv2-btn vv2-btn-primary" onClick={openAssumptions} type="button">
                      Set assumptions
                    </button>
                  ) : null}
                </div>

                <ProtectionDeliveredStrip activity={activity} />

                <div className="vv2-command-grid">
                  <div className="vv2-command-primary vv2-financial-impact">
                    <ValueMetric
                      eyebrow="Estimated financial impact"
                      label="Estimated protected value"
                      large
                      positive={false}
                      provenanceChip={
                        configured ? "Based on your assumptions" : undefined
                      }
                      settleKey={dataSettleKey}
                      strong={configured && economics.estimatedValueProtected != null}
                      unavailable={!configured || economics.estimatedValueProtected == null}
                      tip={TOOLTIPS.protectedValue}
                      unavailableTip={resolveUnavailableReason("protectedValue", metricContext)}
                      value={formatFinancial(
                        economics.estimatedValueProtected,
                        currency,
                        configured,
                      )}
                      helpText={
                        configured
                          ? activity.interventions > 0
                            ? `Calculated from your saved assumptions and ${formatCount(activity.interventions)} recorded interventions.`
                            : "Calculated from your saved assumptions and current observed activity."
                          : "Set your business assumptions to estimate the financial impact of BotShield's recorded protection activity."
                      }
                    />
                    {configured && economics.estimatedValueProtected != null ? (
                      <>
                        <p className="vv2-assumption-disclaimer">
                          Your estimate reflects the business values you&apos;ve provided. It
                          does not represent the total value of BotShield protection.
                        </p>
                        <button
                          className="vv2-link-btn vv2-edit-assumptions-link"
                          onClick={openAssumptions}
                          type="button"
                        >
                          Edit assumptions
                        </button>
                      </>
                    ) : null}
                    <div className="vv2-command-secondary">
                      <div className="vv2-metric-col vv2-metric-col-1">
                        <ValueMetric
                          label="Estimated net value"
                          negative={
                            configured &&
                            economics.estimatedNetValue != null &&
                            economics.estimatedNetValue < 0
                          }
                          settleKey={dataSettleKey}
                          strong={configured && economics.estimatedNetValue != null}
                          unavailable={!configured || economics.estimatedNetValue == null}
                          tip={TOOLTIPS.netValue}
                          unavailableTip={resolveUnavailableReason("netValue", metricContext)}
                          value={formatFinancial(
                            economics.estimatedNetValue,
                            currency,
                            configured,
                          )}
                          helpText={
                            configured && economics.estimatedNetValue != null
                              ? "Calculated from your assumptions and BotShield cost."
                              : undefined
                          }
                        />
                      </div>
                      <div className="vv2-metric-col vv2-metric-col-2">
                        <ValueMetric
                          label="Estimated ROI"
                          settleKey={dataSettleKey}
                          strong={configured && estimatedRoi != null}
                          unavailable={!configured || estimatedRoi == null}
                          tip={TOOLTIPS.roi}
                          unavailableTip={resolveUnavailableReason("roi", metricContext)}
                          value={formatRoiPercent(estimatedRoi, configured)}
                        />
                      </div>
                      <div className="vv2-metric-col vv2-metric-col-3">
                        <ValueMetric
                          label="Est. value / $1 spent"
                          settleKey={dataSettleKey}
                          strong={configured && economics.valueToCostRatio != null}
                          unavailable={!configured || economics.valueToCostRatio == null}
                          tip={TOOLTIPS.valuePerDollar}
                          unavailableTip={resolveUnavailableReason("valuePerDollar", metricContext)}
                          value={formatValueToCostRatio(economics.valueToCostRatio, configured)}
                        />
                      </div>
                    </div>
                  </div>

                  <div aria-label="Plan economics" className="vv2-command-plan vv2-command-plan-enter">
                    <p className="vv2-plan-rail">Plan economics</p>
                    <ValueMetric
                      align="right"
                      label={planDisplayName}
                      strong={monthlyPrice != null}
                      sublabel={billingVerified ? "From Shopify billing" : undefined}
                      value={monthlyPlanLabel}
                    />
                    <ValueMetric
                      align="right"
                      label="Selected period cost"
                      strong
                      value={formatValueV2Currency(economics.allocatedPlanCost, currency)}
                    />
                    <ValueMetric
                      align="right"
                      label="Interventions"
                      strong
                      value={formatCount(activity.interventions)}
                    />
                    <div className="vv2-plan-compact">
                      <ValueMetric
                        align="right"
                        label="Cost / intervention"
                        strong={costPerIntervention != null}
                        unavailable={costPerIntervention == null}
                        tip={TOOLTIPS.costPerIntervention}
                        unavailableTip={resolveUnavailableReason("costPerIntervention", metricContext)}
                        value={formatPerUnit(costPerIntervention, currency, costPerIntervention != null)}
                      />
                      <ValueMetric
                        align="right"
                        label="Est. value / intervention"
                        settleKey={dataSettleKey}
                        strong={configured && estValuePerIntervention != null}
                        unavailable={!configured || estValuePerIntervention == null}
                        tip={TOOLTIPS.estValuePerIntervention}
                        unavailableTip={resolveUnavailableReason(
                          "estValuePerIntervention",
                          metricContext,
                        )}
                        value={formatPerUnit(estValuePerIntervention, currency, configured)}
                      />
                      <ValueMetric
                        align="right"
                        label="Break even"
                        settleKey={dataSettleKey}
                        strong={breakEvenInterventions != null}
                        unavailable={breakEvenInterventions == null}
                        tip={TOOLTIPS.breakEven}
                        unavailableTip={resolveUnavailableReason("breakEven", metricContext)}
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
                <ValuePeriodSnapshot
                  configured={configured}
                  currency={currency}
                  economics={economics}
                />
              </section>

              <section aria-labelledby="vv2-horizon-title" className="vv2-horizon vv2-enter vv2-stage-2">
                <div className="vv2-horizon-head">
                  <div>
                    <span className="vv2-eyebrow">Forward view</span>
                    <h2 className="vv2-band-title" id="vv2-horizon-title">
                      Value horizon
                    </h2>
                    <p>Compare plan spend with eligible projected protection value.</p>
                  </div>
                  <div className="vv2-horizon-tabs" aria-label="Value projection horizon">
                    {HORIZON_OPTIONS.map((option) => (
                      <button
                        aria-pressed={horizon === option.id}
                        className={`${horizon === option.id ? "is-active" : ""}${
                          horizonPress === option.id ? " is-pressed" : ""
                        }`}
                        key={option.id}
                        onClick={() => setHorizon(option.id)}
                        onPointerDown={() => setHorizonPress(option.id)}
                        onPointerLeave={() => setHorizonPress(null)}
                        onPointerUp={() => setHorizonPress(null)}
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
                  <div aria-label="Plan spend rail" className="vv2-plan-spend-rail">
                    <div className={horizon === "30d" ? "is-active" : ""}>
                      <span>Monthly</span>
                      <strong>{formatValueV2Currency(monthlyPrice, currency)}</strong>
                    </div>
                    <div className={horizon === "6m" ? "is-active" : ""}>
                      <span>6 months</span>
                      <strong>{formatValueV2Currency(monthlyPrice * 6, currency)}</strong>
                    </div>
                    <div className={horizon === "1y" ? "is-active" : ""}>
                      <span>1 year</span>
                      <strong>{formatValueV2Currency(monthlyPrice * 12, currency)}</strong>
                    </div>
                  </div>
                ) : null}

                <div className="vv2-horizon-body vv2-horizon-swap" key={`horizon-${horizon}`}>
                  <div className="vv2-horizon-metrics-primary">
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
                      unavailableTip={resolveUnavailableReason(
                        "projectedInterventions",
                        metricContext,
                      )}
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
                      unavailableTip={resolveUnavailableReason(
                        "projectedProtectedValue",
                        metricContext,
                      )}
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
                      unavailableTip={resolveUnavailableReason("projectedNetValue", metricContext)}
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
                      unavailableTip={resolveUnavailableReason("projectedRoi", metricContext)}
                      value={formatRoiPercent(
                        horizonProjection?.projectedRoi,
                        horizonProjection?.financialAvailable,
                      )}
                    />
                  </div>
                  <div className="vv2-horizon-metrics-secondary">
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
                      unavailableTip={resolveUnavailableReason(
                        "projectedValueToCost",
                        metricContext,
                      )}
                      value={formatValueToCostRatio(
                        horizonProjection?.projectedValueToCost,
                        horizonProjection?.financialAvailable,
                      )}
                    />
                  </div>
                  {!horizonProjection?.financialAvailable && horizonProjection?.buildingMessage ? (
                    <div className="vv2-horizon-building">
                      <span aria-hidden="true" className="vv2-horizon-building-icon" />
                      <div>
                        <strong>Building estimate</strong>
                        <p>{horizonProjection.buildingMessage}</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>

              <section aria-labelledby="vv2-plan-value-title" className="vv2-plan-value vv2-enter vv2-stage-3">
                <h2 className="vv2-band-title" id="vv2-plan-value-title">
                  Plan vs value
                </h2>
                <p className="vv2-plan-value-subtitle">
                  What you pay compared with eligible estimated protection value.
                </p>
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
                  <span aria-hidden="true" className="vv2-pv-connector vv2-pv-line vv2-pv-step-6" />
                  <div className="vv2-pv-node vv2-pv-ratio vv2-pv-step-7">
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
                  <div>
                    <span className="vv2-eyebrow">Observed</span>
                    <h2 className="vv2-band-title" id="vv2-observed-title">
                      Observed protection
                    </h2>
                  </div>
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
                  deferAssumptionsCta={!configured}
                  interventions={activity.interventions}
                  monthlyPrice={monthlyPrice}
                  observedInterventionDays={observedInterventionDays}
                  onConfigure={openAssumptions}
                  projectionEligible={payload.projection.eligible}
                />
              </div>

              <CalculationMethodology
                activity={activity}
                assumptions={payload.assumptions}
                billingVerified={billingVerified}
                configured={configured}
                currency={currency}
                economics={economics}
                onEditAssumptions={openAssumptions}
                retentionDays={payload.retentionDays}
              />
            </div>
          ) : null}
        </div>
      </BotShieldPageShell>

      {payload ? (
        <AssumptionsModal
          activity={activity}
          allocatedPlanCost={economics.allocatedPlanCost}
          currency={currency}
          draft={assumptionDraft ?? buildAssumptionDraftFromPayload(payload)}
          onClose={closeAssumptions}
          onReset={() => void resetAssumptions()}
          onSave={() => void saveAssumptions()}
          open={assumptionsModalOpen}
          saving={savingAssumptions}
          setDraft={setAssumptionDraft}
        />
      ) : null}
    </BotShieldNativePage>
  );
}
