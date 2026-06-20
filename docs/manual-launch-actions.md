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
   - `ALERT_FROM_EMAIL`
   - `VITE_SUPPORT_EMAIL`
   - `SHOPIFY_APP_HANDLE`
   - optional `IPAPI_IS_KEY`
6. Keep `BILLING_ENFORCEMENT_ENABLED=false` until billing has been tested.

## Resend

1. Add a sending domain.
2. Publish Resend's SPF and DKIM DNS records exactly as shown.
3. Wait for the domain to show Verified.
4. Create a restricted production API key.
5. Set `ALERT_FROM_EMAIL` to a sender on the verified domain.
6. Redeploy and send both a test alert and weekly report.

## Shopify Partner Dashboard

1. Select Shopify App Pricing.
2. Create BotShield Pro at $30 USD/month with a 7-day trial.
3. Create the private $0 reviewer/test plan.
4. Set welcome link to `/app/billing-return`.
5. Set `SHOPIFY_APP_HANDLE` to the listing/app handle.
6. Verify the test plan appears and approval returns to BotShield.
7. Verify `/api/billing-status` shows an active test subscription.
8. Only then set `BILLING_ENFORCEMENT_ENABLED=true`.
9. Add listing copy, legal URLs, support email, screenshots, and reviewer
   instructions.

