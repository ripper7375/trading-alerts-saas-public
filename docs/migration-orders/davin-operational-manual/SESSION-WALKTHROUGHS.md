# Session Walkthroughs — how the prompts play out in real conversations

**What this is:** the teaching companion to `SESSION-PROMPT-SCRIPT.md`. The script is the
reference card; this file shows **complete sessions played out as dialogues** — what you
paste, what a good response looks like, what you check before answering, and the red flags
that mean "do not say go." Learn the seven walkthroughs here and you can run all ~60
sessions, because every session is one of these types.

**The mapping — which walkthrough teaches which sessions:**

| Walkthrough | Type                 | Teaches sessions                                                                                                                    |
| ----------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| A           | Bootstrap            | 0-1 only                                                                                                                            |
| B           | Standard loop        | 0-2…0-5, 1-2, 1-3, 2-1…2-4, 3-2…3-5, 4A-8, 4B-1, 4B-4, 4B-19, 5-1…5-4, 6-2…6-8, 7-1…7-3, 8-2…8-4                                    |
| C           | Decision session     | 3-1 (F6/F7), 1-1 (F18), 4A-1 (F16), 6-1 (F11 triage)                                                                                |
| D           | BUILD (port)         | 4A-2, 4A-4, 4A-6, 4A-9, 4A-11 · 4B-2, 4B-5, 4B-7, 4B-17, 4B-20 (Note: 4B-8..4B-12 used combined PORT+CUTOVER; 4B-13..16 superseded) |
| E           | CUTOVER (fast-path)  | 4A-3, 4A-5, 4A-7, 4A-10, 4A-12 · 4B-3, 4B-6, 4B-8, 4B-9, 4B-10, 4B-11, 4B-12, 4B-18, 4B-21 · also 1-4, 4B-22, 6-9, 8-1, 8-5         |
| F           | High-stakes cutover  | 4A-9/10 (money), 4B-20/21 (auth), any production deploy                                                                             |
| G           | When things go wrong | any session, any phase                                                                                                              |

---

## The rhythm every session follows (read this once, carefully)

Every session is the same five beats. Only the content changes:

```
BEAT 1  You → Cowork (Advisor):  hand over the PRE-DRAFT, receive the DRAFT   (~minutes)
BEAT 2  You:                     read the DRAFT (1-2 pages), approve or query (~5-10 min)
BEAT 3  You → Claude Code:       OPEN prompt → it CONFIRMs → you say "go"     (~5 min)
BEAT 4  Claude Code works.       You answer escalations if they come          (hours)
BEAT 5  You → Claude Code:       CLOSE prompt → artifacts updated → PRE-DRAFT (~10 min)
        ...and the PRE-DRAFT loops back to Beat 1 for the next session.
```

Beats 1–2 are skipped for fast-path (VERIFY-RETIRE) sessions: the PRE-DRAFT comes straight
to you. Beat 1 is skipped for Session 0-1 (nothing before it exists).

Your total hands-on time per session is ~20–30 minutes. The rest is Claude Code working.

---

## Walkthrough A — Session 0-1, the bootstrap (you'll do this exactly once)

There is no PRE-DRAFT and no Advisor step. You start directly with Claude Code.

**Turn 1 — YOU (paste into Claude Code):**

> Read CLAUDE.md, docs/migration-orders/EXECUTOR-PROTOCOL.md, and the session playbook.
> We are starting Session 0-1. Generate its migration order from TEMPLATE-CONTRACT.md,
> show it to me for approval, and wait.

**Turn 2 — CLAUDE CODE responds.** What good looks like: it summarizes what it read
(current state from CLAUDE.md, the 0-1 tasks from the playbook), then shows a 1–2 page
order with: entry criteria as checkboxes, ordered steps (read railway-gateway → write
reference notes → verify npm versions for F2/F19 → Decision Log entries), a "done when"
list, and an empty Deviations section. **Red flags:** it starts working without showing the
order; the order has no verification per step; it invents tasks not in the playbook.

**Turn 3 — YOU read the order (really read it — this is your only gate), then:**

> Approved. Go. Resolve F2 and the F19 npm check first — show me each Decision Log entry
> before writing the reference notes.

**Turn 4 — CLAUDE CODE works.** Mid-session it shows you two Decision Log entries, e.g.
"F2: next@16.2.10 does not exist on npm; nearest stable is 16.2.8 — recommend pinning
16.2.8." **This is a real decision moment:** the plan expected version numbers that may not
exist. You reply:

> Decision: pin 16.2.8. Record it as F2 RESOLVED, approved by Davin, and update the plan's
> version references in the same commit.

**Turn 5 — YOU (when it reports the steps done):**

> Wrap up per EXECUTOR-PROTOCOL §3: tests + results, fill Deviations, update the artifacts,
> harvest any lesson, then PRE-DRAFT session 0-2's order and show it to me.

