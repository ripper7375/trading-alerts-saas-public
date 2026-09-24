# Admin "View as User" (read-only) — Work Completion Manifest

|               |                                                                                                                                                           |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Request**   | Davin, 2026-09-24, in chat, with three annotated screenshots: `/settings/billing`, `/settings/security`, `/settings/security/activity`.                   |
| **Goal**      | Customer support. An admin sees a FREE or PRO user's Billing, Login History and Security Activity exactly as that user sees them.                         |
| **Model**     | The affiliate view-as (`davintrade-admin-view-as-affiliate/`), adapted for users.                                                                         |
| **Branch**    | `feat/admin-view-as-user`, off `main` @ `084ddaae`: `e5f087fb` (read path), `50e6916c` (UI), plus this docs commit. **Pushed, not merged, not deployed.** |
| **Migration** | **None.** No schema change. Start/stop is logged to the server log (`[admin-view-as-user]`); no admin audit table exists.                                 |
| **Status**    | Code complete and verified locally. **Signed-in admin click-through not done** (the Executor never enters credentials).                                   |

---

## 1. How an admin uses it

1. **Admin → Users** (`/admin/users`). Each row now has a **View as user** button, next to
   "Inspect User". The user detail page (`/admin/users/[id]`) has the same button in its header.
   The button is disabled for admin accounts.
2. The click starts the view and opens `/settings/billing` with a full page load.
3. A blue banner shows **"Admin view (read-only): _name_ (_email_) · _tier_"**, with **Switch
   user** (back to `/admin/users`) and **Exit view** (clears the view, returns to that user's
   detail page).
4. The settings nav shows only **Security** and **Billing**. Security links on to Security
   Activity as usual.
5. The view lasts 2 hours, then the admin starts it again.

## 2. What the admin sees

