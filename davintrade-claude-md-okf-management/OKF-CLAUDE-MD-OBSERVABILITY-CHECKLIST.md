# OKF Knowledge Tree Observability & Health Checklist

**Standard Operating Procedures (SOP) for Monitoring, Maintaining, and Pruning Agent Knowledge**

- **Target System:** `.claude/` Knowledge Tree & `CLAUDE.md` Lean Router
- **Repository:** `trading-alerts-saas-public`
- **Specification:** Open Knowledge Format (OKF) v0.1 adapted for Claude Opus 5.5 Autonomous Execution
- **Version:** 1.1.0

---

## 1. System Overview & Purpose

The Open Knowledge Format (OKF) architecture decouples monolithic agent instructions into a **modular, token-efficient knowledge graph**. Because AI coding agents (Claude Code running Claude Opus 5.5 and future frontier models) autonomously read from, write to, and navigate this file structure across multi-hour sessions, **continuous observability is required** to prevent:

1. **Silent Token Inflation:** Accidental accumulation of session notes or documentation in cold-start files (`CLAUDE.md` must stay under 5 KB).
2. **Context Fragmentation & Orphaned Checklists:** Abandoned `.claude/state/active-tasks.md` scratch files or unfinished multi-step runs.
3. **Multi-Turn Thinking Latency:** Erosion of Rule 8 ("Settled answers stay settled"), causing agents to question earlier agreed decisions.
4. **Knowledge Drift & Stale Traps:** Lingering resolved blockers in `waiting-on.md` confusing future sessions.
5. **Graph Fragmentation:** Broken relative Markdown links caused by file renaming or reorganization.
6. **Rule Leakage & Safety Flags:** Unscoped rules loading globally in `.claude/rules/` or legacy "reasoning extraction" phrases (`think step by step`, `show your chain of thought`) that trigger model downgrades.
7. **Orphaned Subagent Worktrees:** Dangling Git worktrees left behind by parallel subagents under `.claude/worktrees/`.

---

## 2. Core Observability Metrics & SLOs (Guardrails)

The following Service Level Objectives (SLOs) define a healthy, fine-tuned OKF system:

| Metric / Guardrail                            | Target Threshold                         | Critical Warning Threshold           | Health Indicator / Check Method                                                           |
| --------------------------------------------- | ---------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| **Root Router Size** (`CLAUDE.md`)            | **< 4.5 KB** (< 70 lines)                | **> 5.0 KB** (> 90 lines)            | Cold-start token budget must stay ≤ 1,500 tokens.                                         |
| **Active Session State** (`current-state.md`) | **≤ 2 sessions** (< 150 lines)           | **≥ 3 sessions** (> 200 lines)       | Rotation required; older sessions must move to `history/`.                                |
| **Active Task Checklist** (`active-tasks.md`) | **Clean (Deleted on close)**             | **Orphaned / Stale > 24h**           | Must be deleted when tasks pass; if present, open items must be under "Needs from Davin". |
| **Closeout Format Ordering**                  | **Action-First Blockquote**              | **Missing "Needs from Davin"**       | Session block must lead with "Needs from Davin" before "Changed & verified".              |
| **Open Blockers** (`waiting-on.md`)           | **≤ 30 active items**                    | **> 40 items**                       | Stale/resolved items must be pruned to `resolved-waiting-on.md`.                          |
| **Graph / Link Integrity**                    | **0 broken links (100%)**                | **≥ 1 broken link**                  | All relative Markdown links in `.claude/` must resolve on disk.                           |
| **Rule Scoping Compliance**                   | **100% scoped** (except universal rules) | **Any rule missing `paths:`**        | Rules in `.claude/rules/` must have `paths:` frontmatter unless global (Rule 1–8).        |
| **Prompt & Safety Hygiene**                   | **0 extraction phrases**                 | **Contains "show chain of thought"** | Scan `.claude/` and prompt files; must contain zero reasoning-extraction triggers.        |
| **Subagent Worktree Hygiene**                 | **0 dangling worktrees**                 | **Untracked worktree dirs**          | `.claude/worktrees/` must be clean and ignored in `.gitignore`.                           |

---

## 3. Maintenance Cadence & Trigger Events

### 3.1 Per-Session Trigger (Size & State Gate)

- **When:** Every session open and close (governed by `EXECUTOR-PROTOCOL.md` §0 & §3 and `session-lifecycle.md`).
- **Session Start Action:**
  1. Check `CLAUDE.md` (< 5 KB) and `current-state.md` (≤ 2 sessions).
  2. Check if `.claude/state/active-tasks.md` exists from an interrupted session; if present, resume open items against live code.
- **Session Close Action:**
  1. Order the closeout blockquote: **Needs from Davin** → **Changed & verified** → **Unconfirmed / found**.
  2. If tasks are complete, delete `active-tasks.md`. If blocked, leave it and list the blocker under "Needs from Davin".

### 3.2 Weekly / Bi-Weekly Health Audit

- **When:** End of week or every 5–10 development sessions.
- **Action:** Run the automated health check prompt with Claude Code (see `OKF-HEALTH-CHECK-PROMPT.md`) to validate link integrity, clean stale tasks, and prune resolved blockers.

### 3.3 Milestone / Phase Transition Audit

- **When:** Closing a major migration phase (e.g., Phase 14 to Phase 15).
- **Action:** Re-index historical sessions, archive completed cutover tables, and synchronize architecture concept files with live production configurations.

---

## 4. Remediation Runbooks

### Runbook A: Rotating Active Sessions in `current-state.md`

**Symptom:** `current-state.md` contains 3 or more session blocks.

