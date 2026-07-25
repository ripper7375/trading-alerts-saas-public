# Migration Process — Change Proposal (Advisor → Davin)

**Status:** PROPOSAL — awaiting Davin's approval. Nothing here is executed until approved.
**Author:** Advisor (Claude Cowork) · **Date:** 2026-07-25
**Trigger:** Davin's question — _"How can 4A-W4/W5 borrow 4A-8's idempotency/dedupe/rate-limit
requirements since they come before 4A-8?"_

That question was correct and it exposed three real problems, plus two **pre-existing defects in
code that is already cut over**. This document proposes seven changes. Six are cheap; one adds a
session.

**If you approve only one thing, approve P1 + P2.** They are the two that can lose real money.

---

## 0. First, the answer to the question that triggered this

"Borrow" was my wrong word, and it made the dependency sound backwards. The accurate position:

**The idempotency / dedupe / rate-limit requirements are not 4A-8's to give.** They are written in
the migration plan §13 as:

- **CC-C Resilience & inter-service communication** — _"design: Phase 0 · **enforced: throughout
  Phase 4**"_
- **CC-D API edge, versioning & security hardening** — _"decide: Phase 0 · **applied: Phase 4
  onward**"_

They have been readable since Phase 0. **4A-8 is not their author — it is the session that audits
and completes them across the money surface, and implements F14's outbox.** So a session running
before 4A-8 is not reaching forward in time; it is complying with a standing standard.

Nothing 4A-8 _emits_ is consumed by the Wise sessions:

| CC-C / CC-D requirement                   | Does the Wise work need 4A-8 to have run?                                                             |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Idempotency keys on money write endpoints | **No** — Wise _mandates_ `customerTransactionId` as its own idempotency contract                      |
| Dedupe table per webhook processor        | **No** — Wise gets `WiseWebhookEvent.deliveryId @unique`; Stripe/dLocal's tables are separate objects |
| BullMQ job IDs derived from business keys | **No** — the Wise queue is its own namespace                                                          |
| Rate limits                               | **No** — `ThrottlerModule` has been global since 4A-1                                                 |
| **F14 transactional outbox**              | **N/A** — that is Slice 5's money→core tier path. Wise never touches it.                              |

**But** — and this is the part worth your attention — plan §13's own gate table says:

| Phase gate                                    | Must be live first                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------- |
| **First Phase 4 write-API cutover (slice 4)** | **CC-C idempotency + outbox decision (F14); CC-D rate limits on new endpoints** |

The Wise cutover **is** a Phase 4 write-API cutover that moves real money. It simply isn't labelled
"slice 4". So under the ordering I drafted, that gate is formally still open at the moment of your
first real Wise payout. That is not acceptable for a money path, and P1 fixes it.

---

## P1 — Insert a CC-C/CC-D hardening session _before_ the Wise money code

**Problem.** The plan requires CC-C/CC-D to be live before the first Phase 4 write-API cutover.
The Wise cutover is that cutover in substance. As drafted, the gate closes _after_ it.

**Proposed change.** Add one session to the Wise series and **renumber only within that series**
(nothing outside it moves; `4A-8` keeps its number, its slot and its scope):

| New         | Was             | Content                                                           |
| ----------- | --------------- | ----------------------------------------------------------------- |
| `4A-W1`     | `4A-W1`         | Contracts & decisions (unchanged — its order file already exists) |
| `4A-W2`     | `4A-W2`         | Additive schema migration                                         |
| `4A-W3`     | `4A-W3`         | Recipient onboarding BUILD                                        |
| **`4A-W4`** | **— new —**     | **CC-C/CC-D hardening gate for the money surface**                |
| `4A-W5`     | `4A-W4`         | Wise webhook + reducer BUILD                                      |
| `4A-W6`     | `4A-W5`         | Payout engine + funding gate BUILD                                |
| `4A-W7`     | `4A-W6`         | CUTOVER to Wise ⚠️ real money                                     |
| `4A-W7m`    | `4A-W6 (money)` | High-stakes audit ceremony row                                    |
| `4A-W8`     | `4A-W7`         | Archive RiseWorks                                                 |

**Why renumbering is legal here.** `00-SKELETON-AND-RULES.md` §5 forbids renumbering _existing_
sessions because stale references in CLAUDE.md, orders and commits would silently point at the
wrong work. **No W session has been executed or approved**, and the only W artifact that exists —
`4a-w1-wise-contracts-and-decisions.migration-order.md` — keeps its number. There is nothing stale
to break. Renumbering _now_ is free; renumbering after W3 has run would not be.

