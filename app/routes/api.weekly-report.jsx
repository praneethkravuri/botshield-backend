import { buildWeeklySecurityReport } from "../lib/security-posture.server";
import { sendWeeklySecurityReport } from "../lib/weekly-reports.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const report = await buildWeeklySecurityReport(session.shop);
  return Response.json({ report });
}

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  if (request.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  const delivery = await sendWeeklySecurityReport(session.shop);
  return Response.json(
    { delivery },
    { status: delivery.sent ? 200 : 503 },
  );
}
