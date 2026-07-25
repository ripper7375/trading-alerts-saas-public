# Artifact Amendments — paste-ready text for Part 19.5

**Why this file exists:** `EXECUTOR-PROTOCOL.md` §3 makes the artefacts the _only_ channel between
sessions, and `00-SKELETON-AND-RULES.md` §5 requires every order to end by updating CLAUDE.md, the
Decision Log, the cutover table and the file inventory. This file pre-writes those edits so no
W-session has to invent them, and so the Advisor's intent survives verbatim.

**Rules for the Executor**

1. Apply each block **in the session named**, not earlier. Applying W7's cutover-table row before
   the cutover happened would make the artefacts lie.
2. Where a block says `<fill>`, fill it with real evidence — a date, a count, a commit SHA. Never
   leave a placeholder in a committed artefact.
3. If reality differs from a block, **reality wins**: amend the block, and record why in the
   session's Deviations.

---

## 1. `CLAUDE.md` — Current state block

### 1a. At the close of 4A-W1 (replaces the Current / Current-order / Next-session lines)

```markdown
- **Current:** Session 4A-W1 CLOSED — Part 19.5 (Wise) contracts & decisions, no code — <date>.
  Resolved F36 (Wise integration model) and F37 (funding mode / region gate); registered
  F38–F41; recorded F42 as RESOLVED (RiseWorks archived-not-deleted, Davin's instruction).
  Confirmed <present/absent> Business Payment Approval rules on the Wise business account —
  approval rules are incompatible with API-created transfers, so this is a hard gate on 4A-W6.
  Captured `WISE_PROFILE_ID` (sandbox) via a read-only `GET /v1/profiles`. Froze
  `docs/migration-orders/replace-rise-with-wise/part19.5-wise-disbursement-openapi.yaml` and the
  Wise-state → internal-status mapping table (design doc §5.2) as contract law.
- **Current order:**
  `docs/migration-orders/4a-w1-wise-contracts-and-decisions.migration-order.md` (CONFIRMED,
  executed <date>).
- **Order status:** all-green. No code written, no money touched, no schema changed.
- **Next session:** `4A-W2` — the additive Prisma migration for Part 19.5's 5 new tables +
  the `WISE` enum value. PRE-DRAFTed at this close. **Requires Davin present** (production
  schema change, `EXECUTOR-PROTOCOL.md` §7).
```

### 1b. Waiting-on items to add at 4A-W1

```markdown
**(39, NEW)** Part 19.5 (Wise) replaces RiseWorks as the disbursement provider —
`docs/migration-orders/replace-rise-with-wise/` is the governing docset (00 → 06 + the OpenAPI
spec). Sessions `4A-W1 … 4A-W8` are inserted between 4A-7 and 4A-8 (Davin, 2026-07-25).
**(40, NEW — closes #37 by revocation, not resolution)**
`docs/migration-orders/4a-5-rw-money-service-riseworks-webhook-cutover.migration-order.md` is
**REVOKED** (Davin, 2026-07-25). RiseWorks will not be cut over. Waiting-on #37 (RiseWorks
replying with webhook/API settings, and the open `event`/`event_type` field-name question) is
therefore moot. The order file is retained as audit trail with status REVOKED.
**(41, NEW — commercial, blocks nothing yet but shapes everything)** The Wise business account
is registered in **Thailand**, which is _not_ on Wise's API-funding allowlist (US, CA, AU, NZ,
SG, MY only) for personal API tokens. Consequence: **every payout cycle needs one manual
funding action by Davin in the Wise app**, indefinitely, unless F36 resolves to a Wise Platform
partnership. The architecture handles this (funding is a batch _state_, not a method call), and
a funding-SLA alarm prevents silent stalls — but the ongoing human cost should be re-weighed
whenever F36 is revisited.
**(42, NEW)** `WISE_API_TOKEN` is a money-moving secret. Plan: **read-only** token for
4A-W3/W5, promoted to **full access** only at 4A-W6. Verify its presence **value-blind** —
never `railway variables --kv` (that is how `DLOCAL_WEBHOOK_SECRET` reached a transcript in
Session 4A-5).
```

### 1c. Standing-instruction note to add at 4A-W1

