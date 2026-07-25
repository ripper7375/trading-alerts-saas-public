# Part 19.5 — Wise Disbursement: Advisor Docset (index & reading order)

**Role of this docset:** produced by the **Advisor** (Claude Cowork) on **2026-07-25** at Davin's
request, to (a) design the replacement of **RiseWorks** with **Wise** as the final node of the
affiliate-commission disbursement chain, and (b) align that design to the in-progress
monolith → microservices migration (Phase 4A, money-service).

**Role of the reader:** the **Executor** (Claude Code). This docset is _background and design law_ —
it is **not** an order. Only a `*.migration-order.md` with status `APPROVED` may be executed
(`EXECUTOR-PROTOCOL.md` §1, `00-SKELETON-AND-RULES.md` §1). Exactly one order accompanies this
docset — see §4 below.

---

## 1. What "Part 19.5" means

Part 19 (`riseworks/Part-19/**`, inventories `docs/files-completion-list/files-inventory/part19{a,b,c,d}-files-completion.md`)
built the disbursement system around **RiseWorks** (blockchain/USDC, SIWE auth, HMAC webhooks).

**Part 19.5 supersedes Part 19's _provider layer only_.** Everything Part 19 built above the
provider boundary — commission aggregation, batch lifecycle, payout thresholds, transaction
records, audit logs, admin UI shell, the 2 disbursement crons — is **retained and reused**. What
changes is:

| Layer              | Part 19 (RiseWorks)                                  | Part 19.5 (Wise)                                                                                  |
| ------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Payee identity     | `riseId` (blockchain address) + RiseWorks KYC invite | Wise **recipient account** (`recipientId`) created from dynamic account requirements              |
| Money rail         | USDC, integer `1e6` units                            | Local-currency bank payout, decimal major units + FX                                              |
| Payment call       | single `sendBatchPayment`                            | **quote → recipient → transfer → fund** (4 calls), optionally wrapped in a **batch group**        |
| Funding            | implicit (team wallet)                               | **explicit, separate step** — and _not automatable in Thailand_ (see §3)                          |
| Webhook auth       | HMAC-SHA256 hex, `x-rise-signature`                  | **RSA-SHA256 base64**, `X-Signature-SHA256`, verified against Wise's published public key         |
| Webhook dedupe     | none (insert-always)                                 | **`X-Delivery-Id`** unique key + **`data.occurred_at`** ordering (Wise delivers out of order)     |
| Terminal semantics | `payment.completed` / `payment.failed`               | 10 states with **rollback transitions** (`outgoing_payment_sent → bounced_back → funds_refunded`) |

**RiseWorks is archived, not deleted** — Davin's explicit instruction, 2026-07-25:

> "I want I keep Riseworks but make it inactive (achieve) but could be restored when needed"

Recorded as flag **F42** (RESOLVED). The mechanics live in `03-riseworks-archive-and-restore-runbook.md`.

---

## 2. Reading order

| #      | Document                                                | Read it when                                                                                                                                                                                                                                                                      |
| ------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 00     | **this file**                                           | first — orientation, decisions, what is and isn't an order                                                                                                                                                                                                                        |
| 01     | `01-part-19.5-wise-disbursement-architecture-design.md` | before writing any code — the design law: interfaces, data model, state machine, funding gate, security                                                                                                                                                                           |
| 02     | `02-wise-platform-api-integration-reference.md`         | while writing the Wise client — verified endpoints, payloads, statuses, keys, limits, sandbox simulation                                                                                                                                                                          |
| 03     | `03-riseworks-archive-and-restore-runbook.md`           | at session 4A-W7/W8 — how to deactivate Rise without deleting it, and how to bring it back                                                                                                                                                                                        |
| 04     | `04-rise-to-wise-migration-plan.md`                     | to understand the session sequence, gates and rollbacks (4A-W1 … 4A-W8)                                                                                                                                                                                                           |
| 05     | `05-artifact-amendments.md`                             | at every W-session close — paste-ready text for CLAUDE.md, DECISION-LOG, cutover table, playbook, prompt script, Part 19 inventories                                                                                                                                              |
| 06     | `06-part-19.5-file-inventory-PLANNED.md`                | as the target-state file census; the Executor converts PLANNED → ✅ as files land                                                                                                                                                                                                 |
| **07** | **`07-migration-process-change-proposal.md`**           | **read this second, right after 00.** Seven proposed changes to the migration process itself (rev 2), including the two pre-existing defects on already-cut-over money code that this review surfaced. Explains _why_ session `4A-W4` exists and why the W series was renumbered. |
| —      | `part19.5-wise-disbursement-openapi.yaml`               | the contract. Per plan §6 "Contract fidelity", this is **law** for the new endpoints                                                                                                                                                                                              |
| —      | `replace-rise-with-wise.md`                             | Davin's original brief. **Contains 5 factual errors** — see `02-…` §9 before trusting it                                                                                                                                                                                          |

