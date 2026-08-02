# Session Prompt Script — exactly what to say, for every session

**How to use:** each playbook session needs up to three prompts from you: **[A]** to the
Advisor (Claude Cowork) between sessions, **[B]** to Claude Code at OPEN, **[C]** to Claude
Code at CLOSE. Most sessions use the universal forms below — this script tells you _which_
form each session uses and the **session-specific line to append**. Copy-paste; replace only
`<angle-brackets>`. Companions: `SESSION-WALKTHROUGHS.md` (**start there** — complete
sessions played out as real dialogues, one per session type, with what good responses look
like and the red flags) and `HOW-TO-TALK-TO-CLAUDE-CODE.md` (situational prompts for things
that happen _during_ execution — stuck, risky, wrong, broken).

---

## The universal forms

**U-A — Advisor, between sessions (produce the DRAFT):**

> Here's the PRE-DRAFT from session <N> — produce the DRAFT for session <N+1> per
> 00-SKELETON-AND-RULES.md. <+ any session-specific line from the script below>

**U-B — Executor, session OPEN:**

> Read CLAUDE.md and docs/migration-orders/EXECUTOR-PROTOCOL.md. CONFIRM the APPROVED order
> for session <P-N> against the current codebase AND runtime state, and show me: what
> changed since drafting, the "done when" checks, and any failing entry criterion. Do not
> execute until I say go. <+ session-specific line>

**U-C — Executor, session CLOSE:**

> Wrap up per EXECUTOR-PROTOCOL §3: tests + results, fill Deviations, update the artifacts,
> harvest any lesson, then PRE-DRAFT session <next>'s order and show it to me.

**U-CUT — Cutover approval (VERIFY-RETIRE sessions, after reviewing the diff):**

> Every mismatch explained — approved. Flip <flag>, monitor <duration>, report error rate.
> Anything degrades: flip back first, tell me second.

**U-FAST — Fast-path approval (you, on a VERIFY-RETIRE PRE-DRAFT, no Advisor step):**

> Fast-path approved as written — mark it APPROVED and proceed to CONFIRM at next session
> open.

**U-WAIT — Entering any wait (48h shadow-run / 30-day window):**

> Confirm the clock: what started, exact end date/time UTC, what to watch, what failure
> ends the wait early. Put all four in CLAUDE.md under "Waiting on".

---

## Phase 0 — Foundations

**0-1 (bootstrap — NO PRE-DRAFT exists, skip [A]):**

- [B]: > Read CLAUDE.md, docs/migration-orders/EXECUTOR-PROTOCOL.md, and the session
  playbook. We are starting Session 0-1. Generate its migration order from
  TEMPLATE-CONTRACT.md, show it to me for approval, and wait.
- After you approve: > Go. · Append to go-line: _"Resolve F2 and the F19 npm check first —
  show me each Decision Log entry before writing the reference notes."_
- [C]: U-C.

**0-2 (OpenAPI batch 1):** [A]: U-A + _"variant: CONTRACT; scope is the operation-domain
route groups only — money routes are 0-3's."_ · [B]: U-B · [C]: U-C.

**0-3 (OpenAPI batch 2):** [A]: U-A + _"close F1 this session — every route covered or
explicitly marked internal-only."_ · [B]: U-B · [C]: U-C.

**0-4 (secrets + baseline):** [A]: U-A + _"catalog secret NAMES only, never values."_
· [B]: U-B + _"I'll provide dashboard access when you list what you need."_ · [C]: U-C.

**0-5 (staging + local dev):** [A]: U-A + _"include my F17 decision: <synthetic seed —
recommended / your choice>."_ · [B]: U-B · [C]: U-C + _"then walk the Phase 0 exit criteria
one by one with evidence."_

## Phase 1 — Railway PostgreSQL

**1-1 (find DB + restore rehearsal):** [A]: U-A + _"F3 investigation first, destructive
nothing; include my F18 decision: RPO ≤<24h>, RTO ≤<1h>."_ · [B]: U-B + _"database
credentials: <how you'll provide>."_ · [C]: U-C.

