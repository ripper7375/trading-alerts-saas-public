# Stack D Tiers and Trendline Foundation Blueprint

Nov 17, 2026 · @Davin

## 1. Status, purpose and scope

This blueprint is the single source of truth for running Stack D at three resource tiers and for building Trendline Context on a shared base. It is a draft for Davin's approval, not an order, and nothing in it has been built or run.

| Tier      | Collector profile | MT5 chart instances                                    | Stack D                    | Trendline Context | SYN board |
| --------- | ----------------- | ------------------------------------------------------ | -------------------------- | ----------------- | --------- |
| 1 Full    | `full-v1`         | Today's set: 15 indicators across M15 and M5           | Runs, unchanged            | Can run           | Yes       |
| 2 Lite    | `core-v1`         | 6: OHLC, `cherry_a`, `SR_Levels` on each of M15 and M5 | Runs, with a changed model | Can run           | Yes       |
| 3 Shelved | `ohlc-only-v1`    | M5 OHLC (plus M15 OHLC if decision D3 needs it)        | Off, restorable            | Can run           | No        |

**Purpose.** Stack D is close to finished but expensive to run. This blueprint lets it run cheaper (Tier 2) or be parked without loss (Tier 3), and gives Trendline Context a light base that works on every tier.

**Key ideas.**

- A **tier** is the collector's active source profile plus the consumers allowed on it. The profile belongs to the shared base, not to Stack D.
- The **shared base** is MT5 OHLC export, the VPS collector, promotion into `market_data_v6`, the cycle-ready signal and the data-status stamp. It runs on every tier.
- **Stack D** (MCD0–MCD3, SYN and `draft-1`, entry zones, Engine 4 and Report 2) needs Tier 1 or 2.
- **Trendline Context** needs only closed M5 bars and the cycle-ready signal, so it runs on any tier. Its replies follow the tier: with a board on Tiers 1–2, without one on Tier 3.

**In scope.** The tier model, the changes that make the base stand alone, Tier 2 adoption, Tier 3 shelving and restore, isolation guardrails, the amendments Blueprint v2 needs, and the order of work.

**Out of scope.** Deleting anything; changing the content of the SYN rules table; production migrations, credentials and deployments (those stay with Davin); the Trendline build itself, which follows Blueprint v2's phases.

**Replaces.** Stack D Shelving and Trendline Foundation Plan and Stack D Three-Tier Operating Model, both from 2026-11-17. Nothing in them is lost; section 21 maps their parts to this document.

**Related documents.** `docs/STACK-D-ARCHITECTURE.md` and `TRENDLINE-CONTEXT-BLUEPRINT-V2.md` (revised 2026-11-16).

**Binding non-negotiables.** No real infrastructure address or credential in tracked files. Money, auth, secrets and CORS changes escalate to Davin. The Executor never applies a production migration, never enters credentials, and commits or pushes only when asked. Windows checkout with CRLF; `git stash` is never used. Every VPS and live-database step waits until Stage B3 has cleared.

## 2. Before you start

Any agent or person picking up this work reads these seven points first. The first three can break the live pipeline or change trading output if missed.

1. **Profile first, charts second.** The collector rejects a whole cycle when a required source is missing. Going down a tier, switch the profile and run one clean trading day before any indicator is detached. Going up, attach first and switch the profile last (section 12).
2. **Tier 2 is a model change, not only a load cut.** It switches the active channel on both timeframes (M15 `non_b` → `cherry_a`, M5 `best_fit_a` → `cherry_a`) and drops `S_R_Levels`. MCD1, MCD2, SYN and the entry zones will produce different numbers. It needs an ADR, a side-by-side shadow, re-pinned golden scenarios and Davin's approval.
3. **Decide D2 before anything else.** D2 is how replies behave on each tier: board mode on Tiers 1–2, no-board mode on Tier 3 (no direction, entry or sizing). It needs one ADR, signed off together with Blueprint v2's Q1. Workstream 2's reply modes, Workstream 6 and Trendline Phase 4 depend on it. D1 and D3 follow.
4. **Change one thing at a time.** Tier 2 comes in two steps: switch the channel with all indicators still running (fully reversible), then reduce to six instances (section 10).
5. **Trendline Context does not need Tier 3.** It runs on any tier once Workstream 2 gives the base its own cycle-ready event.
6. **Where to begin.** Start at phase P0 in section 19. Check the section 20 item a step depends on before running that step.
7. **What you may not do.** Delete tables or rows, apply production migrations, enter credentials, commit or push unasked, change the SYN rules table, or touch Terminal A, the VPS or the live database before Stage B3 clears.

## 3. Target architecture

One shared base delivers closed bars and a cycle-ready signal every 5 minutes; the collector's active profile picks the tier; Stack D runs only on Tiers 1–2, and Trendline Context runs on all three.

&#91;embedded content: three tiers on one shared base\]

Tier 2 is highlighted because it is the only tier that changes trading output (section 6). Tier 3 is dashed because Stack D is off there. Stack D and Trendline Context never read each other.