**Turn 6 — CLAUDE CODE closes.** What good looks like: reference notes committed, F2/F19
entries in the Decision Log, CLAUDE.md now says "Current: 0-1 done, next 0-2," and a
PRE-DRAFT for 0-2 (rough: which route groups, which template). You don't approve this
PRE-DRAFT — you carry it to Cowork (Walkthrough B, Beat 1).

---

## Walkthrough B — Session 0-2, the standard loop (your bread and butter)

**Beat 1 — YOU (paste into Claude Cowork, with the PRE-DRAFT file or its text):**

> Here's the PRE-DRAFT from session 0-1 — produce the DRAFT for session 0-2 per
> 00-SKELETON-AND-RULES.md. Variant: CONTRACT; scope is the operation-domain route groups
> only — money routes are 0-3's.

**Beat 1 response — COWORK returns a DRAFT.** What good looks like: it kept the Executor's
useful observations from the PRE-DRAFT, applied the CONTRACT template sections, listed the
exact route groups (auth, alerts, drawings, notifications, tier, user, market-data channel),
and set verification ("spot-check 5 generated spec entries against real handlers").

**Beat 2 — YOU read it.** One good question to ask if anything's unclear:

> Explain step 3 like I'm not an engineer — what could go wrong there and what's hard to
> undo? _(then, satisfied:)_ Approved — mark it APPROVED.

**Beat 3 — YOU (paste into a NEW Claude Code session):**

> Read CLAUDE.md and docs/migration-orders/EXECUTOR-PROTOCOL.md. CONFIRM the APPROVED order
> for session 0-2 against the current codebase AND runtime state, and show me: what changed
> since drafting, the "done when" checks, and any failing entry criterion. Do not execute
> until I say go.

**Beat 3 response — CLAUDE CODE confirms.** What good looks like: "Order re-verified;
codebase unchanged since drafting except <small thing>; entry criteria all pass; done-when
is: specs for 7 route groups committed, 5 spot-checks documented." **Red flag:** an entry
criterion fails and it proposes to push on anyway — the correct move is fixing the
criterion or swapping sessions, and it should say so. Then: **> Go.**

**Beat 4 — mostly quiet.** Optional anytime: _"Status check: which step, what's done,
what's left, any deviations?"_

**Beat 5 — YOU:** the U-C close prompt (as in Walkthrough A Turn 5, with "session 0-3").
Skim its close report: tests shown? Deviations honest? PRE-DRAFT sensible? Loop to Beat 1.

---

## Walkthrough C — Session 3-1, a decision session (the flags that are YOURS)

Same five beats, but Beat 4 contains a structured decision you must make. Here's how that
moment actually goes.

**Beat 1 addition to the Advisor prompt:** _"present F6/F7 options for my decision before
scaffolding."_ This ensures the DRAFT's step 1 is "present options, wait."

**Beat 4 — CLAUDE CODE presents (this is what a good escalation looks like):**
"F6 has three options: (1) Bridge-first — keep NextAuth issuing tokens, NestJS verifies the
same secret. Cheapest, nothing user-visible changes, plan recommends it. (2) Adopt OpenAuth —
the 2026-01 study favored it, but I checked: <current maintenance evidence>. (3) Hand-roll
on @nestjs/jwt — most control, most code to own. Hard to undo later: option 2 couples us to
a library; 1 and 3 are reversible. Recommendation: 1 now, revisit at Phase 4 exit."

**YOU reply — decide narrowly, make it record:**

> Decision: F6 = bridge-first. F7 = HS256 shared secret now; switch to JWKS when the second
> service starts verifying tokens. Record both in the Decision Log with today's date,
> approved by Davin, then continue the order.

**If you don't understand the options,** this question earns its keep every time:

> Explain this decision to me as if I'm not an engineer: what are my options, what does
> each cost me, what do you recommend and why, and what's hard to undo later?

Never feel rushed here. A decision session's whole purpose is your judgment; taking a day
to think costs nothing — the wait rules already assume calendar gaps.

---

## Walkthrough D — Session 4A-2, a BUILD session (the Phase 4 pattern)

**Beat 1 — YOU (to Cowork):**

> Here's the PRE-DRAFT from session 4A-1 — produce the DRAFT for session 4A-2 per
> 00-SKELETON-AND-RULES.md. Variant: PORT, dial LOW; generate the migration order at
> 4B-2-example depth — I approve the order before any porting.

The DRAFT you get back is a file-by-file port plan (SOURCE → TARGET → invariants → parity
proof per file), like `4B-2-alert-engine.migration-order.md`. **What to check in Beat 2:**
every file has an invariant line (be suspicious of "none"), tests are ported with
assertions unchanged, and the session ENDS with shadow-run _started_ — if the draft tries
to include the cutover too, send it back: _"Split it — cutover is its own session."_

**Beat 3 addition to the OPEN prompt:** _"re-verify the SOURCE file list and line counts
explicitly."_ Good CONFIRM response includes an actual file table with today's line counts.

