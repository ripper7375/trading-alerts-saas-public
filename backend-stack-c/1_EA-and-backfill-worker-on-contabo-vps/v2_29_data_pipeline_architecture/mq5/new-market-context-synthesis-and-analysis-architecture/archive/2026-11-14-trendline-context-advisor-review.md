# Trendline Context: Advisor feasibility review, fixes and implementation plan

- **Date:** 2026-11-14
- **Role:** Advisor review of the Executor's draft (architecture and implementation)
- **Status:** PRE-DRAFT input for the next Executor order. Not an order; nothing here is APPROVED or CONFIRMED.
- **Reviewed:** `TRENDLINE-CONTEXT-BLUEPRINT.md`, `DATA-PIPELINE-ARCHITECTURE.md` and every file in their §1a File Inventory, in
  `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/mq5/new-market-context-synthesis-and-analysis-architecture/`,
  plus `railway-gateway/src/trendline-context/`, both Prisma schema copies and migration `20261114000000_add_trendline_context_tables`.
- **Repository edits made by this review:** none, other than this file.

**Verdict:** the two-layer idea is sound and worth building, but the implementation as drafted would not produce a correct
Layer-1 row reliably, and the designed read side opens a side door around ADR-025. Five defects are blocking; all have
concrete fixes below.

**Basis:** every file in §1a was read, plus the sibling code it claims to mirror. Nothing was run, compiled or tested, so every
finding is from reading code. One claim (F4, MT5 line geometry) comes from knowledge of MT5 and must be confirmed with the
live check in Phase 1.

## 1. What holds up

- **Repository state:** all pipeline files are untracked or modified-uncommitted, and the branch is 0 ahead / 0 behind
  `origin/main`. The migration header says "not applied".
- **Secrets:** a scan of the folder and `railway-gateway/src/trendline-context` for IPv4s, Railway hosts, connection strings
  and key literals found nothing.
- **Schema mirror:** the three models are identical in both Prisma schema copies, and the migration sits in the same folder as
  the `mcd_outputs` one.
- **Flag gating:** `TrendlineContextModule.register()` mirrors `SensorsModule.register()` faithfully.
- **Auth guard:** `ApiKeyGuard` is applied the same way as on `symbol-specs`.
- **Davin's copier:** it filters by object type, so it does not delete or copy the exporter's buttons, legend or overview box.
- **Transaction size:** not a risk. Even the hard maximum (99 slots × 6 timeframes ≈ 600 lines) is trivial for Postgres; the
  ~100 KB body limit bites first. Bound it anyway (F11).
- **5-minute Layer-2 cadence:** keep it. About 20k rows per day at 72 lines is cheap, and it rides an existing trigger.
- **Own NSSM service, 30 s poll:** both fine.

## 2. Blocking defects

### F1. The Layer-1 idempotency key collides across the eight attachments

- `published_at` is one terminal-wide GlobalVariable, but each attachment writes a different sidecar: its own lines, and the
  overview only on the chart where Publish was clicked (`g_session_overview` is per instance, `.mq5:84,207`).
- All eight POST under the same `(symbol, published_at)`; the first to arrive wins and the rest are dropped as duplicates.
- Publish clicked on a source chart stores only that chart's lines as "the session". The Publish button exists on all eight.

**Fix:** policy comes from exactly one file, never from image sidecars.

- Add input `InpImageKind` (`SOURCE` | `COMPOSITE`). The Publish button is created only on `COMPOSITE`; Start Curation stays
  everywhere.
- On Publish, the clicked composite writes `trendline_context/TrendlinePolicy_<symbol>_<published_at>.tsv` (format in §5.1).
- The uploader POSTs policy only from `TrendlinePolicy_*.tsv`. Image sidecars never produce a POST.

### F2. `composite_m5` and `source_m5` write the same filename

- The name is `<base>_<symbol>_<period>_<stamp>` (`.mq5:300`), so the two M5 charts overwrite each other's PNG and TSV. Same
  for M15.
- Blueprint §5's own example shows identical `r2_key` values for the two.

**Fix:** put the kind in the name: `<base>_<symbol>_<kind>_<TF>_<stamp>.png`, with `<kind>` = `composite` or `source` and
`<TF>` = `M5`, not `PERIOD_M5`.

### F3. A failed job permanently swallows that Publish while the gateway answers 200

