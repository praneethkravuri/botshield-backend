# BotShield merchant onboarding — implementation and release review

**Review only. Do not merge or deploy yet.** The visual implementation and synthetic-session checks are ready for review. Real Shopify development-store validation has not run. The existing app configuration does not grant `read_themes`, so published-theme verification and automatic completion are intentionally withheld under the current permissions. A decision about optional theme access is required before this can deliver the complete production activation flow.

## What changed

The authenticated embedded route **`/app/onboarding`** presents one guide with three steps: open the Theme Editor, enable and save the embed, and verify activation. It uses the existing embedded provider, React Router, query-preserving navigation, app frame and action buttons. No frontend dependency was added.

The welcome illustration is an original lightweight SVG storefront and shield, with ambient nodes and a scanning line. Cards enter with restrained staggered motion. The ten-second tutorial illustrates the Theme Editor entry, App embeds panel, toggle, and Save action. Pause also pauses the hero's ambient motion; replay restarts the tutorial. Written instructions are always available. Reduced motion disables decorative animations and shows static instructions. The verified completion screen draws a checkmark, adds a small particle burst, and offers immediate Overview navigation, a pause action, and instruction review. Normal automatic continuation takes 2.5 seconds. Intentional visits by already-configured merchants stay open for review.

Overview has one setup reminder and routes its incomplete connection actions to the guide. Settings → Connections → Theme activation → Setup guide reopens it. Existing Protection controls can still open Shopify's editor directly. No dashboard, pricing, policy, detection, reporting, webhook or database schema logic changed.

## Verification and the permission decision

The installed `@shopify/app-bridge-types` describes an active theme embed as present **in a theme**. It exposes activation placements containing `themeId`; it does not expose a published-theme flag or theme name. The former helper treated `status: active` as sufficient evidence of published-theme activation. This guide does not make that assumption.

`GET /api/onboarding` authenticates through the existing `authenticate.admin(request)` and derives the shop from the session. If that session already grants `read_themes`, the backend requests only `themes(first: 1, roles: [MAIN]) { nodes { id name role } }`. It does not attempt the theme query without permission. The client reuses `readThemeAppEmbedStatus` and requires the correct active `botshield-embed` placement to match that published theme ID before showing completion. An active draft, an unavailable response, traffic events, a saved guide acknowledgment, and clicking Open Theme Editor cannot produce success.

**No scope was added or requested in this PR.** With today's `write_app_proxy` / optional `read_orders` configuration, merchants can read the guide, open the current published Theme Editor, see raw embed status and use Overview, but published-theme confirmation stays unverified. The dashboard connection presentation also treats unconfirmed published activation as unavailable rather than declaring protection ready. This is why the PR must not be deployed as a completed first-install flow yet.

The proposed resolution is an **optional `read_themes` permission**, requested only when verifying theme activation, subject to owner approval and development-store validation. That request and Shopify configuration change are not included while the decision is pending. If retaining current permissions is preferred, approve the explicit limitation: published-theme success and automatic completion cannot be promised.

Official references for review:

- https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/ux
- https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration
- https://shopify.dev/docs/api/app-bridge-library/apis/app

Fetching shopify.dev was blocked by this environment's network policy; the implementation audit used the repository's installed App Bridge types, extension schema and existing helper. No external documentation access is claimed.

## Editor link and merchant profile

The existing helper targets `https://{authenticated-shop}/admin/themes/current/editor?context=apps&activateAppId={app-api-key}/botshield-embed`. It now rejects unsafe shop domains and handles, and encodes parameter values. The app key is public configuration; no access token goes into the link. The editor opens in a new tab with `noopener,noreferrer`, leaving the embedded guide available for the merchant's return.

The guide defaults to the current published theme. No theme-list permission or draft-theme chooser was silently introduced. Shopify's editor remains the place to select a different theme, with a reminder that draft activation does not verify the published storefront.

