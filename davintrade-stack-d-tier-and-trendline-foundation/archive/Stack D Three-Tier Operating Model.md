# Stack D Three-Tier Operating Model

Nov 17, 2026 · @Davin

**Superseded on 2026-11-17 by Stack D Tiers and Trendline Foundation Blueprint.** Kept for history only; do not work from this document.

## 1. Status, purpose and the three tiers

Stack D will run at one of three tiers, chosen by a single collector setting, and Trendline Context runs on all three. This is a draft design for Davin's approval. It is not an order, and nothing in it has been built or run.

| Tier      | Collector profile | MT5 chart instances                                    | Stack D                    | Trendline Context | SYN board |
| --------- | ----------------- | ------------------------------------------------------ | -------------------------- | ----------------- | --------- |
| 1 Full    | `full-v1`         | Today's set: 15 indicators across M15 and M5           | Runs, unchanged            | Can run           | Yes       |
| 2 Lite    | `core-v1`         | 6: OHLC, `cherry_a`, `SR_Levels` on each of M15 and M5 | Runs, with a changed model | Can run           | Yes       |
| 3 Shelved | `ohlc-only-v1`    | M5 OHLC (plus M15 OHLC if needed)                      | Off, restorable            | Can run           | No        |

**Purpose.** Cut the MT5 and VPS load of Stack D without losing it, and give a clean base for Trendline Context. Tier 1 is today's system. Tier 2 keeps Stack D running on the instances it most needs. Tier 3 parks Stack D and keeps only the shared base.

**What a tier is.** A tier is the collector's active source profile plus the consumer flags allowed with it. The profile belongs to the shared base, not to Stack D. Stack D needs Tier 1 or 2 to run; Trendline Context needs only M5 OHLC and the cycle-ready signal, which every tier provides.

**Related documents.** Tier 3's procedure is in Stack D Shelving and Trendline Foundation Plan. Workstream B of that plan (source profiles and a cycle-ready signal owned by the base) is the same work as Workstream 1 here and is built once. Also `docs/STACK-D-ARCHITECTURE.md` and `TRENDLINE-CONTEXT-BLUEPRINT-V2.md`.

**Out of scope.** Deleting anything, changing the content of the SYN rules table, production migrations, credentials and deployments (those stay with Davin), and the Trendline build itself.

**Binding non-negotiables.** No real infrastructure address or credential in tracked files. Money, auth, secrets and CORS changes escalate to Davin. The Executor never applies a production migration, never enters credentials, and commits or pushes only when asked. Windows checkout with CRLF; `git stash` is never used. Every VPS and live-database step waits until Stage B3 has cleared.

## 2. Before you start

Any agent or person picking up this work reads these six points first. The first three can break the live pipeline or change trading output if missed.

1. **Tier 2 is a model change, not only a load cut.** It switches the active channel on both timeframes (M15 `non_b` → `cherry_a`, M5 `best_fit_a` → `cherry_a`) and drops `S_R_Levels`. MCD1, MCD2, SYN and the entry zones will produce different numbers. It needs its own ADR, re-pinned golden scenarios and Davin's approval of the new outputs.
2. **Profile first, indicators second.** The collector rejects a whole cycle when a required source is missing. Never detach an indicator while the active profile still requires it. Every move down a tier switches the profile and runs one clean trading day before any chart is touched (section 10).
3. **Change one thing at a time.** Tier 2 is adopted in two steps: first switch the active channel to `cherry_a` with all 15 indicators still running (fully reversible), then reduce to six instances (section 8).
4. **Trendline Context does not need Tier 3.** It runs on any tier. Its reply mode follows the tier: with a board on Tiers 1 and 2, without one on Tier 3 (section 6).
5. **Where to begin.** Start at phase P0 in section 15, then Workstream 1 (section 7). Check the section 16 item a step depends on before running that step.
6. **What you may not do.** Delete tables or rows, apply production migrations, enter credentials, commit or push unasked, change the SYN rules table, or touch Terminal A, the VPS or the live database before Stage B3 clears.

