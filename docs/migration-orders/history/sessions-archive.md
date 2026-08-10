# Session History Archive

Superseded session entries moved from `CLAUDE.md` per `EXECUTOR-PROTOCOL.md` §3 step 3.
Most recent entries at the top. For the current and previous sessions, see `CLAUDE.md`.
Each session's canonical record lives in its own `*.migration-order.md` file — this archive
preserves the inline summaries that were originally written into `CLAUDE.md`'s state block.

---

_(superseded-by-above, retained for context)_ Session 6-1b (Mock-Data Hotfix, PORT variant, low dial), CONFIRMED, executed,
CLOSED (partial — live manual check not done, see below) 2026-08-10, same day as Session 6-1.
**All 3 fabricated-data pages plus the 1 fabricated field Session 6-1 identified (A1-1/A1-2/
A1-3/A1-4) are now genuinely wired to real endpoints — zero mock data remains anywhere in the
4 target files.**
**CONFIRM re-verified all 4 backing endpoints live before touching any code:** 3 of 4 matched
the order's own cited shape exactly (`GET /api/invoices`, `POST /api/subscription/cancel`,
`GET /api/admin/fraud-alerts/[id]`, `GET /api/alerts`). Found two real, execution-blocking gaps
the order's own entry criteria hadn't caught (`LESSONS-LEARNED.md` L27 class — the cited shape
was accurate as far as it went, but insufficient for what the file's own Port steps needed):
(1) `GET /api/subscription`'s response never carried `User.trialStatus`/`trialConvertedAt`/
`trialCancelledAt`/`hasUsedFreeTrial` — confirmed by a repo-wide grep that NO existing GET
endpoint exposes them anywhere — yet File 1's own Port step 1 requires driving a trial banner
from exactly those fields; (2) the real `FraudAlert.notes` is a singular `String?`, not the
mock's `string[]`, and `riskScore`/`paymentAttempts`/`previousAlerts`/`userAgent` don't exist
on the schema at all — a straight rewire of File 2 would throw at runtime. Reported both before
writing any code; Davin's live resolution: widen `GET /api/subscription`'s response additively
(small, non-breaking — no existing consumer exists to break, confirmed via grep), and adapt
File 2 to the real fields rather than fabricate the missing ones.
Monolith baseline re-measured at CONFIRM, zero drift from Session 6-1's own close: `tsc
--noEmit` clean; `eslint --max-warnings 0` — same 3 pre-existing warnings, 0 new; `test:ci`
129/129 suites, 2191/2191 tests; `git rev-parse HEAD` == `origin/main` (L38 check, no push gap).
**Built (4 files, one commit each, dependency order — read-only wiring first, the one
destructive action last):** File 4 (`/settings` alert count) — real `GET /api/alerts` count
replaces the hardcoded `alerts: 3`, with a real "Unable to load" state on fetch failure. File 3
(`/admin` activity feed) — the mock generator replaced with the 5 most recent real `FraudAlert`
rows via `GET /api/admin/fraud-alerts`, panel relabeled "Recent Fraud Alerts"; found mid-build
that the route's own `querySchema` enforces `pageSize >= 10` (the order's own suggested
`pageSize=5` would have 400'd), fetched the minimum allowed and trimmed to 5 client-side. File 2
(`/admin/fraud-alerts/[id]`) — `MOCK_ALERT` replaced with a real fetch, explicit 404/403
handling, status-transition actions (Dismiss/Mark Reviewed/Block User) call the real `PATCH`
and only update local state from the server's confirmed response, never optimistically. File 1
(`/settings/billing`, last) — `mockInvoices` and the hardcoded usage stats fully removed;
subscription/invoices/alert-usage all fetched from their real endpoints in parallel;
`components/billing/invoice-list.tsx` mounted for the real invoice table; the cancel dialog's
confirm action calls the real `POST /api/subscription/cancel` and re-fetches `/api/subscription`
on success to reflect the FREE downgrade without a page reload.
**A third gap found mid-build, not anticipated at CONFIRM:** reading `components/billing/
subscription-card.tsx` (the order's other named "already-built-but-unused" component) before
mounting it surfaced a real, pre-existing bug — its optimistic-cancel "Undo" button only clears
local UI state and never calls a reactivation API, while the real cancel call has already been
awaited and resolved by the time Undo is even clickable. Wiring the real `POST /api/subscription/
cancel` directly into this component would mean a user who clicks Cancel then Undo within its 5s
window sees "still PRO" while the subscription was, in fact, already cancelled server-side — a
real, money-adjacent, misleading-state bug. Fixing `subscription-card.tsx` itself was judged out
of this session's own scope (not one of the 4 target files; a drive-by fix to a shared component
is exactly the scope creep `EXECUTOR-PROTOCOL.md` §2 prohibits) — kept the existing hand-rolled
Card + `AlertDialog` cancel-confirmation flow instead (rewired to live data), which correctly
satisfies File 1's own Invariant ("must not regress the existing dialog's confirmation copy").
Registered `DECISION-LOG.md` **F64** (new, OPEN) for a future session to fix or retire it.
**Closed a real L28-class gap:** none of the 4 target pages had any test coverage before this
session (`__tests__/pages/settings/` and `__tests__/pages/admin/` didn't even exist) — built all
4 new test files (15 tests total), each proving real-data render, the relevant empty/error
state, and — for Files 1/2 — both the success and failure paths of their real write action.
**Full verification:** `tsc --noEmit` clean; `eslint app components lib hooks --max-warnings 0`
— same 3 pre-existing warnings, 0 new; `test:ci` **133/133 suites, 2206/2206 tests** (was
129/129, 2191/2191 — +4 suites/+15 tests, exactly matching this session's own new files, zero
regressions elsewhere).
**Not done this session, disclosed rather than silently skipped:** the order's own "Live manual
check of all 4 pages against real account data" done-when item. Session 4B-21 (F56) removed
`CredentialsProvider` from `lib/auth/auth-options.ts` — local email/password sign-in through the
standard NextAuth UI no longer exists; a real check now needs either a live OAuth account or the
auth-bridge with seeded operation-service credentials, neither set up in this session. Minting a
session token to bypass the UI was judged the wrong substitute for a page whose whole point is
"does this look right to a real logged-in user" — carried forward, not fabricated.
**No flag, no cutover-table row** — this session is deliberately flagless per its own header
(correctness fix, not a cutover); `migration-cutover-table.md` unchanged.
**Artifacts updated:** `6-1b-mock-data-hotfix.migration-order.md` (Status → CONFIRMED, executed,
CLOSED partial; Entry criteria all checked; Deviations filled in full — 3 entries; Slice-level
verification checked except the live-manual-check item, disclosed as not done), `DECISION-LOG.md`
(new **F64**, OPEN), `migration-stack-analysis.md` (new Session 6-1b entry, 4 files modified + 1
route widened + 4 new test files), this file (session-history hygiene: Session 4B-22's own full
text moved to `history/sessions-archive.md`, matching this file's own rotation rule — the larger
pre-existing backlog from 4B-21 onward, already flagged at Waiting-on #102, is unchanged and
still needs its own dedicated cleanup session), `LESSONS-LEARNED.md` (new **L57** — read an
"already-built-but-unused" component's real implementation, not just its prop signature, before
wiring a real action into it; harvested from the `subscription-card.tsx` finding). New
`6-2-ia-design-system-shared-shells.migration-order.md` PRE-DRAFTed (UI-BUILD variant, adapted,
no flags) — scoped from the gap matrix's own "→ 6-2" rows (F62 admin-tree consolidation,
`/settings` grid completion, dead nav-link removal, `not-found.tsx`/`global-error.tsx`,
marketing-footer nav). **Not fast-path eligible** — F62's own resolution (Davin's decision, 3
options presented, none chosen by this PRE-DRAFT) is a hard entry criterion; needs a full
Advisor DRAFT before CONFIRM. The live-manual-check carry-forward (Waiting-on #117) and
`DECISION-LOG.md` F64 both folded into 6-2's own Next-session handoff rather than spawning a
separate session for either.

---

_(superseded-by-above, retained for context)_ Session 6-1 (Frontend Gap Matrix & Endpoint Mapping, F11, CONTRACT variant),
CONFIRMED and executed 2026-08-10 — **CLOSED with F11 still OPEN. This is a deliberate,
disclosed partial close, not a silent shortfall:** the order's own Rollback clause says the
matrix "stays uncommitted rather than shipping half-triaged" if Davin's row-by-row triage is
incomplete — it is (the Triage column is empty throughout) — and Davin explicitly instructed
committing and pushing this session's work anyway, a recorded deviation from that default, not
a silent override either way.
**CONFIRM found the by-now-familiar `LESSONS-LEARNED.md` L11 pattern again**: the order file's
only committed version was the original PRE-DRAFT (`Status: PRE-DRAFT`, `Variant: AUDIT`,
2026-07-23, commit `702da51b`) — the working copy was a full rewrite (191 lines changed) to
`Status: APPROVED`, `Variant: CONTRACT`, with zero DRAFT-stage commit trail. The same
uncommitted batch also touched `CLAUDE.md`, `DECISION-LOG.md` (F61/F62/F63 pre-registered),
`migration-cutover-table.md` and both the implementation plan and session playbook (Phase 6
restructured 9→12 sessions) — all internally consistent with each other. Reported to Davin in
full before treating any of it as trustworthy; he confirmed live it was his own authentic edit
via the Antigravity Advisor, made 2026-08-10.
**Step 1 (independently re-verify the census, don't adopt on trust) executed for real:**
re-enumerated `app/**/page.tsx` (57 files, confirmed), `app/api/**/route.ts` (122 endpoints,
confirmed), and re-checked the two pre-computed input artifacts
(`docs/files-completion-list/ui-page-gap-analysis.md` + `ui-page-gap-register.xlsx`, produced
out-of-band 2026-08-10) against live code — every headline finding plus ~40 of the ~54
itemized Section A/C rows were independently re-derived via direct file/grep inspection, not
one substantively wrong. Confirmed exactly, at file:line precision: 56 real routes (not 54;
rows 18/18-5 are one dynamic route; 3 unregistered Admin detail pages exist in code); the 3
fabricated-data pages (`/settings/billing` zero `fetch(` in 439 lines, `/admin/fraud-alerts/[id]`
`MOCK_ALERT`, `/admin` mock activity feed); the admin-tree split (15 pages under
`app/(dashboard)/admin/*` + 8 under `app/admin/*` = 23, `app/admin/layout.tsx` confirmed
absent — `DECISION-LOG.md` F62); `middleware.ts`'s matcher confirmed to cover only
`/dashboard`, `/alerts`, `/charts`, `/settings` (F62-adjacent); all 14 dead internal links
individually checked and confirmed missing; `app/not-found.tsx` confirmed absent.
**Two corrections and one genuine addition found, all recorded in the produced matrix's own
"Corrections found this session" section:** a trivial off-by-one citation (`mockInvoices` at
line 61, not "60-61"); an imprecise nav-link claim on the duplicate affiliate payment pages
(A1-16 — the layout links to the Profile parent page and to the new payout-settings page, not
directly to the legacy page by that literal path; the substantive finding is unchanged); and a
real scope-narrowing find the source artifact missed entirely — `lib/geo/detect-country.ts`
already implements the exact `detectCountry(headers)`/`detectCountryFromIP(ip)` logic F61
needs, 100%-line-covered by its own test, with **zero importers anywhere** — F61's real fix is
a thin route wrapper around already-working code, not new detection logic. Six rows were not
independently re-verified beyond the source artifact (flagged explicitly in the matrix, not
silently marked "yes"); four Section B rows don't fit the order's own Step 3 session-assignment
table cleanly (flagged with a recommendation rather than forced in, per the order's own Rule).
**Regression baseline re-measured, not carried from the order's stale figures:** `tsc --noEmit`
clean; `test:ci` **129/129 suites, 2191/2191 tests** (exact match to the order's own cited
current baseline — genuinely re-confirmed, not assumed). **`eslint app components lib hooks
--max-warnings 0` is NOT clean** — 3 warnings (0 errors), `@next/next/no-location-assign-
relative-destination` on two pre-existing files neither touched this session or by this audit:
`components/layout/header.tsx` (lines 85, 89 — Session 4B-21's own deliberate full-navigation
logout fix, commit `160b4935`) and `app/(dashboard)/admin/disbursement/batches/[batchId]/
page.tsx` (line 236, predates the migration entirely, commit `b14e4a98`, Dec 2025). Root cause:
`eslint-config-next` is now `16.3.0`, newer than what was installed when 4B-21 last scope-
checked `header.tsx` alone and got clean — the rule is new or newly enforced since then, not a
regression either audit introduced. Recorded honestly per `LESSONS-LEARNED.md` L20's own
discipline rather than repeating "clean"; not fixed here (Rule 1: "No building... not one
bugfix" — this is a documentation-only session, and the two flagged files are unrelated to its
scope).
**Steps 2-4 executed:** `docs/migration-orders/phase-6-frontend-gap-matrix.md` produced (Step 2) — every row carries an ID, ownership, backing evidence, a re-verification status, and a
proposed target session (Step 3); F61/F62/F63 (already drafted uncommitted from the 2026-08-10
prep pass) finalized and committed as genuinely OPEN, owner Davin, with due sessions (Step 4).
**Step 5 (obtain Davin's triage) did NOT happen this session** — assigning `build` /
`internal-only` / `out-of-scope` to each row is Davin's own product judgment, explicitly not
the Executor's to infer (order Rule 3), and was not requested or provided in this session.
**F11 therefore stays OPEN** — this is the actual, load-bearing remaining gap, not a
documentation-completeness issue; the matrix is real and accurate, but nobody has yet decided
which of its ~54 rows get built.
**Artifacts updated:** `6-1-gap-matrix-f11.migration-order.md` (Status → CONFIRMED, executed;
Deviations filled in full), `docs/migration-orders/phase-6-frontend-gap-matrix.md` (new),
`DECISION-LOG.md` (F11 status updated to reflect matrix-delivered/triage-pending; F61 entry
extended with the `lib/geo/detect-country.ts` finding), `migration-stack-analysis.md` (new
entry for the matrix artifact), `LESSONS-LEARNED.md` (new lesson on scoped-vs-full lint checks;
L11 recurrence note), this file (session-history hygiene rotation: Session 4B-21's full text
moved to `history/sessions-archive.md`, a short pointer left in place — the larger pre-existing
rotation backlog from 4B-20 onward, already flagged at Waiting-on #102, is unchanged and still
needs its own dedicated cleanup session). New
`6-1b-mock-data-hotfix.migration-order.md` PRE-DRAFTed (PORT variant, low dial) per the order's
own Next-session handoff — scoped exactly to A1-1/A1-2/A1-3(mock half)/A1-4(count half), no
redesign, no new components, no layout changes.

---

_(superseded-by-above, retained for context)_ Session 4B-22 (Phase 4 Exit Review, VERIFY-RETIRE/AUDIT variant), CONFIRMED and
executed 2026-08-04 — **CLOSED: Phase 4 is CLOSED-WITH-NAMED-EXCEPTIONS, not cleanly closed.**
CONFIRM re-verified Session 4B-21's own close (git log `2105d1fd`, order file's own `Status:
CONFIRMED, executed, CLOSED SUCCESSFUL`, `DECISION-LOG.md` F56/F57/F58 all RESOLVED) — zero drift,
matches this file's own prior framing exactly.
**Criterion 1 ("143 BACKEND files retired") → MET WITH NOTED EXCEPTION.** The "143 BACKEND
files" figure (`migration-stack-analysis.md`'s own appendix: 72 CORE + 71 BUSINESS FUNCTION) is
a `lib/*` service-layer census, not an `app/api/**` route census — re-read the plan's own §6 text
closely this session and confirmed this distinction (route files are separately tracked under
exit criterion 2). Every domain module the plan's own 4A/4B sequencing named has been built and
cut over (4A: 8 crons, dLocal+Wise webhooks, read APIs, write APIs [3/4 groups; dLocal blocked on
F49], tier-update outbox; 4B: alert-engine, shared infra, alerts/drawings/notifications/tier/
user-2FA-sessions/market-data-proxy, realtime, auth, email rendering). **But the literal claim
"143 files retired FROM the monolith" does not hold**: the large majority of CC-F-frozen
monolith-side `lib/*` files (tier-config.ts, tier-validation.ts, disbursement/_, dlocal/_,
stripe/_, affiliate/_, drawing/schema.ts, etc.) remain present by deliberate, repeatedly-
documented design — every cutover session's own close-out explicitly says "deleting those copies
was explicitly not this session's job," deferring real file deletion to a dedicated future RETIRE
pass that has never been scheduled. This is a known, accepted, intentional gap (not a surprise),
but the criterion's own wording doesn't hold as literally true today. A genuine §5.6-style 30-day
stability window has also never been formally measured for any slice (live smoke tests have stood
in throughout, per the F44/F51 precedent) — worth naming, not blocking.
**Found and fixed this session, not new gaps but stale documentation:** `migration-stack-
analysis.md`'s CORE section still listed `railway-worker.json` and `lib/websocket/server.ts` as
present — both were actually deleted at Session 4B-17. Its BUSINESS FUNCTION section still listed
`emails/*` (5 files) and `lib/email/templates/affiliate/*` (5 files) as present — all 10 were
actually deleted at Session 4B-19. All 4 backfilled this session (Waiting-on #35/#93 CLOSED for
these specific entries — the broader "never independently re-audited every one of 143 files"
caveat still stands, a full reconciliation was judged disproportionate to this audit's own scope).
**Criterion 2 ("`app/api/**`reduced to only routes that intentionally remain") → MET WITH NOTED
EXCEPTION.** Fresh census of all 122`route.ts`files (full bucket breakdown in
`migration-stack-analysis.md`'s new "Session 4B-22" section): 1 genuinely deleted
(`auth/register`, 4B-21); ~34 flag-gated dual-implementation (old+new coexist behind a
`MIGRATE**` flag or client-side ternary); 8 are the bridge's own new-side routes (no flag needed
in the route itself); 6 are dead/orphaned code found this session (`auth/token-2fa-_`, zero UI
consumers, superseded by the different, already-live `/api/user/2fa/_` cutover — harmless, not
fixed, AUDIT variant); 7 orphaned by Slice 1's cutover (`cron/\*`, `vercel.json`'s crons array is
empty since 4A-3); 1 orphaned by an external dashboard repoint (`webhooks/dlocal`, 4A-5); 1
intentionally archived per F42 (`webhooks/riseworks`); 2 permanent intentional exceptions
matching the plan's own criterion-2 example (`auth/[...nextauth]`per F56,`realtime/token`per
4B-17's own design); ~64 were never part of Phase 4's own defined scope at all (most of
`disbursement/**`/`admin/**`beyond what got named,`affiliate/{auth,profile}/**`,
`candles/[symbol]`, `checkout/validate-code`, `config/affiliate`, `invoices`, ancillary
`payments/dlocal/\*`, `subscription`GET,`test/seed`— cross-checked against the plan's own
explicit 4A 5-slice/4B domain-module lists, confirmed these were simply never targeted).
**One real, unambiguous, previously-undiscovered gap found against the plan's own literal
scope, not fixed this session (AUDIT variant, reported to Davin):**`app/api/webhooks/
stripe/route.ts`is still 100% monolith-native. The plan's own §6 text explicitly scopes Slice 4
as "Write APIs **+ Stripe webhook\*\*" — money-service has had a fully-built, deployed
`StripeWebhookController`/`StripeWebhookService`since Session 4A-9 (2026-07-27), sitting
completely dormant for the ~8 days since; Stripe's dashboard webhook subscription was never
repointed and no`MIGRATE**`flag exists for it anywhere. Registered as`DECISION-LOG.md` **F60** (OPEN) — needs its own dedicated cutover session (verify the controller still matches
Stripe's real event shape after this much drift, repoint the dashboard URL mirroring the dLocal
precedent, prove it live with Davin present). Does not block declaring Phase 4
CLOSED-WITH-NAMED-EXCEPTIONS now.
**Criterion 3 ("NextAuth fully retired") → the F56 conflict, presented and resolved, not
silently amended.** Read the plan's own §6 text directly: criterion 3, as literally worded, is
false — F56 (Session 4B-20, Davin) keeps OAuth on NextAuth indefinitely. Per this order's own
Rules ("Davin's call to resolve, not the Executor's"), this was presented rather than silently
fixed — and since the order arrived APPROVED with the reconciled wording already agreed (Davin,
via Antigravity Advisor, 2026-08-04), applied that exact wording to the plan doc's own §6 (struck
the old text, added the amendment inline) and recorded it as`DECISION-LOG.md`**F59** (RESOLVED)
rather than treating the Advisor-level agreement as license to skip recording it here too.
**DECISION-LOG.md OPEN-flag review (Entry Criteria/Checklist step 5):** F21 (GDPR account-
deletion, needs Davin's product decision) and F47 (Wise non-USD quote bug, needs its own PORT
session) are real OPEN flags but are NOT Phase-4-exit-specific — both would exist identically
regardless of which phase boundary we're at, and neither blocks this declaration. F49 (dLocal
`payment_method_flow` gap, blocks Slice 4 Group B) and F50 (`COMMISSION_CREDITED`wrong
recipient, Slice 5, deliberately non-blocking by design) ARE Phase-4-slice-specific and are
named as the two concrete "partial cutover" exceptions under criterion 1. **Register-table
hygiene gap found and fixed:** F48-F52 had been archived to`history/decisions-archive.md` (2 RESOLVED, F49/F50 still OPEN) without ever being added to`DECISION-LOG.md`'s own register
table — against that file's own hygiene rule (OPEN flags stay in the main body). Backfilled all
5 register rows this session.
**Waiting-on backlog review:** the vast majority of the ~105-item backlog is either already
RESOLVED-but-not-pruned, or genuinely carries forward regardless of the Phase 4 boundary (secret
rotations owed, `market_data_v6`/`flask-api`ingestion questions,`LESSONS-ARCHIVE.md`encoding
corruption, this file's own session-history rotation backlog #102 — none of these are "Phase 4
transliteration didn't finish" gaps, they're general repo/ops hygiene that would be exactly as
open under any phase label). The genuinely Phase-4-scoped open monitoring items (#38 dLocal
webhook completion path never proven live, #40 Slice 3 first authenticated request never
directly observed, #78 Slice 5 first real event delivery still pending) all carry forward
unchanged — none are new, none are blocking, all were already honestly recorded as open
monitoring items by their own originating sessions.
**Phase 6 status checked, not assumed:**`6-1-gap-matrix-f11.migration-order.md`is still
genuinely`Status: PRE-DRAFT`, untouched since Session 5-4 (2026-07-23, `git log`shows zero
commits since) — dormant the entire time Phase 4B ran its course. Its own Entry Criteria cite a
test count (2082) that's now stale (this session's own re-run: 2191) — whoever picks it up next
should refresh its entry criteria before treating it as ready, not just flip its status.
**UPDATE 2026-08-10 (Advisor-side planning action, NOT a migration session — no code changed,
no flag flipped, phase/session unchanged):** the stale-entry-criteria warning above has been
acted on and Phase 6 has been restructured. A full out-of-band UI gap analysis was produced
(`docs/files-completion-list/ui-page-gap-analysis.md` +`ui-page-gap-register.xlsx`), which
discharges the _enumeration_ half of `DECISION-LOG.md`F11 — the triage half stays OPEN and is
still Session 6-1's whole purpose.`6-1-gap-matrix-f11.migration-order.md`is now
`Status: APPROVED`(Advisor-upgraded 2026-08-10, **Davin APPROVED same day** — ready for the
Executor to CONFIRM): its entry criteria were refreshed
(2082 → re-measure, last known 2191), and it is re-scoped from _performing_ the census to
**independently re-verifying it, extending it, assigning target sessions, and obtaining Davin's
triage.** It still builds nothing. **Phase 6 grew from ~9 to 12 sessions** — new **6-1b**
(mock-data hotfix, PORT), **6-10** (public/marketing surface), **6-11** (admin system
operations); the a11y/phase-exit session is renumbered **6-9 → 6-12** and **session number 6-9
is retired, do not reuse it** (same convention as the SUPERSEDED 4A-7). Three new flags
registered OPEN, all owner Davin: **F61** (`GET /api/geo/detect`is called by 2 components but
the route does not exist — 404 on every pricing load, due 6-8), **F62** (admin IA split across
two incompatible trees, 19 of 23 admin pages unreachable from the nav — due 6-2, structurally
hard to undo), **F63** (public legal pages`/terms`/`/privacy`/`/disclaimer` don't exist though
the signup consent checkbox links to two of them — blocks 6-10, compliance-relevant).
Playbook, plan §8, plan §11 flag register, cutover-table conventions and
`migration-stack-analysis.md`all updated to match; handbook`migration-process-handbook-
antigravity-v9.xlsx` supersedes v8. **The three fabricated-data pages found by the analysis
(`/settings/billing`, `/admin/fraud-alerts/[id]`, `/admin`) were deliberately NOT fixed** —
6-1 audits, 6-1b fixes; a drive-by fix would have been exactly the scope creep
`EXECUTOR-PROTOCOL.md` §2 prohibits.
**Regression baseline (Checklist step 6), independently re-run this session, not assumed
green from memory:** monolith`tsc --noEmit`clean,`eslint app components lib hooks
--max-warnings 0`clean (0 errors/warnings),`test:ci`129/129 suites, 2191/2191 tests.
`operation-service` `tsc --noEmit`clean, 42/42 suites, 385/385 tests.`money-service` `tsc
--noEmit`clean, 62/62 suites, 522/522 tests (one flaky SIGTERM-timing failure on the first
concurrent run —`prisma.shutdown.spec.ts`, matching L25's own documented timing sensitivity —
reproduced clean both in isolation and on a second full-suite run with no other suite competing
for CPU; not a real regression). Zero regressions anywhere — matches or exceeds every prior
session's own baseline.
**Verdict: Phase 4 is CLOSED-WITH-NAMED-EXCEPTIONS.** Every domain slice the plan itself named
has been built; nearly all have been cut over; the two real open items (F49/dLocal, F60/Stripe
webhook) are each scoped, owned, and have their own path to a dedicated follow-up session — this
is a genuine, bounded, honestly-reported partial completion, not a silently-waved-through green
checkmark. **Phase 5 stays closed (Session 5-4, 2026-07-23, unaffected).** Phase 6's own Session
6-1 is the next real session on the plan's own dependency chain — PRE-DRAFT, needs its entry
criteria refreshed (stale test count) before Advisor DRAFT/Davin APPROVED, per the note above.
**Artifacts updated:** `4b-22-phase-4-exit-review.migration-order.md`(Status → CONFIRMED,
executed, CLOSED; Done-when all checked with the exceptions named; Deviations filled in full —
10 entries),`DECISION-LOG.md`(F59 new/RESOLVED, F60 new/OPEN, register-table backfill for
F48-F52),`monolith-to-microservices-migration-implementation-plan.md`(§6 criterion 3 amended
per F59),`migration-stack-analysis.md`(4 stale entries backfilled, new Session 4B-22
route-census section),`migration-cutover-table.md`(Slice 4 row annotated with the F60
finding),`LESSONS-LEARNED.md`(new **L54** — the 143-files-is-a-lib-census-not-a-route-census
distinction; new **L55\** — archiving a batch of flags can silently carry still-OPEN ones out of
the main register table too; L11 recurrence tally updated), this file. New`4a-13-stripe-webhook-cutover.migration-order.md`PRE-DRAFTed
(VERIFY-RETIRE/CUTOVER block) per this order's own explicit Rule ("a genuine gap requiring code
changes gets its own dedicated follow-up session, not a same-session fix") — closes
`DECISION-LOG.md`F60, mirrors the dLocal/4A-5 dashboard-repoint precedent exactly, does not
rebuild anything (money-service's receiving side is already fully built and deployed). Otherwise
points at the already-existing, needs-refresh`6-1-gap-matrix-f11.migration-order.md` — the
order's own "no further PRE-DRAFT beyond 4B-22 is implied" instruction was about the *normal\*
happy-path handoff (Phase 6), not a bar on drafting a follow-up for a genuine gap this same audit
found, which its own Rules section separately requires.

---

_(superseded-by-above, retained for context)_ Session 4B-21 (Auth Cutover & UI Rewire, PORT/UI-BUILD hybrid), CONFIRMED, executed,
**CLOSED SUCCESSFUL 2026-08-04.** Step 1 (UI swap) done and fully verified;
Step 2 (local smoke test) executed and returned RED per the order's own explicit rule.
**CONFIRM found the same `LESSONS-LEARNED.md` L11 self-contradiction that hit 4B-20 recurring
immediately**: the working copy jumped `PRE-DRAFT → APPROVED` with no DRAFT stage, silently
dropped the committed PRE-DRAFT's own "NOT fast-path eligible... needs a full Advisor DRAFT"
framing, and claimed "entry criteria verified" while all 4 checkboxes were unchecked and one
(session-cache staleness) was a genuinely unresolved architecture question. Reported in full;
Davin confirmed live (`AskUserQuestion`) it was his own authentic edit. Re-running 4B-20's own
greps found real drift: 2 live consumers not on either session's file list
(`hooks/use-login-tracking.ts` via `components/auth/login-tracker.tsx`, `hooks/
use-realtime-socket.ts`) — approved for inclusion; a third, `hooks/use-auth.ts`, is dead code in
the monolith, flagged not touched.
**Entry Criterion 1 resolved as `DECISION-LOG.md` F57** (Davin, live): force a `getSession()`
refresh at every auth-mutating bridge call site rather than replacing `SessionProvider` with a
custom auth-context — this shrank Step 1's real scope to just 4 files that complete/end a login
(`login-form.tsx`, `verify-2fa/page.tsx`, `header.tsx`, `app/admin/login/page.tsx`) plus 4 more
with a simple endpoint swap and no cache implications (`forgot-password`, `reset-password`,
`verify-email`, `verify-email/pending`) — the other ~15 files are pure `useSession()` readers
needing zero changes, confirmed by checking each has no `signIn()`/`signOut()`/`getSession()`
call of its own.
**Also found (Deviations #6): the order's own Step 1 text over-scoped "2FA setup/verify/disable/
backup-codes" as needing new `token-2fa-*` wiring** — `/api/user/2fa/*` already forwards to
operation-service via a DIFFERENT, already-live flag (`MIGRATE_USER_2FA`, Session 4B-11); wiring
the 5 redundant `token-2fa-*` routes would have been pure duplication — not done. The one genuine
2FA gap was the mid-login completion call in `verify-2fa/page.tsx`, which now re-POSTs to
`token-login` with the same `__2fa_verified__` sentinel instead of calling `signIn('credentials',
...)`.
**A real, pre-existing, unrelated bug found and left unfixed** (out of PORT scope):
`forgot-password/page.tsx`'s embedded `?token=` reset step sends `newPassword` instead of
`password` — has always failed validation on both the legacy and bridge endpoint; confirmed this
path is unreachable in practice (the real reset email points at `/reset-password?token=...`
instead, whose own page sends the correct field). Preserved byte-for-byte, not fixed.
**Full verification (Step 1):** `tsc --noEmit` clean, `eslint app components lib hooks
--max-warnings 0` clean, full `test:ci` 129/129 suites, 2190/2190 tests (3 new test files, 2
extended). 3 commits: `d964d609` (F57), `d9ee2843` (CONFIRM), `c5c9fd31` (Step 1 code).
**Step 2 (local integration smoke test, Davin's own chosen method via `AskUserQuestion`): a
scratch script against a local monolith dev server (flag on) pointed at real production
`operation-service`, reading verification/reset tokens directly from production's own DB rather
than an inbox.** Register → verify-email → login → logout → forgot-password → reset-password →
re-login all passed cleanly end-to-end against real production `operation-service` — proves this
session's own new `token-*` call sites and the F57 fix both work correctly.
**RED RESULT — `DECISION-LOG.md` F58 (new, OPEN):** every operation-service `/user/*` route
(profile, 2FA — both cut over since Session 4B-11, unrelated to this session's own code) returns
"User not found" for a user created via `token-register`, despite the row provably existing —
proven via a direct production-DB query at the EXACT moment of the failure. Reproduced across 3
fresh test users. Extensively ruled out before escalating (not guessed at): JWE encode/decode
mismatch (read both `encodeNextAuthToken`/`decodeNextAuthToken` directly, both correct), stale-
read/wrong-database (direct `DIRECT_URL` query proved the row exists at the exact failure
moment), 2FA-specific code (`GET /api/user/profile` — a different route, same lookup shape —
fails identically), and this session's own changes (4B-21 touched zero files under
`operation-service/src/users/`, `two-factor.service.ts`, or the Prisma schema; `AuthController`'s
own routes — all genuinely new-in-this-session call sites — work correctly for the same row
throughout). Leading hypothesis, NOT confirmed (no access from this environment to verify):
operation-service's live production deployment may be running an older build than this checkout
for the `UsersController`/`TwoFactorService` code path — every prior session that exercised
`/user/*` routes did so against the long-lived canonical test fixtures
(`affiliate-test@trading-alerts.test`/`free-test@trading-alerts.test`, created via the OLD
monolith path long before this migration), never against a row created via operation-service's
OWN `AuthService.register()` — this exact interaction may simply never have been exercised
before. `operation-service` has no connected GitHub source (L23/L38, Waiting-on #77) — a redeploy
requires a manual `railway up`, so "the checkout is correct" does not imply "the running instance
matches it."
**Per this order's own explicit rule ("any red result at Step 2 = abort, do not proceed to
production flip"), Steps 3-6 (Davin's flip approval, the flag flip, the production smoke test,
retiring `CredentialsProvider`) are BLOCKED until F58 is resolved.** 3 tagged test users
(`4b21-smoke-*@trading-alerts.test`) were created in production during this diagnosis — left in
place, not deleted. **This session is not closed** — once F58 is resolved (most likely: Davin
checks operation-service's Railway deployment status/logs directly and redeploys if stale), the
remaining 6 Checklist steps continue in this same order, same session.
**Update, same day:** Davin had `operation-service` redeployed (`railway up --path-as-root
--service operation-service`, deployment `e6d716ac-...`, polled to genuine `latestDeployment.status
=== SUCCESS`, not the stale top-level field per L38) — **F58 still reproduced identically against
the freshly-deployed instance**, ruling out staleness. Further isolation (decoding the raw JWE
directly, byte-perfect claim match; instantiating operation-service's own generated Prisma client +
adapter locally against the known-good DB, which correctly finds the row with the exact same query
shape `UsersService.getProfile()` uses; a value-blind hostname check showing operation-service's
real `DATABASE_URL` resolves to the Railway-internal `postgres.railway.internal`) proves the code
itself is correct but could not conclusively identify why the LIVE container's own query returns
empty for a row that demonstrably exists.
**F58 RESOLVED, same day — turned out to be a false positive.** Davin directed a resilient
`resolveUserId(userId, email?)` email-lookup fallback in `UsersService`/`TwoFactorService`
(`getProfile`/`changePassword` + every `JwtAuthGuard`-derived `TwoFactorService` method);
implemented, tested (42/42 suites/385/385 tests), redeployed (`e2ff66e6-...`, polled to genuine
`SUCCESS`) — **F58 still reproduced identically even with the fix live**, which is what proved
the bug couldn't be inside those services at all. Bypassing the monolith's forwarding layer
entirely and calling operation-service DIRECTLY (with both a fresh `accessToken` and the
monolith-issued session cookie used as a raw Bearer token) returned clean `200`s every time; the
SAME cookie sent through the monolith's own `/api/user/profile` route still 404'd. Root cause:
**this session's own local `.env.local` never had `MIGRATE_USER_PROFILE`/`MIGRATE_USER_2FA` set**
— every `/api/user/profile`/`/api/user/2fa/*` call in this session's local testing silently fell
through to the monolith's OWN native Prisma lookup against `DATABASE_URL` (the STAGING database,
`LESSONS-LEARNED.md` L19's own precedent), never reaching operation-service at all — bridge-
registered test users (created via `token-register`, which genuinely does reach operation-
service and writes to real production) simply don't exist in that staging database. **Both flags
are already `true` in real Vercel production** (Session 4B-11's own close-out) — this was purely
a local-test-environment gap, never a production risk, and operation-service was never broken.
Set both flags locally to match production and re-ran the full smoke test: **22 of 23 checks
passed** — register, verify-email, login, logout, forgot-password, reset-password, re-login,
2FA setup, 2FA verify-setup (real TOTP code), login-with-2FA-required, 2FA verify, and — this
session's own new code — login completion via the `__2fa_verified__` sentinel, all proven
working end-to-end against real production operation-service. The one "failure" (a manually
resent raw cookie still authenticating after `token-logout`) is a test-methodology artifact, not
a bug — NextAuth's default JWE session strategy is stateless by design, unrelated to the bridge.
The `resolveUserId` fallback stays deployed (safe, tested, harmless) per Davin's own direction,
even though it wasn't the actual fix. **Step 2 now genuinely PASSES. Steps 3-6 are unblocked** —
proceeding per Davin's own explicit direction to resume them. Full evidence chain in
`DECISION-LOG.md` F58.
**Further post-flip logout hardening (same track, Davin's direct instruction):**
`handleLogout` in `components/layout/header.tsx` navigated to `/login` via `router.push`
after `token-logout`/`signOut` — client-side SPA navigation, meaning React/`SessionProvider`
state and any in-flight cookie header from the just-ended session could still be alive at
the moment the next sign-in starts, a plausible vector for NextAuth to attempt OAuth account
linking against stale session state. Both `handleLogout` branches (bridge and legacy) now use
`window.location.href = '/login'` — a full browser navigation guarantees nothing survives.
The now-unused `useRouter` import/call was removed. No other `handleLogout`-shaped function
exists in the live app (`hooks/use-auth.ts`'s `logout` is confirmed dead code, untouched per
standing note above; `app/admin/login/page.tsx`'s `signOut` call is an unauthorized-role
forced-logout on the login page itself, not this pattern; `frontend/`'s mirror is out of
scope per `EXECUTOR-PROTOCOL.md` §5). Verified: `tsc --noEmit` clean, `eslint
components/layout/header.tsx --max-warnings 0` clean, full `test:ci` 129/129 suites, 2191/2191
tests. Commit `160b4935`, pushed to `origin/main`, Vercel auto-deployed clean
(`dpl_FREJXM2f72YN8tspbvahtSQzzWpp`, aliased to `trading-alerts-saas-frontend.vercel.app`,
live `200`).
**OAuthAccountNotLinked request declined as literally asked, resolved narrower instead:** Davin
asked to add `allowDangerousEmailAccountLinking: true` to Google/Twitter/LinkedIn in
`lib/auth/auth-options.ts` to fix `ripper7375@gmail.com` hitting `OAuthAccountNotLinked`. Found
this directly contradicts `docs/decisions/google-oauth-decisions.md` Decision #3 and
`docs/policies/08-google-oauth-implementation-rules.md` — both call verified-only linking "the
MOST IMPORTANT policy" and list this exact flag on their "Common Pitfalls"/security-checklist
"DO NOT" items, with a documented attack scenario (unverified email/password squatter account +
later legitimate OAuth sign-in = auto-merged takeover). Flagged the conflict via
`AskUserQuestion` instead of silently complying or silently refusing; Davin chose the narrower,
equally-effective fix: leave `auth-options.ts`'s global policy untouched, manually link only his
own account. Confirmed via a direct read-only production query (`DIRECT_URL`, `.prisma/non-
market-client` + `PrismaPg`, same pattern as `lib/db/prisma.ts`) that his User row
(`cmkp6ftxd0000hr5xnjly47a3`) has a verified email (since 2026-01-22), a password, and zero
linked `Account` rows — exactly the safe-to-link case the existing `signIn` callback's own
verified-only check already allows. Added a temporary diagnostic (`providerAccountId` in the
existing `[SignIn]` console.log, not a secret), deployed, had Davin attempt Google sign-in on
production (still correctly 40x'd on `OAuthAccountNotLinked` — the flag was never touched), then
read the value (`113017035789984861714`) from `vercel logs`. Checked no other `Account` row
already used that `(provider, providerAccountId)` pair, then created exactly one row
(`Account.create({userId, type:'oauth', provider:'google', providerAccountId})`),
independently re-verified via a fresh read. Davin then confirmed live Google sign-in succeeds.
Diagnostic log reverted (file is byte-identical to before this change) and redeployed. 3
commits: `8b9d1906` (diagnostic added), the DB write itself (no code, one production `Account`
row, not a migration), and the diagnostic revert — each `tsc --noEmit`/`eslint --max-warnings 0`
clean, full `test:ci` 129/129 suites/2191/2191 tests green throughout. No global auth policy
changed; every other user's account-linking behavior is unaffected.
**Step 5 (Davin's own live production browser smoke test) — PASSED CLEAN**, reported by Davin:
credentials login, registration, OAuth, and logout all worked correctly against the live,
flag-flipped production bridge. No red result, so per the order's own Rule ("any red result at
Step 2 or Step 5 = abort, revert the flag, do not proceed to Step 6"), Steps 6-7 proceeded in
this same session.
**Steps 6-7 executed:** `CredentialsProvider` removed from `lib/auth/auth-options.ts` — its
`authorize()` implementation, and the two helpers that existed solely to support it
(`generate2FAToken`, the `PrismaUserWith2FA` type) are gone, along with the now-unused `bcrypt`/
`jsonwebtoken` imports (583 → ~370 lines). Three inline comments that referenced "credentials
provider" were corrected rather than left stale; the `signIn` callback's own
`account.provider !== 'credentials'` guard was simplified to a bare truthiness check (behaviorally
identical, since `'credentials'` can no longer occur as a provider name). The file's header
doc-comment was rewritten to describe its new OAuth-only scope and point at `DECISION-LOG.md`
F56. `app/api/auth/register/route.ts` was deleted (superseded by `token-register`) — confirmed,
before deleting, that its only remaining references anywhere in the live app were a mock
error-log example string and an archived/inactive e2e spec, neither a real dependency.
`scripts/verify-auth-config.js` (a standalone dev utility, not wired into `package.json` or CI)
was updated to check for `CredentialsProvider`'s _absence_ instead of its presence, so it stops
reporting false errors against the new architecture.
**A real, deliberate, permanent consequence, not an oversight:** `login-form.tsx`,
`verify-2fa/page.tsx`, `app/admin/login/page.tsx`, and `register-form.tsx` each still contain a
legacy flag-off fallback branch (`signIn('credentials', ...)` / `POST /api/auth/register`) —
these are now permanently non-functional (NextAuth returns a graceful error, not a crash) unless
a future rollback reverts this session's commits alongside the flag, exactly as this order's own
Rollback section anticipated. This is Option B/F56's own accepted design.
**Full verification:** `tsc --noEmit` clean, `eslint app components lib hooks --max-warnings 0`
clean (0 errors/warnings), full `test:ci` 129/129 suites, 2191/2191 tests — byte-identical to the
count before the removal, confirming zero regressions from retiring `CredentialsProvider`. No
test anywhere exercised `authOptions`'s provider array or `authorize()` directly, confirmed via a
repo-wide search before editing.
**`DECISION-LOG.md` F56 → RESOLVED & EXECUTED**, full entry (the original 4B-20 decision plus
this session's execution evidence) moved to `docs/migration-orders/history/decisions-archive.md`
per that file's own hygiene rule, one-line pointer left in place. `migration-cutover-table.md`
got its first-ever auth row (Phase 4B's first traffic-level auth cutover) — Status **CUT-OVER &
LIVE**. Step 8 (a dedicated post-flip monitoring window) was not run as a separate waiting
period — Davin's own live smoke test is itself the strongest available evidence, and a future
spot-check of `/api/auth/*`/`/api/user/2fa/*` error rates is the natural continuation, not a gate
on closing this order, matching the same "spot-check on the next real event" precedent already
established for Slices 1/2/3. **This order is fully CLOSED SUCCESSFUL — all 9 Checklist items
done or explicitly resolved to non-blocking.** New `4b-22-phase-4-exit-review.migration-order.md`
PRE-DRAFTed (the last domain session before Phase 4 exit review, per this order's own Next-session
handoff — no further PRE-DRAFT beyond 4B-22 is implied).

---

_(superseded-by-above, retained for context)_ Session 4B-19 (Email Rendering Port Audit & Verification, PORT/VERIFY-RETIRE
variant, Option A), CONFIRMED and executed 2026-08-03 — **CLOSED SUCCESSFUL, one commit, zero
flags touched, zero test regressions.**
CONFIRM found the by-now-familiar `LESSONS-LEARNED.md` L11 pattern once more (order file
modified-but-uncommitted, `PRE-DRAFT → APPROVED` with Option A selected in the header, no
visible Advisor→Davin approval commit trail) — this time fully benign: the entire body (all 4
Background findings, Entry Criteria, File Port Order, Rules, Slice-level verification,
Next-session handoff) diffed byte-identical to the committed PRE-DRAFT, only the header metadata
changed. Reported before proceeding; Davin confirmed live it was Antigravity Advisor's own
authentic edit.
**Independently re-verified all 4 of the PRE-DRAFT's own Background findings against live code
before trusting them** (not assumed from the order's prose): (1) `lib/email/email.ts` (984
lines) is genuinely fully ported — diffed exported function names against
`operation-service/src/email/email.util.ts` and confirmed all 24 functions match, same names,
same order; (2) `lib/email/subscription-emails.ts` (865 lines) genuinely has 5 of its email
types already ported to `operation-service/src/email/subscription-email.util.ts` (588 lines:
cancellation, payment-failed, payment-receipt, subscription-canceled, affiliate-commission) —
confirmed `getUpgradeEmailTemplate`/`sendUpgradeEmail` and
`getRenewalReminderEmailTemplate`/`sendRenewalReminderEmail` have zero callers anywhere in
`app/`, `lib/`, `components/` (self-referential only), and confirmed the file's other 5
functions are still genuinely live (imported by `app/api/subscription/cancel/route.ts` and
`lib/stripe/webhook-handlers.ts`) — retirement correctly scoped to just the 2 dead functions.
Found one immaterial citation slip: the order said "5 of 8 functions," the file actually defines
7 email-type pairs (14 exports), not 8. (3) `emails/*.tsx` (4 React Email components + barrel,
908 lines) — confirmed zero real imports anywhere in `app/`, `lib/`, `components/`, despite
`emails/index.ts`'s own header claiming a dLocal-payment-flow purpose. (4) `lib/email/templates/
affiliate/*.tsx` (5 React Email components, 1087 lines) — confirmed the only reference anywhere
in real code is one commented-out line, `lib/affiliate/registration.ts:124`; no `send*Email`
wrapper was ever built for any of the 5 templates. All 4 findings held with zero drift since the
2026-08-03 drafting; Davin gave live GO to execute under Option A.
**Executed (one commit, per the order's own explicit "if Option A... one commit" rule):**
removed `getUpgradeEmailTemplate`/`sendUpgradeEmail`/`getRenewalReminderEmailTemplate`/
`sendRenewalReminderEmail` from `lib/email/subscription-emails.ts` (865→612 lines, via a small
scripted line-range deletion rather than hand-built `Edit` matches, given the functions are
large raw-HTML-string template literals — script deleted after use, zero repo residue); deleted
all 10 dead files via `git rm -r` (`emails/{index.ts,payment-confirmation,payment-failure,
renewal-reminder,subscription-expired}.tsx` + `lib/email/templates/affiliate/{welcome,
code-distributed,code-used,monthly-report,payment-processed}.tsx` — `lib/email/templates/` is
now gone entirely, it had no other contents).
**Full verification:** `operation-service` 42/42 suites, 380/380 tests (unchanged — this service
was not touched); `nest build`/`tsc --noEmit` clean. Monolith `test:ci` 123/123 suites,
2157/2157 tests (unchanged from 4B-18d's baseline — zero regressions from the retirement);
`tsc --noEmit` clean; `eslint app components lib hooks --max-warnings 0` clean (0 errors/
warnings). Confirmed via `git show --stat` that exactly the 12 intended files changed (10
deletions + `subscription-emails.ts` + the order file itself) — nothing else touched.
**No `DECISION-LOG.md` entry applies** (no F-numbered decision was open or resolved this
session — Option A closes a stale playbook-description item against already-completed
prior-session work, not an open flag). **No `migration-cutover-table.md` change** (this session
touched zero traffic-carrying slices/flags — same precedent as every prior pure
audit/hygiene/INFRA session).
**Artifacts updated:** `4b-19-email-rendering-port.migration-order.md` (Status → CONFIRMED,
Entry criteria + Slice-level verification checked, Deviations filled in full — 5 entries),
`migration-stack-analysis.md` (new `<details>` entry for the 10 deleted files + 1 trimmed file),
this file. New `4b-20-21-auth-cutover.migration-order.md` PRE-DRAFTed (final Phase 4B domain
session per the playbook's own framing, before 4B-22/Phase 4 exit review).
