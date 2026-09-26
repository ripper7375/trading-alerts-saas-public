# TASK: Feasibility Assessment & Implementation of CLAUDE.md Refactoring via OKF

Claude, please review the architecture blueprint located at:
`davintrade-claude-md-okf-management/OKF_CLAUDE_MD_ARCHITECTURE_DESIGN.md`

### Context:

Our root `CLAUDE.md` has grown to over 480KB (5,376 lines), consuming ~100k tokens at cold session start due to months of accumulated session logs under `## Current state`. We need to refactor it into an Open Knowledge Format (OKF) Knowledge Tree under `.claude/` and replace `CLAUDE.md` with a Lean Router (< 150 lines).

---

### Step 0: Safety & Zero-Data-Loss Invariant (FIRST STEP)

Before modifying any files:

1. Create a safe, verified local backup copy of the current `CLAUDE.md`:
   ```bash
   cp CLAUDE.md CLAUDE-480KB-PRE-OKF-BACKUP.md
   ```
2. Verify that `CLAUDE-480KB-PRE-OKF-BACKUP.md` matches `CLAUDE.md` exactly in byte count.

---

### Step 1: Feasibility Assessment & Execution Plan

1. Ingest and inspect `davintrade-claude-md-okf-management/OKF_CLAUDE_MD_ARCHITECTURE_DESIGN.md`.
2. Inspect the current `CLAUDE.md` boundaries (line 14 to 4893 for historical logs, line 4894 to 5317 for `Waiting on`, line 5318+ for standing rules).
3. Evaluate:
   - File system permissions and target directory layout under `.claude/`.
   - Tooling readiness (file operations, bash/node/python extraction scripts).
   - Confirmation that zero session history will be discarded (all historical logs are routed to `.claude/state/history/`).
4. Output a brief feasibility confirmation and your step-by-step extraction plan to terminal.

---

### Step 2: Implementation (Proceed Automatically if Feasible)

If feasibility is confirmed and no structural blockers exist, proceed directly with full implementation following Section 8 of the design document:

1. **Phase 1: Knowledge Tree Setup & History Extraction**
   - Create directories: `.claude/state/history`, `.claude/rules`, `.claude/architecture`, `.claude/protocols`.
   - Extract the 4,880 lines of historical session narratives (L14–L4893) into `.claude/state/history/2026-09-sessions.md` (and split older months if appropriate).
   - Ensure the latest 1–2 active sessions are extracted into `.claude/state/current-state.md` with proper YAML frontmatter.

2. **Phase 2: Core OKF Concept Decomposition**
   - Extract `## Waiting on` (L4894–L5317) into `.claude/state/waiting-on.md` and `.claude/architecture/database-traps.md`.
   - Extract `## Non-negotiables` and policies into `.claude/rules/non-negotiables.md`, `.claude/rules/security-overrides.md`, and `.claude/rules/i18n-compliance.md`.
   - Create `.claude/protocols/session-lifecycle.md` documenting the session rotation rule (max 2 sessions in `current-state.md`, older rotated to `history/`).
   - Create `.claude/index.md` cataloging all concept documents.

3. **Phase 3: Deploy the Lean Router `CLAUDE.md`**
   - Overwrite root `CLAUDE.md` with the Lean Router template defined in Section 5.1 of the design doc.
   - Crucial: Preserve the auto-generated Next.js block (`<!-- BEGIN:nextjs-agent-rules --> ... <!-- END:nextjs-agent-rules -->`) at the bottom.
   - Ensure explicit instructions tell future sessions: **DO NOT read all .claude/ sub-files upfront; load on-demand based on task triggers.**

---

### Step 3: Verification & Sanity Check

1. Verify the new size of `CLAUDE.md`: Confirm it is under 5 KB and under 150 lines.
2. Confirm all concept files in `.claude/` exist and contain their expected YAML frontmatter.
3. Run codebase sanity checks:
   - `npx tsc --noEmit`
   - `npm run lint`
4. Report the before-and-after line count, byte size, and estimated token savings.
