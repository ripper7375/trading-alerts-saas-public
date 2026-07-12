# Migration Order — PORT variant

> For sessions that **move existing code between stacks** (Next.js lib/routes → NestJS;
> monolith rewiring): all Phase 4 BUILD sessions, 2-2…2-4, 3-2. Read
> `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at **Low**: behavior
> preservation IS the deliverable; treat every "improvement" instinct as suspect. The current
> code is ground truth, the OpenAPI contract is the law, old `docs/build-orders/part-XX` is
> background for _why_ only. Worked example: `4B-2-alert-engine.migration-order.md`.

**Session:** <P-N> · **Variant:** PORT · **Status:** PRE-DRAFT | DRAFT | APPROVED | CONFIRMED
**Generated:** <date> · **Flags touched:** <F-…> · **Estimated time:** <h>
**Target service:** <operation-service | money-service | monolith-internal>
**Contract:** <governing OpenAPI spec(s), or the message/type interfaces if no HTTP>

## Entry criteria

- [ ] <Prior slices/sessions; CC gates (staging, contract tests, tracing) live>
- [ ] File inventory below re-verified against live codebase (paths + line counts)

## Integration points

- **In / Out / Owns:** <what calls it, what it calls, queues/tables it owns>

## File Port Order

_(dependency order: pure/leaf modules → stateful adapters → orchestration → entrypoints →
tests last, ported with assertions UNCHANGED — they are the parity oracle)_

### File <n>/<total>

- **SOURCE:** `<path>` (<lines> lines) → **TARGET:** `<path>`
- **Kind:** pure port | port + adapt (<describe>) | new glue (<justify>) | absorbed | split
- **Port steps:** <mechanical transformations; import swaps; DI wrapping>
- **Invariants:** <behavior that must NOT change — be explicit; "none" is rarely true>
- **Parity proof:** <ported test file | contract test | staging observation>
- **Commit:** `migrate(<slice>): <what>`

## Rules specific to this variant

- Changing a ported test's assertion requires a written justification in Deviations.
- Wrong Prisma client = boundary violation (market vs non-market; role grants will bite).
- SOURCE files become **change-frozen (CC-F)** the moment shadow-run starts.
- This session ends with shadow-run/mirror-run STARTED — cutover is the NEXT session.

## Slice-level verification (done when)

- [ ] Ported suites green in target; monolith suites still green (source untouched)
- [ ] Contract tests pass byte-for-byte; staging end-to-end path observed once
- [ ] Shadow/mirror-run started (mechanism: <…>); CC-F freeze recorded

## Cutover & rollback (next session's order — reference only)

- **Mechanism / precondition / rollback:** <flag name; 48h clean diff + Davin approval;
  exact reverse action verified in staging>

## Retire (after cutover proves stable)

- [ ] Delete SOURCE files; update cutover table; CLAUDE.md; affected
      `migration-stack-analysis.md` entries (ported files leave the monolith's BACKEND list)

## Deviations

_(filled during execution — what/why/impact)_

## Known wrinkles / do-not-touch

- <Cross-stack imports, deferred-broken files (e.g. lib/api/index.ts until Phase 7), env quirks>

## Next-session handoff

_(DRAFT order for <next session> — usually the CUTOVER via TEMPLATE-VERIFY-RETIRE)_