```markdown
> **STANDING NOTE (Part 19.5, 2026-07-25):** the disbursement provider is being replaced
> (RiseWorks → Wise). Until 4A-W7 cuts over, `DISBURSEMENT_PROVIDER` stays `MOCK` in production
> and **no real affiliate payout goes out through money-service**. Any order that would create a
> real payment batch before 4A-W7 is out of order — stop and ask Davin.
```

### 1d. Open-flags line to extend (at 4A-W1)

Append to the existing `**Open flags:**` paragraph:

```markdown
· **F36 OPEN** (Wise integration model: Business + personal token vs Platform Enterprise
partnership — due 4A-W1, Davin) · **F37 OPEN→RESOLVED 4A-W1** (funding mode; Thailand region gate
forces `MANUAL`) · **F38 OPEN** (Wise fee bearer + quote amount direction — due 4A-W2, Davin,
commercial) · **F39 OPEN** (recipient-details collection surface: affiliate self-service vs
admin-entered — due 4A-W3, Davin, product) · **F40 OPEN** (webhook subscription level:
profile vs application — follows F36, due 4A-W5) · **F41 OPEN** (Wise recipient PII retention &
deletion; interacts with the open F21 account-deletion gap — due 4A-W3, Davin) ·
**F42 RESOLVED (2026-07-25, Davin)** — RiseWorks is archived, not deleted: dormant in repo AND
database, restorable per
`docs/migration-orders/replace-rise-with-wise/03-riseworks-archive-and-restore-runbook.md`
```

---

## 2. `DECISION-LOG.md`

### 2a. Flag-register table rows (add at 4A-W1)

```markdown
| F36 | Wise integration model: Business + personal token vs Platform Enterprise partnership | OPEN — due Session 4A-W1 (Davin, commercial) |
| F37 | Wise funding mode (`MANUAL`/`API`) given the account-region gate | RESOLVED — Session 4A-W1 (Davin): MANUAL, Thailand is not on Wise's API-funding allowlist |
| F38 | Wise fee bearer + quote amount direction (`sourceAmount` vs `targetAmount`) | OPEN — due Session 4A-W2 (Davin, commercial) |
| F39 | Wise recipient-details collection surface (affiliate self-service vs admin-entered) | OPEN — due Session 4A-W3 (Davin, product) |
| F40 | Wise webhook subscription level (profile vs application) — dependent on F36 | OPEN — due Session 4A-W5 (technical, follows F36) |
| F41 | Wise recipient PII retention/deletion; interacts with F21 | OPEN — due Session 4A-W3 (Davin) |
| F42 | RiseWorks archival depth (archive vs delete) | RESOLVED — 2026-07-25 (Davin): archive, never delete; restorable |
| F43 | Funding-SLA alert delivery channel (money-service has no email capability) | OPEN — registered Session 4A-W4, due Session 4A-W6 (Davin) |

> ⚠️ **Write `F` for flags and `#` for Waiting-on items, always.** CLAUDE.md cites Waiting-on
> `#26`–`#42` and flags `F1`–`F43` in the same paragraphs; `F37` (Wise funding mode) and `#37` (the
> revoked RiseWorks-reply blocker) sit one line apart and mean entirely different things. The
> highest flag before Part 19.5 was F35, so F36–F43 are free — the hazard is visual, not a real
> collision, and the prefix discipline is the whole fix.
```

### 2b. Resolution entries (append at the sessions named)

```markdown
## F42 — RiseWorks archival depth: archive, never delete

- Status: RESOLVED
- Session: 4A-W1 (decided ahead of it, in the Advisor consultation) · Date: 2026-07-25
- Decision: RiseWorks is **deactivated, not removed**. No source file, test, Prisma model, enum
  value, database row, admin page or document is deleted. "Inactive" is implemented as five
  independent kill-switches (module unregistered from `AppModule`; provider factory gated behind
  `ALLOW_ARCHIVED_PROVIDERS`; `DISBURSEMENT_PROVIDER=WISE`; no inbound provider traffic;
  eligibility filter branched). Restore path documented and dry-run-verified at 4A-W8.