- The controller enqueues with `jobId = symbol_published_at` (`controller.ts:53-54`). Bull ignores an add whose id already
  exists, including a failed job.
- The module registers the queue with no job options (`module.ts:38`), so there is one attempt. `symbol-specs` uses
  `LANE_JOB_OPTIONS` (3 attempts).
- Three ways to fail deterministically:
  - a line with `anchor1_time == anchor2_time` (the DB CHECK at `migration.sql:77` has no DTO counterpart, and the exporter
    does not filter it);
  - the flag turned on before the migration is applied;
  - a DB blip.
- Afterwards every re-POST returns `{queued: 1}`, the uploader marks the file handled, and the session never exists.
- Pipeline §3 rows 2 and 3 are therefore wrong. The HTTP response also never carries `DUPLICATE`; that is only the job's
  return value.

**Fix:** write synchronously in the controller and drop the queue for this lane (about three Publishes a day cannot delay
price ingestion).

- Return `200 {outcome: "RECORDED" | "DUPLICATE" | "CONFLICT", session_id, content_sha256}`.
- `CONFLICT` means same key, different `content_sha256`; log it loudly and keep the first.
- Return 5xx on a database error, so the sender's retry is real.
- If Davin prefers lane uniformity, the alternative is `LANE_JOB_OPTIONS` plus full DTO validation plus a
  `GET /policy/:symbol/:published_at` the uploader confirms against before marking a file handled.

### F4. The anchor-based price recomputation is wrong in three ways

The principle (store geometry, not a frozen price) is right. The specification is not.

1. **Timezone:** anchors are written in raw broker server time (`.mq5:353-354`), while `captured_at`, `published_at` and
   `cycle_slot` are UTC. On a UTC+2/+3 broker every sloped line is off by 2 to 3 hours of slope.
2. **Geometry:** an MT5 trend line is straight in bar-index space, not in clock time. Linear interpolation in seconds diverges
   after every session gap. XAUUSD has a daily break and weekends, so an H4 line drifts by roughly a weekend's worth of slope
   every Monday.
3. **DST:** converting an old anchor with today's offset is an hour off for anchors on the other side of a broker DST change.

**Fix:** store bar offsets, counted on M5, relative to a reference bar.