## 3. The tier model

The collector's active profile is the only switch between tiers; the base, Trendline Context and the reply layer run on every tier, and only Stack D needs Tier 1 or 2.

&#91;embedded content: three tiers on one shared base\]

Tier 2 is highlighted because it is the only tier that changes trading output (section 5). Tier 3 is dashed because Stack D is off there.

## 4. Source profiles

A source profile is a versioned list of the sources the collector requires for a cycle to be complete. Exactly one profile is active at a time, and that setting is what defines the tier.

**Today.** The required sources are effectively fixed in code: if any of them is missing, the collector rejects the cycle. That rule stays; only the list becomes configuration.

**Specification.**

- **Definition.** Each profile is a named, versioned, tracked configuration file: `full-v1`, `core-v1`, `ohlc-only-v1`. It lists, per timeframe, the required sources by the names the collector already uses, and the chart template that produces them.
- **Immutability.** A published profile version never changes. A change is a new version (`core-v2`), so any stored cycle can be explained by the profile it names.
- **Completeness rule.** A cycle is complete when every source in the active profile is present and valid. Extra sources not in the profile are ignored, not rejected, and are not promoted. A missing required source rejects the cycle exactly as today.
- **Stamping.** Every cycle record stores the active profile name beside `config_hash`. History therefore shows which tier produced which cycle.
- **Switching.** The active profile is one setting, changed only by Davin or on his word. A switch takes effect at the next cycle boundary, never mid-cycle, and is logged with the old and new names.
- **Startup check.** At startup the collector and the gateway verify that the active profile exists and that every enabled consumer is allowed on it (section 6). On a mismatch they refuse to register that consumer and log why; the base keeps running.

**Profile contents.**

| Profile        | M15 required                                                                   | M5 required                                                        |
| -------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `full-v1`      | Today's full M15 set                                                           | Today's full M5 set                                                |
| `core-v1`      | OHLC, `cherry_a`, `SR_Levels`, and the statistics inputs MCD needs (section 5) | OHLC, `cherry_a`, `SR_Levels`, and the statistics inputs MCD needs |
| `ohlc-only-v1` | OHLC only if the reply layer's window needs it (decision T3)                   | OHLC                                                               |

`full-v1` is generated from today's collector list, unchanged, so adopting profiles at Tier 1 changes no behaviour.

## 5. Tier 2: `core-v1`

Tier 2 runs six chart instances, three per timeframe, and keeps every Stack D stage. It differs from today in two places that change trading output.

| Timeframe | OHLC | Channel    | Support and resistance |
| --------- | ---- | ---------- | ---------------------- |
| M15       | OHLC | `cherry_a` | `SR_Levels`            |
| M5        | OHLC | `cherry_a` | `SR_Levels`            |

**Why `cherry_a`.** Davin's choice: of the centroid channels, `cherry_a` is the most flexible in use. One channel family on both timeframes also makes the configuration simpler to reason about.

### Change 1: the active channel

|             | Today        | Tier 2     | Affected outputs                                                                                                           |
| ----------- | ------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| M15 channel | `non_b`      | `cherry_a` | MCD1 (M15 primary trend) and anything SYN takes from it                                                                    |
| M5 channel  | `best_fit_a` | `cherry_a` | MCD2 (M5 corridor), entry-zone sources and half-width (10% of the channel width), invalidation distances and runway ratios |

The `cherry_a` parameters on each timeframe become part of `config_hash`, so a later parameter change is visible in history.

### Change 2: one support and resistance set

Tier 2 keeps `SR_Levels` and drops `S_R_Levels` on both timeframes. If the structural levels used for zone confluence and invalidation (the `sr_1`, `sr_2`, `sr_3` levels) come wholly or partly from `S_R_Levels`, zones change. Section 16 lists this as the first item to verify.

### What Tier 2 still needs beyond the six instances

