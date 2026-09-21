import { readCachedBillingStatus } from "./billing.server.js";
import { BOT_EVENT_RETENTION_DAYS } from "../config/data-retention.js";
import { getValueV2Assumptions, saveValueV2Assumptions, resetValueV2Assumptions } from "./value-v2-assumptions.server.js";
import {
  buildValueV2DashboardPayload,
  normalizeValueV2Range,
} from "./value-v2-calculations.js";

function normalizeShop(shop) {
  return String(shop || "").trim().toLowerCase();
}

export async function buildValueV2Dashboard(db, shop, { range = "30d", now = new Date() } = {}) {
  const normalizedShop = normalizeShop(shop);
  const rangeId = normalizeValueV2Range(range);
  const retentionCutoff = new Date(
    now.getTime() - BOT_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );

  const [events, assumptions, billing] = await Promise.all([
    db.botEvent.findMany({
      where: {
        shop: normalizedShop,
        source: "storefront-proxy",
        createdAt: { gte: retentionCutoff },
      },
      select: {
        action: true,
        threatLevel: true,
        reasonSummary: true,
        createdAt: true,
        source: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    getValueV2Assumptions(normalizedShop, db),
    readCachedBillingStatus(normalizedShop),
  ]);

  const value = buildValueV2DashboardPayload({
    events,
    assumptions,
    billing,
    range: rangeId,
    now,
  });

  return {
    ...value,
    retentionMessage:
      value.retentionLimited
        ? `Observed BotShield activity is retained for ${BOT_EVENT_RETENTION_DAYS} days. Longer selections show the full retained window only.`
        : null,
  };
}

export { saveValueV2Assumptions, resetValueV2Assumptions, getValueV2Assumptions };
