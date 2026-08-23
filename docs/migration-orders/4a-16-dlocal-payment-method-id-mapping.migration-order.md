# Migration Order — Session 4A-16 — dLocal Payment Method ID Mapping & Recutover

> For **cutovers, deletions, and exit reviews** combined with a small PORT-style fix: read
> `00-SKELETON-AND-RULES.md` first — §4 applies. This session mirrors the exact shape of Session
> 4A-14 (`4a-14-dlocal-write-api-group-b-cutover.migration-order.md`) — a small symmetrical PORT
> fix (dial **Low**) plus a CUTOVER block (dial **near zero**) — because it is that session's own
> direct continuation: 4A-14 fixed **F49** and reached dLocal's real Payins API for the first
> time, which immediately unmasked **F76** on the very next line of the same request. **PRE-DRAFTed
> by the Executor ad-hoc, following Session 10-3's own close (2026-08-24)**, per Davin's direct
> instruction correcting Phase 10's next-session handoff: `MASTER-ROADMAP-PHASES-7-15.md`'s own
> Phase 4X gate ("all four of 4A-13/14/15/16 CLOSED before Session 8-1 opens") is not yet met —
> 4A-16 has never been numbered or drafted until now, and must run and close before Session 8-1
> (already PRE-DRAFTed as `8-1-deletion-sweep.migration-order.md`) can open.
> Closes `DECISION-LOG.md` **F76** (OPEN) and completes `migration-cutover-table.md` Slice 4 to
> 4/4 write-API groups — the last open item in Phase 4X.

**Session:** 4A-16 (dLocal Payment Method ID Mapping & Recutover) · **Variant:** PORT + CUTOVER ·
**Status:** PRE-DRAFT
**Generated:** 2026-08-24 (Executor, ad-hoc, post-10-3) · **Flags touched:** F76 (OPEN → target
RESOLVED), `MIGRATE_WRITE_APIS_MONEY_DLOCAL` (`false` → target `true`)
**Estimated time:** ~2–3h if the blocking data dependency below is already in hand at session
open; open-ended if it still needs to be obtained.
**Target service:** monolith `lib/dlocal/{payment-methods,dlocal-payment}.service.ts` +
money-service `money-service/src/dlocal/{payment-methods,dlocal-payment}.service.ts` (both sides —
pre-existing bug, confirmed byte-for-byte identical on both sides, same class as F48/F49).

---

## The one blocking item — not resolved here, cannot be resolved from documents alone

**F76's own root-cause entry (`history/decisions-archive.md`) already says this explicitly: "obtain
dLocal's real, current list of valid `payment_method_id` codes per supported country (from dLocal's
dashboard/docs — not guessed)."** Neither the Executor nor the Advisor has dLocal merchant-portal
access. Live-code inspection this session found the bug's exact shape but **found no source of
truth for the real codes anywhere in this repo** — `lib/dlocal/constants.ts` /
`money-service/src/dlocal/dlocal.constants.ts` (byte-for-byte identical, 18 display-name payment
methods across the 8 supported countries) only ever held human-readable names (`'TrueMoney'`,
`'UPI'`, `'GoPay'`, …), and even the original build spec
(`docs/open-api-documents/part-18-dlocal-payment-openapi.yaml:820`) uses `payment_method_id: UPI`
as its own example — the bug predates this migration entirely, baked into the spec itself.

**This session cannot reach Step 1 until Davin (or whoever holds dLocal merchant-dashboard access)
supplies the real method code per display name.** The roadmap's own illustrative examples (`TM`,
`TH_QR`, `MOMO`, etc., `MASTER-ROADMAP-PHASES-7-15.md` §"Phase 4X") are **unconfirmed placeholders
from the roadmap's own prose, not verified against dLocal's real docs** — do not treat them as
ground truth. The table below is a **template with the display names this codebase already uses on
both sides** — fill in the `Real dLocal code` column from dLocal's own dashboard/API reference
before this order can leave PRE-DRAFT:

| Country | Display name (this codebase) | Real dLocal `payment_method_id`                                                                                                                                               |
| ------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IN      | UPI                          | _(needed)_                                                                                                                                                                    |
| IN      | Paytm                        | _(needed)_                                                                                                                                                                    |
| IN      | PhonePe                      | _(needed)_                                                                                                                                                                    |
| IN      | Net Banking                  | _(needed)_                                                                                                                                                                    |
| NG      | Bank Transfer                | _(needed)_                                                                                                                                                                    |
| NG      | USSD                         | _(needed)_                                                                                                                                                                    |
| NG      | Paystack                     | _(needed)_                                                                                                                                                                    |
| PK      | JazzCash                     | _(needed)_                                                                                                                                                                    |
| PK      | Easypaisa                    | _(needed)_                                                                                                                                                                    |
| VN      | VNPay                        | _(needed)_                                                                                                                                                                    |
| VN      | MoMo                         | _(needed)_                                                                                                                                                                    |
| VN      | ZaloPay                      | _(needed)_                                                                                                                                                                    |
| ID      | GoPay                        | _(needed)_                                                                                                                                                                    |
| ID      | OVO                          | _(needed)_                                                                                                                                                                    |
| ID      | Dana                         | _(needed)_                                                                                                                                                                    |
| ID      | ShopeePay                    | _(needed)_                                                                                                                                                                    |
| TH      | TrueMoney                    | _(needed — this is the exact method that failed live at 4A-14, `5010 Method not available`)_                                                                                  |
| TH      | Rabbit LINE Pay              | _(needed)_                                                                                                                                                                    |
| TH      | Thai QR                      | _(needed)_                                                                                                                                                                    |
| ZA      | Instant EFT                  | _(needed)_                                                                                                                                                                    |
| ZA      | EFT                          | _(needed)_                                                                                                                                                                    |
| TR      | Bank Transfer                | _(needed — TR reuses NG's display name; confirm whether dLocal's real code differs per country)_                                                                              |
| TR      | Local Cards                  | _(needed — likely NOT a redirect flow like the other 21; re-confirm `payment_method_flow: 'REDIRECT'` still applies, or whether this one needs `'DIRECT'` — see Rules below)_ |

If a full 18-row mapping isn't available before this session must run, the narrower alternative is
cutting over only the countries/methods with a confirmed real code and leaving the rest on the
monolith's native (broken but unchanged) path — a scope decision for the Advisor's `Decisions
taken`, not assumed here.

---

## Why this session exists

Slice 4 (Write APIs) has stood at 3/4 groups since Session 4A-10b/10c (2026-07-30): Stripe, Admin,
and Disbursement are live; dLocal (Group B) is blocked. The blocking history:

- **F48** (dLocal outbound signing wrong) — RESOLVED, Session 4A-10c.
- **F49** (missing `payment_method_flow`) — RESOLVED, Session 4A-14 (2026-08-21).
- **F76** (this session's target) — unmasked the instant F49's fix reached dLocal's real API:
  `400 {"code":5010,"message":"Method not available"}` on a live, Davin-authorized TH/TrueMoney
  test-mode checkout. `createPayment()` sends `payment_method_id: request.paymentMethod` verbatim
  (`lib/dlocal/dlocal-payment.service.ts:67`, identical in money-service) — a human-readable
  display name, not dLocal's real internal method code.

`MIGRATE_WRITE_APIS_MONEY_DLOCAL` has stayed `false` in production since 4A-14's own rollback
(2026-08-21), re-confirmed live at Session 9-6's CONFIRM (2026-08-22). Fixing F76 is a genuine,
pre-existing production bug fix (the monolith's own native route has the identical bug while
serving 100% of real dLocal traffic) that also unblocks the final group of Slice 4, satisfying
`MASTER-ROADMAP-PHASES-7-15.md`'s Phase 4X gate for Session 8-1.

---

## Entry criteria (re-verify all at CONFIRM)

- [ ] **The blocking mapping table above is filled in with real, dLocal-confirmed codes** — not
      the roadmap's own placeholder examples. Do not open this session without it.
- [ ] `DECISION-LOG.md` **F76** reviewed directly — confirm still OPEN, scope unchanged since
      2026-08-21.
- [ ] **Git drift check**: confirm zero commits have touched `lib/dlocal/` or
      `money-service/src/dlocal/` since 4A-14's own close commit (re-run the same check 4A-14 did
      against its own prior session, don't assume "probably nothing changed").
- [ ] **Baseline test suites 100% green**, re-measured fresh at CONFIRM (do not trust this
      PRE-DRAFT's own numbers if a session has run in between): monolith `test:ci`, `operation-service`,
      `money-service` — as of this PRE-DRAFT's own writing (2026-08-24, Session 10-3's own close):
      153/153 suites·2198/2198 tests, 42/42·395/395, 62/62·526/526.
- [ ] **`DLOCAL_API_KEY` presence re-checked, value not assumed usable.** At 4A-14's own CONFIRM
      (2026-08-21) this key was present but empty in `.env.local` — no real sandbox path existed,
      forcing 4A-14 to substitute unit-test evidence for live sandbox proof (its own Deviation 4).
      A presence-only check at this PRE-DRAFT's own writing shows the key now has _some_ value in
      `.env.local` — re-verify at CONFIRM whether it's a genuine usable sandbox credential (without
      printing it, per `LESSONS-LEARNED.md` L4) before assuming real sandbox verification is
      possible this time.
