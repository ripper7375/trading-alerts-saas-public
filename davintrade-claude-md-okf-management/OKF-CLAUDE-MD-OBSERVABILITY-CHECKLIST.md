# OKF Knowledge Tree Observability & Health Checklist

**Standard Operating Procedures (SOP) for Monitoring, Maintaining, and Pruning Agent Knowledge**

- **Target System:** `.claude/` Knowledge Tree & `CLAUDE.md` Lean Router
- **Repository:** `trading-alerts-saas-public`
- **Specification:** Open Knowledge Format (OKF) v0.1 adapted for Agent Execution
- **Version:** 1.0.0

---

## 1. System Overview & Purpose

The Open Knowledge Format (OKF) architecture decouples monolithic agent instructions into a **modular, token-efficient knowledge graph**. Because AI coding agents (Claude Code) autonomously interact with, read from, and write to this file structure, **continuous observability is required** to prevent:

1. **Silent Token Inflation:** Accidental accumulation of session notes or documentation in cold-start files.
2. **Knowledge Drift & Stale Traps:** Lingering resolved blockers in `waiting-on.md` confusing future sessions.
3. **Graph Fragmentation:** Broken relative Markdown links caused by file renaming or reorganization.
4. **Rule Leakage:** Unscoped rule additions in `.claude/rules/` needlessly loading on every session start.

---

## 2. Core Observability Metrics & SLOs (Guardrails)

The following Service Level Objectives (SLOs) define a healthy OKF system:

| Metric / Guardrail                            | Target Threshold                         | Critical Warning Threshold     | Health Indicator / Check Method                                         |
| --------------------------------------------- | ---------------------------------------- | ------------------------------ | ----------------------------------------------------------------------- |
| **Root Router Size** (`CLAUDE.md`)            | **< 4.5 KB** (< 80 lines)                | **> 5.0 KB** (> 100 lines)     | Cold-start token budget must stay ≤ 1,500 tokens.                       |
| **Active Session State** (`current-state.md`) | **≤ 2 sessions** (< 150 lines)           | **≥ 3 sessions** (> 200 lines) | Rotation required; older sessions must move to `history/`.              |
| **Open Blockers** (`waiting-on.md`)           | **≤ 30 active items**                    | **> 40 items**                 | Stale/resolved items must be pruned to `resolved-waiting-on.md`.        |
| **Graph / Link Integrity**                    | **0 broken links (100%)**                | **≥ 1 broken link**            | All relative Markdown links in `.claude/` must resolve.                 |
| **Rule Scoping Compliance**                   | **100% scoped** (except universal rules) | **Any rule missing `paths:`**  | Rules in `.claude/rules/` must have `paths:` frontmatter unless global. |
| **YAML Frontmatter Integrity**                | **100% valid YAML**                      | **Syntax errors**              | Every `.md` in `.claude/` must contain valid frontmatter with `type:`.  |

---

## 3. Maintenance Cadence & Trigger Events

### 3.1 Per-Session Trigger (Size Gate)

- **When:** Every session open and close (governed by `EXECUTOR-PROTOCOL.md` §0 & §3).
- **Action:** Check `CLAUDE.md` and `current-state.md`. If size limits are breached, execute rotation immediately before starting new work.

### 3.2 Weekly / Bi-Weekly Health Audit

- **When:** End of week or every 5–10 development sessions.
- **Action:** Run the automated health check prompt with Claude Code (see `OKF-HEALTH-CHECK-PROMPT.md`) to validate link integrity and prune resolved blockers.

### 3.3 Milestone / Phase Transition Audit

- **When:** Closing a major migration phase (e.g., Phase 14 to Phase 15).
- **Action:** Re-index historical sessions, archive completed cutover tables, and synchronize architecture concept files with live production configurations.

---

## 4. Remediation Runbooks

### Runbook A: Rotating Active Sessions in `current-state.md`

**Symptom:** `current-state.md` contains 3 or more session blocks.

1. Identify the oldest completed session entry in `.claude/state/current-state.md`.
2. Extract the entire entry (including its objective, root cause, fixes, and verification details).
3. Open the relevant monthly archive: `.claude/state/history/YYYY-MM-sessions.md`.
4. Prepend the extracted entry at the **top** of the archive file (most recent first).
5. Add/update the session index in `.claude/state/history/index.md`.
6. Save `current-state.md` containing strictly the **latest 1–2 sessions**.

### Runbook B: Pruning Resolved Items in `waiting-on.md`

**Symptom:** `waiting-on.md` has grown cluttered with completed issues.

1. Scan `waiting-on.md` for items whose fixes have merged or deployed (e.g., PRs merged, tables created).
2. Cut the resolved item entry.
3. Open `.claude/state/history/resolved-waiting-on.md`.
4. Append the item under the appropriate resolved section with a timestamp and resolution reference (e.g., `Resolved in PR #474`).
5. Ensure only genuinely blocked/trapped items remain in `waiting-on.md`.

### Runbook C: Fixing Broken Graph Links

**Symptom:** Relative link check fails (e.g., `[Database Traps](../architecture/database-traps.md)` points to non-existent file).

1. Identify the referencing file and line number.
2. Verify if the target file was renamed, relocated, or deleted.
3. If renamed/moved: Update the relative path to match the new location.
4. If deleted: Remove the reference or redirect to the relevant archive document.

### Runbook D: Adding New Rules to `.claude/rules/`

**Symptom:** A developer or agent wants to add a new standard operating rule.

1. Determine if the rule is **universal** (applies to 100% of tasks) or **domain-specific** (applies only to specific folders).
2. If universal: Add concise rule to `.claude/rules/non-negotiables.md`.
3. If domain-specific: Create a dedicated file `.claude/rules/<domain>-rules.md` and **MUST include `paths:` in YAML**:
   ```yaml
   ---
   type: Concept/StandingRules
   paths:
     - 'app/**'
     - 'components/**'
   ---
   ```
   _Note: Without `paths:`, Claude Code will load the rule on EVERY session start, degrading the token budget._

---

## 5. Automated Verification Script

Add this lightweight Node.js check script (`scripts/check-okf.mjs`) to your project or execute it via `npx` during CI:

```javascript
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CLAUDE_MD = path.join(ROOT, 'CLAUDE.md');
const CURRENT_STATE = path.join(ROOT, '.claude', 'state', 'current-state.md');

let hasError = false;

// 1. Check CLAUDE.md size
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

if (hasError) process.exit(1);
console.log('✅ OKF health checks passed!');
```