The profile shows the authenticated `.myshopify.com` identifier, plus the published theme name when available through an already-authorized session. It does not invent a store name or request personal details. The actual `body`-target embed has an empty settings schema: the guide explains that it has no Theme Editor settings, applies where the storefront theme renders the embed, and does not add an embed to checkout. It explains activation, deactivation and saving without changing legal content.

## Routing, persistence and failure handling

- The parent route retains Shopify authentication. OAuth, billing returns, webhooks and public routes are not intercepted. Billing return skips activation/profile requests entirely.
- Only an initial `/app` visit with an unacknowledged guide and a confirmed inactive/missing embed is offered onboarding. Explicit legacy views and charge-return parameters are not redirected.
- A small initial loading state prevents flashing Overview before this decision. Subsequent background checks do not unmount the dashboard.
- Per-shop guide acknowledgment uses the existing `AppSetting` unique `(shop, key)` record, key `onboarding.guideAcknowledged.v1`, value `acknowledged`. It records visiting the guide or already-enabled embed status, **not technical completion**. No migration is needed. The authenticated session supplies the shop on reads and writes; request bodies cannot choose a shop.
- A failed acknowledgment save displays a retry and preserves dashboard access for the current app session. A later session may offer the guide again until saving succeeds.
- The selected instruction step is an optional per-shop `sessionStorage` convenience; blocked storage does not prevent setup. No stored browser value verifies activation.
- The provider is keyed to the authenticated merchant shop. It validates profile responses against that shop and cancels stale lifecycle results.
- Initial load, route entry, window focus, visibility return and manual checks share one in-flight request. Every check reloads the published-theme context to account for theme changes. There is no periodic polling. Profile and App Bridge calls have bounded timeouts.
- Starting any new check immediately removes current success. Failed verification retains a separately labeled historical status without using it for completion or a delayed redirect.
- Success depends on the matching published placement, independent of subscription, protection preferences or recorded traffic. Analytics can remain empty after valid activation.
- Exiting the guide or disabling the embed later does not lock merchants out of Overview. Returning users can always reopen the guide.

## Evidence

All screenshots and the recording below use **synthetic local sessions and mocked Shopify activation responses**, never actual merchant data. The built application is rendered with the real downloaded Polaris runtime. The local harness replaces only its in-memory parent loader; deployed authentication source is not bypassed. Screenshots hide Shopify's host-consumed navigation element to represent the content area. The simulated iframe exercise adjusts `frame-ancestors` only in the browser's intercepted test response to permit a localhost parent; production CSP is unchanged. It is not a live Shopify Admin test.

Baseline captures come from an archive of `ac2e90ddd84b2265c010bef82aa32aeaaa1c1d83`, built separately with the same dependencies.

| View | Evidence |
| --- | --- |
| Before: Overview / Connections | [Overview](screenshots/merchant-onboarding/before-overview.png), [Connections](screenshots/merchant-onboarding/before-connections.png) |
| Welcome / Theme Editor | [Desktop](screenshots/merchant-onboarding/welcome-desktop.png) |
| Enable and save | [Desktop](screenshots/merchant-onboarding/enable-and-save-desktop.png), [mobile](screenshots/merchant-onboarding/enable-and-save-mobile.png) |
| Verification | [Inactive](screenshots/merchant-onboarding/verify-inactive-desktop.png), [checking](screenshots/merchant-onboarding/verification-checking.png), [unavailable](screenshots/merchant-onboarding/verify-unavailable-desktop.png) |
| Draft activation is not success | [Unpublished theme](screenshots/merchant-onboarding/draft-theme-not-complete.png) |
| Permission limitation | [Unconfirmed published theme](screenshots/merchant-onboarding/theme-access-limitation.png) |
| Completion / destination | [Success](screenshots/merchant-onboarding/verified-success.png), [Overview](screenshots/merchant-onboarding/overview-after-onboarding.png) |
| Required viewport widths, reduced motion | [1440](screenshots/merchant-onboarding/onboarding-1440-reduced-motion.png), [1280](screenshots/merchant-onboarding/onboarding-1280-reduced-motion.png), [1024](screenshots/merchant-onboarding/onboarding-1024-reduced-motion.png), [768](screenshots/merchant-onboarding/onboarding-768-reduced-motion.png), [390](screenshots/merchant-onboarding/onboarding-390-reduced-motion.png), [360](screenshots/merchant-onboarding/onboarding-360-reduced-motion.png) |
| Simulated iframe / mobile verification | [Content area](screenshots/merchant-onboarding/simulated-shopify-admin-content-area.png), [mobile verification](screenshots/merchant-onboarding/verify-activation-mobile.png) |
| Tutorial motion | [10-second recording](screenshots/merchant-onboarding/tutorial-motion.mp4) (silent, sampled from actual rendered frames) |

