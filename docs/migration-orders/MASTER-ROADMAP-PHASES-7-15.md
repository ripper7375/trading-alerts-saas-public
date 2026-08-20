# Master Roadmap — Phases 7 → 15 (revised migration workflow)

**Status:** PROPOSED 2026-08-20 (Advisor) — pending Davin's approval.
**Supersedes:** nothing. **Amends:** the session playbook (Phases 8+), the implementation plan
(§10, §11), and `davin-operational-manual/SESSION-PROMPT-SCRIPT.md`. Those three files carry
matching amendment notes dated 2026-08-20; if any of them disagrees with this file, this file is
the newer statement of intent and the disagreement is a bug to fix, not a choice to make.

**Why this document exists.** The original workflow (`monolith-to-microservices-migration-
implementation-plan.md` + `…-session-playbook.md`) planned Phases 0–8 and ends at "migration
complete." Since it was written, five bodies of work landed outside its numbering:

| Ref      | Work                                               | State on 2026-08-20                                                              |
| -------- | -------------------------------------------------- | -------------------------------------------------------------------------------- |
| PART 2   | Ad-hoc builds (seed UI, mobile shell, 3 hand-offs) | Built; **not sequenced into any phase**                                          |
| PART 3   | Drawing engine + line alerts                       | Built AND already migrated into `operation-service`; **residual gaps unowned**   |
| PART 4   | Web chat module (Contabo)                          | Frontend built in codebase 2; **backend not started**                            |
| PART 5   | Stack D + Stack E (Parts 26–33)                    | Architecture + tier-prep spec written; **nothing built**                         |
| PART 2.1 | Frontend replacement (codebase 2 → main repo)      | Codebase 2 complete (90 routes, parity-audited, light/dark done); **not ported** |

This roadmap folds all of it into the **same** three-role chain (`EXECUTOR-PROTOCOL.md`,
`00-SKELETON-AND-RULES.md`, migration orders, `CLAUDE.md` state block). Nothing about the ritual
changes. Only the phase list grows.

---

## 0. The one-page answer — execution order

Phase **numbers** are identities, not a running order (`00-SKELETON-AND-RULES.md` §5: never
renumber). The running order is this list, top to bottom:

| #   | Gate                                               | Sessions            | Est. |
| --- | -------------------------------------------------- | ------------------- | ---- |
| 1   | **Phase 7** — API Client Rewrite _(resume here)_   | 7-2, 7-3            | 2    |
| 2   | **Phase 4X** — carry-forward money cutovers        | 4A-13, 4A-14, 4A-15 | 3    |
| 3   | **Phase 9** — Frontend Stack Replacement           | 9-0 … 9-10          | 11   |
| 4   | **Phase 10** — Drawing Engine & Line-Alert closure | 10-1 … 10-3         | 3    |
| 5   | **Phase 8A** — Decommission, part 1                | 8-1, 8-2            | 2    |
| 6   | **Phase 11** — Preparatory Tier-Access Refactoring | 11-1 … 11-3         | 3    |
| 7   | **Phase 12** — Stack D (Parts 26–30)               | 12-0 … 12-5         | 6    |
| 8   | **Phase 13** — Stack E (Parts 31–33)               | 13-0 … 13-3         | 4    |
| 9   | **Phase 14** — Web Chat / Contabo support stack    | 14-0 … 14-3         | 4    |
| 10  | **Phase 15** — Mobile App Integration              | 15-0 … 15-4         | 5    |
| 11  | **Phase 8B** — Final verification & close-out      | 8-3, 8-4, 8-5       | 3    |

**~46 sessions remaining.** Phase 8 is deliberately **split**, not moved: sessions 8-1/8-2 run
early (deleting dead surface while it is still fresh in mind), 8-3/8-4/8-5 run last so the
final e2e, load test and runbooks cover the AI, comments, chat and mobile stacks too. Session
IDs are unchanged — only when they run changes.

### Why this order

- **7-2/7-3 first.** They rewire `app/api/**` _route handlers_, not UI. The frontend swap does
  not touch them, and doing them first means Phase 9's new pages bind to one settled internal
  client instead of two.
- **Phase 4X before 8A — this is a hard block, newly identified.** Session 8-1 deletes migrated
  `app/api/**` routes. Two payment paths are still monolith-native and would break:
  `MIGRATE_WRITE_APIS_MONEY_DLOCAL=false` (blocked on **F49**) and the Stripe webhook, never
  repointed (**F60**, order `4a-13-…` PRE-DRAFTed 2026-08-04 and never run). Deleting first
  would take real money traffic down. Recommend running 4X immediately after 7-3 — the three
  sessions are 1–2 h each and none of them touches the frontend.
- **Phase 9 before Stack D/E.** Stack D's `AIAnalystPanel` and Stack E's comments feed are
  Panels 2 and 3 of codebase 2's `/terminal` page. Building them against the current UI means
  building them twice.
- **Phase 10 before 8A.** The draw→alert→fire path has never been proven live end-to-end; 8-1
  must not delete anything on that path while it is unverified.