| Page                          | Shows the viewed user's                                                                    | Hidden or disabled in view mode                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `/settings/billing`           | Plan and tier, trial state, payment method, alert usage, full invoice history and receipts | Cancel Plan, Manage Subscription, Upgrade, the upgrade card, affiliate payout buttons (a note says why) |
| `/settings/security`          | Security-alert email settings, 2FA on/off and backup-code warning, login history           | Alert switches disabled; Enable / Disable 2FA and Backup Codes hidden                                   |
| `/settings/security/activity` | Every security alert, including read/unread ("New") state                                  | "Mark read"                                                                                             |
| Any other `/settings/*` page  | Nothing. It shows a "Not available in admin view" notice                                   | The whole page (it would show the admin's own account)                                                  |

**Why actions are hidden, not refused.** In this feature every write still acts on the
**session user**, which is the admin. So an admin could not change the customer's account by
clicking Cancel Plan, but they **would cancel their own**. Hiding the controls protects the
admin; nothing can reach the customer's account (§3).

## 3. How it works

**Two conditions**, both required before any route serves another user
(`lib/admin/user-view-as.ts`):

1. **Cookie.** `davintrade-admin-view-user` (`__Secure-` prefixed in production), httpOnly,
   `sameSite: lax`, 2 hours. Value `<adminId>:<userId>`. It is honoured only when the session
   role is ADMIN, the admin id in the cookie equals the session id, and the target exists and is
   **not** an admin. Any error means no view (fails closed).
2. **Opt-in.** The request carries `?view_as=user`. Only the three settings pages add it
   (`withViewAsQuery()` in `lib/admin/user-view-as-paths.ts`). **Every other request ignores the
   cookie entirely**, so a view left open can't leak into `/alerts`, the header, pricing or
   anything else the admin opens.

An opt-in without a valid view (expired cookie, non-admin, target gone) returns **403
`VIEW_AS_DENIED`**, never the admin's own data under the customer's banner.

**Read routes changed** (GET only; each keeps its exact previous behaviour without the opt-in):

| Route                            | In view mode                                                        |
| -------------------------------- | ------------------------------------------------------------------- |
| `GET /api/subscription`          | Viewed user's tier, subscription, trial                             |
| `GET /api/invoices`              | Viewed user's history; dLocal receipt links carry `?view_as=user`   |
| `GET /api/invoices/[id]/receipt` | Receipt only if the payment belongs to the viewed user              |
| `GET /api/alerts`                | Viewed user's alerts (Billing "Active Alerts" count)                |
| `GET /api/user/login-history`    | Viewed user's login history                                         |
| `GET /api/user/security-alerts`  | Viewed user's security activity                                     |
| `GET /api/user/2fa/setup`        | Viewed user's 2FA on/off                                            |
| `GET /api/user/2fa/backup-codes` | Viewed user's remaining backup-code **count** (codes never leave)   |
| `GET /api/user/preferences`      | Viewed user's preferences (the page reads only the two alert flags) |

**Proxy bypass.** Six of these forward to operation-service when their flag is on, and the proxy
authenticates **as the caller**, i.e. the admin. In view mode they skip the proxy and use the
monolith Prisma path each route still keeps as its rollback. Same reasoning as the affiliate
view-as.

**Admin API** `app/api/admin/users/view-as/route.ts`: `POST { userId }` starts (origin check,
`requireAdmin()` with its DB re-check, refuses the admin's own id with 400, answers 404 for both
unknown ids and admin accounts so it can't be used to find admins); `DELETE` stops. There's no
search endpoint: `/admin/users` already has name/email search and a tier filter.

**UI** (`components/admin/user-view-as/`): context, banner, `UserViewAsGate` (replaces non-view
settings pages), `ViewAsUserButton`. `app/settings/layout.tsx` resolves the view on the server
and provides it; `settings-nav.tsx` filters its tabs.

## 4. Files

**New:** `lib/admin/user-view-as.ts`, `lib/admin/user-view-as-paths.ts` (client-safe half),
`app/api/admin/users/view-as/route.ts`, `components/admin/user-view-as/{user-view-as-context,
user-view-as-banner,user-view-as-gate,view-as-user-button}.tsx`, and 4 test files:
`__tests__/lib/admin/user-view-as.test.ts`, `__tests__/api/admin-user-view-as.test.ts`,
`__tests__/api/user-view-as-reads.test.ts`, `__tests__/components/admin/user-view-as-ui.test.tsx`.

**Modified:** the 9 routes in §3; `app/settings/{layout.tsx, _components/settings-nav.tsx,
billing/page.tsx, security/page.tsx, security/activity/page.tsx}`;
`app/admin/users/{page.tsx, [id]/page.tsx}`; `__tests__/pages/admin/user-detail.test.tsx`
(LocaleProvider wrapper, see §6).

## 5. Verification

| Check                   | Result                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`      | Clean                                                                                                     |
| ESLint, changed files   | Clean, `--max-warnings 0`                                                                                 |
| Prettier, changed files | Clean                                                                                                     |
| Full `npm run test:ci`  | **236/236 suites · 3055/3055 tests**, twice in a row. Baseline 232/3008, plus exactly 4 suites / 47 tests |
| Mutation checks         | **9/9 caught**, every restore byte-exact by sha256 (table below)                                          |

| Safeguard removed                                 | Tests failing |
| ------------------------------------------------- | ------------- |
| Opt-in ignored (cookie honoured on every request) | 3             |
| Cookie not bound to the admin's id                | 1             |
| Invalid view falls back to the admin's own data   | 4             |
| Admin accounts viewable                           | 2             |
| Login history still proxies in view mode          | 1             |
| Security activity still proxies in view mode      | 1             |
| Receipt links drop the opt-in                     | 1             |
| Billing plan actions shown in view mode           | 1             |
| Gate lets every settings page through             | 1             |

**Live, local `next dev`, signed out:** the admin API (POST and DELETE) and all 9 read routes
with `?view_as=user` return **401**; `/settings/billing` and `/admin/users` redirect to login;
no server errors.

**UI, through a throwaway unauthenticated preview route (deleted, never committed)** that
rendered the real banner, nav, gate and billing page with the API stubbed in the browser:

- every billing request carried `?view_as=user`; the receipt link did too;
- banner, two-tab nav, "Plan actions are hidden" note, no Cancel/Manage, usage count from the
  viewed user;
- turning the view off restored the full nav, Cancel Plan, and requests without the opt-in;
- no horizontal overflow at desktop; the banner fits at 375px.

## 6. Found along the way

- **A test leak I introduced and fixed.** Adding the button to `/admin/users/[id]` meant its test
  needed a `LocaleProvider`. Wrapping it without a seeded locale made the provider fire its real
  geo-IP `fetch`, which outlived the file and crashed **other** suites' teardown at random
  (`Cannot read properties of null (reading '_location')`, in 3 different suites across 2 runs).
  This is `LESSONS-LEARNED.md` L40 again. Seeding the preference fixed it; two clean full runs
  followed.
- **Pre-existing, not fixed:** at 375px the site-wide floating "Support Centre" button makes the
  page wider than the screen. Measured on untouched `/pricing` too (393 vs 375px).
- **Environment:** the dev server again returned 404 for every API route until `.next/dev` was
  cleared (same stale-cache issue as the affiliate view-as session).
- My first prettier run used a glob that reformatted two unrelated auth routes; both were
  restored by hand to their exact previous content. About 40 other files still list as modified
  in `git status`, but their blob hashes equal HEAD (stale stat info only), so they commit as
  nothing.

## 7. Not verified / open

1. **Signed-in admin click-through** on a deployed build: Users → View as user → Billing,
   Security, Security Activity → Switch → Exit, for one FREE and one PRO customer.
2. **Real data under view mode.** Only the Prisma paths were exercised, with mocks. The first
   real view shows whether they match operation-service's output for the same user.
3. **Currency.** Plan prices are formatted in the **admin's** display currency, not the
   customer's. Invoice rows show the exact charged currency, so billing disputes are unaffected.
4. **Audit trail** is server logs only. A durable record needs a table and a migration.
5. **JWT-role lag** (same as the affiliate view-as): a freshly promoted admin can start a view
   (DB-checked) but sees nothing until their token says ADMIN. Fails closed.
6. **Translations:** new strings use `t(key, fallback)`, English only.

**Decided (Davin, 2026-09-24):** in view mode `/api/user/preferences` returns the user's whole
preferences object (country, timezone, language, currency, notification and privacy settings),
although the Security page displays only the two alert switches. Davin confirmed this is
intended: these are not personal information, and they help with investigating customer problems
and with marketing. Personal data that the view does show (name, email, IP addresses, login
locations, card brand/last 4) was reviewed with Davin and kept as is.

## 8. Rollback

Code only: no migration, no environment variables, no other service. Revert the commit. A
leftover cookie is harmless once reverted (nothing reads it) and expires within 2 hours.
