import db from "../db.server";
import { hydrateEventGeography } from "../lib/event-geography.server";
import { extractReasonCodes } from "../lib/security-events";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const eventRows = await db.botEvent.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    take: 250,
  });
  const rows = await hydrateEventGeography(eventRows, session.shop);
  const scans = rows.map((r) => ({
    id: r.id,
    ipAddress: r.ipAddress,
    threatLevel: r.threatLevel,
    actionTaken: r.action,
    pathVisited: r.path ?? "",
    riskScore: r.riskScore ?? 0,
    reasons: r.reasonSummary ?? "",
    reasonCodes: extractReasonCodes(r.reasonSummary),
    userAgent: r.userAgent ?? "",
    source: r.source ?? "local-engine",
    networkCountry: r.networkCountry ?? "",
    networkCountryCode: r.networkCountryCode ?? "",
    networkCity: r.networkCity ?? "",
    networkLatitude: r.networkLatitude ?? null,
    networkLongitude: r.networkLongitude ?? null,
    networkOrg: r.networkOrg ?? "",
    networkType: r.networkType ?? "",
    networkProvider: r.networkProvider ?? "",
    networkAsn: r.networkAsn ?? null,
    createdAt: r.createdAt,
  }));
  return Response.json({ scans });
}
