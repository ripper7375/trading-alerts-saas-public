# Market Session & High-Impact News Manifest — Work Completion Report

**Date:** 2026-09-10
**Status:** Code complete, verified, committed and pushed to `origin/main` — but **INERT in
production** until three operator steps land (§9).
**Type:** Ad-hoc feature session (Davin-requested directly in chat, beginning as an architecture
question) — outside the phase/session numbering, per
`docs/migration-orders/EXECUTOR-PROTOCOL.md` §6. Recorded in `CLAUDE.md`'s matching ad-hoc note.

> **Scope note:** this document covers the Market Session clock and the High-Impact News/Event
> countdown — the panel Davin annotated in the `/terminal` mockup — plus the complete economic-
> events data lane that feeds the second half, and the Stack D Pillar 8 specification that closes
> the gap which prompted the whole thread. It does not touch `market_data`, the indicator
> statistics lane, or Stack E's own market-comments feed.

---

## 0. How this started, and the decision that shaped everything

Davin asked which of two options to build the panel from:

1. Read events out of the TradingView Economic Calendar widget already embedded at `/econ-news`.
2. Build a lane in `davintrade-news-stack/` replicating `DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md`.

**Option 1 was found structurally incapable**, not merely weaker. `components/calendar/
economic-calendar-widget.tsx` injects a script that renders a **cross-origin iframe** from
`www.tradingview-widget.com`. Config flows in; nothing flows out. Same-origin policy makes that
iframe opaque, and there is no data API behind the widget. So it can drive neither a countdown
(no timestamp reaches the page) nor the LLM warnings (nothing exists server-side at all), and
scraping it would breach TradingView's terms. The widget remains an excellent _display_ surface,
which is what it was built for.

**Option 2 turned out cheaper than it looked, and smaller than proposed.**
`davintrade-news-stack/` is not a scraper — it wraps **MT5's own Economic Calendar API**
(`CalendarValueHistory` → `CalendarEventById` → `CalendarCountryById`), already available on the
terminal that runs the 13 export indicators. No vendor, no API key, no new cost. But replicating
the full blueprint would have been wrong: that machine exists because `market_data` is
high-volume, per-bar and positionally validated. News is ~15k rows/year, event-keyed, with no
cross-source invariant to check. A thin lane was built instead.

**Two reframings that made the work smaller.** First, the panel is _two_ features with nothing in
common but a rectangle: a session clock (pure arithmetic, no data source) and a news countdown
(needs real event rows). Only the second was ever in question. Second, before building anything,
a **Step Zero probe** answered the one question that could have invalidated the whole plan.

---

## 1. What was built

### 1.1 Step Zero — MT5 calendar availability probe

`davintrade-news-stack/step-zero-calendar-availability-check/CalendarAvailabilityCheck.mq5`, a
read-only MQL5 script answering "does the built-in calendar return usable data on THIS terminal?"
before any design work. It deliberately does **not** `#include` the vendor library, so a failure
would be unambiguous (API unavailable, not a library bug) and it could run before that library's
licensing question was settled.

**Result on the live terminal (Eightcap-Demo, build 6182): GO.**

| Check                       | Result                                        |
| --------------------------- | --------------------------------------------- |
| Calendar reachable          | **333 events / 8 days**, `GetLastError() = 0` |
| `CalendarEventById`         | **333 ok / 0 failed**                         |
| `CalendarCountryById`       | **333 ok / 0 failed**                         |
| Server-side currency filter | Works — 95 USD rows of 333                    |
| HIGH-impact present         | 25 (23 upcoming, 2 past)                      |
| Countdown computable        | PPI m/m, USD, `03:00:46`                      |
| Volume                      | 41.6/day → ~15k/year                          |

**The probe's highest-value section was the clock.** This stack shipped a two-year timestamp bug
because an offset was _assumed_ rather than measured (`gmt_offset` built from `TimeCurrent()`, the
last **tick** time, not a clock). The probe measured server-vs-GMT the same hour-rounded way the
fixed indicators now do — **exactly GMT+3** — and the result was cross-checked against two real
releases rather than trusted: US PPI at `15:30` server = 12:30 UTC (published 08:30 ET ✓), ECB at
`15:15` server = 12:15 UTC (announced 14:15 CEST ✓). That confirmed `MqlCalendarValue.time` is
**server time**, empirically.