- Evidence: Davin, live, 2026-07-25 — "I want I keep Riseworks but make it inactive (achieve) but
  could be restored when needed." Mechanics:
  `docs/migration-orders/replace-rise-with-wise/03-riseworks-archive-and-restore-runbook.md`.
  Material context found while designing: `RisePaymentProvider` was **never completed** —
  `lib/disbursement/providers/rise/rise-provider.ts` throws "coming in Part 19B" from
  `sendPayment`/`sendBatchPayment`/`getPaymentStatus`/`getPayeeInfo`, `siwe-auth.ts` is a
  placeholder, and `provider-factory.ts` already throws for `'RISE'` with
  `isProviderAvailable('RISE') === false`. **RiseWorks has never moved money in production**, so
  archiving removes a capability that was never live — and restoring the archive is _not_ the same
  as being able to pay via Rise (that would be new build work).
- Approved by: Davin

## F43 — Funding-SLA alert delivery channel

- Status: OPEN (registered Session 4A-W4) → <RESOLVED at 4A-W6>
- Session: registered 4A-W4 · decided 4A-W6 · Date: <date>
- Question: the funding-SLA alarm is the dead-man switch on the manual funding gate (F37) — without
  it an unfunded batch is silently auto-cancelled by Wise after ~14 days. How does it reach Davin?
  money-service has **no email capability**: verified no `resend`/`nodemailer` in
  `money-service/package.json`; email was ported to operation-service (F29, Session 3-4) and the
  service-to-service `SVC_TOKEN` leg was descoped (F31). A `Notification` row + dashboard card is
  **passive** — it only works if he looks.
- Options: (a) Resend REST directly from money-service for this one alert type — ~30 lines, no new
  dependency, **recommended**; (b) passive dashboard card only; (c) external monitor polling
  `/v1/wise/health`'s `fundingSlaBreaches`; (d) revive `SVC_TOKEN` and call operation-service —
  right architecture, wrong sequencing, do not block Part 19.5 on it.
- Decision: <…>
- Evidence: <whether RESEND_API_KEY is actually set on money-service — Waiting-on #26 lists the
  Resend secret status as unverified; check value-blind>
- Approved by: Davin

## F37 — Wise funding mode: MANUAL (region-gated)

- Status: RESOLVED
- Session: 4A-W1 · Date: <date>
- Decision: `WISE_FUNDING_MODE=MANUAL`. Money cannot leave the Wise balance under program
  control. money-service drafts a batch group, completes it, surfaces Wise's `payInDetails`, and a
  human funds it; funding is then recorded via `POST /v1/wise/batches/{id}/mark-funded` (or
  inferred, best-effort, from a `balances#update` event). `fundBatchFromBalance` throws
  `CapabilityUnavailableError` in this mode. The `API` mode is designed and documented but not
  built in Phase 1.
