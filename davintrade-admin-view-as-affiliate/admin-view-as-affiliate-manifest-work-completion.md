# Admin "View as Affiliate" (read-only) — Work Completion Manifest

|                   |                                                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Request**       | Davin, 2026-09-24, in chat, from two annotated screenshots of `davintrade.app` (`/settings/profile` and `/dashboard` user menus).                      |
| **Decision**      | Option B of three: a **read-only** view of any affiliate's dashboard. Admin is **not** made an affiliate. Plus a full page load after login.           |
| **Branch**        | `feat/admin-view-as-affiliate`, 4 commits on top of `main` @ `0d0f5b73`. **Pushed. Not merged, not deployed.**                                         |
| **Migration**     | **None.** No `schema.prisma` touched. No new table: view-as start/stop is written to server logs, since no general admin audit table exists.           |
| **money-service** | **Untouched.** In view-as mode the monolith reads Prisma directly instead of proxying (§3.2).                                                          |
| **Status**        | Code complete and verified locally. **Signed-in admin click-through not done** (the Executor never enters credentials). That, plus deploy, is Davin's. |

---

## 1. Background: the question that started this

**"Does Admin login = Admin + PRO + Affiliate?"** No. It is Admin + PRO only.

`admin@tradingalerts.com` is defined in `lib/auth/auth-options.ts` (`FIXED_TEST_ACCOUNTS`) with
`role: 'ADMIN'`, `tier: 'PRO'`, `isAffiliate: false`. Before this work the app kept admins out of
the affiliate area on purpose, in three places:

- `middleware.ts` sent any admin on any `/affiliate/*` path to `/admin`.
- `app/affiliate/dashboard/layout.tsx` did the same.
- `requireAffiliate()` refused admins on every affiliate API (403).

So in the first screenshot both "Affiliate Partner Dashboard" and "Admin Control" landed on
`/admin`. The affiliate menu item was shown to everyone, with no role check.

**Three options were put to Davin:**

| Option                                                    | What the admin gets                                    | Money risk                                                                                                                                                                          |
| --------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Make the admin a real affiliate (`isAffiliate = true`) | Their own, empty, affiliate dashboard                  | **High:** codes redeemable by real customers, commissions and Wise payouts to the admin via the F84 monthly cron; admin counted in affiliate metrics, leaderboard and BI dashboards |
| **B. Read-only "view as affiliate"** (chosen)             | Any affiliate's real dashboard, exactly as they see it | None: writes are refused                                                                                                                                                            |
| C. Keep separate test accounts                            | Log in as `affiliate-test@…`                           | None                                                                                                                                                                                |

Davin chose **B**, asked for a way to pick any affiliate (menu entry plus a selection page), and
asked for the page to load fully after login (§4).

---

## 2. Commits

| Commit        | Summary                                                                             |
| ------------- | ----------------------------------------------------------------------------------- |
| `15517726`    | `fix(auth)`: full page load after login and 2FA, so the header sees the new session |
| `4ab2a467`    | `feat(admin)`: read-only "view as affiliate" for admins                             |
| `e39d5b29`    | `docs(claude-md)`: session entry in `CLAUDE.md`                                     |
| _this commit_ | This manifest; `CLAUDE.md` entry updated to "pushed"                                |

---

## 3. What was built

### 3.1 The view-as engine: `lib/affiliate/view-as.ts`

- **Cookie:** `davintrade-admin-view-as` (`__Secure-` prefixed in production). httpOnly,
  `sameSite: lax`, `path: /`, `secure` in production, **2-hour** lifetime.
- **Value:** `<adminUserId>:<affiliateProfileId>`, both validated against `^[A-Za-z0-9_-]{1,64}$`.
- **`getAdminViewAs()`** returns the viewed affiliate only when:
  1. the session role is `ADMIN`;
  2. the cookie decodes cleanly;
  3. the admin id in the cookie **equals** the signed-in user's id;
  4. the affiliate profile exists.

  Anything else, **including any thrown error**, returns `null`. `null` means the normal
  affiliate checks apply, so the helper fails closed.

