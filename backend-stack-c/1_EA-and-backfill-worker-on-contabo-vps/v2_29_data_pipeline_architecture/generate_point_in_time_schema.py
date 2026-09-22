#!/usr/bin/env python3
"""Generate the point-in-time snapshot model and its migration from the registry.

WHY THIS IS GENERATED AND NOT HAND-WRITTEN

`HISTORICAL-VALUES-LOOK-AHEAD-BIAS-OPEN-ISSUE.md` section 7 option 1 asks for a
second table holding each bar's values as they stood at bar close, never
updated. Its cost line names the real hazard: "a rule for which fields are worth
snapshotting". A hand-maintained 77-column mirror across two Prisma schemas is
exactly the drift this repo has already been bitten by four times (the
best_fit_a/b split touched ten files; railway-gateway/test/schema-sync.spec.ts
exists because of it).

So the column list is DERIVED, from the same `SOURCES` registry and the same
`market_data_column()` function that `promote_cycle()` uses to write
`market_data`. A column added to the registry appears here automatically, under
the name it actually has downstream, or this script fails loudly.

WHICH COLUMNS, AND WHY THOSE

Snapshotted -- the sources whose historical values are rewritten:

  * the 7 centroid variants (56 columns). Their SSA/fit window re-anchors to
    `rates_total` every pass. MEASURED on two real captures 12 days apart
    (measure_indicator_drift.py): every comparable bar's `*_ssa` changed, and
    `*_crossing` -- a boolean signal flag -- flipped on 0.71% of bars.
  * fractal_edt / resistance / support (5 columns). Fixed date anchors, so they
    do not drift on their own, but re-anchoring rewrites every historical value
    at once (section 2 of the open issue: "stable -- but fragile").
  * sr_levels (8 columns). `ArrayLevels` is resolved once from a fixed window
    then re-bucketed against every exported bar's close, so a bar from months
    ago carries today's level set. Section 6.3 of
    ARCHITECTURE_DESIGN_14TH_INDICATOR_SUPPORT_AND_RESISTANCE.md calls this the
    same class of look-ahead "and stronger".
  * sr2_levels (8 columns, added 2026-09-22). The 15th indicator,
    S-R-AutoCalibration_v2_29, is a replica of the 14th exporting sr_9..sr_16
    from a second calibration window, so it inherits the identical re-bucketing
    and therefore the identical look-ahead. Snapshotting sr_1..sr_8 and not
    sr_9..sr_16 would leave one of the two S&R lanes with no honest history.

NOT snapshotted, each for a measured or structural reason:

  * The OHLCV spine. Facts about the bar. Measured identical across the two
    captures apart from a handful of genuine broker history revisions.
  * `body_direction` / `body_size` / `body_classification`. `InpZScoreLength`
    is a TRAILING window, so bar T uses T-431..T only. Genuinely causal.
  * The 11 `zigzag_*` columns. Confirmed pivots measured at 0.0% drift across
    128 overlapping bars. Only the newest, still-provisional pivot moves, and
    that is a documented and different nuance (section 2).

A consumer that needs OHLCV alongside a snapshot joins `market_data_v6` on
`(symbol, timeframe, timestamp)` -- safe precisely because those columns are the
ones that do not drift.

USAGE
    python generate_point_in_time_schema.py --check     # verify, change nothing
    python generate_point_in_time_schema.py --print     # emit to stdout
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import export_collector_validator_v2 as collector          # noqa: E402

REPO = HERE.parents[2]
APP_SCHEMA = REPO / 'prisma' / 'market-data' / 'schema.prisma'
GATEWAY_SCHEMA = REPO / 'railway-gateway' / 'prisma' / 'schema.prisma'

MODEL_NAME = 'MarketDataPointInTime'
TABLE_NAME = 'market_data_point_in_time'

# Sources whose per-bar values are rewritten after the bar closes. Derived
# names, hand-picked membership -- the membership IS the judgement call this
# file exists to write down, and it is justified in the module docstring.
DRIFTING_SOURCES = (list(collector.CENTROID_VARIANTS)
                    + ['fractal_edt', 'resistance', 'support', 'sr_levels',
                       'sr2_levels'])

STABLE_SOURCES = ['ohlcv', 'zscore', 'zigzag']


def drifting_columns_by_source() -> list:
    """(source, market_data column) for every drifting source, registry-derived.

    The source travels with each column because it can no longer be recovered
    from the column name: sr_levels and sr2_levels both write bare `sr_<n>`
    columns, so a name-prefix lookup would file sr_9..sr_16 under sr_levels.
    """
    out = []
    for source in DRIFTING_SOURCES:
        if source not in collector.SOURCES:
            raise SystemExit(
                f'source {source!r} is not in the collector registry -- it was '
                f'renamed or removed and this file must be updated with it')
        for staging_col, _type, _header in collector.SOURCES[source]['columns']:
            out.append((source, collector.market_data_column(source, staging_col)))
    return out


def drifting_columns() -> list:
    """market_data column names for every drifting source, registry-derived."""
    return [col for _source, col in drifting_columns_by_source()]


def parse_market_data_field_types(schema_text: str) -> dict:
    """Field -> Prisma type, read from the live MarketDataV6 model.

    Types are taken from the model rather than restated, so a Float that becomes
    an Int upstream cannot silently disagree here.
    """
    body = re.search(r'model MarketDataV6 \{(.*?)\n\}', schema_text, re.S)
    if not body:
        raise SystemExit('MarketDataV6 model not found in the schema')
    types = {}
    for line in body.group(1).split('\n'):
        m = re.match(r'\s+([a-z_][a-zA-Z0-9_]*)\s+(Float\??|Int\??|String\??)', line)
        if m:
            types[m.group(1)] = m.group(2)
    return types


PRISMA_TO_SQL = {
    'Float?': 'DOUBLE PRECISION',
    'Int?': 'INTEGER',
    'String?': 'TEXT',
    'Float': 'DOUBLE PRECISION NOT NULL',
    'Int': 'INTEGER NOT NULL',
    'String': 'TEXT NOT NULL',
}

DOC = '''/// APPEND-ONLY, NEVER UPDATED. One row per (symbol, timeframe, timestamp),
/// holding each indicator's reading AS IT STOOD when the bar had just closed.
///
/// `market_data_v6` cannot answer "what did the indicator say at that bar?".
/// Its rows are upserted on every collection cycle for as long as MT5 keeps
/// exporting the bar (~3000 bars: about 2.2 weeks on M5, 6.5 weeks on M15), so
/// a historical row holds what the indicator says about that bar TODAY, fitted
/// with price action that had not happened yet. That is correct and wanted for
/// live alerting and charts, and it is textbook look-ahead bias for anything
/// that reads stored history.
///
/// MEASURED, not assumed. Two real MT5 captures 12 days apart, diffed by
/// measure_indicator_drift.py over 2114 overlapping M15 bars: `*_uoedt` moved
/// on 100% of comparable bars by a mean of 19.26 USD, which is 14% of the
/// median EDT channel width; `*_ssa` moved on 100% of bars; `*_crossing`, a
/// boolean signal flag, FLIPPED on 0.71%. The controls behaved: OHLCV and
/// confirmed ZigZag pivots were unchanged.
///
/// WRITE-ONCE. The gateway inserts a row the first time it sees a bar whose
/// period has already ended, and never touches it again (INSERT ... ON CONFLICT
/// DO NOTHING). `market_data_v6` keeps updating in place, which is deliberate:
/// alerts and charts depend on the newest fit.
///
/// READ `snapshot_age_bars` BEFORE TRUSTING A ROW. It records how many whole
/// bar periods had elapsed between the bar closing and this snapshot being
/// taken. 1 is the honest value. Larger means the push worker was behind (see
/// PUSH-WORKER-THROUGHPUT-OPEN-ISSUE.md) and the row has that many bars of
/// hindsight in it. A backtest or fitness scorer MUST filter on it; the column
/// exists because a snapshot lane built on a backlogged push worker would
/// otherwise reproduce the very bias it is meant to remove, silently.
///
/// Columns are the 77 that actually drift. The OHLCV spine, the causal z-score
/// triple and the ZigZag metrics are deliberately absent -- they are stable, so
/// duplicating them would cost storage and buy nothing; join `market_data_v6`
/// on (symbol, timeframe, timestamp) for those.
///
/// Generated by backend-stack-c/.../generate_point_in_time_schema.py from the
/// collector's own SOURCES registry. Do not hand-edit; run the generator.'''


def render_prisma(types: dict, columns_by_source: list) -> str:
    lines = [DOC, f'model {MODEL_NAME} {{']
    lines.append('  id        String @id @default(cuid())')
    lines.append('  timestamp Int')
    lines.append('  symbol    String')
    lines.append('  timeframe String')
    lines.append('')
    lines.append('  // Provenance of the snapshot itself.')
    lines.append('  first_seen_at     Int // unix UTC; when this snapshot was taken')
    lines.append('  snapshot_age_bars Int // whole bar periods between bar close and capture; 1 = honest')
    lines.append('  cycle_id          Int? // the collector cycle the source row came from')
    lines.append('  collected_at      Int? // when the collector promoted that row')
    lines.append('')

    current_source = None
    for source, col in columns_by_source:
        if source != current_source:
            lines.append(f'  // {source}')
            current_source = source
        lines.append(f'  {col:<26} {types[col]}')
    lines.append('')
    lines.append('  createdAt DateTime @default(now())')
    lines.append('')
    lines.append('  // No @updatedAt, deliberately: this table is never updated, and a')
    lines.append('  // column that implies otherwise would invite someone to start.')
    lines.append('  @@unique([symbol, timeframe, timestamp])')
    lines.append('  @@index([symbol, timeframe, timestamp])')
    lines.append(f'  @@map("{TABLE_NAME}")')
    lines.append('}')
    return '\n'.join(lines)


def render_sql(types: dict, columns: list) -> str:
    cols = [
        '    "id" TEXT NOT NULL,',
        '    "timestamp" INTEGER NOT NULL,',
        '    "symbol" TEXT NOT NULL,',
        '    "timeframe" TEXT NOT NULL,',
        '    "first_seen_at" INTEGER NOT NULL,',
        '    "snapshot_age_bars" INTEGER NOT NULL,',
        '    "cycle_id" INTEGER,',
        '    "collected_at" INTEGER,',
    ]
    for col in columns:
        cols.append(f'    "{col}" {PRISMA_TO_SQL[types[col]]},')
    cols.append('    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,')
    cols.append('')
    cols.append(f'    CONSTRAINT "{TABLE_NAME}_pkey" PRIMARY KEY ("id")')

    return '\n'.join([
        '-- Point-in-time snapshot lane for the v6 pipeline.',
        '--',
        '-- ADDITIVE ONLY. Creates one new table and touches nothing that exists,',
        '-- so it is safe to apply while the pipeline is running.',
        '--',
        '-- ROLLOUT ORDER MATTERS. railway-gateway auto-deploys from `main`, and its',
        '-- MarketDataProcessor writes this table. Apply this migration BEFORE that',
        '-- deploy: a gateway running against an un-migrated database would fail every',
        '-- snapshot insert. The failure is contained (the snapshot write is wrapped and',
        '-- cannot fail the market_data upsert) but every bar it misses is gone for good',
        '-- -- the honest value exists only once.',
        '--',
        '-- See HISTORICAL-VALUES-LOOK-AHEAD-BIAS-OPEN-ISSUE.md section 7 option 1.',
        '',
        f'CREATE TABLE "{TABLE_NAME}" (',
        '\n'.join(cols),
        ');',
        '',
        '-- Index order below matches what `prisma migrate diff` emits for this',
        '-- model exactly, so the hand-authored file and the generated one are',
        '-- byte-identical after comment stripping. Verified, not assumed.',
        f'CREATE INDEX "{TABLE_NAME}_symbol_timeframe_timestamp_idx" '
        f'ON "{TABLE_NAME}"("symbol", "timeframe", "timestamp");',
        '',
        '-- Write-once is enforced by this constraint plus ON CONFLICT DO NOTHING in',
        '-- the processor, not by a trigger: the key IS the rule.',
        f'CREATE UNIQUE INDEX "{TABLE_NAME}_symbol_timeframe_timestamp_key" '
        f'ON "{TABLE_NAME}"("symbol", "timeframe", "timestamp");',
        '',
    ])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--print', dest='do_print', action='store_true')
    ap.add_argument('--check', action='store_true')
    args = ap.parse_args()

    schema_text = APP_SCHEMA.read_text(encoding='utf-8')
    types = parse_market_data_field_types(schema_text)
    columns_by_source = drifting_columns_by_source()
    columns = [col for _source, col in columns_by_source]

    missing = [c for c in columns if c not in types]
    if missing:
        raise SystemExit(f'columns absent from MarketDataV6: {missing}')

    # Cross-check: nothing from a stable source may leak into the list.
    stable = set()
    for s in STABLE_SOURCES:
        if s == 'ohlcv':
            continue
        for staging_col, _t, _h in collector.SOURCES[s]['columns']:
            stable.add(collector.market_data_column(s, staging_col))
    leaked = sorted(set(columns) & stable)
    if leaked:
        raise SystemExit(f'stable columns leaked into the snapshot set: {leaked}')

    prisma = render_prisma(types, columns_by_source)
    sql = render_sql(types, columns)

    if args.do_print:
        print(prisma)
        print()
        print('-- 8< ---- migration.sql ---- 8< --')
        print(sql)
        return 0

    present = MODEL_NAME in schema_text
    gateway_present = MODEL_NAME in GATEWAY_SCHEMA.read_text(encoding='utf-8')
    print(f'drifting sources : {len(DRIFTING_SOURCES)}')
    print(f'snapshot columns : {len(columns)} (+ 3 key, 4 provenance, id, createdAt)')
    print(f'{MODEL_NAME} in app schema     : {present}')
    print(f'{MODEL_NAME} in gateway schema : {gateway_present}')
    if args.check:
        if not (present and gateway_present):
            print('CHECK FAILED: model missing from one or both schemas')
            return 1
        for path in (APP_SCHEMA, GATEWAY_SCHEMA):
            text = path.read_text(encoding='utf-8')
            body = re.search(rf'model {MODEL_NAME} \{{(.*?)\n\}}', text, re.S)
            if not body:
                print(f'CHECK FAILED: cannot parse the model in {path.name}')
                return 1
            declared = set(re.findall(r'\n  ([a-z_][a-zA-Z0-9_]*)\s+', body.group(1)))
            absent = [c for c in columns if c not in declared]
            if absent:
                print(f'CHECK FAILED: {path.name} is missing {len(absent)} '
                      f'column(s): {absent[:6]}')
                return 1
        print('CHECK OK: both schemas carry every registry-derived column')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
