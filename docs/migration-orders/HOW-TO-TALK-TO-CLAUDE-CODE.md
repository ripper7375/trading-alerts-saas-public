# How to Talk to Claude Code — The Complete Communication Guide

**For:** Davin (Authorizer) working with Claude Code (Executor) through the migration.
**Copy-paste ready:** every quoted block is a prompt you can use verbatim — replace only
the `<angle-bracket>` parts.

---

## 1. Five principles behind every prompt

1. **Standing documents beat prompts.** Claude Code auto-reads `CLAUDE.md`, which points to
   `EXECUTOR-PROTOCOL.md`. Rules that must ALWAYS hold live there — never rely on remembering
   to say them. If you find yourself repeating an instruction across sessions, that's a sign
   it belongs in a standing document; ask the Advisor (Claude Cowork) to add it.
2. **Point at documents, don't paraphrase them.** "Do what session 2-1 says" beats retyping
   the tasks — paraphrasing introduces drift, and the playbook was already reviewed.
3. **One session, one goal.** The moment you add "and also..." mid-session, quality drops
   and the artifacts stop matching reality. New ideas go to the backlog (§8).
4. **Ask for evidence, not confidence.** "Show me the test output" beats "are you sure?" —
   Claude Code will always _sound_ sure. Artifacts (test logs, diffs, file paths) are the
   only trustworthy answer.
5. **You decide, it executes.** When it escalates a question, answer the question asked —
   narrowly. Resist redesigning the plan inside an execution session; plan changes go
   through the Advisor.

---

## 2. The two ritual prompts (canonical — use every session)

**OPEN every session:**

> Read CLAUDE.md and docs/migration-orders/EXECUTOR-PROTOCOL.md. Locate the APPROVED order
> for this session, CONFIRM it against the current codebase AND runtime state (wait-clocks,
> shadow diffs, dashboards), and show me: (1) what changed since it was drafted, (2) this
> session's "done when" checks, (3) any entry criterion that fails. Do not execute anything
> until I say go.

**CLOSE every session:**

> Wrap up per EXECUTOR-PROTOCOL §3: run this session's tests and show me the results, fill
> in the Deviations section, update CLAUDE.md / Decision Log / cutover table / file
> inventory as applicable, then PRE-DRAFT the next session's order and show it to me.

The explicit "do not execute until I say go" in OPEN gives you a checkpoint to actually read
what it reports. Say "go" (or correct course) only after you have.

---

## 3. Starting things

**The very first session (0-1, bootstrap — no PRE-DRAFT exists):**

> Read CLAUDE.md, docs/migration-orders/EXECUTOR-PROTOCOL.md, and the session playbook.
> We are starting Session 0-1. Generate its migration order from TEMPLATE-CONTRACT.md,
> show it to me for approval, and wait.

**Starting a new phase:**

> Before we start Phase <N>: walk me through its entry criteria from the plan and confirm
> each one with evidence. Any Track CC gate required for this phase — prove it's live.

**Resuming after days/weeks away:**

> Read CLAUDE.md. Summarize where the migration stands: current session, waiting-on items,
> open flags needing my decision, and anything time-sensitive (clocks that expired, stability
> windows that completed). Recommend what to do today — but don't start it yet.

---

## 4. During execution

**Progress check (any time):**

> Status check: which step of the order are you on, what's done, what's left, any deviations
> so far?

**When it's been quiet too long on one step:**

> Stop. Show me exactly what you're stuck on, what you've tried, and what you need from me.
> If this step is bigger than the order assumed, say so — we'll split the session.

**Course-correct without derailing:**

> That's not what step <n> of the order says. Re-read it and tell me: are you deviating
> deliberately? If yes, record it in Deviations with the why. If no, get back on the order.

**When it wants to do something extra ("while I'm here, I could also…"):**

> Is that inside this session's scope? If not: add it to CLAUDE.md under "Next session
> must" as a backlog note and continue with the order. Do not do it now.

---

## 5. Risk moments (memorize these three)

**Before ANY risky step (deploys, data changes, config on live systems):**

> Before you do that: what exactly is the rollback if this fails, and has it been verified
> in staging? Show me, then wait for my go.

**Before a production deploy:**

> Give me the deploy checklist: what's changing, what was the staging result, what's the
> rollback, what will you watch after it lands. I'll say "deploy" when satisfied.

**The money question (slice 4A-9/10 and anything payments):**

> This touches real money. Walk me through it as if I'm auditing you: every write path,
> every idempotency protection, what happens if it runs twice, what happens if it dies
> halfway. Then wait.

---

## 6. Cutovers & shadow-runs

**Reviewing a shadow-run:**

> Show me the shadow-run diff summary: total requests compared, match rate, and EVERY
> mismatch with your explanation. An unexplained mismatch means no cutover — do we have any?

**Approving a cutover (only after the above):**

> Approved. Flip <flag>, monitor for <duration>, and report the error rate. If anything
> degrades, flip back first and tell me second.

**Declining a cutover:**

> Not yet. Log the concerns in the order's Deviations, keep both systems running, and
> PRE-DRAFT an investigation session for the mismatches.

**After cutover, before retiring old code:**

> Has this slice been stable long enough per the order's precondition? Show me the dates
> and the error numbers, then list exactly which files the retire step deletes — nothing more.

---

## 7. Flags & decisions

**When a session must resolve a flag:**

> Resolve flag F<N> first: show me the evidence (commands run, docs fetched, options
> considered), your recommendation, and the Decision Log entry you propose — then wait
> for my sign-off before acting on it.

