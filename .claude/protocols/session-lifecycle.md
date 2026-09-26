---
type: Concept/Protocol
authority: binding
updated_at: 2026-09-26
supersedes: "EXECUTOR-PROTOCOL.md §3 step 3's old rule of writing state into CLAUDE.md"
tags: [session, state, rotation, handoff]
related_docs:
  - ../state/current-state.md
  - ../state/waiting-on.md
  - ../state/history/index.md
  - ./verification-checklist.md
---

# Session lifecycle: open, log, rotate, close

`docs/migration-orders/EXECUTOR-PROTOCOL.md` remains the full manual. This file defines **where
session state is written** now that `CLAUDE.md` is a router.

## Open

1. `CLAUDE.md` (auto-loaded) and `.claude/rules/non-negotiables.md` (auto-loaded) are in context.
2. Read `.claude/state/current-state.md`.
3. Numbered migration session: follow `EXECUTOR-PROTOCOL.md` §1 (roadmap, LESSONS-LEARNED, order,
   CONFIRM). Ad-hoc session: read only what the task needs, via the router's matrix.
4. Size gate: `CLAUDE.md` must stay **< 5 KB / < 150 lines**, `current-state.md` **≤ 2 sessions
   (~150 lines)**, `DECISION-LOG.md` ≤ ~50 KB. If one is over, fix it before starting.

## Close — write state here, never into `CLAUDE.md`

1. Tests green (see [verification-checklist](./verification-checklist.md)).
2. Add the new entry at the **top** of `current-state.md` under "Latest sessions". Keep the
   existing style: bold headline with date, branch/commit, what was done, what was verified,
   what was not, artifacts. Precede it with `<!-- session YYYY-MM-DD <slug> -->`.
3. **Rotate:** if `current-state.md` now holds 3 entries, cut the oldest (its whole block,
   verbatim) and paste it at the **top** of the session section in
   `.claude/state/history/YYYY-MM-sessions.md` (the month of that session; create the file with the
   same frontmatter as its siblings if needed). Add a row for it in `history/index.md`.
4. Update the "Where the project stands" bullets and the frontmatter
   (`updated_at`, `last_numbered_session`) in `current-state.md`.
5. New blocker → add to `.claude/state/waiting-on.md`. Resolved blocker → **move** its text to
   `history/resolved-waiting-on.md` (append, with the date resolved). Never delete history.
6. A new standing fact (an infra truth, a trap, a gotcha that will recur) → the matching concept
   file in `.claude/architecture/`, one or two lines, linking to where the story is.
7. Also update, as the manual requires: the order's Deviations, `DECISION-LOG.md`,
   `migration-cutover-table.md`, `migration-stack-analysis.md`, `LESSONS-LEARNED.md`.

## Edit `CLAUDE.md` only when

the routing itself changes (a new concept file, a renamed file, a changed verification command).
Keep the Next.js block at the bottom intact — `next dev` re-adds it if removed.
