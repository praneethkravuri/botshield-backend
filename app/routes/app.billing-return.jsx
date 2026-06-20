import { redirect } from "react-router";
import { readBillingStatus } from "../lib/billing.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);
  await readBillingStatus(admin, session.shop);
  return redirect("/app?billing=updated");
}

export default function BillingReturn() {
  return null;
}
