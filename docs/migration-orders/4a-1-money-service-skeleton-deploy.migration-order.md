# Migration Order — money-service: skeleton + deploy

> **Status: PRE-DRAFT** — written by the Executor at Session 3-5's close, per
> `EXECUTOR-PROTOCOL.md` §3.5. Needs the Advisor to produce the DRAFT (this is an
> INFRA-variant session, not VERIFY-RETIRE — no fast-path; full chain: PRE-DRAFT →
> Advisor DRAFT → Davin APPROVED → Executor CONFIRMED).
> **Session:** 4A-1 · **Phase:** Phase 4A — money-service (Workstream 5), plan §6 /
> blueprint §5.2–5.3 · **Candidate variant:** `TEMPLATE-INFRA.md` (per
> `00-SKELETON-AND-RULES.md`'s own variant table, which names 4A-1/4B-1 explicitly)
> · **Flags touched:** F15 (Redis topology), F16 (public URL scheme + `/v1`
> versioning) — both must resolve before the first Phase 4 cutover (4A-2/3), per
> the playbook's own instruction for this session.

## Why this session, why now

Phase 3 (session 3-5, this close) proved the hybrid-auth bridge works end-to-end
(SSR path, browser path, refresh, revocation, expiry — SVC_TOKEN descoped per
F31) and left all Phase 3 exit flags resolved in the Decision Log. Per the
playbook (`monolith-to-microservices-migration-session-playbook.md` line ~256),
the very next session is **4A-1 — money-service skeleton + deploy**, the start of
Phase 4A (the money-service strangler track, its own 5-slice blueprint). This is
a genuinely new phase, not a continuation of Phase 3's work — flagging that
explicitly so the Advisor doesn't need to re-derive it (L23's lesson: always use
the playbook's own next-session number, never invent one; confirmed here it
really is 4A-1, not an ad-hoc label).

## Head start already in place (don't rediscover this)

- **`money_svc`/`core_app` Postgres roles already exist and are credentialed** —
  created Session 1-3, password-reset and durably persisted to Railway variables
  in Session 1-3b (`MONEY_SVC_DB_PASSWORD`/`CORE_APP_DB_PASSWORD`/
  `PGBOUNCER_USERLIST_B64`, `DECISION-LOG.md`). Positive+denial grant checks were
  verified working as of that session. Re-verify (roles can drift/expire) but this
  is NOT a from-scratch step.
