import { redirect } from "react-router";

export function loader() {
  return redirect("/app");
}

export default function RetiredSetupRoute() {
  return null;
}
