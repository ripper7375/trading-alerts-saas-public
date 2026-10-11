---
type: Concept/AgentState
status: active
updated_at: 2026-10-11
---

# Codex continuity pointer

- Operating system: repository [AGENTS.md](../../../AGENTS.md) and
  [catalog](../index.md), established by Davin's direct instruction.
- Latest completed task: [Workflow publication](../tasks/2026-10-11-publish-codex-workflow.md).
- Latest handoff: [Publication report](../../handoffs/2026-10-11-publish-codex-workflow.md).
- Published workflow: branch codex/claude-collaboration-docs, commit 4a560884.
  Original main and its five prior local commits remain intact; publication did
  not merge main. Details and hook limitations are in the publication report.
- Design and usage: [English package index](../../../davintrade-claude-md-okf-management/codex/README.md).
  Architecture, operating manual, stage prompts and Advisor onboarding live there;
  existing operational sources remain canonical.
- Language: [shared policy](../../agent-collaboration/LANGUAGE-POLICY.md).
  Artifacts/prompts default to English; Thai conversational replies apply in
  sessions where Davin writes Thai, subject to explicit instructions.
- Project position, flags and blockers: canonical
  [Claude state](../../../.claude/state/current-state.md) and
  [waiting-on](../../../.claude/state/waiting-on.md). Read relevant sections
  and verify against live source; this pointer does not replicate them.
- Next: Davin may use the package's English
  [Antigravity opening prompt](../../../davintrade-claude-md-okf-management/codex/OPENING_PROMPT_TO_ANTIGRAVITY.md),
  or assign Claude Code/Codex directly. All four participation setups remain valid.

Keep this file under 6,000 bytes and 100 lines. One state writer updates it;
concurrent task owners retain their own records. Full history belongs in
individual task records and `docs/handoffs/`, never in `AGENTS.md`.
