import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertSafeNonProductionDatabase,
  DEFAULT_LOCAL_DEVELOPMENT_DATABASE_URL,
  looksLikeLocalDevelopmentDatabaseUrl,
  looksLikeRenderPostgresUrl,
} from "../app/lib/database-environment.server.js";

test("looksLikeRenderPostgresUrl identifies Render PostgreSQL hosts", () => {
  assert.equal(
    looksLikeRenderPostgresUrl(
      "postgresql://user:pass@dpg-example.oregon-postgres.render.com/db",
    ),
    true,
  );
  assert.equal(
    looksLikeRenderPostgresUrl("postgresql://user:pass@localhost:5432/botshield_dev"),
    false,
  );
});

test("looksLikeLocalDevelopmentDatabaseUrl accepts localhost-only development hosts", () => {
  assert.equal(
    looksLikeLocalDevelopmentDatabaseUrl(DEFAULT_LOCAL_DEVELOPMENT_DATABASE_URL),
    true,
  );
  assert.equal(
    looksLikeLocalDevelopmentDatabaseUrl(
      "postgresql://botshield:botshield_dev@127.0.0.1:5432/botshield_dev",
    ),
    true,
  );
  assert.equal(
    looksLikeLocalDevelopmentDatabaseUrl(
      "postgresql://user:pass@dpg-example.oregon-postgres.render.com/db",
    ),
    false,
  );
});

test("assertSafeNonProductionDatabase blocks Render production PostgreSQL with no override", () => {
  const originalEnv = { ...process.env };
  try {
    process.env.NODE_ENV = "development";
    assert.throws(
      () =>
        assertSafeNonProductionDatabase(
          "postgresql://user:pass@dpg-example.oregon-postgres.render.com/db",
        ),
      /Refusing to start non-production BotShield against Render PostgreSQL/,
    );
  } finally {
    process.env.NODE_ENV = originalEnv.NODE_ENV;
  }
});

test("assertSafeNonProductionDatabase blocks non-local remote databases in development", () => {
  const originalEnv = { ...process.env };
  try {
    process.env.NODE_ENV = "development";
    assert.throws(
      () =>
        assertSafeNonProductionDatabase(
          "postgresql://user:pass@db.example.amazonaws.com:5432/botshield",
        ),
      /Refusing to start non-production BotShield against a non-local database/,
    );
  } finally {
    process.env.NODE_ENV = originalEnv.NODE_ENV;
  }
});

test("assertSafeNonProductionDatabase allows the documented local development database", () => {
  const originalEnv = { ...process.env };
  try {
    process.env.NODE_ENV = "development";
    assert.doesNotThrow(() =>
      assertSafeNonProductionDatabase(DEFAULT_LOCAL_DEVELOPMENT_DATABASE_URL),
    );
  } finally {
    process.env.NODE_ENV = originalEnv.NODE_ENV;
  }
});

test("assertSafeNonProductionDatabase does not restrict production", () => {
  const originalEnv = { ...process.env };
  try {
    process.env.NODE_ENV = "production";
    assert.doesNotThrow(() =>
      assertSafeNonProductionDatabase(
        "postgresql://user:pass@dpg-example.oregon-postgres.render.com/db",
      ),
    );
  } finally {
    process.env.NODE_ENV = originalEnv.NODE_ENV;
  }
});

test("local development database setup is documented and configured", async () => {
  const compose = await readFile(
    new URL("../docker-compose.dev.yml", import.meta.url),
    "utf8",
  );
  const envExample = await readFile(
    new URL("../.env.development.example", import.meta.url),
    "utf8",
  );
  const docs = await readFile(
    new URL("../docs/local-development-database.md", import.meta.url),
    "utf8",
  );
  const packageJson = await readFile(
    new URL("../package.json", import.meta.url),
    "utf8",
  );
  const guardSource = await readFile(
    new URL("../app/lib/database-environment.server.js", import.meta.url),
    "utf8",
  );

  assert.match(compose, /botshield_dev/);
  assert.match(compose, /5432:5432/);
  assert.match(envExample, /localhost:5432\/botshield_dev/);
  assert.match(envExample, /Do not paste the Render production DATABASE_URL/i);
  assert.match(docs, /Never put the Render production `DATABASE_URL` in local `.env`/);
  assert.match(packageJson, /dev:db:up/);
  assert.match(packageJson, /dev:db:setup/);
  assert.doesNotMatch(guardSource, /BOTSHIELD_ALLOW_PROD_DB/);
});

test("data protection docs describe local-only development separation", async () => {
  const practices = await readFile(
    new URL("../docs/data-protection-and-security.md", import.meta.url),
    "utf8",
  );

  assert.match(practices, /refuse Render PostgreSQL with no bypass override/);
  assert.match(practices, /docs\/local-development-database\.md/);
  assert.match(practices, /docker-compose\.dev\.yml/);
  assert.doesNotMatch(practices, /BOTSHIELD_ALLOW_PROD_DB/);
});
