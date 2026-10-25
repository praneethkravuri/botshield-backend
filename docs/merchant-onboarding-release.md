# BotShield merchant onboarding — implementation and release review

**Draft PR #10 — ready for owner review, not approved for release.** Published-theme verification now uses Shopify's scope-free App Bridge App API. There is no additional permission prompt, independent theme-ID requirement, or theme Admin API lookup. Real Sarah's Candles testing and owner review of the finished appearance remain required before merge or deployment.

## What changed

The authenticated embedded route **`/app/onboarding`** presents one guide with three steps: open the Theme Editor, enable and save the embed, and verify activation. It uses the existing embedded provider, React Router, query-preserving navigation, app frame and action buttons. No frontend dependency was added.

The welcome illustration is an original lightweight SVG storefront and shield, with ambient nodes and a scanning line. Cards enter with restrained staggered motion. The ten-second tutorial illustrates the Theme Editor entry, App embeds panel, toggle, and Save action. Pause also pauses the hero's ambient motion; replay restarts the tutorial. Written instructions are always available. Reduced motion disables decorative animations and shows static instructions. The verified completion screen draws a checkmark, adds a small particle burst, and offers immediate Overview navigation, a pause action, and instruction review. Normal automatic continuation takes 2.5 seconds. Intentional visits by already-configured merchants stay open for review.

Overview has one setup reminder and routes its incomplete connection actions to the guide. Settings → Connections → Theme activation → Setup guide reopens it. Existing Protection controls can still open Shopify's editor directly. No dashboard, pricing, policy, detection, reporting, webhook or database schema logic changed.

## Technical correction: scope-free published-theme verification

The earlier implementation incorrectly inferred from the installed TypeScript placement types that an independent published-theme lookup was necessary. Shopify's documented **App API contract** says `shopify.app.extensions()` reports theme app extension activation information for the **published theme only**, without additional access scopes. The scope-bearing theme query was unnecessary and has been removed, along with its `published-theme.server.js` module, placement-ID matching helper and permission-limitation UI. No `read_themes` permission is added, requested or required.

The client calls the existing App Bridge API and finds the `theme_app_extension` activation with handle `botshield-embed`. It uses these distinct states:

| Shopify response | BotShield interpretation | Completion |
| --- | --- | --- |
| `active` | Embed enabled on the published theme | Verified |
| `available` | Embed exists but is not activated | Incomplete |
| `unavailable` | Embed is not currently usable (`unusable` connection state) | Incomplete |
| No matching embed | Missing embed | Incomplete |
| Rejected/timed-out call, absent API, malformed or unknown status | Unable to verify (`unavailable` connection state) | Unverified |

Theme placement IDs and theme-name personalization are not needed. The browser fixtures intentionally provide **no theme IDs, theme access flags or theme names**. They verify that `active` completes onboarding and automatically opens Overview without a permission prompt or Admin GraphQL request. They also verify that an unusable embed and a failed API call produce different presentations and cannot produce success.

The animated switch, Open Theme Editor click and per-shop guide acknowledgment remain separate from technical activation. None can verify setup. Draft-theme changes do not alter the published-only API's result until the published theme's activation actually changes; the browser tests no longer invent draft-theme placements in a published-only API response.

`GET /api/onboarding` now returns only authenticated shop identity and guide acknowledgment. It does not use the Admin API or query themes. Metadata loading and App Bridge reading start concurrently; metadata failure cannot substitute for activation proof. Current results have lifecycle guards and bounded timeouts. Returning from the editor coalesces focus/visibility events into one check, with one fresh follow-up if an earlier check was still running. This also covers App Bridge becoming ready after the initial attempt. There is no periodic polling.

Official references supplied for this correction:

- https://shopify.dev/docs/api/app-home/latest/apis/authentication-and-data/app-api
- https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration

Direct retrieval of these pages returned HTTP 403 in this environment; no independent live documentation fetch is claimed. The implementation follows the documented published-only contract specified in the review request.

