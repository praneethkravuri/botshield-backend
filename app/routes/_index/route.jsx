import { redirect } from "react-router";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const query = url.searchParams.toString();

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${query}`);
  }

  throw redirect("/app");
};

export default function App() {
  return null;
}