- Evidence: Wise documents that personal API tokens cannot fund transfers or read balance
  statements "except for accounts based in the US, Canada, Australia, New Zealand, Singapore, and
  Malaysia" (<https://docs.wise.com/guides/developer/auth-and-security/personal-api-token>,
  <https://docs.wise.com/guides/product/send-money/use-cases/payouts-smbs>). Davin confirmed the
  account region is **Thailand** (2026-07-25). `POST /v3/profiles/{id}/batch-payments/{groupId}/payments`
  is additionally SCA-protected for UK/EEA profiles
  (<https://docs.wise.com/api-reference/batch-group/batchgroupfund>).
- Approved by: Davin

## F36 — Wise integration model

- Status: OPEN → <RESOLVED at 4A-W1>
- Session: 4A-W1 · Date: <date>
- Decision: <Model A: Wise Business + personal API token | Model B: Wise Platform Enterprise
  partnership>. Davin's initial position (2026-07-25) was "not sure yet — design for both", so the
  architecture is capability-gated: funding mode, webhook subscription level (F40) and SCA handling
  are the only things that differ, and all three are config, not structure.
- Evidence: <what was checked in the Wise account / what the partnership conversation concluded>
- Approved by: Davin
```

---

## 3. `migration-cutover-table.md` — new row

**Add at 4A-W7, after the existing Slice 2 row.** Do **not** modify the Slice 2 row: its RiseWorks
notes stay accurate history.

```markdown
| Slice 2W: Wise disbursement (replaces RiseWorks) | money-service | 4A-W1…W8 | `DISBURSEMENT_PROVIDER=MOCK→WISE` + production Wise webhook subscription (`transfers#state-change`, `transfers#payout-failure`, `balances#update`, schema `4.0.0`) | — (replay-verified, not shadow-run: plan §6 for webhook slices) | yes — replay of real Wise-signed sandbox payloads captured via the Simulation API; sandbox E2E happy + bounce paths | <date> | <yes/no — state the mechanism> | CUT-OVER | Part 19.5 (`docs/migration-orders/replace-rise-with-wise/`). Supersedes Part 19's provider layer only; aggregation/batch/audit layers unchanged. **Funding is MANUAL (F37)** — Thailand is not on Wise's API-funding allowlist for personal tokens, so every cycle needs one human funding action; a funding-SLA alarm (`WISE_FUNDING_SLA_HOURS`, default 72) is the dead-man switch, and Wise auto-cancels unfunded transfers after ~14 days. **Only the webhook reducer may mark a commission PAID** — `payment-orchestrator.service.ts` branches on `isFundable` so a drafted Wise batch never writes `Commission.status` or the affiliate balance. At-most-once accounting via `WiseTransfer.balanceAppliedAt`/`balanceRevertedAt`; dedupe on `X-Delivery-Id`; ordering on `data.occurred_at`. First cutover payout was ONE affiliate, smallest viable amount, Davin funding live. **RiseWorks: ARCHIVED, not retired** — `RiseworksModule` unregistered (so `/v1/webhooks/riseworks` now 404s), provider factory gated on `ALLOW_ARCHIVED_PROVIDERS`, all files/tables/rows retained; restore runbook at `replace-rise-with-wise/03-…`. `4A-5-RW` REVOKED. |
```

**Also amend the `Slice 2` row's Notes** by appending (at 4A-W7):

```markdown
**SUPERSEDED for RiseWorks (2026-07-25):** the RiseWorks half of this slice will never cut over — `4A-5-RW` is REVOKED and RiseWorks is archived by Part 19.5. See the Slice 2W row. The dLocal half is unaffected and remains CUT-OVER.
```

---

## 4. Playbook amendment — `monolith-to-microservices-migration-session-playbook.md`

Per `00-SKELETON-AND-RULES.md` §5, this ships **in the same DRAFT** as the 4A-W1 order and is
covered by Davin's approval of that order.

### 4a. Insert in §"4A — money-service (its blueprint's 5 slices)", after the 4A-6/7 bullet

```markdown
- **Sessions 4A-W1…W8 — Part 19.5: RiseWorks → Wise disbursement** _(inserted 2026-07-25, Davin's
  call; suffix numbering per 00-SKELETON-AND-RULES §5 — nothing renumbered)_. Governing docset:
  `docs/migration-orders/replace-rise-with-wise/`.
  - **4A-W1 — Contracts & decisions** (CONTRACT): resolve **F36** (integration model) / **F37**
    (funding mode, region-gated); register F38–F41; freeze the OpenAPI spec + the Wise-state
    mapping table; check for Business Payment Approval rules (they break API transfers). No code.
  - **4A-W2 — Additive schema** (INFRA+PORT): 5 new tables + the `WISE` enum value, authored in
    `prisma/non-market-data/schema.prisma` and mirrored as a subset into money-service
    (`prisma generate` only — **L1**). Nothing dropped or renamed.
  - **4A-W3 — BUILD recipient onboarding** (PORT+UI-BUILD): Wise API client, RSA signature
    verifier, dynamic account-requirements form. Split into W3a/W3b if > 4h.
  - **4A-W4 — CC-C/CC-D hardening gate for the money surface** (CONTRACT + small INFRA): closes the
    plan §13 gate _"CC-C idempotency + CC-D rate limits before the first Phase 4 write-API
    cutover"_ — because the Wise cutover **is** that cutover in substance. Audits (does **not**
    fix) idempotency keys on every existing money write endpoint; verifies the dLocal webhook
    dedupe table; adds `enableShutdownHooks()` (**pre-existing defect** — `PrismaService.onModuleDestroy`
    is dead code today); replaces the implicit global throttle on `/v1/webhooks/dlocal` with an
    explicit generous per-route limit (**pre-existing defect** on live money traffic); writes the
    BullMQ job-ID policy before the first queue exists; registers **F43**.
    **F14/outbox and the Stripe/dLocal write-path fixes stay 4A-8's.**
  - **4A-W5 — BUILD Wise webhook + reducer** (PORT): `/v1/webhooks/wise`, `X-Delivery-Id` dedupe,
    `occurred_at` ordering, store-then-process via BullMQ, at-most-once accounting.
    **Verification is REPLAY with real Wise-signed payloads captured from the sandbox Simulation
    API — not a 48h shadow-run.**
  - **4A-W6 — BUILD payout engine + funding gate** (PORT): quote/transfer/batch-group services,
    the `isFundable` orchestrator branch, admin funding gate, reconciliation cron.
  - **4A-W7 — CUTOVER to Wise** (VERIFY-RETIRE) ⚠️ **REAL MONEY**: subscribe production webhooks,
    flip `DISBURSEMENT_PROVIDER` (archive switch **A3** — the flip _is_ the cutover mechanism), ONE
    small smoke payout with Davin funding live. **No code changes in this session** — A1/A2 moved to
    W8 per `TEMPLATE-VERIFY-RETIRE.md`'s near-zero dial.
  - **4A-W8 — Archive RiseWorks** (VERIFY-RETIRE, **ARCHIVE not RETIRE — nothing is deleted**):
    archive switches A1/A2, banners, flag-gated UI, schema comments, dormancy verification, restore
    dry-run, inventories.
  - **⚠️ CC-C/CC-D:** the requirements are **plan §13's**, written at Phase 0 and _"enforced
    throughout Phase 4"_ — 4A-8 audits and completes them, it does not author them. `4A-W4` closes
    the gate for the Wise scope before any money code; **4A-8 keeps its number, slot and scope**
    (F14 outbox + Stripe/dLocal write paths) and then _verifies_ rather than rebuilds.
  - **REVOKED:** `4A-5-RW` (RiseWorks webhook cutover) — will never run.