Superseded/unchanged inputs: `riseworks/Archive/riseworks-disbursement-architecture-design.md`
(background for _why_ only, per `00-SKELETON-AND-RULES.md` §5).

---

## 3. Decisions already taken (Davin, 2026-07-25 — do not re-litigate)

| #   | Question                     | Davin's answer                                                              | Consequence                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ---------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Wise integration model       | **"Not sure yet — design for both"**                                        | Architecture is written provider-_and_-capability neutral. Funding sits behind a capability flag (`WISE_FUNDING_MODE`), so moving from personal-token to a Platform partnership is a config change, not a rewrite. → flag **F36** stays OPEN.                                                                                                                                                                       |
| 2   | Wise business-account region | **Thailand / other SE Asia**                                                | Thailand is **not** on Wise's API-funding allowlist (US, CA, AU, NZ, SG, MY only). Phase 1 is therefore **draft-by-API, fund-by-human**. This is the single biggest architectural consequence in the docset. → flag **F37**.                                                                                                                                                                                        |
| 3   | Existing Part 19 DB models   | **"keep RiseWorks but make it inactive (archive), restorable when needed"** | **No renames, no drops, no data deletion.** Wise gets its _own_ additive tables alongside. `AffiliateRiseAccount`, `RiseWorksWebhookEvent`, `RiseWorksKycStatus`, `amountRiseUnits`, `payeeRiseId` all stay exactly as they are. → flag **F42** RESOLVED.                                                                                                                                                           |
| 4   | Sequencing                   | **New sessions after 4A-7**                                                 | Wise work runs as `4A-W1 … 4A-W8`, inserted between Slice 3 cutover (4A-7) and the CC-C hardening gate (4A-8). **No session outside the W series is renumbered** (`00-SKELETON-AND-RULES.md` §5) — `4A-8` keeps its number, slot and scope. Davin's shorthand "4A-5W" maps to this `4A-W*` series.                                                                                                                  |
| 5   | Process review (rev 2)       | **"You may propose changes in the migration process"**                      | Produced `07-migration-process-change-proposal.md` — 7 changes, incl. inserting `4A-W4` to close the plan §13 money gate before the first real payout, and **two pre-existing defects on already-cut-over money code**: `enableShutdownHooks()` missing (so `PrismaService.onModuleDestroy` is dead code) and the live dLocal webhook capped at 100 req/min by the global throttler. **Awaiting Davin's approval.** |

**Also revoked by Davin, 2026-07-25:** `docs/migration-orders/4a-5-rw-money-service-riseworks-webhook-cutover.migration-order.md`
(RiseWorks webhook cutover) is **REVOKED / SUPERSEDED** — it will never be executed. Its
blocking entry criterion (RiseWorks replying with webhook settings) is now moot. CLAUDE.md
"Waiting on" item **#37 is closed by revocation**, not by resolution. Amendment text in `05-…`.

---

## 4. What is an order here, and what is not

`00-SKELETON-AND-RULES.md` §1.5: **chain length is exactly one. Never draft two sessions ahead.**