- **Phase 11 before Phase 12/13.** The preparatory spec's own §4 execution order — tier config,
  guards, JWT claims and the token limiter gate every AI call Stack D makes.
- **8B last.** 8-3's journey list is amended below to include the new stacks.

---

## 1. Where the parts landed

| Your ref | Item                                        | Roadmap home                                             |
| -------- | ------------------------------------------- | -------------------------------------------------------- |
| 1.9      | Session 7-2                                 | Gate 1 — unchanged, run it next                          |
| 2.1      | Seed UI increment (codebase 2)              | **Phase 9** (source of truth, read-only)                 |
| 2.2      | `mobile-app/`                               | **Phase 15**                                             |
| 2.3      | Marketing resources hand-off                | Residuals in **9-7 / 9-8 / 8A** (see §5)                 |
| 2.4      | Hybrid appearance hand-off                  | Server side **done**; client residuals in **9-1**        |
| 2.5      | Language/timezone hand-off                  | §6.C → **12-5**; §6.D → **F74**, decided in **11-1**     |
| 3.1/3.2  | Drawing engine & line alerts                | **Phase 10** (residuals only — the port is already done) |
| 4.1      | Web chat Contabo spec                       | **Phase 14**                                             |
| 5.1–5.4  | Stack D / Stack E / tier prep / Parts 26–33 | **Phases 11, 12, 13**                                    |

**Correction to PART 3's framing.** The drawing engine and line alerts _were_ part of the
migration: `lib/alert-engine/*` no longer exists in the monolith — it lives at
`operation-service/src/alert-engine/` (Sessions 4B-2/4B-3), drawings CRUD at
`operation-service/src/drawings/` (4B-8), and line alerts inside alerts CRUD (4B-5/6/7), all
cut over and in `migration-cutover-table.md` as Slices 6, 7 and 8. What is genuinely unowned is
listed in Phase 10 below. The blueprint at `davintrade-draw-engine-and-line-alerts-stack/
architecture-design-blueprint/` still describes the _monolith_ layout and is stale as of 4B-3 —
Session 10-3 fixes that.

**Correction to PART 1.6's path.** `migration-process-handbook-antigravity-v11.md` does not
exist. The file is `…-v11.xlsx` (same folder). The `.md` operating manual in that folder is
`davin-operational-manual/SESSION-PROMPT-SCRIPT.md` + `HOW-TO-TALK-TO-CLAUDE-CODE.md`.

---

## 2. New flags to register (plan §11 / `DECISION-LOG.md`)

Highest existing flag is **F64**. These continue the sequence. Every one is a real fork in the
road that a session downstream cannot answer for itself.

| Flag    | Phase | Question                                                                                                                                                                                                                                                                                                                                                                                          | Must be resolved by |
| ------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| **F65** | 9     | **BFF boundary.** Does the browser keep calling monolith `app/api/**` forever, or eventually call `operation-service`/`money-service` directly? Plan §10's 8-1 ("monolith contains only UI + keepers") assumes the latter; F45/F30 and 7-1's server-only `lib/api/index.ts` assume the former. Phase 9's data layer and 8-1's deletion list both depend on the answer. ⚠ NEEDS EXPLICIT SIGN-OFF | Session 9-0         |
| **F66** | 9     | **Swap mechanism + brand scope.** Big-bang branch swap vs per-surface progressive replacement; and how far the "Trading Alerts" → "DavinTrade" rename goes (page titles, email templates, legal copy, Stripe product/price names, `manifest.json`, OG images).                                                                                                                                    | Session 9-0         |
| **F67** | 10    | **Where the live drawing-alert smoke test runs.** Never executed — 2026-07-05 attempt had no Docker, no root, and an unreachable Railway Postgres. Contabo VPS vs local Docker vs a Railway scratch environment.                                                                                                                                                                                  | Session 10-1        |
| **F68** | 11    | **The Parts 02–33 tier matrix.** The preparatory spec redefines FREE/PRO entitlements platform-wide, including surfaces already sold. Needs product sign-off and a cross-check against live Stripe entitlements before any code moves. ⚠ NEEDS EXPLICIT SIGN-OFF                                                                                                                                 | Session 11-1        |
| **F69** | 12    | **LLM provider, model and monthly cost ceiling** for Stack D (Gemini vs Claude vs both behind the router), plus the fallback when the ceiling is hit. Money-adjacent → §7 escalation. ⚠ NEEDS EXPLICIT SIGN-OFF                                                                                                                                                                                  | Session 12-0        |
| **F70** | 12    | **VANNA / txtai runtime host.** Both are Python. Contabo VPS (next to MT5/Flask) vs a new Railway service vs in-process. Also: which DB role reads `market_data_v6` — Phase 1's fences give `core_app` no market-data grant.                                                                                                                                                                      | Session 12-0        |
| **F71** | 13    | **Stack E generation mechanism.** A PL/pgSQL trigger on `market_data_v6` writes into the schema `railway-gateway` owns and the `gateway_ingest` role writes; `EXECUTOR-PROTOCOL.md` §5 says the ingest path must never blip, and 8-2 is about to dedup that schema. DB trigger vs application-side generation. ⚠ NEEDS EXPLICIT SIGN-OFF                                                         | Session 13-0        |
| **F72** | 14    | **Contabo chat stack scope.** Domain + TLS for `chat-api.<domain>`; whether NLLB-200 translation ships in v1 (model size vs Contabo CPU); whether the bot worker reuses Phase 12's LLM router; and how `client_message` authenticates — the hand-off spec has **no auth on the socket at all**.                                                                                                   | Session 14-0        |
| **F73** | 15    | **Mobile distribution + push ownership.** Direct APK vs Play Store; FCM project ownership and key storage; iOS via PWA only or a paid Apple account.                                                                                                                                                                                                                                              | Session 15-0        |
| **F74** | 11    | **Payment currency wiring** (language spec §6.D, deliberately deferred 2026-08-19). Reading `userPreference.currency` into checkout requires per-currency Stripe Price objects — a product-catalog decision, not a code one. ⚠ NEEDS EXPLICIT SIGN-OFF                                                                                                                                           | Session 11-1        |

