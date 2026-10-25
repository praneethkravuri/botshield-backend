import { authenticate } from "../shopify.server";
import {
  acknowledgeGuide,
  readGuideAcknowledgment,
} from "../lib/onboarding.server.js";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const acknowledged = await readGuideAcknowledgment(session.shop);
  return Response.json(
    { shop: session.shop, acknowledged },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  if (request.method !== "POST") return new Response(null, { status: 405 });
  // This endpoint records visiting the guide, not activation or protection readiness.
  await acknowledgeGuide(session.shop);
  return Response.json(
    { acknowledged: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
