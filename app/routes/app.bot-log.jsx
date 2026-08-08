import { redirect } from "react-router";

export function loader() {
  return redirect("/app/visitors");
}

export default function RetiredBotLogRoute() {
  return null;
}