### Already-open flags this roadmap schedules

| Flag | Owed by                                                                                     |
| ---- | ------------------------------------------------------------------------------------------- |
| F12  | 8-5 (whole-plan duration — re-estimate against this roadmap, then close)                    |
| F21  | 9-4 (24 h account-deletion GDPR gap — the settings/account surface is rebuilt there anyway) |
| F47  | 4A-15 (Wise non-USD quote correctness)                                                      |
| F49  | 4A-14 (dLocal `payment_method_flow` — **blocks 8-1**)                                       |
| F50  | 4A-15 (`COMMISSION_CREDITED` outbox `aggregateId`)                                          |
| F60  | 4A-13 (Stripe webhook cutover — **blocks 8-1**)                                             |
| F64  | 9-4 (subscription-card optimistic-undo bug — the billing surface is rebuilt there)          |

---

## 3. Phase detail

Every session below is a normal migration order: correct `TEMPLATE-*.md` variant, PRE-DRAFT at
the previous session's close, `Decisions taken` from the Advisor, Davin APPROVES, Executor
CONFIRMS against live code. Nothing here fast-paths that.

### Phase 4X — Carry-forward money cutovers (3 sessions)

Unfinished Phase 4 business, not new work. Named `4X` so nothing is renumbered.

- **4A-13 — Stripe webhook cutover** (VERIFY-RETIRE). Order already PRE-DRAFTed 2026-08-04.
  Re-verify money-service's dormant `StripeWebhookController` against Stripe's current event
  shape (built 2026-07-27, never exercised), repoint the dashboard webhook URL mirroring the
  dLocal/4A-5 precedent, prove live with Davin present. Closes **F60**. ⚠ real money.
- **4A-14 — dLocal write-API Group B cutover** (PORT + CUTOVER). Fix the missing
  `payment_method_flow` field in both implementations, then flip
  `MIGRATE_WRITE_APIS_MONEY_DLOCAL`. Closes **F49**, completing Slice 4 (currently 3/4 groups).
  ⚠ real money.
- **4A-15 — Wise + outbox defect sweep** (PORT, low dial). **F47** (non-USD quote
  `targetAmount`/currency-unit correctness — due before any further non-USD payout) and **F50**
  (`COMMISSION_CREDITED` `aggregateId` resolves to the payer, not the affiliate).

**Gate:** all three CLOSED before Session 8-1 opens.

---

### Phase 9 — Frontend Stack Replacement (11 sessions, cut on layout boundaries)

**Goal.** Replace the monolith's frontend (85 pages, "Trading Alerts" brand) with codebase 2
(`seed-code/trading-conversational-ai-ui-pages-increment/`, 93 pages, "DavinTrade" brand), bound
to the _real_ data layer, auth and tier gates. Codebase 2 has **no backend, no NextAuth, no
session, and a no-op `middleware.ts`** — supplying those is the substance of this phase, not
copying files.

**Inputs (read, do not re-derive):**
`docs/files-completion-list/frontend-codebase-migration/ui-pages-replication.xlsx`
(sheet `codebase_1_vs_codebase_2`, 97 rows — the authoritative route ledger);
`…/codebase-2-parity-audit/00-MASTER-PLAN.md` + `batch-0…8` (95-row parity audit, complete);
`…/light-dark-mode-theme-migration/` (all routes verified light **and** dark);
`docs/files-completion-list/page-comparison-PUBLIC-VS-PAGES-INCREMENT.xlsx`.
From this phase onward `seed-code/**` is **read-only** again — the target is `app/` and
`components/` in the main repo.

#### Why the sessions are cut this way (amended 2026-08-20)

Sessions are cut on **layout boundaries**, not on "surfaces". Codebase 1 has **12 `layout.tsx`
files**; a route group is only the outermost kind, and the nested ones
(`(dashboard)/settings/`, `(dashboard)/admin/`, `admin/disbursement/`, and 5 under
`app/affiliate/`) are equally real seams. Three reasons this beats a surface-based cut:

