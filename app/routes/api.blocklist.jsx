import {
  getBlockedIps,
  removeBlockedIp,
  upsertBlockedIp,
} from "../lib/bot-control.server";

export async function loader() {
  const blockedIps = await getBlockedIps();
  return Response.json({ blockedIps });
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
      const result = await removeBlockedIp(body.ipAddress);
      return Response.json(result);
    }

    const blockedIp = await upsertBlockedIp({
      ipAddress: body.ipAddress,
      reason: body.reason,
      source: body.source ?? "dashboard",
      active: body.active,
      expiresAt: body.expiresAt,
    });

    return Response.json({ ok: true, blockedIp });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to update blocklist" },
      { status: 400 },
    );
  }
}
