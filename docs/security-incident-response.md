# BotShield Security Incident Response Policy

This policy covers security and personal-data incidents affecting BotShield
production systems, merchant data, or Shopify compliance obligations.

It is an operational policy for BotShield's small operator team. It does not
represent third-party certification or audit attestation.

## Scope

Applies to incidents involving:

- unauthorized access to production infrastructure or credentials
- suspected exposure of merchant or customer personal data
- compromise of Shopify app secrets, session tokens, or webhook integrity
- production outages that affect data integrity or availability
- confirmed malware, credential leaks, or suspicious provider-account activity

## Roles

- **Incident lead:** primary operator responsible for coordination
- **Technical responder:** operator performing containment and remediation
- **Communications owner:** operator handling merchant or Shopify notifications

For BotShield's current footprint, these roles may be held by the same person.

## Severity guide

| Severity | Examples |
| --- | --- |
| High | confirmed protected-data exposure, leaked production secrets, unauthorized database access |
| Medium | suspicious provider login, failed containment attempt, partial service compromise |
| Low | isolated false alarm, non-production misconfiguration with no production impact |

## Response phases

### 1. Identification

- Confirm the alert via Render logs, `/health`, GitHub/Render/Shopify account
  activity, or merchant report.
- Record start time, affected systems, and initial indicators.
- Search production logs for `[botshield-access-audit]` entries when protected
  data access may be involved.

### 2. Containment

- Revoke or rotate compromised credentials immediately:
  - `SHOPIFY_API_SECRET`
  - `DATABASE_URL` / database password
  - `RESEND_API_KEY`
  - Partner API token
  - Render deploy keys or account sessions
- Pause destructive changes until scope is understood.
- If active abuse is occurring, pause BotShield protection only when necessary to
  protect merchants and document the reason.

### 3. Investigation

- Determine affected shops, time window, and data categories involved.
- Review application audit logs, webhook logs, and recent deploy history.
- Identify whether protected order payloads, storefront IP/user-agent records, or
  merchant settings were exposed.
- Preserve relevant logs before retention expiry.

### 4. Eradication and recovery

- Remove unauthorized access paths.
- Redeploy from a known-good commit if code integrity is in doubt.
- Restore database/service from Render backup or recovery point if integrity was
  affected.
- Verify `/health`, Admin login, storefront event ingestion, and webhook delivery.

### 5. Notification

Notify affected parties based on facts established during investigation:

- affected merchants through the published support channel
- Shopify through Partner/support channels when app or customer data obligations
  require it
- infrastructure providers when their accounts or credentials were involved

Do not overstate scope. If exposure cannot be confirmed, say what is known and
what remains under investigation.

### 6. Post-incident review

Within 7 days of closure, document:

- root cause
- timeline
- data categories affected
- containment actions taken
- permanent fixes
- manual/provider actions still required
- follow-up tasks

Store the review in the operator's internal incident log.

## Data-specific handling

- If protected customer data may have been exposed, preserve audit metadata but
  do not copy order payloads into incident notes.
- If a shop uninstalls or requests deletion, rely on Shopify `shop/redact`
  handling and manual support verification when needed.
- Do not use production protected data in post-incident test fixtures.

## Preventive controls

- MFA on GitHub, Render, Shopify Partner, and Resend accounts
- least-privilege provider access
- secret rotation procedure in `docs/operations-runbook.md`
- no secrets in git
- separate development and production databases
- automatic 30-day deletion for storefront events

## Related documents

- `docs/data-protection-and-security.md`
- `docs/operations-runbook.md`
- `docs/manual-launch-actions.md`
