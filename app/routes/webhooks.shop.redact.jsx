import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { payload, shop, topic } = await authenticate.webhook(request);
  const shopDomain = shop || payload?.shop_domain;

  console.log(`Received ${topic} webhook for ${shopDomain}`);

  if (shopDomain) {
    await db.$transaction([
      db.session.deleteMany({ where: { shop: shopDomain } }),
      db.botEvent.deleteMany({ where: { shop: shopDomain } }),
      db.blockedIP.deleteMany({ where: { shop: shopDomain } }),
      db.whitelistIP.deleteMany({ where: { shop: shopDomain } }),
      db.appSetting.deleteMany({ where: { shop: shopDomain } }),
    ]);
  }

  return new Response();
};
