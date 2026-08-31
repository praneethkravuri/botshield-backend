# BotShield Data Protection and Security Practices

This document describes the operational and technical controls BotShield uses to
protect merchant and customer personal data. It supports Shopify Protected
Customer Data (PCD) review and internal security operations.

BotShield does **not** claim SOC 2, ISO 27001, PCI DSS certification, or
third-party penetration-test attestation unless separately documented.

## Data minimization

- Storefront security events store IP address, user agent, path, risk signals,
  and network intelligence needed for merchant investigation.
- BotShield does **not** store Shopify customer IDs, customer names, customer
  emails, phone numbers, billing addresses, or shipping addresses.
- Fraud Orders v1 requests optional `read_orders` only. It does **not** request
  `read_all_orders` or Level 2 customer-identifying order fields.
- Fraud Orders data is fetched live from Shopify for display and is **not**
  persisted in BotShield's database.

## Merchant disclosures and agreements

- Public Privacy Policy: `/privacy`
- Public Terms of Service: `/terms`
- Terms incorporate the Privacy Policy as the merchant data-processing
  description for app functionality.

## Consent and sale of data

- Merchants install BotShield through Shopify and authorize processing described
  in the Privacy Policy.
- Merchants remain responsible for storefront notices required by their own
  legal obligations.
- BotShield does **not** sell personal data.

## Automated decisions

- BotShield may automatically allow, challenge, or block storefront requests
  based on merchant-configured rules.
- Fraud Orders is a merchant review/investigation workspace for supported
  Shopify order-risk information. It does not make legal, credit, or similarly
  significant automated decisions about customers.

## Retention and deletion

See `docs/data-retention-and-deletion.md`.

- Storefront events: 30-day automatic deletion
- Network-intelligence cache: 24-hour expiry
- Shop-scoped merchant data: deleted on Shopify `shop/redact`
- Fraud Orders payloads: not stored

Automatic deletion runs from production via `app/lib/data-retention.server.js`.

## Encryption

### In transit

- Production traffic is served over HTTPS/TLS.
- HSTS is enabled in `server.js`.
- Shopify Admin, webhook, and GraphQL traffic use provider-managed TLS.

### At rest

- Production PostgreSQL is hosted on Render-managed PostgreSQL
  (`render.yaml` database `bot-shield-db`).
- Render documents managed PostgreSQL encryption at rest and in transit for
  hosted databases. BotShield does not add separate application-level field
  encryption for IP addresses or user agents stored in PostgreSQL.

### Backups

- Render PostgreSQL backup availability and encryption depend on the selected
  database plan.
- Current repository configuration uses plan `basic-256mb`.
- **Operator action:** upgrade to a paid PostgreSQL plan with documented backup
  and point-in-time recovery before claiming full backup encryption coverage in
  external questionnaires. See `docs/manual-launch-actions.md`.

## Test and production separation

Within repository control:

- Production requires validated env vars in `app/shopify.server.js`.
- `/ui-preview` is blocked in production.
- UI preview/dev mode can use in-memory session storage when
  `BOTSHIELD_UI_PREVIEW=1` and `NODE_ENV !== production`.
- Non-production processes refuse Render PostgreSQL unless
  `BOTSHIELD_ALLOW_PROD_DB=1` is explicitly set
  (`app/lib/database-environment.server.js`).

External/manual separation still required:

1. Create a separate development PostgreSQL instance on Render or locally.
2. Never copy production protected customer data into dev fixtures.
3. Use preview/mock fraud-order data in UI preview mode only.

## Data loss prevention (DLP)

BotShield's practical DLP controls include:

| Risk | Control |
| --- | --- |
| Protected customer data in application logs | Fraud Orders GraphQL failures log error codes only, not order payloads. Generic safe logging helper in `app/lib/safe-log.server.js`. |
| Protected data in error messages | Merchant-facing API errors use `resolveFraudOrdersMerchantError()` and do not echo raw GraphQL payloads. |
| Protected data in analytics/telemetry | No third-party analytics SDK ships protected order payloads. Storefront telemetry stores only fields needed for enforcement. |
| Secrets in logs/source | Secrets remain in environment variables; production env validation rejects placeholder values. |
| Unnecessary exports | No bulk export endpoint for Fraud Orders data. |
| Debug output | No public debug route exposes order payloads. |
| Production fixtures in tests | Tests use synthetic data only. |
| Accidental order persistence | No Prisma order model; Fraud Orders API returns in-memory JSON only. |
| Support/debug exposure | Protected data access is limited to authenticated merchant Admin routes for the installing store. |

## Staff access

BotShield currently operates with a very small operator footprint.

Least-privilege expectations:

- Render dashboard: only operators who deploy/support production
- GitHub repository: only maintainers who need code access
- Shopify Partner Dashboard: only app owners/admins
- PostgreSQL: no broad external IP access unless explicitly required

The application does not expose protected order data through public routes or
unnecessary admin/debug endpoints.

## Staff authentication

Password and MFA requirements are enforced by the underlying providers:

- GitHub organization/repository access
- Render account access
- Shopify Partner account access
- Resend account access

**Operator action:** enable MFA on all provider accounts that can access
production credentials, databases, or deployment settings.

BotShield does not operate a separate internal employee directory or custom staff
password store.

## Personal data access logging

Application-level access audit records are written to production logs with the
prefix `[botshield-access-audit]`.

Logged metadata includes:

- timestamp
- shop domain
- resource category (`fraud_orders`, `storefront_events`)
- operation (`fetch`, `list`, `incident_list`)
- success/failure
- safe error code when applicable

Audit logs intentionally exclude order payloads, customer identifiers, and raw
GraphQL responses.

Compliance webhook handling also writes audit metadata for:

- `customers/data_request`
- `customers/redact`
- `shop/redact`
- `app/uninstalled`

Provider-level database audit logging depends on Render plan/features and should
be treated as an operator verification item if required beyond application
logs.

## Security incident response

See `docs/security-incident-response.md`.

## Shopify compliance webhooks

Configured in `shopify.app.toml` and implemented under `app/routes/webhooks.*`.

- `customers/data_request`: acknowledged; BotShield does not store
  customer-linked records
- `customers/redact`: acknowledged; no customer-linked records expected
- `shop/redact`: deletes shop-scoped BotShield data
- `app/uninstalled`: deletes Shopify sessions; remaining shop data is removed by
  subsequent Shopify shop redaction

Shop deletion logic is centralized in `app/lib/shop-redact.server.js`.

## Fraud Orders Level 1 confirmation

- Optional scope: `read_orders` only
- No `read_all_orders`
- GraphQL query excludes customer name, email, phone, and address fields
- No order persistence in PostgreSQL
- Protected-data failures map to merchant-safe errors and setup-state gating

## Related documents

- `docs/data-retention-and-deletion.md`
- `docs/security-incident-response.md`
- `docs/manual-launch-actions.md`
- `docs/operations-runbook.md`
