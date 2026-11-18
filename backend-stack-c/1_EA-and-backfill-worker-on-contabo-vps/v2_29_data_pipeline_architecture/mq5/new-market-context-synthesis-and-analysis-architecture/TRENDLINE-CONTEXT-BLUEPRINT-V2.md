# Trendline Context Blueprint v2 — Single Source of Truth

- **What this is:** the one reference for designing, building, testing and rolling out the trendline context pipeline. It
  replaces every earlier document on the subject (now in `archive/`, see §17.3).
- **Revision:** 3, 2026-11-16. The change log is Appendix C.
- **Status of the design:** complete enough to build from. Four decisions are **recommended and still waiting for Davin**
  (§3). Two of them need his explicit sign-off: Q1 (analyst text reaching the model) and Q6 (a dedicated API key).
- **Status of the code:** the repository still holds the first draft ("v1"). **Nothing in this document is built.** §17 says,
  file by file, what exists and what must change. Nothing has been deployed, migrated or run against live infrastructure.
- **It is a specification, not an order.** Work still follows the project's order lifecycle (PRE-DRAFT → DRAFT → APPROVED →
  CONFIRMED). An order cites sections of this document; it does not restate them.

**How to read it**

| You are                       | Read                                                            |
| ----------------------------- | --------------------------------------------------------------- |
| Davin, deciding               | §0, §3 (decisions), §5 (your workflow), §15 (rollout)           |
| The Advisor, writing an order | §3, §16 (build plan), §17 (state of the code), §18 (open items) |
| The Executor, building        | §4 to §14 for the phase in hand, then §16 and §17               |

**Rules of authority**

1. Where this document and an archived document differ, this document is right.
2. Where this document and the live code differ, **the live code is right** and this document is corrected in the same
   change (project non-negotiable 7).
3. A sentence marked **RECOMMENDED** is the Advisor's position, not a decision. A sentence marked **PROVISIONAL** is a
   number chosen to start with and replaced by measurement.
4. Anything in §18 is not yet verified. Do not build on it without the check named there.

---

## 0. Summary

An analyst (Davin) draws trend lines by hand in MetaTrader 5 on six timeframes (M3, M5, M15, M30, H1, H4), about every 8
hours. He labels each line, writes one short "session overview" and clicks **Publish**. The pipeline:

1. writes what he published to a file on the terminal's disk (§6),
2. uploads it to the gateway and the chart pictures to object storage (§7),
3. stores it, append-only, in PostgreSQL (§8, §9),
4. computes every 5 minutes where price is relative to each line (§10),
5. turns each label into structured fields (§11),
6. and lets the conversational AI read the result under strict rules (§12).

Two layers hold the data. **Layer 1 (policy)** is what the analyst wrote; it changes only at Publish. **Layer 2 (context)**
is computed by code every 5-minute cycle. The analyst's workload stays small, and every time-sensitive fact is computed
fresh and never typed by a person.

"Constellation" is the analyst's name for his M3 fractal-based narrow-channel technique. The stored value is always
**M3**; "Constellation" is never a value in any schema, contract or file.

---

## 1. Context for a reader with no project history

This is one data source inside the trading-alerts SaaS "DavinTrade", in the part called **Stack D**.

- **The 5-minute cycle.** Every 5 minutes MT5 indicators export OHLC and computed values. A collector on the VPS validates
  them and they are stored in PostgreSQL (`market_data_v6`). When a cycle's rows are complete the gateway marks the cycle
  READY (`market_cycles`) and adds a job to the `cycle-ready` queue. A sensor worker consumes that job, runs the
  **sensors** ("MCDs") and a **synthesis step** ("SYN"), and stores their readings append-only (`mcd_outputs`,
  `synthesis_readings`, `entry_zones`). The conversational AI answers from the stored readings of one cycle, a compact
  OHLC window and a knowledge corpus. It computes nothing per question.
- **One instrument.** The pipeline handles `XAUUSD` only (`READER_SYMBOL` in the gateway, `PACKET_SYMBOL` in the reply
  code). This design keeps a `symbol` column everywhere but accepts only that symbol in the first release.
- **ADR-025, "Rules decide, the model explains."** Bias, archetype and stand-aside come from the SYN rules table (content
  owned by Davin). The model explains them and can neither override stand-aside nor flip the bias. Any source that could
  influence a shown bias must enter through the rules table as a deliberate, versioned, owner-approved decision.
- **"No grades."** No numeric confidence, probability or letter grade is shown anywhere. This design has no such field.
- **The model writes words, never numbers.** In a reply a price is written as a placeholder, for example
  `{MCD2.baseline}`, and the server fills in the value. A check then rejects any number the model typed that is not a
  known value of the cycle.
- **Data recency.** Every reply is stamped "data as of hh:mm UTC". This design extends that to analyst content: a reader
  is always told how old the analyst's input is.
- **Stack C (MT5 to PostgreSQL).** MT5 indicators write local files; Python services on the VPS ship them to a
  Railway-hosted NestJS gateway over HTTP; the gateway writes to PostgreSQL through Prisma.
- **Two Prisma schemas.** `prisma/market-data/schema.prisma` (mirrored by `railway-gateway/prisma/schema.prisma`, which
  the gateway uses) and `prisma/non-market-data/schema.prisma` (monolith only). The monolith reads the market-data tables
  through `marketPrisma`.
- **Shadow and live rows.** A sensor's row carries a `flag` column, `shadow` or `live`. The reply code reads only `live`
  rows. This design uses the same mechanism (§4.3).

**What this is not:** it does not change the MCD/SYN pipeline and is not read by it. It is a new source that the reply
layer reads beside everything above.

---

## 2. Principles and guardrails

### 2.1 Two layers, two authors, two write-rates

Stated by the project owner:

> Human is a **policy maker / market strategist**: sets framework, policy and market overview through label data, roughly
> every 8 hours. AI is a **market analyst**: combines what Human set with real-time market data to synthesize and analyse
> market context and trade setups, and answers the user at the moment they ask.

|                  | Layer 1 — Policy (human)                                       | Layer 2 — Context (system)                                                         |
| ---------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Who writes it    | The analyst, through the MT5 tool                              | Code, automatically                                                                |
| How often        | About every 8 hours, only at Publish                           | Every 5-minute cycle                                                               |
| What it contains | Where a line is drawn, what it means, one free-text overview   | Where price is relative to each line; crossed or touched since publish; policy age |
| Can go stale?    | Yes, and that is expected; staleness is reported, never hidden | No; recomputed every cycle                                                         |
| Storage          | `trendline_policy_sessions`, `trendline_policy_lines`          | `trendline_context_readings`                                                       |

### 2.2 ADR-025: the analyst never decides direction

- `bias_hint` and `regime_hint` are **stored but inert**. They are in no envelope and no model call sees them. Promoting a
  hint into the SYN rules table is not part of this release and needs its own ADR, after shadow data exists.
- Analyst free text may reach the model only in the form and under the conditions in §12.4 (decision Q1).
- The existing direction-word check on replies (`lib/reply/checks/wording-check.ts`) is **not** relaxed for analyst text.
  A reply that takes a side the board does not take fails that check, whatever the analyst wrote. That check is the
  enforcement of this principle on the output side.

### 2.3 No grades

No field is a confidence score, probability or grade. `parse_method`, `status` and `status_reasons` are provenance and
data quality. They are never shown to a user as a certainty level.

### 2.4 Source tagging

Layer-1 content is the analyst's stated opinion, not a verified market fact and not a sensor reading. Any prompt or UI
surface says so in a trader's words, for example "the analyst's read, as of 3 hours ago".

### 2.5 Recency honesty

`hours_since_published` is mandatory in any reply that uses this data.

### 2.6 Append-only, replayable

No table is updated in place. A redraw is a new session; a new cycle is a new set of reading rows. The same cycle
computed twice gives the same rows.

### 2.7 Project rules that bind this build

- No real infrastructure address or credential in any tracked file; use the canonical aliases.
- Money, auth, secrets and CORS changes escalate to Davin. Q6 is one.
- The Executor never applies a production migration, never enters credentials, and commits or pushes only when asked.
- `git stash` is never used in this checkout.
- **Stage B3 freeze.** While the live shadow on Terminal A runs, nothing may touch Terminal A's indicator inputs, the live
  NSSM services or the live database. Every VPS, gateway-deploy and database step in §15 waits for B3 to clear and for
  Davin's word. The sensor worker's code (§10.1) is also not changed before then.

---

## 3. Decision register

| #   | Decision                                   | Status                                   | Outcome                                                                                           | Specified in |
| --- | ------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------ |
| Q1  | May analyst free text reach the model?     | **RECOMMENDED, needs explicit sign-off** | Yes, as attributed commentary that cannot change the board's verdict. Hints stay in the database. | §12.4, §2.2  |
| Q2  | Final `role` vocabulary                    | Decided 2026-11-16                       | `UPTREND_LINE` / `DOWNTREND_LINE`; no value shared with `regime_hint`.                            | §9.3, §11    |
| Q3  | Layer-2 tolerance and staleness            | Decided 2026-11-16; values PROVISIONAL   | Fixed `T`, separate `T_drift`, `H_stale` = 12 h; the `T` used is stored on every reading.         | §10.2        |
| Q4  | Images per request                         | **RECOMMENDED**                          | One trendline image beside the existing chart; kept only if an eval comparison shows a benefit.   | §12.6        |
| Q5  | One or two composite charts                | Decided 2026-11-16                       | `composite_m5` only. Seven attachments.                                                           | §4.2, §6     |
| Q6  | A dedicated API key for the uploader       | **RECOMMENDED, needs explicit sign-off** | Yes: a `trendline_uploader_` key, and the policy route accepts only that key.                     | §8.1         |
| Q7  | Which terminal the analyst draws on        | **RECOMMENDED**                          | A dedicated third terminal, `C`. Never Terminal A or B.                                           | §5.1         |
| Q8  | A model-based label parser                 | **RECOMMENDED**                          | Not in the first release.                                                                         | §11.5        |
| Q9  | Gateway policy lane: synchronous or queued | Decided 2026-11-16                       | Synchronous, one transaction. Bull is used only for Layer 2.                                      | §8.2         |

**What still blocks work**

- Q7 blocks Phase 1 step 2 (the geometry check needs a terminal) and Phase 5.
- Q6 blocks Phase 5. If Davin declines it, the fallback in §8.1 applies and nothing else changes.
- Q1 blocks Phase 4 and `live`.
- Q4 blocks Phase 4. Q8 blocks nothing in the first release.

---

## 4. System overview

### 4.1 Pipeline

```
Analyst terminal C (MT5): draws, labels, clicks Publish on the M5 composite chart
   │
   │  TrendlineScreenshotAndLabelExport_v2_29.mq5 (+ TrendlineLabelUtils.mqh), attached to 7 charts
   ▼
<terminal C>\MQL5\Files\trendline_context\        (written as .tmp, then renamed)
   ├─ TrendlinePolicy_<symbol>_<published_at>.tsv      one per Publish   (all Layer-1 data)
   ├─ <base>_<symbol>_<kind>_<TF>_<stamp>.png          one per capture
   └─ <base>_<symbol>_<kind>_<TF>_<stamp>.png.tsv      one per capture   (image stamp only)
   │
   │  trendline_context_uploader.py   (own NSSM service on the same machine, polls every 30 s)
   ├───────────── policy lane ──────────────┐            ┌──── image lane ────┐
   ▼                                        │            ▼                    │
Railway gateway                             │      Cloudflare R2 (private bucket)
POST /api/v1/trendline-context/policy       │      trendline-context/<symbol>/<image_kind>.png
   │  synchronous, one transaction          │      fixed key, overwritten; stamp in object metadata
   ▼                                        │
PostgreSQL (market-data)                    │
   trendline_policy_sessions  ◀─────────────┘
   trendline_policy_lines
   trendline_context_readings ◀── Layer-2 processor, queue `trendline-context-cycle`,
   │                              one job per cycle, added after the sensor worker's own write
   ▼
Monolith reply pipeline (lib/reply/): reads `live` readings of its cycle, builds envelope
`trendline-context/1`, at most one image
```

