import { PrismaService } from '../src/prisma/prisma.service';
import { bundleProblems } from '../src/sensors/inputs/bundle-types';
import { isoToSlot } from '../src/sensors/inputs/stats-slot';
import { EnvelopeValidator } from '../src/sensors/envelope-validator';
import { McdOutputsWriter } from '../src/sensors/mcd-outputs.writer';
import { staleBundle } from '../src/sensors/stale-bundle';
import { FIXTURE_SLOTS } from './helpers/cycle-fixtures';
import { pythonAvailable, runCycleCli } from './helpers/kit-runner';
import { FakeSensorPrisma } from './helpers/sensors-worker-world';

/**
 * The bundle the worker sends the runner for a cycle it cannot load (build step 3 part 4): no
 * bars, no statistics, `data_status` STALE. The kit's cycle check turns that into STALE with
 * DATA_STALE for every MCD, so the STALE rows come from the same runner, flags and schema as any
 * other cycle and the worker writes no envelope of its own.
 */

const v1 = FIXTURE_SLOTS[0];

describe('staleBundle', () => {
  it('is a bundle of the kit’s shape for the slot, with nothing in it and data_status STALE', () => {
    const bundle = staleBundle('XAUUSD', v1.slot, false);
    expect(bundleProblems(bundle)).toEqual([]);
    expect(bundle).toEqual({
      symbol: 'XAUUSD',
      cycle_slot: '2026-09-18T20:55Z',
      data_status: 'STALE',
      retuning: false,
      bars: { M5: [], M15: [] },
      statistics: {},
      stats_slot: { M5: '2026-09-18T20:55Z', M15: '2026-09-18T20:45Z' },
      active_indicator: {},
      config_hash: {},
      channel_mode: {},
    });
  });

  it('carries each timeframe’s own statistics slot (M15 was last collected at the quarter hour)', () => {
    const bundle = staleBundle('XAUUSD', v1.slot + 600, false); // 21:05
    expect(bundle.cycle_slot).toBe('2026-09-18T21:05Z');
    expect(isoToSlot(bundle.stats_slot.M5)).toBe(v1.slot + 600);
    expect(bundle.stats_slot.M15).toBe('2026-09-18T21:00Z');
    expect(isoToSlot(bundle.stats_slot.M15)).toBe(v1.slot + 300);
  });

  it('carries the retuning value it is given', () => {
    expect(staleBundle('XAUUSD', v1.slot, true).retuning).toBe(true);
  });

  it('every fixture slot gives a valid bundle, and a slot that is not a slot is refused', () => {
    for (const fixture of FIXTURE_SLOTS)
      expect(
        bundleProblems(staleBundle('XAUUSD', fixture.slot, false))
      ).toEqual([]);
    expect(() => staleBundle('XAUUSD', v1.slot + 1, false)).toThrow(RangeError);
  });
});

const real = pythonAvailable() ? describe : describe.skip;

real('a STALE bundle through the real runner', () => {
  jest.setTimeout(120_000);

  it.each(FIXTURE_SLOTS.map((f) => [f.name, f] as const))(
    '%s: all four MCDs answer STALE with DATA_STALE, schema-valid and fit to be written',
    (_name, fixture) => {
      const bundle = staleBundle('XAUUSD', fixture.slot, false);
      const cli = runCycleCli(bundle);
      expect(cli.status).toBe(0);
      const result = cli.result as NonNullable<typeof cli.result>;
      expect(result.results.map((r) => r.mcd_id)).toEqual([
        'MCD0',
        'MCD1',
        'MCD2',
        'MCD3',
      ]);
      for (const reading of result.results) {
        const envelope = JSON.parse(reading.envelope_json);
        expect(reading.status).toBe('STALE');
        expect(envelope.status).toBe('STALE');
        expect(envelope.status_reasons).toEqual(['DATA_STALE']);
        expect(reading.state_code).toBeNull();
        expect(reading.bias).toBeNull();
        expect(reading.guard_problems).toEqual([]);
        expect(reading.inherited_reasons).toEqual([]);
      }
      // and the writer would accept every one of them
      const writer = new McdOutputsWriter(
        new FakeSensorPrisma() as unknown as PrismaService,
        new EnvelopeValidator()
      );
      expect(
        writer.problems({
          symbol: 'XAUUSD',
          slot: fixture.slot,
          result: result as never,
          evaluatedAt: fixture.slot + 70,
        })
      ).toEqual([]);
    }
  );

  it('RETUNING does not change a STALE reading, whatever the job said (the STALE check comes first)', () => {
    const plain = runCycleCli(staleBundle('XAUUSD', v1.slot, false)).result!;
    const during = runCycleCli(staleBundle('XAUUSD', v1.slot, true), {
      retuningEnforced: true,
    }).result!;
    expect(during.results.map((r) => r.envelope_json)).toEqual(
      plain.results.map((r) => r.envelope_json)
    );
    expect(during.retuning).toEqual({
      observed: true,
      enforced: true,
      applied: true,
    });
  });
});