- [ ] **Orphaned `Payment` row from 4A-14's own failed attempt still outstanding**
      (`cmt2yflxe00000fnw8gy7jm53`, `PENDING`, TH/TrueMoney) — not this session's job to fix, but
      confirm at CONFIRM whether Davin has cleaned it up separately; if not, flag again rather than
      silently re-flag the same row a third time without visibility.
- [ ] **Davin present and available** — cutover flag-flip requires his live approval
      (`EXECUTOR-PROTOCOL.md` §7).
- [ ] **Scope isolation confirmed** — Stripe/Wise/outbox/RiseWorks untouched this session.

---

## Ordered Steps

### Step 1: Implement the mapping in `money-service` (Commit 1)

- In `money-service/src/dlocal/payment-methods.service.ts`: add an exported mapping (e.g.
  `DLOCAL_METHOD_CODE_MAP: Record<DLocalCountry, Record<string, string>>` or a flat
  `getDLocalMethodCode(country, displayName): string`) built from the filled-in table above.
- In `money-service/src/dlocal/dlocal-payment.service.ts`: change `createPayment()`'s
  `payment_method_id: request.paymentMethod` (line 67-equivalent) to look up the real code via the
  new mapping function, throwing a clear error if a display name has no mapped code (fail loud, not
  silently send a display name again).
- Update `money-service/src/dlocal/payment-methods.service.spec.ts` and
  `dlocal-payment.service.spec.ts` with real-fetch-path assertions on the mapped
  `payment_method_id` — reuse 4A-14's own `jest.resetModules()` + dynamic `require()` pattern
  (`LESSONS-LEARNED.md`-worthy finding from that session: both spec files short-circuit into a
  mock whenever `NODE_ENV === 'test'`, so a naive assertion on the existing mock never exercises
  the real outbound body).
- Run `pnpm --filter money-service test`, all suites green.
- Commit: `fix(money-service): map display-name payment methods to real dLocal method codes (F76)`

### Step 2: Symmetrical fix in the monolith (Commit 2)

- Same shape in `lib/dlocal/payment-methods.service.ts` and `lib/dlocal/dlocal-payment.service.ts`
  — identical mapping table, identical lookup-and-throw behavior.
- Update `__tests__/lib/dlocal/*.test.ts` with the equivalent real-fetch-path assertions.
- Run `pnpm test:ci`, all suites green.
- Commit: `fix(monolith): map display-name payment methods to real dLocal method codes (F76)`

### Step 3: Full validation

- `tsc --noEmit` clean; `npx eslint app components lib hooks --max-warnings <baseline>` (per
  `LESSONS-LEARNED.md` L38 — `next lint`/`npm run lint` don't work on this Next.js version, call
  `eslint` directly).
- `test:ci` (monolith) + `test` (`operation-service`, `money-service`) all green, exact counts
  re-verified against this order's own Entry Criteria baseline.
- Deploy `money-service` to Railway; verify `Online` via a direct `GET /health`, not log-reading
  (`LESSONS-LEARNED.md` L13).

### Step 4: Sandbox verification

- If `DLOCAL_API_KEY` is confirmed usable (see Entry Criteria): make a real sandbox
  `createPayment()` call for at least the TH/TrueMoney case that failed live at 4A-14, confirming
  `200/201` + a real `redirect_url`, not `5010`.
- If not usable: same fallback 4A-14 used — real-fetch-path unit-test evidence, with the residual
  uncertainty disclosed to Davin explicitly before proceeding, not treated as equivalent to live
  sandbox proof.