### 4.2 The seven chart attachments

One tool is attached once per chart. All seven run on the same terminal.

| #   | `image_kind`   | What it shows                                                                    | Attached to                        | Cadence |
| --- | -------------- | -------------------------------------------------------------------------------- | ---------------------------------- | ------- |
| 1   | `composite_m5` | The curated cross-timeframe lines, legend and tags baked in. The canonical chart | The combined destination chart, M5 | 15 min  |
| 2   | `source_m3`    | That chart's own lines only (the "Constellation" source)                         | The M3 chart                       | 15 min  |
| 3   | `source_m5`    | Same, M5's own lines                                                             | The M5 chart                       | 15 min  |
| 4   | `source_m15`   | Same, M15's own lines                                                            | The M15 chart                      | 15 min  |
| 5   | `source_m30`   | Same, M30's own lines                                                            | The M30 chart                      | 60 min  |
| 6   | `source_h1`    | Same, H1's own lines                                                             | The H1 chart                       | 60 min  |
| 7   | `source_h4`    | Same, H4's own lines                                                             | The H4 chart                       | 240 min |

- The combined chart is produced by Davin's `Objects Copier_6Sources_1Dest_v2_29.mq5`, which this design does not modify.
  Its convention: A=M3, B=M5, C=M15, D=M30, E=H1, F=H4, each source's objects prefixed `A_` to `F_`.
- M3 sits in the 15-minute tier because its channels are short-lived by construction.
- There is no `composite_m15` (Q5): the copier has one destination, so a second composite would be curated by hand a
  second time and would differ.
- **Only the composite carries policy.** A line that is on a source chart but was not copied to the composite, or was
  deleted from it, is not part of the published policy.

### 4.3 Flags and stages

| Stage      | Gateway `TRENDLINE_CONTEXT_ENABLED` | Gateway `TRENDLINE_CONTEXT_FLAG` | What happens                                                                                       |
| ---------- | ----------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------- |
| **off**    | anything but exactly `true`         | —                                | The module registers nothing: no route, no queue, no processor. Default and rollback.              |
| **shadow** | `true`                              | anything but exactly `live`      | Policy is stored. Layer-2 rows are written with `flag = 'shadow'`. The reply code never sees them. |
| **live**   | `true`                              | `live`                           | Layer-2 rows are written with `flag = 'live'`. The reply code may read them (§12).                 |

- Both follow the gateway's existing convention: only the exact text turns something on (`sensor-config.ts`).
- The monolith has no flag of its own for this. It reads only rows with `flag = 'live'`, so setting the gateway flag back
  to `shadow` withdraws the feature from replies at the next cycle.
- Layer 2 is triggered from the sensor worker (§10.1), so it runs only while `SENSOR_WORKER_ENABLED` is `true`.

### 4.4 Clocks and identifiers

Verified in `railway-gateway/src/cycle/slot.ts`, `cycle/closed-bars-query.ts` and the Prisma schema.

- **Every stored time is unix UTC seconds.**
- **A slot `S`** is a 5-minute UTC boundary. `cycle_slot` is a slot.
- **At slot `S` the newest closed M5 bar opened at `S − 300`.** The bar that opens at `S` is still forming.
- **`market_data_v6.timestamp` is a bar's open time.** The table is unique on `(symbol, timeframe, timestamp)`.
- **`published_at`** is the moment of the Publish click, converted to UTC by the exporter.
- **`ref_bar_time`** is the open time of the last closed M5 bar at Publish. It must exist as a `timestamp` in
  `market_data_v6`; Layer 2 checks that (§10.3).
- **`slot`** is a line's TL number within its own source timeframe, 1 to 99. Not unique on a composite.
- **`slot_key`** is `<source_timeframe>:TL<slot>`, for example `M15:TL3`. It is unique **within one session only**.
  `M15:TL3` in the next session may be a different line. Nothing may follow a `slot_key` across sessions.

### 4.5 Configuration reference

**Exporter inputs** (per attachment; §6.1 has the behaviour)

| Input                                                          | Default                              | Note                                                                      |
| -------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------- |
| `InpImageKind`                                                 | `SOURCE`                             | New. `SOURCE` or `COMPOSITE`.                                             |
| `InpTerminalId`                                                | `C`                                  | New. Written into the policy file. `C` follows the recommendation for Q7. |
| `InpTrendLinePrefix`                                           | `Trendline`                          | Existing. Lines are named `<prefix>_TL<n>`.                               |
| `InpMaxTrendlines`                                             | `12`                                 | Existing. Highest TL number scanned; at most 99.                          |
| `InpCaptureEveryMinutes`                                       | `0`                                  | Changed. `0` = automatic from the chart period.                           |
| `InpScreenshotWidth` / `Height`                                | `1920` / `1080`                      | Existing.                                                                 |
| `InpBaseFileName`                                              | `TrendlineScreenshot`                | Existing. The `<base>` of image filenames.                                |
| `InpShowLegend`, `InpShowInlineTags`, `InpLegendMaxLabelChars` | `true`, `true`, `44`                 | Existing.                                                                 |
| `InpSourcePrefix_A..F`                                         | `A_` … `F_`                          | Existing. Used on the composite only.                                     |
| `InpSourceLabel_A..F`                                          | `M3`, `M5`, `M15`, `M30`, `H1`, `H4` | Changed: v1 defaults are empty and its comments name a different order.   |
| `InpShowOverviewBox`                                           | `true`                               | Existing. Shown on the composite only in v2.                              |
| `InpDebugMode`                                                 | `true`                               | Existing.                                                                 |

**Uploader environment**

| Variable                                                                 | Default | Note                                                                                                                                     |
| ------------------------------------------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `TL_EXPORT_DIR`                                                          | none    | Required. The `trendline_context` folder of terminal C. v1 defaults to Terminal A's folder; that default is removed.                     |
| `API_GATEWAY_URL`                                                        | none    | Required.                                                                                                                                |
| `TRENDLINE_API_KEY`                                                      | none    | Required. The dedicated key (Q6). If Q6 is declined, the uploader reads `BACKFILL_API_KEY` instead. v1's placeholder default is removed. |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | none    | Required. Same names as the renderer's worker.                                                                                           |
| `TL_POLL_SEC`                                                            | `30`    |                                                                                                                                          |
| `TL_GATEWAY_TIMEOUT_SEC`                                                 | `10`    |                                                                                                                                          |
| `TL_SENT_RETENTION_HOURS`                                                | `48`    | New.                                                                                                                                     |

The uploader refuses to start, with a clear message, when a required variable is missing. `TL_STATE_PATH` no longer
exists. The service must stay compatible with Python 3.8 and later (the VPS runs 3.11).

**Gateway environment**

| Variable                    | Default  | Note                                                         |
| --------------------------- | -------- | ------------------------------------------------------------ |
| `TRENDLINE_CONTEXT_ENABLED` | off      | §4.3.                                                        |
| `TRENDLINE_CONTEXT_FLAG`    | `shadow` | §4.3.                                                        |
| `TRENDLINE_TOLERANCE`       | `0.80`   | `T`, in price units. PROVISIONAL (§10.2).                    |
| `TRENDLINE_DRIFT_TOLERANCE` | `0.10`   | `T_drift`, in price units. PROVISIONAL (§10.2).              |
| `TRENDLINE_STALE_HOURS`     | `12`     | `H_stale`.                                                   |
| `TRENDLINE_MAX_HOURS`       | `168`    | `H_max`: beyond this age no reading is written. RECOMMENDED. |

They are read once, when the module is registered, by a small config module modelled on `sensors/sensor-config.ts`. A
value that is not a valid number stops the gateway from starting; it is never silently replaced.

---

## 5. The analyst's workflow

### 5.1 Where the analyst draws (Q7, RECOMMENDED)

**A dedicated third terminal, `terminal_id = C`. Never Terminal A, never Terminal B.**

| Option                    | Verdict | Reason                                                                                                                                               |
| ------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Terminal A                | No      | It is the certified live data path and is frozen during B3. Hand-drawing and seven screenshot charts do not belong beside the exporters, even later. |
| Terminal B                | No      | It is the hot standby: its job is to mirror A and take over. It is closed during B3. Analyst state on it would be lost or duplicated at a promote.   |
| **A third terminal, `C`** | **Yes** | Isolated from the data pipeline. A failure or a mistake on it cannot touch price ingestion.                                                          |

- **All seven attachments run on terminal `C`.** The curation flags are terminal GlobalVariables; charts on two terminals
  cannot share a Publish.
- **Same broker server and the same symbol as Terminal A.** Layer 2 counts M5 bars in the database, which come from
  Terminal A. The bar offsets in the policy file are right only if terminal `C` has the same M5 bars. Layer 2 checks this
  through `ref_bar_time` (§10.3).
- **The uploader runs on the same machine as terminal `C`.**
- **Location.** Preferably on the VPS, so images refresh around the clock; Davin draws over remote desktop. His own
  desktop also works: images go stale while it is off and are dropped by the age rule (§12.6), but policy and Layer 2
  keep working, because Layer 2 is computed from the database.
- **Timing.** A third terminal on the VPS uses CPU and memory beside Terminal A, so it waits until B3 has cleared. The
  geometry check (§16, Phase 1 step 2) can run now on Davin's desktop terminal.

### 5.2 A curation session, step by step

1. Click **Start Curation Session** on any of the seven charts. Automatic captures pause on all seven.
2. Draw or adjust trend lines on the source charts. Name each one `Trendline_TL<n>` (n from 1 to `InpMaxTrendlines`).
   Type its label into the line's own **Text** field (§5.3).
3. Run the Objects Copier to rebuild the M5 composite from the six source charts.
4. On the composite, delete the lines that do not matter for this session.
5. Type one short sentence into the **Session overview** box on the composite (optional).
6. Click **Publish / Lock** on the composite. This is the only moment policy is frozen.
7. Check the result on the chart: the legend shows the published lines, and a message says if Publish was refused and why
   (§6.2).

**What to know**

- **Publish exists only on the composite.** A source chart has no Publish button.
- **Editing after Publish changes nothing stored** until the next Publish. Meanwhile new composite images are not shown
  to the model, because they no longer match the stored lines (§12.6).
- **To withdraw all lines,** publish the composite with no trend lines on it. A session with zero lines is valid and
  means "no active analyst lines".
- **`TL3` is not a permanent name.** Each session stands alone.

### 5.3 How to write a label

Either form is accepted. The first gives the system structured fields; the second is stored as plain commentary.

| Form       | Example                                                  | Result                                                 |
| ---------- | -------------------------------------------------------- | ------------------------------------------------------ |
| Rule form  | `ROLE=RESISTANCE \| BIAS=BEARISH \| NOTE=strong M15 cap` | `role` = RESISTANCE, `bias_hint` = BEARISH, note shown |
| Rule form  | `ROLE=UPTREND \| NOTE=London low to NY low`              | `role` = UPTREND_LINE, note shown                      |
| Plain text | `strong resistance drawn from the M15 swing highs`       | `role` = OTHER, the whole sentence is the note         |

