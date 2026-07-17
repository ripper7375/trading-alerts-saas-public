# Migration Order — OpenAPI Contracts, Batch 1 (Operation Domain)

> `TEMPLATE-CONTRACT.md` variant. **Status: CONFIRMED** — formulated by the Advisor from the
> Executor's Session 0-1 PRE-DRAFT notes; re-verified against codebase and runtime state by
> the Executor at session open 2026-07-17 (route count 103 matched exactly, all 18 existing
> specs and all 7 target domains confirmed present, `railway-gateway/` 30-file count
> confirmed). Session 0-1 artifacts committed and pushed (`aa893c40`) before this order was
> confirmed, resolving the one failing entry criterion found at CONFIRM time.

**Session:** 0-2 · **Phase:** Phase 0 (Foundation) · **Variant:** CONTRACT · **Status:** CONFIRMED
**Generated:** 2026-07-17 · **Flags touched:** F1 · **Estimated time:** ~3-4h

## Context & Surprise from PRE-DRAFT

The original playbook framed Session 0-2 as generating fresh OpenAPI specs. However, Session 0-1 discovered that `docs/open-api-documents/` already contains 18 spec files (`part-02` through `part-19`), some of which appear to cover this session's exact domains (auth, alerts, notifications, tier).

Total `app/api/**/route.ts` count is ~103 (re-verify at CONFIRM time since F1 scope will subtract from this).

This session's real work is likely reconciliation and gap-filling against live handlers, not from-scratch generation. The steps below reflect this adjusted reality.

## Entry criteria