## Editor link and merchant profile

The existing helper targets `https://{authenticated-shop}/admin/themes/current/editor?context=apps&activateAppId={app-api-key}/botshield-embed`. It now rejects unsafe shop domains and handles, and encodes parameter values. The app key is public configuration; no access token goes into the link. The editor opens in a new tab with `noopener,noreferrer`, leaving the embedded guide available for the merchant's return.

The guide defaults to the current published theme. No theme-list permission or additional permission prompt is introduced. Shopify's editor remains the place to select a different theme, with a reminder that draft activation does not verify the published storefront.

The profile shows the authenticated `.myshopify.com` identifier and “Theme target: current published theme.” Theme-name personalization is omitted. It does not invent a store name or request personal details. The actual `body`-target embed has an empty settings schema: the guide explains that it has no Theme Editor settings, applies where the storefront theme renders the embed, and does not add an embed to checkout. It explains activation, deactivation and saving without changing legal content.

## Routing, persistence and failure handling

- The parent route retains Shopify authentication. OAuth, billing returns, webhooks and public routes are not intercepted. Billing return skips activation/profile requests entirely.
- Only an initial `/app` visit with an unacknowledged guide and a confirmed inactive/missing/unusable embed is offered onboarding. Explicit legacy views and charge-return parameters are not redirected.
- A small initial loading state prevents flashing Overview before this decision. Subsequent background checks do not unmount the dashboard.
- Per-shop guide acknowledgment uses the existing `AppSetting` unique `(shop, key)` record, key `onboarding.guideAcknowledged.v1`, value `acknowledged`. It records visiting the guide or already-enabled embed status, **not technical completion**. No migration is needed. The authenticated session supplies the shop on reads and writes; request bodies cannot choose a shop.
- A failed acknowledgment save displays a retry and preserves dashboard access for the current app session. A later session may offer the guide again until saving succeeds.
- The selected instruction step is an optional per-shop `sessionStorage` convenience; blocked storage does not prevent setup. No stored browser value verifies activation.
- The provider is keyed to the authenticated merchant shop. It validates profile responses against that shop and cancels stale lifecycle results.
- Initial load, route entry, window focus, visibility return and manual checks share one in-flight request. Every check reads Shopify’s current published-theme activation status. Return events are coalesced; one follow-up reads a fresh result if the return happened during an older in-flight check. There is no periodic polling. Profile and App Bridge calls have bounded timeouts.
- Starting any new check immediately removes current success. Failed verification retains a separately labeled historical status without using it for completion or a delayed redirect.
- Success depends only on the matching embed’s `active` status in Shopify’s published-theme API response, independent of subscription, protection preferences or recorded traffic. Analytics can remain empty after valid activation.
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
| Unusable embed / scope-free completion | [Unusable](screenshots/merchant-onboarding/verify-unusable-desktop.png), [scope-free success](screenshots/merchant-onboarding/scope-free-activation-success.png) |
| Completion / destination | [Success](screenshots/merchant-onboarding/verified-success.png), [Overview](screenshots/merchant-onboarding/overview-after-onboarding.png) |
| Required viewport widths, reduced motion | [1440](screenshots/merchant-onboarding/onboarding-1440-reduced-motion.png), [1280](screenshots/merchant-onboarding/onboarding-1280-reduced-motion.png), [1024](screenshots/merchant-onboarding/onboarding-1024-reduced-motion.png), [768](screenshots/merchant-onboarding/onboarding-768-reduced-motion.png), [390](screenshots/merchant-onboarding/onboarding-390-reduced-motion.png), [360](screenshots/merchant-onboarding/onboarding-360-reduced-motion.png) |
| Simulated iframe / mobile verification | [Content area](screenshots/merchant-onboarding/simulated-shopify-admin-content-area.png), [mobile verification](screenshots/merchant-onboarding/verify-activation-mobile.png) |
| Tutorial motion | [10-second recording](screenshots/merchant-onboarding/tutorial-motion.mp4) (silent, sampled from actual rendered frames) |