- **Statistics inputs.** The SSA and channel statistics per timeframe that MCD reads. If any is produced by an indicator outside the six, either keep that indicator in `core-v1` (adding an instance) or move the calculation server-side. Not decided until verified.
- **Control inputs.** `cycle_slot` / `stats_slot`, data status, RETUNING, the active setting and `config_hash`: unchanged.
- **MCD0 and MCD3.** Unchanged in logic; they run on whatever the profile supplies.

### What Tier 2 gives up

- **Retuning to another channel.** With only `cherry_a` on the charts, `active_indicator_settings` can no longer switch to `non_b`, `best_fit_a` or any other variant. Going back means moving to Tier 1 first.
- **Comparability with Tier 1 history.** Readings before and after the switch come from different channels. The profile name on each cycle keeps them distinguishable; analyses must not pool them blindly.

## 6. Tier rules

Four rules keep the tiers consistent. Each is enforced by code at startup or at the cycle boundary, not by memory.

### Rule 1: consumers allowed per tier

| Consumer                  | `full-v1` | `core-v1` | `ohlc-only-v1`         |
| ------------------------- | --------- | --------- | ---------------------- |
| Stack D sensors MCD0–MCD3 | Allowed   | Allowed   | Refused                |
| SYN and entry zones       | Allowed   | Allowed   | Refused                |
| Engine 4 and Report 2     | Allowed   | Allowed   | Refused                |
| Trendline Context         | Allowed   | Allowed   | Allowed                |
| Reply layer               | Allowed   | Allowed   | Allowed, no-board mode |

A consumer flag set on a tier that refuses it is not registered; the base keeps running and the refusal is logged.

### Rule 2: the active channel must exist in the profile

`active_indicator_settings` may select only a channel the active profile supplies. On `core-v1` that is `cherry_a` on both timeframes. A setting that points elsewhere is refused when saved, and the startup check refuses Stack D if the stored setting no longer matches the profile. Without this rule, a retune on Tier 2 would make every cycle STALE.

### Rule 3: one tier per cycle

The profile switches only at a cycle boundary. A cycle is computed entirely under one profile and one active setting, and both are stamped on it.

### Rule 4: reply mode follows the tier

- **Board mode (Tiers 1 and 2).** Blueprint v2's ADR-025 rules apply as written: bias, archetype and stand-aside come only from the SYN board; Trendline content is attributed context; when they conflict, the reply states both and the board governs.
- **No-board mode (Tier 3).** No direction, entry or sizing. The reply gives price levels, line facts, policy age and the analyst's view with its source named, and says plainly that no board verdict is available. (Decision SD1 of the shelving plan.)
- **Selection is automatic.** The reply layer reads the Stack D flag and the active profile at request time; nobody chooses the mode by hand. One ADR covers both modes.

## 7. Workstream 1: build the shared mechanism

Workstream 1 adds the tier machinery while the system stays on Tier 1, so it changes no output. It is the same work as Workstream B of the shelving plan and is built once.

**1.1 Baseline and audit (before any code).**

- Record the resource baseline in section 12 for at least five trading days on Tier 1.
- Measure the load of each indicator instance on Terminal A, so the expected saving of Tiers 2 and 3 is known before either is adopted.
- Audit every reader of each Stack D source and output: the indicator tables, `mcd_outputs`, `synthesis_readings`, `entry_zones`, the reply layer, Report 1, dashboards and the monolith's packet builder. The result is a table of source → readers, kept in the repository.

**1.2 Source profiles in the collector.** Implement section 4: profile files, the completeness rule against the active profile, stamping of the profile name on each cycle, boundary-only switching and the startup check. Ship `full-v1` generated from today's list and make it active.

**1.3 Cycle-ready owned by the base.** Raise the cycle-ready event from the promotion step that writes `market_data_v6`, not from the sensors module. Stack D and Trendline subscribe behind their own flags. A failing subscriber can only log; it can never fail promotion.

