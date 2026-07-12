# Migration Orders — Shared Skeleton, Rules & the Session Chain

**What a migration order is:** the one-page work plan for exactly ONE playbook session
(`docs/migration-orders/monolith-to-microservices-migration-session-playbook.md`). Every session executes an
approved order and drafts the next one. This file defines what ALL orders share; the
`TEMPLATE-*.md` variants define what differs per session type.

---

## 1. The chain protocol (three roles — see `development-chain-protocol.jpg`)

| Role                | Who                        | Does                                                                    |
| ------------------- | -------------------------- | ----------------------------------------------------------------------- |
| **Executor**        | Claude Code (Sonnet)       | Confirms & executes orders; produces the PRE-DRAFT for the next session |
| **Advisor/Planner** | Claude Cowork (Fable/Opus) | Upgrades PRE-DRAFT → DRAFT using the strategy docs + templates          |
| **Authorizer**      | Davin                      | Approves every DRAFT; his approval is the gate                          |

**Order status lifecycle:** `PRE-DRAFT → DRAFT → APPROVED → CONFIRMED → executed`

1. **End of session N (Executor):** fill this session's **Deviations**, update CLAUDE.md,
   then write `<session>-<slug>.migration-order.md` for session N+1 with status `PRE-DRAFT`
   — raw facts: what changed, surprises, candidate steps. **Artifacts are the only channel**
   to the Advisor (it never sees the session transcript) — an empty Deviations section or
   stale CLAUDE.md starves the next plan.
2. **Between sessions (Advisor):** Davin prompts Claude Cowork with the PRE-DRAFT; it
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
2. **Entry criteria** (checkboxes — verified at CONFIRM time, not assumed)
3. **Ordered steps** — each step carries its own verification, not just a description
4. **Done when** — the session's objective exit test
5. **Rollback** — for any step that changes a live system (omit only for read-only sessions)
6. **Deviations** — filled DURING execution (see §4); starts empty, never deleted
7. **Next-session handoff** — the DRAFT order for the following session (chain protocol §1)

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
