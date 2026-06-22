import db from "../db.server";
import { hydrateEventGeography } from "../lib/event-geography.server";
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

  const eventRows = await db.botEvent.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    take: MAX_INCIDENTS,
  });
  const rows = await hydrateEventGeography(eventRows, session.shop);

  const allEvents = rows.map(serializeSecurityEvent);
  const events = allEvents.filter((event) =>
    matchesIncidentFilters(event, filters),
  );

  return Response.json({
    events,
    counts: {
      real: allEvents.filter((event) => event.source === "storefront-proxy")
        .length,
      simulation: allEvents.filter(
        (event) => event.source !== "storefront-proxy",
      ).length,
      blocked: allEvents.filter(
        (event) =>
          event.source === "storefront-proxy" && event.decision === "blocked",
      ).length,
      challenged: allEvents.filter(
        (event) =>
          event.source === "storefront-proxy" &&
          event.decision === "challenged",
      ).length,
    },
    filters,
  });
}
