import db from "../db.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const rows = await db.$queryRaw`
    SELECT
      id,
      ipAddress,
      threatLevel,
      action,
      path,
      createdAt,
      riskScore,
      reasonSummary,
      source
    FROM BotEvent
    WHERE shop = ${session.shop}
    ORDER BY createdAt DESC
    LIMIT 100
  `;
  const scans = rows.map((r) => ({
    id: r.id,
    ipAddress: r.ipAddress,
    threatLevel: r.threatLevel,
    actionTaken: r.action,
    pathVisited: r.path ?? "",
    riskScore: r.riskScore ?? 0,
    reasons: r.reasonSummary ?? "",
    source: r.source ?? "local-engine",
    createdAt: r.createdAt,
  }));
  return Response.json({ scans });
}
