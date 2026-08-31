import { authenticate } from "../shopify.server";
import { logComplianceWebhook } from "../lib/personal-data-access-audit.server.js";

export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);

  logComplianceWebhook({
    shop,
    topic,
    outcome: "acknowledged_no_customer_records",
  });

  return new Response();
};
