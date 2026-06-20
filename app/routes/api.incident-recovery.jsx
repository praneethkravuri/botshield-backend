import db from "../db.server";
import {
  removeBlockedIp,
  upsertWhitelistIp,
} from "../lib/bot-control.server";
import { authenticate } from "../shopify.server";
import {
  isRecoverableBlockedIncident,
  serializeSecurityEvent,
} from "../lib/security-events";

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

  const eventId = Number(body.eventId);
  const recoveryAction = String(body.action || "");
  if (
    !Number.isInteger(eventId) ||
    !["unblock", "whitelist"].includes(recoveryAction)
  ) {
    return Response.json(
      { error: "A valid incident and recovery action are required." },
      { status: 400 },
    );
  }

  const incident = await db.botEvent.findFirst({
    where: {
      id: eventId,
      shop: session.shop,
      source: "storefront-proxy",
      action: "blocked",
    },
  });

  if (!incident || !isRecoverableBlockedIncident(serializeSecurityEvent(incident))) {
    return Response.json(
      { error: "Blocked storefront incident not found." },
      { status: 404 },
    );
  }

  if (recoveryAction === "whitelist") {
    const whitelistIp = await upsertWhitelistIp(session.shop, {
      ipAddress: incident.ipAddress,
      label: "False-positive recovery",
      notes: `Whitelisted from BotShield incident ${incident.id}`,
      active: true,
    });

    console.log(
      `[botshield-recovery] action=whitelist shop=${session.shop} event=${incident.id} ip=${incident.ipAddress}`,
    );
    return Response.json({
      ok: true,
      action: recoveryAction,
      eventId: incident.id,
      ipAddress: incident.ipAddress,
      whitelistIp,
    });
  }

  await removeBlockedIp(session.shop, incident.ipAddress);
  console.log(
    `[botshield-recovery] action=unblock shop=${session.shop} event=${incident.id} ip=${incident.ipAddress}`,
  );
  return Response.json({
    ok: true,
    action: recoveryAction,
    eventId: incident.id,
    ipAddress: incident.ipAddress,
  });
}
