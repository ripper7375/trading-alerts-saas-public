# Migration Order — VERIFY/RETIRE variant

> For **cutovers, deletions, and exit reviews**: every CUTOVER session. Read `00-SKELETON-AND-RULES.md` first —
> §4 applies with the dial at **near zero**: checklists exist to be obeyed. Keep this order SHORT.
> Fast-path enabled: `PRE-DRAFT → APPROVED → CONFIRMED`.

**Session:** 4A-10 (CUTOVER) · **Variant:** VERIFY-RETIRE · **Status:** PRE-DRAFT
**Generated:** 2026-07-27 (Advisor) · **Finalized:** 2026-07-27 (Executor, at Davin's live
direction) — Entry Criterion 1 and Checklist Step 1 reframed from "mirror-run/shadow-log" to
"code-freeze soak window": no shadow-traffic mechanism exists for Slice 4 (verified: zero
references to money-service/any `MIGRATE_WRITE_APIS_MONEY_*` flag in the 5 monolith write routes
or anywhere in code), so a literal "mirror-run" claim would report 48h of silence as a clean
diff. Matches Slice 3's own F44 precedent. · **Estimated time:** <1h
**Phase / plan section:** Phase 4A — money-service · Slice 4 Cutover (Write APIs)
**Ground truth:** `4a-9-money-service-write-apis-port.migration-order.md`, `migration-cutover-table.md` (Slice 4).
**Flags touched:** `MIGRATE_WRITE_APIS_MONEY_STRIPE`, `MIGRATE_WRITE_APIS_MONEY_DLOCAL`, `MIGRATE_WRITE_APIS_MONEY_ADMIN`, `MIGRATE_WRITE_APIS_MONEY_DISBURSEMENT`
**Contract:** Zero code edits in this session — feature flag flips only, executed per-endpoint-group with Davin present.

---

## Entry criteria

