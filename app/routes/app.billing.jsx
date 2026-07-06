import { redirect } from "react-router";

export function loader() {
  return redirect("/app/settings?tab=pricing");
}

export default function RetiredBillingRoute() {
  return null;
}
