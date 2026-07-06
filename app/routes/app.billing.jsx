import { redirect } from "react-router";

export function loader() {
  return redirect("/app/settings");
}

export default function RetiredBillingRoute() {
  return null;
}
