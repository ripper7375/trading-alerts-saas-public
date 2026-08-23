# LESSONS-LEARNED.md — Skill Memory (rules distilled from failures)

**What this is:** the seventh memory file — reflexes. Where Deviations record _what happened once_ and the Decision Log records _what was chosen_, this file records **rules extracted from failures** so the same mistake is never debugged twice.

**Who writes:** the Executor, at session close. Write the RULE, not the story — one entry, ≤6 lines.
**Who reads:** the Executor, at every session OPEN.
**Hard cap ~40 active lessons.** Currently at 40 (L1–L44, with L20/L21/L26/L34 merged away), after
the 2026-08-12 consolidation pass (64 → 25: 28 archived, 11 merged into 8 master rules, then 4
unpromoted candidates promoted to L26–L29; L30 added 2026-08-20 ad-hoc, L31–L32 added Session 7-2,
L33 added Session 4A-13, L34–L35 added Session 4A-14, L36–L37 added Session 4A-15, L38–L39 added
Session 9-0, L40 added Session 9-1, L3 compressed + L41 added Session 9-5, Session 9-6: L20+L21
merged into L19, L34 merged into L13 — both were already-terse Railway-CLI one-liners covering the
same theme as their merge target — and L42 added; L43 added Session 9-7a; Session 9-7b: L26 merged
into L23 — same "post-cutover monolith code looks alive but isn't" theme, no content lost — and
L44 added, plus an addendum to L43; Session 9-8a: no new lesson added (stayed at the cap) --
recurrence notes appended to L42 (stale `.next` cache, no version bump this time) and L43 (a third
browser-tool timing gotcha, synchronous read racing React's batched re-render after a click));
Session 9-8b: no new lesson added (stayed at the cap) -- recurrence notes appended to L42
(money-service-not-running half recurred a third time, distribute-codes this time) and L43 (a
fourth browser-tool gotcha, `computer` `left_click` silently not registering, `element.click()`
via `javascript_tool` as the reliable workaround). Session 9-9: no new lesson added (stayed at the
cap) -- a recurrence note appended to L15 (a data-shape variant of the same "never-exercised code
carries a latent bug" theme: an API route returning `transactions`/`auditLogs` as siblings of
`batch`, not nested inside it, went undetected because `PaymentBatch` had zero rows until this
session's own live-verification seeded one). Session 9-10: no new lesson added (stayed at the
cap) -- a recurrence note appended to L42 (stale `.next` cache, second occurrence with no version
bump or leftover server involved). A genuinely new candidate lesson surfaced this session (a
deferred action item written into `migration-stack-analysis.md`'s own per-session prose, rather
than registered as a `DECISION-LOG.md` flag, went unaddressed by three intervening sessions that
each touched the very file it was about) but was not promoted, per this file's own cap rule --
noted in Session 9-10's own Deviations for the Advisor to consider consolidating into an existing
lesson or promoting once room exists.
Full history in `LESSONS-ARCHIVE.md`. **At the cap — the next new lesson must consolidate first**
(same rule Session 9-6 hit at 41; nothing to merge yet, all 40 are still genuinely distinct).

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
- Recurrence count: 26+ times through Session 9-5 — the single most-recurring finding class in the
  migration, almost always benign (order body byte-identical to its own committed PRE-DRAFT, or a
  DRAFT/corrected-DRAFT arriving as an uncommitted working-copy edit; Davin's own live confirmation
  is what closes the check every time). One genuinely NOT benign, worth keeping as a worked
  example — **Session 4B-20** (2026-08-03, auth semantics, the highest-blast-radius session in the
  migration): the working copy silently dropped its own committed PRE-DRAFT's explicit "not
  fast-path eligible... needs full Advisor DRAFT and Davin APPROVED" framing, jumping straight to
  `Status: APPROVED` with zero `DECISION-LOG.md` entry and all 4 entry criteria still unchecked.
  Resolved the same way as every recurrence: ask Davin directly, never silently trust or silently
  correct. Compressed here 2026-08-22 (Session 9-5) per this file's own "5+ recurrences → single
  count line" rule; full per-session detail through Session 9-2 in `LESSONS-ARCHIVE.md`.

### L41 — A page's DOM carrying a hidden, duplicate copy of its own content is React/Next's own Suspense-streaming reveal mechanism, not an app bug — verify with computed style, not element count

- Symptom: `querySelectorAll` on `/settings/appearance` (and independently `/login`) found 2 of
  every heading/button in a real `next build && next start` production DOM. Traced the second copy
  to `<div id="S:0">` alongside inline `$RC`/`$RT`/`$RV` scripts — this pinned Next.js version's own
  streaming-SSR "reveal" mechanism (any route with a Suspense boundary, including a plain
  `loading.tsx`, streams resolved content wrapped in a hidden `id="S:N"` div + a relocation script)
  — apparently doesn't always clean up the wrapper after relocating its content.
  `getComputedStyle` showed `display:none`, 0×0 rect: fully inert, non-interactive, invisible.
- Rule: before treating a DOM element-count mismatch as a real double-render bug, check the
  element's own `display`/`visibility`/bounding-rect, not just its count — an `id="S:N"` node with
  `display:none` and a 0×0 rect is inert framework plumbing, not application-code duplication. This
  is very likely `DECISION-LOG.md` F77's actual root cause (found on `/alerts`, closed undiagnosed
  at Session 9-4 after extensive isolation found no trigger) — F77's own "SSR HTML verified clean
  via `fetch()`" finding is consistent with exactly this mechanism.
- Source: Session 9-5 (2026-08-22), `DECISION-LOG.md` F77 addendum · Status: ACTIVE

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

### L13 — Railway CLI observability has two independent failure modes: stale/absent log output, and silently targeting the wrong service

- Rule (freshness): `railway logs` can return stale output or nothing for failed/successful
  builds — pair `--http` with `-n`/`--lines`, use `--latest --build` for failed builds, and prefer
  a direct HTTP/protocol check over reading logs to confirm success.
- Rule (targeting): `railway logs`/`railway status` resolve from the project's linked-service
  config, NOT the current directory — `cd`ing into a service's subdirectory does not scope the
  command to it. Always pass `--service <exact-name>` explicitly whenever more than one service
  exists; an empty/negative result is not evidence of absence until the service name is verified
  (`railway status` lists all services and which is linked).
- Source: Sessions 4B-8, 4B-17, 4A-14 (merged L13+L34, Session 9-6) · Status: ACTIVE

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
- Recurrence (Session 9-9, 2026-08-23): a data-shape variant of the same theme, not an
  interaction-logic one. `app/(dashboard)/admin/disbursement/batches/[batchId]/page.tsx`'s
  `fetchBatch()` did `setBatch(data.batch)`, but `GET /api/disbursement/batches/[batchId]` returns
  `transactions`/`auditLogs` as SIBLINGS of `batch`, not nested inside it — `batch.transactions`
  was `undefined` for literally every batch, not just empty ones, and crashed the page
  (`Cannot read properties of undefined (reading 'filter')`) the instant it was pointed at any
  real batch. `PaymentBatch` had zero rows in this DB until this session's own live-verification
  seeded one — the page's own code had type-checked and "looked complete" every prior session
  that read it, because nothing had ever actually loaded it against real data.

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

### L19 — Railway deployment, networking, and config-presence gotchas

- Rule (deployment): a monorepo subdirectory build needs explicit `rootDirectory` in
  `railway.toml` and Nixpacks (not Dockerfile); root-level install configs must not interfere.
- Rule (networking): use `*.railway.internal:PORT` for service-to-service calls —
  `*_PUBLIC_URL` is external-only and costs egress; never use a public URL for internal traffic.
- Rule (config presence): `.env.example` proves a key is known, not deployed — verify real
  values via `railway variables` or the dashboard, never infer presence from documentation.
- Source: Consolidated (merged L19+L20+L21, Session 9-6) · Status: ACTIVE

### L22 — Order text vs ground truth

- Rule: Order text drifts from ground truth — always read SOURCE directly; never trust the order's paraphrase of existing code, tests, or behavior.
- Source: Consolidated · Status: ACTIVE
- Recurrence (Session 9-1, 2026-08-22): a specific sub-case worth naming — when a Phase-9 order says "delete/port file X," verify which TREE X actually lives in before acting, not just that X exists. `lib/i18n/locale-resolver.ts` was cited as an existing main-repo dependency but only existed in `seed-code/`; `components/header.tsx`'s Batch-0-flagged deletion target only ever existed in `seed-code/` (read-only, do-not-touch), never the main repo the order named. Both found by checking `ls` on both trees directly rather than trusting the order's tree attribution.

### L23 — Post-cutover monolith code is deceptive: it compiles, passes tests, and may still take edits, but carries zero live traffic

- Rule: After cutover, duplicated logic between monolith and microservice drifts silently — the monolith's forwarding copy becomes dead code where edits have zero live effect, and old monolith endpoints stay on disk, compile, and pass their own tests with nothing routing to them. Always check `migration-cutover-table.md` for a slice's actual routing status before treating a route/handler as live, and check both sides (monolith + service) for drift, not just one.
- Source: Consolidated; merged L26 (Session 6-11, promoted 2026-08-12) into this entry, Session 9-7b (2026-08-23) — same root theme, no content lost · Status: ACTIVE

### L24 — Verification context reliability

- Rule: Verification results are only valid in context — Railway logs for timing, background checks with in-flight edits, and scoped lint runs can all give false clean results. Re-run fresh, full-scope, with nothing in flight.
- Source: Consolidated · Status: ACTIVE

### L25 — Cross-origin browser verification

- Rule: Non-browser clients bypass CORS and CSP. Use a real browser with DevTools Network WS filter to confirm cross-origin connections; diff repeated success-log timestamps to detect reconnect loops.
- Source: Consolidated · Status: ACTIVE

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
- Recurrence (Sessions 9-3, 9-4, 2026-08-22) — 3rd/4th occurrences, both fixed the same way: real
  `LocaleProvider` + `localStorage[LOCALE_STORAGE_KEY]` pre-seeded with `defaultPreferences` (skips
  the fetch branch entirely) + a `usePathname: () => '/'` stub; 9-4 also needed a `next-auth/react`
  mock it was missing entirely. Repo-wide `jest.setup.js` default still owed, 4 sessions running —
  this lesson's own stated trigger for adding one; the next session that hits this should add it.

### L42 — A local dev environment that doesn't mirror production's service wiring produces real-looking errors that are environment gaps, not app bugs — verify with a curl/log check before touching app code

- Symptom (Session 9-6): `POST /api/checkout` 500'd with `ECONNREFUSED` because
  `MIGRATE_WRITE_APIS_MONEY_STRIPE=true` forwards to money-service, which had no local `.env` and
  wasn't running. Separately, every `/api/auth/*` route 404'd after a Next.js version bump left a
  stale `.next` build cache behind (fixed by deleting `.next` and restarting — confirmed via a
  direct `curl` to the route returning 200 once cleared, not by reading app code).
- Root cause: a cutover flag or route can be 100% correct while the sibling service it forwards to
  simply isn't running locally (same class as Session 9-5's disclosed operation-service/2FA gap);
  a stale build cache from a framework version bump can present as a routing bug with no code
  change involved at all.