**1.4 Consumer gating.** Implement Rule 1 of section 6: each consumer checks the active profile at startup and refuses to register on a tier that does not allow it.

**1.5 Active-setting guard.** Implement Rule 2: saving an `active_indicator_settings` value outside the active profile is refused, and the startup check catches a stored mismatch.

**1.6 Reply modes.** Implement Rule 4 behind its own flag, with board mode as the default. No-board mode is exercised only in tests until Tier 3 is used.

**1.7 Draft the other two profiles.** Write `core-v1` and `ohlc-only-v1` as files but do not activate them.

**Exit criteria.** All of the above merged behind flags, Tier 1 still active, every Stack D test and golden scenario G01–G16 unchanged and green, and one shadow week showing identical cycles and outputs to the pre-change baseline.

## 8. Workstream 2: adopt Tier 2 in two steps

Tier 2 is reached by changing the model first, with everything still running, and removing instances only after the new model is accepted. Each step can be undone on its own.

### Step 2A: switch the channel, keep all indicators

Prerequisites: Workstream 1 done; Stage B3 cleared; section 16 items 1 to 4 verified.

1. **Make `cherry_a` selectable.** If it is not already one of the valid sources in `active_indicator_settings`, add it to the schema, the DTO and the collector's source names (a migration Davin applies). Fix its parameters per timeframe and include them in `config_hash`.
2. **Repaint check.** Run the same drift test used for the other channels (two captures days apart over the same closed bars) on `cherry_a` for M15 and M5. Closed-bar values must be stable under ADR-011; if not, stop.
3. **Write the ADR** for the channel change and the `S_R_Levels` drop together, with the reasons and the expected effects on MCD1, MCD2 and zones.
4. **Shadow side by side.** For at least five trading days including a weekend, compute every cycle twice: the live path on today's channels, and a shadow path with `cherry_a` as the active channel and SR_Levels as the only support and resistance set, so both model changes are judged here and Step 2B changes no output. Store the shadow results apart; they never reach users.
5. **Compare and review.** Cycle by cycle: MCD1 and MCD2 readings, SYN rule hits and bias, zone sources, widths, invalidation and runway. Davin reviews the differences and decides whether `draft-1` thresholds need retuning (his call alone).
6. **Re-pin golden scenarios.** Regenerate expected values for G01–G16 under `cherry_a`, each changed value with a one-line reason.
7. **Go live on the new channel.** Set the active channel to `cherry_a` on both timeframes and stop reading S_R_Levels, still on `full-v1`. Rollback = set the old channels back; nothing has been removed.

### Step 2B: reduce to six instances

Prerequisites: Step 2A live for at least five clean trading days; the `S_R_Levels` and statistics-input checks (section 16) passed.

1. **Prove the drop.** Replay stored cycles through the `core-v1` source set: outputs must match the live 2A outputs exactly. Any difference means a hidden reader of a dropped source; stop and fix it.
2. **Switch the profile** to `core-v1` at a cycle boundary. Run one clean trading day: every cycle complete and FRESH outside closures.
3. **Lock the setting.** Rule 2 now restricts the active channel to `cherry_a`.
4. **Detach the other instances** on Terminal B first, then Terminal A, loading the six-instance chart templates. Archive the removed templates and inputs with the shelving plan's archive.
5. **Measure** the section 12 metrics for five trading days.

**Rollback of 2B.** Reattach the archived templates, let the extra files appear for a trading day, then set `full-v1` again. The active channel stays `cherry_a` unless 2A is also rolled back.

## 9. Workstream 3: Tier 3

Tier 3 is the shelving plan carried out on top of this mechanism. That plan's Workstreams A, C and E (close-out, shelving and the restore drill) apply as written; its Workstream B is Workstream 1 here.

**What Tier 3 adds to the tier model.**