So this docset ships **one** order:

- `docs/migration-orders/4a-w1-wise-contracts-and-decisions.migration-order.md` — status **DRAFT**,
  awaiting Davin's `APPROVED`.

Sessions **4A-W2 … 4A-W8** appear in `04-rise-to-wise-migration-plan.md` as a _roadmap with
entry criteria and gates_ — deliberately **not** as order files. The Executor PRE-DRAFTs each one
at the close of its predecessor, exactly as it has for 4A-2 → 4A-7. If you find yourself about to
execute W2 because "the plan says so", stop: the plan is not an approval.

---

## 5. Standing constraints this docset must never violate (and does not)

Re-stated because every W-session touches money:

1. **`LESSONS-LEARNED.md` L1 — never run `prisma db push` / `migrate deploy` from `money-service`.**
   The Wise schema migration is authored in **`prisma/non-market-data/schema.prisma`** (monolith,
   sole owner of migration history) and hand-mirrored into `money-service/prisma/schema.prisma`
   as a _subset_, followed by `prisma generate` **only**. Session 4A-W2 says this in its own steps.
2. **`EXECUTOR-PROTOCOL.md` §7 — money, auth, secrets, CORS escalate to Davin immediately.**
   Every W-session that can move real money (W6, W7) carries an explicit Davin-present gate.
3. **`00-SKELETON-AND-RULES.md` §4 — no drive-by fixes.** `lib/api/index.ts` stays broken until
   Phase 7. RiseWorks source files are _not_ to be tidied, refactored, or deleted while archiving.
4. **Slice 2's monitoring caveat is still open** (CLAUDE.md Waiting-on #38): the first live
   post-flip dLocal webhook has not been observed. That is a _different_ provider and does not
   block W-work, but W5 must not be confused with it when reading Railway logs.
5. **The money gate closes in `4A-W4`, not in 4A-8.** Plan §13 requires CC-C/CC-D to be live before
   the first Phase 4 write-API cutover — and the Wise cutover **is** that cutover in substance, just
   not in label. So rev 2 inserts session **`4A-W4`** (CC-C/CC-D hardening for the money surface)
   before any Wise money code. To be precise about the direction of the dependency: the requirements
   are **plan §13's**, written at Phase 0 and _"enforced throughout Phase 4"_ — 4A-8 is the session
   that audits and completes them, not their author. So W5/W6 are not reaching forward in time; they
   comply with a standing standard. **4A-8 keeps its number, slot and scope** (F14 outbox +
   Stripe/dLocal write paths). See `04-…` §3 and `07-…` P1.

---

## 6. One-paragraph summary of the target architecture

Commission aggregation, batch creation and audit logging stay exactly where Part 19/Session 4A-2
put them. A new `money-service/src/wise/` module implements a `WisePaymentProvider` that satisfies
the existing `PaymentProvider` abstract class **unchanged**, plus a new optional
`FundablePaymentProvider` capability interface that models Wise's four-step
quote → recipient → transfer → fund flow and its **funding mode**. Payouts are drafted into a Wise
**batch group** (≤1000 transfers, one funding action); in `MANUAL` mode the group is `COMPLETED`
via API, its `payInDetails` surfaced to the admin UI, and a human funds it from the Wise app —
after which Wise's `transfers#state-change` webhooks (RSA-verified, deduped on `X-Delivery-Id`,
ordered on `occurred_at`) drive an idempotent reducer that moves each `DisbursementTransaction`
and `Commission` to its terminal state and applies the affiliate balance move **at most once**,
with a symmetric **at-most-once reversal** for Wise's rollback transitions. RiseWorks stays on
disk and in the database, unregistered from `AppModule` and rejected by the provider factory —
one import line and one env value away from restoration.

---

_Advisor: Claude Cowork · 2026-07-25 · docset version 1.0 · grounded against the live codebase at
commit-time and against `docs.wise.com` as of 2026-07-25._
