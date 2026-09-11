# All Round Clock Timezone Dropdown — Manifest Work Completion Report

**Date:** 2026-09-03
**Status:** Code complete, verified, committed, and pushed to `origin/main`
**Type:** Ad-hoc feature session (Davin-requested directly in chat, fully-specified task order) —
outside the phase/session numbering, per `docs/migration-orders/EXECUTOR-PROTOCOL.md` §6. Recorded
in `CLAUDE.md`'s matching ad-hoc note.

> **Scope note:** this document covers the Timezone selector on
> `app/settings/language/page.tsx` only — upgrading it from a hardcoded 13-entry regional list to a
> comprehensive, searchable "All Round Clock" dropdown spanning every standard GMT offset from
> `-12:00` to `+14:00`. It does not touch the Language/Currency selectors on the same page, or
> `handleSave()`'s locale-write path — both already fixed in the 2026-09-01 locale-i18n-compliance
> ad-hoc session.

---

## 1. What was built

A new, centralized timezone utility (`lib/utils/timezones.ts`) sourcing the full ~400-zone IANA
timezone list from the ECMAScript standard `Intl.supportedValuesOf('timeZone')` API, wired into
the Language & Region settings page's Timezone dropdown with a standardized `(GMT ±HH:MM)
Region/City` label format, chronological-then-alphabetical sort order, and a free-text search box
filtering by city, country, or GMT offset — while remaining 100% backward-compatible with every
IANA timezone string already stored in user preferences.

### 1.1 New timezone utility (`lib/utils/timezones.ts`)

- `TimezoneOption` interface: `value` (IANA identifier), `label` (formatted display string),
  `offsetMinutes` (for sorting), `gmtPrefix`, `name`.
- `getTimezoneOffsetMinutes(timeZone, date?)`: computes a timezone's current UTC offset in minutes
  via a `toLocaleString('en-US', { timeZone })` round-trip diff; returns `0` on an invalid zone
  rather than throwing.
- `formatGmtOffset(offsetMinutes)`: formats an offset as `(GMT ±HH:MM)`, correctly handling
  half-hour (`+05:30`) and quarter-hour (`+05:45`, `+08:45`, `+12:45`) zones via
  `Math.floor`/`%` on absolute minutes, not a naive hours-only division.
- `getAllTimezones()`: builds the complete sorted list. Prefers
  `Intl.supportedValuesOf('timeZone')` when available (the real runtime path — confirmed live to
  resolve **419** real IANA identifiers in a modern browser); falls back to a curated ~90-zone
  list spanning every standard offset `-12:00`..`+14:00` for environments lacking that API
  (older runtimes, some SSR/jsdom test contexts). Always ensures `UTC` is present. De-duplicates,
  then sorts by `offsetMinutes` ascending, tie-broken by `value.localeCompare()` (alphabetical by
  IANA identifier) — matching the spec's "chronologically sorted by GMT offset... then
  alphabetically by timezone identifier" requirement exactly.
- `getTimezoneLabel(timeZone)`: standalone helper returning a formatted `(GMT ±HH:MM) TimeZone`
  label for a single value (used to render the dropdown trigger's current selection without
  needing the full list in scope); returns `'(GMT +00:00) UTC'` for an empty/falsy input.
- **A real `tsc` finding, not a style choice:** `tsconfig.json`'s `lib` is pinned to `["ES2020",
"DOM", "DOM.Iterable"]` — `Intl.supportedValuesOf` is only typed in TypeScript's
  `lib.es2022.intl.d.ts`, so referencing it directly failed with `TS2559: Type 'typeof Intl' has
