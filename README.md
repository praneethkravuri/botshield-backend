# BotShield

BotShield is a Shopify embedded app focused on helping merchants detect and control suspicious bot traffic from an in-app dashboard.

## What the MVP does

- Scores traffic as `low`, `medium`, or `high` risk
- Allows, blocks, or whitelists traffic based on policy settings
- Stores scan history, evidence reasons, blocked IPs, and whitelisted IPs
- Lets merchants control:
  - auto-block
  - strict mode
  - block level
  - alert routing
- Includes a security copilot and analyst tools

## Main app areas

- `Dashboard`
  - executive overview
  - live operations
  - business impact
  - evidence and analyst workspace
- `Security`
  - threat sensitivity
  - scan controls
  - live logs
  - recent security records
- `Policy Settings`
  - alert routing
  - protection policy
  - saveable protection controls

## Key files

- `app/routes/app._index.jsx`
  - primary BotShield UI and operator experience
- `app/routes/api.scan.jsx`
  - live threat scan endpoint
- `app/routes/api.scans.jsx`
  - scan history loader
- `app/routes/api.settings.jsx`
  - protection settings API
- `app/routes/api.blocklist.jsx`
  - blocked IP API
- `app/routes/api.whitelist.jsx`
  - whitelist API
- `app/lib/bot-detection.server.js`
  - threat scoring engine
- `app/lib/bot-control.server.js`
  - settings, blocklist, and whitelist helpers
- `prisma/schema.prisma`
  - app data model

## Local development

```powershell
npm run dev
```

## Production build

```powershell
npm run build
```

## MVP status

BotShield is in launch-grade MVP shape:

- real backend-connected scan flow
- real settings persistence
- real blocklist / whitelist flows
- polished SaaS UI
- submission-ready direction

## Before Shopify submission

Review:

- `SHOPIFY_SUBMISSION_CHECKLIST.md`
- `APP_STORE_LISTING_COPY.md`
- `PRIVACY_POLICY_TEMPLATE.md`
- `SUPPORT_AND_URLS_TEMPLATE.md`

## App icon

- Base icon asset: `public/botshield-app-icon.svg`

## Notes

- `shopify.app.toml` still needs real production URLs before submission
- the app is a strong MVP, not a full enterprise edge-security network
