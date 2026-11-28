---
type: Concept/AgentState
status: active
updated_at: 2026-11-28
last_numbered_session: '14-3 (CLOSED SUCCESSFUL 2026-08-30) — Phase 14 complete'
next_numbered_session: '12-0 (Phase 12, Stack D) — blocked on the handover-prompt re-draft, see waiting-on.md'
git_branch: main
max_sessions: 2
related_docs:
  - ./waiting-on.md
  - ./history/index.md
  - ./history/project-position-archive-2026-10-11.md
  - ../protocols/session-lifecycle.md
---

# Active session state

Holds **at most 2** session entries (newest first). When adding a third, rotate the oldest into
`history/YYYY-MM-sessions.md` per [session-lifecycle](../protocols/session-lifecycle.md).
Full historical details of earlier builds live in
[project-position-archive-2026-10-11.md](./history/project-position-archive-2026-10-11.md) (use `Grep`).

## Where the project stands

- **Playbook position:** last numbered session **14-3** (Phase 14 Web Chat complete, 2026-08-30);
  all subsequent work is ad-hoc. Next numbered: **12-0** (Stack D, gated on handover re-draft).
- **dLocal declined & to be retired (2026-11-23):** dLocal refused a prod account; app not launched,
  so integration was sandbox-only and is queued for retirement ([waiting-on.md](./waiting-on.md)).
- **Stack D (MCD0–3 & Build Steps 2–7):** all code, migrations, tests, and runbooks complete locally
  and on `origin/main`. MCD0–3 and SYN run in `shadow` on the gateway (stored, not shown to users).
  Stage B3 closed 2026-11-26; MCD0 1.1.0 deployed (`12f69ed3`) and M5 switched to `most_recent` (14:40Z) the same day. Terminal B hot standby
  built & dry-rehearsed (2026-11-21); Watchdog recency filter (`d2d78f762cf0`) live on VPS; D4 drift patch
  (`98543acd7af9`) approved by the Advisor, deployment not yet confirmed.
- **Security & CI (2026-10-23..11-21):** remediation WS-1..WS-17 built (pending deploy/migrations);
  PRs #511–#519 merged & deployed; Dependabot non-prod triage ([PR #520](https://github.com/ripper7375/trading-alerts-saas-public/pull/520))
  cut open alerts 5,498 -> 90; GitHub Ruleset Stage 1 (`27789976`) active on `main`; Node floor
  **24.22.3** (dev PCs upgraded; Brotli guard `e6fd6494` live; launch-day 415 watch open).
- **Bundle & Billing/DB Wave 2:** [PR #537](https://github.com/ripper7375/trading-alerts-saas-public/pull/537) +
  [PR #536](https://github.com/ripper7375/trading-alerts-saas-public/pull/536) cut measured `.next`
  from 546 MB to 179 MB; Manage Subscription S1–S4 & DB Wave 2 (Units R, U, P-operation, F4) built.
- **Charts & Auth hardening (2026-11-28):**
  [PR #542](https://github.com/ripper7375/trading-alerts-saas-public/pull/542) (`8df7591e`) shipped terminal
  news/event vertical lines (`EventVerticalLine`), right margin (12 candles; 36 slots with M5 overlay), TF lock,
  and Relative Strength tooltip alignment;
  [PR #543](https://github.com/ripper7375/trading-alerts-saas-public/pull/543) (`4c22b6cc`) enforced fail-closed
  JWT callbacks, `session.user.id` guards across 38 server files and `permissions.ts`, and brought `davintrade-dev-db`
  to 42/42 migrations; [PR #544](https://github.com/ripper7375/trading-alerts-saas-public/pull/544) (`08fe44b8`) added
  the `'server'` error banner for `/login?error=Callback`. `davintrade.app` verified PRO/OAuth sessions, dashboard,
  terminal shell, and login banner.
- **Open follow-ups:** see [waiting-on.md](./waiting-on.md). DB traps: [database-traps.md](../architecture/database-traps.md).
  **Commit bundle note:** when committing `.claude/state/` (`waiting-on.md`, `current-state.md`), stage their linked
  untracked files together — especially `docs/handoffs/2026-11-27-stack-d-handoff-and-vultr-cutoff.md` and `.claude/`
  archive files — so links never break in a clean checkout (verify with `node scripts/agents/check-operating-docs.mjs`).

## Latest sessions (verbatim)

<!-- session 2026-11-28 preview-auth-and-session-id -->

> **Ad-hoc session (2026-11-28), `main` `4c22b6cc` (`PR #543`, commit `2ae91fe0` on top of `8df7591e`): resolved
> Preview PRO-as-FREE sign-in regression and enforced fail-closed `session.user.id` server guarantees; details in
> [handoff](../../docs/handoffs/2026-11-28-preview-auth-and-session-id.md).**
> **Root cause & DB fix:** Preview logs showed `davintrade-dev-db` missing `User.sessionVersion` (at 29 of 42
> migrations); `callbacks.jwt` failed on lookup and returned a partial token (`tier` downgraded to FREE). Applied 13
> migrations so `davintrade-dev-db` matches `prisma/migrations` at 42/42.
> **Changed & verified:** `lib/auth/auth-options.ts` `callbacks.jwt` now fails closed on lookup error or missing `id`
> (`SIGN_IN_FAILED` / `SESSION_REVOKED`, clears cookie); added `session.user.id` checks across 38 server files (44 call
> sites including 5 `permissions.ts` helpers) and 186 regression tests. Full Jest suite passed (647 suites, 21,629
> tests; 6 suites / 319 tests skipped), `tsc` exit 0, ESLint 0 errors (5 warnings). Production unauthenticated smoke
> test on `davintrade.app` passed; authenticated `davintrade.app` check confirmed `/api/auth/session` includes `id` and
> `tier: "PRO"`, `/dashboard` shows `2/100` PRO, and `/terminal` loads PRO.
> **Needs from Davin / open:** Confirm Vercel Preview `DATABASE_URL` scope vs `davintrade-dev-db`, audit OAuth callback
> sign-in behavior on DB error, keep monitoring `/pro/currency-index` empty-data on production, and review the 7
> role-only admin routes separately. Local main checkout fast-forwarded to `4c22b6cc` and merged worktree removed.

<!-- session 2026-11-28 chart-news-lines -->

> **Ad-hoc session (2026-11-28), `main` `8df7591e` (`PR #542`): shipped upcoming chart news/event vertical lines and
> timeline layout fixes; details in [handoff](../../docs/handoffs/2026-11-28-chart-news-lines.md).**
> **Changed & verified:** Added `EventVerticalLine` primitive + `eventPlacement` helper (right-margin event clamping,
> past-bar rendering), right margin (12 candles; 36 slots with M5 overlay), `linkTimeScales` TF lock, and Relative
> Strength tooltip alignment. Merged to `main` (`PR #542`) and deployed cleanly to `davintrade.app`.
> **Open / known limits:** `/terminal` live-feed time base & CSP follow-up remains open; `/pro/currency-index` empty
> chart on production queued for read-only investigation. Known chart limits: gold 1h halt alignment, drawing clicks in
> the right margin, and history TF lock when fewer than 1 M15 bar fits.
