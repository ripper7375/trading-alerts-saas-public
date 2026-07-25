# Migration Order — VERIFY/RETIRE variant

> For **cutovers, deletions, and exit reviews**. Read `00-SKELETON-AND-RULES.md` first — §4 applies
> with the dial at **near zero**: checklists exist to be obeyed. Keep this order SHORT (~10 lines for
> a cutover). **If executing it uncovers real work, STOP** — that work gets its own session with the
> right variant.

**Session:** 4A-7b · **Variant:** VERIFY-RETIRE · **Status:** PRE-DRAFT (fast-path candidate)
**Generated:** 2026-07-25 (Advisor) · **Updated:** 2026-07-25 (Executor, at 4A-7a's close — corrected
flag names/count and the end-to-end evidence description below to match what 4A-7a actually built)
**Estimated time:** <1h per group (2 groups)
**Phase / plan section:** Phase 4A — money-service, blueprint §5.5 **Slice 3 (of 5)**, CUTOVER half
**Supersedes:** `4a-7-money-service-read-apis-cutover.migration-order.md` (together with `4a-7a-…`)
**Flags:** `MIGRATE_READ_APIS_MONEY_AFFILIATE` (4 routes) and `MIGRATE_READ_APIS_MONEY_ADMIN`
(8 routes) — **two** flags, not one; both currently OFF everywhere. F44/F45 resolved in 4A-7a
(`DECISION-LOG.md`).

---

## Entry criteria

- [ ] **4A-7a closed all-green**, and its end-to-end evidence is in its Deviations: a script-minted
      test-fixture token's request confirmed (via Railway logs) reaching money-service, correctly
      passing `JwtAuthGuard`+`AffiliateGuard`, correctly executing a real Prisma lookup (404, because
      the test fixture lived in a different DB than money-service's production one — a transport/auth
      success, not a data-path failure — see 4A-7a's own Deviations section for the full explanation
      before assuming this means something's broken). 403 (wrong role) verified clean. 401 (signed out) hit a **pre-existing,
      unrelated** bug (`LESSONS-LEARNED.md` L12) — not a 4A-7a regression, don't let it block this order.
- [ ] **Both `MIGRATE_READ_APIS_MONEY_AFFILIATE` and `MIGRATE_READ_APIS_MONEY_ADMIN` exist and are
      currently OFF in production** — verified value-blind (grep for the key, never print the value).
- [ ] **The F44 evidence is in hand** — resolved to Option (a), manual parity verification: the
      12/12-route parity table in `4a-6_test-results_ready_to_proceed_with_4a-7a.md`. No shadow-run
      clock to check, no dual-call diff path to review — that evidence file itself is the gate.
- [ ] **Davin present** — cutovers require his live approval.

---

## Checklist

**CUTOVER block**

1. Present the F44 evidence (the 12/12 parity table). **Every mismatch explained?** (The only
   observed difference anywhere was `period.start`/`period.end` timestamps reflecting each request's
   own execution time — expected, not a real mismatch.) If anything else is unexplained → abort and
   schedule an investigation session.
2. Davin approves, **per group**. His ritual question — _"what's the rollback?"_ — answer below.
3. **Flip one group at a time**, confirming each is clean before the next: **(a)**
   `MIGRATE_READ_APIS_MONEY_AFFILIATE` (4 affiliate-dashboard routes) → **(b)**
   `MIGRATE_READ_APIS_MONEY_ADMIN` (all 8 admin/report routes together — 4A-7a built one flag for the
   whole admin group, not separate flags per admin route; there is no finer granularity available
   without a code change). Lowest blast radius first; money reports last.
4. Set the flag in Vercel's production environment variables and **redeploy** — Vercel does not
   re-read env vars into already-built serverless functions without a redeploy, so this is a
   config-only redeploy (no code change), not a silent runtime flip.
5. Monitor error rate and p95 for the flipped group (Vercel + Railway money-service logs) before
   proceeding to the next group. Green?
6. Record: `migration-cutover-table.md` (Slice 3 → `CUT-OVER`, noting F44's substitution), CLAUDE.md,
   DECISION-LOG. CC-F freeze on `app/api/affiliate/dashboard/*`,
   `app/api/admin/{affiliates,analytics}/*` and their `lib/` logic **stays until the RETIRE session**
   — deleting the monolith's copies is explicitly NOT this session's job.

- **Rollback (either group):** set the relevant flag back to `false` in Vercel's production
  environment and **redeploy**. No code change, no data migration — the monolith's own Prisma logic
  is untouched underneath the flag the whole time. **Not rehearsed in staging** — none exists
  (CC-A/**F34**) — so this is reasoned-about only, the same caveat carried by Slices 1 and 2. Davin
  should know that before approving.

---

## Rules specific to this variant

- No new code, no fixes, no "while I'm here". F44 resolved to manual parity verification (not the
  dual-call diff option), so there is no temporary diff path to delete — nothing to clean up beyond
  the flag flips themselves.
- Any red result = stop and document, never "probably fine".
- If flipping a group reveals that the transport needs a change, **that is 4A-7a's work reopening** —
  stop, flip back, and give it its own session. This split exists precisely so that cannot be
  improvised.

---

## Deviations

_(should normally be empty; a deviation here is itself a warning sign)_

---

## Next-session handoff

_(PRE-DRAFT `4a-w1-…` is already DRAFTed and awaiting Davin's approval — Part 19.5 begins after this
session. Also note for a future RETIRE session: `app/api/affiliate/dashboard/*`,
`app/api/admin/{affiliates,analytics}/*` and the now-orphaned
`lib/affiliate/report-builder.ts` / `lib/affiliate/validators.ts` / `lib/admin/pnl-calculator.ts` /
`lib/admin/affiliate-management.ts` become deletable once this slice has been stable for a
Davin-agreed duration. Not yet scheduled.)_
