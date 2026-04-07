import db from "../db.server";

export async function loader() {
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