- Davin runs a Money-Audit query on the dLocal write path (`createPayment`, auth headers,
  idempotency lock, `Payment` record creation) before authorizing the flag flip.

### Step 5: Cutover flag flip `⚠ NEEDS EXPLICIT SIGN-OFF`

- Davin gives explicit live authorization (`EXECUTOR-PROTOCOL.md` §7).
- Set `MIGRATE_WRITE_APIS_MONEY_DLOCAL=true` on Vercel production; redeploy (env var changes need
  a fresh deployment to take effect on already-running Vercel functions — 4A-14's own Deviation 3).

### Step 6: Live smoke test

- Execute a real test-mode payment through `/api/checkout/dlocal` (or the frontend flow) for the
  TH/TrueMoney case specifically (the one that failed at 4A-14), plus at least one other country if
  time allows.
- Verify: monolith forwards to `money-service`; `money-service` logs `201 Created` with a valid
  `paymentId`/`paymentUrl`; **no** `5010 Method not available`; `Payment` row created `PENDING`,
  no orphaned duplicate.

### Step 7: Session Close-out (Executor at CLOSE)

- Update `migration-cutover-table.md`: Slice 4 → **CUT-OVER (4/4 groups)**.
- Record `DECISION-LOG.md` **F76** as `RESOLVED`; move full entry to `history/decisions-archive.md`.
- Update `CLAUDE.md` state block per `EXECUTOR-PROTOCOL.md` §3 — this closes Phase 4X in full
  (4A-13/14/15/16 all CLOSED), which is Session 8-1's own blocking entry criterion.
- Harvest any lesson into `LESSONS-LEARNED.md`.
- Re-confirm (do not re-PRE-DRAFT) `8-1-deletion-sweep.migration-order.md` — it already exists,
  PRE-DRAFTed at Session 10-3's close, and its own Entry Criteria already anticipate this closure;
  it needs its "Phase 4X CLOSED" checkbox flipped true, not a fresh document.

---

## Rollback

- **Primary Rollback (0ms):** Set `MIGRATE_WRITE_APIS_MONEY_DLOCAL=false` on Vercel production.
  Traffic immediately reverts to the monolith's native route handler with zero downtime — same
  handler, same underlying bug, but no regression versus current production behavior.
- **Code Rollback:** `git revert` the Step 1/2 commits if the mapping proves wrong for any method.

---

## Rules specific to this variant

- **Do not guess a method code.** A wrong-but-plausible-looking code is worse than the current
  display-name bug — dLocal could silently accept a _different_ real method than the user selected
  rather than cleanly rejecting with `5010`. Every row in the mapping table must trace to a real
  dLocal source, cited in this order's own Deviations when filled in.
- **TR's "Local Cards" may not be a redirect flow** — every other method in this codebase assumes
  `payment_method_flow: 'REDIRECT'` (4A-14's own Decision 1). Confirm this against dLocal's docs
  before assuming it's safe to leave unconditional; if it needs `'DIRECT'`, that is card-capture
  scope explicitly out of bounds per 4A-14's own Rules ("No card-capture / DIRECT-flow branching")
  — narrow this session's cutover to exclude TR/Local Cards rather than silently expanding scope.
- **Preserve idempotency locks:** do not alter `acquireCreatePaymentLock`'s 30s Redis dedupe logic.
- **Any failure = stop and revert flag**, exactly as 4A-14's own rule states — a newly-unmasked bug
  found live is its own correctly-scoped finding for a future session, never a reason to keep
  patching deeper into a live money path in the same session (`LESSONS-LEARNED.md` L11).

---

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->

---

## Next-session handoff

- **Next session:** `8-1` — Deletion sweep (Phase 8A). **Already PRE-DRAFTed**
  (`8-1-deletion-sweep.migration-order.md`, Session 10-3's close) — do not re-draft it. Once this
  session closes, re-verify its "Phase 4X CLOSED" entry criterion is now true and proceed to its
  own DRAFT/APPROVED/CONFIRMED lifecycle. Its own PRE-DRAFT separately flags an unresolved scope
  question (F65's BFF-retention resolution narrowing what "delete migrated `app/api/**`" actually
  means) — unrelated to this session, still needs the Advisor's resolution at 8-1's own DRAFT.
