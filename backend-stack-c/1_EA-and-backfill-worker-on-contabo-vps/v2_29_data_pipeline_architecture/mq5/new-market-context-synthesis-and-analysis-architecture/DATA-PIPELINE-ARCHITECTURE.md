# Trendline Context — Data Pipeline Architecture (Source to Destination)

**Status:** DRAFT, for feasibility review. Companion to `TRENDLINE-CONTEXT-BLUEPRINT.md` (the
database/JSON contract) — that document specifies _what the data looks like_; this one specifies
_how it physically moves_, stage by stage, from the MT5 terminal to PostgreSQL and (eventually)
into an AI reply.
**Written:** 2026-11-14, by the Executor (Claude Code).
**Verification record is in §7** — read it before trusting any "built" claim below; it says exactly
what was and was not run.

---

## 0. One diagram

```
┌──────────────┐  draws, labels,     ┌───────────────────────────────────┐
│  MT5 terminal │  clicks Publish     │ TrendlineScreenshotAndLabelExport_ │
│  (the analyst)│────────────────────▶│ v2_29.mq5 (+ TrendlineLabelUtils  │
└──────────────┘                      │ .mqh, Objects Copier_6Sources_    │
                                       │ 1Dest_v2_29.mq5 for a combined    │
                                       │ chart)                            │
                                       └───────────────┬────────────────────┘
                                                        │ writes locally, every
                                                        │ InpCaptureEveryMinutes
                                                        │ (while NOT curating)
                                                        ▼
                                       ┌────────────────────────────────┐
                                       │ VPS local disk (MQL5\Files)     │
                                       │  <name>.png                     │
                                       │  <name>.png.tsv  (Layer-1 data) │
                                       └───────────────┬──────────────────┘
                                                        │ polled every TL_POLL_SEC
                                                        ▼
                                       ┌────────────────────────────────┐
                                       │ trendline_context_uploader.py   │
                                       │ (new, this document's §2.3)     │
                                       └──────┬─────────────────┬────────┘
                                   POST JSON   │                 │ PUT binary
                              (Layer-1 policy) │                 │ (the screenshot)
                                               ▼                 ▼
                                  ┌─────────────────────┐  ┌──────────────┐
                                  │ Railway gateway       │  │ Cloudflare R2│
                                  │ POST /api/v1/         │  │ (private     │
                                  │ trendline-context/    │  │  bucket)     │
                                  │ policy  (NEW)          │  └──────────────┘
                                  └──────────┬─────────────┘
                                             │ BullMQ, concurrency 1
                                             ▼
                                  ┌─────────────────────┐
                                  │ TrendlineContext      │
                                  │ Processor (NEW)       │   writes ONE Prisma
                                  │                        │   transaction: the
                                  └──────────┬─────────────┘   session + its lines
                                             ▼
                                  ┌─────────────────────────────┐
                                  │ PostgreSQL (market-data)      │
                                  │  trendline_policy_sessions    │ ◀── Layer 1, BUILT
                                  │  trendline_policy_lines       │     this turn
                                  │  trendline_context_readings   │ ◀── Layer 2, table
                                  └──────────┬─────────────────────┘     only, NOT written
                                             │                            (§6, §8)
                                             │ (not built: the sensor
                                             │  worker's Layer-2 step)
                                             ▼
                                  ┌─────────────────────────────┐
                                  │ Reply pipeline (lib/reply/)   │  NOT built: multi-image
                                  │ → the conversational AI       │  + this JSON in the
                                  └─────────────────────────────┘  prompt (§6, §8)
```

---

## 1. Scope of this document

