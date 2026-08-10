import db from "../db.server";
import { authenticate } from "../shopify.server";

const PERIOD_DAYS = 90;

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const periodStart = new Date(Date.now() - PERIOD_DAYS * 24 * 60 * 60 * 1000);
  const events = await db.botEvent.findMany({
    where: {
      shop: session.shop,
      source: "storefront-proxy",
      createdAt: { gte: periodStart },
    },
    select: { action: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const days = Array.from({ length: PERIOD_DAYS }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (PERIOD_DAYS - 1 - index));
    return {
      date: date.toISOString().slice(0, 10),
      allowed: 0,
      challenged: 0,
      blocked: 0,
    };
  });
  const byDate = new Map(days.map((day) => [day.date, day]));
  for (const event of events) {
    const day = byDate.get(new Date(event.createdAt).toISOString().slice(0, 10));
    if (!day) continue;
    if (event.action === "blocked") day.blocked += 1;
    else if (event.action === "challenged") day.challenged += 1;
    else day.allowed += 1;
  }

  return Response.json({ periodDays: PERIOD_DAYS, days });
}

