# Migration Order — Session 10-2 — Drawing Engine & Line-Alert e2e + API Coverage

> Read `00-SKELETON-AND-RULES.md` first — §4 applies. **Creativity dial: Medium** (mixes
> automated test infrastructure with verification coverage; the objective is durable, repeatable
> automated CI test proof for the drawing engine, line alerts, and realtime alert delivery).
> **PRE-DRAFTed by the Executor at Session 10-1's close (2026-08-23)**, upgraded to **DRAFT by the
> Advisor / Antigravity (2026-08-23)** per `MASTER-ROADMAP-PHASES-7-15.md` §3 and `00-SKELETON-AND-RULES.md`.

**Session:** 10-2 · **Phase:** 10 (Drawing Engine & Line-Alert Closure) · **Variant:** VERIFY (with scoped bugfix) · **Status:** CONFIRMED  
**Generated:** 2026-08-23 (Executor, PRE-DRAFT) · **Upgraded to DRAFT:** 2026-08-23 (Advisor / Antigravity) · **Approved:** 2026-08-23 (Davin) · **Confirmed:** 2026-08-23 (Executor, live code + runtime re-verified; DRAFT/APPROVED working-copy content confirmed authentic by Davin live per L3; ⚠ chart-marker scope-narrowing sign-off obtained live, separate from general approval)  
**Flags touched:** F82 (orphaned `Alert` row on `Drawing` deletion — resolved inline in Decisions taken below).  
**Estimated time:** ~2–3h (Playwright e2e setup, Newman collection authoring, inline F82 cascade fix, full test execution).  
**Target components:** `e2e/playwright.config.ts`, `e2e/tests/drawing-line-alerts.spec.ts`, `postman/collections/drawing-line-alerts.postman_collection.json`, `operation-service/src/drawings/drawings.service.ts`, `app/api/drawings/[id]/route.ts`.

---

## Decisions taken

> Four technical choices taken by the Advisor per `00-SKELETON-AND-RULES.md` §1.0 & `DECISION-LOG.md` PD1.
> Resolves all open questions raised in the PRE-DRAFT.

1. **Playwright e2e Scope & Assertion Strategy (Open Question 1)**
   - **Chosen:** Author a clean, dedicated Playwright spec `e2e/tests/drawing-line-alerts.spec.ts` targeting `/terminal` for the complete end-to-end journey:
     1. Authenticate as `pro-test@trading-alerts.test` (PRO tier required for line alerts).
     2. Navigate to `/terminal`.
     3. Create an `HLINE` drawing on `XAUUSD`/`M5` at price `2000.0` and attach a `PRICE_TOUCH_LINE` alert via the UI / API.
     4. Trigger deterministic price cross via synthetic Redis publish (`prices:XAUUSD:M5`).
     5. Assert live Toast notification appears in the browser DOM (`expect(page.getByText(...)).toBeVisible()`).
     6. Assert notification unread count updates in `AppHeader`.
     7. Capture and assert WebSocket frame delivery for both `notification` and `alert_fired` events in browser context.
   - **Rejected:** Requiring an active external Windows MetaTrader 5 broker terminal connection for live OHLCV candle streaming in headless CI, or reducing assertions to pure backend DB checks.
   - **Why:** Delivers 100% deterministic, automated browser verification on the live Next.js 16 UI and `operation-service` WebSocket connection without external broker flakiness or market-session constraints.
   - **How hard to undo:** Non-destructive test suite.
   - **⚠ NEEDS EXPLICIT SIGN-OFF, obtained live at CONFIRM (2026-08-23):** this scope silently omits a live chart-marker DOM assertion despite the roadmap's own stated 10-2 criterion being `toast + chart marker` — the same gap Session 10-1 raised as its own Open Question 1, where Davin already accepted reduced (WS-delivery-only) evidence as sufficient. `mt5-service`'s OHLCV feed (required for `/terminal` to have a candle series to place a marker onto) remains out of scope (`EXECUTOR-PROTOCOL.md` §5, SEPARATE_STACK). Davin confirmed live at this session's CONFIRM: scope the Playwright assertions to Toast UI + Notification-count badge + WebSocket frames (`notification` & `alert_fired`) only; canvas marker rendering is covered by its own existing unit tests (`__tests__/drawing/firedMarkers.test.ts`), not by this e2e spec.

2. **Alert Delivery Channel Scope: In-App & Realtime vs. Outbound Email (Open Question 2)**
   - **Chosen:** Scope alert firing verification strictly to **in-app Notification DB record + real-time Socket.IO push (toast & marker)**.
   - **Rejected:** Expecting or asserting outbound email delivery via Resend for line-touch alerts.
   - **Why:** `PRICE_TOUCH_LINE` alerts in `operation-service/src/alert-engine/dispatcher.service.ts` are designed specifically as real-time, low-latency in-app socket pushes + notification bell entries. Email dispatch is reserved for auth flows (email verification, 2FA, password resets) and transactional billing, not high-frequency chart line touches.
   - **How hard to undo:** Pure scoping specification; non-destructive.

