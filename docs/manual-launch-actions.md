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
   - optional `ALERT_FROM_EMAIL=BotShield Reports <reports@botshieldapp.com>` sender override
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

1. Keep the existing verified `botshieldapp.com` sending domain. This sender
   change needs no DNS records or separate mailbox.
2. Keep the existing `RESEND_API_KEY` unchanged; do not share it in reports or PRs.
3. Automated weekly reports (scheduled and manual), security alerts, and test
   alerts default to `BotShield Reports <reports@botshieldapp.com>`, with
   `Reply-To: support@botshieldapp.com`. Customer support remains at that address.
4. Check Render's existing `ALERT_FROM_EMAIL` value privately. A valid override
   still takes precedence. If it is set to the old sender or another value,
   update it to `BotShield Reports <reports@botshieldapp.com>` when the release
   is approved, or remove the override to use the new default. If absent, empty,
   invalid, or already matching the new sender, no environment update is needed.
   Reply-To is set by the shared helper and needs no new environment variable.
5. After configuration/release approval, deploy and send an authorized test alert
   and manual weekly report, checking From, Reply-To, recipient, and delivery in
   Resend. Automated tests mock Resend; they do not establish live deliverability.
   Do not send test emails or change live configuration as part of PR review.

## Shopify Partner Dashboard

1. Deploy the BotShield theme app extension to the production app with
   `shopify app deploy` so Shopify registers the `botshield-embed` app embed.
2. After deploy, open a development store Theme Editor, confirm BotShield appears
   under App embeds, enable it on the published theme, and save.
3. Select Shopify App Pricing.
4. Create BotShield Basic at $29 USD/month with a 7-day trial and confirm
   its plan handle is `basic`.
5. Create the private $0 reviewer/test plan.
6. Set welcome link to `/app/billing-return`.
7. Create a Partner API client with `Manage apps` access.
8. Set `SHOPIFY_PARTNER_ORG_ID` to the organization ID from the Partner
   Dashboard URL.
9. Set `SHOPIFY_PARTNER_ACCESS_TOKEN` to the Partner API client token.
10. Set `SHOPIFY_PARTNER_APP_ID` to BotShield's
   `gid://shopify/App/...` identifier.
11. Set `SHOPIFY_APP_HANDLE` to the listing/app handle and
   `SHOPIFY_TEST_PLAN_HANDLE` to the private test plan handle.
12. Verify the test plan appears and approval returns to BotShield.
13. Verify `/api/billing-status` shows an active test subscription.
14. Cancel the test plan and verify BotShield reports billing inactive before
    enabling enforcement.
15. Only then set `BILLING_ENFORCEMENT_ENABLED=true`.
16. Add listing copy, legal URLs, support email, screenshots, and reviewer
    instructions.
