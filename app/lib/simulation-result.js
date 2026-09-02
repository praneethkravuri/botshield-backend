function formatReasonCodes(reasonCodes = []) {
  return reasonCodes.filter(Boolean).join(", ");
}

function formatReasons(reasons = []) {
  return reasons.filter(Boolean).join(" · ");
}

export function getSimulationResultSummary(result) {
  if (!result) return "Simulation recorded";
  const action = result.actionTaken ?? result.action;
  const threat = result.threatLevel ? String(result.threatLevel) : "";
  if (action && threat) {
    return `Simulation ${action} · ${threat} threat`;
  }
  if (action) return `Simulation ${action}`;
  return "Simulation recorded";
}

export function buildSimulationResultFields(result) {
  if (!result) return [];

  const fields = [
    {
      id: "activity_type",
      label: "Activity type",
      value: "Simulation test",
    },
  ];

  if (result.createdAt) {
    fields.push({
      id: "recorded_at",
      label: "Recorded",
      value: result.createdAt,
    });
  }

  const decision = result.actionTaken ?? result.action;
  if (decision) {
    fields.push({
      id: "decision",
      label: "Decision",
      value: String(decision),
    });
  }

  if (result.threatLevel) {
    fields.push({
      id: "threat_level",
      label: "Threat level",
      value: String(result.threatLevel),
    });
  }

  if (result.riskScore != null && result.riskScore !== "") {
    fields.push({
      id: "risk_score",
      label: "Risk score",
      value: String(result.riskScore),
    });
  }

  if (result.ipAddress) {
    fields.push({
      id: "test_ip",
      label: "Test IP",
      value: String(result.ipAddress),
    });
  }

  if (result.pathVisited) {
    fields.push({
      id: "path",
      label: "Path",
      value: String(result.pathVisited),
    });
  }

  const reasonCodes = formatReasonCodes(result.reasonCodes);
  if (reasonCodes) {
    fields.push({
      id: "reason_codes",
      label: "Reason codes",
      value: reasonCodes,
    });
  }

  const reasons = formatReasons(result.reasons);
  if (reasons) {
    fields.push({
      id: "reasons",
      label: "Reasons",
      value: reasons,
    });
  }

  if (result.summary) {
    fields.push({
      id: "summary",
      label: "Summary",
      value: String(result.summary),
    });
  }

  if (result.id != null) {
    fields.push({
      id: "event_id",
      label: "Event ID",
      value: `#${result.id}`,
    });
  }

  if (result.source) {
    fields.push({
      id: "source",
      label: "Source",
      value: String(result.source),
    });
  }

  if (result.enforcementApplied === false) {
    fields.push({
      id: "enforcement",
      label: "Live enforcement",
      value: "Not changed",
    });
  }

  if (result.simulation === true) {
    fields.push({
      id: "metrics_isolation",
      label: "Live metrics",
      value: "Excluded from storefront metrics and reports",
    });
  }

  return fields;
}
