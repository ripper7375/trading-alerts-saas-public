# Stack D — Architecture

|                     |                                                                                                                                                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**          | Canonical. Version 1.0, 30 September 2026                                                                                                                                                                                                                           |
| **Owner**           | Davin (approver of every change)                                                                                                                                                                                                                                    |
| **Decisions**       | [`docs/adr/`](adr/README.md): entries 001–083, all settled ([ADR-015](adr/015-retuning-during-a-promote.md) settled 1 Oct 2026)                                                                                                                                     |
| **Building an MCD** | [MCD-DEVELOPMENT-STANDARD.md](MCD-DEVELOPMENT-STANDARD.md) (ADR-082), in the order given by [MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md](MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md); the MCD registry is §2.13                                                         |
| **For Davin**       | [STACK-D-BUILD-USER-MANUAL.md](STACK-D-BUILD-USER-MANUAL.md): the build steps from his side, with the prompt to paste for each                                                                                                                                      |
| **Built from**      | The eight decks `STACK-D-REVISED-ARCHITECTURE-00` to `-07` in `davintrade-stack-d-and-e/`, and the review [`STACK-D-ARCHITECTURE-REVIEW-AND-RECOMMENDATIONS.md`](../davintrade-stack-d-and-e/archive/STACK-D-ARCHITECTURE-REVIEW-AND-RECOMMENDATIONS.md) (archived) |
| **Supersedes**      | The eight earlier Stack D documents, now in [`davintrade-stack-d-and-e/archive/`](../davintrade-stack-d-and-e/archive/), and the 103-column reference for architecture questions only (see [Appendix C](#appendix-c--superseded-documents))                         |

Stack D is DavinTrade's conversational AI for XAUUSD on M5 and M15: market data and MCD sensors
on a 5-minute clock, and on each user question a checked Report 1 (analysis) and, when it is safe
to size, a Report 2 (a single-order trade setup).

---

## How to use this document

- **One owner per fact.** Each rule has one owning chapter. Other chapters may repeat it briefly for
  readability, but always cite the owner. If two places seem to disagree, the owning chapter wins,
  and the other is a bug in this document.
- **Source letters.** "File A" to "file I" name the earlier documents, using the review's letters.
  [Appendix C](#appendix-c--superseded-documents) maps each letter to its file in
  `davintrade-stack-d-and-e/archive/`, with a link.
- **Decisions are referenced by number**, for example [ADR-008]. The decision file holds the
  alternative that was not chosen and the date.
- **Status words.** SETTLED = decided by Davin. PROPOSED = adopted provisionally, waiting for
  confirmation (none at present). _Starting value_ = a figure to confirm by measurement; change it
  with a new decision entry, not by editing this file silently.
- **Example values** (prices, states, zones) come from the **18 Sep 20:55 example cycle**, which is
  test data from the MCD evaluators' Excel replica, not from the live pipeline.
- **Names.** Chapters use names by function; older engine numbers are aliases ([ADR-071]):

| Old name                                        | Name in this document | Chapter                |
| ----------------------------------------------- | --------------------- | ---------------------- |
| Engine 1                                        | Market data           | 1                      |
| Engine 1.5A + 4-Quadrant quality gate           | Sensors (MCD0–MCD15)  | 2                      |
| — (new)                                         | Synthesis             | 3                      |
| Engine 1.5E                                     | Router                | 4                      |
| Engine 2                                        | Knowledge             | 4                      |
| Engine 3                                        | Chart                 | 1 (produced), 5 (used) |
| — (new)                                         | Reply (Report 1)      | 5                      |
| Engine 4                                        | Risk (Report 2)       | 6                      |
| Engines 1.5B (JSONB54 storyline), 1.5C (WACS54) | Retired               | —                      |

## Contents

0. [The system at a glance](#0-the-system-at-a-glance)
1. [Market data & chart](#1-market-data--chart)
2. [Sensors (MCDs)](#2-sensors-mcds)
3. [Synthesis & entry zones](#3-synthesis--entry-zones)
4. [Intake, routing & knowledge](#4-intake-routing--knowledge)
5. [Prompt & AI reply](#5-prompt--ai-reply)
6. [Engine 4 & Report 2](#6-engine-4--report-2)
7. [Platform & governance](#7-platform--governance)

- [Appendix A — Decision index](#appendix-a--decision-index)
- [Appendix B — Corrections to earlier material](#appendix-b--corrections-to-earlier-material)
- [Appendix C — Superseded documents](#appendix-c--superseded-documents)
- [Appendix D — Open items](#appendix-d--open-items)

---

## 0. The system at a glance

### 0.1 Two clocks

```
EVERY 5-MINUTE CYCLE (runs whether or not anyone asks)
  1 Market data & chart  →  2 Sensors (MCDs)  →  3 Synthesis & entry zones
                                     │
                     one stamped cycle snapshot (read-only)
                                     ▼
PER USER QUESTION (reads the latest complete cycle, never re-runs a sensor)
  4 Intake, routing & knowledge  →  5 Prompt & AI reply  →  6 Engine 4 & Report 2

ACROSS BOTH
  7 Platform & governance: source of truth, entitlements, trace, retention,
    degraded modes, golden scenarios, operations, languages
```

Sections 1–3 run on the market clock and write one snapshot per 5-minute slot: closed bars, sensor
readings, synthesis, entry zones and the chart. Sections 4–6 run when a trader asks and only read
the latest complete snapshot. Consequences: the same data always gives the same answer; request
latency does not depend on sensor run time; regime history accumulates by itself; any answer can
be replayed from its cycle.

### 0.2 The seven sections

| #   | Section                     | Clock    | Owns                                                                                               | Main output                                                      |
| --- | --------------------------- | -------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | Market data & chart         | Cycle    | MT5 terminal, collector, push worker, gateway ingestion, chart renderer, R2                        | `market_cycles` row with data status; closed bars; stamped chart |
| 2   | Sensors (MCDs)              | Cycle    | MCD evaluators, MCD0 quality gate, sensor worker, state register, state statistics                 | One envelope per MCD per cycle in `mcd_outputs`                  |
| 3   | Synthesis & entry zones     | Cycle    | Rules table, synthesis step, entry-zone builder                                                    | One SYN reading per trader type; `entry_zones`                   |
| 4   | Intake, routing & knowledge | Question | Session gate, language handling, intent, sensor board, dispatch matrix, knowledge corpus and index | The intake packet                                                |
| 5   | Prompt & AI reply           | Question | Answer gate, context assembler, model gateway, Report 1, reply checks, metering                    | Checked Report 1 (`report1.v1`)                                  |
| 6   | Engine 4 & Report 2         | Question | Profile, offer check, modal and validator, sizing maths, badge, consent record                     | Report 2 and a consent record                                    |
| 7   | Platform & governance       | Both     | This document, decision log, entitlements, trace, retention, degraded modes, tests, operations     | The rules every section runs under                               |

### 0.3 The ten handoffs

Each handoff is specified once, in the section that produces it.

| #   | Handoff                     | From → to        | Carries                                                                                 | Defined in |
| --- | --------------------------- | ---------------- | --------------------------------------------------------------------------------------- | ---------- |
| 1   | Cycle stamp + ready signal  | 1 → 2, 5, 7      | Slot time, last closed M5 / M15 bar, data status                                        | §1.3       |
| 2   | Closed bars + current price | 1 → 2, 5         | Closed OHLC (1 day = 288 M5 + 96 M15 bars); the still-open bar as one labelled price    | §1.3       |
| 3   | Active-indicator setting    | 1 → 2, chart, UI | One channel indicator per timeframe, effective from a slot                              | §1.3       |
| 4   | Chart + its stamp           | 1 → 5            | 2-panel PNG with slot, last bar and overlay in its metadata                             | §1.3       |
| 5   | MCD output envelope         | 2 → 3, 4, 5      | Status, state code, bias, levels, one-line summary                                      | §2.3       |
| 6   | Synthesis + entry zones     | 3 → 4, 5, 6      | Archetype, bias, trend relation, stand-aside, ranked zones with invalidation and runway | §3.5, §3.6 |
| 7   | Intake packet               | 4 → 5            | Question, intent, sensor board, readings for M\*, knowledge pack, profile, data status  | §4.9       |
| 8   | Report 1 JSON               | 5 → UI, 6        | Direction copied from synthesis, zone ids, rationale                                    | §5.7       |
| 9   | Engine 4 in / out           | 6 → UI, 7        | Inputs, validator results, lot, stop, targets, consent action                           | §6.11      |
| 10  | Trace                       | 4, 5, 6 → 7      | Ids and versions of everything above, per answer                                        | §7.4       |

### 0.4 Where the review's 32 recommendations landed

| Section                       | Recommendations (P1 in bold)                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 Market data & chart         | **A2** one cycle, closed bars · **A3** active-indicator setting · **D1** freshness stamps (stamped here, enforced in §5.3)                 |
| 2 Sensors                     | **A1** one output format · **A4** per-cycle worker · A5 quality gate as MCD0 · A6 state statistics · A7 dependencies · A8 plug-in contract |
| 3 Synthesis & entry zones     | **B6** rules-based synthesis · **E1** entry-zone spec                                                                                      |
| 4 Intake, routing & knowledge | **B1** sensor board · B2 rules-first routing · **B3** 16 languages · B4 txtai usage · B5 corpus and tests                                  |
| 5 Prompt & AI reply           | **C1** context budget · C2 follow-ups · **D3** number check · F1 structured Report 1 · F2 model gateway · F3 wording                       |
| 6 Engine 4 & Report 2         | **D2** news blackout · D4 defect flag · E2 structure · **E3** maths · E4 broker specs (exported in §1)                                     |
| 7 Platform & governance       | **G1** source of truth · G2 entitlements · G3 trace · G4 degraded modes and replay · G5 later                                              |

### 0.5 Build status (as the source documents state it, September 2026)

| State               | Items                                                                                                                                                                                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Running             | Railway gateway and PostgreSQL schema (103-column `market_data_v6`); `economic_events` lane end to end (live since 11 Sep); MT5Renderer uploading both chart variants every ~300 s, on a synthetic June fixture; chart download route (401 · 403 · 307 presigned) |
| Built, not deployed | Rebuilt `.ex5` for the 10 statistic-emitting indicators; collector restart with the new schema; point-in-time snapshot writes; frozen-baseline mode and centroid watchdog; failover code for terminals A / B / S                                                  |
| Not yet             | A real end-to-end market-data cycle ("v6 has never written a row to PostgreSQL", blueprint 22 Sep); terminals A / B / S; measured push throughput; the Stack D orchestrator (Phase 12); MCD evaluators on PostgreSQL (they read an Excel replica)                 |
| Documents disagree  | Point-in-time migration on production (applied vs not); `indicator_statistics` on production; timestamp-fix deployment; frozen-mode binaries (7 compiled vs 5 of 7 missing). Resolve by checking production, then record the answer here                          |

### 0.6 Glossary

| Term            | Meaning                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| Slot / cycle    | One 5-minute boundary in UTC (e.g. 20:55). One cycle per slot ([ADR-008])                                   |
| Closed bar      | A bar whose open time plus its period is at or before the slot (§1.3 rule 2)                                |
| Data status     | FRESH, DELAYED, STALE, MARKET CLOSED, plus RETUNING during a promote (§1.3 rules 7, 9)                      |
| Envelope        | The common output format of every sensor and of synthesis (`mcd-output/1`, `syn-output/1`)                  |
| Status          | VALID, CAUTIONARY, INVALID or STALE (§2.4)                                                                  |
| Bias            | LONG, SHORT, NEUTRAL or STAND_ASIDE ([ADR-017])                                                             |
| SYN             | The synthesis reading, stored like a sensor with `mcd_id = "SYN"`                                           |
| Zone            | An entry price range around a structural level, with reference price, invalidation and runway (§3.6)        |
| Invalidation    | $0.50 beyond the next structural level past a zone; never closer than $13 ([ADR-032])                       |
| Runway          | Distance in dollars from a zone to the first opposing level; the **runway ratio** is runway ÷ stop distance |
| M\*             | The sensors whose full reading a question needs, chosen by the dispatch matrix (§4.5)                       |
| Sensor board    | One line per sensor plus the synthesis line, sent with every question (§4.4)                                |
| Units           | The quota currency, charged from each model call's actual cost ([ADR-050])                                  |
| Offer check     | The test that decides whether Report 2 may be offered right now (§6.4)                                      |
| Golden scenario | A stored cycle with approved expected outputs, replayed on every change (§7.7)                              |

---

## 1. Market data & chart

Everything produced on the 5-minute clock before anyone asks, and the rules the rest of Stack D
relies on. Recommendations: A2, A3, D1 (all P1).

### 1.1 Scope

**Owns:** the MT5 terminal (15 indicators on the M5 and M15 charts, plus the economic-calendar
exporter EA); the VPS collector and push worker; gateway ingestion into PostgreSQL
(`market_data_v6`, `market_data_point_in_time`, `indicator_statistics`, `economic_events`); the
chart renderer and private R2 storage.

**Hands on to:** Section 2 (cycle-ready signal, closed bars, statistics for the slot, active
indicator, promote events); Section 5 (1 day of closed OHLC, current price line, stamped chart, data
status); Section 6 (economic events, broker symbol specs, data status); Section 7 (cycle history).

### 1.2 The pipeline (unchanged parts)

| Stage              | Where               | What it does                                                                                                                                                                                                                                                                                                         |
| ------------------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MT5 terminal       | Windows VPS (Vultr) | 15 indicators on M5 and M15 plus the calendar EA. MQL5 computes every value. Exports every minute at :59: 3,000 bars per timeframe, newest bar still open                                                                                                                                                            |
| Collector          | VPS                 | Every 5 minutes at :05; M15 on 15-minute boundaries; market-hours gated. COLLECT → ADJUST → VALIDATE (symbol, timeframe and close within 0.01 across sources; up to 3 attempts, 65 s apart) → PROMOTE. A cycle missing any source is rejected. Stale-export guard: newest bar older than 600 s (M5) or 1,800 s (M15) |
| SQLite `xauusd.db` | VPS                 | 3,000-bar buffer per timeframe and outboxes; the collector is its only writer                                                                                                                                                                                                                                        |
| Push worker v5     | VPS                 | Three isolated lanes (prices, statistics, events); prices 500 rows per cycle, one row per request; events batched at 120 rows (gateway body limit 100 KB)                                                                                                                                                            |
| Gateway            | Railway (NestJS)    | Contract check; UPSERT into `market_data_v6` on (symbol, timeframe, timestamp); point-in-time snapshot once a bar has closed; append-only `indicator_statistics` keyed (symbol, timeframe, source, captured_at); append-only `economic_events`                                                                       |
| MT5Renderer        | VPS                 | Two chart variants (overlay, standard) every ~300 s into private R2; 48-hour prune; download route 401 signed out · 403 Free · 307 presigned Pro                                                                                                                                                                     |

The Python calculation stack was parked on 9 Sep: the collector validates and forwards; it does not
compute indicator values.

### 1.3 The nine rules

These rules are Section 1's contract. Other chapters cite them as "rule n".

| #   | Rule             | Statement                                                                                                                                                                          |
| --- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Cycle            | One cycle per 5-minute slot, keyed by slot time in UTC (e.g. XAUUSD @ 20:55). The M15 part refreshes on :00, :15, :30 and :45. Collection cycle ids stay as provenance ([ADR-008]) |
| 2   | Closed bar       | A bar is closed when its open time plus its period is at or before the slot. Sensors and OHLC windows use closed bars only ([ADR-011])                                             |
| 3   | Current price    | The still-open M5 bar is exposed once, as "last price at hh:mm:ss", and labelled. The chart keeps drawing it hollow ([ADR-011])                                                    |
| 4   | One day          | "1 day of OHLC" means the last 288 closed M5 bars and 96 closed M15 bars: trading bars, skipping market-closed gaps ([ADR-003])                                                    |
| 5   | Statistics       | A sensor uses the `indicator_statistics` row captured at the slot where its timeframe was last collected, for the active source. No match means STALE, never "latest available"    |
| 6   | Active indicator | Read from the setting: one channel indicator per timeframe, effective from a named slot for MCDs, chart and UI together ([ADR-010])                                                |
| 7   | Data status      | Every cycle carries FRESH, DELAYED, STALE or MARKET CLOSED. Downstream sections decide what each status allows (§5.3, §6.4) ([ADR-012])                                            |
| 8   | Chart stamp      | Every image carries its slot, last bar and overlay. An image from a different slot never reaches the prompt ([ADR-014])                                                            |
| 9   | Retune           | A promote is an event with an effective slot. Until the re-pushed window is complete, cycles are RETUNING and sensors report CAUTIONARY ([ADR-015])                                |

### 1.4 Seven additions at the seams

1. **Newest bars first + cycle manifest.** The push worker sends the cycle's newest bars ahead of any
   backlog, then a short manifest: slot time, collection cycle ids, bar counts, newest bar times
   ([ADR-009], [ADR-013]). Throughput is measured alongside (demand ≈ 800 rows/min against a likely
   375–600 capacity; the open issue's full range is 375–750; unmeasured).
2. **Cycle stamp and ready signal.** The gateway checks the manifest against what landed, writes one
   `market_cycles` row per slot with its status and timings, and queues the Section 2 job keyed by
   slot ([ADR-009]).
3. **Active-indicator setting.** One admin setting per timeframe, effective from a slot and logged.
   Starting values: M15 `non_b`, M5 `best_fit_a`. MCDs, renderer and UI read it; detection from data
   remains only as a cross-check ([ADR-010]). The renderer needs a small change to resolve one key
   per timeframe.
4. **Closed-bar view + current price.** Consumers read closed bars only (rule 2); the still-open bar
   appears once as a labelled last price (rule 3).
5. **Statistics matched to the slot** (rule 5). No `ORDER BY captured_at DESC LIMIT 1` without a slot
   match anywhere in Stack D.
6. **Chart stamped and kept.** The renderer draws the setting's indicator, writes slot, last bar and
   overlay into the R2 object metadata and the image title, and keeps the last good image
   ([ADR-014]).
7. **Data status** (rule 7), with thresholds from [ADR-012]: cycle ready within **2 minutes** of the
   slot normally, **4 minutes** with collector retries; **STALE** when no ready cycle exists for
   **10 minutes** (matching the VPS guard's 600 s); DELAYED between the ready deadline and STALE;
   MARKET CLOSED from the market-hours gate. Starting values, to confirm on the first real cycles.

Also produced here for Section 6: **`symbol_specs`**, written by the collector from MT5 symbol
properties daily and whenever a value changes (§6.9, [ADR-066]).

### 1.5 One cycle: the 20:55 slot

| Step | Time        | What happens                                                                                   |
| ---- | ----------- | ---------------------------------------------------------------------------------------------- |
| 1    | 20:55:00    | The M5 bar opened at 20:50 closes; the 20:55 bar starts forming                                |
| 2    | 20:55:05    | Collector reads the exports and validates across 15 sources (retries up to 3×, 65 s apart)     |
| 3    | then        | Push worker sends the newest bars first, then the manifest for the 20:55 slot                  |
| 4    | then        | Gateway upserts, snapshots closed bars, checks the manifest and writes `market_cycles` (FRESH) |
| 5    | then        | Cycle ready → Section 2 job (sensors, then synthesis)                                          |
| 6    | in parallel | Renderer uploads an image stamped 20:55 with last bar and overlay                              |

What the 20:55 cycle contains: **M5** closed bars up to the 20:50 bar; the 20:55 bar only as "last
price at 20:55:05". **M15** closed bars up to the 20:30 bar; the 20:45 bar is still open and the M15
part refreshes at the 21:00 slot.

### 1.6 Retunes: promotes and frozen lines

What exists (built, not deployed): terminals A and B carry the tunable indicators and alternate;
only one feeds the collector; terminal S carries 8 OHLCV charts for the currency and gold index and
never alternates. A **promote** switches the collector to the standby; about 6,000 in-window rows
re-push over 5–6 minutes, oldest first. **Frozen channel mode** (`MODE_FROZEN_LINE`) fixes a
centroid channel to an approved line (0 of 44 bars repainted in testing, against 44 of 44 in dynamic
mode) and keeps computing statistics against that line. The **centroid watchdog** confirms new
centroids on closed bars and alerts the administrator. Every configuration change mints a new
`config_hash` in `indicator_configs`.

What Stack D needs from it ([ADR-015], settled 1 October 2026):

1. A promote is recorded as an event: effective slot, terminal, `config_hash` per source, mode
   (dynamic or frozen).
2. Cycles are **RETUNING** until the re-pushed window is complete (the gateway counts no M5 row of
   the 3,000-bar window left from before the promote, and the manifest that counts it is verified;
   amended 2 October 2026, [ADR-015]); sensors report CAUTIONARY.
3. One switch: the active-indicator setting, chart overlay and MCDs change on the same slot as the
   promote.
4. Frozen fit (R², containment against the approved line) is a quality signal for Section 2.
5. Watchdog alerts are stored as events (for Section 2 now, proactive alerts later).

Build step 2 builds items 1 to 3. Items 4 and 5 are not part of step 2 (decided 1 October 2026).

### 1.7 Handoffs

| To     | What                          | Form                                                                 | Replaces                                  |
| ------ | ----------------------------- | -------------------------------------------------------------------- | ----------------------------------------- |
| 2      | Cycle-ready signal            | Job keyed by slot, sent once the cycle is complete                   | Polling for the newest rows               |
| 2      | Closed bars per MCD window    | Closed-bar view (rule 2)                                             | Reading the newest, still-open row        |
| 2      | Statistics for the cycle      | Row at the slot for the active source (rule 5)                       | `ORDER BY captured_at DESC LIMIT 1`       |
| 2 · UI | Active indicator              | Setting per timeframe, effective from a slot (rule 6)                | Inferring it from which columns hold data |
| 2      | Promote / retune events       | Effective slot, terminal, config hash per source, mode (rule 9)      | Nothing                                   |
| 5      | 1 day of OHLC + current price | 288 M5 + 96 M15 closed bars and one labelled price line (rules 3, 4) | 54 bars × 103 columns                     |
| 5      | Chart                         | R2 image with slot, last bar and overlay in metadata (rule 8)        | Fixed key, no bar time                    |
| 5 · 6  | Data status                   | FRESH · DELAYED · STALE · MARKET CLOSED (rule 7)                     | Nothing                                   |
| 6      | Economic events               | Unchanged append-only table; `time_mode` kept for approximate times  | —                                         |
| 6      | Broker symbol specs           | `symbol_specs` (§6.9); commission stays the trader's input           | 100 oz and a 0.01 step hard-coded         |
| 7      | Cycle history                 | `market_cycles` rows with status and timings                         | A log line                                |

### 1.8 Done when

- **One real cycle, measured:** time from slot to cycle ready, and the age of the newest row.
- **One `market_cycles` row per slot**, with status and timings; replaying a slot returns the same
  closed bars.
- **No still-open bar downstream:** a forming-bar fixture never reaches a sensor window, an OHLC
  window or a statistics lookup.
- **Indicator switch in one slot:** changing the setting at slot T switches MCDs, chart and UI
  together at T.
- **Missing statistics → STALE**, never "latest available".
- **Stale and closed differ:** feed stopped 15 min → STALE; weekend → MARKET CLOSED.
- **Chart stamp enforced:** an image from another slot stays out of the prompt; the last good image
  stays downloadable.
- **Newest bars first under backlog:** with the full 3,000-bar re-queue, the cycle's newest bars
  still land first.
- **A rehearsed promote is visible:** RETUNING, then FRESH; sensors CAUTIONARY in between; the event
  names its slot and config hashes.

### 1.9 Decisions

[ADR-008] cycle key · [ADR-009] manifest and ready signal · [ADR-010] active-indicator setting ·
[ADR-011] still-open bar · [ADR-012] freshness thresholds · [ADR-013] newest bars first ·
[ADR-014] chart on the VPS, stamped · [ADR-015] RETUNING.

---

## 2. Sensors (MCDs)

Every cycle, each MCD turns the same closed bars into one comparable reading: one format, one
clock, saved every time. Recommendations: A1, A4 (P1), A5, A6, A7, A8. MCD1–3 are examples and remain
open to change; topics for MCD4–15 are Davin's to define.

### 2.1 Scope

**Owns:** the MCD evaluators; MCD0 (the 4-Quadrant quality gate as a sensor); the sensor worker and
`mcd_outputs`; the envelope schema and the state register; `state_statistics`.

**Receives from Section 1:** cycle-ready signal (rule 1), closed bars (rule 2), statistics for the
slot (rule 5), active-indicator setting (rule 6), promote events and RETUNING (rule 9).

**Hands on to:** Section 3 (every reading of the cycle, with levels); Section 4 (summary lines and
state codes); Section 5 (full readings for M\*, caution reasons, measured statistics); Section 7
(provenance).

### 2.2 The sensor worker

Runs on Railway, started by Section 1's cycle-ready job ([ADR-016]); user requests never run an
evaluator.

```
cycle ready → load inputs → MCD0 → independent MCDs (parallel) → derived MCDs → validate + save
               closed bars ·   channel     MCD1, MCD2, …            MCD3, … read      schema check,
               stats at slot · quality                              upstream          mcd_outputs
               setting · hashes · RETUNING   on M5 and M15          readings
```

1. **Triggered, never polled** — one run per slot.
2. **Inputs by the rules** — closed bars (rule 2), statistics at the slot (rule 5), the setting
   (rule 6), RETUNING (rule 9).
3. **MCD0 first** — channel MCDs on a flagged timeframe inherit CAUTIONARY with the reason
   ([ADR-018]).
4. **Dependencies in order** — derived MCDs read the same cycle's readings instead of recomputing
   ([ADR-021]).
5. **Everything is saved** — one `mcd_outputs` row per MCD per cycle, append-only, including INVALID
   and STALE.
6. **Same answer on replay** — re-running a stored cycle gives byte-identical readings.
7. **Live vs certification history** — live readings on `market_data_v6`; certification on
   point-in-time replay ([ADR-020], §2.7).

### 2.3 Envelope v1 (`mcd-output/1`)

Every MCD returns the same envelope ([ADR-017]). Illustrative MCD2 values:

```json
{
  "schema_version": "mcd-output/1",
  "mcd_id": "MCD2",
  "evaluator_version": "1.1.0",
  "cycle_slot": "2026-09-18T20:55Z",
  "last_closed_bar": { "M5": "20:50" },
  "active_indicator": { "M5": "best_fit_a" },
  "config_hash": { "best_fit_a": "…" },
  "status": "VALID",
  "status_reasons": [],
  "state_code": "MCD2_UP_IN_CORRIDOR",
  "regime_status": "TREND_ALIGNED_CONTINUATION",
  "bias": "LONG",
  "levels": [
    { "name": "UOEDT", "tf": "M5", "price": 4384.28 },
    { "name": "baseline", "tf": "M5", "price": 4367.25 },
    { "name": "LOEDT", "tf": "M5", "price": 4350.22 }
  ],
  "depends_on": [],
  "summary_line": "M5 uptrend, price inside the corridor",
  "commentary": "…",
  "details": {}
}
```

| Group        | Fields                                                         | Purpose                                                                                                                   |
| ------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Identity     | `schema_version`, `mcd_id`, `evaluator_version`, `config_hash` | Which sensor, which code, which indicator tuning                                                                          |
| Clock        | `cycle_slot`, `last_closed_bar`                                | The cycle (rule 1) and the bars read (rule 2)                                                                             |
| Verdict      | `status`, `status_reasons`                                     | VALID, CAUTIONARY, INVALID or STALE, and why                                                                              |
| Reading      | `state_code`, `regime_status`, `bias`                          | `bias` ∈ LONG · SHORT · NEUTRAL · STAND_ASIDE                                                                             |
| Levels       | `name`, `tf`, `price`                                          | What zones and stops are built from (§3.6)                                                                                |
| Links + text | `depends_on`, `summary_line`, `commentary`, `details`          | Derived sensors name inputs; one line for the sensor board; module-specific content in `details` (read only by Section 5) |

### 2.4 Pre-flight and status scale

Order kept from the MCD flowcharts: cycle check, then tier 1 → 4 → 2 → 3, and MCD0.

| Check               | Tests                                                                                                                            | On failure                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Cycle               | Data status and RETUNING (rules 7, 9)                                                                                            | STALE if data is stale · CAUTIONARY while RETUNING                                                    |
| Tier 1 · Indicator  | Active indicator from the setting; detection only cross-checks                                                                   | INVALID if no setting · CAUTIONARY if detection disagrees, then a later tier ends it STALE or INVALID |
| Tier 4 · Statistics | Row at the slot for the active source; containment ≥ 50%                                                                         | STALE if no row · INVALID if containment < 50%                                                        |
| Tier 2 · Continuity | Enough closed bars, ascending, no nulls                                                                                          | INVALID                                                                                               |
| Tier 3 · Sanity     | UOEDT > LOEDT and channel width > 0                                                                                              | INVALID                                                                                               |
| MCD0 · Quality      | Coverage ≥ 60 bars · R² (Model A ≥ 0.70, Model B ≥ 0.65) · fit ratio 1.50–3.20 · symmetry (geo ratio 0.60–1.65, \|skew\| ≤ 1.50) | CAUTIONARY for every channel MCD on that timeframe                                                    |

A detection mismatch is only **recorded** at tier 1: `DETECTION_MISMATCH` (CAUTIONARY) is the first of the reading's
reasons and the checks go on. The status the reading ends with is the last word of the later tiers: for a setting that
does not match the data it is STALE (`NO_STATS_AT_SLOT`, the set indicator has no statistics row at the slot) or INVALID
(the set indicator's columns hold no values). The reason tells the operator that the setting looks wrong.

| Status     | Default meaning downstream                                                |
| ---------- | ------------------------------------------------------------------------- |
| VALID      | Used as normal                                                            |
| CAUTIONARY | Used, with its reason shown; Section 6 pre-sets half the risk ([ADR-061]) |
| INVALID    | Left out of synthesis; listed on the sensor board as unavailable          |
| STALE      | Left out; flagged as a data problem, not a market reading                 |

MCD0 runs Model A (SSA crossings) and Model B (close) on M5 and M15. R² thresholds are per model
([ADR-019]).

### 2.5 MCD1–3 (examples) and the changes to them

|            | MCD1 · M15 primary trend                                                                                                                                                                                         | MCD2 · M5 corridor                                                                                                                                                                                                                       | MCD3 · consolidation + EDT stochastic                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Question   | M15 primary trend; is the short-term regime with it or against it?                                                                                                                                               | M5 trend; is the deviation from the corridor big enough for mean reversion?                                                                                                                                                              | Do the M15 and M5 channels agree and nest; where is price in the M15 corridor?                                  |
| Timeframe  | M15                                                                                                                                                                                                              | M5                                                                                                                                                                                                                                       | M15 + M5                                                                                                        |
| Window     | N_micro = max(96, 5% of T_EDT), closed bars; the channel (T_EDT − 1 closed bars) must hold them                                                                                                                  | Latest closed bar; stats over min(T_EDT − 1, 288)                                                                                                                                                                                        | `T_EDT − 1` closed M5 bars for nesting (the channel's rows end at the forming bar); latest closed bars          |
| Thresholds | ±5° trend · breach on ≥ 80% of N_micro                                                                                                                                                                           | ±5° · channel position < 0 or > 1                                                                                                                                                                                                        | ±5° · nesting ≥ 75% · stochastic 20 / 80                                                                        |
| States     | 9 codes `MCD1_{UP,DOWN,SIDEWAYS}_{IN_CORRIDOR,UPPER_BREAKOUT,LOWER_BREAKDOWN}` plus 5 regime statuses (TREND_ALIGNED_CONTINUATION, BREAKOUT_SAME_SLOPE, COUNTER_TREND_EXPANSION, CONSOLIDATION, RANGE_EXPANSION) | 9 codes `MCD2_{UP,DOWN,SIDEWAYS}_{IN_CORRIDOR,UPPER_BREAKOUT,LOWER_BREAKDOWN}` plus regime statuses (e.g. TREND_ALIGNED_CONTINUATION, UPTREND_DIP_BELOW_CORRIDOR, DOWNTREND_RALLY_ABOVE_CORRIDOR, UPPER / LOWER_OVEREXTENSION_REVERSION) | 7 consolidated codes, 3 non-consolidated (TREND_CONFLICT, OVERFLOW, ESCAPE); a failure is a status, not a state |
| Levels     | UOEDT, baseline, LOEDT                                                                                                                                                                                           | UOEDT, baseline, LOEDT                                                                                                                                                                                                                   | UOEDT, baseline, LOEDT on both timeframes                                                                       |

Changes:

- **MCD1:** add state codes (one per trend × regime); the same-slope breakout fires on the latest bar
  (certified behaviour) and `mcd1.md` is corrected to match ([ADR-023]); output the M15 baseline as
  a level; N_micro counts closed bars only. Version 2.0.1 (PATCH, task P7): the channel must hold N_micro closed
  bars (it has T_EDT − 1, because the last of its T_EDT rows is the still-open bar), else INVALID +
  INSUFFICIENT_BARS ([ADR-083](adr/083-mcd1-and-mcd2-windows-count-the-channels-closed-bars.md)).
- **MCD2:** active indicator from the setting (`target_indicator_override` only in tests); rename the
  HIGH / LOW "probability" to a setup flag until measured; one failure status for tier 4. Version 2.0.1 (PATCH,
  task P7): the window is min(T_EDT − 1, 288) closed bars and a channel under 48 closed bars is INVALID +
  INSUFFICIENT_BARS ([ADR-083](adr/083-mcd1-and-mcd2-windows-count-the-channels-closed-bars.md)).
- **MCD3:** declares `depends_on` MCD1, MCD2 and reads their readings ([ADR-021]); keeps nesting and
  the stochastic as its own contribution; neutral state names instead of names like
  HIGH_CONVICTION_BUY_DIP ([ADR-024]); commentary templates for all 10 states (the evaluator has all
  10; its plan §6 lists 6).
- **All three:** read the closed-bar view in PostgreSQL (the Excel replica stays as a test fixture);
  add a forming-bar test and an envelope-conformance test.

### 2.6 Keep, change, add, remove

- **Keep:** one sensor per market dimension; deterministic English commentary; the four tiers and
  their order; containment ≥ 50% and the ±5° band; 13-test discipline per MCD.
- **Change:** closed-bar view instead of the Excel replica; once per cycle, never per request; tier 1
  reads the setting, tier 4 looks up the slot; MCD3 reads MCD1 / MCD2; neutral names.
- **Add:** envelope v1 and state register; MCD0; `mcd_outputs`; state statistics; `depends_on` and
  the plug-in checklist.
- **Remove:** `target_indicator_override` outside tests; file C's MCD01–10 mock list and ±10° / ±30°
  bands; probability words and percentages not from `state_statistics`; per-request evaluation.

### 2.7 Two histories

|          | Live reading                                                          | Certification                                               |
| -------- | --------------------------------------------------------------------- | ----------------------------------------------------------- |
| Table    | `market_data_v6`                                                      | `market_data_point_in_time` (`snapshot_age_bars = 1`)       |
| Holds    | Today's channel projected back over the window (what the chart shows) | Each bar as it stood at its close, no later refits          |
| Used for | Every cycle's live reading                                            | Replaying MCDs to build state statistics without look-ahead |

Channel values drift on 100% of historical bars (average $19.26), so a state measured on re-fitted
history would look better than it was. Frozen channels, once deployed, make the two agree for the
frozen variant.

### 2.8 State statistics (A6)

Point-in-time history → replay each MCD → state history → forward outcomes at **2 h** (Scalper) and
**12 h** (Day Trader) → `state_statistics` per state × horizon: **n**; forward move (median and
spread); how often price reached the next opposing level before a structural stop; adverse
excursion.

Rules: a number reaches a prompt only from this table and always with its n; below **n ≥ 30** per
state and horizon the state is "provisional" and gets words only ([ADR-022]); a new `config_hash`
starts a new series; the table can later calibrate synthesis rules.

**The arithmetic** (Davin, 3 October 2026, build step 3 plan Q9 b; built in `mcd_worker/statistics/`).
It defines what ADR-022's "forward move" and "adverse excursion" are, so it is not a new decision.
Prices are USD per ounce, and every figure is computed in exact decimals and rounded only when shown.

| Term                | Definition                                                                                                                                                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reference price     | `P_ref` = the close of the last closed M5 bar at the slot T: the bar opened at T − 300 (`last_closed_bar`)                                                                                                                                                             |
| Horizon             | 2 h = 24 M5 bars, 12 h = 144 M5 bars. `P_horizon` = the close of the H-th closed M5 bar after the reference bar, the one that closes at T + H                                                                                                                          |
| Forward move        | LONG `P_horizon − P_ref`; SHORT `P_ref − P_horizon` (positive is in favour of the bias); NEUTRAL and STAND_ASIDE the raw `P_horizon − P_ref`                                                                                                                           |
| Spread              | The first and third quartile beside the median (linear interpolation between closest ranks)                                                                                                                                                                            |
| Adverse excursion   | Never negative, over the H bars after the reference bar (the reference bar's own range is not in it). LONG `max(0, P_ref − min low)`; SHORT `max(0, max high − P_ref)`; NEUTRAL and STAND_ASIDE `max(abs(P_ref − min low), abs(max high − P_ref))`. Median and Q3 kept |
| Next opposing level | `opposing_level_rate` stays NULL until build step 4 defines levels and stops                                                                                                                                                                                           |

What the counts mean (Davin's decisions on the part 6 hand-off, all as built): **n counts cycle occurrences**
(ADR-022 as written), not independent episodes, so 30 consecutive cycles in one state count as 30. An
occurrence has an outcome only when **every** M5 bar from the reference bar to the horizon bar exists; a market
closure or a hole in the history leaves it out of n and is never stretched to "the 24th bar later". Which readings
count as occurrences (a CAUTIONARY reading, a reading made while RETUNING is enforced) is **not yet decided**: it
is settled on the real counts at certification (build step 3, B4). A series is one evaluator MAJOR.MINOR over one
set of source tunings (`config_hash`); every series carries the note `FORMING_BAR_FIT: UNVERIFIED` until the
forming-bar question is closed. The one reader of the table is `state-statistics.reader.ts`, and a test fails
when any other code reads it.

### 2.9 The checklist for MCD4–15 (A8)

A new MCD's feature flag stays `off` until items 1 to 6 pass, and `live` needs all nine: **`shadow` requires items 1 to 6;
`live` requires all nine items** (Davin, build step 3 plan, decision Q7, 3 October 2026; items 7 to 9 cannot exist before
the MCD has run in shadow). The items: (1) spec approved by Davin; (2) evaluator on
the closed-bar view; (3) tests (13-style suite + envelope + forming-bar case); (4) state register entries
(code, plain meaning, bias); (5) levels contributed (or "none"); (6) `depends_on`; (7) a dispatch-matrix entry
and playbook chunk (§4); (8) synthesis rows (§3); (9) statistics measured.

Candidate topics from data no MCD reads yet (topics stay Davin's to define): support & resistance
`sr_1`–`sr_16`; ZigZag structure and wave Z-scores; candle-body Z-score; best support / resistance
lines; `best_fit_a` vs `best_fit_b` divergence; economic-event proximity; currency & gold index
(terminal S); frozen-fit drift.

How to build one: [MCD-DEVELOPMENT-STANDARD.md](MCD-DEVELOPMENT-STANDARD.md) ([ADR-082]).
Its Appendix A is the compliance checklist every MCD manifest carries. The order of work for MCD0–MCD3
and for new MCDs, and the agent's task cards, are in [MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md](MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md); Davin's prompts are in
[STACK-D-BUILD-USER-MANUAL.md](STACK-D-BUILD-USER-MANUAL.md).

### 2.10 Handoffs

| To    | What                       | Form                                                                       | Replaces                                    |
| ----- | -------------------------- | -------------------------------------------------------------------------- | ------------------------------------------- |
| 3     | Every reading of the cycle | `mcd_outputs` rows for one slot: status, state, bias, levels, `depends_on` | WACS as the only combiner                   |
| 4     | Sensor board lines         | `summary_line` + status for every sensor                                   | Embedding raw numeric commentary            |
| 4     | State register             | Codes and plain meanings for the dispatch matrix                           | Router rows for modules never built         |
| 5     | Full readings for M\*      | The envelope, including `details`                                          | Raw `mcdX_output.json` files                |
| 5 · 6 | Caution reasons            | CAUTIONARY with its reason, including the MCD0 defect                      | A separate 4-Quadrant payload               |
| 5     | Measured statistics        | `state_statistics` rows, always with n                                     | Unmeasured words and the seed's percentages |
| 7     | Provenance                 | Slot, evaluator version, config hashes                                     | Nothing                                     |

Levels reach Section 6 through Section 3's zones, not directly.

### 2.11 Done when

- MCD1–3 emit envelope v1 from the closed-bar view; every output validates against the schema.
- One `mcd_outputs` row per MCD per cycle, including INVALID and STALE.
- Replaying a stored cycle reproduces identical readings.
- Tier 1 passes on live data via the setting; a detection mismatch is recorded as CAUTIONARY at tier 1 and the checks
  continue, so the reading ends STALE or INVALID at the later tiers, with `DETECTION_MISMATCH` first among its reasons.
- An MCD0 defect makes that timeframe's channel MCDs CAUTIONARY, with the reason.
- Changing MCD1's trend in a test changes MCD3's reading in the same cycle.
- During a promote every sensor reports CAUTIONARY. The worker always reads and records RETUNING, but applies it to the
  readings only when `SENSOR_RETUNING_ENFORCED=true`; **enforcement defaults to false in production until the B5 promote
  rehearsal** (build step 3, Phase B; Davin's decision Q6), so under the shipped defaults this item is met on fixtures and
  with enforcement switched on, and live only after B5.
- No percentage or confidence word in any output unless it comes from `state_statistics`.
- A new MCD's flag stays off until items 1 to 6 of the checklist pass: `shadow` requires items 1 to 6, and `live` requires all nine items (decision Q7).

### 2.12 Decisions

[ADR-016] worker on Railway · [ADR-017] envelope v1 · [ADR-018] MCD0 · [ADR-019] R² per model ·
[ADR-020] live vs certification history · [ADR-021] MCD3 reads MCD1/MCD2 · [ADR-022] n ≥ 30 ·
[ADR-023] MCD1 breakout on the latest bar · [ADR-024] neutral state names · [ADR-082] MCD
development standard.

### 2.13 MCD registry

One row per MCD. The MCD itself (maths, states, parameters, `details`) lives in its own spec and
registry files; this table only records what exists and where (MCD development standard §16). A row
is added when Davin approves a spec and updated at each status change.

| MCD        | Question                                                                       | Timeframe | Kind                 | Rung: Day Trader / Scalper                | Levels                         | Spec                                                                                                                                                   | Status           |
| ---------- | ------------------------------------------------------------------------------ | --------- | -------------------- | ----------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| MCD0       | Is each timeframe's channel fit good enough to trust the channel sensors?      | M5 + M15  | Gate                 | —                                         | None                           | `engine-1-5-new/mcd0/mcd0.md`, from [file C](../davintrade-stack-d-and-e/archive/STACK-D-ENGINE-1.5A-1.5B-1.5C-ARCHITECTURE-PLAN.md)'s 4-Quadrant gate | Draft (1.0.0)    |
| MCD1       | M15 primary trend; is the short-term regime with it or against it?             | M15       | Independent          | Primary structure / trendlines & channels | UOEDT, baseline, LOEDT         | `engine-1-5-new/mcd1/mcd1.md`                                                                                                                          | Retrofit (2.0.1) |
| MCD2       | M5 trend; is the deviation from the corridor big enough for mean reversion?    | M5        | Independent          | Trendlines & channels / primary structure | UOEDT, baseline, LOEDT         | `engine-1-5-new/mcd2/mcd2.md`                                                                                                                          | Retrofit (2.0.1) |
| MCD3       | Do the M15 and M5 channels agree and nest; where is price in the M15 corridor? | M15 + M5  | Derived (MCD1, MCD2) | Oscillators, as modifier (both)           | UOEDT, baseline, LOEDT on both | `engine-1-5-new/mcd3/mcd3.md`                                                                                                                          | Retrofit (2.0.0) |
| MCD4–MCD15 | Davin to define                                                                |           |                      |                                           |                                |                                                                                                                                                        | Not started      |

Status values: To build · Retrofit · Draft · Shadow · Live · Retired. Rungs follow §3.3 and are
Davin's to confirm per MCD. Retrofit and creation steps: [walkthrough](MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md) Parts C and D.

---

## 3. Synthesis & entry zones

Rules, not averages or the model, turn each cycle's sensor readings into a bias, a reason and a
short list of entry zones with their invalidation prices. Recommendations: B6, E1 (both P1). The
mechanism is settled here; the **content of the rules table is Davin's** ([ADR-026]).

### 3.1 Scope

**Owns:** the synthesis step (in the sensor worker, right after Section 2, same cycle,
[ADR-027]); the rules table (ordered, versioned); the SYN reading; the entry-zone builder and
`entry_zones`.

**Receives:** every sensor reading of the cycle with its levels (§2); support & resistance levels
`sr_1`–`sr_16` from `market_data_v6` ([ADR-030]); the cycle's data status and RETUNING flag (§1).

**Hands on to:** Section 4 (the synthesis line at the top of the sensor board); Section 5 (bias,
reasons, zones for Report 1); Section 6 (zone prices, invalidation, runway, trend relation).

### 3.2 Principles

1. **Rules decide, the model explains.** Bias, archetype and stand-aside come from the rules table.
   The model explains them and can neither override stand-aside nor flip the bias ([ADR-025]).
2. **Two views per cycle.** A Day Trader reading (M15 structure, M5 timing) and a Scalper reading
   (M5 for both). A request uses the one matching the trader's profile ([ADR-028]).
3. **Same for every user.** Trading style, reward-to-risk caps and personal stop limits are applied
   later (§5, §6), so the cycle output never depends on who asks.
4. **Saved and replayable.** Stored like a sensor reading (`mcd_id = "SYN"`) with rule id and rules
   version.
5. **No grades.** No confidence grades (S / A / B, "95% confluence") until state statistics exist
   ([ADR-035]); confidence is shown as reasons.

### 3.3 Precedence and mechanics

Precedence follows file A's ladder ([ADR-029]); a lower rung can never override a higher one:

1. Primary-timeframe structure — MCD1 for Day Traders, MCD2 for Scalpers.
2. Support & resistance — `sr_1`–`sr_16`.
3. Trendlines and channels — the other timeframe's channel.
4. Oscillators — e.g. MCD3's EDT stochastic.

Mechanics ([ADR-026]):

1. **Required sensor first.** If the primary-timeframe sensor is not VALID or CAUTIONARY, the result
   is STAND_ASIDE with a data reason.
2. **Fixed order, first match.** Rules run top to bottom; the first whose conditions hold decides.
   The order is part of the rules version.
3. **Derived sensors modify.** MCD3 confirms or adds caution; it never votes.
4. **Caution is inherited.** Any CAUTIONARY input makes the result CAUTIONARY, with the input's
   reason.
5. **No match is recorded.** Result NEUTRAL, logged with the sensor states, so gaps in the rules
   show up in data.

### 3.4 Draft rules table (starting point, Davin's to edit)

Built only from sensor states that exist today. Not a trading recommendation.

| #   | Rule                          | Profile | When                                                                                                      | Result                                  |
| --- | ----------------------------- | ------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 0   | Data check                    | Both    | Primary sensor not VALID or CAUTIONARY                                                                    | STAND_ASIDE (data)                      |
| 1   | C · macro counter-trend rally | Day     | MCD1 COUNTER_TREND_EXPANSION, and MCD2 trending in the breach direction                                   | Bias = breach direction · counter-trend |
| 2   | B · exhaustion / snapback     | Both    | MCD1 BREAKOUT_SAME_SLOPE, or MCD2 UPPER / LOWER_OVEREXTENSION_REVERSION                                   | Bias against the spike · counter-trend  |
| 3   | A · trend continuation        | Day     | MCD1 TREND_ALIGNED_CONTINUATION, and MCD2 same trend (in corridor, dip below or rally above the corridor) | Bias = M15 trend · with-trend           |
| 3s  | A · trend continuation (M5)   | Scalper | MCD2 TREND_ALIGNED_CONTINUATION, UPTREND_DIP_BELOW_CORRIDOR or DOWNTREND_RALLY_ABOVE_CORRIDOR             | Bias = M5 trend · with-trend            |
| 4   | D · range                     | Both    | MCD1 `CONSOLIDATION` / `RANGE_EXPANSION`, or MCD2 `MCD2_SIDEWAYS_*`                                       | Edges only; middle = STAND_ASIDE        |
| 5   | Unresolved conflict           | Both    | MCD3 `MCD3_NON_CONSOLIDATED_*` and nothing above matched                                                  | STAND_ASIDE                             |
| –   | No match                      | Both    | Nothing above                                                                                             | NEUTRAL, logged                         |

MCD3 as modifier: consolidated in the same direction confirms the result; a trend conflict is noted
as expected in rule 1 and adds caution elsewhere. C is evaluated before A so that a sustained
counter-trend breach is not read as continuation; B before A so that a climax is not bought. Each
change to the table is a new rules version and a decision-log entry.

### 3.5 The SYN reading (`syn-output/1`)

```json
{
  "schema_version": "syn-output/1",
  "mcd_id": "SYN",
  "profile": "DAY_TRADER",
  "cycle_slot": "2026-09-18T20:55Z",
  "rules_version": "draft-1",
  "rule_id": "R1_MACRO_COUNTER_TREND_RALLY",
  "status": "VALID",
  "archetype": "C",
  "bias": "LONG",
  "trend_relation": "COUNTER_TREND",
  "stand_aside": false,
  "inputs": {
    "MCD1": "COUNTER_TREND_EXPANSION",
    "MCD2": "MCD2_UP_IN_CORRIDOR",
    "MCD3": "MCD3_NON_CONSOLIDATED_TREND_CONFLICT"
  },
  "reasons": ["M15 breach up against a falling channel", "M5 uptrend"],
  "zones": ["Z1", "Z2"],
  "summary_line": "Counter-trend rally, LONG"
}
```

`profile` ∈ DAY_TRADER · SCALPER. `trend_relation` ∈ WITH_TREND · COUNTER_TREND (used by §6 for the
style notice and the 2.50× cap).

### 3.6 Entry-zone builder (the missing entry-zone specification)

Replaces the absent `STACK-D-ENTRY-PRICE-ZONE-CALCULATION-DOCUMENT.md`.

1. **Collect levels** on the bias side of price: levels from the sensors behind the reading, plus
   `sr_1`–`sr_16` as context levels ([ADR-030]).
2. **Make zones:** each level ± a half-width of **10% of its source channel's width**; overlapping
   zones merge and count as confluence ([ADR-031]).
3. **Invalidation:** **$0.50 beyond the next structural level** past the zone, and **never closer
   than $13** (Engine 4's minimum stop) ([ADR-032]).
4. **Runway:** distance in dollars from the zone to the first opposing level; the **runway ratio**
   divides it by the stop distance.
5. **Rank:** confluence first, then runway ÷ stop, then distance from price. Keep at most five.
6. **Hand on:** Report 1 shows the zones; the modal's price pills are their reference prices, best
   first, one per zone; fewer pills if fewer zones qualify ([ADR-033]).

Stand-aside means no zones; Report 1 says why. A custom entry stays possible within the **1-day
range widened by half its height**; ±5% of the live price remains only as a typo filter
([ADR-034]).

`entry_zones` row: zone id, cycle slot, profile, low, high, reference price, source sensors,
confluence count, invalidation price, stop distance, next opposing level, runway ($), runway ratio,
rank.

### 3.7 Worked example (18 Sep 20:55, test data)

Sensor readings: MCD1 (M15) downtrend (−29.72°) with a sustained breach above the M15 UOEDT
(channel position 1.64), COUNTER_TREND_EXPANSION. MCD2 (M5) uptrend (6.94°), MCD2_UP_IN_CORRIDOR.
MCD3: MCD3_NON_CONSOLIDATED_TREND_CONFLICT.

|          | Day Trader (M15 structure, M5 timing)      | Scalper (M5 for both)          |
| -------- | ------------------------------------------ | ------------------------------ |
| Rule     | 1 · C macro counter-trend rally            | 3s · A trend continuation (M5) |
| Bias     | LONG                                       | LONG                           |
| Relation | Counter-trend (against the M15 slope)      | With-trend (M5)                |
| MCD3     | Conflict expected while the M15 slope lags | Conflict noted as caution      |

Levels: M5 UOEDT 4384.28, M5 baseline 4367.25, M5 LOEDT 4350.22 (channel width 34.06, half-width
3.41), M15 UOEDT 4279.21, M15 LOEDT 4125.99; last price 4377.99.

|                     | Z1 · M5 baseline       | Z2 · M5 LOEDT              |
| ------------------- | ---------------------- | -------------------------- |
| Range               | 4363.84 – 4370.66      | 4346.81 – 4353.63          |
| Reference price     | 4367.25                | 4350.22                    |
| Invalidation        | 4349.72 (LOEDT − 0.50) | 4278.71 (M15 UOEDT − 0.50) |
| Stop distance       | $17.53                 | $71.51 (wide)              |
| Next opposing level | M5 UOEDT 4384.28       | M5 baseline 4367.25        |
| Runway ÷ stop       | 0.97                   | 0.24                       |
| Rank                | 1                      | 2                          |

Neither zone has room before the next resistance: even the Conservative scenario needs about 1.5×
the stop, so Report 2 gives no badge and names 4384.28 (§6.5). The MCD2 example was produced with a
test override while two indicators were active; it illustrates the mechanism only.

### 3.8 Keep, change, add, remove

- **Keep:** the four archetypes as names; M15 structure first; stops behind structure ($0.50);
  counter-trend RRR cap 2.50×; up to five entry prices in the modal.
- **Change:** archetypes rewritten on sensors that exist; prices come from zones, not a ladder;
  custom entry bounded by the 1-day range; confidence shown as reasons.
- **Add:** the rules table; a SYN reading per trader type per cycle; the zone builder and
  `entry_zones`; invalidation and runway per zone; support & resistance as context.
- **Remove:** WACS confidence tiers; direction chosen by the model; the fixed $2.50 ladder; seed
  archetype conditions on sensors that don't exist.

### 3.9 Handoffs

| To  | What                                 | Form                                                        | Replaces                     |
| --- | ------------------------------------ | ----------------------------------------------------------- | ---------------------------- |
| 4   | Synthesis line                       | Top line of the sensor board: archetype, bias, relation     | Nothing                      |
| 5   | SYN reading for the trader's profile | SYN envelope: bias, archetype, reasons, stand-aside         | The model choosing direction |
| 5   | Zones for Report 1                   | `entry_zones` rows                                          | A missing spec               |
| 6   | Modal price pills                    | Zone reference prices, best first; none when standing aside | A fixed $2.50 ladder         |
| 6   | Stop and target inputs               | Invalidation price and next opposing level per zone         | Fixed dollar stop pills      |
| 6   | Trend relation                       | WITH_TREND or COUNTER_TREND                                 | Nothing                      |
| 7   | Provenance                           | Rules version, rule id, input readings                      | Nothing                      |

### 3.10 Done when

- A Day Trader and a Scalper SYN reading per cycle, saved with rule id and version.
- Replaying a stored cycle gives the same bias, archetype and zones.
- Each reading names its rule; unmatched cycles are logged as NEUTRAL.
- When the rules say stand aside, no zones are built and Report 1 cannot give a direction.
- Every zone has a reference price, invalidation ≥ $13 away and a runway ratio.
- A test cycle with a level just above entry blocks targets beyond it (§6.5).
- Modal pills equal zone reference prices; no filler prices.
- The 18 Sep test cycle gives rule 1 for Day Traders and rule 3s for Scalpers under the draft rules.

### 3.11 Decisions

[ADR-025] rules decide direction · [ADR-026] rules format · [ADR-027] synthesis in the worker ·
[ADR-028] two trader-type readings · [ADR-029] precedence · [ADR-030] `sr_1`–`sr_16` as context ·
[ADR-031] zone half-width · [ADR-032] invalidation · [ADR-033] modal pills · [ADR-034] custom-entry
bound · [ADR-035] no grades.

---

## 4. Intake, routing & knowledge

The first half of every request: check who is asking and what they may use, understand the question
in any of 16 languages, and gather exactly the sensors and knowledge it needs. Recommendations: B1,
B3 (P1), B2, B4, B5.

### 4.1 Scope

**Owns:** the session gate (sign-in, tier, quota pre-check, thread, scope); language handling;
intent; the sensor board and routing; the knowledge corpus, index and retrieval.

**Receives:** latest complete cycle and its data status (§1); sensor readings and state register
(§2); SYN reading for the trader's type (§3); the trader's Engine 4 profile (§6); the entitlement
table (§7).

**Hands on to:** Section 5 (the intake packet); Section 7 (trace: language, intent, M\*, chunk ids,
index build).

### 4.2 Request path

| Step | Name         | What happens                                                                                                     |
| ---- | ------------ | ---------------------------------------------------------------------------------------------------------------- |
| 1    | Gate         | Signed in · tier allows it (§7.3) · quota pre-check · XAUUSD thread · Engine 4 profile confirmed                 |
| 2    | Understand   | One small model call returns: language, English text, intent label, symbols and timeframes mentioned ([ADR-039]) |
| 3    | Scope        | Another symbol or timeframe → fixed reply in the user's language; nothing else runs ([ADR-046])                  |
| 4    | Snapshot     | Latest complete cycle and its data status; SYN for the trader's type; profile snapshot                           |
| 5    | Sensor board | Synthesis line + one line per sensor; INVALID / STALE ones listed as unavailable ([ADR-040])                     |
| 6    | Route        | Dispatch matrix: intent × states → M\* in full + knowledge domains ([ADR-036])                                   |
| 7    | Retrieve     | Query from intent template + state codes + English question; txtai with a metadata filter; top 4 ([ADR-043])     |
| 8    | Hand on      | Intake packet to Section 5; trace fields to Section 7                                                            |

Instant prompts (INSTANT_M5_INSPECT, INSTANT_M15_INSPECT) pass the gate (step 1) like any question:
sign-in, tier and the quota pre-check all apply. They skip steps 2–3 and continue at step 4 with
intent "Explain" scoped to M5 or M15. With no typed question to detect a language from, the reply is
written in the language of the user's interface setting. Stale data is flagged in the packet before
any prompt is built.

### 4.3 Sixteen languages

English is the single pivot for routing and retrieval; the answer is written in the user's language
([ADR-038]).

Question (any of 16) → translate to English with a fixed trading glossary → route and retrieve
against one English corpus → answer in the user's language (§5).

- **Never translated:** prices and numbers; level names (UOEDT, LOEDT, baseline, `sr_n`); state codes
  and rule ids; symbol and timeframe names.
- **The glossary:** one entry per trading term per language (buy / sell, stop loss, take profit,
  entry zone, stand aside…); used both ways; versioned with the corpus.
- **Tested per language:** the labelled question set covers all 16; each language within 5 points of
  English ([ADR-044]).

The language list is owned by §7.9.

### 4.4 Sensor board

Every request carries the whole board ([ADR-040]):

```
SENSOR BOARD · XAUUSD · 18 SEP 20:55 · DAY TRADER
SYN    VALID   Rule 1 · C counter-trend rally · LONG · counter-trend
MCD1   VALID   M15 downtrend; sustained breach above the upper band
MCD2   VALID   M5 uptrend; price inside the corridor
MCD3   VALID   M15 and M5 trends disagree; stand aside on its own
MCD4…          future sensors appear here as they are switched on
DATA   FRESH   cycle 20:55 · last price 4377.99 at 20:55:05
```

1. Always sent: about 600–800 tokens for 15 sensors.
2. Warnings can't be routed out: any sensor opposing the synthesis bias, or saying stand aside, also
   gets its full reading ([ADR-041]).
3. The primary sensor is always in full: MCD1 for Day Traders, MCD2 for Scalpers ([ADR-041]).
4. Unavailable is said out loud: INVALID and STALE sensors are listed, never dropped.

### 4.5 Dispatch matrix (routing v1)

Rules first ([ADR-036]); vector routing may be added later only if it beats the rules on the
labelled set. Eight intent labels ([ADR-037]):

| Intent         | Example                   | Sensors in full (M\*)                               | Knowledge domains                        |
| -------------- | ------------------------- | --------------------------------------------------- | ---------------------------------------- |
| Direction      | "Buy or sell now?"        | Primary sensor + any opposing or stand-aside sensor | D3 synthesis · D2 playbooks for M\* · D5 |
| Entry timing   | "Where should I enter?"   | Sensors that supplied the zones                     | D2 · D3                                  |
| Exit / targets | "Where do I take profit?" | Sensors with levels on the target side              | D2 · D4 risk                             |
| Risk / sizing  | "How big should I go?"    | Board only                                          | D4 · D5 governance                       |
| Explain        | "What is LOEDT?"          | The sensor that owns the term                       | D1 foundations                           |
| News           | "Anything big today?"     | Board + upcoming events                             | D5 blackout protocol                     |
| Report 2       | "Make the trade setup"    | Opens the Section 6 flow                            | none                                     |
| Out of scope   | "Analyse BTC on H4"       | Nothing: fixed reply                                | none                                     |

Plus always: the whole board and the SYN reading.

### 4.6 Knowledge corpus and index

| Domain | Name                 | Written from                                           |
| ------ | -------------------- | ------------------------------------------------------ |
| D1     | Foundations          | MCD specs, the 103-column reference, indicator maths   |
| D2     | Single-MCD playbooks | One playbook per MCD, from its spec and state register |
| D3     | Synthesis            | The rules table explained, archetypes, conflicts       |
| D4     | Risk                 | Engine 4 maths, stops behind structure, caution sizing |
| D5     | Governance           | Invariants, single-order scope, news blackouts         |

Drafted from existing specs; Davin approves each domain before its first build ([ADR-042]).

Built on every deploy ([ADR-005]):

1. Front-matter on every chunk: `id`, `domain`, `mcd_id`, `state_codes`, `timeframe`, `version`.
2. One tag list (`tags.yaml`): the build fails on any unknown domain, MCD or state code.
3. Whole sections: split on `##` / `###`; merge under 200 tokens, split over 1,500.
4. Local files: txtai content + hybrid index, saved with a build id.
5. Tests before release: below the bar (§4.8), the deploy stops.

Embedding model: an English MiniLM-class model ([ADR-045]).

Reference code: `seed-code/txtai/` (read-only) holds the txtai 9.5.0 source (`src/python/txtai/`),
its `docs/` and examples, among them `30_Embeddings_SQL_custom_functions.ipynb` and
`48_Benefits_of_hybrid_search.ipynb`. Pin the installed txtai version to the one the index is built
and tested with; after any upgrade, re-check the two behaviours in §4.7.

### 4.7 Retrieval

txtai's `search()` has no filter argument, so filtering is done in SQL alongside `similar()` with
bound parameters:

```python
# 1. constructed query, not the raw message
q = f"{INTENT_TEMPLATE[intent]} | {state_codes} | {question_en}"

# 2. whitelisted ids only, each bound separately
ids = [m for m in m_star if m in MCD_REGISTRY]
doms = DOMAINS_FOR[intent]            # from tags.yaml
p = {"q": q, **{f"m{i}": m for i, m in enumerate(ids)},
            **{f"d{i}": d for i, d in enumerate(doms)}}

# 3. filter in SQL alongside similar()
sql = f"""SELECT id, text, mcd_id, domain, score
  FROM txtai WHERE similar(:q, 40)
  AND (mcd_id IN ({ph("m", ids)})
       OR domain IN ({ph("d", doms)}))
  LIMIT 4"""
hits = embeddings.search(sql, parameters=p)
```

Top 4, then cross-referenced chunks only while the knowledge budget allows (§5.4). Order:
foundations → playbook → synthesis → risk; each chunk keeps its id and the index build id.

**Hybrid weighting, as txtai 9.5.0 does it** (`embeddings/search/base.py` in the seed copy):

- A single `weights` value `w` gives `w` to the dense (meaning) score and `1 − w` to the keyword
  score, so file A's 70/30 meaning-to-keyword split is `weights=0.7`.
- txtai adds the weighted **scores** only when the keyword index returns normalised scores
  (`"normalize": true` in its `scoring` configuration). Otherwise it fuses by **rank** (reciprocal
  rank fusion), and 70/30 would weight rank positions, not scores. The index is therefore built with
  normalisation on.

### 4.8 Labelled question set

One test asset for Sections 4 and 5: real questions (from beta users and Davin) in all 16
languages, each labelled with the expected intent, M\* and the chunk ids a good answer needs. Run on
every deploy against the new index and dispatch matrix; below the bar, the deploy stops.

Bars ([ADR-044], starting values): intent and M\* match ≥ **90%** · recall@4 ≥ **0.8** · every
language within **5 points** of English · stand-aside or opposing sensors present in full **100%**.

### 4.9 The intake packet (handoffs)

| To    | What                  | Form                                                         | Replaces                  |
| ----- | --------------------- | ------------------------------------------------------------ | ------------------------- |
| 5     | Question              | English text + original text + language code                 | The raw message only      |
| 5     | Intent                | One label from the fixed list                                | Nothing                   |
| 5     | Sensor board          | Synthesis line + one line per sensor                         | Only routed sensors       |
| 5     | Readings in full      | Envelopes for M\*, plus the SYN reading and zones            | Raw output files          |
| 5     | Knowledge pack        | Up to 4 chunks + expansions, with ids and index build id     | Unfiltered search results |
| 5 · 6 | Profile + data status | Trader type, style, limits; FRESH / DELAYED / STALE / CLOSED | Nothing                   |
| 7     | Trace                 | Language, intent, M\*, chunk ids, build id, cycle slot       | Nothing                   |

Section 5 does not reach back into market tables or the index.

### 4.10 Keep, change, add, remove

- **Keep:** tier, quota and thread gate; XAUUSD and M5 / M15 scope with fixed replies; instant
  prompts; five knowledge domains; txtai with local index files and hybrid search.
- **Change:** routing by dispatch matrix, not vector similarity; retrieval query built from context;
  filtering in SQL with whitelisted ids; the gate also checks data status and profile.
- **Add:** language detection, English pivot and glossary; intent labels; sensor board on every
  request; corpus front-matter and `tags.yaml`; labelled question set and deploy gate.
- **Remove:** α / θ similarity thresholds; embedding raw numeric commentary; router rows for modules
  never built; the `filter` argument txtai lacks.

### 4.11 Done when

- Every request carries the board: synthesis line and all sensors, including unavailable ones.
- A test where only MCD3 says stand aside still delivers MCD3's full reading.
- Routing and recall per language within 5 points of English, for all 16.
- Other symbols and timeframes get the fixed reply in the user's language; nothing else runs.
- The SQL retrieval runs on the real txtai index with bound, whitelisted ids.
- The index is built with keyword-score normalisation on and searched with `weights=0.7`; a test
  fails if either setting changes.
- A corpus change that drops recall below 0.8 stops the deploy.
- A STALE cycle is flagged in the packet before any prompt is built.
- An instant prompt with too little quota is refused at the gate, before any model call, and its reply
  is in the user's interface language.
- Each answer's trace names its language, intent, M\*, chunk ids and index build.

### 4.12 Decisions

[ADR-036] dispatch matrix · [ADR-037] eight intents · [ADR-038] English pivot · [ADR-039] one
small model call · [ADR-040] sensor board · [ADR-041] always in full · [ADR-042] corpus authorship ·
[ADR-043] retrieval query · [ADR-044] test thresholds · [ADR-045] embedding model · [ADR-046]
out-of-scope check.

---

## 5. Prompt & AI reply

The second half of every request: fit the context into a fixed budget, get one answer from a tested
model, and check every number and phrase before anyone sees it. Recommendations: C1, D3 (P1), C2,
F1, F2, F3; applies D1.

### 5.1 Scope

**Owns:** the answer gate; the context assembler; the model gateway (registry, capability flags,
evaluation suite); Report 1 (structured JSON, rendered in the user's language); reply checks (numbers
and wording); metering and follow-ups.

**Receives:** the intake packet (§4.9); 1 day of OHLC, last price, chart and data status (§1); full
readings and measured statistics (§2); SYN reading and zones (§3); profile (§6); entitlements and
quota (§7.3).

**Hands on to:** Section 6 (Report 1 JSON: direction from synthesis, chosen zone ids, cycle);
Section 7 (units charged, trace, stage timings, check results); the chat UI (rendered replies).

### 5.2 Reply path

| Step | Name              | What happens                                                                                            |
| ---- | ----------------- | ------------------------------------------------------------------------------------------------------- |
| 1    | Answer gate       | Data status decides what may be said; the chart is kept only if its cycle matches ([ADR-051])           |
| 2    | Assemble          | Intake packet and cycle data fitted into fixed caps; cut in a set order when over ([ADR-048])           |
| 3    | Order for caching | Static rules → shared cycle block → this user's part ([ADR-049])                                        |
| 4    | Model call        | A model that passed the evaluation suite returns Report 1 JSON or a short answer ([ADR-052], [ADR-055]) |
| 5    | Check numbers     | Every literal price, distance, percentage and time matched to the context ([ADR-053])                   |
| 6    | Check wording     | Phrase list in the user's language; invalidation line present ([ADR-056])                               |
| 7    | Render            | Values filled by id; data stamp and disclaimer added; in the user's language                            |
| 8    | Meter + trace     | Actual cost charged in units; trace and stage timings to Section 7 ([ADR-050])                          |

Only step 4 calls a model. A failed check sends the reply back to step 4 once, naming what failed.
Direction is never produced in step 4: it is copied from the SYN reading in step 7.

### 5.3 Answer gate (what each data status allows)

| Data status        | Direction and zones              | Other questions          | Chart sent to the model   | Report 2 (§6)            |
| ------------------ | -------------------------------- | ------------------------ | ------------------------- | ------------------------ |
| FRESH              | Yes                              | Yes                      | Yes, if its cycle matches | Allowed                  |
| DELAYED            | Yes, with the delay stated       | Yes                      | Yes, if its cycle matches | Allowed, delay stated    |
| STALE              | No: "data stopped at hh:mm"      | Explain and general only | No                        | Blocked                  |
| MARKET CLOSED      | Last session's picture, labelled | Yes                      | Last session's, labelled  | Blocked                  |
| RETUNING (ADR-015) | Yes, sensors CAUTIONARY          | Yes                      | Yes, if its cycle matches | Half risk pre-set (§6.4) |

Also: a chart from another cycle is dropped and the reply says the chart is missing; INVALID or
STALE sensors are listed as unavailable ([ADR-040]); an unavailable news calendar is said out loud,
never read as "no news"; every reply is stamped "data as of hh:mm UTC" in the user's language.

### 5.4 Context budget

Caps in tokens, starting values to re-measure per model ([ADR-048]). The cut order applies when a
request is over its total. Sensors opposing the synthesis or saying stand aside keep their full
reading ([ADR-041]).

| Component                     | Cap        | Where it sits         | When over                              | Cut order |
| ----------------------------- | ---------- | --------------------- | -------------------------------------- | --------- |
| System rules + wording guide  | 1,500      | Static prefix, cached | Never cut                              | —         |
| Sensor board + synthesis line | 800        | Cycle block           | Never cut                              | —         |
| OHLC, 1 day, compact          | 8,000      | Cycle block           | Summary mode, ≈ 500                    | 3         |
| Chart image                   | ≈ 1,500    | After the cycle block | Dropped only by the gate or tier       | —         |
| Readings for M\* + zones      | 2,000      | This user's part      | Details dropped; warnings kept in full | 4         |
| Knowledge chunks              | 2,000      | This user's part      | Expansions, then chunk 4               | 2         |
| Profile + upcoming events     | 500        | This user's part      | Never cut                              | —         |
| Chat history                  | 1,500      | This user's part      | Older turns become a summary           | 1         |
| Question                      | 300        | This user's part      | Never cut                              | —         |
| Answer (max output)           | 1,500      | —                     | The schema keeps it short              | —         |
| **Total at every cap**        | **19,600** |                       | Typical first message ≈ 16,000–18,000  |           |

The profile in the prompt carries trader type, style and limits, never the equity balance or
commission ([ADR-077]).

**Prompt order for caching** ([ADR-049]): static rules and wording guide (identical for everyone)
→ the cycle block (board, SYN, OHLC; identical for every user of that trader type in that cycle) →
the chart → this user's part. Cached where the model supports it.

### 5.5 1-day OHLC, compact form

Keeps [ADR-003] and rule 4 (288 closed M5 + 96 closed M15 bars) and changes only the format
([ADR-047]):

```
DATA AS OF 18 SEP 20:55 UTC · XAUUSD · CLOSED BARS
DAY  open 4331.40  high 4391.20  low 4318.75
M5 · 288 bars · from 17 Sep 19:55 · step 5 min
o h l c
4331.40 4333.15 4330.60 4332.85
…
-- market break 17 Sep 21:00 to 22:00 --
…
M15 · 96 bars · same day · step 15 min
…
LAST PRICE 4377.99 at 20:55:05 (forming, not a close)
```

(Illustrative prices except the last price.) One header per timeframe instead of a timestamp on every
bar; gap lines mark market breaks; the day line carries the values most often quoted; the block is
shared and cached.

Measured size for 288 M5 + 96 M15 bars, on synthetic bars with one public tokenizer (o200k_base; each
model differs, so re-measure per model): JSON with a timestamp per bar ≈ 16,900 tokens · CSV with a
timestamp per bar ≈ 13,100 · **compact ≈ 7,700** · summary mode ≈ 460. **Summary mode** = the day
line + the last 12 M5 and 8 M15 bars, used only when a cap forces it.

### 5.6 Metering and quotas

At file D's metering, a first full-context message of ≈ 18,000 tokens costs:

| Model (file D)                       | Multiplier | Units     | Messages on Pro 500k | On Free 50k |
| ------------------------------------ | ---------- | --------- | -------------------- | ----------- |
| Gemini 3.6 Flash · DeepSeek V4 Flash | 1.0×       | ≈ 18,000  | 27                   | 2           |
| GLM-5.2                              | 2.5×       | ≈ 45,000  | 11                   | 1           |
| Kimi K3                              | 3.0×       | ≈ 54,000  | 9                    | 0           |
| GPT 5.6 Terra                        | 8.0×       | ≈ 144,000 | 3                    | 0           |
| Claude Sonnet 5                      | 10.0×      | ≈ 180,000 | 2                    | 0           |

File D's "300+ messages a month" assumed ≈ 1,500 units a message. Rules ([ADR-050]):

1. **Units follow actual cost:** each call is charged from the gateway's reported cost, so cached
   input costs the user less. Multipliers become display-only.
2. **Reserve before calling:** the assembled prompt + maximum output is priced first; if it exceeds
   the balance, nothing is sent (replaces "remaining > 0").
3. **Cost shown in the picker:** each model shows its measured units per message.
4. **Tier amounts from measurement**, by the method in §7.3 ([ADR-073]).

### 5.7 Report 1 as data (`report1.v1`)

The model writes the words; the numbers come from the engines ([ADR-052]). The model returns JSON
checked against the schema; values in braces are ids that the renderer fills.

```json
{
  "headline": "Counter-trend rally inside the M5 corridor; M15 still falling",
  "zones": ["Z1"],
  "rationale": [
    { "text": "M5 holds above {MCD2.baseline}", "cites": ["MCD2"] },
    { "text": "Breach above the M15 upper band", "cites": ["MCD1"] }
  ],
  "watch": [
    {
      "text": "A close below {Z1.invalidation} cancels this view",
      "cites": ["Z1"]
    }
  ],
  "risks": [
    { "text": "MCD3 says stand aside", "cites": ["MCD3"] },
    { "text": "Less room to {MCD2.UOEDT} than the stop", "cites": ["Z1"] }
  ]
}
```

The server adds: **direction** and archetype copied from SYN (e.g. "LONG · counter-trend rally ·
rule 1"); every value by id (`{MCD2.baseline}` → 4367.25); the data stamp; the disclaimer (fixed,
reviewed text per language). Text fields are written in the user's language; ids, level names and
state codes stay untranslated.

Report 1 sections: 1 Summary (synthesis reading for the trader type) · 2 M15 vs M5 alignment · 3
Levels (channel geometry, context levels) · 4 Entry zones with invalidation and room · 5 What would
change the picture · 6 Risks and news (Pillar 8 rules: a null forecast means "not published"; no
events means say nothing; a non-zero `time_mode` means the time is approximate). Removed: the WACS
score and MCD density in the last N bars ([ADR-001], [ADR-002], [ADR-003]).

### 5.8 Number check

Every number in a reply must exist in its context ([ADR-053]):

1. **Extract** prices, $ distances, percentages, ratios and times; locale formats (4 377,99;
   4.377,99) normalised.
2. **Match** against the context set: ±$0.05 on prices and dollar distances; statistics and times
   exact.
3. **Regenerate once**, naming the numbers that failed.
4. **Flag:** a number still unmatched is shown as "—, not verified" and logged.

The context set: the day line and the last price; every level in the envelopes and zones; distances
from the last price to each level and zone; profile values and the user's own inputs; event times;
statistics with their n. Single OHLC bar values are left out: a day of bars covers almost every
price in the day's range to within $0.05, so matching against them would pass nearly anything.
Example: "support near 4350.72" against M5 LOEDT 4350.22 is off by $0.50 → regenerated. Violation
rates go to the Section 7 dashboard. Report 2's numbers come from Engine 4 and are checked the same
way.

### 5.9 Wording guide

Decision support, said the same way in 16 languages ([ADR-056]):

| Always                                          | Never                                                                   |
| ----------------------------------------------- | ----------------------------------------------------------------------- |
| Conditional phrasing: "if price holds above …"  | "Advice", "we recommend you buy"                                        |
| The invalidation level with every direction     | Unmeasured probabilities or grades: "82%", "GRADE S", "high-conviction" |
| The data stamp on every reply                   | "Guaranteed", "100% accurate", "hallucination-free", "risk-free"        |
| Statistics only with their n ([ADR-022])        | Urgency: "act now", "don't miss"                                        |
| Stand-aside said plainly when synthesis says so | News that isn't in the events feed                                      |

Checked how: phrase lists in all 16 languages, versioned with the glossary; run with the number check
on every reply; a second failure replaces the reply with a short fixed answer built from the sensor
board; the same words are fixed in the documentation, marketing and seed idea; counsel in each
target market reviews the guide (not yet done, see Appendix D).

### 5.10 Models and the evaluation suite

The registry stays in `config/ai-models.ts` and gains capability flags and an evaluation record:
`slug`, `multiplier` (display only), `vision`, `context_tokens`, `json_schema`, `prompt_caching`,
`languages_ok` (of 16), `units_per_msg`, `eval_run` (id + date), `status` (candidate → passed →
retired). Only passed models appear in the picker.

| Test                    | Pass when                                               | Bar        |
| ----------------------- | ------------------------------------------------------- | ---------- |
| Golden scenarios (§7.7) | Direction = synthesis; zone ids valid; stand-aside kept | 100%       |
| Schema                  | Valid `report1.v1` after at most one retry              | 100%       |
| Numbers                 | No unverified number shown                              | 100%       |
| Wording                 | No listed phrase in any language                        | 100%       |
| Languages               | All 16 within 5 points of English                       | 16 / 16    |
| Cost and time           | Units per message and p90 time recorded                 | Feeds §5.6 |

Run on every model or prompt change. At launch: one default model and one fallback from another
provider, both passed; file D's six models start as candidates ([ADR-055]). Providers are restricted
to those that don't train on or keep prompts ([ADR-077]).

### 5.11 Follow-ups and speed

- **Same cycle:** the cycle block is identical, so it is served from the cache; the chart is resent
  only if the question is about the chart ([ADR-057]).
- **New cycle:** a fresh cycle block, and the reply opens with what changed (built by code from the
  two cycles' envelopes): "data updated 21:00 UTC: MCD2 left the corridor".
- **History:** the last **10** messages; older turns as a running summary of at most 300 tokens;
  reports kept as their JSON, not re-sent as prose. (Settles file D's 20 vs 10.)

Replies are shown after their checks, with progress stages on screen ([ADR-054]). Time budget per
stage (p90, starting values):

| Stage                      | Target     |
| -------------------------- | ---------- |
| Gate + understand (§4)     | ≤ 1.0 s    |
| Snapshot + retrieval       | ≤ 0.2 s    |
| Chart from R2, in parallel | ≤ 0.2 s    |
| Assemble + cache order     | ≤ 0.05 s   |
| Model: first token         | ≤ 3 s      |
| Model: Report 1 complete   | ≤ 10 s     |
| Checks + render            | ≤ 0.3 s    |
| **Report 1 end to end**    | **≤ 15 s** |

Short chat answers ≤ 8 s. One regeneration adds a model call; its rate is tracked.

### 5.12 Keep, change, add, remove

- **Keep:** OpenRouter gateway and `config/ai-models.ts`; dual report; Pillar 8 news rules; sessions
  API, auto-title, quota meter.
- **Change:** units from actual cost with the worst case reserved; Report 1 contents (synthesis and
  zones replace WACS and density); history 10 messages + summary; picker lists passed models only.
- **Add:** answer gate; caps and a cut order; Report 1 as checked JSON; number and wording checks;
  evaluation suite; time budget.
- **Remove:** pillars 1–4 (NL2SQL, density, storyline, WACS); prices typed by the model; unmeasured
  probabilities and grades; "100% accurate", "hallucination-free".

### 5.13 Handoffs

| To  | What                | Form                                                                                | Replaces                     |
| --- | ------------------- | ----------------------------------------------------------------------------------- | ---------------------------- |
| 6   | Report 1 result     | `report1.v1` JSON: direction from synthesis, chosen zone ids, cycle slot            | Prose the modal would parse  |
| 6   | Trade-setup request | Opens the modal with the same cycle and zone ids                                    | Nothing                      |
| UI  | Rendered reply      | Checked card in the user's language, values by id, stamp and disclaimer             | A streamed, unchecked answer |
| 7   | Usage               | Units charged per call, cached and uncached tokens, model                           | Tokens × multiplier          |
| 7   | Trace               | Model and prompt version, tokens per component, gate and check results, stage times | Nothing                      |
| 7   | Violations          | Number and wording failures, for the dashboard                                      | Nothing                      |
| 4   | Missed knowledge    | Questions answered without a relevant chunk, for the corpus backlog                 | Nothing                      |

### 5.14 Done when

- An over-long history or knowledge pack is cut in the set order; the board and warnings never are.
- A request whose worst case exceeds the balance is refused before the model is called.
- A STALE test cycle gets no direction; the reply says when the data stopped.
- A chart from another cycle is dropped and the reply says so.
- A planted wrong price is caught, regenerated, then flagged; the rate is on the dashboard.
- Listed phrases are caught in each of the 16 languages' test replies.
- On every golden scenario, Report 1's direction equals the synthesis reading.
- Units per first message and per follow-up are measured per model and feed §7.3.

### 5.15 Decisions

[ADR-047] OHLC delivery · [ADR-048] caps · [ADR-049] prompt order · [ADR-050] metering ·
[ADR-051] answer gate · [ADR-052] Report 1 as JSON · [ADR-053] number check · [ADR-054] show after
checks · [ADR-055] models at launch · [ADR-056] wording · [ADR-057] follow-ups.

---

## 6. Engine 4 & Report 2

Turn one checked reading into one sized, single-order setup: offered only when it is safe to size,
built on structure, calculated exactly, and recorded with the trader's consent. Recommendations: D2,
E3 (P1), D4, E2, E4; uses E1 (§3.6). No language model writes any number in Report 2.

### 6.1 Scope

**Owns:** the Engine 4 profile (8 metrics, confirmation, history); the offer check; the modal and its
validator; the sizing maths; the badge; the consent record.

**Receives:** data status, last price, events and broker specs (§1); CAUTIONARY status and reasons
(§2); SYN reading and zones with invalidation and runway (§3); Report 1 JSON (§5); entitlements
(§7).

**Hands on to:** Section 5 (whether Report 2 is available, and why not); Section 7 (consent records,
trace, validator results); the chat UI (modal definition, Report 2).

### 6.2 The profile (unchanged from file E, with fixes)

| #   | Metric                                   | Options                                             | Default         |
| --- | ---------------------------------------- | --------------------------------------------------- | --------------- |
| 1   | Type of trader                           | Scalper (< 2 h) · Day Trader (< 12 h)               | Day Trader      |
| 2   | Trading style                            | Trend Following · Trend Countering · Both           | Trend Following |
| 3   | Max risk per trade (commission included) | 0.5% – 2.0% in steps                                | 1.50%           |
| 4   | Maximum leverage                         | 1:1.0 – 1:3.0 presets or custom, **ceiling 1:5.0**  | 1:1.5           |
| 5   | Target RRR (commission included)         | 1.50× – 3.50×; **≤ 2.50× for counter-trend styles** | 1.75×           |
| 6   | Current equity balance                   | Numeric ($)                                         | $5,000          |
| 7   | Min stop-loss distance                   | Numeric ($)                                         | $13.00          |
| 8   | Round-trip commission                    | Numeric ($ per lot)                                 | $4.00           |

Kept: confirmation at the start of every session and after mid-session edits; `user_trade_preferences`
plus the append-only `user_trade_preferences_history`; single-order scope; the calculation-tool
position (no suitability assessment); AI badge and provenance metadata. Fixes: the profile has **8**
metrics everywhere (files D and E §4 say 9); the "Lookback Window: Fixed 54-Bar Standard" line is
removed ([ADR-003]); the counter-trend caps follow the **setup** as well as the profile ([ADR-064]);
the equity input in the modal is pre-filled from the profile.

### 6.3 Flow

| Step | Name            | What happens                                                                                                   |
| ---- | --------------- | -------------------------------------------------------------------------------------------------------------- |
| 1    | Offer check     | Direction, data status, blackout and setup validity decide whether Report 2 is offered, or why not ([ADR-058]) |
| 2    | Pre-fill        | Direction from synthesis; zone prices; structural stops; risk halved if CAUTIONARY; equity from the profile    |
| 3    | Validate        | One validator for the modal and for chat ([ADR-067])                                                           |
| 4    | Size            | Lot from broker specs; declared and actual risk; stop price; leverage used                                     |
| 5    | Targets + badge | Three scenarios; room to the next opposing level; badge from synthesis ([ADR-063])                             |
| 6    | Render          | Fixed template in the user's language, with the single-order notice ([ADR-068])                                |
| 7    | Consent         | Accept · Modify · Decline; "you place the order with your broker"                                              |
| 8    | Record          | Consent record and trace to Section 7 ([ADR-069])                                                              |

### 6.4 Offer check

Runs before Report 1 is shown (so Report 1 can say whether Report 2 is available) and again when the
modal is submitted. Report 2 stays pinned to the cycle Report 1 used ([ADR-059]).

| Condition                                  | Report 2                   | What the reply says                                  |
| ------------------------------------------ | -------------------------- | ---------------------------------------------------- |
| Synthesis LONG or SHORT, cycle FRESH       | Offered                    | —                                                    |
| Cycle DELAYED                              | Offered                    | The delay: "data as of 20:50 UTC"                    |
| Sensors CAUTIONARY, or cycle RETUNING      | Offered, half risk pre-set | The reason, and that the trader may override         |
| Setup outside the trader's style           | Offered, with a notice     | "Counter-trend setup; your style is trend following" |
| A newer cycle changed the synthesis        | Refresh offered            | "The picture changed at 21:00 UTC"                   |
| Synthesis NEUTRAL or STAND_ASIDE           | Not offered                | The synthesis reason                                 |
| Cycle STALE or MARKET CLOSED               | Not offered                | "Data stopped at hh:mm" or "market closed"           |
| Tier-1 release within ±15 minutes          | Not offered                | The release, and when the window ends                |
| Price already past the zone's invalidation | Not offered                | "This setup is no longer valid"                      |

### 6.5 Stops, targets and the badge (E2)

- **Stop options** ([ADR-062]): distances from entry to each structural invalidation level at or
  beyond Min SLD, plus "custom". No fixed $13–21 pills.
- **Room to the next level:** a target past the next opposing level is never recommended; the level
  is named.
- **Badge** ([ADR-063]), from synthesis and room; a badge only goes to a scenario whose target sits
  before the next level:

| Condition                                           | Badge        |
| --------------------------------------------------- | ------------ |
| No scenario fits before the next level              | No badge     |
| Counter-trend or conflict                           | Conservative |
| With the trend; room ≥ Normal RRR                   | Normal       |
| With the trend on M5 and M15; room ≥ Aggressive RRR | Aggressive   |

Example (18 Sep, Day Trader, Z1): entry 4367.25; stop option A 4349.72 ($17.53, below M5 LOEDT);
option B 4278.71 ($88.54, below M15 UOEDT); next opposing level M5 UOEDT 4384.28, room 17.03 =
0.97 × stop. Conservative (1.50×) needs a target distance of ≈ 26.40 → target ≈ 4393.6, past the
level → no badge; Report 2 names 4384.28. A default profile (Trend Following) also sees the
counter-trend notice, and the 2.50× cap applies.

### 6.6 News blackout (D2) and defect flag (D4)

**Blackout** ([ADR-060]): no Report 2 from 15 minutes before to 15 minutes after file A's Tier-1
releases — US CPI, Core PCE, FOMC rate decision, NFP. The list is a versioned config file keyed on
MT5 calendar event ids (not names). Events come from `economic_events`, live since 11 Sep: MT5's
own calendar, exported every 15 minutes, converted from broker server time (measured GMT+3 in
September) to UTC, stored append-only.

- Approximate time (`time_mode` ≠ 0): the window widens to **±60 minutes**.
- Other HIGH-impact USD releases inside the trader's holding window (2 h Scalper, 12 h Day Trader): a
  warning, not a block.
- Calendar not exported for 45 minutes: the blackout still applies from the last known schedule, and
  the calendar's age is shown (§7.6).
- Tests: releases at −16, −14, +14 and +16 minutes give allowed, blocked, blocked, allowed; the test
  also passes across the broker's clock change (US daylight saving ends early November).

**Defect flag** ([ADR-061]): the SYN reading carries CAUTIONARY and its reason (the MCD0 gate or
RETUNING). The modal pre-selects half the trader's risk % (e.g. 1.50% → 0.75%) with the reason
beside it. The trader may choose any value up to Max RPT; the override and the reason shown are
stored in the consent record. A flagged channel and a promote in progress behave the same way.

### 6.7 Sizing maths

Contract figures come from `symbol_specs` (§6.9); the formulas below use 100 oz a lot for
readability.

| Step                    | Formula                                                                   |
| ----------------------- | ------------------------------------------------------------------------- |
| 1 Max lot from leverage | Max lot = (Max leverage × Equity) ÷ (Entry × 100)                         |
| 2 Lot at the stop       | Lot@SLD = (RPT × Equity) ÷ (SLD × 100 + Commission per lot)               |
| 3 Effective lot         | min(Max lot, Lot@SLD), **rounded down** to the lot step; never rounded up |
| 4 Leverage used         | (Lot × 100 × Entry) ÷ Equity; must be ≤ Max leverage                      |
| 5 Declared risk         | RPT × Equity                                                              |
| 6 Actual risk           | Lot × (SLD × 100 + Commission per lot)                                    |
| 7 Stop price            | BUY: Entry − SLD · SELL: Entry + SLD                                      |
| 8 Target distance       | RRR × SLD + Commission × (RRR + 1) ÷ 100                                  |
| 9 Target price          | BUY: Entry + distance · SELL: Entry − distance                            |
| 10 Net profit           | Lot × 100 × distance − Commission × Lot = **RRR × actual risk**           |

**RRR definition** ([ADR-065]): the RRR shown is exactly net profit ÷ actual loss, both after
commission and rounding. Report 2 shows declared and actual risk side by side. Checks use exact
values; display rounds to 2 decimals.

Scenarios: Normal = Target RRR; Conservative = one notch lower; Aggressive = one notch higher (capped
at 2.50× for counter-trend setups).

**Worked example, corrected** (file G §6 inputs: equity $10,000; BUY 2,545.00; risk 1.00%; stop
$15.00; commission $4 a lot round trip): lot = min(cap, 100 ÷ 1,504 = 0.0665) → **0.06**; declared
risk $100.00; **actual risk $90.24 (0.90%)**; leverage used **1.527×** (file G prints 1.52×).

|                                            | Conservative 1.50×              | Normal 1.75×                    | Aggressive 2.00×                |
| ------------------------------------------ | ------------------------------- | ------------------------------- | ------------------------------- |
| As printed in file G: target / net         | 2,568.10 / $138.60              | 2,572.00 / $162.00              | 2,575.75 / $184.50              |
| File G's formulas, applied: target / net   | 2,567.54 / $134.98              | 2,571.29 / $157.48              | 2,575.04 / $179.98              |
| **This document: distance / target / net** | **$22.60 / 2,567.60 / $135.36** | **$26.36 / 2,571.36 / $157.92** | **$30.12 / 2,575.12 / $180.48** |

This table is a unit-test fixture. Note: with the default Max leverage of 1:1.5, the leverage cap
would clamp this example to 0.05 lot; the example assumes a higher maximum.

### 6.8 Lots below the broker minimum

File G's case: $500 equity · 0.50% risk = $2.50 · $15.00 stop · $4 commission → 0.0017 lot; one 0.01
lot would lose $15.04 (3.01%). Never round up to the minimum. The help offered stays inside the
trader's limits:

| File G option          | Revised                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| 1 Raise risk to 3.01%  | Shown only when the needed risk is at or under Max RPT (here 3.01% > 2.00%, so not offered)      |
| 2 Tighten the stop     | Only a nearer structural stop at or beyond Min SLD; no arbitrary tightening                      |
| 3 Set equity to $3,008 | Removed as a button; shown as a fact: "this setup needs at least $3,008 of equity at 0.50% risk" |
| 4 Decline              | Kept                                                                                             |

Equity is the trader's real balance; the report never suggests entering a different number.

### 6.9 Broker figures (`symbol_specs`)

Filled by the collector (§1.4) from the MT5 terminal that runs the export indicators, daily and on
change; Engine 4 reads the latest row and records its version in the consent record ([ADR-066]).

| Field                     | Source                                                                   |
| ------------------------- | ------------------------------------------------------------------------ |
| `contract_size`           | `SYMBOL_TRADE_CONTRACT_SIZE`                                             |
| `volume_min / step / max` | `SYMBOL_VOLUME_MIN / _STEP / _MAX`                                       |
| `tick_size`               | `SYMBOL_TRADE_TICK_SIZE`                                                 |
| `typical_spread`          | Median of `SYMBOL_SPREAD` per cycle                                      |
| `swap_long / swap_short`  | `SYMBOL_SWAP_LONG / _SHORT`                                              |
| `commission`              | The trader's input (profile metric 8); MT5 does not expose it per symbol |
| `captured_at`, `version`  | Recorded with each setup                                                 |

Chart prices are bid: a BUY fills on the ask; a SELL's stop and target trigger on the ask. The typical
spread is applied where each price triggers and the report shows the spread used. A Day Trader setup
that can cross the daily rollover shows the swap for its lot. Per-broker profiles come later; the
default is the feed broker's specs. `symbol_specs` older than 7 days → Report 2 not offered (§7.6).

### 6.10 One validator, one template

Values typed in chat (e.g. "risk 1.2%, stop $18.50, RRR 2.85") are extracted by Section 4 and only
pre-fill the modal; the trader confirms each input; nothing is computed from free text alone
([ADR-067]). The same checks run for both paths:

| #   | Check                                                     |
| --- | --------------------------------------------------------- |
| 0   | Entry within the 1-day bound ([ADR-034]); ±5% typo filter |
| 1   | Risk % ≤ Max RPT                                          |
| 2   | Stop ≥ Min SLD; structural or "custom"                    |
| 3   | RRR ≤ 2.5× when the setup is counter-trend                |
| 4   | Leverage used ≤ Max leverage (lot clamped)                |
| 5   | No Tier-1 release within the window                       |
| 6   | Setup still valid; data status allows it                  |
| 7   | Lot ≥ the broker minimum, or the underflow help (§6.8)    |

Report 2 is a fixed template ([ADR-068]): numbers from Engine 4 only; labels and the disclaimer from
reviewed text in 16 languages; declared and actual risk side by side; the single-order scope notice
on every report.

### 6.11 Consent record and audit

One append-only row for every Accept, Modify and Decline ([ADR-069]):

```
action          ACCEPT | MODIFY | DECLINE
user            id, replaced by an HMAC hash after account deletion
cycle_slot      "2026-09-18T20:55Z"
synthesis       rule id + rules version
zone            "Z1"
profile         snapshot id
inputs          side, entry, equity, risk, stop
outputs         lot, declared + actual risk, stop, targets, badge
overrides       defect flag, style notice
warnings        releases in the holding window
versions        Engine 4, symbol_specs, template, disclaimer
language, recorded_at
```

Account deletion follows file E §4.4: personal data is deleted; history and consent rows keep the
hashed id. This requires removing `ON DELETE CASCADE` from
`user_trade_preferences_history.user_id` (today it would delete the audit trail with the account).
The button "Accept & Ready to Execute" becomes "Accept setup", with "you place the order with your
broker" (DavinTrade places no orders). Retention: §7.5.

### 6.12 Keep, change, add, remove

- **Keep:** 8 profile metrics and the confirmation card; leverage ceiling 1:5 and counter-trend RRR
  cap; sizing steps (round down, never up); three scenarios; accept / modify / decline;
  single-order scope notice.
- **Change:** stop pills → structural stop options; badge from synthesis and room; RRR = net profit ÷
  actual loss; chat setups pre-fill the modal; underflow help within limits.
- **Add:** the offer check; blackout and defect-flag rules; `symbol_specs`; declared and actual risk;
  the consent record; fixture tests.
- **Remove:** WACS thresholds in the badge; the 54-bar line on the profile card; the "Set equity to …"
  button; `ON DELETE CASCADE` on history; "Ready to Execute" wording.

### 6.13 Handoffs

| To  | What                    | Form                                                                    | Replaces                     |
| --- | ----------------------- | ----------------------------------------------------------------------- | ---------------------------- |
| 5   | Report 2 availability   | Offered or not, with the reason, before Report 1 is shown               | Offered after every Report 1 |
| UI  | Modal definition        | Direction, zone prices, stop options, pre-set risk with reasons, bounds | Fixed pills                  |
| UI  | Report 2                | Template in the user's language; declared and actual risk; disclaimer   | A model-written report       |
| 7   | Consent record          | One append-only row per accept, modify or decline                       | A transcript line            |
| 7   | Trace                   | Validator results, overrides, Engine 4 and `symbol_specs` versions      | Nothing                      |
| 1   | Request: `symbol_specs` | Filled by the collector from MT5, daily and on change                   | Constants in code            |
| 7   | Request: retention      | One figure for profile history and consent records                      | Two figures (files D, E)     |

### 6.14 Done when

- Releases at −16, −14, +14 and +16 minutes give allowed, blocked, blocked, allowed.
- The corrected table runs as a unit test; this document and the code agree.
- A CAUTIONARY cycle pre-sets half the risk; an override shows in the consent record.
- On the 18 Sep example no badge is given and 4384.28 is named.
- No offered underflow option exceeds Max RPT or asks for a different equity.
- The same setup typed in chat and entered in the modal gives identical results.
- Changing contract size or lot step in `symbol_specs` changes the lot with no code change.
- Deleting a test account keeps its hashed history and consent rows.

### 6.15 Decisions

[ADR-058] when Report 2 is offered · [ADR-059] setup freshness · [ADR-060] news blackout ·
[ADR-061] defect flag · [ADR-062] stop options · [ADR-063] badge · [ADR-064] style mismatch ·
[ADR-065] RRR definition · [ADR-066] broker figures · [ADR-067] chat-typed setups · [ADR-068] Report
2 production · [ADR-069] consent.

---

## 7. Platform & governance

What holds the other six together: one source of truth, one entitlement table, one trace per answer,
and a defined response to every failure. Recommendations: G1 (P1), G2, G3, G4, G5.

### 7.1 Scope

**Owns:** this document and the decision log; the entitlement table and quota method; the trace,
audit storage and retention; degraded modes; golden scenarios and the release gate; operations
(dashboard, alerts), prompt privacy and the language list.

**Receives:** cycle and push health (§1); sensor and rules versions (§2, §3); trace fields (§4, §5,
§6); usage, units and check results (§5); consent records and validator results (§6).

**Hands on to:** every section (tiers, retention, failure responses); the build pipeline
(golden-scenario results on every change).

### 7.2 Source of truth

([ADR-070], [ADR-071])

```
CLAUDE.md                 → navigation matrix points Stack D work here
docs/
  STACK-D-ARCHITECTURE.md   this file; one chapter per section
  MCD-DEVELOPMENT-STANDARD.md            how every MCD is specified, built and switched on
  MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md  order of work and agent task cards for MCDs
  handoffs/                              one hand-off report per agent session
  STACK-D-BUILD-USER-MANUAL.md           Davin's steps and prompts for the whole build
  STACK-D-ADVISOR-BRIEF.md               standing instructions for Davin's advisor (Antigravity)
  adr/
    README.md               index of all decisions
    001-….md … 082-….md     one file per decision
davintrade-stack-d-and-e/
  STACK-D-REVISED-ARCHITECTURE-00…07.pptx  the eight section decks
  engine-1-5-new/mcdN/      each MCD's spec, code, tests and manifest
  archive/                  the eight superseded documents (each with a SUPERSEDED banner),
                            the review and the rev-3 deck
```

Rules:

- One home per fact: a rule lives in one chapter and is referenced, never restated.
- A change to a settled decision is a **new** decision file that names the one it replaces; the old
  file's status becomes "Superseded by ADR-nnn". This document is then updated in the same change.
- The decks `STACK-D-REVISED-ARCHITECTURE-00…07` are the record of how the decisions were reached;
  this document is what to build from.
- Names by function, old engine numbers kept as aliases (table in "How to use this document").

### 7.3 Entitlements and the quota method

One table in config, read by the session gate, the chart route, the modal and the model picker
([ADR-074]). Every value is Davin's to change.

| Feature                            | Free                                   | Pro                              | Sources before this document                                                    |
| ---------------------------------- | -------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------- |
| AI chat and Report 1               | Recorded demo conversation ([ADR-072]) | Yes, monthly units               | File A, deployed UI: Pro only · file D: Free 50k tokens · file I: Free 20 a day |
| Report 2 (trade setup)             | —                                      | Yes                              | Not tiered in file G                                                            |
| Chart image sent to the model      | —                                      | Yes                              | File D §10: Pro only                                                            |
| Chart download · M5-on-M15 overlay | —                                      | Yes                              | R2 manifest: Free refused                                                       |
| Session clock and news countdown   | —                                      | Yes                              | Seed `/free` page; news manifest §6.1                                           |
| Model choice                       | —                                      | Passed models only ([ADR-055])   | File D §7: six models                                                           |
| Chat history                       | —                                      | 12 months, deletable ([ADR-076]) | File D §3                                                                       |

The recorded demo is a real golden-scenario conversation replayed from storage, so it costs nothing
per view.

**Pro quota** ([ADR-073]): monthly units = (Pro price × the share Davin allows for model spend) ÷
measured cost per unit ([ADR-050]). Davin sets the share; measurement supplies the cost. No token
number is published until the first measurement run.

### 7.4 Trace

One row per answer ([ADR-075]), written by Sections 4, 5 and 6 (each fills its own fields; nothing
is written twice):

| Group     | Fields                                                                         |
| --------- | ------------------------------------------------------------------------------ |
| Request   | request id · user (hashed after deletion) · tier · language · intent · session |
| Data      | cycle slot · data status · sensor statuses · synthesis rule and version        |
| Knowledge | M\* · chunk ids · index build id                                               |
| Model     | model · prompt version · tokens per component · cached tokens · units charged  |
| Checks    | answer gate · number and wording results · regenerations                       |
| Risk      | Engine 4 inputs and outputs · validator results · overrides · consent action   |
| Time      | duration of every stage ([ADR-054])                                            |

Storage: a `request_traces` table, 90 days in PostgreSQL, then archived with the consent records.
Read by support ("open request id"), the dashboard and audits.

### 7.5 Retention and privacy

([ADR-076], [ADR-077])

| Data                               | Kept                             | Where                |
| ---------------------------------- | -------------------------------- | -------------------- |
| Consent records                    | 7 years                          | Write-once archive   |
| Traces (with both reports as JSON) | 90 days live, then 7 years       | PostgreSQL → archive |
| Profile history                    | 7 years, hashed after deletion   | PostgreSQL           |
| Chat transcripts                   | 12 months; the trader can delete | PostgreSQL           |
| Account personal data              | Until the account is deleted     | PostgreSQL           |

One figure, 7 years, for everything that shows what a trader was told and chose (the longer of file
D's 7 years and file E's 5–7). Transcripts are not needed for that, because the trace keeps both
reports; file D's 7-year write-once storage of every transcript is dropped.

What a model provider sees:

1. Only what Report 1 needs: trader type, style and limits; never the equity balance or commission.
2. Only providers that don't train on or keep prompts, set in the gateway.
3. The privacy notice names the processors.
4. Deletion as file E §4.4: personal data removed; audit rows keep a hash.

Counsel should confirm the figures and the notice for each target market (Appendix D).

### 7.6 Degraded modes

Every failure has one defined response, and each row has a golden scenario ([ADR-078]):

| Failure                               | Response                                                              | From              |
| ------------------------------------- | --------------------------------------------------------------------- | ----------------- |
| Market data STALE                     | No direction, no Report 2; other questions answered; stop time stated | ADR-051 · ADR-058 |
| Market closed                         | Last session's picture, labelled; no Report 2                         | ADR-051 · ADR-058 |
| Sensor INVALID or STALE               | Listed as unavailable; left out of synthesis                          | ADR-040           |
| Chart missing or from another cycle   | Text-only answer; the missing chart is stated                         | ADR-051           |
| Promote in progress (RETUNING)        | Sensors CAUTIONARY; half risk pre-set                                 | ADR-015 · ADR-061 |
| Model provider down                   | Fallback model; if both fail, a fixed answer from the sensor board    | ADR-055           |
| Quota exhausted                       | Refused before any model call; balance shown                          | ADR-050           |
| Knowledge index won't load            | Report 1 from sensor data, flagged; Report 2 unaffected               | ADR-078           |
| News calendar not exported for 45 min | Blackout still applied from the last known schedule; age shown        | ADR-078           |
| `symbol_specs` older than 7 days      | Report 2 not offered until the specs refresh                          | ADR-078           |

### 7.7 Golden scenarios and the release gate

About **24** stored cycles, each with expected outputs approved by Davin: sensor envelopes, SYN
reading, zones, Report 1 checks (direction = synthesis, zone ids valid) and Report 2 numbers
([ADR-079]). Coverage: every synthesis rule (0–5, 3s, no match) for both trader types; every data
status (FRESH, DELAYED, STALE, MARKET CLOSED, RETUNING); every caution (MCD0 CAUTIONARY, style
mismatch, no room — the 18 Sep cycle); every block (a Tier-1 release, a price past invalidation);
account edges (an underflow account, the leverage clamp); clock edges (a weekend, the broker's clock
change). Real cycles can be captured only once the v6 pipeline writes to production; until then the
18 Sep test cycle is scenario 1 and the rest come from point-in-time replay.

The release gate (any failure stops the deploy; run on every change to sensors, rules, prompts,
models, the corpus or Engine 4):

| Asset                  | Tests                               | Defined in       |
| ---------------------- | ----------------------------------- | ---------------- |
| Golden scenarios       | Whole cycle to Report 2             | §7.7             |
| Labelled question set  | Routing and retrieval, 16 languages | §4.8             |
| Model evaluation suite | A model joins only after passing    | §5.10            |
| Engine 4 fixtures      | Worked example, blackout, underflow | §6.7, §6.6, §6.8 |
| Point-in-time replay   | Sensor certification                | §2.8             |

### 7.8 Operations

One admin page built from the trace, cycle and consent tables, and five alerts ([ADR-080]).

Panels: **Pipeline** (cycle ready time, STALE and DELAYED counts, push throughput vs demand) ·
**Sensors + synthesis** (INVALID rate per sensor, rule hit counts, NEUTRAL rate) · **Answers**
(number and wording violations, regenerations, stage times) · **Cost** (units per message by model,
daily spend, quota use by tier) · **Setups** (Report 2 offered and blocked by reason; accept, modify,
decline) · **Languages** (questions and routing accuracy per language).

| Alert                | Fires when (starting values)            |
| -------------------- | --------------------------------------- |
| Cycles STALE         | 2 in a row in market hours              |
| Calendar export late | None for 45 minutes                     |
| Checks failing       | Violations above 2% of replies in a day |
| Spend                | Daily model cost above budget           |
| Gateway              | Errors or a growing push backlog        |

### 7.9 Languages

Sixteen languages, one list, from `lib/i18n/dictionaries` (17 files; English as `en-US` and
`en-GB`) ([ADR-081]):

Arabic `ar` (RTL) · Chinese Simplified `zh` · Chinese Traditional `zh-TW` · English `en-US` / `en-GB` ·
French `fr` · German `de` · Hindi `hi` · Indonesian `id` · Japanese `ja` · Korean `ko` · Portuguese
`pt` · Spanish `es` · Thai `th` · Turkish `tr` · Urdu `ur` (RTL) · Vietnamese `vi`.

- **Must exist in all 16 before release:** disclaimers; out-of-scope replies ([ADR-046]); reasons
  Report 2 isn't offered ([ADR-058]); consent buttons ([ADR-069]); wording phrase lists
  ([ADR-056]); the trading glossary ([ADR-038]); Report 2 labels ([ADR-068]).
- **May fall back to English:** ordinary interface labels.
- **Right-to-left:** Arabic and Urdu reports render right-to-left, prices left-to-right. Number
  formats are applied by the renderer and normalised by the number check (§5.8).

### 7.10 Build order and roadmap

| #   | Section | Build                        | Notes                                                                             | Done when |
| --- | ------- | ---------------------------- | --------------------------------------------------------------------------------- | --------- |
| 1   | 7       | This document + decision log | Done with this version                                                            | —         |
| 2   | 1       | Pipeline in production       | Cycles, manifest, data status, `symbol_specs`; every later step needs real cycles | §1.8      |
| 3   | 2       | Sensor worker                | Envelope, MCD0, point-in-time replay                                              | §2.11     |
| 4   | 3       | Synthesis and zones          | First golden scenarios captured                                                   | §3.10     |
| 5   | 6       | Engine 4 and Report 2        | Deterministic; fixtures first                                                     | §6.14     |
| 6   | 4       | Intake and knowledge         | Glossary, corpus, index, labelled set                                             | §4.11     |
| 7   | 5       | Prompt and reply             | Assembler, checks, model evaluation                                               | §5.14     |

Alongside from step 4: trace, entitlements, dashboard, alerts, retention (chapter 7; done when §7.13).

**Running a build step (instructions for the agent).** Each step runs in two kinds of session, and
Davin's prompt says which one:

- **What to read.** `CLAUDE.md`, "How to use this document", chapter 0, the step's chapter and every
  decision entry it cites; for steps 3, 4 and 6 also the MCD walkthrough, Part D. Read other chapters
  only where the step's chapter points to them.
- **Session A, build.** First reply: a plan listing the files to create or change, any database
  migrations (written as files; Davin applies them to production), how each item of the step's "Done
  when" list will be shown (test name or command), and the decisions needed from Davin. If the step is
  too large for one session, the plan splits it into **parts**, each a coherent set of files and
  tests that one session can finish; the plan names the parts in order. Stop for his approval, then
  build the part the prompt names (part 1 if none). Finish with a table that maps each "Done when"
  item met so far to its evidence. Do not commit, push or apply production migrations.
- **Session B, check (a fresh session), once all parts are built.** Read the step's chapter. For each
  "Done when" item, check the evidence yourself: open the code, run the tests or commands. Report
  failures only, with file and line. Change nothing.
- **Every session ends with a hand-off report,** session A and session B alike, and so does every
  MCD task session (MCD walkthrough, Part E). Write it to
  `docs/handoffs/<YYYY-MM-DD>-<HHMM>-<task>.md` (no colons, so the name works on Windows), for
  example `2026-10-01-1430-step3-part2.md` or `2026-10-02-0915-mcd2-p3.md`. Davin gives it to his
  advisor, who writes the next session's prompt, so the report must stand on its own:

  ```markdown
  # Hand-off: <task> · <date> <time> UTC

  Session: A (build) | B (check) · Task: build step N part k | task Pn for MCDm

  1. Done in this session (one line each)
  2. Files changed (path · purpose)
  3. Tests and commands run, with results
  4. "Done when" or checklist items now met, with evidence
  5. Not finished: what remains, in order (the next part, or "none")
  6. Decisions needed from Davin, with the options seen
  7. Problems and surprises the next session must know
  8. State: last commit (or "not committed"), migrations written but not applied, services changed
  9. Suggested next task (e.g. "build step 3, part 3" or "session B for build step 3")
  ```

- **MCD work inside the steps** (MCD walkthrough, Part D): step 3 runs stages 4–5 (shadow,
  certification) for every MCD built so far; step 4 adds the rule rows their specs propose, as Davin
  accepts them; step 6 adds their dispatch-matrix rows, playbook and foundations chunks, glossary
  terms and reason texts. An MCD goes live (stage 7) only after step 6.

Later (roadmap): alerts to traders when a state changes (G5); memory of a trader's past setups and
outcomes (G5); each trader's own time zone on screen (G5); MCD4–MCD15 through the plug-in contract
(§2.9); per-broker specs ([ADR-066]); vector routing, only if it beats the rules ([ADR-036]).

### 7.11 Keep, change, add, remove

- **Keep:** a write-once archive for audit rows; hashed ids after deletion (file E); per-lane tests
  and mutation checks; AI badge and provenance metadata.
- **Change:** "newest wins" → one document; four tier answers → one table; two retention figures →
  one; engine numbers → names.
- **Add:** the decision log in the repository; a trace per answer; the degraded-mode table with
  tests; golden scenarios in CI; the dashboard and five alerts.
- **Remove:** transcripts in the 7-year archive; equity and commission in prompts; safety texts
  falling back to English; hand checks for chart staleness.

### 7.12 Handoffs

| To  | What              | Form                                                               | Replaces                |
| --- | ----------------- | ------------------------------------------------------------------ | ----------------------- |
| 4   | Entitlement table | Tier rules read by the session gate, chart route, modal and picker | Rules in four documents |
| 5   | Quota method      | Units a month from the model-spend share and measured cost         | 50k / 500k tokens       |
| 5   | Prompt privacy    | No equity or commission in prompts; provider allow-list            | Nothing                 |
| 6   | Retention figure  | 7 years for consent records, traces and profile history            | Two figures             |
| 1–6 | Degraded modes    | One table, each row with a test                                    | Behaviour per section   |
| 1–6 | Release gate      | Golden scenarios plus the four other test assets                   | Per-lane tests only     |
| All | Source of truth   | This document and `docs/adr/`                                      | Nine documents          |

### 7.13 Done when

- This document exists; the nine earlier documents carry the banner; `CLAUDE.md` points here.
- `docs/adr/` holds every decision, each with its status.
- Changing one tier value changes the gate, chart route, modal and picker.
- A request id opens its cycle, rule, chunks, model, checks and consent.
- A deleted test account leaves hashed audit rows and no personal data.
- Each degraded-mode row has a golden scenario that passes.
- The release fails if one of the 16 languages lacks a safety text.
- The blackout test passes across the broker's clock change.

### 7.14 Decisions

[ADR-070] source of truth · [ADR-071] engine names · [ADR-072] Free tier · [ADR-073] Pro quota ·
[ADR-074] entitlements · [ADR-075] trace · [ADR-076] retention · [ADR-077] prompt privacy ·
[ADR-078] degraded modes · [ADR-079] golden scenarios · [ADR-080] operations · [ADR-081] languages.

---

## Appendix A — Decision index

| #                                                                              | Decision                                                                                                 | Source              | Status  |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ------------------- | ------- |
| [001](adr/001-retire-engine-1-5c-wacs54.md)                                    | Engine 1.5C (WACS54) retired; replaced by the Engine 1.5E router                                         | File A · 29 Sep     | Settled |
| [002](adr/002-remove-jsonb54-and-freq54.md)                                    | JSONB54 and FREQ54 removed; MCD regime outputs carry the state                                           | 29 Sep              | Settled |
| [003](adr/003-per-mcd-windows-and-1-day-of-ohlc-instead-of-the-54-bar-rule.md) | 54-bar rule dropped: each MCD reads its own window; the LLM gets 1 day of M5 + M15 OHLC                  | 29 Sep              | Settled |
| [004](adr/004-two-panel-chart-in-private-r2.md)                                | Engine 3 = 2-panel M5 / M15 PNG, overlay and standard variants, private R2                               | 10–11 Sep manifests | Settled |
| [005](adr/005-knowledge-index-as-local-txtai-files.md)                         | Engine 2 index = local txtai files, rebuilt on every deploy                                              | 29 Sep              | Settled |
| [006](adr/006-charts-rendered-on-a-schedule.md)                                | Charts are rendered on a schedule, never on demand (<120 ms retrieval budget)                            | R2 manifest §8      | Settled |
| [007](adr/007-finalise-the-architecture-section-by-section.md)                 | Architecture finalised section by section, one deck per section                                          | 29 Sep              | Settled |
| [008](adr/008-cycle-key-is-the-5-minute-slot-time.md)                          | Stack D cycle key = 5-minute slot time (UTC); collection cycle ids kept as provenance                    | Section 1 · 29 Sep  | Settled |
| [009](adr/009-cycle-manifest-and-ready-signal.md)                              | Push worker sends a cycle manifest; the gateway checks it, writes market_cycles and triggers Section 2   | Section 1 · 29 Sep  | Settled |
| [010](adr/010-active-indicator-setting-per-timeframe.md)                       | Active indicator = admin setting per timeframe, effective from a slot (M15 non_b, M5 best_fit_a)         | Section 1 · 29 Sep  | Settled |
| [011](adr/011-still-open-bar-kept-out-of-sensors-and-ohlc.md)                  | Still-open bar kept out of sensors and OHLC; exposed once as a labelled last price                       | Section 1 · 29 Sep  | Settled |
| [012](adr/012-freshness-thresholds.md)                                         | Cycle ready ≤ 2 min (≤ 4 with retries); STALE after 10 min                                               | Section 1 · 29 Sep  | Settled |
| [013](adr/013-newest-bars-pushed-first.md)                                     | The cycle’s newest bars are pushed first; throughput measured alongside                                  | Section 1 · 29 Sep  | Settled |
| [014](adr/014-chart-rendered-on-the-vps-stamped-and-kept.md)                   | Charts stay rendered on the VPS, stamped per slot, last good image kept                                  | Section 1 · 29 Sep  | Settled |
| [015](adr/015-retuning-during-a-promote.md)                                    | A promote marks cycles RETUNING until the re-pushed window completes; sensors report CAUTIONARY          | Section 1 · 1 Oct   | Settled |
| [016](adr/016-sensor-worker-on-railway.md)                                     | Sensor worker runs on Railway, started by Section 1’s cycle-ready job                                    | Section 2 · 29 Sep  | Settled |
| [017](adr/017-mcd-output-envelope-v1.md)                                       | Every MCD returns envelope v1; bias = LONG · SHORT · NEUTRAL · STAND_ASIDE                               | Section 2 · 29 Sep  | Settled |
| [018](adr/018-quality-gate-becomes-mcd0.md)                                    | The 4-Quadrant gate becomes MCD0 per timeframe; channel MCDs inherit its CAUTIONARY                      | Section 2 · 29 Sep  | Settled |
| [019](adr/019-r-squared-threshold-per-model.md)                                | R² thresholds per model: A ≥ 0.70, B ≥ 0.65 (file C)                                                     | Section 2 · 29 Sep  | Settled |
| [020](adr/020-live-readings-vs-certification-history.md)                       | Live readings on market_data_v6; certification on point-in-time replay                                   | Section 2 · 29 Sep  | Settled |
| [021](adr/021-mcd3-reads-mcd1-and-mcd2-readings.md)                            | MCD3 reads MCD1 / MCD2 readings from the same cycle instead of recomputing them                          | Section 2 · 29 Sep  | Settled |
| [022](adr/022-minimum-sample-before-quoting-a-number.md)                       | A state’s numbers are quoted only with n ≥ 30 per state and horizon, always shown with n                 | Section 2 · 29 Sep  | Settled |
| [023](adr/023-mcd1-same-slope-breakout-on-the-latest-bar.md)                   | MCD1 same-slope breakout fires on the latest bar (certified behaviour); mcd1.md corrected                | Section 2 · 29 Sep  | Settled |
| [024](adr/024-neutral-state-names.md)                                          | Neutral state names; no probability words until measured                                                 | Section 2 · 29 Sep  | Settled |
| [025](adr/025-rules-decide-direction.md)                                       | Direction comes from the synthesis rules table; the LLM explains and can’t override stand-aside          | Section 3 · 29 Sep  | Settled |
| [026](adr/026-rules-file-format.md)                                            | Rules: ordered, versioned file; first match wins; no match = NEUTRAL, logged; draft as a start           | Section 3 · 29 Sep  | Settled |
| [027](adr/027-synthesis-runs-in-the-sensor-worker.md)                          | Synthesis runs in the sensor worker right after Section 2, in the same cycle                             | Section 3 · 29 Sep  | Settled |
| [028](adr/028-two-trader-type-readings-per-cycle.md)                           | Two synthesis readings per cycle: Day Trader (M15 + M5) and Scalper (M5)                                 | Section 3 · 29 Sep  | Settled |
| [029](adr/029-precedence-ladder.md)                                            | Precedence follows file A’s ladder; derived sensors modify, don’t vote                                   | Section 3 · 29 Sep  | Settled |
| [030](adr/030-support-and-resistance-as-context-levels.md)                     | sr_1–sr_16 used as context levels until an S&R sensor exists                                             | Section 3 · 29 Sep  | Settled |
| [031](adr/031-zone-half-width.md)                                              | Zone half-width = 10% of the source channel width; overlapping zones merge                               | Section 3 · 29 Sep  | Settled |
| [032](adr/032-invalidation-price.md)                                           | Invalidation = $0.50 beyond the next structural level, never under $13                                   | Section 3 · 29 Sep  | Settled |
| [033](adr/033-modal-price-pills-from-zones.md)                                 | Modal price pills = one reference price per zone, best first; fewer if fewer qualify                     | Section 3 · 29 Sep  | Settled |
| [034](adr/034-custom-entry-bound.md)                                           | Custom entry within the 1-day range widened by half its height; ±5% stays as a typo filter               | Section 3 · 29 Sep  | Settled |
| [035](adr/035-no-confidence-grades.md)                                         | No confidence grades until state statistics exist                                                        | Section 3 · 29 Sep  | Settled |
| [036](adr/036-routing-v1-is-a-dispatch-matrix.md)                              | Routing v1 = dispatch matrix (intent × states) + labelled set; vector routing only if it wins            | Section 4 · 29 Sep  | Settled |
| [037](adr/037-eight-intent-labels.md)                                          | Fixed list of eight intent labels; instant prompts carry their own                                       | Section 4 · 29 Sep  | Settled |
| [038](adr/038-english-pivot-for-16-languages.md)                               | English pivot with a trading glossary; the answer comes back in the user’s language                      | Section 4 · 29 Sep  | Settled |
| [039](adr/039-one-small-model-call-to-understand-the-question.md)              | One small model call returns language, English text, intent, symbols and timeframes                      | Section 4 · 29 Sep  | Settled |
| [040](adr/040-sensor-board-on-every-request.md)                                | Sensor board = synthesis line + every sensor; unavailable sensors listed as such                         | Section 4 · 29 Sep  | Settled |
| [041](adr/041-warnings-and-the-primary-sensor-always-in-full.md)               | Primary sensor and any opposing or stand-aside sensor always sent in full                                | Section 4 · 29 Sep  | Settled |
| [042](adr/042-knowledge-corpus-authorship.md)                                  | Corpus drafted from existing specs; you approve each domain before its first build                       | Section 4 · 29 Sep  | Settled |
| [043](adr/043-retrieval-query-built-from-context.md)                           | Retrieval query = intent template + state codes + English question                                       | Section 4 · 29 Sep  | Settled |
| [044](adr/044-routing-and-retrieval-test-thresholds.md)                        | Tests: routing ≥ 90% · recall@4 ≥ 0.8 · every language within 5 points of English                        | Section 4 · 29 Sep  | Settled |
| [045](adr/045-embedding-model.md)                                              | Embedding model stays an English MiniLM-class model                                                      | Section 4 · 29 Sep  | Settled |
| [046](adr/046-deterministic-out-of-scope-check.md)                             | Deterministic out-of-scope check before any reasoning; fixed replies in 16 languages                     | Section 4 · 29 Sep  | Settled |
| [047](adr/047-one-day-of-ohlc-in-compact-form.md)                              | 1-day OHLC sent in full, compact form, shared and cached; summary only when a cap forces it              | Section 5 · 29 Sep  | Settled |
| [048](adr/048-context-caps-and-cut-order.md)                                   | Caps per prompt component; cut history → knowledge → OHLC → sensor details; board and warnings never cut | Section 5 · 29 Sep  | Settled |
| [049](adr/049-prompt-order-for-caching.md)                                     | Prompt order: static rules → shared cycle block → this user’s part, cached where supported               | Section 5 · 29 Sep  | Settled |
| [050](adr/050-metering-from-actual-cost.md)                                    | Units from each call’s actual cost; worst case reserved before calling; tiers set from measurement       | Section 5 · 29 Sep  | Settled |
| [051](adr/051-answer-gate-by-data-status.md)                                   | Answer gate by data status; a chart from another cycle is dropped; every reply stamped                   | Section 5 · 29 Sep  | Settled |
| [052](adr/052-report-1-as-structured-json.md)                                  | Report 1 = report1.v1 JSON; direction copied from synthesis; values filled by id                         | Section 5 · 29 Sep  | Settled |
| [053](adr/053-number-check-on-every-reply.md)                                  | Every number matched to the context within $0.05; regenerate once, then flag                             | Section 5 · 29 Sep  | Settled |
| [054](adr/054-replies-shown-after-their-checks.md)                             | Replies shown only after their checks, with progress stages; Report 1 ≤ 15 s p90                         | Section 5 · 29 Sep  | Settled |
| [055](adr/055-models-at-launch.md)                                             | Launch with one default and one fallback model, both passing the evaluation suite                        | Section 5 · 29 Sep  | Settled |
| [056](adr/056-wording-guide-in-16-languages.md)                                | Wording guide and phrase lists in 16 languages, checked on every reply; counsel review                   | Section 5 · 29 Sep  | Settled |
| [057](adr/057-follow-ups-and-chat-history.md)                                  | Follow-ups reuse the cached cycle block; changes stated; history = 10 messages + summary                 | Section 5 · 29 Sep  | Settled |
| [058](adr/058-when-report-2-is-offered.md)                                     | Report 2 offered only with a synthesis direction on a usable cycle, outside a blackout; else the reason  | Section 6 · 30 Sep  | Settled |
| [059](adr/059-setup-pinned-to-its-cycle.md)                                    | Setup pinned to Report 1’s cycle; refused past invalidation; a changed synthesis offers a refresh        | Section 6 · 30 Sep  | Settled |
| [060](adr/060-news-blackout.md)                                                | Blackout ±15 min around file A’s Tier-1 list (±60 if approximate); other releases warn                   | Section 6 · 30 Sep  | Settled |
| [061](adr/061-defect-flag-halves-the-pre-set-risk.md)                          | CAUTIONARY pre-sets half the risk with the reason; override allowed and logged                           | Section 6 · 30 Sep  | Settled |
| [062](adr/062-structural-stop-options.md)                                      | Stop options = distances to structural invalidation levels ≥ Min SLD, plus custom                        | Section 6 · 30 Sep  | Settled |
| [063](adr/063-badge-from-synthesis-and-room.md)                                | Badge from the synthesis table and room to the next level; no badge when nothing fits                    | Section 6 · 30 Sep  | Settled |
| [064](adr/064-counter-trend-caps-follow-the-setup.md)                          | Setup outside the trader’s style: offered with a notice; counter-trend caps follow the setup             | Section 6 · 30 Sep  | Settled |
| [065](adr/065-rrr-definition.md)                                               | RRR = net profit ÷ actual loss, after commission; declared and actual risk both shown                    | Section 6 · 30 Sep  | Settled |
| [066](adr/066-broker-figures-from-mt5.md)                                      | symbol_specs from MT5; spread applied where each price triggers; swap shown for Day Traders              | Section 6 · 30 Sep  | Settled |
| [067](adr/067-chat-typed-setups-pre-fill-the-modal.md)                         | Chat-typed setups pre-fill the modal; one validator for both paths                                       | Section 6 · 30 Sep  | Settled |
| [068](adr/068-report-2-is-a-fixed-template.md)                                 | Report 2 = Engine 4 + a fixed template in 16 languages; no model writes it                               | Section 6 · 30 Sep  | Settled |
| [069](adr/069-consent-record.md)                                               | Consent record per action; “Accept setup”; history kept, hashed, after deletion                          | Section 6 · 30 Sep  | Settled |
| [070](adr/070-one-architecture-document-and-decision-log.md)                   | One architecture document from the seven decks; docs/adr/; SUPERSEDED banners on files A–I               | Section 7 · 30 Sep  | Settled |
| [071](adr/071-engines-named-by-function.md)                                    | Engines named by function; old engine numbers kept as aliases                                            | Section 7 · 30 Sep  | Settled |
| [072](adr/072-free-tier.md)                                                    | Free tier: no AI chat; a recorded demo conversation instead                                              | Section 7 · 30 Sep  | Settled |
| [073](adr/073-pro-quota-method.md)                                             | Pro quota = (Pro price × model-spend share) ÷ measured cost per unit                                     | Section 7 · 30 Sep  | Settled |
| [074](adr/074-one-entitlement-table.md)                                        | One entitlement table in config, read by every gate                                                      | Section 7 · 30 Sep  | Settled |
| [075](adr/075-one-trace-per-answer.md)                                         | One trace per answer; 90 days live, then archived with the audit rows                                    | Section 7 · 30 Sep  | Settled |
| [076](adr/076-retention.md)                                                    | Retention: 7 years for audit rows; chat transcripts 12 months, deletable                                 | Section 7 · 30 Sep  | Settled |
| [077](adr/077-prompt-privacy.md)                                               | No equity or commission in prompts; approved model providers only                                        | Section 7 · 30 Sep  | Settled |
| [078](adr/078-degraded-modes.md)                                               | One degraded-mode table; every row has a test                                                            | Section 7 · 30 Sep  | Settled |
| [079](adr/079-golden-scenarios.md)                                             | About 24 golden scenarios you approve, replayed on every change                                          | Section 7 · 30 Sep  | Settled |
| [080](adr/080-operations-dashboard-and-alerts.md)                              | One admin page and five alerts                                                                           | Section 7 · 30 Sep  | Settled |
| [081](adr/081-safety-texts-in-all-16-languages.md)                             | Safety texts in all 16 languages before release; right-to-left tested                                    | Section 7 · 30 Sep  | Settled |
| [082](adr/082-mcd-development-standard.md)                                     | Every MCD is built to MCD-DEVELOPMENT-STANDARD.md; one registry row per MCD in §2.13                     | Section 2 · 30 Sep  | Settled |

## Appendix B — Corrections to earlier material

| Where             | Said                                              | Correct statement                                                                                                                      |
| ----------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Rev-3 deck        | "SQLite staging + Python calc"                    | The Python calc stack was parked on 9 Sep. MQL5 computes every value; the collector validates and forwards                             |
| Rev-3 deck        | "Exports at second :59, every 5 minutes"          | Exports every minute at :59; the collector reads every 5 minutes at :05, and M15 every 15                                              |
| Review A2         | "No cycle identifier"                             | A collection `cycle_id` exists per timeframe and attempt; what was missing is one key across timeframes and a ready signal ([ADR-008]) |
| Review A3         | MCD2 and MCD3 disagree on test data               | Stronger: on live data every variant has data every cycle, so a "single active" check would always fail ([ADR-010])                    |
| Review, evidence  | MCD1–3 timestamps                                 | Not from the live pipeline; MCD evaluators read an Excel replica. The forming-bar finding rests on the pipeline documents              |
| Rev-3 deck        | "Contabo VPS"                                     | The blueprint names a Vultr Windows server; "Contabo" survives in folder names                                                         |
| Review B3         | Thai singled out                                  | DavinTrade serves 16 languages; B3 covers all 16 with English as the single pivot ([ADR-038])                                          |
| Review G4         | Block trade setups when the knowledge index fails | Report 2 does not use the index; only Report 1 is flagged (§7.6)                                                                       |
| Files D, E §4     | "9 constraints"                                   | Engine 4 has 8 metrics                                                                                                                 |
| File D §3 vs §10  | Chat buffer 20 vs 10 messages                     | 10 messages + a running summary ([ADR-057])                                                                                            |
| File D §7         | "300+ messages a month"                           | Assumed ≈ 1,500 units a message; a first full-context message is ≈ 16,000–18,000 tokens, up to 19,600 at every cap (§5.4, §5.6)        |
| File G §6         | Worked example                                    | Commission not subtracted; declared vs actual risk; corrected in §6.7                                                                  |
| File G §4.1       | Underflow options 1 and 3                         | Option 1 can exceed Max RPT; option 3 asks for an equity the account does not hold; revised in §6.8                                    |
| File E §5         | `ON DELETE CASCADE` on the preferences history    | Deletes the audit trail with the account; removed (§6.11)                                                                              |
| News manifest §10 | "the other 12 dictionaries"                       | `lib/i18n/dictionaries` now holds 17 files for 16 languages (§7.9)                                                                     |

## Appendix C — Superseded documents

On 30 September 2026 the superseded files were moved to
[`davintrade-stack-d-and-e/archive/`](../davintrade-stack-d-and-e/archive/). Each carries a banner pointing here. The content
stays for history; where it disagrees with this document, this document wins. Letters are those the
review used where they can be confirmed from the review's evidence; the two unlettered files are the
review's B and H.

| Letter | File                                                                                                                                                                                     | Superseded by                                                           |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| A      | [`archive/STACK-D-OKF-CONVERSATIONAL-AI-ARCHITECTURE-V2.md`](../davintrade-stack-d-and-e/archive/STACK-D-OKF-CONVERSATIONAL-AI-ARCHITECTURE-V2.md)                                       | Chapters 2–5                                                            |
| C      | [`archive/STACK-D-ENGINE-1.5A-1.5B-1.5C-ARCHITECTURE-PLAN.md`](../davintrade-stack-d-and-e/archive/STACK-D-ENGINE-1.5A-1.5B-1.5C-ARCHITECTURE-PLAN.md)                                   | Chapters 2–3 (MCD0 in §2.4; 1.5B and 1.5C retired)                      |
| D      | [`archive/STACK-D-CONVERSATIONAL-AI-CHART-ANALYSIS-ARCHITECTURE-V2.md`](../davintrade-stack-d-and-e/archive/STACK-D-CONVERSATIONAL-AI-CHART-ANALYSIS-ARCHITECTURE-V2.md)                 | Chapters 5 and 7                                                        |
| E      | [`archive/ENGINE-4-USER-CONSTRAINTS-AND-PREFERENCES-ARCHITECTURE.md`](../davintrade-stack-d-and-e/archive/ENGINE-4-USER-CONSTRAINTS-AND-PREFERENCES-ARCHITECTURE.md)                     | Chapter 6 (profile, compliance layer kept with fixes)                   |
| F      | [`archive/STACK-D-MASTER-MODIFICATION-PLAN.md`](../davintrade-stack-d-and-e/archive/STACK-D-MASTER-MODIFICATION-PLAN.md)                                                                 | This document                                                           |
| G      | [`archive/STACK-D-WORKFLOW-AND-WORK-PROCESS-IN-CREATING-TRADE-SETUP-REPORT.md`](../davintrade-stack-d-and-e/archive/STACK-D-WORKFLOW-AND-WORK-PROCESS-IN-CREATING-TRADE-SETUP-REPORT.md) | Chapter 6                                                               |
| I      | [`archive/STACK-D-EXECUTIVE-PRESENTATION-DECK.md`](../davintrade-stack-d-and-e/archive/STACK-D-EXECUTIVE-PRESENTATION-DECK.md)                                                           | This document and the revised decks                                     |
| —      | [`archive/STACK-D-CONVERSATIONAL-AI-CHART-ANALYSIS-ARCHITECTURE.md`](../davintrade-stack-d-and-e/archive/STACK-D-CONVERSATIONAL-AI-CHART-ANALYSIS-ARCHITECTURE.md) (v1)                  | Chapter 5 (file D already replaced it)                                  |
| —      | [`MARKET-DATA-V6-103-COLUMNS-AND-MQ5-INDICATORS-REFERENCE-EN.md`](../davintrade-stack-d-and-e/MARKET-DATA-V6-103-COLUMNS-AND-MQ5-INDICATORS-REFERENCE-EN.md) (not moved)                 | Still current as the column reference; architecture decisions live here |

Inputs to this document, archived with the files above:

| Input      | File                                                                                                                                                   | Role now                                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The review | [`archive/STACK-D-ARCHITECTURE-REVIEW-AND-RECOMMENDATIONS.md`](../davintrade-stack-d-and-e/archive/STACK-D-ARCHITECTURE-REVIEW-AND-RECOMMENDATIONS.md) | Source of recommendation IDs (A1, D1 …) and file letters; its recommendations were taken up section by section, with outcomes in [`adr/`](adr/README.md) |
| Rev-3 deck | [`archive/STACK-D-OPERATIONAL-WORKFLOW-EXECUTIVE-DECK.pptx`](../davintrade-stack-d-and-e/archive/STACK-D-OPERATIONAL-WORKFLOW-EXECUTIVE-DECK.pptx)     | The deck the review assessed; replaced by the eight revised decks                                                                                        |

Other sources stay current for their own scope: the MCD specs in `engine-1-5-new/` (as examples,
with the changes in §2.5 and the retrofit steps in
[MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md](MCD-RETROFIT-AND-CREATION-WALKTHROUGH.md)), the
data-collection blueprint v2.29, the terminal, frozen-baseline, chart and news manifests.

Background only, not instructions, until reviewed: the six design folders Davin keeps in
`seed-code/txtai/` (`CHAT-UI-MANAGEMENT`, `INCOMING-CHAT-ALERT_NOTIFICATIONS`, `MARKDOWN-MEMORY-AND-JSONL-TRANSCRIPT-ARCHITECTURE-DESIGN`, `RAG-SCALABILITY-AND_BOTTLENECK-MITTIGATION-DESIGN`, `CONVERSATIONAL-AI-TRADING-STRATEGY-RAG-MODEL` and `DYNAMIC-CHART-AND-CARD-DISPLAY`). They predate this document and overlap parts of it (chat sessions,
retention, memory, RAG storage, alerts to traders). Where they disagree with this document, this
document wins. They are reviewed before build step 4 (Appendix D); the review records here which
parts are kept, which are background and which are superseded. The txtai library source in the same
folder is reference code (§4.6).

## Appendix D — Open items

| Item                                                                                                       | Owner                       | Where               |
| ---------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------- |
| Resolve the four "documents disagree" status items against production                                      | Davin / Executor            | §0.5                |
| First real, measured cycle; confirm the ADR-012 thresholds                                                 | Executor                    | §1.8                |
| Write the rules table content (the draft is a starting point)                                              | Davin                       | §3.4                |
| Approve each knowledge domain before its first build                                                       | Davin                       | §4.6                |
| Set the model-spend share for the Pro quota; publish tier amounts after measurement                        | Davin                       | §7.3                |
| Counsel review: wording guide, disclaimers, consent wording, retention figures, privacy notice             | Davin + counsel             | §5.9, §6.11, §7.5   |
| Capture golden scenarios from live cycles once the pipeline runs                                           | Executor, approved by Davin | §7.7                |
| Measure token counts and cost per model; set caps per model                                                | Executor                    | §5.4, §5.10         |
| Review the six design folders in `seed-code/txtai/` against this document; record the result in Appendix C | Davin, with his advisor     | Before build step 4 |

<!-- decision links -->

[ADR-001]: adr/001-retire-engine-1-5c-wacs54.md
[ADR-002]: adr/002-remove-jsonb54-and-freq54.md
[ADR-003]: adr/003-per-mcd-windows-and-1-day-of-ohlc-instead-of-the-54-bar-rule.md
[ADR-005]: adr/005-knowledge-index-as-local-txtai-files.md
[ADR-008]: adr/008-cycle-key-is-the-5-minute-slot-time.md
[ADR-009]: adr/009-cycle-manifest-and-ready-signal.md
[ADR-010]: adr/010-active-indicator-setting-per-timeframe.md
[ADR-011]: adr/011-still-open-bar-kept-out-of-sensors-and-ohlc.md
[ADR-012]: adr/012-freshness-thresholds.md
[ADR-013]: adr/013-newest-bars-pushed-first.md
[ADR-014]: adr/014-chart-rendered-on-the-vps-stamped-and-kept.md
[ADR-015]: adr/015-retuning-during-a-promote.md
[ADR-016]: adr/016-sensor-worker-on-railway.md
[ADR-017]: adr/017-mcd-output-envelope-v1.md
[ADR-018]: adr/018-quality-gate-becomes-mcd0.md
[ADR-019]: adr/019-r-squared-threshold-per-model.md
[ADR-020]: adr/020-live-readings-vs-certification-history.md
[ADR-021]: adr/021-mcd3-reads-mcd1-and-mcd2-readings.md
[ADR-022]: adr/022-minimum-sample-before-quoting-a-number.md
[ADR-023]: adr/023-mcd1-same-slope-breakout-on-the-latest-bar.md
[ADR-024]: adr/024-neutral-state-names.md
[ADR-025]: adr/025-rules-decide-direction.md
[ADR-026]: adr/026-rules-file-format.md
[ADR-027]: adr/027-synthesis-runs-in-the-sensor-worker.md
[ADR-028]: adr/028-two-trader-type-readings-per-cycle.md
[ADR-029]: adr/029-precedence-ladder.md
[ADR-030]: adr/030-support-and-resistance-as-context-levels.md
[ADR-031]: adr/031-zone-half-width.md
[ADR-032]: adr/032-invalidation-price.md
[ADR-033]: adr/033-modal-price-pills-from-zones.md
[ADR-034]: adr/034-custom-entry-bound.md
[ADR-035]: adr/035-no-confidence-grades.md
[ADR-036]: adr/036-routing-v1-is-a-dispatch-matrix.md
[ADR-037]: adr/037-eight-intent-labels.md
[ADR-038]: adr/038-english-pivot-for-16-languages.md
[ADR-039]: adr/039-one-small-model-call-to-understand-the-question.md
[ADR-040]: adr/040-sensor-board-on-every-request.md
[ADR-041]: adr/041-warnings-and-the-primary-sensor-always-in-full.md
[ADR-042]: adr/042-knowledge-corpus-authorship.md
[ADR-043]: adr/043-retrieval-query-built-from-context.md
[ADR-044]: adr/044-routing-and-retrieval-test-thresholds.md
[ADR-045]: adr/045-embedding-model.md
[ADR-046]: adr/046-deterministic-out-of-scope-check.md
[ADR-047]: adr/047-one-day-of-ohlc-in-compact-form.md
[ADR-048]: adr/048-context-caps-and-cut-order.md
[ADR-049]: adr/049-prompt-order-for-caching.md
[ADR-050]: adr/050-metering-from-actual-cost.md
[ADR-051]: adr/051-answer-gate-by-data-status.md
[ADR-052]: adr/052-report-1-as-structured-json.md
[ADR-053]: adr/053-number-check-on-every-reply.md
[ADR-054]: adr/054-replies-shown-after-their-checks.md
[ADR-055]: adr/055-models-at-launch.md
[ADR-056]: adr/056-wording-guide-in-16-languages.md
[ADR-057]: adr/057-follow-ups-and-chat-history.md
[ADR-058]: adr/058-when-report-2-is-offered.md
[ADR-059]: adr/059-setup-pinned-to-its-cycle.md
[ADR-060]: adr/060-news-blackout.md
[ADR-061]: adr/061-defect-flag-halves-the-pre-set-risk.md
[ADR-062]: adr/062-structural-stop-options.md
[ADR-063]: adr/063-badge-from-synthesis-and-room.md
[ADR-064]: adr/064-counter-trend-caps-follow-the-setup.md
[ADR-065]: adr/065-rrr-definition.md
[ADR-066]: adr/066-broker-figures-from-mt5.md
[ADR-067]: adr/067-chat-typed-setups-pre-fill-the-modal.md
[ADR-068]: adr/068-report-2-is-a-fixed-template.md
[ADR-069]: adr/069-consent-record.md
[ADR-070]: adr/070-one-architecture-document-and-decision-log.md
[ADR-071]: adr/071-engines-named-by-function.md
[ADR-072]: adr/072-free-tier.md
[ADR-073]: adr/073-pro-quota-method.md
[ADR-074]: adr/074-one-entitlement-table.md
[ADR-075]: adr/075-one-trace-per-answer.md
[ADR-076]: adr/076-retention.md
[ADR-077]: adr/077-prompt-privacy.md
[ADR-078]: adr/078-degraded-modes.md
[ADR-079]: adr/079-golden-scenarios.md
[ADR-080]: adr/080-operations-dashboard-and-alerts.md
[ADR-081]: adr/081-safety-texts-in-all-16-languages.md
[ADR-082]: adr/082-mcd-development-standard.md
[ADR-083]: adr/083-mcd1-and-mcd2-windows-count-the-channels-closed-bars.md