**Why insert before W4-new (the webhook) rather than before W6-new (the payout engine).** The
webhook session is where money _state_ first gets written (`Commission → PAID`, affiliate balance
moved) and where money-service gets its **first BullMQ consumer**. Both are CC-C surface. Closing
the gate before that is closing it before the first thing that can be wrong about money.

**What `4A-W4` contains** (variant: `TEMPLATE-CONTRACT.md` for the audit + small INFRA edits, ~2–3h):

1. **Audit** every money write endpoint that exists today for an idempotency key — Stripe checkout,
   dLocal create, `batches/[batchId]/execute` — and record the finding per endpoint. **Audit only;
   fixing Stripe/dLocal write paths stays 4A-8's job.** Wise's own keys are designed already.
2. **Verify the webhook dedupe tables.** `RiseWorksWebhookEvent` is the template the plan names.
   Confirm dLocal has an equivalent (it is live and cut over — this is the highest-value check in
   the session), and confirm Stripe's status. Add what is missing **for live paths only**.
3. **Graceful shutdown** — see **P2**, which is a real defect, not a Wise concern.
4. **Rate limits** — see **P3**, which is also a live defect.
5. **BullMQ job-ID policy** written down before the first queue exists (money-service has
   `BullModule.forRoot` from 4A-1 but **no `registerQueue` and no `@Processor` yet** — verified
   2026-07-25). Job IDs must derive from business keys so a retry cannot double-fire a payout.
6. **Do NOT** touch F14/outbox, Stripe/dLocal write-path fixes, or Slice 5 mechanics. Those remain
   4A-8's, so 4A-8 does not become an empty session.

**Then 4A-8, unchanged in its slot, verifies rather than rebuilds** — with the Wise surface already
compliant and the audit findings from W4 in hand. Note this explicitly in W8's handoff.

**Cost:** one session, ~2–3h. **Cost of not doing it:** your first real payout goes out with the
plan's own money gate formally open, and the two defects in P2/P3 stay live.

---

## P2 — Fix graceful shutdown (⚠️ pre-existing defect, affects live code)

**Problem.** `money-service/src/main.ts` (51 lines) never calls `app.enableShutdownHooks()`.
Nest only invokes lifecycle hooks on SIGTERM if shutdown hooks are enabled. Therefore
`PrismaService.onModuleDestroy()` at `money-service/src/prisma/prisma.service.ts:36` **is dead code
today** — it has never run. Every Railway redeploy since 4A-1 has severed Prisma connections rather
than closing them.

Plan §13 CC-C names this explicitly:

> **Graceful shutdown.** Nest `enableShutdownHooks()`, drain BullMQ workers on SIGTERM, close
> Prisma/Redis cleanly — **Railway redeploys will otherwise sever in-flight batch payouts.**

That last clause is precisely the Wise scenario: a redeploy landing mid-`prepareBatch` while 40
Wise transfers are being created. W6-new's `customerTransactionId` resumability mitigates the
_consequence_; it does not fix the _cause_.

**Proposed change.** In `4A-W4`: add `app.enableShutdownHooks()` to `main.ts`, verify
`PrismaService.onModuleDestroy` now fires, and write the BullMQ drain policy for the queue W5-new
is about to create. **This affects the already-cut-over crons and dLocal webhook too — it is a fix
for them as much as for Wise.**

**Cost:** ~1 line plus a verification. **Cost of not doing it:** interrupted batch payouts and
leaked connections on every deploy, indefinitely.

---

## P3 — Correct the webhook throttling decision (⚠️ pre-existing defect, affects live code)

**Two problems, one of which is live right now.**

1. **Live:** `ThrottlerGuard` is registered as `APP_GUARD` in `money-service/src/app.module.ts:70`
   with `{ ttl: 60000, limit: 100 }`, and **no controller opts out** (verified 2026-07-25). So
   `/v1/webhooks/dlocal` — **already cut over, taking real payment traffic** — is capped at 100
   requests per minute. A dLocal retry burst can be 429'd, and dLocal will read that as a delivery
   failure. This has nothing to do with Wise; it is a latent fault on a live money path.
2. **My design was wrong too.** I specified `@SkipThrottle()` on the Wise webhook. That removes the
   ceiling entirely, which trades a throttling fault for a flooding fault.

**Proposed change.** In `4A-W4`, adopt one policy for all provider webhooks: an explicit, generous
per-route limit — `@Throttle({ default: { ttl: 60_000, limit: 300 } })` as the starting point —
rather than either the global 100 or no limit at all. Apply it to `/v1/webhooks/dlocal` **and** to
the Wise route when W5-new creates it. Rationale to record: legitimate provider traffic is low and
bounded (Wise retries ≤25 times over ~2 weeks with exponential backoff), so a high ceiling costs
nothing and still bounds a flood.