**1-2 (CONDITIONAL relocation — only if F3 found DB off-Railway; otherwise skip):**
[A]: U-A + _"include the maintenance-window plan; I approve the window time explicitly."_
· [B]: U-B + _"before the dump: prove the restore rehearsal from 1-1 passed."_ · [C]: U-C.

**1-3 (roles + PgBouncer):** [A]: U-A · [B]: U-B + _"remember L3: migrations on the DIRECT
url."_ · [C]: U-C.

**1-4 (denial smoke tests):** [A]: U-A (or U-FAST — this is checklist-like) · [B]: U-B ·
[C]: U-C + _"walk Phase 1 exit criteria; confirm railway-gateway ingest never blipped."_

## Phase 2 — Prisma 7.8.0 + schema split

**2-1 (Prisma upgrade, isolated):** [A]: U-A + _"variant: UPGRADE; F19 audit is step 1 —
no code edits before I've seen the hit-list."_ · [B]: U-B · Mid-session gate: > Show me the
F19 hit-list and the official upgrade-guide URLs you read. _(then)_ > Proceed. · Production
deploy needs your explicit: > Deploy. · [C]: U-C.

**2-2 (model census + split, F4/F5):** [A]: U-A + _"include F5 recommendation with Prisma-7
evidence."_ · [B]: U-B · [C]: U-C + _"show me the full model census table — every model
assigned, none ambiguous."_

**2-3 (baseline migration + FK audit):** [A]: U-A + _"first migration must be a no-op
baseline — never a create."_ · [B]: U-B · [C]: U-C + _"list every FK dropped, with its
kept column+index."_

**2-4 (rewire monolith):** [A]: U-A · [B]: U-B · [C]: U-C + _"walk Phase 2 exit criteria;
zero behavior change is the claim — prove it with the baseline diff."_

## Phase 3 — Hybrid JWT auth

**3-1 (decisions + skeleton + bridge):** [A]: U-A + _"present F6/F7 options for my decision
before scaffolding."_ · Your decision reply: > Decision: F6 = <bridge-first>, F7 = <HS256
now, JWKS when second verifier lands>. Record both in the Decision Log, approved by Davin,
then continue. · [B]: U-B · [C]: U-C.

**3-2 (token endpoints):** [A]: U-A + _"reuse lib/auth logic — 2FA and lockout semantics are
invariants."_ · [B]: U-B · [C]: U-C.

**3-3 (Next.js side):** [A]: U-A (variant: UI-BUILD) · [B]: U-B · [C]: U-C + _"demo the
staging walkthrough: login → dashboard SSR → browser call → logout."_

**3-4 (CORS + secondary flows):** [A]: U-A · [B]: U-B + _"CORS origins are security — list
them for my sign-off before applying."_ · [C]: U-C.

**3-5 (three-path verification, phase exit):** [A]: U-A · [B]: U-B · [C]: U-C + _"walk
Phase 3 exit criteria; confirm production NextAuth untouched and regression-free."_

## Phase 4 — Backend move (two patterns + a complete session-by-session table)

**P4-BUILD (the pattern for every BUILD row below):**

- [A]: U-A + _"variant: PORT, dial LOW; generate the migration order at 4B-2-example depth —
  I approve the order before any porting."_ + the row's specific line.
- [B]: U-B + _"re-verify the SOURCE file list and line counts explicitly."_
- [C]: U-C + _"confirm shadow/mirror-run STARTED and the source files are now CC-F frozen —
  state the exact 48h end time."_ then **U-WAIT**.

**P4-CUTOVER (the pattern for every CUTOVER row below — fast-path, no Advisor):**

- On the PRE-DRAFT: **U-FAST**.
- [B]: U-B + _"first: the shadow/replay diff — total compared, match rate, EVERY mismatch
  with your explanation."_
- Approve with **U-CUT** using the row's flag/mechanism. · [C]: U-C.

### Phase 4A — money-service, all 12 sessions

