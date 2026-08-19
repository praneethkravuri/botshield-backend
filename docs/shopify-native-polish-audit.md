# BotShield Shopify-Native UX Polish Audit

**Date:** August 18, 2026  
**Scope:** Interaction and App Bridge polish across embedded Admin — **not** a visual redesign.  
**Status:** Deployed to production via Render (push to `main`).

---

## Executive summary

BotShield already used Polaris web components (`s-*`), App Bridge toasts, and `s-app-nav` navigation. This pass focused on replacing the highest-friction non-native patterns: inline custom save bars, browser `window.confirm`, and custom discard overlays. Shell chrome that competed with Shopify Admin (floating support bubble, opaque page background) was removed or neutralized.

**Shopify interaction language + BotShield security identity** is the guiding principle: Shopify owns save/discard, loading, toasts, modals, and nav; BotShield keeps security cards, status semantics, and page layouts.

---

## 1. Converted to official Shopify / Polaris behavior

| Area | Before | After |
|------|--------|-------|
| **Save bar** | Inline `s-box` + `s-button-group` (`BotShieldSaveState`) pinned inside page content | `<ui-save-bar>` + `shopify.saveBar.show/hide` via `useBotShieldSaveBar` |
| **Save loading** | Button `loading` prop only | `shopify.loading.start/stop` via `useBotShieldLoadingIndicator` during save |
| **Settings notifications/reports** | Inline save strip in panel | App Bridge save bar ID `botshield-settings-save-bar` |
| **Protection legacy policy view** | Inline save strip | App Bridge save bar ID `botshield-protection-save-bar` |
| **Danger zone — clear simulation** | `window.confirm` + async button | `BotShieldConfirmationModal` (`s-modal`) + `commandFor` trigger |
| **Protection drawer discard** | Custom CSS overlay (`botshield-protection-discard-layer`) | `BotShieldConfirmationModal` (`botshield-protection-discard-modal`) |
| **Toasts** | Already App Bridge | Unchanged — `shopify.toast.show` in `BotShieldToastProvider` |
| **Buttons / forms / badges** | Already `s-button`, `s-text-field`, `s-switch`, `s-badge` wrappers | Unchanged — verified across pages |
| **Navigation** | Already `s-app-nav` + React Router deep links | Unchanged — verified path-based routing |
| **Admin shell background** | Custom `#f6f6f4` page wash | `transparent` — inherits Shopify Admin surface |

**Preview fallback:** `/ui-preview` routes still render an inline save strip (App Bridge unavailable) so local QA remains usable.

---

## 2. App Bridge functionality added

| API | Hook / component | Where used |
|-----|------------------|------------|
| `shopify.saveBar.show(id)` / `.hide(id)` | `useBotShieldSaveBar` in `app/hooks/use-botshield-save-bar.js` | Settings (notifications/reports), Protection legacy policy |
| `shopify.loading.start()` / `.stop()` | `useBotShieldLoadingIndicator` | Same save flows while persisting |
| `<ui-save-bar>` with discard confirmation | `BotShieldSaveState` | Embedded Admin save/discard |
| `s-modal` confirmation | `BotShieldConfirmationModal` | Danger zone, Protection drawer discard |
| `commandFor` / `command="--show"` on `s-button` | `BotShieldActionButton` | Opens confirmation modals natively |

**Already present (not new):** `shopify.toast.show`, `s-app-nav`, `AppProvider` in `app/routes/app.jsx`.

---

## 3. Custom BotShield components intentionally retained

| Component / pattern | Why kept |
|---------------------|----------|
| **Overview / Analytics / Protection / Fraud / Settings layouts** | Explicit user constraint — established visual identity |
| **Security status cards** (`botshield-protection-status`, operational strip, threat cards) | BotShield product personality; semantics not available as stock Polaris blocks |
| **`BotShieldStatusBadge` + `getUiStatus`** | Security-specific green/amber/red/neutral mapping with text labels |
| **Protection drawer (portal)** | Complex multi-step configuration; inline footer save is clearer than save bar inside modal |
| **Protection module rows, policy flow diagram, access grid** | Security control-plane UX; no Polaris equivalent |
| **Settings hub left nav + section panels** | Recently polished control center; autosave sections unchanged |
| **Custom empty states** (`BotShieldEmptyState`) | Contextual security copy + optional actions |
| **`BotShieldBanner` for persistent errors** | Shopify guidance: errors needing merchant action stay visible (drawer save failures) |
| **Overview typography tokens** (`botshield-overview-v2`, `--overview-*`) | Cross-page hierarchy already established |
| **Legacy `Screen` wrapper** | Fallback Protection Rules view only |