- `ROLE` values: `SUPPORT`, `RESISTANCE`, `UPTREND_LINE` (or `UPTREND`), `DOWNTREND_LINE` (or `DOWNTREND`),
  `CHANNEL_UPPER`, `CHANNEL_LOWER`, `PIVOT`, `OTHER`.
- `BIAS` values: `BULLISH`, `BEARISH`, `NEUTRAL`. It is stored for later analysis and shown to nobody.
- The session overview may be plain text, or `REGIME=RANGE_BOUND | NOTE=...` with `REGIME` one of `TREND_UP`,
  `TREND_DOWN`, `RANGE_BOUND`, `TRANSITIONING`, `UNCLEAR`.
- A rule-form label with a mistake in it (an unknown role, or an uptrend line that slopes down) is stored but shown to
  nobody. The uploader's log reports how many labels were not understood (§8.2). The full grammar is §11.

---

## 6. The MT5 exporter

Files: `TrendlineScreenshotAndLabelExport_v2_29.mq5`, `TrendlineLabelUtils.mqh`. Everything in this section is the target;
the current code is v1 (§17).

### 6.1 What it scans

- Trend-line objects (`OBJ_TREND`) on its own chart whose name is `<InpTrendLinePrefix>_TL<n>`, optionally preceded by a
  source prefix (`A_` … `F_`) on the composite.
- A line's label is its `OBJPROP_TEXT`, or its `OBJPROP_TOOLTIP` when the text is empty.
- `ray_extends` is the line's `OBJPROP_RAY_RIGHT`. A left ray is ignored.
- **Source timeframe.** On a source chart it is the chart's own period. On the composite it comes from the object's
  prefix through `InpSourcePrefix_*` / `InpSourceLabel_*`. It is always written as `M3`, `M5`, `M15`, `M30`, `H1` or `H4`,
  never as `PERIOD_M15`.

### 6.2 Behaviour

