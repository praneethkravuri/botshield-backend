import db from "../db.server";
import { authenticate } from "../shopify.server";

const KEYS = ["analystNotes", "trustedTags"];
const MAX_ENTRIES = 250;
const MAX_TEXT_LENGTH = 500;

function parseObject(value) {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function sanitizeMap(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return Object.fromEntries(
    Object.entries(input)
      .slice(0, MAX_ENTRIES)
      .map(([key, value]) => [
        String(key).slice(0, 128),
        String(value || "").trim().slice(0, MAX_TEXT_LENGTH),
      ])
      .filter(([key, value]) => key && value),
  );
}

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const rows = await db.appSetting.findMany({
    where: { shop: session.shop, key: { in: KEYS } },
    select: { key: true, value: true },
  });
  const values = new Map(rows.map((row) => [row.key, row.value]));
  return Response.json({
    analystNotes: parseObject(values.get("analystNotes")),
    trustedTags: parseObject(values.get("trustedTags")),
  });
}

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  if (request.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  const body = await request.json().catch(() => ({}));
  const analystNotes = sanitizeMap(body.analystNotes);
  const trustedTags = sanitizeMap(body.trustedTags);

  await db.$transaction(
    Object.entries({ analystNotes, trustedTags }).map(([key, value]) =>
      db.appSetting.upsert({
        where: { shop_key: { shop: session.shop, key } },
        create: { shop: session.shop, key, value: JSON.stringify(value) },
        update: { value: JSON.stringify(value) },
      }),
    ),
  );

  return Response.json({ ok: true, analystNotes, trustedTags });
}
