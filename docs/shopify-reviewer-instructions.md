# Shopify Reviewer Instructions

## Test store and access

Provide Shopify with a development/test store and any required collaborator
access in the Partner Dashboard review form. Do not place passwords in this
repository.

## Installation and setup

1. Install BotShield and open it from Shopify Admin.
2. The embedded dashboard should load without leaving Shopify Admin.
3. Open Online Store > Themes > Customize.
4. Select App embeds.
5. Enable the BotShield app embed and click Save.
6. Visit the storefront homepage in a new browser tab.
7. Return to BotShield and click Refresh Runtime.
8. Confirm Theme Embed Detected, Storefront Connected, and a real storefront
   event in the Incident Timeline.

## Diagnostic verification

1. Click Run Diagnostic Scan.
2. Confirm the event is labelled Simulation or Diagnostic.
3. Confirm the real storefront event count does not increase because of the
   diagnostic.
4. Confirm the diagnostic does not add an IP to the production blocklist.

## Enforcement verification

1. Add the reviewer's current test IP to the whitelist and reload the storefront.
2. Confirm a `WHITELIST_MATCH` event is allowed.
3. Remove the whitelist entry.
4. Add a controlled test IP to the blocklist.
5. Request the storefront from that controlled IP and confirm the blocked page.
6. In Incident Timeline, use Unblock or Whitelist to demonstrate recovery.

Do not intentionally block the reviewer's only available IP without a second
session or recovery path.

## Billing verification

Use Shopify App Pricing's private $0 test plan during review. Configure its
welcome link as `/app/billing-return`. The public plan should be BotShield
Basic, $29 USD monthly, with a 7-day free trial and plan handle `basic`.

## Email verification

1. Enter a reviewer-controlled email address in BotShield Settings.
2. Enable Email Alerts and Weekly Reports.
3. Save.
4. Click Send Test Email.
5. Confirm the email arrives and the dashboard records `sent`.
6. Click Send Weekly Report Now and confirm delivery.

## Important product limitation

BotShield uses a Shopify theme app embed and storefront JavaScript. It is not an
edge WAF or server-side interceptor. Clients that bypass JavaScript may not be
inspected.
