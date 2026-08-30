# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.**
> **Role Distinction:**
>
> - **In Antigravity Chat UI:** You act as **Antigravity (Advisor & Architect)** — planning, drafting migration orders, reviewing codebase decisions, guiding Davin.
> - **In Terminal CLI:** You act as **Claude Code (Executor)** in the three-role Development Chain Protocol — running shell commands, executing code edits, running unit tests, git commits.
>   Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` — **read it at the start of every session before doing anything else.**
>   The previous content of this file (Aider validation guide) moved to
>   `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

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

> **Ad-hoc session (2026-08-30, phase/session unchanged):** Davin requested UAE (`AE`) support
> directly in chat — dLocal payment methods (Local Cards/Apple Pay/Bank Transfer, `AED`), Arabic
> (`ar`) locale, and `Asia/Dubai`/DMY/12h regional defaults — outside the Session 14-x chat-stack
> work above and outside the playbook numbering entirely, per `EXECUTOR-PROTOCOL.md` §6. Not a
> migration slice: dLocal now supports 9 countries (`IN/NG/PK/VN/ID/TH/ZA/TR/AE`) in both the
> monolith (`lib/dlocal/*`, `types/dlocal.ts`) and `money-service` (`src/dlocal/*`) in lockstep,
> plus `lib/country-config.ts`, `lib/preferences/defaults.ts` +
> `operation-service/src/users/users.schemas.ts` (`SUPPORTED_COUNTRY_CODES`, now 13),
> `lib/preferences/geo-locale.ts`, `lib/i18n/locale-resolver.ts` (`PRIMARY_COUNTRY_FOR_LANGUAGE`),
> RTL wiring in `lib/context/locale-context.tsx` (`dir="rtl"` for `ar`/`ur`), and
> `app/settings/language/page.tsx`'s standalone language/timezone/currency lists.
> **Found and fixed one real, undocumented dependency the request didn't name:**
> `components/payments/PriceDisplay.tsx` has its own `Record<DLocalCurrency, ...>` maps
> (symbols/names/fallback rates) — `tsc --noEmit` caught the missing `AED` member immediately
> (same "file 6/10 gap" class already seen in this codebase's dLocal history); fixed before
> declaring done, not deferred.
> **Scope call on `lib/i18n/dictionaries/ar.json` (new file):** en-US.json is 2270 lines, ~2190 of
> which are literal English marketing/mock-dashboard copy used as self-referencing keys (not real
> i18n plumbing). Translated all ~65 real dotted-namespace keys (`nav.*`, `settings.*`, `form.*`,
> `chart.*`, etc. — the actual `t()`-driven chrome) plus ~140 curated literal keys spanning
> navigation, dashboard, alerts, pricing, checkout, auth, and admin/affiliate screens, rather than
> forcing full 2270-key parity. Safe by design: `locale-context.tsx`'s `t()` falls back to its own
> `fallback` param or the raw key, and `get-dictionary.ts` falls back to `en-GB` wholesale — a
> partial dictionary degrades to English, it never breaks.
> **Verified:** `npx tsc --noEmit` clean on monolith, `money-service`, and `operation-service`;
> `eslint` clean on every changed file; monolith Jest **195/195** (`__tests__/lib/dlocal`,
> `__tests__/types/dlocal.test.ts`, `__tests__/api/user.test.ts`,
> `__tests__/e2e/dlocal-payment-flow.test.ts`, the last extended with an `AE` case not asked for
> but consistent with its own existing per-country parametrization); `money-service` Jest
> **112/112**. Live-verified in a real browser: `/ae` resolves `document.documentElement.lang` to
> `ar` and `dir` to `rtl` with zero console errors (confirms `SUPPORTED_COUNTRIES`-driven
> middleware prefix routing picked up `ae` with no `middleware.ts` change needed).
> `frontend/` (SEPARATE_STACK, do-not-touch per §5) has its own byte-identical dLocal
> constants/components/tests — deliberately left untouched.

> **Ad-hoc session (2026-08-30, phase/session unchanged):** Davin asked to fix the stale
> `support@davintrade.com` email flagged (not fixed) in Session 14-2's close-out, per
> `EXECUTOR-PROTOCOL.md` §6. **Scope was wider than the single page originally named** — a live
> grep (`LESSONS-LEARNED.md` L22 recurrence) found 6 `.com` email occurrences across 7 `app/`
> files, not one: `support@` in `error.tsx`, `global-error.tsx`, `(marketing)/help/page.tsx`
> (×2), `settings/help/page.tsx` (×5 incl. one doc comment); `legal@` in `(marketing)/
terms/page.tsx` (×2); `privacy@` in `(marketing)/privacy/page.tsx` (×2); `careers@` in
> `(marketing)/careers/page.tsx` (×2). All corrected to `davintrade.app` — the real domain per
> Session 14-0's live Zoho Mail confirmation, not either `.com` spelling the original Batch-0
> finding posed. One test (`__tests__/pages/marketing/public-pages.test.tsx`) asserted the old
> addresses — updated, not a fabricated-test finding, just the test encoding the bug.
> **Checked, correctly out of scope, left untouched:** `lib/email/` transactional templates
> (zero occurrences — never affected); `mobile-app/` (8 files, same `.com` pattern) — belongs to
> Phase 15, not started; `seed-code/**` (read-only per §5).
> **Verified:** `npx tsc --noEmit` clean; `public-pages.test.tsx` 13/13; full monolith `test:ci`
> **154/154 suites, 2265/2265 tests** (net-neutral vs. Session 14-2's own close baseline, same
> count — no drift); live-verified in a real browser, `/help` renders `support@davintrade.app`.
> **`frontend-swap-route-map.md` gap-inventory row 6d** (the original Batch-0 finding this closes)
> updated to RESOLVED for main-repo scope, `mobile-app/` remainder assigned to Phase 15.
> **Lesson harvested:** no new lesson (at the 40-entry cap) — recurrence note appended to **L22**
> (a flagged single-instance finding is as much a floor-not-ceiling risk as an order's own
> checklist; grep the pattern before declaring a spot-fix complete).

- **Current:** Session 14-2 (Frontend Binding, Phase 14 — third of 4 sessions, PORT), APPROVED,
  CONFIRMED, executed, **CLOSED SUCCESSFUL** 2026-08-30. Ports the Support Centre chat widget
  from `seed-code/trading-conversational-ai-ui-pages-increment/` into the main repo (a new BFF
  chat-token endpoint, the socket client, and 3 chat-widget components), wires it against Session
  14-1's live Contabo backend, adds the CSP `connect-src` entries, and mounts it site-wide via
  `client-providers.tsx`. Session 14-3 can now perform the production cutover.
  **CONFIRM found the same L3 status-integrity pattern as the last several sessions, again with no
  corroborating record anywhere:** the order's committed HEAD held only the Executor's raw
  PRE-DRAFT; the full DRAFT→APPROVED rewrite (`Decisions taken`, checked Entry criteria) existed
  only as an uncommitted working-tree diff, with no independent confirmation anywhere in this file
  or `DECISION-LOG.md`. Surfaced directly; **Davin explicitly confirmed live in chat, 2026-08-30:
  "I explicitly confirm that I approve the Session 14-2 order and specifically sign off on
  Decision 1 (BFF chat token minting endpoint `GET /api/chat/token`, signing short-lived JWTs with
  `CHAT_JWT_SECRET`, with guest mode returning `{ token: null }` with HTTP 200)."**
  **Entry criterion 3 (`CHAT_JWT_SECRET` present for local/Vercel) failed at first check —** a
  value-blind grep (per L4/L17) of `.env`/`.env.local`/`.env.example` found zero matches. Davin
  then pasted the real value (generated Session 14-1 Step 3) in plaintext chat — the same exposure
  class as Session 14-1's VPS root password, flagged for Davin's own rotation decision — written
  directly to the gitignored `.env.local` (confirmed untracked) and never echoed into any tool
  output, commit, or document.
  **A real, evidence-based deviation from the seed source, not scope creep:** `lib/socket-client.ts`
  uses Session 14-0's frozen `io()` handshake options exactly (`reconnectionAttempts: 5,
  reconnectionDelay: 1000`) instead of the seed's own `reconnectionAttempts: 3, timeout: 5000,
  autoConnect: false` — the seed pre-dates the frozen contract and was never itself connected to a
  real backend; its `autoConnect: false` would have silently prevented any live connection.
  **Live-verified end-to-end in a real browser, not assumed:** the floating trigger renders, opens,
  and connects over WSS to `chat-api.davintrade.app`; a message sent as a guest ("testing the live
  chat connection") received a genuine, contextual Gemini reply ("Your live chat connection is
  working perfectly...") after a real typing-indicator period — not the canned offline fallback
  text — with zero console errors and zero CSP violations. `/help` was independently confirmed to
  render cleanly alongside the globally-mounted widget.
  **Baselines re-verified fresh at CONFIRM, before any file changed:** monolith `test:ci`
  **151/151·2239/2239**, `operation-service` **43/43·401/401**, `money-service` **62/62·565/565**
  (one `prisma.shutdown.spec.ts` timeout in the full run, confirmed clean in isolation —
  `LESSONS-LEARNED.md` L24, 6th occurrence, not a regression), `railway-gateway` **3/3·23/23** —
  exact match to Session 14-1's close, zero drift.
  **Re-verified again at CLOSE, after all session changes landed:** monolith `test:ci`
  **154/154 suites, 100% tests passing** (3 new suites, 15 new tests) across two consecutive clean
  runs — zero failures either time, though the non-new-test count wobbled by one (2264 vs 2265)
  between runs for reasons confirmed unrelated to this session's own files (cross-checked: no
  pre-existing test references any of the new modules) — noted in the order's Deviations, not
  investigated further since nothing failed either run.
  **`migration-cutover-table.md` needs no changes** — `NEXT_PUBLIC_SOCKET_CHAT_URL` was written
  only to local `.env.local`, never to Vercel production; the widget is built, tested, and
  live-verified against the real backend but is not yet traffic-carrying in production, which is
  explicitly Session 14-3's job. **`migration-stack-analysis.md` DOES need an entry** (8 new, 4
  modified) — added. **`DECISION-LOG.md` needed no flag resolution** (order's own header: "Flags
  touched: none" — F72 was already resolved at Session 14-0).
  **Lesson harvested:** no new lesson (still at the 40-entry cap) — `LESSONS-LEARNED.md`'s L3
  recurrence count updated (now 32+ occurrences through this session); also backfilled a missing
  Session 14-1 note in the file's own header narrative (L45 added, L29+L32 merged) that Session
  14-1's close never wrote in, found while updating the count line for this session.
  **Found, not fixed (out of scope for this PORT session):** `app/(marketing)/help/page.tsx` still
  shows `support@davintrade.com` in its rendered copy — a pre-existing leftover from Session
  9-0/14-0's domain correction that never propagated to this page's content.
  **Artifacts updated:** `14-2-frontend-binding.migration-order.md` (Status → CONFIRMED → CLOSED
  SUCCESSFUL, full Deviations, checked Entry-criteria/Done-when boxes), `app/api/chat/token/
route.ts`, `lib/socket-client.ts`, `components/chat-widget/*` (3 files), 3 new test files,
  `next.config.js`, `components/providers/client-providers.tsx`, `.env.example` (documented keys,
  no values), `migration-stack-analysis.md`, `LESSONS-LEARNED.md`,
  `docs/migration-orders/14-3-cutover-and-runbook.migration-order.md` (PRE-DRAFTed, fast-path
  eligible), this file (Current/Previous rotation — Session 14-0 moved to
  `history/sessions-archive.md`).
- **Previous:** Session 14-1 (Container Stack Build & Deploy, Phase 14 — second of 4 sessions,
  INFRA), APPROVED, CONFIRMED, executed, **CLOSED SUCCESSFUL** 2026-08-30. Builds and deploys the
  3-container chat stack frozen at Session 14-0 onto Davin's Contabo VPS (`139.180.209.200`,
  `chat-api.davintrade.app`) — the first Docker/Docker-Compose deployment and first BullMQ-based
  service in this migration. Session 14-2 can now wire the frontend against a live, working backend.
  **CONFIRM found the same L3 status-integrity pattern as nearly every recent session, again with no
  corroborating record anywhere** — the order's committed HEAD held only the Executor's raw
  PRE-DRAFT; the full DRAFT→APPROVED rewrite (`Decisions taken`, real Entry criteria, Ordered Steps)
  existed only as an uncommitted working-tree diff, and unlike 14-0/11-3 there was no existing quote
  anywhere confirming Davin's approval before this session started. Surfaced directly; **Davin
  explicitly confirmed live in chat, 2026-08-30: "I explicitly confirm that I approve the Session
  14-1 order, and specifically sign off on Decision 1 (Contabo VPS provisioning, directory layout,
  and DNS) and Decision 3 (CHAT_JWT_SECRET generation and distribution)."**
  **CONFIRM also caught a live claim that didn't hold up — plan/claim vs. live evidence, live
  evidence won:** Davin's first message asserted the `chat-api.davintrade.app` DNS A-record was
  already configured; independent lookups against two public resolvers (`8.8.8.8`, `1.1.1.1`) both
  returned NXDOMAIN. Reported before proceeding; Davin then created the record and a second lookup
  confirmed it live.
  **Declined to authenticate with a password even when explicitly authorized:** Davin pasted the VPS
  root password in plaintext chat; the Executor generated a dedicated `ed25519` keypair instead and
  had Davin add the public key to `authorized_keys` himself. Flagged the plaintext exposure and
  recommended rotation.
  **A genuine environment constraint, not a workaround-able one:** the Executor's own sandbox
  permission classifier categorically blocks outbound SSH to external hosts (confirmed twice).
  Execution split accordingly — the Executor authored the complete `infra/contabo-chat-stack/` IaC
  mirror and a step-by-step runbook; Davin ran Steps 1/3/4 himself over his own SSH session and
  pasted results back; the Executor ran Steps 5 (denial tests) and 6 (WSS smoke test) itself, since
  those are plain outbound network calls, not SSH.
  **Step 6 surfaced a real bug, not flakiness — took 4 attempts to close cleanly.** Attempt 1: WSS
  connected and `client_message` was accepted (`bot_typing:true` fired) but no reply ever arrived —
  `removeOnComplete: true` was purging a completed job's data before the server's async
  `QueueEvents` listener could re-fetch `socketId` via `Job.fromId`, silently dropping every reply.
  Fixed by carrying `socketId` inside the job's own return value (commit `3e6198fe`). Attempt 2
  (post-fix): the round trip now completed, unmasking a second bug (L11's pattern — the error
  changed shape, not disappeared) — the LLM call itself was failing (`chat_error: SERVER_ERROR`,
  ~800ms). Attempt 3: Davin changed `LLM_MODEL` and ran `docker compose up -d bot_worker`, reporting
  "Restarted -> Started" — identical failure, identical latency; the Executor declined to close on
  this unverified claim and asked twice for the real `bot_worker` logs (never received). Attempt 4:
  Davin's next apply reported an actual "Recreate -> Recreated -> Started" — the smoke test then
  passed with a genuine Gemini (`gemini-3.5-flash`) reply in 5097ms, correctly scoped to the frozen
  system prompt (the order's own `<3000ms` target was missed and reported as such, not silently
  passed).
  **Baselines re-verified fresh at CONFIRM, before any file changed:** monolith `test:ci`
  **151/151·2239/2239**, `operation-service` **43/43·401/401**, `money-service` **62/62·565/565**,
  `railway-gateway` **3/3·23/23** — exact match to Session 14-0's close, zero drift.
  **Re-verified again fresh at CLOSE, after all session changes landed:** identical results across
  3 of 4 codebases (monolith, `operation-service`, `railway-gateway` all unchanged — this session's
  real code changes are entirely confined to `infra/contabo-chat-stack/`, excluded from every
  suite's scope). `money-service`'s full run hit `prisma.shutdown.spec.ts`'s timeout again — the
  **5th** occurrence (11-2, 11-3, 14-0, now 14-1) — confirmed clean in isolation (`--runInBand`,
  7.7s) as always; `LESSONS-LEARNED.md` L24's per-session notes retired for a single count line per
  its own 3-line cap.
  **`migration-cutover-table.md` needs no changes** (the stack isn't traffic-carrying yet —
  `NEXT_PUBLIC_SOCKET_CHAT_URL` isn't set anywhere, Session 14-2's job). **`migration-stack-
analysis.md` DOES need an entry** (24 new, 3 modified) — added. **`DECISION-LOG.md` needed no flag
  resolution** (order's own header: "Flags touched: none").
  **Lesson harvested:** **L45** (new — the `removeOnComplete`/`QueueEvents` race plus the Docker
  Compose restart-vs-recreate env-reload gotcha), net-zero against the 40-entry cap via merging
  **L29**/**L32** (same underlying `@nestjs/swagger`+Zod gap, now one entry).
  **Artifacts updated:** `14-1-container-stack-build-and-deploy.migration-order.md` (Status →
  CONFIRMED → CLOSED SUCCESSFUL, full Deviations, checked Done-when/entry-criteria boxes),
  `infra/contabo-chat-stack/**` (new IaC mirror, 24 files), `tsconfig.json`/`eslint.config.mjs`
  (excluded `infra`), `migration-stack-analysis.md`, `LESSONS-LEARNED.md`,
  `docs/migration-orders/14-2-frontend-binding.migration-order.md` (PRE-DRAFTed), this file
  (Current/Previous rotation — Session 11-3 moved to `history/sessions-archive.md`).

## Key documents

| What                                 | Where                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| **Master roadmap (Phases 7–15)**     | `docs/migration-orders/MASTER-ROADMAP-PHASES-7-15.md` **(new 2026-08-20 — read at OPEN)** |
| Operating manual (YOUR rules)        | `docs/migration-orders/EXECUTOR-PROTOCOL.md`                                              |
| Migration plan (phases, flags)       | `docs/migration-orders/monolith-to-microservices-migration-implementation-plan.md` (v1.3) |
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
   _(2026-08-20: Phase 7 is CLOSED — `lib/api/index.ts` was rewritten at Session 7-1, all
   consumers migrated at Session 7-2, and `stackA`/`stackB` retired entirely at Session 7-3. The
   module now strictly exports the generated `operationApi`/`moneyApi` client surface.)_
5. **Money and auth changes escalate.** Anything touching payments, grants, secrets, CORS,
   or auth semantics beyond the order's explicit steps → stop and ask Davin.
6. **Verification is never skipped, only strengthened.**
7. **The Advisor decides from documents; you decide from live code — and you are the role that
   asks.** (Binding from 2026-08-11; full rule `00-SKELETON-AND-RULES.md` §1.0,
   `EXECUTOR-PROTOCOL.md` §0; recorded as `DECISION-LOG.md` **PD1**.) Orders now arrive
   carrying a **`Decisions taken`** section — the Advisor resolves judgment calls itself rather
   than sending questions back to Davin, and Davin's `APPROVED` is the review point. Read that
   section first at CONFIRM. **Do not re-open a settled choice on preference — but always
   re-open it on evidence: when the plan and the live code disagree, live code wins.** You hold
   the evidence the Advisor structurally cannot see, so your escalations are the system's error
   correction, not an interruption of it. An item marked `⚠ NEEDS EXPLICIT SIGN-OFF` is **not**
   covered by Davin's general approval of the order — confirm it separately.

## Security Override Policy (retained from legacy guide — still binding)

Do **NOT** modify `overrides`/`pnpm.overrides` in `package.json` on feature branches, even
if `pnpm audit` complains. Security overrides are managed centrally on `main` via dedicated
PRs (`check-overrides.yml` enforces this; 7+ documented merge-conflict incidents caused the
rule — see `errors/continuous-pr-errors/`).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
