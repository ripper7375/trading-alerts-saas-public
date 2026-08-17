# Batch 1 — Auth & Account-Token Pages

> Part of the Codebase 2 ↔ Codebase 1 parity audit. Read `00-MASTER-PLAN.md` first for the
> two rules, known exceptions, hard constraints, and the screenshot-path convention — this
> file only covers what's specific to this batch. Requires Batch 0 to have landed first
> (shared header/sidebar/providers).

## Scope

9 pages: login, register, password recovery, 2FA verification, email verification, and the
two public token-based account-deletion pages. Route groups: `app/(auth)/*` plus
`app/account/*` in Codebase 2.

## Rows

| No. | Page Name                                | Route                       | Codebase 1 file                                                                                                                                                                                        | Codebase 2 file                            |
| --- | ---------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| 3   | Cancel Account Deletion (public, token)  | `/account/deletion-cancel`  | _(API-only in C1 — check for a page at `app/account/deletion-cancel/page.tsx` before concluding there's no UI counterpart; evidence column points at `app/api/user/account/deletion-cancel/route.ts`)_ | `app/account/deletion-cancel/page.tsx`     |
| 4   | Confirm Account Deletion (public, token) | `/account/deletion-confirm` | _(same caveat — evidence points at `app/api/user/account/deletion-confirm/route.ts`)_                                                                                                                  | `app/account/deletion-confirm/page.tsx`    |
| 65  | Forgot Password Page                     | `/forgot-password`          | `app/(auth)/forgot-password/page.tsx`                                                                                                                                                                  | `app/(auth)/forgot-password/page.tsx`      |
| 67  | Login Page                               | `/login`                    | `app/(auth)/login/page.tsx`                                                                                                                                                                            | `app/(auth)/login/page.tsx`                |
| 71  | Register Page                            | `/register`                 | `app/(auth)/register/page.tsx` (evidence column points at `components/auth/register-form.tsx` — the form component, check both)                                                                        | `app/(auth)/register/page.tsx`             |
| 72  | Reset Password Page                      | `/reset-password`           | `app/(auth)/reset-password/page.tsx`                                                                                                                                                                   | `app/(auth)/reset-password/page.tsx`       |
| 88  | Verify 2FA Page                          | `/verify-2fa`               | `app/(auth)/verify-2fa/page.tsx`                                                                                                                                                                       | `app/(auth)/verify-2fa/page.tsx`           |
| 89  | Verify Email Pending Page                | `/verify-email/pending`     | `app/(auth)/verify-email/pending/page.tsx`                                                                                                                                                             | `app/(auth)/verify-email/pending/page.tsx` |
| 90  | Verify Email Page                        | `/verify-email`             | `app/(auth)/verify-email/page.tsx`                                                                                                                                                                     | `app/(auth)/verify-email/page.tsx`         |

(Codebase 1 paths are relative to the repo root, e.g. `app/(auth)/login/page.tsx` →
`d:/SaaS Project/trading-alerts-saas-public/app/(auth)/login/page.tsx`.)

## Batch-specific notes

- Rows 3/4's evidence columns point at API routes, not pages — Codebase 1 may genuinely have
  no UI page for these (token-link landing pages that just show a confirmation message could
  be rendered by a route handler + redirect, or a thin page). Check the actual `app/account/`
  tree in Codebase 1 first; if there really is no page there, these two rows fall under the
  same "no C1 counterpart, Rule 1 N/A, Rule 2 still applies" treatment as rows 57/58/94/95 in
  `00-MASTER-PLAN.md` §2 — note that explicitly in your findings rather than guessing at a
  structure to match.
- Password/secret-visibility toggle buttons on these forms were the subject of a documented
  accessibility fix in Codebase 1 (icon-only buttons need `aria-label`, no `tabIndex={-1}`) —
  worth checking Codebase 2's equivalents have the same accessibility baseline, since that's
  a "core interactive element" concern under Rule 1, not just cosmetic.
- Compare form field sets exactly: Codebase 1's register form's tier-selection step, any
  password-strength meter, "remember me," social-login buttons (if any) — all must be present
  in Codebase 2's register/login flow even if visually restyled to DavinTrade tokens.

## Findings

**Verification:** `npx tsc --noEmit` clean; `npx next build` succeeded (all 88 routes,
including all 9 rows in this batch). Live-verified the 5 changed pages in the dev server
(`npm run dev -p 3009` inside `seed-code/trading-conversational-ai-ui-pages-increment`):
password toggles flip input type + accessible name correctly, register form's strength
checklist/confirm-password-mismatch/referral-code-verify all update live and correctly,
forgot-password's new Resend/Try Another buttons render post-submit, and
`/verify-email/pending?email=...` now decodes and displays the URL email. No console errors.

### Row 3 — Cancel Account Deletion (`/account/deletion-cancel`)

**Rule 1:** N/A. Walked Codebase 1's actual `app/account/` tree directly — it doesn't exist
at all in Codebase 1; only `app/api/user/account/deletion-cancel/route.ts` (API route, no
page) exists. Same "no C1 counterpart" treatment as rows 57/58/94/95 per Master Plan §2.
**Rule 2:** Reviewed — already fully DavinTrade-compliant (amber/emerald/rose accents,
`bg-[#050609]`/`bg-[#090b14]` dark surfaces, DavinTrade AI branding, no Trading-Alerts
leftovers). No violations found.
**Changes:** None. **Files touched:** None.

### Row 4 — Confirm Account Deletion (`/account/deletion-confirm`)

Same situation as row 3 — Codebase 1 has no UI page, only
`app/api/user/account/deletion-confirm/route.ts`. Rule 2 reviewed, already
DavinTrade-compliant. **Changes:** None. **Files touched:** None.

### Row 65 — Forgot Password Page

**Rule 1 gap:** Codebase 1's confirmation step (`ConfirmationStep` in
`app/(auth)/forgot-password/page.tsx`) offers a "Resend Email" button and a "Try Another
Email" button after the reset email is sent. Codebase 2's confirmation state only offered
"Return to Sign In" — both flow-step actions were missing entirely.
**Fix:** Added a "Resend Email" button (mocked spinner) and a "Try Another Email" button
(resets back to the email-entry step) to the confirmation card, alongside the existing
"Return to Sign In" button.
**Note:** Codebase 1's forgot-password page also contains an embedded token-based reset step
(`ResetPasswordStep`), but that code path's own comments flag it as dead/unreachable in C1
("nothing links to /forgot-password?token=... in practice") — the real password-reset UX
lives at the separate `/reset-password` route (row 72), which both codebases already
implement as its own page. Not replicated here, matching C1's own documented reality rather
than inventing a structure to match.
**Files touched:** `app/(auth)/forgot-password/page.tsx`

