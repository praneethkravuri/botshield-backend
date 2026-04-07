import prisma from "../db.server";

export async function loader({ request }) {
  const url = new URL(request.url);

  // 👉 This creates a test bot entry when ?test=1 is in URL
  if (url.searchParams.get("test") === "1") {
    await prisma.botEvent.create({
      data: {
        ipAddress: "1.2.3.4",
        userAgent: "TestBot",
        threatLevel: "High",
        action: "Blocked",
        path: "/test",
      },
    });
  }

  // 👉 Get latest 5 rows from DB
  const events = await prisma.botEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return new Response(JSON.stringify(events, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}