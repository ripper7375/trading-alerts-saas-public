# OAuth Cookie Fix & Sign-Out Manifest — Work Completion Report

**Date:** 2026-09-01
**Status:** Code complete, verified, committed, and pushed to `origin/main`. Two production
database migrations applied. Fix confirmed working live by Davin (Google + Twitter/X sign-in).
**Type:** Ad-hoc bug-investigation session (Davin-reported directly in chat) — outside the
phase/session numbering, per `docs/migration-orders/EXECUTOR-PROTOCOL.md` §6. Recorded across four
ad-hoc notes in `CLAUDE.md` (OAuth cookie fix, OAuth root-cause correction, sign-out fix, and this
document's own source entries).

> **Scope note:** this document covers everything from the original `error=Callback` OAuth report
> through to the follow-on sign-out bug Davin found while verifying it, and the CI safeguard added
> afterward. It does not cover the Railway-project cleanup discussion (zoological-motivation,
> feisty-amazement, the staging project's pending service deletion) — those were investigated and
> discussed in chat but produced no code changes, so they aren't repeated here.

---

## 1. What was built

Google and Twitter/X OAuth sign-in were failing with `error=Callback` on `davintrade.app`. What
started as a NextAuth cookie-configuration fix turned out to be masking a much larger, unrelated
problem: **production's database was missing schema that had only ever been applied to other
databases via `prisma db push`, never captured in a tracked migration.** Fixing that also surfaced
a second, independent bug — sign-out silently not working — caused by two compounding issues of
its own. A CI safeguard was added at the end so this specific failure class (a migration existing
in the repo but never reaching production) can't silently recur.

### 1.1 OAuth cookie-domain fix (real hardening, not the actual root cause)

- `lib/auth/auth-options.ts`: added an explicit `.davintrade.app` (leading-dot) `domain` to all six
  NextAuth cookies (`sessionToken`, `callbackUrl`, `csrfToken`, and — previously left undefined,
  silently falling back to host-only defaults — `state`, `pkceCodeVerifier`, `nonce`). Gated on
  `VERCEL_ENV === 'production'` specifically, not `NODE_ENV` (which is `"production"` for Vercel
  preview deployments too — a `.davintrade.app` Domain attribute on a `*.vercel.app` host would be
  invalid and silently dropped by the browser, breaking OAuth on every preview build).
- Added diagnostic `console.log`/`console.error` wrappers to `CustomPrismaAdapter`'s previously-bare
  `linkAccount`/`getUserByAccount` passthroughs — this logging is what let Davin pull the exact
  Vercel runtime error that revealed the real root cause in §1.2.
- **This fix was kept in the codebase** (it's correct, real hardening against a genuine host-only
  vs. domain-scoped cookie mismatch class of bug) but confirmed **not** to be what was causing the
  reported failure — see §6 for how that was found.

### 1.2 The real root cause: untracked database schema drift

Davin pulled the actual Vercel runtime logs, which showed:
`PrismaClientKnownRequestError P2022 — The column User.profile does not exist in the current
database`, thrown by `getUserByAccount`'s very first `prisma.account.findUnique(...)` call. Every
OAuth sign-in was dying there, before ever reaching account-linking logic.

Investigation (disposable shadow database, dropped after use — zero real data touched) found this
wasn't an isolated gap:

- `User.profile` (`Json?`, added for the AI Token Metering feature) was never captured in any
  tracked Prisma migration — applied directly via `db push`/manual SQL to a different database at
  some point, bypassing migration history entirely.
- Replaying all 14 tracked migrations from empty into the shadow database failed partway through
  `20260831061759_add_tutorial_videos` — `type "MarketingAssetStatus" does not exist`. That enum,
  its sibling `MarketingAssetCategory`, and the entire `MarketingAsset` table (the Marketing
  Resources / Media Kit feature) were **also** never captured in any migration — a second, earlier,
  separate instance of the same drift class.
- **A load-bearing discovery along the way:** the "railway" Postgres reachable via this repo's own
  `.env.local` turned out to be a **separate Railway project** ("postgre for staging"), not
  production — confirmed only because Davin screenshotted the real Railway dashboard. Production
  lives in the "trading-alerts" project instead, whose `DATABASE_URL` there is Railway's internal
  address (unreachable from outside Railway) — Vercel's real connection runs through
  `DATABASE_PUBLIC_URL` instead. `vercel env pull` also cannot retrieve Sensitive-marked env vars
  at all (writes a `[SENSITIVE]` placeholder, by design) — Davin retrieved the real production
  connection string directly from Railway's own dashboard instead, into a local, gitignored
  `.env.production.local`, never pasted into chat.
- Two new tracked migrations were written to backfill both gaps (idempotent — safe regardless of a
  given database's current state) and applied directly to production via `prisma migrate deploy`,
  run by Davin from his own machine. Three **other**, pre-existing pending migrations
  (`vat_tax_invoicing_stack`, `commission_clawback_link`, `commission_recurring_invoice_id`) were
  discovered as a side effect of finally checking production's real status, individually reviewed
  for safety, and applied in the same pass — six migrations total, all additive, all successful.

### 1.3 The follow-on bug: sign-out silently not working

While verifying the OAuth fix, Davin found the `/login` "Already Signed In" screen's Sign Out
button rolled back to the same screen no matter how many times it was clicked. Two independent,
compounding bugs were found via live DevTools evidence Davin captured (Network + Application tabs):

1. `app/(auth)/login/page.tsx` and `app/(auth)/verify-2fa/page.tsx`'s Sign Out buttons only ever
   called `next-auth/react`'s `signOut()` — every other sign-out call site in the app already
   additionally calls `/api/auth/token-logout`. `signOut()` alone can only clear a cookie matching
   its _current_ config's exact `Domain` scope — any session cookie set before the §1.1 fix deployed
   was host-only, a genuinely different cookie to the browser than the new domain-scoped one, so it
   kept getting read as an active session no matter how many times the (correctly-working, for the
   _new_ cookie) sign-out ran.
2. **A second, pre-existing bug found only while reading `token-logout/route.ts` closely for fix
   #1:** it cleared cookies via `cookieStore.delete(name)`, which Next.js builds without a `Secure`
   attribute. Both cookie names are `__Secure-`-prefixed in production, and browsers silently
   reject an _entire_ Set-Cookie header for a `__Secure-`-prefixed name if `Secure` is missing — so
   this route's cookie clearing had never actually taken effect in production, for any user, since
   it was created.

### 1.4 CI safeguard against recurrence

Added `.github/workflows/check-production-migrations.yml` — runs `prisma migrate status` against
production on every push to `main`, purely read-only (never applies anything, never gates the
deploy workflow). Makes drift visible within about a minute instead of sitting silent for days, the
way today's `User.profile`/`MarketingAsset` gaps did. Deliberately **not** full auto-deploy — this
repo has already been burned once by an unrelated pending migration sitting ahead of the one that
mattered (the Academy session's own workaround), so `migrate deploy` stays a deliberate, human-run
step. Required a new `PRODUCTION_DIRECT_URL` GitHub Actions secret (deliberately not reusing the
existing `DATABASE_URL` secret already used elsewhere in this repo's workflows, whose actual target
wasn't confirmed to be production).

---

## 2. Files changed

| File                                                                       | Change                                                                                                                                                  |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/auth/auth-options.ts`                                                 | `.davintrade.app` cookie domain on all 6 NextAuth cookies; `linkAccount`/`getUserByAccount` diagnostic logging                                          |
| `prisma/migrations/20260901062245_add_user_profile_column/migration.sql`   | **Added.** Idempotent backfill for `User.profile`                                                                                                       |
| `prisma/migrations/20260830020000_backfill_marketing_assets/migration.sql` | **Added.** Idempotent backfill for `MarketingAssetCategory`/`MarketingAssetStatus`/`MarketingAsset`                                                     |
| `app/(auth)/login/page.tsx`                                                | Sign Out now calls `/api/auth/token-logout` (bridge-aware) before `signOut()`                                                                           |
| `app/(auth)/verify-2fa/page.tsx`                                           | Same fix as above, for the "Already Authenticated" screen                                                                                               |
| `app/api/auth/token-logout/route.ts`                                       | Cookie clearing switched from `.delete()` to `.set()` with explicit `Secure`/`httpOnly`/`sameSite` (reusing the existing `tokenCookieOptions()` helper) |
| `__tests__/api/auth/token-logout.test.ts`                                  | Updated to assert `.set()` with correct options instead of the old `.delete()` calls                                                                    |
| `.github/workflows/check-production-migrations.yml`                        | **Added.** Read-only production migration-drift CI check                                                                                                |
| `CLAUDE.md`                                                                | Four ad-hoc session entries (cookie fix, root-cause correction, sign-out fix, this document's source)                                                   |
| `next-env.d.ts`                                                            | Regenerated by `next dev`; committed to keep the tree clean per this repo's own established convention                                                  |

**9 files touched (7 modified, 2 added)**, 539 insertions / 9 deletions across 8 commits.

---

## 3. Test verification

| Suite                                                                            | Result                                                                                                                                             |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monolith Jest (scoped: `__tests__/api/auth/token-logout.test.ts`)                | **4/4 passed**, after updating assertions to match the `.set()`-based fix                                                                          |
| Monolith Jest (full `test:ci`, run 3 times across the session as changes landed) | **165/165 suites · 2382/2382 tests passed**, every time — zero regressions                                                                         |
| TypeScript — monolith                                                            | `tsc --noEmit`, 0 errors, checked after every batch of changes                                                                                     |
| ESLint                                                                           | Clean on every changed file                                                                                                                        |
| Prettier                                                                         | Clean (pre-commit hook auto-formatted on each commit)                                                                                              |
| Pre-push hook (type-check + `test:quick` + full `test:ci`)                       | Passed on all 8 pushes to `origin/main`                                                                                                            |
| CI workflow itself                                                               | Manually triggered end-to-end after the `PRODUCTION_DIRECT_URL` secret was added — passed: `15 migrations found... Database schema is up to date!` |

---

## 4. Live verification

- **Production OAuth flow driven directly in the browser** (stopping short of entering any
  credentials, per this repo's standing rule): confirmed the apex domain 308-redirects to
  `www.davintrade.app` before any application code runs (so the whole OAuth round trip is always
  single-host in practice), confirmed Google's consent screen loads with the correct
  `redirect_uri`, and confirmed — via Davin's own click-through — that both Google and Twitter/X
  sign-in now complete successfully end to end.
- **Regression check on public, DB-backed pages** after the two production migrations were applied:
  `/affiliate/leaderboard` and `/academy` (the latter reads the newly-created `TutorialVideo`
  table) both render live data with zero console/server errors.
- **Sign-out fix**: verified locally that `/login` still renders clean post-change (zero
  console/server errors); the actual authenticated click-through (does Sign Out now redirect to a
  genuinely logged-out state) needs Davin's own confirmation, same "Executor never enters
  credentials" boundary as everywhere else in this repo's history — flagged in `CLAUDE.md`'s
  `Waiting on` section, not silently assumed fixed.
- **CI workflow**: two real end-to-end runs performed — one confirming the expected failure mode
  before the secret existed (missing `DIRECT_URL` → fails at the dependency-install step, correctly
  _not_ mislabeled as migration drift by the "Explain failure" step's scoped condition), one
  confirming the success mode after the secret was added (green run, correct production host in
  the log, "up to date").

---

## 5. Git history

Landed as 8 commits on `main`, each pushed individually (pre-push hook ran the full 165-suite test
run before allowing every push):

| Commit     | Summary                                                                        |
| ---------- | ------------------------------------------------------------------------------ |
| `6d88d85a` | `fix(auth): share OAuth state/PKCE/session cookies across apex and www` — §1.1 |
| `de40dc05` | `fix(db): add tracked migration for User.profile column` — §1.2                |
| `b5d34b7c` | `fix(db): add tracked migration backfilling MarketingAsset feature` — §1.2     |
| `81225159` | `docs: record OAuth root-cause correction and resolution in session log`       |
| `946880ab` | `fix(auth): fix sign-out never actually clearing the session cookie` — §1.3    |
| `a30863fe` | `docs: record sign-out fix in session log`                                     |
| `6f3830f1` | `ci: add production migration drift detection workflow` — §1.4                 |
| `c08b7d60` | `fix(ci): move DIRECT_URL to job level in migration-check workflow`            |

---

## 6. A note on the investigation path

The apex/www cookie-domain fix (§1.1) was the first hypothesis, backed by a real, plausible
mechanism (host-only OAuth state cookies breaking the callback when the initiating host differs
from the fixed-`NEXTAUTH_URL` callback host) — but Davin confirmed live that `error=Callback`
persisted after it deployed. Rather than assume the fix was merely incomplete, live production
testing (browser-driven, no credentials entered) found the apex/www split doesn't actually happen
in practice — Vercel 308-redirects apex to `www` before any application code runs, so the whole
flow is always single-host. That ruled out the first theory's _mechanism_, even though the fix
itself remained valid hardening. The actual cause only surfaced once Davin pulled the real Vercel
runtime logs (using the diagnostic logging added as part of the same first fix) and shared the
exact `P2022` error — at which point the investigation shifted entirely to database schema drift,
uncovering the two-layer untracked-migration problem and the staging/production Railway-project
mix-up described in §1.2.

---

## 7. Explicitly out of scope / flagged, not fixed

- **LinkedIn OAuth** — never actually tested this session (Davin's report and every live check
  covered Google and Twitter/X only). Flagged in `CLAUDE.md`'s `Waiting on` section.
- **`TokenUsageLog` table** — confirmed missing on _both_ the staging and production databases (the
  AI Token Metering feature's own schema was never captured in any migration and was never fully
  deployed anywhere). Unrelated to the OAuth/sign-out flow — nothing in either touches this table —
  so left as a separate, flagged gap rather than bundled into an urgent auth fix.
- **The other test accounts** (`pro-test`, `admin-test`, `affiliate-test`, etc.) — the sign-out fix
  isn't account-specific, but wasn't individually re-verified against each one.
- **Two offline Railway projects** (`zoological-motivation`, `feisty-amazement`) and a pending
  service-deletion change in the "postgre for staging" project — investigated and discussed in
  chat (confirmed unreferenced anywhere in this app's config, safe either way) but produced no code
  changes, so not covered by this document; see the session transcript instead.
