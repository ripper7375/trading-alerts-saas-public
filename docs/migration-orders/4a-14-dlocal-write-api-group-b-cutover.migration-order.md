# Migration Order — Session 4A-14 — dLocal Write-API Group B Cutover (Slice 4 completion)

> For **cutovers, deletions, and exit reviews**: read `00-SKELETON-AND-RULES.md` first — §4
> applies. This session combines a small PORT-style fix (dial LOW) with a CUTOVER block (dial
> near zero) — mirrors the shape of Sessions 4A-10b/10c, the direct precedent for this exact flag
> and this exact bug. PRE-DRAFTed by the Executor at Session 4A-13's close (2026-08-21).
> Closes `DECISION-LOG.md` **F49** (OPEN) and completes `migration-cutover-table.md` Slice 4 to
> 4/4 write-API groups.

**Session:** 4A-14 (dLocal Write-API Group B Cutover) · **Variant:** PORT + CUTOVER · **Status:** PRE-DRAFT
**Generated:** 2026-08-21 (Executor, at Session 4A-13's close)
**Flags touched:** F49 (OPEN → target RESOLVED), `MIGRATE_WRITE_APIS_MONEY_DLOCAL` (`false` → `true`)
**Target service:** monolith `lib/dlocal/dlocal-payment.service.ts` + money-service
`money-service/src/dlocal/dlocal-payment.service.ts` (both sides — pre-existing bug, not
money-service-only)

---

## Decisions taken

<!-- The Advisor resolves the judgment calls below at DRAFT per `DECISION-LOG.md` PD1. Left
     deliberately unresolved in this PRE-DRAFT — same discipline as every recent PRE-DRAFT since
     the Phase 6 drift pattern: a Step 0 discovery pass belongs to the Advisor/DRAFT stage, not
     invented here from stale citations. -->

1. **What `payment_method_flow` value(s) this codebase actually needs** `⚠ NEEDS EXPLICIT SIGN-OFF`
   — dLocal's Payins API requires this field; the monolith's live payment-method selector supports
   more than one dLocal method (`TrueMoney`/`UPI`/`GoPay`-class wallet/bank-redirect methods per
   `DECISION-LOG.md` F49's own text). Needs a fresh read of `dlocal-payment.service.ts`'s current
   `createPayment` call site and whatever payment-method enum/type it already threads through,
   to determine whether this is a single hardcoded value (`"REDIRECT"`, most likely given the
   product only sells subscription checkout, not card-capture) or needs to vary per method.
2. **Fix monolith and money-service together, in one commit each, verified against a real dLocal
   sandbox call before flipping the flag** — not decided here, but flagged as the obviously
   correct shape given F48/F49's own history (dLocal bugs have consistently been pre-existing on
   both sides, byte-identical, and prior attempts to fix money-service alone without touching the
   monolith left the monolith's own native fallback path carrying the identical bug).

---

## Why this session exists

Slice 4 (Write APIs) has stood at 3/4 groups cut over since Session 4A-10b/10c (2026-07-30):
Stripe, Admin, and Disbursement are live; dLocal (Group B) is blocked. The blocking history is
itself instructive and must be re-read, not re-derived:

- **F48** (dLocal outbound signing wrong) — found and RESOLVED 4A-10c. Fixing it unmasked a
  second, previously-invisible bug (`400`, not `403` — the request finally reached dLocal's real
  payload-validation layer for the first time ever).
- **F49** (this session's target) — `payment_method_flow` is a required dLocal field that neither
  the monolith's nor money-service's `createPayment` request body has ever included, on either
  side, at any point in this migration or before it. Confirmed still absent in both files as of
  this PRE-DRAFT (`grep -rn payment_method_flow lib/dlocal/ money-service/src/dlocal/` → zero
  matches).

`MIGRATE_WRITE_APIS_MONEY_DLOCAL` remains `false` in production; the monolith's own native dLocal
route carries 100% of live dLocal payment-creation traffic today, with the identical F49 bug
(pre-existing, not migration-introduced) — meaning dLocal payment creation likely doesn't work
correctly today, on either side, independent of this migration. Fixing F49 is a genuine product
bug fix as much as a migration unblock.

**Independent of 4A-13's own open item.** This session does not depend on whether Davin has
decided to disable the Stripe webhook's monolith endpoint yet (4A-13's own trailing
recommendation) — dLocal and Stripe are unrelated payment paths.

---

## Entry criteria (draft — re-verify all at CONFIRM, per every prior session's own discipline)

- [ ] `DECISION-LOG.md` **F49** reviewed directly — confirm OPEN, scope unchanged, and re-read the
      full archived F48/F49 narrative in `history/decisions-archive.md` before touching anything.
- [ ] **Git drift check re-measured live**: `git log --oneline <4A-10c commit>..HEAD --
lib/dlocal/ money-service/src/dlocal/` — confirm nothing has changed either dLocal
      implementation since 4A-10c (2026-07-30) other than the still-absent `payment_method_flow`.
- [ ] **Live schema/API check**: dLocal's own current Payins API docs re-checked for
      `payment_method_flow`'s accepted values and whether it's still required — do not assume the
      2026-07-30 error message's requirement is unchanged 3+ weeks later.
- [ ] **Codebase test baselines re-measured**: monolith `tsc`/`eslint`/`test:ci`; money-service
      `test` — both sides, fresh, isolated (not run in parallel — see `LESSONS-LEARNED.md` L24).
- [ ] **The 4th orphaned `Payment` row** (`cms7hlmb900000fmpz9i9fv1q`, noted outstanding since
      4A-10c) — confirm Davin's cleanup status; re-verify via a direct read-only production query,
      not from memory.
- [ ] **Davin present and available** — dLocal write traffic is real money, same class as every
      other Slice 4 group cutover.
- [ ] **Sandbox/test-mode proof available before any production flag flip** — dLocal has a
      sandbox environment (`DLOCAL_API_URL=sandbox`, used successfully in 4A-10b's original smoke
      test plan); confirm it's still reachable and credentialed before relying on it.

---

## Rules specific to this variant

- **Fix both sides in the same session, verified identically** — F48/F49's own history shows a
  fix applied to money-service alone while the monolith kept the bug is a real, live risk (the
  monolith is still carrying 100% of dLocal traffic until this flag flips).
- **No card-capture/DIRECT-flow speculation** — this product's checkout is subscription-only via
  wallet/bank-redirect methods; do not add general-purpose payment-method-flow branching unless
  live evidence shows more than one flow value is actually needed.
- **Any red result = abort, revert flag, document** — same standing rule as every prior Slice 4
  cutover attempt (4A-10b, 4A-10c).
- **Do not touch Stripe** (F60/4A-13, already closed) **or Wise/outbox** (F47/F50, 4A-15) — scope
  isolation, same as every other session in Phase 4X.

## Rollback

- Revert `MIGRATE_WRITE_APIS_MONEY_DLOCAL` to `false` in Railway/Vercel — 0ms traffic revert to
  the monolith's own native dLocal route (same mechanism as every other Slice 4 group).
- Code fix itself is additive (a missing request field); reverting the flag alone is sufficient
  without a code revert, but if the fix itself is suspected wrong, revert both commits together.

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->

## Next-session handoff

- **Next session:** `4A-15` — Wise + Outbox Defect Sweep (F47 non-USD quote correctness, F50
  `COMMISSION_CREDITED` `aggregateId`), completing Phase 4X.
- **Variant:** PORT, low dial. No new behavior — every existing Wise test must pass unmodified.
- **Prerequisite:** 4A-14 CLOSED SUCCESSFUL (Slice 4 at 4/4).
- **4A-15 also owes:** PRE-DRAFT Session 9-0 and write `HANDOVER-PROMPT-phase-9.md` at its own
  close, per `MASTER-ROADMAP-PHASES-7-15.md`'s own trigger table.
