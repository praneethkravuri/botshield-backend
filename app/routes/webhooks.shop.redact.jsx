import { authenticate } from "../shopify.server";
import { logComplianceWebhook } from "../lib/personal-data-access-audit.server.js";
import { deleteShopScopedData } from "../lib/shop-redact.server.js";
import db from "../db.server";

export const action = async ({ request }) => {
  const { payload, shop, topic } = await authenticate.webhook(request);
  const shopDomain = shop || payload?.shop_domain;

  const result = await deleteShopScopedData(db, shopDomain);

  logComplianceWebhook({
    shop: shopDomain,
    topic,
    outcome: result.deleted ? "shop_data_deleted" : "no_shop_domain",
    detail: result.deleted
      ? `deleted sessions=${result.counts.sessions} events=${result.counts.botEvents}`
      : null,
  });

  return new Response();
};
