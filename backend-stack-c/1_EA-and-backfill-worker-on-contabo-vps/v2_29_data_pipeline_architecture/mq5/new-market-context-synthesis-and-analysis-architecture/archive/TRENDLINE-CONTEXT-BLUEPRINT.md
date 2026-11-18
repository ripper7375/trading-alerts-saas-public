# Trendline Context Blueprint — Database Architecture & JSON Contract

**Status:** DRAFT, for feasibility review. Nothing in this document is built, migrated or deployed.
**Written:** 2026-11-14, by the Executor (Claude Code), from a working session with Davin (project owner).
**Purpose of this document:** a self-contained design the reader can assess on its own — for correctness, completeness and feasibility — without needing this project's full history. Where it leans on an existing decision elsewhere in the codebase, that decision is summarised inline and the source is named, not assumed as known.

---

## 0. One-paragraph summary

An analyst (Davin) periodically (roughly every 8 hours) draws trendlines by hand on MetaTrader 5 charts across six timeframes -- M3, M5, M15, M30, H1 and H4. M3 carries a fractal-based narrow-channel technique the analyst calls "Constellation" by alias; in every schema, contract and file in this project the timeframe name **M3** is the one actually stored -- "Constellation" is never a separate value, only the human name for that timeframe's lines. The analyst labels each line in plain English, writes one short free-text "session overview" sentence, and clicks a **Publish** button. MQL5 tools already built export this as a screenshot (PNG) plus a sidecar data file (TSV) per chart. This document specifies: (a) the wire format those MQL5 tools emit, (b) the Postgres schema that ingests it, split into a **human-written policy layer** (changes rarely) and a **system-computed context layer** (recomputed automatically every 5 minutes), and (c) the JSON envelope the conversational AI eventually reads. The split exists specifically so the analyst's workload stays small and bounded, while every fact that is time-sensitive is computed fresh by code, never typed by a human and never silently treated as still-current.

---

## 1. Context (for a reader with no project history)

This is one data source inside a larger trading-alerts SaaS ("DavinTrade"), referred to internally as **Stack D**. The parts relevant to this document:

- **A 5-minute market cycle.** Every 5 minutes (per symbol), MT5-side indicators export fresh OHLC and computed values; a VPS collector validates and promotes them into PostgreSQL (`market_data_v6`); a cycle-ready job then runs a set of **sensors** ("MCDs") that each read the closed bars and emit one structured reading per cycle, saved append-only (`mcd_outputs`). A **synthesis step** ("SYN") combines sensor readings through an ordered **rules table** (content owned by Davin) into a bias/reasons/entry-zones reading, also saved append-only (`synthesis_readings`, `entry_zones`). A conversational AI then answers trader questions using the latest cycle's stored readings, a compact window of OHLC, and a knowledge corpus — never anything computed ad hoc per question.
- **The governing principle for that synthesis step** (binding, cited as ADR-025 in the codebase): _"Rules decide, the model explains. Bias, archetype and stand-aside come from the rules table. The model explains them and can neither override stand-aside nor flip the bias."_ Any new data source whose content could influence a shown bias has to enter through that same rules table, as a deliberate decision, not by an LLM quietly weighing free text.
- **An existing "no grades" rule:** no numeric confidence score (no "95% confluence", no S/A/B grade) is shown anywhere until a dedicated statistical-significance system exists. This document's schema deliberately contains no confidence/score field for the same reason.
- **Every reply is stamped with data recency** ("data as of hh:mm UTC"), and a reply that cannot show live context says so explicitly rather than guessing. This document extends the same honesty requirement to analyst-authored content: a reader is always told how many hours old the human's input is.
- **Existing MQL5 → Postgres pipeline (Stack C):** MT5 indicators write local TSV files; a Python collector on the VPS validates and stages them; a push worker ships validated rows to a Railway-hosted gateway service (NestJS) over HTTP; the gateway writes to PostgreSQL through Prisma. Two Prisma schema files exist for this one physical system: `prisma/market-data/schema.prisma` (mirrored by `railway-gateway/prisma/schema.prisma`, which the gateway service reads/writes directly) and `prisma/non-market-data/schema.prisma` (monolith-only, e.g. per-user data). This document's tables belong in the **market-data** schema — reasoning in §6.
- **An existing envelope convention.** Every sensor reading already has a versioned JSON shape with an identity block, a clock block, a verdict, and content (example field names: `schema_version`, `mcd_id`, `cycle_slot`, `status`, `state_code`, `levels`). This document's JSON contract (§5) follows the same shape for consistency, not as a new invention.
- **Everything in this pipeline is feature-flagged off by default and rolled out in three stages** (off → shadow, writing but never shown to a user → live). This document recommends the same discipline (§8).

