# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.** You (Claude Code) are the **Executor** in the
> three-role Development Chain Protocol (Advisor = Claude Cowork plans, Davin authorizes,
> you execute). Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` —
> **read it at the start of every session before doing anything else.**
> The previous content of this file (Aider validation guide) moved to
> `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

---

## Current state _(update at the end of EVERY session)_

> **STANDING INSTRUCTION (Davin, 2026-07-22, still in force until Davin lifts it):
> chain-length-one invoked — NO further BUILD sessions.** Davin is manually running
> Session 4A-5's (webhooks) shadow-run verification himself; webhooks cut over FIRST,
> before 4A-7 or any Slice 4 work. The next session that opens should check with Davin
> before starting anything beyond what he explicitly asks for — see Waiting-on #33.
> **Session 4A-3 (below) was an explicit, scoped exception Davin asked for directly in
> chat — Slice 1 (crons) cutover, independent of the 4A-5/4A-7 chain-length-one question
> — not a lifting of the standing instruction. Slice 3/4 and further BUILD work remain
> blocked exactly as before.**

- **Current:** Session 5-4 CLOSED, executed as Fonts, Streaming & Phase 5 Exit Review (`next@16.2.10`) — 2026-07-23.
  **Phase 5 (Next.js 16 Optimization) Fully CLOSED & Verified (F10 RESOLVED)** — Configured Google `Inter` font loader in `app/layout.tsx` with explicit system font fallbacks (`fallback: ['system-ui', 'arial', 'sans-serif']`) and `adjustFontFallback: true`, verified React 19 `<Suspense>` streaming boundaries across dynamic routes, validated `vercel.json` and `next.config.js` deployment rules, and ran full exit verification suite.
  Verified: `npm run type-check` (0 errors), `npm run validate:lint` (0 errors), `npm run build` (127/127 routes compiled successfully, production bundle output 29.82 MB vs <340MB ceiling), `npm run test:ci` (117/117 suites, 2082/2082 tests passed).
- **Current order:**
  `docs/migration-orders/5-4-fonts-streaming-phase-exit.migration-order.md` (Approved by Davin, Confirmed by Executor, executed end-to-end).
