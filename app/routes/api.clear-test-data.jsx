import db from "../db.server";
import { authenticate } from "../shopify.server";

export async function action({ request }) {
  const { session } = await authenticate.admin(request);

  if (request.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  const result = await db.botEvent.deleteMany({
    where: {
      shop: session.shop,
      source: { not: "storefront-proxy" },
    },
  });

  return Response.json({ ok: true, deleted: result.count });
}