### Row 67 — Login Page

**Rule 1 gaps** (component: `components/auth/login-form.tsx`):

1. No password show/hide toggle at all — Codebase 1's `login-form.tsx` has an `Eye`/`EyeOff`
   toggle button with `aria-label`. Missing entirely in Codebase 2.
2. No Social Sign-In section — Codebase 1 renders `<SocialAuthButtons />` (Google + X) below
   the form. Codebase 2 had no equivalent at all.

**Fix:** Added a password show/hide toggle with `aria-label="Show password"`/`"Hide
password"` (live-verified — toggles input type and accessible name). Added a new shared
`components/auth/social-auth-buttons.tsx` — Codebase 2 has no `next-auth`/OAuth backend in
this frontend-only increment (confirmed: no `next-auth` in `package.json`), so the buttons
mirror the mocked-success pattern the rest of the auth flow already uses (brief loading
state, then redirect) rather than being dead/non-functional — and wired it in below a new
"OR" divider.
**Files touched:** `components/auth/login-form.tsx`,
`components/auth/social-auth-buttons.tsx` (new)

### Row 71 — Register Page

**Rule 1 gaps** (component: `components/auth/register-form.tsx`) — the largest gap in this
batch. Against Codebase 1's `register-form.tsx`, the following fields/elements that exist in
C1 were entirely missing from C2:

1. Password show/hide toggle (Eye/EyeOff + `aria-label`).
2. **Confirm Password field** — not present at all; no password-confirmation step existed.
3. **Password requirements checklist** — the live 5-check list (min length, uppercase,
   lowercase, number, special character) shown as the user types.
4. **Referral Code field** — explicitly flagged in Codebase 1's own source comment as
   "Business Critical Feature"; C2 had no referral input, Verify button, or discount
   messaging at all.
5. **Terms of Service / Privacy Policy agreement checkbox** — required in C1 (blocks submit
   until checked); entirely absent in C2, so the form could submit with no ToS/Privacy
   acknowledgment.