- **`loadViewAsTarget()`** never creates a profile. This matters because
  `getAffiliateProfile()` auto-creates one when missing, so the admin path must never call it.
- **Payment details are removed:** the returned profile carries `paymentDetails: {}`.

### 3.2 Affiliate read routes

Each GET route below now checks view-as first. If an admin is viewing, the route serves the
viewed affiliate's data and **skips the money-service proxy**. Otherwise it behaves exactly as
before.

| Route                                            | In view-as mode                                                         |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| `GET /api/affiliate/dashboard/stats`             | Viewed affiliate's stats (Prisma)                                       |
| `GET /api/affiliate/dashboard/codes`             | Viewed affiliate's codes (Prisma)                                       |
| `GET /api/affiliate/dashboard/code-inventory`    | Viewed affiliate's inventory (Prisma)                                   |
| `GET /api/affiliate/dashboard/commission-report` | Viewed affiliate's commissions (Prisma); also feeds Statements          |
| `GET /api/affiliate/dashboard/resources`         | Viewed affiliate's active codes + published assets                      |
| `GET /api/affiliate/profile`                     | Viewed affiliate's profile, payment details removed, never auto-created |
| `/affiliate/dashboard/payouts` (server page)     | Viewed affiliate's payout batches                                       |

**Why the proxy is skipped.** Slice 3 is cut over in production
(`MIGRATE_READ_APIS_MONEY_AFFILIATE`). The proxy forwards **the caller's own token**, so for an
admin it would return the admin's data or refuse. The alternatives were:

- mint a token that acts as the affiliate, which would also let it write, so rejected;
- use the Prisma path each route still keeps as the Slice 3 rollback, which reads the same
  database by the viewed affiliate's profile id, so chosen.

Parity between the two paths was established at F44.

**Writes are unchanged.** These still call `requireAffiliate()`, which an admin fails with 403
whatever the UI shows:

- `PUT/PATCH /api/affiliate/profile`
- `POST .../resources/[id]/copy`
- `GET .../resources/[id]/download` (it increments a counter, so it counts as a write)
- the `/affiliate/settings/payout` routes

### 3.3 Admin API: `app/api/admin/affiliates/view-as/route.ts`

| Method   | Purpose                                                                                          | Guards                                                            |
| -------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `GET`    | Search affiliates by name, owner email, or promo code; status filter; paginated (5–50 per page)  | `requireAdmin()`                                                  |
| `POST`   | Start viewing: body `{ profileId }`, sets the cookie, returns `redirectTo: /affiliate/dashboard` | `validateOrigin()` + `requireAdmin()`; 404 for an unknown profile |
| `DELETE` | Stop viewing: expires the cookie with the same attributes it was set with                        | `validateOrigin()` + `requireAdmin()`                             |

- **How search works:** `AffiliateProfile` has no relation to `User` and no code column. So a
  search term matches three ways: `fullName`, `userId IN (users whose email matches)`, and
  `id IN (profiles owning a matching code)`.
- **Why not reuse the existing admin list:** it proxies to money-service and has no search.
- **Logging:** start/stop write `[admin-view-as] start admin=… affiliateProfile=…` and
  `[admin-view-as] stop admin=…`.

### 3.4 UI

- **Picker page** `app/admin/affiliates/view-as/page.tsx` (inside `/admin`, so the admin layout
  gates it):
  - debounced search, status filter;
  - each row shows name, status, email, active code, country, earnings, codes used and join date;
  - a "View dashboard" button on each row;
  - after starting a view, a full page load so the dashboard reads the new cookie.
- **Ways in:**
  - header user menu: **admins** see "View as Affiliate (read-only)" instead of "Affiliate
    Partner Dashboard"; everyone else is unchanged;
  - admin sidebar: new "👁️ View as Affiliate" entry after "Affiliates & Reports";
  - the `/affiliate` "Administrator Hub" card gains a second button.
- **Dashboard layout** (`app/affiliate/dashboard/layout.tsx`):
  - admin with an active view: renders the dashboard in read-only mode;
  - admin without one: sent to the picker (previously `/admin`);
  - non-admins: unchanged, including the F79 database re-check.
