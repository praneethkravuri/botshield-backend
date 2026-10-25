# Embedded Settings information release

Settings → Security & Privacy now opens Data Use and Data Retention in the
authenticated embedded application. Privacy, Terms, and Deletion open the
established public documents on botshieldapp.com with an accessible new-tab
announcement. These legal documents remain external to avoid introducing copies
that could diverge from the marketing website.

## Destinations

| Settings control | Destination | Behavior |
| --- | --- | --- |
| View data use | `/app/information/data-use` | Internal, same tab |
| View retention details | `/app/information/data-retention` | Internal, same tab |
| View privacy policy | `https://botshieldapp.com/privacy` | Public document, new tab |
| View terms | `https://botshieldapp.com/terms` | Public document, new tab |
| View deletion details | `https://botshieldapp.com/data-deletion` | Public document, new tab |

Internal pages use the existing `/app` authentication boundary and embedded
navigation conventions. Their back link explicitly restores the privacy Settings
section, overriding a stale legacy `view` parameter. Related app documentation
stays internal; legal and support links use the public website without forwarding
Shopify query parameters. Native links support keyboard navigation. Headings
receive focus on entry, and the content reflows on narrow screens.

Data Use and Data Retention content was extracted into shared components without
changing policy language or dates. The existing public backend routes continue to
render those same components. The marketing website was not modified.

## Changed files

- `app/components/admin/BotShieldAdminExperience.jsx`: connect Settings controls to the destination-aware link.
- `app/components/information/DataUseDocument.jsx`: shared existing Data Use content.
- `app/components/information/DataRetentionDocument.jsx`: shared existing retention content.
- `app/components/information/EmbeddedInformationShell.jsx`: embedded document layout, contents, related links, focus and back navigation.
- `app/components/information/SettingsInformationLink.jsx`: internal navigation and canonical public legal destinations.
- `app/lib/settings-information.js`: reviewed document destinations and return path.
- `app/routes/app.information.data-use.jsx`: internal Data Use route.
- `app/routes/app.information.data-retention.jsx`: internal retention route.
- `app/routes/data-use.jsx` and `app/routes/data-retention.jsx`: retain public routes through shared content.
- `app/styles/embedded-information.css`: scoped responsive layout and focus styling.
- `tests/settings-information.test.mjs`: rendered controls, shared policy text, embedded parameters, direct route initialization and navigation.
- `tests/public-legal.test.mjs`: follow extracted content while retaining existing disclosure assertions.
- `tests/settings-phase2-closeout.test.mjs`: clarify the existing document-identifier test name.
- `docs/settings-information-release.md`: this release and verification record.

## Verification

- `npm run test:mvp`: 425 tests passed, zero failures or skips; style and hydration SSR probes passed.
- `npm run build`: passed.
- `npm run typecheck`: passed.
- `npm run lint`: fails with 192 errors and six warnings, identical to an isolated lint run on the original HEAD. New information components, routes and destination module have zero lint findings. Existing lint issues were left outside this feature.
- Prisma generation, three existing migrations and database readiness passed against synthetic local PostgreSQL only.
- The actual server started with local-only test credentials; `/health` returned HTTP 200 with the database connected. `/data-use`, `/data-retention`, `/privacy`, `/terms`, and `/data-deletion` each returned HTTP 200 locally.
- Unauthenticated internal URLs and existing Settings both received Shopify's HTTP 410 "Handling response" behavior with these synthetic credentials. No authentication bypass was added to the application.
- Chromium exercised the built application in a local-only harness with a synthetic authenticated parent loader and mocked App Bridge/Polaris. All five actual Settings controls had the reviewed destinations. Data Use and Retention opened in the same tab, both survived reload, embedded parameters were retained, back navigation restored Security & Privacy, heading focus and keyboard Enter worked, and the 390px layout had no horizontal overflow. Canonical legal link clicks opened their expected URLs. No browser page errors occurred. Remote responses in this browser harness were mocked.
- Separate, real HTTP GET requests to the public website's `/privacy`, `/terms`, `/data-deletion`, and `/support` returned HTTP 200. This confirms reachability, not a legal review of their wording.
- Full diff review confirms no changes to OAuth, session handling, billing, webhook/HMAC handling, protection, analytics, Fraud Orders, Value, database schema/migrations, manifests/lockfile, Render configuration, or production environment variables. Existing relevant automated suites ran as part of `test:mvp`; production integrations were not exercised.

Screenshots from the synthetic-session Chromium check are available in the task
workspace at `/tmp/botshield-data-use-desktop.png` and
`/tmp/botshield-data-retention-mobile.png`.

## Deployment after explicit approval

1. Review this single PR and complete a real Shopify development-store session check: open Settings → Security & Privacy, click all five controls, refresh both internal document URLs, use their back links and the Shopify navigation, and verify there are no unexpected login redirects or App Bridge errors. Confirm the public legal documents display normally. Live Shopify authentication, sessions, billing, and webhook integrations were not end-to-end tested in the local mocks.
2. Confirm the existing Render `botshield-backend` service tracks this repository's `main` branch and retains Starter compute. No infrastructure or environment-variable changes are required.
3. Only after approval to merge and deploy, merge the PR into `main`. The existing configuration has automatic deployment enabled, so merging may trigger the production deployment immediately. Do not merge merely to stage the change.
4. Let the existing Render pipeline run its configured commands: build `npm ci && npx prisma generate && npm run build`; start `npm run setup && npm run start`. This PR adds no migrations; no manual database migration is needed. Do not use production database credentials in Codex.
5. Confirm Render reports Live and its `/health` check passes. In a real merchant session, repeat the five-button, refresh and return-navigation checks. Verify the existing $29/month plan display and normal dashboard navigation without creating a new subscription or changing store protection settings. Confirm no changed control opens an onrender.com document.
6. If the deployment introduces a regression, use Render's rollback to the previously working deployment, then investigate before another deployment. No schema rollback is needed for this feature.

No merge, production deployment, live subscription change, or infrastructure
change was performed during implementation.