**What this document is not:** it does not change, and is not read by, the existing MCD/SYN sensor pipeline above. It defines a **new, additional** data source that is read by the reply-assembly layer alongside — not instead of — everything above.

---

## 2. The core design principle: two layers, two authors, two write-rates

Stated by the project owner directly, and the organising idea of this whole document:

> Human is a **policy maker / market strategist**: sets framework, policy and market overview through label data, roughly every 8 hours.
> AI is a **market analyst**: combines what Human set with real-time market data to synthesize and analyse market context and trade setups, and answers the user at the moment they ask.

Translated into data terms:

|                  | Layer 1 — Policy (Human)                                                 | Layer 2 — Context (System)                                                                                                               |
| ---------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Who writes it    | The analyst, via MT5 tools                                               | Code, automatically                                                                                                                      |
| How often        | ~Every 8 hours, only at "Publish"                                        | Every 5-minute cycle                                                                                                                     |
| What it contains | Where a line is drawn, what it means, one free-text session overview     | Where price is _right now_ relative to each line; whether it has been crossed or touched since publish; how many hours old the policy is |
| Can go stale?    | Yes — and that is fine and expected; staleness is reported, never hidden | No — recomputed every cycle, so it is never more than ~5 minutes old                                                                     |
| Storage          | `TrendlinePolicySession` / `TrendlinePolicyLine` (§4.1)                  | `TrendlineContextReading` (§4.2)                                                                                                         |

