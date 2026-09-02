import db from "../db.server";
import { clearShopTestData } from "../lib/clear-test-data.server";
import { authenticate } from "../shopify.server";

export async function action({ request }) {
  const { session } = await authenticate.admin(request);

  if (request.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  const result = await clearShopTestData(db, session.shop);
  return Response.json(result);
}
