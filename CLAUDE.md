# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.** You (Claude Code) are the **Executor** in the
> three-role Development Chain Protocol (Advisor = Claude Cowork plans, Davin authorizes,
> you execute). Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` —
> **read it at the start of every session before doing anything else.**
> The previous content of this file (Aider validation guide) moved to
> `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

---

## Current state _(update at the end of EVERY session)_

> **STANDING INSTRUCTION (Davin, 2026-07-22, NARROWED 2026-07-24 — still in force
> until Davin lifts it further):** chain-length-one originally read as "webhooks cut
> over FIRST (both providers), before 4A-7 or any Slice 4 work." **Davin confirmed
> live, 2026-07-24, that this narrows to dLocal-cutover-first**: with dLocal now
> CUT-OVER (Session 4A-5, see Current below), 4A-7/Slice 4 work is unblocked — it does
> NOT need to wait for RiseWorks. RiseWorks's own cutover (`4A-5-RW`) trails
> independently, gated on RiseWorks replying with webhook/API settings (see Waiting on).
> **Session 4A-3 (below) was an explicit, scoped exception Davin asked for directly in
> chat — Slice 1 (crons) cutover, independent of this question — not itself a lifting
> of the standing instruction.** With dLocal cut over too, Slice 3/4 BUILD work (4A-7
> onward) may now proceed; RiseWorks-specific work stays gated on `4A-5-RW`'s own entry
> criteria.