### 1.2 Piece A — the Market Session clock

`lib/market-sessions/sessions.ts`: a pure, dependency-free engine for Sydney / Tokyo / London /
New York, plus `components/market-sessions/session-status-banner.tsx` rendering the mockup's D4
banner from it. Headlines the most recently opened session (so New York holds it during the
London overlap), dims inactive centres, and counts down to this session's close, the next
session's open, or the weekend reopen.

Two correctness properties that a naive session clock gets wrong:

- **All zone maths runs through IANA identifiers and `Intl`, never fixed UTC offsets.** Hardcoding
  breaks four times a year, and Sydney's DST runs _opposite_ to London's — a single offset
  constant is wrong for part of every year in at least one centre.
- **A session is open only when the forex market itself is open.** Without that gate, Tokyo shows
  as trading at 10:00 JST on a Saturday, and Sydney shows open during the Sunday-evening gap
  before the 17:00 New York reopen.

`Intl.DateTimeFormat` instances are cached per zone: a single state computation resolves parts a
few hundred times in the worst case and the banner recomputes every second, so the uncached
version would build tens of thousands of formatters a minute in an open tab.

### 1.3 The append-only data contract

- `sqlite_schema_v6_xauusd.sql` — new `economic_events` outbox (25 columns), 7-day replay buffer,
  prune trigger. Not symbol-scoped: events are global, and XAUUSD relevance is derived from
  `currency` at query time.
- `gateway_contract_economic_events.schema.json` — 25 properties, `additionalProperties: false`.
- `EconomicEvent` in **both** `prisma/market-data/schema.prisma` and
  `railway-gateway/prisma/schema.prisma`, byte-identical by construction.
- `prisma/migrations/20260910120000_add_economic_events/migration.sql` — authored, **not applied**.

### 1.4 MQL5 exporter

`mq5/EconomicCalendarExport_v2_29.mq5` — an **EA**, not a script (it is a timer job), attached to
one chart, any symbol. Writes a tab-separated snapshot to a temp file and renames, so the
collector can never read a half-written file; a failed or empty fetch leaves the previous export
intact rather than replacing it with nothing.

**Deliberately dumb**: it emits a full snapshot every cycle and does no change detection. That
decision belongs in the collector, where it is testable in Python.

### 1.5 Collector parser and the append-only decision

`export_collector_validator_v2.py` — `parse_calendar_file()` and `stage_economic_events()`,
hooked into `run_cycle()` in their own `try/except`. **159 insertions, 0 deletions.**

### 1.6 Push-worker drain loop

`backfill_worker_api_gateway_v5.py` — `push_economic_events()`, a third isolated lane with its own
endpoint and quarantine file, every exception swallowed. **99 insertions, 0 deletions.**

### 1.7 Gateway

`economic-events.controller.ts`, `economic-events.processor.ts`, a third Bull queue, and a
**generated** DTO (a target added to `generate-market-data-dto.js`, never hand-written).

### 1.8 API route and the news row

`lib/economic-events/queries.ts`, `app/api/market/economic-events/route.ts`,
`components/market-sessions/useUpcomingEvent.ts`, and the news row in the banner.

### 1.9 Stack D Pillar 8

`STACK-D-CONVERSATIONAL-AI-CHART-ANALYSIS-ARCHITECTURE-V2.md` promoted from 7 pillars to 8 across
all 8 reference sites, plus `lib/economic-events/prompt-context.ts`.

---

## 2. Files changed

**38 files — 21 added, 17 modified — 4,943 insertions, 29 deletions.**

### 2.1 Stack C — the VPS pipeline