**When it asks YOU a flag-level question (F16 URLs, F17 staging data, F18 RPO/RTO):**

Answer narrowly and make it record the decision:

> Decision: <your answer>. Record it in the Decision Log with today's date and "approved
> by Davin", then continue the order.

**When you don't understand what it's asking:**

> Explain this decision to me as if I'm not an engineer: what are my options, what does
> each cost me, what do you recommend and why, and what's hard to undo later?

That last question — "what's hard to undo?" — is the single most useful thing a
non-engineer can ask. Reversible decisions can be made quickly; irreversible ones deserve
your time.

---

## 8. Guarding scope & the frozen list

**The scope challenge (use liberally):**

> Is this change inside the current session's order? Quote me the step that covers it.
> If you can't, it's out of scope — backlog it.

**When it touches something it shouldn't:**

> Stop. That file is on the do-not-touch list (EXECUTOR-PROTOCOL §5). Revert the change
> and explain why you thought it was needed — if the reason is real, it goes in the
> PRE-DRAFT for a future session.

**When a bug is found in change-frozen code (CC-F):**

> That slice is change-frozen. Apply the fix to BOTH the old and new implementations,
> note it in Deviations, and confirm the shadow-diff stays interpretable.

---

## 9. Verification & challenge patterns

**Never accept "done" without evidence:**

> Show me: the test command you ran, its full output, and the commit hashes. "Done" means
> I can see it.

**When something feels off (trust the feeling):**

> Something seems wrong with <X>. Don't defend it — investigate it. Show me what you find
> even if it proves you were right.

**Spot-check its claims (do this occasionally even when all seems fine):**

> Pick 3 random items from what you just did and prove each one end-to-end: file exists,
> test covers it, behavior matches the contract.

**When tests fail:**

> Don't change the test to make it pass. First explain WHY it fails: is the code wrong, the
> test wrong, or the expectation wrong? Evidence for whichever you claim.

---

## 10. Emergencies

**Something broke in production:**

> Production incident: <symptom>. First: is a rollback available per the current order or
> runbook? If yes, execute it now and tell me what you did. Diagnosis comes AFTER we're
> stable.

**You realize an approval was a mistake:**

> I'm revoking my approval of <thing>. Flip back / revert to the pre-approval state, verify
> we're stable, and log what happened in Deviations. We'll re-plan through the Advisor.

**A session went completely sideways:**

> Abort per the abort rule: leave the codebase green (revert uncommitted work), write the
> blocker into CLAUDE.md, and summarize what a fresh session needs to know. We stop here.

---

## 11. Waiting states

**Entering a wait (shadow-run, stability window):**

> Confirm the clock: what started, when it ends (exact date/time UTC), what should be
> watched during it, and what would count as a failure that ends the wait early. Put all
> four in CLAUDE.md under "Waiting on".

**During a wait — resist this temptation:** don't start the next build session "to save
time" if it depends on the wait's outcome. Ask instead:

> Is there any session we can safely run during this wait that does NOT depend on its
> outcome? (e.g. Phase 5 work during Phase 4 waits.)

---

## 12. Anti-patterns — what NOT to say

| Don't say                                                 | Because                                                | Say instead                                                  |
| --------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------ |
| "Just fix it however you think is best" (on live systems) | Delegates a decision that's yours; invites scope creep | "Propose 2 options with rollback for each; I'll pick"        |
| "Do sessions 2-1 through 2-4 today"                       | Destroys the one-session-one-unit safety property      | Run them one at a time; each ends with its handoff           |
| "Skip the shadow-run, I'm confident"                      | The 48h exists to catch what confidence can't          | If truly trivial, ask the Advisor to re-class the slice      |
| "While you're at it, also add <feature>"                  | Mid-session scope injection — the #1 quality killer    | "Backlog it: note in CLAUDE.md for a future session"         |
| "Why is this taking so long?" (as a push to hurry)        | Pressure produces skipped verification                 | "Show me where the time went; should we split this session?" |
| "Are you sure?"                                           | It will say yes; sounds like reassurance-seeking       | "Show me the evidence"                                       |
| "Ignore the protocol just this once"                      | The protocol IS the safety system                      | If the protocol is wrong, amend it via the Advisor           |
| Approving a DRAFT without reading it                      | Your approval is the only human gate                   | Read the ~1 page; ask one question about anything unclear    |

---

## 13. Quick-reference card (print this)

| Moment               | Say                                                                |
| -------------------- | ------------------------------------------------------------------ |
| Session start        | OPEN ritual (§2) + "don't execute until I say go"                  |
| Session end          | CLOSE ritual (§2)                                                  |
| Anything risky       | "What's the rollback? Show me, then wait."                         |
| Cutover              | "Every mismatch explained? Then: approved, flip, monitor, report." |
| It asks me to decide | Decide narrowly → "record it in the Decision Log"                  |
| I don't understand   | "Explain like I'm not an engineer + what's hard to undo?"          |
| Scope temptation     | "Quote me the order step that covers it — or backlog it."          |
| Claimed done         | "Show me: command, output, commit hashes."                         |
| Feels wrong          | "Investigate, don't defend."                                       |
| Broke production     | "Rollback first, diagnose after."                                  |
| Long absence         | "Read CLAUDE.md, summarize, recommend — don't start."              |

---

_Companion: the Advisor-side prompt is one line —
"Here's the PRE-DRAFT from session <N> — produce the DRAFT for session <N+1> per
00-SKELETON-AND-RULES.md." Everything else the Advisor needs is in the folder._
