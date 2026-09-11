# Currency & Gold Index Stack ("Lane 4") Manifest — Work Completion Report

**Date:** 2026-09-11
**Status:** Phases 1–4 code complete, verified, committed, and pushed to `origin/main`. Both
`railway-gateway` and the monolith auto-deployed from that push and are confirmed live in
production (§5.1). Phase 5's 3 remaining items — applying the Postgres migration, attaching the
exporter to 8 MT5 charts, and registering the engine as a VPS service — are **not started**, and
require physical actions on the Contabo/Vultr VPS that this Executor cannot perform. See §5.
**Type:** Ad-hoc feature session (Davin-requested directly in chat, one phase at a time) — outside
the phase/session numbering, per `docs/migration-orders/EXECUTOR-PROTOCOL.md` §6. Recorded across
three `CLAUDE.md` ad-hoc entries (Phase 1; Phase 2; Phases 3+4 combined), all dated 2026-09-11.

> **Scope note:** this document covers the G8 Currency & Gold Index Suite ("Lane 4") only — a
> fully isolated, display-only marketing lane per
> `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/
DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md`'s isolation doctrine. It shares no process, no
> database file, and no source file with the XAUUSD alert pipeline ("Lane 1"), `indicator_statistics`
> ("Lane 2"), or `economic_events` ("Lane 3").

---

## 1. What was built

Four phases, each planned, implemented, and verified as its own unit before the next began, per
`EXECUTOR-PROTOCOL.md`'s one-session-one-verifiable-unit discipline. The full architecture spec is
[`COMPREHENSIVE_ARCHITECTURE_DESIGN_CURRENCY_AND_GOLD_INDEX_STACK.md`](COMPREHENSIVE_ARCHITECTURE_DESIGN_CURRENCY_AND_GOLD_INDEX_STACK.md)
in this same folder; this manifest records what was actually built against it, including every
place the implementation deliberately departed from the spec's own illustrative examples and why.

### 1.1 Phase 1 — VPS math engine (fully separate from the v6 alert pipeline)

- **New** `backend-stack-c/.../currency_gold_index_engine.py` — a standalone Python process
  (own script, own NSSM service, own SQLite outbox `currency_gold_indices.db`, **never**
  `xauusd.db`) computing 8 equal-weighted G8 currency indices (`USDX`/`EURX`/`JPYX`/`GBPX`/
  `AUDX`/`NZDX`/`CADX`/`CHFX`) and a rebased gold index (`XAUX`) every 5 minutes from 8
  independent `OHLCV_{SYMBOL}_M5.txt` exports.
- **All 8 currency-index formulas verified byte-exact** against the authoritative MQL5 indicator
  files (`mql5-indicators/interesting-indicators/currency-and-gold-index/*.mq5`) — every
  `MathPow()` exponent sign read directly from source, including the trickier inverse-quote
  conventions (`CADX`/`CHFX` use `1/rate`). `EURX.mq5` was initially missing from the folder;
  Davin supplied it mid-session and it verified exact too (all-positive exponents, as predicted).
