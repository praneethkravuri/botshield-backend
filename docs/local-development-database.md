# Local Development Database

BotShield production uses Render-managed PostgreSQL. Local development and
testing must use a separate local database only.

## Rules

1. Never put the Render production `DATABASE_URL` in local `.env`.
2. Never copy production customer or protected data into the local database.
3. Use synthetic/test data only in development.
4. There is no override to connect non-production BotShield to Render PostgreSQL.

## Recommended setup

### 1. Start local PostgreSQL

Requires Docker Desktop or another Docker runtime:

```bash
npm run dev:db:up
```

This starts the development database defined in `docker-compose.dev.yml`:

- Host: `localhost`
- Port: `5432`
- Database: `botshield_dev`
- User: `botshield`
- Password: `botshield_dev`

### 2. Configure local environment

```bash
cp .env.development.example .env
```

Ensure `.env` contains:

```env
DATABASE_URL=postgresql://botshield:botshield_dev@localhost:5432/botshield_dev
NODE_ENV=development
```

Do not paste the Render production connection string into `.env`.

### 3. Apply migrations to the local database

```bash
npm run dev:db:setup
```

Or manually:

```bash
npm run dev:db:up
npm run setup
```

### 4. Run the app locally

```bash
npm run dev
```

## Safeguard

`app/lib/database-environment.server.js` runs when the app loads
`app/db.server.js`.

In non-production:

- Render PostgreSQL URLs are rejected.
- Non-local database hosts are rejected.
- Only localhost-style development databases are allowed.

Production on Render is unaffected and continues using the managed Render
PostgreSQL database from environment configuration.

## Synthetic data only

- UI preview mode (`BOTSHIELD_UI_PREVIEW=1`) uses in-memory sessions and mock
  fraud-order data.
- Automated tests use synthetic fixtures only.
- Do not dump, restore, or manually import production BotShield tables into the
  local Docker database.

## Stop local database

```bash
npm run dev:db:down
```

To remove local data entirely:

```bash
docker compose -f docker-compose.dev.yml down -v
```

## Related documents

- `docs/data-protection-and-security.md`
- `.env.development.example`
- `docker-compose.dev.yml`
