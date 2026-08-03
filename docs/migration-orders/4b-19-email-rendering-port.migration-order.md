# Migration Order — PORT variant

> For sessions that **move existing code between stacks** (Next.js lib/routes → NestJS;
> monolith rewiring). Read `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at
> **Low**: behavior preservation IS the deliverable. The current code is ground truth, not the
> session playbook's own one-line description of this session (see Background — that
> description is stale against the live codebase, per `LESSONS-LEARNED.md` L27's own recurring
> class of finding).

**Session:** 4B-19 · **Variant:** PORT · **Status:** PRE-DRAFT
**Generated:** 2026-08-03 (Executor PRE-DRAFT at 4B-18d close) · **Flags touched:** none identified
yet (see Entry criteria — may register a new one if Davin chooses Option B below)
**Estimated time:** 1-4h (genuinely unclear until Davin's Option A/B/C decision — see below)
**Target service:** operation-service (if anything is ported at all — see Background)
**Contract:** none identified (internal email-rendering capability, not an API surface)

## Background (read before touching anything — the playbook's own description is stale)

The session playbook (`monolith-to-microservices-migration-session-playbook.md` line 328) describes
this session as: **"CORE `emails/*` + `lib/email/email.ts` port."** That description was written
early in the migration and has NOT been re-verified against the live codebase since — this
PRE-DRAFT's own audit (2026-08-03, at 4B-18d's close) found it substantially out of date:

1. **`lib/email/email.ts` (985 lines, the raw-HTML-string email-sending/template module) is
   ALREADY fully ported** — Session 3-4 (F29 resolution) ported it verbatim into
   `operation-service/src/email/email.util.ts` (1004 lines), confirmed by reading both files
   directly. Nothing left to do here.
2. **`lib/email/subscription-emails.ts` (865 lines) is ALREADY mostly ported** — Session 4A-11
   (Slice 5 outbox worker) ported 5 of its 8 functions verbatim into
   `operation-service/src/email/subscription-email.util.ts` (588 lines): cancellation,
   payment-failed, payment-receipt, subscription-canceled, affiliate-commission. The other 3 were
   deliberately skipped, and re-checking that decision now still holds: `getUpgradeEmailTemplate`/
   `sendUpgradeEmail` has zero call sites anywhere in `app/`/`lib/` (confirmed dead code, would
   just move the deadness); `getRenewalReminderEmailTemplate`/`sendRenewalReminderEmail` is
   DEFINED but has zero callers anywhere in the codebase either (confirmed via a repo-wide grep) —
   also dead code today, not just "no outbox event to trigger it" as 4A-11 framed it.
3. **`emails/*.tsx` (4 files: `PaymentConfirmationEmail`, `PaymentFailureEmail`,
   `RenewalReminderEmail`, `SubscriptionExpiredEmail` — React Email/JSX components, a completely
   different rendering mechanism than the raw-HTML-string approach above) — a repo-wide grep for
   real imports (excluding the unrelated `seed-code/stack-auth/` reference project) found ZERO
   consumers anywhere in `app/`, `lib/`, or `components/`.** `emails/index.ts`'s own header says
   "Export all email templates for the dLocal payment flow" but nothing in the live dLocal
   payment code path (`lib/dlocal/*`, `app/api/payments/dlocal/*`) actually imports from this
   directory. Appears to be built-but-never-wired-up code.
4. **`lib/email/templates/affiliate/*.tsx` (5 files: welcome, code-distributed, code-used,
   monthly-report, payment-processed — also React Email components) — the ONLY reference found
   anywhere in real code is a single COMMENTED-OUT line** in `lib/affiliate/registration.ts:124`
   (`// await sendAffiliateWelcomeEmail(...)`). No `send*Email` wrapper function for any of these
   5 templates exists anywhere in the codebase — only the raw `.tsx` template files themselves.
   Also appears to be built-but-never-finished code.

**Net finding: there may be nothing left to genuinely PORT for this session** — the real,
live-callable email infrastructure is already in operation-service. What remains (`emails/*.tsx`,
`lib/email/templates/affiliate/*.tsx`, the 2 dead `subscription-emails.ts` functions) is dead or
never-finished code in the monolith itself, not something a behavior-preservation PORT session can
meaningfully "preserve the behavior of" — there is no live behavior to preserve.

## Entry criteria — this session cannot proceed past Step 0 without Davin's decision

- [ ] **Davin/Advisor to choose one before any file is touched:**
  - **Option A (recommended):** treat this as CONFIRMED — close out the "email rendering port"
    playbook item as already-substantially-done (Sessions 3-4/4A-11), formally retire the 2
    confirmed-dead `subscription-emails.ts` functions and the 9 unused `.tsx` template files from
    the monolith (a VERIFY-RETIRE-shaped action, not a PORT), and move directly to
    Session 4B-20/21 (auth cutover).
  - **Option B:** port the dead/unfinished code anyway, preemptively, in case a future feature
    (dLocal payment-flow emails, affiliate welcome emails) revives it — a real PORT session, but
    porting code with zero current behavior to preserve is a different risk profile than this
    variant's own "Low creativity dial, behavior preservation is the deliverable" framing assumes.
  - **Option C:** skip this session number entirely (mark SUPERSEDED, same precedent as the
    unsplit `4a-w3` order), proceed straight to 4B-20/21.
- [ ] If Option A or B: re-verify this PRE-DRAFT's own 4 findings above are still accurate at
      CONFIRM (nothing should have changed since 2026-08-03, but confirm per this repo's own
      standing CONFIRM discipline, not assume).

## File Port Order (only applies under Option B — do not build any of this under Option A/C)

### File 1/2 (if Option B)

- **SOURCE:** `emails/{payment-confirmation,payment-failure,renewal-reminder,subscription-expired}.tsx`
  - `emails/index.ts` (4 components, ~908 lines total) → **TARGET:**
    `operation-service/src/email/templates/dlocal/*.tsx` (needs a React Email rendering dependency —
    check `@react-email/render` or equivalent isn't already a `money-service`/`operation-service`
    dependency before assuming it needs adding)
- **Kind:** port + adapt (needs a real caller built too, since none exists in SOURCE — this is
  the actual delta between "port existing behavior" and "build new behavior using old templates")
- **Invariants:** none identified — no live behavior to preserve, since nothing calls these today
- **Parity proof:** N/A — no existing test coverage found (a repo-wide check found no spec file
  importing from `emails/`)
- **Commit:** `migrate(4b-19): port dLocal payment React Email templates`

### File 2/2 (if Option B)

- **SOURCE:** `lib/email/templates/affiliate/*.tsx` (5 files, ~1087 lines total) → **TARGET:**
  `operation-service/src/email/templates/affiliate/*.tsx` or `money-service` (needs a decision —
  affiliate/commission logic is money-service's domain per every prior affiliate-related session;
  check whether email-sending itself should live there instead of operation-service)
- **Kind:** port + adapt (same "no real caller exists yet" gap as File 1/2)
- **Invariants:** none identified
- **Parity proof:** N/A — no existing test coverage found
- **Commit:** `migrate(4b-19): port affiliate React Email templates`

## Rules specific to this variant

- Do not build a real caller/wiring for either template set unless Davin explicitly confirms a
  live feature needs it — porting dead code is one thing, silently reviving a half-built feature
  (e.g., actually sending affiliate welcome emails for the first time ever) is a product decision,
  not a PORT session's call to make unilaterally.
- If Option A: this becomes a VERIFY-RETIRE-shaped close instead — re-verify the dead-code finding
  live (re-run the same greps), get Davin's explicit go before deleting anything, one commit.

## Slice-level verification (done when)

- [ ] Davin's Option A/B/C decision recorded in this order and in `DECISION-LOG.md` if it
      resolves a real open question
- [ ] Whichever path chosen, `operation-service` test suite green, monolith `test:ci` green,
      `tsc --noEmit` clean both sides

## Deviations

_(empty — filled during execution once this order is CONFIRMED and run)_

## Known wrinkles / do-not-touch

- Do not conflate this session's own dead-code findings with `lib/api/index.ts` (a DIFFERENT,
  already-documented known-broken-by-design file, Phase 7's own scope) — unrelated.
- `market_data_v6`/`flask-api` (carried forward from 4B-18d's own Next-session handoff) is
  unrelated to this session — do not scope-creep into fixing it here.

## Next-session handoff

- After this session (whichever option chosen): **Session 4B-20/21 (Auth cutover, LAST)** —
  retire `[...nextauth]`, swap login/register forms to NestJS endpoints, delete
  `auth-options.ts`. Per the playbook's own framing, this is the final Phase 4B domain session
  before **4B-22 (Phase 4 exit review)**.
