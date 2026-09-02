import db from "../db.server";
import { resetShopBotShieldData } from "../lib/reset-shop-data.server";
import { authenticate } from "../shopify.server";

export async function action({ request }) {
  const { session } = await authenticate.admin(request);

  if (request.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  const result = await resetShopBotShieldData(db, session.shop);
  return Response.json(result);
}
