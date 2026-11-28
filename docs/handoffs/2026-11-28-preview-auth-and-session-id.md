# Hand-off: Preview sign-in showed a PRO account as FREE; sessions must name an account (2026-11-28)

These notes were written for `.claude/state/` and `.claude/architecture/`. They are kept here instead (Davin,
2026-11-28): this worktree holds the unpruned operating documents. Fold them into the main checkout.

## Cause

- On a Vercel Preview, `/api/auth/session` returned only `name`, `email` and `image` for the PRO test account.
- The database the Preview queried was behind on migrations. Its server log shows
  `column User.sessionVersion does not exist` twice on 2026-11-28 (02:57 and 02:59 UTC), for the column list of the
  sign-in lookup in `callbacks.jwt` (`lib/auth/auth-options.ts`). The log belongs to the Railway development
  database (project `davintrade-dev-db`).
- The password step selects other columns, so it passed. The `jwt` callback caught the failed lookup and returned
  the token without `id`, `tier` or `role`.
- Production was not affected in the same way: its migration check (job `140854099445`, commit `8df7591e`) lists
  only `20261114000000_add_trendline_context_tables` as unapplied, and password sign-in there goes through
  operation-service (the auth bridge is on in the public production bundle), not through this lookup.

## Code change (Davin approved both parts in chat, 2026-11-28)

- `callbacks.jwt`, sign-in: a lookup that throws, or an outcome without an account id, now refuses the sign-in
  (`SIGN_IN_FAILED`, the reason in the server log). A missing row still falls back to the user object, as before.
- `callbacks.jwt`, later reads: a token whose `id` is not a non-empty string is refused (`SESSION_REVOKED`), so
  NextAuth clears the cookie. Anyone holding such a cookie is signed out on the next session read. A failed refresh
  on a session update still keeps the live session.
- Server-side "signed in" checks now require `session.user.id`: 20 pages and layouts, 18 API handlers and the
  chat-token route (a session without an id is a guest there), and 5 helpers in `lib/auth/permissions.ts`.
- Left as they were: admin routes that decide by role alone and never use the account id
  (`api/admin/{analytics,api-usage,error-logs,users}`, `api/disbursement/{audit-logs,transactions}`,
  `api/disbursement/reports/summary`), client components, and `middleware.ts` (the page checks stay behind it).
  `POST /api/subscription` has no check of its own: it forwards the cookie to `/api/checkout`.
- Tests, written first and seen failing: `__tests__/lib/auth/session-without-id.test.ts` and
  `__tests__/lib/auth/session-id-guards.test.ts`. A new server-side "signed in" check belongs in the tables of the
  second one.
- Verified from the worktree: full Jest (wrapper config, coverage off) 647 suites passed, 6 skipped; 21,629 tests
  passed, 319 skipped. `tsc --noEmit` exit 0. ESLint 0 errors (5 existing warnings). `npm run build` was not run.
  The commit hook also reorders one existing class list in `app/admin/layout.tsx` (Prettier).
- Not seen in a browser. From code reading: a refused OAuth sign-in lands on `/login?error=Callback`, for which the
  login form shows no message (true of that code before this change too); a refused password sign-in answers 500 and
  the form should show its server-error text.

## Development database (applied 2026-11-28, Davin's approval)

- Target checked before each command: `DIRECT_URL` of the main checkout's `.env.local` is the TCP proxy of the
  `davintrade-dev-db` Postgres service and not the production one.
- `prisma migrate deploy` from this worktree applied 13 migrations: `20260904110000_backfill_untracked_tables`,
  `20261002000000`, `20261003000000`, `20261004000000`, `20261010000000`, `20261014000000`, `20261014010000`,
  `20261015000000`, `20261021000000`, `20261024000000`, `20261025000000`, `20261026000000` and `20261114000000`.
- Afterwards `migrate status`: "Database schema is up to date" (42 of 42). The seeded PRO test account is read by
  the sign-in column list with an id, tier `PRO`, role `USER`, `sessionVersion` 0; active, verified, no 2FA.
- Production was not touched: `20261114000000_add_trendline_context_tables` is still Davin's to apply there.

## Stale operating documents

- `.claude/architecture/database-traps.md`
  - "`DATABASE_URL` is scoped to All Environments, so preview deployments hit production data": the Preview's
    queries reached the development database on 2026-11-28. Read the variable scopes in Vercel before rewriting it.
  - "NOT applied" for `20261024000000`, `20261025000000` and `20261026000000`: the production check records all
    three as applied; the development database got them on 2026-11-28.
  - The local-database lines: `.env.local` points at `davintrade-dev-db`; `DATABASE_URL` in `.env` does not point
    there (where it points was not checked).
- `.claude/state/waiting-on.md`: "Preview deployments point at the production database" (noticed 2026-09-09) has
  the same conflict. Close or rewrite it after the Vercel check.

## Open

- Vercel variable names and scopes were not read (connector 403 for the team). That the Preview uses the
  development database with the auth bridge off rests on the database log and the observed behaviour.
- Re-test of the Preview sign-in: `vercel.json` skips `claude/*` and `docs/*` branches, so it needs a branch with
  another prefix.
- Google and X sign-in on `davintrade.app` not checked (Davin signs in).