| Session | What                                                           | Pattern                                   | Session-specific line to append                                                                                                                                                                                                                                                                                                                                                    |
| ------- | -------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4A-1    | Skeleton + Railway deploy + cutover-table rows                 | Decision + INFRA ([A]: U-A variant INFRA) | _"include my F16 decision: <api.domain/v1 + money.domain/v1> and F15 default (one Redis, op._/money._ namespaces); populate the real cutover-table rows."_                                                                                                                                                                                                                         |
| 4A-2    | BUILD slice 1: 8 cron jobs                                     | P4-BUILD                                  | _"crons keep the identical UTC expressions from vercel.json — that's the invariant."_                                                                                                                                                                                                                                                                                              |
| 4A-3    | CUTOVER slice 1                                                | P4-CUTOVER                                | Mechanism: enable Nest scheduler + empty vercel.json crons. Rollback: restore vercel.json crons.                                                                                                                                                                                                                                                                                   |
| 4A-4    | BUILD slice 2: RiseWorks + dLocal webhooks                     | P4-BUILD                                  | _"verification is REPLAY tests with recorded signed payloads (raw-body HMAC) — not a 48h shadow."_                                                                                                                                                                                                                                                                                 |
| 4A-5    | CUTOVER slice 2                                                | P4-CUTOVER                                | Add: _"I'll update the provider dashboard URLs — walk me through each console click."_ Rollback: point URLs back.                                                                                                                                                                                                                                                                  |
| 4A-6    | BUILD slice 3: read APIs (dashboards, reports, admin lists)    | P4-BUILD                                  | — (standard; 48h shadow)                                                                                                                                                                                                                                                                                                                                                           |
| 4A-7    | CUTOVER slice 3                                                | P4-CUTOVER                                | Mechanism: env flag base-URL swap. Rollback: flip flag back.                                                                                                                                                                                                                                                                                                                       |
| 4A-W1   | Part 19.5 contracts & decisions (Wise)                         | CONTRACT ([A]: research/spec)             | _"read `docs/migration-orders/replace-rise-with-wise/` 00→06 first. Resolve F36/F37 with me. Check my Wise account for Business Payment Approval rules — they break API transfers. No code this session."_ — executed 2026-07-26: F36=Model A, F37=MANUAL, approval rules absent.                                                                                                  |
| 4A-W2   | Part 19.5 additive schema migration                            | INFRA + PORT rules                        | _"the migration is authored in `prisma/non-market-data/schema.prisma` ONLY. Show me the generated SQL before applying — any DROP/RENAME/ALTER COLUMN aborts the session. money-service gets `prisma generate` only (L1)."_                                                                                                                                                         |
| 4A-W3a  | BUILD Wise recipient onboarding backend                        | PORT (Low dial)                           | _"the recipient account requirements must be schema-driven from Wise's account-requirements endpoint — do not hard-code Thai bank fields. Store only accountTail and detailsFingerprint (SHA-256); zero raw bank details in DB or logs. Native fetch and crypto only."_                                                                                                            |
| 4A-W3b  | BUILD Wise recipient onboarding UI                             | UI-BUILD (High dial)                      | _"dynamic schema-driven React form component rendering input fields from Wise account-requirements response + admin recipient list page."_                                                                                                                                                                                                                                         |
| 4A-W4   | CC-C/CC-D hardening gate (money surface)                       | CONTRACT ([A]: audit/spec) + small INFRA  | _"audit only for Stripe/dLocal write paths — do NOT fix them, that's 4A-8's. DO fix the two live defects: add `enableShutdownHooks()` (`PrismaService.onModuleDestroy` is dead code today) and put an explicit generous `@Throttle()` on `/v1/webhooks/dlocal`, verified by replay before and after. Write the BullMQ job-ID policy before the first queue exists. Register F43."_ |
| 4A-W5   | BUILD Wise webhook + state reducer                             | P4-BUILD                                  | _"verification is REPLAY with real Wise-signed payloads from the sandbox Simulation API. Dedupe on X-Delivery-Id, order on data.occurred_at. Only this reducer may mark a commission PAID."_                                                                                                                                                                                       |
| 4A-W6   | BUILD Wise payout engine + funding gate                        | P4-BUILD                                  | _"branch the orchestrator on `isFundable` — a drafted Wise batch must NEVER write Commission.status or the affiliate balance. Every existing orchestrator test must still pass unmodified."_                                                                                                                                                                                       |
| 4A-W7   | CUTOVER to Wise — **REAL MONEY**                               | P4-CUTOVER + Walkthrough F                | Money-audit prompt first. Then: _"walk me through the Wise Developer Hub subscription clicks, then ONE affiliate, smallest amount. I fund it in the Wise app while you watch the logs."_ Rollback: `DISBURSEMENT_PROVIDER=MOCK` + delete subscriptions.                                                                                                                            |
| 4A-W8   | ARCHIVE RiseWorks + artefacts                                  | P4-CUTOVER (VERIFY-RETIRE, archive block) | _"ARCHIVE, not retire — delete NOTHING. Every RiseWorks test must still pass, and the row counts for AffiliateRiseAccount / RiseWorksWebhookEvent must be identical before and after. Dry-run the restore."_                                                                                                                                                                       |
| 4A-8    | CC-C hardening gate (idempotency, dedupe, outbox, rate limits) | Standard loop (B)                         | [A] add: _"resolve F14 (recommend outbox) incl. the reconciliation-cron design — slice 4 does not proceed until this session's done-when passes."_                                                                                                                                                                                                                                 |
| 4A-9    | BUILD slice 4: write APIs + Stripe webhook                     | P4-BUILD                                  | _"every write endpoint lists its idempotency key in the order — a write without one is a blocker, not a TODO."_                                                                                                                                                                                                                                                                    |
| 4A-10   | CUTOVER slice 4 — **REAL MONEY**                               | P4-CUTOVER + Walkthrough F                | Before approving, ALWAYS the money-audit prompt (Walkthrough F). Stripe webhook URL swap included.                                                                                                                                                                                                                                                                                 |
| 4A-11   | BUILD slice 5: tier-update event path                          | P4-BUILD                                  | _"implements the F14 outbox + nightly reconciliation cron; core-side apply must be idempotent."_                                                                                                                                                                                                                                                                                   |
| 4A-12   | CUTOVER slice 5                                                | P4-CUTOVER                                | Mechanism: core stops reading Subscription directly. Rollback: re-enable direct read. Then **U-WAIT** — the money-service 30-day stability window starts.                                                                                                                                                                                                                          |