1. **Batch membership becomes falsifiable.** "Which session owns `/admin/system/jobs`?" is
   answerable from the tree (it sits under `admin/layout.tsx`, so: admin-core) rather than from
   judgment. Phase 6's A2-12 failure was exactly a row assigned to a session whose order never
   scoped it.
2. **Shell bugs cannot cross a session boundary.** Each session transplants exactly one
   `layout.tsx` plus its guard and nav — the containment the "double `<AppHeader>`" bug (parity
   audit, Batch 3) needed and did not have.
3. **A closed URL set per session** makes a route-manifest diff a real exit check.

**Honest limits of the rule.** It does nothing for the actual hard part (codebase 2 has no data
layer — that is per-page work however you batch it); Session 9-6 deliberately spans three groups
because payment is a _flow_, not a layout; and it does not solve sizing — 9-8 (19 pages) and 9-7
(14 pages, 5 nested layouts) are both likely over the playbook's ~4 h split threshold and should
be expected to become 9-7a/b and 9-8a/b once 9-0 produces real per-page effort. **How much the
rule is worth is decided by F66:** under a big-bang branch swap it is mild bookkeeping; under
progressive per-surface shipping — where every migrated subtree must render correctly beside
un-migrated pages sharing the root layout — it is load-bearing.

#### The layout inventory (verified against both trees 2026-08-20, not from the xlsx)

| Layout boundary (codebase 1 = the target structure)              | CB1 pages | Where those pages sit in codebase 2                  | Session |
| ---------------------------------------------------------------- | --------- | ---------------------------------------------------- | ------- |
| `app/layout.tsx` (root shell, providers, globals)                | —         | root shell + `providers.tsx`                         | 9-1     |
| `app/(marketing)/layout.tsx`                                     | 12        | **ungrouped at app root**                            | 9-2     |
| `app/(public)/layout.tsx`                                        | 2         | `(public)` ✓                                         | 9-2     |
| `app/(auth)/layout.tsx`                                          | 7         | `(auth)` ✓                                           | 9-3     |
| `app/(dashboard)/layout.tsx` — core                              | 7         | `(dashboard)` ✓ (+ new `/terminal`, `/free` at root) | 9-4     |
| `app/(dashboard)/settings/layout.tsx`                            | 11        | `(dashboard)/settings` ✓                             | 9-5     |
| root commerce (`checkout`, `checkout/return`, `upgrade/success`) | 3         | root ✓                                               | 9-6     |
| `app/affiliate/*` — 5 nested layouts                             | 14        | **ungrouped `app/affiliate`** (14)                   | 9-7     |
| `app/(dashboard)/admin/layout.tsx` — core                        | 19        | **ungrouped `app/admin`** (33 total)                 | 9-8     |
| `app/(dashboard)/admin/disbursement/layout.tsx`                  | 10        | inside that same ungrouped `app/admin`               | 9-9     |
| **Total**                                                        | **85**    | **93**                                               |         |

Route groups are **URL-neutral** in Next.js, so adopting codebase 1's grouping while taking
codebase 2's page bodies costs nothing and preserves Davin's own standing rule that every
codebase-2 URL must match codebase 1 exactly.

#### Sessions

- **9-0 — Swap contract & decisions** (CONTRACT, no code). Resolve **F65**, **F66**. Produce
  `docs/migration-orders/frontend-swap-route-map.md`: one row per route — codebase-2 source file
  → main-repo destination (**including its target layout boundary**) → the real endpoint/hook it
  binds to → auth gate → tier gate → which codebase-1 file it retires. Inventory what codebase 2
  lacks wholesale: session/auth, middleware gating, data fetching, i18n `<T>` bound to the real
  `GET /api/user/preferences`, error/loading boundaries, and the 5 Batch-0 findings still open
  (no-op `middleware.ts`; `--accent-foreground` light-mode contrast; missing sidebar Help item;
  dead `components/header.tsx`; `davintrade.com` vs `davin-trade.com`). Also produce real
  per-page effort estimates so 9-7/9-8's split can be decided on evidence rather than guessed.
  **Done when:** zero unmapped rows in either direction; F65/F66 in `DECISION-LOG.md`.
- **9-1 — Root shell & design system** (UI-BUILD). `app/layout.tsx`, `providers.tsx`,
  `globals.css` tokens, Tailwind config, fonts, brand assets, `theme-provider`, the appearance
  engine (server persistence already exists — `UserAppearance` + `lib/appearance/`),
  AppHeader/ChatSidebar/marketing header+footer, and the three root boundaries
  (`not-found.tsx`, `error.tsx`, `global-error.tsx`). Fix the Batch-0 findings. Nothing else can
  be migrated before this lands.
