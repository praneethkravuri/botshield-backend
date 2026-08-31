const RENDER_POSTGRES_PATTERN = /render\.com|\.oregon-postgres\.render\.com/i;

export function looksLikeRenderPostgresUrl(databaseUrl) {
  return RENDER_POSTGRES_PATTERN.test(String(databaseUrl || ""));
}

export function assertSafeNonProductionDatabase(databaseUrl = process.env.DATABASE_URL) {
  if (process.env.NODE_ENV === "production") return;
  if (process.env.BOTSHIELD_ALLOW_PROD_DB === "1") return;
  if (!databaseUrl) return;

  if (looksLikeRenderPostgresUrl(databaseUrl)) {
    throw new Error(
      "Refusing to start non-production BotShield against Render PostgreSQL. Use a separate development DATABASE_URL, or set BOTSHIELD_ALLOW_PROD_DB=1 only for intentional operator access.",
    );
  }
}