![Desktop onboarding](screenshots/merchant-onboarding/welcome-desktop.png)

## Checks run

- `npm run test:mvp`: **451 tests passed**, including the 426-test existing baseline and 25 new onboarding checks; both existing style and hydration SSR probes passed.
- `npm run typecheck`: passed.
- `npm run build`: passed. No added application dependencies. The onboarding route bundle is approximately 5 KB gzipped and its scoped stylesheet approximately 6 KB gzipped in this build.
- `npx vite-node app/dev/onboarding-ssr-probe.mjs`: actual onboarding SSR/hydration passed with a synthetic session and reduced motion. Existing React Router SSR development warnings remain; no hydration mismatch was reported by the probe.
- Targeted lint for all new modules, route changes, browser script and focused tests: passed. The two large pre-existing admin files retain their original diagnostics (87 errors / 3 warnings in the index route, 21 errors / 2 warnings in the admin component). Full lint reports **190 errors and 6 warnings**, down from 192 / 6 because the touched parent route now correctly places its two existing `process` directives. Repository-wide lint is not passing.
- Local PostgreSQL: acknowledgment persisted through independent Prisma clients, remained isolated between two synthetic shops, and was idempotent. Only those temporary test keys were cleaned up. No production database or migration was used.
- All **nine browser acceptance scenarios passed**. Browser checks cover first-visit routing, editor URL, instructions, keyboard focus, pause/replay, manual checks, missing/inactive/unavailable statuses, draft rejection, current success invalidation, request deduplication, Overview continuation, intentional review, Settings entry, back/refresh, exit after failed save, permission limitation, all requested viewport widths and reduced motion.
- The simulated Shopify Admin content-frame layout check passed using a local-only test CSP adjustment. A real Shopify frame remains unverified.
- Axe WCAG 2 A/AA and 2.1 AA: zero reported violations across all three steps at 1280 and 360 widths after fixing observed contrast issues. This automated scan is not a complete accessibility certification.
- Real local server with synthetic credentials: `/health` returned 200 with the local database connected; public `/data-use`, `/data-retention`, `/privacy`, `/terms`, `/data-deletion` returned 200. Unauthenticated `/app/onboarding`, existing `/app/settings` and `/api/onboarding` all returned Shopify's existing 410 handling response with these fake credentials. This confirms protected routes did not become public; it does not prove authenticated Shopify login works.
- OAuth, billing, webhooks/HMAC, protection, analytics and related regression tests passed as part of the full suite. Their production behavior has not been retested in a real merchant session.

## Repeatable local checks

Use Node 24.17.0 and the documented local PostgreSQL setup. Do not use Render database credentials.

```sh
npm run test:mvp
npm run typecheck
npm run build
npx vite-node app/dev/onboarding-ssr-probe.mjs
npx eslint app/components/onboarding app/lib/onboarding.js app/lib/onboarding.server.js app/lib/published-theme.server.js app/routes/api.onboarding.jsx app/routes/app.onboarding.jsx app/lib/theme-extension-status.js app/lib/theme-extension-status.client.js app/routes/app.jsx app/dev/onboarding-ssr-probe.mjs scripts/test-onboarding-browser.mjs tests/onboarding.test.mjs scripts/dev-onboarding-preview.mjs
```