| File                                                                  | Change                                           |
| --------------------------------------------------------------------- | ------------------------------------------------ |
| `step-zero-calendar-availability-check/CalendarAvailabilityCheck.mq5` | **New.** Read-only go/no-go probe                |
| `mq5/EconomicCalendarExport_v2_29.mq5`                                | **New.** Calendar exporter EA                    |
| `gateway_contract_economic_events.schema.json`                        | **New.** 25-property JSON contract               |
| `sqlite_schema_v6_xauusd.sql`                                         | `economic_events` outbox + index + prune trigger |
| `export_collector_validator_v2.py`                                    | Parser + append-only staging (+159/−0)           |
| `backfill_worker_api_gateway_v5.py`                                   | Batched drain lane (+99/−0)                      |
| `test_economic_events.py`                                             | **New.** 14 collector tests, standalone-runnable |
| `test_push_economic_events.py`                                        | **New.** 13 push tests, standalone-runnable      |
| `DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md`                         | §0.1 manifest rows + new §5.5                    |

### 2.2 Railway gateway

| File                                        | Change                                                |
| ------------------------------------------- | ----------------------------------------------------- |
| `src/gateway/economic-events.controller.ts` | **New.** Batched ingest, explicit ParseArrayPipe opts |
| `src/worker/economic-events.processor.ts`   | **New.** Idempotent upsert on the append-only key     |
| `src/gateway/dto/economic-event.dto.ts`     | **New.** Generated, 25 fields                         |
| `test/economic-events.e2e-spec.ts`          | **New.** 11 e2e tests                                 |
| `scripts/generate-market-data-dto.js`       | Third TARGETS entry                                   |
| `prisma/schema.prisma`                      | `EconomicEvent`, byte-identical to the monolith       |
| `src/gateway/gateway.module.ts`             | Queue + controller registration                       |
| `src/worker/worker.module.ts`               | Queue + processor registration                        |
| `test/schema-sync.spec.ts`                  | Drift guard + append-only invariants                  |
| `test/dto-contract.spec.ts`                 | DTO↔contract guard for the new DTO                   |
| `test/market-data.e2e-spec.ts`              | Third queue override (§7)                             |
| `test/indicator-statistics.e2e-spec.ts`     | Third queue override + `economicEvent` mock           |

### 2.3 Monolith

| File                                                                 | Change                                          |
| -------------------------------------------------------------------- | ----------------------------------------------- |
| `lib/market-sessions/sessions.ts`                                    | **New.** Session-clock engine                   |
| `components/market-sessions/session-status-banner.tsx`               | **New.** The D4 banner                          |
| `components/market-sessions/useUpcomingEvent.ts`                     | **New.** Fetch hook, aborts on unmount          |
| `lib/economic-events/queries.ts`                                     | **New.** Read layer, collapses to newest        |
| `lib/economic-events/prompt-context.ts`                              | **New.** Pillar 8 serialization (no caller yet) |
| `app/api/market/economic-events/route.ts`                            | **New.** PRO-gated, DB re-check                 |
| `prisma/market-data/schema.prisma`                                   | `EconomicEvent`                                 |
| `prisma/migrations/20260910120000_add_economic_events/migration.sql` | **New**, authored/unapplied                     |
| `components/market-comments-panel.tsx`                               | Banner mounted, PRO-gated                       |
| `lib/i18n/dictionaries/en-US.json` / `en-GB.json`                    | +10 keys each                                   |
| 5 new test files                                                     | 54 new monolith tests                           |
| `STACK-D-...-V2.md`                                                  | 7 pillars → 8                                   |

---

## 3. Test verification

| Suite                               | Before      | After           |
| ----------------------------------- | ----------- | --------------- |
| Monolith `npm run test:ci`          | 176 / 2,445 | **181 / 2,513** |
| Gateway `npm test`                  | 3 / 31      | **3 / 43**      |
| Gateway `npm run test:e2e`          | 2 / 17      | **3 / 28**      |
| Collector `test_economic_events.py` | —           | **14 / 14**     |
| Push `test_push_economic_events.py` | —           | **13 / 13**     |

`npx tsc --noEmit` and `npx eslint` clean on the monolith and the gateway throughout. Both Python
suites are runnable with **no infrastructure** (`python test_economic_events.py`) because this
stack has no pytest config and pytest is not installed on the dev box — a test nobody can run is
worse than no test.

---

## 4. Live verification

