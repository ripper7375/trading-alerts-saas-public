# Migration Order — CONTRACT/RESEARCH variant

> For sessions whose output is a **document or decision**, not running code: OpenAPI specs,
> audits, investigations (F-flags), gap matrices, baselines. Read
> `00-SKELETON-AND-RULES.md` first — §4 autonomy clause applies. **Creativity dial: Medium**
> (how you investigate is yours; what counts as evidence is not).

**Session:** <P-N> · **Variant:** CONTRACT · **Status:** PRE-DRAFT | DRAFT | APPROVED | CONFIRMED
**Generated:** <date> · **Flags touched:** <F-…> · **Estimated time:** <h>

## Entry criteria

- [ ] <Prior sessions/artifacts this research builds on>
- [ ] <Access needed: dashboards, env values, docs>

## Ordered steps

_(each step = investigate → produce → verify; a claim without a source is not a finding)_

1. **<Investigation step>** — sources to consult: <live code paths / dashboards / official
   docs to fetch>. Output: <section of the artifact>.
   _Verify:_ <spot-check rule, e.g. "diff 5 generated spec entries against the real route
   handlers side-by-side">.
2. **<Decision step (flag resolution)>** — options, evidence for each, recommendation.
   _Verify:_ Decision Log entry written; Davin sign-off if the flag is his.
3. …

## Rules specific to this variant

- Ground truth priority: live code > live dashboards > recent docs > old build-orders.
- Distinguish **verified facts** from **assumptions** in the artifact — mark assumptions
  explicitly (they become entry-criteria checks for whoever consumes the document).
- If investigation contradicts the plan/playbook, that's a finding — record it, propose the
  amendment, don't silently absorb it.

## Done when

- [ ] Artifact committed to <path>; every claim sourced; assumptions marked
- [ ] Flags resolved → Decision Log; plan/playbook amendments proposed if needed

## Rollback

Usually none (read-only session). If any live setting was touched during investigation,
list its restoration here.

## Deviations

_(filled during execution — what/why/impact)_

## Next-session handoff

_(DRAFT order for <next session>, per chain protocol)_
