# TASK: Autonomous OKF Knowledge Tree Health Check & Observability Audit

Claude, please perform an end-to-end **OKF Knowledge Tree Health Check** on our agent knowledge base (`CLAUDE.md` and `.claude/`), referencing the standards in `davintrade-claude-md-okf-management/OKF-CLAUDE-MD-OBSERVABILITY-CHECKLIST.md`.

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

### Step 2: Graph & Link Integrity Audit

1. Scan all `.md` files under `CLAUDE.md` and `.claude/` for relative Markdown links in the format `[...](...)`.
2. Verify that every referenced local file actually exists on disk.
3. Report any broken or dangling 404 links. If any are found, fix or relink them immediately.

---

### Step 3: Rule Scoping & Native Rules Audit

1. Inspect every file in `.claude/rules/`:
   - Confirm `non-negotiables.md` is concise and intended for universal session loading.
   - For all other rule files (e.g., `security-overrides.md`, `i18n-compliance.md`), verify they contain valid `paths:` frontmatter to prevent unwanted token consumption on cold session start.

---

### Step 4: Active Blockers & Waiting-On Hygiene

1. Inspect `.claude/state/waiting-on.md`:
   - Check the total number of open blocker/trap items.
   - Cross-reference recent commit history or PR merges to identify if any open items have already been resolved.
   - **Auto-remediation:** If any item has been resolved, move it into `.claude/state/history/resolved-waiting-on.md` with a timestamp and resolution note.

---

### Step 5: Health Check Summary Report

Output a clean, concise audit report to terminal formatted as follows:

```markdown
## OKF Knowledge Tree Health Report

| Check Item              | Current Value           | Target Threshold     | Status (PASS / WARN / FAIL) |
| ----------------------- | ----------------------- | -------------------- | --------------------------- |
| CLAUDE.md Router Size   | X bytes / Y lines       | < 5 KB / < 100 lines | PASS                        |
| Active Sessions Count   | N sessions              | ≤ 2 sessions         | PASS                        |
| Broken Relative Links   | N broken links          | 0 broken links       | PASS                        |
| Rule Scoping (`paths:`) | All scoped / N unscoped | 100% scoped          | PASS                        |
| Active Blockers Count   | N active items          | ≤ 30 items           | PASS                        |

### Actions Taken:

- (List any auto-remediation performed, e.g., rotated sessions, fixed links, or "None required — system 100% healthy")
```
