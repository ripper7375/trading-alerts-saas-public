# Language Selection Modal Manifest — Work Completion Report

**Date:** 2026-09-04
**Status:** Code complete, verified, committed, and pushed to `origin/main`
**Type:** Ad-hoc feature session (Davin-requested directly in chat, with an annotated screenshot of
the live landing page) — outside the phase/session numbering, per
`docs/migration-orders/EXECUTOR-PROTOCOL.md` §6. Recorded in `CLAUDE.md`'s matching ad-hoc note.

> **Scope note:** this document covers two same-day passes as one unit — the initial public
> Language modal (§1.1–§1.3) and Davin's same-day follow-up adding 5 more languages and
> alphabetizing the modal (§1.4). Both shipped, tested, and were pushed independently; see §5 for
> the two commits.

---

## 1. What was built

A "Language" nav item on the public marketing site (desktop nav + mobile drawer) that opens a modal
offering the exact same language list as Settings → Language & Region, so a first-time visitor can
read the landing page in their own language without logging in and finding that settings page.
Selecting a language applies immediately — no separate "Save" step, no page reload.

### 1.1 Shared language list — single source of truth

- **New file** `lib/i18n/languages.ts` — exports `SUPPORTED_LANGUAGES` (`LanguageOption[]`:
  `code`/`name`/`flag`), extracted from the array that used to live only inside
  `app/settings/language/page.tsx`. Both surfaces now import the same array, so they can never
  drift apart from each other.
- `app/settings/language/page.tsx` refactored to import `SUPPORTED_LANGUAGES` instead of declaring
  its own local `languages` const — a pure extraction, no behavior change to that page.

### 1.2 The modal component

- **New file** `components/marketing/language-selector-modal.tsx` — a shadcn `Dialog`
  (`components/ui/dialog.tsx`, Radix under the hood) listing every `SUPPORTED_LANGUAGES` entry as a
  clickable flag+name row. Clicking one calls `setLocalePreferences({ language: code })` from
  `useLocale()` and closes the modal in the same handler — one click, no confirm step.
- **Deliberately mirrors `app-header.tsx`'s existing "Quick Country Switcher" pattern, not
  `settings/language`'s own save path.** Read `app/api/user/preferences/route.ts` directly before
  choosing: its `PUT` requires an authenticated session (401 otherwise), so routing the modal
  through it would fail silently for every anonymous visitor — exactly the audience this feature
  exists for. `setLocalePreferences()` instead persists client-side only, via
  `LocaleProvider`'s own `localStorage` + cookie write path (`lib/context/locale-context.tsx`) —
  the same session-local-only precedent the header's country switcher already established for this
  codebase's "ambient quick-toggle" class of control.

### 1.3 Navbar wiring

- `components/marketing/marketing-navbar.tsx`: a `Globe`-icon "Language" button added as the first
  item in both the desktop nav (before "Features," matching Davin's screenshot exactly) and the
  mobile drawer (above the mapped nav links), opening the modal via `languageModalOpen` state.
- **Checked before adding a translation key, not assumed safe:** grepped `fr.json`/`ko.json`/
  `zh.json`/`zh-TW.json` for the navbar's own existing labels (`Features`/`Pricing`/`Docs`/
  `Affiliates`) first and confirmed none of them are translated in those four dictionaries either —
  `MarketingNavbar` was never in scope for the earlier 18-batch locale audit's public-marketing
  batch. The new `t('Language')` key was left untranslated in those four to match its siblings
  exactly (translating just the new button next to five untranslated ones would have been a worse,
  inconsistent state); it falls back to the English word "Language," the same graceful degradation
  every other nav label there already has.

### 1.4 Same-day follow-up: 5 more languages, alphabetized modal

Davin asked to add the languages already reachable via the header's "Select Country & Region"
dropdown but missing from the language list — naming 7 country codes (NG, PK, VN, ID, TH, ZA, TR) —
and, now that the list was growing, to alphabetize the modal.

- **Checked `lib/country-config.ts` before adding anything, rather than assuming 7 new languages
  were needed.** NG and ZA both already map to `language: 'en-US'` — already in the list. Only
  PK(`ur`)/VN(`vi`)/ID(`id`)/TH(`th`)/TR(`tr`) were genuinely missing.
