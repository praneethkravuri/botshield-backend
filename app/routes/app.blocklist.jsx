import { redirect } from "react-router";

export function loader() {
  return redirect("/app/settings?tab=general");
}

export default function RetiredBlocklistRoute() {
  return null;
}