**Beat 4 — a typical escalation you'll see (real example from the alert engine):**
"watches.ts imports geometry from the frontend tree. The order says use the shared package
from 4B-1. Confirmed it's published — proceeding per order." (No action needed — that's it
narrating an order-anticipated wrinkle.) **Action needed** looks like: "The cron in
vercel.json runs at 02:00 UTC but the code comments say 03:00 — which is the invariant?"
You answer narrowly; it records the answer in Deviations.

**Beat 5 — the close has one extra check.** Append to U-C:

> ...and confirm shadow/mirror-run STARTED and the source files are now CC-F frozen — state
> the exact 48h end time.

Then immediately: **U-WAIT** — make it write the clock into CLAUDE.md. Now you wait 48
hours. Do nothing on this slice; Phase 5 sessions may run in parallel if you want progress.

---

## Walkthrough E — Session 4A-3, a CUTOVER (fast-path — no Advisor)

The BUILD session's close already produced a PRE-DRAFT for this cutover. It's ~10 lines.

**Beat 2 (replaces Beats 1–2) — YOU, on reading the PRE-DRAFT:**

> Fast-path approved as written — mark it APPROVED and proceed to CONFIRM at next session
> open.

**Beat 3 — YOU (to Claude Code):** U-B for session 4A-3, plus:

> First: the shadow-run diff — total requests compared, match rate, EVERY mismatch with
> your explanation.

**What good looks like:** "48h window ended <timestamp — check it's actually past!>.
14,382 requests mirrored, 14,380 identical. 2 mismatches: both timestamp-formatting on the
response envelope, explained by <reason>, semantically identical." **Red flags that mean
NO CUTOVER:** any mismatch labeled "probably fine" or "unexplained"; the clock not actually
elapsed; "I didn't capture the diff but tests pass."

**YOU (only when every mismatch is explained):**

> Every mismatch explained — approved. Flip MIGRATE_MONEY_CRONS, monitor 30 minutes, and
> report error rate. Anything degrades: flip back first, tell me second.

**Beat 5:** U-C. The cutover table row moves to CUT-OVER; the PRE-DRAFT for the next BUILD
session appears; loop back to Walkthrough D.

---

## Walkthrough F — Session 4A-10, the money cutover (maximum ceremony)

Identical to Walkthrough E with ONE addition — before your approval, always:

> This touches real money. Walk me through it as if I'm auditing you: every write path,
> every idempotency protection, what happens if it runs twice, what happens if it dies
> halfway. Then wait.

**What a passing answer looks like:** it names each write endpoint; for each: the
idempotency key ("Stripe checkout uses idempotency-key header derived from <business
key>"), the double-run behavior ("second run returns the first run's result, no second
charge"), and the mid-death behavior ("webhook retry + dedupe table replays safely").
**Any hand-waving = no approval.** You are allowed to say:

> Not convinced on <X>. Demonstrate it in staging: run it twice, show me one charge.

Same treatment for 4B-20/21 (auth cutover): _"Walk me through what breaks if this goes
wrong and how users get back in. Rollback demonstrated in staging?"_

---

## Walkthrough G — when a session goes sideways (any phase)

Modeled on the real 2026-07-12 git incident — this is the pattern that worked:

1. **Claude Code hits something unexpected and stops** (a discrepancy, a permission wall, a
   pre-existing bug blocking the goal). Good behavior: it flags BEFORE acting. If instead
   you notice it pushing through: _"Stop. Show me exactly what you're stuck on, what you've
   tried, and what you need from me."_
2. **It presents options** (often as a numbered choice). Pick the root-cause fix over the
   bypass, the reversible over the irreversible, and the escalated-and-approved over the
   silent. (Real example: fixing the one-line tsconfig case typo beat `--no-verify`.)
3. **If the surprise is a real sub-task,** don't bloat the current session:
   > That's its own piece of work. Finish what can be finished cleanly, record the rest as
   > a blocker in CLAUDE.md, and PRE-DRAFT an ad-hoc session for it.
4. **If the session can't end clean:**
   > Abort per the abort rule: leave the codebase green, write the blocker into CLAUDE.md,
   > summarize for a fresh session. We stop here.
5. **Afterwards, always:** was a lesson earned? (>30 min lost, recurred, or hit CI/prod →
   an L-entry). The incident that costs you an afternoon should never cost you two.

---

## Five habits that make all of this work

1. **Actually read the 1–2 pages you approve.** Your reading is the only human gate; the
   system is built so that's _enough_, but not so that it's _optional_.
2. **Check clocks yourself.** "48h elapsed" is a date comparison you can do — do it.
3. **Decide narrowly, record always.** Answer the question asked; end every decision with
   "record it in the Decision Log."
4. **Evidence, not confidence.** "Show me" beats "are you sure" — every time, forever.
5. **Don't rush waits, don't batch sessions.** The calendar is a feature. One session, one
   goal, one approval at a time.
