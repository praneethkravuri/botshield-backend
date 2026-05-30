import {
  getBlockedIps,
  removeBlockedIp,
  upsertBlockedIp,
} from "../lib/bot-control.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const blockedIps = await getBlockedIps(session.shop);
  return Response.json({ blockedIps });
}

export async function action({ request }) {
  const { session } = await authenticate.admin(request);

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
      const result = await removeBlockedIp(session.shop, body.ipAddress);
      return Response.json(result);
    }

    const blockedIp = await upsertBlockedIp(session.shop, {
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