⚠️ Touching the live dLocal route is a **change to already-cut-over money code**. It needs your
explicit approval (`EXECUTOR-PROTOCOL.md` §7) and it should be verified against a replayed dLocal
payload before and after, not just reasoned about.

**Cost:** one decorator per webhook controller. **Cost of not doing it:** dropped dLocal webhooks
under retry pressure, presenting as missing payments.

---

## P4 — Move the RiseWorks archive switches out of the cutover session

**Problem.** I put archive switches A1–A3 inside `4A-W6` (now `4A-W7`), the cutover session. A1
(removing `RiseworksModule` from `app.module.ts`) and A2 (the provider-factory gate) are **code
changes**. `TEMPLATE-VERIFY-RETIRE.md` is explicit: _"No new code, no fixes, no 'while I'm here' —
observation and execution only,"_ dial **near zero**. I violated my own template.

**Proposed change.**

- `4A-W7` (cutover) keeps **only A3** — flipping `DISBURSEMENT_PROVIDER=MOCK→WISE`. That flip _is_
  the cutover mechanism, so it belongs there and it is config, not code.
- **A1 and A2 move to `4A-W8`** (the archive session), where code changes are the point.

**Consequence, and why it is harmless.** Between W7 and W8 both webhook routes stay registered.
`/v1/webhooks/riseworks` will answer 401 to unsigned requests instead of 404 — but nothing points
at it, RiseWorks has never sent it a single production request, and `RisePaymentProvider` cannot
send a payment even if constructed. Zero traffic, zero risk. The dormancy verification in
`03-…` §3 then all happens in one place, in W8, where it can be evidenced properly.

**Cost:** none — it is a reordering. **Benefit:** the money cutover session becomes a pure
checklist, which is the whole point of the near-zero dial.

---

## P5 — New flag: how does the funding-SLA alarm actually reach you?

**Problem I created and did not close.** The design's funding-SLA alarm is the dead-man switch on
the manual funding gate — without it, a batch can sit unfunded until Wise auto-cancels it after
~14 days. I specified it as _"admin `Notification` row + log"_. Both are **passive**: they only work
if you happen to look.

And money-service has **no email capability at all** — verified: no `resend`/`nodemailer` in
`money-service/package.json`. Email was ported to _operation-service_ (F29, Session 3-4), and the
service-to-service `SVC_TOKEN` leg was descoped (F31). So there is currently no push channel out
of money-service.

**Proposed change.** Register **flag F43 — funding-SLA alert delivery channel**, owner Davin, due
`4A-W6`. Options to decide between:

| Option                                           | How                                                                                                                  | Cost                         | Honest assessment                                                                                                                             |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **(a) Resend REST directly from money-service**  | `fetch` to Resend's API for exactly one alert type; key already in the matrix (status unverified per Waiting-on #26) | ~30 lines, no new dependency | **Recommended.** Push, reliable, minimal scope. Slightly duplicates operation-service's email concern — acceptable for one operational alert. |
| (b) `Notification` row + funding-queue card only | already designed                                                                                                     | zero                         | Passive. Fine if you open the admin dashboard daily; a silent 14-day loss if you don't.                                                       |
| (c) External monitor polling `/v1/wise/health`   | e.g. an uptime service watching `fundingSlaBreaches`                                                                 | small, outside the repo      | Decent, and it also covers the service being down — but it is a second system to maintain.                                                    |
| (d) Wait for a money→operation-service call      | needs SVC_TOKEN revived (F31)                                                                                        | a session                    | Architecturally tidiest, wrong sequencing — do not block Part 19.5 on it.                                                                     |

**Cost of not deciding:** the dead-man switch has no bell.

---

## P6 — Retype `4A-W2` from "Decision session" to "Standard loop"

Minor consistency fix. `4A-W2`'s dominant work is a Prisma migration; F38 is a rider on it. Its
direct analogue is **Session 2-2** (the schema split, which resolved F4 _and_ F5) and that is
classified "Standard loop". Sessions typed "Decision session" (1-1/F18, 3-1/F6-F7, 4A-1/F16,
6-1/F11) are ones where _your decision is the deliverable_. W2's deliverable is a migration.

Affects only the `ประเภท (Type)` column in the v6 handbook. **Cost: none.**

---

## P7 — Terminology and numbering hygiene

