import { authenticate } from "../shopify.server";
import { logComplianceWebhook } from "../lib/personal-data-access-audit.server.js";
import db from "../db.server";

export const action = async ({ request }) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  logComplianceWebhook({
    shop,
    topic,
    outcome: session ? "sessions_deleted" : "already_uninstalled",
  });

  return new Response();
};
