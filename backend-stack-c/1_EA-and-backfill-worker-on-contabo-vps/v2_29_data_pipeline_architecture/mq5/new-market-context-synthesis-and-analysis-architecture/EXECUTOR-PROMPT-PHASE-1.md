# Prompt for Claude Code (Executor): Trendline Context, Phase 1

Copy everything below the line into a new Claude Code session. Fill in the three answers first.

---

## Your task

Build **Phase 1** of the trendline context pipeline, exactly as specified in:

`backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/mq5/new-market-context-synthesis-and-analysis-architecture/TRENDLINE-CONTEXT-BLUEPRINT-V2.md`

That document is the single source of truth. Read it in full before you touch anything. The files in `archive/` beside it
are history only; do not build from them.

## Davin's answers (fill in before sending)

- **Q7, the terminal for the geometry check:** `<for example: my desktop MT5, same broker server as Terminal A>`
- **Q6, a dedicated `trendline_uploader_` key and a route restricted to it:** `<approved / declined>`
- **Q1, analyst text reaching the model:** not needed for Phase 1. Do not build anything from §12.

## Do this, in order

1. **Confirm before you build.** Check the blueprint against the live code (§4.4, §8, §9, §17). Where they disagree, the
   live code is right: stop, tell me, and correct the blueprint in the same change. Report what you confirmed.
2. **Exporter** (§6): `TrendlineScreenshotAndLabelExport_v2_29.mq5` and `TrendlineLabelUtils.mqh`. Compile with MetaEditor.
3. **Stop for the geometry check** (§16, Phase 1 step 2). I run it on the terminal named above; give me exact steps and
   tell me what to send back. **Do not start step 4 until I report that the bar formula matches the native value.**
4. **Gateway** (§8, §9): the synchronous policy route, the DTO, both Prisma schema copies, the migration edited in place,
   and the tests of §14. The parser is not built yet: `parser_version` is `none`.
5. **Uploader** (§7): rewrite `trendline_context_uploader.py`, tested against files written by the real exporter.
6. **End to end**, locally only: a throwaway local PostgreSQL and a local gateway.

## Done when

The "Done when" line of Phase 1 in §16 holds, and every test of §14 for the exporter, uploader, gateway and schema has
been run. Report each check with its result. If one was not run, say so plainly.

## Limits

- **Phase 1 only.** No Layer 2 (§10), no parser (§11), no read side (§12). Do not touch
  `railway-gateway/src/sensors/` or anything under `lib/reply/`.
- **Stage B3 is running.** Nothing may touch Terminal A's indicator inputs, the live NSSM services or the live database.
  Nothing is deployed, and nothing runs on the VPS.
- **Never apply the migration** to any database except a throwaway local one. Never enter credentials or key values.
- **Auth changes** (§8.1) are built only if Q6 above says approved.
- No real infrastructure address or credential in any tracked file.
- Do not commit, push or stage unless I ask. Never use `git stash`. Run Prettier on changed files only.
- Update the code comments that cite the archived documents in each file you touch, so they cite the V2 blueprint.
- Keep `.claude/state/active-tasks.md` as your checklist, and close the session by the project's session protocol.
