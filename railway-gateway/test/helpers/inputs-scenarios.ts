import {
  BAR_COLUMNS,
  CycleInputsBundle,
  REFUSED_DATA_STATUS,
  channelColumns,
} from '../../src/sensors/inputs/bundle-types';
import type {
  InputsSource,
  LoadedInputs,
} from '../../src/sensors/inputs/inputs-source';
import {
  FIXTURE_SLOTS,
  FixtureSlot,
  StoredCycle,
  readFixtureBundle,
  readFixtureCycle,
} from './cycle-fixtures';
import {
  SeedPlan,
  ambiguousUnusedSources,
  buildSeedPlan,
  loaderForm,
  shortenChannel,
} from './inputs-world';
import { CliRun, runCycleCli } from './kit-runner';

/**
 * The loader’s acceptance test (build step 3, part 3): what the database loader hands the
 * Python runner gives the readings that were stored for the same cycle, and the rules the
 * loader keeps (ADR-083, rules 2, 5, 6 and 9, Q13) show in the readings, not only in the
 * bundle. The scenarios do not know what the database is: `backend.open` lays a seed plan
 * out as rows and returns the source to ask. test/sensors-inputs-runner.spec.ts uses an
 * in-memory stand-in for Prisma, test/sensors-inputs.pg.spec.ts a real PostgreSQL.
 */

export interface LoaderBackend {
  /**
   * Lay `plan` out in the database (replacing whatever was there) and return the source
   * to ask. `key` names an UNMODIFIED stored cycle: a backend may skip reseeding when it
   * is asked for the same key twice in a row.
   */
  open(plan: SeedPlan, key?: string): Promise<InputsSource>;
}

type Ok = Extract<LoadedInputs, { status: 'OK' }>;
type Result = NonNullable<CliRun['result']>;

async function run(
  backend: LoaderBackend,
  plan: SeedPlan,
  key?: string,
  options: { retuningEnforced?: boolean } = {}
): Promise<{ loaded: Ok; result: Result }> {
  const source = await backend.open(plan, key);
  const loaded = await source.loadCycleInputs('XAUUSD', plan.slot);
  if (loaded.status !== 'OK')
    throw new Error(`not loaded: ${JSON.stringify(loaded)}`);
  const cli = runCycleCli(loaded.bundle, options);
  if (cli.status !== 0)
    throw new Error(`the runner exited ${cli.status}: ${cli.stderr}`);
  return { loaded, result: cli.result as Result };
}

const reading = (result: Result, id: string) => {
  const found = result.results.find((r) => r.mcd_id === id);
  if (!found) throw new Error(`no reading for ${id}`);
  return found;
};
const envelope = (result: Result, id: string) =>
  JSON.parse(reading(result, id).envelope_json);

const v1 = FIXTURE_SLOTS[0];
const freshPlan = (fixture: FixtureSlot = v1) =>
  buildSeedPlan(readFixtureBundle(fixture));

/** The stored reading of an MCD, field for field. */
function expectSameReadings(
  result: Result,
  stored: StoredCycle,
  only?: string[]
) {
  expect(result.cycle_slot).toBe(stored.cycle_slot);
  expect(result.order).toEqual(stored.order);
  expect(result.flags).toEqual(stored.flags);
  expect(result.retuning).toEqual(stored.retuning);
  for (const expected of stored.results) {
    if (only && !only.includes(expected.mcd_id)) continue;
    const actual = reading(result, expected.mcd_id);
    expect(actual.envelope_json).toBe(expected.envelope_json);
    expect(actual).toEqual(expected);
  }
}