For the browser acceptance runner, use a local synthetic-session preview. The guarded `scripts/dev-onboarding-preview.mjs` harness replaces only the built app parent loader in memory and binds to loopback. It refuses production mode, requires explicit opt-in and refuses non-local databases. Browser tooling was installed outside the repository, so it does not alter production dependencies. Configure `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH`, `AXE_MODULE` and `BOTSHIELD_POLARIS_SCRIPT` for your tooling paths and set `BOTSHIELD_ONBOARDING_BASE_URL` to that localhost preview. `BOTSHIELD_SCREENSHOTS` selects the evidence directory. Then run:

```sh
node scripts/test-onboarding-browser.mjs
```

Start the separate local preview after building:

```sh
BOTSHIELD_SYNTHETIC_PREVIEW=1 node scripts/dev-onboarding-preview.mjs
```

Browser tooling can be installed outside the checkout, for example `npm install --prefix /tmp/botshield-browser-tools --no-save playwright-core @axe-core/playwright`. Set `PLAYWRIGHT_MODULE=/tmp/botshield-browser-tools/node_modules/playwright-core/index.mjs` and `AXE_MODULE=/tmp/botshield-browser-tools/node_modules/@axe-core/playwright/dist/index.mjs`. Use an installed Chromium via `CHROMIUM_PATH` and a locally downloaded copy of Shopify's `https://cdn.shopify.com/shopifycloud/polaris.js` via `BOTSHIELD_POLARIS_SCRIPT`. No browser package was added to the app manifest or lockfile.

The runner refuses a non-local base URL. It mocks activation/profile/backend responses and must not be used to claim real Shopify verification.

## Sarah's Candles development-store smoke test — not performed

Use the actual development-store domain in Shopify CLI; the display name “Sarah's Candles” is not hardcoded into the app. Use a development app configuration and test credentials, keeping committed production URLs and secrets unchanged.

1. Resolve the optional theme-access decision first. If approved, implement and review the optional scope/request, deploy that configuration only to the development app, and validate grant and denial. Without theme access, confirm the limitation state and absence of success instead.
2. Run `shopify app dev --store=<actual-development-store.myshopify.com>` with the development app configuration. Open the authenticated embedded app through Shopify Admin. Check subscription approval and any reauthentication still use the existing flows.
3. For initial-visit behavior, use a fresh development shop or clear only that development shop's guide acknowledgment key in its development database. Never clear merchant settings or production data. With the published embed disabled, opening `/app` should offer `/app/onboarding`. Loading should be stable without an Overview flash.
4. Verify the displayed shop identifier and, when authorized, published theme name match Shopify. Activate Open Theme Editor: it must open that shop's current published theme, App embeds context, with the BotShield embed selected. Check that the embedded guide remains open in its tab.
5. Find BotShield under App embeds. Turn it on but do not save; return and verify that opening the editor alone is insufficient. Save, return to BotShield, and check the refreshed status. No tutorial control can change the actual embed status.
6. With published theme identity and its active placement verified, observe the completion animation and immediate Go to Overview control. Check Stay on this page, then automatic continuation, and query-parameter preservation. Confirm the normal `/app` Overview loads.
7. Reload Overview and reopen the app in another staff session. Onboarding should not be forced again. Settings → Connections → Setup guide should open a reviewable guide and remain there for an already-active shop.
8. Disable and save the published embed. Return to Overview: dashboard access remains available and a setup reminder appears. Re-enable it and confirm the reminder disappears only after current verification.
9. Activate only an unpublished theme; it must not produce published-theme success. Switch published themes and recheck. Test unavailable Shopify responses and theme permission denial; no stale success or redirect is allowed.
10. Test keyboard-only setup, written instructions, pause/replay, reduced motion and narrow Shopify Admin content widths. Confirm editor/new-tab behavior on desktop and mobile.
11. Open Overview, Protection, Analytics, Value, Fraud Orders and Settings. Confirm existing data and controls remain functional. Check billing status, session refresh and established webhook delivery monitoring without changing prices, secrets or endpoints. Do not run synthetic browser mocks against production.
12. Review screenshots and the real flow with the owner before approving merge or production release. Shopify App Store compliance approval has not been established by this work.

