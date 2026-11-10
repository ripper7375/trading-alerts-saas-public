import * as path from 'path';
import {
  CertifyDatabase,
  PythonStatisticsRunner,
  StoredOutputForStats,
  collapseToEpisodes,
  computeTimeframeDrift,
  configHashFromEnvelopeJson,
  mergePointInTimeBars,
  occurrencesFromSensorRows,
  parseCertifyArgs,
  resolveStatisticsEngineDir,
  runCertifyCommand,
} from '../src/sensors/certify-state-statistics';
import { DEFAULT_ENGINE_DIR } from '../src/sensors/sensor-config';
import { pythonAvailable } from './helpers/kit-runner';
import {
  FakeStatsPrisma,
  GOLDEN_PATH,
  readGolden,
} from './helpers/state-statistics-world';

jest.setTimeout(60_000);

const BASE_SLOT = 1_794_320_100; // divisible by 900 and 300

function makeStoredRow(
  slotIndex: number,
  over: Partial<StoredOutputForStats> = {}
): StoredOutputForStats {
  const slot = BASE_SLOT + slotIndex * 300;
  return {
    cycle_slot: slot,
    mcd_id: 'MCD2',
    evaluator_version: '2.0.1',
    status: 'CAUTIONARY',
    state_code: 'MCD2_CHANNEL_UP',
    bias: 'LONG',
    retuning_observed: false,
    retuning_applied: false,
    envelope_json: JSON.stringify({
      mcd_id: 'MCD2',
      evaluator_version: '2.0.1',
      config_hash: { best_fit_a: 'h1' },
      status: 'CAUTIONARY',
      state_code: 'MCD2_CHANNEL_UP',
      bias: 'LONG',
    }),
    ...over,
  };
}

describe('parseCertifyArgs', () => {
  it('parses --db with defaults', () => {
    const parsed = parseCertifyArgs(['--db']);
    expect(parsed.error).toBeNull();
    expect(parsed.db).toBe(true);
    expect(parsed.source).toBe('stored');
    expect(parsed.mode).toBe('cycles');
    expect(parsed.validOnly).toBe(false);
    expect(parsed.excludeRetuning).toBe(false);
    expect(parsed.write).toBe(false);
  });

  it('parses all flags for --db', () => {
    const parsed = parseCertifyArgs([
      '--db',
      '--source',
      'point-in-time',
      '--last',
      '288',
      '--since',
      '2026-11-10T12:00Z',
      '--until',
      '1794321000',
      '--valid-only',
      '--exclude-retuning',
      '--mode',
      'episodes',
      '--compare-drift',
      '--write',
      '--json',
    ]);
    expect(parsed.error).toBeNull();
    expect(parsed.source).toBe('point-in-time');
    expect(parsed.last).toBe(288);
    expect(parsed.validOnly).toBe(true);
    expect(parsed.excludeRetuning).toBe(true);
    expect(parsed.mode).toBe('episodes');
    expect(parsed.compareDrift).toBe(true);
    expect(parsed.write).toBe(true);
    expect(parsed.json).toBe(true);
  });

  it('rejects bad combinations and unknown flags', () => {
    expect(parseCertifyArgs([]).error).toContain(
      'choose one of --db or --file'
    );
    expect(parseCertifyArgs(['--db', '--file', 'a.json']).error).toContain(
      'cannot be used together'
    );
    expect(parseCertifyArgs(['--file', 'a.json', '--write']).error).toContain(
      '--write requires --db'
    );
    expect(parseCertifyArgs(['--db', '--source', 'other']).error).toContain(
      '--source must be'
    );
    expect(parseCertifyArgs(['--db', '--mode', 'other']).error).toContain(
      '--mode must be'
    );
    expect(parseCertifyArgs(['--db', '--unknown']).error).toContain(
      'unknown argument'
    );
  });
});

