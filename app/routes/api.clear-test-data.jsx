import db from "../db.server";

export async function action({ request }) {
  if (request.method !== "POST") {
    return new Response(null, { status: 405 });
  }
  await db.botEvent.deleteMany();
  try {
    await db.$executeRaw`DELETE FROM BlockedIP`;
    await db.$executeRaw`DELETE FROM WhitelistIP`;
    await db.$executeRaw`DELETE FROM AppSetting`;
  } catch {
    // Ignore when new tables are not available yet.
  }
  return Response.json({ ok: true });
}
