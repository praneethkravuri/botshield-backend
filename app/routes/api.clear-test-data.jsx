import db from "../db.server";
import { authenticate } from "../shopify.server";

export async function action({ request }) {
  const { session } = await authenticate.admin(request);

  if (request.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  if (process.env.NODE_ENV === "production") {
    return Response.json(
      { error: "Test data clearing is disabled in production." },
      { status: 403 },
    );
  }

  await db.botEvent.deleteMany({
    where: { shop: session.shop },
  });
  await db.$transaction([
    db.blockedIP.deleteMany({ where: { shop: session.shop } }),
    db.whitelistIP.deleteMany({ where: { shop: session.shop } }),
    db.appSetting.deleteMany({ where: { shop: session.shop } }),
  ]);
  return Response.json({ ok: true });
}
