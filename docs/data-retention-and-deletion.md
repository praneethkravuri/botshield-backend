# BotShield Data Retention and Deletion

## Data stored

- Shopify shop domain and app sessions
- Merchant protection and alert settings
- Storefront security events: IP address, user agent, path, decision, risk,
  reason codes, source, and network intelligence
- Merchant blocklist, whitelist, analyst notes, and trusted tags
- Email/report delivery status and provider message IDs
- Cached IP network intelligence

BotShield does not intentionally store customer names, customer emails,
phone numbers, billing or shipping addresses, order contents, payment card
details, or Shopify customer IDs.

When Fraud Orders is connected, BotShield fetches supported Shopify order and
fraud/risk information live for display and does not persist that order data.

## Retention

- Storefront security events (`BotEvent`): automatically deleted after 30 days
- Network-intelligence cache (`NetworkIntel`): automatically deleted after
  the 24-hour `expiresAt` timestamp
- Merchant settings, blocklists, and whitelists: retained while installed and
  deleted on Shopify `shop/redact`
- Valid privacy requests: completed within 30 days unless retention is legally
  required

Automatic deletion runs from the production web service on startup and on a
recurring schedule via `app/lib/data-retention.server.js`.

## Access logging

Protected-data workflows write safe application audit metadata to production
logs (`[botshield-access-audit]`) with shop domain, resource category,
operation, and success/failure. Audit logs do not include order payloads or
Shopify customer identifiers.

## Webhook behavior

- `customers/data_request`: acknowledged; normally no customer-linked record
  exists because events are not associated with Shopify customer IDs
- `customers/redact`: acknowledged; normally no customer-linked record exists
- `shop/redact`: deletes sessions, events, blocklist, whitelist, and settings
- `app/uninstalled`: removes stored Shopify sessions; shop data is removed by
  the subsequent Shopify shop-redaction workflow

## Merchant-requested deletion

Support verifies the store owner before manually deleting store-scoped data.
Deletion should use the same transaction as `shop/redact`.
