# Recommendation: Decomposing the Overloaded CLAUDE.md

## The Problem in Numbers

| Metric                           | Current                    | Target                                        |
| -------------------------------- | -------------------------- | --------------------------------------------- |
| File size                        | 327KB / 3,457 lines        | ~3-5KB / ~80 lines                            |
| Distinct concerns                | 6 (fused)                  | 6 (separated into files)                      |
| Token cost per session OPEN      | ~82,000 tokens (full file) | ~1,500 tokens (slim pointer + targeted reads) |
| Time to find "where are we now?" | Scan through 3,400+ lines  | Read line 1 of `state/current.md`             |

---

## Current Structure (What's Actually in CLAUDE.md)

Based on the line-by-line analysis:

```
Lines 1-11      → IDENTITY (role distinction, mode declaration)
Lines 12-13     → ---
Lines 14-27     → STANDING INSTRUCTIONS (Davin's directives)
Lines 29-36     → CURRENT SESSION POINTER (4B-18, with 4B-17 previous)
Lines 37-275    → SESSION HISTORY (4B-12 back through 4B-9, detailed)
Lines 276-948   → SESSION HISTORY (4B-9 back through 4B-1, deeply detailed)
Lines 948-2085  → SESSION HISTORY (4A-12 back through 4A-W1, deeply detailed)
Lines 2085-2553 → SESSION HISTORY (4A-7b back through 4A-5 + Phase 5 interleave)
Lines 2554-3177 → WAITING-ON TRACKER (#1-#97, many RESOLVED)
Lines 3178-3316 → NEXT-SESSION PLANNING (both tracks)
Lines 3317-3421 → OPEN FLAGS SUMMARY (F1-F52, inline)
Lines 3423-3434 → KEY DOCUMENTS TABLE (static reference)
Lines 3436-3449 → NON-NEGOTIABLES (6 standing rules)
Lines 3451-3457 → SECURITY OVERRIDE POLICY
```

**The core insight:** ~3,300 of 3,457 lines are **append-only historical records** (session outcomes + waiting-on items) that no session actually needs to read in full. Only ~150 lines are genuinely "read every session" material.

---

## Proposed Structure

```
CLAUDE.md                                    ← Slim pointer (~80 lines)
docs/migration-orders/
├── state/
│   ├── current.md                           ← Live session state (what CLAUDE.md line 29 does today)
│   ├── waiting-on.md                        ← Active blockers only (OPEN items from #1-#97)
│   ├── waiting-on-archive.md                ← RESOLVED items (bulk of current content)
│   └── next-sessions.md                     ← Next-session planning (both tracks)
├── history/
│   ├── phase-4b-sessions.md                 ← Sessions 4B-1 through 4B-18
│   ├── phase-4a-sessions.md                 ← Sessions 4A-1 through 4A-12
│   ├── phase-4a-wise-sessions.md            ← Sessions 4A-W1 through 4A-W8
│   └── phase-0-3-5-sessions.md              ← Earlier phases
├── EXECUTOR-PROTOCOL.md                     ← (unchanged)
├── LESSONS-LEARNED.md                       ← (unchanged)
├── DECISION-LOG.md                          ← (unchanged)
└── ... (existing files unchanged)
```

---

## File-by-File Decomposition

### 1. `CLAUDE.md` → Slim Pointer (~80 lines)

The new CLAUDE.md contains ONLY what the Executor (or Advisor) must read at the very start of every session. Everything else is reachable via links.

```markdown
# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.**
> **Role Distinction:**
>
> - **In Antigravity Chat UI:** You act as **Antigravity (Advisor & Architect)**
> - **In Terminal CLI:** You act as **Claude Code (Executor)**
>   Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md`

---

## Current state

> **STANDING INSTRUCTION (Davin, 2026-07-22, NARROWED 2026-07-24):**
> [... the ~12 lines of standing instruction, unchanged ...]

- **Current:** → `docs/migration-orders/state/current.md`
- **Waiting on (OPEN only):** → `docs/migration-orders/state/waiting-on.md`
- **Next sessions:** → `docs/migration-orders/state/next-sessions.md`
- **Session history:** → `docs/migration-orders/history/`
- **Open flags:** F11, F12, F21, F47, F49, F50 — full detail in `DECISION-LOG.md`