1. Identify the oldest completed session entry in `.claude/state/current-state.md`.
2. Extract the entire entry blockquote verbatim.
3. Open the relevant monthly archive: `.claude/state/history/YYYY-MM-sessions.md`.
4. Prepend the extracted entry at the **top** of the session section (most recent first).
5. Add/update the session row in `history/index.md`.
6. Save `current-state.md` containing strictly the **latest 1–2 sessions**.

### Runbook B: Pruning Resolved Items in `waiting-on.md`

**Symptom:** `waiting-on.md` has grown cluttered with completed issues.

1. Scan `waiting-on.md` for items whose fixes have merged or deployed (e.g., PRs merged, tables created).
2. Cut the resolved item entry.
3. Open `.claude/state/history/resolved-waiting-on.md`.
4. Append the item under the appropriate resolved section with a timestamp and resolution reference (e.g., `Resolved in PR #474`).
5. Ensure only genuinely blocked/trapped items remain in `waiting-on.md`.

### Runbook C: Managing Active Tasks (`active-tasks.md`)

**Symptom:** `.claude/state/active-tasks.md` remains on disk after a session ends.

1. Inspect the file content:
   - If all items are checked (`- [x]`) and verified: **Delete the file**. It is scratch state that is no longer needed.
   - If open items (`- [ ]`) remain due to an intentional blocker or dependency on Davin: Verify that the blocker is explicitly documented under "Needs from Davin" in `current-state.md`. Keep the file for the next session to resume.

### Runbook D: Fixing Broken Graph Links

**Symptom:** Relative link check fails (e.g., `[subagent-orchestration.md](../protocols/subagent-orchestration.md)` points to non-existent file).

1. Identify the referencing file and line number.
2. Verify if the target file was renamed, relocated, or deleted.
3. If renamed/moved: Update the relative path to match the new location.
4. If deleted: Remove the reference or redirect to the relevant archive document.

### Runbook E: Scoping Rules in `.claude/rules/`

**Symptom:** A new rule file was added to `.claude/rules/` without `paths:` frontmatter.

1. If the rule is strictly universal (applies to every single session regardless of files touched): Integrate it concisely into `non-negotiables.md`.
2. If domain-specific: Add the proper `paths:` frontmatter targeting only relevant glob patterns:
   ```yaml
   ---
   type: Concept/StandingRules
   paths:
     - 'app/**'
     - 'components/**'
     - 'lib/i18n/**'
   ---
   ```
   _Note: Without `paths:`, Claude Code loads the rule on EVERY session start, degrading the token budget._

### Runbook F: Cleaning Subagent Worktrees

**Symptom:** Subagent executions left folders in `.claude/worktrees/`.

1. Confirm no active background subagent processes are running.
2. Verify that changes made by subagents were merged or discarded by the main agent.
3. Remove the temporary worktrees using `git worktree remove` or delete the directory contents.
4. Ensure `.claude/worktrees/` remains listed in `.gitignore`.

---

## 5. Automated Verification Script

Add this lightweight Node.js check script (`scripts/check-okf.mjs`) to your project or execute it via `npx` during CI:

```javascript
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CLAUDE_MD = path.join(ROOT, 'CLAUDE.md');
const CURRENT_STATE = path.join(ROOT, '.claude', 'state', 'current-state.md');
const NON_NEGOTIABLES = path.join(
  ROOT,
  '.claude',
  'rules',
  'non-negotiables.md'
);
const ACTIVE_TASKS = path.join(ROOT, '.claude', 'state', 'active-tasks.md');

let hasError = false;

// 1. Check CLAUDE.md size and lines
if (fs.existsSync(CLAUDE_MD)) {
  const stat = fs.statSync(CLAUDE_MD);
  const lines = fs.readFileSync(CLAUDE_MD, 'utf8').split('\n').length;
  console.log(`[OKF Check] CLAUDE.md: ${stat.size} bytes, ${lines} lines`);
  if (stat.size > 5120) {
    console.error(`❌ FAIL: CLAUDE.md exceeds 5KB limit (${stat.size} bytes)`);
    hasError = true;
  }
} else {
  console.error('❌ FAIL: CLAUDE.md missing');
  hasError = true;
}

// 2. Check current-state.md session count
if (fs.existsSync(CURRENT_STATE)) {
  const content = fs.readFileSync(CURRENT_STATE, 'utf8');
  const sessionMatches =
    content.match(/^##\s+(?:Session|Latest|Round)/gim) || [];
  console.log(
    `[OKF Check] current-state.md sessions detected: ${sessionMatches.length}`
  );
  if (sessionMatches.length > 2) {
    console.warn(
      `⚠️ WARN: current-state.md has ${sessionMatches.length} sessions (target <= 2)`
    );
  }
}

// 3. Check Rule 8 in non-negotiables.md
if (fs.existsSync(NON_NEGOTIABLES)) {
  const content = fs.readFileSync(NON_NEGOTIABLES, 'utf8');
  if (!content.includes('Settled answers stay settled')) {
    console.warn(
      '⚠️ WARN: Rule 8 (Settled answers stay settled) missing from non-negotiables.md'
    );
  } else {
    console.log('✅ Rule 8 verified in non-negotiables.md');
  }
}

// 4. Check active-tasks.md status
if (fs.existsSync(ACTIVE_TASKS)) {
  const content = fs.readFileSync(ACTIVE_TASKS, 'utf8');
  const openTasks = (content.match(/^-\s+\[\s\]/gm) || []).length;
  console.log(
    `[OKF Check] active-tasks.md present with ${openTasks} open tasks`
  );
} else {
  console.log('✅ active-tasks.md is clean (no orphaned tasks)');
}

if (hasError) process.exit(1);
console.log('✅ OKF health checks passed!');
```
