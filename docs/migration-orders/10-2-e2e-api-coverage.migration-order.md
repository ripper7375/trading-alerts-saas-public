# Migration Order — Session 10-2 — Drawing Engine & Line-Alert e2e + API Coverage

> Read `00-SKELETON-AND-RULES.md` first — §4 applies. **Creativity dial: Medium** (no named
> single-purpose template fits exactly — this mixes INFRA (Playwright/Newman tooling, if not
> already present) and VERIFY (the actual coverage checks); per `00-SKELETON-AND-RULES.md` §2,
> "use the dominant variant and borrow sections," left for the Advisor to finalize at DRAFT).
> **PRE-DRAFTed by the Executor at Session 10-1's close (2026-08-23)**, per
> `MASTER-ROADMAP-PHASES-7-15.md` §3.

**Session:** 10-2 · **Phase:** 10 (Drawing Engine & Line-Alert Closure) · **Variant:** INFRA/VERIFY (tentative — Advisor to confirm) · **Status:** PRE-DRAFT
**Generated:** 2026-08-23 (Executor, at Session 10-1's close) · **Flags touched:** none identified yet — see Open questions for the Advisor below.
**Estimated time:** unknown — depends on whether Playwright/Newman are already configured in this repo (not checked this session; scope discovery is this order's own first step).

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §3: "10-2 — e2e + API coverage (VERIFY). Playwright
`draw → attach alert → price crosses → fire → toast + chart marker + email`, on the Phase 9
terminal. Newman coverage for `/api/drawings` and `/api/alerts/line`." Session 10-1 proved the
cross-process chain live, by hand, once; this session's job is to make that proof **repeatable and
automated** — a real e2e test a CI run (or a future session) can re-execute, not a one-off manual
verification that dies with the transcript. The only prior alert e2e test
(`e2e/archive/tests/path7-alert-notifications.spec.ts`) is archived and covers the older generic
alert flow, not line-touch/drawing alerts.

---

## Entry criteria (re-verify all at CONFIRM)

- [ ] **Session 10-1 CLOSED SUCCESSFUL** — F67 resolved, all 4 Invariant Proofs verified live
      (`10-1-drawing-alert-smoke.migration-order.md`).
- [ ] **Playwright and Newman tooling present and runnable** — NOT verified this session; check
      `package.json` for `@playwright/test` / `newman`, and whether `e2e/` has a working config
      (`playwright.config.ts`) distinct from the archived `e2e/archive/` tests.
- [ ] **`operation-service` HTTP + worker processes bootable** — proven in 10-1 via static
      `node dist/main` + `node dist/main-worker` (do NOT run `start:dev` concurrently with
      `start:worker` — 10-1 Deviation 1: `nest-cli.json`'s `deleteOutDir: true` races the two).
      `operation-service/.env` created ad-hoc in 10-1 (gitignored, not committed) — recreate from
      root `.env.local`'s `DATABASE_URL`/`REDIS_URL`/`NEXTAUTH_SECRET`/`NEXTAUTH_URL`/
      `TWO_FACTOR_ENCRYPTION_KEY`/`RESEND_API_KEY` per `LESSONS-LEARNED.md` L42, never printing
      values (L4).
- [ ] **CSP `connect-src` includes the local operation-service origin** — fixed permanently in
      10-1 (`next.config.js`, commit `c7842f9b`); confirm it's still present, not reverted.
- [ ] **`market_data_v6` table absent locally** (found in 10-1, unrelated to line alerts — the
      legacy cron-based `AlertCheckerService` errors on every run in this dev DB). Does NOT block
      line-alert e2e (that path is Redis-price-event-driven, not `market_data_v6`-driven), but the
      Playwright run's console/log capture should not treat this pre-existing noise as a new
      failure.
- [ ] **Baseline test suites 100% green**: Monolith `test:ci` 153/153 suites/2198/2198 tests,
      `operation-service` 42/42/393/393, money-service 62/62/526/526 (10-1's own closing baseline —
      re-verify fresh, don't trust this number if any source has changed since).

---

## Open questions for the Advisor (resolve in `Decisions taken` at DRAFT)

1. **The chart-marker visual gap directly blocks this session's own stated e2e journey.** The
   roadmap's own success criterion is `... fire → toast + chart marker + email`. Session 10-1 found
   that `/terminal`'s OHLCV candlestick feed depends on `mt5-service`'s own Flask-SocketIO server
   (`ws://localhost:5001`), never started in either session — with no candle data loaded, there is
   no chart series for `useFiredAlertMarkers` to mount a marker onto, regardless of whether the
   alert-fired WS message arrives. Davin accepted reduced (WS-delivery-only) evidence for 10-1's own
   manual proof — but a Playwright **assertion** needs a concrete, checkable condition. Options:
   (a) stand up `mt5-service`'s Flask/SocketIO server for real (blocked in 10-1's sandbox by no live
   MT5 terminal connection — may or may not be blocked here too, untested), (b) mock/stub the OHLCV
   feed with synthetic candle data so a marker has something to render onto, (c) assert only on the
   toast/notification-delivery side and treat the chart-marker DOM assertion as a separate, disabled
   or skipped test with a tracking note. `⚠ NEEDS EXPLICIT SIGN-OFF` if (a) requires new
   infrastructure/credentials.
2. **Does the "email" leg of the journey have a real send path to assert against in test mode?**
   Not checked this session — grep for where `Notification`/alert-fire delivery might also trigger
   an email (Resend), and whether a test-mode capture mechanism (e.g., a fake inbox, or a DB-side
   "email queued" row) already exists, or whether this needs its own scoping decision.
3. **F82 (registered `DECISION-LOG.md`, Session 10-1)** — `DELETE /api/drawings/:id` leaves an
   orphaned `Alert` row behind (only `DrawingAlert` cascades, not `Alert` itself). This session's
   own Newman coverage for `/api/drawings` is the natural place to assert this with a real check
   (create → delete → assert zero `Alert` rows remain) — decide whether this session ALSO fixes F82
   inline (small, well-scoped, non-money/non-auth) or only asserts/documents the current (buggy)
   behavior and defers the fix to a dedicated PORT session. Precedent: `EXECUTOR-PROTOCOL.md`
   permits fixing a "genuine defect discovered during" a verification session when it's this
   narrowly scoped — Advisor's call.
4. **Test-fixture strategy** — 10-1 used `pro-test@trading-alerts.test` (line alerts are
   PRO-exclusive) and a deterministic synthetic Redis publisher (`prices:XAUUSD:M5`,
   Davin-approved for 10-1). Confirm the same approach is intended for the automated Playwright
   run (a real login flow + real API calls, not mocked), and whether Newman needs its own separate
   test-user/token strategy distinct from Playwright's browser-driven login.

---

## Rules specific to this variant

- **No drive-by fixes to F82** without the Advisor's explicit go-ahead (see Open Question 3) — if
  left un-fixed, the Newman suite must assert the CURRENT (buggy) behavior honestly, not silently
  work around it.
- **Reuse 10-1's environment setup, don't re-derive it** — `operation-service` static-build boot
  sequence, CSP fix, and `.env` reconstruction are all already solved; this session should cite
  them, not re-diagnose.
- Apply `LESSONS-LEARNED.md` L24's recurrence (10-1): running Playwright/Newman concurrently with
  other heavy local processes against the same shared pooled dev Postgres can produce a real,
  reproducible `P2028` transaction-timeout — not a code defect. If hit, reduce concurrent load and
  retry before treating it as a regression.

---

## Done when

- [ ] Playwright e2e spec exists and passes: draw a line → attach an alert → (deterministic)
      price crosses → fire → toast/notification appears (chart-marker and email legs per the
      Advisor's resolution of Open Questions 1–2).
- [ ] Newman collection covers `/api/drawings` and `/api/alerts/line` (create, list, update,
      delete — including an explicit assertion for F82's current behavior, per Open Question 3).
- [ ] Full baseline test suites still green (monolith `test:ci`, `operation-service`,
      money-service).
- [ ] `DECISION-LOG.md` and `LESSONS-LEARNED.md` updated for anything found.

---

## Rollback

- Delete/revert any new test files if the suite can't be made to pass within this session's
  budget — do not merge a flaky or falsely-green e2e test.
- Stop any `operation-service`/`mt5-service` processes started for this session.

---

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->

---

## Next-session handoff

- **Next session:** `10-3` — Blueprint reconciliation & close (VERIFY-RETIRE): rewrite the drawing-
  engine blueprint's stale monolith-era status callouts to describe the `operation-service` reality,
  fold `implementation-progress-files-and-folder-directory.md` into `migration-stack-analysis.md`.
  Per `MASTER-ROADMAP-PHASES-7-15.md` §3, **10-3 also writes Phase 11's own handover prompt**
  (`docs/migration-orders/davin-operational-manual/antigravity/HANDOVER-PROMPT-phase-11.md`).
- **Prerequisite:** Session 10-2 CLOSED SUCCESSFUL.
