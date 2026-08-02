# Migration Order: User Profile / 2FA / Sessions Domain Extraction (Session 4B-11)

> PRE-DRAFT — raw facts for the Advisor to upgrade into a DRAFT. Not yet reviewed by Davin.

**Session:** 4B-11
**Phase / plan section:** Phase 4B step 11, plan §6 (session playbook line ~326: "alerts CRUD →
drawings + drawing-alerts → notifications → tier (guard) → **user/profile/2FA/sessions** →
market-data channel proxy")
**Target service:** `operation-service` & Next.js Monolith
**Variant:** likely PORT, but see the scope/split flag below — **this domain is roughly 4-5x the
size of Tier (4B-10, 387 lines) and comparable to Alerts CRUD (971 lines, which needed a 3-session
PORT/transport/CUTOVER split, Sessions 4B-5/6/7)** — the Advisor should decide up front whether
4B-11 stays one session or splits the same way.
**Status:** PRE-DRAFT (2026-08-02)
**Flags touched:** not introduced yet — reserved names pending the Advisor's naming decision (see
open question #2 below; likely more than one flag, mirroring Tier/Notifications' single-flag shape
won't fit a domain this size and this varied)

---

## Raw facts (Executor, for the Advisor to upgrade into a DRAFT)

**Open question #1 for the Advisor, not resolved here — a real architectural wrinkle found while
drafting this PRE-DRAFT, not anticipated by the playbook's own one-line phrasing:**
`operation-service` **already has** a `TwoFactorController`/`TwoFactorService`
(`operation-service/src/auth/two-factor.{controller,service}.ts`, 88+414 lines) mapped to
`/auth/2fa/{status,setup,verify-setup,verify,backup-codes,disable}` — built in an earlier session
(likely part of the original Session 3-x auth-bridge work, for operation-service's OWN native
login flow) and confirmed live in production (its routes appear in every recent boot log, e.g.
4B-10's own verification this session). This is a **separate question from whether the monolith's
own `app/api/user/2fa/*` routes (below) implement the SAME feature** (2FA tied to the user's
NextAuth session / dashboard settings) **or a parallel, independent one** (2FA on operation-service's
own native `/auth/login` flow, built for a login path most of the app doesn't use yet — see F7/F24,
Session 3-1/3-2). Before writing any Ordered Steps, this needs a real answer: does 4B-11 REUSE the
existing `TwoFactorService`, or does the monolith's dashboard-facing 2FA need its own, separate port
because the underlying secret/backup-code storage or session model differs? Reading both sides'
Prisma models (`User.twoFactorSecret`/`backupCodes` fields, however they're actually named) before
drafting Ordered Steps would resolve this — not done here, flagged for the Advisor/DRAFT stage.

**Open question #2:** given the domain's real size (14 files, 2060 lines — see below), should this
be one PORT+CUTOVER session (Tier/Notifications/Drawings' combined shape) or split into multiple
sessions by sub-domain (e.g., profile+preferences, then 2FA, then sessions+login-history, then
account-deletion) the way Alerts CRUD split into PORT/transport/CUTOVER? Account deletion and 2FA
in particular are security-sensitive enough that a VERIFY-heavy, low-creativity-dial approach seems
warranted regardless of the split decision.

**SOURCE candidates (14 files, 2060 lines total, re-verify at DRAFT/CONFIRM — these are this
session's own fresh `wc -l` counts):**

- `app/api/user/profile/route.ts` (177 lines) — profile read/update.
- `app/api/user/preferences/route.ts` (147 lines) — user preferences (theme, language, etc. —
  overlaps with `settings/appearance`, `settings/language` pages; not yet checked whether those
  pages call this route or a different one).
- `app/api/user/password/route.ts` (170 lines) — password change.
- `app/api/user/login-history/route.ts` (143 lines) — read-only.
- `app/api/user/sessions/route.ts` (99 lines) + `app/api/user/sessions/[id]/route.ts` (66 lines) —
  list/revoke active sessions; likely reads/writes the `RefreshToken` table hardened in Session
  3-2 — re-check that hardening (hashed-at-rest, revocable) is preserved if ported.
- `app/api/user/2fa/setup/route.ts` (140), `verify/route.ts` (180), `verify-setup/route.ts` (185),
  `backup-codes/route.ts` (188), `disable/route.ts` (190) — 883 lines total, the largest single
  chunk of this domain. See open question #1 above before treating this as a normal PORT.
- `app/api/user/account/deletion-request/route.ts` (107), `deletion-confirm/route.ts` (133),
  `deletion-cancel/route.ts` (135) — 375 lines total. Note: F21 (24h Account-Deletion GDPR gap,
  hard-delete vs. anonymize) is still OPEN in `DECISION-LOG.md`, unresolved since Session 2-4 —
  this needs Davin's product decision before (or as part of) this session, not silently assumed
  either way.

**Established transport pattern (reuse, don't reinvent):** `forwardRequestToOperationService()`
(`lib/operation-service/write-routes.ts`) + `getOperationServiceToken()`
(`lib/operation-service/client.ts`) + new `shouldUseOperationServiceFor...()` reader(s) in
`lib/operation-service/flags.ts`, matching every prior slice's shape (Tier, Notifications,
Drawings, Alerts).

**Not checked this session, flag for DRAFT/CONFIRM:**

- Whether `operation-service`'s existing `AuthController`/`AuthService` (506 lines) already
  duplicates any of the profile/password logic below it — not read in full this session.
- Whether any of these 14 routes are referenced by other monolith code (crons, admin pages) beyond
  their own settings-page UI callers — not audited, same class of gap 4B-9's own PRE-DRAFT flagged
  for Notifications (which turned out to matter there).
- F21 (Account-Deletion GDPR gap) needs resolving before or during this session — it's been open
  since Session 2-4 and this is the first session that actually touches account-deletion code.
- Real production traffic exposure: unlike Tier/Notifications/Drawings, this domain includes
  password changes, 2FA, and account deletion — genuinely security-sensitive, not just read-mostly
  dashboard data. Escalation triggers in `EXECUTOR-PROTOCOL.md` §7 ("auth semantics", "security... beyond the order's explicit steps") likely apply more heavily here than to any 4B session so far.

---

## Candidate steps (Advisor to confirm/adjust once open questions #1-#2 are resolved)

0. Resolve open question #1 (does `TwoFactorService` get reused or does 2FA need its own port) and
   open question #2 (one session or split by sub-domain), and F21 (account-deletion GDPR).
1. Port whichever sub-domains Step 0 scopes in — likely `UserProfileService`/`Controller`
   (profile+preferences+password), a `SessionsController` (sessions+login-history), and either a
   reused or new 2FA path, plus account-deletion (gated on F21).
2. Unit tests + module registration.
3. Monolith forwarding layer + flag wiring (likely more than one flag given the sub-domain split).
4. Deploy + Davin live-approval checkpoint + cutover + live smoke test — mind Session 4B-9's own
   incident (verify REAL HTTP status codes via a real e2e spec for any POST/PATCH/DELETE handler,
   not just a controller-construction unit test).

---

## Deviations

_(none yet — PRE-DRAFT, not executed)_