- The active profile is `ohlc-only-v1`. Rule 1 refuses every Stack D consumer; the base, Trendline Context and the reply layer keep running.
- The reply layer is in no-board mode (Rule 4).
- Tier 3 can be entered from Tier 1 or Tier 2. From Tier 2 the archive holds the six-instance templates and the `cherry_a` settings; from Tier 1 it holds the full set. The restore drill uses whichever tier was left.

**What stays true on Tier 3.** No Stack D table is dropped or emptied. `trade_consent_records` keeps its seven-year retention and its append-only trigger. Stack D tests and golden scenarios keep running in CI against the tier they were last pinned to.

**Choosing between Tier 2 and Tier 3.** Tier 3 is the cheapest, but the product loses its board. Tier 2 keeps the board at a cost the section 12 measurements will show. If Tier 2's load is acceptable, running Tier 2 with Trendline Context gives both the board and the trend lines; Tier 3 is then kept for periods when resources must be at their lowest.

## 10. Switching between tiers

Every move between tiers follows one rule: going down, the profile changes before any chart; going up, the charts change before the profile. Either way the collector never requires a source that is not being produced.

&#91;embedded content: allowed moves between tiers\]

| Move           | Procedure                                                                                                                                    | Rollback                                                            |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1 → 2          | Step 2A (channel to `cherry_a`, shadow, ADR, approval), then Step 2B (replay check, profile `core-v1`, one clean day, detach on B then A)    | Reattach, one day, `full-v1`; set old channels if 2A is also undone |
| 1 → 3 or 2 → 3 | Shelving plan Workstream C: Engine 4, SYN, sensors off; profile `ohlc-only-v1`; one clean day; detach on B then A                            | The 3 → 1 or 3 → 2 procedure                                        |
| 2 → 1          | Reattach the archived full templates; one trading day with extra files ignored; profile `full-v1`; Rule 2 now allows other channels          | Back down by 1 → 2 Step 2B                                          |
| 3 → 2          | Reattach the six-instance templates; one day; profile `core-v1`; sensors, SYN, Engine 4 on in that order, each through shadow                | Back to Tier 3                                                      |
| 3 → 1          | Reattach the full templates; one day; profile `full-v1`; consumers on in order through shadow; compare with the last pinned golden scenarios | Back to Tier 3                                                      |

**Common to every move.** Davin approves the move and its timing. Terminal B moves before Terminal A, and both are checked against the target profile. The switch happens at a cycle boundary. The section 12 metrics are recorded for five trading days after the move. No move happens during the B3 freeze.

## 11. Verification

Every tier change is proven by automated tests plus a shadow comparison on real cycles. No change is accepted on reasoning alone.

| Test                     | What it proves                                                                                                                                   | When it runs                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| Profile completeness     | Each profile accepts its own complete set, rejects a set missing one required source, ignores extra sources                                      | Every change                             |
| Profile stamping         | Every cycle record carries the profile name beside `config_hash`                                                                                 | Every change                             |
| Boundary switch          | A switch mid-cycle takes effect at the next cycle only                                                                                           | Every change                             |
| Consumer gating          | Each Stack D consumer refuses to register on `ohlc-only-v1`; Trendline registers on all three                                                    | Every change                             |
| Active-setting guard     | A setting outside the active profile is refused on save and at startup                                                                           | Every change                             |
| Base independence        | With every consumer off, promotion, cycle-ready and the data-status stamp still work; a throwing subscriber never fails promotion                | Every change                             |
| Reply modes              | Board mode on Tiers 1–2 keeps the board's verdict; no-board mode on Tier 3 gives no direction, entry or sizing and says the board is unavailable | Every change                             |
| Import boundary          | Trendline code never imports Stack D modules; the base imports neither                                                                           | Every change                             |
| Golden scenarios G01–G16 | Stack D output for the pinned tier                                                                                                               | Every change; re-pinned only in Step 2A  |
| Tier 1 equivalence       | Adding profiles changes nothing on `full-v1`                                                                                                     | One shadow week, Workstream 1 exit       |
| Tier 2 model shadow      | Side-by-side outputs of today's channels vs `cherry_a` + `SR_Levels`                                                                             | Five trading days, Step 2A               |
| Tier 2 reduction replay  | `core-v1` source set reproduces live 2A outputs exactly                                                                                          | Step 2B, before the switch               |
| Restore drill            | A tier can be raised again from the archive                                                                                                      | Once per tier left, on a throwaway setup |