- Rule: before editing any code in response to a 500/404 that "shouldn't happen," check (a) is the
  forwarded-to service actually running (`curl` its health route or the failing route directly),
  and (b) does a clean `rm -rf .next` + restart change anything, especially right after any
  Next.js/framework version bump. If a sibling service needs its own local `.env` to test a real
  cutover path, create one reusing the same test-mode secrets already in root `.env.local` (per
  that service's own `.env.example`) rather than flipping the cutover flag off to dodge it — that
  tests the frozen fallback path, not the real one.
- Source: Session 9-6 (2026-08-22) · Status: ACTIVE
- Recurrence (Session 9-8a, 2026-08-23): the exact stale-`.next`-cache symptom (every non-root
  route 404s, `/` alone works) recurred with no framework version bump involved this time — just a
  dev server left over from a prior session. Same fix (`rm -rf .next`, restart) confirmed clean.
- Recurrence (Session 9-8b, 2026-08-23): the money-service-not-running half recurred a third time
  — `POST .../distribute-codes` 500'd (`ECONNREFUSED` in `lib/money-service/client.ts`) on the
  first live click; started via the existing `moneyservice` launch config, identical action
  succeeded (200 OK) on retry. Any admin/affiliate write route that proxies to money-service will
  hit this in a fresh dev environment until a session makes starting it the default.
- Recurrence (Session 9-10, 2026-08-23): the stale-`.next`-cache half recurred a second time —
  every non-root route 404'd right after `preview_start`/`next dev`, with no framework version
  bump and no leftover dev server involved this time (a genuinely fresh server start). Same fix
  (`rm -rf .next`, restart) confirmed clean before any live-verification work began.

### L43 — Browser-tool `form_input` on a checkbox/radio sets the DOM property without firing React's `onChange` — controlled state goes stale and a `disabled={!checked}` submit button silently stays disabled

- Symptom (Session 9-7a): `form_input` on the register form's terms checkbox showed
  `checked: true` in the DOM, but `formData.terms` (React state) stayed `false` and the submit
  button stayed disabled — no error, just a click that silently did nothing.
- Root cause: `form_input` writes the DOM property directly; React's controlled-input tracking
  relies on a real `input`/`change` event reaching its listener, which a direct property write
  doesn't dispatch.
- Rule: for a React-controlled checkbox/radio, use a real `computer` `left_click` on the element,
  not `form_input` — then verify with a quick `javascript_tool` read of `.checked` and the
  submit button's `disabled` state before clicking submit. `form_input` is fine for text/select
  inputs, whose value assignment does trigger React's listener.
- Source: Session 9-7a (2026-08-22) · Status: ACTIVE
- Recurrence (Session 9-7b, 2026-08-23): a second, distinct browser-tool gotcha in the same
  family — `computer` (`left_click`, `screenshot`, etc.) fails with "the Browser pane is not
  displayed" whenever the pane isn't actually visible in the user's UI, even though the tab is
  live and correctly loaded. `read_page`, `get_page_text`, `javascript_tool`, `form_input`, and
  `navigate` all work fine in this state — none of them need the pane composited. For headless/
  background live-verification (no user watching the pane), drive forms with `form_input` +
  `javascript_tool` (e.g. `el.click()`, `form.requestSubmit()`) and read results with
  `get_page_text`/`read_page`/network requests instead of retrying `computer`.
- Recurrence (Session 9-8a, 2026-08-23): a third gotcha in the same family — reading the DOM
  synchronously in the same `javascript_tool` call right after `el.click()` can race React's
  batched re-render, making a working `onClick` handler look like it silently did nothing (a form
  submit's resulting state update read as stale/absent). `await new Promise(r => setTimeout(r,
300))` before reading confirmed the state change had actually landed.
- Recurrence (Session 9-8b, 2026-08-23): a fourth gotcha — `computer` `left_click` on a `ref`
  silently failed to register a real click several times (dialog stayed closed, no request fired,
  no tool error) even with the pane displayed and a fresh `read_page` just beforehand, while other
  `computer` clicks in the same session worked fine; no reliable trigger found. `element.click()`
  via `javascript_tool` never failed as a workaround — prefer it over retrying `computer` when a
  click silently doesn't take effect.

### L44 — A hardcoded test-fixture `upsert` in a credentials `authorize()` callback can silently overwrite a real, live-earned DB state on every login

- Symptom (Session 9-7b): `free-test@trading-alerts.test` was confirmed `isAffiliate: true` in the
  DB at CONFIRM (a real Session 9-7a registration). Live-verifying F79's fix, logging in via the
  login page's own "FREE User" quick-fill flipped it straight back to `false` — `User.updatedAt`
  moved to the exact login timestamp. `lib/auth/auth-options.ts`'s `FIXED_TEST_ACCOUNTS` map
  hardcodes `isAffiliate: false` for this email, and its `prisma.user.upsert()` writes that
  hardcoded value on **every** login (not just first-ever creation), unconditionally clobbering
  any real state a product flow (registration, tier upgrade, etc.) had since given the account.
- Root cause: an `authorize()`-time upsert meant to guarantee a seeded test account always exists
  can't distinguish "first login, create with defaults" from "Nth login, an app flow already
  changed this row for a real reason" — using one hardcoded `update` payload for both silently
  regresses the second case every time.
- Rule: before trusting a named test-fixture account's DB state as stable across a session, check
  whether the login path itself (`authorize()`/credentials callback, any bridge login route) does
  an unconditional `upsert`/`update` on that email — if so, its hardcoded fields will reset on the
  next login, and a state your own session's earlier step (registration, upgrade) established can
  vanish the moment you or a later session logs in again. Never fix this by hand-holding around it
  silently; if it blocks a session's own required live-verification, restore the DB value directly
  (documented as a workaround, not a fix) and register the upsert itself as its own flag — it's
  auth-semantics, out of scope for a UI session to patch inline (`EXECUTOR-PROTOCOL.md` §7).
- Source: Session 9-7b (2026-08-23), `DECISION-LOG.md` F80 · Status: ACTIVE
