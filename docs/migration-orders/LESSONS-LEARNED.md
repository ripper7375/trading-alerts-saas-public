# LESSONS-LEARNED.md — Skill Memory (rules distilled from failures)

**What this is:** the seventh memory file — reflexes. Where Deviations record _what happened once_ and the Decision Log records _what was chosen_, this file records **rules extracted from failures** so the same mistake is never debugged twice.

**Who writes:** the Executor, at session close. Write the RULE, not the story — one entry, ≤6 lines.
**Who reads:** the Executor, at every session OPEN.
**Hard cap ~40 active lessons.** Currently at 40 (L1–L40), right at the cap after the
2026-08-12 consolidation pass (64 → 25: 28 archived, 11 merged into 8 master rules,
then 4 unpromoted candidates promoted to L26–L29; L30 added 2026-08-20 ad-hoc, L31–L32
added Session 7-2, L33 added Session 4A-13, L34–L35 added Session 4A-14, L36–L37 added
Session 4A-15, L38–L39 added Session 9-0, L40 added Session 9-1).
Full history in `LESSONS-ARCHIVE.md`. **Next consolidation needed before any further lesson is
added** (count is at the cap, not past it — the next new lesson must consolidate first).

---

## Active lessons

### L1 — Never run Prisma schema migrations (`db push` / `migrate deploy`) from money-service

- Symptom: (Caught by Advisor before disaster) Running `db push` or `migrate deploy` from `money-service` drops all core tables.
- Root cause: `money-service` shares the monolith's database but only defines a _subset_ of the schema.
- Rule: ONLY run `prisma generate` in `money-service`. The monolith is the sole owner of the database schema and migrations. Never attempt to migrate the database from the `money-service` workspace.
- Source: Session 4A-6 (Advisor Review) · Status: ACTIVE

### L2 — A server-only import anywhere in a module taints the WHOLE module for every `'use client'` importer

- Rule: Any file that exports both client-safe values and server-only logic must be split into two files. Only `next build` catches this error, not `tsc` or `jest`. Run `npm run build` at least once per session that touches files imported by client components.

### L3 — Never trust an order's header status field alone; cross-check entry-criteria checkboxes and git history

- Symptom: an order arrived with header `Status: APPROVED` while its own Entry Criteria list still had an unchecked "Davin approves this DRAFT" box, and the file was untracked with no PRE-DRAFT→DRAFT→APPROVED commit history at all.
- Rule: at CONFIRM, cross-check the header's claimed status against (a) the order's own entry-criteria checkboxes and (b) git history for that file. A self-contradicting order is a stop-and-ask trigger, not something to silently trust or silently fix.
- Source: Session 4A-6 · Status: ACTIVE
- Recurrence count: 10+ times through Session 4B-3, each individually documented (full per-session
  detail moved to `LESSONS-ARCHIVE.md` per this file's own "5+ recurrences → single count line"
  hygiene rule) — Sessions 4A-3, 5-1, 4A-7b, 4A-W1, 4A-W2, 4A-W3a, 4A-W3b, 4B-2, 4B-3. Several
  further Sessions between 4B-4 and 4B-18d also flagged this exact pattern in their own CLAUDE.md
  close-outs (mostly benign — order body byte-identical to its committed PRE-DRAFT, only header
  metadata changed) without a matching entry ever being appended here; not reconstructed
  retroactively, flagged as its own gap. Recurred again at Session 4B-22: both the order file and
  `CLAUDE.md` were modified-but-uncommitted, `PRE-DRAFT → APPROVED`, matching committed `HEAD`'s own
  `PRE-DRAFT` — benign this time on two counts: the VERIFY-RETIRE variant is explicitly fast-path
  eligible per `EXECUTOR-PROTOCOL.md` §4 (no dropped DRAFT-stage requirement, unlike 4B-20's own
  case), and Davin's own chat message opening the session directly stated the APPROVED status and
  the F56 reconciliation, serving as the live confirmation this check exists to obtain. Most recent,
  and the most consequential to date:
  **Session 4B-20** (2026-08-03) — NOT benign: the working copy dropped its own committed
  PRE-DRAFT's explicit "not fast-path eligible under any circumstance... needs a full Advisor
  DRAFT and Davin APPROVED" framing entirely, jumped straight to `Status: APPROVED`/"Option B
  selected" with zero corresponding `DECISION-LOG.md` entry and all 4 Entry Criteria checkboxes
  still unchecked — on the single highest-blast-radius session in the whole migration (auth
  semantics). Resolved the same way as every prior instance (asked Davin directly rather than
  silently trusting or correcting); confirmed live as his own authentic decision and recorded as
  `DECISION-LOG.md` F56 before treating the entry criterion as satisfied. This is the single
  most-recurring finding class in this migration — still worth the Advisor's attention on whether
  the order-authoring pipeline itself should change (e.g. every status-field edit going through a
  reviewable commit) rather than relying on CONFIRM-time detection every single session, and this
  session is a concrete argument that the stakes of skipping that fix keep rising, not falling.
  Recurred again at Session 6-1 (2026-08-10) — benign: order + 5 supporting artifacts (`CLAUDE.md`,
  `DECISION-LOG.md`, cutover table, plan, playbook) rewritten in one internally consistent batch,
  no DRAFT-stage commit; confirmed live by Davin as his own authentic edit before treating any of
  it as trustworthy.
  Recurred again at Session 6-3 (2026-08-10) — this time with real body-content drift, not just
  header metadata: citation source swapped to a less-authoritative doc, an explicit "needs a
  design decision" open question silently resolved with no visible rationale, and a carried-forward
  Done-when item dropped. Confirmed live by Davin as authentic; he also resolved the design
  question directly and explicitly reinstated the dropped item rather than letting it stay lost.
  Recurred again at Session 6-12 (2026-08-11) — the working copy asserted F11 already resolved
  with the one artifact that should carry that evidence (`phase-6-frontend-gap-matrix.md`) still
  100% unfilled at first read. Confirmed live by Davin as authentic; the real triage then landed
  and was re-verified against the file itself, not the claim alone, before treating it as settled.
  Recurred again at Session 7-3 (2026-08-20) — benign: order arrived a bare `PRE-DRAFT` stub at
  committed HEAD but the full DRAFT→APPROVED upgrade on disk; confirmed live by Davin as authentic
  before execution. Recurred again at Sessions 4A-13, 4A-14, and 4A-15 (all 2026-08-21) — all
  three benign, all three confirmed live by Davin as authentic before execution. 18+ recurrences
  total — this is the single most-recurring finding in the migration; per this file's own hygiene
  rule, further benign recurrences get a count bump here, not a new paragraph.

