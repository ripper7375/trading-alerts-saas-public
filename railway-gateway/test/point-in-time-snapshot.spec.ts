import * as fs from 'fs';
import * as path from 'path';
import {
  SNAPSHOT_COLUMNS,
  TIMEFRAME_SECONDS,
  barAgeInPeriods,
  buildSnapshot,
} from '../src/worker/point-in-time-snapshot';
import { MarketDataDto } from '../src/gateway/dto/market-data.dto';

/**
 * The point-in-time snapshot lane
 * (HISTORICAL-VALUES-LOOK-AHEAD-BIAS-OPEN-ISSUE.md section 7 option 1).
 *
 * Every failure mode in this lane is SILENT, which is why the tests are shaped
 * the way they are:
 *
 *   * Snapshot the forming bar and you enshrine a partial candle as the truth —
 *     and nothing errors, because a partial candle is a perfectly valid row.
 *   * Let the write become an upsert and the table quietly stops being
 *     append-only, reproducing exactly the bias it exists to remove.
 *   * Let the column list drift from the Prisma model and the missing columns
 *     are simply NULL forever, which is indistinguishable from "the indicator
 *     had no value".
 *
 * So the column list is checked against the schema rather than restated, and
 * the age arithmetic is checked at its boundaries rather than in the middle.
 */

const SCHEMA_PATH = path.join(__dirname, '../prisma/schema.prisma');
const SOURCE_OF_TRUTH_SCHEMA_PATH = path.join(
  __dirname,
  '../../prisma/market-data/schema.prisma'
);
const PROCESSOR_PATH = path.join(
  __dirname,
  '../src/worker/market-data.processor.ts'
);

function modelFieldNames(schemaSource: string, modelName: string): string[] {
  const match = schemaSource.match(
    new RegExp(`model\\s+${modelName}\\s*\\{([\\s\\S]*?)\\n\\}`)
  );
  if (!match) throw new Error(`model ${modelName} not found`);
  return match[1]
    .split('\n')
    .map((line) => line.replace(/\/\/.*/, '').trim())
    .filter((line) => line.length > 0 && !line.startsWith('@@'))
    .map((line) => line.split(/\s+/)[0]);
}

/** A payload with every snapshot column populated with a distinguishable value. */
function makeDto(
  overrides: Partial<Record<string, unknown>> = {}
): MarketDataDto {
  const base: Record<string, unknown> = {
    terminal_id: 'T1',
    timestamp: 1_789_764_300,
    symbol: 'XAUUSD',
    timeframe: 'M15',
    open: 4000,
    high: 4010,
    low: 3990,
    close: 4005,
    volume: 1234,
    cycle_id: 42,
    collected_at: 1_789_764_305,
  };
  SNAPSHOT_COLUMNS.forEach((column, index) => {
    base[column] = index + 1;
  });
  return { ...base, ...overrides } as unknown as MarketDataDto;
}

describe('barAgeInPeriods', () => {
  it('reports 0 while the bar is still forming', () => {
    // Every export ends at shift 0 by design, so this is the COMMON case, not
    // an edge case. It is the one that must never be snapshotted.
    expect(barAgeInPeriods(1_000_000, 'M15', 1_000_000)).toBe(0);
    expect(barAgeInPeriods(1_000_000, 'M15', 1_000_000 + 899)).toBe(0);
  });

  it('reports 1 at the exact moment the bar closes', () => {
    expect(barAgeInPeriods(1_000_000, 'M15', 1_000_000 + 900)).toBe(1);
    expect(barAgeInPeriods(1_000_000, 'M5', 1_000_000 + 300)).toBe(1);
  });

  it('counts whole periods for a late arrival', () => {
    // The push worker sends oldest-first at a capped rate, so a backlog makes
    // a bar arrive long after it closed (PUSH-WORKER-THROUGHPUT-OPEN-ISSUE.md).
    expect(barAgeInPeriods(1_000_000, 'M15', 1_000_000 + 900 * 7 + 1)).toBe(7);
  });

  it('treats negative elapsed time as still forming rather than as age 0 data', () => {
    // Clock skew between the VPS and Railway must never produce a snapshot of a
    // bar that has not happened.
    expect(barAgeInPeriods(1_000_000, 'M15', 999_000)).toBe(0);
  });

  it('returns null for an unknown timeframe instead of guessing a period', () => {
    expect(barAgeInPeriods(1_000_000, 'H1', 2_000_000)).toBeNull();
    expect(barAgeInPeriods(1_000_000, '', 2_000_000)).toBeNull();
  });

  it('knows exactly the two timeframes this pipeline carries', () => {
    expect(Object.keys(TIMEFRAME_SECONDS).sort()).toEqual(['M15', 'M5']);
    expect(TIMEFRAME_SECONDS.M5).toBe(300);
    expect(TIMEFRAME_SECONDS.M15).toBe(900);
  });
});