| Component                                                       | Layer     | Tier 1                    | Tier 2                 | Tier 3                              |
| --------------------------------------------------------------- | --------- | ------------------------- | ---------------------- | ----------------------------------- |
| MT5 OHLC export, Terminals A and B                              | Base      | Runs                      | Runs                   | Runs                                |
| Stack D indicator instances                                     | Stack D   | 15 indicators, M15 and M5 | 6 instances            | Detached, archived                  |
| VPS collector                                                   | Base      | `full-v1`                 | `core-v1`              | `ohlc-only-v1`                      |
| Promotion into `market_data_v6`, cycle-ready, data-status stamp | Base      | Runs                      | Runs                   | Runs                                |
| MCD0–MCD3 (`mcd_outputs`)                                       | Stack D   | Runs                      | Runs, `cherry_a` model | Off; table kept                     |
| SYN, `draft-1`, entry zones                                     | Stack D   | Runs                      | Runs                   | Off; tables kept                    |
| Engine 4, Report 2 (`trade_consent_records`)                    | Stack D   | Runs                      | Runs                   | Off; records kept, 7-year retention |
| Trendline Context (Terminal C, uploader, route, Layer 2)        | Trendline | Can run                   | Can run                | Can run                             |
| Reply layer                                                     | Base      | Board mode                | Board mode             | No-board mode                       |

## 4. Guardrail principles

Every step follows nine rules. A step that would break one stops and goes back to Davin.

1. **Off, never deleted.** Lower tiers switch things off; no table is dropped, no migration rolled back, no row deleted. Stack D tables are append-only and stay readable.
2. **Dependencies point one way.** Stack D and Trendline Context may depend on the base. The base depends on neither, and Trendline never imports, calls or reads Stack D.
3. **One switch per tier.** The active profile is the only tier switch. Each consumer also has its own flag, off by default.
4. **Configuration, not code forks.** Tiers differ by versioned profiles, not by copies of the collector.
5. **One change at a time.** A model change (new channel) and a load change (fewer instances) never ship in the same step.
6. **Measure before and after.** Every resource claim is backed by numbers taken on the same machine over the same number of trading days.
7. **Restorable by procedure.** Any tier left behind can be brought back from a written, drilled checklist.
8. **Honest absence.** When Stack D is off, nothing pretends it ran: replies say no board verdict exists, and old MCD or SYN rows are never shown as current.
9. **Project rules unchanged.** ADR-025 ("Rules decide, the model explains"), "no grades", data-recency honesty, off → shadow → live, and the B3 freeze all still apply.

## 5. Source profiles

A source profile is a versioned list of the sources the collector requires for a cycle to be complete. Exactly one profile is active at a time, and that setting defines the tier.

**Today.** The required sources are effectively fixed in code: if any is missing, the collector rejects the cycle. That rule stays; only the list becomes configuration.

**Specification.**

- **Definition.** Each profile is a named, versioned, tracked configuration file: `full-v1`, `core-v1`, `ohlc-only-v1`. It lists, per timeframe, the required sources by the names the collector already uses, and the chart template that produces them.
- **Immutability.** A published profile version never changes; a change is a new version (`core-v2`), so any stored cycle can be explained by the profile it names.
- **Completeness rule.** A cycle is complete when every source in the active profile is present and valid. Extra sources outside the profile are ignored and not promoted. A missing required source rejects the cycle exactly as today.
- **Stamping.** Every cycle record stores the active profile name beside `config_hash`, so history shows which tier produced each cycle.
- **Switching.** One setting, changed only by Davin or on his word. A switch takes effect at the next cycle boundary and is logged with old and new names.
- **Startup check.** The collector and gateway verify the active profile exists and that every enabled consumer is allowed on it (section 7). On a mismatch they refuse that consumer and log why; the base keeps running.

**Profile contents.**

| Profile        | M15 required                                                                   | M5 required                                                        |
| -------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `full-v1`      | Today's full M15 set                                                           | Today's full M5 set                                                |
| `core-v1`      | OHLC, `cherry_a`, `SR_Levels`, plus any statistics input MCD needs (section 6) | OHLC, `cherry_a`, `SR_Levels`, plus any statistics input MCD needs |
| `ohlc-only-v1` | OHLC only if decision D3 needs it                                              | OHLC                                                               |

`full-v1` is generated from today's collector list unchanged, so adopting profiles on Tier 1 changes no behaviour.

## 6. Tier 2: `core-v1`

Tier 2 runs six chart instances, three per timeframe, and keeps every Stack D stage. It differs from today in two places that change trading output.

| Timeframe | OHLC | Channel    | Support and resistance |
| --------- | ---- | ---------- | ---------------------- |
| M15       | OHLC | `cherry_a` | `SR_Levels`            |
| M5        | OHLC | `cherry_a` | `SR_Levels`            |

**Why `cherry_a`.** Davin's choice: of the centroid channels, `cherry_a` is the most flexible in use. One channel family on both timeframes also simplifies the configuration.

### Change 1: the active channel

|             | Today        | Tier 2     | Affected outputs                                                                                                        |
| ----------- | ------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| M15 channel | `non_b`      | `cherry_a` | MCD1 (M15 primary trend) and what SYN takes from it                                                                     |
| M5 channel  | `best_fit_a` | `cherry_a` | MCD2 (M5 corridor), entry-zone sources and half-width (10% of the channel width), invalidation distances, runway ratios |