```

### 4b. Add to §"Quick reference: where YOU are required"

```markdown
| 4A-W1 | F36/F37 decisions; Wise account access; confirm no payment-approval rules |
| 4A-W2 | Production Prisma migration approval |
| 4A-W3 | F39 (who fills the recipient form) + F41 (PII retention) |
| 4A-W6 | Promote `WISE_API_TOKEN` to full access; money-path review |
| 4A-W7 | **Cutover + fund the first real batch in the Wise app** |
| Every payout cycle (F37 = MANUAL) | **Fund the completed batch in the Wise app** — ongoing, not one-off |
```

---

## 5. `prompt-to-claude-code/SESSION-PROMPT-SCRIPT.md` — rows to add

Must never disagree with the playbook (`00-SKELETON-AND-RULES.md` §5). Insert after the `4A-7` row.

```markdown
| 4A-W1 | Part 19.5 contracts & decisions (Wise) | CONTRACT ([A]: research/spec) | _"read `docs/migration-orders/replace-rise-with-wise/` 00→06 first. Resolve F36/F37 with me. Check my Wise account for Business Payment Approval rules — they break API transfers. No code this session."_ |
| 4A-W2 | Part 19.5 additive schema migration | INFRA + PORT rules | _"the migration is authored in `prisma/non-market-data/schema.prisma` ONLY. Show me the generated SQL before applying — any DROP/RENAME/ALTER COLUMN aborts the session. money-service gets `prisma generate` only (L1)."_ |
| 4A-W3 | BUILD Wise recipient onboarding | P4-BUILD (+ UI-BUILD for the form) | _"the recipient form is schema-driven from Wise's account-requirements endpoint — do not hard-code Thai bank fields. No raw bank details in the DB or logs."_ |
| 4A-W4 | CC-C/CC-D hardening gate (money surface) | CONTRACT ([A]: audit/spec) + small INFRA | _"audit only for Stripe/dLocal write paths — do NOT fix them, that's 4A-8's. DO fix the two live defects: add `enableShutdownHooks()` (`PrismaService.onModuleDestroy` is dead code today) and put an explicit generous `@Throttle()` on `/v1/webhooks/dlocal`, verified by replay before and after. Write the BullMQ job-ID policy before the first queue exists. Register F43."_ |
| 4A-W5 | BUILD Wise webhook + state reducer | P4-BUILD | _"verification is REPLAY with real Wise-signed payloads from the sandbox Simulation API. Dedupe on X-Delivery-Id, order on data.occurred_at. Only this reducer may mark a commission PAID."_ |
| 4A-W6 | BUILD Wise payout engine + funding gate | P4-BUILD | _"branch the orchestrator on `isFundable` — a drafted Wise batch must NEVER write Commission.status or the affiliate balance. Every existing orchestrator test must still pass unmodified."_ |
| 4A-W7 | CUTOVER to Wise — **REAL MONEY** | P4-CUTOVER + Walkthrough F | Money-audit prompt first. Then: _"walk me through the Wise Developer Hub subscription clicks, then ONE affiliate, smallest amount. I fund it in the Wise app while you watch the logs."_ Rollback: `DISBURSEMENT_PROVIDER=MOCK` + delete subscriptions. |
| 4A-W8 | ARCHIVE RiseWorks + artefacts | P4-CUTOVER (VERIFY-RETIRE, archive block) | _"ARCHIVE, not retire — delete NOTHING. Every RiseWorks test must still pass, and the row counts for AffiliateRiseAccount / RiseWorksWebhookEvent must be identical before and after. Dry-run the restore."_ |
```

---

## 6. Part 19 inventories — supersession note

Append **verbatim** to the bottom of each of
`docs/files-completion-list/files-inventory/part19a-files-completion.md`,
`part19b-…`, `part19c-…`, `part19d-…` at session 4A-W8. Do **not** edit their existing tables —
they remain accurate records of what Part 19 completed.

```markdown
---

