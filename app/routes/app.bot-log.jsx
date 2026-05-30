import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);

  const events = await prisma.botEvent.findMany({
    where: {
      shop: session.shop,
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return new Response(JSON.stringify(events, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