The `cherry_a` parameters on each timeframe become part of `config_hash` (decision D7).

### Change 2: one support and resistance set

Tier 2 keeps `SR_Levels` and drops `S_R_Levels` on both timeframes. If the structural levels used for zone confluence and invalidation (`sr_1`, `sr_2`, `sr_3`) come wholly or partly from `S_R_Levels`, zones change. Section 20 item 3 is verified before Step 3A.

### Inputs beyond the six instances

- **Statistics inputs.** The SSA and channel statistics MCD reads per timeframe. If one comes from an indicator outside the six, keep that indicator in `core-v1` or compute it server-side (decision D8).
- **Control inputs.** `cycle_slot` / `stats_slot`, data status, RETUNING, the active setting and `config_hash`: unchanged.
- **MCD0 and MCD3.** Unchanged in logic; they run on what the profile supplies.

### What Tier 2 gives up

- **Retuning to another channel.** With only `cherry_a` on the charts, `active_indicator_settings` cannot switch to another variant. Going back means moving to Tier 1 first.
- **Direct comparability with Tier 1 history.** Readings before and after come from different channels. The profile stamp keeps them apart; analyses must not pool them blindly.

## 7. Tier rules

Four rules keep the tiers consistent. Each is enforced in code at startup or at the cycle boundary.

### Rule 1: consumers allowed per tier

| Consumer                  | `full-v1`  | `core-v1`  | `ohlc-only-v1` |
| ------------------------- | ---------- | ---------- | -------------- |
| Stack D sensors MCD0–MCD3 | Allowed    | Allowed    | Refused        |
| SYN and entry zones       | Allowed    | Allowed    | Refused        |
| Engine 4 and Report 2     | Allowed    | Allowed    | Refused        |
| Trendline Context         | Allowed    | Allowed    | Allowed        |
| Reply layer               | Board mode | Board mode | No-board mode  |

A consumer whose flag is on but whose tier refuses it is not registered; the base keeps running and the refusal is logged.

### Rule 2: the active channel must exist in the profile

`active_indicator_settings` may select only a channel the active profile supplies; on `core-v1` that is `cherry_a` on both timeframes. A setting outside the profile is refused on save, and the startup check refuses Stack D if a stored setting no longer matches. Without this rule a retune on Tier 2 would make every cycle STALE.

### Rule 3: one tier per cycle

The profile switches only at a cycle boundary. Each cycle is computed under one profile and one active setting, and both are stamped on it.

### Rule 4: reply mode follows the tier (decision D2)

- **Board mode, Tiers 1 and 2.** Blueprint v2's ADR-025 rules apply as written: bias, archetype and stand-aside come only from the SYN board; Trendline content is attributed context; when they conflict the reply states both and the board governs.
- **No-board mode, Tier 3.** No direction, entry or sizing. The reply gives price levels, line facts, policy age and the analyst's view with its source named, and says plainly that no board verdict is available. Old MCD or SYN rows are never used.
- **Automatic selection.** The reply layer reads the Stack D flag and the active profile at request time. One ADR covers both modes.

## 8. Workstream 1: close out Stack D

Every later change starts from a known-good, recorded Tier 1 state, so that any rollback or restore has a precise target.

**1.1 Finish to a defined line.** Agree with Davin which open Stack D items are done and which are parked. Parked items go into the tier ADR (1.5), not only `waiting-on.md`.

**1.2 Record the B3 result.** The Terminal A live shadow ends with a written result: cycles observed, FRESH / STALE / rejected counts, MCD0 flag frequency and open defects. The B3 freeze lifts only on Davin's word.

**1.3 Freeze a release.** Davin creates a git tag on the final Tier 1 commit (suggested `stack-d-tier1-<date>`). The Executor does not tag or push unless asked. The tag pins code, both Prisma schemas, migrations, the `draft-1` version and `config_hash`.

**1.4 Archive what is not in git.** Into a tracked folder, with no addresses or secrets:

- MT5 chart templates and indicator inputs for every Stack D chart on Terminals A and B, including the `active_indicator_settings` values;
- the collector's current full source list (it becomes `full-v1`);
- the names (not values) of every environment variable and NSSM service Stack D uses;
- the flag names and current values.

**1.5 Write the tier ADR.** One ADR records the tier model, what each tier runs, the restore conditions and the switching procedure (section 12). The Tier 2 model change gets its own ADR in Step 3A; the reply modes get theirs under D2. Each takes the next free number.

**1.6 Baseline and reader audit.**

- Measure the section 16 metrics for at least five trading days on Tier 1, including the load of each indicator instance on Terminal A.
- List every reader of each Stack D source and output: indicator tables, `mcd_outputs`, `synthesis_readings`, `entry_zones`, the reply layer, Report 1, dashboards and the monolith's packet builder. Keep the source → readers table in the repository.

**Exit criteria.** B3 result written; tag exists; archive committed on Davin's word; tier ADR drafted; baseline and reader audit recorded.

## 9. Workstream 2: build the shared mechanism

Workstream 2 adds the tier machinery while the system stays on Tier 1, so it changes no output. It is the foundation for Tier 2, Tier 3 and Trendline Context alike.

