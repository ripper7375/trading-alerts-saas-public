# Migration Order — VERIFY-RETIRE variant (ARCHIVE, not RETIRE — nothing deleted)

> For **cutovers, deletions, and exit reviews**. Read `00-SKELETON-AND-RULES.md` first — §4 applies
> with the dial at **near zero**: checklists exist to be obeyed. This is explicitly the **ARCHIVE**
> pattern (`03-riseworks-archive-and-restore-runbook.md`), not the `TEMPLATE-VERIFY-RETIRE.md`
> RETIRE pattern — F42 (RESOLVED, Davin) prohibits deleting anything RiseWorks-related. If any step
> below implies deletion, that step is wrong — stop and ask Davin.

**Session:** 4A-W8 · **Variant:** VERIFY-RETIRE (ARCHIVE block) · **Status:** PRE-DRAFT
**Generated:** 2026-07-27 (Executor, at 4A-W7's close) · **Estimated time:** ~1–2h
**Phase / plan section:** Phase 4A — money-service · Part 19.5 (RiseWorks → Wise), session 8 of 9
**Ground truth:** `03-riseworks-archive-and-restore-runbook.md` §2.1–2.5 (the full checklist below
is adapted from that section verbatim, not paraphrased — read it in full before executing) and
`04-rise-to-wise-migration-plan.md` §4 "4A-W8".
**Contract:** Archive switches **A1, A2, A4, A5** (`03-…` §1) — **A3** (`DISBURSEMENT_PROVIDER=WISE`)
already applied at 4A-W7, per that runbook's own Rev 2.

---

## Why this session, why now

4A-W7 wired `WisePaymentProvider` into the provider factory, subscribed production Wise webhooks,
flipped `DISBURSEMENT_PROVIDER=WISE`, and drafted/funded a single-affiliate smoke payout. Per the
runbook's Rev 2 note, A1 (unregister `RiseworksModule`) and A2 (`ALLOW_ARCHIVED_PROVIDERS` gate) are
real code changes that were deliberately deferred out of 4A-W7's near-zero-dial cutover into this
session. This order applies those two switches plus A4 (RiseWorks dashboard already points nowhere
useful — nothing to do, just verify) and A5 (eligibility path — already effectively true since
4A-W7 wired `getAllPayableAffiliatesForProvider`), then runs the full dormancy verification the
runbook's own §3 defines as this session's Done-when.

**Note for the next Executor (Davin, 2026-07-27):** `DECISION-LOG.md` **F47** (OPEN) — a real
currency-unit bug in `wise-quote.service.ts` found live during 4A-W7's own THB smoke payout
(`targetAmount` passed in the recipient's local currency using the USD commission number
unconverted). It does **not** block this archival session — F47 is about the Wise payout path, not
RiseWorks — but it must be fixed before any further non-USD Wise payout, and should not get lost
now that RiseWorks is being archived. If PRE-DRAFTing 4A-W9, carry F47 forward explicitly.

---

## Scope Discipline & Grounded Line Counts

- **Files touched, current line counts (re-verified 2026-07-27, several drifted from the runbook's
  own citations — notably `provider-factory.ts` and `disbursement.constants.ts`, both edited by
  4A-W7's Step 1; use these, not the runbook's numbers):**
  - `money-service/src/app.module.ts`: **81 lines**
  - `money-service/src/disbursement/providers/provider-factory.ts`: **128 lines**
  - `money-service/src/disbursement/disbursement.constants.ts`: **169 lines**
  - `money-service/src/disbursement/disbursement.types.ts`: **168 lines**
  - `money-service/src/riseworks/riseworks-webhook.controller.ts`: **186 lines**
  - `money-service/src/riseworks/riseworks.module.ts`: **21 lines**
  - `money-service/src/disbursement/providers/rise/webhook-verifier.ts`: **161 lines**
- **Governing prohibition (F42):** nothing RiseWorks-related is deleted — no source file, test,
  Prisma model, enum value, database row, admin page, or documentation. "Archived" = deactivated
  and clearly labelled, never removed.

---

## Entry criteria

_(verified at CONFIRM time, not assumed — `EXECUTOR-PROTOCOL.md` §1.3)_

- [ ] **4A-W7 fully closed, not just executed.** Specifically: the smoke payout's real
      `transfers#state-change` webhook has actually landed (not a hand-signed replay), `Commission
    .status = PAID` observed exactly once, and the funding cycle monitoring window (order's own
      Step 7) has passed clean. Archiving Rise is low-risk regardless (see below), but this order
      should not START until Wise is proven, not just wired.
- [ ] `money-service` test suite green (baseline to diff against after this session's own edits).
- [ ] `git status` clean / all 4A-W7 work committed and pushed — re-verify `origin/main` matches
      local `HEAD` before starting (this exact gap bit 4A-W7 once already).
- [ ] Davin present for every step (`EXECUTOR-PROTOCOL.md` §7 — this still touches the live
      disbursement provider surface, even though RiseWorks itself has never moved money).

**A failed entry criterion means do not start** — propose the fix or the session swap.

---

## Integration points

- **In:** none (no new external inputs — this session only removes RiseWorks from money-service's
  own module graph and provider-construction path).
- **Out:** none (RiseWorks' dashboard webhook URL already points at the monolith, unchanged by this
  order — A4 is a verify-only step, not a repoint).
- **Owns:** `RiseworksModule` registration state, `ArchivedProviderError`/`ALLOW_ARCHIVED_PROVIDERS`
  gate, commission-aggregator eligibility branch.

---

## Ordered Steps

_(mirrors `03-…` §2.1–2.5 exactly — read that section in full, this is a compressed index, not a
replacement.)_

### Step 1 — money-service: deactivate `RiseworksModule` (A1) (`03-…` §2.1)

- **TARGET:** `money-service/src/app.module.ts` (81 lines)
- Remove `RiseworksModule` from `imports` and its `import` line. Replace with the exact comment
  block `03-…` §2.1 specifies (restore pointer + reason), not silence.
- **Verification:** `grep -rn "RiseworksModule" money-service/src/app.module.ts` → only inside a
  comment.
- **Commit:** `chore(archive): unregister RiseworksModule (A1) per F42`

### Step 2 — money-service: `ArchivedProviderError` + `ALLOW_ARCHIVED_PROVIDERS` gate (A2) (`03-…` §2.1)

- **TARGET:** `money-service/src/disbursement/providers/provider-factory.ts` (128 lines),
  `money-service/src/disbursement/disbursement.constants.ts` (169 lines)
- Add `ARCHIVED_PROVIDERS = ['RISE'] as const` and an `ArchivedProviderError`. The existing
  `case 'RISE'` block in `provider-factory.ts` stays reachable behind the
  `ALLOW_ARCHIVED_PROVIDERS=true` gate — do not replace its body (it already throws "not yet
  implemented," unrelated to this gate).
- **Verification:** unit test — `createPaymentProvider('RISE')` with `ALLOW_ARCHIVED_PROVIDERS`
  unset throws `ArchivedProviderError`; `getAvailableProviders()` returns `['MOCK', 'WISE']` only.
- **Commit:** `build(archive): add ArchivedProviderError + ALLOW_ARCHIVED_PROVIDERS gate (A2) per F42`

### Step 3 — money-service & monolith: banners only, no logic edits (`03-…` §2.1–2.2)

- `riseworks-webhook.controller.ts` (186), `riseworks.module.ts` (21),
  `providers/rise/webhook-verifier.ts` (161) + its `.spec.ts`: append the `ARCHIVED` banner to each
  file-header docblock. **No code changes** — the Rise spec must keep passing unmodified (it's the
  proof the archived code still works if restored).
- Monolith `lib/disbursement/providers/rise/*` (4 files), `app/api/webhooks/riseworks/route.ts`,
  `app/api/disbursement/riseworks/{accounts,sync}/route.ts`,
  `app/api/cron/sync-riseworks-accounts/route.ts`: banner only.
- `sync-riseworks-accounts` money-service counterpart (already cut over to money-service's own
  scheduler, Session 4A-3): make it short-circuit with an `ARCHIVED — skipping` log line instead of
  throwing. **Do not delete the job or change its cron expression.**
- Admin UI (`app/(dashboard)/admin/disbursement/{accounts,layout,config}/*`): gate the accounts page
  - nav item behind `NEXT_PUBLIC_SHOW_ARCHIVED_DISBURSEMENT_UI`; provider dropdown shows `RISE`
    disabled/labelled "archived," not removed.
- **Commit:** `docs(archive): append ARCHIVED banners, gate admin UI, silence sync-riseworks cron noise`

### Step 4 — Database: comments only, zero migration (`03-…` §2.3)

- Add the archive banner comment block to `prisma/non-market-data/schema.prisma` (Rise section) and
  the mirrored subset in `money-service/prisma/schema.prisma`. Comment-only — produces no migration.
- Row retention: indefinite, no purge, no anonymization pass.
- **Verification:** `prisma validate` clean both sides; `git diff` shows comment-only changes.
- **Commit:** `docs(archive): mark RiseWorks schema block ARCHIVED, zero migration`

### Step 5 — Documentation & inventories (`03-…` §2.4)

- New `riseworks/ARCHIVED.md` (date, authority F42, restore pointer, "nothing deleted" statement).
- `docs/files-completion-list/files-inventory/part19{a,b,c,d}-files-completion.md`: append the
  supersession note (`05-artifact-amendments.md` §6) — do not edit existing tables.
- `docs/migration-orders/4a-5-rw-money-service-riseworks-webhook-cutover.migration-order.md`: header
  status → **REVOKED** with reason/date (keep the file).
- `docs/migration-orders/migration-stack-analysis.md`: mark Rise entries `ARCHIVED (Part 19.5)`; add
  new `src/wise/**` entries (still owed from 4A-W1 onward per Waiting-on history — this session
  finally closes that gap).
- **Commit:** `docs(archive): riseworks ARCHIVED.md, revoke 4a-5-rw order, update file inventories`

### Step 6 — Secrets (`03-…` §2.5)

- `RISE_WEBHOOK_SECRET`: confirmed never set (CLAUDE.md Waiting-on #26 history) — leave unset,
  nothing to rotate.
- Any other live `RISE_*` variable: leave it, note it in this order's Deviations (removing it is a
  restore-cost with no security benefit, since A2+A1 already make the code path unconstructable).

---

## Rules specific to this variant

- **Nothing is deleted, ever, in this order.** Every step above is comment/banner/gate — no source
  file, test, model, enum, row, or admin page disappears. A step that implies deletion is wrong.
- **Checklist Invariant:** any red result = stop and document immediately.
- The Rise test suite (including `webhook-verifier.spec.ts`) must keep passing unmodified — a
  skipped or deleted Rise test is a failed archival, not a passed one.

---

## Done when

_(= the runbook's own §3 dormancy verification, evidenced, not asserted)_

- [ ] `grep -rn "RiseworksModule" money-service/src/app.module.ts` → only inside a comment.
- [ ] `POST /v1/webhooks/riseworks` → **404** (route not registered). Before this session it
      returned 401 (missing signature) — that difference is the proof A1 actually took effect.
- [ ] `createPaymentProvider('RISE')` with `ALLOW_ARCHIVED_PROVIDERS` unset → throws
      `ArchivedProviderError`. Unit test asserts it.
- [ ] `getAvailableProviders()` → `['MOCK', 'WISE']` — `'RISE'` absent. Unit test asserts it.
- [ ] Railway: `DISBURSEMENT_PROVIDER` reads `WISE` (value-blind check per L17 — never
      `railway variables --kv`).
- [ ] `sync-riseworks-accounts` fires on its next natural tick and logs `ARCHIVED — skipping` with
      **no error**.
- [ ] `SELECT count(*) FROM "AffiliateRiseAccount"` and `… FROM "RiseWorksWebhookEvent"` return the
      **same counts as before** this session's archival commits. Record both numbers in Deviations.
- [ ] Full money-service suite green — including every Rise spec, unmodified.
- [ ] `npm run validate` (or the Windows-adjusted `tsc --noEmit` + `eslint` bar per L20) green on
      the monolith side.
- [ ] `migration-cutover-table.md`, `CLAUDE.md`, `DECISION-LOG.md` (F42 amendment noting archival
      complete), `migration-stack-analysis.md` updated.
- [ ] Session `4A-W9` (or whatever the plan's next Part 19.5 session is — check
      `04-rise-to-wise-migration-plan.md` §4 for whether one exists) PRE-DRAFTed, carrying F47
      forward explicitly.

---

## Rollback / Restore

_(mirrors `03-…` §4 — full ≤30-minute restore procedure, not reproduced here in full; read that
section before attempting a restore.)_ Preconditions: Davin's explicit instruction + a recorded
reason (F42 amendment in `DECISION-LOG.md`). **Restoring the archive ≠ being able to pay via
Rise** — `RisePaymentProvider` was never completed (`sendPayment` etc. all throw "coming in Part
19B"); state this plainly to Davin before starting any restore. Steps: uncomment
`RiseworksModule` import, set `ALLOW_ARCHIVED_PROVIDERS=true` + `DISBURSEMENT_PROVIDER=RISE` +
`RISE_WEBHOOK_SECRET`, deploy, verify `/v1/webhooks/riseworks` → 401 (not 404) for unsigned,
verify eligibility reverts via a dry-run batch preview (not a real batch).

---

## Deviations

_(filled DURING execution — what / why / impact.)_

---

## Known wrinkles / do-not-touch

- **`lib/api/index.ts`** — known-broken by design until Phase 7. Do not touch.
- **F42's prohibition is absolute** — if any step is found to require deletion, stop and ask Davin
  rather than improvising a "safe" deletion.
- **Running Wise and Rise simultaneously is explicitly not recommended** (`03-…` §4.3) — a
  `Commission` has exactly one `disbursementTransaction`, so dual-provider operation doubles the
  reconciliation surface for no gain. Out of scope for this order if it ever comes up.
- **F47 (OPEN, `DECISION-LOG.md`)** — the Wise quote currency-unit bug. Unrelated to this session's
  own scope but must not be lost; do not let RiseWorks archival close-out overshadow it.

---

## Next-session handoff

_(PRE-DRAFT the next Part 19.5 session at this session's close, if `04-rise-to-wise-migration-plan.md`
§4 defines one — otherwise this may be Part 19.5's last session. Either way, carry F47 forward
explicitly into whatever PRE-DRAFT comes next, and note that Part 19.5's own exit review should
confirm F47 has an owner before the docset is considered closed.)_
