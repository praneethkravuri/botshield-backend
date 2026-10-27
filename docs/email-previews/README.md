# BotShield editorial merchant emails

**Fictional preview data only. Nothing was sent.** The report is designed as an executive briefing, distinct from the application dashboard.

| Template | Desktop | Mobile (320px) | Dark | Mobile dark | Images blocked | HTML / text |
| --- | --- | --- | --- | --- | --- | --- |
| Weekly Security Report | [Preview](weekly-desktop.png) | [Preview](weekly-mobile.png) | [Preview](weekly-dark.png) | [Preview](weekly-mobile-dark.png) | [Preview](weekly-images-blocked.png) | [HTML](weekly.html) / [Text](weekly.txt) |
| Real Security Alert | [Preview](alert-desktop.png) | [Preview](alert-mobile.png) | [Preview](alert-dark.png) | [Preview](alert-mobile-dark.png) | [Preview](alert-images-blocked.png) | [HTML](alert.html) / [Text](alert.txt) |
| Test Notification | [Preview](test-desktop.png) | [Preview](test-mobile.png) | [Preview](test-dark.png) | [Preview](test-mobile-dark.png) | [Preview](test-images-blocked.png) | [HTML](test.html) / [Text](test.txt) |

## Design and scope

The weekly briefing pairs a clean official-logo masthead with a solid neutral hero, larger editorial headline, store identity and reporting window. A numbered activity section introduces a prominent analyzed total and three independent, full-width statistic surfaces. Every metric has its own table, generous padding, 18px separation, restrained border and optional soft shadow. The weekly palette is neutral with one brand-blue highlight; green is reserved for actual active protection. A separate protection panel, quiet reason table and white footer complete the report.

Alerts use a shorter light introduction, actual severity badge and structured incident details. Test notifications use the same masthead with a simple non-incident confirmation. Real recorded actions and severity remain authoritative.

Shadow and highlight treatments are progressive enhancements only. Hero gradients and image backgrounds are deliberately absent. Solid `bgcolor` fallbacks, table spacing, inline text styles and borders remain usable when effects or embedded CSS are removed. There is no animation, GIF, JavaScript, tracking asset, added image, external font, stylesheet or dependency. Outlook may show square corners and no shadow/gradient; the information hierarchy and independent card spacing remain intact.

Runtime changes are confined to `app/lib/merchant-email-templates.js`. Sender/Reply-To, subjects, recipients, Resend transport, preferences, schedules, cooldowns, report calculations, security, database, Shopify configuration, marketing and all application UI remain untouched. Outgoing unverified dashboard CTAs remain omitted in HTML and plain text.

## Reporting windows

Date formatting affects presentation only, with the same output in HTML and plain text. Exact UTC-midnight windows display only included calendar dates: October 19 through the exclusive October 27 midnight cutoff displays **October 19–26, 2026 · UTC**. Cross-month/year windows and single-day windows are covered by tests.

Rolling/partial windows retain exact times (including seconds/milliseconds where present) and a short **end time not included** note. This necessary fallback preserves the existing inclusive-start/exclusive-end query boundaries without implying that partial days were full calendar days. The awkward “before” phrasing is removed. No timestamps, query boundaries or reporting calculations changed.

Scheduled and manual reports continue through the same `sendWeeklySecurityReport` service and pass the actual report builder's `periodStart` / `periodEnd` to the renderer. Regression tests verify real builder-to-mocked-delivery pass-through, synchronized text/HTML dates and nonmutation.

## Official logo and sender

The existing transparent official logo is unchanged, with explicit 39×48 display dimensions preserving its 208×256 proportions, alt text, a white backing tile and always-visible BotShield wordmark.

Public URL: https://botshield-backend.onrender.com/botshield-official-logo-transparent.png

Previously verified repository/public asset SHA-256: `ff132a41a95bc4ebe9ceb4e3342780a62f40707ce7acc32f4407e8db36ddeac1`.

Unchanged sender: **BotShield Reports <reports@botshieldapp.com>**. Unchanged Reply-To: **support@botshieldapp.com**. No environment-variable or domain/DNS edits.

## Validation

- 481 automated tests passed, including 22 focused renderer/mocked sender tests.
- Production build, TypeScript, existing SSR/hydration probes and targeted lint passed.
- Global lint retains 190 existing errors / 6 warnings; no unrelated cleanup.
- 32 Chromium checks cover desktop/mobile light/dark, blocked images, long names, large values, zero/missing data, actual severity variants and inline-only solid-color fallbacks. Email-appropriate Axe checks exclude web-page landmark rules (`region`, `landmark-one-main`). See [recorded results](browser-checks.json).
- All previews are fictional. No live email or security event was generated.

**Chromium is not Gmail, Outlook or Apple Mail.** These new designs have not been tested in those clients. Owner-confirmed Gmail iPhone results apply to the previous production design, not this revision. Proprietary forced-dark transformations and Outlook Word-engine appearance remain unverified.

## Reproduce

Generate all HTML/plain-text samples without any delivery capability:

```text
node scripts/preview-merchant-emails.mjs
node --test tests/merchant-email-templates.test.mjs tests/email-sender.test.mjs
```

For local screenshots/checks, set `PLAYWRIGHT_MODULE`, `AXE_MODULE` and optionally `CHROMIUM_PATH` to existing external tooling, then run `node scripts/test-merchant-email-previews.mjs`. This loopback-only preview script never imports email delivery, credentials or the database.


## Gmail iPhone readability correction

The owner confirmed an actual delivered weekly email had nearly invisible hero text/dates in Gmail iPhone dark mode. The previous markup combined light text with an inline gradient. Forced-color handling can transform live text independently of image-like backgrounds; our Chromium `prefers-color-scheme` previews did not reproduce that client behavior.

The gradient is removed rather than patched with blend modes, text-fill overrides, image text, or Gmail-only selectors. All three hero sections now use an explicit solid light `bgcolor` **and** inline background color, dark navy headings, readable muted copy and standard text classes. Supporting clients receive paired dark backgrounds/light text through the existing media query. The official logo, report composition, independent cards and data remain intact.

`color-scheme: light only` was considered but is not relied upon: current Gmail iOS/version/account support could not be independently established, and it would not provide a cross-client guarantee. Attempts to fetch the Gmail CSS reference, Can I Email color-scheme reference and Litmus dark-mode guide returned HTTP 403 in this environment. Existing `light dark` metadata remains; readable solid-color defaults and optional paired dark styles do not depend on a force-light opt-out.

A regression checks every hero for matching explicit solid backgrounds, standard text classes and absence of gradients/pinned light text, blend modes or text-fill hacks. Browser checks cover light/dark and inline-only fallbacks for all three templates. These are structural and browser checks, **not proof of Gmail's proprietary dark-mode transformations**.

**Required follow-up:** inspect newly delivered messages from this revision in actual Gmail iPhone dark and light mode, including weekly title, label, store and reporting dates, plus alert/test copy. Gmail desktop, Outlook and Apple Mail inbox rendering also remains unverified. No live email was sent for this fix.
