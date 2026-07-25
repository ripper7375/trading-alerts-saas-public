# Migration Order — UI-BUILD variant (with an embedded decision)

> For **new/redesigned frontend surfaces**. Read `00-SKELETON-AND-RULES.md` first — §4 applies with
> the dial at **High** for design, but **Low** for anything touching auth semantics: the contract
> constrains the data, not the design, and auth is not a place to be creative.

**Session:** 4A-7a · **Variant:** UI-BUILD (+ CONTRACT for the two decisions) · **Status:** DRAFT
**Generated:** 2026-07-25 (Advisor) · **Estimated time:** 3–4h (split 4A-7a1/4A-7a2 if it overruns)
**Phase / plan section:** Phase 4A — money-service, blueprint §5.5 **Slice 3 (of 5)** — the BUILD
half of what `4a-7-…` tried to do in one session
**Flags touched:** **F44** (resolve — read-API shadow mechanism) · **F45** (resolve — browser→
money-service transport) · re-opens the assumption recorded as CLAUDE.md Waiting-on **#34**
**Target service:** monolith frontend + Next.js route handlers (money-service unchanged)
**Contract:** the 12 GET routes money-service already exposes (Session 4A-6) — shapes are frozen,
this session only changes _who calls them and how_

---

## Why this session exists (and why `4a-7-…` cannot be executed as drafted)

`4a-7-money-service-read-apis-cutover.migration-order.md` is a VERIFY-RETIRE order carrying
**real build work** — introducing an env var, a fetch transport, and a Bearer-header attach. Its
template forbids exactly that: _"No new code, no fixes, no 'while I'm here' — observation and
execution only"_, dial **near zero**. The order itself admits it: _"any frontend data-hook change to
attach the header is itself real work — if it turns out more involved than a straightforward header
attach, that's its own scoped change, not something to improvise mid-cutover."_

It is more involved. **Two blockers, one of them architectural:**

### Blocker 1 — the browser cannot read the JWT. The planned mechanism is impossible.

Waiting-on #34 records the resolution as: _"The Next.js frontend will manually extract its JWT and
attach it as a Bearer header when calling money-service's Read APIs."_ Verified against the live
codebase 2026-07-25, that cannot work:

| Evidence                                                                                                                                                                  | Path                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| NextAuth session cookies are `httpOnly: true` (×3 cookie definitions)                                                                                                     | `lib/auth/auth-options.ts:552, 564, 576`           |
| _"token never reaches client JS — it lives only in this httpOnly cookie"_                                                                                                 | `app/api/auth/token-refresh/route.ts:27`           |
| `tokenCookieOptions()` returns `httpOnly: true`                                                                                                                           | `lib/operation-service/cookies.ts`                 |
| _"**Server-only** fetch helper… the browser never talks to operation-service directly, so the access token never has to leave the server (also sidesteps CORS entirely)"_ | `lib/operation-service/client.ts:1–13` (103 lines) |

Client-side JavaScript has no access to an `httpOnly` cookie. There is nothing for a data hook to
"manually extract". **This is a design contradiction between two already-resolved decisions**, and
both were confirmed by Davin:

- **F30** (Session 3-4, RESOLVED): _CORS confirmed unnecessary, server-side proxying continues_ —
  the pattern actually built and shipped for operation-service.
- **Waiting-on #34** (blueprint §4.2 / §5.4): browser talks to money-service directly with a Bearer
  header, which is why `money-service/src/main.ts` carries a real `ALLOWED_ORIGINS` CORS allowlist
  (unlike operation-service, which needs none).

They are not literally contradictory — different services — but the money-service half rests on a
capability the auth design deliberately removed. **F45 resolves which one wins.**

### Blocker 2 — there is no shadow-run, and no mechanism to have one.