- **9-2 — `(marketing)` 12 + `(public)` 2** (UI-BUILD). Landing, about, blog, careers,
  changelog, disclaimer, docs, help, pricing, privacy, status, terms; plus the two
  account-deletion token pages. **Deliberately second, ahead of auth:** these are the only pages
  that render without a session, so they are verifiable end-to-end while the
  no-test-credentials gap (Waiting-on #117) is still open. Closes Phase 6's ticketed
  `/welcome` (B2-13) if F66 scopes it here.
- **9-3 — `(auth)` 7** (UI-BUILD). login, register, forgot/reset password, verify-2fa,
  verify-email(+pending). Bind to the real bridge (`NEXT_PUBLIC_AUTH_BRIDGE_ENABLED`, F56) and
  NextAuth OAuth; codebase 2's mocked `social-auth-buttons.tsx` becomes real. **This session
  unblocks live verification for every session after it.**
- **9-4 — `(dashboard)` core 7 + `/terminal` + `/free`** (UI-BUILD). dashboard, alerts,
  alerts/new, alerts/[id]/edit, notifications, and the two chart-workspace pages **retired** in
  favour of `/terminal` (PRO 4-panel) and `/free` (3-panel). **Stack D and Stack E panels ship
  as flag-gated empty states — never mock data** (Session 6-1b exists because three pages
  shipped fabricated data). The drawing toolbar and line-alert UI bind to the live
  `operation-service` endpoints.
- **9-5 — `(dashboard)/settings/` 11** (UI-BUILD). All settings pages against real endpoints;
  appearance and language/timezone already have real backends. Closes **F21** and **F64**.
- **9-6 — Payments flow** (UI-BUILD + PORT, **deliberately cross-boundary**). `/checkout`,
  `/checkout/return`, `/upgrade/success`, plus `/pricing` (owned by 9-2) and `/settings/billing`
  (owned by 9-5) re-verified as one end-to-end journey. Payment is a flow, not a layout, and
  money code escalates (`EXECUTOR-PROTOCOL.md` §7) — it earns one focused session rather than
  being smeared across three. Test mode only.
- **9-7 — `app/affiliate/*` 14** (UI-BUILD). Landing, join, register, verify, dashboard + 8
  subroutes, payout settings; `/affiliate/resources` binds to the real
  `GET /api/affiliate/dashboard/resources` built 2026-08-20. **Five nested layouts** — expect
  this to split into 9-7a (public/join/register) and 9-7b (`affiliate/dashboard/*`).
- **9-8 — `(dashboard)/admin/` core 19** (UI-BUILD). Overview, users(+detail),
  affiliates(+detail) and the 5 affiliate reports, settings/affiliate, fraud-alerts(+detail),
  errors, api-usage, and all four `admin/system/*` pages (they sit under `admin/layout.tsx`, not
  under disbursement). Includes **`/admin/resources`**, whose backend shipped 2026-08-20 with no
  page behind it. Expect a 9-8a/9-8b split.
- **9-9 — `admin/disbursement/` 10** (UI-BUILD). disbursement root, accounts, affiliates(+id),
  audit, batches(+id), config, recipients, transactions — one nested layout, one session.
- **9-10 — Phase 9 exit** (VERIFY-RETIRE). Every row of the 9-0 map live and bound to real
  data; zero mock constants repo-wide; component tests rebuilt and `test:ci` green; light _and_
  dark verified on every route; dead codebase-1 components deleted;
  `phase-6-frontend-gap-matrix.md` marked SUPERSEDED-BY-PHASE-9 (not deleted — it is Phase 6's
  record).

#### Per-session exit check (new — applies to 9-1 … 9-9)

`tsc --noEmit` and `test:ci` are not sufficient here. Every session additionally ends with a
**route-manifest diff**: the exact set of URLs that appeared, disappeared and stayed. A stale
`app/about/` surviving beside a new `app/(marketing)/about/` gives two files resolving to
`/about` — Next.js fails the build, and nothing in the normal gate would have predicted it.
The diff must match the session's own layout-boundary row and nothing else.

#### Codebase-2 pages with no codebase-1 counterpart (triage before 9-8 opens)

Codebase 2's `app/admin` carries **33** pages against codebase 1's **29**. The four extras are
not all wanted:

| Codebase-2 page                 | Disposition                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `admin/resources`               | **Take it** — its backend shipped 2026-08-20 and has no UI                                              |
| `admin/notifications/broadcast` | **Triage at 9-0** — new surface, needs a real endpoint or it ships as another mock                      |
| `admin/disbursement/settings`   | **Triage at 9-0** — same; belongs to 9-9 if kept                                                        |
| `admin/login`                   | **Do NOT take it** — **F62 already RESOLVED** to retire `app/admin/login` behind a redirect to `/login` |

Same class, outside admin: codebase 2 still contains **`app/test-api/`**, which Session 6-12
deleted from codebase 1 on purpose. The swap must not resurrect either page.

**Phase exit criteria:** route parity with the 9-0 map, no dead internal links, no fabricated
data, a11y + responsive at least at Session 6-12's standard, `test:ci` net-neutral-or-better,
and a clean route-manifest diff against the 9-0 map.

---

### Phase 10 — Drawing Engine & Line-Alert closure (3 sessions)

Only the residuals — the port itself shipped in 4B-2/3/5/6/7/8.

- **10-1 — Live end-to-end smoke** (INFRA/VERIFY). Run `PHASE-4-SMOKE-TEST-RUNBOOK.md` for real:
  Flask `mt5-service/app/redis_pub.py` → Redis `prices:{symbol}:{tf}` → the `operation-service`
  alert-engine worker → `Notification` row + socket push + chart marker. This is the **one
  remaining unverified link** in the whole feature (2026-07-05 attempt blocked on environment,
  not code). Resolve **F67** first.
- **10-2 — e2e + API coverage** (VERIFY). Playwright `draw → attach alert → price crosses →
fire → toast + chart marker + email`, on the Phase 9 terminal. Newman coverage for
  `/api/drawings` and `/api/alerts/line`. The only existing alert e2e is
  `e2e/archive/tests/path7-alert-notifications.spec.ts` — archived, and for the older generic
  alert flow.
- **10-3 — Blueprint reconciliation & close** (VERIFY-RETIRE). Rewrite the blueprint's §3/§7/§14
  status callouts to describe the `operation-service` reality (they still describe monolith
  `lib/alert-engine/`, Prisma 6 and `prisma/schema.prisma` — all three moved); fold
  `implementation-progress-files-and-folder-directory.md` into `migration-stack-analysis.md`.

**Deliberately NOT here:** tool-set gating by tier. The blueprint's Phase 6 flags it as never
implemented, but the _values_ come from Phase 11's tier matrix — building it twice would be the
error. It is scoped into Session 11-1.

---

### Phase 8A — Decommission, part 1 (2 sessions)

Sessions 8-1 and 8-2, unchanged in scope, moved earlier.

- **8-1 — Deletion sweep.** **Entry criteria now include:** 4A-13, 4A-14, 4A-15 CLOSED (F49/F60
  resolved); Phase 9-10 CLOSED; **F65** resolved (it defines what "migrated" means for a route
  the browser still calls). Delete migrated `app/api/**` except keepers, the `frontend/` mirror
  dLocal slice, empty `vercel.json` crons, and the 6 dead `token-2fa-*` files if 7-2 left them.
- **8-2 — Gateway deployment & schema dedup.** Unchanged — **and it must run before Session
  13-1**, which wants to add a trigger to the very `market_data_v6` schema this session
  deduplicates.

---

### Phase 11 — Preparatory Tier-Access & Core Refactoring (3 sessions)

Source: `davintrade-stack-d-and-e/PREPARATORY-TIER-ACCESS-AND-CORE-REFACTORING-SPECIFICATION.md`
§3 (6 Core Areas) and §4 (its own execution order).

- **11-1 — Tier matrix decision + types/config** (CONTRACT + PORT, Core Area 1). Resolve
  **F68** (⚠ sign-off: this changes entitlements on a product with paying users — cross-check
  every proposed FREE/PRO line against live Stripe entitlements and the existing
  `lib/tier-config.ts` before writing anything) and **F74** (payment currency wiring). Then
  update `@trading-alerts/types` and `lib/tier-config.ts`, including the drawing tool-set
  entitlements deferred from Phase 10.
- **11-2 — Guards, JWT claims & header forwarding** (PORT, Core Areas 2/3/6). `lib/tier-
validation.ts`, NestJS `TierGuard`, the JWT payload in `operation-service/src/auth/`, and
  Next.js → service header forwarding. **Known defect to fix here, not discover later:**
  `forwardedRequestContext()` forwards only `x-correlation-id`/`user-agent`/`x-forwarded-for`
  and silently drops everything else — that is why the 2026-08-19 GeoIP work could not be
  mirrored into `operation-service`.
- **11-3 — Token metering & schema** (INFRA + PORT, Core Areas 4/5). Redis
  `trackAiTokenUsage()` sliding-window limiter (integrate with the existing three-layer rate
  limiter, do not add a fourth), `TokenUsageLog` model and `profile` JSONB via `prisma db push`
  (this repo's convention — no migrations folder; L1 applies: author in
  `prisma/non-market-data/schema.prisma`, `prisma generate` only on the service side).
  **Done when:** a tier-gated dummy AI route returns 429 at quota, proven by test.

---

### Phase 12 — Stack D: Conversational AI Analyst (6 sessions)

Source: `STACK-D-CONVERSATIONAL-AI-CHART-ANALYSIS-ARCHITECTURE.md` §5 (Parts 26–30).
Greenfield: the repo has **zero** LLM SDKs, no VANNA, no txtai.

- **12-0 — Decisions & contracts** (CONTRACT, no code). Resolve **F69**, **F70**. Confirm Part
  24's `mtf_render` PNG pipeline actually exists and is reachable from wherever the router runs
  — the whole multimodal claim rests on it. Freeze the OpenAPI for `/api/ai/chat*` **before**
  building, so Phase 7's generated client picks it up rather than drifting from day one.
- **12-1 — Part 26: dual-RAG infrastructure** (INFRA). VANNA schema vectors over
  `market_data_v6`, txtai trading-knowledge index, PNG artifact storage. **Reuse the existing
  Vercel Blob** integration (added 2026-08-20) rather than introducing a second storage backend.
- **12-2 — Part 27: NL2SQL + quad-retrieval orchestrator** (PORT). Invariant: every generated
  SQL statement carries `symbol='XAUUSD'` and `timeframe IN ('M5','M15')` — enforced in code and
  proven by an adversarial test, not by prompt instruction. `Promise.all` < 150 ms with a
  measured assertion. 5-stage clarification gate.
- **12-3 — Part 28: context assembly + multimodal LLM router** (PORT). Router, cost surveillance
  into `TokenUsageLog`, quotas from 11-3, hard ceiling behaviour from F69.
- **12-4 — Part 29: instrument chat management + `AIAnalystPanel`** (UI-BUILD). "1 instrument =
  1 thread" state machine on the Phase 9 terminal shell; a firing alert appends to the active
  thread without duplicating a sidebar entry.
- **12-5 — Part 30: SSE streaming + action cards** (UI-BUILD). `/api/ai/chat/stream`,
  `TradeSetupCard`, `MarketHealthCard`. **Also closes the language hand-off's §6.C** (AI
  system-prompt language injection) — skipped 2026-08-19 because no LLM route existed; it does
  now. ⚠ Trade-setup cards render entry/TP/SL: confirm the disclaimer copy from `/disclaimer`
  (F63) is displayed with them.

