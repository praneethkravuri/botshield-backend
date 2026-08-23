import { hasFraudOrderReadAccess } from "../lib/fraud-order-access.server.js";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);

  return Response.json({
    connected: hasFraudOrderReadAccess(session?.scope),
  });
}
