# Migration Order — Session 4A-15 — Wise + Outbox Defect Sweep

> For sessions that **move existing code between stacks** / fix defects in already-ported code:
> read `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at **Low**. Behavior
> preservation is the deliverable for the Wise quote-correctness half (F47); the outbox half
> (F50) is a genuine, previously-undelivered feature (affiliate identity resolution) rather than
> a regression, so treat that half's dial as slightly higher — get it right, not just unchanged.
> PRE-DRAFTed by the Executor at Session 4A-14's close (2026-08-21).
> Closes `DECISION-LOG.md` **F47** (OPEN, found 4A-W7) and **F50** (OPEN, found 4A-11), completing
> Phase 4X's originally-scoped Wise/outbox work.

**Session:** 4A-15 (Wise + Outbox Defect Sweep) · **Variant:** PORT · **Status:** PRE-DRAFT
**Generated:** 2026-08-21 (Executor, at Session 4A-14's close)
**Flags touched:** F47 (OPEN → target RESOLVED), F50 (OPEN → target RESOLVED)
**Target service:** `money-service` (both defects) + `operation-service` (F50's consumer-side skip
logic, if the chosen fix touches it)
**Contract:** No new HTTP surface for either fix — F47 corrects an internal quote-amount
calculation; F50 corrects an outbox event payload's contents. Existing `POST /v1/wise/*` and the
outbox `eventType` contract stay byte-identical in shape.

---

## Decisions taken

<!-- Left deliberately unresolved in this PRE-DRAFT — a Step 0 discovery pass and the actual
     fix-shape decisions belong to the Advisor at DRAFT per `DECISION-LOG.md` PD1, not invented
     here from stale citations. Same discipline as every recent PRE-DRAFT. -->

1. **F47's actual fix shape** `⚠ NEEDS EXPLICIT SIGN-OFF` — needs a fresh read of
   `money-service/src/wise/services/wise-quote.service.ts` (99 lines) as it stands today, cross-
   checked against Wise's current Quotes API docs for `targetAmount` vs `sourceAmount` semantics
   under `feeBearer: 'PLATFORM'` (F38's resolved decision), before deciding whether this is a
   currency-unit bug (e.g. minor-vs-major units), a wrong-field-read bug, or a rounding-direction
   bug. Not diagnosed in depth since Session 4A-W7 first found it.
2. **F50's actual fix shape** `⚠ NEEDS EXPLICIT SIGN-OFF` — the archived F50 write-up
   (`history/decisions-archive.md`) proposes money-service pre-resolving the affiliate's identity
   (email/name/code/running-total-earnings) into the `COMMISSION_CREDITED` payload at emission
   time (`money-service/src/stripe/stripe-webhook.service.ts`'s `emitOutboxEvent` call site
   already has full schema access to `Commission`/`AffiliateProfile`/`User`), as cheaper than
   extending `operation-service`'s narrow Prisma schema subset (`operation-service/prisma/
schema.prisma` has no `Commission`/`AffiliateProfile` model by design, per L1). This is the
   Advisor's to confirm or revise at DRAFT, not assumed here.
3. **Whether fixing F50 requires touching `operation-service/src/outbox/outbox-consumer.service.ts`'s
   existing `COMMISSION_CREDITED` skip branch** `⚠ NEEDS EXPLICIT SIGN-OFF` — depends on Decision 2.
   If money-service pre-resolves the identity into the payload, the consumer-side skip becomes
   unnecessary and should be removed (dead branch) rather than left stale.

---

## Why this session exists

Two independent, non-blocking defects found earlier in Phase 4/4X, both explicitly deferred to
their own dedicated session rather than fixed as drive-bys at discovery time:

- **F47** — found Session 4A-W7 (Wise integration build): the Quotes API's `targetAmount`/
  currency-unit handling for non-USD payouts may be wrong. Zero production impact today because
  Wise disbursement funding mode is `MANUAL` (F37) and non-USD payouts haven't run live yet — but
  this is due before ANY further non-USD Wise payout, and Slice 4/Phase 4X's own exit review
  flagged it as still open.
- **F50** — found Session 4A-11 (outbox consumer build): `COMMISSION_CREDITED` events resolve
  `aggregateId` to the paying subscriber, not the earning affiliate — `OutboxConsumerService`
  currently special-cases this eventType to skip delivery entirely (log + `skipped` status) rather
  than emailing the wrong person. Zero production impact today because `OUTBOX_PUBLISHER_ENABLED`
  stays off pending this fix, but the other 5 eventTypes ARE live-deliverable and this one
  shouldn't stay permanently skipped.

**Independent of 4A-14's own outcome.** Session 4A-14 (2026-08-21) closed PARTIAL — F49 genuinely
fixed, but dLocal Group B's cutover failed live on a new bug (F76, OPEN) and remains blocked.
Wise/outbox are a completely different provider with no technical dependency on dLocal Group B —
this session can and should proceed regardless of F76's own resolution timeline, same
scope-isolation convention used throughout this migration. **What this session does NOT achieve
on its own:** Phase 4X's gate for Session 8-1 ("all of 4A-13/14/15 CLOSED") — even after this
session closes cleanly, dLocal Group B (F76) still needs its own dedicated fix-and-recutover
session (working title `4A-16`, not yet numbered) before that gate is genuinely satisfied.

---

## Entry criteria (draft — re-verify all at CONFIRM)

- [ ] `DECISION-LOG.md` **F47** and **F50** reviewed directly — confirm both still OPEN, scope
      unchanged since 4A-W7/4A-11, re-read full archived narrative for F50 in
      `history/decisions-archive.md` (F47 has no extended write-up beyond its register row).
- [ ] **Git drift check re-measured live**: `git log --oneline <this session's own close commit>..HEAD
-- money-service/src/wise/ money-service/src/stripe/stripe-webhook.service.ts
operation-service/src/outbox/` — confirm nothing has changed in either area since this PRE-DRAFT.
      Use a real, verified commit hash at CONFIRM time, not a placeholder (Session 4A-14's own
      order cited a non-existent hash — re-verify, don't copy forward).
- [ ] **Wise API docs re-checked live** for F47 — do not assume the 4A-W7-era understanding of
      `targetAmount`/currency-unit semantics is still accurate; Wise's API can version.
- [ ] **Codebase test baselines re-measured at CONFIRM**: monolith `tsc`/`eslint`/`test:ci`;
      money-service `test`; operation-service `test` (if F50's fix touches it) — all fresh,
      isolated runs (`LESSONS-LEARNED.md` L24).
- [ ] **`OUTBOX_PUBLISHER_ENABLED` current state re-confirmed** (should still be OFF; F50's own
      non-blocking status depends on this).
- [ ] **No live money movement in this session's scope** — F47 fixes a calculation bug (no flag
      flip, no cutover); F50 fixes a payload/consumer-logic bug (also no flag flip). Neither
      requires Davin's live real-money presence the way 4A-14's cutover did, but confirm this
      framing still holds at CONFIRM before assuming a lower-stakes session.
- [ ] **Scope isolation confirmed**: do NOT touch dLocal (F76, `4A-16`) or Stripe webhook
      (F60/F75, closed 4A-13).

---

## Integration points

- **F47 (`wise-quote.service.ts`):** In — called by `WiseTransferService`/batch-execution flow
  when creating a Wise transfer. Out — Wise's real Quotes API (`POST /v3/quotes` or equivalent).
  Owns — no persistent state; a pure calculation/API-call service.
- **F50 (`stripe-webhook.service.ts` emission + `outbox-consumer.service.ts` consumption):**
  In — `emitOutboxEvent(userId, 'COMMISSION_CREDITED', payload)` called from the Stripe webhook
  handler on a commission-crediting event. Out — the `OutboxEvent` table (money-service side,
  producer) and `operation-service`'s consumer (reads, resolves recipient, sends). Owns — the
  `COMMISSION_CREDITED` payload shape is theirs to change; other 5 eventTypes must stay untouched.

---

## Rules specific to this variant

- **No behavior change to the other 5 outbox eventTypes.** F50's fix is scoped to
  `COMMISSION_CREDITED` only — every existing Wise test AND every existing outbox test for the
  other 5 eventTypes must pass unmodified; a passing test needing its assertion changed outside
  F47/F50's own scope is a finding, not a fix (`LESSONS-LEARNED.md` L18).
- **F47 needs live/sandbox proof, not just a corrected calculation.** A unit test alone proved
  insufficient for the exact same class of "is this the value the real API expects" question in
  Session 4A-14 (F49→F76) — verify the corrected `targetAmount`/currency-unit logic against Wise's
  real sandbox for at least one non-USD currency before considering this closed.
- **Any Railway CLI log/status query this session MUST pass `--service <exact-name>` explicitly**
  — `LESSONS-LEARNED.md` L34 (this session found `railway logs`/`status` silently default to
  whichever service happens to be linked, not the directory or the service you intend).
- **Any local DB read-only verification this session MUST sanity-check row counts first** —
  `LESSONS-LEARNED.md` L35 (this session found the Executor's local `DATABASE_URL` did not point
  at the real production database; a "clean" result is not evidence without confirming the
  connection target first).

---

## Slice-level verification (done when)

- [ ] F47: corrected quote-amount logic, verified against Wise's real sandbox for ≥1 non-USD
      currency, existing Wise test suite green plus new regression test(s) for the specific bug.
- [ ] F50: `COMMISSION_CREDITED` payload carries resolvable affiliate identity; consumer-side
      delivery (or the chosen equivalent) proven correct (real or synthetic event, per whatever
      the DRAFT's Decisions taken settles on); the other 5 eventTypes' tests unchanged.
- [ ] `DECISION-LOG.md` F47 and F50 both RESOLVED with live evidence.
- [ ] Full test baselines green: monolith `tsc`/`eslint`/`test:ci`; money-service `test`;
      operation-service `test` (if touched).

---

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->

---

## Next-session handoff

- **Next session:** `9-0` — Frontend Swap Contract & Decisions (per
  `MASTER-ROADMAP-PHASES-7-15.md`'s own running order) — **but only once dLocal Group B (F76,
  working title `4A-16`) is ALSO closed**, since Phase 4X's gate for Session 8-1 needs all of
  4A-13/14/15/16 CLOSED, and 9-0 itself has no dependency on Phase 4X but the roadmap's own
  posted running order sequences Phase 9 after Phase 4X as a whole. Flag this ordering question to
  Davin/Advisor explicitly at this session's own close — do not assume either ordering silently.
- **Variant:** CONTRACT, no code (per the roadmap's own description of 9-0).
- **Prerequisite:** 4A-15 CLOSED SUCCESSFUL. dLocal Group B (F76) status should be checked at
  4A-15's own close and reported, even though it's not a hard blocker for 4A-15 itself.
- **4A-15 obligation carried over from 4A-14 (per `MASTER-ROADMAP-PHASES-7-15.md`'s own trigger
  table):** PRE-DRAFT Session 9-0 and author `HANDOVER-PROMPT-phase-9.md` at this session's own
  close.