export function defineLoaderToRunnerScenarios(backend: LoaderBackend): void {
  jest.setTimeout(180_000);

  describe('the loader’s bundle gives the stored readings (the acceptance test)', () => {
    it.each(FIXTURE_SLOTS.map((f) => [f.name, f] as const))(
      '%s: every MCD’s envelope equals the one stored for the cycle, byte for byte',
      async (_name, fixture) => {
        const { result } = await run(backend, freshPlan(fixture), fixture.name);
        const stored = readFixtureCycle(fixture);
        expectSameReadings(result, stored);
        expect(result.results.map((r) => r.mcd_id)).toEqual([
          'MCD0',
          'MCD1',
          'MCD2',
          'MCD3',
        ]);
      }
    );

    it.each(FIXTURE_SLOTS.map((f) => [f.name, f] as const))(
      '%s: the bundle is the stored one to the byte of the runner’s own canonical text, but for the two documented differences',
      async (name, fixture) => {
        const { result } = await run(backend, freshPlan(fixture), fixture.name);
        const stored = readFixtureCycle(fixture);
        const storedBundle = readFixtureBundle(fixture);
        // the stored bundle in the loader’s form hashes to exactly what the database bundle hashes to
        const inLoaderForm = runCycleCli(loaderForm(storedBundle));
        expect(inLoaderForm.status).toBe(0);
        expect(result.inputs_sha256).toBe(inLoaderForm.result!.inputs_sha256);
        // and it is not the stored bundle’s hash: the loader leaves out the columns no evaluator reads
        expect(result.inputs_sha256).not.toBe(stored.inputs_sha256);
        expect(ambiguousUnusedSources(storedBundle)).toEqual(
          name === 'v1' ? [] : ['sr_levels']
        );
      }
    );

    it.each(FIXTURE_SLOTS.map((f) => [f.name, f] as const))(
      '%s: the columns the loader leaves out are ones no evaluator reads: putting them back with absurd values changes no reading',
      async (_name, fixture) => {
        const { loaded, result } = await run(
          backend,
          freshPlan(fixture),
          fixture.name
        );
        const poisoned: CycleInputsBundle = JSON.parse(
          JSON.stringify(loaded.bundle)
        );
        for (const timeframe of ['M5', 'M15'] as const) {
          const active = poisoned.active_indicator[timeframe]!;
          const read = new Set([
            'timestamp',
            'close',
            ...Object.values(channelColumns(active)),
          ]);
          const bars = poisoned.bars[timeframe];
          let spoiled = 0;
          for (const bar of bars.slice(0, -1)) {
            for (const column of BAR_COLUMNS) {
              if (!read.has(column)) {
                bar[column] = 424242.5;
                spoiled += 1;
              }
            }
          }
          expect(spoiled).toBeGreaterThan(1000);
        }
        const again = runCycleCli(poisoned);
        expect(again.status).toBe(0);
        expect(again.result!.results).toEqual(result.results);
      }
    );

    it('two loads and two runs of the same cycle give the same readings and the same hash of the inputs', async () => {
      const first = await run(backend, freshPlan(), v1.name);
      const second = await run(backend, freshPlan(), v1.name);
      expect(JSON.stringify(second.loaded.bundle)).toBe(
        JSON.stringify(first.loaded.bundle)
      );
      expect(second.result.results).toEqual(first.result.results);
      expect(second.result.inputs_sha256).toBe(first.result.inputs_sha256);
    });
  });

  describe('ADR-083: the evaluators do the window arithmetic on the whole closed channel the loader supplies', () => {
    // MCD2 reads min(T_EDT - 1, 288) closed M5 bars and needs a channel of at least 48 rows.
    it.each([
      [49, 49],
      [48, 48],
      [288, 288],
      [289, 288],
    ])(
      'an M5 channel of %i closed rows: MCD2 reads %i bars',
      async (rows, window) => {
        const plan = freshPlan();
        shortenChannel(plan, 'M5', rows);
        const { loaded, result } = await run(backend, plan);
        expect(loaded.provenance.barsRequested.M5).toBe(rows + 1); // the channel’s length, not less one: the evaluator subtracts the open bar row
        const mcd2 = envelope(result, 'MCD2');
        expect(mcd2.status).not.toBe('INVALID');
        expect(mcd2.details.window_bars).toBe(window);
      }
    );

    it('an M5 channel of 47 closed rows is shorter than the floor: INVALID + INSUFFICIENT_BARS, by the evaluator', async () => {
      const plan = freshPlan();
      shortenChannel(plan, 'M5', 47);
      const mcd2 = envelope((await run(backend, plan)).result, 'MCD2');
      expect(mcd2.status).toBe('INVALID');
      expect(mcd2.status_reasons).toEqual(['INSUFFICIENT_BARS']);
    });

    // MCD1 reads N_micro = max(96, 5 % of T_EDT) closed M15 bars and needs the channel to hold them.
    it.each([[96], [120]])(
      'an M15 channel of %i closed rows holds N_micro = 96',
      async (rows) => {
        const plan = freshPlan();
        shortenChannel(plan, 'M15', rows);
        const mcd1 = envelope((await run(backend, plan)).result, 'MCD1');
        expect(mcd1.status).not.toBe('INVALID');
        expect(mcd1.details.n_micro).toBe(96);
      }
    );

    it('an M15 channel of 95 closed rows cannot hold N_micro: INVALID + INSUFFICIENT_BARS', async () => {
      const plan = freshPlan();
      shortenChannel(plan, 'M15', 95);
      const mcd1 = envelope((await run(backend, plan)).result, 'MCD1');
      expect(mcd1.status).toBe('INVALID');
      expect(mcd1.status_reasons).toEqual(['INSUFFICIENT_BARS']);
    });
  });

  describe('rule 5: statistics at the slot, never the latest available', () => {
    it('with no row for the active M5 source at the slot MCD2 is STALE, although the slots either side hold rows for it', async () => {
      const plan = freshPlan();
      const before = plan.statistics.length;
      plan.statistics = plan.statistics.filter(
        (r) =>
          !(
            r['timeframe'] === 'M5' &&
            r['source'] === 'best_fit_a' &&
            r['captured_at'] === plan.slot
          )
      );
      expect(plan.statistics.length).toBe(before - 1);
      expect(
        plan.statistics.some(
          (r) => r['timeframe'] === 'M5' && r['source'] === 'best_fit_a'
        )
      ).toBe(true);
      const mcd2 = envelope((await run(backend, plan)).result, 'MCD2');
      expect(mcd2.status).toBe('STALE');
      expect(mcd2.status_reasons).toContain('NO_STATS_AT_SLOT');
    });

    it('with no usable cycle behind M15 the M15 readers (MCD1, MCD3) are STALE and MCD2, which reads M5 only, is not', async () => {
      const plan = freshPlan();
      plan.cycles = plan.cycles.filter((c) => c['slot'] === plan.slot);
      expect(plan.cycles).toHaveLength(1);
      const { result, loaded } = await run(backend, plan);
      expect(loaded.provenance.collected).toEqual({ M5: true, M15: false });
      for (const id of ['MCD1', 'MCD3']) {
        expect(envelope(result, id).status).toBe('STALE');
      }
      expect(['VALID', 'CAUTIONARY']).toContain(
        envelope(result, 'MCD2').status
      );
    });
  });

  describe('rule 6: the setting reaches the readings, from the slot it names', () => {
    it('a setting effective at the slot makes the M5 fractal EDT the active indicator of that cycle, and not of the cycle before', async () => {
      const plan = freshPlan();
      plan.settings.push({
        timeframe: 'M5',
        source: 'fractal_edt',
        effective_slot: plan.slot,
        set_by: 'test',
        reason: null,
      });
      // a READY cycle one slot earlier, so the same world can be asked about both sides of the flip
      plan.cycles.push({ ...plan.cycles[0], slot: plan.slot - 300 });
      const source = await backend.open(plan);
      const before = await source.loadCycleInputs('XAUUSD', plan.slot - 300);
      const at = await source.loadCycleInputs('XAUUSD', plan.slot);
      if (before.status !== 'OK' || at.status !== 'OK')
        throw new Error('the cycles should load');
      expect(before.bundle.active_indicator).toEqual({
        M5: 'best_fit_a',
        M15: 'non_b',
      });
      expect(at.bundle.active_indicator).toEqual({
        M5: 'fractal',
        M15: 'non_b',
      });

      const cli = runCycleCli(at.bundle);
      expect(cli.status).toBe(0);
      const mcd2 = envelope(cli.result as Result, 'MCD2');
      expect(mcd2.active_indicator).toEqual({ M5: 'fractal' });
      expect(Object.keys(mcd2.config_hash)).toEqual(['fractal_edt']);
      expect(mcd2.details.window_bars).toBe(288); // the fractal channel is 336 rows: min(335, 288)
    });

    it('with no setting for M5 MCD2 is INVALID + NO_SETTING: the sensors never guess it from the data', async () => {
      const plan = freshPlan();
      plan.settings = plan.settings.filter((s) => s['timeframe'] !== 'M5');
      const mcd2 = envelope((await run(backend, plan)).result, 'MCD2');
      expect(mcd2.status).toBe('INVALID');
      expect(mcd2.status_reasons).toEqual(['NO_SETTING']);
    });
  });

  describe('rule 9: RETUNING is read from the READY row and recorded', () => {
    it('observed true, not enforced: recorded, and no reading changes', async () => {
      const plan = freshPlan();
      plan.cycles[0]['retuning'] = true;
      const { loaded, result } = await run(backend, plan);
      expect(loaded.provenance.retuning).toBe(true);
      expect(result.retuning).toEqual({
        observed: true,
        enforced: false,
        applied: false,
      });
      expectSameReadings(result, {
        ...readFixtureCycle(v1),
        retuning: result.retuning,
      });
    });

    it('enforced: every sensor is CAUTIONARY with RETUNING', async () => {
      const plan = freshPlan();
      plan.cycles[0]['retuning'] = true;
      const { result } = await run(backend, plan, undefined, {
        retuningEnforced: true,
      });
      expect(result.retuning).toEqual({
        observed: true,
        enforced: true,
        applied: true,
      });
      for (const id of ['MCD0', 'MCD1', 'MCD2', 'MCD3']) {
        const e = envelope(result, id);
        expect(e.status).toBe('CAUTIONARY');
        expect(e.status_reasons).toContain('RETUNING');
      }
    });

    it('a DELAYED cycle is read like a FRESH one', async () => {
      const plan = freshPlan();
      plan.cycles[0]['data_status'] = 'DELAYED';
      const { loaded, result } = await run(backend, plan);
      expect(loaded.bundle.data_status).toBe('DELAYED');
      expectSameReadings(result, readFixtureCycle(v1));
    });
  });

  describe('Q13: one source used by both timeframes under two tunings', () => {
    it('is refused: all four readings are INVALID + SANITY_FAILED, written, not skipped', async () => {
      const plan = freshPlan();
      plan.settings = [
        {
          timeframe: 'M5',
          source: 'non_b',
          effective_slot: 0,
          set_by: 'test',
          reason: null,
        },
        {
          timeframe: 'M15',
          source: 'non_b',
          effective_slot: 0,
          set_by: 'test',
          reason: null,
        },
      ];
      plan.cycles[0]['config_hashes'] = { M5: { non_b: 'tuned-on-m5' } };
      plan.cycles[1]['config_hashes'] = { M15: { non_b: 'tuned-on-m15' } };
      const { loaded, result } = await run(backend, plan);
      expect(loaded.bundle.data_status).toBe(REFUSED_DATA_STATUS);
      expect(loaded.provenance.refusals).toHaveLength(1);
      expect(result.results).toHaveLength(4);
      for (const id of ['MCD0', 'MCD1', 'MCD2', 'MCD3']) {
        const e = envelope(result, id);
        expect(e.status).toBe('INVALID');
        expect(e.status_reasons).toEqual(['SANITY_FAILED']);
        expect(reading(result, id).guard_problems).toEqual([]);
      }
    });

    it('is not triggered when the two timeframes only run the same indicators under different tunings', async () => {
      const plan = freshPlan();
      plan.cycles[0]['config_hashes'] = {
        M5: { best_fit_a: 'a5', non_b: 'n5' },
      };
      plan.cycles[1]['config_hashes'] = {
        M15: { best_fit_a: 'a15', non_b: 'n15' },
      };
      const { loaded, result } = await run(backend, plan);
      expect(loaded.provenance.refusals).toEqual([]);
      expect(envelope(result, 'MCD2').config_hash).toEqual({
        best_fit_a: 'a5',
      });
      expect(envelope(result, 'MCD1').config_hash).toEqual({ non_b: 'n15' });
    });
  });
}