3. **Inline Resolution of F82 (Orphaned Alert Row on Drawing Delete) (Open Question 3)**
   - **Chosen:** **Fix F82 inline** in `operation-service/src/drawings/drawings.service.ts` (`remove`) and monolith `app/api/drawings/[id]/route.ts`. When a `Drawing` is deleted, query its associated `DrawingAlert` records and delete their backing `Alert` rows (`where: { id: { in: alertIds } }`) in the same operation. Add explicit Newman assertions verifying zero orphaned `Alert` rows remain after drawing deletion.
   - **Rejected:** Leaving F82 open and asserting buggy orphan behavior in Newman tests.
   - **Why:** The fix is surgical (~5 lines), eliminates permanent database leakage, carries zero auth/money risk, and is directly validated by this session's own Newman suite.
   - **How hard to undo:** Trivial — standard Prisma deletion logic.

4. **Newman API Test Automation & Collection Structure (Open Question 4)**
   - **Chosen:** Author `postman/collections/drawing-line-alerts.postman_collection.json` and add npm script `"test:api:drawings": "newman run postman/collections/drawing-line-alerts.postman_collection.json -e postman/environments/local.postman_environment.json"`. Cover the full CRUD lifecycle for `/api/drawings` and `/api/alerts/line`, with authentication via NextAuth cookie / bearer token.
   - **Rejected:** Embedding drawing tests inside existing monolithic collection without isolated script runner, or relying on manual Postman GUI runs.
   - **Why:** Enables repeatable, single-command API regression testing in local development and CI pipelines.
   - **How hard to undo:** Non-destructive test artifact.

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §3:
"10-2 — e2e + API coverage (VERIFY). Playwright `draw → attach alert → price crosses → fire → toast + chart marker`, on the Phase 9 terminal. Newman coverage for `/api/drawings` and `/api/alerts/line`."

Session 10-1 proved the cross-process pipeline (`mt5-service` publisher → Redis `prices:*` → `operation-service-worker` evaluation → Postgres `Notification` + Redis `alerts:fired` → `RealtimeGateway` → Browser Socket.IO) live by hand once. This session transforms that proof into **automated, repeatable regression test suites** (Playwright e2e + Newman API tests) that run in CI and protect the drawing engine against future regressions.

---

## Entry criteria (re-verify all at CONFIRM)

- [x] **Session 10-1 CLOSED SUCCESSFUL** — F67 resolved, all 4 Invariant Proofs verified live (`10-1-drawing-alert-smoke.migration-order.md`). Re-verified: F67 RESOLVED entry present in `DECISION-LOG.md`.
- [x] **Playwright and Newman tooling verified** — `@playwright/test` (^1.40.0) and `newman` (^6.2.2) present in `package.json`. **CONFIRM finding:** `e2e/playwright.config.ts` does NOT exist (only `e2e/archive/playwright.config.ts` does) — root `package.json`'s existing `test:e2e*` scripts are currently broken on this missing path. Step 3 must create it fresh, not "ensure/configure" an existing one. Davin acknowledged live at CONFIRM.
- [x] **`operation-service` HTTP + worker processes runnable** — static build confirmed present (`operation-service/dist/main.js`, `main-worker.js`).
- [x] **`operation-service/.env` configured** — all 5 required vars confirmed present (values not re-checked into any output per L4).
- [x] **CSP `connect-src` verified** — `next.config.js:131` includes `http://localhost:3001` and `ws://localhost:3001`.
- [x] **Baseline test suites 100% green**: re-run fresh at CONFIRM — Monolith `test:ci` 153/153 suites/2198/2198 tests; `operation-service` 42/42/393/393; `money-service` 62/62/526/526. Exact match, zero drift since 10-1 close.

---

## Ordered steps

_(each step = change → immediate verification → rollback note)_

### 1. Fix F82 Drawing-Alert Cascade Deletion

- **Action:** In `operation-service/src/drawings/drawings.service.ts` (`remove` method) and monolith `app/api/drawings/[id]/route.ts` (`DELETE` handler):
  1. Before deleting the drawing, retrieve all associated `DrawingAlert` records:
     `const drawingAlerts = await this.prisma.drawingAlert.findMany({ where: { drawingId: id }, select: { alertId: true } });`
  2. Delete the drawing (which cascades `DrawingAlert` join rows):
     `await this.prisma.drawing.delete({ where: { id } });`
  3. Delete the backing `Alert` rows:
     `if (drawingAlerts.length > 0) { await this.prisma.alert.deleteMany({ where: { id: { in: drawingAlerts.map(a => a.alertId) } } }); }`
- **Verify:**
  - Create a drawing, attach a line alert, delete the drawing via API.
  - Query database: verify `Drawing`, `DrawingAlert`, AND `Alert` rows for this drawing are all deleted (zero orphaned rows).
  - Run `operation-service` unit tests: `npm test` remains 100% green (42/42 suites).
- **Rollback:** Revert modifications to `drawings.service.ts` and `app/api/drawings/[id]/route.ts`.

