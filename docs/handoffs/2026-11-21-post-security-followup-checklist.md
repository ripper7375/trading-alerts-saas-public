# Post-Security Follow-up Checklist (Local Sync, Money-Service B.4, Pending Stack D Migration)

- **Date:** 2026-11-21 (Asia/Bangkok)
- **Author:** Antigravity (Advisor) → Future Agents (Claude Code / Codex) & Davin
- **Status:** Open operational follow-ups (companion to `.claude/state/waiting-on.md` L22 item `(a)`, `(d)`, `(f)` and `.claude/state/current-state.md` L128, L136–139)
- **Privacy / Rule 9:** Contains no real IPs, credentials, connection strings, or unfixed advisory details.

> **Why this note exists:** All nine security/housekeeping PRs (`#511`–`#519`) are merged on `origin/main` (`2466c598`) and deployed. Three operational follow-up checks remain so future Agents can sync the local checkout safely without losing WIP, finish verifying `money-service`, and avoid touching the pending Stack D migration out of turn.

---

## 1. Safe Sync of Local `main` Checkout (`c8a5956e` → `origin/main`)

**Current state:** Local `main` in Davin's workstation checkout is at `c8a5956e` (behind `origin/main`, which includes `#511`–`#519` at `2466c598`), alongside uncommitted WIP (Terminal B / `centroid_watchdog.py` / `.claude/state/*` / `.claude/architecture/infrastructure.md` / `docs/handoffs/*`).

**When to run:** Only when Davin explicitly asks to sync local `main` (e.g., after the 2026-11-21 MT5 Dry Rehearsal / Watchdog commit work). **Never** use `git stash`, `git reset --hard`, or broad `git clean`.

### Special trap: 3 local Chat VPS runbook files already merged via PR `#515` (`67ab1e0a`)

Before PR `#515` was merged, these 3 files were created/edited in the local working tree and then merged identically onto `origin/main`:

1. `davintrade-webchat-stack/POST-SNAPSHOT-CHAT-VPS-REBUILD-RUNBOOK.md` (untracked locally; tracked on `origin/main`)
2. `davintrade-webchat-stack/UBUNTU-WEBCHAT-STACK-RESTORATION-RUNBOOK.md` (modified locally; matches `origin/main` modulo EOL)
3. `docs/runbooks/contabo-chat-stack.md` (modified locally; matches `origin/main` modulo EOL)

If left in place, `git pull` / `git merge origin/main` will abort on the untracked file or flag redundant conflicts.

### Recommended verification & cleanup steps before pulling

1. Fetch without changing working tree:
   ```bash
   git fetch origin main
   ```
2. Verify that the 3 local runbook copies have no extra unmerged edits compared with `origin/main`:
   ```bash
   git diff --ignore-cr-at-eol origin/main -- \
     davintrade-webchat-stack/UBUNTU-WEBCHAT-STACK-RESTORATION-RUNBOOK.md \
     docs/runbooks/contabo-chat-stack.md
   ```
   And compare local `davintrade-webchat-stack/POST-SNAPSHOT-CHAT-VPS-REBUILD-RUNBOOK.md` against `git show origin/main:davintrade-webchat-stack/POST-SNAPSHOT-CHAT-VPS-REBUILD-RUNBOOK.md` (ignoring CRLF vs LF).
3. **Only if all 3 match `origin/main` (or Davin confirms `origin/main` is authoritative):** remove/restore **strictly those 3 paths** (never touch any other WIP file):
   - Remove untracked local duplicate `davintrade-webchat-stack/POST-SNAPSHOT-CHAT-VPS-REBUILD-RUNBOOK.md`
   - Restore the other 2 tracked runbooks to `HEAD` (`git restore -- davintrade-webchat-stack/UBUNTU-WEBCHAT-STACK-RESTORATION-RUNBOOK.md docs/runbooks/contabo-chat-stack.md`)
4. Also watch for Windows CRLF stat-dirty entries (`git diff --ignore-cr-at-eol` is empty on `infra/contabo-chat-stack/*`, `infra/pgbouncer/*`, etc.) — do not mistake EOL noise for real edits.
5. Commit/handle Davin's intended WIP per his instruction, then pull/sync cleanly against `origin/main`.

---

## 2. `money-service` Post-Deploy Webhook Observation (Runbook `B.4`) & `pgbouncer` Check

**Context:** On 2026-11-21 (with Davin's Rule 5 sign-off), `money-service` (`891313ae`) was manually deployed last from `2466c598` (`4d991c9f` `[SUCCESS]`), carrying both PR `#518` (`@nestjs/platform-express` `11.2.11` + `effect` override) and `f9255241` (_RiseWorks webhook responds `410`_). Immediately prior, `pgbouncer` (`e5d5cae8`) was upgraded to `alpine:3.24` / `PgBouncer 1.25.2` + `STOPSIGNAL SIGINT` (`aa2a8cab` `[SUCCESS]`, no public domains or TCP proxies).

### Verification checklist for the next Agent / Davin

1. Inspect Railway HTTP/deploy logs for `money-service` (`891313ae`) across the next **1–2 real webhook deliveries**:
   - `POST /v1/webhooks/stripe` → `2xx` (no `5xx`, no retry backlog)
   - `POST /v1/webhooks/dlocal` → `2xx` (no `5xx`, no retry backlog)
   - `POST /v1/webhooks/riseworks` (if any legacy hit arrives) → `410` expected per `f9255241` (no `5xx`)
2. Confirm `money-service` `/health` remains `healthy` (`database: up`).
3. Confirm `pgbouncer` (`aa2a8cab`) deploy logs show no `login failed`, TLS errors, or `pooler error`.
4. Note separately: the optional throwaway `verify-1-3b` role-grant check was not re-run (`pgbouncer.ini`, `entrypoint.sh`, `PGBOUNCER_USERLIST_B64`, and Postgres roles did not change); run only if Davin requests it.
5. Once B.4 webhook deliveries pass cleanly, update `waiting-on.md` L22 item `(a)` as resolved.

---

## 3. Pending Stack D Migration (`20261114000000_add_trendline_context_tables`)

**Current state:** GitHub Actions job `Check Production Migration Status` on `main` (`2466c598`) currently fails **only** because `prisma/migrations/20261114000000_add_trendline_context_tables` is not yet applied to production.

### Guardrails for future Agents

1. **Do NOT apply this migration ad-hoc** just to turn `Check Production Migration Status` green. Production migrations require Davin's explicit approval and Stack D cutover ordering (`non-negotiables.md` rule 1, `EXECUTOR-PROTOCOL.md`).
2. When Davin is ready to proceed with Stack D Trendline Context:
   - Review `docs/handoffs/2026-11-14-trendline-context-advisor-review.md` (especially its blocking defects F1–F5) and `prisma/migrations/20261114000000_add_trendline_context_tables/migration.sql` (creates `trendline_policy_sessions`, `trendline_policy_lines`, and `trendline_context_readings`; runtime feature stays gated behind `TRENDLINE_CONTEXT_ENABLED`).
   - Follow `.claude/architecture/database-traps.md` when applying (use `DIRECT_URL` / `prisma.production.config.ts`, never through `pgbouncer`), and confirm `Check Production Migration Status` turns green afterwards.
3. **Unrelated pre-existing failure:** Railway project `prisma-migration` (`ef03a5bc`) also fails on pushes to `main` (tracked since `2026-10-31` in `waiting-on.md`); treat as a separate investigation when Davin prioritizes it.
