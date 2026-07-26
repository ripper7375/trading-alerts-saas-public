# Migration Order — CONTRACT variant

> For sessions that **research, specify, audit or gap-analyse**. Read
> `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at **Medium**. The deliverable is a
> decision plus a frozen contract, not code.

**Session:** 4A-W1 · **Variant:** CONTRACT · **Status:** CONFIRMED (2026-07-26, Executor — entry criteria re-verified live, all pass; see Deviations)
**Generated:** 2026-07-25 (Advisor) · **Estimated time:** 2–3h
**Phase / plan section:** Phase 4A — money-service · **Part 19.5** (new): RiseWorks → Wise
disbursement. Inserted between 4A-7 (Slice 3 cutover) and 4A-8 (CC-C hardening gate) per Davin's
sequencing call, 2026-07-25. Suffix numbering per `00-SKELETON-AND-RULES.md` §5 — **no session
outside the W series is renumbered**; `4A-8` keeps its number, slot and scope.
**Rev 2 (2026-07-25):** `07-migration-process-change-proposal.md` inserts a new `4A-W4` (CC-C/CC-D
hardening) and renumbers _only within_ the W series. This order keeps the number `4A-W1`.
**Flags touched:** **F36** (resolve) · **F37** (resolve) · **F38, F39, F40, F41** (register OPEN) ·
**F42** (record RESOLVED). **F43** is registered later, in `4A-W4`.
⚠️ Write `F` for flags, `#` for CLAUDE.md Waiting-on items — `F37` and `#37` are different things.
**Target service:** money-service (no code this session) · **Contract:**
`docs/migration-orders/replace-rise-with-wise/part19.5-wise-disbursement-openapi.yaml` — this
session's job is to freeze it as law
**Code written this session:** **none.** No schema change. No money moved. Read-only API calls only.

---

## Why this session, why now

Davin is replacing **RiseWorks** with **Wise** as the final node of the affiliate-commission
disbursement chain. The Advisor has produced the design docset at
`docs/migration-orders/replace-rise-with-wise/` (files `00`–`07` + the OpenAPI spec). Two of its
decisions are **commercial, not technical**, and they change the _shape_ of the sessions that
follow:

1. **F36 — integration model.** Wise Business + personal API token (self-serve) vs a Wise Platform
   Enterprise partnership. This determines whether funding can ever be automated, and whether
   webhooks are profile-level or application-level.
2. **F37 — funding mode.** Davin has confirmed the account region is **Thailand**, which is _not_
   on Wise's API-funding allowlist (US, CA, AU, NZ, SG, MY only). If that stands, money cannot
   leave the Wise balance under program control and every payout cycle needs a human action.

Writing session 4A-W6's payout engine before these resolve guarantees rework. This session also
catches two things that would silently kill W6 much later and much more expensively:

- **Business Payment Approval rules.** Wise documents that approval rules configured on wise.com
  are _incompatible_ with API-created transfers — every transfer fails with _"Quote cannot be
  accepted with this request due to missing approval."_
- **Sandbox reality.** Wise's sandbox is UK-region and stable only for GBP/USD/EUR, so **the Thai
  (THB) payout route cannot be exercised end-to-end in sandbox at all.** Better known now than
  discovered in W6.

There is deliberately **no code** in this session. `00-SKELETON-AND-RULES.md` §1.5 (chain length
one) also means this is the _only_ Part 19.5 order that exists — W2…W8 live in the plan doc as a
roadmap and get PRE-DRAFTed one at a time.

---

## Entry criteria

_(verified at CONFIRM time, not assumed — `EXECUTOR-PROTOCOL.md` §1.3)_

- [x] **Session 4A-7 (Slice 3 read-APIs cutover) is CUT-OVER, or Davin has explicitly deferred it.**
      Davin's sequencing decision was "Wise work after 4A-7". If 4A-7 has not run, confirm with him
      before starting rather than assuming the deferral. — PASS: 4A-7b cut over both flag groups in
      production, 2026-07-26 (this order's own CONFIRM found the criterion transitioned from
      conditional/deferred at drafting time to genuinely true).
