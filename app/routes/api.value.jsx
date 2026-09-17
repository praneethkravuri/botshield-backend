import db from "../db.server.js";
import { logPersonalDataAccess } from "../lib/personal-data-access-audit.server.js";
import { saveValueAssumptions } from "../lib/value-assumptions.server.js";
import { buildValueDashboard } from "../lib/value.server.js";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const range = url.searchParams.get("range") || "30d";

  try {
    const value = await buildValueDashboard(db, session.shop, { range });
    logPersonalDataAccess({
      shop: session.shop,
      resource: "value_dashboard",
      operation: "fetch",
      success: true,
    });
    return Response.json({ ok: true, value });
  } catch (error) {
    logPersonalDataAccess({
      shop: session.shop,
      resource: "value_dashboard",
      operation: "fetch",
      success: false,
      errorCode: "fetch_failed",
    });
    return Response.json(
      {
        ok: false,
        error: "Couldn't load Value dashboard data right now.",
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
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const assumptions = await saveValueAssumptions(session.shop, body, {
      reset: body.reset === true,
    });
    logPersonalDataAccess({
      shop: session.shop,
      resource: "value_assumptions",
      operation: body.reset ? "reset" : "save",
      success: true,
    });
    return Response.json({ ok: true, assumptions });
  } catch (error) {
    logPersonalDataAccess({
      shop: session.shop,
      resource: "value_assumptions",
      operation: "save",
      success: false,
      errorCode: "save_failed",
    });
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Couldn't save Value assumptions.",
      },
      { status: 400 },
    );
  }
}
