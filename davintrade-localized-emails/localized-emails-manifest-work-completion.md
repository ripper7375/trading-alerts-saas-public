# Localized E-mails — Work Completion Manifest

|               |                                                                                                                                                                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Request**   | Davin, 2026-10-20, in chat: the e-mails Resend sends (sign-in alerts, account deletion, and the rest) are all in English; make every one follow the language and the locale formats the specific user selected.                                                          |
| **Goal**      | Every e-mail the app sends is written in the recipient's own language, timezone, date format, time format and number format.                                                                                                                                             |
| **Branch**    | `main` at `de61737e`, working tree. **Not committed, not pushed, not deployed.**                                                                                                                                                                                         |
| **Migration** | **None.** No schema change. The language is kept in the existing `UserPreferences.preferences` JSON (`language`, `timezone`, `dateFormat`, `timeFormat`, `currency`).                                                                                                    |
| **Status**    | Built and verified locally (types, lint, Prettier, full monolith suite, full `operation-service` suite, production build, a visual check of rendered e-mails). **Not verified:** a real Resend delivery, a signed-in click-through, the translations by a native reader. |

---

## 1. What was found

- **Two senders, both English only:** `lib/email/email.ts` + `subscription-emails.ts` (the monolith) and
  `operation-service/src/email/` (its own deploy, an older copy that had drifted). Which one runs depends on the
  `MIGRATE_*` flags, so both had to change.
- **The sign-in e-mail** is the new-device alert (`POST /api/auth/track-login` → `sendNewDeviceAlert`).
- **Account deletion:** only **one** e-mail exists, the "confirm or cancel" request (operation-service
  `UsersService.requestDeletion`). The "deletion confirmed" and "deletion cancelled" e-mails are `TODO`s in the
  code (`deletion-confirm/route.ts`, `deletion-cancel/route.ts`, `UsersService.confirmDeletion`): they do not exist
  yet, so nothing could be translated. See §6.
- The previous locale work (`davintrade-language-and-locale-format-fix`, §3.4) had left e-mails out on purpose
  ("no viewer whose settings could apply"); that note now points here.

## 2. How it works

**One pure folder, `lib/email/i18n/`:** a typed catalog per locale (`messages/<locale>.ts`, all 19 locales of
`lib/i18n/languages.ts`; `en-US` is the source and a missing key in any other fails `tsc`), `catalog.ts` (lookup with a
per-key English fallback, escaping), `format.ts` (date, time and USD), `layout.ts` + `templates.ts` (the HTML builders
for every live e-mail). `operation-service/src/email/i18n/` is a **byte-for-byte copy** (that service deploys on its
own); `__tests__/lib/email/i18n/mirror.test.ts` fails on any difference.

**Which locale, field by field:** (1) what the person saved in Settings → Language & Region, (2) the `davintrade-*`
cookies and IP timezone of the request that triggered the mail, (3) English and UTC (what every e-mail was before).
The saved choice comes first on purpose: a sign-in alert or a reset link goes to the account owner, and the browser
that triggered it may be someone else's.

**Formats:** with saved formats the time reads exactly like the same time on screen (`23/10/2026 16:30 GMT+7`, the
app's own formatter semantics); with none, the date is written out in the reader's language (`23. Oktober 2026`).
Latin digits and the Gregorian calendar always (Thai would otherwise print 2569). **Money stays USD** (it is what is
charged), written in the reader's number format (`35,00 $`, `US$35.00`); English keeps the bare `$`.

**Right-to-left:** Arabic and Urdu get `dir="rtl"`, sides swapped in tables and lists, and Latin / numeric values
isolated with `<bdi>` so a time is not reflowed inside an Arabic sentence.

**Keeping the saved choice current** (the mail no request triggers, a Stripe receipt or a commission notice, can only
read what is saved, and most people never press Save):

1. `syncLocaleCookiesAction` takes `saveToAccount`; `LocaleProvider` sets it only for the user's own choices (header
   country, language modal, Settings), never for detection.
2. `POST /api/auth/track-login` saves the browser's language **once, if the account has none**; it never overwrites.

**operation-service** has no request cookies, so the monolith forwards the reader's locale as `x-email-language`,
`x-email-formats`, `x-email-timezone` (`forwardedRequestContext()`; the three `token-*` e-mail routes forward only
these three, not the IP or user agent). `EmailLocaleContextMiddleware` keeps them per request;
`EmailLocaleService` registers a resolver with the senders at start-up, so no caller changed.

## 3. The e-mails, now localized (19 locales each)

Welcome · affiliate welcome · verify e-mail · reset password · **new-device sign-in alert** · password changed ·
2FA enabled · 2FA disabled · **account deletion confirm / cancel** · subscription confirmed · subscription cancelled
(now / at period end) · payment failed · payment receipt · affiliate commission.

## 4. Files