### L4 — Never use `railway variables --kv` (or any unfiltered dump) to check whether a secret is set

- Symptom: checking that `DLOCAL_WEBHOOK_SECRET` was set on Railway production printed the actual secret value into the session transcript.
- Root cause: `--kv` (and the default table view) print real values, not just key presence; there is no built-in "exists only" flag.
- Rule: to check whether a secret is SET without exposing its value, grep for the key name only and report a boolean (e.g. pipe through something that reports match/no-match, never the matched line's content) — never display the value in any tool output, chat message, or artifact. If a value is accidentally displayed, do not repeat it, flag the exposure to Davin, and let him decide on rotation.
- Source: Session 4A-5 · Status: ACTIVE
- Recurrence (Session 4A-10b continuation, 2026-07-30): the risk isn't limited to `--kv`. `railway variable list --service <svc>` with NO flags at all (the default table view) ALSO prints real, unmasked values for every variable — `CRON_SECRET`, `DATABASE_URL`, `NEXTAUTH_SECRET`, `REDIS_URL`, and 4 dLocal secrets were exposed this way, on the assumption the default table masked values the way some other CLIs do. It doesn't. Rule extension: for Railway specifically, the ONLY safe way to check presence is `railway variable list --service <svc> --json` piped through a script that checks `Object.keys(...)` and prints booleans only — never render the default table, `--kv`, or `--json` output directly, regardless of which flag combination is used.
- Recurrence (Session 4A-11, 2026-07-30): even the "safe" `--json` + script method has a hole — a `head -c 300`/`cat`-style sanity check on the raw JSON file (meant only to confirm the fetch/parse worked before trusting the boolean check) printed operation-service's real `DATABASE_URL` and `NEXTAUTH_SECRET` straight into the transcript. Rule extension: NEVER read, `cat`, `head`, or otherwise preview ANY byte of a Railway variable dump file's contents, even for debugging the check itself — only grep for an exact key-name match (`grep -q '"KEY_NAME"'`) and report the boolean. If the boolean check itself seems broken, debug it with synthetic/fake JSON, not the real file.
- Recurrence (Session 4B-3, 2026-08-01): a THIRD distinct failure mode — `railway variables
  --service <svc>` with no flags prints a box-drawn table (`║ KEY │ value ║`), and piping that
  through `head -30` "just to see if a variable is there" printed `operation-service-worker`'s
  real `DATABASE_URL` and `NEXTAUTH_SECRET` in full. Separately, this box-table format is ALSO why
  several earlier value-blind checks in this same session using an anchored `grep -c
'^MIGRATE_ALERT_ENGINE'` pattern silently returned false negatives — the real line starts with
  `║ `, never matching `^KEYNAME`. Rule extension: the only reliable safe method across this whole
  incident class is `railway variables --service <svc> --kv | cut -d'=' -f1` (or equivalent),
  which both avoids ever rendering a value AND is immune to the box-table anchoring trap — never
  use `head`/`cat`/`tail` on any raw `railway variables` output, in any flag combination, for any
  reason, including "just checking the format."

### L5 — A guard that rejects before the DB means "route works" was never proven; the first authenticated call is the first schema test

- Symptom: (pre-emptive, Session 4A-7a) 12 money-service routes were verified as "registered and protected" by unauthenticated requests returning 401 — but `JwtAuthGuard` rejects before Prisma is ever reached, so nothing about the database was tested.
- Root cause: a 401 from an auth guard exercises the guard, not the handler. Services that define a hand-mirrored schema **subset** (money-service, operation-service) can diverge from the monolith without any test noticing.
- Rule: the first **authenticated** call to a newly deployed route is its first real schema test. If it fails on a Prisma column/model/relation/enum, that is a SCHEMA finding — stop and scope it as its own session. Never patch the transport/client around it (`select`, `omit`, defaulting, mapping), and never author schema from the consuming service (L1). See `DECISION-LOG.md` **F46**.
- Source: Session 4A-7a (Advisor review, 2026-07-25) · Status: ACTIVE

### L6 — `prisma migrate dev` does live drift detection against the target DB and can propose a full schema RESET; only `migrate diff`/`migrate deploy` are safe on a DB with pre-existing untracked drift

- Symptom: ran the order's literal `prisma migrate dev --create-only` against production. It printed "Drift detected... We need to reset the 'public' schema... All data will be lost" and only stopped short of the reset confirmation prompt because stdin wasn't a TTY (exit 130). The drift was pre-existing (untracked `db push`-applied tables/columns from past sessions) and had nothing to do with the schema edit being made.
- Root cause: `migrate dev` (any invocation, `--create-only` or not) first diffs the ACTUAL target database against what replaying the full migration history would produce; on any mismatch its only offered resolution is a destructive reset. This repo has no `SHADOW_DATABASE_URL` configured and no staging Postgres to rehearse against (F34/CC-A gap), so this check runs directly against production every time.
- Rule: **never run `prisma migrate dev` (in any form) against this production database.** To generate migration SQL for review without touching the database at all, use `prisma migrate diff --from-schema <pre-edit schema snapshot> --to-schema <schema.prisma> --script` (pure datamodel diff, zero DB connection). To apply an already-reviewed migration, use `prisma migrate deploy` (apply-only, no drift check, no reset path). Verify with `migrate status` (read-only) before and after, always through the SAME connection string the apply step used (see L19's recurrence).
- Source: Session 4A-W2 · Status: ACTIVE

### L7 — `enableShutdownHooks()` is not optional; without it every `onModuleDestroy` is dead code

- Symptom: `PrismaService.onModuleDestroy()` existed in money-service since Session 4A-1 and had never once run — no Railway redeploy had ever actually drained an in-flight query.
- Root cause: Nest only invokes lifecycle hooks on SIGTERM/SIGINT when `app.enableShutdownHooks()` is called in `main.ts`. Registered-but-never-enabled reads as handled when it isn't.
- Rule: any service with a lifecycle hook (`onModuleDestroy`/`OnApplicationShutdown`), a queue consumer, or in-flight external calls must call `app.enableShutdownHooks()`. Verify with a real test, not a code read alone — a synthetic `process.emit('SIGTERM', 'SIGTERM')` proves the wiring, but Nest's own shutdown listener re-sends the OS signal via `process.kill(process.pid, signal)` after cleanup, which will kill the test runner unless `process.kill`/`process.exit` are stubbed first.
- Source: Session 4A-W4 (2 pre-existing defects found by Advisor review 2026-07-25, fixed and verified 2026-07-26) · Status: ACTIVE

### L8 — A global `APP_GUARD` throttler also throttles your provider webhooks

- Symptom: `/v1/webhooks/dlocal` inherited the app-wide `ThrottlerGuard` default (100 req/60s) with no per-route override — a legitimate provider retry burst would 429 and be read as a permanent delivery failure.
- Root cause: `ThrottlerGuard` registered as `APP_GUARD` applies to every route by default, including ones whose caller is a payment provider you don't control and can't ask to back off.
- Rule: every payment-provider webhook route needs an **explicit**, generous per-route `@Throttle()` — never the inherited global default, and never `@SkipThrottle()` either (that trades throttling for unbounded flooding). Prove the override actually raises the ceiling with a real burst test against the real guard, not just a metadata-presence check — `@Throttle()` doesn't change the handler body, so an unchanged behavioral test suite proves zero regression but not that the new limit is real.
- Source: Session 4A-W4 (2026-07-26) · Status: ACTIVE

### L9 — Porting a dependency into money-service needs the monolith's PINNED version, not `npm install <pkg>`'s latest

- Symptom: Session 4A-9's Step 0 (`cd money-service && npm install stripe`) pulled `stripe@22.3.2`
  (latest) while the monolith pins `stripe@^14.10.0` — an 8-major-version gap. Surfaced as a real
  `tsc` compile error (`Subscription.current_period_end` moved off the SDK's top-level type in
  later major versions), not a silent bug — but a subtler API-version mismatch could easily have
  shipped clean and only misbehaved against Stripe's real API at runtime.
- Root cause: `npm install <pkg>` with no version specifier always resolves to the latest tag;
  nothing prompts a check against what version the code being ported was actually written
  against and tested with.
- Rule: when a PORT session installs any dependency into money-service that the monolith already
  depends on, check the monolith's `package.json` for its pinned version FIRST and install that
  exact version/range (`npm install <pkg>@<same-range-as-monolith>`) — never a bare
  `npm install <pkg>`. Behavior preservation (the PORT variant's whole premise) starts at the SDK
  version, not just the code that calls it.
- Source: Session 4A-9 (2026-07-27) · Status: ACTIVE

### L10 — A provider's "Invalid credentials" error can mean the request signing is wrong, not the secret values — check the code path before re-verifying config a second time

- Symptom: `money-service` returned the identical `403 Invalid credentials` (dLocal code 3001) on a
  dLocal payment-creation retry even after the credentials were refreshed and independently
  confirmed present. The real cause (found by re-reading the actual `fetch()` call, not by
  re-checking config again) was `dlocal-payment.service.ts:143-151` sending `X-Login`/
  `X-Trans-Key`/`Authorization` to the wrong fields — a byte-for-byte-preserved bug that predates
  this migration entirely (identical in the monolith's own original source).
- Root cause: L32 correctly established "verify the config is present in the new service's real
  environment" — but a provider's generic "invalid credentials" response is consistent with BOTH a
  wrong secret value AND a correctly-valued secret sent in the wrong header/field/signing scheme.
  Nothing distinguishes these from the error message alone.
- Rule: after a config-presence check passes (L32) and a provider still rejects credentials as
  invalid, read the actual outbound request construction (headers, signing/HMAC scheme, which
  field gets which secret) before asking for the credentials to be re-verified a second time —
  especially for code marked "ported byte-for-byte" from an older codebase, which may never have
  been exercised against the real provider API even before the migration. Compare against any
  sibling code path for the same provider that IS known-working (here, the inbound webhook
  verifier, fixed in Session 4A-5) — a working sibling often reveals the provider's real scheme
  directly.
- Source: Session 4A-10b continuation (2026-07-30), `DECISION-LOG.md` F48 · Status: ACTIVE

### L11 — Fixing the first bug a request hits can unmask a second, previously-invisible bug in the same code path; a live-fixed error message changing shape (not just disappearing) is real progress, not a new failure to panic over

- Symptom: fixing F48 (dLocal outbound signing) turned a `403 Invalid credentials` into a
  `400 Missing parameter: payment_method_flow` (F49) — a completely different, previously-unseen
  dLocal error. The request had never gotten far enough to reach dLocal's payload-validation layer
  before, since auth always failed first; F49 had been silently present, untriggered, this whole
  time.
- Root cause: a request that fails at step 1 (auth) never exercises step 2 (payload validation) —
  fixing step 1 doesn't just fix the request, it also turns on the lights for whatever was already
  broken at step 2. Neither this migration's code reads nor its mocked-`fetch` unit tests could
  have caught F49 while F48 was still masking it.
- Rule: when a live-verification fix changes an error's status code/shape rather than making the
  call succeed outright, that's a signal to keep investigating one layer deeper, not to assume the
  fix failed or is complete. Read the NEW error on its own merits (here: a genuinely different
  dLocal error code, 5001 vs. 3001) before concluding anything about the original bug — a changed
  error is usually progress, and conflating "still failing" with "still the same bug" wastes
  diagnostic time. Don't fix the newly-revealed bug in the same session unless it's trivially in
  scope; a live cutover attempt that reveals a second real bug is itself the deliverable (a new,
  correctly-scoped finding), not a reason to keep patching deeper into the money-moving path
  live in production.
- Source: Session 4A-10c (2026-07-30), `DECISION-LOG.md` F48/F49 · Status: ACTIVE

### L12 — A module shared into both an HTTP-process AppModule and a worker-process entrypoint auto-starts its side effects in EVERY process that constructs it

- Symptom: (caught by design before it shipped, not a live incident) 4B-2's own File 12 instruction
  ("Register AlertEngineModule in app.module.ts") means the module is imported by BOTH `main.ts`
  (HTTP process) and the new `main-worker.ts` (worker process) sharing one `app.module.ts`. A naive
  reading — `@Interval()` on the cron scheduler, an `OnModuleInit` subscribe loop on the worker
  service — would run BOTH the cron and the Redis pub/sub subscriber in EVERY process that
  constructs the module, not just the intended worker process: a genuine double-fire/
  double-consumption bug, not a hypothetical.
- Root cause: NestJS decorators (`@Cron()`, `@Interval()`) and lifecycle hooks (`OnModuleInit`) fire
  unconditionally in every application context that constructs the provider — module registration
  alone carries no notion of "which process is this," and neither does the decorator.
- Rule: when a module with active side effects (cron, queue consumer, pub/sub subscriber) is shared
  between two process entrypoints via one `app.module.ts`, gate the actual work behind an internal
  flag/method that only ONE entrypoint's own bootstrap flips on (e.g. `enable()`/`start()`) — never
  rely on module-registration or decorator presence alone to imply "this process should run it."
  money-service's own `CronsScheduler` already does exactly this shape (every `@Cron()` handler
  checks `isCronEnabled()` before doing real work) — same pattern, generalized to any module shared
  across a multi-process topology, not just a global on/off flag.
- Source: Session 4B-2 (2026-07-31) · Status: ACTIVE
- Recurrence (Session 4B-3, 2026-08-01): the exact mistake this lesson describes was made for
  real, one session after it was written — commit `0d74f645` made `operation-service`'s HTTP
  process (`main.ts`, replicated) call `AlertWorkerService.start()`/`AlertCronScheduler.enable()`
  directly, gated only on an env-var check inside the shared entrypoint, not on which entrypoint
  file was running. Caught by re-reading `AlertWorkerService`'s own class comment (which cites this
  exact lesson's rationale near-verbatim) before the flag was ever set live, and reverted. Rule
  extension: an env-var check inside a SHARED entrypoint file is not the same as "only one
  entrypoint's own bootstrap flips it on" — if the HTTP process and the worker process both run the
  same `main`-style file, gate by something that varies per-PROCESS-TYPE (e.g. Railway's own
  `RAILWAY_SERVICE_NAME`, checked against the specific worker service's name), not by an env var
  that could legitimately be set the same way across replicas of the wrong process.

### L13 — Railway logs are unreliable for freshness or absence of output

- Symptom: `railway logs` returned stale output or nothing at all for failed/successful builds.
- Root cause: Railway CLI caches logs and `--latest` behaves inconsistently across build states.
- Rule: Always pair `--http` with `-n`/`--lines`. Use `--latest --build` for failed builds. For success, a direct HTTP/protocol check is more reliable than reading logs.
- Source: Sessions 4B-8, 4B-17 (Extends L38) · Status: ACTIVE

### L14 — Spot-check real DB schema after Prisma baseline

- Symptom: `applied_steps_count: 0` but zero error, table wasn't actually created.
- Root cause: A migration-history baseline can mark a migration finished without executing its DDL.
- Rule: After any baseline, spot-check the schema change is in the real database (e.g., `to_regclass()`).
- Source: Session 4B-12 · Status: ACTIVE

### L15 — An "already-built-but-unused" component can carry a latent bug that's never been exercised in production; read its real implementation before wiring a real action into it, not just its prop signature

- Symptom: Session 6-1b's order named `components/billing/subscription-card.tsx` as ready to mount for `/settings/billing`'s real cancel action. Reading its implementation (not just its exported props) before wiring found a real bug: its optimistic-cancel "Undo" button only clears local React state — it never calls a reactivation API — while the real `onCancel()` has already been `await`ed and resolved by the time Undo is clickable. Wiring the real cancel endpoint into it as-is would have meant a user who clicks Cancel then Undo within its 5s window sees "still PRO" while the subscription was, in fact, already cancelled.
- Root cause: a component that's never been mounted anywhere has never had its interaction logic exercised against a real backend call, no matter how complete its code looks or how confidently an order describes it as "already built." Its own file existing and type-checking proves nothing about whether its own internal assumptions (here: that Undo can meaningfully cancel an in-flight or completed async action) are actually correct.
- Rule: before wiring a real, consequential action (money, auth, destructive writes) into any component an order describes as "already built, just mount it," read that component's own implementation in full — not just its prop signature — and trace what each of its interactive paths actually does end-to-end. A found defect in a shared, never-fixed-by-this-session component is a real finding to disclose and route around (keep the existing, working flow; register a flag for a future fix), not something to silently wire in or silently patch as a drive-by.
- Source: Session 6-1b (2026-08-10), `DECISION-LOG.md` F64 · Status: ACTIVE

### L16 — A `next/navigation` `useRouter()` test mock must return a stable object reference, not a fresh literal per call, whenever the component under test puts `router` in a memoized hook's dependency array

- Symptom: `notification-list.tsx`'s `fetchNotifications` is a `useCallback` with `router` in its dependency array (needed to redirect on a 401). The test's `jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))` returned a NEW object literal on every call — since Next's real `useRouter()` is memoized/stable across renders but the mock wasn't, every re-render produced a new `router` reference, which recomputed `fetchNotifications`, which re-fired its own mount-effect, which re-rendered — a genuine re-fetch storm inside the test (33 spurious `fetch` calls from one simulated tab click) that has nothing to do with the app's real behavior.
- Root cause: an unstable mock for a value the real implementation guarantees stable (`useRouter()`, `useSession()`, any context-backed hook) can manufacture an infinite-ish render loop in ANY component that puts that value in a `useCallback`/`useEffect`/`useMemo` dependency array — the bug is invisible by reading the component's own source, since the real app never exhibits it.
- Rule: when mocking `next/navigation`'s `useRouter` (or any hook Next/React itself memoizes), return a SINGLE stable object created once outside the mock factory (`const mockRouter = { push: mockPush }; jest.mock(..., () => ({ useRouter: () => mockRouter }))`), never a fresh literal per call. Before trusting a component test with unexpectedly high fetch/render counts, check whether any mocked hook's return value is memoized in the mock the way it is in production.
- Source: Session 6-4 (2026-08-10) — `edit.test.tsx` uses the same unstable-per-call mock shape and would hit the identical bug if that component's own effects ever grow a `router`-dependent `useCallback`; worth a follow-up check when that file is next touched. · Status: ACTIVE
- Recurrence: Session 6-8 (2026-08-11) — hit again writing `checkout-return.test.tsx`/`upgrade-success.test.tsx` (fresh `{ push: mockPush }` object per `useRouter()`/`useSearchParams()` call); caught before commit, fixed with the same hoisted-stable-object pattern.

### L17 — `middleware.ts`'s matcher and `app/(dashboard)/layout.tsx`'s own `getServerSession`+`redirect` are two INDEPENDENT auth gates; bypassing one alone does not make a page public

- Symptom: built two new pages meant to be reachable without a session (a public, token-based email-link flow) at `app/(dashboard)/settings/account/delete/{confirm,cancel}/page.tsx`, and added an exact-pathname allow-list to `middleware.ts` for both paths. Live, unauthenticated browser verification still showed both pages redirecting to `/login` — the middleware fix alone did nothing to stop the redirect.
- Root cause: `app/(dashboard)/layout.tsx` performs its own server-side `getServerSession()`+`redirect('/login')` on every page it wraps, entirely independent of `middleware.ts` — it exists specifically as defense-in-depth (per its own doc comment) and does not consult the middleware's decision at all. Any page file physically placed inside that route group inherits this gate regardless of URL, matcher, or an edge-level allow-list.
- Rule: to make a page genuinely public while it lives at a URL prefix an auth-gated route group's layout would otherwise wrap, the page file must be moved OUT of that route group entirely (a sibling route group with no auth-gated `layout.tsx` — Next.js route groups are transparent to the URL, so the path is unaffected) — a middleware allow-list is necessary but never sufficient on its own for a route group with its own server-side auth check in `layout.tsx`. Verify with a real unauthenticated browser request after ANY change meant to make a page public, not just a code read of `middleware.ts` — the two gates fail independently and a fix to one can look complete while the other still blocks everything.
- Source: Session 6-5 (2026-08-11) · Status: ACTIVE

### L18 — Mock/test fidelity

- Rule: Mocks and assertions must reflect real data contracts; a ported test that needs its assertion changed is a finding; never mock a field name the real model doesn't have.
- Source: Consolidated · Status: ACTIVE

### L19 — Railway monorepo deployment

- Rule: Railway builds need explicit rootDirectory in railway.toml; deploying a monorepo subdirectory requires Nixpacks, not Dockerfile, and root-level install configs must not interfere.
- Source: Consolidated · Status: ACTIVE

### L20 — Railway internal networking

- Rule: Use _.railway.internal:PORT for service-to-service; _\_PUBLIC_URL is external only and costs egress. Never use a public URL for internal traffic.
- Source: Consolidated · Status: ACTIVE

### L21 — Config presence vs documentation

- Rule: .env.example proves a key is known, not deployed; verify real values via `railway variables` or the deployment dashboard, never infer presence from documentation.
- Source: Consolidated · Status: ACTIVE

### L22 — Order text vs ground truth

- Rule: Order text drifts from ground truth — always read SOURCE directly; never trust the order's paraphrase of existing code, tests, or behavior.
- Source: Consolidated · Status: ACTIVE
- Recurrence (Session 9-1, 2026-08-22): a specific sub-case worth naming — when a Phase-9 order says "delete/port file X," verify which TREE X actually lives in before acting, not just that X exists. `lib/i18n/locale-resolver.ts` was cited as an existing main-repo dependency but only existed in `seed-code/`; `components/header.tsx`'s Batch-0-flagged deletion target only ever existed in `seed-code/` (read-only, do-not-touch), never the main repo the order named. Both found by checking `ls` on both trees directly rather than trusting the order's tree attribution.

### L23 — Monolith/microservice code drift after cutover

- Rule: After cutover, duplicated logic between monolith and microservice drifts silently; the monolith's forwarding copy becomes dead code where edits have zero live effect. Always check both sides.
- Source: Consolidated · Status: ACTIVE

### L24 — Verification context reliability

- Rule: Verification results are only valid in context — Railway logs for timing, background checks with in-flight edits, and scoped lint runs can all give false clean results. Re-run fresh, full-scope, with nothing in flight.
- Source: Consolidated · Status: ACTIVE

### L25 — Cross-origin browser verification

- Rule: Non-browser clients bypass CORS and CSP. Use a real browser with DevTools Network WS filter to confirm cross-origin connections; diff repeated success-log timestamps to detect reconnect loops.
- Source: Consolidated · Status: ACTIVE

### L26 — A cut-over monolith route still compiles and passes tests; check `migration-cutover-table.md` before treating it as live

- Rule: After cutover, old monolith endpoints remain on disk, compile, and pass their tests — but carry zero live traffic. Before building admin/ops UI that triggers or monitors "the scheduled jobs," check the cutover table for that slice's actual routing status, not just that route files exist.
- Source: Session 6-11 (promoted 2026-08-12) · Status: ACTIVE

### L27 — A gap-matrix row's `BUILT` verdict must cite its own independent evidence, not a sibling row

- Rule: Before accepting any gap-matrix row's `BUILT`/`VERIFIED` verdict in a phase-exit review, verify the cited session's order actually scoped that row's distinct deliverable. Rows whose "Backing evidence" cross-references a sibling row rather than citing their own file/commit are especially suspect.
- Source: Ad-hoc session 2026-08-11 (promoted 2026-08-12) · Status: ACTIVE

### L28 — `npm install` fails at the monolith root once any pnpm `workspace:*` dependency exists; use `pnpm add -w` instead

- Rule: Plain npm cannot parse pnpm's `workspace:` protocol. At the monolith root (a pnpm workspace), always use `pnpm add -w <pkg>[@version]`. This is root-only — `operation-service`/`money-service` are plain npm projects (not pnpm workspace members, per F9), so `npm install` still works inside them.
- Source: Session 7-1 (promoted 2026-08-12) · Status: ACTIVE

### L29 — `@nestjs/swagger` only introspects body schemas from class-validator DTOs, not Zod; route paths/methods still work

- Rule: On a Zod-validated NestJS service, `@nestjs/swagger` emits correct route paths/methods/params but generic `type: object` for request/response bodies (Zod's `z.infer<>` types erase at compile time, carrying no decorator metadata). Accept generic body schemas or plan a separate `zod-to-openapi` step.
- Source: Session 7-1 (promoted 2026-08-12) · Status: ACTIVE

### L30 — A fully-mocked unit test suite can pass 100% while missing a real Next.js Response API constraint; verify redirects live, not just via mocks

- Symptom: `GET /api/affiliate/dashboard/resources/[id]/download` redirected to `asset.fileUrl` unchanged. All 6 unit tests passed (the mocked `NextResponse.redirect` echoed any string back uncritically). Live browser verification against the real dev server 500'd instead: `NextResponse.redirect('/marketing-icon.svg')` throws `TypeError: Invalid URL` — the real Next.js redirect helper requires an ABSOLUTE URL, and a relative `/public`-style path (the exact shape 3 of the 4 seeded assets use) is a completely normal input, not an edge case.
- Root cause: a mock that echoes its input back verifies wiring, not the real API's contract — the test suite could reach 100% green without ever exercising the real validation path.
- Rule: for any route calling `NextResponse.redirect()`/`Response.redirect()` on a value that could come from stored data (not a hardcoded literal), resolve it to absolute first (`new URL(value, request.url)`) and add a unit test for the relative-input case specifically. Live-verify redirect routes against a real dev server before calling a session done — this bug was caught only that way, not by 100%-passing mocked tests.
- Source: Ad-hoc session 2026-08-20 (Marketing Resources / Media Kit) · Status: ACTIVE

### L31 — Swapping a hand-rolled `fetch()` wrapper for `openapi-fetch` breaks every test that mocks `global.fetch` with a minimal `{ok, status, json}` object — real `Response`/`Request` objects are required

- Symptom: migrating `app/api/auth/token-*` from `callOperationService()` onto `createOperationApi()` (Session 7-1's generated `openapi-fetch` client) turned every one of 5 existing test files' passing tests into uniform 500s. The real error, only visible with `--silent` off: `TypeError: Cannot read properties of undefined (reading 'get')` inside `openapi-fetch`'s `coreFetch`.
- Root cause: `openapi-fetch` reads `response.headers.get('Content-Length')` before parsing, then parses via `response.text()` (not `.json()`), and calls the real underlying `fetch(request, init)` with a genuine `Request` object as the first argument — none of which the old wrapper's bare `fetch(url, init)` + `.json()` ever required, so `{ok, status, json: async () => body}` mocks satisfied the old code path but not the new one.
- Rule: when migrating any route/wrapper onto an `openapi-fetch`-based generated client, replace every mocked fetch response with a real `new Response(JSON.stringify(body), {status})` (never a hand-rolled object), and rewrite any assertion reading `mock.calls[0]` as `(url, init)` to instead read `mock.calls[0][0]` as a real `Request` (`.url`, `await .text()`) — do this for every test file touching a migrated route before assuming "tests still green" proves nothing changed.
- Source: Session 7-2 (2026-08-20), `DECISION-LOG.md`-adjacent order Deviation 4 · Status: ACTIVE

### L32 — `@nestjs/swagger` can omit query-parameter (not just body) schemas entirely for Zod-validated routes — check `parameters.query` in the generated `schema.ts`, not just `requestBody`, before trusting a generated client's typed surface

- Symptom: `lib/api/generated/money-api/schema.ts` (Session 7-1) has `parameters.query?: never` on **every** money-service operation — worse than the "generic `type: object`" body gap Session 7-1 disclosed. Discovered only by reading the raw schema file directly, not by trusting the generated clients' own header comments (which described the gap as body-only).
- Root cause: `@nestjs/swagger` has no class-validator DTO metadata to introspect for a Zod-validated route's `@Query()` params, same underlying cause as the body gap (L29) — but the failure mode is silent (`never`, not a usable generic type), so a caller passing real query params gets a compile error, not a loose-but-working type.
- Rule: before writing a call site against ANY generated OpenAPI client for a Zod-validated NestJS service, grep the real `schema.ts` for that operation's `parameters.query` (and `requestBody`) — don't assume from another service's or another session's disclosed gap that the shape is the same. Work around a `never` query type with a single narrowly-scoped cast (e.g., append the query string to a literal path, cast once) rather than casting every call site individually.
- Source: Session 7-2 (2026-08-20), order Deviation 5 · Status: ACTIVE

### L33 — A service's DB role can be missing a grant on a table its code has always needed; this stays invisible until that table's FIRST real write, not caught by any test or dry run

- Symptom: money-service's `StripeWebhookController` (built Session 4A-9, dormant 25 days) hit
  `Database error. Code: 42501. Message: permission denied for table "User"` on its very first
  real production event — twice (initial delivery + Stripe's automatic retry), both failing the
  identical way. `money_svc`'s Postgres role had never been granted `UPDATE` on `User`.
- Root cause: unit tests use mocked Prisma clients (never touch real Postgres RBAC at all); a
  local dev connection commonly runs under a more permissive role than production's per-service
  grant; and a route that has genuinely never processed real traffic has never exercised its own
  write path against the real role it will actually run under. None of L5's "first authenticated
  call is the first schema test" logic catches this — a `42501` is a grant gap, not a schema gap,
  and a request can pass every schema check while still failing here.
- Rule: when cutting over a service's write route that is about to receive its FIRST real
  production traffic (dual-delivery, shadow window, or otherwise), budget explicitly for a
  DB-grant-gap failure class in addition to schema/logic drift — a `42501` on the exact tables the
  route needs to write is diagnosable in minutes once seen, but nothing short of a real write
  against real production credentials surfaces it beforehand. Before disabling any prior/fallback
  path after such a cutover, confirm the observed real event actually reached every write inside
  the same transaction, not just the first one that happened to fail loudest.
- Source: Session 4A-13 (2026-08-21), `DECISION-LOG.md` F75 · Status: ACTIVE

### L34 — `railway logs`/`railway status` silently default to the linked service, not the directory you ran them from or the service you meant

- Symptom: querying money-service's logs during a live smoke test (`cd money-service && railway logs --http --path /v1/payments/dlocal/create`) returned nothing, twice, across two different query shapes — appearing to mean the request never reached money-service. It had. The commands were actually querying `operation-service-worker` (an unrelated alert-engine worker, and this Railway project's default _linked_ service), not `money-service` — `cd`ing into a subdirectory does not change which service Railway's CLI targets.
- Root cause: `railway status`/`railway logs` resolve the target service from the project's linked-service config (set once via `railway link`/`railway service`), not from the current working directory or any inferred context. Running them from inside `money-service/` looks like it should scope to that service; it doesn't.
- Rule: always pass `--service <exact-name>` explicitly on every `railway logs`/`railway status` call when more than one service exists in the project — never rely on directory context. An empty/negative result from an unscoped Railway CLI call is not evidence of absence; verify the service name first (`railway status` lists all services and which one is linked).
- Source: Session 4A-14 (2026-08-21) · Status: ACTIVE

### L35 — A local `.env`/`.env.local` `DATABASE_URL` is not guaranteed to be the real production database; a "clean" read-only query result needs a sanity check before it's trusted as verification

- Symptom: a read-only Prisma query for a specific `Payment` row (needed to verify an orphaned-row cleanup) returned "not found," and a broader scan returned zero `PENDING` rows — appearing to confirm the row was cleaned up. It wasn't necessarily: a later query, for a DIFFERENT row that money-service's own first-party structured log had just proven was created seconds earlier, also returned "not found" — and a plain `count()` on the same connection showed **0 total `Payment` rows and 8 total `User` rows**, nowhere near consistent with months of real production/migration activity. The local `DATABASE_URL` was pointing at the wrong database the entire session; both "verified clean" results were false negatives.
- Root cause: a query returning zero rows is consistent with BOTH "the data was genuinely cleaned up" and "this connection isn't the database the data lives in" — nothing about a clean, error-free query result distinguishes the two, and a local `.env` file's `DATABASE_URL` can silently point at a stale/personal/dev database without any error at connection time.
- Rule: before trusting ANY read-only DB query result as verification evidence (not just an absence-of-rows result), sanity-check the connection identifies the right database — a rough `count()` on a table known to have substantial real data (e.g., total `User` or `Payment` rows) should be in a plausible range, not suspiciously near zero. When a query result contradicts a first-party service log that just asserted the opposite (as happened here), trust the service log and re-verify the query's own target, not the other way around.
- Source: Session 4A-14 (2026-08-21), `DECISION-LOG.md` F76 · Status: ACTIVE

### L36 — This repo's pre-commit hook (lint-staged) can leave a purely-cosmetic working-tree/index diff after a commit has already succeeded; verify before trusting a post-commit `git status`

- Symptom: twice in Session 4A-15, `git status` showed a file as `MM` (staged, then further modified) immediately after that file's own commit had already succeeded and was verified via `git log`. `git diff` against `HEAD` showed the difference was whitespace/line-wrapping only (prettier's multi-line style vs. the Edit tool's original single-line output) — zero logic change.
- Root cause: the hook stashes pre-hook state, runs `eslint --fix`/`prettier --write` on staged content, commits the formatted version, then pops the stash as cleanup — which can reintroduce the pre-format (pre-hook) file content into the working tree and index on top of the commit that already happened, even though `HEAD` itself holds the correctly formatted version.
- Rule: if `git status` shows a just-committed file as modified again, diff it against `HEAD` before assuming real uncommitted work exists. If the diff is whitespace/formatting-only, `git checkout HEAD -- <file>` to resync (safe — `HEAD` already holds the tested, committed version); never re-stage or re-commit a "revert to unformatted" as if it were new work, and never fold it into a later, unrelated step's commit.
- Source: Session 4A-15 (2026-08-21) · Status: ACTIVE

### L37 — An order's own risk-framing/runtime-state claims can be stale even on the day it's drafted; cross-check against the project's own already-correct maintained artifacts, not just live infrastructure

- Symptom: Session 4A-15's order (PRE-DRAFTed and DRAFTed/APPROVED all on 2026-08-21) asserted `OUTBOX_PUBLISHER_ENABLED` was disabled ("zero production risk"). It had actually been `true` in production since Session 4A-12 (2026-07-30) — over three weeks earlier — and `migration-cutover-table.md`'s own Slice 5 row already recorded this correctly at the time the order was drafted.
- Root cause: the order's narrative was carried forward from F50's original 2026-07-30 finding (written when the publisher genuinely was off) without being re-checked against either live infrastructure or this project's own other maintained artifact that already had the correct, current answer.
- Rule: at CONFIRM, don't just re-verify an order's claims against live infrastructure (L22) — also check them against this project's other maintained documents (`migration-cutover-table.md`, `DECISION-LOG.md`'s register) that may already record the correct current state, especially for flag/toggle state tied to a past session's cutover. A same-day draft is not automatically fresh.
- Source: Session 4A-15 (2026-08-21) · Status: ACTIVE

### L38 — `next lint` has been removed from this Next.js version's CLI entirely; `npm run lint`/`npm run eslint` both silently fail

- Symptom: Session 9-0's entry-criteria checklist called `npm run eslint -- app components lib hooks --max-warnings 5` — that script doesn't exist in `package.json` (only `lint`/`lint:fix`, both `next lint`). Running the real `lint` script also failed: `next lint` errored with `Invalid project directory provided, no such directory: .../lint`, because `next --help` lists no `lint` subcommand at all in this version — the CLI parses the literal word "lint" as a positional directory argument instead.
- Root cause: a Next.js version bump removed the `next lint` command outright (per this repo's own standing "this is NOT the Next.js you know" warning) without anyone updating `package.json`'s `lint`/`lint:fix` scripts, which still shell out to the now-nonexistent subcommand.
- Rule: don't trust `npm run lint`/`npm run eslint` to produce real signal on this repo until `package.json` is fixed. Call `npx eslint <dirs> --max-warnings <n>` directly instead — it works today and matches the project's real `eslint.config.mjs`. Whoever next touches `package.json`'s scripts should replace `"lint": "next lint"` with a direct `eslint` invocation.
- Source: Session 9-0 (2026-08-22) · Status: ACTIVE

### L39 — Citing a source document by one-line summary (instead of reading it in full) can silently mischaracterize a gap's real scope

- Symptom: `frontend-swap-route-map.md`'s own gap inventory (Session 9-0) described the 38-file "Light Clean Mode hardcoded-dark" bug as "distributed — each session fixes its own files as it ports them," citing `codebase-2-parity-audit/batch-0-shared-shell.md` only secondhand. Reading that file in full while PRE-DRAFTing Session 9-1 (same close-out pass) showed the bug's own root files render on 5 of the 6 Protected pages — no session can "fix its own files" without touching shared chrome one specific session (9-1) owns. A second finding from the same full read (a hard "6 Protected pages, never modify" constraint, confirmed live by Davin 2026-08-17) wasn't in `frontend-swap-route-map.md` at all — it exists only in the parity audit's own §0, which nothing in Phase 9 planning had surfaced up to that point.
- Root cause: building a gap inventory under time pressure from a document's own paraphrase (or a prior citation of it) rather than reading the cited source's full text trades completeness for speed — the paraphrase can drop a scoping detail (here: which files, and their render-tree entanglement with a separately-documented Protected-pages list) that changes who owns the fix and how.
- Rule: when a gap-inventory or route-map row cites a parity-audit/spec document, read that document in full at least once per phase (not just its citing session's own summary) before treating its "owning session" assignment as settled — especially for any gap touching shared/shell-level files, which are exactly where a dropped scoping detail does the most damage. If a fuller read changes an earlier session's own artifact, amend that artifact directly (with a dated addendum note) rather than only correcting it in the next session's own order.
- Source: Session 9-0/9-1 PRE-DRAFT (2026-08-22) · Status: ACTIVE

### L40 — `jest.setup.js` wires a REAL `fetch` (undici), not a mock; any component with an un-awaited network call crashes the worker on test teardown even after every assertion passes

- Symptom: wrapping `app/not-found.tsx` in `LocaleProvider` for the first time in the test suite (Session 9-1, porting codebase 2's shell) passed all 8 assertions, then crashed the Jest worker process on teardown (`Cannot read properties of null (reading '_location')`) — `LocaleProvider`'s first-visit branch fires a real `fetch('https://ipapi.co/json/')` for geo-detection when no cookie/localStorage preference exists (always true in a clean jsdom test), which was still in flight when the test file's window tore down.
- Root cause: `jest.setup.js` assigns `global.fetch` to a genuine `undici` fetch implementation (needed for other tests that exercise real HTTP semantics), not a mock — so any component rendered in a test that fires an un-awaited `fetch()` in a `useEffect` silently attempts a real network call, and jsdom's fast teardown after synchronous assertions finish races that pending promise.
- Rule: before rendering any component that transitively mounts `LocaleProvider` (or any other provider with a fire-and-forget network call) in a test, mock `global.fetch` to reject/resolve immediately for that test file — don't rely on the "tests already passed" result as proof the file is clean. No repo-wide default mock exists yet; add one to `jest.setup.js` if this recurs a third time.
- Source: Session 9-1 (2026-08-22) · Status: ACTIVE
