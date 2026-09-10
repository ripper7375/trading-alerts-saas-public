# M5-on-M15 Toggle Persistence — Manifest of Work Completion

**Work:** persist the PRO overlay toggle so the rendered-PNG download serves the
variant matching what is on the trader's screen.
**Executed:** 2026-09-10.
**Closes:** `MTF-RENDER-DELIVERY-MANIFEST-WORK-COMPLETION.md` §7.5.
**Status:** implementation complete and verified. **Not committed** — left for
Davin's review.

---

## 1. Decisions

Confirmed by Davin in chat before implementation.

| #   | Decision              | Chosen                                  | Consequence                                                                                                                   |
| --- | --------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| D11 | Where the state lives | **`UserPreferences.m5OnM15`**           | No migration — `preferences` is a JSON column. Durable and **cross-device**: toggle on desktop, the phone's download matches. |
| D12 | Keep `?variant=`?     | **No — the route reads the preference** | One source decides. The download button is a plain link with no state dependency, and Pillar 6 will read the same value.      |

D12's real payoff is that two sources can no longer disagree. A client-supplied
variant would have reintroduced precisely the screen-vs-download divergence this
whole line of work exists to close.

## 2. What shipped

| File                                                  | Change                                                                              |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `lib/preferences/defaults.ts`                         | `m5OnM15` on the interface, in `DEFAULT_PREFERENCES`, and in the validation switch. |
| `app/api/user/preferences/route.ts`                   | `m5OnM15: z.boolean().optional()`.                                                  |
| `operation-service/src/users/users.schemas.ts`        | The same three additions — see §3.1.                                                |
| `lib/preferences/server-preferences.ts` **(new)**     | `getM5OnM15Preference(userId)`.                                                     |
| `lib/auth/permissions.ts`                             | `requireChartDownload()` now returns the `Session`.                                 |
| `app/api/chart/download/route.ts`                     | Resolves the variant from the preference; `?variant=` removed.                      |
| `components/charts/mtf/useMtfPreference.ts` **(new)** | Loads and saves the toggle.                                                         |
| `components/charts/trading-chart.tsx`                 | Uses the hook instead of `useState(false)`.                                         |
| `lib/storage/chart-keys.ts`                           | `parseChartVariant` + `DEFAULT_CHART_VARIANT` **deleted** — see §3.3.               |
| Tests                                                 | 1 new suite, 1 rewritten, 2 updated.                                                |

## 3. Findings

### 3.1 ⚠ The preferences schema is mirrored in `operation-service`

`operation-service/src/users/users.schemas.ts` carries its own copy of the Zod
schema, the `UserPreferencesShape` interface **and** a `DEFAULT_PREFERENCES`
object. Adding the field only to the monolith would have meant any preferences
update routed through that service silently stripped `m5OnM15` — the toggle
would appear to work and then not persist.

This repo has a documented practice of keeping the two in lockstep (the
2026-09-03 France/Korea session did the same for `SUPPORTED_COUNTRY_CODES`), so
both were updated. Worth noting **how the second half was caught**: the Zod
schema and the interface were updated by hand, and `tsc` then failed on the
_defaults object_, which had been missed. The mirror's own type-checking found
it — the kind of drift that goes unnoticed when a field is optional everywhere.

### 3.2 The PUT merges, so a partial save is safe — checked, not assumed

`app/api/user/preferences/route.ts` builds `{ ...existingData,
...newPreferences }` before upserting. Two things follow, and both needed
confirming before relying on them:

- The hook can PUT `{ m5OnM15: next }` alone without clobbering the user's
  language, theme or chart colours.
- Conversely, the Settings pages saving language or privacy will not clobber
  `m5OnM15`.

Had the route replaced rather than merged, this design would have quietly
destroyed unrelated preferences on every toggle.

### 3.3 Dropping `?variant=` left dead code, which was deleted

With the route reading the preference, `parseChartVariant()` and
`DEFAULT_CHART_VARIANT` had **no production callers** — only their own tests,
which is the worst state for dead code to be in because it looks exercised.
Both were removed along with their assertions.

`CHART_VARIANTS` was **kept**: the cross-language parity test iterates it to pin
the object key against the renderer's own output filenames, which remains the
guard against a silent 404 on download.

### 3.4 The hook is inert unless the toggle is actually shown

In the stacked layout the M5 chart never renders the toggle, so a naive
implementation would have made **two** preference requests per page — one of
them for a value that instance can never use. `useMtfPreference(active)` takes
`isPro && mtfAvailable`, mirroring `useMtfOverlay`'s own discipline, so only the
M15 instance fetches.

It also guards a race worth naming: a slow GET landing _after_ the user has
already clicked would otherwise clobber their choice with the stale stored
value. A `touchedRef` prevents that.

Writes are optimistic — the toggle should feel instant, and a failed save
degrades to "the overlay is on for this session but the download may not agree",
which is worth surfacing (the button shows a saving state) and not worth
blocking the UI over.

## 4. Verification

| Check                                    | Result                                                    |
| ---------------------------------------- | --------------------------------------------------------- |
| Monolith `npx tsc --noEmit`              | clean                                                     |
| **operation-service `npx tsc --noEmit`** | clean — after it caught the missed defaults object (§3.1) |
| `npx eslint` (8 changed files)           | clean                                                     |
| operation-service `npm test`             | **43/43 suites · 401/401 tests**                          |
| Monolith `npm run test:ci`               | **176/176 suites · 2445/2445 tests**                      |
| jsdom teardown leaks                     | **0**                                                     |

Previous baseline was 175 suites / 2439 tests. The delta is +1 suite and +6 net
tests: 7 new for the server reader, minus the 1 removed with
`parseChartVariant`.

### 4.1 Not verified — flagged, not skipped

| Gap                                         | Why                                                                                                                                                                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **The round trip end to end**               | Toggle on screen → PUT → download serves `overlay`. Needs an authenticated PRO session, which the Executor does not create. It is also gated on the R2 bucket existing, so the download half cannot work yet regardless. |
| Persistence across reload                   | Same reason. The hook is unit-tested only through the route's contract.                                                                                                                                                  |
| Cross-device behaviour (D11's main benefit) | Needs two authenticated clients.                                                                                                                                                                                         |
| `useMtfPreference` itself                   | No direct suite — it is a thin fetch wrapper, and the behaviour that matters (which variant the download serves) is covered at the route. Worth adding if the hook grows.                                                |

## 5. Open items

### 5.1 The toggle now writes on every click

Each toggle is a PUT. Rapid flipping issues several in-flight requests; the last
write wins, which is correct, but there is no debounce. Not worth adding for a
control a trader clicks occasionally — recorded so it is a known choice.

### 5.2 Stack D Pillar 6 gets this for free

`STACK-D-…-V2.md` §10 was updated: its sketch referenced an invented
`m5OnM15Enabled` field, now corrected to the real `m5OnM15`, with a pointer to
`getM5OnM15Preference()` so Session 12-2 does not add a second preferences
fetch.

### 5.3 Still open elsewhere

- The R2 bucket and credentials, without which the download does nothing
  (delivery manifest §5).
- Whether to drop the still-forming newest bar (renderer plan §7.1).
- Two WebSockets per viewer (dual-stacked manifest §5.1).
