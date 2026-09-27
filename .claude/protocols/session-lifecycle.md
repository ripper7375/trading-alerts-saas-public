---
type: Concept/Protocol
authority: binding
updated_at: 2026-09-27
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
2. Read `.claude/state/current-state.md`. If `.claude/state/active-tasks.md` exists, a previous
   session stopped mid-task: read it, confirm its open items against the live code, and resume
   (or tell Davin why not).
3. Numbered migration session: follow `EXECUTOR-PROTOCOL.md` §1 (roadmap, LESSONS-LEARNED, order,
   CONFIRM). Ad-hoc session: read only what the task needs, via the router's matrix.
4. Size gate: `CLAUDE.md` must stay **< 5 KB / < 150 lines**, `current-state.md` **≤ 2 sessions
   (~150 lines)**, `DECISION-LOG.md` ≤ ~50 KB. If one is over, fix it before starting.

## Track — multi-step tasks survive context compaction

Long sessions get their older turns summarized; a plan held only in chat can be lost. For a task
with **3+ distinct steps** (a migration, a broad audit, a multi-file port):

1. **Decompose first.** Before touching code, write every step as `- [ ]` into
   `.claude/state/active-tasks.md` (frontmatter: `type: Concept/ActiveTasks`, `status`,
   `started_at`, `session_slug`). Break the order down yourself; Davin need not list steps.
2. **Keep it live.** Tick items (`- [x]`) as each is done and verified; append sub-tasks and edge
   cases as you find them. The file is the source of truth; the in-chat todo list may mirror it.
3. **Work to finish.** A progress update does not end the turn. Before stopping, re-read the file:
   if an open item is unblocked and in scope, continue with it. Stop only when every item is done,
   or the next one is blocked, needs Davin's sign-off, or escalates (non-negotiables 2 and 5);
   mark such items `- [ ] BLOCKED: <reason>`.
4. **Close.** All done and verified → delete the file. Stopping with open items → leave it, and
   name the open items under "Needs from Davin" in the session entry.

The file is gitignored: it is in-flight scratch for one checkout. The durable record is the
session entry and `waiting-on.md`. Parallel sessions must use separate worktrees (one file each).

## Close — write state here, never into `CLAUDE.md`

1. Tests green (see [verification-checklist](./verification-checklist.md)).
2. Add the new entry at the **top** of `current-state.md` under "Latest sessions", as one
   blockquote (rotation moves it verbatim). Precede it with `<!-- session YYYY-MM-DD <slug> -->`.
   Order it **action-first**:
   - bold headline with date, branch/commit;
   - **Needs from Davin:** open decisions, sign-offs, unconfirmed assumptions, leftover
     `active-tasks.md` items — or "None";
   - **Changed & verified:** files created/modified/retired, and the evidence (exact `test:ci`
     counts, build, live checks);
   - **Unconfirmed / found:** what was noticed but not verified (with paths checked), and what
     was not done.

   The terminal report to Davin uses the same three parts, in the same order, as headed sections.

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
8. `.claude/state/active-tasks.md`: deleted if every item is done, otherwise left in place (see Track).

## Edit `CLAUDE.md` only when

the routing itself changes (a new concept file, a renamed file, a changed verification command).
Keep the Next.js block at the bottom intact — `next dev` re-adds it if removed.