**New:** `lib/email/i18n/**` (25 files), `lib/email/recipient-locale.ts`, `operation-service/src/email/i18n/**` (copy),
`operation-service/src/email/{email-locale.context,email-locale.service,email.module,recipient-locale}.ts`, and their
specs; `__tests__/lib/email/i18n/{catalog,languages,format,templates,mirror}.test.ts`,
`__tests__/lib/email/{recipient-locale,email-senders}.test.ts`,
`__tests__/lib/operation-service/forwarded-request-context.test.ts`, `__tests__/api/auth/track-login.test.ts`.

**Changed:** `lib/email/email.ts`, `lib/email/subscription-emails.ts`, `operation-service/src/email/email.util.ts`,
`.../subscription-email.util.ts`, `operation-service/src/app.module.ts`, `lib/operation-service/client.ts`,
`app/actions/locale.ts`, `lib/context/locale-context.tsx`, `app/api/auth/track-login/route.ts`, the three
`app/api/auth/token-{forgot-password,resend-verification,verify-email}/route.ts`, `lib/stripe/webhook-handlers.ts`
(one argument, see §5); docs: policy `08-locale-i18n-compliance.md` §2.D, `.claude/rules/i18n-compliance.md`,
`.claude/architecture/environment-gotchas.md`.

**Untouched on purpose:** `frontend/` (a stale pre-V8 snapshot), `seed-code/`.

## 5. Deviations and things to look at

1. **`lib/stripe/webhook-handlers.ts` (payments file) changed by one argument:** the commission e-mail now receives
   `breakdown.commissionPercent`, the rate the commission was computed with. Its text used to say a fixed "20%"
   (a figure the SystemConfig guard exists to prevent). Without a rate the line is **left out**, not guessed. No payment
   logic was touched. This is the one place that brushes non-negotiable 5; it needs Davin's eye.
2. **E-mail HTML is now escaped.** The old templates interpolated the name raw (a test asserted it). Every value is
   escaped now; that test was changed. `<html>` is now `<html lang="…">` (that test too).
3. **operation-service still prints the list price** it always did (PRO $29 / $290, "payment failed" $29): its
   outbox events carry no price, and the monolith's copy reads SystemConfig. Pre-existing and unchanged; the
   SystemConfig guard does not scan `operation-service/`. Worth its own order.
4. **A `UserPreferences` row can now appear at sign-in** (`rememberAccountLocaleIfAbsent`). `GET /api/user/preferences`
   treats a user with a row as having chosen (it skips the geo-IP default for `countryCode`). Nothing reads that
   `countryCode` back for locale today (the Settings page edits the live locale), but note it.
5. **The three `token-*` e-mail routes** (not wired into any form yet) forward the locale headers only.
6. Three templates with **no caller** (alert triggered, trial reminder, upgrade prompt) stay English; the file says so.

## 6. Not done / follow-ups

- **Translations are drafts no native reader has seen** (like the chat panel's). They need a read before anyone relies
  on them for legal, billing or account-deletion wording.
- **"Deletion confirmed" and "deletion cancelled" e-mails do not exist** (§1). Adding them is a new feature (two
  templates in 19 languages, a send at confirm and at cancel, and a decision on what they may say before the 24 h
  worker runs).
- PDF receipts (`lib/auth/session-tracker.ts` too) are still not localized.
- No real Resend delivery was sent; Resend has no per-locale setting, so none is needed.

## 7. Verification

- `npx tsc --noEmit` (root) clean; `operation-service` `tsc --noEmit` clean.
- `eslint` on every changed file clean; `prettier --check` on every changed file clean.
- Full monolith Jest: **573 suites passed, 5 skipped, 0 failed; 19,303 tests passed** (run before the last small
  additions; every suite they touch was re-run after: `__tests__/lib/email`, `__tests__/api/auth`,
  `__tests__/lib/operation-service`, `__tests__/lib/context`, `__tests__/app/actions`).
- `operation-service` Jest: **63 suites, 627 tests, all passed** (11 of those suites only run after the local types
  package is built: see the environment gotchas).
- New tests: the catalog (every locale: keys, placeholders, bold markers, no HTML, translated not English), formats
  (equal to the app's own formatter on a 30-case matrix), every e-mail × all 19 locales, escaping, right-to-left,
  the recipient lookup, the sign-in capture, the forwarded headers, the mirror.
- Visual: rendered Thai (sign-in alert), Arabic (password changed, right-to-left), German (receipt), Spanish and
  English samples in the browser pane; the one defect found there (the Arabic time reflowed) is fixed and tested.

## 8. Rollback

Revert the commit. No migration, no flag. The `language` values already saved in `UserPreferences.preferences` are
inert without this code. The two services are independent: either can be deployed first (a new operation-service with
an old monolith sends English unless the person saved a language; a new monolith with an old operation-service just
sends headers the old one ignores).
