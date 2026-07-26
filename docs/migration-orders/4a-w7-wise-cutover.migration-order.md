# Migration Order — VERIFY-RETIRE variant

> For **cutovers, deletions, and exit reviews**. Read `00-SKELETON-AND-RULES.md` first — §4
> applies with the dial at **near zero**: checklists exist to be obeyed. If executing this
> uncovers real work (see Entry criterion 0 below — it likely will), **STOP** — that work gets
> its own PORT/CONTRACT session with the right variant, not folded into this cutover.

**Session:** 4A-W7 · **Variant:** VERIFY-RETIRE (CUTOVER block) · **Status:** PRE-DRAFT
**Generated:** 2026-07-26 (Executor, at 4A-W6's close) · **Estimated time:** 1–2h **plus** whatever
Entry criterion 0 below turns out to need (likely a short PORT session first — see there)
**⚠️ REAL MONEY CUTOVER. Money-audit prompt first (`EXECUTOR-PROTOCOL.md` §7). Davin must be
present for every step.**
**Ground truth:** `04-rise-to-wise-migration-plan.md` §4 "4A-W7" (the full checklist below is
adapted from that section verbatim, not paraphrased) and `03-riseworks-archive-and-restore-runbook.md`
for the A1–A3 archive switches.

---

## Entry criterion 0 (NEW — found at 4A-W6's close, blocks everything else in this order)

- [ ] **`DISBURSEMENT_PROVIDER=WISE` must actually be constructible before it can be flipped.**
      Verified live at 4A-W6's close: `money-service/src/disbursement/providers/provider-factory.ts`
      has no `case 'WISE'` (only `'MOCK'` and a `throw` for `'RISE'`); `disbursement.constants.ts`'s
      `SUPPORTED_PROVIDERS` and `getDefaultProvider()` don't recognize `'WISE'` at all — with
      `DISBURSEMENT_PROVIDER=WISE` set, `getDefaultProvider()` silently returns `'MOCK'` instead,
      and `disbursement-processor.service.ts`'s cron would keep calling
      `commissionAggregator.getAllPayableAffiliates()` (the Rise/Mock eligibility query) instead of
      4A-W6's own new `getAllPayableAffiliatesForProvider('WISE')`. **This order's own step 4
      ("Flip `DISBURSEMENT_PROVIDER=MOCK → WISE`, redeploy") would silently do nothing** — the cron
      would keep running exactly as it does today, and step 5's "smoke payout" would silently
      process through `MockPaymentProvider` instead of reaching Wise at all. Combine this with the
      OTHER live finding from 4A-W6 (`MockPaymentProvider.sendPayment()`'s `transactionId` mismatch
      means "successful" Mock payments are silently skipped, batch still reports `success: true`) —
      the compound failure mode is a cutover that LOOKS like it worked (green batch, no errors) and
      moved zero real money, with no error anywhere to notice.
      **Do not attempt this order until that gap is closed** — either a short dedicated PORT session
      wires `provider-factory.ts`/`disbursement.constants.ts`/`disbursement-processor.service.ts`
      for real DI-aware `WisePaymentProvider` construction, or (Davin's call) this order's own
      Checklist step 4 is rewritten to construct `WisePaymentProvider` directly (bypassing the
      factory) the same way 4A-W6's own E2E test does. Either way, this needs a real decision and
      real code before Checklist step 4 below can be trusted — propose the fix or the session swap,
      per this file's own template instruction.

---

## Entry criteria

- [ ] Entry criterion 0 above is closed.
- [ ] W6 closed, all-green, sandbox E2E evidence presented (4A-W6 CONFIRMED and executed
      2026-07-26 — 44/44 suites, 366/366 tests, `base-provider.ts` untouched).
- [ ] `WISE_*` production env vars set (value-blind verified per L17) and `WISE_ENV=production`.
      `WISE_API_TOKEN` promoted to **full production access** (distinct token from the sandbox one
      used W1–W6 per the two-tokens-promoted-per-session plan, design §7.2).
- [ ] **At least one real affiliate has an `ACTIVE` Wise recipient** — ideally one Davin controls,
      for the smoke payout.
- [ ] Production Wise balance funded with at least the smoke amount (Davin funds manually — Model
      A/Thailand region gate, F36/F37).
- [ ] Business Payment Approvals absent on the **production** Wise account (third and final check —
      confirmed absent on sandbox at W1, re-confirmed live at W6; production is a DIFFERENT account
      state and has never been checked).
- [ ] `RESEND_API_KEY` + `WISE_FUNDING_ALERT_EMAIL` set on money-service (F43, built W6 — currently
      confirmed ABSENT; the funding-SLA alarm cannot deliver until these are set).
- [ ] Davin present. His ritual question — _"what's the rollback?"_ — answered below before step 3.

---

## Checklist (CUTOVER block)

1. Present W6's sandbox evidence and the §5.2 state-mapping table. Any unexplained mismatch →
   **abort**.
2. Davin approves, live.
3. **Subscribe production webhooks** (`transfers#state-change` + `transfers#payout-failure` +
   `balances#update`, schema `4.0.0`, **profile-level** per F40) →
   `https://money-service-production.up.railway.app/v1/webhooks/wise`. Confirm the auto-sent
   **test event** arrives and returns 200 (`X-Test-Notification: true`).
4. **Flip:** `DISBURSEMENT_PROVIDER=MOCK → WISE`. Redeploy. **Blocked on Entry criterion 0 —
   verify the flip actually changes which provider gets constructed before trusting this step.**
5. **Smoke payout — ONE affiliate, smallest viable amount:** prepare → complete → present pay-in
   details → Davin funds in the Wise app → observe `transfers#state-change` land in Railway logs →
   confirm `Commission=PAID` and the affiliate balance moved exactly once.
   ⚠️ **Do not batch multiple affiliates on the first run.**
6. Apply archive switches **A1–A3** (`03-…` §1): unregister `RiseworksModule`, provider-factory
   gate (`ALLOW_ARCHIVED_PROVIDERS`), env already flipped in step 4. Redeploy; confirm
   `POST /v1/webhooks/riseworks` → **404**.
7. Monitor for a full funding cycle: error rate, webhook backlog, no duplicate `Commission.paidAt`
   writes. Green?
8. Record: `migration-cutover-table.md` (new Slice 2W row), `CLAUDE.md`, `DECISION-LOG.md`.

## Rollback

- `DISBURSEMENT_PROVIDER=WISE → MOCK` + redeploy. Stops all new sends immediately.
- Delete the production webhook subscriptions. In-flight events are still delivered but not sent;
  the reconciliation cron (4A-W6) backfills once resubscribed ⇒ no event loss.
- **Already-sent money cannot be recalled.** That is precisely why step 5 is one small payout.
- Re-register `RiseworksModule` per `03-…` §4 if a provider is needed at all — note Rise cannot
  actually send payments (`03-…` §4.1.3, never completed).

## Rules specific to this variant

- No new code, no fixes, no "while I'm here" — observation and execution only, EXCEPT for closing
  Entry criterion 0, which is a hard blocker discovered too late to fix inside a near-zero-dial
  cutover session and must be resolved (by a separate PORT session, or by Davin's explicit
  direction to fold a minimal fix into this order) before step 4 is trustworthy.
- Any red result = stop and document, never "probably fine".

## Deviations

_(should normally be empty; a deviation here is itself a warning sign)_

## Next-session handoff

\_(PRE-DRAFT `4a-w8-riseworks-archive.migration-order.md` at this session's close — VERIFY-RETIRE,
ARCHIVE not RETIRE, nothing deleted — per `04-rise-to-wise-migration-plan.md` §4 "4A-W8": apply
A4–A5 and every `03-…` §2.1–2.5 item, run the dormancy verification, entry-gated on Wise stable
since W7 for ≥1 successful funding cycle **and** ≥7 days.)
