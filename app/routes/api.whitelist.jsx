import {
  getWhitelistIps,
  removeWhitelistIp,
  upsertWhitelistIp,
} from "../lib/bot-control.server";

export async function loader() {
  const whitelistIps = await getWhitelistIps();
  return Response.json({ whitelistIps });
}

export async function action({ request }) {
  if (!["POST", "DELETE"].includes(request.method)) {
    return new Response(null, { status: 405 });
  }

  let body = {};
  if (request.method !== "DELETE") {
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
  } else {
    try {
      body = await request.json();
    } catch {
      body = {};
    }
  }

  try {
    if (request.method === "DELETE") {
      const result = await removeWhitelistIp(body.ipAddress);
      return Response.json(result);
    }

    const whitelistIp = await upsertWhitelistIp({
      ipAddress: body.ipAddress,
      label: body.label,
      notes: body.notes,
      active: body.active,
    });

    return Response.json({ ok: true, whitelistIp });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to update whitelist" },
      { status: 400 },
    );
  }
}