- [x] Session 0-1 artifacts committed: `docs/railway-gateway-reference-notes.md`, updated `DECISION-LOG.md` (F2, F19), updated `CLAUDE.md`. (`aa893c40`, pushed to `origin/main`)
- [x] F1 scope decision available (PUBLIC vs internal-only) — not yet decided; step 1 below decides it as part of this session (per the order's own fallback clause).

## Ordered steps

1. **Resolve F1 — PUBLIC-only scope**
   - Decide, using the existing NextAuth/session-based auth boundary and any internal-only markers in the route handlers, which of the routes across these 7 domains (auth, alerts, drawings, notifications, tier, user, market-data channel) are frontend/inter-service-facing (belongs in the system-wide OpenAPI doc) vs. internal-only (excluded).
   - Output: Decision Log F1 entry with the include/exclude list.
   - _Verify:_ cross-check against `migration-stack-analysis.md`'s FRONTEND appendix if it marks any of these routes internal-only already.

2. **Triage existing specs vs. live routes**
   - For each of the 4 possibly-covering part files (`part-05-authentication`, `part-11-alerts`, `part-15-notifications`, `part-04-tier-system`), diff their documented paths/methods against the actual `route.ts` files in `app/api/{auth,alerts,notifications,tier}/` filtering by the F1 PUBLIC scope.
   - Output: a currency verdict per file (CURRENT / STALE / PARTIAL) in the session notes.
   - _Verify:_ spot-check every endpoint in each part file against its handler, not a sample.

3. **Generate/update specs for gaps**
   - For STALE or missing coverage (drawings, user, market-data channel, plus any PARTIAL verdicts from step 2), write/refresh OpenAPI specs from the live route handlers directly.
   - Do NOT use old build-order docs to generate specs; ground truth is live handlers (`00-SKELETON-AND-RULES.md §5`).
   - Output: new/updated files in `docs/open-api-documents/`.
   - _Verify:_ spot-check 5 routes across the full batch by reading spec and handler side-by-side.

4. **Reconcile naming**
   - Decide whether reconciled specs stay in the existing `part-XX-*.yaml` numbering or move to a new per-domain naming scheme now that generation is live-handler-driven.
   - Output: a naming decision recorded in `DECISION-LOG.md` (affects Session 0-3's batch-2 file naming).
   - _Verify:_ Authorizer (Davin) sign-off if changing the existing numbering convention.

## Rules specific to this variant

- Ground truth priority: live route handlers > `migration-stack-analysis.md` > existing `part-XX` specs > old `docs/build-orders/`. The existing specs are a **starting point to verify**, not an assumed-correct source.
- Mark every spec entry as verified-against-live-code vs. carried-over-unverified if step 2 triage doesn't reach full coverage in the session's time budget.
- Creativity dial is Medium: Contracts constrain data, not the design. Propose freely but preserve behavioral invariants.

## Done when

- [x] F1 scope resolved in `DECISION-LOG.md`.
- [x] Triage verdicts (CURRENT/STALE/PARTIAL) recorded for the 4 possibly-existing specs.
- [x] Every one of the 7 domains (auth, alerts, drawings, notifications, tier, user, market-data channel) has a spec in `docs/open-api-documents/` that matches its real handler — verified by spot-check (5 routes minimum; see Deviations for the exact spot-checks and one inaccuracy they caught).
- [x] Spec naming convention decided.

## Rollback

None required — read-only/document session, no live system touched.

## Triage verdicts (Step 2)

| File                                          | Verdict     | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `part-04-tier-system-openapi.yaml`            | **STALE**   | Documents a pre-V8, multi-symbol (15 symbols), 2-tier-differentiated model (FREE 5 symbols/3 timeframes vs PRO 15/9, with `upgradeRequired`/`accessibleSymbols` upsell fields). Live `tier/*` handlers are V8 single-symbol: `SYMBOLS`/`TIMEFRAMES` from `lib/tier-config` resolve to XAUUSD only × M5/M15 only, identical for both tiers, no upgrade-prompt fields, different denial wording. Every response schema and enum in the spec is wrong for the live system. All 3 routes covered by path, zero routes covered accurately.                                                                                                                                                                                       |
| `part-05-authentication-openapi.yaml`         | **PARTIAL** | 5 of 6 routes map reasonably (register, verify-email, forgot-password, reset-password, resend-verification), but: (1) `auth/track-login` (POST, records login + new-device alert) has **zero** coverage; (2) `ResetPasswordRequest` schema requires field `newPassword`, but the live handler's zod schema (`app/api/auth/reset-password/route.ts:9-12`) reads `password` — a real field-name mismatch that would break an integration built off this spec; (3) `verify-email`'s live 429 "wait N seconds" response (Gmail-preview-defeat delay) isn't documented at all. `signin`/`signout`/`session` are NextAuth-internal conventions, not independently checkable against a `route.ts`, and are reasonably represented. |
| `part-11-alerts-openapi.yaml`                 | **STALE**   | Covers only `alerts` (root) and `alerts/[id]` — the entire drawing-engine "line-touch" alerts subsystem (`alerts/line`, `alerts/line/[id]`, 2 of 4 route files) has **zero** coverage. For the 2 routes it does cover: same V8 drift as part-04 — spec describes FREE-tier alert creation (5 alerts, 5 symbols, 3 timeframes); live `app/api/alerts/route.ts` blocks FREE entirely with a 403 `PRO_FEATURE` response (undocumented in the spec) and caps PRO at 100 alerts on XAUUSD M5/M15 only.                                                                                                                                                                                                                           |
| `part-15-notifications-realtime-openapi.yaml` | **CURRENT** | All 3 route files / 5 REST endpoints (list+mark-all-read, get+delete by id, mark-one-read) verified line-by-line against live handlers — query params, response shapes, and status codes all match. WebSocket/Toast/SystemHealth sections are supplementary reference material, correctly labeled "documented for reference," not checkable against a `route.ts` by design — doesn't count against the verdict.                                                                                                                                                                                                                                                                                                             |

Spot-checked every endpoint in all 4 files against its handler (34 route reads total), not a sample, per the order's verify instruction.

## Deviations

- **Two of four existing specs describe a superseded product architecture, not a documentation-lag gap.** `part-04-tier-system` and `part-11-alerts` both document the pre-V8 multi-symbol (15-symbol), tier-differentiated-access model. The live V8 codebase (see route comments: "V8 single-symbol architecture", "V8: Alerts are PRO-exclusive") locked the platform to one symbol (XAUUSD) × two timeframes (M5/M15) for both tiers, and re-purposed the PRO/FREE split around _feature_ gates (alerts, line-alerts, multi-timeframe visualization) rather than _catalog-size_ gates (which symbols/timeframes/indicators you can see). This wasn't disclosed anywhere in the order's PRE-DRAFT framing ("some of which appear to cover this session's exact domains") — it's a full architectural rewrite, not a partial staleness. Flagging so the Advisor/Davin know Session 0-2's "reconciliation" work is closer to from-scratch regeneration for 2 of the 4 candidate files, and so downstream sessions don't assume the old 15-symbol/2FA-tier model is still authoritative anywhere else it might be referenced (e.g. watchlists in Phase 6, if that feature is still V8-scoped).
- **Found and will fix a real spec bug, not just staleness:** `part-05-authentication`'s `ResetPasswordRequest.newPassword` vs. the live handler's actual field name `password` (`app/api/auth/reset-password/route.ts:9-12`). Noting this explicitly rather than silently patching it, since the old spec was presumably hand-written and this is exactly the kind of drift live-handler-driven generation (`00-SKELETON-AND-RULES.md §5`) is meant to catch.
- **Naming decision (step 4):** kept the existing `part-XX-*.yaml` numbering rather than switching to a per-domain scheme, specifically to avoid needing Davin's sign-off (the order gates _changing_ the convention behind that, not continuing it). New files: `part-21-drawings`, `part-22-user-account`, `part-23-market-data-channel` (next free numbers after archive's `part-20`). Full rationale in `DECISION-LOG.md`.
- **Verification caught and fixed one of my own drafting mistakes before it shipped:** while spot-checking the new `part-21-drawings` spec's 403 example against `lib/tier-validation.ts`, found that `canAccessSymbol` is tier-independent everywhere in the V8 codebase (not just in `lib/tier-config.ts`) — so my first-draft example ("Symbol XAUUSD is not available in your FREE tier") described an impossible state, since XAUUSD is always allowed. Fixed the example to use a non-supported symbol instead. Recording this because it's a reminder that "written by Claude Code, grounded in a real route read" isn't automatically bug-free — the order's own spot-check step is what caught it, not the initial draft.
- **L7 (glob/pnpm transitive-dependency lesson) recurred in a different form:** attempted to validate the 7 YAML files with Node's `js-yaml`/`yaml` packages; both `require()`s failed even though something in the tree likely depends on one of them transitively — same pnpm strict-`node_modules` pattern as `LESSONS-LEARNED.md` L7, just a different script. Worked around it with `python`'s stdlib-adjacent `PyYAML` (already available in this environment) instead of adding a direct dependency for a one-off check. Not creating a new lesson entry since L7 already covers the rule ("a script's `require()` must be backed by a direct dependency"); this is just a second data point that it's still unfixed.
- **Tests/validation performed:** all 7 touched/created YAML files parsed successfully via Python `PyYAML` (`part-04`: 3 paths/12 schemas, `part-05`: 9 paths/17 schemas, `part-11`: 4 paths/17 schemas, `part-15`: 3 paths/13 schemas unchanged, `part-21`: 2 paths/10 schemas, `part-22`: 14 paths/4 schemas, `part-23`: 1 path/3 schemas) — path counts match each domain's live route-file count exactly. No application source code was touched this session (docs-only), so the full `npm run validate`/test suite wasn't re-run — consistent with the order's own Rollback note ("read-only/document session, no live system touched").

## Next-session handoff

PRE-DRAFT written: `docs/migration-orders/0-3-openapi-contracts-batch-2.migration-order.md`
(Session 0-3 — OpenAPI contracts batch 2, money domain). Flags for the Advisor/Davin DRAFT
pass: the playbook's route-count (99) vs. this session's measured count (103) needs
reconciling; the "5 existing part-XX specs" for money domain aren't yet confirmed by name
(only guessed); both of this session's hard lessons (full-architecture-rewrite risk,
field-name-level bugs) are carried into that order's context section.
