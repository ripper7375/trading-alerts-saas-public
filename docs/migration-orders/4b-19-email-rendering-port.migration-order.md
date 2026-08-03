# Migration Order — PORT / VERIFY-RETIRE variant (Option A Selected)

> For sessions that **move existing code between stacks** (Next.js lib/routes → NestJS;
> monolith rewiring). Read `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at
> **Low**: behavior preservation IS the deliverable. Ground truth audit confirms active email infrastructure is ALREADY in operation-service/money-service (Sessions 3-4/4A-11); Option A selected to audit, verify, and retire remaining dead templates.

**Session:** 4B-19 · **Variant:** PORT / VERIFY-RETIRE (Option A) · **Status:** CONFIRMED
**Generated:** 2026-08-03 (Executor PRE-DRAFT at 4B-18d close; Approved by Antigravity Advisor 2026-08-03; CONFIRMED by Executor 2026-08-03 after independent re-verification of all 4 Background findings — zero drift found; Davin confirmed live the PRE-DRAFT→APPROVED header edit was Antigravity Advisor's own authentic work) · **Flags touched:** none
**Estimated time:** <1h (Option A: verify active email functions, retire unused legacy templates)
**Target service:** operation-service / money-service / monolith
**Contract:** none (internal email-rendering capability)

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

- [x] **Davin/Advisor to choose one before any file is touched:** **Option A selected** (Davin,
      live, 2026-08-03) — close out the "email rendering port" playbook item as
      already-substantially-done (Sessions 3-4/4A-11), formally retire the 2 confirmed-dead
      `subscription-emails.ts` functions and the 9 unused `.tsx` template files from the monolith
      (a VERIFY-RETIRE-shaped action, not a PORT), and move directly to Session 4B-20/21
      (auth cutover).
  - Option B (port the dead/unfinished code preemptively) and Option C (skip the session number
    entirely) were both declined.
- [x] Re-verified this PRE-DRAFT's own 4 findings at CONFIRM (2026-08-03) — all 4 hold, zero
      drift since drafting. Independently confirmed, not assumed:
  - Finding 1 (`lib/email/email.ts` fully ported): confirmed both files export the identical 24
    functions, same names, same order (`isEmailServiceConfigured` → `sendTwoFactorDisabledEmail`).
  - Finding 2 (`subscription-emails.ts` — 5 types ported, 2 dead): confirmed via repo-wide grep of
    `app/`, `lib/`, `components/` — `getUpgradeEmailTemplate`/`sendUpgradeEmail` and
    `getRenewalReminderEmailTemplate`/`sendRenewalReminderEmail` have zero external callers
    (self-referential only). Confirmed the file's other 5 functions are still live
    (`app/api/subscription/cancel/route.ts`, `lib/stripe/webhook-handlers.ts` both import from
    it) — retirement correctly scoped to the 2 dead functions only, not the whole file. Minor
    citation correction: the file defines 7 email-type pairs (14 exports), not "8 functions" as
    the PRE-DRAFT's prose stated (5 ported + 2 dead = 7) — immaterial to the conclusion.
  - Finding 3 (`emails/*.tsx`, zero consumers): confirmed via repo-wide grep of `app/`, `lib/`,
    `components/` for imports from `emails/` — zero matches, zero test coverage.
  - Finding 4 (`lib/email/templates/affiliate/*.tsx`, one commented-out reference): confirmed the
    only hit anywhere in real code is the commented-out line at `lib/affiliate/registration.ts:124`;
    no `send*Email` wrapper exists anywhere for any of the 5 templates.

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

- [x] Davin's Option A/B/C decision recorded in this order (Option A, above). No `DECISION-LOG.md`
      entry needed — this doesn't resolve an F-numbered open question, it closes a stale playbook
      item description against already-completed prior-session work.
- [x] `operation-service` test suite green (42/42 suites, 380/380 tests — unchanged, this service
      was not touched), monolith `test:ci` green (123/123 suites, 2157/2157 tests — unchanged from
      4B-18d's baseline, zero regressions), `tsc --noEmit` clean both sides, `eslint app components
  lib hooks --max-warnings 0` clean (0 errors/warnings), `operation-service` `nest build` clean.

## Deviations

1. **Minor citation correction, immaterial to the outcome:** the PRE-DRAFT's Background section
   (Finding 2) said Session 4A-11 "ported 5 of its 8 functions" from `subscription-emails.ts`. The
   file actually defines 7 email-type pairs (14 exports: 7 `get*Template` + 7 `send*Email`), not 8
   — 5 ported + 2 dead (`upgrade`, `renewal-reminder`) = 7. Found while independently re-verifying
   the finding at CONFIRM via `grep -n "^export function\|^export async function"`. Does not change
   which functions are dead or the retirement scope.
2. **Retirement scope was function-level, not file-level, for `subscription-emails.ts`:** only
   `getUpgradeEmailTemplate`, `sendUpgradeEmail`, `getRenewalReminderEmailTemplate`, and
   `sendRenewalReminderEmail` (plus their JSDoc blocks and the now-empty "RENEWAL REMINDER EMAIL"
   section divider) were deleted — confirmed via grep before deleting that the file's other 5
   functions are still imported by live monolith code (`app/api/subscription/cancel/route.ts`,
   `lib/stripe/webhook-handlers.ts`). Deleting the whole file would have broken both. File went
   from 865 to 612 lines.
3. **Used a small Node.js script (not the Edit tool) to perform the line-range deletion** in
   `lib/email/subscription-emails.ts`, given the functions being removed are large raw-HTML-string
   template literals with heavy special-character content — a scripted, line-number-addressed
   deletion (verified against a fresh `Read` of the file immediately beforehand) was more reliable
   than hand-constructing exact-match `old_string` blocks for that much templated markup. Deleted
   the throwaway script after use; zero repo residue.
4. **All 10 dead template files removed via `git rm -r`, not deleted-then-staged**, for a clean,
   traceable single diff: `emails/{index.ts,payment-confirmation.tsx,payment-failure.tsx,
renewal-reminder.tsx,subscription-expired.tsx}` (5 files) and
   `lib/email/templates/affiliate/{welcome,code-distributed,code-used,monthly-report,
payment-processed}.tsx` (5 files) — the PRE-DRAFT's own "9 unused `.tsx` template files" count
   excludes the `emails/index.ts` barrel (a `.ts`, not `.tsx`, file) which was also removed since it
   only re-exported the 4 now-deleted components. `lib/email/templates/` had no other contents and
   is now gone entirely (git doesn't track empty directories).
5. **One commit for the whole retirement**, per this order's own explicit Rules section ("If
   Option A: ... one commit").
6. **Lesson harvested at close, per `LESSONS-LEARNED.md` L11's own hygiene rule ("5+ recurrences
   → single count line"):** CONFIRM found the by-now-familiar L11 pattern again (order file
   modified-but-uncommitted, header status flipped with no visible Advisor→Davin commit trail) —
   this session's occurrence was the 11th documented one, well past the file's own consolidation
   threshold. Collapsed L11's 9 individually-narrated `Recurrence (Session ...)` bullets into a
   single count line in `LESSONS-LEARNED.md`; the full narrative (plus this session's own
   recurrence) moved verbatim to `LESSONS-ARCHIVE.md`. No new numbered lesson was warranted from
   this session's own execution work (nothing cost >30 min to diagnose, recurred in a genuinely
   new shape, or reached CI/production). Incidentally found pre-existing character-encoding
   corruption (mojibake) in `LESSONS-ARCHIVE.md`'s own 4B-18b/4B-18c-era entries while appending —
   not fixed, flagged in `CLAUDE.md` Waiting-on #103.

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