describe('buildSnapshot', () => {
  const barTs = 1_789_764_300;

  it('refuses to snapshot the still-forming bar', () => {
    expect(buildSnapshot(makeDto({ timestamp: barTs }), barTs + 1)).toBeNull();
    expect(
      buildSnapshot(makeDto({ timestamp: barTs }), barTs + 899)
    ).toBeNull();
  });

  it('snapshots the first sighting after the bar closes, with age 1', () => {
    const snap = buildSnapshot(makeDto({ timestamp: barTs }), barTs + 900);
    expect(snap).not.toBeNull();
    expect(snap!.snapshot_age_bars).toBe(1);
    expect(snap!.first_seen_at).toBe(barTs + 900);
    expect(snap!.timestamp).toBe(barTs);
    expect(snap!.symbol).toBe('XAUUSD');
    expect(snap!.timeframe).toBe('M15');
  });

  it('records a late arrival rather than dropping it', () => {
    // A gap is indistinguishable from "the indicator had nothing to say"; an
    // honest age lets the consumer decide.
    const snap = buildSnapshot(makeDto({ timestamp: barTs }), barTs + 900 * 12);
    expect(snap!.snapshot_age_bars).toBe(12);
  });

  it('refuses an unknown timeframe', () => {
    expect(
      buildSnapshot(
        makeDto({ timestamp: barTs, timeframe: 'H4' }),
        barTs + 99999
      )
    ).toBeNull();
  });

  it('carries every snapshot column through', () => {
    const snap = buildSnapshot(makeDto({ timestamp: barTs }), barTs + 900)!;
    SNAPSHOT_COLUMNS.forEach((column, index) => {
      expect(snap[column]).toBe(index + 1);
    });
  });

  it('keeps a missing indicator value NULL and never coerces it to 0', () => {
    // A 0.00 XAUUSD "support level" reaching a consumer is the exact defect the
    // collector's own ingestion guard exists to prevent; the snapshot lane must
    // not reintroduce it at the other end of the pipe.
    const snap = buildSnapshot(
      makeDto({ timestamp: barTs, sr_4: null, non_b_uoedt: undefined }),
      barTs + 900
    )!;
    expect(snap.sr_4).toBeNull();
    expect(snap.non_b_uoedt).toBeNull();
    expect(snap.sr_4).not.toBe(0);
  });

  it('preserves a genuine 0 value, which is not the same as missing', () => {
    const snap = buildSnapshot(
      makeDto({ timestamp: barTs, non_b_crossing: 0 }),
      barTs + 900
    )!;
    expect(snap.non_b_crossing).toBe(0);
    expect(snap.non_b_crossing).not.toBeNull();
  });

  it('carries collection provenance, and tolerates its absence', () => {
    const withProv = buildSnapshot(makeDto({ timestamp: barTs }), barTs + 900)!;
    expect(withProv.cycle_id).toBe(42);
    expect(withProv.collected_at).toBe(1_789_764_305);

    const without = buildSnapshot(
      makeDto({
        timestamp: barTs,
        cycle_id: undefined,
        collected_at: undefined,
      }),
      barTs + 900
    )!;
    expect(without.cycle_id).toBeNull();
    expect(without.collected_at).toBeNull();
  });

  it('copies no OHLCV, z-score or ZigZag column into the snapshot', () => {
    // These are stable — measured identical across two captures 12 days apart —
    // so duplicating them costs storage and buys nothing. A consumer joins
    // market_data_v6 for them, which is safe precisely because they do not move.
    const snap = buildSnapshot(makeDto({ timestamp: barTs }), barTs + 900)!;
    for (const column of [
      'open',
      'high',
      'low',
      'close',
      'volume',
      'body_direction',
      'body_size',
      'body_classification',
      'zigzag_slope',
      'zigzag_category',
      'zigzag_current_point',
      'terminal_id',
    ]) {
      expect(snap[column]).toBeUndefined();
    }
  });
});