- **PgBouncer is already deployed and Online** on Railway (`pgbouncer` service,
  confirmed via `railway status` at this session's close, 2026-07-21) — Session
  1-3/1-3b's work. money-service's `DATABASE_URL` should point through it
  (`pgbouncer.railway.internal`), matching `operation-service`'s own convention
  (L3: migrations use the DIRECT url, runtime uses the pooled one).
- **A shared Railway Redis instance already exists and is Online** (same project,
  used today by `operation-service`'s `ThrottlerModule`). F15's plan-recommended
  default is exactly this — one shared instance, per-service key prefixes +
  separate BullMQ queue namespaces, split only on measured contention. Strongly
  recommend confirming this default rather than provisioning a second Redis
  instance, unless Davin has a reason to isolate it.
- **`operation-service/` is a working, deployed reference implementation** for
  almost everything this session needs structurally: `main.ts` (helmet/CORS
  pattern — though money-service's CORS scope differs, see below),
  `PrismaService` (driver-adapter pattern, `ssl: { rejectUnauthorized: false }`,
  L32), `ConfigModule`/`ThrottlerModule` wiring, `railway up --path-as-root`
  deploy mechanics (L33 — this WILL bite again for a second subdirectory service
  unless the same flag is used from the start), and the root `tsconfig.json`
  `exclude` requirement (L30 — money-service must be added to it in the same
  commit it's scaffolded, exactly like `operation-service` needed).

## Candidate scope (raw, for the Advisor to firm up — not exhaustive)

Per the playbook's own line for this session: "money-service NestJS skeleton
(blueprint §5.2), Railway deploy with `money_svc` role via PgBouncer, `/health`
live, secrets from the 0-4 matrix. Populate `migration-cutover-table.md`
(pre-scaffolded) with real slice rows. Also resolve F15 and F16 — they must
precede the first cutover."

1. Scaffold `money-service/` — skeleton only (blueprint §5.2's file tree), NOT
   the 5 domain modules' business logic (affiliate/billing/payments/disbursement
   — those are separate BUILD sessions per slice, 4A-4 onward). This session's
   `/health` + auth guard + Prisma service, mirroring `operation-service`'s own
   skeleton-first precedent (Session 3-1).
2. Add `money-service` to root `tsconfig.json`'s `exclude` list in the SAME
   commit it's created (L30 — do not let this slip to a `git push` discovery).
3. F16 decision needed from Davin before this session can pick real route
   prefixes: `api.<domain>/v1/...` is the plan's own recommendation (implementation
   plan line 721) — confirm or override.
4. F15 decision: recommend confirming the existing shared Redis instance
   (see above) rather than a new one — needs Davin's explicit sign-off since
   it's a named flag, not just a technical default.
5. Railway deploy: `money-service`, `money_svc` DB role via PgBouncer,
   `DATABASE_URL`/`REDIS_URL`/`NEXTAUTH_SECRET` + money-domain secrets
   (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `DLOCAL_*`, `RISE_*`,
   `RESEND_API_KEY`) per the 0-4 secret matrix (`docs/secret-matrix.md`) —
   confirm which of these already exist vs. need Davin to supply new ones.
   **`SVC_TOKEN` will need to actually exist for the first time here** if F16/
   this session's scope includes any core↔money internal call — Session 3-5
   found zero real `SVC_TOKEN` implementation anywhere in the codebase (F31);
   this may be the session where it's finally built, or it may still be
   deferred again — the Advisor should decide explicitly, not by default.
6. Populate `migration-cutover-table.md`'s real slice rows (the file is
   currently just the placeholder example row) — one row per blueprint §5.5
   slice (crons, webhooks, read APIs, write APIs + Stripe webhook, tier-update
   event path), status `MONOLITH` for all (nothing has cut over yet).
7. CORS: money-service's own `enableCors` should allow only the Vercel
   origin(s) — this is a DIFFERENT posture from `operation-service`'s F30
   ("CORS confirmed unnecessary, server-side proxying continues") IF the
   frontend calls money-service directly per-blueprint §5.4 ("data hooks point
   at `NEXT_PUBLIC_MONEY_API_URL`") rather than through a Next.js proxy layer —
   the Advisor should confirm which posture this plan actually wants before
   assuming either one; don't silently copy F30's answer across services
   without re-checking it applies.

## Known gaps to flag, not silently route around

- No staging environment exists (Phase 0's CC-A gap, unchanged) — this session's
  local-testing approach will need the same L31/L32/L33-style recipe this
  session (3-5) used successfully, or Davin's explicit "test locally, deploy
  directly" call (matching F25/F28's precedent) if local money-service testing
  proves impractical (Stripe/dLocal webhook signature verification may need
  provider sandbox credentials not yet confirmed available locally).
- Vercel access still doesn't exist in this environment (Waiting-on #4,
  unchanged since Session 1-1) — any "frontend now calls money-service" claim
  can only be verified locally, same limitation as every 3-x session.

## Entry criteria (candidate — re-verify at CONFIRM)

- [ ] F15: Davin's decision on Redis topology (confirm shared-instance default
      or require a new dedicated instance).
- [ ] F16: Davin's decision on the public URL scheme + `/v1` versioning.
- [ ] Secret matrix reviewed: which money-domain secrets already exist
      (Stripe/dLocal/RiseWorks credentials) vs. need Davin to supply.
- [ ] `money_svc`/`core_app` Postgres roles + PgBouncer re-verified live and
      authenticatable (not just "were working as of Session 1-3b").

## Rollback

Additive-only session (new service, no existing code touched) — rollback is
`railway service delete money-service` plus reverting the `tsconfig.json`
exclude-list commit. No cutover happens this session (that's 4A-2/3+), so
nothing live is at risk if this session needs to be reverted.

## Deviations

_(filled during execution)_
