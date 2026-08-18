import { redirect } from "react-router";
import { refreshBillingStatus } from "../lib/billing.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const planHandle = url.searchParams.get("plan_handle") || "";
  await refreshBillingStatus({
    admin,
    shop: session.shop,
    planHandle,
  });
  return redirect("/app/settings?section=billing&updated=true");
}

export default function BillingReturn() {
  return null;
}