**2.1 Source profiles in the collector.** Implement section 5: profile files, the completeness rule against the active profile, stamping of the profile name on each cycle, boundary-only switching and the startup check. Ship `full-v1` generated from today's list and make it active.

**2.2 Cycle-ready owned by the base.** Raise the cycle-ready event from the promotion step that writes `market_data_v6`, not from the sensors module (today Blueprint v2 §9.1 has `CycleReadyProcessor` enqueue Trendline after its own commit). Stack D and Trendline (`trendline-context-cycle`) subscribe behind their own flags. A failing subscriber can only log; it can never fail promotion.

**2.3 Consumer gating.** Implement Rule 1: each consumer checks the active profile at startup and refuses to register on a tier that does not allow it.

**2.4 Active-setting guard.** Implement Rule 2: saving an `active_indicator_settings` value outside the active profile is refused; the startup check catches a stored mismatch.

**2.5 Reply modes.** Implement Rule 4 behind its own flag, board mode by default. No-board mode is exercised in tests until a tier needs it. The data-status stamp and "data as of hh:mm UTC" come from the base on every tier.

**2.6 Draft the other profiles.** Write `core-v1` and `ohlc-only-v1` as files; do not activate them.

**Timing.** The code can be written and tested before Stage B3 clears; deploying it to the gateway and VPS waits for B3 and Davin's word.

**Exit criteria.** All of the above merged behind flags, Tier 1 still active, every Stack D test and golden scenario G01–G16 unchanged and green, and one shadow week showing cycles and outputs identical to the Workstream 1 baseline.

## 10. Workstream 3: adopt Tier 2 in two steps

Tier 2 is reached by changing the model first, with every indicator still running, and removing instances only after the new model is accepted. Each step can be undone on its own.

### Step 3A: switch the model, keep all indicators

Prerequisites: Workstream 2 done; Stage B3 cleared; section 20 items 2 to 4 verified.

1. **Make `cherry_a` selectable.** If it is not already a valid source of `active_indicator_settings`, add it to the schema, DTO and collector source names (a migration Davin applies). Fix its parameters per timeframe (D7) and include them in `config_hash`.
2. **Repaint check.** Run the drift test used for the other channels (two captures days apart over the same closed bars) on `cherry_a` for M15 and M5. Closed-bar values must be stable under ADR-011; if not, stop.
3. **Write the ADR** for both model changes: `cherry_a` as the channel and `S_R_Levels` dropped, with reasons and expected effects.
4. **Shadow side by side.** For at least five trading days including a weekend, compute every cycle twice: the live path on today's channels and both S&R sets, and a shadow path reading only the Tier 2 sources (`cherry_a` and `SR_Levels`). Both model changes are judged here, so Step 3B changes no output. Shadow results never reach users.
5. **Compare and review.** Cycle by cycle: MCD1 and MCD2 readings, SYN rule hits and bias, zone sources, widths, invalidation and runway. Davin decides whether `draft-1` needs retuning (D9; his call alone).
6. **Re-pin golden scenarios.** Regenerate G01–G16 expected values under the Tier 2 model, each changed value with a one-line reason.
7. **Go live on the new model.** Set the active channel to `cherry_a` on both timeframes and stop reading `S_R_Levels`, still on `full-v1`. Rollback: set the old channels and S&R reading back; nothing has been removed.

### Step 3B: reduce to six instances

Prerequisites: Step 3A live for at least five clean trading days; section 20 item 4 resolved.

1. **Prove the drop.** Replay stored cycles through the `core-v1` source set; outputs must match the live 3A outputs exactly. Any difference means a hidden reader of a dropped source: stop and fix it.
2. **Switch the profile** to `core-v1` at a cycle boundary. Run one clean trading day: every cycle complete and FRESH outside closures.
3. **Lock the setting.** Rule 2 now restricts the active channel to `cherry_a`.
4. **Detach the other instances** on Terminal B first, then Terminal A, loading the six-instance templates. Archive what was removed beside the Workstream 1 archive.
5. **Measure** the section 16 metrics for five trading days.

**Rollback of 3B.** Reattach the archived templates, let the extra files appear for a trading day, then set `full-v1`. The model stays on `cherry_a` unless 3A is also rolled back.

## 11. Workstream 4: Tier 3, shelving Stack D

Tier 3 parks Stack D completely and keeps only the base, Trendline Context and the reply layer. It can be entered from Tier 1 or Tier 2, in a fixed order so the collector never waits for a source that has stopped.

1. **Consumers off, downstream first.** Engine 4 / Report 2, then SYN, then the sensors. Confirm with one trading day of cycles: promotion continues; no new rows in `mcd_outputs`, `synthesis_readings` or `entry_zones`; replies are in no-board mode.
2. **Switch the profile** to `ohlc-only-v1` at a cycle boundary. Confirm for one trading day that every cycle is FRESH outside closures and names the new profile.
3. **Detach the indicators** on Terminal B, then Terminal A, loading the OHLC-only template (D5 keeps B as hot standby). Archive the templates being left (full set from Tier 1, six-instance set from Tier 2).
4. **Stop Stack D-only services.** Any NSSM service or worker that serves only Stack D is stopped and set to manual start, not uninstalled; its name goes into the restore checklist.
5. **Keep the data.** `mcd_outputs`, `synthesis_readings`, `entry_zones` and `trade_consent_records` stay as they are. Consent records keep their seven-year retention and append-only trigger.
6. **Keep the code alive.** Stack D unit tests and G01–G16, pinned to the tier that was left, keep running in CI on every change (D11). A skip needs a named reason and owner.
7. **Measure** the section 16 metrics for five trading days.

