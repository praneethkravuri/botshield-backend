import { getAppSettings, saveAppSettings } from "../lib/bot-control.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const settings = await getAppSettings(session.shop);
  return Response.json({ settings });
}

export async function action({ request }) {
  const { session } = await authenticate.admin(request);

  if (request.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const settings = await saveAppSettings(session.shop, body);
  return Response.json({ ok: true, settings });
}