- [x] The docset exists and is readable: `docs/migration-orders/replace-rise-with-wise/`
      `00-README-PART-19.5-DOCSET.md`, `01-part-19.5-wise-disbursement-architecture-design.md`,
      `02-wise-platform-api-integration-reference.md`,
      `03-riseworks-archive-and-restore-runbook.md`, `04-rise-to-wise-migration-plan.md`,
      `05-artifact-amendments.md`, `06-part-19.5-file-inventory-PLANNED.md`,
      `07-migration-process-change-proposal.md`, `part19.5-wise-disbursement-openapi.yaml`. —
      PASS: all 9 present and read in full this session.
- [x] **A Wise business account exists and Davin can log into it.** — PASS (Davin, live).
- [x] **A Wise sandbox account exists** (`https://wise-sandbox.com`) with a sandbox API token
      available for a read-only call. If it does not exist, creating it is step 0 — flag the extra
      time rather than skipping the step. — PASS: `GET /v1/profiles` succeeded (see Deviations #5).
- [x] **Davin is available.** F36 and F37 are his decisions and cannot be inferred. — PASS.
- [x] The codebase claims in the design doc still hold — spot-check at least these five paths and
      line counts, and report any drift:
      `money-service/src/disbursement/providers/base-provider.ts` (174),
      `money-service/src/disbursement/providers/provider-factory.ts` (105),
      `money-service/src/disbursement/payment-orchestrator.service.ts` (333),
      `money-service/src/app.module.ts` (75),
      `prisma/non-market-data/schema.prisma` (1023). — PASS, zero drift (see Deviations #1, #7 —
      the order file's own numbers were themselves found drifted at CONFIRM and corrected by Davin
      before this criterion could be marked passed).

**A failed entry criterion means do not start** — propose the fix or the session swap
(`EXECUTOR-PROTOCOL.md` §1.4).

---

## Integration points

- **In:** Davin's decisions (F36, F37); Wise's live documentation; the Wise account UI.
- **Out:** two resolved flags, four registered flags, one frozen OpenAPI contract, one frozen state
  table, the secret-matrix additions, and a PRE-DRAFT for 4A-W2.
- **Owns:** nothing at runtime. This session creates no code, no tables, no routes.

---

## Ordered steps

_(each step carries its own verification)_

### 1. Read the docset, in order

Read `00` → **`07`** → `01` → `02` → `04`. Skim `03`, `05`, `06` (executed in later sessions).
`07` is read second because it explains why `4A-W4` exists, why the W series was renumbered, and
which of its seven changes Davin approved — everything after it assumes that outcome.
**Verification:** you can answer, without re-reading, (a) why funding is modelled as a batch
_state_ rather than a method call, (b) which single component is allowed to mark a commission
`PAID`, and (c) what `balanceAppliedAt` protects against. If any answer is unclear, re-read §3.4,
§5.3 and §5.4 of `01-…` before proceeding — everything downstream depends on those three.

### 2. Check the Wise business account for Payment Approval rules — **hard gate**

With Davin, in the Wise UI, check whether any Business Payment Approval rule is configured.
**Verification:** record **present** or **absent** explicitly in this order's Deviations and in
CLAUDE.md. If present, record Davin's decision on removing it (and note that until it is removed,
session 4A-W6's transfers will fail 100% of the time). Do **not** change the setting yourself —
it is his account and a money control.

### 3. Resolve F36 (integration model) with Davin

Present the Model A / Model B table from `01-…` §2. Note explicitly what Model A costs: one manual
funding action per payout cycle, forever, given the Thailand region.
**Verification:** a `DECISION-LOG.md` entry using the block in `05-…` §2b, with Davin's own words
quoted. If he stays undecided, that is a **valid** outcome — record F36 as OPEN with "design for
both" as the standing instruction, and proceed; the architecture already tolerates it.

### 4. Resolve F37 (funding mode) with Davin

Confirm the account region and therefore the funding mode.
**Verification:** `DECISION-LOG.md` entry (block in `05-…` §2b), and the chosen value of
`WISE_FUNDING_MODE` recorded. Expected outcome given Thailand: `MANUAL`. If Davin says the account
is (or will be) in an allowlisted country, verify it in the Wise UI before recording `API` — this
is exactly the kind of assumption that costs a whole session later.

### 5. Bootstrap Wise identity — read-only

Using the **sandbox** token: `GET https://api.wise-sandbox.com/v1/profiles` with
`Authorization: Bearer <sandbox token>`.
**Verification:** the call returns 200; record the business `profileId` (→ `WISE_PROFILE_ID`
sandbox value) and the profile type. **Print no token, ever** — not in a command echo, not in a
log, not in this order. If Davin also supplies a production read-only token, repeat and record the
production `profileId` separately.

### 6. Confirm the source-currency question

Determine which balance currency payouts are funded from (`WISE_SOURCE_CURRENCY`) and whether such
a balance exists on the account. Commissions are denominated in USD (`MINIMUM_PAYOUT_USD = 50`),
Wise pays out in the affiliate's local currency, so the source currency drives every quote.
**Verification:** value recorded; the existence of that balance confirmed with Davin (a balance
that does not exist makes W6's E2E impossible).

### 7. Register F38, F39, F40, F41 as OPEN

Use the flag-register rows in `05-…` §2a. Each needs an owner and a due session:
F38 → Davin, 4A-W2 · F39 → Davin, 4A-W3 · F40 → technical (follows F36), 4A-W5 · F41 → Davin, 4A-W3.
**Verification:** all four rows present in `DECISION-LOG.md`'s flag-register table.

### 8. Record F42 as RESOLVED

Use the F42 block in `05-…` §2b verbatim — including the material finding that
`RisePaymentProvider` was never completed, so restoring the archive is _not_ the same as being able
to pay via RiseWorks.
**Verification:** entry present; and
`docs/migration-orders/4a-5-rw-money-service-riseworks-webhook-cutover.migration-order.md`'s header
status changed to **REVOKED** with the date and reason. **Keep the file** — order files are the
audit trail.

### 9. Freeze the two contracts

1. Review `part19.5-wise-disbursement-openapi.yaml` against the live codebase: confirm the guard
   names (`JwtAuthGuard`, `AdminGuard`, `AffiliateGuard`), the `/v1` prefix behaviour in
   `main.ts` (51 lines), and that no declared path collides with an existing route
   (`/v1/webhooks/dlocal`, `/v1/webhooks/riseworks`, `/v1/affiliate/dashboard/*`, `/v1/admin/*`).
   Correct any drift, then mark its `info.description` **"Status: CONTRACT (frozen at 4A-W1)"**.
2. Mark the state-mapping table in `01-…` §5.2 as **invariant** — changing a row later requires a
   Deviation with written justification.

**Verification:** both marked; the route-collision check performed by listing money-service's
registered routes (boot it locally, or read the controllers) rather than by memory.

### 10. Secret matrix + token strategy

Add every `WISE_*` variable from `06-…` §8 to the Session 0-4 secret matrix.
**Verification:** the matrix names each variable, its sensitivity, and — for `WISE_API_TOKEN` — the
promotion plan: **read-only for W3/W5, full access only from W6**. Record the rationale: a leak
during recipient/webhook development then cannot move money.

### 11. Note the sandbox limitation explicitly

Record, in this order's Deviations and in the W2 PRE-DRAFT, that **THB cannot be tested end-to-end
in sandbox** (Wise's sandbox is UK-region, stable for GBP/USD/EUR only). Consequences:
W3 must fetch the real THB account-requirements schema from **production** (read-only, no money),
W6's E2E runs on a sandbox-supported currency pair, and W7's single smoke payout is the first real
proof of the THB route.
**Verification:** stated in both places, with the source URL from `02-…` §10.

### 12. Close per `EXECUTOR-PROTOCOL.md` §3

Apply the artefact blocks listed in `05-…` §9 for 4A-W1 (CLAUDE.md §1a–1d, DECISION-LOG §2a/§2b,
playbook §4, prompt script §5). Then PRE-DRAFT `4a-w2-wise-additive-schema.migration-order.md`
using `TEMPLATE-INFRA.md` + PORT rules, seeded from `04-…` §4 (4A-W2).
**Verification:** every artefact updated; the W2 PRE-DRAFT exists with status `PRE-DRAFT`; the
playbook and `SESSION-PROMPT-SCRIPT.md` agree about which sessions exist
(`00-SKELETON-AND-RULES.md` §5).

---

## Done when

- [x] **F36** has a `DECISION-LOG.md` entry — resolved, or explicitly recorded OPEN with
      "design for both" as the standing instruction. — RESOLVED (Model A), not left OPEN.
- [x] **F37** is RESOLVED with the region evidence and the chosen `WISE_FUNDING_MODE`. — `MANUAL`.
- [x] **F38, F39, F40, F41** appear in the flag register as OPEN with owners and due sessions.
- [x] **F42** is RESOLVED; the `4A-5-RW` order file is marked **REVOKED** and retained.
- [x] Business Payment Approval status recorded as **present** or **absent**, with Davin's decision
      if present. — Absent.
- [x] `GET /v1/profiles` succeeded against sandbox; `WISE_PROFILE_ID` recorded; **no token value
      appears anywhere** in the transcript, logs or artefacts. — `29617748` (business).
- [x] `WISE_SOURCE_CURRENCY` decided and the corresponding balance's existence confirmed. — `USD`.
- [x] The OpenAPI spec is corrected against the live codebase, route-collision-checked, and marked
      frozen; the §5.2 state table is marked invariant.
- [x] All `WISE_*` variables are in the Session 0-4 secret matrix, with the read-only → full token
      promotion plan written down.
- [x] The THB sandbox limitation is recorded in Deviations and carried into the W2 PRE-DRAFT.
- [x] CLAUDE.md, DECISION-LOG.md, the playbook and `SESSION-PROMPT-SCRIPT.md` all updated and
      mutually consistent.
- [x] `4a-w2-…migration-order.md` exists at status `PRE-DRAFT`.
- [x] **Nothing was built, migrated, deployed or paid.** `git diff --stat` shows changes to
      documentation and order files only.

---

## Rollback

None required. This session is read-only with respect to code, schema, infrastructure and money.
The only mutations are documentation commits, each individually revertable with `git revert`.

If step 2 or step 5 reveals that the Wise account is not usable at all (no business account, no
sandbox, approval rules Davin will not remove), the correct outcome is **stop and record the
blocker in CLAUDE.md "Waiting on"** — not to proceed to W2. Part 19.5 cannot start on an
unusable account.

---

## Rules specific to this variant

- **No code.** If a question can only be answered by writing code, that is a finding for W2/W3, not
  work for this session.
- **No token values, anywhere.** Verify secrets' _presence_ value-blind. Never run
  `railway variables --kv` — that is precisely how `DLOCAL_WEBHOOK_SECRET` reached a session
  transcript in Session 4A-5.
- **Read-only Wise calls only.** `GET /v1/profiles`, and at most a `GET` of account requirements.
  No quote creation, no recipient creation, no transfer, no funding.
- **Do not change settings in Davin's Wise account.** Observe and report; he clicks.
- **Wise's live docs outrank `02-…`.** If they disagree at CONFIRM time, the live docs win — record
  the difference as a Deviation and correct `02-…`.

---

## Deviations

_(filled DURING execution — what / why / impact. An empty Deviations section starves the next
plan — `00-SKELETON-AND-RULES.md` §1.1.)_

**Expected entries this session, at minimum:**

- Business Payment Approval status: present / absent, and Davin's decision.
- The THB-not-testable-in-sandbox finding and its consequences for W3/W6/W7.
- Any drift between the design doc's cited paths/line counts and the live codebase.
- Any place where Wise's live documentation contradicts `02-wise-platform-api-integration-reference.md`.

**Actual entries, filled during execution (2026-07-26):**

1. **CONFIRM-time finding: the order file itself was mid-edit, uncommitted.** `git status`
   showed this file modified-but-uncommitted; `git diff` against the last commit (`b5f5dbea`)
   showed the header flipped `DRAFT → APPROVED` with no Advisor/Davin approval commit trail,
   and — independently — all five entry-criteria line-count numbers shifted by exactly `+1`
   away from both the committed version and the live codebase (174→175, 105→106, 333→334,
   75→76, 1023→1024), plus a sixth non-entry-criterion number in the Next-session handoff
   (`transaction.service.ts` 310→311). This matches `LESSONS-LEARNED.md` L11's pattern
   (self-contradicting/uncommitted order status, 4 prior recurrences) — stopped and reported
   to Davin rather than trusting or silently correcting. Davin confirmed live: the
   `DRAFT→APPROVED` edit was his own intentional approval; he separately restored all five
   line-count numbers to the correct `wc -l` baseline before saying go. Re-verified live
   post-fix: `git diff` showed only the Status field changed, all five numbers matched `wc -l`
   exactly. No new LESSONS-LEARNED entry — this is L11's existing pattern, not a new one.
2. **Business Payment Approval rules: absent.** Davin confirmed live, no rule configured on
   the Wise business account. No action needed before 4A-W6; must be re-checked at 4A-W6 and
   4A-W7 per the risk register (`04-…plan.md` §5), since account settings can change.
3. **F36 resolved to Model A**, not left OPEN as "design for both." Davin's 2026-07-25
   position (recorded in `00-README-…md` §3) was undecided; asked again live this session, he
   chose **Model A — Business + personal API token** explicitly. This does not change F37's
   outcome (Thailand's regional gate forces `MANUAL` funding under either model on a
   non-allowlisted account), but it does fix F40's webhook subscription level as
   **profile-level** and rules out pursuing a Wise Platform Enterprise partnership.
4. **F37 resolved: `MANUAL`.** Davin re-confirmed live the account region is still Thailand.
5. **Sandbox identity bootstrapped without any token entering this session.** Per this
   order's own "no token values, anywhere" rule, Davin ran `GET https://api.wise-sandbox.com/v1/profiles`
   himself outside this chat and pasted back only the response body. Business profile:
   `id: 29617748`, `type: business` (a sibling personal profile `29617747` also exists on the
   same sandbox account — not the one recorded as `WISE_PROFILE_ID`).
6. **`WISE_SOURCE_CURRENCY` = `USD`**, balance confirmed by Davin to exist on the account.
7. **No drift found** between the design doc's cited paths/line counts and the live codebase
   once the order file's own numbers were corrected back to baseline (see item 1) — all five
   entry-criterion paths exist, all five line counts match exactly (174/105/333/75/1023).
8. **No Wise live-documentation contradiction found** — `02-…integration-reference.md` was
   read in full; nothing in it was checked against Wise's live docs this session beyond what
   the reference file itself already cites with source URLs (no new endpoint was called
   except the read-only `GET /v1/profiles` in item 5).
9. **THB cannot be tested end-to-end in sandbox** (Wise's sandbox is UK-region, stable only
   for GBP/USD/EUR — `02-…md` §10). Consequences: `4A-W3` must fetch the real THB
   account-requirements schema from **production** (read-only, no money); `4A-W6`'s E2E runs
   on a sandbox-supported currency pair (GBP/USD/EUR); `4A-W7`'s single smoke payout is the
   first real proof of the THB route. Carried into the `4A-W2` PRE-DRAFT below and into
   CLAUDE.md Waiting-on #44.

---

## Known wrinkles / do-not-touch

- **`lib/api/index.ts`** — known-broken by design until Phase 7. Do not touch.
- **RiseWorks source, schema and rows** — F42: archived, never deleted. This session touches
  RiseWorks only to mark the `4A-5-RW` order REVOKED.
- **Slice 2's open monitoring caveat** (CLAUDE.md Waiting-on #38): the first live post-flip **dLocal**
  webhook has still not been observed. Different provider; does not block this session; do not
  confuse it with Wise work when reading Railway logs.
- **CLAUDE.md Waiting-on #35** — `migration-stack-analysis.md`'s money-service section was never
  backfilled after Session 4A-1. Part 19.5 appends its own entries only; the full regeneration is
  an 8.6-only task. Do not attempt it here.
- **`sync-riseworks-accounts`** is one of the 8 crons already cut over in Session 4A-3 and currently
  errors every run (because `RisePaymentProvider.getPayeeInfo` throws). Silencing it is a **W8**
  step, not this session's — resist the drive-by fix.
- **money-service dependency budget:** no new npm packages are needed for Part 19.5 (Node ≥ 20
  gives global `fetch`; `crypto` is built in; `bullmq`/`@nestjs/bullmq`/`ioredis` are already
  dependencies). If a later session proposes `axios`/`undici`, that is scope creep.

---

## Next-session handoff

_(PRE-DRAFT `4a-w2-wise-additive-schema.migration-order.md` at this session's close — variant
`TEMPLATE-INFRA.md` + PORT rules, seeded from `04-rise-to-wise-migration-plan.md` §4 (4A-W2). It
must carry, at minimum:_

- _**Note the rev-2 session sequence so nothing is lost downstream:** W1 → W2 → W3 → **W4 (new:
  CC-C/CC-D hardening — closes the plan §13 money gate, fixes two pre-existing defects on live
  code)** → W5 (webhook) → W6 (payout engine) → W7 (cutover) → W8 (archive). W2 does **not** touch
  W4's scope; it only needs to know W4 exists so its own handoff points at it._

- _**`LESSONS-LEARNED.md` L1 as a first-class step:** the migration is authored in
  `prisma/non-market-data/schema.prisma` only; money-service gets a hand-mirrored subset and
  `prisma generate` — never `db push` or `migrate deploy`._
- _**Read the generated SQL by eye before applying.** It must contain only `CREATE TABLE` ×5,
  `CREATE INDEX` ×n and `ALTER TYPE "DisbursementProvider" ADD VALUE 'WISE'`. Any `DROP`,
  `RENAME` or `ALTER COLUMN` aborts the session — that would be an F42 violation._
- _**Prove the `money_svc` role can read and write all 5 new tables with an actual query.** New
  tables do not inherit grants; a grant listing can lie by omission. This is the most likely
  silent failure of that session._
- _**Davin present** — production schema change (`EXECUTOR-PROTOCOL.md` §7)._
- _**Record the before/after row counts** for `AffiliateRiseAccount` and `RiseWorksWebhookEvent` as
  F42 evidence._
- _**Resolve F38** (fee bearer + quote amount direction) — it determines the semantics of
  `WiseTransfer.feeBearer`/`feeAmount`._
- _**Carry forward design §3.5** (verified against the live code 2026-07-25, fix lands in W6, but W2
  should record it so it is not rediscovered): `transaction.service.ts` (310 lines, ≈line 80)
  derives the payee reference from `commission.affiliateProfile?.riseAccount?.*`, and
  `payment-orchestrator.service.ts` (≈line 117) then does
  `affiliateId: txn.affiliateRiseAccount?.affiliateProfileId || ''` — so a Wise transaction, which
  has no Rise account, gets `affiliateId = ''` and `riseId = ''` **silently**. Fix by resolving from
  `Commission.affiliateProfileId`. Conversely, `amountRiseUnits` is **already** correctly branched
  (`provider === 'RISE' ? usdToRiseUnits(...) : null`) and every reader is already null-safe — so
  there is no null-tolerance audit to do, only a UI-labelling task in W6 (the admin pages show a
  "Rise ID" column that should show the Wise transfer id for Wise rows)._
- _The THB sandbox limitation carried forward from this session's Deviations.)_