- **Step Zero run on the real terminal** — §1.1's table, produced by Davin running the compiled
  script; the report file was read directly from `MQL5\Files\`.
- **Session banner in a real browser** — rendered `🇬🇧 GB London Session · SESSION CLOSES IN
05:59:41`, correct for 11:00 BST, with only London lit and the countdown ticking (05:59:29 →
  05:59:27 over 2.1s). Verified light **and** dark, **zero console errors**.
- **All 12 DST/weekend assertions re-run in Chrome's own ICU**, not just jsdom's — and hydration
  succeeded with **no mismatch**, which independently proves Node's and Chrome's ICU agree on
  every case.
- **API route hit live with the migration UNAPPLIED → 401, not 500.** An ordering proof: if the
  auth gate ran after the query, a missing table would have surfaced as a server error. The mocked
  tests assert that ordering but cannot demonstrate it.
- **SQLite schema applied to a real in-memory database**, proving the append-only replay: a
  forecast row at `t=100` with `actual = NULL`, the published actual landing at `t=200` as a
  **second row**, the first unchanged.
- **The migration diffed against `prisma migrate diff` output — IDENTICAL.**

**Not verified, flagged rather than skipped:** no MQL5 file was compiled (MetaEditor is not
available here), no render has run against the live terminal, and the authenticated `/terminal`
click-through was not performed — the Executor does not enter credentials.

---

## 5. Git history

11 scoped commits on `main`, then pushed to `origin/main`.

| Commit     | Summary                                                             |
| ---------- | ------------------------------------------------------------------- |
| `05f41a45` | `feat(market-sessions)` — session-clock engine (§1.2)               |
| `102fcca4` | `feat(terminal)` — PRO-gated banner in the panel (§1.2, §6.1)       |
| `5b1b601b` | `chore(news-stack)` — Step Zero probe (§1.1)                        |
| `85a8e85d` | `feat(economic-events)` — append-only data contract (§1.3)          |
| `59a20a66` | `feat(economic-events)` — MQL5 exporter (§1.4)                      |
| `628dcf5e` | `feat(economic-events)` — collector parser (§1.5)                   |
| `dcee76e8` | `feat(economic-events)` — batched push drain (§1.6)                 |
| `04018330` | `feat(economic-events)` — gateway controller/queue/processor (§1.7) |
| `a48595f3` | `feat(economic-events)` — API route + news row (§1.8)               |
| `4bb54d14` | `docs(economic-events)` — stale docstring + missing key (§8.4)      |
| `7620e037` | `feat(stack-d)` — Pillar 8 (§1.9)                                   |

---

## 6. Design decisions, each made against a real alternative

### 6.1 PRO-gated, after getting it wrong first

The banner initially shipped **ungated**, on the reasoning that session hours are public
information. Davin corrected this with a screenshot of the seed's `/free` page: the entire
right-hand panel is blurred behind a lock whose copy names the feature explicitly — _"Live Market
Comments, **Session Countdowns**, Gauges, and EDT Quality Metrics require a PRO subscription."_

The error was not the monetization opinion; it was treating a **settled design decision as an open
question** and defaulting to the answer that contradicted it. The monolith had no such overlay only
because that panel had no real content to gate — the banner was the first, which is what made the
question live again.

Noted in code: this is a **presentation gate, not an entitlement boundary**. Session state is
computed client-side from the clock, so nothing secret is withheld.

### 6.2 Append-only, reversing an earlier recommendation

The Step Zero report and the first summary both recommended **UPSERT**. That was the wrong default,
and it was reversed on reflection against this repo's own precedent: `indicator_statistics` is
append-only for exactly this class of data, and `HISTORICAL-VALUES-LOOK-AHEAD-BIAS-OPEN-ISSUE.md`
records that UPSERT already destroyed point-in-time truth once here, irrecoverably.

**The asymmetry decides it.** From append-only history, current state is one `DISTINCT ON` query
away. From an upserted row, the forecast as it stood before the release is gone forever. A revised
forecast is itself signal, and volume is trivial either way.

### 6.3 Change detection in the collector, not the exporter

Not bookkeeping — it is what makes append-only _affordable_. The exporter re-emits ~333 rows per
snapshot; appending all of them every cycle writes ~32,000 rows/day, about **12M/year**, nearly all
byte-identical repeats. Comparing against the newest stored row per `value_id` — across every field
**except** `captured_at`, which differs by definition — brings that to roughly **15k/year**.

### 6.4 Ids as strings everywhere

`MqlCalendarValue.id` and `MqlCalendarEvent.id` are MQL5 `ulong` (64-bit) and JSON has no 64-bit
integer. The Step Zero probe never printed their magnitude — a genuine gap in it — so rather than
gamble on Int32 they are opaque strings in SQLite, the contract, Prisma and the DTO alike.
Verified: `ULONG_MAX` round-trips losslessly as text, where an integer truncates silently.

### 6.5 Batched push, not `market_data`'s shape

`market_data` posts one row per request and is already under-provisioned for its own volume
(`PUSH-WORKER-THROUGHPUT-OPEN-ISSUE.md`: ~800 rows/min demanded against 375–600 capacity).
Inheriting that would turn a 333-row first sync into 333 sequential round trips. Capped at
250/cycle. Oldest-first is safe _here_ in a way it is not for `market_data`: this outbox empties
every cycle, so nothing starves behind a backlog.

### 6.6 A `.txt` export, not direct SQLite

MQL5 can write SQLite — the vendor library and the legacy EA both do — but in the v6 flow the
Python collector is the **only** writer of `xauusd.db`. A second writer buys lock contention and
"database is locked" failures for nothing. Blueprint §3.3 already settled this.

### 6.7 Missing is never zero

`LONG_MIN` upstream means _not published_, and for forecasts that is the **common** case: Step Zero
measured only 12 of 23 upcoming HIGH-impact events carrying one, because rate decisions, votes and
speeches structurally have none. Coercing to `0` would both fabricate a zero forecast for an ECB
decision and make a genuine `0.0` publication look unchanged, so it would never be recorded at all
— two opposite fabrications from one line. Enforced at every layer and tested at each.

---

## 7. Mutation testing — how the tests were trusted

Every safety-critical property was verified by **breaking it and confirming the right test fails**,
because every failure mode in this lane is silent.

| Broken                                           | Fails with                                            |
| ------------------------------------------------ | ----------------------------------------------------- |
| Session market-open gate **and** `effectiveOpen` | 2 tests (each alone: none — a redundant pair)         |
| Collector change detection                       | volume test: 3 expected rows become **192**           |
| Empty field coerced to `0` (collector)           | 5 tests, incl. `pre-release actual was overwritten`   |
| Push batching                                    | `120 requests for 120 rows`                           |
| Push swallow-everything guard                    | 2 exceptions escape into the caller                   |
| Push 400 poison guard                            | `poison rows left unstamped -> outbox wedged`         |
| `ParseArrayPipe` whitelist options               | `rejects an unknown field with 400, not a silent 200` |
| Panel tier gate                                  | `hides the session banner on FREE`                    |
| Pillar 8 empty-string guard                      | 1 test                                                |
| Pillar 8 missing-as-number                       | 2 tests                                               |
| Pillar 8 anti-hallucination boundary             | 1 test                                                |

**Two mutation attempts initially proved the wrong thing**, and both are recorded because the shape
recurs:

- The session-clock guards turned out to be a **mutually redundant pair** — removing either alone
  left all 26 tests green, and only removing both failed two. Documented in place so neither is
  "simplified" away.
- The first push-worker poison-guard mutation silently hit the **success** path instead, because
  both paths carry byte-identical stamping blocks. It failed three tests and looked entirely
  convincing while proving nothing about the guard in question. **A passing mutation check is only
  as good as the mutation landing where you think it did.**

---

## 8. Corrections made during the session

1. **"Real-browser ICU" claim, retracted mid-run.** Reported that 12 DST checks had passed in
   Chrome. They had not — React had not hydrated (no fibers on `document.body`), so they had run
   during SSR on **Node's** ICU. Cause was the workaround itself: the browser pane force-upgrades
   `localhost` to https, so `127.0.0.1` was used, which Next's dev server blocks as a cross-origin
   dev request; chunks 403'd and hydration never happened. Fixed with a temporary
   `allowedDevOrigins` (since reverted, diff empty) and the checks genuinely re-ran in Chrome.
2. **UPSERT → append-only** (§6.2).
3. **Ungated → PRO-gated banner** (§6.1).
4. **A stale docstring in the previous commit.** The banner's header still said the news half was
   "NOT reproduced here" — true when the session clock shipped alone, false the moment the news row
   landed. A comment describing the opposite of what the file does is worse than no comment. Fixed
   with the missing `t()` key in `4bb54d14`.
5. **A test that passed for the wrong reason.** With modern fake timers `advanceTimersByTime`
   advances the clock itself, so also calling `setSystemTime` double-counted the jump. One test
   caught it; the session-boundary test passed anyway because its assertion tolerated the drift.
6. **A test fixture blamed on the code.** The first volume fixture flipped a revised forecast back
   on the next cycle, and the collector correctly recorded the revert as a second change. The code
   was right; the fixture was not.
7. **`app.module.ts` named as the registration point.** It only composes modules; registration
   lives in `gateway.module.ts` / `worker.module.ts`.

---

## 9. NOT DONE — what this needs from Davin

**The lane is complete and inert.** Until these land, the news row simply does not render and the
banner shows the session clock alone — the intended degradation, not a fault.

1. **⚠ Compile in MetaEditor.** `EconomicCalendarExport_v2_29.mq5` has **never been compiled** —
   MQL5 cannot be built in this environment. Worth batching with the **10 statistic-emitting
   indicators already a build behind** (`CLAUDE.md`'s existing Waiting-on item): one trip, not two.
2. **⚠ Apply the migration.** `20260910120000_add_economic_events`, purely additive — one
   `CREATE TABLE` plus indexes, touching nothing existing. No pre-flight count needed, unlike the
   `best_fit` rename or the provenance `NOT NULL` change.
3. **⚠ Deploy to the VPS.** Collector, schema and push worker; then attach the exporter EA to one
   chart (any symbol). Recommended to **hold until that terminal has run a green cycle** — building
   ahead is fine, shipping into an unproven terminal is not.

**Also unverified, flagged rather than skipped:**

- Authenticated `/terminal` click-through of the banner (Executor does not enter credentials).
- Any live MT5 → PostgreSQL round trip for this lane.
- `prompt-context.ts` has **no runtime caller** until Stack D Session 12-2 (§10).

**One open licensing question:** `davintrade-news-stack/`'s `base.mqh` is © Omega Joctan, an MQL5
Market seller. **Nothing shipped here depends on it** — the Step Zero probe and the exporter both
use only native MQL5 calls, deliberately. The question becomes live only if his
`provider_sqlite.mqh` is ever adopted, which §6.6 makes unnecessary.

---

## 10. Explicitly out of scope

- **Stack D's orchestrator.** Confirmed not built — no `app/api/ai`, no
  `execute7PillarRetrieval()`. Pillar 8 was therefore delivered as **specification plus the one
  piece worth having in tested code now**, not as a wiring change. Building the orchestrator is
  Phase 12 (Sessions 12-0 → 12-5) and was not requested.
- **`prompt-context.ts`'s caller.** The module exists ahead of its consumer, deliberately and
  visibly. The rules it encodes are safety rules that fail to survive the trip from a design
  document into code written six sessions later. Retrieval (`getUpcomingHighImpactEvents`) is live
  and exercised; only serialization waits.
- **The seed's full blur-and-lock overlay on `/free`.** FREE users correctly see no banner, but the
  panel still renders an empty "coming soon" state rather than the seed's locked one. A
  pre-existing divergence — blurring an empty panel advertises nothing. Belongs with Stack E, when
  there is content behind the glass.
- **Currency breadth.** The pipeline captures **every** currency; only the _display_ filter is
  narrowed to `USD/EUR/GBP/JPY/CHF`. Widening is a one-line change with no capture implications —
  what is not captured cannot be recovered, so nothing was filtered at source.
- **`/econ-news` and its TradingView widget** — untouched, and correctly retained as the public
  browse surface (§0).
- **Translation of the 10 new i18n keys** into the other 12 dictionaries — identity-mapped English
  only, degrading safely per `docs/policies/08-locale-i18n-compliance.md`'s documented precedent.
