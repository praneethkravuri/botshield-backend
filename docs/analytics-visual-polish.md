# Analytics dashboard visual polish

Analytics now uses a brighter neutral canvas and independent white card surfaces
with consistent borders, restrained shadows and spacing. The four metrics are
separate cards, with aligned labels/values and full wrapping for the top signal.
Filters use readable sentence-case labels and a clearly separated dataset footer.
The activity chart, rankings, outcomes, visitor table, signal combinations, insight,
investigation summary and Event explorer share the same surface treatment.

Phone metrics form a compact two-by-two grid. Paired analysis panels stack below
980px, and the activity bars can shrink to their available width. The mobile
header no longer reserves a large empty flex column. Tablet filters align in three
columns when signals are available, while empty datasets keep a balanced layout.
Summary values wrap, empty panels shed their nested gray surfaces, and loading
has a matching card. Existing chart values, periods, labels and tooltips remain.

## Before and after

These are synthetic-data screenshots from local builds, not live merchant data
or Shopify Admin captures. The original main-branch build and the proposed build
use the same 36 synthetic events and fixed browser clock. The official Polaris
runtime is loaded; App Bridge, API data and external font/icon responses are
mocked. Screenshot assets are documentation only and are not served by the app.

| View | Before | After |
| --- | --- | --- |
| Desktop, complete page | [1280px](screenshots/analytics-polish/before-1280.png) | [1280px](screenshots/analytics-polish/after-1280.png) |
| Phone, complete page | [390px](screenshots/analytics-polish/before-390.png) | [390px](screenshots/analytics-polish/after-390.png) |
| Independent metrics | — | [Detail](screenshots/analytics-polish/after-metrics-desktop.png) |
| Activity chart and facts | — | [Detail](screenshots/analytics-polish/after-activity-desktop.png) |
| Loading | — | [Phone](screenshots/analytics-polish/after-loading.png) |
| No-data layout | — | [Phone](screenshots/analytics-polish/after-no-data-phone.png) |

## Changes and scope

- `app/styles/analytics-premium.css`: Analytics-only surfaces, typography, spacing, responsive grids, chart sizing, table presentation, focus and loading styles. PostCSS parsing and selector inspection confirm every non-keyframe selector remains scoped to `.botshield-analytics-premium`. No new animations, dependencies, fonts, app images or requests were introduced.
- `app/components/admin/BotShieldAdminExperience.jsx`: only the three Analytics table wrappers, their small `AnalyticsTableRegion` helper, and a local loading-card wrapper. The table regions have names and tab stops so keyboard users can scroll the existing tables. The helper documents one scoped lint exception for a scroll region's necessary tab stop; it keeps an accurate region role instead of incorrectly claiming interactive grid behavior.
- This release note and its screenshots.

Removing those presentation/accessibility wrappers restores the component source
byte-for-byte to the original main-branch version. Calculations, event handling,
API sources, date filtering, classifications, intervention logic, search,
pagination, refresh and detail actions are unchanged. Table content still scrolls
locally on narrow screens; page and chart overflow are checked separately.

No changes affect Overview, Protection, Value, Fraud Orders, Settings, Shopify
authentication, sessions, billing/$29 pricing, compliance webhooks, HMAC
verification, database schemas/migrations, Render, environment configuration or
the marketing website.

## Validation

- `npm run test:mvp`: **426 passed**, zero failures or skips; both style/hydration SSR probes passed. This includes the existing Analytics suites.
- `npm run build` and `npm run typecheck`: passed.
- Global lint retains the existing **192 errors and six warnings**. Targeted lint of the modified admin component has **21 errors and two warnings**, matching the original version's rules/messages with no additional findings. The stylesheet parses successfully; this repository has no separate CSS lint command.
- Chromium at **1440, 1280, 1024, 768, 390 and 360px**: no page, chart or metric-content overflow. Metrics have independent borders/shadows; controls retain usable dimensions; paired panels stack at narrow widths. The complete desktop/phone pages and individual lower sections were visually inspected.
- A fixed-clock comparison against the original main-branch build matched all **11 scenarios**: default, decision, risk, signal, search, four periods, pagination and no-match selection. Metric strings, event rows, context, pagination, bucket counts and inline bar heights match.
- Desktop and phone axe checks, scoped to Analytics with WCAG 2 A/AA and 2.1 AA tags: **zero violations** after correcting keyboard access to scrollable tables.
- Native keyboard filter order, visible table focus, arrow-key table scrolling, and keyboard reachability/44px height of phone Event explorer actions passed.
- Initial loading, disabled refresh progress, one scan request per refresh, retained selected filters and no-data layouts passed. Empty-data layouts also passed at 1280, 390, 360 and a 960px available-content-width simulation.
- Completed browser checks reported no uncaught page errors and ran with reduced motion enabled.

Live Shopify authentication/App Bridge/iframe behavior, production data integration
and manual screen-reader testing remain unverified. The local width simulation is
not a live Shopify session. Accessibility results are limited to the tested rules
and scope. No production credentials, database operations or protection actions
were used during these checks.

## Deployment and rollback

1. Review this focused PR and the screenshots. Before release approval, check Analytics in a real Shopify development-store session: all filters, periods, search, clear, refresh, pagination, details, keyboard scrolling, loading/empty states and a narrow Admin window. Confirm normal app navigation remains intact.
2. Only after approval to merge and deploy, merge into `main`. The existing Render service may auto-deploy immediately; do not merge merely to stage the change.
3. Keep the current infrastructure and production variables. Existing Render commands remain build `npm ci && npx prisma generate && npm run build`, start `npm run setup && npm run start`. This PR introduces no migration or manual database step.
4. Confirm Render is Live and `/health` passes, then repeat the Analytics smoke checks without changing protection settings or creating a subscription.
5. For a regression, restore the previous successful Render deployment. Revert the PR separately if needed after approval. No schema rollback is required.

No merge, production deployment or live infrastructure change was performed.