### Phase 4B — operation-service, all 22 sessions

| Session   | What                                                                      | Pattern                              | Session-specific line to append                                                                                                                                       |
| --------- | ------------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4B-1      | @trading-alerts/types package + geometry hoist                            | Standard loop (B), [A] variant INFRA | _"resolve F9; hoisting the drawing geometry is part of this — see the 4B-2 order's Wrinkle #1. Never fork the math."_                                                 |
| 4B-2      | BUILD: alert engine (11 files)                                            | P4-BUILD                             | _"the order already exists — re-verify 4B-2-alert-engine.migration-order.md against the live codebase and upgrade it to DRAFT."_ (Its wait is a log-only MIRROR-run.) |
| 4B-3      | CUTOVER: alert engine                                                     | P4-CUTOVER                           | _"one worker dispatching at a time: stop the monolith worker, THEN enable service dispatch — jobId dedupe is the backstop, not the plan."_                            |
| 4B-4      | Shared infra: redis/cache/logger/errors/monitoring + OTel/correlation IDs | Standard loop (B)                    | [A] add: _"resolve F13 (tracing backend) here if still open — this is where the OTel SDK lands."_                                                                     |
| 4B-5      | BUILD: alerts CRUD (app/api/alerts/\*\*)                                  | P4-BUILD                             | —                                                                                                                                                                     |
| 4B-6      | CUTOVER: alerts CRUD                                                      | P4-CUTOVER                           | Flag: MIGRATE_ALERTS.                                                                                                                                                 |
| 4B-7      | BUILD: drawings + drawing-alerts                                          | P4-BUILD                             | _"geometry parity is THE invariant — same fixtures in, same level numbers out, chart vs server."_                                                                     |
| 4B-8      | Drawings CRUD (PORT + CUTOVER combined)                                   | PORT+CUTOVER (E fast-path)           | Flag: `MIGRATE_DRAWINGS=true`. Completed 2026-08-01.                                                                                                                  |
| 4B-9      | Notifications (PORT + CUTOVER combined)                                   | PORT+CUTOVER (E fast-path)           | Flag: `MIGRATE_NOTIFICATIONS=true`. Completed 2026-08-02.                                                                                                             |
| 4B-10     | Tier System & TierGuard (PORT + CUTOVER combined)                         | PORT+CUTOVER (E fast-path)           | Flag: `MIGRATE_TIER=true`. Completed 2026-08-02.                                                                                                                      |
| 4B-11     | User Profile, 2FA, Sessions & Deletion (PORT + CUTOVER combined)          | PORT+CUTOVER (E fast-path)           | Flags: `MIGRATE_USER_PROFILE=true`, `_2FA=true`, `_SESSIONS=true`. Completed 2026-08-02.                                                                              |
| 4B-12     | Market Data Channel Proxy (PORT + CUTOVER combined)                       | PORT+CUTOVER (E fast-path)           | Flag: `MIGRATE_MARKET_DATA_CHANNEL=true`. Completed 2026-08-02 (F52 resolved).                                                                                        |
| 4B-13..16 | Reserved Domain Slots (SUPERSEDED)                                        | SUPERSEDED                           | _All 7 Phase 4B domain extractions completed at 4B-12 via combined PORT+CUTOVER shape._                                                                               |
| 4B-17     | BUILD: realtime/websocket delivery (F8)                                   | P4-BUILD                             | [A] add: _"F8 FIRST — read both realtime spec docs and present socket-architecture options for my decision before any porting."_                                      |
| 4B-18     | CUTOVER: realtime                                                         | P4-CUTOVER                           | _"drain existing socket connections gracefully; prove one live alert → toast + chart marker end-to-end before I approve."_                                            |
| 4B-19     | Email rendering port (emails/\* + lib/email)                              | Standard loop (B)                    | _"render every template and show me the outputs for visual check before the send-path switches."_                                                                     |
| 4B-20     | Auth cutover BUILD (staging verification)                                 | P4-BUILD + Walkthrough F treatment   | _"treat like money: what breaks if this goes wrong, how do users get back in, rollback demonstrated in staging?"_                                                     |
| 4B-21     | Auth CUTOVER — retire NextAuth                                            | P4-CUTOVER + Walkthrough F treatment | The riskiest 4B moment. Rollback = re-enable NextAuth route + auth-options (kept until 4B-22 confirms).                                                               |
| 4B-22     | Phase 4 exit review                                                       | E fast-path (U-FAST)                 | [B] add: _"cutover table 100% walk-through, row by row, with evidence per row."_ Then **U-WAIT** — operation-service 30-day window.                                   |