**Before shelving.** Decision D4 settles whether Report 1 and the economic-calendar export stay in the base or shelve with Stack D; the reader audit (1.6) shows what depends on them.

**Choosing Tier 2 or Tier 3.** Tier 3 is the cheapest, but the product loses its board. If Tier 2's measured load is acceptable, Tier 2 with Trendline gives both board and trend lines, and Tier 3 is kept for periods when resources must be at their lowest (D10).

## 12. Workstream 5: switching tiers and restoring

Every move between tiers follows one rule: going down, the profile changes before any chart; going up, the charts change before the profile. The collector therefore never requires a source that is not being produced, and restore is just a move up.

&#91;embedded content: allowed moves between tiers\]

| Move           | Procedure                                                                                                                              | Rollback                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1 → 2          | Workstream 3: Step 3A (model change, shadow, ADR, approval), then Step 3B (replay check, `core-v1`, one clean day, detach on B then A) | Reattach, one day, `full-v1`; old model too if 3A is undone |
| 1 → 3 or 2 → 3 | Workstream 4: consumers off; `ohlc-only-v1`; one clean day; detach on B then A                                                         | The matching move up                                        |
| 2 → 1          | Reattach the archived full templates; one trading day with extras ignored; `full-v1`; Rule 2 now allows other channels                 | Move down again by Step 3B                                  |
| 3 → 2          | Reattach the six-instance templates; one day; `core-v1`; sensors, SYN, Engine 4 on in that order, each through shadow                  | Back to Tier 3                                              |
| 3 → 1          | Reattach the full templates; one day; `full-v1`; consumers on in order through shadow; compare with the pinned golden scenarios        | Back to Tier 3                                              |

**Restore preconditions.** Davin decides to move up; the restore window avoids B3-style freezes; the archive for the target tier is at hand. Stack D tests and G01–G16 are green on the current main branch. If schema or base code moved since the tag, fix forward on main; never check out an old tag over newer code.

**The drill.** After any move down, run the matching move up once on a throwaway setup (a throwaway database and a terminal that is not A). Record how long it took and what the checklist missed, and fix the checklist. The move down counts as done only after the drill.

**What a move up does not need.** No migration and no backfill: Stack D's tables simply start receiving new rows. The gap while Stack D was off is visible by cycle time and profile stamp.

**Common to every move.** Davin approves the move and its timing. Terminal B moves before Terminal A and both are checked against the target profile. The switch happens at a cycle boundary. Section 16 metrics are recorded for five trading days afterwards. No move happens during the B3 freeze.

## 13. Workstream 6: Blueprint v2 amendments

Blueprint v2 assumes Stack D is always running. One more revision makes Trendline Context run on any tier; nothing else in it changes.

| Blueprint v2 section                         | What it assumes today                                                               | Amendment                                                                                                                                                        |
| -------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §1 Context, §2 principle                     | The SYN board always exists                                                         | Trendline runs on the shared base, on any tier, with or without a board                                                                                          |
| §9.1 Trigger                                 | `CycleReadyProcessor` (sensors) enqueues `trendline-context-cycle` after its commit | Enqueue from the base's cycle-ready event (2.2)                                                                                                                  |
| §9.2 Definitions                             | M5 bars from `market_data_v6`                                                       | Unchanged; note that every profile supplies them                                                                                                                 |
| §11.1, §12.1 ADR-025 rules                   | The board governs every reply                                                       | Add the two reply modes of Rule 4 (D2)                                                                                                                           |
| §12.1 Eval scenarios                         | Board says `SHORT` or `STAND_ASIDE`, reply keeps it                                 | Keep these for board mode; add no-board scenarios: analyst text says "pullback buy", the reply gives levels and the attributed view with no direction of its own |
| §13, §14, §16 Inventory, rollout, build plan | One guarded enqueue in `CycleReadyProcessor`; Stack D running during shadow         | Replace with the base event; Workstream 2 becomes a prerequisite of Trendline Phase 2                                                                            |

**What does not change.** The two-layer split, the exporter, the policy file, bar-space geometry, the uploader, the synchronous gateway, the three tables, the parameters T, T_drift and H_stale, the parser, the image rule, and decisions Q2, Q3, Q5 and Q9.

**How to apply.** The Advisor writes the revision and records it in the blueprint's header like the 2026-11-16 revisions, with Q1 re-opened for sign-off together with D2. The Phase 1 geometry check (§5.4) depends on none of this and can start as soon as Davin's desktop terminal is ready.

## 14. Immunization guardrails

These guardrails keep the base, Stack D and Trendline Context from affecting each other on any tier. Each is enforced by a test or a check, not by memory.

