# BotShield Polaris UI Audit

## Architecture decision

BotShield uses Shopify's React Router application template with
`@shopify/shopify-app-react-router` and App Bridge 4. The app shell already
loads Shopify's Polaris web components (`s-*`). The migration therefore uses
Polaris web components and App Bridge APIs instead of adding the legacy
`@shopify/polaris` React package.

## Existing screens

| Screen | Previous state | Migration |
| --- | --- | --- |
| Dashboard | Working data, highly custom layout, inconsistent actions | Polaris page, status banner, metrics, readiness, activity, locations |
| Security | Working settings and diagnostics, custom controls | Detection settings page with save state and async actions |
| Settings | Working persistence, weak form/action feedback | Policy page with validation, save state, Resend status, lists |
| Incidents | Working API and recovery, embedded in custom dashboard | Dedicated responsive Polaris table and recovery actions |
| Billing | Working status API, buried in custom status panels | Dedicated plan/status page using dynamic Basic pricing |
| Setup/help | Information distributed across dashboard/footer | Dedicated readiness, legal, support, and limitation page |

## Interactive control audit

| Control | Endpoint/action | Previous UX | Migrated UX |
| --- | --- | --- | --- |
| Refresh dashboard | Multiple authenticated API loaders | Custom button, weak failure feedback | Async button, loading, dedupe, toast |
| Run diagnostic | `POST /api/scan` | Custom button and local notification | Polaris loading button, toast, labeled diagnostic result |
| Generate simulation | `POST /api/scan` | Custom button | Clearly labeled simulation, loading and toast |
| Save detection settings | `POST /api/settings` | Immediate/custom controls | Dirty state, save/discard, validation, error state |
| Auto Block | `POST /api/settings` | Custom toggle | Polaris switch in saved settings form |
| Strict Mode | `POST /api/settings` | Custom toggle | Polaris switch with dependency behavior |
| Pause/resume | `POST /api/settings` | Multiple custom buttons | Async action with persistent status |
| Save alert settings | `POST /api/settings` | Custom form | Email validation, dirty state, save/discard |
| Send test email | `POST /api/alerts/test` | No local loading state | Loading, disabled, deduped, toast, status refresh |
| Send weekly report | `POST /api/weekly-report` | No local loading state | Loading, disabled, toast, status refresh |
| Add/remove blocked IP | `/api/blocklist` | Custom table/buttons | Polaris field/table/actions with loading and toast |
| Add/remove trusted IP | `/api/whitelist` | Custom table/buttons | Polaris field/table/actions with loading and toast |
| Incident recovery | `POST /api/incident-recovery` | Custom buttons | Row-level async actions and refreshed data |
| Refresh billing | `GET /api/billing-status` | Buried in status action | Dedicated loading action and toast |
| Choose plan | Shopify App Pricing URL | Custom external action | Dynamic Shopify plan action |
| Clear simulation data | `POST /api/clear-test-data` | Custom action | Clearly scoped danger zone; real events preserved |

## Status and copy audit

- Raw provider, billing, protection, event, and source values are normalized in
  `app/lib/ui-status.js`.
- Production metrics use real storefront events only.
- Diagnostic and simulation events remain separately labeled.
- The UI describes theme-embed/JavaScript enforcement limitations and does not
  claim edge-WAF protection.
- Billing copy uses BotShield Basic, $14.99/month, and a 7-day trial.

## Known legacy debt

The old custom dashboard presentation remains in `app/routes/app._index.jsx`
behind the internal `legacy` page state during the production migration. It is
not linked from Shopify navigation. It can be removed after the Polaris
experience completes embedded production QA.

The repository-wide ESLint command also reports pre-existing errors in legacy
dashboard components, legal pages, and Node environment configuration. All new
Polaris files pass targeted ESLint.