## Key documents

| What                                 | Where                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| Operating manual (YOUR rules)        | `docs/migration-orders/EXECUTOR-PROTOCOL.md`                                       |
| Migration plan (phases, flags)       | `docs/migration-orders/monolith-to-microservices-migration-implementation-plan.md` |
| Session playbook                     | `docs/migration-orders/monolith-to-microservices-migration-session-playbook.md`    |
| Order rules + templates              | `docs/migration-orders/00-SKELETON-AND-RULES.md` + `TEMPLATE-*.md`                 |
| Decision Log                         | `docs/migration-orders/DECISION-LOG.md`                                            |
| Lessons learned (read at every OPEN) | `docs/migration-orders/LESSONS-LEARNED.md`                                         |
| Cutover table                        | `docs/migration-orders/migration-cutover-table.md`                                 |
| File inventory                       | `docs/migration-orders/migration-stack-analysis.md`                                |
| **Live state**                       | `docs/migration-orders/state/current.md`                                           |
| **Blockers / waiting-on**            | `docs/migration-orders/state/waiting-on.md`                                        |
| **Session history**                  | `docs/migration-orders/history/`                                                   |

## Non-negotiables (short form — manual has details)

1. **Never execute an order that is not CONFIRMED.**
2. **One session = one verifiable unit of work.**
3. **Artifacts are the only channel.**
4. **Scope discipline.** `lib/api/index.ts` is known-broken BY DESIGN — Phase 7.
5. **Money and auth changes escalate.**
6. **Verification is never skipped, only strengthened.**

## Security Override Policy

Do **NOT** modify `overrides`/`pnpm.overrides` in `package.json` on feature branches.
```

> [!IMPORTANT]
> **Result:** ~80 lines, ~3KB. The Executor reads this in ~750 tokens instead of ~82,000.

---

### 2. `docs/migration-orders/state/current.md` — Live Session State

This is the "hot" file — updated at the end of EVERY session. Contains only:

- Current session + status
- Previous session (1 level, not the full chain)
- Order status for the current session

**Source lines:** CLAUDE.md lines 29-36 (current/previous pointer) + the relevant `Order status (...)` entries from lines 2278-2553.

**Rule:** When a session closes, the outgoing "Current" moves to `history/phase-4b-sessions.md` (or whichever phase file), and the new current replaces it. The file never grows beyond ~50 lines.

---

### 3. `docs/migration-orders/state/waiting-on.md` — Active Blockers Only

**Source lines:** CLAUDE.md lines 2554-3177 (the `Waiting on` tracker).

**Key change:** Only OPEN items live here. When an item is marked RESOLVED, it moves to `waiting-on-archive.md`. Today, the waiting-on section has ~97 numbered items, the majority RESOLVED — likely only ~15-20 are genuinely OPEN.

**Template:**

```markdown
# Waiting On — Active Items

_Items are moved to `waiting-on-archive.md` when RESOLVED._

- **(94, OPEN — 4B-12)** `market_data_v6` has 0 rows — whether `railway-gateway` ...
- **(95, OPEN — 4B-12)** `_prisma_migrations` row still shows `applied_steps_count: 0` ...
- **(96, OPEN — 4B-17)** Browser-session live smoke test not yet run ...
- **(97, OPEN — 4B-17)** `railway logs` gap for successful deployments ...
```

**Estimated size:** ~2-3KB (only OPEN items).

---

### 4. `docs/migration-orders/state/next-sessions.md` — Planning Lookahead

**Source lines:** CLAUDE.md lines 3178-3316.

Contains the "Next session (Phase 4B track)" and "Next session (other tracks)" planning blocks, plus the open flags summary (which really belongs here since it informs what's unblocked next).

---

### 5. `docs/migration-orders/history/phase-4b-sessions.md` — Session Archive

**Source lines:** CLAUDE.md lines 37-948 (all 4B sessions).

This is the largest single extraction. The content is unchanged — it's a forensic record — but it moves from "read every session" to "read on demand when you need to trace a prior session's outcome."

**Same pattern for:**

- `phase-4a-sessions.md` (lines 948-2085)
- `phase-4a-wise-sessions.md` (the W-series, extracted from within the 4A range)
- `phase-0-3-5-sessions.md` (lines 2085-2553, the earlier phases)

---

## What Changes in the Workflow

### EXECUTOR-PROTOCOL §1 (Session OPEN) — Updated Read List

```diff
 1. Read `CLAUDE.md` (root) → identify current phase/session and the current order file.