| Item                       | Rule                                                                                                                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Image kind                 | `image_kind` = `InpImageKind` in lower case + `_` + the period in lower case, for example `composite_m5`, `source_h4`.                                                                                             |
| Allowed periods            | `SOURCE`: M3, M5, M15, M30, H1, H4. `COMPOSITE`: M5 only. Any other combination fails `OnInit` with a clear message.                                                                                               |
| Cadence                    | `InpCaptureEveryMinutes = 0` means: M3, M5, M15 → 15; M30, H1 → 60; H4 → 240. A non-zero value overrides. Captures are aligned to the UTC clock.                                                                   |
| Curation flags             | Terminal GlobalVariables, per symbol: `TL_Curation_InProgress_<symbol>` and `TL_Curation_PublishedAt_<symbol>`.                                                                                                    |
| Start Curation             | Button on every attachment. Sets the in-progress flag; every attachment of that symbol stops capturing.                                                                                                            |
| **Publish**                | Button **only on the composite**. Clears the in-progress flag, sets the published-at flag, writes the policy file (§6.3), then captures.                                                                           |
| Publish is refused         | With an on-chart message, and nothing is written, when: a line with a TL number has a prefix that maps to no source timeframe; two lines give the same `slot_key`; a line has both anchors on the same M5 bar.     |
| Zero lines                 | Allowed. Writes a policy file with `line_count` 0.                                                                                                                                                                 |
| Publish reaches all charts | On every timer tick (5 s) each attachment compares the published-at flag with the last value it saw and captures at once when it changed. All seven images refresh within seconds of a Publish.                    |
| No double capture          | After a Publish capture the attachment records the **aligned** boundary as done, so the timer does not capture the same period again with an earlier stamp.                                                        |
| Legend and tags            | Machine-generated from the scanned lines, never hand-typed. Tag objects are named `TLSX_Tag_<slot_key>` (with `:` replaced by `_`).                                                                                |
| Overview box               | On the composite only. Read at Publish.                                                                                                                                                                            |
| Output folder              | `MQL5\Files\trendline_context\`.                                                                                                                                                                                   |
| File writing               | UTF-8 (`FileOpen(..., FILE_WRITE\|FILE_TXT\|FILE_ANSI, '\t', CP_UTF8)`). Written to `<name>.tmp`, then renamed with `FileMove`. The last line is `end<TAB>1`.                                                      |
| Sanitiser                  | `TLU_TsvSafe` turns every control character (below 0x20, 0x7F, U+2028, U+2029) into one space.                                                                                                                     |
| Value lookup               | `TLU_GetTrendLineValueAt` returns `EMPTY_VALUE` when the native `ObjectGetValueByTime` fails. It has no fallback formula.                                                                                          |
| UTC conversion             | `TLU_ServerToUtc` (server time minus the current server-to-GMT offset) is used only for moments that are current: the Publish time, the capture time and the reference bar. Never for arithmetic on an old anchor. |

### 6.3 The policy file

`TrendlinePolicy_<symbol>_<published_at>.tsv`, written **once per Publish by the composite**. It is the only source of
Layer-1 data.

```
schema<TAB>trendline-policy/2
symbol<TAB>XAUUSD
terminal_id<TAB>C
published_at_utc<TAB><unix seconds>
ref_bar_time_utc<TAB><unix seconds, open time of the last closed M5 bar at Publish>
session_overview<TAB><free text, or empty>
lines_sha256<TAB><64 hex characters>
line_count<TAB><n>
slot<TAB>slot_key<TAB>source_timeframe<TAB>anchor1_time_utc<TAB>anchor1_price<TAB>anchor1_bars_ago_m5<TAB>anchor2_time_utc<TAB>anchor2_price<TAB>anchor2_bars_ago_m5<TAB>ray_extends<TAB>value_at_publish<TAB>label
<n rows>
end<TAB>1
```

| Column                | Meaning                                                                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `slot`                | The TL number, 1 to 99.                                                                                                                                  |
| `slot_key`            | `<source_timeframe>:TL<slot>`.                                                                                                                           |
| `source_timeframe`    | `M3`, `M5`, `M15`, `M30`, `H1` or `H4`.                                                                                                                  |
| `anchor*_time_utc`    | The anchor's time converted to UTC. **For display only**; never used for arithmetic (§6.5).                                                              |
| `anchor*_price`       | The anchor's price, written with the symbol's own digits.                                                                                                |
| `anchor*_bars_ago_m5` | Whole M5 bars from the anchor to the reference bar: `iBarShift(_Symbol, PERIOD_M5, anchorTime)` minus the reference bar's shift. Positive = in the past. |
| `ray_extends`         | `1` or `0`.                                                                                                                                              |
| `value_at_publish`    | The line's price at the reference bar from the native MT5 lookup on the composite. Empty if the lookup fails.                                            |
| `label`               | What the analyst typed, sanitised. Last column.                                                                                                          |

The MT5 object name is not written (it is not an identity). No derived field (`role`, hints) is written.

### 6.4 The image files

`<base>_<symbol>_<kind>_<TF>_<yyyymmdd_hhmm>.png` and the same name with `.png.tsv`. `<kind>` is `composite` or `source`;
`<TF>` is `M5`, not `PERIOD_M5`; the stamp is the aligned capture boundary in UTC. The sidecar holds the image's stamp and
**no line rows**:

```
schema<TAB>trendline-image/2
image<TAB><png filename>
symbol<TAB>XAUUSD
image_kind<TAB>composite_m5
captured_at_utc<TAB><unix seconds>
session_published_at_utc<TAB><unix seconds, or empty if never published>
lines_sha256<TAB><64 hex characters>
end<TAB>1
```

**`lines_sha256`** is computed the same way in the policy file and in every image sidecar:

- one row per scanned line: `slot_key|anchor1_bars_ago_m5|anchor1_price|anchor2_bars_ago_m5|anchor2_price|ray_extends`,
- prices written with the symbol's digits, bar counts as integers, `ray_extends` as `0` or `1`,
- rows sorted by `slot_key` in byte order, joined with `\n`, encoded as UTF-8, hashed with SHA-256, written as lower-case
  hex (`CryptEncode` with `CRYPT_HASH_SHA256`). With no lines it is the hash of the empty string.

The hash covers geometry only. It answers one question: does this picture show the same lines as the stored policy?

### 6.5 Line geometry: bars, not clock time

**The canonical value of a line is its value on the M5 composite chart, counted in M5 bars.**

Why not clock time: an MT5 trend line is straight in the **bar-index space** of the chart it is shown on. Gold has a daily
break and weekends, so a line interpolated in seconds drifts after every gap. Old anchors also cannot be converted to UTC
reliably across a broker daylight-saving change.

- The exporter records, per line, how many M5 bars each anchor lies before a reference bar, and once per file the UTC
  open time of that reference bar. The reference bar is current, so converting it with the current offset is correct.
- With `p1`, `p2` the anchor prices, `a1`, `a2` the two `bars_ago_m5` values, and `k` the number of M5 bars after the
  reference bar:

  ```
  v(k) = p1 + (p2 − p1) × (a1 + k) / (a1 − a2)
  ```

- **An anchor in the future** gets a negative offset, estimated as `−ceil((anchorTime − refBarTime) / 300)`. The estimate
  assumes no session gap, so Layer 2 marks such a line `CAUTIONARY` (`FUTURE_ANCHOR`).
- The same line on another timeframe's chart can differ slightly from the canonical value. The M5 composite is what the
  analyst looks at when publishing, so it is the reference.

This rule rests on knowledge of MT5, not on a test. The check is Phase 1 step 2 (§16) and nothing downstream may be
built before it passes.

---

## 7. The uploader

File: `trendline_context_uploader.py`. Its own NSSM service on the analyst terminal's machine. Every `TL_POLL_SEC` it
looks only in `TL_EXPORT_DIR` and ignores `*.tmp`.

### 7.1 Reading a file

- Read as UTF-8. Split on `\n` only, then strip one trailing `\r` (`str.splitlines()` also splits on other characters).
- Require the `schema` line, the `end<TAB>1` trailer and, for a policy file, exactly `line_count` rows. Anything else is a
  parse failure.

### 7.2 Policy lane

For each `TrendlinePolicy_*.tsv`, oldest first:

1. Parse it and build the request body (mapping below).
2. `POST {API_GATEWAY_URL}/api/v1/trendline-context/policy` with `Authorization: Bearer <key>`.
3. Act on the answer:

| Answer                                   | Action                                                                                                   |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `200`, outcome `RECORDED` or `DUPLICATE` | Move the file to `sent\`. Log the outcome and the parse summary.                                         |
| `200`, outcome `CONFLICT`                | Move the file to `quarantine\`. Log an error once.                                                       |
| `400`, or a parse failure                | Move the file to `quarantine\`. Log an error once. No retry.                                             |
| `401` or `403`                           | Leave the file where it is: the key is wrong, not the file. Log an error, at most once every 10 minutes. |
| `5xx`, timeout, network error            | Leave the file where it is. Retry on the next tick.                                                      |

| File field                                 | Body field                                |
| ------------------------------------------ | ----------------------------------------- |
| `symbol`                                   | `symbol`                                  |
| `terminal_id`                              | `terminal_id`                             |
| `published_at_utc`                         | `published_at` (integer)                  |
| `ref_bar_time_utc`                         | `ref_bar_time` (integer)                  |
| `session_overview`                         | `overview_raw` (omitted when empty)       |
| `lines_sha256`                             | `lines_sha256`                            |
| row `slot`, `slot_key`, `source_timeframe` | the same names                            |
| row `anchor1_time_utc`, `anchor2_time_utc` | `anchor1_time`, `anchor2_time` (integers) |
| row `anchor*_price`, `anchor*_bars_ago_m5` | the same names (number, integer)          |
| row `ray_extends`                          | `ray_extends` (boolean)                   |
| row `value_at_publish`                     | `value_at_publish` (omitted when empty)   |
| row `label`                                | `label_raw`                               |

The uploader derives nothing. It sends no `role`, hint, note or parse method.

### 7.3 Image lane

For each `*.png` that has a `*.png.tsv`:

1. Check that the PNG is complete (the check `mtf_render_upload_worker.py` already uses).
2. PUT it to the private bucket at the fixed key `trendline-context/<symbol in lower case>/<image_kind>.png`, replacing
   the previous capture. The object's metadata carries the stamp: `symbol`, `image_kind`, `captured_at`, `published_at`,
   `lines_sha256`.
3. On success move the pair to `sent\`. On failure leave it for the next tick.
4. When several captures of one `image_kind` are waiting, upload only the newest and move the older pairs to `sent\`.

Images never pass through the gateway (its JSON body limit is about 100 KB).

### 7.4 State and retention

- **A file's folder is its state**: `trendline_context\` (waiting), `sent\` (done), `quarantine\` (refused). There is no
  watermark file, so a later success can never hide an earlier failure.
- `sent\` is pruned after `TL_SENT_RETENTION_HOURS`. `quarantine\` is not pruned automatically; its file count is logged
  on every tick so it is noticed.
- R2 holds one object per `image_kind`, so it does not grow.
- Log lines never contain a key or a credential.

---

## 8. The gateway: storing policy

Files in `railway-gateway/src/trendline-context/`, registered in `app.module.ts` by `TrendlineContextModule.register()`,
which registers nothing unless the module is enabled (§4.3).

### 8.1 Authentication (Q6, RECOMMENDED, needs explicit sign-off)

- The route is behind the existing `ApiKeyGuard` (`railway-gateway/src/auth/api-key.guard.ts`), as `symbol-specs` is.
- **Recommended:** one new key with the prefix `trendline_uploader_`, and this route accepts only that key. Any other
  valid key gets `403`; no key or an unknown key is refused by the existing guard, as today.
  - **Why.** Today every key in `API_KEYS` (the push worker's, the relay's, the renderer's, the monolith's) could write
    analyst policy, and the uploader would appear in the logs as the push worker. This content can end up in front of
    users. A separate key can also be revoked without stopping price ingestion.
  - **Code.** Two small changes. The guard works out the caller's prefix only for its log line today: the new prefix
    joins its list of known callers, and the caller is made available on the request so the route can check it.
  - **Davin's part.** He creates the key and sets it in `API_KEYS` on the gateway and in the uploader's environment. The
    Executor never sees or types its value.
- **If Davin declines:** the route keeps `ApiKeyGuard` only and the uploader uses the push worker's key. Nothing else in
  this document changes.
- The uploader reuses the renderer's R2 credentials in the first release.

### 8.2 `POST /api/v1/trendline-context/policy`

Synchronous (Q9). The controller validates, derives, writes the session and all its lines in **one Prisma transaction**,
and answers with the real outcome. There is no queue on this lane: about three Publishes a day cannot delay price
ingestion. The route is exempt from the throttler (`@SkipThrottle()`), like the other machine lanes.

**Steps, in order**

1. Authenticate (§8.1).
2. Validate the body (§8.3). Failure → `400`.
3. Compute `content_sha256` (below).
4. Look up `(symbol, published_at)`. If it exists, answer `DUPLICATE` or `CONFLICT` and stop.
5. Derive the stored fields: `source_charts` = the distinct `source_timeframe` values, sorted; the parser's output for the
   overview and for every line (§11).
6. Insert the session and its lines in one transaction. On a unique-constraint race (`P2002`) re-read and answer as in
   step 4.
7. Answer.

**Answers**

| Situation                              | Response                                                                                       |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| New `(symbol, published_at)`           | `200 {outcome: "RECORDED", session_id, content_sha256, parse_summary}`                         |
| Key exists, same `content_sha256`      | `200 {outcome: "DUPLICATE", session_id, content_sha256}`                                       |
| Key exists, different `content_sha256` | `200 {outcome: "CONFLICT", session_id, content_sha256}`; the first is kept; logged as an error |
| Body fails validation                  | `400`                                                                                          |
| Database error                         | `5xx`, so the uploader's retry is real                                                         |

- `parse_summary` is `{rule, plain, malformed}`: how many labels were parsed by rule, stored as plain commentary, or not
  understood. The uploader logs it; it is the analyst's feedback on his labels.
- **`content_sha256`** is the SHA-256 (lower-case hex) of `JSON.stringify` of an object built from the validated body
  with exactly these keys in this order: `symbol`, `terminal_id`, `published_at`, `ref_bar_time`, `overview_raw` (empty
  string when absent), `lines_sha256`, `lines`. `lines` is sorted by `slot_key` in byte order, each line with the keys of
  §8.3 in the order listed there (`value_at_publish` as `null` when absent). It is computed from the request, before any
  parsing, so a new parser version never turns a duplicate into a conflict.
- `lines_sha256` is stored as received. The gateway does not recompute it.

### 8.3 Request body

The global `ValidationPipe` already rejects unknown fields. Every database CHECK has a counterpart here, so a body that
passes validation cannot fail a CHECK.

| Session field  | Rule                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------- |
| `symbol`       | `@Matches(/^[A-Za-z0-9._-]{1,32}$/)` and, in the first release, equal to `READER_SYMBOL` |
| `terminal_id`  | `@Matches(/^[A-Za-z0-9_-]{1,16}$/)`                                                      |
| `published_at` | integer, unix UTC seconds, not more than 300 s ahead of the gateway's clock              |
| `ref_bar_time` | integer, a multiple of 300, less than `published_at`                                     |
| `overview_raw` | optional string, at most 2000 characters                                                 |
| `lines_sha256` | `@Matches(/^[0-9a-f]{64}$/)`                                                             |
| `lines`        | array, `@ArrayMaxSize(600)`, may be empty; `slot_key` unique within it                   |

| Line field (in this order) | Rule                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| `slot_key`                 | `@Matches(/^(M3\|M5\|M15\|M30\|H1\|H4):TL[1-9]\d?$/)`, equal to `<source_timeframe>:TL<slot>` |
| `slot`                     | integer 1 to 99                                                                               |
| `source_timeframe`         | `@IsIn(['M3','M5','M15','M30','H1','H4'])`                                                    |
| `anchor1_time`             | integer, unix UTC seconds                                                                     |
| `anchor1_price`            | finite number                                                                                 |
| `anchor1_bars_ago_m5`      | integer                                                                                       |
| `anchor2_time`             | integer, unix UTC seconds                                                                     |
| `anchor2_price`            | finite number                                                                                 |
| `anchor2_bars_ago_m5`      | integer, different from `anchor1_bars_ago_m5`                                                 |
| `ray_extends`              | boolean                                                                                       |
| `value_at_publish`         | optional finite number                                                                        |
| `label_raw`                | string, at most 2000 characters, may be empty                                                 |

Example:

```json
{
  "symbol": "XAUUSD",
  "terminal_id": "C",
  "published_at": 1794636000,
  "ref_bar_time": 1794635700,
  "overview_raw": "REGIME=RANGE_BOUND | NOTE=Range-bound between the M30 and H1 bands",
  "lines_sha256": "<64 hex characters>",
  "lines": [
    {
      "slot_key": "M15:TL3",
      "slot": 3,
      "source_timeframe": "M15",
      "anchor1_time": 1794600300,
      "anchor1_price": 4051.2,
      "anchor1_bars_ago_m5": 118,
      "anchor2_time": 1794621900,
      "anchor2_price": 4046.8,
      "anchor2_bars_ago_m5": 46,
      "ray_extends": true,
      "value_at_publish": 4043.99,
      "label_raw": "ROLE=RESISTANCE | NOTE=strong M15 resistance"
    }
  ]
}
```

### 8.4 Reads the module provides

`TrendlineContextService` offers what Layer 2 needs: the session in force at a slot (§10.3) with its lines. The monolith
does not call the gateway; it reads the tables itself (§12.1).

---

## 9. Database schema

The three models live in `prisma/market-data/schema.prisma` and, identically, in `railway-gateway/prisma/schema.prisma`.
They belong in `market-data` because the gateway writes them, as it writes `SymbolSpec` and `McdOutput`.

**Migration.** `prisma/migrations/20261114000000_add_trendline_context_tables/migration.sql` exists and has **never been
applied to any database**. Because of that, v2 edits it in place; no second migration is added. Davin applies it (§15).

### 9.1 Target models

```prisma
/// Layer 1: one row per Publish. APPEND-ONLY: a redraw is a new row, never an UPDATE.
model TrendlinePolicySession {
  id     String @id @default(cuid())
  symbol String

  terminal_id  String // which MT5 terminal published (e.g. "C")
  published_at Int // unix UTC; with symbol, the idempotency key
  ref_bar_time Int // unix UTC, open of the last closed M5 bar at Publish; the origin of every bars_ago value

  overview_raw  String? // exactly what the analyst typed in the overview box, or null
  overview_note String? // the part that may be shown (§11.4), or null
  regime_hint   String? // closed vocabulary; DB only, never in an envelope (ADR-025)
  source_charts String[] @default([]) // derived: the distinct source_timeframe values present

  lines_sha256   String // geometry hash from the exporter; matches images to this session
  content_sha256 String // whole-body hash from the gateway; DUPLICATE vs CONFLICT
  parser_version String // which label parser ran ("none" before one exists)

  lines TrendlinePolicyLine[]

  createdAt DateTime @default(now())

  @@unique([symbol, published_at])
  @@map("trendline_policy_sessions")
}

/// One hand-drawn line within a session.
model TrendlinePolicyLine {
  id         String                 @id @default(cuid())
  session_id String
  session    TrendlinePolicySession @relation(fields: [session_id], references: [id], onDelete: Cascade)

  slot_key         String // "M15:TL3"; unique WITHIN this session only
  slot             Int // 1..99
  source_timeframe String // M3 | M5 | M15 | M30 | H1 | H4

  anchor1_time        Int // unix UTC, display only
  anchor1_price       Float
  anchor1_bars_ago_m5 Int // M5 bars before ref_bar_time; negative = estimated future anchor
  anchor2_time        Int // unix UTC, display only
  anchor2_price       Float
  anchor2_bars_ago_m5 Int
  ray_extends         Boolean // false: the line has no meaning past its later anchor
  value_at_publish    Float? // native MT5 value at ref_bar_time; self-check for Layer 2

  label_raw    String // exactly what the analyst typed; never discarded, never shown
  role         String // closed vocabulary (§9.3)
  bias_hint    String? // BULLISH | BEARISH | NEUTRAL | null; DB only, never in an envelope (ADR-025)
  note         String? // the part of the label that may be shown (§11.4), or null
  parse_method String // rule | model | manual | none

  readings TrendlineContextReading[]

  createdAt DateTime @default(now())

  @@unique([session_id, slot_key])
  @@map("trendline_policy_lines")
}

