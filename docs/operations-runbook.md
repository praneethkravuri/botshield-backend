# BotShield Production Operations Runbook

## Monitoring

- Render health check: `/health`
- Configuration diagnostics: `/health/config`
- Storefront logs: search for `[botshield-storefront]`
- Network intelligence: search for `[botshield-intel]`
- Alerts: search for `[botshield-alert]`
- Weekly reports: search for `[botshield-weekly-report]`

## Severity 1: storefront disruption

1. Confirm `/health` returns HTTP 200 and `database: connected`.
2. Check the latest Render deploy and application logs.
3. If false-positive blocking is widespread, pause protection in BotShield.
4. Keep event logging active while blocking is paused.
5. Roll back only to the last verified commit.
6. Notify affected merchants using the published support channel.

## Database recovery

Before launch, upgrade PostgreSQL to a plan with backups.

Recovery procedure:

1. Stop writes or pause protection.
2. Create/identify the latest Render recovery point.
3. Restore to a new recovery instance following Render's managed PostgreSQL
   restore process.
4. Update `DATABASE_URL` only after validating migrations and row counts.
5. Deploy and verify `/health`.
6. Visit the storefront and confirm a new real event reaches the dashboard.
7. Retain the old database until verification is complete.

## Deployment verification

1. Render reports the intended commit as Live.
2. Prisma reports no failed migrations.
3. `/health` is HTTP 200.
4. Shopify Admin embedded dashboard loads.
5. Theme embed heartbeat becomes current.
6. A storefront visit creates a real event.
7. Blocklist and whitelist smoke tests pass.
8. Email test and weekly report deliver successfully.

## Secret rotation

Rotate compromised credentials in Render and the provider dashboard. Never
commit secrets. Rotate Shopify, Resend, database, and IP-intelligence
credentials independently, then redeploy and verify health.

