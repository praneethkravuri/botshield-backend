import { getAppSettings } from "../lib/bot-control.server";
import { sendTestIncidentEmail } from "../lib/incident-alerts.server";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export async function action({ request }) {
  const { session } = await authenticate.admin(request);

  if (request.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  const settings = await getAppSettings(session.shop);
  if (!settings.emailAlerts || !settings.alertEmail) {
    return Response.json(
      { error: "Save and enable a valid alert email first." },
      { status: 400 },
    );
  }

  const delivery = await sendTestIncidentEmail({
    shop: session.shop,
    alertEmail: settings.alertEmail,
  });
  const sentAt = new Date().toISOString();
  const deliverySettings = {
    lastAlertStatus: delivery.status,
    lastAlertAttemptAt: sentAt,
    lastAlertEventId: "TEST",
    ...(delivery.sent ? { lastAlertSentAt: sentAt } : {}),
  };
  await db.$transaction(
    Object.entries(deliverySettings).map(([key, value]) =>
      db.appSetting.upsert({
        where: { shop_key: { shop: session.shop, key } },
        create: { shop: session.shop, key, value },
        update: { value },
      }),
    ),
  );

  console.log(
    `[botshield-alert] shop=${session.shop} event=TEST status=${delivery.status} sent=${delivery.sent}`,
  );

  return Response.json(
    { ok: delivery.sent, delivery },
    { status: delivery.sent ? 200 : 503 },
  );
}