This mirrors the MCD/SYN split already in the codebase (§1): the rules table there is "policy" (Davin's content, changes rarely); sensor readings there are "context" (computed every cycle). The same two-write-rate pattern is being applied to hand-drawn lines instead of to indicator-derived channels.

**Why this solves the stated problem.** The failure mode being designed against: if the analyst is asked to type _everything_ — including facts that are only true for a few minutes — the data entry burden grows without bound and is stale the moment it is saved. The fix is not to make Layer 1 "more real-time" (impossible for a human on an 8-hour cadence); it is to keep Layer 1 to only the things that genuinely do not change minute to minute (a drawn level, its meaning, a one-sentence regime read) and let Layer 2 carry every fast-moving fact, written by a machine on a machine's clock.

---

## 3. What MQL5 already produces (today, after this blueprint's changes land — §9)

Two tools, in `backend-stack-c/.../mq5/new-market-context-synthesis-and-analysis-architecture/`:

- **`TrendlineValueExport_v2_29.mq5`** — scans `<prefix>_TL1..TL12` trend-line objects on its own chart, exports their price at every historical bar (up to 3000 bars) as a TSV. Purely numeric, no label. Out of scope for this document (it is the old-style per-bar value feed, analogous to the existing `sr_1..sr_16` columns).
- **`TrendlineScreenshotAndLabelExport_v2_29.mq5`** (+ shared helpers in `TrendlineLabelUtils.mqh`) — the subject of this document. Scans the same trend lines on whatever chart it is attached to (which may be a single source chart, or the combined destination chart produced by `Objects Copier_6Sources_1Dest_v2_29.mq5`, which merges drawn objects from up to 6 source charts — the project's convention is A=M3, B=M5, C=M15, D=M30, E=H1, F=H4, each source's objects prefixed `A_`.. `F_` to avoid name collisions; M3 carries the fractal-based narrow-channel technique the analyst calls "Constellation" by alias — "M3" is the stored value everywhere, never "Constellation"), every `InpCaptureEveryMinutes` (default 15, but set DIFFERENTLY per attached chart -- `DATA-PIPELINE-ARCHITECTURE.md` §2.1a has the full table) minutes, **only while a shared "curation in progress" flag is clear** (a `GlobalVariable`, set/cleared by two on-chart buttons, "Start Curation Session" / "Publish / Lock"). On Publish it also reads a one-line **session overview** the analyst may have typed into an on-chart edit box, freezes it until the next Publish, and forces one immediate capture.

Every capture writes two files, named `<base>_<symbol>_<timeframe>_<yyyymmdd_hhmm>.png` / `.png.tsv`:

- The PNG: the chart as it currently looks (candles, the drawn lines, an auto-generated legend box and short per-line tags — never hand-typed, always rebuilt from the same data as the TSV, so the picture and the data can never disagree).
- The TSV sidecar:

```
image<TAB><filename>
symbol<TAB>XAUUSD
timeframe<TAB>PERIOD_M15
captured_at_utc<TAB><unix seconds>
session_published_at_utc<TAB><unix seconds, or empty if never published>
session_overview<TAB><free text, or empty>
line_count<TAB><n>
slot<TAB>slot_key<TAB>source_timeframe<TAB>name<TAB>value<TAB>anchor1_time<TAB>anchor1_price<TAB>anchor2_time<TAB>anchor2_price<TAB>ray_extends<TAB>label
<one row per detected line>
```

Every free-text field (`session_overview`, a line's `label`, a line's `name`) is passed through a sanitiser that turns an embedded tab, CR or LF into a single space before writing, so a pasted multi-line label can never corrupt the row structure.

**This TSV is the only thing MQL5 is responsible for.** It does not upload anywhere and does not compute anything Layer-2-shaped (no "is this still valid", no "how far is price"). Getting it off the VPS and into Postgres (a Python uploader, following the existing `stage_symbol_specs`-style best-effort pattern already used for the economic calendar and broker specs) is **not built** — named explicitly in §9.

---

## 4. Database schema (Prisma)

Both models live in `prisma/market-data/schema.prisma` (and the mirrored `railway-gateway/prisma/schema.prisma`) — see §6 for why.

### 4.1 Layer 1 — `TrendlinePolicySession` / `TrendlinePolicyLine`

**This is the REAL schema, copied verbatim from `prisma/market-data/schema.prisma` (and mirrored
byte-for-byte in `railway-gateway/prisma/schema.prisma`) on 2026-11-14 while auditing this
document against the actual files, not an illustrative sketch — an earlier draft of this section
used camelCase/`DateTime` and a now-removed `objectName` field that was never implemented; both
are corrected here so this document and the two real files cannot read differently.**

```prisma
/// Layer 1 (policy, Blueprint §2/§4.1): one row per "Publish / Lock" click
/// on the MT5-side curation tool. APPEND-ONLY -- a redraw is a new row,
/// never an UPDATE, so the analyst's decision history stays replayable the
/// same way mcd_outputs and indicator_statistics do.
model TrendlinePolicySession {
  id     String @id @default(cuid())
  symbol String

  published_at  Int // unix UTC, when "Publish / Lock" was clicked -- the idempotency key together with symbol
  overview_note String? // the session-level free-text read, or null; NOT per-line (see TrendlinePolicyLine)
  regime_hint   String? // closed vocabulary, optional; deliberately NOT mcd1's regime_status words (Blueprint §4.3)
  source_charts String[] // e.g. ["M3","M5","M15","M30","H1","H4"] -- M3 is the "Constellation" source (its alias name)

  lines TrendlinePolicyLine[]

  createdAt DateTime @default(now())

  // No @updatedAt, deliberately: this table is never updated.
  @@unique([symbol, published_at])
  @@index([symbol, published_at])
  @@map("trendline_policy_sessions")
}

/// One hand-drawn line within a TrendlinePolicySession (Blueprint §4.1).
model TrendlinePolicyLine {
  id         String                 @id @default(cuid())
  session_id String
  session    TrendlinePolicySession @relation(fields: [session_id], references: [id], onDelete: Cascade)

  slot_key         String // "M15:TL3" -- stable identity across redraws; see slot vs slot_key below
  slot             Int // 1..12, the raw TL number WITHIN its own source_timeframe only -- NOT globally unique
  source_timeframe String // M3 | M5 | M15 | M30 | H1 | H4 (or whatever the exporter's source-label input holds); M3 = "Constellation"

  // The line's two raw anchor points, not a single frozen price: a sloped
  // line's value changes every bar, so "the price" is only meaningful when
  // recomputed from these at whatever time it is asked about (Blueprint §4.1).
  anchor1_time  Int
  anchor1_price Float
  anchor2_time  Int
  anchor2_price Float
  ray_extends   Boolean @default(true) // false: the line has no meaning past anchor2_time

  label_raw    String // exactly what the analyst typed; never discarded regardless of parse_method
  role         String // closed vocabulary (Blueprint §4.3)
  bias_hint    String? // BULLISH | BEARISH | NEUTRAL | null -- inert until a SYN rule reads it (ADR-025, Blueprint §7.1)
  note         String? // free-text remainder beyond label_raw's headline meaning, if any
  parse_method String // rule | model | manual (Blueprint §4.4)

  readings TrendlineContextReading[]

  createdAt DateTime @default(now())

  @@index([session_id, slot_key])
  @@map("trendline_policy_lines")
}
```

**Why `slot` and `slot_key` are two different fields.** `slot` is only unique _within one source timeframe_ (there can legitimately be an `M5:TL3` and an `M15:TL3` open at once, on the same combined chart, meaning two different lines). `slot_key` (`source_timeframe + ":TL" + slot`) is the actual stable identity a consumer should key on. The MT5 object's own name (`Trendline_TL3`, or `B_Trendline_TL3` after a combine step's prefix) is NOT stored at all -- it is debug-only, read by the uploader and discarded, never sent to the gateway (`trendline_context_uploader.py`'s `parse_sidecar()` builds every line dict without it) -- so it cannot drift into being treated as an identity either.

### 4.2 Layer 2 — `TrendlineContextReading`

**Also copied verbatim from the real schema files, for the same reason as §4.1.**

```prisma
/// Layer 2 (context, Blueprint §2/§4.2): one row per (line, 5-minute cycle),
/// meant to be written automatically by the sensor worker on the SAME
/// cycle-ready trigger that already writes mcd_outputs -- never by a human,
/// never by the reply path. NOT WRITTEN YET: this table exists so the
/// schema is complete; the worker code is explicitly out of scope of this
/// migration (Blueprint §9).
model TrendlineContextReading {
  id String @id @default(cuid())

  cycle_slot Int // same clock as mcd_outputs.cycle_slot

  policy_line_id      String
  policy_line         TrendlinePolicyLine @relation(fields: [policy_line_id], references: [id], onDelete: Cascade)
  policy_session_id   String // denormalised: which session this reading is relative to, no join needed
  policy_published_at Int // denormalised: how old the policy was at this cycle, no join needed

  value_now                 Float? // recomputed from the two anchors + cycle_slot, never a value carried forward
  side                      String // ABOVE | BELOW | AT
  crossed_since_published   Boolean
  touch_count_since_publish Int
  hours_since_published     Float
  status                    String // VALID | CAUTIONARY | INVALID | STALE -- the SAME vocabulary as mcd_outputs

  @@unique([cycle_slot, policy_line_id])
  @@index([cycle_slot])
  @@map("trendline_context_readings")
}
```

### 4.3 Closed vocabularies (proposed; content is the project owner's to finalise — see §9)

| Field         | Values                                                                                                | Notes                                                                                                                                                                                                                                                                             |
| ------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `role`        | `SUPPORT`, `RESISTANCE`, `TREND_UP`, `TREND_DOWN`, `CHANNEL_UPPER`, `CHANNEL_LOWER`, `PIVOT`, `OTHER` | What the analyst is asserting the line represents.                                                                                                                                                                                                                                |
| `biasHint`    | `BULLISH`, `BEARISH`, `NEUTRAL`, `null`                                                               | Optional; see the ADR-025 guardrail in §7.1 before this is allowed to affect anything shown.                                                                                                                                                                                      |
| `regimeHint`  | `TREND_UP`, `TREND_DOWN`, `RANGE_BOUND`, `TRANSITIONING`, `UNCLEAR`                                   | Session-level. Deliberately worded differently from MCD1's own `regime_status` enum (`TREND_ALIGNED_CONTINUATION`, `CONSOLIDATION`, ...) even though the underlying concepts overlap, so the two can never be confused by a reader who only sees the value, not its source field. |
| `parseMethod` | `rule`, `model`, `manual`                                                                             | How `role`/`biasHint`/`regimeHint` were derived from the free text — see §4.4.                                                                                                                                                                                                    |
| `status`      | `VALID`, `CAUTIONARY`, `INVALID`, `STALE`                                                             | Reused verbatim from the existing sensor envelope vocabulary.                                                                                                                                                                                                                     |
| `side`        | `ABOVE`, `BELOW`, `AT`                                                                                | Current price vs. the line.                                                                                                                                                                                                                                                       |

### 4.4 How `labelRaw` becomes `role` / `biasHint` / `note`

Two paths, chosen per line depending on how the analyst typed it:

1. **`rule`** — the analyst types a lightweight convention (e.g. `ROLE=RESISTANCE | BIAS=BEARISH | NOTE=...`); a deterministic parser (regex/split, no model call) extracts the fields at ingestion time. Zero marginal cost, 100% reliable when the convention is followed.
2. **`model`** — the analyst just writes a sentence (the project's own working example: _"This trend is drawn based on M15 representing strong resistant trendline"_); a small/cheap model call, made **once, at ingestion, when the label is first seen** (never on every chat turn — this is the cost-saving mechanism the project owner asked about), derives the same fields as a best-effort interpretation.

`labelRaw` is always kept in full regardless of path. `parseMethod` records which path produced the structured fields, so a reader can treat a `rule`-derived field as ground truth and a `model`-derived one with appropriately less certainty.

---

## 5. JSON envelope (what the reply pipeline reads)

```json
{
  "schema_version": "trendline-context/1",
  "symbol": "XAUUSD",
  "policy_published_at_utc": "2026-11-14T06:00:00Z",
  "hours_since_published": 3.25,
  "session_overview": "Range-bound between the M30 and H1 bands; H4 still downtrend",
  "regime_hint": "RANGE_BOUND",
  "cycle_slot": "2026-11-14T09:15:00Z",
  "image_refs": {
    "composite_m5": {
      "r2_key": "trendline-context/TrendlineScreenshot_XAUUSD_PERIOD_M5_20261114_0915.png",
      "captured_at_utc": "2026-11-14T09:15:00Z"
    },
    "composite_m15": {
      "r2_key": "trendline-context/TrendlineScreenshot_XAUUSD_PERIOD_M15_20261114_0915.png",
      "captured_at_utc": "2026-11-14T09:15:00Z"
    },
    "source_m3": {
      "r2_key": "trendline-context/TrendlineScreenshot_XAUUSD_PERIOD_M3_20261114_0915.png",
      "captured_at_utc": "2026-11-14T09:15:00Z"
    },
    "source_m5": {
      "r2_key": "trendline-context/TrendlineScreenshot_XAUUSD_PERIOD_M5_20261114_0915.png",
      "captured_at_utc": "2026-11-14T09:15:00Z"
    },
    "source_m15": {
      "r2_key": "trendline-context/TrendlineScreenshot_XAUUSD_PERIOD_M15_20261114_0915.png",
      "captured_at_utc": "2026-11-14T09:15:00Z"
    },
    "source_m30": {
      "r2_key": "trendline-context/TrendlineScreenshot_XAUUSD_PERIOD_M30_20261114_0900.png",
      "captured_at_utc": "2026-11-14T09:00:00Z"
    },
    "source_h1": {
      "r2_key": "trendline-context/TrendlineScreenshot_XAUUSD_PERIOD_H1_20261114_0900.png",
      "captured_at_utc": "2026-11-14T09:00:00Z"
    },
    "source_h4": {
      "r2_key": "trendline-context/TrendlineScreenshot_XAUUSD_PERIOD_H4_20261114_0800.png",
      "captured_at_utc": "2026-11-14T08:00:00Z"
    }
  },
  "lines": [
    {
      "slot_key": "M15:TL3",
      "source_timeframe": "M15",
      "role": "RESISTANCE",
      "bias_hint": null,
      "label_raw": "This trend is drawn based on M15 representing strong resistant trendline",
      "value_now": 4042.15,
      "side": "BELOW",
      "crossed_since_published": false,
      "touch_count_since_published": 2,
      "status": "VALID"
    }
  ]
}
```

This is assembled at read time from one `TrendlinePolicySession` (the latest published one) joined with the latest `TrendlineContextReading` per line — never stored as this exact shape; the shape exists only at the moment of assembly, following the same pattern as every other envelope already in the reply pipeline.

**`image_refs` has 8 keys, not 1.** Two "composite" images (the curated, cross-timeframe picture, legend and values baked in — one drawn on an M5 candle background, one on M15, same lines in both) plus six "source" images, one per timeframe the analyst draws on (`M3`, `M5`, `M15`, `M30`, `H1`, `H4`) — each a clean screenshot of just that chart's own traced lines. Which images exist and how fresh each one is depends on its own capture cadence, not one single clock: `DATA-PIPELINE-ARCHITECTURE.md` §2.1a has the full table. The example above shows this on purpose — the M30/H1/H4 entries carry an OLDER `captured_at_utc` than the rest, because they genuinely are captured less often; a reader (the model or a human) should never assume every key in `image_refs` is equally fresh.

---

## 6. Why `market-data`, not `non-market-data`

Two Prisma schema files already exist for this one physical pipeline (§1). The deciding question is not "was this written by a human" (an earlier draft of this document placed these tables next to the per-user `Drawing` model in `non-market-data` for that reason, and that was wrong) but **"does the Railway gateway service need to write this row directly"** — because that is what the `market-data` / `non-market-data` split is actually for in this codebase (the gateway's own Prisma schema mirrors only `market-data`). The VPS → collector → push worker → gateway path is exactly how `TrendlinePolicySession`/`TrendlinePolicyLine` rows will be written (the gateway inserts them, the same way it already inserts `SymbolSpec` rows), and the sensor worker (which also lives on the gateway side) is what will write `TrendlineContextReading` rows. Both therefore belong in `market-data`, alongside `SymbolSpec` and `McdOutput`, not in `non-market-data`.

---

## 7. Guardrails this design must not violate

### 7.1 ADR-025 — "Rules decide, the model explains"

`biasHint` and `regimeHint` are **inert by default**. Storing them does not, by itself, change what bias a user is shown. If the project owner later decides a line's `biasHint` or a session's `regimeHint` should influence the synthesis step's output, that is a new entry in the existing SYN rules table (a new precedence rung, or folded into the existing "trendlines and channels" rung — see the architecture's precedence ladder: primary-timeframe structure, then support/resistance, then trendlines/channels, then oscillators) — a deliberate, versioned, owner-approved decision, not something this schema or any LLM call is allowed to do on its own.

### 7.2 "No grades"

No field in §4 is a confidence score, a probability, or a letter grade. `parseMethod` tells a reader _how_ a field was derived, which is provenance, not a certainty number — it must not be rendered to an end user as if it were one.

### 7.3 Source tagging

Everything in `TrendlinePolicySession`/`TrendlinePolicyLine` is explicitly the analyst's stated opinion, not a verified market fact and not a sensor reading. Any prompt or UI surface that shows this data should say so in words a trader would understand (e.g. "the analyst's read, as of 3 hours ago"), never presented with the same authority as an MCD/SYN reading.

### 7.4 Data-recency honesty

`hoursSincePublished` (Layer 2, recomputed every cycle) is not optional telemetry; it is how this design keeps the promise in §0 that a stale human input is never silently treated as current. A reply that uses this data states the policy's age the same way it already states the market cycle's own data status (FRESH/DELAYED/STALE/MARKET_CLOSED).

### 7.5 Append-only, replayable

Neither table is ever updated in place. A redraw is a new `TrendlinePolicySession`; a new cycle is a new `TrendlineContextReading` row. This matches every other table in the pipeline (`mcd_outputs`, `indicator_statistics`) and is what makes "what did the system know at time T" answerable later.

---

## 8. Rollout

Recommended: the same three-stage flag discipline already used for every other capability in this pipeline (the sensor worker's own flag, the synthesis flag, the intake flag, the reply flag) — `TRENDLINE_CONTEXT_ENABLED`:

1. **off** (default) — nothing computed, nothing shown.
2. **shadow** — Layer 1 ingestion and Layer 2 computation run and are stored, so real data accumulates and can be checked, but the reply pipeline never reads or shows it.
3. **live** — the reply pipeline may read it.

---

## 9. Explicitly not built yet (do not mark these as missing from this document — they are out of scope on purpose)

- The Python/VPS uploader that moves the TSV + PNG off the VPS into the gateway (pattern: `stage_symbol_specs`, or the existing R2-direct image upload pattern, `mtf_render_upload_worker.py`).
- The actual Prisma migration (this document is schema design, not a migration file).
- The sensor-worker code that computes and writes `TrendlineContextReading` every cycle.
- The reply-pipeline code that assembles §5's envelope and places it in the prompt (today's context assembler accepts one optional chart image per request; placing multiple images and this JSON block is a real capability addition, not configuration).
- The `rule`/`model` parser itself (§4.4).
- Final sign-off on the `role`/`regimeHint` vocabularies (§4.3) and whether `biasHint`/`regimeHint` ever enter the SYN rules table (§7.1) — both are the project owner's content decisions.
- A feasibility/cost assessment of the one-time `model`-path parse (§4.4) — provider, cost ceiling, and whether it reuses the reply pipeline's existing model gateway and metering infrastructure.

## 10. Specifically for a feasibility reviewer

Things worth stress-testing in this design: (a) whether denormalising `policyPublishedAt`/`policySessionId` onto every `TrendlineContextReading` row (§4.2) is worth the write amplification against just joining; (b) whether 5-minute-cycle computation for Layer 2 is the right cadence given lines are only re-curated every ~8 hours (a coarser cadence may be sufficient and cheaper); (c) whether `slotKey`'s stability assumption holds in practice — specifically what happens if the analyst renames a line's slot between sessions (is "M15:TL3" semantically a promise that slot 3 always means the same thing, or just an artifact of drawing order); (d) the `model`-path parser's error mode — what happens to a reply if the one-time structuring extracts a wrong `role` and nothing catches it before it reaches a user.