| #   | Guardrail                                                                            | Enforced by                                                                                           |
| --- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| G1  | Trendline code never imports or calls the sensors, SYN or Engine 4 modules           | A boundary test (lint rule or import scan) that fails the build                                       |
| G2  | The base never imports either consumer                                               | The same test, in the other direction                                                                 |
| G3  | No foreign key between Trendline and Stack D tables in either direction              | A schema check over both Prisma schemas in CI                                                         |
| G4  | With every consumer off, promotion, cycle-ready and the data-status stamp still work | An integration test on every change                                                                   |
| G5  | A failing consumer cannot fail promotion                                             | A test that forces each subscriber to throw                                                           |
| G6  | A consumer cannot run on a tier that refuses it                                      | Rule 1 startup check; refusal logged                                                                  |
| G7  | The active channel always exists in the profile                                      | Rule 2 on save and at startup                                                                         |
| G8  | Stack D code keeps compiling and passing on every tier                               | Its unit tests and G01–G16 in CI, pinned to the current Stack D model                                 |
| G9  | The analyst terminal never touches the data terminals                                | Trendline's exporter runs on Terminal C only (Blueprint v2 Q7); A and B carry no Trendline attachment |
| G10 | Nothing stale is shown as current                                                    | Rule 4: no-board mode ignores MCD and SYN rows regardless of age                                      |
| G11 | Resource drift is visible                                                            | Section 16 metrics logged daily, with an alert above an agreed CPU or memory threshold                |

**Daily monitoring on every tier.** Share of cycles FRESH; collector rejections and their reasons; VPS CPU and memory. A rejection naming a source outside the active profile means a template or profile slipped and is fixed the same day.

G6 and G7 add startup checks to the gateway and collector. They are not auth changes; anything that would touch the auth guard escalates to Davin.

## 15. Verification

Every tier change is proven by automated tests plus a comparison on real cycles. No change is accepted on reasoning alone.

| Test                     | What it proves                                                                                                            | When                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Profile completeness     | Each profile accepts its own complete set, rejects a set missing one required source, ignores extras                      | Every change                             |
| Profile stamping         | Every cycle carries the profile name beside `config_hash`                                                                 | Every change                             |
| Boundary switch          | A switch takes effect at the next cycle only                                                                              | Every change                             |
| Consumer gating          | Stack D consumers refuse `ohlc-only-v1`; Trendline registers on all three                                                 | Every change                             |
| Active-setting guard     | A setting outside the profile is refused on save and at startup                                                           | Every change                             |
| Base independence        | With every consumer off, promotion, cycle-ready and data status work; a throwing subscriber never fails promotion         | Every change                             |
| Reply modes              | Board mode keeps the board's verdict; no-board mode gives no direction, entry or sizing and says the board is unavailable | Every change                             |
| Import boundary          | G1 and G2                                                                                                                 | Every change                             |
| Golden scenarios G01–G16 | Stack D output for the current model                                                                                      | Every change; re-pinned only in Step 3A  |
| Tier 1 equivalence       | Workstream 2 changes nothing on `full-v1`                                                                                 | One shadow week, Workstream 2 exit       |
| Tier 2 model shadow      | Today's model vs `cherry_a` + `SR_Levels`, side by side                                                                   | Five trading days, Step 3A               |
| Tier 2 reduction replay  | `core-v1` reproduces live 3A outputs exactly                                                                              | Step 3B, before the switch               |
| Tier 3 clean run         | Promotion and data status unchanged with Stack D off                                                                      | One trading day, Workstream 4 step 2     |
| Restore drill            | A tier left behind can be raised again from the archive                                                                   | Once per tier left, on a throwaway setup |

## 16. Measurement and success criteria

Each tier is judged against the Tier 1 baseline from Workstream 1, taken on the same machine. None of these numbers has been measured yet; no saving is assumed.

| Metric                                     | Source                           | Tier 2 target                                         | Tier 3 target                |
| ------------------------------------------ | -------------------------------- | ----------------------------------------------------- | ---------------------------- |
| Terminal A CPU and memory                  | VPS, hourly                      | Set by Davin from the baseline (D13)                  | Lowest of the three          |
| VPS total CPU and memory, median and peak  | VPS, hourly                      | Lower, with headroom for Terminal C if it lives there | Lowest                       |
| Load per indicator instance                | Terminal A, once in Workstream 1 | Shows which removals pay                              | —                            |
| Export time: bar close to files written    | Collector log                    | Not slower                                            | Not slower                   |
| Promotion latency                          | Gateway log                      | Not slower                                            | Not slower                   |
| Share of cycles FRESH, market open         | Data-status stamp                | Equal or better                                       | Equal or better              |
| Rejections by reason                       | Collector log                    | None naming a dropped source                          | None naming a Stack D source |
| Database growth per day                    | PostgreSQL                       | Lower                                                 | Lowest                       |
| Model and tooling cost per day for Stack D | Usage metering                   | Unchanged                                             | Near zero                    |

A tier is "done" after five consecutive trading days, including a weekend, that meet its targets.

**Reading the results.** If Tier 2 saves little, the per-instance figures show whether the cost sits in the six kept instances or elsewhere, and Tier 3 is the real lever. If it saves a lot, Tier 2 with Trendline becomes the default operating point (D10).

## 17. Risks and mitigations

Two risks matter most: detaching indicators before the profile changes, which rejects every cycle, and treating Tier 2 as a load cut when it changes what the board says.