**Parallel note:** Phase 5 sessions (below) may run during any Phase 4 wait — they touch
different files.

## Phase 5 — Next.js 16 (may interleave with Phase 4)

**5-1 (audit + baseline, F10):** [A]: U-A + _"variant: UPGRADE; fetch the official 15→16
guide — hit-list before any edit."_ · [B]: U-B · [C]: U-C.
**5-2 (bump + codemods):** [A]: U-A · [B]: U-B · deploy gate: > Deploy to preview. · [C]: U-C.
**5-3 (bundle optimizations):** [A]: U-A + _"bundle ≤ baseline is a hard gate."_ · [B]: U-B · [C]: U-C.
**5-4 (fonts + streaming + exit):** [A]: U-A · [B]: U-B · [C]: U-C + _"walk Phase 5 exit
criteria with the before/after metrics table."_

## Phase 6 — Frontend redesign

**6-1 (gap matrix, F11 — YOUR session as much as its):** [A]: U-A + _"variant: CONTRACT;
output is the gap matrix for my triage — no building."_ · [B]: U-B · Your triage reply:

> Triage: rows <…> = build, rows <…> = internal-only, rows <…> = out-of-scope. Record in
> the matrix and Decision Log. · [C]: U-C.
> **6-2 (IA + design system):** [A]: U-A (variant: UI-BUILD, dial HIGH) · [B]: U-B · [C]: U-C.
> **6-3 (surface: alerts + charts, incl. MTF toggle + V8 variant UI):** [A]: U-A + _"variant:
> UI-BUILD; propose design freely — the contract constrains the data. V8 PRO gating stays."_
> · [B]: U-B · staging review: > Show me the staging URL; I review before the flag flips. · [C]: U-C.

