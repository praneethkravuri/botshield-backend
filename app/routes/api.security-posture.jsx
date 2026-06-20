import { getMerchantSecurityPosture } from "../lib/security-posture.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const posture = await getMerchantSecurityPosture(session.shop);
  return Response.json({ posture });
}