## Deployment after explicit approval

1. Resolve the theme-access decision, finish its development-store tests, and review the exact PR diff and visual evidence. Re-run checks after any resulting code/config change. This draft is not approval to deploy a Shopify configuration change.
2. After owner approval, merge the reviewed PR into `main` using normal GitHub checks. Do not bypass checks or force-push. Render's existing GitHub auto-deploy should run its unchanged build/start commands on the Starter service. No new environment variables, domain, service or database migration are needed for the implementation in this PR.
3. If a separately reviewed Shopify optional-scope change is included later, release that application configuration only through the approved Shopify workflow. A Render deploy alone does not publish Shopify app configuration.
4. Inspect Render's build log and service Live status. Request `/health` at `https://botshield-backend.onrender.com/health` and require two HTTP 200 responses with `ok: true`, `database: "connected"`, and `deployCommit` matching the actual merge commit. A healthy old commit is not deployment confirmation.
5. Repeat the authenticated Sarah's Candles smoke test on the approved release and inspect errors. Do not claim production success from build output or a mocked session.

## Rollback

If release verification fails, stop rollout and use Render's rollback to the last confirmed healthy deploy, or create a normal GitHub revert PR for this feature's merge commit and allow the approved GitHub deployment process to run. Do not reset or force-push `main`. Confirm the old commit via `/health` and check the embedded app. The harmless guide-acknowledgment rows can remain; the prior app ignores them. There is no schema migration to reverse. Any later Shopify optional-permission configuration change needs its own reviewed rollback; reverting a Render build does not roll back Shopify configuration.

## Changed-file inventory

- `app/components/onboarding/OnboardingPage.jsx`: guide steps, merchant context, review/completion/navigation and written instructions.
- `app/components/onboarding/OnboardingIllustrations.jsx`: original SVG and illustrative editor motion.
- `app/components/onboarding/ThemeActivationProvider.jsx`: shared current verification and profile lifecycle.
- `app/components/onboarding/OnboardingGate.jsx`: scoped initial-visit routing and loading.
- `app/components/onboarding/SetupReminder.jsx`: Overview setup entry.
- `app/styles/onboarding-premium.css`: isolated responsive, motion and reduced-motion styling.
- `app/lib/onboarding.js`, `app/lib/onboarding.server.js`, `app/lib/published-theme.server.js`: routing rules, bounded checks, authenticated per-shop acknowledgment and optional authorized published-theme query.
- `app/lib/theme-extension-status.js`, `app/lib/theme-extension-status.client.js`: existing helper validation and published-placement verification.
- `app/routes/app.onboarding.jsx`, `app/routes/api.onboarding.jsx`: embedded guide and authenticated metadata endpoints.
- `app/routes/app.jsx`, `app/routes/app._index.jsx`: shared provider, merchant isolation, initial gate and existing dashboard connection state integration.
- `app/components/admin/BotShieldAdminExperience.jsx`: Overview and Settings setup entry points.
- `tests/onboarding.test.mjs`, `tests/overview-store-health-refresh.test.mjs`, `tests/settings-phase2-closeout.test.mjs`: focused tests and revised navigation expectations.
- `app/dev/onboarding-ssr-probe.mjs`, `scripts/test-onboarding-browser.mjs`, `scripts/dev-onboarding-preview.mjs`: executable hydration, guarded local preview and browser acceptance checks.
- This report and `docs/screenshots/merchant-onboarding/`: review evidence and release instructions.
