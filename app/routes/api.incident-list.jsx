import db from "../db.server";
import { hydrateEventGeography } from "../lib/event-geography.server";
import { logPersonalDataAccess } from "../lib/personal-data-access-audit.server.js";
import {
  matchesIncidentFilters,
  serializeSecurityEvent,
} from "../lib/security-events";
import { authenticate } from "../shopify.server";

const MAX_INCIDENTS = 250;

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const filters = {
    source: url.searchParams.get("source") || "real",
    decision: url.searchParams.get("decision") || "all",
    risk: url.searchParams.get("risk") || "all",
    search: url.searchParams.get("search") || "",
  };

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const realEventWhere = {
    shop: session.shop,
    source: "storefront-proxy",
    createdAt: { gte: thirtyDaysAgo },
  };
  const incidentWhere = { shop: session.shop };
  if (filters.source === "real") {
    incidentWhere.source = "storefront-proxy";
  } else if (filters.source === "simulation") {
    incidentWhere.source = { not: "storefront-proxy" };
  }
  if (filters.decision === "allowed") {
    incidentWhere.action = { in: ["allowed", "whitelisted"] };
  } else if (filters.decision !== "all") {
    incidentWhere.action = filters.decision;
  }
  if (filters.risk !== "all") incidentWhere.threatLevel = filters.risk;

  const search = filters.search.trim();
  if (search) {
    incidentWhere.OR = [
      "ipAddress",
      "path",
      "reasonSummary",
      "networkOrg",
      "networkType",
      "networkProvider",
      "networkCountry",
      "networkCountryCode",
      "networkCity",
    ].map((field) => ({ [field]: { contains: search, mode: "insensitive" } }));
  }
  const [
    eventRows,
    real,
    simulation,
    blocked,
    challenged,
    allowed,
    highRisk,
  ] = await Promise.all([
    db.botEvent.findMany({
      where: incidentWhere,
      orderBy: { createdAt: "desc" },
      take: MAX_INCIDENTS,
    }),
    db.botEvent.count({ where: realEventWhere }),
    db.botEvent.count({
      where: {
        shop: session.shop,
        source: { not: "storefront-proxy" },
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    db.botEvent.count({ where: { ...realEventWhere, action: "blocked" } }),
    db.botEvent.count({ where: { ...realEventWhere, action: "challenged" } }),
    db.botEvent.count({
      where: {
        ...realEventWhere,
        action: { in: ["allowed", "whitelisted"] },
      },
    }),
    db.botEvent.count({ where: { ...realEventWhere, threatLevel: "high" } }),
  ]);
  const rows = await hydrateEventGeography(eventRows, session.shop);

  const allEvents = rows.map(serializeSecurityEvent);
  const events = allEvents.filter((event) => matchesIncidentFilters(event, filters));

  logPersonalDataAccess({
    shop: session.shop,
    resource: "storefront_events",
    operation: "incident_list",
    success: true,
  });

  return Response.json({
    events,
    counts: {
      total: real,
      real,
      simulation,
      blocked,
      challenged,
      allowed,
      highRisk,
      periodDays: 30,
    },
    filters,
  });
}