| Risk                                              | Effect                                   | Mitigation                                                                          |
| ------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------- |
| Indicator detached while still required           | Every cycle rejected or STALE            | Profile first, one clean day, then detach (section 12)                              |
| Tier 2 outputs worse than today                   | Weaker bias or zones reach users         | Step 3A side-by-side shadow; Davin approves before go-live; rollback is one setting |
| `cherry_a` repaints on closed bars                | Readings drift after the fact            | Drift test first in Step 3A; stop if it fails                                       |
| `sr_1`–`sr_3` come from `S_R_Levels`              | Zone confluence and invalidation change  | Verified before 3A; judged inside the 3A shadow                                     |
| A statistics input comes from a dropped indicator | MCD loses an input; cycles STALE         | Verified first; D8 keeps it or moves it server-side                                 |
| `draft-1` thresholds tuned to the old channels    | Rule hits shift                          | Davin reviews rule-hit differences (D9)                                             |
| Retune attempted on Tier 2                        | Every cycle STALE                        | Rule 2 refuses it                                                                   |
| Stack D enabled on Tier 3                         | Consumers run on missing inputs          | Rule 1 refuses registration                                                         |
| Hidden reader of a dropped source                 | A component breaks silently              | Reader audit (1.6); exact-match replay (3B)                                         |
| Old MCD or SYN rows shown as current              | Stale verdicts reach users               | Rule 4 and G10; a test with fresh-looking rows present                              |
| Stack D code rots on Tier 3                       | Restore fails or takes weeks             | G8 keeps tests in CI; restore drill                                                 |
| Base changes break Stack D assumptions            | Restore needs rework                     | Stack D tests run on every base change; fix forward on main                         |
| Trendline grows a quiet dependency on Stack D     | Tiers no longer isolate                  | G1 and G3 fail the build                                                            |
| Reply quality drops with no board                 | Users get less guidance                  | No-board mode says what is missing instead of filling the gap                       |
| Report 1 or the calendar depend on Stack D        | Report 1 changes unexpectedly on Tier 3  | D4 decided before shelving                                                          |
| Consent records altered                           | Legal record broken                      | No change to `trade_consent_records`; trigger and retention stay                    |
| Mixed-tier history pooled in analysis             | Misleading statistics                    | Profile stamp on every cycle; analyses filter by it                                 |
| Terminal B diverges from A                        | Failover delivers a different source set | B moves first and is checked against the same profile                               |

## 18. Decisions for Davin

Thirteen decisions, in the order they are needed. **D2 is decided first**, then D1 and D3; the rest follow their phase.

| #   | Decision                                                                    | Recommendation                                                                                                               | Needed by                                           |
| --- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| D2  | Reply behaviour per tier                                                    | Board mode on Tiers 1–2; no-board mode on Tier 3 (no direction, entry or sizing). One ADR, signed off with Blueprint v2's Q1 | P0; Workstream 2.5, Workstream 6, Trendline Phase 4 |
| D1  | Adopt the three-tier model with profiles owned by the base                  | Yes; Tier 1 stays active until each step is approved                                                                         | P0                                                  |
| D3  | OHLC in `ohlc-only-v1`                                                      | M5 always; M15 only if the reply layer's OHLC window uses it                                                                 | P0                                                  |
| D11 | Stack D tests stay required in CI on every tier                             | Yes; a skip needs a named reason and owner                                                                                   | P1                                                  |
| D13 | Resource targets per tier                                                   | Set from the Workstream 1 baseline                                                                                           | P1                                                  |
| D7  | `cherry_a` parameters on M15 and M5                                         | Davin sets them; they enter `config_hash`                                                                                    | P3, Step 3A                                         |
| D8  | A statistics input from a dropped indicator: keep it or compute server-side | Decide after verification; prefer keeping one indicator over new server code                                                 | P3, Step 3A                                         |
| D9  | Accept the Tier 2 outputs, including any `draft-1` retune                   | Only after the five-day side-by-side shadow; retuning is Davin's alone                                                       | P3, Step 3A go-live                                 |
| D10 | Default operating tier                                                      | Tier 2 with Trendline if the saving is enough; Tier 3 when resources must be lowest                                          | P5                                                  |
| D4  | Report 1 and the economic-calendar export on Tier 3                         | Decide after the reader audit; keep the calendar if any non-Stack D reply uses it                                            | Before Tier 3                                       |
| D5  | Terminal B on lower tiers                                                   | Stays hot standby on the same template as A                                                                                  | Before any detach                                   |
| D6  | Where Terminal C (Trendline) lives                                          | As Blueprint v2 Q7: VPS after B3 if the measured headroom allows, else Davin's desktop                                       | Trendline Phase 5                                   |
| D12 | What "restore" means for the rules table                                    | Restore the pinned `draft-1` version unchanged; any rules change is separate                                                 | Any restore                                         |

## 19. Sequenced plan

The work runs in six gated phases, P0 to P5. Trendline Context starts alongside as soon as P2 gives the base its own cycle-ready event, and the Blueprint v2 revision can start as soon as D2 is decided.

&#91;embedded content: phases P0–P5 with the work that runs alongside\]