---

### Phase 13 — Stack E: Market Comments & Quality Metrics (4 sessions)

Source: `STACK-E-POSTGRESQL-JSONB-MARKET-COMMENTS-ARCHITECTURE.md` §5 (Parts 31–33).

- **13-0 — Decisions & contract** (CONTRACT, no code). Resolve **F71** (⚠ sign-off). The design
  as written puts a PL/pgSQL trigger on `market_data_v6` — a table in the market-data schema
  that `railway-gateway` owns, that `gateway_ingest` writes, and that
  `EXECUTOR-PROTOCOL.md` §5 marks must-never-blip. Options: DB trigger (as designed),
  application-side generation in the gateway or a worker, or a materialized side table. Also
  freeze the JSONB element schema (`icon_type`/`timestamp`/`short_comment`/`call_action`).
  **Entry criterion: Session 8-2 CLOSED** — do not add a trigger to a schema mid-dedup.
- **13-1 — Part 31: narrative engine + indexes** (INFRA). Whatever F71 chose, plus the two-stage
  GIN index strategy. Prove ingest throughput is unchanged before and after — a regression here
  is a data-pipeline outage, not a UI bug.
- **13-2 — Part 32: NOTIFY/Redis → socket gateway** (PORT). Reuse the realtime architecture F8
  settled at 4B-17 (`operation-service`'s existing HTTP process, real socket.io, NextAuth-JWE
  handshake). **Do not stand up a second socket server.** Mind 4B-18b/18c/18d's CORS-origin,
  CSP `connect-src` and reconnect-loop lessons.