- **Zero new MQL5 authoring needed** — reuses the existing, already-compiled
  `ohlcvexportlightweight_v2_29.mq5` unchanged, attached to 8 independent charts (7 FX pairs + a
  dedicated `XAUUSD` chart, deliberately **not** reusing the alert pipeline's own `XAUUSD` export,
  to avoid the exact read-a-writer's-database-path hazard this repo's own history had already hit
  once — see `CLAUDE.md`'s 2026-09-11 `MT5Renderer` fixture-database entry).
- Session-boundary detection (00:00 server time for the 8 currency indices, 01:01 for `XAUX`'s own
  daily rollover reopen) via a pure-Python Eightcap US-DST offset function — the engine has no live
  MT5 API access, so this had to be computed independently rather than measured live.
- A deliberate schema addition beyond the spec's own literal fields: every row carries
  `session_open_bar_time`, so the engine — the only place with ground truth of the documented
  DST rule — is the only place in the whole stack that ever has to reason about it.

### 1.2 Phase 2 — NestJS gateway endpoint + Postgres schema

- **New** `POST /api/v1/currency-gold-indices` in `railway-gateway/`: a 4th isolated Bull queue
  (`currency-gold-indices-sync`), `CurrencyGoldIndicesController` (array body via `ParseArrayPipe`
  with explicit `whitelist`/`forbidNonWhitelisted`), `CurrencyGoldIndicesProcessor` (concurrency 1),
  and a DTO generated from the Phase 1 JSON contract — modeled on the closest existing precedent,
  the `indicator_statistics` lane.
- **New** `CurrencyGoldIndex` Prisma model, in both `prisma/market-data/schema.prisma` and
  `railway-gateway/prisma/schema.prisma` (byte-identical body, per the established convention
  `schema-sync.spec.ts` enforces) — deliberately **not** modeled as an append-only revision stream
  like `IndicatorStatistic`/`EconomicEvent`: `(index_name, bar_time)` has exactly one correct,
  deterministically-recomputable value, so the gateway upserts in place.
- Migration `20260911120000_add_currency_gold_indices` **authored, not applied** — one new table,
  nothing existing touched — per this repo's standing rule that the Executor never applies a
  migration to a live database.
- **A real pre-existing bug found and fixed in shared infrastructure:**
  `generate-market-data-dto.js`'s import-collection step silently dropped `IsIn` from a generated
  DTO's imports whenever it was the _only_ enum decorator in a schema and its own argument list
  needed to wrap onto multiple lines (a regex missing the `s`/dotAll flag). This lane's 9-item
  `index_name` enum is the first schema to actually expose it — every prior wrapped `@IsIn(...)`
  had an earlier single-line `@IsIn(...)` elsewhere that masked the bug by seeding the clean name
  first. Fixed by extracting the decorator name directly instead of a two-step string strip;
  confirmed the 3 pre-existing DTOs regenerate byte-identical.

### 1.3 Phase 3 — Redis cache + public API route

- **New** `GET /api/market/currency-gold-indices` — the **first genuinely public, unauthenticated
  route** under `/api/market/*`; every sibling (`economic-events`, `indicator-statistics`) is
  session + PRO gated. Cache-aside (60s TTL) via an **existing** `lib/cache/cache-manager.ts`
  utility, found and extended rather than duplicated with raw Redis calls, falling back to Postgres
  gracefully if Redis is unreachable.
- **Two deliberate departures from the spec's own illustrative example**, both evidence-based:
  dropped the spec's `"name": "Gold Index"` field from the wire response (baking an English-only
  display name into a public API payload would violate this repo's own locale/i18n policy — that
  mapping belongs in the frontend via `t()`); and used this app's real, established
  `/api/market/*` route convention and `{indices}` response wrapper instead of the spec's
  illustrative `/api/v1/public/market-indices/today`, which matches no real convention anywhere in
  this codebase.
- **A real bug in the new test file, caught before it could mask a future regression:** the query
  function calls `findMany` once or twice depending on whether the first result is empty (an
  early-return path the single-call sibling query functions never needed). `jest.clearAllMocks()`
  only clears call history, not queued `mockResolvedValueOnce()` values, so a test that queued two
  but consumed only one leaked its second value into the next test — passing only by coincidence
  because every test happened to queue byte-identical fixtures. Fixed with `jest.resetAllMocks()`.

### 1.4 Phase 4 — landing-page Hero widget

