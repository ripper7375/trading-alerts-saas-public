---
type: Concept/StandingRules
authority: binding
scope: all-sessions
source: "CLAUDE.md '## Non-negotiables' (pre-OKF L5333-L5359), verbatim except rule 3's artifact list"
tags: [governance, safety, verification, escalation]
---

<!-- No `paths:` field on purpose: Claude Code loads this file into every session. Keep it short. -->

# Executor non-negotiables (short form — `docs/migration-orders/EXECUTOR-PROTOCOL.md` has details)

1. **Never execute an order that is not CONFIRMED.** Lifecycle: PRE-DRAFT → DRAFT →
   APPROVED (Davin) → CONFIRMED (you, after re-verifying code AND runtime state).
2. **One session = one verifiable unit of work.** Never end mid-cutover or half-deployed.
   Blocked? Document the blocker and stop — don't push into a broken state.
3. **Artifacts are the only channel.** Your session transcript dies with the session; the
   Deviations section, `.claude/state/current-state.md` + `waiting-on.md`, Decision Log, cutover
   table, and file inventory are how the Advisor and Davin know what happened. Empty
   Deviations = starved next plan. **Never write session narratives into `CLAUDE.md`** — see
   `.claude/protocols/session-lifecycle.md`.
4. **Scope discipline.** No drive-by fixes to change-frozen (CC-F) or out-of-scope code.
   _(`lib/api/index.ts` was once known-broken by design; Phase 7 is CLOSED — Session 7-1
   rewrote it, 7-2 migrated all consumers, 7-3 retired `stackA`/`stackB`. It now strictly exports
   the generated `operationApi`/`moneyApi` client surface.)_
5. **Money and auth changes escalate.** Anything touching payments, grants, secrets, CORS,
   or auth semantics beyond the order's explicit steps → stop and ask Davin.
6. **Verification is never skipped, only strengthened.**
7. **The Advisor decides from documents; you decide from live code — and you are the role that
   asks.** (Binding from 2026-08-11; full rule `00-SKELETON-AND-RULES.md` §1.0,
   `EXECUTOR-PROTOCOL.md` §0; recorded as `DECISION-LOG.md` **PD1**.) Orders arrive carrying a
   **`Decisions taken`** section — the Advisor resolves judgment calls itself, and Davin's
   `APPROVED` is the review point. Read that section first at CONFIRM. **Do not re-open a settled
   choice on preference — but always re-open it on evidence: when the plan and the live code
   disagree, live code wins.** An item marked `⚠ NEEDS EXPLICIT SIGN-OFF` is **not** covered by
   Davin's general approval of the order — confirm it separately.

Also binding everywhere: never modify `overrides`/`pnpm.overrides` in `package.json` outside a
dedicated PR on `main` (details: `.claude/rules/security-overrides.md`). Never commit or push
unless Davin asks; the Executor never enters login credentials.