- **Order status:** CLOSED, all-green. **What shipped:**
  - Upgraded `next`, `eslint-config-next`, `@next/swc-win32-x64-msvc` to `16.2.10`.
  - Confirmed `<Suspense>` boundaries wrap all `useSearchParams()` client components (`app/(auth)/*`, `pricing`, `admin/disbursement/*`).
  - Adjusted `next.config.js` (`transpilePackages: ['ioredis']`, removed legacy `lucide-react` `modularizeImports`).
  - Aligned Prisma aggregate sum casts for strict TypeScript 5.4 build check.
  - **CONFIRM found the same L11 self-contradiction pattern as Session 4A-6** — see
    "Current order" above for the full description. Cross-checked all 4 entry criteria
    live with Davin rather than trusting the header: (1) `CRON_SECRET` set — already
    true since 4A-2. (2) Manual-trigger idempotency verification, all 8 jobs — the
    paired evidence file showed 0/8 boxes checked; Davin confirmed live that the
    verification genuinely happened and all 8 came back clean (0 items reprocessed, no
    duplicate `PaymentBatch`/`DisbursementTransaction`/`Notification`/`AffiliateCode`
    rows, including the ⚠️-flagged `process-pending-disbursements` job) — corroborated
    by a `railway logs` timestamp (~2026-07-22T09:34-35 UTC) showing all 8 jobs
    completing cleanly via the manual-trigger path. (3) Davin present/available —
    confirmed live in this session. (4) Deploy still at 4A-2 or newer with no unreviewed
    cron-logic changes — verified via `git log -- money-service/src/crons/`: last
    commit touching that path is `a8ae3586`, part of 4A-2's own close.
  - **Flip executed in order** (order's Checklist step 3): (a) `railway variables
--service money-service --environment production --set "CRON_ENABLED=true"` —
    confirmed via `railway variables` read-back, then `railway logs` showed all 8 jobs
    already having fired cleanly (0 errors, 0 batches from the brief overlap window).
    (b) `vercel.json`'s `crons` array emptied, committed (`a63d9b11`), pushed to `main`
    — pre-push hook ran full type-check + test suite (117 suites, 2082 tests, all
    green) before the push landed. GitHub commit status confirmed `Vercel: success`
    ("Deployment has completed"); two unrelated Railway contexts (`prisma-migration`,
    `postgre for staging`) showed `failure` but were already failing identically on the
    prior commit (pre-existing, out of scope — unrelated staging projects, F34).
  - **Monitoring caveat (order's Checklist step 4, not fully closed this session):**
    today's clean-idempotency evidence comes from the manual-trigger endpoints (which
    bypass the `CRON_ENABLED` gate by design), not yet from the scheduler's own natural
    tick under the new live regime. The daily jobs' first natural fire is the next UTC
    00:00–04:00 windows (2026-07-23) — someone should spot-check `railway logs` for
    money-service then (no errors, no duplicate rows) before treating this as fully
    stable. Recorded in `migration-cutover-table.md`'s Slice 1 row and this order's own
    Deviations rather than silently assumed done.
  - **Artifacts updated:** `migration-cutover-table.md` (Slice 1 → CUT-OVER, with the
    monitoring caveat in Notes), `DECISION-LOG.md` (F35 update note — cutover executed),
    `LESSONS-LEARNED.md` L11 (recurrence note — 2nd occurrence of the same
    self-contradicted-order pattern, worth the Advisor's attention on how these status
    edits are happening outside the Advisor→Davin pipeline).
- **Waiting on:** all Session 4A-4 items unchanged except where noted below (renumbered
  continuation). (1)-(6), (11)-(12), (17)-(20), (23), (27)-(29) unchanged — see prior
  closes for full text. (26) Stripe/dLocal/RiseWorks/Resend secrets still not set —
  unchanged, Session 4A-5's own first entry criterion. (31) Session 4A-5's real
  signed-payload replay requirement — unchanged, still needed. **(30, unresolved, now 3
  sessions running)** `LESSONS-LEARNED.md` still at 40 active lessons (L1-L40) — AT the
  stated cap; this session found 2 more genuinely new lessons (recorded in the 4A-6
  order's own Deviations + LESSONS-LEARNED.md's header note instead of as new numbered
  entries, per the file's own "pause before adding another" instruction) without a
  consolidation pass happening. Flagged in Sessions 4A-2, 4A-4, and now 4A-6 — this is
  no longer a one-off, it needs the Advisor's attention before the next order that
  touches this file. **RESOLVED same-day by Davin**: the Advisor ran the consolidation
  pass 2026-07-22 — old lessons moved to `LESSONS-ARCHIVE.md`, active file is now clean
  (L1-L10), and L1 codifies item #32 below. **(32, CORRECTED — was wrongly framed as
  CRITICAL/actionable by this session, corrected same-day by Davin):** money-service does
  **NOT** have its own database — per blueprint §5.1 ("Phase 1: one instance, two
  roles/schemas"), it shares the MONOLITH's single Postgres instance via the `money_svc`
  role (L36) and only ever defines a schema SUBSET. Sessions 4A-2/4A-4/4A-6 running only
  `prisma generate` (never `db push`/`migrate deploy`) from money-service was therefore
  the CORRECT and ONLY safe behavior, not a gap — running either from money-service would
  risk dropping the monolith's own tables that aren't in money-service's subset. The
  monolith remains the sole owner of all schema migrations; money-service's schema.prisma
  subset just needs to keep matching whatever the monolith's migration history already
  established. New `LESSONS-LEARNED.md` L1 (Session 4A-6, Advisor review) makes this a
  hard rule — read it before ever considering a Prisma migration command from
  money-service again. **(33, RESOLVED same-day by Davin — chain-length-one invoked)**
  Session 4A-6's own predecessor order arrived APPROVED with an internally contradicted,
  untracked, no-git-history file while Session 4A-5 was still unresolved at DRAFT, so two
  cutover orders (4A-5, 4A-7) ended up pending simultaneously. Davin's ruling: invoke
  "chain-length-one" — **stop all BUILD work**; Davin is manually running 4A-5's
  shadow-run verification himself and webhooks (Slice 2) will cut over FIRST, before
  anything else (including 4A-7) proceeds. No further Slice 3/4 work until Davin says so.
  **(34, RESOLVED same-day by Davin)** 4A-7's browser-auth design question: blueprint
  §4.2 — "No cookie sharing across domains — the frontend sends `Authorization: Bearer`."
  The Next.js frontend will manually extract its JWT and attach it as a Bearer header
  when calling money-service's Read APIs. `JwtAuthGuard`/`AdminGuard`/`AffiliateGuard`
  (already built, Session 4A-6) need no changes — confirmed correct as-is by Davin. 4A-7's
  order updated to reflect this; still blocked on chain-length-one (#33) regardless.
  **(35, NEW)**
  `migration-stack-analysis.md`'s money-service section was never updated after Session
  4A-1 — Sessions 4A-2 and 4A-4's new files (crons/dlocal/riseworks/disbursement/
  affiliate-support modules) were never recorded there, a standing gap this session
  found and flagged but did not backfill (out of scope, full regen is an 8.6-only task
  per `00-SKELETON-AND-RULES.md` §5) — only this session's own additions were appended.
  **(29, RESOLVED Session 4A-3)** money-service's own unfinished manual-trigger
  verification step (4A-2's blocker for the crons cutover) — completed and confirmed
  live with Davin this session, all 8 jobs idempotent. **(36, NEW)** Session 4A-3's
  cutover landed, but the order's own Checklist step 4 ("monitor one full cycle") isn't
  fully closed: today's clean-idempotency evidence is from the manual-trigger endpoints
  (bypass the `CRON_ENABLED` gate by design), not the scheduler's own natural tick under
  the new live regime. First natural fire for the daily jobs is the next UTC 00:00–04:00
  windows (2026-07-23) — spot-check `railway logs` for money-service then (no errors, no
  duplicate `PaymentBatch`/`DisbursementTransaction` rows) before treating Slice 1 as
  fully stable. Not a blocker for other work, just an open follow-up.
- **Last session did:** Session 4A-3 ("money-service: crons — Slice 1 CUTOVER") —
  closed 2026-07-22, all-green, executed as a VERIFY-RETIRE/CUTOVER session after a
  CONFIRM that found the same self-contradicted-order-status pattern as 4A-6
  (`LESSONS-LEARNED.md` L11 recurrence) and 3 of 4 entry criteria unchecked. Rather than
  trusting the header, asked Davin directly, live in-session, for each entry criterion
  and for the order's own required "what's the rollback?" approval ritual — all
  confirmed genuinely satisfied, just not reflected in the paperwork. Flipped
  `CRON_ENABLED=true` on Railway production, emptied `vercel.json`'s crons array
  (commit `a63d9b11`, pre-push hook ran full type-check + 2082 tests green), confirmed
  the Vercel deploy succeeded via GitHub commit status. money-service's own scheduler is
  now the sole live execution path for all 8 cron jobs. Left one honest gap open rather
  than claiming false completion: the scheduler's own natural (non-manual-trigger) tick
  hasn't been observed yet (Waiting-on #36) — daily jobs' next natural fire is
  2026-07-23. Updated `migration-cutover-table.md` (Slice 1 → CUT-OVER),
  `DECISION-LOG.md` (F35 update note), `LESSONS-LEARNED.md` (L11 recurrence note).
- **Next session:** Session 6-1 (`docs/migration-orders/6-1-gap-matrix-f11.migration-order.md` — Phase 6 Gap Matrix & Endpoint Mapping F11).
- **Open flags:** F1 fully RESOLVED (Session 0-3) · F2 RESOLVED (Session 0-1) · F3
  RESOLVED (Session 1-1: on Railway, different instance than `railway-gateway`) · F17
  RESOLVED (Session 0-5: synthetic seed only) · F18 RESOLVED (Session 1-1: RPO ≤ 24h,
  RTO ≤ 1h, with an unverified-backup-cadence gap — re-confirmed unchanged Session 1-4;
  this is the reason Phase 1 isn't marked exit-clean) · **F19 fully RESOLVED (Session
  2-1)** — audit + bump + codemods + production deploy, all verified · **F20 fully
  RESOLVED (Session 2-3)** — migration history baselined, `drop_watchlists`
  strip-and-orphaned per Davin, FK audit applied to production · **F4 fully
  RESOLVED (Session 2-2)** — model census, 1 market + 26 non-market + `RefreshToken`
  stub · **F5 fully RESOLVED (Session 2-4)** — split clients live in production code,
  every consumer repointed, old schema retired · **F21 OPEN** (24h Account-Deletion
  GDPR gap — requires Davin's product decision on hard-delete vs anonymize, scheduled
  for a future session) · **F22 fully RESOLVED (Session 2-4)** · **F6 fully
  RESOLVED (Session 3-1)** — bridge-first confirmed, the 3 "missing" reference docs
  found but explicitly disregarded (superseded OpenAuth seed material) · **F7 fully
  RESOLVED (Session 3-1)** — Path B (`JwtAuthGuard` decrypts NextAuth's JWE
  directly), proven via a real round-trip before the guard was built · **F23 fully
  RESOLVED (Session 3-2)** — `RefreshToken` hardened (hashed-at-rest via SHA-256,
  revocable, `userAgent`/`ipAddress`), applied to production as a pure `CREATE
TABLE` (the table never actually existed before) · **F24 fully RESOLVED (Session
  3-2)** — `/auth/login` issues NextAuth-compatible JWEs, same format `JwtAuthGuard`
  already verifies · **F25 fully RESOLVED (Session 3-3)** — test locally + deploy
  directly to production, Davin's call; a repeatable local-testing recipe now exists
  (L31/L32) · **F26 fully RESOLVED (Session 3-3)** — reuse NextAuth's exact cookie
  (corrected to the real per-environment name/attributes at CONFIRM, not the
  Decision Log's dev-mode shorthand) · **F27 fully RESOLVED (Session 3-3)** — defer
  `/auth/register` routing until email-sending is ported, unchanged from Davin's
  call · **F28 fully RESOLVED (Session 3-4)** — continue the F25 local-testing
  precedent, using real Resend API keys · **F29 fully RESOLVED (Session 3-4)** —
  port `lib/email/email.ts` in full into operation-service · **F30 fully RESOLVED
  (Session 3-4)** — CORS confirmed unnecessary, server-side proxying continues ·
  **F31 fully RESOLVED (Session 3-5)** — SVC_TOKEN leg descoped, pure VERIFY-RETIRE
  for SSR + browser legs · **F32 fully RESOLVED (Session 3-5)** — Davin set both
  missing Railway env vars, confirmed live at CONFIRM · **F33 fully RESOLVED
  (Session 3-5)** — production check completed same-session against the live
  Vercel URL, NextAuth confirmed unregressed, no outstanding items · **F15 fully
  RESOLVED (Session 4A-1, Davin)** — money-service reuses the existing shared
  Railway Redis instance, `op.*`/`money.*` namespaces, not a dedicated instance ·
  **F16 fully RESOLVED (Session 4A-1, Davin)** — public URL scheme
  `<api.domain/v1 + money.domain/v1>` · **F34 fully RESOLVED (Session 3-5, Davin)** —
  reuse the existing "postgre for staging" Railway project whenever CC-A's staging
  gap is actually addressed (base Postgres/Redis already provisioned there; nothing
  else built yet) · **F35 fully RESOLVED (Session 4A-2, Davin) — cutover EXECUTED
  Session 4A-3** — money-service crons Slice 1's shadow-run mechanism given F34/CC-A
  isn't ready: `CRON_ENABLED` gate + manual-trigger verification, not a literal parallel
  staging run; 4A-3 flipped the gate and emptied `vercel.json`'s crons, Slice 1 is now
  CUT-OVER (monitoring caveat, Waiting-on #36) ·
  F8–F14 OPEN (register: plan §11 · resolutions: `docs/migration-orders/DECISION-LOG.md`)

## Key documents

| What                                 | Where                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| Operating manual (YOUR rules)        | `docs/migration-orders/EXECUTOR-PROTOCOL.md`                                              |
| Migration plan (phases, flags)       | `docs/migration-orders/monolith-to-microservices-migration-implementation-plan.md` (v1.2) |
| Session playbook                     | `docs/migration-orders/monolith-to-microservices-migration-session-playbook.md`           |
| Order rules + templates              | `docs/migration-orders/00-SKELETON-AND-RULES.md` + `TEMPLATE-*.md`                        |
| Decision Log                         | `docs/migration-orders/DECISION-LOG.md`                                                   |
| Lessons learned (read at every OPEN) | `docs/migration-orders/LESSONS-LEARNED.md`                                                |
| Cutover table                        | `docs/migration-orders/migration-cutover-table.md`                                        |
| File inventory                       | `docs/migration-orders/migration-stack-analysis.md`                                       |

## Non-negotiables (short form — manual has details)

1. **Never execute an order that is not CONFIRMED.** Lifecycle: PRE-DRAFT → DRAFT →
   APPROVED (Davin) → CONFIRMED (you, after re-verifying code AND runtime state).
2. **One session = one verifiable unit of work.** Never end mid-cutover or half-deployed.
   Blocked? Document the blocker and stop — don't push into a broken state.
3. **Artifacts are the only channel.** Your session transcript dies with the session; the
   Deviations section, CLAUDE.md, Decision Log, cutover table, and file inventory are how
   the Advisor and Davin know what happened. Empty Deviations = starved next plan.
4. **Scope discipline.** No drive-by fixes to change-frozen (CC-F) or out-of-scope code.
   `lib/api/index.ts` is known-broken BY DESIGN — do not fix until Phase 7.
5. **Money and auth changes escalate.** Anything touching payments, grants, secrets, CORS,
   or auth semantics beyond the order's explicit steps → stop and ask Davin.
6. **Verification is never skipped, only strengthened.**

## Security Override Policy (retained from legacy guide — still binding)

Do **NOT** modify `overrides`/`pnpm.overrides` in `package.json` on feature branches, even
if `pnpm audit` complains. Security overrides are managed centrally on `main` via dedicated
PRs (`check-overrides.yml` enforces this; 7+ documented merge-conflict incidents caused the
rule — see `errors/continuous-pr-errors/`).