- [ ] **Entry criterion 0 (CRITICAL, HARD-BLOCKING — found while finalizing this PRE-DRAFT,
      2026-07-27):** Checklist Step 3 ("Flip Feature Flags") is currently a silent no-op. Verified
      live: none of the 5 monolith write routes (`app/api/checkout/route.ts`,
      `app/api/payments/dlocal/create/route.ts`, `app/api/subscription/cancel/route.ts`,
      `app/api/admin/affiliates/[id]/distribute-codes/route.ts`,
      `app/api/disbursement/batches/[batchId]/execute/route.ts`) contain ANY flag check or
      forwarding call to money-service — `lib/money-service/routes.ts` and `flags.ts` (built 4A-7a
      for Slice 3's READ APIs) have zero write-route wrappers for Stripe/dLocal/admin/
      disbursement, and `grep`ing the whole monolith for `MIGRATE_WRITE_APIS_MONEY` returns zero
      matches anywhere. Flipping any of these 4 flags to `true` in Railway right now would change
      NOTHING — the monolith routes would keep executing their existing Prisma logic
      unconditionally, 100% of the time, exactly as 4A-W7's own Waiting-on #54 found for
      `DISBURSEMENT_PROVIDER=WISE` before that gap was closed. **This order cannot proceed past
      this criterion.** A new BUILD session (PORT or CONTRACT+small-INFRA, mirroring 4A-7a's own
      scope for Slice 3: a monolith-side `lib/money-service/write-routes.ts`-equivalent transport + a `MIGRATE_WRITE_APIS_MONEY_*`-keyed flag check wired into all 5 existing route handlers)
      must ship and be CONFIRMED before 4A-10 can execute — VERIFY-RETIRE's own "near zero"
      creativity dial (Rules: "No new code edits, no refactoring, no fixes") forbids building this
      transport layer inside 4A-10 itself.
- [ ] **48h code-freeze SOAK window elapsed clean (Started: 2026-07-27 12:52 UTC · Ends:
      2026-07-29 12:52 UTC) — NOT a mirror-run/shadow-diff.** Re-verified at this PRE-DRAFT's
      finalization (2026-07-27): zero references to `money-service`, `MONEY_SERVICE_URL`, or any
      `MIGRATE_WRITE_APIS_MONEY_*` flag exist in any of the 5 monolith write routes, or anywhere
      else in `lib/`/`app/`/`money-service/src/` — no flag is read by any code yet, and no
      shadow-call/duplication wiring exists. 4A-9 was BUILD ONLY (zero traffic, no URL change, no
      flag flip); nothing routes real requests to the new money-service controllers during this
      window, so there is no traffic to diff and no log volume to review — calling it a
      "mirror-run" would report 48h of silence as "clean" for the wrong reason (same failure
      shape as `LESSONS-LEARNED.md` L18: a route with zero requests was never exercised, not
      proven correct). Reframed at Davin's explicit direction to match Slice 3's own F44
      precedent (no real shadow-run infra exists in this repo, F34/CC-A gap) — this window is a
      calendar/CC-F-freeze buffer only. The real quality gate is `money-service`'s full test
      suite + `nest build`, re-verified green at CONFIRM (not assumed from 4A-9's close-out).
- [ ] Source files in monolith (`app/api/checkout/route.ts`, `app/api/payments/dlocal/create/route.ts`, `app/api/subscription/cancel/route.ts`, `app/api/admin/affiliates/[id]/distribute-codes/route.ts`, `app/api/disbursement/batches/[batchId]/execute/route.ts`) verified CC-F (change-frozen) — in effect since 4A-9's close per that order's own Rules section.
- [ ] `money-service` test suite 100% green (59/59 suites, 506/506 tests as of 4A-9's close — re-verify fresh at CONFIRM, don't assume).
- [ ] Davin present for live cutover authorization.

---

## Checklist (CUTOVER block)

1. **Confirm the 48h freeze/soak window held clean** — NOT a shadow-log review (no shadow-traffic
   mechanism exists for Slice 4, see Entry Criterion 1). Check: (a) no incidents on the
   monolith's still-live write paths during the window (they're CC-F frozen and unchanged,
   receiving 100% of real traffic exactly as before this whole migration); (b) `money-service`'s
   full test suite + `nest build` re-run clean right now, not assumed from 4A-9's close-out date.
2. **Davin Live Approval:** Davin explicitly approves flipping traffic for each endpoint group:
   - Group A: `MIGRATE_WRITE_APIS_MONEY_STRIPE=true`
   - Group B: `MIGRATE_WRITE_APIS_MONEY_DLOCAL=true`
   - Group C: `MIGRATE_WRITE_APIS_MONEY_ADMIN=true`
   - Group D: `MIGRATE_WRITE_APIS_MONEY_DISBURSEMENT=true`
3. **Flip Feature Flags:** Apply env variable flags in Railway production environment.
4. **Monitor Health:** Observe Railway logs and error rate for 15 minutes per group. Note: Transactional emails for PRO upgrades emit `OutboxEvent`s to `operation-service` (following 4A-5 dLocal precedent; Slice 5 / 4A-11 delivers email worker).
5. **Update Artifacts:** Update `migration-cutover-table.md` (Slice 4 → CUTOVER), `CLAUDE.md`, and `DECISION-LOG.md`.

- **Rollback:** Revert feature flags to `false` in Railway dashboard (0ms traffic revert back to monolith handlers).

---

## Rules specific to this variant

- No new code edits, no refactoring, no fixes. Observation and execution only.
- Any red result or unexplained error = abort immediately, revert flag, schedule investigation.

---

## Deviations

_(should normally be empty)_

---

## Next-session handoff

**Blocked on Entry Criterion 0** — the actual next session is a new BUILD session (transport
layer: monolith-side flag check + proxy forwarding for the 5 Slice 4 write routes, mirroring
4A-7a's own Slice-3 scope), not yet numbered/PRE-DRAFTed. 4A-10 itself stays PRE-DRAFT until that
session ships and is CONFIRMED. Session 4A-11 (Slice 5 / Outbox Email Worker Build) is unaffected
and can proceed independently once Davin decides ordering.