### 2. Author and Run Newman API Collection

- **Action:** Create `postman/collections/drawing-line-alerts.postman_collection.json` containing requests:
  1. `GET /api/drawings` (list user drawings, filter by `symbol=XAUUSD&timeframe=M5`).
  2. `POST /api/drawings` (create `HLINE` drawing at `price: 2000.0`).
  3. `PATCH /api/drawings/:id` (update drawing anchors / style).
  4. `GET /api/alerts/line` (list user line alerts).
  5. `POST /api/alerts/line` (attach line alert to created drawing).
  6. `PATCH /api/alerts/line/:id` (update line alert parameters).
  7. `DELETE /api/drawings/:id` (delete drawing, verify F82 clean cascade).
  8. `DELETE /api/alerts/line/:id` (delete standalone line alert).
     Add npm script `"test:api:drawings"` to `package.json`.
- **Verify:**
  - Run `npm run test:api:drawings`.
  - All assertions pass with 200/201 status codes, valid response schemas, and verified deletion counts.
- **Rollback:** Remove `postman/collections/drawing-line-alerts.postman_collection.json` and package.json script.

### 3. Configure Playwright for Next.js 16 / Terminal Testing

- **Action:** Ensure `e2e/playwright.config.ts` is configured for the local environment:
  - Base URL `http://localhost:3000`.
  - Web server setup pointing to `next dev` (or running against already-started servers).
  - Timeout and retry configurations suitable for CI.
- **Verify:**
  - Run `npx playwright test --version` and verify Playwright executes cleanly.
- **Rollback:** Revert config changes.

### 4. Author Playwright e2e Spec for Line Alert Journey

- **Action:** Create `e2e/tests/drawing-line-alerts.spec.ts`:
  1. Login as `pro-test@trading-alerts.test` using `auth.fixture` or direct login helper.
  2. Navigate to `/terminal`.
  3. Create an `HLINE` drawing at price `2000.0` on `XAUUSD`/`M5` and attach a line alert.
  4. Listen for Socket.IO `notification` and `alert_fired` events in page context.
  5. Trigger synthetic price crossing via Redis publish (`prices:XAUUSD:M5`, cross 2000.0).
  6. Assert Toast notification renders with title `"XAUUSD M5 alert"` and body `"Price ... touched line @ 2000"`.
  7. Assert notification badge in `AppHeader` increments.
  8. Clean up created drawing fixture.
- **Verify:**
  - Run `npx playwright test e2e/tests/drawing-line-alerts.spec.ts`.
  - Playwright completes all steps green with 0 failures.
- **Rollback:** Remove `e2e/tests/drawing-line-alerts.spec.ts`.

### 5. Execute Full Regression Baselines

- **Action:** Run all test suites across the monorepo:
  - Monolith `npm run test:ci`
  - `operation-service` `npm test`
  - `money-service` `npm test`
  - `npm run test:api:drawings`
  - `npx playwright test e2e/tests/drawing-line-alerts.spec.ts`
- **Verify:** All suites pass 100% green. Zero regressions.
- **Rollback:** None.

---

## Rules specific to this variant

- **No flakiness:** Playwright tests must use explicit web-first assertions (`toBeVisible()`, `toHaveText()`) with proper timeouts, never arbitrary `sleep` calls.
- **Fixture cleanup:** Every test run must clean up created drawings and alerts on completion (in `afterEach` / `finally` blocks).
- **Environment isolation:** Use dedicated test accounts (`pro-test@trading-alerts.test`); do not mutate production data.

---

## Done when

- [ ] **F82 resolved** and verified: deleting a drawing cleanly deletes all associated `Alert` rows without orphaned records.
- [ ] **Newman API collection** (`postman/collections/drawing-line-alerts.postman_collection.json`) created and passing 100% via `npm run test:api:drawings`.
- [ ] **Playwright e2e test** (`e2e/tests/drawing-line-alerts.spec.ts`) passing 100% on `/terminal` (`draw → attach alert → price crosses → fire → toast + realtime delivery`).
- [ ] **Baseline test suites 100% green**: Monolith `test:ci`, `operation-service`, `money-service`.
- [ ] `DECISION-LOG.md` updated marking F82 RESOLVED.

---

## Rollback

- Revert changes to `operation-service/src/drawings/drawings.service.ts` and `app/api/drawings/[id]/route.ts`.
- Delete newly created test files in `e2e/tests/` and `postman/collections/`.
- Revert `package.json` script addition.

---

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->

---

## Next-session handoff

- **Next session:** `10-3` — Blueprint reconciliation & close (VERIFY-RETIRE): rewrite the drawing-engine blueprint's stale monolith-era status callouts to describe the `operation-service` reality, fold `implementation-progress-files-and-folder-directory.md` into `migration-stack-analysis.md`, and write Phase 11's handover prompt (`HANDOVER-PROMPT-phase-11.md`).
- **Prerequisite:** Session 10-2 CLOSED SUCCESSFUL.