describe('occurrence extraction and episode collapsing', () => {
  it('extracts config_hash and series from stored rows', () => {
    const rows = [
      makeStoredRow(0, { status: 'VALID' }),
      makeStoredRow(1, { status: 'CAUTIONARY' }),
      makeStoredRow(2, { status: 'INVALID', state_code: null, bias: null }),
      makeStoredRow(3, { retuning_observed: true }),
    ];
    const all = occurrencesFromSensorRows(rows);
    expect(all).toHaveLength(3);
    expect(all[0]).toEqual({
      mcd_id: 'MCD2',
      evaluator_version_series: '2.0',
      config_hash_key: '{"best_fit_a":"h1"}',
      state_code: 'MCD2_CHANNEL_UP',
      bias: 'LONG',
      slot: BASE_SLOT,
    });

    const validOnly = occurrencesFromSensorRows(rows, { statuses: ['VALID'] });
    expect(validOnly).toHaveLength(1);

    const noRetuning = occurrencesFromSensorRows(rows, {
      excludeRetuning: true,
    });
    expect(noRetuning).toHaveLength(2);
  });

  it('collapses consecutive 5-minute slots of the same state into episodes', () => {
    const rows = [
      makeStoredRow(0),
      makeStoredRow(1),
      makeStoredRow(2),
      // slot 3 has a different state
      makeStoredRow(3, { state_code: 'MCD2_CHANNEL_DOWN', bias: 'SHORT' }),
      makeStoredRow(4, { state_code: 'MCD2_CHANNEL_DOWN', bias: 'SHORT' }),
      // slot 6 (after a 1-slot gap) returns to UP
      makeStoredRow(6),
    ];
    const episodes = occurrencesFromSensorRows(rows, { mode: 'episodes' });
    expect(episodes.map((e) => [e.slot, e.state_code])).toEqual([
      [BASE_SLOT, 'MCD2_CHANNEL_UP'],
      [BASE_SLOT + 3 * 300, 'MCD2_CHANNEL_DOWN'],
      [BASE_SLOT + 6 * 300, 'MCD2_CHANNEL_UP'],
    ]);
    expect(collapseToEpisodes([])).toEqual([]);
  });

  it('handles envelopes without config_hash (such as MCD0)', () => {
    expect(configHashFromEnvelopeJson('{"mcd_id":"MCD0"}')).toEqual({});
  });
});

describe('point-in-time bar merging and forming-bar / refit drift check', () => {
  it('overlays snapshot_age_bars=1 channel columns onto the market_data_v6 spine and falls back when absent', () => {
    const spine = [
      {
        timestamp: 1000,
        close: 4000,
        best_fit_a_uoedt: 4020,
        best_fit_a_loedt: 3980,
      },
      {
        timestamp: 1300,
        close: 4005,
        best_fit_a_uoedt: 4025,
        best_fit_a_loedt: 3985,
      },
    ];
    const snapshots = [
      {
        timestamp: 1300,
        snapshot_age_bars: 1,
        best_fit_a_uoedt: 4022.5,
        best_fit_a_loedt: 3982.5,
      },
    ];
    const merged = mergePointInTimeBars(spine, snapshots, 1);
    expect(merged).toHaveLength(2);
    // Bar 1000 had no snapshot -> keeps spine value
    expect(merged[0]['best_fit_a_uoedt']).toBe(4020);
    // Bar 1300 had an age=1 snapshot -> uses point-in-time value
    expect(merged[1]['best_fit_a_uoedt']).toBe(4022.5);
    expect(merged[1]['close']).toBe(4005);
  });

  it('computes max and mean absolute drift between point-in-time and refitted market_data_v6 rows', () => {
    const snapshots = [
      { timestamp: 1000, best_fit_a_uoedt: 4010, best_fit_a_loedt: 3990 },
      { timestamp: 1300, best_fit_a_uoedt: 4012, best_fit_a_loedt: 3990 },
    ];
    const live = [
      { timestamp: 1000, best_fit_a_uoedt: 4011.5, best_fit_a_loedt: 3990 },
      { timestamp: 1300, best_fit_a_uoedt: 4012.5, best_fit_a_loedt: 3990 },
    ];
    const report = computeTimeframeDrift('M5', snapshots, live, [
      'best_fit_a_uoedt',
      'best_fit_a_loedt',
    ]);
    expect(report.matchedBars).toBe(2);
    const uoedt = report.columns.find((c) => c.column === 'best_fit_a_uoedt')!;
    expect(uoedt.comparedBars).toBe(2);
    expect(uoedt.changedBars).toBe(2);
    expect(uoedt.maxAbsDiff).toBe(1.5);
    expect(uoedt.meanAbsDiff).toBe(1.0);
    const loedt = report.columns.find((c) => c.column === 'best_fit_a_loedt')!;
    expect(loedt.changedBars).toBe(0);
    expect(loedt.maxAbsDiff).toBe(0);
  });
});

