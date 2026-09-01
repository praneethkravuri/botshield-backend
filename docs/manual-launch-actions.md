# Manual Launch Actions

These steps cannot be completed safely by application code.

## Render

1. Upgrade `botshield-db` before June 28, 2026.
2. Select a paid PostgreSQL plan with point-in-time recovery/backups.
3. Upgrade the BotShield web service to a non-sleeping paid instance.
4. Restrict PostgreSQL external access. Remove `0.0.0.0/0` if external access
   is not required, or allow only trusted operator IP ranges.
5. Configure:
   - `RESEND_API_KEY`
   - optional `ALERT_FROM_EMAIL` sender override
   - `VITE_SUPPORT_EMAIL`
   - `SHOPIFY_APP_HANDLE`
   - `SHOPIFY_PUBLIC_PLAN_HANDLE=basic`
   - `SHOPIFY_PARTNER_ORG_ID`
   - `SHOPIFY_PARTNER_ACCESS_TOKEN`
   - `SHOPIFY_PARTNER_APP_ID`
   - `SHOPIFY_TEST_PLAN_HANDLE`
   - optional `IPAPI_IS_KEY`
6. Keep `BILLING_ENFORCEMENT_ENABLED=false` until billing has been tested.

## Resend

1. Add a sending domain.
2. Publish Resend's SPF and DKIM DNS records exactly as shown.
3. Wait for the domain to show Verified.
4. Create a restricted production API key.
5. Verify `botshieldapp.com` in Resend. BotShield defaults to
   `BotShield <support@botshieldapp.com>`.
6. Optionally set `ALERT_FROM_EMAIL` to another sender on the verified domain.
7. Redeploy and send both a test alert and weekly report.

## Shopify Partner Dashboard

1. Select Shopify App Pricing.
2. Create BotShield Basic at $29 USD/month with a 7-day trial and confirm
   its plan handle is `basic`.
3. Create the private $0 reviewer/test plan.
4. Set welcome link to `/app/billing-return`.
5. Create a Partner API client with `Manage apps` access.
6. Set `SHOPIFY_PARTNER_ORG_ID` to the organization ID from the Partner
   Dashboard URL.
7. Set `SHOPIFY_PARTNER_ACCESS_TOKEN` to the Partner API client token.
8. Set `SHOPIFY_PARTNER_APP_ID` to BotShield's
   `gid://shopify/App/...` identifier.
9. Set `SHOPIFY_APP_HANDLE` to the listing/app handle and
   `SHOPIFY_TEST_PLAN_HANDLE` to the private test plan handle.
10. Verify the test plan appears and approval returns to BotShield.
11. Verify `/api/billing-status` shows an active test subscription.
12. Cancel the test plan and verify BotShield reports billing inactive before
    enabling enforcement.
13. Only then set `BILLING_ENFORCEMENT_ENABLED=true`.
14. Add listing copy, legal URLs, support email, screenshots, and reviewer
   instructions.
