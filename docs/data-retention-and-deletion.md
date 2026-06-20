# BotShield Data Retention and Deletion

## Data stored

- Shopify shop domain and app sessions
- Merchant protection and alert settings
- Storefront security events: IP address, user agent, path, decision, risk,
  reason codes, source, and network intelligence
- Merchant blocklist, whitelist, analyst notes, and trusted tags
- Email/report delivery status and provider message IDs
- Cached IP network intelligence

BotShield does not intentionally store customer names, order contents, payment
details, or Shopify customer IDs.

## Retention

- Network-intelligence cache: 24 hours
- Security events and merchant configuration: while installed and until the
  Shopify shop-redaction process is completed
- Valid privacy requests: completed within 30 days unless retention is legally
  required

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

