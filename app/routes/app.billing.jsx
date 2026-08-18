import { redirect } from "react-router";

export function loader({ request }) {
  const url = new URL(request.url);
  const params = new URLSearchParams(url.search);
  params.set("section", "billing");
  return redirect(`/app/settings?${params.toString()}`);
}

export { default } from "./app._index";
