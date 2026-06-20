import { getAppSettings } from "../lib/bot-control.server";
import { sendTestIncidentEmail } from "../lib/incident-alerts.server";
import { authenticate } from "../shopify.server";

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

  console.log(
    `[botshield-alert] shop=${session.shop} event=TEST status=${delivery.status} sent=${delivery.sent}`,
  );

  return Response.json(
    { ok: delivery.sent, delivery },
    { status: delivery.sent ? 200 : 503 },
  );
}
