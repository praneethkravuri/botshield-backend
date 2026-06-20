import { readBillingStatus } from "../lib/billing.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);
  const billing = await readBillingStatus(admin, session.shop);
  return Response.json({ billing });
}
