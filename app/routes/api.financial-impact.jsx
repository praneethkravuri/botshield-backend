import db from "../db.server";
import { getEstimatedValueProtected } from "../lib/financial-impact.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const impact = await getEstimatedValueProtected(db, session.shop);
  return Response.json({ impact });
}
