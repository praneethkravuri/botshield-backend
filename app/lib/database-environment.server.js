const RENDER_POSTGRES_PATTERN = /render\.com|\.oregon-postgres\.render\.com/i;

export const DEFAULT_LOCAL_DEVELOPMENT_DATABASE_URL =
  "postgresql://botshield:botshield_dev@localhost:5432/botshield_dev";

const LOCAL_DEVELOPMENT_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "[::1]",
  "host.docker.internal",
]);

function getDatabaseHostname(databaseUrl) {
  try {
    const normalized = String(databaseUrl || "").replace(/^postgres(ql)?:\/\//, "http://");
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function looksLikeRenderPostgresUrl(databaseUrl) {
  return RENDER_POSTGRES_PATTERN.test(String(databaseUrl || ""));
}

export function looksLikeLocalDevelopmentDatabaseUrl(databaseUrl) {
  const hostname = getDatabaseHostname(databaseUrl);
  return LOCAL_DEVELOPMENT_HOSTS.has(hostname);
}

export function assertSafeNonProductionDatabase(databaseUrl = process.env.DATABASE_URL) {
  if (process.env.NODE_ENV === "production") return;
  if (!databaseUrl) return;

  if (looksLikeRenderPostgresUrl(databaseUrl)) {
    throw new Error(
      "Refusing to start non-production BotShield against Render PostgreSQL. Copy .env.development.example to .env and use the local development database instead.",
    );
  }

  if (!looksLikeLocalDevelopmentDatabaseUrl(databaseUrl)) {
    throw new Error(
      "Refusing to start non-production BotShield against a non-local database. Use the local Docker PostgreSQL database documented in docs/local-development-database.md.",
    );
  }
}
