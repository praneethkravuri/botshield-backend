import db from "../db.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const rows = await db.botEvent.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
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
