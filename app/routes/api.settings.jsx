import { getAppSettings, saveAppSettings } from "../lib/bot-control.server";

export async function loader() {
  const settings = await getAppSettings();
  return Response.json({ settings });
}

export async function action({ request }) {
  if (request.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const settings = await saveAppSettings(body);
  return Response.json({ ok: true, settings });
}
