import { runShopDiagnostic } from "../lib/diagnostic.server";
import { authenticate } from "../shopify.server";

export async function action({ request }) {
  const { session } = await authenticate.admin(request);

  if (request.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  const diagnostic = await runShopDiagnostic(session.shop);
  return Response.json({ diagnostic });
}