- **New** `CurrencyIndexHeroWidget`, wired into `components/landing/landing-hero.tsx` right after
  the CTA button row (architecture doc §7.1's own placement) — 4 rows visible, scrollable for the
  remaining 5 of 9.
- **New** `FloatingSparkline` — zero-dependency pure SVG, kept close to the spec's own given
  implementation (already well-designed), with a baseline that floats in Y-space with the data's
  own range rather than sitting at a fixed axis position.
- **New** `components/ui/tooltip.tsx` — a shared Radix Tooltip wrapper; none existed in this
  codebase yet.
- **New** `lib/currency-gold-indices/metadata.ts` — the 9 index names + educational tooltip copy
  (definition + "trading edge" per the spec's §8 dictionary), wired through `t()` with 27 new
  identity-mapped keys in `en-US.json`/`en-GB.json` (not yet translated into other dictionaries,
  matching the established precedent for newly-added marketing copy).
- **SWR used deliberately, not by default** — every other data hook in this app
  (`useContainmentRates`, `useUpcomingEvents`) uses plain `fetch`+`useEffect`+`setInterval`; this is
  the one route that is genuinely public and real-cached, where SWR's revalidate-on-focus and dedup
  semantics are an actual fit.
- Renders **nothing at all** until real data exists — the same "absent row is the honest
  rendering" rule `components/market-sessions/containment-rate-strip.tsx` already follows, rather
  than a placeholder or broken-looking card on the public landing page.
- **A real risk caught and fixed before it could break an existing suite:**
  `__tests__/components/landing/landing-and-auth-navigation.test.tsx` renders `<LandingHero>`
  directly, and this app's `jest.setup.js` polyfills `global.fetch` with `undici`'s real
  implementation (not a stub) — an unmocked SWR call would have attempted a genuine fetch and
  rejected, the exact "fetch leaked past jsdom teardown, error surfaced in an unrelated suite"
  failure class `LESSONS-LEARNED.md` already documents from a prior `LocaleProvider` geo-IP
  incident. Mocked `useCurrencyGoldIndices` directly in that test file before it could reproduce.

---

## 2. Files changed

| File                                                                                                         | Change                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend-stack-c/.../currency_gold_index_engine.py`                                                          | **Added.** The VPS math engine (Phase 1)                                                                                                                                    |
| `backend-stack-c/.../gateway_contract_currency_gold_indices.schema.json`                                     | **Added.** JSON contract for the push payload                                                                                                                               |
| `backend-stack-c/.../install_currency_gold_index_engine_service.bat`                                         | **Added.** Standalone NSSM installer — deliberately not appended to the existing `install_services.bat`, which has a documented live-credential-clobbering hazard on re-run |
| `mql5-indicators/interesting-indicators/{USDX,EURX,GBPX,JPYX,CADX,AUDX,NZDX,CHFX,Rebased Gold Price H4}.mq5` | Moved into a new `currency-and-gold-index/` subfolder (7 renamed, `EURX.mq5` newly present) — the authoritative ground-truth files Phase 1's formulas were verified against |
| `prisma/market-data/schema.prisma`                                                                           | New `CurrencyGoldIndex` model                                                                                                                                               |
| `railway-gateway/prisma/schema.prisma`                                                                       | Mirrored (byte-identical body)                                                                                                                                              |
| `prisma/migrations/20260911120000_add_currency_gold_indices/migration.sql`                                   | **Added.** Authored, not applied                                                                                                                                            |
| `railway-gateway/scripts/generate-market-data-dto.js`                                                        | New `CurrencyGoldIndexDto` target + **real bug fix** (multi-line decorator import stripping)                                                                                |
| `railway-gateway/src/gateway/currency-gold-indices.controller.ts`                                            | **Added.** `POST /api/v1/currency-gold-indices`                                                                                                                             |
| `railway-gateway/src/gateway/dto/currency-gold-index.dto.ts`                                                 | **Added.** Generated                                                                                                                                                        |
| `railway-gateway/src/gateway/gateway.module.ts`                                                              | 4th isolated queue + controller registered                                                                                                                                  |
| `railway-gateway/src/worker/currency-gold-indices.processor.ts`                                              | **Added.** Upsert processor                                                                                                                                                 |
| `railway-gateway/src/worker/worker.module.ts`                                                                | 4th isolated queue + processor registered                                                                                                                                   |
| `railway-gateway/test/currency-gold-indices.e2e-spec.ts`                                                     | **Added.** 12 tests                                                                                                                                                         |
| `railway-gateway/test/{dto-contract,schema-sync}.spec.ts`                                                    | Extended with Lane 4 contract/drift assertions                                                                                                                              |
| `railway-gateway/test/{market-data,indicator-statistics,economic-events}.e2e-spec.ts`                        | New queue-mock override added (every registered queue must be mocked or Bull reaches for Redis at teardown)                                                                 |
| `lib/cache/cache-manager.ts`                                                                                 | New `MARKET_INDICES` prefix + Lane 4 cache section, reusing the existing `getCache`/`setCache` utility                                                                      |
| `lib/currency-gold-indices/queries.ts`                                                                       | **Added.** Latest-per-index + sparkline read layer                                                                                                                          |
| `lib/currency-gold-indices/metadata.ts`                                                                      | **Added.** Index display names + tooltip copy                                                                                                                               |
| `app/api/market/currency-gold-indices/route.ts`                                                              | **Added.** The public API route                                                                                                                                             |
| `__tests__/api/currency-gold-indices.test.ts`                                                                | **Added.** 13 tests                                                                                                                                                         |
| `components/market/floating-sparkline.tsx`                                                                   | **Added.**                                                                                                                                                                  |
| `components/market/currency-index-hero-widget.tsx`                                                           | **Added.**                                                                                                                                                                  |
| `components/market/useCurrencyGoldIndices.ts`                                                                | **Added.** SWR hook                                                                                                                                                         |
| `components/ui/tooltip.tsx`                                                                                  | **Added.** New shared Radix Tooltip primitive                                                                                                                               |
| `components/landing/landing-hero.tsx`                                                                        | Widget wired in after the CTA row                                                                                                                                           |
| `__tests__/components/market/{floating-sparkline,currency-index-hero-widget}.test.tsx`                       | **Added.** 20 tests total                                                                                                                                                   |
| `__tests__/components/landing/landing-and-auth-navigation.test.tsx`                                          | New hook mock (prevents an unmocked-`fetch` leak into an unrelated suite)                                                                                                   |
| `lib/i18n/dictionaries/{en-US,en-GB}.json`                                                                   | 27 new identity-mapped keys (9 names + 9 definitions + 9 trading-edge copy)                                                                                                 |
| `CLAUDE.md`                                                                                                  | 3 ad-hoc session entries (Phase 1; Phase 2; Phases 3+4)                                                                                                                     |

**46 files touched** (37 added, 9 modified/renamed) across 4 feature commits, plus this manifest
and `CLAUDE.md` in a 5th documentation commit.

---

## 3. Test verification

| Suite                                                                                        | Result                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 1 — formula/pipeline verification script (throwaway, this stack has no pytest infra)   | **38/38 checks passed**                                                                                                                                                                                  |
| Phase 1 — `python -m py_compile`                                                             | Clean                                                                                                                                                                                                    |
| Phase 2 — `railway-gateway` unit + contract (`npm test`)                                     | **3/3 suites · 52/52 tests**                                                                                                                                                                             |
| Phase 2 — `railway-gateway` e2e (`npm run test:e2e`)                                         | **4/4 suites · 40/40 tests** (12 new for this lane)                                                                                                                                                      |
| Phase 2/3 — `npx tsc --noEmit` (`railway-gateway` + monolith)                                | Clean throughout                                                                                                                                                                                         |
| Phase 3/4 — monolith full suite, run after Phase 3                                           | **185/185 suites · 2550/2550 tests**                                                                                                                                                                     |
| Phase 3/4 — monolith full suite, run after Phase 4                                           | **187/187 suites · 2563/2563 tests**                                                                                                                                                                     |
| Post-commit — monolith full suite, run after all 4 commits + pre-commit-hook auto-formatting | **187/187 suites · 2563/2563 tests** — identical to the pre-commit numbers, confirming the hooks' `eslint --fix`/`prettier --write` passes were purely cosmetic                                          |
| ESLint — monolith                                                                            | Clean on every changed/new file                                                                                                                                                                          |
| ESLint — `railway-gateway`                                                                   | Reproduces the pre-existing `LESSONS-LEARNED.md` L38 break (the package has no ESLint config file of its own at all) — confirmed unrelated to this session; `tsc --noEmit` is the real static gate there |
| `npx prisma validate` (monolith schema)                                                      | Clean                                                                                                                                                                                                    |

Zero regressions at every checkpoint — each phase's full-suite run matched the prior baseline plus
exactly that phase's own new suites/tests, nothing else moved.

---

## 4. Live browser verification

Started the real dev server (`next dev`, Turbopack) and drove it directly rather than relying on
unit tests alone for the widget's visual behavior:

- **Empty state (no live VPS data yet):** `GET /api/market/currency-gold-indices` returns
  `{"indices":[]}` cleanly, and the widget renders **nothing** on the landing page — no broken or
  placeholder card — confirming the full route → cache → query → widget chain works end to end even
  before Phase 5 puts real data behind it.
- **With data (temporarily injected mock rows directly into the route handler, screenshotted, then
  reverted — confirmed via a clean `git diff`, never committed):** the 4-visible/scroll-for-5
  container scrolls correctly; hovering a row's symbol/name shows the full Radix tooltip with the
  correct definition + trading-edge copy (verified on `AUDX` → "AUD Index"); dark mode toggled live
  and the card background, text, and sparkline colors all adapted correctly.
- The one console warning present throughout (`allowTransparency` prop) was confirmed pre-existing
  and unrelated — traced to `components/landing/ticker-tape.tsx`'s own TradingView embed, untouched
  by this session.

---

## 5. Phase 5 — Live VPS Deployment & End-to-End Verification

**Status: NOT STARTED.** This is the architecture doc's own final phase ("Verification &
End-to-End Testing"), and every item in it requires physical actions on the Contabo/Vultr Windows
VPS that this Executor has no access to — the same "Executor has no VPS/MetaEditor access"
boundary every prior session in this repo's history has hit for physical deployment steps.

### 5.1 What Davin needs to do

**Updated 2026-09-11, post-push — two of the five original items turned out to already be done.**
Both `railway-gateway` and the monolith auto-deploy from a push to `origin/main` (confirmed, not
assumed — see the live checks below), so the 5-commit push in §6 shipped both automatically within
minutes, with no separate deploy step needed. **Only the 3 physical VPS/database items remain.**

- [x] **Deploy the `railway-gateway` changes** — **CONFIRMED LIVE.** An unauthenticated
      `POST https://railway-gateway-production-3796.up.railway.app/api/v1/currency-gold-indices`
      returned `401 {"message":"Missing authorization header"}` rather than `404` — this only
      happens if `CurrencyGoldIndicesController` and its `ApiKeyGuard` are genuinely registered in
      the running production process. The health endpoint's `uptime` (~9 minutes at check time)
      is consistent with a fresh auto-deploy from the push.
- [x] **Deploy the monolith changes** — **CONFIRMED LIVE.**
      `GET https://davintrade.app/api/market/currency-gold-indices` returns `{"indices":[]}` — the
      correct empty-state shape (see §1.3), not a 404. The public landing page is already serving
      Phase 3/4's code; it has nothing to display only because the 3 items below haven't happened
      yet, not because of any missing deploy step.
- [ ] **Apply the Postgres migration** — `20260911120000_add_currency_gold_indices` (authored,
      not applied). This is why the routes above return empty rather than real data: the table
      doesn't exist in production yet, so `getCurrencyGoldIndexSnapshots()` catches a
      `relation "currency_gold_indices" does not exist` error and degrades to `[]` (§1.3's
      designed fallback, not an error state). Confirm which database is genuinely production
      first — this repo's own history (`CLAUDE.md`'s 2026-09-01/2026-09-09 entries) documents real
      prior confusion between a same-named "staging" project and the actual production database;
      do not assume from a connection string alone.
- [ ] **Attach the exporter to 8 independent MT5 charts** — `EURUSD`, `USDJPY`, `GBPUSD`,
      `AUDUSD`, `NZDUSD`, `USDCAD`, `USDCHF`, and a dedicated `XAUUSD` chart, all M5, all running
      the existing, already-compiled `ohlcvexportlightweight_v2_29.mq5` with its default
      `InpBaseFileName = "OHLCV"`. No new MQL5 authoring or MetaEditor compile is needed for
      this step — it is pure chart attachment.
- [ ] **Register the engine as a Windows service** — run
      `install_currency_gold_index_engine_service.bat` from an elevated cmd on the VPS (edit its
      `CONFIG` block first: `BACKFILL_API_KEY`, `API_GATEWAY_URL`). This is a standalone script,
      safe to run independently of `install_services.bat` — see §2's note on why it was built
      separately. Do this AFTER the migration is applied and the charts are attached, since the
      engine will start attempting pushes as soon as it runs.

### 5.2 What needs live verification once the above is done

- [ ] **Isolation, under real load:** confirm a Lane 4 engine restart/failure genuinely has zero
      effect on Lane 1 (XAUUSD alerts) — the architecture guarantees this by construction (separate
      process, separate database file, separate input files), but has never been observed live.
- [ ] **Formula correctness against real market data** — Phase 1's 38-check verification used
      synthetic fixtures; no real MT5 export has ever been fed through the engine. In particular,
      confirm the session-open detection lands on the correct bar at both the FX (00:00) and gold
      (01:01) boundaries, including through an actual DST transition if the deployment window
      permits observing one.
- [ ] **The full push → gateway → Postgres → cache → API → widget round trip** with real numbers —
      confirm `value`/`change_pct` genuinely hover near 100/0 as expected, and that
      `session_open_bar_time` resets correctly at rollover.
- [ ] **Mobile-viewport click-through** — the widget's CSS is responsive by construction (a plain
      flex/scroll list), but was not specifically screenshotted at a narrow viewport during Phases
      1–4.