**6-4 (surface: notifications UX):** same as 6-3, surface line: _"notifications — live toast,
bell, list; ties to the 4B-17/18 realtime path."_

**6-5 (surface: settings + user, incl. 2FA screens):** same as 6-3, surface line:
_"settings/user — 2FA flows re-verified end-to-end in the browser."_

**6-6 (surface: admin, incl. disbursement lifecycle views):** same as 6-3, surface line:
_"admin — batch lifecycle states must mirror the cutover-table vocabulary users of the money
service actually see."_

**6-7 (surface: affiliate portal + reports):** same as 6-3, surface line: _"affiliate —
report views for every report endpoint in the gap matrix marked build."_

**6-8 (surface: payments/checkout):** same as 6-3 PLUS the money rule: _"never render
amounts from client math — display what the service returns."_

**6-9 (a11y + exit):** U-FAST · [B]: U-B · [C]: U-C + \_"final gap-matrix sweep — every row

> closed, internal, or ticketed."\_

## Phase 7 — API client

**7-1 (re-verify + generate):** [A]: U-A + _"first step: re-read the lib/api flag's mismatch
list vs the NEW routes; client is GENERATED from OpenAPI, not hand-written."_ · [B]: U-B · [C]: U-C.
**7-2 (migrate consumers):** [A]: U-A + _"ends with the lint rule banning stray fetch() —
show me it failing on a planted violation."_ · [B]: U-B · [C]: U-C.
**7-3 (contract tests + exit):** [A]: U-A + _"tests against recorded REAL responses — L1
applies."_ · [B]: U-B · [C]: U-C.

## Phase 8 — Decommission

**8-1 (deletion sweep):** U-FAST · [B]: U-B + _"list every file to delete BEFORE deleting —
nothing more than the list."_ · [C]: U-C.
**8-2 (gateway dedup):** [A]: U-A + _"the ingest path must never blip — state how each step
avoids it."_ · [B]: U-B · [C]: U-C.
**8-3 (full e2e):** [A]: U-A + _"all journeys in plan 8.3; payment flows in TEST MODE
only."_ · [B]: U-B · [C]: U-C + _"produce the signed-off test report."_
**8-4 (load test + cost):** [A]: U-A · [B]: U-B · [C]: U-C + _"include the capacity/cost
sheet — real numbers, not estimates."_
**8-5 (close-out):** U-FAST · [B]: U-B · [C]: U-C + _"regenerate migration-stack-analysis.md
via the categorization script, close the Decision Log (all F1–F19 resolved or formally
carried), and give me the migration completion summary."_ then U-WAIT if the 30-day joint
window hasn't elapsed.

---

## If a session goes sideways (any phase)

- Blocker: > Abort per the abort rule: leave the codebase green, write the blocker into
  CLAUDE.md, summarize for a fresh session. We stop here.
- Unplanned incident (like the git-workflow repair): run it as an **ad-hoc session**
  (EXECUTOR-PROTOCOL §6) — same open/close rituals, labeled ADHOC-<date> in CLAUDE.md,
  phase/session unchanged.

**Status:** v1.1 (complete per-session coverage: all 12×4A + 22×4B rows explicit) — matches playbook v1.1 / protocol §1–§7 / skeleton chain rules. If the
Advisor splits or inserts sessions, it must propose the matching update to THIS file in the
same DRAFT (suffix rule: 4B-2b, never renumber).
