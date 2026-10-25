# Merchant information experience V3

Data Use and Data Retention now use a shared embedded presentation with a compact
icon header, existing document dates, a desktop section rail, a native mobile
section menu, and distinct reading cards. Retention facts still render their
existing configuration-backed values and conditions. The Settings controls and
related-document links explicitly distinguish “Inside BotShield” from the
“Official BotShield website.”

## Visual evidence

These are local synthetic-session captures, not live Shopify Admin screenshots.
The after captures load the official Polaris runtime. App Bridge, Shopify API
data, and external font/icon responses are mocked. The redesigned documents use
native HTML and SVG, with no new fonts, images, libraries or backend requests.
The screenshots below are documentation assets; they are not served by the app.

| Page | Before | After |
| --- | --- | --- |
| Data Use, desktop | [Before](screenshots/information-v3/before-data-use-1280.png) | [After](screenshots/information-v3/after-data-use-1280.png) |
| Data Retention, desktop | [Before](screenshots/information-v3/before-data-retention-1280.png) | [After](screenshots/information-v3/after-data-retention-1280.png) |
| Data Use, phone | — | [390px](screenshots/information-v3/after-data-use-390.png) |
| Data Retention, phone | — | [390px](screenshots/information-v3/after-data-retention-390.png) |
| Security & Privacy entry points | — | [Desktop](screenshots/information-v3/settings-section-1280.png) · [360px phone](screenshots/information-v3/settings-section-360.png) |

Visual review covered desktop, narrow laptop, tablet and phone layouts. A phone
review caught action buttons falling into the icon column; the scoped Settings
grid fix now places controls beneath their descriptions. Button dimensions are
checked separately from page overflow, so a narrow but technically non-overflowing
control does not pass responsive QA.

## Behavior and accessibility

- Desktop navigation is sticky in tall viewports, with a static fallback for short viewports. At widths below 980px it becomes a native, keyboard-operable disclosure with the current section in its summary.
- Section links preserve Shopify query parameters, update the URL hash using the existing router, and focus the relevant heading. Hash entry and refresh restore the target section. Repeated section choices do not fill browser history.
- IntersectionObserver tracks the nearest overflow ancestor, including an app-level scroll container, instead of assuming all scrolling happens on the browser window. All observers and interaction listeners are cleaned up on unmount. There are no scroll handlers, polling or per-frame geometry calculations.
- Explicitly selected short sections near the document end remain current while visible. Wheel, touch and scrolling-key interactions resume automatic section tracking.
- Smooth section navigation respects reduced motion. Native back, section and document links retain visible focus indicators and accessible names. External links retain their new-tab announcement.
- The back link still returns to `/app/settings?view=settings&section=privacy` with embedded parameters retained. The public legal destinations are unchanged, and none of the five controls opens an onrender.com document.

## Content and scope safeguards

The shared `DataUseDocument.jsx` and `DataRetentionDocument.jsx` files are unchanged.
So are the public shell, public routes, legal URLs, effective/updated dates,
retention configuration, support configuration and all policy wording. Existing
rendered-content tests compare internal and public paragraphs, sections and
retention facts. No policy inconsistency required a language change.

Changes are limited to:

- `app/components/information/EmbeddedInformationShell.jsx`: embedded layout, header, section navigation and related-document presentation.
- `app/components/information/SettingsInformationLink.jsx`: visible destination descriptions and navigation icons.
- `app/components/information/InformationIcon.jsx`: small native outline icons that render before Polaris loads.
- `app/hooks/useEmbeddedInformationNavigation.js`: hash navigation, reduced motion, scroll-root discovery, active tracking and cleanup.
- `app/styles/embedded-information.css`: scoped reading cards, retention fact grid, responsive layouts and focus states.
- `app/styles/settings-premium.css`: privacy-section action styling and the phone grid correction; unrelated Settings sections are unaffected.
- `tests/settings-information.test.mjs`: preserved content, destination descriptions, routing, hash focus, nested scroll root, reduced-motion behavior, active state and observer cleanup.
- This release record and its screenshot assets.

OAuth, App Bridge authentication configuration, sessions, billing and $29 pricing,
subscription enforcement, webhook/HMAC handlers, protection, analytics, Fraud
Orders, Value, schemas, migrations, dependency manifests, Render configuration and
production environment variables are unchanged. The `pixel-perfect` website was
not modified.

## Validation

| Check | Result |
| --- | --- |
| `npm run test:mvp` | 426 passed; zero failures/skips; both SSR probes passed |
| `npm run build` | Passed |
| `npm run typecheck` | Passed |
| `npm run lint` | Existing baseline remains: 192 errors and six warnings |
| Targeted lint of modified/new information components and navigation hook | No findings |
| Both documents at 1440, 1280, 1024, 768, 390 and 360px | No horizontal overflow; rendered screenshots inspected |
| All five Settings controls at those six widths | At least 180px wide and 44px tall; no clipped link content or page overflow |
| Every document section at 1280 and 390px | Correct heading focus, hash and active item; mobile disclosure closes after selection |
| Direct hash refresh on both routes | Correct heading focus and retained embedded parameters |
| Nested 640px-tall app scroll container | Section navigation and manual active tracking passed; window scrolling was not required |
| Normal and reduced motion | Smooth section navigation and reduced-motion instant navigation passed |
| Keyboard entry and return, related-page navigation, three public legal controls | Passed in Chromium with a synthetic session |
| 960px available app width and 200% scale-equivalent reflow | Passed; the latter uses a 640 CSS-pixel viewport at device scale 2, not the browser's zoom menu |
| axe WCAG 2 A/AA and 2.1 AA, document `main` at desktop/phone | Zero violations in the tested scopes |
| axe, privacy Settings group at 1280 and 360px | Zero violations in the tested scopes |
| Five existing local public document routes | HTTP 200 |
| Official website privacy, terms and deletion URLs | Separate real HTTP GETs returned 200 |
| Browser runtime | No page errors in the completed checks |

The network access needed for the official Polaris runtime was added to the
Codex environment draft (`cdn.shopify.com`); this does not change Render or the
production app's configuration.

Live merchant authentication, the full Shopify Admin/App Bridge integration,
production billing/webhooks and manual screen-reader testing remain unverified.
Automated accessibility results are limited to the specified rules and scopes.
No production secrets or production databases were used. The width simulation is
not a substitute for checking the real Shopify iframe and Admin chrome.

## Deployment and rollback

1. Review this single PR and the visual evidence. Before release approval, open both documents from Security & Privacy in a real Shopify development-store session. Check all five destinations, all section controls, hash refreshes, focus, scrolling, related documents, and back-to-Settings behavior with the actual Shopify chrome and Polaris assets. Include a narrow window and keyboard-only pass.
2. After explicit approval to merge and deploy, merge into `main`. The existing Render service may auto-deploy immediately from that merge; do not merge just to stage this release.
3. Keep Starter compute, all production variables, app URLs and webhook endpoints unchanged. Use the existing Render build command, `npm ci && npx prisma generate && npm run build`, and start command, `npm run setup && npm run start`. This PR adds no schema or migration changes and needs no manual database operation.
4. Confirm Render is Live and `/health` passes. Repeat the merchant checks for both information pages and all five Settings links. Confirm that the normal app navigation and existing plan display remain intact without creating subscriptions or changing protection settings.
5. If this release regresses the merchant experience, restore the previous successful Render deployment. Revert the PR separately if needed after approval. There is no schema change to roll back.

No merge, production deployment or live infrastructure change was performed in
this task.
