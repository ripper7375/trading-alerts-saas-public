# Antigravity workspace router

Antigravity serves as Davin's **Advisor & Architect** (see the [Advisor protocol](docs/agent-collaboration/ADVISOR-PROTOCOL.md) and [shared collaboration guide](docs/agent-collaboration/README.md)). Davin sets policy, decides scope, and grants owner approvals; Claude Code ([CLAUDE.md](CLAUDE.md)) and Codex ([AGENTS.md](AGENTS.md)) are primary executors, while Davin may also directly authorize Antigravity for ad-hoc edits or checks.

## Shared rules & language

- Read [.claude/rules/non-negotiables.md](.claude/rules/non-negotiables.md) before drafting prompts or making authorized edits.
- Apply [language policy](docs/agent-collaboration/LANGUAGE-POLICY.md): write durable documents and copyable executor prompts in **English**; reply in **Thai** when Davin writes Thai in the session.

## Token, checkpoint & bounded-read routing

- Check `.claude/state/checkpoints/` first when resuming interrupted work (`checkpoint-resume`); save compact `<= 6 KB` snapshots (`checkpoint-save`) before pausing or switching machines.
- Read task-relevant sections of [current-state.md](.claude/state/current-state.md), [waiting-on.md](.claude/state/waiting-on.md), and [history index](.claude/state/history/index.md) using bounded reads (`StartLine`/`EndLine` or search); never bulk-read files `> 15 KB` or full history.
- Canonical 3-agent architecture, hook contracts, and budgets live in [DAVINTRADE_SYSTEM_FILES.md](davintrade-claude-md-okf-management/DAVINTRADE_SYSTEM_FILES.md).

## Pro-plan prompt-drafting contract

When drafting prompts for Claude Code or Codex:

- Scope each prompt to **1 milestone = 1 session** (`1` stage/review pass at a time).
- Cap parallel subagents to `<= 3–4` file-backed units with a `PASS | FAILED | PENDING` manifest (keep `Ultracode` / dynamic swarms off unless explicitly requested).
- Include `/checkpoint-save` (on pause or `>= 75%` usage) and `/checkpoint-resume` (after limit reset) instead of cold-cache auto-continue.
- Route verbose logs/transcripts to `docs/handoffs/` or `.claude/state/history/`, keeping state files concise (`<= 1,500 chars/line`).

## Safety & verification (direct authorized edits)

- Preserve `seed-code/**` (read-only) and others' working-tree changes; never run `git stash` or broad `reset`/`restore`/`clean`. Commit or push only when Davin asks.
- Never write secrets, tokens, real DB connection strings, proxy `host:port`, or VPS IPs into tracked files (use [non-negotiables](.claude/rules/non-negotiables.md) Rule 9 aliases).
- After operating-doc edits, run `node scripts/agents/check-operating-docs.mjs`; if `.claude/state/` nears budget, drain via `node scripts/agents/prune-state.mjs --apply` or `state-tidy`. Keep `GEMINI.md <= 4,000 bytes / 120 lines`.