## Update 2026-07-25 — SUPERSEDED (provider layer only) by Part 19.5 · ARCHIVED, not deleted

Part 19's **RiseWorks provider layer** is superseded by **Part 19.5 (Wise)** —
`docs/migration-orders/replace-rise-with-wise/`. Inventory:
`docs/files-completion-list/files-inventory/part19.5-files-completion.md`.

**Nothing listed in this document was deleted.** Per flag **F42** (Davin, 2026-07-25) RiseWorks is
_archived_: every file, test, Prisma model, enum value, database row, admin page and document
listed above still exists and still passes its tests. It is deactivated by five kill-switches
(`RiseworksModule` unregistered from money-service's `AppModule`; provider factory gated on
`ALLOW_ARCHIVED_PROVIDERS`; `DISBURSEMENT_PROVIDER=WISE`; no inbound provider traffic; eligibility
filter branched) and is restorable in ≤30 minutes via
`docs/migration-orders/replace-rise-with-wise/03-riseworks-archive-and-restore-runbook.md`.

**What Part 19.5 retains from Part 19 unchanged:** commission aggregation, payout-threshold logic,
batch lifecycle, transaction records, audit logs, reports, the 2 disbursement crons, and the admin
UI shell. Only the _provider_ below that boundary changed.

**Historical note recorded while designing Part 19.5:** `RisePaymentProvider` was never completed.
`lib/disbursement/providers/rise/rise-provider.ts` throws "coming in Part 19B" from `sendPayment`,
`sendBatchPayment`, `getPaymentStatus` and `getPayeeInfo`; `siwe-auth.ts` is a placeholder; and
`provider-factory.ts` already threw for `'RISE'` with `isProviderAvailable('RISE') === false`.
RiseWorks therefore never moved money in production, and the "✅ Complete" statuses above should be
read as _"the files exist and were reviewed"_, not _"RiseWorks payouts worked end to end"_.
```

---

## 7. `migration-stack-analysis.md` — entries

At 4A-W8 (and incrementally as files land, per `00-SKELETON-AND-RULES.md` §5):

- **Add** every `money-service/src/wise/**` file from `06-part-19.5-file-inventory-PLANNED.md`
  §1–2, plus the 3 frontend files in §3.
- **Mark** each Rise entry `ARCHIVED (Part 19.5, F42) — retained, deactivated` rather than removing
  the line.
- **Note** the still-open standing gap recorded in CLAUDE.md Waiting-on #35: this file's
  money-service section was never backfilled after Session 4A-1, so Sessions 4A-2/4A-4's files are
  still missing from it. Part 19.5 should append its own additions **without** attempting the full
  regeneration (that is an 8.6-only task).

---

## 8. `LESSONS-LEARNED.md` — candidate entries

`LESSONS-LEARNED.md` was consolidated to L1–L11 on 2026-07-22 with a ~40 cap, so there is room.
Only add a lesson if the failure actually happens — do not pre-write lessons. Likely candidates,
listed so the Executor recognises them:

| If this happens                                                    | Candidate rule                                                                                                                                                                                         |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The webhook route gets rate-limited by the global `ThrottlerGuard` | "A globally-registered `APP_GUARD` throttler applies to webhook routes too — every provider webhook controller needs `@SkipThrottle()`, or the provider's retry storm gets throttled into event loss." |
| A drafted-but-unfunded batch marks commissions `PAID`              | "A provider whose 'send' does not move money must not share the orchestrator's success path. Branch on capability, not on provider name."                                                              |
| A Wise state arrives that the mapper doesn't know                  | "Never model an external provider's status as a DB enum. A new provider state must degrade to a logged skip, not a write failure."                                                                     |
| `money_svc` can't write the new tables                             | "New tables do not inherit role grants. After any migration that adds a table, prove the service role can read/write it with an actual query — grant listings lie by omission."                        |

---

## 9. Application order summary

| Session      | Apply blocks                                                     |
| ------------ | ---------------------------------------------------------------- |
| **4A-W1**    | §1a, §1b, §1c, §1d, §2a, §2b (F42, F37, F36), §4, §5             |
| **4A-W2**    | §1 (state block refresh), §2b (F38)                              |
| **4A-W3**    | §1, §2b (F39, F41), §7 (incremental)                             |
| **4A-W4** 🆕 | §1, §2a (**register F43**), §2b (F43 entry), §7 (incremental)    |
| **4A-W5**    | §1, §2b (F40), §7 (incremental)                                  |
| **4A-W6**    | §1, §2b (**resolve F43**), §7 (incremental)                      |
| **4A-W7**    | §1, §3 (both the new Slice 2W row **and** the Slice 2 amendment) |
| **4A-W8**    | §1, §6, §7 (final), §8 (only if a real failure occurred)         |

---

## 10. `LESSONS-LEARNED.md` — two entries to add at 4A-W4 (these failures already happened)

Unlike §8's _candidates_, these two are **confirmed defects found on 2026-07-25**, so they qualify
as lessons the moment W4 fixes them. Format per that file's header: the rule, not the story, ≤6 lines.

> ⚠️ **Numbering corrected 2026-07-25.** An earlier revision of this section reserved `L12`/`L13`.
> That was wrong — the live file's active lessons already run to **L17**, and **L18** was appended on
> 2026-07-25 (the F46 schema-vs-transport rule). The two entries below are therefore **L19** and
> **L20**. Re-check the highest active `### L` in `LESSONS-LEARNED.md` before appending — do not
> trust these numbers if other sessions have run in between.

```markdown
### L19 — `enableShutdownHooks()` is not optional; without it every `onModuleDestroy` is dead code

- Symptom: `PrismaService.onModuleDestroy()` existed in money-service from 4A-1 and had never run.
- Root cause: Nest only invokes lifecycle hooks on SIGTERM when `app.enableShutdownHooks()` is called.
- Rule: any service with a lifecycle hook, a queue consumer, or in-flight external calls must call
  `app.enableShutdownHooks()` in `main.ts`. A hook that is never invoked is worse than no hook — it
  reads as handled. Grep for `onModuleDestroy`/`OnApplicationShutdown` and assert the bootstrap enables them.
- Source: Session 4A-W4 (found by Advisor review, 2026-07-25) · Status: ACTIVE

### L20 — A global `APP_GUARD` throttler also throttles your provider webhooks

- Symptom: `/v1/webhooks/dlocal` was capped at 100 req/60s after cutover; a provider retry burst
  would be 429'd and read by the provider as delivery failure.
- Root cause: `ThrottlerGuard` registered as `APP_GUARD` applies to every route, including ones
  whose caller is a payment provider you do not control.
- Rule: every provider webhook route needs an **explicit** generous per-route `@Throttle()` — never
  the inherited default, and never `@SkipThrottle()` (that trades throttling for flooding).
- Source: Session 4A-W4 (found by Advisor review, 2026-07-25) · Status: ACTIVE
```

⚠️ `LESSONS-LEARNED.md` sits at **L1–L18** (2026-07-25) against a stated ~40 cap — there is room.
Add these **only when W4 actually fixes them**, not before.
