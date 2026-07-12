# Migration Order — INFRA variant

> For sessions that **provision or configure live systems**: databases, roles, PgBouncer,
> Railway services, staging environments, CI pipelines, Redis/queues. Read
> `00-SKELETON-AND-RULES.md` first — §4 applies. **Creativity dial: Medium** (the approach is
> flexible; the end-state, grants, and names are fixed by the plan).

**Session:** <P-N> · **Variant:** INFRA · **Status:** PRE-DRAFT | DRAFT | APPROVED | CONFIRMED
**Generated:** <date> · **Flags touched:** <F-…> · **Estimated time:** <h>

## Entry criteria

- [ ] <CC gates, e.g. "CC-G restore rehearsal done" before anything data-touching>
- [ ] <Access: Railway/Vercel/provider dashboards Davin must grant>
- [ ] Blast-radius statement: what could this session break if it goes wrong? <answer>

## Ordered steps

_(each step = change → immediate verification → rollback note; stage before production)_

1. **<Provision/configure step>** — exact resource, names per plan (e.g. roles `money_svc`/
   `core_app`/`gateway_ingest`; queues `op.*`/`money.*`).
   _Verify:_ <smoke test — connect, write, read>.
   _Rollback:_ <destroy/revert action>.
2. **<Denial test step>** — infra that enforces boundaries must be proven to DENY:
   _Verify:_ <e.g. "as money_svc, SELECT on User FAILS">.
3. **<As-code step>** — config committed as idempotent script/IaC (`roles.sql`,
   `railway.toml`, workflow YAML), never dashboard-only.
   _Verify:_ re-running the script is a no-op.
4. …

## Rules specific to this variant

- **Nothing dashboard-only.** Every setting lands in a committed file or is documented in
  the secret matrix.
- Production changes only after the identical change succeeded in staging.
- Never break the always-on paths: `railway-gateway` ingest and the live monolith must not
  blip — state explicitly how each step avoids them.
- Secrets: names in the matrix, values only in Railway/Vercel — never in git.

## Done when

- [ ] Resource live + smoke/denial tests documented as pass
- [ ] Config as code committed; secret matrix updated; monitoring/health hooked (CC-B)

## Rollback

<Ordered teardown/revert plan for the whole session, verified plausible in staging>

## Deviations

_(filled during execution)_

## Next-session handoff

_(DRAFT order for <next session>)_