![Desktop onboarding](screenshots/merchant-onboarding/welcome-desktop.png)

## Checks run

- `npm run test:mvp`: **453 tests passed**, including the 426-test existing baseline and 27 new onboarding checks; both existing style and hydration SSR probes passed.
- `npm run typecheck`: passed.
- `npm run build`: passed. No added application dependencies. The onboarding route bundle is approximately 5 KB gzipped and its scoped stylesheet approximately 6 KB gzipped in this build.
- `npx vite-node app/dev/onboarding-ssr-probe.mjs`: actual onboarding SSR/hydration passed with a synthetic session and reduced motion. Existing React Router SSR development warnings remain; no hydration mismatch was reported by the probe.
- Targeted lint for all new modules, route changes, browser script and focused tests: passed. The two large pre-existing admin files retain their original diagnostics (87 errors / 3 warnings in the index route, 21 errors / 2 warnings in the admin component). Full lint reports **190 errors and 6 warnings**, down from 192 / 6 because the touched parent route now correctly places its two existing `process` directives. Repository-wide lint is not passing.
- Local PostgreSQL: acknowledgment persisted through independent Prisma clients, remained isolated between two synthetic shops, and was idempotent. Only those temporary test keys were cleaned up. No production database or migration was used.
- All **eleven browser acceptance scenarios passed**. Browser checks cover first-visit routing, editor URL, instructions, keyboard focus, pause/replay, manual checks, missing/inactive/unavailable statuses, unusable embed status, scope-free completion, in-flight-return and App Bridge readiness checks, current success invalidation, request deduplication, Overview continuation, intentional review, Settings entry, back/refresh, exit after failed save, all requested viewport widths and reduced motion.
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
npx eslint app/components/onboarding app/lib/onboarding.js app/lib/onboarding.server.js app/routes/api.onboarding.jsx app/routes/app.onboarding.jsx app/lib/theme-extension-status.js app/lib/theme-extension-status.client.js app/routes/app.jsx app/dev/onboarding-ssr-probe.mjs scripts/test-onboarding-browser.mjs tests/onboarding.test.mjs scripts/dev-onboarding-preview.mjs
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

1. Use the existing app permissions. There must be no extra Shopify permission prompt for theme verification. No Shopify application configuration deployment is required for this change.
2. Run `shopify app dev --store=<actual-development-store.myshopify.com>` with the development app configuration. Open the authenticated embedded app through Shopify Admin. Check subscription approval and any reauthentication still use the existing flows.
3. For initial-visit behavior, use a fresh development shop or clear only that development shop's guide acknowledgment key in its development database. Never clear merchant settings or production data. With the published embed disabled, opening `/app` should offer `/app/onboarding`. Loading should be stable without an Overview flash.
4. Verify the displayed shop identifier matches Shopify and the theme target says current published theme; a theme name is intentionally omitted. Activate Open Theme Editor: it must open that shop's current published theme, App embeds context, with the BotShield embed selected. Check that the embedded guide remains open in its tab.
5. Find BotShield under App embeds. Turn it on but do not save; return and verify that opening the editor alone is insufficient. Save, return to BotShield, and check the refreshed status. No tutorial control can change the actual embed status.
6. With App Bridge reporting `active` for `botshield-embed`, observe the completion animation and immediate Go to Overview control. Check Stay on this page, then automatic continuation, and query-parameter preservation. Confirm the normal `/app` Overview loads.
7. Reload Overview and reopen the app in another staff session. Onboarding should not be forced again. Settings → Connections → Setup guide should open a reviewable guide and remain there for an already-active shop.
8. Disable and save the published embed. Return to Overview: dashboard access remains available and a setup reminder appears. Re-enable it and confirm the reminder disappears only after current verification.
9. Activate only an unpublished theme; it must not produce published-theme success. Switch published themes and recheck. Test an embed reported as `unavailable` and failed Shopify API calls separately; no stale success or redirect is allowed.
10. Test keyboard-only setup, written instructions, pause/replay, reduced motion and narrow Shopify Admin content widths. Confirm editor/new-tab behavior on desktop and mobile.
11. Open Overview, Protection, Analytics, Value, Fraud Orders and Settings. Confirm existing data and controls remain functional. Check billing status, session refresh and established webhook delivery monitoring without changing prices, secrets or endpoints. Do not run synthetic browser mocks against production.
12. Review screenshots and the real flow with the owner before approving merge or production release. Shopify App Store compliance approval has not been established by this work.