## 12. Measurement and success criteria

The tiers exist to save resources, so each is judged against a Tier 1 baseline taken on the same machine. None of these numbers has been measured yet; no saving is assumed.

| Metric                                    | Source            | Tier 1 baseline | Tier 2 target                                             | Tier 3 target                |
| ----------------------------------------- | ----------------- | --------------- | --------------------------------------------------------- | ---------------------------- |
| Terminal A CPU and memory                 | VPS, hourly       | Measure         | Set by Davin from the baseline                            | Lowest of the three          |
| VPS total CPU and memory, median and peak | VPS, hourly       | Measure         | Lower, with headroom for Terminal C if it will live there | Lowest                       |
| Load per indicator instance               | Terminal A, once  | Measure         | Shows which removals pay                                  | —                            |
| Export time: bar close to files written   | Collector log     | Measure         | Not slower                                                | Not slower                   |
| Promotion latency                         | Gateway log       | Measure         | Not slower                                                | Not slower                   |
| Share of cycles FRESH, market open        | Data-status stamp | Measure         | Equal or better                                           | Equal or better              |
| Rejections by reason                      | Collector log     | Measure         | None naming a dropped source                              | None naming a Stack D source |
| Database growth per day                   | PostgreSQL        | Measure         | Lower                                                     | Lowest                       |

Each tier is "done" after five consecutive trading days, including a weekend, that meet its targets.

**Deciding between tiers.** If Tier 2's saving is small, the per-instance figures show whether the cost sits in the six kept instances or elsewhere; Tier 3 is then the real lever. If the saving is large, Tier 2 plus Trendline becomes the default operating point.

## 13. Risks and mitigations

The highest-impact risk is treating Tier 2 as a load cut when it changes what the board says.

| Risk                                              | Effect                                   | Mitigation                                                                                          |
| ------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Tier 2 outputs worse than today                   | Weaker bias or zones reach users         | Step 2A side-by-side shadow; Davin approves the new outputs before go-live; rollback is one setting |
| `cherry_a` repaints on closed bars                | Readings drift after the fact            | Drift test in Step 2A before anything else; stop if it fails                                        |
| `sr_1`–`sr_3` come from `S_R_Levels`              | Zone confluence and invalidation change  | Verified first (section 16); judged inside the 2A shadow, not discovered in 2B                      |
| A statistics input comes from a dropped indicator | MCD loses an input; cycles STALE         | Verified first; keep that indicator in `core-v1` or compute server-side                             |
| `draft-1` thresholds tuned to the old channels    | Rule hits shift                          | Davin reviews rule-hit differences in the shadow and decides any retune                             |
| Indicator detached while still required           | Every cycle rejected                     | Profile first, one clean day, then detach (section 10)                                              |
| Retune attempted on Tier 2                        | Every cycle STALE                        | Rule 2 refuses the setting                                                                          |
| Stack D enabled on Tier 3                         | Consumers run on missing inputs          | Rule 1 refuses registration at startup                                                              |
| Hidden reader of a dropped source                 | A component breaks silently              | Reader audit in 1.1; exact-match replay in 2B                                                       |
| Mixed-tier history pooled in analysis             | Misleading statistics                    | Profile name stamped on every cycle; analyses filter by it                                          |
| Terminal B diverges from A                        | Failover delivers a different source set | B always moved first and checked against the same profile                                           |

## 14. Decisions for Davin

Eight decisions shape the tier model. **T1 and T2 come first:** T1 approves the model itself, and T2 decides how replies behave on each tier, which the shelving plan also depends on.

