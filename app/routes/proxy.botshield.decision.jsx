import { authenticate } from "../shopify.server";
import { evaluateStorefrontRequest } from "../lib/storefront-enforcement.server";

export async function loader({ request }) {
  const { session } = await authenticate.public.appProxy(request);
  const shop = session?.shop || new URL(request.url).searchParams.get("shop");

  if (!shop) {
    return Response.json({ error: "Missing shop context." }, { status: 400 });
  }

  const decision = await evaluateStorefrontRequest(request, shop);
  console.log(
    `[botshield-storefront] decision=${decision.decision} shop=${shop} path=${new URL(request.url).searchParams.get("path") || "/"}`,
  );
  return Response.json(decision);
}