- The exporter adds per line `anchor1_bars_ago_m5` and `anchor2_bars_ago_m5` (`iBarShift(_Symbol, PERIOD_M5, anchorTime)`
  minus the reference bar's shift; negative if in the future).
- It adds once per file `ref_bar_time_utc`, the open time of the last closed M5 bar. Converting that with the current offset is
  correct because the bar is current.
- Layer 2 computes `n` = M5 bars in the database with `ref < open_time ≤ cycle_slot`, then
  `value = p1 + (p2 − p1) × (a1 + n) / (a1 − a2)`.
- This needs no historical timezone conversion and no deep history. It matches the M5 composite chart, which becomes the
  canonical geometry.
- Keep `anchor*_time` (converted to UTC, documented as display-only) and add `value_at_publish` as a self-check.
- The time-slope fallback in `TrendlineLabelUtils.mqh:156-166` has the same flaw; when the native lookup fails it should return
  `EMPTY_VALUE`.

### F5. The §5 envelope is a side door around ADR-025

- Storage is inert today, as claimed: nothing reads `TrendlineContextService`.
- The designed envelope, however, hands `bias_hint`, `regime_hint`, a directional free-text overview ("H4 still downtrend") and
  `role` values `TREND_UP`/`TREND_DOWN` straight to the model.
- That is exactly "a direct read by the model". ADR-025's stated reason is that a model can change direction on regeneration.

**Fix:** envelope v1 omits `bias_hint` and `regime_hint` entirely (keys absent, not null). They stay in the database only, as a
possible future SYN input.

- Whether analyst free text reaches the model at all is Davin's decision (Q1).
- If yes, it needs:
  - a new ADR;
  - a `PROMPTS_VERSION` bump with a static rule: analyst lines are levels and the analyst's opinion, the board alone gives
    direction, and on conflict the reply says so and the board governs;
  - eval scenarios in `lib/reply/eval/scenarios.ts` where the analyst text contradicts the SYN bias and the reply must keep the
    SYN bias.

## 3. Serious defects

| #   | Finding                                                                                                                                                                                                                                                                                       | Fix                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F6  | **Truncated sidecar accepted.** The file is written in place (`.mq5:328-369`), and `parse_sidecar` never compares rows to `line_count` (`uploader.py:187-217`). A mid-write read POSTs a short session, which then wins forever.                                                              | Write to `<name>.tmp`, then `FileMove`. End the file with `end<TAB>1`. The parser requires the trailer and `rows == line_count`.                                                                                                                                                                                                                                                                                                                           |
| F7  | **Watermark leapfrog.** Files are handled in sorted order and the state stores the newest success (`uploader.py:299-306`), so a failed file followed by a successful one is skipped for good. Any 4xx is retried every 30 s forever. The state key also contains the date, so it grows daily. | Per-file handling: on success move the pair to `sent\`; on 400 move it to `quarantine\` and log once; on 5xx or network error leave it. No watermark file.                                                                                                                                                                                                                                                                                                 |
| F8  | **No retention.** About 530 captures a day leave about 1,070 files a day in `MQL5\Files` forever, and R2 gets a new key per capture, unbounded. `mtf_render`'s prune only covers the `xauusd/` prefix.                                                                                        | Write to the subfolder `MQL5\Files\trendline_context\`. Prune `sent\` after 48 h. In R2 use one fixed key per image, `trendline-context/<symbol>/<image_kind>.png`, overwritten each capture, as `mtf_render` does.                                                                                                                                                                                                                                        |
| F9  | **No way to build `image_refs` or judge freshness.** Nothing records which images exist, and the existing chart rule (stamp must match the cycle) can never pass for a 15/60/240-minute image.                                                                                                | Put a stamp in the R2 object metadata: `symbol`, `image_kind`, `captured_at`, `published_at`, `lines_sha256`. The read side does a HEAD per key and accepts an image only if `published_at` and `lines_sha256` match the current session and its age is ≤ 2× its cadence.                                                                                                                                                                                  |
| F10 | **Non-ASCII labels are destroyed.** `FILE_ANSI` on write, `encoding="ascii", errors="replace"` on read. This contradicts "exactly what the analyst typed".                                                                                                                                    | `FileOpen(..., FILE_WRITE\|FILE_TXT\|FILE_ANSI, '\t', CP_UTF8)`; read as UTF-8. Split on `\n` only (`splitlines()` also splits on VT, FF and U+2028).                                                                                                                                                                                                                                                                                                      |
| F11 | **`source_timeframe` and `slot_key` are inconsistent and unguarded.** A source chart emits `PERIOD_M15:TL3`, a composite `M15:TL3`. A composite with unset labels collapses `A_…TL3` and `B_…TL3` into one key. The input comments say A=M5…F=M3; the documents say A=M3…F=H4.                | The exporter emits `M3\|M5\|M15\|M30\|H1\|H4` always. A composite refuses to Publish if any trend line with a slot has an unmapped prefix. DTO: `@IsIn` on `source_timeframe`, `@Matches(/^(M3\|M5\|M15\|M30\|H1\|H4):TL\d{1,2}$/)` on `slot_key`, unique `slot_key` within the body, `@ArrayMinSize(1) @ArrayMaxSize(600)` on `lines`, the `@Matches` on `symbol` that the comment claims, anchors not equal. Schema: `@@unique([session_id, slot_key])`. |
| F12 | **Publish does not propagate.** Only the clicked chart captures. H4 keeps showing pre-Publish lines for up to 4 hours. The clicked chart also captures twice (`.mq5:214` stores an unaligned boundary), and the second file has `captured_at < published_at`.                                 | In `OnTimer`, every instance compares `TLU_LastPublishedAt()` with the last value it saw and force-captures on change. After a Publish capture, set `g_last_capture_boundary` to the aligned boundary.                                                                                                                                                                                                                                                     |
| F13 | **Edits after Publish drift silently.** A later capture carries the same `published_at` with different lines. The policy correctly stays, but the image now disagrees with it.                                                                                                                | Covered by `lines_sha256` in F9: the drifted image is dropped and a `CONFLICT` is logged.                                                                                                                                                                                                                                                                                                                                                                  |
| F14 | **Layer 2 is under-specified.** `status`, the `AT` tolerance, "touch" and "crossed" are undefined. The column is `touch_count_since_publish` but the envelope says `…_published`. Nothing says which session applies at a slot.                                                               | Definitions in §5.3.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| F15 | **Layer 2 cannot be "a second consumer" of `cycle-ready`.** Bull consumers of one queue compete for jobs, and a failure inside `CycleReadyProcessor` would endanger the certified sensor path.                                                                                                | After its own commit, `CycleReadyProcessor` enqueues `trendline-context-cycle` (job id `<symbol>_<slot>`, `LANE_JOB_OPTIONS`) inside a try/catch that can only log. A separate processor in `TrendlineContextModule` consumes it.                                                                                                                                                                                                                          |
| F16 | **The reply side is a contract change.** `context-caps.v1.json` has ten components whose caps sum exactly to the 19,600 total. `assemble.ts` refuses any marker line it does not expect. The reply pipeline also has a number dictionary (`values.ts`).                                       | An 11th component needs a caps v2 (ADR-048/049 amendment), a marker label, a segment and a cut rank, and probably value-dictionary entries for line prices. The Executor must confirm the last from live code; it was not traced in this review.                                                                                                                                                                                                           |

**Smaller items**

- `parse_method: "manual"` mislabels lines nobody parsed. Add `none` to the vocabulary.
- Parsing in the uploader plus append-only tables means pre-parser sessions stay `OTHER` forever. Move the rule parser into the
  gateway and add a `parser_version` column.
- No `terminal_id`, although there are two terminals.
- The curation flag and `published_at` are terminal-wide, not per symbol.
- `TLSX_Tag_<slot>` names collide on a composite (`.mq5:403`); use the slot key.
- Both `@@index([symbol, published_at])` and `@@index([cycle_slot])` duplicate a unique index. Readings need
  `@@index([policy_session_id, cycle_slot])`.
- `source_charts` is nullable in the SQL but not in Prisma; run `prisma migrate diff` against a throwaway database.
- There is no spec for the module anywhere (`symbol-specs` has a contract spec; `sensors` has a disabled-consumes-nothing spec).
- §2.4's "mirrors `symbol-specs` exactly" is not true, per F3 and F11.

## 4. Operational positions

- **Eight hand-set inputs:** not workable long-term, but the full coordinator EA is not needed either.
  - The cadence problem disappears if `InpCaptureEveryMinutes = 0` means "auto from `_Period`" (M3/M5/M15 → 15, M30/H1 → 60,
    H4 → 240) and 0 is the default.
  - Publish atomicity is F12 and the policy source is F1.
  - What remains by hand is one enum per chart, and a wrong value is visible in the filename.
  - Build the coordinator only if the shadow run shows attachments being lost.
- **Eight images per request:** not a sound target.
  - At the existing CHART cap of 1,500 tokens, eight images are 12,000 of a 19,600 budget, before the cost and payload of eight
    base64 PNGs.
  - The H4 image can be four hours old.
  - The numbers the model needs are already in the JSON.
  - Capture and store all eight (cheap, useful for UI). Send at most one trendline image per request in v1, the composite
    matching the question's timeframe, under the existing chart gates. Raising that is a cost decision (Q4).
- **`slot_key` stability (Blueprint §10c):** it is unique within one session only. `TL3` in the next session may be a different
  line. Fix the "stable across redraws" comments and build nothing cross-session on it.
- **`role: OTHER` interim (pipeline §9c):** acceptable in shadow, not in live.

## 5. Corrected contracts

### 5.1 Files (all in `MQL5\Files\trendline_context\`, UTF-8, written as `.tmp` then renamed)

**Policy file** `TrendlinePolicy_<symbol>_<published_at>.tsv`, written once per Publish by the clicked composite:

```
schema<TAB>trendline-policy/2
symbol<TAB>XAUUSD
terminal_id<TAB>A
published_at_utc<TAB><unix s>
ref_bar_time_utc<TAB><unix s, open of last closed M5 bar>
session_overview<TAB><text or empty>
line_count<TAB><n>
slot<TAB>slot_key<TAB>source_timeframe<TAB>anchor1_time_utc<TAB>anchor1_price<TAB>anchor1_bars_ago_m5<TAB>anchor2_time_utc<TAB>anchor2_price<TAB>anchor2_bars_ago_m5<TAB>ray_extends<TAB>value_at_publish<TAB>label
<n rows>
end<TAB>1
```

**Image sidecar** `<base>_<symbol>_<kind>_<TF>_<yyyymmdd_hhmm>.png.tsv`:

- Keys: `schema` (`trendline-image/2`), `image`, `symbol`, `image_kind` (for example `composite_m5`, `source_h4`),
  `captured_at_utc`, `session_published_at_utc`, `lines_sha256`, `end`.
- It has no line rows.
- `lines_sha256` is SHA-256 over the sorted `slot_key|a1_bars|p1|a2_bars|p2|ray` rows. A composite and the policy file use the
  same recipe; a source chart hashes its own lines and is matched on `published_at` only.

### 5.2 Gateway and schema

- `POST /api/v1/trendline-context/policy` is synchronous, with the response in F3.
- Body: `symbol`, `terminal_id`, `published_at`, `ref_bar_time`, `overview_note?`, `lines_sha256`, `lines[]`.
- Each line: `slot_key`, `slot`, `source_timeframe`, `anchor1_time`, `anchor1_price`, `anchor1_bars_ago_m5`, `anchor2_time`,
  `anchor2_price`, `anchor2_bars_ago_m5`, `ray_extends`, `value_at_publish?`, `label_raw`.
- Removed from the body: `role`, `bias_hint`, `regime_hint`, `note`, `parse_method`, `source_charts`. The gateway derives them.

Schema changes (edit the unapplied migration in place, both schema copies):

- `TrendlinePolicySession` gains `terminal_id String`, `ref_bar_time Int`, `lines_sha256 String` and `parser_version String`;
  drop the duplicate index.
- `TrendlinePolicyLine` gains `anchor1_bars_ago_m5 Int`, `anchor2_bars_ago_m5 Int` and `value_at_publish Float?`;
  `@@unique([session_id, slot_key])` replaces the index; `parse_method` CHECK becomes `rule | model | manual | none`; add CHECK
  `anchor1_bars_ago_m5 <> anchor2_bars_ago_m5`.
- `TrendlineContextReading` gains `symbol String` and `status_reasons String[]`; rename `touch_count_since_publish` to
  `touch_count_since_published`; `@@index([policy_session_id, cycle_slot])` replaces `@@index([cycle_slot])`.

### 5.3 Layer-2 definitions

- **Session at slot S:** the session with the greatest `published_at ≤ S + 300`. This is deterministic on replay.
- **`value_now`:** the formula in F4. It is null when `ray_extends` is false and the cycle bar is past anchor 2.
- **`side`:** compare the last closed M5 close with `value_now`; `AT` when within the tolerance `T`.
- **`crossed_since_published`:** some M5 bar since publish closed on the opposite side from the close at publish, by more than
  `T`.
- **`touch_count_since_published`:** the number of separate runs of M5 bars whose high-low range came within `T` of the line
  without a close beyond it.
- **`status`** describes the reading, never the line's market validity (a crossed line is `crossed = true`, not `INVALID`):
  - `INVALID`: the value cannot be computed.
  - `STALE`: the policy is older than `H_stale` hours, or the cycle itself is STALE.
  - `CAUTIONARY`: the M5 bar chain since the reference bar has a gap, or `value_at_publish` disagrees with the recomputed value
    by more than `T`; the reason goes in `status_reasons`.
  - `VALID`: otherwise.
- `T` and `H_stale` are parameters for Davin (Q3).

### 5.4 Envelope v1 (`trendline-context/1`)

- As Blueprint §5, minus `bias_hint` and `regime_hint`.
- `touch_count_since_published` spelled consistently.
- Each line carries `parse_method`.
- `image_refs` is replaced by at most one `image: {image_kind, captured_at_utc}`, chosen by the read side.
- `session_overview` and `label_raw` are present only if Q1 is answered yes.

## 6. Questions for Davin

1. **ADR-025:** may the analyst's free text (overview, labels) reach the model at all? If yes, under the rule in F5? Should
   `bias_hint` / `regime_hint` ever enter the SYN rules table, and on which rung?
2. **Vocabulary:** the final `role` list. `TREND_UP`/`TREND_DOWN` appear in both `role` and `regime_hint`, which undercuts the
   Blueprint's own "cannot be confused" argument. Rename one set?
3. **Layer-2 numbers:** the touch/AT tolerance `T` (points, or a fraction of ATR?) and the staleness limit `H_stale` (12 hours?).
4. **Images:** is one trendline image per request acceptable for v1? What cost ceiling applies if more are wanted?
5. **Two composites:** the copier has one destination, so `composite_m5` and `composite_m15` are filtered by hand twice and can
   differ. Is the M15 composite needed, or is M5 canonical and enough?
6. **Auth (non-negotiable 5):** today any key in `API_KEYS` can write analyst policy, and the uploader would log as
   `push_worker_`. Do you want a dedicated `trendline_uploader_` key, with this route restricted to it?
7. **Where you draw:** Terminal A, B or another machine? B3's freeze forbids touching Terminal A's indicator inputs, and a
   standby terminal has its own GlobalVariables.
8. **Model-path parser:** which model, what cost ceiling, and should a model-derived `role` be shown before you have confirmed
   it?

## 7. Implementation plan

Each phase is one verifiable unit. Nothing below deploys or migrates without Davin, and nothing on the VPS happens before B3 is
clear.

**Phase 0: decisions and order.** Davin answers Q1 to Q7. The Advisor drafts the order with a `Decisions taken` section; Q1 and
Q6 are marked `⚠ NEEDS EXPLICIT SIGN-OFF`.

**Phase 1: correct Layer-1 ingestion, proven locally.**

1. MQL5: `InpImageKind`, auto cadence, subfolder, atomic UTF-8 writes, the policy file, bar offsets, UTC anchors, publish
   propagation, tag names, and the Publish refusal on unmapped prefixes (F1, F2, F4, F6, F10, F11, F12). Compile.
2. **Geometry check:** on any terminal that is not Terminal A, draw one line across a weekend and compare the exporter's
   `value` with both the time formula and the bar formula. This confirms or refutes F4 before anything depends on it.
3. Gateway: synchronous controller, new DTO, `lines_sha256` conflict handling, schema and migration edits in both copies (F3,
   F11, §5.2). Specs: a contract corpus, flag-off-registers-nothing, duplicate, conflict, and 5xx on database failure.
4. Uploader: policy and image lanes, `sent\` / `quarantine\`, fixed R2 keys with stamp metadata, PNG completeness check, 48 h
   prune (F7, F8, F9). Unit tests against files produced by the real exporter in step 2.
5. End to end against a throwaway local Postgres and a local gateway: one real Publish becomes one session row with all lines;
   a repeat is `DUPLICATE`; an edited repeat is `CONFLICT`.

**Phase 2: Layer-2 computation.**

- The `trendline-context-cycle` queue and processor (F15), a pure function for §5.3, and fixtures covering a weekend gap, a
  missing bar, a cross, two touches, and a session change mid-cycle.
- A replay test: the same slot computed twice gives the same rows.

**Phase 3: rule parser (gateway side).**

- A deterministic `ROLE=… | BIAS=… | NOTE=…` parser with `parser_version`.
- Anything unparsed becomes `role: OTHER, parse_method: none`.
- Needs Q2. The model path is not started until Q8.

**Phase 4: read side.**

- Only after Q1 and an ADR.
- Envelope assembly in the packet builder, caps v2 with the 11th component, marker and structure check, value-dictionary
  entries, the image rule from F9, a `PROMPTS_VERSION` bump, and the ADR-025 eval scenarios.
- Flag `off`.

**Phase 5: rollout (Davin, after B3).**

1. Apply the migration.
2. Deploy the gateway with `TRENDLINE_CONTEXT_ENABLED` unset, then `true`. Never the reverse order.
3. Install the uploader service with its own key, if Q6 says so.
4. Attach the exporter to the composite first, then the six sources.
5. Run in shadow for at least five trading days, including a weekend.
6. Check the drift reasons and the `CONFLICT` log.
7. Davin decides on `live`.

**Phase 6 (optional):** the model-path parser, and the coordinator EA if shadow shows attachment drift.

## 8. Not checked

- Whether `OBJPROP_TEXT` on a trend line or the edit box truncates long labels in this MT5 build (verify in Phase 1 step 2).
- Whether `iBarShift` on M5 reaches back far enough for old H4 anchors on the VPS terminal.
- How the monolith's packet builder reads `mcd_outputs` today, which decides where the envelope is assembled.
- `TrendlineValueExport_v2_29.mq5` and `SsaCrossingAndFractal_v2_29.mq5` beyond a skim; both are out of scope.
