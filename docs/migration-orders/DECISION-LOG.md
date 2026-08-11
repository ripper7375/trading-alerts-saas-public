# Decision Log — Flag Resolutions & Material Decisions

**What this is:** the append-only record of every flag resolution (F1–F19) and every
material decision made during the migration. The flag _register_ (what each flag asks) lives
in the plan §11; this file records _how each was resolved, by whom, with what evidence_.
The Executor writes entries at session close; Davin's sign-off is quoted where required.

**Entry format:**

```
## <ID> — <short title>
- Status: OPEN | RESOLVED | SUPERSEDED
- Session: <P-N where resolved>  ·  Date: <yyyy-mm-dd>
- Decision: <what was decided>
- Evidence: <commands run, docs read, URLs fetched, test results>
- Approved by: <Davin | n/a (technical, within bounds)>
```

---

## Flag register status (details in plan §11)

| Flag | Topic                                                                                                                                                                                                                                                                                                                                     | Status                                                                                                                                                                                                                                                                                                                       |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1   | OpenAPI coverage from live routes                                                                                                                                                                                                                                                                                                         | RESOLVED — fully closed, Session 0-3                                                                                                                                                                                                                                                                                         |
| F2   | Pin next@16.2.10 / @nestjs/core@11.1.28                                                                                                                                                                                                                                                                                                   | RESOLVED — Session 0-1                                                                                                                                                                                                                                                                                                       |
| F3   | Where does the monolith's Postgres live?                                                                                                                                                                                                                                                                                                  | RESOLVED — Session 1-1 (on Railway, different instance than railway-gateway)                                                                                                                                                                                                                                                 |
| F4   | Full model census for schema split                                                                                                                                                                                                                                                                                                        | RESOLVED — Session 2-2                                                                                                                                                                                                                                                                                                       |
| F5   | Prisma file-layout strategy                                                                                                                                                                                                                                                                                                               | RESOLVED — Session 2-2                                                                                                                                                                                                                                                                                                       |
| F6   | Auth strategy: bridge vs OpenAuth vs hand-rolled                                                                                                                                                                                                                                                                                          | OPEN — due Session 3-1 (Davin)                                                                                                                                                                                                                                                                                               |
| F7   | HS256 shared secret vs JWKS + rotation timing                                                                                                                                                                                                                                                                                             | OPEN — due Session 3-1 (Davin)                                                                                                                                                                                                                                                                                               |
| F8   | Realtime/websocket architecture                                                                                                                                                                                                                                                                                                           | RESOLVED — Session 4B-17 (Davin): operation-service's existing HTTP process, real socket.io-client/socket.io, alert-fired scope only, NextAuth-JWE handshake auth                                                                                                                                                            |
| F9   | @trading-alerts/types packaging mechanics                                                                                                                                                                                                                                                                                                 | RESOLVED — Session 4B-1 (pnpm workspace for the monolith, `file:` dependency for operation-service/money-service; Railway deploy-time resolution for operation-service still open, see F9's own entry)                                                                                                                       |
| F10  | Next.js 15→16 breaking-change audit                                                                                                                                                                                                                                                                                                       | RESOLVED — Session 5-1                                                                                                                                                                                                                                                                                                       |
| F11  | Frontend gap matrix — enumeration DELIVERED 2026-08-10, re-verified and matrix produced at Session 6-1 (`phase-6-frontend-gap-matrix.md`); row-by-row triage still outstanding                                                                                                                                                            | RESOLVED — Session 6-12 (Davin): all 59 gap-matrix rows (deduplicated from the 90-row source register) triaged as BUILT / VERIFIED / OUT_OF_SCOPE across Sessions 6-1..6-11                                                                                                                                                  |
| F12  | Whole-plan duration estimate                                                                                                                                                                                                                                                                                                              | OPEN — revisit after F1–F5                                                                                                                                                                                                                                                                                                   |
| F13  | Observability/tracing backend                                                                                                                                                                                                                                                                                                             | RESOLVED — Session 4B-4 (Davin): Option C (OTel SDK + OTLP Exporter + Pino Correlation Logging)                                                                                                                                                                                                                              |
| F14  | Tier-update: outbox vs direct call                                                                                                                                                                                                                                                                                                        | RESOLVED — Session 4A-8 (Transactional Outbox, `OutboxEvent`; publisher built but gated OFF, real delivery target is Slice 5 / 4A-11-12)                                                                                                                                                                                     |
| F15  | Redis topology/namespacing                                                                                                                                                                                                                                                                                                                | RESOLVED — Session 4A-1 (Davin)                                                                                                                                                                                                                                                                                              |
| F16  | Public URL scheme + /v1 versioning                                                                                                                                                                                                                                                                                                        | RESOLVED — Session 4A-1 (Davin)                                                                                                                                                                                                                                                                                              |
| F17  | Staging data strategy                                                                                                                                                                                                                                                                                                                     | RESOLVED — Session 0-5 (Davin)                                                                                                                                                                                                                                                                                               |
| F18  | RPO/RTO targets                                                                                                                                                                                                                                                                                                                           | RESOLVED — Session 1-1 (RPO gap: automated-backup cadence unverified, dashboard-only)                                                                                                                                                                                                                                        |
| F19  | Prisma 6.19.2→7.8.0 breaking-change audit                                                                                                                                                                                                                                                                                                 | RESOLVED — Session 2-1                                                                                                                                                                                                                                                                                                       |
| F20  | Production migration history unbaselined                                                                                                                                                                                                                                                                                                  | RESOLVED — Session 2-3 (drop_watchlists stripped-and-orphaned per Davin; other 5 baselined; FK audit applied)                                                                                                                                                                                                                |
| F21  | 24h Account-Deletion GDPR gap                                                                                                                                                                                                                                                                                                             | OPEN — found Session 2-3, requires Davin's product decision (hard-delete vs anonymize), scheduled for a future session                                                                                                                                                                                                       |
| F22  | lib/affiliate/constants.ts breaks `npm run build` (pre-existing, likely live)                                                                                                                                                                                                                                                             | RESOLVED — Session 2-4 (same-session follow-up, Davin's explicit go-ahead)                                                                                                                                                                                                                                                   |
| F35  | money-service crons Slice 1 shadow-run mechanism, given CC-A/F34 not yet built                                                                                                                                                                                                                                                            | RESOLVED — Session 4A-2 (Davin)                                                                                                                                                                                                                                                                                              |
| F44  | Read-API (Slice 3) shadow-run mechanism, given CC-A/F34 still not built                                                                                                                                                                                                                                                                   | RESOLVED — Session 4A-7a (Davin)                                                                                                                                                                                                                                                                                             |
| F45  | Browser → money-service transport, given NextAuth's cookies are `httpOnly`                                                                                                                                                                                                                                                                | RESOLVED — Session 4A-7a (Davin) · auth-semantics decision, EXECUTOR-PROTOCOL §7                                                                                                                                                                                                                                             |
| F46  | Schema-vs-transport failure classification at the first authenticated read                                                                                                                                                                                                                                                                | RESOLVED — 2026-07-25 (Davin, pre-registered ahead of Session 4A-7a)                                                                                                                                                                                                                                                         |
| F36  | Wise integration model: Business + personal token vs Platform Enterprise partnership                                                                                                                                                                                                                                                      | RESOLVED — Session 4A-W1 (Davin): Model A — Business + personal token                                                                                                                                                                                                                                                        |
| F37  | Wise funding mode (`MANUAL`/`API`) given the account-region gate                                                                                                                                                                                                                                                                          | RESOLVED — Session 4A-W1 (Davin): `MANUAL`, Thailand is not on Wise's API-funding allowlist                                                                                                                                                                                                                                  |
| F38  | Wise fee bearer + quote amount direction (`sourceAmount` vs `targetAmount`)                                                                                                                                                                                                                                                               | RESOLVED — Session 4A-W2 (Davin): Option A — Platform bears the fee (`feeBearer = 'PLATFORM'`)                                                                                                                                                                                                                               |
| F39  | Wise recipient-details collection surface (affiliate self-service vs admin-entered)                                                                                                                                                                                                                                                       | RESOLVED — Session 4A-W3a (Davin): Option A — Affiliate self-service form (`/affiliate/settings/payout`)                                                                                                                                                                                                                     |
| F40  | Wise webhook subscription level (profile vs application) — dependent on F36                                                                                                                                                                                                                                                               | RESOLVED — Session 4A-W5 (Davin): Profile-level subscription (`WISE_WEBHOOK_SCOPE = 'PROFILE'`), following Model A                                                                                                                                                                                                           |
| F41  | Wise recipient PII retention/deletion; interacts with F21                                                                                                                                                                                                                                                                                 | RESOLVED — Session 4A-W3a (Davin): Option A — Wise-managed PII + local hash/tail only (`accountTail` & SHA-256 fingerprint)                                                                                                                                                                                                  |
| F42  | RiseWorks archival depth (archive vs delete)                                                                                                                                                                                                                                                                                              | RESOLVED — 2026-07-25 (Davin): archive, never delete; restorable                                                                                                                                                                                                                                                             |
| F43  | Funding-SLA alert channel: how to notify Davin when a batch group nears Wise's 14-day expiration unfunded (Slack webhook / Discord webhook / monolith email proxy) — money-service has no email capability of its own                                                                                                                     | RESOLVED — Session 4A-W6 (Davin): Option (a), Resend REST direct, no new dependency                                                                                                                                                                                                                                          |
| F47  | Wise quote `targetAmount`/currency-unit correctness for non-USD payouts (interacts with F38's already-RESOLVED fee-bearer decision)                                                                                                                                                                                                       | OPEN — found Session 4A-W7, due before any further non-USD Wise payout                                                                                                                                                                                                                                                       |
| F48  | dLocal outbound payment-creation request signing is wrong (pre-existing, both monolith and money-service)                                                                                                                                                                                                                                 | RESOLVED — Session 4A-10c (2026-07-30): corrected `Authorization`/`X-Login`/`X-Trans-Key` to dLocal's real `V2-HMAC-SHA256` scheme, verified live (dLocal now returns `400` payload-validation, not `403` credential rejection)                                                                                              |
| F49  | dLocal outbound payment-creation request body is missing the required `payment_method_flow` field (pre-existing, both monolith and money-service; was masked by F48)                                                                                                                                                                      | OPEN — found Session 4A-10c, blocks Group B (dLocal) of Slice 4's write-API cutover; full detail in `history/decisions-archive.md`                                                                                                                                                                                           |
| F50  | `COMMISSION_CREDITED` outbox event's `aggregateId` resolves to the wrong recipient (the paying subscriber, not the affiliate)                                                                                                                                                                                                             | OPEN — found Session 4A-11, non-blocking (this eventType deliberately skipped rather than emailed to the wrong person); full detail in `history/decisions-archive.md`                                                                                                                                                        |
| F51  | Slice 5 cutover wait-clock: no shadow-run mechanism exists                                                                                                                                                                                                                                                                                | RESOLVED — Session 4A-11 (Davin): no formal wait-clock, same resolution as F44                                                                                                                                                                                                                                               |
| F52  | `market_data_v6` was never actually created in production; its own migration was baselined with zero applied steps                                                                                                                                                                                                                        | RESOLVED — ad-hoc repair session 2026-08-02 (Davin present): table created via reviewed/approved DDL, verified via raw SQL and a real Prisma query, Slice 12 cutover retried and succeeded live                                                                                                                              |
| F53  | `RealtimeGateway`'s CORS `origin` array-vs-wildcard-string bug blocks every real cross-origin browser connection                                                                                                                                                                                                                          | RESOLVED — Session 4B-18b (2026-08-03): fixed and verified via a real cross-origin preflight probe; live browser proof still blocked by the separate F54 gap                                                                                                                                                                 |
| F54  | Monolith CSP `connect-src` never included operation-service's origin — blocks the realtime WebSocket connection client-side before any network request is sent                                                                                                                                                                            | RESOLVED — Session 4B-18c (2026-08-03): fixed and independently verified via a live `101 Switching Protocols` WS handshake; live browser proof still blocked by the separate, NEW F55 gap                                                                                                                                    |
| F55  | Realtime WS connection authenticates server-side then repeatedly disconnects/reconnects in a loop (many cycles, several ~25-30s apart) - `isConnected` never observed true client-side despite genuine server-side auth success                                                                                                           | RESOLVED - Session 4B-18d (2026-08-03): reason captured as `"transport close"` (not ping-timeout); pattern did not reproduce across ~2h active monitoring; full live smoke test passed clean with real end-to-end delivery proof, closing the F53/F54/F55 arc                                                                |
| F56  | OAuth handling for the Auth Cutover (4B-20/21) — operation-service has zero OAuth support; auth-options.ts configures 3 conditional providers on top of CredentialsProvider                                                                                                                                                               | RESOLVED & EXECUTED — decided Session 4B-20 (Davin): Option B; executed Session 4B-21 — `CredentialsProvider` removed from `auth-options.ts`, live production smoke test passed for credentials login/registration/OAuth/logout                                                                                              |
| F57  | 4B-21 Entry Criterion 1 — client-side session-cache staleness after a bridge login/logout (next-auth/react's `SessionProvider` cache can't see a cookie the bridge sets/clears server-side)                                                                                                                                               | RESOLVED — Session 4B-21 (Davin, live during CONFIRM): force a `getSession()` refresh at every auth-state-changing bridge call site (login, 2FA-login-completion, logout) rather than replacing `SessionProvider` with a custom auth-context                                                                                 |
| F58  | Every operation-service `/user/*` route (profile, 2FA, sessions, preferences — cut over since Session 4B-11) returns "User not found" for a user created via `token-register` (this session's own bridge registration path), despite the row provably existing                                                                            | RESOLVED — Session 4B-21: false positive, caused by this session's own local dev server never having `MIGRATE_USER_PROFILE`/`MIGRATE_USER_2FA` set (silently falling through to the monolith's own native lookup against the wrong `DATABASE_URL`); operation-service itself was never broken, proven by calling it directly |
| F59  | Phase 4 exit criterion 3 ("NextAuth fully retired; JWT auth is the only auth system") literally conflicts with F56's own indefinite OAuth-on-NextAuth retention                                                                                                                                                                           | RESOLVED — Session 4B-22 (Davin, via Antigravity Advisor approval): amend criterion 3's own wording, do not silently mark it checked                                                                                                                                                                                         |
| F60  | Stripe webhook migration (part of the plan's own Slice 4 scope, "`Write APIs + Stripe webhook`") was never executed — money-service has a fully-built, dormant `StripeWebhookController`; Stripe's dashboard was never repointed, no flag exists                                                                                          | OPEN — found Session 4B-22 (Phase 4 exit review), needs its own scoped cutover session                                                                                                                                                                                                                                       |
| F61  | `GET /api/geo/detect` is called by `app/(marketing)/pricing/page.tsx:155` and `components/payments/CountrySelector.tsx:69` but the route does not exist anywhere in `app/api/` — a 404 on every pricing-page load                                                                                                                         | RESOLVED — Session 6-8 (Davin): build it as a thin wrapper around the existing detectCountry(), keeping its IP-geolocation fallback as-is                                                                                                                                                                                    |
| F62  | Admin information architecture is split across two incompatible trees — `app/(dashboard)/admin/*` (15 pages, `getServerSession` guard, 4-entry nav) and `app/admin/*` (8 pages, **no `layout.tsx` at all**); 19 of 23 admin pages are unreachable from the admin nav                                                                      | RESOLVED — Session 6-2 (Davin): Option (a) — merge `app/admin/*` into `app/(dashboard)/admin/*`, retire `app/admin/login` with a redirect to `/login`                                                                                                                                                                        |
| F63  | Public legal pages (`/terms`, `/privacy`, `/disclaimer`) do not exist; the registration consent checkbox links to two of them, and `/disclaimer` is compliance-relevant for a trading product                                                                                                                                             | RESOLVED — Session 6-10 (Davin): ship production-grade legal template copy for `/terms`, `/privacy`, and `/disclaimer`                                                                                                                                                                                                       |
| F64  | `components/billing/subscription-card.tsx`'s optimistic-cancel "Undo" button never calls a reactivation API — it only clears local state after the real `onCancel()` has already resolved, so a user who clicks Cancel then Undo within its 5s window sees "still PRO" while the subscription was, in fact, already cancelled server-side | OPEN — found Session 6-1b (reading the component before wiring it, not by triggering the bug live); owner Davin — fix the undo flow or retire the component if it stays unused; not blocking, component still unmounted                                                                                                      |

> **Note on numbering (updated 4A-W4, 2026-07-26).** F36–F42 (Part 19.5 / Wise) were registered at
> Session **4A-W1**, closing the register's F35→F44 gap. **F43** is now registered (Session
> **4A-W4**, per that order's own Step 6 — it needed 4A-W4's audit findings to be meaningful, per
> the original deferral). F44–F46 were registered ahead of Session 4A-7a because that session
> needed them at CONFIRM time.
>
> ⚠️ **Flags are `F<n>`; CLAUDE.md "Waiting on" items are `#<n>`.** They are different sequences and
> they overlap numerically — `F37` (Wise funding mode) and `#37` (the revoked RiseWorks-reply
> blocker) are unrelated. Always write the prefix.

---

_(Resolution entries append below this line — newest last)_

## F6 — Auth strategy: bridge vs OpenAuth vs hand-rolled

- Status: RESOLVED
- Session: 3-1 · Date: 2026-07-21
- Decision: Confirm 'bridge first' - The new service verifies existing NextAuth tokens while NextAuth remains on Vercel.
- Evidence: Live decision from Davin via interactive prompt. At CONFIRM, a fresh full-repo
  search found the plan's 3 "missing" F6 reference docs actually exist
  (`backend-stack-a/hybrid-authentication-for-backend-stack-a/`, committed 2026-02-02,
  predates this migration) and recommend OpenAuth as primary reference — Davin reviewed
  and explicitly disregards them as superseded exploratory seed material for a future
  end-state; bridge-first stands per the plan's own §5 decision.
- Approved by: Davin

## F7 — HS256 shared secret vs JWKS + rotation timing

- Status: RESOLVED
- Session: 3-1 · Date: 2026-07-21
- Decision: Path B: Build JwtAuthGuard to decrypt NextAuth's JWE directly (no NextAuth changes, safer for live users, but ties NestJS to NextAuth JWE format).
- Evidence: Live decision from Davin via interactive prompt.
- Approved by: Davin

## F47 — Wise quote `targetAmount`/currency-unit correctness for non-USD payouts

- Status: OPEN
- Session: 4A-W7 · Date: 2026-07-27
- Found while: drafting the session's own single-affiliate THB smoke payout — the first time any
  Wise payout code has ever run against a non-USD recipient (every prior test used USD/GBP sandbox
  fixtures).
- **The bug:** `money-service/src/wise/services/wise-quote.service.ts`'s `createQuote` is called
  from `wise-payment.provider.ts`'s `prepareBatch` with `targetAmount: item.amount` — `item.amount`
  is the `Commission.commissionAmount`, always denominated in **USD** (`DEFAULT_CURRENCY`, the only
  currency commissions are ever computed/stored in). When `targetCurrency` is anything other than
  USD (here, THB), this passes the raw USD number as if it were ALREADY a target-currency amount —
  i.e., a `$50` commission became a quote request for **50 THB** (≈ $1.49), not $50-worth of THB
  (≈ 1,394–1,679 THB depending on payment method). Live-verified: my own script's call reproduced
  this exact bug (`{"targetAmount":50,"targetCurrency":"THB",...}`) before separately failing on an
  unrelated 422 (see below). This would have silently shorted every non-USD affiliate to roughly
  1–3% of their real earned commission had the 422 not also been present.
- **A second, independent problem, found reconciling the numbers on the transfer that DID
  eventually complete (created out-of-band, not through this app's own code — see this session's
  own Deviations):** that transfer used `providedAmountType: "SOURCE"` with `sourceAmount: 50.00`
  fixed (spend exactly $50 total including fees, convert the remainder). For the `BANK_TRANSFER`
  payment method actually used, the fee was $8.49 (17%), so the recipient received THB worth only
  ~$41.51, not $50. **This does not satisfy F38's own resolved intent** ("platform bears the fee,
  affiliate receives their exact earned commission") — under this shape, the AFFILIATE bears the
  fee, not the platform. F38 remains RESOLVED as a decision (platform-absorbs-fee is still the
  intended design); this flag is about the fact that NEITHER the app's current code NOR the
  transfer that actually worked correctly implements that decision for a non-USD target currency.
- **What a correct fix needs:** for a non-USD `targetCurrency`, the commission's USD amount must
  first be converted to a target-currency amount at or after quote-request time (Wise's own rate),
  THEN passed as a genuinely fixed `targetAmount` in the SAME shape F38 already established for the
  USD case — so the affiliate's received THB is provably worth their full earned USD commission,
  fee absorbed by the platform on the source side. This is a real implementation change to
  `wise-quote.service.ts`/`wise-payment.provider.ts`, not a config flip — scope it as its own PORT
  session before any further non-USD affiliate is paid through this path.
- Owner: Davin/Advisor — due before the next non-USD Wise payout (the smoke payout itself is not
  blocked on this, since it's explicitly a one-off test amount, not a real affiliate's earned
  commission).

_(F55 RESOLVED at Session 4B-18d, 2026-08-03 — full resolution entry moved to
`docs/migration-orders/history/decisions-archive.md` per this file's own hygiene rule.)_

_(F56 RESOLVED & EXECUTED — decided Session 4B-20, executed Session 4B-21 (2026-08-04) — full
resolution entry moved to `docs/migration-orders/history/decisions-archive.md` per this file's own
hygiene rule.)_

## F57 — 4B-21 Entry Criterion 1: client-side session-cache staleness after a bridge login/logout

- Status: RESOLVED
- Session: 4B-21 · Date: 2026-08-03
- Found while: this order's own CONFIRM re-verification — token-login/token-logout set/clear the
  shared NextAuth-format session cookie server-side (F26), which `getServerSession()` reads fine
  (fresh on every request), but `next-auth/react`'s `SessionProvider` maintains its own client-side
  cache that only refetches on its own triggers (focus, its own polling interval, or an explicit
  `signIn()`/`signOut()`/`getSession()`/`update()` call) — none of which a bridge login/logout goes
  through. Left unresolved, every client component reading `useSession()`/`getSession()` directly
  (at minimum: `components/layout/header.tsx`, `components/notifications/notification-bell.tsx`,
  `hooks/use-realtime-socket.ts`, `hooks/use-login-tracking.ts` via `components/auth/
login-tracker.tsx`, plus every settings/pricing/checkout page) would show a stale "not logged in"
  view after a real bridge login, or a stale "still logged in" view after a bridge logout.
- Decision: force a `getSession()` call (from `next-auth/react`) immediately after every
  auth-state-changing bridge call — `token-login` success (`login-form.tsx`), the mid-login 2FA
  completion re-POST to `token-login` (`verify-2fa/page.tsx`), `token-logout` (`header.tsx`), and the
  admin login form's own `token-login` call (`app/admin/login/page.tsx`) — rather than replacing
  `SessionProvider` with a thin custom auth-context. `getSession()`'s own internal broadcast
  (`next-auth/react`'s documented cross-tab/cross-consumer sync mechanism) is what notifies every
  OTHER mounted `useSession()` instance to refetch and re-render, so this is a genuinely centralized
  fix, not a per-consumer one — the ~19 files that only READ session state (settings pages, pricing,
  checkout, `providers.tsx`, notification-bell/list, trading-chart, DrawingLayer, the realtime-socket
  hook, the login-tracker hook) needed ZERO code changes, confirmed by reading each for a
  `signIn()`/`signOut()`/`getSession()` call of their own (none has one) before leaving it untouched.
  The custom-auth-context alternative was explicitly rejected: it would have touched all ~19 files
  individually (larger diff, more regression surface on the last domain session before Phase 4B
  closes) while still needing `next-auth/react`'s own session for OAuth-only users
  (`social-auth-buttons.tsx`), meaning two auth-state sources to keep in sync either way.
- Evidence: Live decision from Davin (`AskUserQuestion`, this session's CONFIRM), alongside
  confirming the order's own APPROVED/"entry criteria verified" edit was his authentic action and
  approving the inclusion of 2 files (`hooks/use-login-tracking.ts`/`login-tracker.tsx`,
  `hooks/use-realtime-socket.ts`) found via a fresh re-run of 4B-20's own greps that weren't in
  either session's own file list. Implemented and verified: `tsc --noEmit` clean, `eslint app
components lib hooks --max-warnings 0` clean, full `test:ci` 129/129 suites, 2190/2190 tests (new
  coverage added for every touched file's bridge branch, including a dedicated assertion that
  `getSession()` fires after a successful bridge login and does NOT fire on the twoFactorRequired
  branch).
- Approved by: Davin

## F58 — operation-service `/user/*` routes return "User not found" for a bridge-registered user

- Status: RESOLVED (false positive — see "Actual root cause" below; the entire investigation
  chain in between is preserved as-is since each ruled-out theory was itself correctly verified,
  and the isolation method that finally found the real cause depended on having ruled these out
  first)
- Session: 4B-21 · Date: 2026-08-03
- Found while: Checklist Step 2's own local integration smoke test (Davin's own choice, `AskUserQuestion`
  — a scratch script against a local monolith dev server with `NEXT_PUBLIC_AUTH_BRIDGE_ENABLED=true`,
  `OPERATION_SERVICE_URL` pointed at real production operation-service, reading verification/reset
  tokens directly from production's own DB rather than an inbox).
- Symptom: a fresh user created end-to-end via `token-register` → `token-verify-email` →
  `token-login` (all three succeed, 200/201, correct `user` object, valid session cookie, `GET
/api/auth/session` correctly reflects the user) then gets **"User not found" (404)** from BOTH
  `GET /api/user/2fa/setup` and `GET /api/user/profile` — two independent, already-cut-over-since-
  Session-4B-11 routes, ruling out anything 2FA-specific. `token-forgot-password`/`token-reset-
password`/re-`token-login` with the new password all still succeed normally for the same user in
  between.
- Ruled out, with direct evidence, before escalating (not guessed at):
  - **Not a stale/wrong-cookie/JWE-decode issue** — `encodeNextAuthToken()` (`token-login`'s minter)
    and `decodeNextAuthToken()`/`JwtAuthGuard` (operation-service's own verifier) were read directly;
    both encode/decode the same `id` claim correctly. `GET /api/auth/session` (the monolith's own
    independent NextAuth decode of the identical cookie) correctly resolves the same user right
    before the failing call, in the same script run.
  - **Not a stale-read/replication-lag/wrong-database issue** — queried `"User" WHERE id = $1`
    directly via `DIRECT_URL` (production, the same connection string that correctly read the
    verification/reset tokens `AuthService` had just written) at the EXACT moment operation-service
    said the row didn't exist: the row was there, correct email, `emailVerified` set, matching
    `id`.
  - **Not 2FA-specific code** — `GET /api/user/profile` (a completely different `UsersService`
    method, same `prisma.user.findUnique({where:{id}})` shape) fails identically for the same user.
  - **Not this session's own code** — 4B-21 touched zero files under `operation-service/src/users/`,
    `operation-service/src/auth/two-factor.service.ts`, or the Prisma schema; `AuthController`'s own
    routes (register/login/logout/forgot/reset — all genuinely NEW-in-this-session call sites) work
    correctly for the exact same row throughout.
  - Reproduced identically across 3 separate fresh test users in 3 separate script runs — not a
    one-off flake.
  - `operation-service`'s own `prisma/schema.prisma` `User` model, `UsersController`'s guard/handler
    wiring, and `PrismaModule`'s DI wiring were all read directly and look structurally correct —
    only one `PrismaService`/`PrismaModule` exists in the whole service (no split-client
    possibility, unlike the monolith's market/non-market split).
- **Original leading hypothesis (stale deployment) — TESTED AND RULED OUT, same session:** Davin
  had `railway up --path-as-root --service operation-service` re-run (deployment
  `e6d716ac-2d6c-4f02-9a51-ab213715270d`); polled `latestDeployment.status` (not the stale
  top-level field, L38) until genuinely `SUCCESS`; fresh boot log confirmed clean startup, zero DI
  errors, `UsersController {/user}` mapped with all its routes including `GET /user/profile`. Re-ran
  the exact same check against this freshly-redeployed instance — **F58 still reproduced
  identically.** This rules out staleness as the cause.
- **Further isolation performed after the redeploy, conclusive:**
  1. Decoded the raw session-cookie JWE directly (via operation-service's own `jose`/`@panva/hkdf`
     packages, replicating `decodeNextAuthToken()`'s exact derivation) — `claims.id` is a
     byte-perfect match to the real row's `id` (verified via character codes, not just string
     equality), ruling out any encoding/truncation/whitespace issue.
  2. Instantiated operation-service's own generated `@prisma/client` + `@prisma/adapter-pg` (the
     exact classes `PrismaService` uses) directly, pointed at `DIRECT_URL`, and ran
     `UsersService.getProfile()`'s EXACT query (`findUnique` by id, by email, and with its full
     `select` shape) — **all three found the row correctly.** This proves the code, the schema,
     and the adapter are all correct when pointed at the known-good database.
  3. Checked operation-service's real Railway `DATABASE_URL` value-blind (hostname only, never the
     credential): it resolves to `postgres.railway.internal` — a Railway-internal hostname
     (L53) scoped to whatever Postgres resource is linked within operation-service's own Railway
     project, not directly comparable to `DIRECT_URL`'s public proxy host from outside Railway's
     network. Whether this actually points at the identical physical database `DIRECT_URL` reaches
     could not be verified further from this environment (`AuthService`'s register/login/forgot/
     reset calls — which use the SAME injected `PrismaService`/`DATABASE_URL` — all correctly read
     and write rows visible via `DIRECT_URL`, which argues against a wrong-database explanation,
     but doesn't fully resolve the contradiction with items 1-2 above).
  4. Checked operation-service's own application logs (`railway logs`) around the failing requests
     for a genuine Prisma-level error (connection, prepared-statement, or pooling exception) that
     might be silently swallowed into the generic `NotFoundException` — found none; the query
     appears to genuinely execute and cleanly return zero rows from the live container's own
     perspective, which contradicts the identical query succeeding via items 1-2 above.
- **Status after this session's investigation: still OPEN, root cause not conclusively identified.**
  The contradiction (code+schema+adapter proven correct in isolation, yet the live container gets a
  clean empty result for a row that demonstrably exists) points at something in the live container's
  actual runtime environment or connection behavior that isn't reproducible from outside — most
  likely something PgBouncer/pooling-related specific to `DATABASE_URL`'s pooled connection string
  (Prisma's own documented `pgbouncer=true` connection-string parameter for transaction-mode pooling
  is one candidate worth checking, though this wouldn't typically explain a clean silent miss rather
  than an error) — but this is NOT confirmed, only the most plausible remaining candidate. Needs
  Davin's own Railway project/dashboard access (comparing the real `DATABASE_URL` value against the
  monolith's own production connection string beyond just the hostname, or attaching to the live
  container directly) to go further; this environment has exhausted its available diagnostic paths.
- **What was tried before the real cause was found (Davin's own direction):** Davin proposed a
  resilient email-lookup fallback in `UsersService`/`TwoFactorService` (`resolveUserId(userId,
email?)` — fall back to `findUnique({where:{email}})` when the id lookup misses). Implemented
  across `getProfile`/`changePassword` and every `JwtAuthGuard`-derived `TwoFactorService` method,
  redeployed, re-verified — **F58 still reproduced identically even with this fix live**, which is
  what finally proved the bug could not be inside `UsersService`/`TwoFactorService` at all (a
  temporary diagnostic error string confirmed the new code path wasn't even being reached in the
  way expected, prompting the decisive test below).
- **Actual root cause, found by bypassing the monolith's forwarding layer entirely:** minted a
  session directly against operation-service's own `/auth/login` (bypassing the monolith
  completely) and called `/user/profile` directly with the raw `accessToken` — **200, success.**
  Then, in the same script run, took the monolith-issued session cookie for the same user and
  called operation-service's `/user/profile` DIRECTLY with it as a Bearer token — **also 200,
  success.** Then called the MONOLITH's own `/api/user/profile` route with the identical cookie —
  **404, "User not found."** This proved conclusively that operation-service was never broken;
  the bug was in the monolith's own route. Reading `app/api/user/profile/route.ts` found it checks
  `shouldUseOperationServiceForUserProfile()` (`MIGRATE_USER_PROFILE` env var) before forwarding —
  **this session's own local `.env.local` never had `MIGRATE_USER_PROFILE` or `MIGRATE_USER_2FA`
  set**, so every `/api/user/profile` and `/api/user/2fa/*` call in this session's own local
  testing silently fell through to the monolith's OWN native Prisma lookup (`lib/db/prisma.ts`,
  reading `DATABASE_URL` — the STAGING database, `turntable.proxy.rlwy.net`, per `LESSONS-
LEARNED.md` L19's own precedent), never reaching operation-service at all — and the bridge-
  registered test users, created via `token-register` (which DOES go through operation-service,
  writing to the real production database), simply don't exist in that staging database. Both
  flags are already `true` in real Vercel production (Session 4B-11's own close-out) — this was
  purely a local-test-environment gap, never a production risk.
- **Verification once the local flags were set to match production:** re-ran the full local
  smoke test (register → verify-email → login → logout → forgot-password → reset-password →
  re-login → 2FA setup → 2FA verify-setup (real TOTP code) → login with 2FA required → 2FA verify
  → login completion via the `__2fa_verified__` sentinel → session reflects the logged-in user)
  against real production operation-service — **22 of 23 checks passed.** The one "failure"
  (a stale raw cookie manually resent after `token-logout` still authenticates) is a test-
  methodology artifact, not a bug: `token-logout` correctly tells the BROWSER to delete the
  cookie via `Set-Cookie`, but a script that bypasses the browser and manually resends the old raw
  value is exercising something a real browser never does — NextAuth's default JWE session
  strategy is stateless (signature+expiry only, no server-side revocation list), the same
  property the pre-existing NextAuth `CredentialsProvider` path has always had.
- **The `resolveUserId` email-lookup fallback (Davin's own fix) stays deployed** — it is safe,
  tested (42/42 suites, 385/385 tests), and harmless for the success path, even though it turned
  out not to be the actual fix. Left in place as defense-in-depth rather than reverted, per
  Davin's own direction.
- Impact: none in production — `AuthController`'s routes (register/login/logout/forgot/reset,
  all genuinely new-in-this-session call sites) were proven correct throughout every stage of this
  investigation, and `/user/*` routes are proven correct now that the test environment matches
  production's real flag state.
- Approved by: Davin (directed the `resolveUserId` fallback fix; root-caused live in this
  session)

## F59 — Phase 4 exit criterion 3 wording vs. F56's indefinite OAuth-on-NextAuth retention

- Status: RESOLVED
- Session: 4B-22 · Date: 2026-08-04
- Found while: this session's own Checklist step 4 — the plan's literal exit criterion 3
  ("NextAuth fully retired; JWT auth is the only auth system," §6) is false as written: F56
  (Session 4B-20, executed 4B-21) keeps a narrow OAuth-only `[...nextauth]`/`auth-options.ts`
  shim alive **indefinitely** for Google/Twitter/LinkedIn — a deliberate, Davin-approved
  architectural decision, not an oversight, but one the plan's own exit gate can't be checked off
  against as literally worded.
- Decision: amend criterion 3's own wording in
  `monolith-to-microservices-migration-implementation-plan.md` §6 to: "Credentials, 2FA,
  registration, email verification, password reset, and user sessions migrated to JWT via
  operation-service; OAuth intentionally retained on NextAuth via narrow provider shim per F56."
  Recorded here rather than silently amended — the wording was reconciled by Antigravity Advisor
  (approving this session's order, 2026-08-04) with Davin, and applied to the plan doc as this
  session's own explicit act, not a unilateral Executor edit.
- Evidence: `docs/migration-orders/4b-22-phase-4-exit-review.migration-order.md`'s own header
  ("Approved by Antigravity Advisor 2026-08-04 with Criterion 3 wording reconciled per F56");
  `CLAUDE.md`'s Session 4B-22 Current entry quotes the identical reconciled wording verbatim.
- Approved by: Davin (via Antigravity Advisor)

## F60 — Stripe webhook migration (plan's own Slice 4 scope) was never executed

- Status: OPEN
- Session: 4B-22 · Date: 2026-08-04
- Found while: this session's fresh `app/api/**` census (Checklist step 3) — `app/api/webhooks/
stripe/route.ts` is still 100% monolith-native: raw body read, `constructWebhookEvent`, and
  `lib/stripe/webhook-handlers.ts`'s full tier/subscription/commission logic, unchanged.
- **This is a real gap against the plan's own literal scope, not an out-of-scope route.** The
  plan's own Phase 4 section (§6, 4A item 4) explicitly reads: "Write APIs **+ Stripe webhook**
  (rollback: flip back)." Session 4A-9 (2026-07-27) built a complete, deployed
  `StripeWebhookController`/`StripeWebhookService` in money-service — it has sat fully dormant,
  never receiving a single real request, for the entire remainder of Phase 4B (roughly 8 days of
  further migration work at the time this was found).
- Confirmed, not assumed: `lib/money-service/flags.ts` has `shouldUseMoneyServiceForStripeWrite`
  (checkout/subscription-cancel only) but no Stripe-webhook-specific reader anywhere in the
  codebase; no session's close-out anywhere in `CLAUDE.md` records repointing Stripe's dashboard
  webhook URL (unlike dLocal's explicit repoint at Session 4A-5); Stripe's own webhook subscription
  was never touched.
- **Not fixed this session** (AUDIT/VERIFY-RETIRE variant, near-zero dial — a real cutover
  requiring Davin's live approval per `EXECUTOR-PROTOCOL.md` §7 is out of scope for an exit
  review). Needs its own dedicated cutover session: verify money-service's `StripeWebhookController`
  still matches Stripe's real event shape after 8 days of drift, repoint Stripe's dashboard webhook
  URL (mirroring the dLocal precedent), and prove it live with Davin present.
- Owner: Davin/Advisor — due before Phase 4 can be called genuinely, literally complete against
  its own Slice 4 scope (does not block declaring Phase 4 CLOSED-WITH-NAMED-EXCEPTIONS now).
- Follow-up: `4a-13-stripe-webhook-cutover.migration-order.md` PRE-DRAFTed at Session 4B-22's
  close (VERIFY-RETIRE/CUTOVER block) — dashboard-repoint cutover, mirrors the dLocal/4A-5
  precedent exactly, not a rebuild (money-service's receiving side is already fully built).

---

## F11 — Frontend feature-gap backlog (enumeration delivered; triage completed)

- Status: RESOLVED — Session 6-12 (Davin): all 59 gap-matrix rows triaged as BUILT / VERIFIED / OUT_OF_SCOPE across Sessions 6-1 through 6-11
- Session: registered 2026-08-10; resolved Session 6-12 · Date: 2026-08-11
- Decision: **RESOLVED.** All 59 rows of `phase-6-frontend-gap-matrix.md` (the re-verified,
  deduplicated matrix — distinct from `ui-page-gap-register.xlsx`'s raw 90-row source count,
  see that matrix's own Correction #7) triaged across Sessions 6-1..6-11 into live components,
  pages, or verified internal-only routes.
  1. _"What is missing?"_ — **ANSWERED.** A full sweep of `app/**/page.tsx` (57 files),
     `app/api/**/route.ts` (122 endpoints), both NestJS services' controllers, all 21 OpenAPI
     specs in `docs/open-api-documents/`, all 33 Prisma models, and every internal `href` in
     `app/` + `components/` produced two committed artifacts:
     - `docs/files-completion-list/ui-page-gap-analysis.md` — the report
     - `docs/files-completion-list/ui-page-gap-register.xlsx` — 90-row register, 32 orphaned
       endpoints/models, 14 dead links
  2. _"Which gaps do we build?"_ — **STILL OPEN.** This is Davin's product judgment and is the
     entire point of Session 6-1. The priority column in the register is the Advisor's
     recommendation, explicitly NOT a triage verdict.
- Evidence (headline findings, each verified against live code at file:line):
  - **Baseline reconciliation:** `ui-pages.xlsx` claims 54 pages; the codebase has 56 distinct
    routes. Rows 18 and 18-5 are the same dynamic route; three Admin detail pages
    (`/admin/affiliates/[id]`, `/admin/fraud-alerts/[id]`,
    `/admin/disbursement/batches/[batchId]`) exist in code but were never registered.
  - **Fabricated data in production (3 pages):** `/settings/billing` has zero `fetch` calls in
    439 lines (`mockInvoices` line 60-61, mock usage stats line 98-99, cancel dialog wired to
    nothing) while `GET /api/invoices`, `GET /api/subscription` and `POST /api/subscription/cancel`
    all exist with no consumer; `/admin/fraud-alerts/[id]` renders `MOCK_ALERT` (line 66,
    `setAlert(MOCK_ALERT)` line 112) while `GET /api/admin/fraud-alerts/[id]` is never called;
    `/admin` generates a mock activity feed (line 82).
  - **Missing route:** `GET /api/geo/detect` is called by two components; `app/api/geo/` does not
    exist. Registered as F61.
  - **Orphaned capability (32 items):** incl. all 3 `/api/tier/*` endpoints, both account-deletion
    confirm/cancel endpoints, `GET /api/payments/dlocal/[paymentId]`,
    `/api/admin/affiliates/reports/code-flows`, `/api/affiliate/dashboard/code-inventory`,
    `POST /api/admin/codes/[code]/cancel`, and the `SecurityAlert`, `SystemConfigHistory`,
    `OutboxEvent`, `WiseTransfer` and `TrialStatus` models/enums — none with any UI.
  - **Navigation:** 14 dead internal links; **no `app/not-found.tsx`** anywhere; 19 of 23 admin
    pages unreachable from the admin nav (registered as F62).
- Consequence for the plan: Phase 6 grew from ~9 to **12 sessions** — 6-1b (mock-data hotfix),
  6-10 (public/marketing surface) and 6-11 (admin system operations) added; the a11y/phase-exit
  session renumbered 6-9 → 6-12. Session number **6-9 is retired, do not reuse**.
- Approved by: n/a — enumeration is mechanical and evidence-backed; the triage that actually
  resolves F11 requires Davin and has not happened.

**Update — Session 6-1 (2026-08-10), CONFIRMED and executed:** the order's own Step 1
(independently re-verify the census against live code, don't adopt on trust) is done — every
headline finding and ~40 of the ~54 itemized rows were re-checked directly (file:line grep/read
against the working tree), not one row was found to be substantively wrong. Two corrections and
one useful addition surfaced (full detail in `phase-6-frontend-gap-matrix.md`'s own "Corrections
found this session" section): a trivial off-by-one line citation (A1-1); an imprecise nav-link
claim (A1-16); and a real scope-narrowing find the source artifact missed — `lib/geo/detect-
country.ts` already implements the country-detection logic F61 needs, with zero importers, so
F61's real fix is a thin route wrapper, not new logic. `docs/migration-orders/phase-6-frontend-
gap-matrix.md` is now the produced artifact (Step 2), with every row assigned a target session
(Step 3) and 4 rows flagged as not fitting the Step 3 table cleanly, per the order's own Rule.
**Step 5 (obtain Davin's triage) did not happen this session** — triage is a real product
decision reserved for Davin (order Rule 3), not something to infer or fabricate. Per the order's
own Rollback clause ("if the triage is incomplete, the session does not close; the matrix stays
uncommitted"), the default would be to hold the matrix uncommitted — Davin explicitly directed
committing and pushing this session's work regardless, a disclosed deviation from that default,
not a silent override (see the order's own Deviations). **F11 stays OPEN** — the Triage column in
the matrix is empty and this is the actual remaining blocker, not documentation completeness.

---

## F61 — `GET /api/geo/detect` is called but does not exist

- Status: RESOLVED
- Session: registered 2026-08-10 (UI gap analysis); resolved Session 6-8 (2026-08-11) · Owner: Davin
- Question: build the missing route, or delete both call sites and fall back to manual country
  selection?
- Evidence: `app/(marketing)/pricing/page.tsx:155` and `components/payments/CountrySelector.tsx:69`
  both `fetch('/api/geo/detect')`. `ls app/api/geo` → no such directory. Every pricing-page load
  therefore issues a request that 404s. Country detection feeds dLocal payment-method selection,
  so this sits on the checkout conversion path.
- **Update — Session 6-1 (2026-08-10):** re-verified live; also found `lib/geo/detect-country.ts`
  already implements `detectCountry(headers)` / `detectCountryFromIP(ip)` (Cloudflare/Vercel
  header-based, IP-geolocation fallback, 100%-line-covered by its own test) with **zero importers
  anywhere in the app**. If the "build it" answer wins, the fix at 6-8 is a thin
  `app/api/geo/detect/route.ts` wrapper around already-working, already-tested logic — not new
  detection code. Doesn't change the underlying vendor/cost/privacy question this flag still
  needs Davin's call on (a third-party IP lookup is called from inside that existing utility).
- Why it needs Davin: geo-IP detection has cost, privacy and vendor implications (a third-party
  lookup service vs. Vercel's own request geo headers vs. dropping the feature). Not a technical
  coin-flip.
- **Decision (Davin, live, Session 6-8 CONFIRM):** build it — `app/api/geo/detect/route.ts` calls
  `detectCountry(request.headers)` verbatim, keeping the existing `detectCountryFromIP` third-party
  fallback (`ip-api.com`) exactly as-is. No vendor swap, no feature removal.
- Executed: Session 6-8 (2026-08-11), commit `96e2a8a3`. 3 new unit tests
  (`__tests__/pages/checkout/geo-detect.test.tsx`).

---

## F62 — Admin information architecture is split across two incompatible trees

- Status: RESOLVED
- Session: registered 2026-08-10 (UI gap analysis); resolved Session 6-2 (2026-08-10) · Owner: Davin
- Question: merge `app/admin/*` into `app/(dashboard)/admin/*` (one shell, one guard, one nav),
  or keep both trees and only cross-link them?
- Evidence: `app/(dashboard)/admin/*` holds 15 pages under the `(dashboard)` layout with a
  `getServerSession` guard, a 4-entry admin nav, and an 8-entry disbursement sub-nav.
  `app/admin/*` holds 8 pages and has **no `layout.tsx` at all** — those pages inherit the root
  layout, with no nav and no shared guard. The two share the `/admin` URL prefix but have no
  links between them: 19 of the 23 admin pages can only be reached by typing the URL.
  `middleware.ts` deliberately excludes `/admin` (documented in the file) because `app/admin/login`
  would otherwise be unreachable to a logged-out admin.
- Why it needed Davin: consolidating changes URLs, the auth entry point and the admin login flow —
  hard to undo once admin surfaces are rebuilt on top of it. Decided **before** 6-6, at Session 6-2's
  own CONFIRM.
- Decision (Davin, live, Session 6-2 CONFIRM): **Option (a)** — merge all 8 `app/admin/*` pages
  into `app/(dashboard)/admin/*`; retire `app/admin/login` with a plain redirect to the existing
  `/login` page (no role-aware redirect preserved — an admin who signs in via `/login` lands on
  `/dashboard` and reaches `/admin` the same way any admin does today, guarded correctly by
  `app/(dashboard)/admin/layout.tsx`'s existing `getServerSession()` + role check either way).
  Unifies all 23 admin pages under one guard, one nav, one styling system.
- Executed: Session 6-2 (2026-08-10). See that order's own Deviations for the file-move list and
  the `middleware.ts`/test-retirement consequences.

---

## F63 — Public legal pages do not exist; content ownership unassigned

- Status: RESOLVED — Session 6-10 (Davin): ship production-grade legal template copy for `/terms`, `/privacy`, and `/disclaimer`
- Session: registered 2026-08-10 (UI gap analysis); resolved Session 6-10 · Owner: Davin
- Question: does Davin supply real legal copy for `/terms`, `/privacy` and `/disclaimer`, or does
  Session 6-10 ship reviewed placeholders?
- Resolution: Davin approved shipping production-grade legal template copy for `/terms` (Terms of Service), `/privacy` (Privacy Policy / GDPR), and `/disclaimer` (Financial Risk Disclaimer for trading alerts), repointing dead links in `register-form.tsx` and marketing footer.
- Evidence: `app/(marketing)/layout.tsx` links to `/terms` (line 116), `/privacy` (line 111) and
  `/disclaimer`; `components/auth/register-form.tsx`'s consent checkbox links to `/terms`
  (line 534) and `/privacy` (line 541).
