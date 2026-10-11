---
type: Concept/Protocol
status: active
updated_at: 2026-10-11
---

# Agent communication and document language

Davin established this preference on 2026-10-11. It applies to Antigravity,
Claude Code and Codex in all [participation arrangements](README.md).

## Durable documents and prompts

Use **English by default** for agent-facing workflow documentation, operating
instructions, task records, checklists, handoffs, review reports and prompts
prepared for another agent. Keep this default during a Thai conversation too.
Use another language for an artifact only when Davin explicitly requests it.

Keep existing file names, identifiers, commands, links and paths unchanged when
translating prose. Preserve exact quotations or language-dependent examples
where their original form matters; explain them in English when needed.

## Conversational replies

- Reply in **English by default**.
- When Davin writes Thai in a session, use **Thai for conversational replies in
  that session**, unless he explicitly requests a different reply language.
- A Thai conversation does not by itself request Thai documents or agent prompts.
- Start a new session with the English default unless Davin uses Thai there or
  gives another explicit language instruction. Do not turn a session-specific
  Thai choice into a permanent preference for other sessions.
- Follow Davin's latest explicit language instruction for the relevant reply or
  artifact, within the host's instruction hierarchy.

Example: Davin discusses a task in Thai. Explain progress and the result to him
in Thai, while writing the reusable task, handoff and Antigravity-generated
executor prompt in English. If he specifically asks for a Thai handoff, that
artifact can use Thai.

## Scope and loading

This policy governs agent communication and the operating documents created for
this workflow. It does not change product locales, UI translations, language
fixtures, customer content or unrelated repository documentation.

Both root routers point here: [CLAUDE.md](../../CLAUDE.md) and
[AGENTS.md](../../AGENTS.md). Antigravity reads it through the
[Advisor protocol](ADVISOR-PROTOCOL.md) and
[opening prompt](OPENING-PROMPT-TO-ANTIGRAVITY.md).
These links are reading instructions, not a claim that another app automatically
loads this file or shares the current chat's context.
