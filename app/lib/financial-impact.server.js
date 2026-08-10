const PERIOD_DAYS = 30;

function emptyFinancialImpact() {
  return {
    status: "unavailable",
    periodDays: PERIOD_DAYS,
    currencyCode: null,
    totalAmountMinor: null,
    qualifyingOrderCount: 0,
    series: [],
    methodology:
      "Calculated only from verified order-level records where BotShield can document the Shopify order value and a qualifying prevented financial-loss outcome.",
    unavailableReason:
      "No verified financial impact data yet. BotShield does not estimate value from traffic, blocked visitors, challenges, or risk scores.",
  };
}

export async function getEstimatedValueProtected(db, shop) {
  const impactStore = db?.financialImpactEvent;
  if (!impactStore || typeof impactStore.findMany !== "function") {
    return emptyFinancialImpact();
  }

  const periodStart = new Date(Date.now() - PERIOD_DAYS * 24 * 60 * 60 * 1000);
  const records = await impactStore.findMany({
    where: {
      shop,
      qualifiesForValueProtection: true,
      verifiedAt: { not: null },
      outcomeAt: { gte: periodStart },
    },
    orderBy: { outcomeAt: "asc" },
  });

  const validRecords = records.filter(
    (record) =>
      record.shopifyOrderId &&
      record.evidenceReference &&
      Number.isSafeInteger(Number(record.amountMinor)) &&
      Number(record.amountMinor) >= 0 &&
      record.currencyCode &&
      record.outcomeAt &&
      record.verifiedAt,
  );
  const currencies = new Set(validRecords.map((record) => record.currencyCode));
  if (!validRecords.length || currencies.size !== 1) return emptyFinancialImpact();

  const currencyCode = validRecords[0].currencyCode;
  const dailyTotals = new Map();
  for (const record of validRecords) {
    const day = new Date(record.outcomeAt).toISOString().slice(0, 10);
    dailyTotals.set(day, (dailyTotals.get(day) || 0) + Number(record.amountMinor));
  }

  return {
    status: "available",
    periodDays: PERIOD_DAYS,
    currencyCode,
    totalAmountMinor: validRecords.reduce(
      (total, record) => total + Number(record.amountMinor),
      0,
    ),
    qualifyingOrderCount: validRecords.length,
    series: Array.from(dailyTotals, ([date, amountMinor]) => ({ date, amountMinor })),
    methodology:
      "Sum of verified Shopify order values linked to qualifying prevented financial-loss outcomes during the selected period. Traffic and risk-event counts are excluded.",
    unavailableReason: null,
  };
}