- **Current:** Session 4A-5 CLOSED, executed as money-service webhooks Slice 2 CUTOVER
  (dLocal-only, scope-amended 2026-07-24) — 2026-07-24.
  **CONFIRM (two live passes this session):** first pass found the order's own header
  read `DRAFT (scope-amended, awaiting Davin's approval)` — not APPROVED, contrary to
  the initial framing — and found no evidence yet of Entry Criterion #2 (a real signed
  dLocal webhook verified against the new endpoint); stopped and asked Davin live
  rather than assume, per the order's own explicit gate. Second pass, after Davin's own
  shadow-run/debugging work landed: found two real bugs already fixed and recorded as
  Deviations, both explicit Davin-authorized scoped exceptions (EXECUTOR-PROTOCOL.md §7
  money/auth escalation) — `8e681297` (signature verification read a `x-signature`
  header dLocal never sends; real signature is `Authorization: V2-HMAC-SHA256,
Signature: <hex>` over `X-Login+X-Date+body`, not the raw body alone) and `1cc31b24`
  (webhook replay of an already-COMPLETED payment created a duplicate "Welcome to
  PRO!" `Notification` row — `Payment`/`Subscription`/`Commission` writes were already
  idempotent, only `notification.create()` lacked a guard). The order's own Deviations
  notes explicitly flagged that neither fix alone satisfied Entry Criterion #2 — asked
  Davin live whether the actual post-fix real-signed-payload replay had been verified;
  confirmed yes (correct `Payment`/`Subscription` DB writes, second replay idempotent).
  Also confirmed live: chain-length-one narrows to dLocal-cutover-first (see standing
  instruction above).
  **Flip executed** (order's Checklist step 3, dashboard-side, by Davin): dLocal
  Merchant Dashboard webhook URL updated to
  `https://money-service-production.up.railway.app/v1/webhooks/dlocal`. Railway logs
  checked immediately after: clean boot, no errors, but no real payment webhook had
  landed in that log window yet.
  **Monitoring caveat (order's Checklist step 4, not fully closed this session):** the
  first live post-flip delivery hasn't been directly observed — spot-check `railway
logs` for money-service on the next real dLocal payment (expect no errors, correct
  `Payment`/`Subscription` row updates) before treating dLocal as fully stable.
  Recorded in `migration-cutover-table.md`'s Slice 2 row.
  **Process note:** a `railway variables --kv` check (to confirm `DLOCAL_WEBHOOK_SECRET`
  was set) printed the actual secret value into the session transcript — should have
  been a value-blind existence check instead. Value not reproduced in any artifact;
  Davin may want to weigh rotation given it now sits in a transcript. New
  `LESSONS-LEARNED.md` entry recorded.
  **Artifacts updated:** `migration-cutover-table.md` (Slice 2 row →
  `CUT-OVER (dLocal only)`, RiseWorks portion noted separately), `CLAUDE.md` (this
  block, chain-length-one narrowing, Waiting-on). `DECISION-LOG.md` — no flag applies
  to this specific cutover mechanism, left unchanged.
- **Current order:**
  `docs/migration-orders/4a-5-money-service-webhooks-cutover.migration-order.md`
  (CONFIRMED by Executor 2026-07-24, executed for dLocal). RiseWorks split out to
  `docs/migration-orders/4a-5-rw-money-service-riseworks-webhook-cutover.migration-order.md`
  (still PRE-DRAFT, gated on RiseWorks's reply).
- **Order status:** dLocal CUT-OVER, all-green (monitoring caveat above). RiseWorks
  portion not started. **What shipped (dLocal only):**
  - Two live-escalated bugfixes (full detail in Current above): dLocal webhook
    signature verification (`8e681297`) and a replay-guard on webhook completion side
    effects (`1cc31b24`). Both documented as Deviations in the order itself, both
    tested (34/34 then full-suite 260/260 pass, `tsc --noEmit` clean).
  - dLocal's provider-dashboard webhook URL repointed to money-service's
    `/v1/webhooks/dlocal` endpoint — the cutover moment itself, per this order's own
    framing (no code flag, no redeploy).
  - RiseWorks's route stays deployed-but-silent exactly as 4A-4 left it — untouched,
    unweakened, zero live traffic, dashboard still pointed at the monolith.
- **Last session did:** Session 5-4 ("Fonts, Streaming & Phase 5 Exit Review",
  `next@16.2.10`) — closed 2026-07-23. Phase 5 (Next.js 16 Optimization) fully closed &
  verified (F10 RESOLVED): Google `Inter` font loader with system-font fallbacks,
  React 19 `<Suspense>` streaming boundaries verified across dynamic routes,
  `vercel.json`/`next.config.js` deployment rules validated. Full exit suite green:
  `type-check` 0 errors, `validate:lint` 0 errors, `build` 127/127 routes (29.82 MB
  bundle vs <340MB ceiling), `test:ci` 117/117 suites, 2082/2082 tests. Live Vercel
  production deployment verified (commit `be62d87f`).
- **Waiting on:** all Session 4A-4 items unchanged except where noted below (renumbered
  continuation). (1)-(6), (11)-(12), (17)-(20), (23), (27)-(29) unchanged — see prior
  closes for full text. **(26, PARTIALLY RESOLVED Session 4A-5)** `DLOCAL_WEBHOOK_SECRET`
  now confirmed set on Railway production (this session) — `RISE_WEBHOOK_SECRET` still
  not set, moves to `4A-5-RW`'s own entry criteria; Stripe/Resend secrets status
  unchanged/unverified this session. **(31, RESOLVED Session 4A-5)** Session 4A-5's real
  signed-payload replay requirement — done: real dLocal webhook traffic verified against
  the fixed signature-verification code, correct `Payment`/`Subscription` writes,
  second replay confirmed idempotent (Davin, live). **(37, NEW)** `4A-5-RW` (RiseWorks
  webhook cutover) is PRE-DRAFT and blocked on RiseWorks actually replying with
  webhook/API settings — including resolving the open `event`/`event_type` field-name
  question in that order's own Entry criteria. Do not approve/execute it without that
  information present, per its own Gate note. **(38, NEW)** dLocal's cutover (this
  session) flipped the dashboard URL, but the first live post-flip webhook delivery
  hasn't been directly observed in Railway logs yet (log buffer only covered the
  immediate post-flip window, no request traffic in it) — spot-check `railway logs` for
  money-service on the next real dLocal payment before treating dLocal as fully stable;
  same "monitoring caveat" pattern as Slice 1's #36. **(30, unresolved, now 3
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
- **Next session:** Davin's call. Chain-length-one now unblocks
  `docs/migration-orders/4a-7-money-service-read-apis-cutover.migration-order.md`
  (Read APIs cutover — its own browser-auth question already resolved, Waiting-on #34)
  — no longer needs to wait on RiseWorks. `4A-5-RW` (RiseWorks) stays PRE-DRAFT,
  gated on RiseWorks's reply (new Waiting-on item below). `Session 6-1` (Phase 6 Gap
  Matrix, `docs/migration-orders/6-1-gap-matrix-f11.migration-order.md`) was
  PRE-DRAFTed at 5-4's close, a separate track — Davin to decide ordering against 4A-7.
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