- **Banner** (`components/affiliate/view-as-banner.tsx`): "Admin view (read-only): _name_
  (_email_)", with **Switch affiliate** and **Exit view**.
- **Read-only context** (`components/affiliate/view-as-context.tsx`) tells pages when they are
  being viewed by an admin.
- **Page changes in view-as mode** (hiding is a courtesy; the API refuses writes anyway):
  - **Nav:** "Payout Settings" tab hidden; "Back to App" goes to `/admin`.
  - **Profile:** "Edit Profile" and "Manage Payout Settings" hidden. It no longer falls back to a
    profile built from the viewer's own session, which would have shown the admin's name as
    the affiliate's.
  - **Resources:** downloads shown as disabled. Copying swipe text still works but skips the
    tracking call. The FAQ's Payout Settings link becomes plain text.
  - **Payouts:** the Payout Settings link becomes plain text.
- **Payout settings layout:** an admin is sent to `/affiliate/dashboard` rather than `/admin`,
  so following a stale link keeps them in the view.

### 3.5 Middleware (found during verification)

`middleware.ts` had its own rule: any admin on any `/affiliate/*` path goes to `/admin`. It runs
**before** the layout, so view-as could never have opened in production. None of the unit tests
touched it.

`/affiliate/dashboard*` is now exempt. Admins on `/affiliate/settings/*`, `/affiliate/register`
and `/affiliate` are still sent to `/admin`. Both cases are tested.

---

## 4. Login fix: full page load after sign-in

