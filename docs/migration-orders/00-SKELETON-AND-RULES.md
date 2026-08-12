# Migration Orders — Shared Skeleton, Rules & the Session Chain

**What a migration order is:** the one-page work plan for exactly ONE playbook session
(`docs/migration-orders/monolith-to-microservices-migration-session-playbook.md`). Every session executes an
approved order and drafts the next one. This file defines what ALL orders share; the
`TEMPLATE-*.md` variants define what differs per session type.

---

## 1. The chain protocol (three roles — see `development-chain-protocol.jpg`)

| Role                | Who                  | Does                                                                    |
| ------------------- | -------------------- | ----------------------------------------------------------------------- |
| **Executor**        | Claude Code (Sonnet) | Confirms & executes orders; produces the PRE-DRAFT for the next session |
| **Advisor/Planner** | Antigravity (IDE)    | Upgrades PRE-DRAFT → DRAFT using the strategy docs + templates          |
| **Authorizer**      | Davin                | Approves every DRAFT; his approval is the gate                          |

### 1.0 The decision model — who decides, who asks (binding from 2026-08-11)

The two AI roles have **deliberately asymmetric** authority, because they have deliberately
asymmetric evidence:

> **The Advisor decides from documents. The Executor decides from live code.**
> **The Advisor does not ask; the Executor does.**

|                     | **Advisor (Antigravity)**                                                                                                                                                | **Executor (Claude Code)**                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sees                | The docset: plan, playbook, orders, flags, lessons. A whole-repo view, but a _static_ one.                                                                               | The live tree, real runtime, real test output, real deploy state.                                                                                                |
| On an open question | **Decides.** Picks the best-practice option and writes it into the DRAFT with its rationale. **Must not send the question back to Davin.**                               | **Escalates.** Stops and asks Davin.                                                                                                                             |
| Why                 | An Advisor that asks converts every judgment call into a round-trip and stalls the chain. Its choices are reviewable — Davin's `APPROVED` at BEAT 2 _is_ the checkpoint. | An Executor that guesses ships a wrong assumption into the codebase, where it is expensive to find. Its uncertainty is usually evidence the documents are wrong. |

**Why this is safe:** the Advisor is not deciding _unreviewed_ — it is deciding _in a document
Davin must approve before anything executes_. The decision moved from a separate round-trip into
the artifact he already reads. That only holds if he can see it, which is why §3 makes
**`Decisions taken`** a mandatory section of every order.

**Advisor decides autonomously:** template variant · step sequencing · which files to touch ·
generation strategy and tooling · library and pattern choices · test strategy · audit method ·
naming — anything where "what is best practice here?" has a defensible, evidence-backed answer.

**Advisor must still flag, but with a recommendation attached — never as an open question.**
Mark these **`⚠ NEEDS EXPLICIT SIGN-OFF`** inside `Decisions taken` so they cannot be approved by
skimming: real money movement · auth semantics · secrets or role grants · production deploys ·
cutover flag flips · deletion of production data · legal/compliance content. (Same list as
`EXECUTOR-PROTOCOL.md` §7.)

**Executor escalates — always:** an order's claim contradicted by live code · a document that
contradicts another document · anything the order does not cover · a test failure it cannot
explain · any §7 item. **When the Advisor's plan and the live code disagree, live code wins** —
the Executor reports the conflict, and the plan is revised to match reality, never the reverse.

**Neither role edits the other's artifacts.** The Advisor owns `*.migration-order.md`. The
Executor owns `CLAUDE.md`, `DECISION-LOG.md`, `migration-cutover-table.md` and
`migration-stack-analysis.md`, written at session CLOSE (`EXECUTOR-PROTOCOL.md` §3). If the
Advisor believes one of those needs changing, it says so in the DRAFT and lets the Executor do it.

**Order status lifecycle:** `PRE-DRAFT → DRAFT → APPROVED → CONFIRMED → executed`

1. **End of session N (Executor):** fill this session's **Deviations**, update CLAUDE.md,
   then write `<session>-<slug>.migration-order.md` for session N+1 with status `PRE-DRAFT`
   — raw facts: what changed, surprises, candidate steps. **Artifacts are the only channel**
   to the Advisor (it never sees the session transcript) — an empty Deviations section or
   stale CLAUDE.md starves the next plan.
2. **Between sessions (Advisor):** Davin prompts Antigravity with the PRE-DRAFT; it
   produces the authoritative `DRAFT` — correct template variant, skeleton as minimum
   required content, strategy context (plan, flags, playbook, file inventory) applied.
   **Canonical prompt (step 7 in the diagram):** _"Here's the PRE-DRAFT from session <N> —
   produce the DRAFT for session <N+1> per 00-SKELETON-AND-RULES.md."_ This short form is
   sufficient BECAUSE this file binds the Advisor to §2 (best mix of variant sections) and
   §3 (skeleton = minimum content) on every invocation — the prompt never needs to restate
   them.
3. **Authorization (Davin):** review → mark `APPROVED` (or send back).
4. **Start of session N+1 (Executor):** re-verify the APPROVED order against the current
   **codebase** (paths, line counts, flag states) _and_ **runtime state** (shadow-run diffs,
   wait-clocks elapsed, dashboards) → mark `CONFIRMED` → execute. **Never execute anything
   not CONFIRMED.**
5. **Chain length is exactly one.** Never draft two sessions ahead.
6. **Fast-path:** for VERIFY-RETIRE sessions (~10-line checklists) the PRE-DRAFT may go
   straight to Davin for approval, skipping the Advisor step — ceremony proportional to work.

