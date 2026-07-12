# Session Prompt Script — exactly what to say, for every session

**How to use:** each playbook session needs up to three prompts from you: **[A]** to the
Advisor (Claude Cowork) between sessions, **[B]** to Claude Code at OPEN, **[C]** to Claude
Code at CLOSE. Most sessions use the universal forms below — this script tells you _which_
form each session uses and the **session-specific line to append**. Copy-paste; replace only
`<angle-brackets>`. Companion: `HOW-TO-TALK-TO-CLAUDE-CODE.md` (situational prompts for
things that happen _during_ execution — stuck, risky, wrong, broken).

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

## Phase 4 — Backend move (pattern prompts — reuse per slice)

**P4-BUILD (every BUILD session — 4A-2,4,6,9,11 and 4B builds):**

- [A]: U-A + _"variant: PORT, dial LOW; generate the migration order at 4B-2-example depth —
  I approve the order before any porting."_
- [B]: U-B + _"re-verify the SOURCE file list and line counts explicitly."_
- [C]: U-C + _"confirm shadow/mirror-run STARTED and the source files are now CC-F frozen —
  state the exact 48h end time."_ then U-WAIT.

**P4-CUTOVER (every CUTOVER session — fast-path, skip [A]):**

- On the PRE-DRAFT: U-FAST.
- [B]: U-B + _"first: the shadow diff — total compared, match rate, EVERY mismatch with
  explanation."_
- Approve: U-CUT (with the slice's flag name from the cutover table). · [C]: U-C.

**Session-specific additions on top of the patterns:**

- **4A-1 (skeleton + deploy):** [A]: U-A (variant: INFRA) + _"include my F16 decision:
  <api.domain/v1 + money.domain/v1>, and F15 default (one Redis, op._/money._ namespaces)."_
- **4A-5 (webhook cutover):** add to U-CUT: _"I'll update the provider dashboard URLs when
  you give me the exact new endpoints — walk me through each console click."_
- **4A-8 (CC-C hardening gate):** [A]: U-A + _"resolve F14 (recommend outbox) with the
  reconciliation cron design — nothing in slice 4 proceeds until this session's done-when
  passes."_
- **4A-9/10 (MONEY write cutover):** before approving, always: > This touches real money.
  Walk me through it as if I'm auditing you: every write path, every idempotency
  protection, what happens if it runs twice, what happens if it dies halfway. Then wait.
- **4B-1 (types package):** [A]: U-A + _"resolve F9; geometry hoisting for the alert engine
  is part of this — see the 4B-2 order's Wrinkle #1."_
- **4B-2/3 (alert engine):** the worked example order exists — [A]: U-A + _"re-verify
  4B-2-alert-engine.migration-order.md against the live codebase and upgrade it to DRAFT."_
- **4B-17 (realtime, F8):** [A]: U-A + _"F8 first: read both realtime spec docs and present
  the socket-architecture options for my decision before any porting."_
- **4B-20/21 (auth cutover — riskiest of 4B):** treat like money: > Walk me through what
  breaks if this goes wrong and how users get back in. Rollback demonstrated in staging?
- **4B-22 (phase exit review):** U-FAST · [B]: U-B + _"cutover table 100% walk-through, row
  by row."_ then U-WAIT (30-day window).

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
> **6-3…6-8 (surfaces — one per session):** [A]: U-A + _"variant: UI-BUILD; surface:
> <alerts-charts / notifications / settings-user / admin / affiliate / payments>; propose
> design freely, the contract constrains the data."_ · [B]: U-B · staging review: > Show me
> the staging URL; I'll review before the flag flips. · [C]: U-C.
> **6-9 (a11y + exit):** U-FAST · [B]: U-B · [C]: U-C + _"final gap-matrix sweep — every row
> closed, internal, or ticketed."_

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

**Status:** v1.0 — matches playbook v1.1 / protocol §1–§7 / skeleton chain rules. If the
Advisor splits or inserts sessions, it must propose the matching update to THIS file in the
same DRAFT (suffix rule: 4B-2b, never renumber).
