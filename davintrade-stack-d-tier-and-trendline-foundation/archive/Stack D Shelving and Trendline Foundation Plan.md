# Stack D Shelving and Trendline Foundation Plan

Nov 17, 2026 · @Davin

**Superseded on 2026-11-17 by Stack D Tiers and Trendline Foundation Blueprint.** Kept for history only; do not work from this document.

## 1. Status, purpose and scope

This plan splits today's pipeline into three layers: a light **shared base** that keeps running, a **shelved Stack D** that stops but can be restored, and **Trendline Context** built on the base. It is a draft for Davin's approval, not an order, and nothing in it has been built or run.

**Why now.** Stack D is close to finished but expensive to run: 15 indicators per cycle across two timeframes, plus MCD0–MCD3, SYN, entry zones and Engine 4. Trendline Context needs a small fraction of that, mainly closed M5 bars. Parking the heavy part frees resources without losing the work.

**The three layers.**

| Layer             | What it is                                                                                                                                        | State after this plan                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Shared base       | MT5 export of M5 OHLC, the VPS collector, promotion into `market_data_v6`, a cycle-ready signal, the gateway, and the data-status stamp           | Running, slimmed to an OHLC-only source profile                       |
| Stack D           | The 15 indicators, MCD0–MCD3, SYN and the `draft-1` rules table, entry zones, Engine 4 and Report 2, and the reply layer's reading of MCD and SYN | Shelved: switched off by flags, code and data kept, restorable        |
| Trendline Context | The new source in `TRENDLINE-CONTEXT-BLUEPRINT-V2.md` (exporter, uploader, gateway route, three tables, Layer 2, parser, envelope)                | Built on the shared base, after the blueprint amendments in section 9 |

**In scope.** The boundary between the layers, the changes needed to make the base stand alone, the shelving and restore procedures, guardrails that keep each layer from affecting the others, and the amendments Blueprint v2 needs.

**Out of scope.** Deleting anything; any change to the content of the SYN rules table; production migrations, credentials or deployments (those stay with Davin); and the Trendline build itself, which follows Blueprint v2's own phases.

**Binding non-negotiables.** No real infrastructure address or credential in tracked files. Money, auth, secrets and CORS changes escalate to Davin. The Executor never applies a production migration, never enters credentials, and commits or pushes only when asked. This checkout is Windows with CRLF line endings; `git stash` is never used. Every VPS and live-database step waits until Stage B3 has cleared.

### Before you start

Any agent or person picking up this plan reads these points first. Two of them can break the live pipeline or block the work if missed.

1. **The shelving order is load-bearing.** The collector rejects a whole cycle when any expected source is missing. Detach indicators before the collector runs the `ohlc-only-v1` profile and every cycle is rejected. The only safe order is: consumer flags off → switch the collector profile → detach indicators (section 6, steps 1 to 3). The base changes in section 5 must be merged and proven first.
2. **Decide SD1 before anything else.** SD1 is what a reply may say when no SYN board exists. The recommendation: no direction, entry or sizing; only price levels, line facts, policy age and the analyst's view with its source named. It needs a new ADR and is signed off together with Blueprint v2's Q1. Workstream B.3, the Blueprint v2 revision (section 9) and Trendline Phase 4 all depend on it.
3. **Where to begin.** Start at phase P0 in section 13. Then follow the workstreams in order: A (section 4), B (5), C (6), with E (8) as the closing drill. F (9) runs in parallel.
4. **What is not yet confirmed.** Section 14 lists assumptions made without reading the live code. Check the item a step depends on before running that step.
5. **What you may not do.** Delete anything, apply production migrations, enter credentials, commit or push unasked, or touch the VPS or live database before Stage B3 clears (section 3 and the non-negotiables above).

## 2. Target architecture

After this plan, one base pipeline delivers closed M5 bars and a cycle-ready signal every 5 minutes, and two consumers hang off it: Stack D (off) and Trendline Context (being built). Neither consumer depends on the other.

&#91;embedded content: target architecture · base, shelved Stack D, Trendline\]

Dashed parts are switched off while shelved; the table below lists every component and what happens to it.