## 2. Which template variant for which session

| Variant                     | Session type                               | Playbook examples                    | Creativity dial |
| --------------------------- | ------------------------------------------ | ------------------------------------ | --------------- |
| `TEMPLATE-CONTRACT.md`      | Research, specs, audits, gap analysis      | 0-1…0-4, 1-1, 6-1                    | Medium          |
| `TEMPLATE-INFRA.md`         | Provisioning, roles, deploys, environments | 0-5, 1-2…1-4, 4A-1, 4B-1             | Medium          |
| `TEMPLATE-PORT.md`          | Moving existing code between stacks        | all Phase 4 BUILDs, 2-2…2-4, 3-2     | **Low**         |
| `TEMPLATE-UPGRADE.md`       | Dependency/framework version bumps         | 2-1 (Prisma), 5-1…5-4 (Next 16)      | Medium          |
| `TEMPLATE-UI-BUILD.md`      | New/redesigned frontend surfaces           | 3-3, 6-2…6-8                         | **High**        |
| `TEMPLATE-VERIFY-RETIRE.md` | Cutovers, deletions, exit reviews          | every CUTOVER, 8-1, 8-5, phase exits | **Near zero**   |

If a session mixes types (common), use the dominant variant and borrow sections — the
Advisor always **chooses the best mix of sections from the variants** for the session at hand.

## 3. Sections every order has (the skeleton)

**The skeleton is the MINIMUM required content of every order** — variants and the Advisor
may add sections, never remove these:

1. **Header:** session ref · phase/plan section · variant used · status (PRE-DRAFT/DRAFT/APPROVED/CONFIRMED) ·
   generated date · flags touched · estimated time (split the session if > ~4h)
2. **Decisions taken** — **added 2026-08-11, mandatory in every DRAFT** (see §1.0). A short,
   scannable list of every judgment call the Advisor made instead of asking Davin. One line each:
   **what was chosen · what was rejected · why · how hard to undo.** Placed at the TOP of the
   order, immediately after the header — never buried inside the ordered steps. Items on the §7
   list carry **`⚠ NEEDS EXPLICIT SIGN-OFF`**. This section is the mechanism that makes
   "the Advisor decides" safe: it is what Davin actually reviews at BEAT 2. An order whose
   decisions are discoverable only by reading step 7 has failed this requirement.
   _(A PRE-DRAFT written by the Executor may leave this empty or list open questions for the
   Advisor to resolve — the Executor is not the deciding role.)_
3. **Entry criteria** (checkboxes — verified at CONFIRM time, not assumed)
4. **Ordered steps** — each step carries its own verification, not just a description
5. **Done when** — the session's objective exit test
6. **Rollback** — for any step that changes a live system (omit only for read-only sessions)
7. **Deviations** — filled DURING execution (see §4); starts empty, never deleted
8. **Next-session handoff** — the DRAFT order for the following session (chain protocol §1)

## 4. Autonomy & deviation (applies to every order)

This order describes **intent, not keystrokes**. Claude Code is free — encouraged — to choose
better implementation approaches, code organization, naming, and additional tests than
outlined, and to reorder steps where the dependency graph allows. The outline was written
before the code was touched; the executor always knows more than the planner.

Claude Code is **NOT** free to change:

- observable behavior, API/message/contract shapes, or anything marked **invariant**;
- the session's scope — no drive-by fixes to change-frozen (CC-F) or out-of-scope code;
- verification steps — they may be strengthened, never skipped;
- security-relevant decisions (auth, grants, secrets, CORS) without explicit approval.

**Deviation protocol:** believe the outline is wrong, or see a materially better approach?

- _Small and in-bounds_ → do it, record it in the **Deviations** section (what/why/impact).
- _Material, boundary-touching, or invariant-adjacent_ → STOP and ask Davin first.

> A deviation silently made is a bug; a deviation recorded is a contribution.

**The creativity dial** (per-variant, table above) sets the default posture: at **Low**,
preserve behavior obsessively and treat every "improvement" instinct as suspect; at **High**,
the contract constrains the data, not the design — propose freely. The dial never overrides
the NOT-free list.

## 5. Style rules

- Keep orders to ~1–2 pages. Ceremony proportional to work: a cutover order is ~10 lines.
- Ground every file reference in the live codebase at CONFIRM time (paths + line counts).
- Old `docs/build-orders/part-XX.md` docs are background for _why_; never copy their steps.
- Every order ends updating: CLAUDE.md, Decision Log (if flags), cutover table (if routes),
  and `migration-stack-analysis.md` entries (if the session created/moved/deleted files) —
  the Executor maintains the inventory the Advisor plans from; full regeneration only at 8.6.
- **Playbook maintenance is the Advisor's job, event-driven not per-session:** the playbook
  needs no filename upkeep, but when deviations change session boundaries (split / skip /
  insert) or a flag resolution changes a phase's session list, the Advisor proposes the
  playbook amendment in the same DRAFT it hands Davin — one approval covers both. When
  inserting sessions, use suffixes (`4B-2b`) — never renumber existing sessions (stale
  references in CLAUDE.md, orders, and commits would silently point at the wrong work).
  Any playbook amendment must update `prompt-to-claude-code/SESSION-PROMPT-SCRIPT.md` in
  the same DRAFT — the script and the playbook must never disagree about which sessions exist.