| Phase               | Workstream | Can start before B3 clears?                                          | Exit gate                                     |
| ------------------- | ---------- | -------------------------------------------------------------------- | --------------------------------------------- |
| P0 Decide           | —          | Yes                                                                  | D2, D1, D3 recorded; section 20 items checked |
| P1 Close out        | 1          | Partly: archive and audit yes; B3 result and baseline need B3 to end | Checkpoint recorded                           |
| P2 Shared mechanism | 2          | Code yes; deployment no                                              | One shadow week, Tier 1 output unchanged      |
| P3 Step 3A          | 3          | No                                                                   | New outputs approved (D9)                     |
| P4 Step 3B          | 3          | No                                                                   | Five days meeting Tier 2 targets              |
| P5 Operating tier   | 4, 5       | No                                                                   | D10 decided; drill passed for any tier left   |

Each gate is passed only on Davin's word.

## 20. Assumptions and items not yet verified

This blueprint was written from the Stack D architecture document, Blueprint v2 and design discussion, not from the live code. The Executor confirms each item before the step that depends on it.

- [ ] **1. Collector rule.** The collector rejects a cycle when any expected source is missing, and that list can move into configuration without a rewrite. (Workstream 2.1)
- [ ] **2. `cherry_a` as a valid source.** Whether `cherry_a` is already one of the valid sources of `active_indicator_settings` (eight today, including `fractal_edt`), on both M15 and M5. (Step 3A)
- [ ] **3. Where `sr_1`–`sr_3` come from.** Which indicator supplies the structural levels for zone confluence and invalidation, and whether any come from `S_R_Levels`. (Step 3A)
- [ ] **4. Statistics inputs.** Which indicator or server step produces the SSA and channel statistics MCD reads per timeframe, and whether all survive in `core-v1`. (Steps 3A and 3B, D8)
- [ ] **5. Readers of Stack D sources and outputs.** Including Report 1, dashboards and the monolith's packet builder. (Workstream 1.6)
- [ ] **6. Where cycle-ready is raised.** Whether the promotion step can emit the event, or it is raised inside the sensors path. (Workstream 2.2)
- [ ] **7. Flag names and defaults** for sensors, SYN, Engine 4 and the reply layer's MCD reading. (Workstream 2.3)
- [ ] **8. `draft-1` and the channel.** Whether any rule threshold assumes the characteristics of `non_b` or `best_fit_a`. (Step 3A, D9)
- [ ] **9. Where the load is.** That the indicators, not OHLC export or promotion, are the main cost. (Workstream 1.6)
- [ ] **10. Terminal B.** That B can run each tier's template and still take over from A. (D5)
- [ ] **11. Reply OHLC window.** Which timeframes it uses. (D3)
- [ ] **12. Stack D-only services.** Which NSSM services and workers serve only Stack D. (Workstream 4)
- [ ] **13. Blueprint v2 open checks.** `cycle_slot` open or close time, bar-space geometry and the M5 bar clock (§17 of that blueprint) are unaffected here but still gate Trendline Phases 1 and 2.

## 21. Document history

This blueprint merges two plans written on 2026-11-17. They stay readable for history but are no longer maintained; where they differ, this document is the reference.

| Earlier document | Its part                                 | Where it is now                                                                               |
| ---------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| Shelving plan    | §1 Status, §3 principles                 | Sections 1, 4                                                                                 |
| Shelving plan    | §4 Workstream A: close out               | Workstream 1 (section 8)                                                                      |
| Shelving plan    | §5 Workstream B: shared base             | Workstream 2 (section 9), widened to all three profiles                                       |
| Shelving plan    | §6 Workstream C: shelve                  | Workstream 4 (section 11), now from Tier 1 or 2                                               |
| Shelving plan    | §7 Workstream D: guardrails              | Section 14 (D-1…D-10 renumbered G1…G11)                                                       |
| Shelving plan    | §8 Workstream E: restore                 | Workstream 5 (section 12), generalised to every tier move                                     |
| Shelving plan    | §9 Workstream F: Blueprint v2 amendments | Workstream 6 (section 13), now for board and no-board modes                                   |
| Shelving plan    | §12 Decisions SD1–SD8                    | Section 18: SD1 → D2, SD2 → D3, SD3 → D4, SD4 → D5, SD5 → D6, SD6 → D11, SD7 → D12, SD8 → D13 |
| Three-tier model | §1–§6 Tiers, profiles, Tier 2, rules     | Sections 1, 3, 5, 6, 7                                                                        |
| Three-tier model | §7 Workstream 1                          | Workstream 2 (section 9)                                                                      |
| Three-tier model | §8 Steps 2A, 2B                          | Workstream 3, Steps 3A, 3B (section 10)                                                       |
| Three-tier model | §10 Switching                            | Workstream 5 (section 12)                                                                     |
| Three-tier model | §14 Decisions T1–T8                      | Section 18: T1 → D1, T2 → D2, T3 → D3, T4 → D7, T5 → D8, T6 → D9, T7 → D10, T8 → D13          |

**Changed while merging.** One close-out (Workstream 1) now serves every tier; the reader audit and baseline moved into it. The tier ADR replaces the separate shelving ADR. Phases are renumbered P0–P5 (section 19).

| Date       | Change                               |
| ---------- | ------------------------------------ |
| 2026-11-17 | First version, merging the two plans |