- **13-3 — Part 33: comments feed + quality metrics UI** (UI-BUILD). Panel 3 on the Phase 9
  terminal: `MarketCommentsFeed` + `QualityMetricsPanel` (Bar Coverage / Regression R² / EDT
  Fitness / Baseline Symmetry), replacing 9-4's empty state.

---

### Phase 14 — Web Chat / Contabo support stack (4 sessions)

Source: `seed-code/trading-conversational-ai-ui-pages-increment/docs/web-chat-stack/
contabo_backend_handoff_spec.md` + `web-chat-stack-specification.md`.

- **14-0 — Decisions & contract** (CONTRACT). Resolve **F72**. Note the hand-off spec's
  `client_message` payload carries **no authentication or user identity at all** — for a
  product with billing and PRO support tiers that is a design gap to close here, not at 14-2.
- **14-1 — Container stack build & deploy** (INFRA). The 4 containers (Socket.io server, Redis
  broker, NLLB-200 API if F72 keeps it, BullMQ bot worker), `docker-compose.yml`, Nginx TLS
  termination, health checks, restart policy.
- **14-2 — Frontend binding** (PORT). `NEXT_PUBLIC_SOCKET_CHAT_URL`, socket client, the Support
  Centre widget from the Phase 9 shell. Add the chat origin to `next.config.js`'s CSP
  `connect-src` — the exact class of bug 4B-18c fixed for realtime.
- **14-3 — Cutover + runbook** (VERIFY-RETIRE). Live handshake proof, rollback = unset the env
  var (the widget degrades to the existing support-ticket form), runbook entry under
  `docs/runbooks/` for CC-G.

---

### Phase 15 — Mobile App Integration (5 sessions)

Source: `mobile-app/docs/MOBILE_UI_SPECIFICATION.md`. Today `mobile-app/src` makes **zero API
calls**, and the backend has **no FCM, no push dispatcher and no device-token model**.

- **15-0 — Contract & decisions** (CONTRACT). Resolve **F73**. Define the mobile API surface —
  mobile is a _separate origin_, so CORS, JWT issuance and refresh, and whether it goes through
  the monolith BFF or straight to services (falls out of **F65**).
- **15-1 — Push infrastructure** (INFRA). `DeviceToken` model, registration/revocation
  endpoints, FCM dispatcher inside `operation-service`, hooked into the existing alert-engine
  `dispatcher.service.ts` / `notify-bridge.service.ts` — a new delivery channel alongside
  in-app and email, not a parallel pipeline.
