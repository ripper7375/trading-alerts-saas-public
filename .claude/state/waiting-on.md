---
type: Concept/BlockersAndTraps
status: active
severity: high
updated_at: 2026-10-10
tags: [blockers, deploys, migrations, verification, stack-c, stack-d]
related_docs:
  - ../architecture/database-traps.md
  - ./history/resolved-waiting-on.md
  - ./current-state.md
---

# Waiting on — open blockers and unverified items

Read this when your task touches deploys, migrations, the database, auth, the VPS pipeline, or
when you need to know what is still unconfirmed. Items are verbatim from the pre-OKF `CLAUDE.md`
(original line ranges in the comments). When an item is resolved, **move it** (don't delete it)
to [history/resolved-waiting-on.md](./history/resolved-waiting-on.md).

Quick index (newest first):

- Build step 5 part 5 (2026-10-10): the three tables (`user_trade_preferences`, `user_trade_preferences_history`, `trade_consent_records`), the keyed user-id hash and the stores BUILT and NOT committed (Davin: stop after part 5); **the migration `20261010000000_add_engine4_tables` is a FILE, NOT applied** (applied only on a throwaway local PostgreSQL 18, zero drift), nothing deployed, no dependency, nothing in the app imports the module · **part 4 is COMMITTED LOCALLY (`eba2b64d`, not pushed) after Davin approved the thirteen readings of its hand-off and D12 (resolved)** · OPEN, Davin: (1) the twelve readings of `docs/handoffs/2026-10-10-0445-step5-part5.md` section 6, built as the default: **the CURRENT profile cascades on deleting the account while the history and the consent record keep `user_id` NULL (a departure from the order's literal "SET NULL")**, the migration is in `prisma/migrations/` (the order's folder does not exist), the profile figures are canonical decimal TEXT, the counter-trend cap is also a database rule, an unchanged save writes no snapshot, **a missing `ENGINE4_AUDIT_HMAC_KEY` stops every write and only `NODE_ENV=test` uses the public test key**, the trigger lets `user_id` go to NULL (so a `User.id` cannot be changed while audit rows name it), what the consent record stores, what `recordConsent` refuses, `ENGINE4_VERSION = '1.0.0'` · (2) **before any route writes: provision `ENGINE4_AUDIT_HMAC_KEY` (32 characters or more) and `ENGINE4_AUDIT_HMAC_KEY_VERSION` in Vercel, run `prisma migrate status`, and apply this migration (it needs none of the three older pending ones)** · (3) D13, the Tier-1 ids; commit part 5 by explicit path; push the seven local commits (`506018d1`, `706852a0`, `6e8d6a2f`, `b6cb56ae`, `c1d49d9f`, `07cc26ec`, `eba2b64d`) and part 5 · (4) retention (7 years, architecture 7.5) has no job and the trigger forbids a DELETE, so the first retention job needs its own decision · (5) D14, D16 of the plan · next: part 6 (the routes, the first callers of the stores, and the reader of the M5 bars) ·
- Build step 5 part 4 (2026-10-10): the entry bound, the single validator and the modal definition COMMITTED LOCALLY (`eba2b64d`, not pushed) after Davin approved the thirteen readings of its hand-off as built and D12 (resolved; the open text is in [resolved-waiting-on](./history/resolved-waiting-on.md)) · still true: the reader of the M5 bars (`market_data_v6`: `timestamp`, `high`, `low`) is not built (part 6); until the Tier-1 ids (D13) exist, check 5 fails for every setup ·
- Build step 5 part 3 (2026-10-10): the offer check, the Tier-1 blackout, the broker figures and three readers COMMITTED LOCALLY (`07cc26ec`, not pushed) after Davin approved the thirteen readings of its hand-off as built (resolved; the open text is in [resolved-waiting-on](./history/resolved-waiting-on.md)) · still true: D13, the four Tier-1 event ids from production `economic_events` (the read-only query is in the part 3 hand-off section 9): until then every offer is "not offered: calendar list not set", and when the ids are in the file three tests that document the empty state change in the same commit (`tier1-config.test.ts` "ships EMPTY", two in `read/events.test.ts`) · findings: the calendar's age is the age of the newest observation (rows are written on change), and `lib/economic-events/queries.ts` can return a stale observation ·
- Build step 5 part 2 (2026-10-10): structure levels, stop options, room and badge COMMITTED LOCALLY (`c1d49d9f`, not pushed) after Davin approved the ten readings of its hand-off as built (resolved; the open text is in [resolved-waiting-on](./history/resolved-waiting-on.md)) · still true: production must pass `expectedInputsSha256` and `expectedEnvelopeSha256` from the SYN reading to `readStructureLevels` ·
- Build step 5 part 1 (2026-10-09): arithmetic and sizing COMMITTED LOCALLY (`b6cb56ae`, not pushed) after Davin approved the eight readings of its hand-off as built (resolved; the step 5 plan is APPROVED in full, D1 to D17 and A1 to A7; the open text is in [resolved-waiting-on](./history/resolved-waiting-on.md)) · the plan's own to-dos stay open, none blocks building: D12 provision `ENGINE4_AUDIT_HMAC_KEY` (part 5), D13 the Tier-1 event ids (part 3, to go live), D14 counsel on the disclaimer and consent wording (part 7), D16 the red root `tsc` (364 errors, all in the untracked `davintrade-mobile-app/`) · 26 of 435 part 1 mutants survive as equivalent or unreachable (hand-off section 4) ·
- Build step 4 closing (2026-10-09): **build step 4 is CLOSED.** Session B checked it (`docs/handoffs/2026-10-09-1320-step4-session-b-check.md`): no defect in the rules, the zone builder, the SYN reading, the replay or the tables; F1 (the loader's `sr_*` read), F2, F3, F5, F7 and F8 are fixed in `6e8d6a2f` (committed locally, NOT pushed) · F4 (the part 7 hand-off says no golden is signed while HEAD holds all 16 approvals) and F6 (the golden README says every branch, true per branch, not per trader type) are not among that commit's items · F1's open production check stays: does `market_data_v6.sr_9` exist, and migration `20260922000000_add_market_data_v6_sr2_levels` is authored, not applied · the line below that ends "next: a session B check of step 4" is therefore DONE ·
- Build step 4 part 7 (2026-10-09, the last part): the first golden scenarios, the corrected documents and the closing are BUILT and **COMMITTED LOCALLY** (2026-10-09, Davin's order, not pushed), nothing deployed or migrated; **build step 4 is complete in code** (parts 1 to 7; hand-off `docs/handoffs/2026-10-09-1024-step4-part7.md`). `mcd_worker/golden/` (16 cycles: the three real and 13 synthetic; every rule and branch of `draft-1` decides a reading, except the two Scalper cells no input can reach), `tools/golden.py`, `tests/test_golden.py` (65), `railway-gateway/test/golden-scenarios.spec.ts` (55), architecture 3.5 (the stored 18 Sep reading) and 3.7 (the stored figures) with 0.6, 3.2, 3.10, 3.11, ADR-084 to ADR-092, the runbook's section 9 · **RESOLVED 2026-10-09: Davin approved the hand-off and signed all 16 golden scenarios** (`mcd_worker/golden/*/approval.json`; `python -B -m mcd_worker.tools.golden check --require-approved` passes: 16 approved, 0 pending) · OPEN, Davin: (2) **ADR-088: the reversion readings have no zones** (a snapback and a range edge fire when the price is outside the M5 channel on the side opposite to the bias, so no M5 level lies on the bias side: `NO_ZONE_SOURCES` in golden 2, 7 Scalper, 8, 10, 11): keep, or let M15 or `sr_*` supports be sources (a `zones-2`) · (3) **ADR-084 (d): range edges are always COUNTER_TREND**, also when the edge trade agrees with MCD1's trend (golden 11); §6's 2.50× cap reads the relation · (4) §2's MCD2 example and the examples of §4 to §6 (incl. the Report 2 worked example in 6.5) still use the first sketch of 3.7 (entry 4367.25, last price 4377.99): rebuild them from the corrected 3.7 in steps 5 to 7 · (5) the checklist item 8 (synthesis rows) of MCD1 to MCD3, and whether MCD0 needs it · (6) the part 6 choices above · (7) push (`506018d1` and part 7), apply the three migrations (B0) · (8) 18 old "lint-staged automatic backup" stashes are still in the stash list (`stash@{0}`, the part 6 work, was dropped on 2026-10-09) · (9) ADR files 038, 046, 056, 068 and 081 and their README rows still say 16 languages (the 19-language update touched the architecture, the brief and the manual only) · next: a session B check of step 4; B0 and the `SYN` shadow stage ·
- Build step 4 part 6 (2026-10-04): the replay and the measurement kit for SYN are built and tested (`replay.ts` compares the SYN readings and the entry zones byte for byte and `node scripts/replay-cycle.js --fixtures` gives VERIFIED for v1, v3 and v4 including them; `measure-sensors.js` reports the SYN rows, the rule hits, the no-match cycles, the zones, the CAUTIONARY share, a wording scan and the refusals counted from `--log` and the job outcomes); gateway Jest 2,686 pass, all 11 gated suites pass on a scratch PostgreSQL (377 tests), mutation check 193 of 195 with 2 equivalent; **COMMITTED LOCALLY as `506018d1` on 2026-10-09 (Davin's order; not pushed)**, nothing deployed or migrated; parts 1 to 5 are committed (seven commits, already on `origin/main`); **Davin approved the part 5 hand-off and its decisions 1 to 5 and ordered part 5 committed (`4302b510`) (resolved)** · OPEN, Davin (the 2026-10-09 order committed part 6 without answering them, so they stay open; none blocked part 7): the choices of the part 6 hand-off section 6 (the replay asks for the stored rules version; a gateway-refused reading is a note, not a verdict; a changed sensor explains a changed SYN reading; refusals counted from the log and outcomes only; the kit's copy of the wording lists; `NO_MATCH` as a finding) · apply the three pending migrations (steps 2, 3, 4; `20261004000000_add_synthesis_tables` before `SYN` is turned on) · push `506018d1` · part 7 is BUILT (the entry above) · `SYN` stays `off` until MCD1 and MCD2 are at `shadow` ·
- Build step 4 part 5 (2026-10-04): the gateway write path for SYN is built and tested (`context_levels` from `market_data_v6`, the `synthesis` section parsed, `syn-output-1.schema.json` copied, a pre-validating writer with the TypeScript twin of the 25 CHECKs, the SYN rows in the sensors' one transaction, the processor's log and outcome); gateway Jest 2,407 pass, all 10 gated suites pass on a scratch PostgreSQL, mutation check 115 of 115; **committed locally as `4302b510` (not pushed) after Davin approved the hand-off and its choices on 2026-10-04 (resolved: `SYN_TABLES_MISSING` kept; refusals counted from the log and the job outcomes)**; the part 6 line above carries what is open ·
- Build step 4 part 4 (2026-10-04): the tables `synthesis_readings` and `entry_zones` are written as a migration FILE `20261004000000_add_synthesis_tables` (25 CHECKs), in both Prisma schemas and the stubs, with a gated scratch-PostgreSQL spec; built and tested, NOT committed, **NOT applied**; parts 1 to 3 are committed locally (five commits, NOT pushed); **Davin approved the part 3 hand-off and its six decisions on 2026-10-04 (resolved)** · the choices of the part 4 hand-off section 6 were approved on 2026-10-04 (resolved; none blocked part 5) (no foreign key; the database re-derives the hashes; **decision 3: SYN rows in the cycle's transaction can roll back the sensor rows, so checks before one transaction or a second transaction**; retention; refused readings are not stored; the constants in the database) · apply the migration (B0; three are now pending: `20261002000000`, `20261003000000`, `20261004000000`) · commit part 4 · push (five commits) · part 5 must supply `context_levels` and parse `synthesis` ·
- Build step 4 part 3 (2026-10-04): the cycle runner calls synthesis after the last MCD (`mcd_worker/synthesis/cycle.py`), the bundle has an optional `context_levels` (a kit change, standard 1.0.6), the `SYN` flag (`off`/`shadow`/`live`) is in `worker_config.yaml` as `off`, the three fixtures are rebuilt with `<slot>.synthesis.json`, and the sensor kit sync list is 45 files (377,716 bytes); built and tested, NOT committed, nothing deployed or migrated; **Davin approved the part 2 hand-off on 2026-10-04 (resolved)** · the six small choices of the part 3 hand-off section 6 were approved on 2026-10-04 (resolved; none blocked part 4) (the sync list grew in part 3, not part 5; `INPUTS_REFUSED` as a SYN `data_status`; a failed synthesis gives no SYN rows; `synthesis` inside `deterministic_dict`; the validator allows `context_levels`; two small gateway edits: `replay.ts` reads only `MCD<n>` keys, the loader-form test helper drops `context_levels`) · commit by explicit path (parts 1 to 3) · push · part 5 must make the loader supply `context_levels`, parse `synthesis` and decide how an `error` is recorded · `SYN` stays `off` until MCD1 and MCD2 are at `shadow` ·
- Build step 4 part 2 (2026-10-04): the entry-zone builder `zones.py`, the pills `pills.py` and the parameters `zone_params.yaml` (`zones-1`) are built in `mcd_worker/synthesis/`, NOT committed, nothing deployed or migrated; the engine no longer carries MCD3's `UPSTREAM_CAUTIONARY` echoes · the six small readings of the part 2 hand-off section 6 were approved on 2026-10-04 (resolved; none blocked part 3) (D7 (e) read literally; M15 levels follow the rules of `sr_*`; levels from every available sensor; a LONG below the whole M5 channel has no zones; the `context_levels` shape; a zone carries more than 3.6's row) · commit by explicit path (parts 1 and 2) · push · the part 4 column for the runway ratio must be nullable (a zone with nothing beyond it has none) ·
- Build step 4 part 1 (2026-10-04): the rules file `draft-1.yaml`, its loader, the engine and the `syn-output/1` reading are built in `mcd_worker/synthesis/`, NOT committed; **Davin approved the part 1 hand-off and answered its five readings on 2026-10-04 (resolved)** · any change to the rules table is a new version `draft-2.yaml`, never an edit of `draft-1` ·
- Build step 3 sync kit (2026-10-03): the standard is 1.0.5 and `railway-gateway/scripts/sync-sensor-kit.js` is built, with `railway-gateway/sensors/` (the runbook's 34 runtime files, 252,181 bytes) and a 58-test spec; committed locally (`66dca628`, `4797ffa8`), NOT pushed, nothing deployed or migrated · OPEN, Davin: **the file list (the order named 39 files, 8 of them do not exist; the runbook's 34 were built)** · push · how Python enters the Railway image (and `SENSOR_ENGINE_DIR` = `sensors/` there) · the forming-bar record and the `InpExtendLinesToCurrent` check · before B4 a statistics command and a point-in-time replay ·
- Build step 3 Phase A wrap-up (2026-10-03): session B checked Phase A (no code or test defect) and **Davin's answers to its findings F1 to F5 are applied (resolved); Phase A is committed locally in four commits by area, NOT pushed, nothing deployed or migrated** · OPEN, Davin: push when he decides · the forming-bar record and the `InpExtendLinesToCurrent` check (below) · before B0 Python in the image (`sync-sensor-kit.js` is built, see the line above) · before B4 a statistics command and a point-in-time replay · (the standard's version and the untracked step 2 commit hand-off were resolved on 2026-10-03) · a wrong setting turns MCD0 STALE and a STALE MCD0 marks nobody (Q5 b) ·
- Build step 3 part 7 built (2026-10-03, the last part of Phase A: the measurement kit `railway-gateway/scripts/measure-sensors.js`, the Phase B runbook `docs/runbooks/deploy-stack-d-step3.md`, the forming-bar trace of the seven centroid files, architecture 2.8, the closing verification), NOT committed, nothing deployed or migrated · **the fit DOES include the bar still forming (`rates_total - 1`)**, see the part 7 hand-off section 2 · OPEN, Davin: (1) record the forming-bar result now, or after B4's live comparison · (2) production check: `InpExtendLinesToCurrent` on terminals A and B (ADR-083 depends on it being true) · (3) before B0: build `sync-sensor-kit.js` and settle how Python enters the Railway image (not built, not decided) · before B4: a command that runs the statistics engine, and a point-in-time replay (neither exists) · (4) item 4's `DETECTION_MISMATCH`-through-the-worker scenario: DONE in the Phase A wrap-up (two gated tests) · the session B check and the commit are done, see the line above ·
- Build step 3 part 6 built (2026-10-03: `state_statistics` and the n >= 30 gate, engine, writer, reader and a guard test), NOT committed, nothing deployed or migrated · **Davin settled its decisions on 2026-10-03, all as built** (resolved): strict window integrity, n counts cycles, the choice of which readings count is for B4 on the real counts, the arithmetic recorded in architecture 2.8 (done in part 7) ·
- Build step 3 part 5 built (2026-10-03: replay and determinism, `railway-gateway/src/sensors/replay.ts` and `scripts/replay-cycle.js`; a stored cycle replays byte for byte from its stored bundle: `--fixtures` for v1, v3 and v4, `--db --slot` for the database), NOT committed, nothing deployed or migrated · **Davin settled part 5's decisions (all as built) and the Q9 (b) arithmetic on 2026-10-03** (resolved) ·
  - Build step 3 part 4 built (2026-10-03: the sensor worker `railway-gateway/src/sensors/`, off by default; the runner returns `bundle_canonical_json`), NOT committed, nothing deployed or migrated · **Davin settled part 4's decisions on 2026-10-03** (resolved; items 9 and 10 stay as built) ·
    Build step 3 part 3 built (2026-10-03: the cycle inputs loader `railway-gateway/src/sensors/inputs/`, one interface and two sources; the database source proven on a scratch PostgreSQL 18.0 against the real Python runner, every envelope equal to the stored one for v1, v3 and v4), NOT committed, nothing deployed or migrated · **Davin settled its decisions on 2026-10-03** (resolved; the runner returns `bundle_canonical_json`, built in part 4) · still unanswered: decision 6 (M15 left out and STALE when its cycle is not READY), stays as built · then "build step 3, part 4" ·
    Build step 3 part 2 built (2026-10-03: the sensor tables as Prisma models, gateway mirror, stubs and a migration FILE `20261003000000_add_sensor_tables`; verified on a scratch PostgreSQL 18.0 server, zero drift), NOT committed, **NOT applied**, nothing deployed · **Davin approved D1 to D6 on 2026-10-03** (resolved; D3: part 4 owns the 90-day `market_cycle_inputs` cleanup) · apply the migration only at B0, after `prisma migrate status` ·
    Build step 3 part 1 built (the Python cycle runner `engine-1-5-new/mcd_worker/`, fixtures only), NOT committed · Davin settled its questions on 2026-10-03 · still open: MCD0's checklist items 7 and 8 (steps 4 and 6),
    an optional per-MCD env override for rollback (part 4) · Phase B still waits on step 2 live (B0 to B5) ·
- Build step 2 session B check (2026-10-02): no defect found; **build step 2 is committed locally (seven commits, not pushed), NOT deployed, the part 2 migration NOT applied** · OPEN, Davin:
  **decision 1, how RETUNING ends (P1: with the real push worker it could last days, not hours; simulated, unmeasured)** · **P2, three stale statements, to be fixed after decision 1** · **F1 to F4, the "Done when" items
  that wait on live evidence or on later build steps** · six gateway tests need the whole repo checkout ·
  Build step 2 part 10 built (**Option A**: the gateway counts the window to end RETUNING; the `measure-cycles` kit; the deploy-order runbook; ADR-015 amended), NOT deployed, migration NOT applied ·
  **build step 2 is complete in code (parts 1 to 10); committed locally later, see the entry above** · OPEN, Davin: (1) confirm the one-step reading of "followed by one verified manifest" (ADR-015 amendment; part 10 hand-off, decision 1) ·
  (2) **a key of its own for writes, before the flag goes live** (part 6, decision 1) · (3) the part 7 and part 8 decisions · (4) the production and VPS checks, then deploy in the order of
  `docs/runbooks/deploy-stack-d-step2.md` · (5) run the kit on real cycles, settle the newest-row question, confirm or replace the ADR-012 thresholds with a new decision ·
  RETUNING can last as long as the push worker takes to re-send the window (unmeasured; the kit reports episode lengths) · the three renderer test files were not run in part 10 (their packages are not installed) ·
  Build step 2 part 9 built (promote and RETUNING: sender `repush_rows_unsent`; gateway promote detection, `PROMOTE` / `RETUNE_COMPLETE` events, `retuning` on the ready job), NOT deployed, migration NOT applied ·
  its open point (the sender's count can never reach 0) is RESOLVED by part 10, see [resolved](./history/resolved-waiting-on.md) · `cycle_events` comes from the part 2 migration: apply it before the gateway deploys ·
  M15-only reconfigurations are not detected ·
  Build step 2 part 8 built (the `symbol_specs` lane: MQL5 exporter, collector stage, 4th push lane, gateway endpoint + queue + processor + reader), NOT deployed, migration NOT applied · **the exporter is NOT compiled** (Davin's
  MetaEditor) and must be attached to an XAUUSD chart on BOTH terminals A and B · the part 2 migration must be applied BEFORE the gateway deploys (a job for a missing table fails and the sender has already stamped the row) ·
  deploy order migration, gateway, VPS files (the same three as part 3), then compile and attach · nothing imports `SymbolSpecsService` until Section 6 ·
  Build step 2 part 7 built (chart stamp: the VPS renderer is driven by validated slots, resolves the active indicator per timeframe from the gateway AT the slot, stamps title and R2 metadata, keeps the last good
  image; monolith `getChartStamp` + `chartMatchesCycle` + `X-Chart-*` headers; gateway `?slot=`), NOT deployed, no migration · deploy order gateway, then monolith, then VPS · renderer needs `API_GATEWAY_URL` and
  `BACKFILL_API_KEY` in its NSSM environment · `chartMatchesCycle` has no caller until step 3 · not yet run against a real `xauusd.db` or real R2 ·
  Build step 2 part 6 built (active-indicator setting: gateway resolver, audited setter, `GET /api/v1/cycles/current`; monolith channel route behind a flag, `useMtfOverlay`, admin route), NOT deployed,
  flag OFF by default · needs a monolith key in the gateway's `API_KEYS` and two new monolith env names · the renderer and the sensor loader do not follow the setting yet ·
  Build step 2 part 5 built (read side + the strengthened landed check), NOT deployed: readers not wired into `AppModule` yet; a `cycle-ready` consumer must retry on
  `CYCLE_NOT_READY`; the labelled last price needs the newest-row answer below; `lib/indicator-statistics/queries.ts` is a known "latest available" read (reported, not changed) ·
  Build step 2 part 4 built, NOT deployed, migration NOT applied (deploy order: migration, then gateway, then VPS; cycle-ready jobs have no consumer
  until step 3; a manifest job that exhausts its retries leaves a PENDING row) ·
  Build step 2 part 3 built, NOT deployed to the VPS (three files, restart order; manifests 404 until the gateway ships) ·
  Build step 2: newest row at slot time may be the closing bar, not the new-bar stub (unverified) · production and VPS
  checks Davin runs before the Part 2 migration is applied (four §0.5 items; also which gateway the push worker targets)
- MCD kit: forming bar inside the statistics fit windows (**traced in build step 3 part 7: it IS inside; Davin records the result**, carried for stage 5) · kit writes absolute
  workbook paths into fixture sources · kit passes a non-string `config_hash` into the envelope (P6 finding F1)
- Shared FX rates `REDIS_URL` · SystemConfig pricing deploy + test · Language & locale open items ·
  Disbursement payout go-live (G1–G4) · 15th indicator rollout order
- Chart-render: 2 unverified items · Socket-refactor trigger (decided: don't yet)
- **OPEN:** which gateway does the VPS push worker target? (blocks staging cleanup)
- `railway-gateway` Watch Paths unset · Preview deployments hit the production DB
- Push-worker throughput · Look-ahead bias in historical indicator values · Decision Layer BLOCKED
- Many "authenticated click-through not yet confirmed" items (Executor never enters credentials)
- Phase 12 handover re-draft · Journey B chat check · `/help` + `/about` 404 · `rag_dual_memory` tables missing

<!-- session 2026-10-10 step5-part5 -->

- **Build step 5 part 5 (2026-10-10): the three tables, the keyed user-id hash and the stores are BUILT and tested, NOT committed (Davin: stop after part 5); the migration is a FILE and is NOT applied; nothing deployed** (hand-off `docs/handoffs/2026-10-10-0445-step5-part5.md`; plan `docs/handoffs/2026-10-09-1357-step5-plan.md`, part 5). Part 4 was committed first (`eba2b64d`, Davin's order).
  `prisma/migrations/20261010000000_add_engine4_tables/migration.sql`, three models in `prisma/non-market-data/schema.prisma`, `types/prisma-stubs.d.ts`, `lib/engine4/store/{user-hash,profile-store,consent-store}.ts`, `lib/engine4/version.ts`, `__tests__/lib/engine4/store/` (5 new test files), `__tests__/engine4/engine4-tables.pg.spec.ts` (gated, 181 tests). **Still open:** (1) Davin: the hand-off section 6 readings (twelve); (2) **before any route writes: provision `ENGINE4_AUDIT_HMAC_KEY` (32 characters or more) and `ENGINE4_AUDIT_HMAC_KEY_VERSION` in Vercel, run `prisma migrate status`, and apply the migration (it needs none of the three older pending ones; header of the file has the single-migration recipe and the rollback)**; (3) D13, commit part 5, push; (4) retention (7 years) has no job and the trigger forbids a DELETE; (5) parts 6 to 8 of the plan, D14, D16.
  Things to know: **deleting a `User` row is done by the database**: `user_trade_preferences_history` and `trade_consent_records` get `user_id` NULL (`ON DELETE SET NULL`) and keep the HMAC hash, the key version and every other column (tested on a real PostgreSQL 18.0 through the stores and through plain SQL), while the CURRENT profile `user_trade_preferences` (personal data, no hash) is deleted with the account (`ON DELETE CASCADE`, a departure from the order's literal words); nothing cascades into an audit table. **The audit tables are append-only by trigger** (UPDATE, DELETE and TRUNCATE refused with 23001) except `user_id` from a value to NULL with every other column equal, so a `User.id` cannot be changed while audit rows name it; `DROP TABLE` is not stopped. The hash is HMAC-SHA-256 (hex) of the user id's UTF-8 bytes, with `ENGINE4_AUDIT_HMAC_KEY` (32 characters or more) and `ENGINE4_AUDIT_HMAC_KEY_VERSION` (1 to 999999999, default 1); a missing key stops every write, only `NODE_ENV=test` falls back to a public key; **D12: a rotation never recomputes an old hash** (`verifyUserHash` says `OTHER_KEY_VERSION` rather than guess). The eight profile figures are canonical decimal TEXT and the CHECKs are the twin of `validateProfile` (a 756-profile corpus agrees). `ON DELETE RESTRICT` raises 23001, not 23503; `TRUNCATE` of the history table alone is refused by PostgreSQL itself (0A000) before the trigger. The stores are imported by path (the barrel exports only `ENGINE4_VERSION`), take narrow client interfaces the real generated client fits with no cast, and may import only `crypto` and `@/lib/db/prisma` (the guard says so). `recordConsent` refuses an unpinned setup, an Accept of a failed setup and a snapshot that is not the trader's or not the profile the setup was validated against; a Modify or Decline of a failed setup is recorded. The gated spec runs with `npx jest --testMatch '**/__tests__/engine4/*.pg.spec.ts'` on a database made of the previous non-market schema plus the migration file (recipe in its header and in `database-traps.md`); the mutation harness lives in the session scratchpad, not in the repo.

<!-- session 2026-10-10 step5-part4 -->

- **Build step 5 part 4 (2026-10-10): the entry bound, the single validator and the modal definition are BUILT and tested, since COMMITTED as `eba2b64d` (Davin's order, not pushed), nothing deployed or migrated** (hand-off `docs/handoffs/2026-10-10-0320-step5-part4.md`; plan `docs/handoffs/2026-10-09-1357-step5-plan.md`, part 4). Part 3 was committed first (`07cc26ec`, Davin's order).
  `lib/engine4/{entry-bound,modal-definition,validate}.ts`, `OfferResult.direction` and `trendRelation` in `offer.ts`, `byRank` in `zone.ts`, `__tests__/lib/engine4/` (3 new test files and `helpers/setup.ts`). **Still open:** D13; push; parts 6 to 8 of the plan; D14, D16 of the plan (the thirteen readings and D12 were approved as built).
  Things to know: `validateSetup(ctx, fields)` is the one function for the modal and for chat, and `ValidatedSetup` is plain JSON-safe data (`serializeValidatedSetup` is `JSON.stringify`): the same setup entered either way is byte-identical, because numbers are read exactly and leave as canonical text; the fields are all required (no silent defaults), `stopDistance` is dollars from the entry, equity is read under check 1; an entry is a ZONE price when it equals a zone's reference price (of the reading's side), otherwise a custom entry held to the day range and the 5% filter, and what is not known (no closed bar, no live price) refuses a custom entry; the range is made of the CLOSED M5 bars of the last 24 hours (`dayRange`; the bars are `market_data_v6` rows, and no reader of them exists yet, the stored bundles keep closes only); check 6 is the offer check run again (its rows 6, 7 and 9, a pending refresh, the picked zone's `invalidated` flag, the direction), the blackout is check 5 and the broker figures check 7, so **with the Tier-1 list empty or no `symbol_specs` row every setup fails (`ok` false), on purpose**; the setup is sized only when entry, risk, stop and RRR are acceptable and there are broker figures; an override above the half-risk pre-set (up to Max RPT) is recorded in `overrides.defectFlag` with the reasons; the badge is NOT in `ValidatedSetup` (`decideBadge` runs after it); `buildModalDefinition` lists a zone past its invalidation as a flagged pill and gives a custom entry its own stop options (`customEntryStopChoices`); the mutation harness lives in the session scratchpad, not in the repo.

<!-- session 2026-10-10 step5-part3 -->

- **Build step 5 part 3 (2026-10-10): the offer check, the Tier-1 blackout, the broker figures and three readers are BUILT and tested, since COMMITTED as `07cc26ec` (Davin's order, not pushed), nothing deployed or migrated** (hand-off `docs/handoffs/2026-10-09-2340-step5-part3.md`; plan `docs/handoffs/2026-10-09-1357-step5-plan.md`, part 3). Part 2 was committed first (`c1d49d9f`, Davin's order).
  `lib/engine4/{time,blackout,broker,offer}.ts`, `lib/engine4/read/{cycle,specs,events}.ts`, `zoneFromEntryRow` in `zone.ts`, `config/engine4/tier1-events.json` and its schema, `__tests__/lib/engine4/` (9 new test files). **Still open:** D13, the four Tier-1 event ids; push; parts 5 to 8 of the plan; D12, D14, D16 of the plan (the thirteen readings were approved as built).
  Things to know: **Report 2 is off in production until the Tier-1 ids (D13) and a `symbol_specs` producer (F9) exist, on purpose: the offer check FAILS CLOSED** (an empty, unreadable or incomplete Tier-1 list, an unreadable or empty calendar, no usable specs, an unusable synthesis, no zone or price, and a live status that was not supplied are all "not offered", each with its own code); the live data status (STALE, MARKET_CLOSED) is computed by the gateway and passed in (`parseLiveDataStatus` reads `GET /api/v1/cycles/current`'s `dataStatus`), `market_cycles.data_status` cannot say STALE; the first "not offered" reason in table order is shown and all are returned (A1); `readOfferSnapshot`, `readNewestBrokerFigures` and `readCalendar` are imported BY PATH, never through the barrel, and return a problem instead of throwing; `economic_events` rows are written only on change, so the calendar's age means "the newest observation" (nothing records an export), and the blackout reads the newest observation of each release by first finding the releases with ANY observation in the window and then reading ALL their observations; `Number` is allowed in the engine only on a `bigint` (`toDbInt`); the Tier-1 parser is the validator (no `ajv` installed) and `tier1-config.test.ts` keeps the schema file in step; when the ids are in the config file, `tier1-config.test.ts` "ships EMPTY" and two tests in `read/events.test.ts` change in the same commit; the SYN `flag` is returned by the snapshot reader and acted on by nobody; the mutation harness lives in the session scratchpad, not in the repo.

<!-- session 2026-10-10 step5-part2 -->

- **Build step 5 part 2 (2026-10-10): structure levels, stop options, room and badge are BUILT and tested, since COMMITTED as `c1d49d9f` (Davin's order, not pushed), nothing deployed or migrated** (hand-off `docs/handoffs/2026-10-09-2224-step5-part2.md`; plan `docs/handoffs/2026-10-09-1357-step5-plan.md`, section 3 and part 2). Part 1 was committed first (`b6cb56ae`, Davin's order).
  `lib/engine4/{levels,zone,stops,room,badge}.ts`, `lib/engine4/read/structure-levels.ts`, `scripts/engine4/structure_worlds.py`, `__tests__/lib/engine4/` (6 new test files, `helpers/stored.ts`, `fixtures/structure-worlds.json`). **Still open:** push; parts 4 to 8 of the plan; D12, D13, D14, D16 of the plan (the ten readings were approved as built).
  Things to know: the twin of the zone builder's level assembly is held to the Python by `structure-corpus.test.ts` (31 golden zones and 494 zones of 160 random worlds made by the real builder: change `zones.py`, `zone_params.yaml` or `structure_worlds.py` and the fixture must be rebuilt, `python scripts/engine4/structure_worlds.py --check`, then `npx prettier --write` it; a test fails until it is); `ZONES_1` in `levels.ts` is pinned to `zone_params.yaml` (a `zones-2` needs the twin, the pin and the fixture updated); `readStructureLevels` is imported BY PATH, never through the barrel (it pulls in Prisma, `crypto`, `zlib`; the exactness guard enforces it) and takes the clock as `nowSeconds`; it never returns partial levels: any problem empties `levels` and `buildStopChoices` then offers only the zone's own invalidation and says why; pass it the SYN reading's `inputs_sha256` and each sensor's `envelope_sha256`, or it can detect only a damaged bundle, not one of another cycle's making; `zoneFromStored` reads the `zones_json` shape, and `zoneFromEntryRow` (part 3) reads an `entry_zones` row; a stop 12.50 behind a level is exactly $13 away (the floor is kept), 12.49 is not; the corpus tests read `davintrade-stack-d-and-e/engine-1-5-new/mcd_worker/{golden,fixtures,synthesis}` and need the whole checkout; the mutation harness lives in the session scratchpad, not in the repo.

<!-- session 2026-10-09 step5-part1 -->

- **Build step 5 part 1 (2026-10-09): arithmetic and sizing are BUILT and tested, since COMMITTED as `b6cb56ae` (Davin's order, not pushed), nothing deployed or migrated** (hand-off `docs/handoffs/2026-10-09-1620-step5-part1.md`; plan `docs/handoffs/2026-10-09-1357-step5-plan.md`, approved in full).
  `lib/engine4/{exact,types,profile,sizing,scenarios,underflow,index}.ts`, `scripts/engine4/oracle.py`, `__tests__/lib/engine4/` (9 test files, `helpers/`, `fixtures/sizing-oracle.json`). **Still open:** push; parts 4 to 8 of the plan; D12, D13, D14, D16 of the plan (actions of Davin's, none blocks building); the eight readings were approved as built.
  Things to know: money figures are `Rational` (exact fractions of BigInts), inputs are decimal text (a number is read by its shortest decimal text, so never pass the result of float arithmetic); `sizeSetup` returns `status: 'UNDERFLOW'` with no lot instead of rounding up to the broker minimum, and `underflowHelp` says what the trader may do (raise risk only inside Max RPT, a nearer structural stop at or beyond Min SLD, decline; the equity a minimum lot needs is a fact, never an offer); the spread is D3 (BUY fills at the ask and pays the spread in its loss and its target; a SELL's stop and target trigger on the ask, so their chart levels are the trigger prices minus S) and the leverage steps use the fill price; `lib/engine4` is held to exact arithmetic by `exactness-guard.test.ts` (no `Math`, `Number`, `toFixed`, float literal or number arithmetic, no outside import); `sizing-oracle.json` is tied to `oracle.py` by SHA-256 (edit the oracle, run it, `npx prettier --write` the fixture; `python scripts/engine4/oracle.py --check` compares a rebuild); the contract in the oracle is a power of 2 and 5 only (so its divisions are exact), the TypeScript takes any positive contract size; the architecture's 6.8 example is a risk AND leverage underflow at gold 2,545 (part 8 rewrites it); at 4,367.20 and 1:1.5 any equity under $2,911.47 is a leverage underflow; the mutation harness lives in the session scratchpad, not in the repo.

<!-- session 2026-10-09 step4-part7 -->

- **Build step 4 part 7 (2026-10-09): the first golden scenarios, the corrected documents and the closing are BUILT, tested and COMMITTED LOCALLY (Davin's order of 2026-10-09; not pushed), nothing deployed or migrated** (hand-off `docs/handoffs/2026-10-09-1024-step4-part7.md`; plan `docs/handoffs/2026-10-04-0110-step4-plan.md`, part 7 and D13). Part 6 was committed first (`506018d1`, Davin's order).
  `mcd_worker/golden/` (README, INDEX, 16 scenario folders), `mcd_worker/tools/golden.py`, `mcd_worker/tests/test_golden.py`, `railway-gateway/test/golden-scenarios.spec.ts`; architecture 0.6, 3.2, 3.5, 3.7, 3.10, 3.11; ADR-084 to ADR-092 and the ADR index; `docs/runbooks/deploy-stack-d-step3.md` section 9; `synthesis.md`, `mcd_worker/README.md`, `.prettierignore`. **Resolved the same day:** Davin approved the hand-off and signed the 16 golden scenarios; part 7 was committed; `stash@{0}` was dropped. **Still open:** (1) Davin: the choices of the hand-off section 6 (the reversion readings have no zones, ADR-088; range edges are always COUNTER_TREND, ADR-084 (d)); (2) push `506018d1` and part 7, apply the three pending migrations when he decides; (3) the examples of §2, §4, §5 and §6 that still quote the first sketch of 3.7; (4) a session B check of build step 4; (5) the carried items of the step 3 entries and the part 6 choices.
  Things to know: a golden folder is `scenario.json` (the input), `expected.json` (the exact output, compared byte for byte), `review.md` (tables to read before signing), `approval.json` (PENDING; it holds the SHA-256 of the two files as reviewed; only a person writes APPROVED, and `record` puts a scenario back to PENDING with a note when its files changed after approval; tests prove no path of the tool creates an APPROVED scenario). The three real scenarios come from the stored bundles through the runner; the 13 synthetic ones run the synthesis layer only, on readings built through the kit (their prices are made up to be consistent, not taken from a market) and each carries a bar still forming with another close than the last closed one. Every row and every branch of `draft-1` decides a reading; a Scalper cannot reach row 5 or "no match" with a usable MCD2 (brute-forced over every combination of the three sensors in `test_golden.py`). The reference price and the sr levels: 3.7 now shows the 18 Sep stored figures (reference 4378.31, Z1 4363.79 to 4370.61 with reference 4367.20, invalidation 4350.42, stop 16.78, runway 2.37; Z2 4346.75 to 4353.57 with reference 4350.16, invalidation 4334.06, stop 16.10, runway 0.76), pinned by `test_golden.py`; the first sketch's numbers stay as an arithmetic test in `test_zones_builder.py`. `test_boundaries.py` now lists `golden` among the worker's directories; `mutation_check.TEST_MODULES` lists `test_golden` (its document pins and kit check skip when the repository is not beside the engine, as in the harness's scratch copy). The ADRs were written by the Executor from the plan and the part hand-offs; Davin approved the decisions, not the wording. `git stash apply` writes CRLF in this checkout (see environment-gotchas). The scratch PostgreSQL was not needed.

<!-- session 2026-10-04 step4-part6 -->

- **Build step 4 part 6 (2026-10-04): the replay and the measurement kit for SYN are BUILT and tested, NOT committed, nothing deployed or migrated** (hand-off `docs/handoffs/2026-10-04-1118-step4-part6.md`; plan `docs/handoffs/2026-10-04-0110-step4-plan.md`).
  `railway-gateway/src/sensors/` (edited `replay.ts`, `measure-sensors.ts`, `synthesis-rows.ts`; new `measure-synthesis.ts`, `table-missing.ts`), the headers of `scripts/replay-cycle.js` and `scripts/measure-sensors.js`, five new specs (one gated), the sample file `test/fixtures/measure-synthesis-sample.json`. Parts 1 to 5 are committed locally (`45d6695d` to `4302b510`, not pushed). **Still open:** (1) Davin: the section 6 choices of the hand-off; (2) apply the three pending migrations when he decides; (3) commit part 6, push; (4) part 7: the first golden scenarios, documents 3.5 and 3.7 corrected, the ADRs, the runbook's SYN steps (including `--log` and the SYN parts of the two scripts); (5) the carried items of the step 3 entries.
  Things to know: the replay turns `SYN` on only for a cycle that has SYN rows, under the flag and the rules version stored on them, and asks for that version while the engine still has its file; a database without the SYN tables is read as "no SYN rows" (a note in the replay, a notice in the kit; the migration is yours to apply); refusals are counted only from logs and job outcomes (a `--log` is taken to cover the range, Bull keeps 100 completed jobs, `SYN_TABLES_CHECK_FAILED` has no slot); a new column on `synthesis_readings` or `entry_zones` needs the replay's and the kit's column lists and comparison (specs fail until they agree); `sensors-python-runner.spec.ts` has a 5-second runner timeout that can fail when the whole suite runs under load; the scratch PostgreSQL cluster was deleted.

<!-- session 2026-10-04 step4-part5 -->

- **Build step 4 part 5 (2026-10-04): the gateway write path for SYN is BUILT and tested, NOT committed, nothing deployed or migrated** (hand-off `docs/handoffs/2026-10-04-0813-step4-part5.md`; plan `docs/handoffs/2026-10-04-0110-step4-plan.md`).
  `railway-gateway/src/sensors/` (`synthesis-rows.ts`, `synthesis.writer.ts`, `syn-validator.ts`, `syn-output-1.schema.json`, `inputs/context-levels-query.ts`; edited `mcd-outputs.writer.ts`, `cycle-run-result.ts`, the processor, the module and the database source), `scripts/sync-syn-output-schema.js`, four new specs (one gated). Parts 1 to 4 are committed locally (`45d6695d` to `d800adc5`, not pushed). **Still open:** (1) Davin: the section 6 choices of the hand-off; (2) apply the three pending migrations when he decides; (3) commit part 5, push; (4) parts 6 and 7: replay and the measurement kit (SYN and zones byte for byte, refused readings counted), the golden scenarios and the documents (3.5 and 3.7 corrected, the ADRs, the runbook's SYN steps); (5) the carried items of the step 3 entries.
  Things to know: the SYN rows are judged in TypeScript before the one transaction (a refused profile is logged `SYN_READING_REFUSED` and left out whole; the sensors and the other profile are written); with `SYN` on before the migration is applied the SYN rows are left out and `SYN_TABLES_MISSING` is logged (the sensors are safe); a new CHECK in the migration needs its twin in `synthesis-rows.ts` and a corpus row, or three specs fail; `context_levels` has sixteen columns per timeframe from the database; the SYN texts the database loader's cycles make are identical to the stored fixtures'; the scratch PostgreSQL cluster was deleted.

<!-- session 2026-10-04 step4-part4 -->

- **Build step 4 part 4 (2026-10-04): the synthesis tables are BUILT as a migration FILE, NOT applied, NOT committed, nothing deployed** (hand-off `docs/handoffs/2026-10-04-0508-step4-part4.md`; plan `docs/handoffs/2026-10-04-0110-step4-plan.md`, decision D9).
  `prisma/migrations/20261004000000_add_synthesis_tables/migration.sql` (`synthesis_readings`, `entry_zones`; Prisma's DDL verbatim plus 25 hand-written CHECKs), `SynthesisReading` and `EntryZone` in `prisma/market-data/schema.prisma` and `railway-gateway/prisma/schema.prisma`, `types/prisma-stubs.d.ts`, `schema-sync.spec.ts` (133 tests), `synthesis-tables.pg.spec.ts` (57, gated). Parts 1 to 3 are committed locally (`45d6695d` to `46e7f9f8`, not pushed). **Still open:** (1) Davin: the section 6 choices of the hand-off (decision 3 shapes part 5); (2) apply the migration when he decides, after `prisma migrate status` (it depends on no other; two earlier ones are also pending); (3) commit part 4, push; (4) parts 5 to 7: the gateway write path (parse `synthesis`, the schema copy and its sync script, the writer, the processor, a query that supplies `context_levels`), replay and the measurement kit, the golden scenarios and the documents; (5) the carried items of the step 3 entries.
  Things to know: the database re-derives the SHA-256 of both canonical texts and checks the JSONB copy, so the writer must hash exactly the text it stores; a refused row rolls back its whole transaction (tested), so part 5 must check before it writes; a zone with nothing beyond the entry has all three runway columns NULL (read it as "no obstacle found"); readings that fail their guard are not stored; the mutation check found that the sync spec did not compare column types (now it does, for these two tables only); the scratch PostgreSQL cluster was deleted.

<!-- session 2026-10-04 step4-part3 -->

- **Build step 4 part 3 (2026-10-04): the runner integration, the `context_levels` section, the `SYN` flag and the rebuilt fixtures are BUILT and tested, NOT committed, nothing deployed or migrated** (hand-off `docs/handoffs/2026-10-04-0319-step4-part3.md`; plan `docs/handoffs/2026-10-04-0110-step4-plan.md`).
  The 12 MCD envelope hashes are byte-identical (pinned in `test_runner_synthesis.py`); standard 1.0.6; the sensor kit is 45 files and `check:sensor-kit` passes. **Still open:** (1) Davin: the six small choices of the hand-off section 6; (2) commit and push (Davin; parts 1 to 3 are all uncommitted); (3) parts 4 to 7: the tables (a migration FILE), the gateway write path (parse `synthesis`, a schema copy and its sync script, the processor, a query that supplies `context_levels`), replay and the measurement kit, the golden scenarios and the documents (3.5 and 3.7 corrected, the ADRs); (4) the carried items of the step 3 entries (the forming-bar record, `InpExtendLinesToCurrent`, how Python enters the Railway image, the statistics command and the point-in-time replay).
  Things to know: nothing in the gateway reads `synthesis` or supplies `context_levels` yet, so a live cycle would build zones from the sensors' channel lines alone; `SYN` is `off` in the committed configuration and needs MCD1 and MCD2 at `shadow`; the 28 Sep workbooks do carry `sr_1` to `sr_16` (the part 2 hand-off said they did not); 28 Sep 14:15 still has no zones; a failed synthesis gives `synthesis.error` and no SYN rows for the cycle; the loader-form test helper drops `context_levels` until part 5 and its third difference goes away then.

<!-- session 2026-10-04 step4-part2 -->

- **Build step 4 part 2 (2026-10-04): the entry-zone builder, the pills and the zone parameters are BUILT and tested, NOT committed, nothing deployed or migrated** (hand-off `docs/handoffs/2026-10-04-0226-step4-part2.md`; plan `docs/handoffs/2026-10-04-0110-step4-plan.md`).
  `mcd_worker/synthesis/` (`zones.py`, `pills.py`, `zone_params.yaml`; decisions D4 to D7 as approved). **Still open:** (1) Davin: the six small readings of the hand-off section 6; (2) commit and push (Davin; part 1 is uncommitted too); (3) parts 3 to 7: the runner, the `context_levels` bundle section (a kit change) and the SYN flag; the tables (a migration FILE); the gateway write path; replay and the measurement kit; the golden scenarios and the documents; (4) the carried items of the step 3 entries (the forming-bar record, `InpExtendLinesToCurrent`, how Python enters the Railway image, the statistics command and the point-in-time replay).
  Things to know: with `sr_*` the 18 Sep zones differ from architecture 3.7's table (3.7 is reproduced only on its own numbers); a LONG with the price below the whole M5 channel has no zones (28 Sep 14:15 is one); a zone with no level beyond it has no runway and no ratio (it ranks first on that key); D7 (f)'s last tie-break can never apply; `zone_params.yaml` is one file (a new `zones_version` keeps the old file as `zone_params.zones-1.yaml`); nothing calls the builder yet and the bundle holds no `sr_*` values.

<!-- session 2026-10-04 step4-part1 -->

- **Build step 4 part 1 (2026-10-04): the rules engine and the SYN reading are BUILT and tested, NOT committed, nothing deployed or migrated** (hand-off `docs/handoffs/2026-10-04-0156-step4-part1.md`; plan `docs/handoffs/2026-10-04-0110-step4-plan.md`, approved with D1 to D13 and A1 to A4 as recommended).
  `mcd_worker/synthesis/` (`rules/draft-1.yaml` = architecture 3.4 as approved; `rules.py`, `facts.py`, `engine.py`, `reading.py`, `syn-output-1.schema.json`, `synthesis.md`). **Still open:** (1) Davin: the five small readings of the hand-off section 6; (2) commit and push (Davin); (3) parts 2 to 7 of the plan: zones and pills, the runner and the bundle's `context_levels` (a kit change), the tables (a migration FILE), the gateway write path, replay and the measurement kit, the golden scenarios and the documents; (4) the carried items of the step 3 entries (the forming-bar record, `InpExtendLinesToCurrent`, how Python enters the Railway image, the statistics command and the point-in-time replay).
  Things to know: every SYN reading on the three real cycles is CAUTIONARY (MCD0 flags both timeframes); row 5 of the table can never fire for a Scalper; `synthesis/` was not in the sensor kit sync list until part 3 (it is now: 45 files); `reading.py`, `rules.py` and `facts.py` use `fullmatch` (Python's `$` accepts a trailing newline); the first row of each trader type must be the data check (the loader refuses a file that moves it).

<!-- session 2026-10-03 step3-sync-kit -->

- **Build step 3 sync kit (2026-10-03): the standard is 1.0.5 and `scripts/sync-sensor-kit.js` is BUILT and COMMITTED LOCALLY (`66dca628`, `4797ffa8`), NOT pushed, nothing deployed or migrated** (hand-off `docs/handoffs/2026-10-03-1535-step3-sync-kit.md`; text of the closed items in [resolved](./history/resolved-waiting-on.md)).
  **Still open:** (1) **Davin: the file list.** The order called its 39 files "the 34 of runbook 2.2"; `mcdN/__init__.py` and `mcdN_manifest.yaml` (8 files) do not exist and 7 runtime files of the runbook's 34 (`errors.py`, `budget.py`, `testing.py` and the four checklists) were missing from it, so the runbook's 34 were built. Say if the four `mcdN.md` specs should ship too (a four-line edit of the script's list and the spec's list). (2) Push (Davin). (3) How Python enters the Railway image (runbook 2.1, two unverified candidates) and, in the image, `SENSOR_ENGINE_DIR` pointing at `sensors/` (its default is still the checkout's engine folder). (4) The forming-bar record and `InpExtendLinesToCurrent` on terminals A and B. (5) Before B4: a statistics command and a point-in-time replay.
  (6) The hand-off, these state files and the runbook are not committed; the runbook still says `sync-sensor-kit.js` is "Not built" (section 0, the B0 row of the order table, the section 2.2 heading) and quotes 251,497 bytes (today 252,181; probably `guards.py` after F5, not diffed). Prettier re-pads a whole table when one cell is edited, so edit it in one go.
  Things to know: a flag change now travels in the copy (`sensors/mcd_worker/worker_config.yaml` and `sensors/mcdN/mcdN_registry.yaml`): change the engine, run `npm run sync:sensor-kit`, commit the copy, or the spec fails; the script refuses (exit 2) when the registries' `flag:` lines and `worker_config.yaml` disagree. `--check` cannot run on Railway (no engine folder there); the pin is the Jest spec, which needs the whole checkout. A plain sync reports a file in `sensors/` that is not on the list and leaves it.

<!-- session 2026-10-03 step3-phase-a-commit -->

- **Build step 3 Phase A wrap-up (2026-10-03): session B's findings F1 to F5 are closed with Davin's answers, and Phase A is committed locally in four commits by area, NOT pushed, nothing deployed or migrated** (hand-off `docs/handoffs/2026-10-03-1510-step3-commit.md`; the check is `docs/handoffs/2026-10-03-1415-step3-session-b-check.md`; text of the closed items in [resolved](./history/resolved-waiting-on.md)).
  **Still open:** (1) push (Davin); (2) the forming-bar record and `InpExtendLinesToCurrent` on terminals A and B (part 7 entry below); (3) before B0, Python in the Railway image (`sync-sensor-kit.js` is built: see the sync-kit entry above); before B4, a statistics command and a point-in-time replay; (4) and (5) RESOLVED 2026-10-03: the standard is PATCH 1.0.5 and `docs/handoffs/2026-10-02-1635-step2-commit.md` is tracked (`66dca628`);
  (6) session B section 7 items 1 to 4 are known behaviour, not defects: a wrong setting on one timeframe makes MCD0 STALE and a STALE MCD0 marks nobody (Q5 b); a cycle whose job fails or is skipped as too old has no rows (the kit lists them); `mcd_outputs` is append-only by key, not by trigger; replay needs the stored bundle, which is deleted after 90 days.

<!-- session 2026-10-03 step3-part7 -->

- **Build step 3 part 7 (2026-10-03, the last part of Phase A): the measurement kit, the Phase B runbook, the forming-bar trace and the closing verification are DONE, NOT committed, nothing deployed or migrated** (hand-off `docs/handoffs/2026-10-03-1230-step3-part7.md`).
  **The forming-bar trace (Q12), read only, all seven centroid regression files: the fit INCLUDES the bar still forming (`rates_total - 1`).** In all seven: the SSA fit and trend always (it is the last element of the vector); the crossing set that is clustered (so the centroids and the regression line) as an eligible point; the line evaluated at it; the containment sample (`containment_n`, hence `T_EDT`)
  and the extended statistics always, with the default `InpExtendLinesToCurrent = true`; the EDT fractals as a confirming bar; the Model A and B window only when the newest used cluster has a crossing on it (always in frozen mode). The export runs at second 59 of each minute. **ADR-083's premise (`T_EDT` rows end at the forming bar, so `t_edt_open_bar_rows = 1`) is confirmed by the source:** no MINOR change on that ground; it holds while
  `InpExtendLinesToCurrent` is true (check it on the VPS). The plan's first outcome is the case: certification states that the look-ahead is limited to the forming bar's close; how much it moves a fit needs B4's comparison. `FORMING_BAR_FIT: UNVERIFIED` stays on every series until Davin closes the item. Table with line numbers per file: hand-off section 2.
  **How to use the kit:** `node scripts/measure-sensors.js --db --last 288 [--redis] [--replay 3] [--expect MCD0,MCD1,MCD2,MCD3] [--strict]` (the public database URL; `REDIS_URL` for `--redis`; Python for `--replay`); `--file test/fixtures/measure-sensors-sample.json` shows the format. Read only. It prints the status mix per MCD, the MCD0 flag rate (M5, M15, both), `EVALUATOR_ERROR`, guard problems and a second
  look at every stored envelope, time per MCD against 1 s and per cycle against 30 s, rows per cycle, READY cycles with no row, skipped jobs, the determinism verdict and the MCD0 inheritance check, then one line per finding.
  **Not built (the runbook section 0 lists them):** `scripts/sync-sensor-kit.js` (before B0; the 34-file list and its evidence are in runbook 2.2) **[built 2026-10-03, see the sync-kit entry above]**; Python in the Railway image (not decided); a command that runs the statistics engine, and a point-in-time replay (before B4); (the `DETECTION_MISMATCH`-through-the-worker scenario of "Done when" item 4 was added in the Phase A wrap-up).
  Things to know: `mcd_outputs.evaluated_at` is when the worker STARTED the job (the database holds no completion time; the kit estimates "signal to done"); MCD0's time includes the one-time build of the schema validator (about 0.19 s); six gateway specs need the whole checkout (the part 6 count of five plus `measure-sensors-real.spec.ts`); Redis ran only as a fake; part 2's index test never failed on PostgreSQL 18.0, so its rewrite is deterministic by construction;
  nothing ran against production, the Railway image, a real Redis or the VPS.

<!-- session 2026-10-03 step3-part6 -->

- **Build step 3 part 6 (2026-10-03): `state_statistics` and the n >= 30 gate are BUILT and tested, NOT committed, nothing deployed or migrated.** `mcd_worker/statistics/` (`outcomes.py`, `aggregate.py`), `railway-gateway/src/sensors/state-statistics.{series,writer,reader}.ts` and `test/no-direct-state-statistics-reads.spec.ts` (hand-off `docs/handoffs/2026-10-03-1000-step3-part6.md`).
  **How it fits:** the engine takes occurrences (`mcd_id`, `evaluator_version_series` as `MAJOR.MINOR`, `config_hash_key` as the sorted, unspaced JSON of the envelope's `config_hash`, `state_code`, `bias`, `slot` in unix seconds) and the closed M5 bars (`timestamp` = open time, `high`, `low`, `close`) and returns rows with the columns of `state_statistics`
  (`compute_state_statistics`); `StateStatisticsWriter.writeRows` upserts them in one transaction; `StateStatisticsReader.read` is the only way to read them (`MEASURED` with its n from 30, else `PROVISIONAL` words). The series key is built in TypeScript only (`seriesKeyOf`); Python treats it as opaque text. Nothing runs the engine from TypeScript yet, and neither class is in a Nest module (no caller before the section 5 prompt assembler).
  **Davin's Q9 (b) arithmetic is built as he gave it** (reference price, sign convention, quartiles, excursion; `opposing_level_rate` NULL until step 4).
  **Settled by Davin on 2026-10-03, all as built** (text in [resolved](./history/resolved-waiting-on.md)): (1) an outcome needs every M5 bar of its window (a closure leaves the occurrence out of n, never stretched); (2) n counts cycle occurrences, ADR-022 as written; (3) **which readings count as occurrences is deferred to B4's replay and decided on the real counts**; (4) the arithmetic is recorded in architecture section 2.8 (done in part 7); (5) the smaller builder's calls stay.
  Things to know: run Python from `engine-1-5-new/`, never from inside `mcd_worker/` (the folder `statistics` would shadow the standard library's module); a Prisma `update` ignores `undefined`, so the writer sends explicit nulls (a series that falls below 30 loses its numbers); five gateway specs need the whole checkout (the guard scans 13 roots); the golden rows are
  `mcd_worker/tests/data/state-statistics.rows.json` (`WRITE_FIXTURES=yes`, then `prettier --write`); the engine is not wired to anything and B4 needs a command or a call to run it (part 7 or B4); the earlier 129 runner mutants were not re-run; nothing ran against production, the Railway image or a real Redis.

<!-- session 2026-10-03 step3-part5 -->

- **Build step 3 part 5 (2026-10-03): replay and determinism are BUILT and tested, NOT committed, nothing deployed or migrated.** `railway-gateway/src/sensors/replay.ts` (`CycleReplayer`, `loadStoredCycle`, `loadFixtureCycle`, `runReplayCommand`) and `scripts/replay-cycle.js` (hand-off `docs/handoffs/2026-10-03-0830-step3-part5.md`).
  **How to use it:** `node scripts/replay-cycle.js --fixtures` replays v1, v3 and v4 in one command (no database); `node scripts/replay-cycle.js --db --slot <ISO time or unix seconds> [--slot ...]` reads two tables with two SELECTs per slot from the database named by `DATABASE_URL` (from a laptop that is the public URL, never
  `railway run`'s private one); READ ONLY. Exit 0 every cycle VERIFIED, 1 a difference, 2 a cycle could not be replayed or the arguments are wrong. It needs Python with PyYAML and jsonschema and the engine folder (`SENSOR_PYTHON`, `SENSOR_ENGINE_DIR`, or `--python` and `--engine-dir`), like the worker. B1 and B4 should run it
  on three real shadow cycles, days after they were written. Verdicts: `VERIFIED`; `TAMPERED_BUNDLE` (the unzipped bundle does not hash to `inputs_sha256`, or a reading names other inputs; Python is not started); `VERSION_MISMATCH` (an evaluator is not the version that wrote the row); `LOGIC_DIVERGENCE` (same version, inputs as stored, another envelope);
  and two not in Davin's list, `STORED_READING_CORRUPT` and `NOT_REPLAYABLE` (nothing stored, the bundle deleted by the 90-day retention, no readings, readings made under different RETUNING enforcement, the runner gave no result).
  **Settled by Davin on 2026-10-03: (1) to (7) all as built** (text in [resolved](./history/resolved-waiting-on.md)): the six verdicts stay, a tampered bundle ends the replay before Python runs, the JSON round trip, the temporary configuration, the fixture hash comparison and the read-only `--db` stay; part 4's item 9 goes to part 7 and item 10 stays as built.
  Things to know: a bundle stored for 90 days and deleted, with readings that stay, is `NO_STORED_BUNDLE`, not an error; a slot delivered twice keeps its first bundle, so a reading written later from changed data reads as `TAMPERED_BUNDLE` (`READINGS_NAME_OTHER_INPUTS`) with the finding saying so; `kit-runner.ts` left a `mcd-shadow-*` folder per Jest process in `%TEMP%`
  (fixed in part 7: it deletes its own, and the 134 old ones were deleted); nothing ran against production, the Railway image or a real Redis; live replay time is unmeasured (about 1 s per cycle here).

<!-- session 2026-10-03 step3-part4 -->

- **Build step 3 part 4 (2026-10-03): the sensor worker is BUILT and tested, NOT committed, nothing deployed or migrated.** `railway-gateway/src/sensors/` (`SensorsModule.register()`, `CycleReadyProcessor`, `PythonCycleRunner`, `EnvelopeValidator`, `McdOutputsWriter`, `staleBundle`, `readSensorConfig`; hand-off `docs/handoffs/2026-10-03-0548-step3-part4.md`).
  **Off by default:** the module is empty unless `SENSOR_WORKER_ENABLED` is exactly `true`, and `AppModule` imports it. **To turn it on (B0, Davin):** the migration `20261003000000_add_sensor_tables` applied, Python 3.11 with PyYAML and jsonschema and the engine folder in the Railway image
  (`SENSOR_ENGINE_DIR`; the plan's `sync-sensor-kit.js` is NOT built), the flags in `worker_config.yaml` set to `shadow` one MCD at a time (the committed file has every MCD off: the worker then runs the runner and writes nothing), `SENSOR_RETUNING_ENFORCED` left false until B5.
  Other settings: `SENSOR_PYTHON`, `SENSOR_WORKER_CONFIG` (an override file), `SENSOR_MAX_JOB_AGE_SECONDS` (600), `SENSOR_RUNNER_TIMEOUT_MS` (30,000). Rollback: the variable off and a redeploy.
  **Davin settled (1) to (8) on 2026-10-03** (as built; (6): the plan's `sync-sensor-kit.js` at B0, option (a); text in [resolved](./history/resolved-waiting-on.md)). Items (9) and (10) were settled on 2026-10-03: (9) `test/sensor-tables.pg.spec.ts` "the retention delete is served by the cycle_slot index" depends on planner statistics (fails on a table that has held rows, passes on a fresh one; the real cleanup uses the index on a populated table): taken up in part 7; (10) part 3's decision 6 stays as built.
  Things to know: Bull's back-off is `(2^n - 1) x delay`; no real Redis ran; `npm run lint` in `railway-gateway/` finds no files (already so); the worker spec truncates the two sensor tables so the gated specs pass in any order.

<!-- session 2026-10-03 step3-part3 -->

- **Build step 3 part 3 (2026-10-03): the cycle inputs loader is BUILT and tested, NOT committed, nothing deployed or migrated.** `railway-gateway/src/sensors/inputs/` (`InputsSource`, `DatabaseInputsSource`, `FixtureInputsSource`; hand-off `docs/handoffs/2026-10-03-0215-step3-part3.md`).
  The acceptance test (`test/sensors-inputs.pg.spec.ts`, gated on `CYCLE_PG_URL` on localhost and `CYCLE_PG_ALLOW_WIPE=yes`, needs Python) passes 32 of 32 on a scratch PostgreSQL 18.0; the same scenarios run on an in-memory Prisma in `test/sensors-inputs-runner.spec.ts`.
  **Settled by Davin on 2026-10-03** (moved to [resolved](./history/resolved-waiting-on.md)): the columns the bundle carries, the M15 cover rule, the stored text (the runner returns `bundle_canonical_json`), Q13 as built, the digest check deferred to Phase B.
  Decision (6) (M15 left out, and STALE, when the cycle that collected it is not READY) was settled as built on 2026-10-03. Things to know: `python -m mcd_worker.cli` runs nothing with the committed config (every flag `off`); the footprint at the replicas' channel lengths
  is about 2.7 GB for 90 days by arithmetic on fixtures (approved: 1.1 to 1.7 GB), not a live measurement; `INVALID_CYCLE_ROW` will not mend by waiting (part 4 writes STALE at once), `CYCLE_NOT_READY` will.

<!-- session 2026-10-03 step3-part2 -->

- **Build step 3 part 2 (2026-10-03): the sensor tables are BUILT as a migration FILE, NOT applied, NOT committed, nothing deployed.** `prisma/migrations/20261003000000_add_sensor_tables/migration.sql` (Prisma's DDL for `mcd_outputs`,
  `market_cycle_inputs` and `state_statistics`, plus three hand-written CHECK constraints), the identical models in `prisma/market-data/schema.prisma` and `railway-gateway/prisma/schema.prisma`, `types/prisma-stubs.d.ts`, `schema-sync.spec.ts` (92 tests)
  and the gated `sensor-tables.pg.spec.ts` (33 tests; hand-off `docs/handoffs/2026-10-03-0050-step3-part2.md`). **To apply (Davin, B0):** `prisma migrate status` first, then `prisma db execute --file prisma/migrations/20261003000000_add_sensor_tables/migration.sql`
  and `prisma migrate resolve --applied 20261003000000_add_sensor_tables`, before `SENSOR_WORKER_ENABLED` is set; it needs none of the other pending migrations. **SETTLED 2026-10-03: Davin approved D1 to D6 as built (see resolved).** The questions were, and each only edited the unapplied file:
  (D1) confirm the shapes (`cycle_slot` unix Int, snake_case timestamps, `config_hash_key` as canonical JSON text, the extra columns); (D2) keep the JSONB copy of the envelope (1.24 of 3.1 KB per row); (D3) **retention for `mcd_outputs` is undecided**
  (about 1.4 GB a year at four MCDs, 5.5 at sixteen) and **no part owns the 90-day `DELETE` of `market_cycle_inputs`** (recommend part 4); (D4) the six measured columns of `state_statistics`, `opposing_level_rate` NULL until step 4; (D5) append-only by key, not by trigger;
  (D6) the two CHECKs beyond the n >= 30 gate. Things to know: Prisma's `migrate diff` cannot see CHECK constraints (two tests compare them with the model: a measured column added without editing the CHECK would otherwise let a number through below n = 30);
  measured on the fixtures, a cycle costs 56 to 82 KB stored (bundles 1.14 to 1.79 GB for 90 days); verified on a scratch PostgreSQL 18.0 server, not on the Railway version; Part 4 must convert the runner's ISO `cycle_slot` to unix seconds.

<!-- session 2026-10-03 step3-part1 -->

- **Build step 3 part 1 (2026-10-03): the Python cycle runner is BUILT on fixtures, NOT committed, NOT deployed; no migration.** `davintrade-stack-d-and-e/engine-1-5-new/mcd_worker/` (README, hand-off
  `docs/handoffs/2026-10-02-2359-step3-part1.md`). All four flags are `off` in `worker_config.yaml` and in the registries; items 1 to 6 of every checklist are passed, 7 to 9 pending. **Settled by Davin on 2026-10-03** (items 1 to 3 and the bundle size, moved to [resolved](./history/resolved-waiting-on.md); items 4 and 5 stay open as noted): (4) and (5) below carry on. The original list:
  (1) **Q5 b read literally:** only a VALID MCD0 passes its defect on; a CAUTIONARY MCD0 (only while RETUNING is enforced) marks nobody (`PROPAGATING_STATUSES` in `inheritance.py`, one line). (2) **Two flag rules of mine:**
  no MCD higher than an MCD it depends on, no channel MCD higher than MCD0 (`flags.flag_problems`). (3) **Guard failures** become INVALID with `EVALUATOR_ERROR` (no new reason code). (4) **MCD0's items 7 and 8**
  (dispatch matrix and playbook chunk; synthesis rows) are `pending` with "whether a gate needs it is Davin's call": until he decides, MCD0 cannot reach `live` (items 1 to 6 allow `shadow`). (5) **Rollback of one MCD is a
  commit and a gateway deploy** (flags are in the committed `worker_config.yaml`); `SENSOR_WORKER_ENABLED=false` stops the whole worker at once. Things to know: MCD0 calls both timeframes defective on all three real
  cycles (v1, v3, v4), so every channel MCD is CAUTIONARY on each; MCD3's reading through the runner differs from its stored per-MCD envelope in status and reasons only (it reads the marked MCD1 and MCD2, Q5 a); the
  shared bundles are 0.54 to 1.17 MB of JSON (41 to 66 KB gzipped) for Q4's sizing; Python in the Railway image and the real cold-start time are still B0.

<!-- session 2026-10-02 step2-session-b-and-commit -->

- **Build step 2, session B check (2026-10-02) and the commit: no defect found in what was built; three things stay open and none blocks the deploy. Build step 2 (parts 1 to 10, the check, the state files) is
  committed locally in seven commits by area, NOT pushed, NOT deployed; the part 2 migration is a file only and NOT applied.** This supersedes "nothing is committed" in the entries below. Check:
  `docs/handoffs/2026-10-02-1548-step2-session-b-check.md`. Commit session hand-off (hashes): `docs/handoffs/`, `*-step2-commit.md`.
  (1) **Decision 1, Davin's, OPEN: how RETUNING ends (session B's P1).** Option A (ADR-015, amended in part 10) ends RETUNING when the gateway counts no M5 row of the 3,000-bar window with a `cycle_id` below the
  promote cycle's. Session B drove the unchanged `push_cycle` against the collector's real re-queue (every slot rewrites every bar; the worker re-sends the newest 386 rows first, then the OLDEST unsent rows), so the
  middle of the window keeps its pre-promote `cycle_id` until it ages into the oldest part. Time until the window is clean, by the most rows the worker can send: **100 to 200 a minute about 10 trading days; 300 about 6;
  400 about 4; 600 about half a day; 800 one slot.** This is a **simulation, NOT a measurement**: the real rate is unmeasured (the open throughput item puts it at 375 to 600 a minute, which is half a day to about five
  days). The builder's tests do not see it because they re-push arbitrary amounts per cycle. Options: (a) keep Option A and measure first (session B's default; cost: below about 600 rows a minute every promote leaves
  the sensors CAUTIONARY for days); (b) Option B from part 9's list: count only what the sensors read (the newest 288 M5 and 96 M15 closed bars and the statistics at the slot), which the promote cycle's priority push
  already delivers, so RETUNING ends one verified manifest after the promote (older bars may still mix; the ADR says so); (c) make the push worker faster before relying on A. **Settle before step 3 wires the
  `retuning` flag to CAUTIONARY in production;** it does not block the deploy. Sources: session B hand-off section 7 P1 (the table) and section 6 decision 1.
  (2) **P2, three stale statements, to be fixed in a small builder session AFTER decision 1** (their text depends on the rule; deliberately not fixed in the commit session). Locations checked against the live files on
  2026-10-02: (a) `backend-stack-c/.../backfill_worker_api_gateway_v5.py:913-915`: the comment says the gateway reads `repush_rows_unsent` as 0 and then waits for one more verified manifest; since Option A the gateway
  does not read that field (the module docstring was updated, this comment was missed); (b) `docs/STACK-D-ARCHITECTURE.md:255-256`: "about 6,000 in-window rows re-push over 5–6 minutes, oldest first" (the window is
  re-queued every cycle; P1 shows how long it takes); (c) "hours" in `docs/adr/015-retuning-during-a-promote.md:36` and `docs/runbooks/mt5-terminal-promote.md:191`: true at the fast end, about ten times too short at
  the slow end. Part 9's Option A text also called RETUNING "independent of the worker's throughput": correct for the rule, not for its duration.
  (3) **F1 to F4: "Done when" items of section 1.8 that wait on live evidence or on later build steps (none is a defect in what was built).** **F1** one real cycle, measured: the kit is right on its fixture, but no real
  cycle has run anywhere (run `docs/runbooks/deploy-stack-d-step2.md` section 6.6; it also settles the newest-row question). **F2** the chart stamp, first half ("an image from another slot stays out of the prompt"):
  `chartMatchesCycle` (`lib/storage/chart-keys.ts:163`) is called only by its own test; the prompt assembler that must call it does not exist yet (the plan says build step 7; the part 7 note above said step 3;
  the second half, the last good image, is met: 118 renderer tests pass). **F3** a rehearsed promote visible end to end: only simulated (no second terminal; section 0.5 says "Not yet"), the gateway exposes the flag
  but nothing reads it until step 3's loader, which maps `retuning` to CAUTIONARY (`mcd_common/preflight.py:139-140`), and P1's duration. **F4** the indicator switch in one slot: met for the setting, the gateway and
  the renderer; MCD inputs need step 3's loader, and the UI follows the setting only when `ACTIVE_INDICATOR_FROM_GATEWAY=true` (off by default). After the first measured cycles, a new decision entry confirms or
  replaces the ADR-012 thresholds; step 3 starts after live evidence is recorded (plan, decision 6).
  (4) **Six gateway tests need the whole repo checkout.** In a copy of `railway-gateway/` alone, six pin-tests fail because they read the VPS collector, the migration SQL, the monolith or the docs from outside the
  package (`data-status.spec.ts` x2, `cycle-slot.spec.ts` x1, `active-indicator.spec.ts` x3). Harmless for the Railway build (it runs no tests); a CI job that tests the package alone would go red.
  Session B also confirmed `test_extended_statistics.py` fails the same 15 checks at HEAD (its sections 4 to 6 print SKIP without the captured exports, which is how a naive baseline passes) and that
  `npm run build` at the repo root rewrites `next-env.d.ts` (keep it out of commits).

<!-- session 2026-10-02 step2-part1 -->

- **Build step 2 part 10 (2026-10-02): Option A, the measurement kit, the deploy-order runbook and the closing of build step 2 are BUILT, NOT DEPLOYED. The Part 2 migration is NOT applied. Nothing is committed.**
  Pieces: (1) **Option A** (ADR-015 amended in place, STACK-D section 1.6 item 2): `railway-gateway/src/cycle/retuning.ts` and `CycleManifestService` end a RETUNING when the gateway counts no M5 row of the
  window (`slot - 3000 * 300` to the slot) in `market_data_v6` with a `cycle_id` below the promote cycle's `m5_collection_cycle_id`, and the manifest that counts it is verified (READY); the promote cycle is
  found through the latest `PROMOTE` event at or before the slot; `RETUNE_COMPLETE` now carries `promote_slot`, `promote_m5_collection_cycle_id`, `window_old_rows`, `window_from`, `window_to`, `verified_at_slot`;
  `repush_rows_unsent` stays in the manifest and on the row as a diagnostic nothing reads. (2) **`measure-cycles`**: `railway-gateway/src/cycle/measure-cycles.ts` (pure, tested) and
  `railway-gateway/scripts/measure-cycles.js` (plain JavaScript on purpose, see `environment-gotchas.md`): slot to ready, manifest ingestion, gateway time, newest-bar age by value, export lag, ADR-012 deadlines,
  RETUNING episodes, status split; `--db` (one read-only SELECT, `DATABASE_URL`) or `--file`. (3) **`docs/runbooks/deploy-stack-d-step2.md`** (migration, gateway, monolith with the flag off, VPS files, verification, cutover)
  and `docs/runbooks/mt5-terminal-promote.md` section 4 rewritten for Option A. Things to know:
  (a) **How long RETUNING lasts is now the time the push worker takes to re-send the window**, not a fixed 5 to 6 minutes. The worker re-sends the oldest rows first every slot, so a worker slower than the window
  leaves the middle of it old until it ages into the oldest part: hours, not minutes (a reading of the code, **unmeasured**; push-worker throughput is still open). The READY log line prints the count while RETUNING;
  (b) the window is a time window: one bar wider than the collector's when the newest row is the stub (a row that just scrolled out can hold RETUNING one more cycle), narrower across a weekend, M5 only;
  (c) it assumes collector cycle ids only grow (recreating `xauusd.db` restarts them) and that no row stays at an old `cycle_id` (a quarantined row would keep RETUNING on until it leaves the window);
  (d) **the one-step reading of "followed by one verified manifest" is mine** (the manifest that counts 0 must itself be READY): Davin to confirm, the extra manifest costs a new column;
  (e) the three renderer test files (`test_mtf_stamp.py`, `test_mtf_render_upload_worker.py`, `test_mtf_render.py`) were NOT run: their packages (matplotlib, pandas, pytest, boto3) are not installed and installing
  them needs a download Davin has not approved; part 10 touched none of them; `test_extended_statistics.py` fails the same 15 checks as at HEAD;
  (f) **nothing ran against production, the VPS or a deployed gateway**: the kit has run on a fixture only. Part 10 hand-off: `docs/handoffs/2026-10-02-1300-step2-part10.md`.
- **Build step 2 part 9 (2026-10-02): promote and RETUNING are BUILT, NOT DEPLOYED, and the Part 2 migration is NOT applied. Its open point (the sender's re-push count cannot reach 0 on the real collector) is RESOLVED by part 10, Option A: see the next entry.**
  Pieces: the sender's manifest carries `repush_rows_unsent` (`unsent_counts()` in `backfill_worker_api_gateway_v5.py`: unsent rows with open time before `slot - 300`, read with `backlog_rows` in one statement);
  `railway-gateway/src/cycle/retuning.ts` (promote detection against the previous cycle: terminal, per-source `config_hash`, per-source mode; the RETUNING step; the event rows) and `CycleManifestService` (writes
  `PROMOTE` and `RETUNE_COMPLETE` events keyed `XAUUSD_PROMOTE_<slot>` and `XAUUSD_RETUNE_COMPLETE_<slot>`, carries `market_cycles.retuning`, announces `CycleReadyJobData.retuning`).
  **The open point (resolved by part 10, text in [resolved](./history/resolved-waiting-on.md)):** the sender's count is the whole window in every manifest and never 0, because `promote_cycle()` re-queues
  the window every cycle. Part 10 stopped reading it: the gateway counts the window itself. `test_the_collectors_full_requeue_leaves_the_whole_window_unsent_at_manifest_time` still pins the fact and fails when
  the collector changes. **Deploy order:** (1) the production and VPS checks, `prisma migrate status`, the Part 2 migration (it creates `cycle_events`; without it the first PROMOTE write fails and the
  row stays PENDING); (2) `railway-gateway` (no new dependency, env name or queue); (3) `backfill_worker_api_gateway_v5.py` alone to the VPS and restart `MT5PushWorker` (the field is optional in the contract). Things to know:
  (a) (superseded by part 10: the gateway no longer reads the sender's count, so a promote between the gateway deploy and the VPS file deploy is harmless);
  (b) M15 is not compared (it is absent from the cycle before every refresh slot): an M15-only reconfiguration is not detected, a terminal switch or an M5 change is;
  (c) a manifest that arrives behind a newer one gets its own flag and writes no events; `RETUNE_COMPLETE` is written just before the READY commit, so a job that exhausts its retries could leave a second one later;
  (d) not run on a real `xauusd.db` or a deployed gateway; the first live check is in the hand-off (section 9). Part 9 hand-off: `docs/handoffs/2026-10-02-1134-step2-part9.md`.
- **Build step 2 part 8 (2026-10-02): the `symbol_specs` lane is BUILT, NOT DEPLOYED, and the Part 2 migration is NOT applied.** Pieces: `mq5/SymbolSpecsExport_v2_29.mq5` (an EA, **never compiled**: MetaEditor is
  Davin's), `symbol_specs` outbox in `sqlite_schema_v6_xauusd.sql`, `stage_symbol_specs()` in the collector, `push_symbol_specs()` as the 4th lane of the push worker, `gateway_contract_symbol_specs.schema.json`
  (mirrored into `railway-gateway/src/symbol-specs/`), `POST /api/v1/symbol-specs`, queue `symbol-specs-sync`, `SymbolSpecsProcessor` (per-symbol `version`, idempotent on `(symbol, captured_at)`) and
  `SymbolSpecsService.getLatestSymbolSpec`. **Deploy order:** (1) the production and VPS checks, `prisma migrate status`, then the Part 2 migration `20261002000000_add_cycle_pipeline_tables` (it creates `symbol_specs`;
  **apply it before the gateway deploys**: the endpoint answers 200 on enqueue, so a job that then fails for a missing table is lost after its 3 attempts while the push worker has already stamped the row; the daily
  refresh would record the figures again within 24 hours, but do not rely on it); (2) deploy `railway-gateway` (new queue and endpoint, no new dependency, no new env name; the same `API_KEYS` as the other lanes);
  (3) copy `export_collector_validator_v2.py`, `sqlite_schema_v6_xauusd.sql` and `backfill_worker_api_gateway_v5.py` to the VPS (the same three as part 3; the schema file must sit beside the collector because the
  collector creates `symbol_specs` from it), restart `MT5Collector` first, then `MT5PushWorker`; (4) compile `mq5/SymbolSpecsExport_v2_29.mq5` in MetaEditor and attach it to **one XAUUSD chart on terminal A and one on B**,
  then wait about 30 minutes (it needs 30 spread samples taken while quotes are live). Any order of (3) and (4) is safe: the collector ignores a missing file, and a worker that meets a database without the table says so
  once and idles the lane. A worker that runs before the gateway has the endpoint gets 404 on every pass (a retry, never a quarantine; `send_attempts` and `last_error` record it) and sends nothing else. Things to know:
  (a) **Not compiled, not run on a terminal.** The first live check is in blueprint section 5.7: the Experts log line `SymbolSpecsExport: SymbolSpecs_XAUUSD.txt written, ...`, the file in `MQL5\Files`, a row in
  `symbol_specs` on `xauusd.db` whose `terminal_id` is the terminal's folder name, then `Pushed 1 symbol spec(s)` in the push worker log. Compare the figures with the symbol's Specification window in MT5.
  (b) **Both terminals need the exporter** (`docs/runbooks/mt5-terminal-promote.md` has the new bullet): promoting to one without it stops the refresh with no error, until the newest row is a week old and Report 2 is no
  longer offered (section 6.9).
  (c) **`typical_spread` is a median over a rolling 24 hours of one-per-minute samples, restarted whenever the EA restarts**; a spread change alone appends nothing, the daily row carries it. If you want a different window
  or sampling, they are inputs (`InpWindowSamples`, `InpSampleSec`, `InpMinSamples`, `InpMaxQuoteAgeSec`).
  (d) **`captured_at` is UTC from `TimeTradeServer()` minus the hour-rounded offset**, not raw `TimeCurrent()` (server time of the last tick), which the order literally named; see the part 8 hand-off, deviation 2.
  (e) **`terminal_id` on this lane is the MT5 terminal's folder name** (`C:/MT5-A/MQL5/Files` gives `MT5-A`), not the push worker's sender id, which the other lanes carry in that field.
  (f) **Nothing reads the table yet.** `SymbolSpecsService` is not imported anywhere; Section 6 (Engine 4) reads the newest row (by `captured_at`) and records its `version` in the consent record. The monolith cannot
  import the gateway package: it will read the table through `marketPrisma` (the model is mirrored in `prisma/market-data/schema.prisma`) or ask for an endpoint, which is not built.
  (g) **No `symbol_specs` line exists in the section 1.8 "Done when" list**; the evidence is this lane's own tests. Part 8 hand-off: `docs/handoffs/2026-10-02-1100-step2-part8.md`.
- **Build step 2 part 7 (2026-10-02): the chart stamp and the last good image are BUILT, NOT DEPLOYED (no migration).** VPS: `mtf_render_upload_worker.py` polls `xauusd.db` for the newest validated M5 slot
  (it no longer sleeps 300 s), asks the gateway for the active indicator of each timeframe AT that slot (`GET /api/v1/cycles/current?slot=S`, new and additive), falls back to `RENDER_OVERLAYS` and says so in the stamp,
  renders both variants as of the slot into a temp directory, uploads ONLY if both are complete PNGs, with the stamp as R2 object metadata (`cycle-slot`, `last-closed-bar`, `overlay`, `variant`, `rendered-at`, plus
  `overlay-m15`, `overlay-source`), and prints the same stamp in the image title. Monolith: `getChartStamp(variant)` (HEAD), `chartMatchesCycle(stamp, cycleSlot)`, `X-Chart-*` headers on the download 307.
  **Deploy order:** (1) gateway (the `?slot=` parameter; additive, no migration); (2) monolith (safe in either order with the renderer: an image without a stamp is served exactly as before); (3) VPS: copy
  `mtf_render_upload_worker.py` and the whole `mtf_render/` package (new `stamp.py`; `renderer.py`, `data_source.py`, `__main__.py` changed), add `API_GATEWAY_URL` and `BACKFILL_API_KEY` (the push worker's values)
  to `nssm set MT5Renderer AppEnvironmentExtra` **together with the existing `R2_*` and `MTF_DB_PATH` entries (the command replaces the whole value)**, restart `MT5Renderer`. Without them the renderer still works on
  `RENDER_OVERLAYS`. Things to know:
  (a) **`chartMatchesCycle` has no caller yet.** The prompt builder (step 3) calls `getChartStamp(variant)` then `chartMatchesCycle(stamp, cycleSlot)` and keeps the image out of the prompt on `NO_CHART_STAMP` or
  `CHART_SLOT_MISMATCH`. The `X-Chart-*` headers are for downloads and tools; a browser script cannot read headers of a followed redirect.
  (b) **Not run against a real `xauusd.db` or a real R2 bucket.** Tests use a fixture database and a fake S3 client. First live check after deploy: the log line `uploaded ... slot S, overlay M5 x / M15 y (setting)`, then
  a HEAD of `xauusd/mtf_render_xauusd_m5_m15_overlay.png` shows the five `x-amz-meta-*` keys, and `GET /api/chart/download` carries `X-Chart-Slot`.
  (c) The newest-row question above is still open, so the title states the newest M5 candle actually drawn as a fact ("newest M5 candle opened ...") rather than assuming it is the last closed bar.
  (d) Part 6's note (b) is now half answered: the renderer follows the setting once this is deployed; the sensor-input loader still does not (step 3).
  Part 7 hand-off: `docs/handoffs/2026-10-02-<HHMM>-step2-part7.md`.
- **Build step 2 part 6 (2026-10-02): the active-indicator setting is BUILT, NOT DEPLOYED, and the monolith side is behind a flag that is OFF.** Gateway: `ActiveIndicatorService`
  (`resolveActiveIndicator(timeframe, slot)`, `resolveAll(slot)`, the audited setter that refuses non-future slots, the history), `GET /api/v1/cycles/current` (newest READY cycle, status, timings, and the settings in
  force AT THAT CYCLE'S SLOT), `GET` and `POST /api/v1/active-indicator`. Monolith: `lib/active-indicator/` (client, flag, sources), `app/api/market-data/channel/route.ts` (resolves the indicator from the gateway
  when `ACTIVE_INDICATOR_FROM_GATEWAY=true`, otherwise unchanged), `components/charts/mtf/useMtfOverlay.ts` (follows the route and refreshes 90 s after each slot), `app/api/admin/active-indicator/route.ts` (admin
  only, no page). **Order to turn it on:** (1) the production and VPS checks and the part 2 migration (it seeds M15 `non_b` and M5 `best_fit_a`; without those rows the gateway answers "no setting" and the route answers 503);
  (2) deploy the gateway; (3) add a key for the monolith to the gateway's `API_KEYS` and set `MARKET_GATEWAY_URL` and `MARKET_GATEWAY_API_KEY` in the monolith (names in `docs/secret-matrix.md`; values are yours, never in
  the repo, never `NEXT_PUBLIC_`); (4) deploy the monolith (nothing changes while the flag is off); (5) set `ACTIVE_INDICATOR_FROM_GATEWAY=true`. Things to know:
  (a) **The same key that reads can write.** The gateway has one `API_KEYS` list, shared with the VPS push worker, and `POST /api/v1/active-indicator` accepts any of them. Recommend a separate key list for the
  write route before this goes live (the part 6 hand-off, decision 1).
  (b) **The renderer and the sensor-input loader do not follow the setting yet.** The loader (step 3) will call `ActiveIndicatorService.resolveAll(cycleSlot)` in process; the VPS renderer (part 7) will call
  `GET /api/v1/cycles/current`. Until part 7, the chart image served by `/api/chart/download` is rendered on the VPS with the renderer's own choice, so after a change the downloaded overlay can differ from the on-screen one.
  (c) With `MIGRATE_MARKET_DATA_CHANNEL=true` the route resolves the setting first and forwards the indicator to operation-service, but operation-service does not know `fractal_edt`: with the fractal EDT active
  that path answers 400. The flag defaults off; operation-service was not touched (out of scope).
  (d) The setting is changed through the admin route only (no page): `POST /api/admin/active-indicator` with `{ timeframe, source, effectiveSlot, reason }` as a signed-in administrator; the author is taken from the session.
  Part 6 hand-off: `docs/handoffs/2026-10-02-0536-step2-part6.md`.

- **Build step 2 part 5 (2026-10-02): read side BUILT, NOT DEPLOYED; the landed check is stronger.** `railway-gateway/src/cycle/read/` (`CycleReaderService`,
  `CycleReadModule`): `getClosedBars(timeframe, slot, n)`, `getOneDayOhlc(slot)`, `getStatisticsAtSlot(source, timeframe, slot)` and the READY-only accessors `getReadyCycle(slot)`,
  `getNewestReadyCycle()`. The landed check now also requires the newest row of each timeframe to carry a `cycle_id` at or above the manifest's `collection_cycle_id`, so **a newest row the
  gateway rejected (quarantined) leaves the cycle INCOMPLETE** (reason `NEWEST_ROW_NOT_CURRENT`), not READY with a hole. Things the next builder must know:
  (a) **Not wired**: nothing imports `CycleReadModule` yet. The sensor worker (step 3) imports it; the monolith (Section 5, Next.js) cannot import from the gateway package, so step 5 must
  either call gateway read endpoints (part 6's `GET /api/v1/cycles/current` is the natural start) or re-implement the readers over `marketPrisma` (two implementations to keep equal; not recommended).
  (b) **The sensor worker must retry on `CYCLE_NOT_READY`**: the `cycle-ready` job is announced just before the row is marked READY (part 4, announce first), so a consumer can pick it up a moment early.
  (c) **The labelled last price depends on the newest-row question below.** It is the close of the M5 row at the slot and is exposed only while that row is still the version this cycle wrote
  (`lastPrice.status = OK`); once the next cycle rewrites it the answer is `UNAVAILABLE / NOT_THIS_CYCLES_PRICE`, and if the export ended before the new bar opened there is no row at all
  (`FORMING_BAR_NOT_IN_TABLE`). If the VPS query shows the newest row is the bar about to close (not the new-bar stub), the price line needs another source: decide then, do not borrow the closed bar's close.
  (d) **Known "latest available" read, reported and NOT changed:** `lib/indicator-statistics/queries.ts` (`getLatestContainmentRates`, `distinct` + `captured_at desc`, feeds the existing
  market-sessions containment strip). It is the only offender in 694 scanned files; `test/no-latest-statistics.spec.ts` lists it and fails if it stops being true. Section 5 must read statistics through `getStatisticsAtSlot`.
  (e) `legacy/` evaluators of the MCD kit (`mcd*/legacy/*_evaluator.py`) sort workbook rows by `captured_at` and take the newest; they are superseded archives (skipped by the guard), and the
  retrofitted kit enforces the slot match itself (`mcd_common/cycle_inputs.py`). Part 5 hand-off: `docs/handoffs/2026-10-02-0446-step2-part5.md`.

- **Build step 2 part 4 (2026-10-02): gateway side BUILT, NOT DEPLOYED, Part 2 migration NOT applied.** `POST /api/v1/cycle-manifest`
  (API key, validated against a byte-identical copy of the Stack C contract kept inside `railway-gateway/src/cycle/`), a manifest job on
  `market-data-sync`, the landed-row check, `market_cycles` writes and a `cycle-ready` job keyed `XAUUSD_<slot>`. **Deploy order matters,
  in this order:** (1) the production and VPS checks below, then `prisma migrate status`, then apply
  `20261002000000_add_cycle_pipeline_tables`; (2) deploy `railway-gateway` (it gains the dependency `ajv` 8.18.0; `postinstall` runs
  `prisma generate`); (3) copy the part 3 files to the VPS. **A gateway deployed before the migration answers 200 to a manifest and then fails
  the job** (`market_cycles` does not exist; 3 attempts), after which the sender has stamped the manifest delivered and it is lost. The
  gateway before the VPS files is safe. Also: (a) **`cycle-ready` jobs have no consumer until build step 3**: they wait in Redis (about 288 a day,
  small payloads; `removeOnComplete` never applies to a job that never runs), step 3's sensor worker must drain them; (b) **no watchdog**: a manifest job
  that exhausts its 3 attempts (a database outage longer than the backoff) leaves its `market_cycles` row PENDING for good; part 5's read side must
  select only READY rows when it looks for the newest ready cycle (`data-status.ts` takes a ready cycle as its input and never sees PENDING ones); (c) **three starting values are untuned**: re-check every 5 s,
  give up on missing rows after 120 s, a 30 s grace for statistics before going READY without them (recorded as `STATISTICS_SHORTFALL` in
  `check_detail`) (`railway-gateway/src/cycle/manifest-thresholds.ts`). Part 4 hand-off: `docs/handoffs/2026-10-02-0156-step2-part4.md`.

- **Build step 2 part 3 (2026-10-02): sender side BUILT, NOT DEPLOYED to the VPS.** Davin copies three files from
  `backend-stack-c/.../v2_29_data_pipeline_architecture/`: `export_collector_validator_v2.py`, `sqlite_schema_v6_xauusd.sql` and
  `backfill_worker_api_gateway_v5.py` (the `DEPLOY_TO_CONTABO_VPS_READY/Python_Scripts` copies are older and that package has no
  schema file; the schema file is required beside the collector because the collector creates the manifest outbox from it).
  Restart `MT5Collector` first (it widens `xauusd.db` additively and creates `cycle_manifests`), then `MT5PushWorker`. Either order
  is safe: a worker meeting an old database switches newest-first and the manifest off and says so once in its log. **Until
  the gateway endpoint `/api/v1/cycle-manifest` (built in part 4, not yet deployed) is live, every manifest answers 404**: the worker retries each for an hour,
  never quarantines it, and price rows are unaffected. Newest-first ordering takes effect as soon as the new collector has
  validated one cycle. Part 3 hand-off: `docs/handoffs/2026-10-02-0101-step2-part3.md`.

- **Build step 2 (2026-10-02): is the newest row at slot time the new-bar stub or the bar that is about to close? — UNVERIFIED.**
  ADR-011 and §1.5 say the collector reads about 5 s after the boundary, so the newest row is a stub of the bar just
  opened (the 20:55 bar at the 20:55 slot). The live code points the other way: the exporters fire at second 59 of every
  minute (`InpExportSecond = 59`, `mq5/ohlcvexportlightweight_v2_29.mq5:35,110`), one second before a 5-minute boundary, so the
  freshest export before the collector's read at slot + 5 s would end with the bar that opened five minutes earlier (20:50),
  not yet closed by a second; and the collector's own stale-export guard treats a lag of about 300 s on M5 as normal
  (`export_collector_validator_v2.py:75-81`, "worst legitimate lag ~495 s"). The only real sample (the 18 Sep example cycle,
  `davintrade-stack-d-and-e/engine-1-5-new/OHLCV_XAUUSD_M5.txt`) ends with the 20:55 stub, so the evidence conflicts.
  If the closing bar is the newest row, then rule 2's "closed" bar may be about 1 s short, rule 3's labelled price has no stub to
  come from, and "replaying a slot returns the same closed bars" needs the digest (decision 8). **Settled by the first real
  cycle.** Build step 2 part 3 (built 2026-10-02, not deployed) makes the collector stamp, on every validated cycle in
  `collection_cycles`, `export_mtime` (the OHLCV export file's modification time: NOT the "Export Time:" header line, which is
  the last tick's broker time) and `newest_bar_ts` (open time of the newest bar). Once the updated collector has run a few
  cycles on the VPS, this read-only query on `C:\Scripts\database\xauusd.db` answers the question without the gateway:
  `SELECT cycle_time, timeframe, attempt, export_mtime - cycle_time AS export_vs_slot_sec, cycle_time - newest_bar_ts AS slot_minus_newest_sec FROM collection_cycles WHERE status = 'validated' AND export_mtime IS NOT NULL ORDER BY cycle_time DESC LIMIT 30;`
  Reading it for M5: `slot_minus_newest_sec` of **0** means the newest row is the stub of the bar that just opened (the document's
  reading); **300** means it is the bar that closes at the slot, and a negative `export_vs_slot_sec` (the export was written before the
  boundary) says it was exported before it closed. Options to
  bring to Davin if it is real: read the :59 export at about slot + 65 s (inside the 2-minute ready threshold), or change
  `InpExportSecond` (rebuild and redeploy of 13 indicators). Plan: `docs/handoffs/2026-10-01-2321-step2-plan.md` §2 finding 1.

- **Build step 2 (2026-10-02): checks Davin runs before the Part 2 migration is applied (decisions 2 and 3, settled in the plan).**
  Read-only; the Executor cannot reach production (`.env` is the staging clone). Parts 1 to 3 do not wait for these.
  **The Part 2 migration is written and NOT applied:** `prisma/migrations/20261002000000_add_cycle_pipeline_tables/` (four additive
  tables, no foreign keys, two seed rows; replayed and introspected clean on a local embedded Postgres). Apply it only after the checks
  below, after `prisma migrate status`, and before any gateway deploy that writes these tables (parts 4, 6, 8, 9). It depends on none of
  the other pending migrations, so it can be applied alone (`prisma db execute --file`, then `prisma migrate resolve --applied`).
  (a) Point-in-time migration `20260920000000_add_market_data_point_in_time`: `SELECT to_regclass('public.market_data_point_in_time')`
  and the last 8 rows of `_prisma_migrations`. (b) `indicator_statistics`: its column count, and whether
  `market_data_v6.sr_9` exists (extended and `sr2` migrations are "authored, not applied"). (c) Timestamp fix: `.ex5` dates on
  terminals A and B, and one fresh export's bar time against the chart. (d) Frozen-mode binaries: `.ex5` dates and the frozen
  input on each of the 7 centroid indicators (all 7 `.mq5` sources contain `MODE_FROZEN_LINE`; the `.ex5` files are compressed,
  so they cannot be inspected from here). (e) Which gateway the push worker targets: see the OPEN item further down. Record each
  answer in `STACK-D-ARCHITECTURE.md` §0.5 and move this item to `history/resolved-waiting-on.md`.

<!-- session 2026-09-30 mcd-p1-shared-kit -->

- **MCD kit (2026-09-30): the statistics fit windows may include the still-open bar — UNVERIFIED.**
  In both replica workbooks `window_end_ts` equals `live_bar_ts` for the centroid sources (v1 M5
  `best_fit_a` 20:55, M15 `non_b` 20:45; v4 `cherry_a`, `non_a`, `non_b` 23:15), so
  `regression_angle`, `containment_rate`, R² and the offsets may have been fitted with the forming
  bar, while ADR-011 and rule 2 keep that bar out of sensors. The kit (`mcd_common`) removes the
  live-bar prices, not this. Check the MQL5 source (`backend-stack-c/…/mq5/`) before certification
  (walkthrough stage 5), and ask the Stack C side if it is true. Hand-off:
  [2026-09-30-1448-p1-kit.md](../../docs/handoffs/2026-09-30-1448-p1-kit.md) §7.
  Readers of those fit fields so far: MCD2 (`regression_angle`, `containment_rate`, `containment_n`;
  committed) and MCD1 (the same three, and `N_micro` depends on `containment_n`; evaluator 2.0.0, built in P3, checked by P6 and signed off on 2026-10-01, committed the same day).
  MCD3 reads `containment_rate` and `containment_n` (the M5 `T_EDT`), not the angle (evaluator 2.0.0, signed off and committed 2026-10-01).
  MCD0 (evaluator 1.0.0, built in task P5, checked by P6, signed off by Davin and committed 2026-10-01) reads the fit descriptors themselves (R², MSE,
  skew, the offsets, `window_span_bars`, `regression_angle` for the flat test), so a forming-bar fit would reach its
  verdicts too; coverage already subtracts the open bar: [mcd0.md](../../davintrade-stack-d-and-e/engine-1-5-new/mcd0/mcd0.md).
  **New evidence (2026-10-01, MCD3 task P2):** the band columns (UOEDT, LOEDT, baseline) are populated on exactly
  `T_EDT` rows ending at the still-open bar, on 7 of 7 real channels in replicas v1 and v4 (M5 `best_fit_a` 755,
  `fractal` 336, `cherry_a` 1134, `fractal` 410; M15 `non_b` 1808 and 2035, `non_a` 968), so the channel window
  includes the forming bar. That settles the window, not the fit price: whether the fit used the forming bar's
  price still needs the MQL5 source. Hand-off:
  [2026-10-01-0703-mcd3-p2.md](../../docs/handoffs/2026-10-01-0703-mcd3-p2.md) §7 item 1.
  **New evidence (2026-10-02, build step 2 planning):** in `mq5/2EDTCentroidRegressionCherryPickA_v2_29.mq5:1997-2004` the SSA
  input vector is `close[startIdx .. rates_total - 1]`, and index `rates_total - 1` is the forming bar, so `*_ssa` (every bar's
  value, not only the newest) is computed with the forming bar's close. Only that one of the 7 centroid files was read; the
  regression and statistics paths (lines 677-680, 994, 1059) also run to `rates_total - 1` but were not traced.
  **Davin's decision (2026-10-02, build step 2 decision 5): carry this for stage 5 (certification), do not change the MQL5 now.**
  Build step 2's "no still-open bar downstream" item is therefore shown on the read path only (closed-bar view, one-day OHLC,
  statistics lookup by slot); the indicators' own fit is outside it.

- **The kit writes an absolute workbook path into `<slot>.source.md` (2026-10-01, MCD3 task P3).** For a workbook outside
  `engine-1-5-new/` (v3 and v4, as for MCD1, MCD2 and MCD0) the fixture files carry a `D:/SaaS Project/...` path; the
  SHA-256 is what matters. A kit change (`render_source_md` could use a relative path) for Davin to schedule.

- **Kit hardening: a non-string `config_hash` is copied into the envelope (2026-10-01, MCD0 task P6, finding F1).**
  `reading_context` in `mcd_common/envelope.py` (the `used = {...}` line) copies `inputs.config_hash[source]` into the envelope's
  `config_hash` with no type check, and the shared T10 corruptions (`corrupted_bundles` in `mcd_common/testing.py`) never touch
  `config_hash`. A `None`, number, boolean, list, mapping, `bytes`, NaN or object therefore gives a VALID envelope that breaks
  `mcd-output/1`; `bytes`, NaN and objects cannot even be serialised, so the worker could not store the row. Shown on MCD0 (random
  corruption of about 23,000 bundles: 661 hits, all this) and on MCD2 (a `None`, `7` and `b"x"`); MCD1 and MCD3 call the same
  function. MCD0 now guards it itself (tier 3: INVALID + `SANITY_FAILED`, and only string hashes are written). **A kit change for
  Davin to schedule:** make `reading_context` keep string hashes only, add a `config_hash` corruption to the shared T10, and then
  give MCD1 to MCD3 the same tier-3 check or rely on the kit. Related, lower: `Params.from_yaml` accepts a non-finite value
  (`.inf`), which would give a non-finite `coverage` in MCD0's `details`. Hand-off:
  [2026-10-01-1650-mcd0-p6.md](../../docs/handoffs/2026-10-01-1650-mcd0-p6.md).

<!-- CLAUDE.md L4896-L4901 -->

- **Shared FX rates (2026-09-26 round 4): check Vercel's `REDIS_URL`.** The Next app shares the
  rate table with money-service only if its `REDIS_URL` (Vercel) points at money-service's Redis
  (Railway). If unset it silently keeps its own hourly cache. After deploy, confirm the key
  `fx:usd_rates` exists and its `fetchedAt` matches `/api/fx/rates`. Deploy both apps together
  (`creditAffiliateCommission` now requires `interval`).

<!-- CLAUDE.md L4902-L4912 -->

- **SystemConfig pricing (2026-09-26): deploy both apps together, then test a price change.**
  Stripe checkout is proxied to money-service when its flag is on, so deploy money-service and the
  Next app together. Then remove `NEXT_PUBLIC_PRO_PRICE_MONTHLY`/`_YEARLY` from Vercel if set (no
  longer read). On staging: set a different Base Price in `/admin/settings/affiliate`, run a Stripe
  test checkout (expect an inline price on the PRO product) and a dLocal test payment (expect the
  new amount). Repeat for the annual plan (Stripe: yearly interval; dLocal: 365 days) and set the
  Annual PRO Price in admin (default $290 until set). After deploy, open
  `https://davintrade.app/api/fx/rates`: `source` must be `"live"` (otherwise local prices are at
  the fixed fallback rates). Checklist: §7 of
  `davintrade-systemconfig/systemconfig-fix-manifest-work-completion.md`.

<!-- CLAUDE.md L4913-L4923 -->

- **Language & locale (2026-09-25): merge, then the open items.** Branch
  `fix/16-language-localization-reaudit` is pushed, not merged, not deployed. After deploy, do the
  signed-in click-through; the checklist is item 7 of §6 in
  `davintrade-16-language-localization-remediation/16-language-localization-remediation-manifest-work-completion.md`.
  The click-through should include Davin's round-2 case: change language, then open `/admin` without
  refreshing; the sidebar must follow (manifest §7). Round 2 is committed on the same branch;
  **round 3 (manifest §8), the SystemConfig/annual-plan work and the live exchange rates were committed and pushed 2026-09-26.**
  That §6 lists the open items. Tier-2 translation is done for compulsory pages; admin (not required)
  and affiliate (optional) remain. Two need Davin's call: loading saved preferences on a new device
  (auth-adjacent), and GB versus IP country on a first visit.

<!-- CLAUDE.md L4924-L4931 -->

- **⚠ Disbursement payout settings (F83/F84, 2026-09-23): deploy + go-live checks.** Branch
  `feat/disbursement-payout-settings` is unpushed. Deploy money-service first, then the Next app.
  Monthly payouts are live only when **G1** (money-service deployed), **G2** (`CRON_ENABLED=true`
  on Railway), **G3** (not paused; `DISBURSEMENT_ENABLED` not `false` on **both** Vercel and
  Railway) and **G4** (`DISBURSEMENT_PROVIDER=WISE` on **Railway** money-service) all hold. Then
  run the post-deploy checks and search the logs for `[disbursement-settings]`. The checklist is
  in `davintrade-disbursement-payout-settings-stack/disbursement-payout-settings-manifest-work-completion.md` §5.

<!-- CLAUDE.md L4932-L4938 -->

- **⚠ 15th indicator rollout (2026-09-22): migration → gateway → VPS (3 files) → attach.**
  `20260922000000_add_market_data_v6_sr2_levels` is authored, not applied, and nothing is
  committed. Apply it before `railway-gateway` deploys. Ship `sqlite_schema_v6_xauusd.sql` with
  the two `.py` files (the `DEPLOY_TO_CONTABO_VPS_READY/` package predates this change). Attach
  `S-R-AutoCalibration_v2_29.ex5` on A+B before restarting the collector, then give it a window
  that differs from the 14th's. Full steps: blueprint §13 item 10.

<!-- CLAUDE.md L4958-L4967 -->

- **Chart-render click-through — PARTLY RESOLVED 2026-09-11, two items remain** (2026-09-10).
  Verified by Davin in a real browser on `davintrade.app`: the M5-on-M15 toggle round-trips and the
  download serves the matching variant (OFF → `standard`, titled "M5 overlay OFF"; ON → `overlay`,
  titled "M15 channel + M5 channel OVERLAID (PRO)", M5 channel drawn on the lower panel), and the
  FREE tier shows a **locked** toggle with a PRO badge and a PRO-locked Download button. **Still
  unverified**, both needing a live click-through the Executor cannot perform: that `/terminal`
  opens **exactly two** WebSockets (not four or one — the operational cost of the dual-stacked
  layout, and the input to the socket-refactor trigger below), and that the pane-splitting maths
  looks right, since jsdom's `ResizeObserver` is a no-op stub and that path has no meaningful
  coverage.

<!-- CLAUDE.md L4968-L4976 -->

- **Socket-refactor trigger — DECIDED, do not refactor yet** (2026-09-10). Two WebSockets per
  viewer on `/terminal` and `/free`. Reviewed and deliberately declined: eventlet is green-threaded
  so this is a doubling of a small number, the fix means refactoring `useOhlcvSocket` (which the
  single-chart consumers also use) for no observed benefit, and **it cannot be measured today** —
  `/terminal` showed `Disconnected` and the VPS has not run a green cycle with the recompiled
  `.ex5`. **The trigger:** once the feed is live, measure peak concurrent connections and open file
  descriptors against `ulimit -n` on the Flask host; revisit only if connections approach that limit
  or push latency degrades. Detail + cheaper mitigations:
  `MTF-DUAL-STACKED-LAYOUT-MANIFEST-WORK-COMPLETION.md` §5.1.

<!-- CLAUDE.md L5035-L5047 -->

- **⚠ OPEN — which gateway does the VPS push worker target? Blocks the rest of the staging
  cleanup.** `backfill_worker_api_gateway_v5.py` reads
  `API_GATEWAY_URL = os.environ.get('API_GATEWAY_URL', ...)` — set on the Contabo VPS (NSSM
  service config / env), not in the repo, so it cannot be determined from here. It matters
  because **there are two `railway-gateway` services**: the production one in `trading-alerts`,
  and a second one still running in the staging project since 2026-08-24.
  - If the VPS points at **production**, the staging `railway-gateway` and `Redis` are dead weight
    and can be removed (further saving).
  - If it points at **staging**, that is a much more interesting finding — it would explain why
    production's queue has shown `completed 0` for days, and the pipeline has been pushing into a
    parallel stack all along.
    **Do not remove the staging `railway-gateway` or `Redis` until this is answered.** Check the
    push worker's `API_GATEWAY_URL` on the VPS.

<!-- CLAUDE.md L5078-L5081 -->

- **⚠ `railway-gateway` Watch Paths still unset** — every push anywhere in this monorepo rebuilds
  it. On 2026-09-09 that churn exposed a latent build failure (below) and produced three failed
  deployments from commits that changed nothing in `railway-gateway/`. Scope it to
  `railway-gateway/**` in Settings → Source.

<!-- CLAUDE.md L5092-L5096 -->

- **⚠ Preview deployments point at the production database** (noticed 2026-09-09, not changed).
  Vercel's `DATABASE_URL` is scoped to **All Environments**, so preview branches connect to
  production data; `DIRECT_URL` is Production-only, so the two are inconsistent. Deliberately left
  alone during the rotation — narrowing the scope would break previews and deserves its own
  change.

<!-- CLAUDE.md L5097-L5113 -->

- **Push-worker throughput — OPEN, arithmetic only, needs VPS measurement** (2026-09-09, raised
  while answering Davin's question about row volume/cadence; **predates and is unrelated to** the
  calculation-split removal — it applied equally to the 79-column architecture). Two mechanisms
  verified in code: (a) `promote_cycle()`'s `INSERT OR REPLACE` omits `synced_at`, so SQLite
  resets it to NULL and **every cycle re-queues all ~6000 in-window rows** (correct by design —
  MT5 recalculates the whole 3000-bar window); (b) the worker POSTs **one row per HTTP request**
  at `MAX_ROWS_PER_CYCLE=500` + `ACTIVE_SLEEP_SEC=30`. Demand ~800 rows/min vs a likely capacity
  of 375–600. Because selection is `ORDER BY timestamp ASC` (**oldest first**), the symptom would
  be **the newest bars — the ones alerts need — arriving late or never**, not a crash or data
  loss (the outbox is bounded by the ~6000 rows that exist). Note oldest-first is not arbitrary:
  it drains stragglers that scrolled out of MT5's window while unsynced, which is what stops
  SQLite growing — so a fix must satisfy freshness _and_ that guarantee. **Never observed in
  production** — the live gateway queue showed 0 completed jobs across ~5 days uptime with
  `removeOnComplete: 100`, so this has likely never run at sustained volume. Full write-up,
  the exact measurements to take first, ranked fixes and the invariants not to break:
  `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/
PUSH-WORKER-THROUGHPUT-OPEN-ISSUE.md`. Also listed as blueprint §12 item 7.

<!-- CLAUDE.md L5114-L5133 -->

- **Historical indicator values are not point-in-time (look-ahead bias) — OPEN, mechanism
  verified, magnitude never measured** (2026-09-09, raised while confirming for Davin that UPSERT
  overwrites a bar's row in place). Verified in the indicator sources: the centroid/SSA fitting
  window re-anchors to the live bar every pass (`startIdx = rates_total - InpSSAMathLookback`),
  so a bar's row is refitted for ~3000 bars (~2.2 weeks M5, ~6.5 weeks M15) before MT5 stops
  exporting it and the row **freezes forever**. Net effect: the stored value for bar T was
  computed using price action from up to ~2 weeks _after_ T. **Harmless for live alerting and
  charts** (they want the newest fit — this is the feature), **invalid for backtesting /
  walk-forward / fitness scoring**. ~56 of the 83 data fields drift (the 7 centroid families);
  OHLCV and the `body_*` z-score triple are genuinely causal (`InpZScoreLength=432` is a trailing
  window) and safe; `fractal_*`/`best_resistance`/`best_support` are stable but rewrite wholesale
  whenever their fixed anchors are re-set. **Sharp detail:** the honest point-in-time value _is_
  computed — it's the first write after the bar closes — and then ~3000 UPSERTs destroy it. Also
  documents a related nuance found the same way: the export includes shift 0, so **the newest row
  in `market_data_v6` is always a still-forming partial bar** until the next cycle. This is a
  **second, independent blocker on the Decision Layer** (noted in its banner too). Magnitude is
  unmeasured — the doc gives a cheap experiment (capture exports a week apart, diff the same
  timestamps) that must run before anything is built. Full write-up + four ranked options:
  `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/
HISTORICAL-VALUES-LOOK-AHEAD-BIAS-OPEN-ISSUE.md`. Also blueprint §12 item 8.

<!-- CLAUDE.md L5134-L5139 -->

- **Decision Layer is BLOCKED** (2026-09-09) — `v2_29_davintrade_decision_layer/
DAVINTRADE_DECISION_LAYER_BLUEPRINT.md` now carries a banner explaining why: its
  `param_search`/`fitness_scorer` core needs arbitrary-parameter recomputation and the
  R²/MSE/skew statistics substrate, both of which left with the parked calc stack. Needs Davin's
  call: revive the calc stack (see that folder's own doc, two open bugs to fix first), or
  redesign the layer around admin-fixed values only.

<!-- CLAUDE.md L5170-L5178 -->

- **Landing-page Language modal — live click-through not yet confirmed** (2026-09-04 ad-hoc
  session) — `tsc`/`eslint`/new-test (4/4)/full `test:ci` (168/168 · 2397/2397)/`npm run build`
  all clean, but live browser verification was blocked by another session's `next dev` holding
  the shared `.next/` directory (same Windows contention `2026-08-31`'s Academy session
  documented) — not an auth boundary this time, just port/process contention. Needs a pass once
  a dev server is free: open the public landing page, confirm the new "Language" nav item
  (desktop, between the logo and Features) and mobile-drawer equivalent both open the modal,
  that selecting a language re-locales the page immediately with no reload, and that the
  currently-active language shows the check-mark/highlighted state on reopen.

<!-- CLAUDE.md L5179-L5190 -->

- **Trading chart candle up/down colors — never actually seen rendered against live data**
  (2026-09-04 ad-hoc session) — `trading-chart.tsx` now correctly passes `chartUpColor`/
  `chartDownColor` from Settings → Appearance to `CandlestickSeries`, confirmed by reading the
  code and by the chart canvas background/toolbar/gridlines switching correctly in both local dev
  and live production. But every environment this session had available (local dev, a throwaway
  preview route, and the real `/terminal` page on production) showed `Disconnected` — no live
  Socket.IO/MT5 feed — so no actual candle was ever drawn to visually confirm the configured
  colors render correctly on a real bar. Needs Davin's own pass with the backend feed live: open
  `/terminal`, confirm bullish/bearish candles show the colors set in Settings → Appearance →
  Chart Candlestick Customization (default cyan `#00fbff`/magenta `#fb00ff`), and that changing
  those colors updates already-rendered candles live (the new reactive-update effect) without
  needing a page reload.

<!-- CLAUDE.md L5191-L5197 -->

- **Traditional Chinese (zh-TW) — Settings page selection not yet click-through-confirmed**
  (2026-09-03 ad-hoc session) — the dictionary and dropdown entry are live-verified via a public
  unauthenticated page (`/login`, seeded via `localStorage`), but the actual `/settings/language`
  page (where a real user picks it from the dropdown, saves, and sees it persist) is auth-gated —
  same "Executor never enters credentials" boundary as everything else on this list. Needs
  Davin's own pass: select "Chinese (Traditional) (繁體中文)" from the Language dropdown, Save,
  and confirm the app re-locales correctly and the choice survives a reload.

<!-- CLAUDE.md L5198-L5216 -->

- **18-batch site-wide locale audit — authenticated click-through not yet confirmed**
  (2026-09-03 ad-hoc session, CLOSED SUCCESSFUL) — `tsc`/`eslint`/full `test:ci` (166/166 ·
  2390/2390) held clean and constant across all 18 batches, and translation coverage was
  cross-checked programmatically each batch, but the large majority of the ~130 touched files sit
  behind an auth gate (settings, all of admin, the affiliate dashboard) — the Executor never
  enters credentials. Needs Davin's own pass, switched to French/Korean/Chinese, spot-checking at
  minimum: `/dashboard`, `/alerts` (the two highest-traffic pages this session started from),
  `/settings/security` (the largest file in the repo), the 7 `/admin/disbursement/*` pages, and
  the affiliate dashboard's payouts/profile/resources/statements pages. The genuinely public
  surfaces this effort touched (account-delete pages, the public affiliate resources page, the
  auth pages' pre-login state, and Batch 18's marketing/status pages) were structurally verified
  (clean build, zero server errors) but not click-through-verified in a real browser either.
  **`components/auth/social-auth-buttons.tsx` — RESOLVED same-day, ad-hoc follow-up** (Davin
  asked directly whether this component was real and needed his click-through): it renders on the
  public, pre-login `/login`/`/register` pages, so unlike the rest of this list it needed no
  authenticated verification at all. Wired and live-verified in a real browser — switching to
  French renders "Se connecter avec Google"/"Se connecter avec X" correctly, zero console errors.
  `tsc`/`eslint` clean; `login-form.test.tsx`/`register-form.test.tsx` (13/13) and full `test:ci`
  (166/166 · 2390/2390) unaffected. Commit `efe07233`.

<!-- CLAUDE.md L5217-L5224 -->

- **All Round Clock timezone dropdown — authenticated click-through not yet confirmed**
  (2026-09-03 ad-hoc session) — `tsc`/`eslint`/new-test (8/8)/full `test:ci` (166/166 · 2390/2390)
  all clean, and the real search/select interaction was live-verified in a browser via a temporary
  unauthenticated throwaway route (deleted after use) — but `/settings/language` itself is
  auth-gated, so needs Davin's own pass to confirm: the Timezone field shows the correct
  `(GMT ±HH:MM)` label for the user's saved preference on load, the search box filters as expected
  inside the real page's styling/positioning, selecting a new zone updates the "Current time"
  preview live, and Save persists it correctly.

<!-- CLAUDE.md L5225-L5235 -->

- **France/South Korea + French/Korean/Chinese — authenticated click-through not yet confirmed**
  (2026-09-03 ad-hoc session) — `tsc`/`eslint`/full `test:ci` (165/165 · 2382/2382) all clean, and
  a local dev server booted with zero build errors, but the header's "Select Country & Region"
  dropdown and `/settings/language` are both auth-gated (confirmed even `/free` redirects to
  `/login` despite not being in `middleware.ts`'s own protected-prefix list) — the Executor never
  authenticates, so needs Davin's own pass to confirm: the header shows `🇫🇷 France €` /
  `🇰🇷 South Korea ₩` and switching to either actually re-locales the app; the Language & Region
  page offers French/Korean/Chinese and each renders its own dictionary with zero console/
  hydration errors. Separately, `ar.json` is still missing a translated country name for every
  `SUPPORTED_COUNTRIES` entry except France/South Korea (added this session) — a pre-existing gap
  from the UAE ad-hoc session, not introduced here, flagged for a future pass.

<!-- CLAUDE.md L5236-L5244 -->

- **Sign-out fix — live click-through not yet confirmed** (2026-09-01 ad-hoc session) — fixed
  `/login` and `/verify-2fa`'s "already signed in" Sign Out buttons plus a second, independent bug
  in `token-logout/route.ts` (cookie clearing silently failing in production, `__Secure-` prefix +
  missing `Secure` attribute). `tsc`/`eslint`/full `test:ci` all clean, but the Executor never
  authenticates, so the actual "does Sign Out now work" click-through needs Davin. His existing
  Free Test User session will still carry the pre-fix orphaned cookie until the _first_ post-deploy
  Sign Out click or a manual browser cookie clear — not automatically resolved by the deploy alone.
  Also needs a pass across the other `FIXED_TEST_ACCOUNTS` (pro-test, admin-test, affiliate-test,
  etc.) Davin asked about — the fix isn't account-specific, but wasn't verified against each one.

<!-- CLAUDE.md L5252-L5269 -->

- **BI dashboard authenticated visual verification** — the new `/admin/dashboards/*` suite
  (2026-08-31 ad-hoc session) is verified structurally (routes compile, RBAC redirect works,
  raw SQL runs clean against live data) but not visually as a logged-in admin — needs Davin's own
  click-through (dev server left running) to confirm chart rendering, dark/light theming, and
  real dashboard content, since the Executor cannot enter credentials even for the dev login
  page's test-account autofill buttons.
  **FX-rate placeholder concern in `lib/admin/analytics/jurisdictions.ts` resolved same session:**
  Davin clarified dLocal never supported `HK`/`TW`/`KR` — those customers already pay via Stripe
  in USD, which doesn't change the merged-revenue logic (dLocal `Payment` rows simply never exist
  for those 3 countries) but does mean Taiwan's TWD threshold is the one rate that actually drives
  a real compliance decision (Taiwan-sourced revenue is assessed in TWD regardless of billing
  currency); `HK`'s rate is provably dead code (`thresholdKind: 'NONE'` never reads it) and `KR`'s
  only feeds a cosmetic display figure (zero-threshold, no math depends on it). All 17 jurisdictions'
  `approxUsdFxRate` values were refreshed from a live, dated snapshot (exchangerate-api.com,
  2026-08-31) rather than left as mixed workbook/reused-config/guessed figures — several were
  > 10% stale (`TRY` had moved ~33%). Still static reference constants, not live-fetched; **needs
  > periodic re-snapshotting** (no automated refresh exists), which is the one genuinely open item
  > here now, not missing sourcing.

<!-- CLAUDE.md L5270-L5275 -->

- **Phase 12 handover prompt full re-draft** — Session 14-3 refreshed its factual anchors only
  (Phase 14 close, fresh baselines) and flagged that new Stack D architecture material landed
  2026-08-30 (`davintrade-stack-d-and-e/`, commit `64222ef4` — a `DUAL-RAG-SYSTEM-ARCHITECTURE.md`,
  two versioned storage-strategy docs, a `-V2.md` Stack D architecture variant). The Advisor must
  resolve whether these supersede the file the handover prompt's `<CANONICAL_DOCUMENTS>` still
  cites before Session 12-0 drafts against it.

<!-- CLAUDE.md L5276-L5278 -->

- **Journey B (authenticated PRO user) chat verification** — not run against production; needs
  Davin's own login click-through on `https://davintrade.app` (or a provided test session), since
  the Executor cannot enter credentials itself.

<!-- CLAUDE.md L5279-L5281 -->

- **`/help` and `/about` 404 on production** — found live during Session 14-3, confirmed unrelated
  to the chat cutover (zero application source changes shipped before the gap was found). Needs its
  own investigation session.

<!-- CLAUDE.md L5282-L5286 -->

- **DavinTrade Academy live browser verification — `/academy` and `/academy/[id]` RESOLVED
  2026-09-01** (locale-i18n-compliance ad-hoc session): both live-verified in a real browser
  (Arabic, `dir="rtl"`, translated chrome, zero console/server errors) once a dev server was free.
  `/admin/tutorials` still needs Davin's own click-through — same "cannot log in as admin" boundary
  as everything else below.

<!-- CLAUDE.md L5287-L5297 -->

- **Authenticated click-through for the locale-i18n-compliance session's 8 auth-gated pages**
  (2026-09-01 ad-hoc session) — `/settings/language`, `/admin/dashboards/*` (5 dashboards),
  `/settings/billing`, `/affiliate/dashboard/commissions`, `/admin/affiliates/[id]`,
  `/admin/tutorials`, and `/checkout` (mounts `CountrySelector`/`PaymentMethodSelector`/
  `PriceDisplay`) all compile and redirect cleanly for an unauthenticated visitor (zero server
  errors) but were not click-through-verified as a logged-in user — same "Executor never enters
  credentials" boundary as the BI dashboards and Academy items above. Needs Davin's own pass to
  confirm: the Settings→Language page's Save actually flips live app context and survives reload;
  the 5 BI dashboards, billing/invoice history, and affiliate commissions/admin pages render
  correctly with a non-English locale selected (`ar`/`th`); the checkout page's country/payment
  selectors and price display localize as expected.

<!-- CLAUDE.md L5298-L5317 -->

- **`20260214000000_rag_dual_memory` — recorded as APPLIED in production's ledger, but its 6
  tables DO NOT EXIST** (corrected 2026-09-13; the earlier "still pending" wording here was wrong
  for production). Production's `_prisma_migrations` row is `applied_steps_count = 0`: it was
  baselined with `prisma migrate resolve --applied` during Session 2-3's history baselining
  (`DECISION-LOG` F20, now in `history/decisions-archive.md`), never executed. Davin confirmed
  against the live production database that none of `mt5_accounts`, `upload_history`,
  `jsonl_sessions`, `behavioral_drift`, `advice_outcomes`, `compliance_audit` exist.
  **Consequence for Stack D:** `prisma migrate deploy` / `migrate status` will treat it as done and
  **never create these tables**. When Stack D RAG work starts, create them with
  `prisma db execute --file prisma/migrations/20260214000000_rag_dual_memory/migration.sql`
  (against production via `prisma.production.config.ts`'s target; the SQL uses
  `CREATE TABLE IF NOT EXISTS`), and **do not** run `migrate resolve` on it again, since the ledger
  row already exists. It is one of 5 zero-step baselined rows (with `20251227000000_init`,
  `20260224000000_update_kc_ha_body_columns`, `20260705000000_add_market_data_v6`,
  `20260705010000_drop_market_data`); `add_market_data_v6` was the same trap
  (`market_data_v6` absent until created by hand 2026-09-09), so check each one's physical objects
  rather than trusting its ledger row. Still also awaiting the Advisor's call on whether the
  2026-08-30 Stack D material supersedes the handover prompt's canonical documents (the "Phase 12
  handover prompt" item above).