Everything from the MT5 terminal up to and including a row landing in PostgreSQL
(`trendline_policy_sessions` / `trendline_policy_lines`). It names, but does not specify, the two
stages after that (Layer-2 computation, the reply pipeline's read side) — those are `TRENDLINE-
CONTEXT-BLUEPRINT.md`'s §9 "not built yet" items, unchanged by this document.

---

## 1a. File inventory

Every production file either document refers to, in one place, checked against the real
filesystem on 2026-11-14 (`ls`/`find`, not memory) so nothing in the folder is undocumented and
nothing documented is missing from the folder. "Built by" distinguishes what the Executor wrote
this pass from what Davin built himself in parallel (neither reviewed in depth nor edited beyond
a read, per his own instruction).

**In this folder** (`backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/mq5/new-market-context-synthesis-and-analysis-architecture/`):

| File                                          | What it is                                                                                                                                                             | Built by                                             | Status                                                                                                                                           |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TRENDLINE-CONTEXT-BLUEPRINT.md`              | The database/JSON contract (this document's companion)                                                                                                                 | Executor                                             | Document                                                                                                                                         |
| `DATA-PIPELINE-ARCHITECTURE.md`               | This document                                                                                                                                                          | Executor                                             | Document                                                                                                                                         |
| `TrendlineLabelUtils.mqh`                     | Shared MQL5 helpers: slot parsing, broker-to-UTC, a line's current value, its label, the curation-flag, the prefix-to-source-timeframe matcher, the TSV-safe sanitiser | Executor                                             | Compiles (§7.1)                                                                                                                                  |
| `TrendlineValueExport_v2_29.mq5`              | Per-bar numeric `tl_1..tl_12` export (TSV, up to 3000 bars). Out of this pipeline's scope (§1) — uses the shared `.mqh` only for its slot parser                       | Executor (renamed from `TrendlineDrawing_v2_29.mq5`) | Compiles (§7.1)                                                                                                                                  |
| `TrendlineScreenshotAndLabelExport_v2_29.mq5` | The subject of §2.1/§2.1a: the screenshot + label TSV exporter                                                                                                         | Executor                                             | Compiles (§7.1)                                                                                                                                  |
| `trendline_context_uploader.py`               | §2.3: ships the TSV/PNG off the VPS                                                                                                                                    | Executor                                             | `py_compile` + a real unit test of its parser (§7.2)                                                                                             |
| `Objects Copier_6Sources_1Dest_v2_29.mq5`     | Combines drawn objects from up to 6 source charts onto one destination chart (§2.1, §2.1a)                                                                             | **Davin**                                            | Read in full, not modified; already copies everything this pipeline needs (`OBJPROP_TEXT`/`TOOLTIP`, anchors, ray flags) with no change required |
| `SsaCrossingAndFractal_v2_29.mq5`             | A real indicator (SSA, EMA-SSA, crossing, fractals) — a DIFFERENT, numeric-substrate data stream, not part of this pipeline at all                                     | **Davin**                                            | Read in full, not modified; named here only so a reviewer of this folder knows it is deliberately out of scope, not overlooked                   |

**Outside this folder** (the real production code this pipeline wires into — a reviewer scoped to
only this folder would miss these without this table):

| File                                                                          | What it is                                                                                                | Status                                                                                   |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `railway-gateway/src/trendline-context/trendline-context.module.ts`           | §2.4: the dynamic, flag-gated module                                                                      | `tsc --noEmit` clean (§7.3)                                                              |
| `railway-gateway/src/trendline-context/trendline-context.controller.ts`       | §2.4: `POST /api/v1/trendline-context/policy`                                                             | "                                                                                        |
| `railway-gateway/src/trendline-context/trendline-context.processor.ts`        | §2.4: the one-transaction writer                                                                          | "                                                                                        |
| `railway-gateway/src/trendline-context/trendline-context.service.ts`          | §2.4: the (not yet consumed) read side                                                                    | "                                                                                        |
| `railway-gateway/src/trendline-context/trendline-context.keys.ts`             | Queue/job names, the `TRENDLINE_CONTEXT_ENABLED` flag helper                                              | "                                                                                        |
| `railway-gateway/src/trendline-context/dto/trendline-policy-session.dto.ts`   | The hand-written, closed-vocabulary-checked request body                                                  | "                                                                                        |
| `railway-gateway/src/app.module.ts`                                           | One import + one line registering `TrendlineContextModule.register()`, next to `SensorsModule.register()` | "                                                                                        |
| `prisma/market-data/schema.prisma`                                            | §2.5/§4: the three models (monolith copy)                                                                 | `prisma validate` clean (§7.4)                                                           |
| `railway-gateway/prisma/schema.prisma`                                        | The same three models, mirrored (gateway copy)                                                            | `prisma generate` clean (§7.4)                                                           |
| `prisma/migrations/20261114000000_add_trendline_context_tables/migration.sql` | The DDL, hand-written to mirror the schema                                                                | Written in step with the schema this pass; **never run against any database** (§7.5, §8) |
| `.gitignore`                                                                  | One new scoped entry for this folder's `.ex5` build output                                                | —                                                                                        |

---

## 2. Stage by stage

### 2.1 MT5 terminal — draw, label, Publish

Files: `TrendlineScreenshotAndLabelExport_v2_29.mq5`, `TrendlineLabelUtils.mqh`, and (for a
chart combining several source timeframes) `Objects Copier_6Sources_1Dest_v2_29.mq5`
(Davin's own tool, unmodified).

The analyst draws trend lines (`Trendline_TL1`..`TL12`), sets each one's label in its own Text
field, optionally types one session-level sentence into the on-chart "Session overview" box,
and clicks **Publish / Lock**. That click is the ONLY moment Layer-1 data is frozen; see the
Blueprint §2 for why and `TrendlineScreenshotAndLabelExport_v2_29.mq5`'s own header comment for
the full curation-flag mechanism (the "Start Curation Session" button pauses every automatic
capture, on every chart that shares the flag, until Publish).

**Output, every `InpCaptureEveryMinutes` (default 15) while not curating:** a PNG screenshot and
a `.png.tsv` sidecar, written to the terminal's own `MQL5\Files` folder (the same folder
`export_collector_validator_v2.py`'s `DEFAULT_EXPORT_DIR` already watches for the 15 numbered
indicators — this tool writes alongside them, not instead of them).

**Status:** BUILT and compiled (§7.1). Not yet run in a live terminal.

### 2.1a The image set and its cadence

This gap was found by Davin re-reading this document and the Blueprint on 2026-11-14 and asking
directly whether every image was actually enumerated anywhere: it was not. The table below is
the complete, corrected list — it supersedes any earlier informal mention of "M5 and M15" or
"the 5 source timeframes" as the full picture.

**Eight images, two kinds.** `TrendlineScreenshotAndLabelExport_v2_29.mq5` is ONE tool, attached
up to eight times (once per chart it needs to capture); which kind of image a given attachment
produces depends only on WHICH chart it sits on, not on any code difference:

| #   | Image (`image_refs` key, Blueprint §5) | What it shows                                                                                                                                                                                    | Attached to                                     | `InpCaptureEveryMinutes` | Cadence |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- | ------------------------ | ------- |
| 1   | `composite_m5`                         | The curated, cross-timeframe set of lines (after the analyst filters `Objects Copier_6Sources_1Dest_v2_29.mq5`'s combined output down to what matters) — values and labels baked into the legend | The combined destination chart, set to M5       | 15                       | 15 min  |
| 2   | `composite_m15`                        | The SAME curated lines, M15 candle background instead                                                                                                                                            | A second combined destination chart, set to M15 | 15                       | 15 min  |
| 3   | `source_m3`                            | That chart's own traced lines only, clean (no legend values needed beyond the inline tags) — the "Constellation" source                                                                          | The M3 chart                                    | 15                       | 15 min  |
| 4   | `source_m5`                            | Same, M5's own traced lines                                                                                                                                                                      | The M5 chart                                    | 15                       | 15 min  |
| 5   | `source_m15`                           | Same, M15's own traced lines                                                                                                                                                                     | The M15 chart                                   | 15                       | 15 min  |
| 6   | `source_m30`                           | Same, M30's own traced lines                                                                                                                                                                     | The M30 chart                                   | 60                       | 60 min  |
| 7   | `source_h1`                            | Same, H1's own traced lines                                                                                                                                                                      | The H1 chart                                    | 60                       | 60 min  |
| 8   | `source_h4`                            | Same, H4's own traced lines                                                                                                                                                                      | The H4 chart                                    | 240                      | 240 min |

**Why M3 sits in the 15-minute tier with M5 and M15, not with M30/H1 or alone:** confirmed by
Davin 2026-11-14 — M3's own narrow, fractal-based channels ("Constellation") are short-lived by
construction, so they need the same refresh rate as the fastest timeframes, not the slower tiers
a 30-minute-or-larger bar can tolerate.

**What is NOT yet true, stated plainly:**

- Nothing automates "which `InpCaptureEveryMinutes` value on which attachment" — the table above
  is the setup instruction, not something the tool enforces. Attaching the same .mq5 to an H4
  chart and forgetting to change the input from its default (15) would capture H4 sixteen times
  as often as intended; nothing currently catches that mistake.
  Several turns earlier a "one coordinator EA, holding all seven chart IDs as inputs" was
  discussed as a cleaner alternative (one timer gating the tiers itself instead of trusting eight
  separate correctly-configured attachments) — that coordinator was never built; today's answer
  is "eight attachments, each set by hand to the table above."
- Only M5 and M15 attachments have ever actually been described as something Davin runs
  day-to-day; M3, M30, H1 and H4 attachments are new instructions this table introduces, not
  something already in place.
- `image_refs` (Blueprint §5) is the TARGET shape for the reply pipeline to read; nothing
  assembles it yet (§6 below).

### 2.2 VPS local disk — the handoff point

No new file here: this is simply `C:\MT5\MQL5\Files` (or wherever the terminal is installed),
already the shared bus `ACTIVE-STANDBY-TERMINAL-ARCHITECTURE.md` §3 describes for the 15
numbered indicators, the calendar and `symbol_specs`. The trendline tool's PNG/TSV pair is a
**fifth lane** on that same bus, with its own naming pattern (`Trendline...png[.tsv]`) so it can
never collide with the existing four.

### 2.3 `trendline_context_uploader.py` — off the VPS

File: `trendline_context_uploader.py` (this folder).

A long-lived polling service (an NSSM service, like `MT5Collector`, `MT5PushWorker` and
`MT5Renderer`), **not** a scheduled one-shot. Every `TL_POLL_SEC` (default 30 s) it lists new
`*.png.tsv` files, and for each one:

1. Parses the sidecar (§3 of the Blueprint has the exact wire format) into the gateway's
   `TrendlinePolicySessionDto` JSON shape.
2. If the sidecar has never been published (`session_published_at_utc` empty — the analyst has
   drawn but not yet clicked Publish on this chart), **skips the policy POST** and uploads only
   the PNG; there is no Layer-1 data to send yet.
3. Otherwise POSTs that JSON to `POST {API_GATEWAY_URL}/api/v1/trendline-context/policy`, with
   the same `Authorization: Bearer <BACKFILL_API_KEY>` header `backfill_worker_api_gateway_v5.py`
   already uses against this same gateway.
4. Uploads the matching PNG straight to Cloudflare R2 (`mtf_render_upload_worker.py`'s own
   direct-PUT pattern: same R2 env vars, a `boto3` S3-compatible client, no public-read ACL) —
   **never through the gateway's small-body JSON routes**, which `DATA_COLLECTION_PIPELINE_
BLUEPRINT_v2_29.md`'s own push worker keeps under Express's ~100 KB limit on purpose (a
   1920×1080 PNG is far larger).
5. Records the newest filename handled per (symbol, timeframe) in a small local JSON state file,
   so a restart does not re-walk the whole folder.

**Why re-POSTing the same session repeatedly is safe, by design, not by luck:** every capture
between two Publish clicks carries the identical `published_at` (the MQL5 side freezes it at
Publish, §2.1). The gateway's own idempotency key is `(symbol, published_at)` (§2.4), so only the
_first_ POST after a Publish ever creates a row; every later one for the same session is read
back as an accepted duplicate, the same shape of idempotency `symbol-specs` already relies on.

**Status:** BUILT. Its TSV parser was unit-tested against a synthetic sidecar built in the exact
shape the real MQL5 writer function produces, with every field checked (§7.2) — not against a
real captured file, since none exists yet. The gateway POST and the R2 PUT have never been
exercised against a real endpoint (§7, §8).

### 2.4 Gateway — `POST /api/v1/trendline-context/policy`

Files (all new, in `railway-gateway/src/trendline-context/`): `trendline-context.module.ts`,
`.controller.ts`, `.processor.ts`, `.service.ts`, `.keys.ts`, `dto/trendline-policy-session.dto.ts`.
Wired into `app.module.ts`.

Mirrors the existing `symbol-specs` lane exactly (its controller, DTO and processor were read in
full before writing this one, to stay consistent rather than inventing new conventions):

- **A dynamic module**, like `SensorsModule.register()`: `TrendlineContextModule.register()`
  registers nothing — no controller, no route, no queue — unless `TRENDLINE_CONTEXT_ENABLED` is
  exactly `"true"`. Off is the default and the rollback; a typo leaves the route returning 404,
  not "exists but rejects everything".
- **A hand-written DTO** (not generated, for the same reason `symbol-spec.dto.ts` is hand-written:
  `role`, `bias_hint`, `regime_hint` and `parse_method` are closed vocabularies with real meaning
  downstream, and a generated DTO only checks type and presence, not words).
- **One queue, concurrency 1** (`trendline-policy-sync`), so a backlog or a failure here can never
  delay price ingestion, the same reasoning every other lane already states.
- **The processor writes the whole session as ONE Prisma transaction** (the session row and every
  line's row together, or neither) — stronger than `symbol-specs`' per-row writes, because a
  Publish is semantically one atomic unit; a reader must never see a session with only some of
  its lines.
- **Idempotent on `(symbol, published_at)`**, with the same unique-constraint-race handling
  `SymbolSpecsProcessor` already uses (P2002 → re-read → DUPLICATE, not a failure).

**Status:** BUILT. `npx tsc --noEmit` passes clean across the WHOLE gateway package (not just
these new files) after `prisma generate` picked up the new models (§7.3). Never deployed, never
called.

### 2.5 PostgreSQL — `market-data` schema

Three Prisma models (`TrendlinePolicySession`, `TrendlinePolicyLine`, `TrendlineContextReading`),
added to BOTH `prisma/market-data/schema.prisma` and the mirrored `railway-gateway/prisma/
schema.prisma`, plus one migration file, `prisma/migrations/20261114000000_add_trendline_
context_tables/migration.sql` — **NOT applied.** Field-by-field reasoning is in the Blueprint §4;
this document only adds the pipeline-level facts:

- Placed in `market-data`, not `non-market-data`, because the gateway must write these rows
  directly (the same test the Blueprint §6 uses for `SymbolSpec`).
- `trendline_context_readings` is created now, empty, so the schema is complete, but **nothing
  writes to it** — that is the sensor worker's job, explicitly out of scope of this change (§6).
  An empty, unwritten table costs nothing.
- CHECK constraints on every closed-vocabulary column (`role`, `bias_hint`, `parse_method`,
  `side`, `status`, `regime_hint`), matching this project's established habit of pairing Prisma's
  generated DDL with hand-added CHECKs (`mcd_outputs`'s own migration does the same).

**Status:** schema validated independently on both copies (`prisma validate` / `prisma generate`,
§7.3). Migration file written, **not applied to any database, local or production** (non-
negotiable: the Executor never applies a migration).

---

## 3. Idempotency and failure modes, end to end

| Failure                                                                                                 | What happens                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Uploader is stopped or the VPS loses network                                                            | Sidecars accumulate on local disk; nothing is lost; the uploader catches up on restart (state file remembers where it left off)                                                                                                                                             |
| The uploader POSTs the same session twice (its own retry, or a restart before the state file was saved) | Gateway returns the DUPLICATE outcome for the second one; no second row                                                                                                                                                                                                     |
| The gateway or its queue is down                                                                        | `requests` raises, the uploader logs and retries on the next `TL_POLL_SEC` tick; the sidecar is not marked handled, so nothing is skipped                                                                                                                                   |
| R2 upload fails but the policy POST succeeded (or vice versa)                                           | The two are independent per-file outcomes (§2.3 step 3 vs 4); the file is only marked "handled" in the state file when BOTH succeed, so a partial failure retries both next time, even though the gateway POST is itself idempotent                                         |
| A malformed or hand-edited `.tsv` reaches the uploader                                                  | `parse_sidecar` raises `SidecarParseError`, logged, that one file skipped; the service does not crash-loop                                                                                                                                                                  |
| The DTO's closed-vocabulary check refuses a field (e.g. an unknown `role`)                              | 400 from the gateway, logged by the uploader; **the uploader currently always sends `role: "OTHER"` and `parse_method: "manual"`** (§4) — until the Blueprint §4.4 parser exists, nothing CAN send an unknown role, so this path is dormant today, not untested-and-ignored |

---

## 4. What is explicitly NOT in this pipeline yet — correcting earlier statements

A few things said in this chat session two turns ago are now **superseded** by what this turn
built; stated here once, plainly, so neither document nor the chat transcript is left
contradicting the repository:

- _"The uploader is Python, not part of this request"_ — superseded. It is built (§2.3).
- _"The 5-source combine tool"_ — superseded. Davin built a 6-source version himself
  (`Objects Copier_6Sources_1Dest_v2_29.mq5`); this pipeline refers to that one.
- _"Nothing reads the TSV yet"_ — **partially superseded.** The uploader and the gateway now
  read it and a row can reach PostgreSQL. It still does **not** reach the AI: Layer 2 (the
  sensor-worker computation of `TrendlineContextReading`) and the reply pipeline's read side
  (today's context assembler accepts one optional chart image per request, not this JSON plus
  several images) are both still unbuilt. "Candidate label data, not yet reaching the AI" is
  still the correct one-line summary — it now means something narrower than it did two turns ago.
- _"No `.gitignore` entry for `_.ex5`"\* — addressed this turn (§5).
- The per-line "last edited" timestamp and the VALID/CAUTIONARY/INVALID/STALE staleness
  judgement raised two turns ago are **designed** (Blueprint §4.2's `hours_since_published` /
  `status`, computed by diffing successive snapshots) but **not computed by anything yet** —
  that computation is the same not-built sensor-worker step named above.

Still true and unchanged: there is one exporter tool, not six, but it is only actually ATTACHED
and running on M5 and M15 today — M3, M30, H1 and H4 are instructions (§2.1a), not something in
place (correcting "M30/H1/H4 exporters do not exist" from an earlier turn: the code exists for
all six, the day-to-day habit of attaching and configuring it does not, yet); `TrendlineValueExport_v2_29.
mq5`'s per-bar numeric export is untouched and separate from this pipeline.

---

## 5. Housekeeping done this turn

`.gitignore` gained one entry for this folder's compiled `.ex5` files (flagged twice before,
acted on now that more build-adjacent files are landing here) — see the repo root `.gitignore`.

---

## 6. Explicitly deferred (next pieces of this pipeline, not started)

1. **Layer-2 computation** — a sensor-worker step, on the SAME `cycle-ready` trigger that already
   runs MCD0-3, that reads the latest published session and the latest closed bars and writes one
   `TrendlineContextReading` row per line per cycle (Blueprint §4.2). This is real, separate work
   (reading OHLC history for crossed/touch-count logic) deliberately not attempted in this pass.
2. **Reply-pipeline read side** — assembling the Blueprint §5 JSON envelope and placing it (plus
   more than one chart image) in the prompt. Needs a real capability add to `lib/reply/context/
assemble.ts`, not configuration.
3. **The Blueprint §4.4 rule/model label parser** — today every line the uploader sends is
   `role: OTHER, parse_method: manual`; nothing yet turns `label_raw` into a real `role` or
   `bias_hint`.
4. **Deploying any of the above** — see §8.

---

## 7. Verification record (read before trusting any "built" claim above)

| What                                                                          | How it was checked                                                                                                                                                                                                         | Result                                                                                                                                             |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7.1 `TrendlineScreenshotAndLabelExport_v2_29.mq5` + `TrendlineLabelUtils.mqh` | Compiled with the real MetaEditor (`/compile`), in their actual folder                                                                                                                                                     | 0 errors, 0 warnings                                                                                                                               |
| 7.2 `trendline_context_uploader.py`'s `parse_sidecar()`                       | `python -m py_compile` (syntax), then unit-tested against a synthetic `.png.tsv` built byte-for-byte in the shape `WriteSidecar()` actually emits (CRLF rows, the real 11-column header), with every output field asserted | Passed; `requests`/`boto3` (VPS-only deps, not installed on this dev machine) were stubbed only for this import, never patched in the shipped file |
| 7.3 The 6 new gateway TypeScript files + `app.module.ts`                      | `prisma generate` against the updated `railway-gateway/prisma/schema.prisma`, then `npx tsc --noEmit` across the WHOLE gateway package                                                                                     | Clean, 0 errors                                                                                                                                    |
| 7.4 Both Prisma schema copies                                                 | `prisma validate` (market-data copy) and `prisma generate` (gateway copy) — schema-only, no database touched                                                                                                               | Both valid                                                                                                                                         |
| 7.5 The migration SQL                                                         | Hand-written to mirror an existing migration's exact style (`20260214000000_rag_dual_memory`'s `TEXT[]` syntax)                                                                                                            | **Never run against any database** (local or production) — not a substitute for 7.4                                                                |
| **Never done, by design**                                                     | A live call to the gateway endpoint; a live write to any PostgreSQL instance; running the uploader against a real MT5-produced sidecar; anything on the VPS                                                                | —                                                                                                                                                  |

---

## 8. A live constraint found while preparing this change, not optional context

`.claude/state/active-tasks.md` (read before touching anything under `prisma/` or
`railway-gateway/`) records that **Stage B3 — five trading days of live shadow on Terminal A — is
currently running**, with its own explicit rule: _"nothing...may touch Terminal A's indicator
inputs, the live NSSM services or the live database."_ Nothing in this pipeline does: every file
above is unapplied, undeployed and uncommitted, and the Executor does not apply migrations or
push without being asked (non-negotiables). This is stated here as a standing constraint on
**when** any of this may be deployed, not a statement that it was violated: deployment (running
the migration, enabling `TRENDLINE_CONTEXT_ENABLED`, installing the uploader service) should wait
until B3 is clear and Davin says so, the same gate every other pending change in `active-tasks.md`
is already held behind.

---

## 9. Specifically for a feasibility reviewer

Beyond the Blueprint's own §10: (a) whether a 30-second poll interval for the uploader is the
right trade-off against the 15-minute capture cadence it is watching (could be far coarser); (b)
whether the uploader belongs as its own NSSM service or should be folded into the existing
`MT5PushWorker` process (one fewer service to supervise, at the cost of coupling an experimental
lane to a production one); (c) whether `role: OTHER` / `parse_method: manual` as the uploader's
unconditional default (§4, §6 item 3) is an acceptable interim state to deploy before the real
parser exists, or whether Layer-1 ingestion should stay behind the flag until the parser lands
too; (d) whether a Prisma transaction across a session and an unbounded number of lines
(`InpMaxTrendlines`, operator-configured) needs an explicit upper bound before this is production-
safe.