+   Then read `docs/migration-orders/state/current.md` → the live session state.
+   Then read `docs/migration-orders/state/waiting-on.md` → active blockers.
    Then read `docs/migration-orders/LESSONS-LEARNED.md` (short, Tier-1).
 2. Read the order for THIS session in `docs/migration-orders/`.
```

### EXECUTOR-PROTOCOL §3 (Session CLOSE) — Updated Write List

```diff
 3. Update the artifacts:
-   - `CLAUDE.md` state block: current session done, what next, waiting-on, flag changes.
+   - `docs/migration-orders/state/current.md`: move outgoing current to history, write new current.
+   - `docs/migration-orders/state/waiting-on.md`: add new items, resolve closed items (move to archive).
+   - `docs/migration-orders/state/next-sessions.md`: update planning if changed.
+   - `docs/migration-orders/history/phase-4b-sessions.md`: append the session's full record.
    - `DECISION-LOG.md`: any flag touched.
    - `migration-cutover-table.md`: any route/slice whose status moved.
    - `migration-stack-analysis.md`: affected entries IF files were created/moved/deleted.
```

---

## Migration Strategy

> [!CAUTION]
> This refactoring touches the document that the Advisor plans from and the Executor reads at OPEN. A botched migration could leave both agents unable to find the current state. Execute this as a **dedicated, atomic session**.

### Recommended approach:

1. **Create the directory structure** (`state/`, `history/`)
2. **Extract history first** (lines 37-2553 → the 4 history files) — this is the bulk, and removing it is the lowest-risk move (no session currently references a specific line number in CLAUDE.md's history section)
3. **Extract waiting-on** (lines 2554-3177 → `waiting-on.md` + `waiting-on-archive.md`, splitting OPEN from RESOLVED)
4. **Extract next-sessions + flags** (lines 3178-3421 → `next-sessions.md`)
5. **Rewrite CLAUDE.md** to the slim pointer template above
6. **Update EXECUTOR-PROTOCOL.md** §1 and §3 with the new read/write paths
7. **Commit atomically** — one commit for the whole restructure, so `git blame` shows the move clearly

### Risk mitigation:

- The Advisor (Antigravity) must be told about the new file layout **before** it generates the next order — otherwise it will still expect to write to CLAUDE.md's state block
- The Executor (Claude Code) must read the updated EXECUTOR-PROTOCOL.md at its next OPEN — which it already does by protocol
- Davin should review the slim CLAUDE.md before either agent runs again

---

## Benefits Summary

| Before                                                   | After                                                 |
| -------------------------------------------------------- | ----------------------------------------------------- |
| 327KB read at every session OPEN                         | ~3KB slim pointer + ~5KB targeted reads               |
| ~82,000 tokens consumed before any work starts           | ~2,500 tokens                                         |
| Session history, active state, and rules all in one file | Each concern in its own file, independently readable  |
| Waiting-on items grow forever (97 items, most RESOLVED)  | Only OPEN items in the active file; RESOLVED archived |
| "Where are we?" requires scanning 3,400 lines            | `state/current.md` — always < 50 lines                |
| Risk of accidentally editing historical records          | History files are append-only, rarely touched         |

---

## Alternative: Minimal-Change Variant

If the full decomposition feels too risky mid-migration, a **half-step** that captures 90% of the benefit:

1. **Move only the session history** to `history/` files (this is ~2,500 lines — the bulk)
2. Keep everything else in CLAUDE.md but much shorter (~400 lines instead of 3,457)
3. Defer the waiting-on split and the state/current extraction to a later session

This gets CLAUDE.md from 327KB → ~40KB, which is already a 8× improvement in token cost and makes the file navigable again.
