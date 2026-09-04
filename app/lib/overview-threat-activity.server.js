const DEFAULT_PERIOD_DAYS = 90;

export function utcDateKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

export function buildThreatActivityDayBuckets(
  periodDays = DEFAULT_PERIOD_DAYS,
  now = new Date(),
) {
  return Array.from({ length: periodDays }, (_, index) => {
    const date = new Date(now);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - (periodDays - 1 - index));
    return {
      date: utcDateKey(date),
      allowed: 0,
      challenged: 0,
      blocked: 0,
    };
  });
}

export function aggregateThreatActivityEvents(events, days) {
  const byDate = new Map(days.map((day) => [day.date, day]));
  for (const event of events) {
    const day = byDate.get(utcDateKey(event.createdAt));
    if (!day) continue;
    if (event.action === "blocked") day.blocked += 1;
    else if (event.action === "challenged") day.challenged += 1;
    else day.allowed += 1;
  }
  return days;
}

export function buildOverviewThreatActivityResponse(
  events,
  { periodDays = DEFAULT_PERIOD_DAYS, now = new Date() } = {},
) {
  const days = buildThreatActivityDayBuckets(periodDays, now);
  aggregateThreatActivityEvents(events, days);
  return { periodDays, days };
}

export { DEFAULT_PERIOD_DAYS as THREAT_ACTIVITY_PERIOD_DAYS };