describe('resolveStatisticsEngineDir and PythonStatisticsRunner', () => {
  it('falls back to DEFAULT_ENGINE_DIR when given the 45-file runtime sensors copy', () => {
    const runtimeCopy = path.resolve(__dirname, '../sensors');
    expect(resolveStatisticsEngineDir(runtimeCopy)).toBe(DEFAULT_ENGINE_DIR);
    expect(resolveStatisticsEngineDir(DEFAULT_ENGINE_DIR)).toBe(
      DEFAULT_ENGINE_DIR
    );
  });

  const maybe = pythonAvailable() ? it : it.skip;
  maybe(
    'runs mcd_worker.tools.compute_statistics on 30 rising occurrences and returns a MEASURED row',
    async () => {
      const runner = new PythonStatisticsRunner({
        python: 'python',
        engineDir: path.resolve(__dirname, '../sensors'),
        timeoutMs: 30_000,
      });
      const occurrences = Array.from({ length: 30 }, (_, i) => ({
        mcd_id: 'MCD2',
        evaluator_version_series: '2.0',
        config_hash_key: '{"best_fit_a":"h1"}',
        state_code: 'MCD2_CHANNEL_UP',
        bias: 'LONG',
        slot: BASE_SLOT + i * 300,
      }));
      const bars = Array.from({ length: 80 }, (_, i) => {
        const close = 4000 + i * 0.5;
        return {
          timestamp: BASE_SLOT - 300 + i * 300,
          high: close + 1,
          low: close - 1,
          close,
        };
      });
      const res = await runner.compute({
        occurrences,
        bars,
        horizons: [2],
      });
      expect(res.occurrences).toBe(30);
      expect(res.rows).toHaveLength(1);
      expect(res.rows[0].n).toBe(30);
      expect(res.rows[0].forward_move_median).toBe(12); // 24 bars * 0.5
    }
  );
});

describe('runCertifyCommand', () => {
  it('verifies the golden state-statistics file in --file mode', async () => {
    const options = parseCertifyArgs(['--file', GOLDEN_PATH]);
    const res = await runCertifyCommand(options);
    expect(res.exitCode).toBe(0);
    expect(res.report.rows).toEqual(readGolden().result.rows);
    expect(res.report.measuredRows).toBe(6);
    expect(res.report.provisionalRows).toBe(8);
    expect(res.text).toContain('DRY RUN');
  });

  it('runs --db stored mode and writes rows through StateStatisticsWriter when --write is set', async () => {
    const fakeStats = new FakeStatsPrisma();
    const storedRows = Array.from({ length: 30 }, (_, i) => makeStoredRow(i));
    const m5Bars = Array.from({ length: 70 }, (_, i) => {
      const close = 4000 + i * 0.25;
      return {
        timestamp: BASE_SLOT - 300 + i * 300,
        high: close + 0.5,
        low: close - 0.5,
        close,
      };
    });

    const database = {
      stateStatistic: fakeStats.stateStatistic,
      $transaction: fakeStats.$transaction.bind(fakeStats),
      mcdOutput: {
        findMany: jest.fn().mockResolvedValue(storedRows),
      },
      marketDataV6: {
        findMany: jest.fn().mockResolvedValue(m5Bars),
      },
      marketDataPointInTime: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as unknown as CertifyDatabase;

    const fakeRunner = {
      compute: jest.fn().mockResolvedValue(readGolden().result),
    };

    const options = parseCertifyArgs(['--db', '--write', '--compare-drift']);
    const res = await runCertifyCommand(options, {
      openDatabase: async () => ({
        database,
        close: async () => undefined,
      }),
      statisticsRunner: fakeRunner,
    });

    expect(res.exitCode).toBe(0);
    expect(res.report.written).toBe(true);
    expect(res.report.writtenRows).toBe(readGolden().result.rows.length);
    expect(fakeStats.rows.size).toBe(readGolden().result.rows.length);
    expect(res.text).toContain('WRITE COMPLETE');
  });
});