The cutover table records Slice 3 as `shadow start: —`, `diff clean?: —`, while the playbook
specifies 4A-6/7 as _"BUILD then ⏸ 48h ➜ CUTOVER"_. A read-API shadow-run needs something calling
**both** old and new and diffing — which needs either a dual-call code path or the staging
environment that CC-A/**F34** has never built. Slice 1 hit this same wall and Davin resolved it with
**F35** (manual-trigger verification instead of a literal parallel run). Slice 3 needs its own
equivalent ruling: **F44**.

**Consequence:** `4a-7-…` is **superseded by this order plus `4a-7b-…`**. Do not execute it. Mark it
`SUPERSEDED` at this session's close (keep the file — order files are the audit trail).

---

## Entry criteria

_(verified at CONFIRM time, not assumed — `EXECUTOR-PROTOCOL.md` §1.3)_

- [ ] **Davin available** — F45 is an auth-semantics decision (`EXECUTOR-PROTOCOL.md` §7) and F44 is
      a verification-standard decision. Neither can be inferred.
- [ ] Session 4A-6 is still `BUILT`: all 12 GET routes respond **401** to unauthenticated requests.
      Re-verify by actual request, not by reading the cutover table.
- [ ] The four Blocker-1 evidence points above still hold (re-grep — if someone has since made the
      cookie non-httpOnly, that is itself a finding to escalate before anything else).
- [ ] **Stale monitoring claims closed first** — both are one-command checks and both concern money
      paths that are _already live_: - CLAUDE.md Waiting-on **#36**: Slice 1's first _natural_ cron tick (due 2026-07-23, still
      open). `railway logs` for money-service across a UTC 00:00–04:00 window — no errors, no
      duplicate `PaymentBatch`/`DisbursementTransaction` rows. - CLAUDE.md Waiting-on **#38**: dLocal's first live post-flip webhook delivery, never
      observed. This matters more than it looks: Session 4A-5's two signature/replay bugfixes went
      live **without** passing through their own DRAFT→APPROVED cycle (Davin-authorised scoped
      exception, recorded in that order's Deviations) — so the only remaining proof that the fixed
      code is correct in production is a real delivery nobody has yet looked at.
- [ ] **Confirm the monolith's migration history already covers what money-service's
      `schema.prisma` subset assumes** — carried forward from `4a-7-…`'s entry criterion #4, and it
      belongs here rather than in 4A-7b because **step 5 is the first authenticated read** these
      routes will ever serve. Session 4A-6's 401 checks proved the guards work, not that the DB
      reads do: `JwtAuthGuard` rejects before Prisma is ever touched. Slice 1's crons already read
      the shared DB through the same subset, so this is expected to pass — but expected is not
      verified.
      ⚠️ **This is a READ-ONLY check** (`prisma migrate status` against the shared DB from the
      **monolith**, or asking the monolith side directly). Never a `db push` or `migrate deploy`
      from money-service — `LESSONS-LEARNED.md` **L1** forbids it outright, because money-service
      defines only a _subset_ and migrating from there drops the monolith's own tables.
- [ ] `npm run validate` green on the monolith before any edit (a clean baseline to diff against).

**A failed entry criterion means do not start.** If #36/#38 cannot be closed (log buffer rolled
over, no traffic yet), that is not a blocker for _this_ session — record it and proceed — but say so
explicitly rather than leaving the claim dangling a third time.

---

## Integration points

- **In:** the browser and Next.js server components/route handlers.
- **Out:** money-service's 12 GET routes (`/v1/affiliate/dashboard/*`, `/v1/admin/*`).
- **Owns:** the transport module and the feature flag. **Owns no money logic and no auth logic** —
  it reuses `lib/operation-service/*`'s proven pattern or extends it, per F45.

---

## Ordered steps

### 1. Resolve F45 — how does a browser-initiated read reach money-service?

Present these three options to Davin with the Blocker-1 evidence. **Do not proceed to step 2 until
he chooses.**

| Option                                    | Mechanism                                                                                                                                                                                                                                   | Cost                                                                                                                                                                       | Honest assessment                                                                                                                                                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **(a) Server-side proxy** — _recommended_ | Next.js route handlers call money-service using a copy of `lib/operation-service/client.ts`'s pattern; the JWE is read server-side from the httpOnly cookie and forwarded as `Authorization: Bearer`. Browser talks only to its own origin. | Low — mirrors code that already works. `NEXT_PUBLIC_MONEY_API_URL` becomes `MONEY_SERVICE_URL` (server-only), and money-service's `ALLOWED_ORIGINS` becomes unused config. | Consistent with **F30**. Token never reaches JS. No CORS. Makes 4A-7b a genuine base-URL swap. Cost: defers blueprint §5.4's browser-direct vision and forgoes the direct-call latency win.                                     |
| (b) Token-vending endpoint                | A Next.js route reads the httpOnly cookie and returns the JWE to the browser, which attaches it as Bearer on direct money-service calls.                                                                                                    | Medium                                                                                                                                                                     | Delivers §5.4 literally — but **deliberately puts a 30-day session JWE into JS-reachable memory**. One XSS becomes a 30-day account takeover. I do not recommend trading the httpOnly guarantee for a latency win on read APIs. |
| (c) Short-lived scoped token              | As (b), but mint a ~5-minute, money-service-audience token instead of handing over the session JWE.                                                                                                                                         | High — money-service must accept a second token shape; new minting + refresh path                                                                                          | The _correct_ long-term answer if browser-direct is genuinely wanted. Too much for a Slice 3 cutover; propose it as its own session if Davin wants §5.4 honoured properly.                                                      |

**Verification:** a `DECISION-LOG.md` F45 entry quoting Davin, **and** an explicit note on what it
means for blueprint §5.4 and for money-service's `ALLOWED_ORIGINS` (if (a): say plainly that the
CORS allowlist is now dead config, so nobody later "fixes" it by widening it).

### 2. Resolve F44 — what replaces the 48h read shadow-run?

| Option                                                              | Mechanism                                                                                                                                                                                          |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **(a) Dual-call diff — _recommended if Davin wants a real shadow_** | The transport calls old **and** new for a chosen route group, returns the old response, logs a structured diff. Run 48h, then cut over. Costs a temporary code path that must be removed at 4A-7b. |
| (b) Progressive cutover as the substitute                           | No shadow. Cut over **one route group at a time** behind the flag, each with instant rollback, watching errors between groups. Same reasoning that let 4A-5 substitute replay for a 48h shadow.    |
| (c) Build CC-A staging first (**F34**)                              | Correct, and long overdue — but it is a multi-session project and would park Slice 3 indefinitely.                                                                                                 |

**Verification:** `DECISION-LOG.md` F44 entry; the playbook's _"⏸ 48h"_ for 4A-6/7 amended in the
same breath (`00-SKELETON-AND-RULES.md` §5 — playbook amendments ship with the order that needs
them), and `SESSION-PROMPT-SCRIPT.md` updated to match so the two never disagree.

### 3. Build the transport (shape per F45)

For the recommended (a): `lib/money-service/client.ts` + `lib/money-service/routes.ts`.
**Invariants — the dial is Low here:**

- Reuse `lib/operation-service/client.ts`'s error-mapping shape (`MoneyServiceError` with
  `status` + `body`) so callers behave identically. Do not invent a second error convention.
- **Server-only.** Same header comment and the same rule: never imported from a `'use client'`
  file (`LESSONS-LEARNED.md` **L6** — one server-only import taints the whole module for every
  client importer, and **only `next build` catches it**, not `tsc` or `jest`).
- Read the session cookie via the existing `SESSION_COOKIE_NAME` from
  `lib/operation-service/cookies.ts` — **do not re-derive the per-environment cookie name.**
  Session 3-3's CONFIRM already found the Decision Log's literal string was the dev-only value.
- `cache: 'no-store'` on every call (these are per-user reads).
- **Do not touch `lib/api/index.ts`** — known-broken by design until Phase 7.

### 4. Add the flag, defaulting OFF

`MIGRATE_READ_APIS_MONEY` (or per-group flags — the Executor may choose finer granularity, that is
inside the dial). **Default off in every environment**, including local. The flag's only job is to
let 4A-7b flip route groups one at a time without a code deploy.

**Verification:** with the flag unset, every one of the 12 routes still resolves to the monolith and
`npm run validate` + the full suite are green — i.e. this session is a no-op in production until
someone flips something.

### 5. Prove one signed-in browser call end-to-end

This is `4a-7-…`'s unmet entry criterion #3, and it is this session's real deliverable. Pick the
**lowest-risk** route group (affiliate dashboard read, not an admin money report). With the flag on
in a preview/local environment only:

1. Sign in as a real user in a browser.
2. Load the page. Confirm the response came from money-service (correlation id / Railway log line),
   not the monolith.
3. Confirm a signed-out browser gets 401, and a wrong-role user gets 403 (`AffiliateGuard` /
   `AdminGuard` still bite).
4. Capture the evidence into the order's Deviations — 4A-7b's entry criteria depend on it.

**⛔ Note what this step really proves — governed by `DECISION-LOG.md` F46 (RESOLVED, pre-registered
2026-07-25 at Davin's instruction) and `LESSONS-LEARNED.md` L18.**

This is the first time these 12 routes serve an _authenticated_ request, and therefore the first time
they touch Prisma at all — 4A-6's 401s never reached the database, because `JwtAuthGuard` rejects
before any query runs. **If the read fails on a Prisma column, model, relation or enum value, that is
a SCHEMA finding, not a transport bug.** Stop, record model + field + exact error in Deviations,
report to Davin, and let it become its own scoped session.

**Specifically forbidden as a "fix" here:** adding a `select`/`omit` to dodge the missing field ·
defaulting or mapping the value inside `lib/money-service/*` · editing
`money-service/prisma/schema.prisma` · any Prisma write command from money-service (**L1**). A
transport-side workaround would make the route return **plausible but wrong data** on the
affiliate-commission read path and bake the divergence in permanently.

### 6. Close per `EXECUTOR-PROTOCOL.md` §3

Mark `4a-7-money-service-read-apis-cutover.migration-order.md` **SUPERSEDED** (file retained),
update CLAUDE.md / DECISION-LOG / cutover table (Slice 3 notes only — status stays `BUILT`) /
`migration-stack-analysis.md` (new `lib/money-service/*` files), then **PRE-DRAFT `4a-7b-…`**.

---

## Done when

- [ ] **F45 resolved** with a Decision-Log entry and its consequence for §5.4 / `ALLOWED_ORIGINS`
      written down explicitly.
- [ ] **F44 resolved**; playbook **and** `SESSION-PROMPT-SCRIPT.md` amended together.
- [ ] Transport module exists, server-only, reusing the 3-3 cookie constant and error shape.
- [ ] Flag exists and defaults **off**; with it off, production behaviour is **bit-identical** —
      proved by the full suite plus `npm run build` (L6's only real detector).
- [ ] **One real signed-in browser call to money-service succeeded end-to-end**, with 401/403
      negative cases also observed. Evidence in Deviations.
- [ ] If F44 = dual-call: the diff logger is live and the 48h clock is recorded in CLAUDE.md under
      "Waiting on" with all four WAIT fields (what started, exact end UTC, what to watch, what ends
      it early).
- [ ] `4a-7-…` marked SUPERSEDED; `4a-7b-…` PRE-DRAFTed.
- [ ] **No route group is actually cut over in this session.** `git diff` shows a new module, a new
      flag, and no change to which service serves production traffic.

---

## Rollback

Revert the commit and redeploy. Because the flag defaults off, production behaviour is unchanged
throughout, so the rollback is precautionary rather than corrective — which is the entire reason for
splitting this work out of the cutover.

---

## Rules specific to this variant

- Dial is **High** on how the transport is organised, **Low** on anything auth-shaped. If a step
  seems to require changing how tokens are minted, read, or scoped — **stop and ask Davin.** That is
  F45 territory, not implementation detail.
- Do not widen `ALLOWED_ORIGINS` on money-service to "make CORS work". If CORS appears to be needed,
  F45 was answered differently than the code assumes — stop.
- Ported/existing tests may be extended, never weakened (`LESSONS-LEARNED.md` **L3**).

---

## Deviations

_(filled DURING execution — what/why/impact)_

**Expected entries at minimum:** F45's decision and its blast radius · F44's decision and the
playbook amendment · the browser end-to-end evidence · outcome of the #36/#38 monitoring checks ·
any drift in the Blocker-1 evidence.

---

## Known wrinkles / do-not-touch

- `lib/api/index.ts` — known-broken by design. Phase 7 only.
- `lib/operation-service/*` — **read it, copy its pattern, do not refactor it.** It serves live auth
  traffic. A "shared base client" extraction is Phase 7's job.
- `middleware.ts` imports `lib/operation-service/cookies.ts` and runs on the **Edge runtime** — no
  Node-only APIs may enter that import graph. If the new transport shares anything with it, keep the
  shared part Edge-safe.
- money-service is **not** modified by this session. Its 12 routes and its guards are already
  correct (Davin confirmed at 4A-6).
- Do not start any Part 19.5 (`4A-W*`) work here. Slice 3 finishes first.

---

## Next-session handoff

_(PRE-DRAFT `4a-7b-money-service-read-apis-cutover.migration-order.md` — variant
`TEMPLATE-VERIFY-RETIRE.md`, dial near zero, **~10 lines**. It must contain: the concrete rollback
(flip `MIGRATE_READ_APIS_MONEY` back — no longer "TBD"), the per-route-group flip order with
affiliate-dashboard reads first and admin money reports last, the F44-mandated evidence to present
before flipping, and — if F44 = dual-call — removal of the temporary diff path. **No code work of
any kind belongs in that order.**)_