- Confirmed real, non-empty dictionaries already existed on disk for all 5 before wiring them in
  (`ur.json`/`vi.json`/`id.json`/`tr.json` at 2,268 keys each, `th.json` at 2,636 — the same
  "legacy" dictionary tier `es`/`de`/`pt`/`ja` already sit in). Added to `SUPPORTED_LANGUAGES` with
  native-script names matching the `fr`/`ko`/`zh`/`ar` entries' existing convention (e.g.
  `Urdu (اردو)`), flags taken directly from each language's matching `country-config.ts` entry.
  `locale-context.tsx` needed no change — its dictionary loader already lazy-imports any
  `lib/i18n/dictionaries/${language}.json` generically. **16 languages total now** (see §7 for the
  full alphabetized list).
- **Alphabetizing scoped to the modal only, not the shared list or Settings' own dropdown** —
  Davin's ask named "the modal" specifically, and Settings' `<Select>` isn't long enough yet to
  need it. Sorted a `useMemo`'d copy (`localeCompare` on `name`) inside `LanguageSelectorModal`,
  leaving `SUPPORTED_LANGUAGES`'s own insertion order (English variants first) intact as the shared
  source of truth's canonical order.

---

## 2. Files changed

| File                                                              | Change                                                                                       |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `lib/i18n/languages.ts`                                           | **Added.** `SUPPORTED_LANGUAGES` shared source of truth (11 entries → 16 after §1.4)         |
| `app/settings/language/page.tsx`                                  | Refactored to import `SUPPORTED_LANGUAGES` instead of a local `languages` const              |
| `components/marketing/language-selector-modal.tsx`                | **Added.** Modal component; §1.4 added alphabetized `useMemo` sort                           |
| `components/marketing/marketing-navbar.tsx`                       | "Language" nav button (desktop + mobile drawer), modal wiring                                |
| `__tests__/components/marketing/language-selector-modal.test.tsx` | **Added.** 4 tests (render, closed state, select-and-close, active-language highlighting)    |
| `next-env.d.ts`                                                   | Next.js dev-server auto-regen, per `CLAUDE.md`'s own "This is NOT the Next.js you know" note |
| `CLAUDE.md`                                                       | Ad-hoc session notes (both passes — this doc's own source entries)                           |

**7 files touched (3 added, 4 modified)** across 2 commits, 327 insertions / 17 deletions.

---

## 3. Test verification

| Suite                                                                           | Result                                                                                                                                 |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `__tests__/components/marketing/language-selector-modal.test.tsx` (both passes) | **4/4 passed** — including the "renders every language" loop, which covers the §1.4 languages automatically with no test change needed |
| `__tests__/pages/marketing/public-pages.test.tsx`                               | **13/13 passed**, unaffected                                                                                                           |
| Monolith Jest, full `npm run test:ci` (pass 1: initial modal)                   | **168/168 suites · 2397/2397 tests** (167/2393 baseline +1 suite/+4 tests, zero regressions)                                           |
| Monolith Jest, full `npm run test:ci` (pass 2: 5 languages + sort)              | **168/168 suites · 2397/2397 tests**, zero regressions (no new suite — existing test's loop already covered it)                        |
| TypeScript — monolith                                                           | `npx tsc --noEmit`, 0 errors, both passes                                                                                              |
| ESLint                                                                          | Clean on every changed file, both passes                                                                                               |
| `npm run build` (production build)                                              | Clean, exit 0, both passes — `/`, `/econ-news`, `/settings/language` all present in the route manifest                                 |

---

## 4. Live browser verification

**Blocked by environment both passes, not attempted around.** Another chat session already had
`next dev` running against this same repo's shared `.next/` build directory — the exact Windows
file-lock contention `CLAUDE.md`'s 2026-08-31 Academy ad-hoc session already documented. `netstat`
confirmed only port 3000 had a real listening socket throughout; this session's own
`autoPort`-assigned attempts (`.claude/launch.json`'s `nextdev` entry) never bound to anything.
Did not force a `next build`/kill the other session's server to work around it, matching that
earlier session's own restraint.

Fell back to the production build (`npm run build`, both passes clean, exit 0) as the strongest
available non-interactive check — a malformed component or a broken import in either the modal or
the new dictionary wiring would fail that build immediately, and neither did.

**Not an auth boundary this time** — unlike almost every other entry in `CLAUDE.md`'s history, this
feature needed no authentication to reach at all; the block is purely local dev-server port/process
contention. Flagged in `CLAUDE.md`'s `Waiting on` list, not silently skipped — needs Davin's own
click-through once a dev server is free: confirm the "Language" nav item opens the modal on both
desktop and mobile, that selecting a language re-locales the page immediately with no reload, and
that the currently-active language shows its check-mark/highlighted state on reopen.

---

## 5. Git history

Landed as 2 scoped commits on `main`, then pushed to `origin/main` on Davin's explicit request
(pre-push hook re-ran `tsc --noEmit` and the full monolith test suite clean before each push):

| Commit     | Summary                                                                             |
| ---------- | ----------------------------------------------------------------------------------- |
| `5e241e7c` | `feat(marketing): add public Language modal to landing-page nav` — §1.1, §1.2, §1.3 |
| `01a0a4ad` | `feat(marketing): add missing dLocal-country languages, alphabetize modal` — §1.4   |

---

## 6. A note on the modal's design vs. Settings' own save path

The modal's `setLocalePreferences()`-only, no-`PUT`-round-trip design (§1.2) means a change made in
the modal is **session-local** for an anonymous visitor — exactly the same limitation the header's
existing "Quick Country Switcher" already has, and not a regression introduced by this feature. A
visitor who later creates an account and wants their language choice to persist server-side still
needs to set it once from `/settings/language`, which does call the authenticated `PUT` endpoint.
This was a deliberate design decision, not an oversight — see §1.2 for the auth-boundary reasoning
that ruled out the alternative.

---

## 7. Full language list (16, alphabetized as shown in the modal)

| #   | Display name (as shown in the modal) | Code    |
| --- | ------------------------------------ | ------- |
| 1   | Arabic (العربية)                     | `ar`    |
| 2   | Chinese (Simplified) (简体中文)      | `zh`    |
| 3   | Chinese (Traditional) (繁體中文)     | `zh-TW` |
| 4   | English (UK)                         | `en-GB` |
| 5   | English (US)                         | `en-US` |
| 6   | French (Français)                    | `fr`    |
| 7   | German                               | `de`    |
| 8   | Indonesian (Bahasa Indonesia)        | `id`    |
| 9   | Japanese                             | `ja`    |
| 10  | Korean (한국어)                      | `ko`    |
| 11  | Portuguese                           | `pt`    |
| 12  | Spanish                              | `es`    |
| 13  | Thai (ภาษาไทย)                       | `th`    |
| 14  | Turkish (Türkçe)                     | `tr`    |
| 15  | Urdu (اردو)                          | `ur`    |
| 16  | Vietnamese (Tiếng Việt)              | `vi`    |

Settings → Language & Region keeps `SUPPORTED_LANGUAGES`'s own insertion order (English variants
first) rather than this alphabetized view — see §1.4.

---

## 8. Explicitly out of scope

- **Translating the new "Language" nav-button key** into `fr`/`ko`/`zh`/`zh-TW` — deliberately left
  matching its untranslated navbar siblings; see §1.3.
- **`es`/`de`/`pt`/`ja`/`hi`/`id`/`tr`/`ur`/`vi`** dictionary _expansion_ — these are pre-existing,
  older 2,268-key dictionaries never touched by any documented locale-audit session; §1.4 only
  wired 4 of them (`id`/`tr`/`ur`/`vi`) into the language _picker_, it did not extend their content.
  `hi` (Hindi, India's language per `country-config.ts`) was **not** added to the picker this
  session — India wasn't named in Davin's 7-country list, so it stays out of scope for this pass.
- **Server-side persistence of a modal-made language choice for anonymous visitors** — session-local
  only by design; see §6.
- **Live browser click-through** — blocked by shared dev-server contention both passes; see §4.