## Deployment after explicit approval

1. Review the corrected PR diff, finished screenshots and scope-free completion flow in Sarah’s Candles. Re-run checks after any further code changes. Obtain explicit owner approval before merging or deploying.
2. After owner approval, merge the reviewed PR into `main` using normal GitHub checks. Do not bypass checks or force-push. Render's existing GitHub auto-deploy should run its unchanged build/start commands on the Starter service. No new environment variables, domain, service or database migration are needed for the implementation in this PR.
3. Keep Shopify app configuration and permissions unchanged. This implementation requires only the existing Render GitHub deployment workflow.
4. Inspect Render's build log and service Live status. Request `/health` at `https://botshield-backend.onrender.com/health` and require two HTTP 200 responses with `ok: true`, `database: "connected"`, and `deployCommit` matching the actual merge commit. A healthy old commit is not deployment confirmation.
5. Repeat the authenticated Sarah's Candles smoke test on the approved release and inspect errors. Do not claim production success from build output or a mocked session.

## Rollback

If release verification fails, stop rollout and use Render's rollback to the last confirmed healthy deploy, or create a normal GitHub revert PR for this feature's merge commit and allow the approved GitHub deployment process to run. Do not reset or force-push `main`. Confirm the old commit via `/health` and check the embedded app. The harmless guide-acknowledgment rows can remain; the prior app ignores them. There is no schema migration to reverse.

## Changed-file inventory

- `app/components/onboarding/OnboardingPage.jsx`: guide steps, merchant context, review/completion/navigation and written instructions.
- `app/components/onboarding/OnboardingIllustrations.jsx`: original SVG and illustrative editor motion.
- `app/components/onboarding/ThemeActivationProvider.jsx`: shared current verification and profile lifecycle.
- `app/components/onboarding/OnboardingGate.jsx`: scoped initial-visit routing and loading.
- `app/components/onboarding/SetupReminder.jsx`: Overview setup entry.
- `app/styles/onboarding-premium.css`: isolated responsive, motion and reduced-motion styling.
- `app/lib/onboarding.js`, `app/lib/onboarding.server.js`: routing rules, bounded checks and authenticated per-shop acknowledgment. The former theme-query module was deleted.
- `app/lib/theme-extension-status.js`, `app/lib/theme-extension-status.client.js`: existing helper validation and scope-free published-theme activation parsing, including the distinct unusable state.
- `app/routes/app.onboarding.jsx`, `app/routes/api.onboarding.jsx`: embedded guide and authenticated metadata endpoints.
- `app/routes/app.jsx`, `app/routes/app._index.jsx`: shared provider, merchant isolation, initial gate and existing dashboard connection state integration.
- `app/components/admin/BotShieldAdminExperience.jsx`: Overview and Settings setup entry points.
- `tests/onboarding.test.mjs`, `tests/overview-store-health-refresh.test.mjs`, `tests/settings-phase2-closeout.test.mjs`: focused tests and revised navigation expectations.
- `app/dev/onboarding-ssr-probe.mjs`, `scripts/test-onboarding-browser.mjs`, `scripts/dev-onboarding-preview.mjs`: executable hydration, guarded local preview and browser acceptance checks.
- This report and `docs/screenshots/merchant-onboarding/`: review evidence and release instructions.