| Component                                                   | Layer   | After shelving       | Note                                                                         |
| ----------------------------------------------------------- | ------- | -------------------- | ---------------------------------------------------------------------------- |
| MT5 OHLC export on Terminal A                               | Base    | Runs                 | M5 required; M15 only if the reply layer's OHLC window needs it (section 14) |
| The 15 indicators on Terminals A and B                      | Stack D | Detached from charts | Templates and settings archived for restore                                  |
| Terminal B (hot standby)                                    | Base    | Runs, OHLC only      | Mirrors A's slimmed profile                                                  |
| VPS collector and validation                                | Base    | Runs                 | Source profile switched to `ohlc-only` (section 5)                           |
| Promotion into `market_data_v6`                             | Base    | Runs                 | Unchanged                                                                    |
| Cycle-ready signal                                          | Base    | Runs                 | Moved out of the sensors module (section 5)                                  |
| Data-status stamp (FRESH / DELAYED / STALE / MARKET_CLOSED) | Base    | Runs                 | Computed from the OHLC profile                                               |
| `CycleReadyProcessor` sensor work: MCD0–MCD3                | Stack D | Off by flag          | `mcd_outputs` kept, no new rows                                              |
| SYN, `draft-1`, entry zones                                 | Stack D | Off by flag          | `synthesis_readings`, `entry_zones` kept                                     |
| Engine 4, Report 2                                          | Stack D | Off by flag          | `trade_consent_records` kept: append-only, 7-year retention                  |
| Reply layer                                                 | Base    | Runs                 | Reads MCD and SYN only when their flag is on; says so when absent            |
| Trendline Context                                           | New     | Built on the base    | Its own folder, uploader, route, queue, tables and flag                      |

The key move is the cycle-ready row: the base must be able to say "cycle ready" without any Stack D code running.

## 3. Guardrail principles

Every step in this plan follows eight rules. A step that breaks one is stopped and brought back to Davin.

1. **Off, never deleted.** Stack D is switched off by flags and detached indicators. No table is dropped, no migration is rolled back, no row is deleted. All Stack D tables are append-only and stay readable.
2. **Dependencies point one way.** Stack D and Trendline Context may depend on the base. The base depends on neither. Trendline Context never imports, calls or reads Stack D code or tables.
3. **One switch per layer.** Each consumer has its own flag, defaulting to off. Turning one off never changes how the base or the other consumer behaves.
4. **Configuration, not code forks.** The difference between "full" and "OHLC-only" is a versioned source profile, not a second copy of the collector.
5. **Measure before and after.** Every resource claim is backed by numbers taken on the same machine, over the same number of trading days, before and after each step.
6. **Restorable by procedure.** Stack D can be brought back by following a written checklist, and that checklist is tested once in a drill before the shelving is called done.
7. **Honest absence.** When Stack D is off, nothing pretends it ran: the reply layer states that no board verdict is available, and no stale MCD or SYN row is presented as current.
8. **Project rules unchanged.** ADR-025 ("Rules decide, the model explains"), "no grades", data-recency honesty, the off → shadow → live rollout and the B3 freeze all still apply.

## 4. Workstream A: close out Stack D

Stack D is shelved only from a known-good, recorded state, so that "restore" has a precise target.

**A1. Finish to a defined line.** Agree with Davin which open Stack D items are done before shelving and which are parked. Parked items are listed in the shelving ADR (A5), not left in `waiting-on.md` alone.

**A2. Record the B3 result.** The live shadow on Terminal A ends with a written result: cycles observed, FRESH / STALE / rejected counts, MCD0 flag frequency, and any open defect. The B3 freeze lifts only when Davin says so.

**A3. Freeze a release.** Davin creates a git tag on the final Stack D commit (suggested `stack-d-shelved-<date>`). The Executor does not tag or push unless asked. The tag pins code, both Prisma schemas, migrations, the `draft-1` rules table version and `config_hash`.

**A4. Archive what is not in git.** Into a tracked folder, with no addresses or secrets:

- MT5 chart templates and indicator inputs for every Stack D chart on Terminals A and B, including the `active_indicator_settings` values;
- the collector's current full source list;
- the names (not values) of every environment variable and NSSM service Stack D uses;
- the flag names and their current values.

**A5. Write the shelving ADR.** It records what is shelved, why (resource cost), what stays running, the restore conditions, and the restore checklist (section 8). It takes the next free ADR number.

