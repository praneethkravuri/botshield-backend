import { redirect as reactRouterRedirect } from "react-router";
import { refreshBillingStatus } from "../lib/billing.server";
import {
  buildBillingSettingsRedirectPath,
  buildEmbeddedAdminBillingReturnUrl,
  getBillingReturnSearchParams,
  needsBillingReturnEmbeddedBootstrap,
} from "../lib/billing-return.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  if (needsBillingReturnEmbeddedBootstrap(request)) {
    const returnParams = getBillingReturnSearchParams(request);
    const shop = returnParams.get("shop") || "";
    const embeddedUrl = buildEmbeddedAdminBillingReturnUrl(shop, returnParams);
    if (embeddedUrl) {
      throw reactRouterRedirect(embeddedUrl);
    }
  }

  const { admin, session, redirect } = await authenticate.admin(request);
  const url = new URL(request.url);
  const planHandle = url.searchParams.get("plan_handle") || "";

  await refreshBillingStatus({
    admin,
    shop: session.shop,
    planHandle,
  });

  return redirect(buildBillingSettingsRedirectPath({ updated: true }));
}

export default function BillingReturn() {
  return null;
}
