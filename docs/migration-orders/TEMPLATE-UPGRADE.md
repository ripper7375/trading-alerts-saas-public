# Migration Order — UPGRADE variant

> For sessions that **bump a dependency or framework version**: 2-1 (Prisma 7.8.0),
> 5-1…5-4 (Next.js 16). Read `00-SKELETON-AND-RULES.md` first — §4 applies.
> **Creativity dial: Medium** — how you fix breakages is yours; "no behavior change, no
> metric regression" is not. One variable at a time: an upgrade session never also
> refactors, splits schemas, or adds features.

**Session:** <P-N> · **Variant:** UPGRADE · **Status:** PRE-DRAFT | DRAFT | APPROVED | CONFIRMED
**Generated:** <date> · **Flags touched:** <F-…, e.g. F19/F10> · **Estimated time:** <h>
**From → To:** <package(s) + exact versions, verified on npm at CONFIRM time>

## Entry criteria

- [ ] Official upgrade/breaking-change guide(s) fetched and read (list URLs consulted)
- [ ] Baselines recorded: tests, bundle size, CWV, build time (whichever apply)
- [ ] Blast-radius statement: what does this package touch? <answer>

## Ordered steps

1. **Audit:** enumerate breaking changes vs THIS codebase (grep for each affected API);
   write the hit-list with file paths. _Verify:_ hit-list reviewed before any edit.
2. **Bump:** exact version pin; lockfile updated; client/codegen regenerated.
3. **Codemods/fixes:** official codemods first, manual fixes second — each fix references
   its hit-list entry. _Verify:_ build clean.
4. **Parity:** full test suite vs baseline; metric gates (bundle ≤ baseline etc.).
5. **Staged rollout:** staging deploy → smoke → production deploy (Davin approves prod).

## Rules specific to this variant

- Fix forward within the session or roll back fully — never leave a half-upgraded state.
- A test that fails after the bump is a finding, not an obstacle: understand WHY before
  changing the test (the new major may have genuinely changed semantics → Deviations entry).
- Peer-dependency bumps ride along only if required; list each with its reason.

## Done when

- [ ] Production on the new version; tests green vs baseline; metric gates pass
- [ ] Audit + hit-list + resolution committed (this becomes F-flag evidence in Decision Log)

## Rollback

Revert commit + lockfile restore + previous deploy re-promoted. State any reason this
wouldn't be clean (e.g. a migration that ran) and its mitigation BEFORE starting.

## Deviations

_(filled during execution)_

## Next-session handoff

_(DRAFT order for <next session>)_