---

## 4. UX inconsistencies remaining

| Item | Notes | Recommendation |
|------|-------|----------------|
| **Dual page titles** | BotShield `h1.botshield-overview-title` coexists with Shopify Admin chrome | Acceptable — hierarchy preserved per brief; optional future `shopify.titleBar` audit |
| **Protection drawer save** | Drawer uses footer Save/Cancel, not App Bridge save bar | Intentional — modal/drawer pattern; save bar would conflict with drawer lifecycle |
| **Protection drawer success** | Brief inline `saveSuccess` text + toast | Could drop inline text and rely on toast only (minor) |
| **IP list remove confirm** | Custom in-drawer confirm step | Could migrate to `s-modal` in a follow-up |
| **Route enter animation** | `.botshield-route-enter` subtle fade | Low priority — not disruptive |
| **`BotShieldPolarisExperience.jsx`** | Legacy preview file; save bar IDs not updated | Not in production path |
| **Chat bubble removed** | Support now via Settings / email only | Consider Settings → App & diagnostics link if merchants miss it |

---

## 5. Integration problems discovered (not changed this pass)

| Issue | Impact | Documented for next pass |
|-------|--------|--------------------------|
| **Local dev requires Postgres** | `npm run dev` fails without DB; blocks full embedded session QA locally | Use Shopify dev store + tunnel or mock session for E2E |
| **UI preview hydration** | `/ui-preview?view=policy&section=billing` occasionally lands on Overview | Preview routing race — fix in preview route, not Admin UX |
| **Theme embed detection** | Protection "Needs setup" depends on backend theme probe | Backend/integration pass |
| **Email provider** | Test notification requires configured provider | Ops / integration |
| **Billing verification** | Partner API + App Pricing return flow | Already implemented; verification edge cases remain backend |
| **Save bar + multiple dirty forms** | Only one save bar visible at a time (Settings vs Protection never simultaneous) | OK today; watch if multi-form pages added |
| **Protection v2 main page** | No inline editable fields — save bar only on legacy Screen path | By design; drawer owns edits |

---

## Page-by-page QA checklist (embedded Admin)

| Page | Save bar | Toasts | Modals | Loading | Empty states | Status language |
|------|----------|--------|--------|---------|--------------|-----------------|
| **Overview** | N/A (read-mostly) | ✅ | N/A | ✅ skeletons | ✅ | ✅ |
| **Analytics** | N/A | ✅ | N/A | ✅ | ✅ period empty | ✅ |
| **Protection** | ✅ legacy policy; drawer footer | ✅ | ✅ discard | ✅ | ✅ lists | ✅ |
| **Fraud Orders** | N/A | ✅ | review flows | ✅ | ✅ | ✅ |
| **Settings** | ✅ notifications/reports | ✅ | ✅ danger zone | ✅ | ✅ per section | ✅ |

**Navigation:** Path routes (`/app`, `/app/analytics`, `/app/protection`, `/app/fraud-orders`, `/app/settings?section=…`) — browser back/forward and refresh supported.

**Accessibility:** Polaris web components provide focus rings and labels; status badges include text; destructive actions use titled modals.

**Responsiveness:** Protection and Settings hub use existing `@media` breakpoints; no new horizontal scroll introduced.

---

## Files changed

- `app/hooks/use-botshield-save-bar.js` — **new**
- `app/components/design-system/BotShieldDesignSystem.jsx` — save bar, modal, shell, `commandFor` on buttons
- `app/components/admin/BotShieldAdminExperience.jsx` — save bar IDs, confirmation modals, danger zone
- `tests/ui-design-system.test.mjs` — save bar + modal contracts
- `tests/protection-page.test.mjs` — discard modal expectations

---

## Test plan

```bash
npm run test:mvp
```

Verify in Shopify Admin (dev store):

1. Settings → Notifications: change email toggle → native save bar → Save / Discard
2. Settings → Danger zone → Clear simulation → modal confirm → toast
3. Protection → Configure policy drawer → edit → close → discard modal
4. Navigate all five pages via `s-app-nav`; refresh nested Settings section URL

Verify in Shopify Admin after Render reports Live.
