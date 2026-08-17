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

_(Append here per row: what was wrong, what changed, file(s) touched.)_
