import db from "../db.server";
import {
  buildValueV2Dashboard,
  resetValueV2Assumptions,
  saveValueV2Assumptions,
} from "../lib/value-v2.server.js";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const range = url.searchParams.get("range") || "30d";

  try {
    const value = await buildValueV2Dashboard(db, session.shop, { range });
    return Response.json({ ok: true, value });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Couldn't load Value dashboard.",
      },
      { status: 500 },
    );
  }
}

export async function action({ request }) {
  const { session } = await authenticate.admin(request);

  if (request.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  try {
    if (body?.reset) {
      const assumptions = await resetValueV2Assumptions(session.shop);
      return Response.json({ ok: true, assumptions });
    }

    const assumptions = await saveValueV2Assumptions(session.shop, body || {});
    return Response.json({ ok: true, assumptions });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Couldn't save Value assumptions.",
      },
      { status: 400 },
    );
  }
}
