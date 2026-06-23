# BotShield Polaris UI Audit

## Ground-up Admin experience rebuild

The production admin now renders
`app/components/admin/BotShieldAdminExperience.jsx`. This is a new interface,
not another composition pass over the previous prototype.

The rebuild follows Shopify's current App Home guidance:

- Task-based navigation is limited to Overview, Activity, Protection, Settings,
  and Setup.
- The custom branded masthead and in-product logo were removed.
- Overview provides setup state, immediate actions, verified metrics, protection
  status, security health, and recent real activity.
- Activity uses a full-width index-style table with filters and row-level
  recovery actions.
- Protection and Settings use the Shopify settings layout: context in the
  narrow column, controls in the wide column, and an explicit save state.
- Subscription remains available from Settings without consuming permanent app
  navigation.
- Setup uses automatically verified steps, contextual actions, support, legal
  links, and an honest enforcement limitation.

The legacy custom route remains in the repository as isolated migration debt,
but it is not rendered by the production app experience.

### Product-depth pass

The new Admin experience now surfaces additional real merchant value without
adding fabricated metrics:

- Seven-day storefront activity compared with the previous seven days.
- Security-score factors and the next verified setup improvement.
- Top real threat signals and approximate traffic origins.
- Activity summary metrics before the full investigation table.
- Plain-language detection sensitivity guidance and network intelligence scope.
- Alert and weekly-report delivery history with visible failure states.
- Diagnostic-data cleanup that never removes real storefront events.

### SaaS visual-depth pass

The production design system now gives every screen a consistent visual layer:

- Neutral Shopify Admin background with elevated white surfaces.
- Consistent 16px card radii, subtle borders, and restrained two-level shadows.
- Stronger metric typography with status-colored edge accents.
- A raised protection summary that establishes hierarchy before detailed data.
- Responsive padding and card density for narrower Admin viewports.

The visual depth is intentionally restrained: no gradients, glass effects,
decorative branding, or fabricated data.

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

## Visual composition sprint

The follow-up composition pass preserves the Polaris/App Bridge foundation while
giving each page a clearer hierarchy:

- Dashboard leads with one protection command center, followed by four compact
  operational signals, verified activity metrics, setup progress, and recent
  storefront activity.
- Incident rows now expose merchant-readable reason codes and approximate
  network location alongside the decision and recovery controls.
- Detection and policy pages summarize the active configuration before exposing
  detailed controls, with a single save action when settings are dirty.
- Billing presents the plan, price, trial, subscription truth, and Shopify action
  as one coherent subscription surface.
- Setup uses ordered, verified checklist rows with contextual actions instead of
  a grid of equally weighted status boxes.

No backend endpoint, storefront enforcement path, billing verification logic, or
email delivery behavior was changed by this sprint.

## Shopify App Store composition rebuild

The premium composition rebuild replaces the dashboard's developer-oriented
card grid with a merchant-facing Security Center:

- Protection status and the next meaningful action lead the page.
- Theme app embed setup becomes the dominant onboarding callout when missing.
- Security outcomes use merchant language: verified visitors, threats stopped,
  suspicious visitors, and requests analyzed.
- Security health explains the score and surfaces the next improvement.
- Operational health is consolidated into a Store Protection Overview instead
  of four disconnected status tiles.
- Setup progress is guided and verifiable.
- Recent activity is summarized as readable security events; the full table is
  reserved for the Investigation Center.
- Technical reason codes are translated into merchant-readable explanations.

The supporting screens are framed by merchant purpose: Investigation Center,
Threat Detection, Response Policy, Subscription, and Setup & Support.

## Competitor-reference simplification pass

After reviewing the supplied Blockify dashboard screenshots, the primary
BotShield dashboard was simplified again around the strongest Shopify app
patterns visible in that reference:

- A short welcome header replaces the oversized security-center presentation.
- One compact status panel exposes theme embed, protection, and setup state with
  direct actions.
- The Overview contains two large merchant outcomes and one plain protection
  settings list.
- Recent storefront activity is limited to four readable rows.
- Support, setup guidance, and diagnostics are presented as three compact cards.
- Promotional cross-sells, competitor branding, and the competitor's orange
  visual identity were deliberately not copied.

Every displayed status and control remains connected to the existing BotShield
model and action layer.

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

Embedded screenshot QA could not be completed in the Codex desktop session
because the in-app browser connection was unavailable. The changed files pass
targeted ESLint, the MVP test suite, TypeScript validation, and the production
React Router build. A final visual pass in Shopify Admin remains required after
deployment.
