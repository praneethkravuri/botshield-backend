import { getProtectionStatus } from "../lib/bot-control.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const status = await getProtectionStatus(session.shop);
  return Response.json({ status });
}