6. Social Sign-Up section (Google + X), same gap as login.

**Fix:** Rebuilt the form to include all six items above, styled to the existing DavinTrade
amber/slate dark tokens already used by the name/email/password fields (no
Codebase-1-styling carried over). Referral verification is mocked client-side using the same
rule C1 itself uses (`code.startsWith('REF-') && code.length >= 10`) since neither codebase's
frontend increment has a real `/api/affiliate/verify-code` backend; discount price uses the
existing `formatCurrency` from `useLocale()` rather than C1's `useAffiliateConfig` hook, which
doesn't exist in Codebase 2 (confirmed via grep — no backend `SystemConfig` to read from).
Submit is blocked client-side with an inline error until password requirements are met,
passwords match, and terms are agreed. Live-verified: strength checklist updates live,
confirm-password mismatch warning appears/clears correctly, referral code
`REF-ABC123XYZ` verifies and shows the discounted price (20% off).
**Files touched:** `components/auth/register-form.tsx`,
`components/auth/social-auth-buttons.tsx` (new, shared with login)

### Row 72 — Reset Password Page

**Rule 1 / accessibility gaps:**

1. The existing password show/hide toggle button had **no `aria-label`** — an icon-only
   button, exactly the accessibility defect class this batch's own notes call out.
2. The Confirm Password field had **no toggle of its own** — it silently reused the primary
   password field's `showPassword` boolean (toggling "New Password" visibility also flipped
   "Confirm New Password", with no independent control or icon on the confirm field).
3. **No password requirements checklist** — Codebase 1's `reset-password/page.tsx` shows the
   same live 5-check list; Codebase 2 had none.

**Fix:** Added `aria-label` to the existing toggle. Gave Confirm Password its own
`showConfirmPassword` state and toggle button with its own `aria-label`. Added the 5-check
password requirements list under the password field. Added a "Passwords do not match" inline
message under Confirm Password (C1 surfaces this via its Zod resolver; C2 has no
form-validation library wired up on this page, so this is a lightweight equivalent).
Live-verified: both toggles report correct accessible names and independently control their
own field; checklist updates live as the password is typed.
**Files touched:** `app/(auth)/reset-password/page.tsx`

### Row 88 — Verify 2FA Page

Reviewed both sides in full. Codebase 1 uses 6 separate per-digit boxes with
auto-focus/auto-advance/paste/auto-submit; Codebase 2 uses a single text input capped at 6/9
characters. This is a Rule-2 styling/interaction variant, not a missing element — every C1
flow step (enter code, verify, switch to backup code, back to login) exists and works in C2.
Also compared C1's "already authenticated" / "no active challenge" branches, which gate on a
real `next-auth` `useSession()`; Codebase 2 has no session/auth backend in this frontend-only
increment (confirmed: no `next-auth` dependency in `package.json`), so there is no live
session state to branch on — the same "mocked frontend, no backend" situation the Master Plan
already carves out elsewhere, not a like-for-like gap. No changes made.
**Files touched:** None.

### Row 89 — Verify Email Pending Page

**Rule 1 gap:** Codebase 1's page reads the `?email=` query parameter (the real
register-flow redirect target, `/verify-email/pending?email=<encoded>`) and
displays/pre-fills it, with a "Wrong email?" link to switch to manual entry. Codebase 2's
page ignored the query parameter entirely and always started with a blank, always-editable
email input — breaking the handoff for any flow that links to this page with an email (a
future register-form wiring, or a login error's "resend verification" link, both of which
pass `?email=` in Codebase 1).
**Fix:** Added `useSearchParams()` (wrapped in `Suspense`, matching this codebase's existing
convention for other pages that read search params) to read and decode the `email` param;
when present, displays it as read-only text with a "Wrong email?" toggle back to the editable
input, matching C1's exact UX. Also removed two pre-existing unused imports (`ArrowRight`,
`CardContent`) while rewriting the file. Live-verified: navigating to
`/verify-email/pending?email=ripper7375%40gmail.com` correctly decodes and displays the
email.
**Files touched:** `app/(auth)/verify-email/pending/page.tsx`

### Row 90 — Verify Email Page

Reviewed in full against Codebase 1. Already has loading/success/error states, a "Request
New Verification Link" retry action, and a "Back to Login" action — every interactive
element/flow step present in C1 exists and works in C2 (restyled to DavinTrade tokens). No
gaps found, no changes made.
**Files touched:** None.