- [ ] **A cache-TTL sanity check under real traffic** — confirm the 60s Redis TTL keeps Postgres
      load negligible once the landing page is receiving genuine anonymous traffic, not just the
      zero-traffic dev-server check this session performed.

### 5.3 Deliberately out of scope, not deferred by oversight

- **`forex_ohlcv_m5`** (raw per-pair OHLCV storage, spec §6.1) — the landing-page widget only needs
  the 9 computed index values; raw-pair storage is listed in the spec purely as future substrate
  for the roadmap's PRO 32-pair screener (§9), which itself is explicitly a future phase, not part
  of Phase 5.
- **The PRO 32-pair Strongest-vs-Weakest screener** (spec §9) — depends on `forex_ohlcv_m5` above;
  a distinct, larger feature for its own future session.

---

## 6. Git history

Landed as 5 scoped commits on `main`, then pushed to `origin/main`:

| Commit     | Summary                                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| `b6e43625` | `feat(currency-index): Lane 4 VPS math engine + gateway contract` — Phase 1                               |
| `8ad913fc` | `feat(currency-index): NestJS gateway endpoint + Postgres schema` — Phase 2                               |
| `7582d660` | `feat(currency-index): Redis cache + public API route` — Phase 3                                          |
| `bffd867b` | `feat(currency-index): landing-page Hero widget` — Phase 4                                                |
| _pending_  | `docs(ad-hoc): record Currency & Gold Index Stack work-completion manifest` — this document + `CLAUDE.md` |

Each of the 4 feature commits triggered this repo's pre-commit hook (`lint-staged`:
`eslint --fix` + `prettier --write` on every staged file), which applied only cosmetic
formatting/import-order changes — confirmed via the full test suite passing unchanged after each
commit.

---

## 7. Explicitly out of scope

- **Any live VPS action** — see §5.
- **`frontend/` (SEPARATE_STACK)** — per `EXECUTOR-PROTOCOL.md` §5 this tree is out of scope for
  this migration entirely and was not touched; it has no currency-index feature of its own to
  mirror.
- **Full dictionary-parity translation** of the 27 new Lane 4 strings into `fr`/`ko`/`zh`/`ar`/etc.
  — identity-mapped in `en-US`/`en-GB` only, matching this repo's established precedent for
  newly-added marketing copy (degrades to English elsewhere rather than breaking).
- **`docs/policies/*` updates** — no existing policy document names this lane; none was edited.
- **Fixing the `railway-gateway` ESLint config gap** (§3) — a real, but pre-existing and unrelated,
  gap; flagged, not fixed, per scope discipline.