no properties in common with type 'IntlWithSupportedValuesOf'`. Resolved with an
  `Intl as unknown as IntlWithSupportedValuesOf` cast (an `interface` with an optional
  `supportedValuesOf` member), verified clean against a real `tsc --noEmit` run rather than
  assumed to compile.

### 1.2 Language & Region settings page (`app/settings/language/page.tsx`)

- Removed the hardcoded 13-entry `timezones` array (Eastern/Central/Mountain/Pacific Time,
  London, Paris, Berlin, Tokyo, Shanghai, Singapore, Sydney, Dubai, Seoul — friendly regional
  names like `"Eastern Time (ET)"`).
- Added `allTimezones = useMemo(() => getAllTimezones(), [])` and a `timezoneSearch` state string,
  with a derived `filteredTimezones` memo matching the query (case-insensitive substring) against
  each option's `label`, `value` (IANA identifier), or `gmtPrefix` — so typing `"Dubai"`,
  `"Paris"`, `"Seoul"`, or `"+05:30"`/`"GMT+4"`-style offset text all filter correctly.
- The `<SelectTrigger>` now renders `getTimezoneLabel(settings.timezone)` directly (via
  `<SelectValue>`'s children override) instead of relying on the matching `<SelectItem>`'s own
  children — so the trigger always shows a correctly formatted label even before the full list has
  rendered.
- `<SelectContent>` gained a sticky search `<input>` at the top (`onClick`/`onKeyDown`
  `stopPropagation()` to prevent Radix Select's own keyboard-driven typeahead/roving-focus from
  intercepting keystrokes meant for the search box — see §4 for why this needed live verification,
  not just code review) and renders `filteredTimezones` (or a "No timezones found" empty state)
  instead of the old static array.
- Selecting a timezone clears `timezoneSearch` so reopening the dropdown always starts from the
  full list, not the previous search's filtered subset.
- The existing `getCurrentTime()` preview needed **no changes** — it already re-derives from
  `settings.timezone` on every render, so it updates instantly the moment a new zone is selected,
  satisfying the spec's "current time preview updates instantly" requirement for free.

---

## 2. Files changed

| File                                    | Change                                                                                                                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/utils/timezones.ts`                | **Added.** `getAllTimezones()`/`getTimezoneLabel()`/`getTimezoneOffsetMinutes()`/`formatGmtOffset()`                                                                                              |
| `app/settings/language/page.tsx`        | Static 13-entry `timezones` array replaced with the full searchable IANA-backed dropdown                                                                                                          |
| `__tests__/lib/utils/timezones.test.ts` | **Added.** 8 tests covering the new utility (see §3)                                                                                                                                              |
| `next-env.d.ts`                         | Next.js dev-server auto-regenerated quote-style diff (see this repo's own "This is NOT the Next.js you know" `CLAUDE.md` note) — committed alongside to keep the tree clean, no behavioral change |
| `CLAUDE.md`                             | Ad-hoc session note (this doc's own source) + a new `Waiting on` entry                                                                                                                            |

**5 files touched (3 modified, 2 added)**, 353 insertions / 27 deletions across 3 commits (utility

- tests, page wiring, docs close-out) — deliberately split rather than batched into one commit, per
  `EXECUTOR-PROTOCOL.md` §2's "never batch a whole session into one commit."

---

## 3. Test verification

| Suite                                                       | Result                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New `__tests__/lib/utils/timezones.test.ts`                 | **8/8 passed** — offset formatting (incl. half/quarter-hour zones), chronological + alphabetical sort order, financial-hub presence (`UTC`, `America/New_York`, `Europe/London`, `Asia/Dubai`, `Asia/Tokyo`, `Asia/Seoul`, `Asia/Singapore`, `Australia/Sydney`), zero duplicate identifiers, empty/invalid-input fallback |
| `__tests__/api/user.test.ts` (order's own regression check) | **26/26 passed**, unaffected                                                                                                                                                                                                                                                                                               |
| Monolith Jest — full `npm run test:ci`                      | **166/166 suites, 2390/2390 tests passed** (165→166 suites, 2382→2390 tests vs. the immediately-prior session's own close baseline — exactly this session's 1 new suite/8 new tests, zero regressions elsewhere)                                                                                                           |
| TypeScript — monolith                                       | `tsc --noEmit`, 0 errors (after resolving the `Intl.supportedValuesOf` typing gap in §1.1)                                                                                                                                                                                                                                 |
| ESLint                                                      | Clean on all 3 changed/new source files                                                                                                                                                                                                                                                                                    |
| Pre-push hook (re-run automatically on `git push`)          | Full type-check + `test:ci` re-verified clean (**166/166 suites, 2390/2390 tests**) before the push was allowed to proceed                                                                                                                                                                                                 |

---

## 4. Live browser verification

Radix's `Select` (`components/ui/select.tsx` wraps `@radix-ui/react-select`) is **not** a
`cmdk`-based combobox — it owns its own keyboard-driven typeahead/roving-focus, a well-known
conflict source for an embedded search `<input>`. The task order's own JSX anticipated this with
`onKeyDown`/`onClick` `stopPropagation()` calls, but rather than trust that mitigation from a code
read alone, it was live-verified in a real browser before being treated as working:

- Built a **temporary, non-authenticated throwaway route** (`app/dev-tz-preview/page.tsx`),
  deliberately placed outside `app/settings/` to route around that directory's own
  `layout.tsx`-level `getServerSession()`+`redirect()` auth gate (the Executor never enters
  credentials, including one-click dev-login test-account autofill) — rendering the exact same
  `<Select>`+search-input JSX with mock state. **Deleted immediately after use, never committed.**
- Started a real Turbopack `next dev` server and drove it directly:
  - The page loaded with **`Total timezones: 419`** — confirming `Intl.supportedValuesOf`'s real
    ICU-backed path is what actually runs in a browser, not the curated fallback.
  - Opening the dropdown showed entries correctly sorted chronologically by offset, then
    alphabetically (e.g. all `-04:00` zones grouped and alpha-sorted:
    `America/Kentucky/Louisville`, `America/Lower_Princes`, `America/Manaus`, ... `America/New_York`).
  - Typing **`Dubai`** into the search box filtered live from 419 entries down to the single
    match `(GMT +04:00) Asia/Dubai`, with the dropdown staying open the whole time — confirming
    `stopPropagation()` correctly prevented Radix's typeahead from hijacking the keystrokes.
  - Clicking the filtered result correctly selected it (`Selected: Asia/Dubai`) and updated the
    trigger label to `(GMT +04:00) Asia/Dubai`.
  - Reopening the dropdown confirmed the search box resets to empty and the full list re-scrolls
    to the newly-selected item (Radix's built-in scroll-to-selected behavior, unaffected).
  - Typing a raw GMT-offset string, **`+05:30`**, correctly filtered to the two real zones at that
    offset the runtime's ICU data actually canonicalizes (`Asia/Calcutta`, `Asia/Colombo`) —
    confirming the search also matches on `gmtPrefix`, not just city/region name.
- **The real, auth-gated `/settings/language` page was also checked**, not just the throwaway
  route: local Turbopack `next dev` compiled it with zero build errors from the new
  `lib/utils/timezones.ts` import, and `GET /settings/language` cleanly redirected an
  unauthenticated visitor to `/login?callbackUrl=%2Fsettings%2Flanguage` (200), zero server
  errors — the same `app/settings/layout.tsx` auth gate as every other settings page in this
  repo's history.

**Not performed:** the authenticated click-through (does the Timezone field show the correct
saved-preference label on load, does the search box filter correctly inside the real page's own
styling/positioning, does selecting a new zone update the "Current time" preview live, does Save
persist it) — the Executor never authenticates. Flagged in `CLAUDE.md`'s `Waiting on` section for
Davin's own pass.

---

## 5. Git history

Landed as 3 scoped commits on `main`, then pushed to `origin/main` (pre-push hook re-ran the full
166-suite/2390-test monolith suite, plus a fresh type-check, before allowing the push):

| Commit     | Summary                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------- |
| `4aeb83f7` | `feat(utils): add all-round-clock timezone utility` — §1.1                                                    |
| `8a0bdcf8` | `feat(settings): wire Language & Region timezone dropdown to full IANA list` — §1.2                           |
| `dbc923c2` | `docs: close out all-round-clock timezone dropdown ad-hoc session` — this manifest's `CLAUDE.md` source entry |

---

## 6. Backward compatibility with existing user preferences

Every previously-offered timezone value (`America/New_York`, `America/Chicago`,
`America/Denver`, `America/Los_Angeles`, `Europe/London`, `Europe/Paris`, `Europe/Berlin`,
`Asia/Tokyo`, `Asia/Shanghai`, `Asia/Singapore`, `Australia/Sydney`, `Asia/Dubai`, `Asia/Seoul`)
is a real, standard IANA timezone identifier — every one of them is present in the full
`Intl.supportedValuesOf('timeZone')` list and in the curated fallback, by construction. No
migration, no remapping, and no special-casing was needed: a user whose stored `timezone` column
already holds one of these strings sees `getTimezoneLabel()` render it correctly
(e.g. `(GMT -05:00) America/New_York`) with zero change to what's persisted in the database.

---

## 7. Explicitly out of scope

- **`docs/policies/08-locale-i18n-compliance.md`** — this order only changes the Timezone list,
  not the Language/Currency arrays on the same page or `handleSave()`'s locale-write path, both
  already fixed in the 2026-09-01 locale-i18n-compliance ad-hoc session. Left unedited.
- **A `cmdk`/`@radix-ui/react-popover`-based combobox rewrite** — no `cmdk` dependency exists in
  this repo, and the task order's own raw-`<input>`-inside-`SelectContent` approach (with
  `stopPropagation()` mitigations) was verified working live in a real browser (§4); rewriting the
  interaction pattern to a different primitive would have been unrequested scope creep.
- **Full authenticated click-through of the real `/settings/language` page** — see §4's "Not
  performed" note and `CLAUDE.md`'s `Waiting on` entry.