describe('snapshot column set vs. the Prisma model', () => {
  const local = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  const truth = fs.readFileSync(SOURCE_OF_TRUTH_SCHEMA_PATH, 'utf-8');

  it('parsed a non-trivial model from both schemas', () => {
    expect(
      modelFieldNames(local, 'MarketDataPointInTime').length
    ).toBeGreaterThan(70);
    expect(
      modelFieldNames(truth, 'MarketDataPointInTime').length
    ).toBeGreaterThan(70);
  });

  it('the two schema copies declare identical fields', () => {
    expect(modelFieldNames(local, 'MarketDataPointInTime')).toEqual(
      modelFieldNames(truth, 'MarketDataPointInTime')
    );
  });

  it('every SNAPSHOT_COLUMNS entry exists in the model', () => {
    const fields = new Set(modelFieldNames(truth, 'MarketDataPointInTime'));
    const missing = SNAPSHOT_COLUMNS.filter((c) => !fields.has(c));
    expect(missing).toEqual([]);
  });

  it('the model has no indicator column that SNAPSHOT_COLUMNS omits', () => {
    // The other direction. A column added to the model but not to this list
    // would be NULL forever, which reads as "no value" rather than as a bug.
    const structural = new Set([
      'id',
      'timestamp',
      'symbol',
      'timeframe',
      'first_seen_at',
      'snapshot_age_bars',
      'cycle_id',
      'collected_at',
      'createdAt',
    ]);
    const modelIndicatorFields = modelFieldNames(
      truth,
      'MarketDataPointInTime'
    ).filter((f) => !structural.has(f));
    expect(modelIndicatorFields.sort()).toEqual([...SNAPSHOT_COLUMNS].sort());
  });

  it('every snapshot column also exists on MarketDataV6, under the same name', () => {
    // The snapshot is a subset of the live row. A name that exists here but not
    // there would always be NULL, because the payload never carries it.
    const liveFields = new Set(modelFieldNames(truth, 'MarketDataV6'));
    const missing = SNAPSHOT_COLUMNS.filter((c) => !liveFields.has(c));
    expect(missing).toEqual([]);
  });

  it('the model is append-only: no @updatedAt anywhere in it', () => {
    // Comment-stripped. The model's own comment explains WHY there is no
    // @updatedAt, so a raw substring check fails on the explanation rather than
    // on the thing it is guarding — the third time that shape bit this session.
    const body = truth
      .match(/model\s+MarketDataPointInTime\s*\{([\s\S]*?)\n\}/)![1]
      .split('\n')
      .map((line) => line.replace(/\/\/.*/, ''))
      .join('\n');
    expect(body).not.toContain('@updatedAt');
    expect(body).toContain('@default(now())'); // createdAt survived the strip
  });

  it('the model is keyed so that a second write for the same bar cannot insert', () => {
    const body = truth.match(
      /model\s+MarketDataPointInTime\s*\{([\s\S]*?)\n\}/
    )![1];
    expect(body).toContain('@@unique([symbol, timeframe, timestamp])');
  });
});

describe('the processor writes it append-only and cannot break ingestion', () => {
  const source = fs.readFileSync(PROCESSOR_PATH, 'utf-8');

  it('uses skipDuplicates rather than an upsert', () => {
    // An upsert here would silently make the table mutable, which is the whole
    // bug this lane exists to fix.
    expect(source).toContain('skipDuplicates: true');
    expect(source).toMatch(/marketDataPointInTime\.createMany/);
    expect(source).not.toMatch(/marketDataPointInTime\.upsert/);
    expect(source).not.toMatch(/marketDataPointInTime\.update/);
  });

  it('wraps the snapshot write so it cannot fail the market_data upsert', () => {
    const fn = source.slice(
      source.indexOf('private async writePointInTimeSnapshot')
    );
    expect(fn).toContain('try {');
    expect(fn).toContain('catch');
    expect(fn).not.toMatch(/\bthrow\b/);
  });

  it('writes the snapshot after the live upsert, never before', () => {
    expect(source.indexOf('marketDataV6.upsert')).toBeLessThan(
      source.indexOf('this.writePointInTimeSnapshot(data)')
    );
  });
});
