# TASK: Autonomous OKF Knowledge Tree Health Check & Observability Audit

Claude, please perform an end-to-end **OKF Knowledge Tree Health Check** on our agent knowledge base (`CLAUDE.md` and `.claude/`), referencing the fine-tuned standards in `davintrade-claude-md-okf-management/OKF-CLAUDE-MD-OBSERVABILITY-CHECKLIST.md` (v1.1.0).

---

### Step 1: File Size & Cold-Start Token Guardrails

1. Inspect `CLAUDE.md`:
   - Check byte size (must be `< 5.0 KB`) and line count (must be `< 100 lines`).
   - Confirm it remains strictly a **Lean Router** (no session logs or detailed documentation injected).
2. Inspect `.claude/state/current-state.md`:
   - Check line count (target `< 150 lines`).
   - Count the number of active session entries (target `≤ 2 sessions`).
   - **Auto-remediation:** If there are 3 or more sessions, rotate the oldest session to the top of `.claude/state/history/2026-09-sessions.md` (or current month) and update `history/index.md`.

---

### Step 2: Active Task Checklist & Scratch State Audit

1. Inspect `.claude/state/active-tasks.md`:
   - Check if the file exists:
     - If all items are completed (`- [x]`): **Delete the file** (scratch cleanup).
     - If open items (`- [ ]`) remain: Verify they are actively blocked or require Davin's sign-off, and confirm they are listed under "Needs from Davin" in `current-state.md`.
2. Verify `.gitignore` contains `.claude/state/active-tasks.md` so scratch checklists are not tracked in Git.

---

### Step 3: Graph & Link Integrity Audit

1. Scan all `.md` files under `CLAUDE.md` and `.claude/` for relative Markdown links in the format `[...](...)`.
2. Verify that every referenced local file actually exists on disk (including `.claude/protocols/subagent-orchestration.md`).
3. Report any broken or dangling 404 links. If any are found, fix or relink them immediately.

---

### Step 4: Rule Scoping, Rule 8, & Prompt Hygiene Audit

1. Inspect `.claude/rules/non-negotiables.md`:
   - Verify that all **8 rules** are present and intact, including Rule 8 ("Settled answers stay settled").
2. Inspect all domain-specific rule files in `.claude/rules/`:
   - Confirm each has valid `paths:` frontmatter to prevent unwanted token consumption on cold session start.
3. **Prompt & Safety Hygiene Scan:**
   - Scan `.claude/` and prompt documents for deprecated reasoning-extraction triggers: `show your chain of thought`, `think step by step`, or `think out loud`.
   - Confirm zero occurrences exist.

---

### Step 5: Active Blockers & Closeout Formatting Hygiene

1. Inspect `.claude/state/waiting-on.md`:
   - Check the total number of open blocker/trap items (target `≤ 30 items`).
   - Cross-reference recent commit history to identify if any items have been resolved.
   - **Auto-remediation:** If any item has been resolved, move it into `.claude/state/history/resolved-waiting-on.md` with a timestamp and resolution note.
2. Inspect `current-state.md`:
   - Confirm the session block follows the **Action-First order**:
     1. **Needs from Davin**
     2. **Changed & verified**
     3. **Unconfirmed / found**

---

### Step 6: Subagent Worktree Hygiene

1. Inspect `.claude/worktrees/`:
   - Verify that no dangling or uncommitted worktrees exist from past subagent runs.
   - Confirm `.claude/worktrees/` is properly ignored in `.gitignore`.

---

### Step 7: Health Check Summary Report

Output a clean, concise audit report to terminal formatted as follows:

```markdown
## OKF Knowledge Tree Health Report (Opus 5.5 Fine-Tuned)

| Check Item               | Current Value           | Target Threshold      | Status (PASS / WARN / FAIL) |
| ------------------------ | ----------------------- | --------------------- | --------------------------- |
| CLAUDE.md Router Size    | X bytes / Y lines       | < 5 KB / < 100 lines  | PASS                        |
| Active Sessions Count    | N sessions              | ≤ 2 sessions          | PASS                        |
| Active Task State        | Clean / In-progress     | Deleted on completion | PASS                        |
| Rule 8 & Non-negotiables | 8 rules present         | 8 binding rules       | PASS                        |
| Rule Scoping (`paths:`)  | All scoped / N unscoped | 100% scoped           | PASS                        |
| Prompt Safety Hygiene    | 0 extraction triggers   | 0 forbidden phrases   | PASS                        |
| Broken Relative Links    | N broken links          | 0 broken links        | PASS                        |
| Open Blockers Count      | N active items          | ≤ 30 items            | PASS                        |
| Subagent Worktrees       | 0 dangling dirs         | 0 dangling dirs       | PASS                        |

### Actions Taken:

- (List any auto-remediation performed, e.g., rotated sessions, fixed links, cleaned scratch tasks, or "None required — system 100% healthy")
```