- **15-2 — Mobile data layer** (PORT). Wire `mobile-app/src` to real endpoints with a typed
  client generated from the same specs Phase 7 emits; auth flow; tier gating from Phase 11.
- **15-3 — Capacitor packaging** (INFRA + UI-BUILD). Android build pipeline, high-priority
  notification channel, custom alert chimes, screen wake lock, PWA/iOS path.
- **15-4 — Mobile e2e + release** (VERIFY-RETIRE). A real alert fires → push lands on a real
  device with the right chime; signed release artifact; distribution per F73.

---

### Phase 8B — Final verification & close-out (3 sessions)

Sessions 8-3/8-4/8-5, **amended**:

- **8-3 — Full-system e2e.** Original journeys (ingest, auth/2FA, alert fire→notify, Stripe +
  dLocal checkout, affiliate→commission→batch, tier gating) **plus**: draw→line-alert→fire;
  AI chat quad-retrieval → streamed answer → trade-setup card; market-comment generated →
  socket → Panel 3; support chat round trip; mobile push received.
- **8-4 — Load test + capacity.** Original scope **plus** the AI token path (cost per user at
  load, against F69's ceiling) and socket fan-out with the comments feed live.
- **8-5 — Runbooks + close-out.** `docs/runbooks/*` including the Contabo chat stack and the
  FCM dispatcher; regenerate `migration-stack-analysis.md`; close **F1–F74**; re-estimate and
  close **F12**; declare done after the 30-day joint stability window.

---

## 4. What does not change

- The three-role chain, the order lifecycle (PRE-DRAFT → DRAFT → APPROVED → CONFIRMED), the
  §7 escalation list, the do-not-touch list, session-history hygiene, lesson harvesting.
- **PD1 stays in force.** Orders arrive with `Decisions taken`; the Executor decides from live
  code and asks; when plan and live code disagree, live code wins.
- Every new phase still updates the same four artifacts at close: `CLAUDE.md`, `DECISION-LOG.md`,
  `migration-cutover-table.md` (when a route/slice moves), `migration-stack-analysis.md` (when
  files are created/moved/deleted).
- **Cutover-table scope is unchanged:** traffic-carrying slices with a real rollback mechanism.
  Phases 9–15 are mostly additive builds, so most of them will correctly add **no rows** — the
  same call Phase 6 made deliberately. 4A-13/4A-14 _do_ move rows.

---

## 5. Carried-forward residuals (things with no session until now)

| Item                                                                                                                               | Now owned by                                        |
| ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `BLOB_READ_WRITE_TOKEN` not provisioned — the real upload path is untested                                                         | **Davin**, before 9-8                               |
| `/admin/resources` has a backend but no page                                                                                       | 9-8                                                 |
| `MarketingAsset` not mirrored into money-service (decide keep-or-mirror)                                                           | 8-1                                                 |
| Stale CORS comment in `money-service/src/main.ts` (phantom `NEXT_PUBLIC_MONEY_API_URL`)                                            | next session touching that file; else 8-1           |
| Generated-spec request/response bodies are generic `type: object` (Zod, not class-validator, so `@nestjs/swagger` has no metadata) | 7-3, or a scoped Zod-to-OpenAPI session before 12-0 |
| Two unstaged doc deletions + untracked `seed-code/lovable-mobile-app/docs/` found 2026-08-19                                       | 9-0 (docs reorg)                                    |
| `CLAUDE.md` / `LESSONS-LEARNED.md` archival backlog (Waiting-on #30/#102/#129)                                                     | next session hitting the §1 size gate               |
| No authenticated live click-through since 6-1b (no test credentials, Waiting-on #117)                                              | 9-0 — Phase 9 cannot be verified without it         |

---

## 6. The single biggest risk in this roadmap

**Phase 9 is not a file copy.** Codebase 2 is a complete, well-audited, _frontend-only_
application: no auth, no session, a no-op middleware, and every data surface either mocked or
absent. The main repo is the opposite: a real data layer, real auth, real tier gates, and 85
pages of accumulated wiring, plus ~164 test suites that assert against the current components.

The failure mode is a session that ports pages visually and calls it done, leaving a
beautiful UI that renders nothing real — the exact defect Session 6-1b existed to remove, at
ten times the scale. Three guards, all non-negotiable:

1. **Session 9-0's route map is the contract.** No page ships in 9-1…9-9 without its row naming
   the real endpoint it binds to. A row that cannot name one is a finding for Davin, not a
   licence to mock.
2. **`test:ci` never goes backwards.** A test needing its assertion changed is a finding, not a
   fix (`LESSONS-LEARNED.md` L3). Where a component genuinely dies, its test dies with it and
   the count is reconciled explicitly in the order's Deviations.
3. **A route-manifest diff closes every session 9-1…9-9.** The set of URLs added, removed and
   unchanged must match that session's own layout-boundary row and nothing else. This is the
   only check that catches a stale `app/about/` surviving beside a new `app/(marketing)/about/`
   — two files resolving to one URL, which fails the Next.js build and which neither `tsc` nor
   `test:ci` would have predicted.