1. **Drop "borrow."** Replace everywhere with _"comply with the standing CC-C/CC-D standard (plan
   §13), in this session's own scope."_ Same meaning, no false implication of a backwards
   dependency. Affects `00-…` §5, `04-…` §3, and the v6 `Audit_Report` E3.
2. **Add a disambiguation note wherever both numbering systems appear.** CLAUDE.md cites
   _Waiting-on items_ `#26`–`#42` and _flags_ `F1`–`F43` in the same paragraphs. "F37" (Wise funding
   mode) and "#37" (the now-revoked RiseWorks reply) are different things one line apart. Highest
   flag currently in the register is **F35**, so F36–F43 are free — the risk is visual, not a real
   collision. I considered moving the Wise flags to F50+ to remove the ambiguity entirely, but the
   F36–F43 numbers are already cited across the delivered docset and the v6 handbook; renumbering
   would create more confusion than it removes. **A one-line note beats a renumber.**

**Cost:** wording only.

---

## Summary and recommendation

| #      | Change                                                                                           | Cost              | Risk if skipped                                             |
| ------ | ------------------------------------------------------------------------------------------------ | ----------------- | ----------------------------------------------------------- |
| **P1** | Insert `4A-W4` CC-C/CC-D hardening before the Wise money code; renumber only within the W series | 1 session (~2–3h) | **Plan's own money gate open at first real payout**         |
| **P2** | `enableShutdownHooks()` — fixes dead `onModuleDestroy` on **live** code                          | ~1 line           | **Severed in-flight batch payouts on every deploy**         |
| **P3** | Explicit high per-route throttle on provider webhooks, incl. **live** dLocal                     | 1 decorator each  | **Dropped dLocal webhooks under retry pressure**            |
| **P4** | Move archive switches A1/A2 from the cutover session to the archive session                      | reorder only      | Cutover session contains code changes, against its template |
| **P5** | Flag **F43** — funding-SLA alert delivery channel                                                | a decision        | Dead-man switch with no bell                                |
| **P6** | Retype `4A-W2` → Standard loop                                                                   | none              | Cosmetic inconsistency                                      |
| **P7** | Drop "borrow"; add flag-vs-Waiting-on disambiguation note                                        | wording           | Confusion at exactly the wrong moment                       |

**Net effect on schedule:** Part 19.5 goes from 7 sessions / ~20h to **8 sessions / ~23h**.

**My recommendation: approve all seven.** P2 and P3 are not Wise work at all — they are defects on
already-cut-over money paths that this review happened to surface, and they should be fixed whether
or not you proceed with Wise. P1 is the one that costs real time, and it is the one that stops your
first real payout from happening with the plan's own gate open.

**If you approve, the Executor's first act is not code** — it is applying P1/P4/P6/P7 to
`04-rise-to-wise-migration-plan.md`, `00-README-…`, `01-…design.md`, `05-artifact-amendments.md`,
`06-…inventory.md`, the `4a-w1-…` order's handoff, and the v6 handbook, then PRE-DRAFTing the new
`4A-W4`. P2/P3/P5 are content _for_ that session, not edits to make now.

---

## What I am NOT proposing (considered and rejected)

| Considered                                               | Why rejected                                                                                                                                                                                                                                                           |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Run all of `4A-8` before the Wise series                 | Costs a full session of delay, and 4A-8 would audit a money surface that does not yet include Wise — so its dedupe/idempotency checks get partly re-run at W8 anyway. P1 gets the safety at a third of the cost.                                                       |
| Split `4A-8` into `4A-8a` / `4A-8b`                      | Renames an existing, playbook-referenced session. `00-SKELETON-AND-RULES.md` §5 forbids exactly that. Adding a new W-series session achieves the same thing without touching anything that already has references.                                                     |
| Move the Wise series after `4A-8` entirely               | You already made this sequencing call (after 4A-7). P1 respects your decision and closes the gate inside it, rather than re-litigating it.                                                                                                                             |
| Renumber the Wise flags to F50+                          | Removes a visual ambiguity but invalidates references already delivered in the docset and the v6 handbook. See P7.2.                                                                                                                                                   |
| Resolve **F13** (observability backend) inside Part 19.5 | Genuinely tempting, since the funding-SLA alarm wants somewhere to fire. But F13 is a whole-platform decision due at 4B-4, and hijacking it for one alert would set the tracing backend by accident. P5's option (a) gets the alert delivered without pre-empting F13. |
| Fix Stripe/dLocal write-path idempotency in `4A-W4`      | That is 4A-8's actual scope. W4 **audits and records**; it does not fix. Otherwise 4A-8 becomes an empty session and the Slice 4 gate loses its meaning.                                                                                                               |