**A6. Take the resource baseline.** Before any change, measure the items in section 10 for at least five trading days with Stack D fully on. This is the "before" every later saving is compared with.

**Exit criteria:** B3 result written; tag exists; archive committed (on Davin's word); ADR drafted; baseline recorded.

## 5. Workstream B: extract the shared base

Three small changes let the base run without Stack D. All three must be in place and proven **before** any indicator is detached; otherwise every cycle is rejected.

### B.1 Collector source profiles

Today the collector rejects a cycle when any expected source is missing. Removing indicators without changing that rule would turn every cycle STALE or rejected.

- Move the list of required sources out of code into a versioned **source profile**, for example `full-v1` (today's list) and `ohlc-only-v1` (M5 OHLC, plus M15 OHLC only if section 14 confirms the reply layer needs it).
- The active profile is one setting. The cycle record stores which profile produced it, beside `config_hash`, so history stays interpretable.
- The completeness rule is unchanged in spirit: a cycle is complete when every source **in the active profile** is present. A missing OHLC export still rejects the cycle.
- Tests: each profile accepts its own complete set, rejects a set missing one of its sources, and ignores extra sources that are not in it.

### B.2 Cycle-ready signal owned by the base

Blueprint v2 (§9.1) has `CycleReadyProcessor` in the sensors module enqueue Layer 2 after its own commit. With sensors off, that never happens.

- Emit the cycle-ready event from the promotion step that writes `market_data_v6`, which is part of the base.
- Stack D subscribes to that event when its flag is on; Trendline's queue `trendline-context-cycle` subscribes when its flag is on. Neither consumer can fail the promotion: each enqueue is wrapped so it can only log.
- Tests: promotion with both flags off emits the event and enqueues nothing; with one flag on, only that queue receives a job; a failing enqueue never fails promotion.

### B.3 Reply layer without a board

- The reply layer reads MCD and SYN only when the Stack D flag is on.
- When it is off, the reply states plainly that no board verdict is available and gives no direction, entry or sizing (see decision SD1 in section 12 for what Trendline-only replies may say).
- The data-status stamp and "data as of hh:mm UTC" continue from the base.

**Exit criteria:** B.1 to B.3 merged behind flags, tests green, `full-v1` still the active profile, and a shadow comparison showing `ohlc-only-v1` would have accepted the same cycles' OHLC.

## 6. Workstream C: shelve Stack D

Shelving runs in a fixed order so that the pipeline is never in a state where the collector expects a source that no longer exists.

1. **Consumers off first.** Set the Engine 4 / Report 2 flag, the SYN flag and the sensors (MCD) flag to off, in that order, downstream first. Confirm with one trading day of cycles: promotion continues, no new rows in `mcd_outputs`, `synthesis_readings` or `entry_zones`, and the reply layer reports no board.
2. **Switch the collector profile.** Set the active profile to `ohlc-only-v1`. Confirm for at least one trading day that every cycle is still FRESH (outside market closures) and that each cycle record names the new profile.
3. **Detach the indicators.** On Terminal A, then Terminal B, remove the Stack D indicators from their charts and load the OHLC-only chart template. Keep the archived templates from A4. Done after step 2 only, so the collector no longer waits for their files.
4. **Stop Stack D-only services.** Any NSSM service or worker that only serves Stack D is stopped and set to manual start, not uninstalled. Its name goes into the restore checklist.
5. **Keep the data.** `mcd_outputs`, `synthesis_readings`, `entry_zones` and `trade_consent_records` stay as they are. Consent records keep their seven-year retention and their append-only trigger.
6. **Keep the code alive in CI.** Stack D unit tests and golden scenarios G01–G16 keep running on every change, so the code cannot rot unnoticed. If a test must be skipped, the skip names the reason and an owner.
7. **Measure the "after".** Repeat the section 10 measurements for at least five trading days.

**Rollback at any step:** set the previous profile and flags back and reattach the archived templates. Because nothing was deleted, rollback is the same as restore (section 8).

**Exit criteria:** all consumers off, `ohlc-only-v1` active, indicators detached on both terminals, five clean trading days, the "after" numbers recorded.

## 7. Workstream D: immunization guardrails

These guardrails keep the three layers from affecting each other while one is shelved and another is being built. Each is enforced by a test or a check, not by memory.

| #    | Guardrail                                                                                             | Enforced by                                                                                                                                                   |
| ---- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1  | Trendline code never imports or calls the sensors, SYN or Engine 4 modules                            | A boundary test (lint rule or import scan) that fails the build                                                                                               |
| D-2  | Trendline tables have no foreign key into any Stack D table, and Stack D tables none into Trendline's | A schema check in CI over both Prisma schemas                                                                                                                 |
| D-3  | The base never imports either consumer                                                                | The same boundary test, in the other direction                                                                                                                |
| D-4  | With every consumer flag off, promotion and the data-status stamp still work                          | An integration test run on every change                                                                                                                       |
| D-5  | A failing consumer cannot fail promotion                                                              | A test that forces each consumer's enqueue to throw                                                                                                           |
| D-6  | A shelved flag cannot be switched on by accident                                                      | Flags default to off; turning Stack D on requires the active profile `full-v*`, checked at startup, else the gateway refuses to register Stack D and logs why |
| D-7  | Stack D code keeps compiling and passing                                                              | Its unit tests and G01–G16 in CI (step 6 of section 6)                                                                                                        |
| D-8  | The analyst terminal never touches the data terminals                                                 | Trendline's exporter runs on Terminal C only (Blueprint v2 Q7); A and B carry no Trendline attachment                                                         |
| D-9  | Nothing stale is shown as current                                                                     | The reply layer ignores MCD and SYN rows when the Stack D flag is off, regardless of their age                                                                |
| D-10 | Resource drift is visible                                                                             | The section 10 metrics are logged daily, with an alert when CPU or memory on the VPS crosses an agreed threshold                                              |

**Monitoring while shelved.** Three numbers are watched daily: share of cycles FRESH, collector rejections and their reasons, and VPS CPU and memory. A rejection whose reason names a Stack D source means a profile or template slipped and is fixed the same day.

D-6 is the only guardrail that adds behaviour to the gateway; it is a startup check, not an auth change, and it escalates to Davin if it would touch the auth guard.

## 8. Workstream E: restore procedure

Stack D comes back by reversing section 6 in order, from the archive made in A4. The procedure is tested once, as a drill, before shelving is declared done.

**Preconditions.** Davin decides to restore; the B3-style freeze rules are agreed for the restore window; the shelving tag and archive are at hand.

1. **Check the code.** Confirm Stack D tests and G01–G16 are green on the current main branch. If schema or base code moved since the tag, fix forward on main; never restore by checking out the old tag over newer code.
2. **Start services.** Set the Stack D-only services from manual back to automatic and start them.
3. **Reattach indicators.** Load the archived templates and inputs on Terminal A, then B. Check `active_indicator_settings` against the archive.
4. **Collect in parallel.** Let the full set of files appear for at least one trading day while the profile is still `ohlc-only-v1`; the collector ignores the extra sources.
5. **Switch the profile.** Set `full-v1` (or a newer full profile). Confirm cycles are FRESH and complete.
6. **Consumers on, upstream first.** Sensors, then SYN, then Engine 4 / Report 2, each through shadow before live, as for any capability.
7. **Compare.** Run the golden scenarios against live cycles and compare MCD0 flag rates and zone output with the B3 record from A2.

**The drill.** On a non-production setup (a throwaway database and a terminal that is not A), run steps 1 to 6 once after shelving and record how long it took and what the checklist missed. Update the checklist; then shelving is done.

**What restore does not need.** No migration, no data backfill: Stack D's tables simply start receiving new rows again. The gap in `mcd_outputs` during the shelf is expected and is visible by cycle time.

## 9. Workstream F: Blueprint v2 amendments

Blueprint v2 was written with Stack D running. Six of its sections assume that and must be amended before Trendline is built on the base alone.

| Blueprint v2 section                         | What it assumes today                                                                    | Amendment                                                                                                                          |
| -------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| §1 Context, §2 principle                     | "The rules table is policy, sensor readings are context"; the SYN board exists           | State that Trendline runs on the shared base and does not require Stack D                                                          |
| §9.1 Trigger                                 | `CycleReadyProcessor` (sensors) enqueues `trendline-context-cycle` after its commit      | Enqueue from the base's cycle-ready event (B.2)                                                                                    |
| §9.2 Definitions                             | M5 bars from `market_data_v6`; `cycle_slot` clock                                        | Unchanged in substance; name the `ohlc-only-v1` profile as the source of those bars                                                |
| §11.1, §12.1 ADR-025 rules                   | "Bias, archetype and stand-aside come only from the board; the board governs a conflict" | Add the no-board mode decided in SD1: what a reply may and may not say when no board exists                                        |
| §12.1 eval scenarios                         | Board says `SHORT` or `STAND_ASIDE`, reply keeps it                                      | Add scenarios with no board: analyst text says "pullback buy", reply gives levels and the attributed view, no direction of its own |
| §13, §14, §16 Inventory, rollout, build plan | `CycleReadyProcessor` gets one guarded enqueue; Stack D running during shadow            | Replace with the base event; add this plan's phases as prerequisites to Trendline Phase 1 step 3 onward                            |

**What does not change.** The two-layer split, the exporter, the policy file, bar-space geometry, the uploader, the synchronous gateway, the three tables, the parameters T, T_drift and H_stale, the parser, the image rule, and decisions Q2, Q3, Q5 and Q9.

**How to apply.** One more blueprint revision, written by the Advisor and recorded in its header like the 2026-11-16 revisions, with Q1 re-opened for sign-off together with SD1. The Phase 1 geometry check (§5.4) does not depend on any of this and can start as soon as Davin's desktop terminal is ready.

## 10. Resource measurement and success criteria

Shelving succeeds when the base is at least as reliable as before and measurably cheaper. No saving is assumed: none of these numbers has been measured yet.

| Metric                                                 | Where measured    | Taken                                   | Success after shelving                                                            |
| ------------------------------------------------------ | ----------------- | --------------------------------------- | --------------------------------------------------------------------------------- |
| MT5 terminal CPU and memory, Terminal A                | VPS               | Hourly, 5 trading days before and after | Lower than baseline; target set by Davin from the baseline                        |
| VPS total CPU and memory, peak and median              | VPS               | Same                                    | Lower than baseline, with headroom for Terminal C if it will live on the VPS (Q7) |
| Cycle export time: bar close to files written          | Collector log     | Every cycle                             | Not slower than baseline                                                          |
| Promotion latency: files to `market_data_v6`           | Gateway log       | Every cycle                             | Not slower than baseline                                                          |
| Share of cycles FRESH (market open)                    | Data-status stamp | Daily                                   | Equal to or better than baseline                                                  |
| Collector rejections, by reason                        | Collector log     | Daily                                   | No rejection naming a Stack D source                                              |
| Database growth per day                                | PostgreSQL        | Daily                                   | Lower: no new Stack D rows                                                        |
| Model and tooling cost per day attributable to Stack D | Usage metering    | Daily                                   | Near zero while shelved                                                           |

**Done means:** all "after" rows meet their target for five consecutive trading days including a weekend, the restore drill has passed, and the shelving ADR is approved.

## 11. Risks and mitigations

The largest risk is ordering: detaching indicators before the collector profile changes would reject every cycle.

| Risk                                            | Effect                                            | Mitigation                                                                             |
| ----------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Indicators detached before the profile switch   | Every cycle rejected or STALE                     | Fixed order in section 6; step 3 only after step 2 has run clean for a trading day     |
| Hidden reader of a Stack D source               | A component breaks silently when its source stops | Audit every reader of the indicator tables and MCD/SYN rows before step 1 (section 14) |
| Reply layer still reads old MCD or SYN rows     | Stale verdicts shown as current                   | Guardrail D-9; a test with the flag off and fresh-looking rows present                 |
| Stack D code rots on the shelf                  | Restore fails or takes weeks                      | Guardrail D-7, CI keeps tests and G01–G16 running; restore drill                       |
| Base changes break Stack D's assumptions        | Restore needs rework                              | Every base change runs Stack D's tests too; fix forward on main                        |
| Trendline grows a quiet dependency on Stack D   | Shelving no longer isolates                       | Guardrails D-1 and D-2 fail the build                                                  |
| Reply quality drops with no board               | Users get less guidance                           | Explicit no-board mode (SD1); say what is missing rather than fill the gap             |
| Report 1 or the calendar feed depend on Stack D | Report 1 changes unexpectedly                     | Decide its fate in SD3 before shelving                                                 |
| Consent records altered during shelving         | Legal record broken                               | No change to `trade_consent_records`; its trigger and retention stay                   |
| Restore under time pressure                     | Mistakes in a live window                         | Restore only through the tested checklist, through shadow first                        |

## 12. Decisions for Davin

Eight decisions shape this plan. Each row gives the recommendation it builds on until Davin answers. **SD1 is decided first:** it sets what the product says without a board, and B.3, the blueprint revision and Trendline Phase 4 depend on it. SD2 and SD3 come next, before shelving step 1; the rest can follow the phases.

| #   | Decision                                                                              | Recommendation                                                                                                                                   | Blocks                  |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| SD1 | What may a reply say when no board exists?                                            | No direction, entry or sizing. Levels, line facts, policy age and the analyst's attributed view only. Needs its own ADR and Q1 sign-off together | Trendline Phase 4, live |
| SD2 | Which OHLC goes into `ohlc-only-v1`?                                                  | M5 for Trendline; add M15 only if the reply layer's compact OHLC window needs it                                                                 | Workstream B            |
| SD3 | Do Report 1 and the economic-calendar export stay in the base or shelve with Stack D? | Decide after the reader audit; keep the calendar if any non-Stack D reply uses it                                                                | Shelving step 1         |
| SD4 | Does Terminal B stay as hot standby for the base?                                     | Yes, on the OHLC-only template, so the base keeps its failover                                                                                   | Shelving step 3         |
| SD5 | Where does Terminal C (Trendline) live?                                               | As Blueprint v2 Q7: VPS after B3 if the "after" numbers leave headroom, else Davin's desktop                                                     | Trendline Phase 5       |
| SD6 | Do Stack D tests stay required in CI?                                                 | Yes, required; a skip needs a named reason and owner                                                                                             | Guardrail D-7           |
| SD7 | What "restore" means for the rules table                                              | Restore the tagged `draft-1` version unchanged; any rules change is a separate decision                                                          | Restore                 |
| SD8 | Resource targets for "done"                                                           | Set by Davin after the baseline in A6                                                                                                            | Section 10              |

## 13. Sequenced plan

Shelving runs as five gated phases; Trendline work starts in parallel and needs only the base's cycle-ready event from P2 before its Layer 2.

&#91;embedded content: shelving phases P0–P4 beside the Trendline track\]

Each gate is passed only on Davin's word. Nothing on the VPS or the live database moves before Stage B3 clears, so P1's B3 record comes first and P3 cannot start earlier.

## 14. Assumptions and items not yet verified

This plan was written from the Stack D architecture document, Blueprint v2 and conversation notes, not from the live code. The Executor confirms each item below against the code before the step that depends on it.

- [ ] **Collector rule.** The collector rejects a cycle when any expected source is missing, and that list can be moved into configuration without a rewrite.
- [ ] **Where cycle-ready is raised.** Whether the promotion step can emit the event, or whether it is raised inside the sensors path today.
- [ ] **Readers of Stack D data.** Every component that reads the indicator tables, `mcd_outputs`, `synthesis_readings` or `entry_zones`, including the monolith's packet builder.
- [ ] **OHLC the reply layer needs.** Which timeframes the compact OHLC window uses (decides SD2).
- [ ] **Report 1 and the calendar.** Whether either depends on MCD or SYN output (decides SD3).
- [ ] **Flag names.** The actual flag names for sensors, SYN, Engine 4 and the reply layer's MCD reading, and whether each defaults to off.
- [ ] **Stack D-only services.** Which NSSM services and workers serve only Stack D.
- [ ] **Where the cost is.** That the 15 indicators and sensor work, not the OHLC export or promotion, are the main resource cost; the A6 baseline confirms or corrects this.
- [ ] **Terminal B template.** That B can run the OHLC-only template and still take over from A.
- [ ] **Blueprint v2 open checks.** `cycle_slot` open or close time, bar-space geometry, and the M5 bar clock (§17 of the blueprint) are unaffected by this plan but still gate Trendline Phases 1 and 2.

Related documents: `docs/STACK-D-ARCHITECTURE.md` and `TRENDLINE-CONTEXT-BLUEPRINT-V2.md` (revised 2026-11-16).
