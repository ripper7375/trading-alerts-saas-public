# Theme-Switching Toggle Manifest — Work Completion Report

**Date:** 2026-09-04
**Status:** Code complete, verified, committed, and pushed to `origin/main`
**Type:** Ad-hoc feature session (Davin-requested directly in chat) — outside the phase/session
numbering, per `docs/migration-orders/EXECUTOR-PROTOCOL.md` §6. Recorded in `CLAUDE.md`'s matching
ad-hoc note.

> **Scope note:** this document covers the public marketing-navbar theme toggle itself, plus a
> real, load-bearing bug the toggle's own implementation surfaced and fixed at the source
> (`AppearanceProvider.saveSettings()`'s stale-closure race) rather than working around locally.
> It does not cover the Theme Mode application bug itself (duplicate providers, next-themes'
> storage listener, the trading chart never reading appearance state) — that is a separate,
> earlier fix; see `theme-mode-fix-manifest-work-completion.md` in this same folder.

---

## 1. What was built

A one-click dark/light toggle on the public marketing navbar, so a visitor can flip the site's
theme without logging in and finding their way into the authenticated Settings → Appearance page.
Davin asked for this directly in chat, with a screenshot of the live landing page annotating the
exact spot — next to the "เข้าสู่ระบบ"/Log In button.

### 1.1 Checked live code before building anything

`AppearanceProvider` (`components/providers/appearance-provider.tsx`) is already mounted once at
the true root (`app/providers.tsx` → `client-providers.tsx`), so `useAppearance()`/
`useChartAppearance()` already reach every marketing page — no new provider wiring needed.

More importantly, `saveAppearanceAction` (`app/actions/appearance.ts`) was read directly and
confirmed **guest-safe by design**: unlike `PUT /api/user/preferences` (401 for an anonymous
visitor — the reason the earlier Language modal stayed session-local-only, see that feature's own
manifest), it always writes the `davintrade-appearance` cookie first and only additionally upserts
the DB row when a session exists. So unlike the Language/Country quick-switchers, this toggle can
call the real save action and get **genuine persistence across a reload for anonymous visitors
too**, not just a same-tab-session convenience — confirmed live, not assumed (§4).

### 1.2 New `components/marketing/theme-toggle-button.tsx`

A Moon/Sun icon button (mirrors the Settings → Appearance page's own icon convention) reading
`resolvedTheme` from `useAppearance()`. One click does both halves at once — no separate "Save"
step, matching the same "shortcut" spirit as the Language modal:

```tsx
const handleToggle = async (): Promise<void> => {
  const next = isDark ? 'light' : 'dark';
  updateSettings({ theme: next }); // instant reactive DOM flip
  await saveSettings({ theme: next }); // persistence
};
```

Wired into `MarketingNavbar` exactly where Davin's screenshot pointed: the right-side CTA cluster
before the Log In button on desktop, and beside the hamburger menu button on mobile (always
visible, not buried inside the drawer).

### 1.3 A real, load-bearing bug found and fixed at the source, not routed around

Writing the toggle's single-click "update, then immediately save" handler reproduced a genuine
stale-closure race in `AppearanceProvider.saveSettings()`. It closes over the `settings` state
from the render in which it was created, but `updateSettings()` only _schedules_ a state update —
it doesn't apply it synchronously. Calling both in the same handler
(`updateSettings(x); await saveSettings()`) therefore persisted the value from **before** the
change, not after. Caught by this session's own new test
(`toHaveBeenCalledWith(..., '"theme":"dark"')` received `"theme":"light"` instead), not eyeballed.

**Fixed at the source, not papered over in the caller:** `saveSettings()` now takes an optional
`overrides?: Partial<AppearanceSettings>` and merges it in before persisting, so a caller can hand
it the intended value directly instead of trusting a same-tick state read:

```tsx
const saveSettings = async (
  overrides?: Partial<AppearanceSettings>
): Promise<boolean> => {
  return new Promise((resolve) => {
    startTransition(async () => {
      const res = await saveAppearanceAction({ ...settings, ...overrides });
      resolve(res.success);
    });
  });
};
```

**A repo-wide grep for other `saveSettings()` call sites (this file's own established sweep
habit) turned up a second, pre-existing, real victim of the identical pattern:**
`app/(auth)/welcome/page.tsx`'s onboarding accent-color picker (`handleSelectAccent`) —
`updateSettings({ accent }); void saveSettings();` — meaning a new user's chosen onboarding accent
color had been silently persisting the _previous_ accent to the database, not the one they just
clicked, since that flow was built. Fixed the same way (`saveSettings({ accent })`).

**Checked and confirmed clean, not assumed:** `app/settings/appearance/page.tsx`'s own `handleSave`
does **not** have this bug — its update and save are two separate user actions across a render
boundary (pick a theme, _then_ click "Apply" later), so `saveSettings()`'s no-args default (now
unchanged in behavior when called with no overrides) always sees the already-committed state
there.

---

## 2. Files changed

| File                                                                | Change                                                                                                         |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `components/marketing/theme-toggle-button.tsx`                      | **Added.** The toggle button itself                                                                            |
| `components/providers/appearance-provider.tsx`                      | `saveSettings()` gained an optional `overrides` param — fixes the stale-closure race at the source             |
| `components/marketing/marketing-navbar.tsx`                         | Wired `<ThemeToggleButton />` into the desktop CTA cluster and the mobile header (beside the hamburger button) |
| `app/(auth)/welcome/page.tsx`                                       | Second, independent instance of the same stale-closure bug fixed (`handleSelectAccent`)                        |
| `__tests__/components/marketing/theme-toggle-button.test.tsx`       | **Added** — 3 tests, including the one that caught the stale-closure bug                                       |
| `__tests__/components/landing/landing-and-auth-navigation.test.tsx` | Wrapped in `AppearanceProvider` alongside `LocaleProvider` (renders `MarketingNavbar` directly)                |
| `__tests__/pages/marketing/public-pages.test.tsx`                   | Same `AppearanceProvider` wrapper fix                                                                          |
| `CLAUDE.md`                                                         | Ad-hoc session note (this doc's source entry)                                                                  |

**9 files changed** (per the landed commit's own stat: 7 source/test files + `CLAUDE.md` +
`next-env.d.ts`, the latter a Next.js dev-server auto-regenerated file), 289 insertions / 19
deletions, 1 commit.

---

## 3. Test verification

| Suite                                                                                                                                                                                                                                    | Result                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| New `theme-toggle-button.test.tsx`                                                                                                                                                                                                       | **3/3 passed** (incl. the stale-closure-race regression test) |
| Every test file touching `AppearanceProvider`/`saveAppearanceAction` (`appearance.test.ts`, `trading-chart.test.tsx`, `economic-calendar-widget.test.tsx`, the Settings → Appearance page test, plus the 2 navbar-rendering files above) | **53/53 passed**, across all 7 files                          |
| Full monolith `npm run test:ci`                                                                                                                                                                                                          | **170/170 suites, 2407/2407 tests** — zero regressions        |
| TypeScript                                                                                                                                                                                                                               | `npx tsc --noEmit`, 0 errors                                  |
| ESLint                                                                                                                                                                                                                                   | Clean (0 errors/warnings) on all 6 changed/new source files   |
| `npm run build`                                                                                                                                                                                                                          | Clean, exit 0                                                 |

---

## 4. Live browser verification

Unlike almost every other entry in this repo's session history, this feature needed no
authentication to reach, so it was fully click-through-verified end to end rather than left as a
"needs Davin's own pass" item:

- **Desktop:** clicking the toggle instantly re-themed the entire landing page — background, nav,
  cards, chart mock — with zero console errors.
- **Persistence, proven live not assumed:** a full page reload afterward confirmed the dark choice
  survived for the anonymous session — the guest cookie path (§1.1) proven live, not just read in
  source.
- **Mobile (375px viewport):** the toggle rendered correctly positioned beside the hamburger
  button.
- **Mobile interaction quirk, diagnosed and confirmed unrelated to the app:** the automation
  harness's coordinate/ref-based clicks were unreliable while the Browser pane was backgrounded in
  this environment. A direct-dispatch click confirmed the mobile instance of the same shared
  `ThemeToggleButton` component toggles correctly too — the successful desktop test plus DOM
  state before/after the mobile click both confirm this was a harness quirk, not an app bug.

---

## 5. Git history

Landed as a single commit on `main`, then pushed to `origin/main`:

| Commit     | Summary                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `059071a5` | `feat(marketing): add public dark/light theme toggle to navbar` — the toggle, the stale-closure fix in both locations, and all test updates |

---

## 6. A note on the stale-closure bug's blast radius

The bug this session found and fixed was not specific to the toggle — it lives in
`AppearanceProvider.saveSettings()` itself, a shared primitive. Anything in the app that calls
`updateSettings()` immediately followed by `saveSettings()` in the same handler is exposed to it.
Two real instances were found and fixed this session (the new toggle's own handler, and the
pre-existing onboarding accent picker); `app/settings/appearance/page.tsx`'s `handleSave` was
checked and confirmed structurally immune (update and save happen across two separate user
actions, not one handler). A future session adding a new one-click "pick and persist" control
anywhere in the appearance system should pass `overrides` explicitly to `saveSettings()` rather
than relying on `settings` having already caught up — this is now documented directly in
`saveSettings()`'s own doc comment, not just here.

---

## 7. Explicitly out of scope

- **The Theme Mode application bug** (duplicate `AppearanceProvider` instances across 7 route
  layouts, `next-themes`' cross-tab `storage` listener, the trading chart never reading appearance
  state) — a separate, distinct fix; see `theme-mode-fix-manifest-work-completion.md` in this same
  folder for full detail.
- **No new translation keys** — the toggle's `aria-label`/`title` text ("Switch to light/dark
  mode") goes through `useLocale()`'s `t()` with an English fallback, following this codebase's
  existing graceful-degradation convention for untranslated strings; not added to any dictionary
  this session.
- **No changes to the authenticated Settings → Appearance page itself** — this toggle is
  additive, a faster path to the same underlying setting, not a replacement for that page.
