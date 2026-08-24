# Decision Log — Flag Resolutions & Material Decisions

**What this is:** the append-only record of every flag resolution (F1–F19) and every
material decision made during the migration.

**Two ID prefixes are in use.** `F<n>` = a _technical_ flag from the plan's §11 register (an
unknown identified during planning, resolved during execution). `PD<n>` = a **Process Decision**
— a change to how the three-role chain itself operates (roles, authority, ritual). They are kept
distinct deliberately: a PD changes the machine, an F changes the work the machine does. The flag _register_ (what each flag asks) lives
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

| Flag | Topic                                                                                                                                                                                                                                                                      | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PD1  | Process decision — the decision model (Advisor decides from docs & doesn't ask; Executor decides from live code & does ask)                                                                                                                                                | RESOLVED — 2026-08-11 (Davin); full rule in `EXECUTOR-PROTOCOL.md` §0                                                                                                                                                                                                                                                                                                                                                                                                  |
| F12  | Whole-plan duration estimate                                                                                                                                                                                                                                               | OPEN — revisit after F1–F5                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| F21  | 24h Account-Deletion GDPR gap                                                                                                                                                                                                                                              | OPEN — `/settings/account` wired to the real `deletion-request`/`deletion-confirm` endpoints (Session 9-5); confirmation/scheduling emails and the actual deletion job are still TODO stubs (no cron/worker exists); full detail in `history/decisions-archive.md`                                                                                                                                                                                                     |
| F76  | dLocal `payment_method_id` sent to Payins API is a display name, not the real method code                                                                                                                                                                                  | RESOLVED — Session 4A-16 (2026-08-24): `DLOCAL_METHOD_CODE_MAP`/`getDLocalMethodCode()` added both sides, live TH/TrueMoney test-mode payment succeeded (`payment_method_id: 'TM'`, zero 5010, real dLocal redirect URL); `MIGRATE_WRITE_APIS_MONEY_DLOCAL` flipped `true` in production; Slice 4 now 4/4 groups; full detail in `history/decisions-archive.md`                                                                                                        |
| F75  | `money_svc` Postgres role missing `UPDATE` grant on `User`                                                                                                                                                                                                                 | RESOLVED — Session 4A-13 (2026-08-21), same session                                                                                                                                                                                                                                                                                                                                                                                                                    |
| F78  | `AppHeader`'s nav/badge chrome goes stale after a server-side-only tier change (e.g. a webhook-driven upgrade) — pages themselves are unaffected                                                                                                                           | OPEN — found Session 9-6 (2026-08-22); full detail in `history/decisions-archive.md`                                                                                                                                                                                                                                                                                                                                                                                   |
| F79  | Same staleness class as F78, but a redirect trap: `affiliate/dashboard/layout.tsx` reads `session.user.isAffiliate` from the JWT and bounces a freshly-registered affiliate back to `/affiliate/register`                                                                  | RESOLVED — Session 9-7b (2026-08-23): both `app/affiliate/dashboard/layout.tsx` and `app/affiliate/settings/layout.tsx` now call `requireAffiliate()` (DB fallback) instead of trusting the JWT claim; live-verified against `free-test@trading-alerts.test`, redirect loop confirmed gone                                                                                                                                                                             |
| F80  | `lib/auth/auth-options.ts`'s `FIXED_TEST_ACCOUNTS` credentials-authorize path unconditionally `upsert`s `isAffiliate: fixed.isAffiliate` (hardcoded per email) on every login, silently wiping a real, legitimately-earned `isAffiliate: true` back to the fixture default | OPEN — found live Session 9-7b (2026-08-23) during its own required click-through; pre-existing, not a 9-7b file; auth-semantics, `EXECUTOR-PROTOCOL.md` §7 escalation; full detail in `history/decisions-archive.md`                                                                                                                                                                                                                                                  |
| F65  | **BFF boundary** — monolith `app/api/**` vs direct browser calls to services                                                                                                                                                                                               | RESOLVED — Session 9-0 (2026-08-22): retain `app/api/**` as the permanent BFF proxy layer; full rationale in `frontend-swap-route-map.md` §1                                                                                                                                                                                                                                                                                                                           |
| F66  | **Frontend swap mechanism + brand scope**                                                                                                                                                                                                                                  | RESOLVED — Session 9-0 (2026-08-22): progressive layout-boundary replacement; DavinTrade rebrand scoped to UI chrome/metadata/email; full detail in `frontend-swap-route-map.md` §2                                                                                                                                                                                                                                                                                    |
| F67  | **Where the drawing-alert live smoke test runs** — never executed                                                                                                                                                                                                          | RESOLVED — Session 10-1 (2026-08-23): Option B (local env) + synthetic feeder, all 4 Invariant Proofs verified live; full detail in `history/decisions-archive.md`                                                                                                                                                                                                                                                                                                     |
| F68  | **The Parts 02–33 tier access matrix** — redefines FREE/PRO entitlements platform-wide                                                                                                                                                                                     | RESOLVED — Session 11-1 (2026-08-24): unified 2-Tier Master Matrix adopted, zero existing PRO entitlement reduced; Davin's live sign-off quoted, full detail in `history/decisions-archive.md`                                                                                                                                                                                                                                                                         |
| F69  | **Stack D LLM provider, model and monthly cost ceiling**                                                                                                                                                                                                                   | OPEN — registered 2026-08-20; **⚠ NEEDS EXPLICIT SIGN-OFF** (money-adjacent, §7); resolve at Session 12-0                                                                                                                                                                                                                                                                                                                                                             |
| F70  | **VANNA / txtai runtime host**; also which DB role reads `market_data_v6` (`core_app` has no market-data grant)                                                                                                                                                            | OPEN — registered 2026-08-20; resolve at Session 12-0. New evidence, Session 8-2 (2026-08-24): production's `market_data_v6` exists but isn't in the `public` schema `core_app`'s Prisma client resolves against — role `search_path` gap, not missing data; full detail below                                                                                                                                                                                         |
| F71  | **Stack E generation mechanism** — PL/pgSQL trigger on `market_data_v6` vs application-side generation                                                                                                                                                                     | OPEN — registered 2026-08-20; **⚠ NEEDS EXPLICIT SIGN-OFF**; resolve at Session 13-0; entry criterion Session 8-2 CLOSED                                                                                                                                                                                                                                                                                                                                              |
| F72  | **Contabo chat stack scope** — domain/TLS, NLLB-200 v1 scope, `client_message` has **no auth on the socket at all**                                                                                                                                                        | OPEN — registered 2026-08-20; resolve at Session 14-0                                                                                                                                                                                                                                                                                                                                                                                                                  |
| F73  | **Mobile distribution + push ownership**                                                                                                                                                                                                                                   | OPEN — registered 2026-08-20; resolve at Session 15-0                                                                                                                                                                                                                                                                                                                                                                                                                  |
| F74  | **Payment currency wiring** (language hand-off §6.D, deferred 2026-08-19)                                                                                                                                                                                                  | RESOLVED — Session 11-1 (2026-08-24): USD stays the sole billing currency, per-currency Stripe Price objects rejected; Davin's live sign-off quoted, full detail in `history/decisions-archive.md`                                                                                                                                                                                                                                                                     |
| F77  | `/alerts` and `/alerts/new` client-side double-render on reload                                                                                                                                                                                                            | OPEN — found Session 9-4 (2026-08-22); likely root cause (React/Next Suspense-streaming reveal artifact, benign) identified at Session 9-5's addendum; a test-alert price-corruption side-effect was observed and needs re-verification before being treated as a proven data-integrity risk; full detail in `history/decisions-archive.md`                                                                                                                            |
| F81  | `POST /api/wise/recipients/[id]/revalidate` is `requireAffiliate()`-guarded, self-service-only (derives target from the caller's own token, `:id` used only for an ownership check) — no admin-scoped equivalent exists                                                    | OPEN — found Session 9-9 (2026-08-23); Row 20's admin `disbursement/recipients` page cannot safely call this route (403 for a non-affiliate admin, or silently revalidates the admin's own recipient instead of the target affiliate's); Davin declined to build a new admin-scoped endpoint in this UI-BUILD session — dropped from Decision 4's scope; a future session needs `requireAdmin()` + explicit affiliate lookup if admin-triggered revalidation is wanted |
| F82  | `DELETE /api/drawings/:id` left the backing `Alert` row permanently orphaned (only `DrawingAlert` cascaded)                                                                                                                                                                | RESOLVED — Session 10-2 (2026-08-23): both `remove()` (operation-service) and the monolith route now collect the attached `alertId`(s) before the cascade and delete them explicitly; full detail in `history/decisions-archive.md`                                                                                                                                                                                                                                    |

> **Legacy flags F1–F64** (all RESOLVED, excluding F12/F21 still OPEN and PD1) have been
> archived to `history/decisions-archive.md` §"Legacy Flag Register (F1–F64)" — complete
> one-line status per flag preserved there verbatim, nothing lost.
>
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

## F80 — OPEN, found Session 9-7b (2026-08-23)

- Status: OPEN
- Session: 9-7b (found, not owned — pre-existing file, out of scope to fix here) · Date: 2026-08-23
- Symptom: live-verifying F79's fix, `free-test@trading-alerts.test` was confirmed
  `isAffiliate: true` in the DB (per this session's own CONFIRM). Signing in via the login page's
  "FREE User" quick-fill (the same fixture) flipped it straight back to `false` — `User.updatedAt`
  moved to the exact moment of that login. Root cause, found by reading `lib/auth/auth-options.ts`
  directly: the credentials `authorize()` callback's `FIXED_TEST_ACCOUNTS` map hardcodes
  `isAffiliate: false` for `free-test@trading-alerts.test`, and its `prisma.user.upsert()` writes
  that hardcoded value on **every** login, unconditionally overwriting any real state — including a
  genuine, already-completed `POST /api/affiliate/auth/register` (Session 9-7a). The same map
  hardcodes `isAffiliate: true` for `affiliate-test@trading-alerts.test` / `affiliate-pro-test@...`,
  so those two fixtures are unaffected; only accounts whose hardcoded fixture value disagrees with
  their real, live-earned state are at risk, and only on next login.
  A second consequence found live, downstream of the same staleness: even after F79's DB-fallback
  fix lets the monolith's own layout gates through, `GET /api/wise/recipients/me` (Row 46) 403'd
  with "Affiliate access required" — money-service's own `AffiliateGuard` trusts the forwarded
  JWT's `isAffiliate` claim directly, with no DB-fallback equivalent to F79's fix. Confirmed the
  page and `WiseRecipientForm` render correctly once verified against a non-stale JWT
  (`affiliate-test@trading-alerts.test`, a fresh login) — this is a stale-JWT propagation gap, not
  a defect in this session's own restyle work.
- Workaround used to complete this session's own verification (not a fix): manually restored
  `isAffiliate: true` directly via Prisma for `free-test@trading-alerts.test` after the reset, and
  avoided re-triggering it by not logging in as that account a second time.
- Not fixed here: `lib/auth/auth-options.ts` is core NextAuth credentials-provider code, well
  outside this session's Surface, and touches auth semantics (`EXECUTOR-PROTOCOL.md` §7 — stop and
  ask, never drive-by). Needs its own scoped decision: e.g., only `upsert` on `create` (first-ever
  login) and leave `update` alone for `isAffiliate`/`tier`/`role` on already-existing test users, or
  stop resetting `isAffiliate` specifically since it's the one field these fixtures are meant to
  gain through real product flows (registration), not carry as a fixed seed value. The
  money-service `AffiliateGuard` gap is a separate, cross-service decision (does it grow its own
  DB-fallback, mirroring F79's fix, or does the JWT get force-refreshed at the point of
  registration instead — same shape of question F57/F78 already raised for tier changes).
- Approved by: n/a (technical finding, not yet resolved — Davin/Advisor to scope the fix session).

## F81 — OPEN, found Session 9-9 (2026-08-23)

- Status: OPEN
- Session: 9-9 (found during Row 20 build, `admin/disbursement/recipients`) · Date: 2026-08-23
- Symptom: the order's own Feeds-on citation for Row 20 named `POST /api/wise/recipients/[id]/
revalidate` as the backing endpoint for an admin-triggered "revalidate Wise recipient" action
  (Decision 4). Reading the route directly (`app/api/wise/recipients/[id]/revalidate/route.ts`)
  before wiring it found it is guarded by `requireAffiliate()`, not `requireAdmin()` — its own doc
  comment explains this is deliberate: the live money-service backend derives the target recipient
  from the caller's own token, using the `:id` param only for an ownership check, not as a lookup
  key. Confirmed live at that session's build time (per the route's own comment) that revalidate is
  an affiliate self-service action on their own payout settings page, not an admin action.
- Root cause: no admin-scoped equivalent exists. Wiring an admin page's button to this route as-is
  would either 403 (an admin isn't necessarily also an affiliate) or — worse — silently revalidate
  the logged-in admin's own Wise recipient record instead of the target affiliate's shown in the
  row, since the affiliate identity comes from the caller's session, not the `:id` in the URL.
- Not fixed here: building a real admin-scoped route (`requireAdmin()` + an explicit affiliate
  lookup, mirroring the self-service route's shape) is backend work beyond this UI-BUILD session's
  stated dial ("Zero" on data — every row binds to an endpoint that already exists) and touches
  authorization semantics (`EXECUTOR-PROTOCOL.md` §7 — stop and ask, never drive-by). Asked Davin
  live; he declined to build it this session. Row 20 ships restyled but read-only for Wise
  recipients (matching its pre-session behavior, "view only, never raw bank details"); Decision 4's
  scope was narrowed accordingly — Quick Pay and batch execute/delete/config-save keep their
  AlertDialog wraps, revalidate does not ship.
- Approved by: Davin (live chat, 2026-08-23) — drop from Session 9-9's scope, register for a future
  session.

## F70 — new evidence, Session 8-2 (2026-08-24), still OPEN

- Status: OPEN (unchanged — evidence added, not resolved; resolution stays owned by Session 12-0)
- Session: 8-2 (found while verifying production ingest for `railway-gateway`'s first deployment)
  · Date: 2026-08-24
- Symptom: `railway-gateway`'s first real write to production `market_data_v6` failed with
  `The table public.market_data_v6 does not exist in the current database` — using a `DATABASE_URL`
  confirmed byte-identical (SHA-256-prefix + length compared, values never printed) to
  `operation-service`'s own. Re-running the exact single-table `CREATE TABLE` DDL (already
  Davin-approved for staging) against the same connection returned `relation "market_data_v6"
already exists`.
- Root cause: Prisma's generated client always fully qualifies queries with the `public` schema
  (no `@@schema` declared in either `prisma/market-data/schema.prisma` or `railway-gateway`'s own
  mirror). The connecting role's own `search_path` resolves an unqualified `CREATE TABLE`/query to
  a different schema first — the table is real and was never missing, it's just not reachable
  through `public`. This is exactly this flag's own already-registered question: "which DB role
  reads `market_data_v6` — `core_app` has no market-data grant."
- Not fixed here: resolving which schema/role should actually own `market_data_v6` is DB-grant
  architecture, explicitly this flag's own scope and Session 12-0's to decide — not something to
  guess at mid-deployment. Session 8-2 stopped, disclosed the full evidence chain to Davin, and —
  per his explicit direction — closed on staging's complete end-to-end proof plus production's
  healthy `/health`, deferring production ingest verification to this flag's resolution.
- Approved by: Davin (live chat, 2026-08-24) — accept staging proof + production health as Session
  8-2's verification of record; defer schema/role fix to Session 12-0.
