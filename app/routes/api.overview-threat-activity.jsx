import db from "../db.server";
import {
  buildOverviewThreatActivityResponse,
  THREAT_ACTIVITY_PERIOD_DAYS,
} from "../lib/overview-threat-activity.server.js";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const periodStart = new Date(
    Date.now() - THREAT_ACTIVITY_PERIOD_DAYS * 24 * 60 * 60 * 1000,
  );
  const events = await db.botEvent.findMany({
    where: {
      shop: session.shop,
      source: "storefront-proxy",
      createdAt: { gte: periodStart },
    },
    select: { action: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return Response.json(buildOverviewThreatActivityResponse(events));
}