/// Layer 2: one row per (line, cycle). Written only by the Layer-2 processor.
model TrendlineContextReading {
  id String @id @default(cuid())

  symbol     String
  cycle_slot Int // unix UTC, a multiple of 300: the same clock as mcd_outputs.cycle_slot

  policy_line_id      String
  policy_line         TrendlinePolicyLine @relation(fields: [policy_line_id], references: [id], onDelete: Cascade)
  policy_session_id   String // denormalised
  policy_published_at Int // denormalised

  flag              String // shadow | live: the stage when the row was written (§4.3)
  evaluator_version String // version of the Layer-2 function that computed the row
  tolerance_used    Float // the T applied to this reading

  value_now                   Float? // v(N) of §10.3; null when the line is not defined at the cycle bar or cannot be computed
  side                        String? // ABOVE | BELOW | AT; null exactly when value_now is null
  crossed_since_published     Boolean
  touch_count_since_published Int
  hours_since_published       Float
  status                      String // VALID | CAUTIONARY | INVALID | STALE: quality of the READING, not of the line
  status_reasons              String[] @default([]) // codes of §10.4, in the order found

  @@unique([cycle_slot, policy_line_id])
  @@index([symbol, cycle_slot])
  @@index([policy_session_id, cycle_slot])
  @@map("trendline_context_readings")
}
```

### 9.2 CHECK constraints in the migration

- Every closed-vocabulary column of §9.3, including `flag IN ('shadow','live')`.
- `slot BETWEEN 1 AND 99`.
- `anchor1_bars_ago_m5 <> anchor2_bars_ago_m5`.
- `ref_bar_time % 300 = 0` and `ref_bar_time < published_at`.
- `cycle_slot % 300 = 0`.
- `(value_now IS NULL) = (side IS NULL)`.
- `source_charts` and `status_reasons` are `NOT NULL` with an empty-array default, so the SQL matches Prisma.

After editing, run `prisma migrate diff` against a throwaway database to prove the SQL and the schema agree.

### 9.3 Closed vocabularies

| Field              | Values                                                                                                        | Note                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `role`             | `SUPPORT`, `RESISTANCE`, `UPTREND_LINE`, `DOWNTREND_LINE`, `CHANNEL_UPPER`, `CHANNEL_LOWER`, `PIVOT`, `OTHER` | What the line is, structurally.                                    |
| `bias_hint`        | `BULLISH`, `BEARISH`, `NEUTRAL`, null                                                                         | Stored only.                                                       |
| `regime_hint`      | `TREND_UP`, `TREND_DOWN`, `RANGE_BOUND`, `TRANSITIONING`, `UNCLEAR`, null                                     | Stored only. The market state of the session, never a single line. |
| `parse_method`     | `rule`, `model`, `manual`, `none`                                                                             | `model` and `manual` are reserved; nothing writes them yet.        |
| `status`           | `VALID`, `CAUTIONARY`, `INVALID`, `STALE`                                                                     | The words the sensor envelope uses.                                |
| `side`             | `ABOVE`, `BELOW`, `AT`, null                                                                                  | Where the last closed M5 close is relative to the line.            |
| `flag`             | `shadow`, `live`                                                                                              | As on `mcd_outputs`.                                               |
| `source_timeframe` | `M3`, `M5`, `M15`, `M30`, `H1`, `H4`                                                                          |                                                                    |

The board's own bias words are different: `LONG`, `SHORT`, `NEUTRAL`, `STAND_ASIDE`. They never appear in these tables.

---

## 10. Layer 2: the per-cycle computation

### 10.1 Trigger

- Layer 2 has its own Bull queue, `trendline-context-cycle`. It is **not** a second consumer of `cycle-ready`: consumers
  of one queue compete for jobs.
- **Where the job is added.** In `CycleReadyProcessor.handle` (`railway-gateway/src/sensors/cycle-ready.processor.ts`),
  after the sensor run has returned with any outcome except `SKIPPED_OLD` (a cycle announced too long ago, which no
  reply will read). The add:
  - happens only when the trendline module is enabled; when it is disabled the queue is not even registered,
  - is wrapped in a try/catch that can only log, so it can never fail or delay a sensor write,
  - uses job id `<symbol>_<slot>`, `LANE_JOB_OPTIONS`, and the payload `{symbol, slot}`.
- A separate processor in `TrendlineContextModule` consumes the queue, with concurrency 1.
- The computation itself is a **pure function**: session, lines, bars and parameters in; reading rows out. The processor
  only loads, calls and writes.
- **Late evaluation is safe.** Layer 2 reads only closed bars, which later cycles do not change, so a job that runs late
  still gives the right rows. No "too old" rule is needed.
- This is a change to the sensor worker's file. It is made only after B3 has cleared, and it ships with a spec proving
  that the sensor outcome is unchanged when the add throws.

### 10.2 Parameters

| Parameter | Meaning                                                                            | Value                                                                 |
| --------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `T`       | Price tolerance for `AT`, touches and crosses. Fixed, in price units (not points). | **PROVISIONAL** `0.80`. Replaced by a value measured in shadow.       |
| `T_drift` | Tolerance of the geometry self-check only.                                         | **PROVISIONAL** `0.10`. Set from the residuals of the geometry check. |
| `H_stale` | Age in hours at which the policy is reported `STALE`.                              | `12`.                                                                 |
| `H_max`   | Age in hours beyond which no reading is written at all.                            | `168` (RECOMMENDED).                                                  |

- Every reading stores the `T` it used and the version of the function that computed it. The table is append-only;
  without them a later change would leave history that cannot be interpreted.
- `T_drift` is tight on purpose. At the reference bar both numbers come from the same M5 chart, so they should agree to a
  few cents. A loose value would hide a one-bar counting error on a shallow line.
- Ages are wall-clock hours. A policy published on Friday is `STALE` at Monday's open until the next Publish. That is
  intended.
- **A volatility-adaptive `T`** (a fraction of M5 ATR) is not in the first release. It may be added later only with two
  rules written first: each bar is judged with the `T` of that bar, so `crossed_since_published` can never return from
  true to false; and the range across a weekend or daily-break gap is left out of the ATR.

### 10.3 The algorithm

Input: `symbol`, slot `S`.

**Step 1 — is there anything to compute?** Each of these ends the job successfully with no rows written:

| Check                                                                                                          | Outcome           |
| -------------------------------------------------------------------------------------------------------------- | ----------------- |
| No `market_cycles` row for `(symbol, S)` in state `READY`                                                      | `CYCLE_NOT_READY` |
| No session with `published_at ≤ S` (the **session in force** is the one with the greatest such `published_at`) | `NO_SESSION`      |
| The session in force has no lines                                                                              | `NO_LINES`        |
| `hours_since_published` > `H_max`                                                                              | `POLICY_EXPIRED`  |

`hours_since_published = (S − published_at) / 3600`.

**Step 2 — load the bars.** With `r` = `ref_bar_time`, read the M5 bars with `r ≤ timestamp ≤ S − 300` through the
existing `closedBarsFetcher` (`cycle/closed-bars-query.ts`; it is the one query that reads closed bars, so no second one
is written). Order them oldest first and number them `k = 0, 1, …, N`.

- If the oldest bar's `timestamp` is not `r`: every line is `INVALID` with `REF_BAR_MISSING`.
- If the newest bar's `timestamp` is not `S − 300`: every line is `INVALID` with `CYCLE_BAR_MISSING`.
- In both cases `value_now` and `side` are null, `crossed_since_published` is false and `touch_count_since_published` is 0.

**Step 3 — per line.** With `a1`, `a2`, `p1`, `p2` from the line:

- `v(k) = p1 + (p2 − p1) × (a1 + k) / (a1 − a2)`.
- The line **is defined at bar `k`** when `k ≥ −max(a1, a2)` and, if `ray_extends` is false, also `k ≤ −min(a1, a2)`.
- `side(k)`, for a bar where the line is defined, from `d = close(k) − v(k)`: `ABOVE` when `d > T`, `BELOW` when
  `d < −T`, otherwise `AT`.
- **`value_now`** = `v(N)` when the line is defined at `N`, else null.
- **`side`** = `side(N)`, or null when `value_now` is null.
- **Origin side** = `side(k0)`, where `k0` is the first bar from 0 on at which the line is defined and the side is not
  `AT`. If there is no such bar, there is no origin side.
- **`crossed_since_published`** = true when some bar after `k0` has a side that is not `AT` and differs from the origin
  side. False when there is no origin side.
- **Contact.** Bar `k` is a contact bar when the line is defined there and `low(k) − T ≤ v(k) ≤ high(k) + T`.
- **`touch_count_since_published`** = the number of runs of consecutive contact bars, among bars `k ≥ 1`, that are
  touches. A run is a touch **unless price finished it on the other side**: that is, unless the side at the run's last
  bar is not `AT` and differs from the last side that was not `AT` before the run (the origin side when there is none).
  A run still in progress at `N` is judged the same way.
- **Self-check.** When `value_at_publish` is present and `|v(0) − value_at_publish| > T_drift`: `VALUE_DRIFT`.
- **Future anchor.** When `a1` or `a2` is negative: `FUTURE_ANCHOR`.

**Step 4 — the bar-gap check, once per job.** `BAR_GAP` applies to every line when a `market_cycles` row (any state)
exists for a slot `s` with `r + 300 < s ≤ S` and no M5 bar with `timestamp = s − 300` exists. A slot with a cycle and no
bar means the market was open and a bar is missing from the database, so `k` is under-counted. A stretch with neither
cycles nor bars is a closed market and is not a gap.

**Step 5 — write.** One row per line, in one transaction, skipping rows that already exist for `(cycle_slot,
policy_line_id)`. Each row carries `flag`, `evaluator_version` and `tolerance_used`.

### 10.4 Status

`status` describes the **reading**, never whether the line still "holds" in the market. A crossed line has
`crossed_since_published = true`; it is not `INVALID`.

| Status       | When (the first that applies, from the top) | Reason codes                                 |
| ------------ | ------------------------------------------- | -------------------------------------------- |
| `INVALID`    | The reading cannot be computed.             | `REF_BAR_MISSING`, `CYCLE_BAR_MISSING`       |
| `STALE`      | `hours_since_published` > `H_stale`.        | `POLICY_OLD`                                 |
| `CAUTIONARY` | The value may be off.                       | `BAR_GAP`, `VALUE_DRIFT`, `FUTURE_ANCHOR`    |
| `VALID`      | Otherwise.                                  | may carry `LINE_ENDED` or `LINE_NOT_STARTED` |

- `LINE_ENDED`: `ray_extends` is false and the cycle bar is past the later anchor. `LINE_NOT_STARTED`: the cycle bar is
  before the earlier anchor. In both, `value_now` and `side` are null and the reading is otherwise correct.
- `status_reasons` lists every code that applies, whatever the status.
- The cycle's own data status (`FRESH`, `DELAYED`) plays no part here. Whether a cycle is too old to answer from is
  decided by the reply code, as it is for the sensors.

### 10.5 Tests required

- A fixture for each of: a weekend gap, a missing bar with a cycle row (`BAR_GAP`), a cross, two separate touches, a
  touch still in progress, a false break (crossed and back), a line that has ended, a line not yet started, a future
  anchor, a missing reference bar, a session change between two cycles, a zero-line session.
- Every fixture passes `T`, `T_drift`, `H_stale` and `H_max` explicitly.
- A replay test: the same slot computed twice gives the same rows, and the second write inserts nothing.
- A spec that the sensor outcome is unchanged when adding the Layer-2 job throws.

---

## 11. The label parser

It runs **in the gateway** at ingestion (§8.2 step 5), so it is versioned and applies to every Publish. `label_raw` and
`overview_raw` are always stored in full and are never shown to anyone.

### 11.1 Rule form for a line label

```
ROLE=<role> [ | BIAS=<bias> ] [ | NOTE=<free text to the end of the label> ]
```

- Keys and values are matched without regard to case. Spaces around `|` and `=` are ignored.
- `ROLE` is required and comes first. `NOTE`, when present, comes last and takes the rest of the label, including any
  `|` inside it.
- `ROLE` accepts the values of §9.3 and these input aliases: `UPTREND` and `TREND_UP` → `UPTREND_LINE`; `DOWNTREND` and
  `TREND_DOWN` → `DOWNTREND_LINE`. Only canonical values are stored.
- **Slope check.** With slope = `(p2 − p1) / (a1 − a2)`: `UPTREND_LINE` needs a slope above zero, `DOWNTREND_LINE` below
  zero. A label that fails is treated as malformed.

### 11.2 Rule form for the session overview

```
REGIME=<regime> [ | NOTE=<free text to the end> ]
```

Same matching rules. `REGIME` accepts the values of §9.3.

### 11.3 Three outcomes

| Text                                                                                                   | Outcome       |
| ------------------------------------------------------------------------------------------------------ | ------------- |
| Fits the rule form, and passes the slope check                                                         | **rule**      |
| Contains none of the tokens `ROLE=`, `BIAS=`, `REGIME=`, `NOTE=` (any case, spaces allowed before `=`) | **plain**     |
| Contains one of those tokens but does not fit the rule form, or fails the slope check                  | **malformed** |

### 11.4 What is stored

| Outcome   | `role`     | `bias_hint`         | `note`                            | `parse_method` |
| --------- | ---------- | ------------------- | --------------------------------- | -------------- |
| rule      | as written | as written, or null | the `NOTE` text, or null          | `rule`         |
| plain     | `OTHER`    | null                | the whole label, or null if empty | `none`         |
| malformed | `OTHER`    | null                | **null**                          | `none`         |

For the overview: **rule** → `regime_hint` as written and `overview_note` = the `NOTE` text; **plain** → `regime_hint`
null and `overview_note` = the whole text; **malformed** → both null.

- **`note` and `overview_note` are the only analyst texts that may ever be shown.** A malformed text is stored but shown
  to nobody, because it may contain a hint the grammar did not manage to separate out.
- A malformed text is logged as a warning and counted in `parse_summary` (§8.2).
- `parser_version` on the session names the parser, starting at `rule-1`. Until Phase 3 it is `none`: every line is
  stored as `OTHER / none` with `note` null.
- The tables are append-only, so a session keeps what the parser of its day produced. A newer parser applies from the
  next Publish on.
- `role: OTHER` on every line is acceptable in shadow, not in live.

### 11.5 A model-based parser (Q8, RECOMMENDED: not in the first release)

- **Why not.** There is one author and about three Publishes a day; the rule form costs a few keystrokes; a mistake is
  already visible in `parse_summary`. A model parse adds cost, a way to be wrong that nothing catches, and a confirmation
  step the append-only tables do not have.
- **Decide from data.** During shadow, count the labels stored as plain or malformed. If the share stays low, it is not
  needed.
- **If it is built later:** once per label at ingestion, through the reply pipeline's existing model gateway and metering,
  on the smallest model there, with a daily call limit; cached by label text; deriving `role` and `note` only, never a
  hint; and **a model-derived `role` is not shown to users** (the envelope reports `OTHER`) until a way for Davin to
  confirm it has been designed.

---

## 12. The read side: what the AI is given

Nothing here is built. Phase 4 starts only after Davin's sign-off on Q1 and the ADR in §12.4.

### 12.1 The reader

- A new reader in the monolith, `lib/reply/read/trendline-context.ts`, imported by path like its neighbours
  (`chart.ts`, `day-bars.ts`, `snapshot-at.ts`). It reads through `marketPrisma`.
- **Point in time.** It asks for the readings of the reply's own cycle: `symbol`, `cycle_slot`, `flag = 'live'`. It never
  asks for "the latest". No such rows → no envelope, and the reply carries no analyst context.
- It then loads the one session those readings name (`policy_session_id`) and its lines.
- **It fails closed.** A database error or an inconsistent result gives "no envelope" with a reason; it never throws into
  the reply.
- It reads `note` and `overview_note` only. It has no access path to `label_raw`, `overview_raw`, `bias_hint` or
  `regime_hint`: its `select` does not name them, and a test asserts that.

### 12.2 The envelope `trendline-context/1`

Assembled per request. Never stored.

```json
{
  "schema_version": "trendline-context/1",
  "symbol": "XAUUSD",
  "policy_published_at_utc": "2026-11-14T06:00:00Z",
  "hours_since_published": 3.25,
  "policy_stale": false,
  "session_overview": "Range-bound between the M30 and H1 bands",
  "cycle_slot": "2026-11-14T09:15:00Z",
  "image": {
    "image_kind": "composite_m5",
    "captured_at_utc": "2026-11-14T09:15:00Z"
  },
  "lines": [
    {
      "slot_key": "M15:TL3",
      "value_id": "TL.M15.TL3",
      "source_timeframe": "M15",
      "role": "RESISTANCE",
      "parse_method": "rule",
      "analyst_text": "strong M15 resistance",
      "value_now": 4041.61,
      "side": "BELOW",
      "crossed_since_published": false,
      "touch_count_since_published": 2,
      "status": "VALID",
      "status_reasons": []
    }
  ]
}
```

- `hours_since_published` is the reading's own value: `(cycle_slot − published_at) / 3600`. Here 09:15 − 06:00 = 3.25.
- `policy_stale` is true when the readings are `STALE` (`POLICY_OLD`).
- `session_overview` is the session's `overview_note`; `analyst_text` is the line's `note`. Either is absent when null.
  Both are present only if Q1 is signed off; without it the envelope carries levels, roles and computed facts only.
- **There is no `bias_hint`, `regime_hint`, `label_raw` or `overview_raw` key.**
- `image` is present only when the image passes §12.6.
- **Which lines are included.** A line whose `value_now` is null (ended, not started, or `INVALID`) is left out. Of the
  rest, at most **24** are included, those nearest to the last price. `analyst_text` is cut to **160** characters and
  `session_overview` to **300**. These three limits are RECOMMENDED and are fixed in the caps amendment (§12.5).

### 12.3 Values and the number check

- Each included line's `value_now` is an **addressable value**: the prompt shows its id beside the value, and the model
  writes `{TL.M15.TL3}`, never the number. The id is `TL.<source_timeframe>.TL<slot>`, which fits the existing id
  grammar. The ids are named in `lib/reply/context/values.ts` (the one place ids are named) and the entries are added in
  `lib/reply/checks/value-dictionary.ts` as prices with the existing ±$0.05 tolerance.
- The distance from the last price to each line is added as a **match-only** entry, following the existing `DIST.*`
  entries.
- **Figures inside analyst text** ("resistance near 4050") are added as match-only entries, as the figures in the
  sensors' own sentences already are. Otherwise a reply that repeats one would fail the number check.

### 12.4 Analyst free text and ADR-025 (Q1, RECOMMENDED, needs explicit sign-off)

**Recommended:** the analyst's `note` and `overview_note` reach the model as attributed commentary. They can never change
the board's verdict. Before Phase 4, all three of these exist:

1. **A new ADR** recording the decision. It takes the next free number in `docs/adr/` (the folder ran to 099 on
   2026-11-16).
2. **A new prompts version** (`PROMPTS_VERSION` in `lib/reply/context/static-text.ts`, `prompts.v1` today) with a static
   rule that says: the analyst's overview and line texts are the human strategist's map and opinion as of the publish
   time; bias, archetype and stand-aside come only from the board; when the two conflict, the reply states the analyst's
   earlier read and the board's current verdict, and the board governs; the reply always states how old the analyst's
   input is; it describes the analyst's lines as levels, never as an instruction to take a side.
3. **Eval scenarios** in `lib/reply/eval/scenarios.ts`, using the board's own words (`LONG`, `SHORT`, `NEUTRAL`,
   `STAND_ASIDE`):
   - the overview says "looking for a pullback buy inside the M15 support zone", the board says `SHORT` and the line has
     `crossed_since_published = true`: the reply keeps `SHORT`, says the line was crossed since publish, and proposes no
     long entry;
   - a line text describes an aggressive breakout target and the board says `STAND_ASIDE`: the reply keeps stand-aside;
   - a label typed as `ROLE=RESISTANCE | BIAS=BEARISH | NOTE=cap`: the assembled prompt contains "cap" and does not
     contain `BEARISH`;
   - the policy is 14 hours old: the reply says so.

**The existing direction-word check is not relaxed.** It reads what the model wrote, not what the analyst wrote. A reply
that takes a stance the board does not take fails it, as today. So the model must paraphrase the analyst's read as levels
and conditions; the static rule says so.

### 12.5 The context budget

Adding this envelope is a **contract change**, not configuration.

- `config/reply/context-caps.v1.json` has ten components whose caps add up exactly to the 19,600-token total. An eleventh
  component needs a new caps version and an amendment to **ADR-048** (context caps and cut order).
- Its position in the prompt affects caching and is settled in an amendment to **ADR-049** (prompt order for caching).
  The policy text changes only at Publish; the computed facts change every cycle.
- `lib/reply/context/assemble.ts` refuses any marker line it does not expect, so the component needs a marker label, a
  segment and a place in the cut order. RECOMMENDED: it is cut before any sensor reading, because it is opinion.

### 12.6 The image (Q4, RECOMMENDED)

- **Recommended:** at most one trendline image, always `composite_m5`, in addition to the existing cycle chart. So a
  request carries at most two images. It has its own cap in the new caps table, sized like the existing chart's (1,500
  tokens).
- It is used only when the existing chart gates pass (data status, intent, tier, vision) and a HEAD on its fixed R2 key
  shows all of:
  - `published_at` equals the session in the envelope,
  - `lines_sha256` equals that session's (an edit after Publish without a new Publish drops the image),
  - its age is at most 30 minutes (twice its cadence).
- If any check fails the reply goes without the image.
- **Source images are stored but not sent to the model.** A source chart is uncurated; it can show lines the policy does
  not hold. They are available for a UI, matched on `published_at` and age.
- **Measure before spending.** The numbers the model needs are already in the envelope. Before `live`, run the eval suite
  with the envelope alone and with the envelope plus the image. Keep the image only if the answers are measurably
  better. No second trendline image is added without such evidence and Davin's approval of the added cost per reply.

---

## 13. Failure modes

| Failure                                               | What happens                                                                                                          |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Uploader stopped, or its machine loses network        | Files wait in `trendline_context\`. Nothing is lost; all are handled on restart.                                      |
| The exporter is still writing when the uploader looks | The uploader sees only `*.tmp`, which it ignores.                                                                     |
| A truncated or hand-edited file                       | Parse failure → `quarantine\`, logged once.                                                                           |
| The same policy file is sent twice                    | The second answer is `DUPLICATE`; no second row.                                                                      |
| Same Publish key, different content                   | `CONFLICT`: the first session is kept, the file goes to `quarantine\`, an error is logged.                            |
| Gateway down, or a database error                     | `5xx` or a network error; the file stays and is retried.                                                              |
| Body rejected (`400`)                                 | `quarantine\`, logged once. No endless retry.                                                                         |
| Key refused (`401`, `403`)                            | Files stay and are retried; an error is logged at most once every 10 minutes. Nothing is lost while the key is fixed. |
| The sensor run fails for a cycle                      | No Layer-2 job is added for it. That cycle has no sensor readings either, so nothing can be answered from it.         |
| The module is enabled before the migration is applied | Writes fail with `5xx` and are retried; nothing is lost. The order in §15 avoids it.                                  |
| R2 upload fails                                       | The image pair stays and is retried. Policy is unaffected.                                                            |
| Lines edited after Publish, no new Publish            | Policy unchanged. New composite images carry another `lines_sha256` and are not shown.                                |
| The analyst's clock is wrong                          | A `published_at` in the future is refused with `400`. A wrong `ref_bar_time` shows as `REF_BAR_MISSING`.              |
| Terminal C has other M5 bars than Terminal A          | `REF_BAR_MISSING` or `VALUE_DRIFT`; readings are `INVALID` or `CAUTIONARY`, never silently wrong.                     |
| A bar is missing from the database                    | `BAR_GAP`; readings are `CAUTIONARY`.                                                                                 |
| Adding the Layer-2 job throws                         | Logged. The sensor write is unaffected. That cycle has no analyst context.                                            |
| The Layer-2 job fails                                 | Retried under `LANE_JOB_OPTIONS`. No reading for that cycle → the reply has no analyst context for it.                |
| The analyst publishes nothing for a long time         | Readings are `STALE` after `H_stale`; none are written after `H_max`.                                                 |
| A wrong `InpImageKind` on an attachment               | Visible in the filename and R2 key. A wrong period fails `OnInit`.                                                    |
| The feature misbehaves in live                        | Set `TRENDLINE_CONTEXT_FLAG` back to `shadow`: replies stop using it at the next cycle. Or disable the module.        |

---

## 14. Tests and verification

| Component | Required tests                                                                                                                                                                                                                                 | How it is verified                                                                               |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Exporter  | Compiles with 0 errors and 0 warnings. The geometry check (§16). A Publish on a test chart produces files that the uploader's parser accepts.                                                                                                  | MetaEditor compile; manual run on a terminal that is not A or B                                  |
| Uploader  | Unit tests for both parsers against **files written by the real exporter**; every row of the action table in §7.2; newest-only image upload; retention.                                                                                        | The real Python interpreter (not the Store stub); `requests` and `boto3` stubbed in tests only   |
| Gateway   | A contract spec with valid and invalid bodies; the module registers nothing when disabled; `RECORDED`, `DUPLICATE`, `CONFLICT`; `5xx` on a database failure; `403` for another valid key (Q6); `content_sha256` stable across parser versions. | The gateway's own type check, lint and tests (see `.claude/protocols/verification-checklist.md`) |
| Schema    | Both copies identical; `prisma validate`; `prisma migrate diff` against a throwaway database shows no difference.                                                                                                                              | Never against a real database                                                                    |
| Layer 2   | §10.5.                                                                                                                                                                                                                                         | Gateway tests                                                                                    |
| Parser    | Each row of §11.3 and §11.4; aliases; the slope check; a `NOTE` containing `\|`; case and spacing.                                                                                                                                             | Gateway tests                                                                                    |
| Read side | The reader never selects a hidden column; no live rows → no envelope; the limits of §12.2; value ids resolve; the eval scenarios of §12.4.                                                                                                     | `npx tsc --noEmit`, `npm run lint`, `npm run test:ci`, `npm run build`                           |

Verification is never skipped. A phase is not done while one of its checks has not been run, and the report says so
plainly.

---

## 15. Rollout

All of it is done by Davin or on his word, **after Stage B3 has cleared**.

1. Apply the migration.
2. Deploy the gateway with the module disabled. Then set `TRENDLINE_CONTEXT_ENABLED=true`. Never the other order. Leave
   `TRENDLINE_CONTEXT_FLAG` unset: this is **shadow**.
3. Create the uploader's key and set it on both sides (if Q6 is approved).
4. Set up terminal `C` and install the uploader as its own NSSM service on the same machine.
5. Attach the exporter to the M5 composite first, then to the six source charts.
6. Run in shadow for at least five trading days, including a weekend. During it:
   - compare `value_now` with the chart for a few lines, before and after the weekend;
   - review `status_reasons` (especially `VALUE_DRIFT`, `BAR_GAP`, `REF_BAR_MISSING`), the `CONFLICT` log and
     `quarantine\`;
   - measure M5 ranges and how often lines read `AT` or count touches, and set the final `T` and `T_drift`;
   - count the labels stored as plain or malformed.
7. Davin decides on **live**. It requires: Q1 signed off and its ADR, the rule parser, the read side built and its evals
   passing, and a calibrated `T`. Then set `TRENDLINE_CONTEXT_FLAG=live`.

---

## 16. Build plan

Each phase is one verifiable unit of work. Nothing deploys or migrates without Davin.

**Phase 0 — decisions and order.**
Davin signs off Q1, answers Q6 and Q7. The Advisor writes the order, with a `Decisions taken` section; Q1 and Q6 are
marked `⚠ NEEDS EXPLICIT SIGN-OFF`. The Executor confirms the order against live code before starting.
_Done when:_ the order is CONFIRMED.

**Phase 1 — Layer-1 ingestion, proven locally.**

1. Exporter: all of §6. Compile.
2. **Geometry check.** On a terminal that is not A or B (Davin's desktop is enough), draw a line across a weekend and
   compare the native value with `v(k)` of §6.5 and with a clock-time interpolation. **If `v(k)` does not match the native
   value, stop and return to the Advisor.** In the same step: check whether a long label is cut by MT5, how far back
   `iBarShift` on M5 reaches, and that `ref_bar_time_utc` equals a `timestamp` in `market_data_v6`.
3. Gateway: the route of §8, the schema and migration of §9 in both copies, the tests of §14. The parser is not built
   yet: `parser_version` is `none`.
4. Uploader: all of §7, tested against files from step 2.
5. End to end against a throwaway local PostgreSQL and a local gateway.

_Done when:_ one real Publish becomes one session row with all its lines; a repeat answers `DUPLICATE`; an edited repeat
answers `CONFLICT`; a zero-line Publish is stored; every test of §14 for these components passes.

**Phase 2 — Layer 2.** (The change to the sensor worker's file waits for B3.)
The queue, the processor, the pure function of §10.3, the configuration of §4.5, the tests of §10.5.
_Done when:_ the fixtures and the replay test pass, and the sensor-outcome spec passes.

**Phase 3 — the rule parser.**
§11.1 to §11.4, `parser_version = rule-1`, `parse_summary` in the response.
_Done when:_ the parser tests of §14 pass and the three label forms of §5.3 give the stored fields shown there.

**Phase 4 — the read side.** Only after Q1's sign-off and its ADR.
The reader, the envelope, the value ids and dictionary entries, the caps and prompt-order amendments, the new prompts
version, the image rule, the eval scenarios.
_Done when:_ the evals of §12.4 pass, the image comparison of §12.6 has been run and decided, and the monolith's four
checks pass.

**Phase 5 — rollout.** §15, by Davin, after B3.

**Phase 6 — optional.** A model-based parser (Q8). A coordinator EA, only if the shadow run shows attachments being lost
or misconfigured.

---

## 17. The current state of the code

### 17.1 Files in this folder

Folder: `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/mq5/new-market-context-synthesis-and-analysis-architecture/`

| File                                                         | Today                                                           | Work for v2                                    |
| ------------------------------------------------------------ | --------------------------------------------------------------- | ---------------------------------------------- |
| `TRENDLINE-CONTEXT-BLUEPRINT-V2.md`                          | This document                                                   | Kept current                                   |
| `TrendlineLabelUtils.mqh`                                    | v1; the Executor reports it compiles                            | §6.2: sanitiser, per-symbol flags, no fallback |
| `TrendlineScreenshotAndLabelExport_v2_29.mq5`                | v1; reported to compile; never run in a live terminal           | All of §6                                      |
| `trendline_context_uploader.py`                              | v1; its parser was unit-tested against a synthetic v1 file only | Rewritten to §7                                |
| `TrendlineValueExport_v2_29.mq5`                             | Per-bar numeric export of `tl_1..tl_12`                         | Not part of this pipeline; untouched           |
| `Objects Copier_6Sources_1Dest_v2_29.mq5`                    | **Davin's.** Combines six source charts onto one                | Not modified                                   |
| `SsaCrossingAndFractal_v2_29.mq5`                            | **Davin's.** A different, numeric data stream                   | Not part of this pipeline                      |
| `AutoFibonacci_v2_29.mq5`                                    | Not reviewed                                                    | Not part of this pipeline                      |
| `Trendline Context Blueprint v2.pptx` (and the Thai edition) | Presentation decks made from an earlier revision                | Not a reference; this document is              |
| `archive/`                                                   | The five superseded documents (§17.3)                           | Read for history only                          |

### 17.2 Files outside this folder

| File                                                                          | Today (v1)                                              | Work for v2                                                                   |
| ----------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `railway-gateway/src/trendline-context/trendline-context.module.ts`           | Flag-gated; registers the queue `trendline-policy-sync` | Drops that queue; registers `trendline-context-cycle` and its processor       |
| `railway-gateway/src/trendline-context/trendline-context.controller.ts`       | Adds a Bull job, always answers `{queued: 1}`           | §8.2                                                                          |
| `railway-gateway/src/trendline-context/trendline-context.processor.ts`        | Writes the session from the queue                       | Its write moves behind the controller; the file becomes the Layer-2 processor |
| `railway-gateway/src/trendline-context/trendline-context.service.ts`          | One unused read                                         | §8.4                                                                          |
| `railway-gateway/src/trendline-context/trendline-context.keys.ts`             | Queue and job names, `trendlineContextEnabled()`        | New queue name; the job-id helper for policy is removed                       |
| `railway-gateway/src/trendline-context/dto/trendline-policy-session.dto.ts`   | Loose validation                                        | §8.3                                                                          |
| New: a config module, the parser, the Layer-2 function                        | Do not exist                                            | §4.5, §11, §10                                                                |
| `railway-gateway/src/app.module.ts`                                           | Imports and registers the module                        | No change                                                                     |
| `railway-gateway/src/auth/api-key.guard.ts`                                   | Works out the caller's prefix for its log line          | §8.1 (if Q6 is approved)                                                      |
| `railway-gateway/src/sensors/cycle-ready.processor.ts`, `sensors.module.ts`   | Untouched by v1                                         | §10.1: one guarded add, after B3                                              |
| `prisma/market-data/schema.prisma`, `railway-gateway/prisma/schema.prisma`    | Three v1 models, identical in both                      | §9.1, identical in both                                                       |
| `prisma/migrations/20261114000000_add_trendline_context_tables/migration.sql` | v1 DDL, **never applied**                               | Edited in place to §9                                                         |
| `.gitignore`                                                                  | One entry for this folder's `.ex5` output               | No change                                                                     |
| `lib/reply/read/trendline-context.ts` and the files named in §12              | Do not exist / untouched                                | Phase 4                                                                       |
| `docs/handoffs/2026-11-14-trendline-context-advisor-review.md`                | A copy of the archived review                           | Kept as a dated handoff                                                       |

Comments in the v1 code cite the archived documents by name and section (for example "Blueprint §4.1"). Each file's
comments are changed to cite this document when the file is next touched.

### 17.3 The archive

`archive/` holds the documents this one replaces. They are kept for history and are **not** a reference.

| File                                                    | What it was                                                                        |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `TRENDLINE-CONTEXT-BLUEPRINT.md`                        | The v1 database and JSON contract, by the Executor                                 |
| `DATA-PIPELINE-ARCHITECTURE.md`                         | The v1 pipeline description, by the Executor                                       |
| `FABLE-REVIEW-PROMPT.md`                                | The brief for the Advisor's review                                                 |
| `2026-11-14-trendline-context-advisor-review.md`        | The Advisor's review of v1 (findings F1 to F16, Appendix A)                        |
| `TRENDLINE-CONTEXT-V2-OPEN-DECISIONS-Q1-Q2-Q3-Q5-Q9.md` | An external advisor's decision paper, written without codebase access (Appendix B) |

### 17.4 Verification record

| What                                                                                                                                    | Checked by | How                                                                                                                                                    | Result                                               |
| --------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Exporter and `.mqh` (v1)                                                                                                                | Executor   | Compiled with MetaEditor                                                                                                                               | Reported 0 errors, 0 warnings                        |
| Uploader parser (v1)                                                                                                                    | Executor   | `py_compile`; a unit test against a synthetic file                                                                                                     | Reported passed                                      |
| Gateway files (v1)                                                                                                                      | Executor   | `prisma generate`, then `npx tsc --noEmit` on the gateway                                                                                              | Reported clean                                       |
| Both Prisma schemas (v1)                                                                                                                | Executor   | `prisma validate` / `prisma generate`                                                                                                                  | Reported valid                                       |
| Schema copies identical; migration matches                                                                                              | Advisor    | Read and compared                                                                                                                                      | Identical; one nullability difference, fixed by §9.2 |
| Flag gating and guard use mirror the sibling modules                                                                                    | Advisor    | Read against `SensorsModule` and `symbol-specs`                                                                                                        | Sound                                                |
| No secret or real address in this folder or the module                                                                                  | Advisor    | Pattern search                                                                                                                                         | None found                                           |
| The slot clock, the bar table, the cycle-ready job, the `flag` column, the value-id mechanism, the wording check, the reply's read path | Advisor    | Read in live code, 2026-11-16                                                                                                                          | As stated in §1, §4.4, §10, §12                      |
| Everything specified in this document                                                                                                   | Nobody     | —                                                                                                                                                      | **Not built, not run**                               |
| **Never done, by design**                                                                                                               | —          | A live gateway call; a write to any PostgreSQL instance; the uploader against a real MT5 file; anything on the VPS; the migration against any database | —                                                    |

The Advisor's checks were made by reading code. The Advisor ran, compiled and tested nothing and did not repeat the
Executor's checks.

---

## 18. Open items: not yet verified

Each names the check that closes it.

| Item                                                                                               | Closed by                                        |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| An MT5 trend line is straight in bar space, so `v(k)` matches the native value across a gap (§6.5) | Phase 1 step 2. **Blocks everything after it.**  |
| `TLU_ServerToUtc` gives a `ref_bar_time` equal to a `timestamp` in `market_data_v6`                | Phase 1 step 2; then `REF_BAR_MISSING` in shadow |
| Davin's desktop terminal, and later terminal `C`, use Terminal A's broker server                   | Davin, before Phase 1 step 2                     |
| The VPS can carry a third MT5 terminal                                                             | Davin, before Phase 5                            |
| MT5 does not cut a long label                                                                      | Phase 1 step 2                                   |
| `iBarShift` on M5 reaches back far enough for old H4 anchors                                       | Phase 1 step 2                                   |
| The `BAR_GAP` rule (§10.3 step 4) does not raise false alarms in normal trading                    | The shadow run                                   |
| The final `T` and `T_drift`                                                                        | The shadow run                                   |
| Wiring the Layer-2 queue into the sensor module as §10.1 describes                                 | The Executor, at CONFIRM of Phase 2              |
| The eleventh component's cap, marker, cut rank and prompt position                                 | The ADR-048 and ADR-049 amendments, Phase 4      |
| Whether R2 offers a token limited to one key prefix                                                | Davin or the Executor, before Phase 5            |
| `TrendlineValueExport_v2_29.mq5`, `SsaCrossingAndFractal_v2_29.mq5`, `AutoFibonacci_v2_29.mq5`     | Out of scope; not reviewed                       |

---

## Appendix A — Why the design differs from v1

The Advisor's review of v1 found these defects. Each is fixed in the section named. The full review is in `archive/`.

| #   | Defect in v1                                                                                                                      | Fixed in       |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| F1  | Every chart posted its own lines under one `(symbol, published_at)` key; the first to arrive won and the rest were dropped        | §6.3, §7.2     |
| F2  | The M5 composite and the M5 source chart wrote the same filename and overwrote each other                                         | §6.4           |
| F3  | A failed Bull job kept its id, so every retry was ignored while the gateway answered 200: a Publish could vanish silently         | §8.2           |
| F4  | Line prices were to be interpolated in clock time from anchors in broker server time: wrong across gaps, timezones and DST        | §6.5, §10.3    |
| F5  | The envelope handed `bias_hint`, `regime_hint` and directional free text straight to the model, around ADR-025                    | §2.2, §12      |
| F6  | A half-written file could be read and stored as the session                                                                       | §6.2, §7.1     |
| F7  | A watermark let a later success hide an earlier failure; any 4xx was retried forever                                              | §7.4           |
| F8  | No retention: files and R2 objects grew without limit                                                                             | §7.3, §7.4     |
| F9  | Nothing recorded which image belonged to which session, so freshness could not be judged                                          | §7.3, §12.6    |
| F10 | Labels were written as ANSI and read as ASCII, destroying any other character                                                     | §6.2, §7.1     |
| F11 | `source_timeframe` and `slot_key` were inconsistent between charts and unvalidated                                                | §6.1, §8.3, §9 |
| F12 | Publish captured only the clicked chart, and captured it twice                                                                    | §6.2           |
| F13 | An edit after Publish made the picture disagree with the stored lines, silently                                                   | §12.6          |
| F14 | Layer 2 had no definitions for status, tolerance, touch or cross                                                                  | §10            |
| F15 | Layer 2 was planned as a second consumer of `cycle-ready`, which would compete for jobs                                           | §10.1          |
| F16 | The reply side was described as configuration; it is a change to the caps contract, the prompt structure and the value dictionary | §12.3, §12.5   |

Statements in the archived v1 documents that are not true, so they are not repeated from memory: "the gateway returns the
DUPLICATE outcome"; "mirrors the `symbol-specs` lane exactly"; "the picture and the data can never disagree"; `slot_key` is
"stable across redraws"; the `image_refs` example (two images with one key); camelCase field names.

## Appendix B — Where this design differs from the external advisor's paper

The paper (in `archive/`) was written without access to the codebase. Its recommendations for Q2, Q5 and Q9 were adopted
as written. These points were changed:

| Topic                      | The paper                                              | This document                                        | Why                                                                                      |
| -------------------------- | ------------------------------------------------------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Q1, what text is sent      | `label_raw` or the parsed note                         | Only `note` / `overview_note` (§11.4)                | A rule label contains `BIAS=…`; sending it leaks the hint the paper itself keeps hidden  |
| Q1, ADR number             | ADR-050                                                | The next free number                                 | 050 is taken                                                                             |
| Q1, eval wording           | Board bias `BEARISH`                                   | `LONG` / `SHORT` / `NEUTRAL` / `STAND_ASIDE`         | Those are the board's words; `BEARISH` is the analyst-hint vocabulary                    |
| Q1, size and wording check | Not addressed                                          | Limits in §12.2; the check is kept as is (§12.4)     | 72 labels of 2,000 characters fit no budget; the check enforces ADR-025 on the output    |
| Q2, slope                  | Not addressed                                          | The parser rejects a role that contradicts the slope | Cheap protection against a typing mistake                                                |
| Q3, formula                | Two different ATR formulas in one paper                | A fixed `T` first; an adaptive one deferred          | The paper contradicts itself and does not define the per-bar and gap rules it would need |
| Q3, fixed default          | `1.50`                                                 | PROVISIONAL `0.80`, then measured                    | By the paper's own figures 1.50 is most of a quiet M5 bar                                |
| Q3, drift tolerance        | `0.50`                                                 | PROVISIONAL `0.10`                                   | Both values come from one chart; 0.50 would hide a one-bar error on a shallow line       |
| Q3, units and levels       | Points at an assumed tick; price levels stated as fact | Price units; levels to be measured                   | The paper had no data                                                                    |
| Q3, ageing notice at 8 h   | In its summary only                                    | Dropped                                              | `hours_since_published` already states the age                                           |
| Q5, source images          | Sent when the user asks about one timeframe            | Not sent in the first release                        | Source charts are uncurated and not hash-checked                                         |

## Appendix C — Change log

| Revision | Date       | Change                                                                                                                                                                                |
| -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | 2026-11-14 | First consolidated v2: the two v1 documents and the Advisor's review merged, with every review fix applied.                                                                           |
| 2        | 2026-11-16 | Decisions Q1, Q2, Q3, Q5, Q9 filled in; recommendations for Q4, Q6, Q7, Q8 added; one example value corrected.                                                                        |
| 3        | 2026-11-16 | Rewritten as the single source of truth: normative sections first, history moved to appendices, superseded documents archived. Substantive changes in this revision are listed below. |

**What revision 3 changed in substance** (each from reading live code, or to close a gap):

- **The cycle clock.** `cycle_slot` is a 5-minute boundary at which the newest closed M5 bar opened 300 s earlier. So the
  session in force is the one with `published_at ≤ S`, `hours_since_published = (S − published_at) / 3600`, and bars are
  counted up to `S − 300`. Revision 2 had assumed the opposite and corrected the envelope example to 3.33; it is 3.25.
- **The stale-cycle clause is gone.** `market_cycles.data_status` is only ever `FRESH` or `DELAYED`; staleness of a cycle
  is decided by the reply code. Layer 2's `STALE` now means only that the policy is old.
- **Shadow and live** are carried by a `flag` column on each reading, as on `mcd_outputs`, with a gateway setting. The
  monolith needs no flag of its own.
- **Schema.** Readings gain `flag` and `evaluator_version`; `side` is nullable; an index on `(symbol, cycle_slot)`. The
  session stores `overview_raw` and a showable `overview_note`.
- **The showable text is decided at ingestion.** `note` and `overview_note` are the only analyst texts the reader can
  select; a malformed label has none. This replaces the rule the reader would have had to apply.
- **Layer 2 is fully specified**: the algorithm, the meaning of a line being defined at a bar, origin side, cross, touch,
  `BAR_GAP`, `REF_BAR_MISSING`, `CYCLE_BAR_MISSING`, `LINE_ENDED`, `LINE_NOT_STARTED`, status precedence, and an upper
  age `H_max`.
- **The parser is fully specified**: grammar, three outcomes, what is stored, `parse_summary` in the response.
- **The gateway route**: the first release accepts only `XAUUSD`; a `published_at` in the future is refused;
  `content_sha256` is defined exactly; a session with zero lines is valid (the way to withdraw all lines).
- **The read side**: the reader's place and rules, the value ids, the dictionary entries, the limits, the ADRs to amend.
  The direction-word check is kept unchanged; the earlier open question about it is closed.
- **Configuration**: every exporter input, uploader variable and gateway variable is listed in §4.5.
- **New sections**: the analyst's workflow (§5), tests and verification (§14), "done when" criteria in the build plan.