**Symptom** (Davin's second screenshot): right after logging in, `/dashboard` said "Welcome back,
Admin!" in the page body, while the header said **"Trader" / "Trader Account"** and showed no
Admin Control.

**Cause:**

- "Trader" / "Trader Account" are `app-header.tsx`'s fallbacks for an empty `useSession()`.
- The page body reads the session on the server, so it was right.
- The header reads it in the browser, from the `SessionProvider` created before login.
- `login-form.tsx` called `getSession()` and then `router.push`. In next-auth **4.24.13** a
  standalone `getSession()` only notifies **other** tabs: its broadcast rides the `storage`
  event, which never fires in the tab that wrote it. This was confirmed in the installed source.
- So the header kept its pre-login state until a refresh or a tab refocus.

**Fix:** new `lib/auth/post-login-navigation.ts` (`navigateAfterLogin()` →
`window.location.assign`). It is used by `components/auth/login-form.tsx` (both the bridge and
NextAuth paths) and by `app/(auth)/verify-2fa/page.tsx` (all three landings). The redirect to the
2FA step stays a client-side push, because the user is not signed in yet at that point.

---

## 5. Files changed

30 files, +1752 / −112 (excluding `CLAUDE.md` and this manifest).

**New:**

- `lib/affiliate/view-as.ts`
- `lib/auth/post-login-navigation.ts`
- `app/api/admin/affiliates/view-as/route.ts`
- `app/admin/affiliates/view-as/page.tsx`
- `components/affiliate/view-as-banner.tsx`
- `components/affiliate/view-as-context.tsx`
- `__tests__/lib/affiliate/view-as.test.ts`
- `__tests__/api/admin-affiliate-view-as.test.ts`
- `__tests__/api/affiliate-view-as-reads.test.ts`

**Modified:**

- `middleware.ts`
- `app/admin/layout.tsx`
- `app/affiliate/page.tsx`
- `app/affiliate/dashboard/layout.tsx`
- `app/affiliate/dashboard/{payouts,profile,resources}/page.tsx`
- `app/affiliate/settings/layout.tsx`
- `app/api/affiliate/dashboard/{stats,codes,code-inventory,commission-report,resources}/route.ts`
- `app/api/affiliate/profile/route.ts`
- `components/affiliate/affiliate-nav.tsx`
- `components/layout/app-header.tsx`
- `components/auth/login-form.tsx`
- `app/(auth)/verify-2fa/page.tsx`
- `__tests__/middleware.test.ts`
- `__tests__/components/auth/login-form.test.tsx`
- `__tests__/app/auth-verify-2fa.test.tsx`

---

## 6. Test, lint and type-check results

| Check                                      | Result                                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                         | Clean                                                                                                         |
| ESLint (changed files, `--max-warnings 0`) | Clean                                                                                                         |
| Prettier                                   | Clean (also applied by the pre-commit hook)                                                                   |
| Full `npm run test:ci`                     | **230/230 suites · 2983/2983 tests**. Baseline 227/2951, plus 3 new suites and 32 new tests; zero regressions |
| New suites                                 | `view-as.test.ts` 14, `admin-affiliate-view-as.test.ts` 10, `affiliate-view-as-reads.test.ts` 4               |
| Middleware tests                           | 12/12, including 4 new                                                                                        |
| Auth suites (login, 2FA, bridge swaps)     | 22/22                                                                                                         |

**Mutation checks: 5/5 caught.** Each check broke one safeguard on purpose and confirmed a test
failed. Every restore was confirmed byte-exact by sha256.

| Safeguard removed                                       | Result       |
| ------------------------------------------------------- | ------------ |
| Stats route proxies to money-service even in view-as    | 1 test fails |
| Cookie accepted without matching the admin's id         | 1 fails      |
| `paymentDetails` not removed                            | 2 fail       |
| Profile route ignores view-as (would auto-create)       | 1 fails      |
| Middleware exemption for `/affiliate/dashboard` removed | 2 fail       |

---

## 7. Live verification (local `next dev`)

**Signed out, against the real routes:**

| Request                                                   | Result                                                           |
| --------------------------------------------------------- | ---------------------------------------------------------------- |
| `GET` / `POST` / `DELETE` `/api/admin/affiliates/view-as` | **401**                                                          |
| Cross-origin `POST`                                       | **403** "Invalid request origin" (refused before any auth check) |
| `/admin/affiliates/view-as`                               | 307 → `/login?callbackUrl=%2Fadmin%2Faffiliates%2Fview-as`       |
| `/affiliate/dashboard`                                    | 307 → `/login?callbackUrl=%2Faffiliate%2Fdashboard`              |

**UI, through a throwaway unauthenticated preview route** (repo precedent; **deleted**, never
committed). It rendered the real picker, banner and nav with the admin API stubbed in the browser:

- View-as nav shows the banner, hides Payout Settings, and "Back to App" goes to `/admin`. The
  normal affiliate nav is unchanged.
- Typing "bob" sent **one** debounced request and filtered to the right affiliate.
- "View dashboard" sent `POST {"profileId":"prof_2"}`. An error response is displayed and the
  button re-enables.
- No horizontal overflow at 375px; the banner wraps cleanly.

**Environment note:** the dev server first returned 404 for **every** route, including
next-auth's own `/api/auth/session`. The cause was a stale `.next/dev` cache, unrelated to this
change; clearing it fixed it.

---

## 8. Not verified / open items

1. **Signed-in admin click-through** on a deployed build: header name and Admin Control straight
   after login; picker → view → every tab → Switch → Exit. The Executor never enters credentials.
2. **Real data under view-as.** Only the Prisma paths were exercised, with mocks. The first real
   view shows whether the monolith's rollback path still matches money-service's output (F44
   parity dates from 2026-07).
3. **Translations.** New strings use `t(key, fallback)`, so they render in English. No dictionary
   entries were added to any language (admin-only surface; policy §2.C allows partial coverage).
4. **Audit trail** is server logs only (`[admin-view-as]`). A durable record would need a new
   table and migration.
5. **An admin whose JWT still says USER.** The admin API accepts a database-confirmed admin, but
   `getAdminViewAs()` trusts the JWT role, so a freshly promoted admin sees no view until their
   token refreshes. Fails closed, low impact.
6. **Unchanged surfaces:** no "View as this affiliate" button on `/admin/affiliates/[id]` (the
   picker covers it), and no "view as FREE user" (discussed as a possible follow-on using the
   same mechanism).

---

## 9. Rollback

This is code only: no migration, no environment variables, no money-service change. To roll
back, revert `4ab2a467` (and `15517726` for the login change). A leftover view-as cookie is
harmless once reverted, because nothing reads it, and it expires within 2 hours.