| #   | Decision                                                                             | Recommendation                                                                                   | Blocks                         |
| --- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------ |
| T1  | Adopt the three-tier model with profiles owned by the base                           | Yes; Tier 1 stays active until each step is approved                                             | Workstream 1                   |
| T2  | Reply behaviour per tier (board mode and no-board mode)                              | As Rule 4; one ADR for both modes, signed off with Blueprint v2's Q1 and the shelving plan's SD1 | Reply layer, Trendline Phase 4 |
| T3  | Which OHLC goes into `ohlc-only-v1`                                                  | M5 always; M15 only if the reply layer's OHLC window uses it                                     | Tier 3                         |
| T4  | `cherry_a` parameters on M15 and M5                                                  | Davin sets them; they enter `config_hash`                                                        | Step 2A                        |
| T5  | If a statistics input comes from a dropped indicator: keep it or compute server-side | Decide after verification; prefer keeping one indicator over new server code                     | Step 2B                        |
| T6  | Accept Tier 2's outputs, including any `draft-1` retune                              | Only after the five-day side-by-side shadow; retuning is Davin's alone                           | Step 2A go-live                |
| T7  | Default operating tier once Tier 2 is proven                                         | Tier 2 with Trendline if the measured saving is enough; Tier 3 when resources must be lowest     | Long-term operation            |
| T8  | Resource targets per tier                                                            | Set from the Tier 1 baseline                                                                     | Section 12                     |

## 15. Sequenced plan

Tier 2 is reached in four gated phases after P0, and Trendline work can start as soon as P1 gives the base its own cycle-ready event.

&#91;embedded content: phases P0–P4 with the work that runs alongside\]

Each gate is passed only on Davin's word. P1 changes no output and can be built before Stage B3 clears; P2 onward touches Terminal A and the live pipeline and waits for B3. Tier 3 is optional and follows the shelving plan from whichever tier is running.

## 16. Assumptions and items not yet verified

This design was written from the Stack D architecture document, Blueprint v2 and design discussion, not from the live code. The Executor confirms each item against the code before the step that depends on it.

- [ ] **1. Collector rule.** The collector rejects a cycle when any expected source is missing, and that list can move into configuration without a rewrite. (Workstream 1)
- [ ] **2. `cherry_a` as a valid source.** Whether `cherry_a` is already one of the valid sources of `active_indicator_settings` (eight today, including `fractal_edt`), on both M15 and M5. (Step 2A)
- [ ] **3. Where `sr_1`–`sr_3` come from.** Which indicator supplies the structural levels used for zone confluence and invalidation, and whether any of them come from `S_R_Levels`. (Step 2A)
- [ ] **4. Statistics inputs.** Which indicator or server step produces the SSA and channel statistics MCD reads per timeframe, and whether all of them survive in `core-v1`. (Step 2A)
- [ ] **5. Readers of Stack D sources.** Every component that reads the indicator tables or Stack D outputs, including Report 1, dashboards and the monolith's packet builder. (Workstream 1.1)
- [ ] **6. Where cycle-ready is raised.** Whether the promotion step can emit the event today, or it is raised inside the sensors path. (Workstream 1.3)
- [ ] **7. Flag names and defaults.** The actual flags for sensors, SYN, Engine 4 and the reply layer's MCD reading. (Workstream 1.4)
- [ ] **8. `draft-1` and the channel.** Whether any rule threshold assumes the characteristics of `non_b` or `best_fit_a`. (Step 2A review)
- [ ] **9. Where the load is.** That the indicators, not OHLC export or promotion, are the main cost; the per-instance measurement confirms it. (Section 12)
- [ ] **10. Terminal B.** That B can run each tier's chart template and still take over from A. (Steps 2B, Tier 3)
- [ ] **11. Reply OHLC window.** Which timeframes the compact OHLC window uses. (Decision T3)

The prerequisites of Step 2A in section 8 refer to items 1 to 4 of this list.
