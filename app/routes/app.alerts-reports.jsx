import { redirect } from "react-router";

export function loader() {
  return redirect("/app/settings?section=notifications");
}

export { default } from "./app._index";
