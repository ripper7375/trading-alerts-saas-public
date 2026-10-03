import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  barsNotClosed,
  bundleProblems,
} from '../src/sensors/inputs/bundle-types';
import { FixtureInputsSource } from '../src/sensors/inputs/fixture-inputs.source';
import { isoToSlot, slotToIso } from '../src/sensors/inputs/stats-slot';
import {
  FIXTURES_DIR,
  FIXTURE_SLOTS,
  readFixtureBundle,
  readFixtureCycle,
} from './helpers/cycle-fixtures';
import { pythonAvailable, runCycleCli } from './helpers/kit-runner';

/**
 * The fixture source: the stored cycle bundles of `mcd_worker/fixtures/` behind the same
 * interface as the database source. It returns a stored bundle as it is.
 */

const source = new FixtureInputsSource(FIXTURES_DIR);

describe.each(FIXTURE_SLOTS.map((f) => [f.name, f] as const))(
  'the stored cycle %s',
  (_name, fixture) => {
    it('loads as the bundle in the file, with its facts', async () => {
      const result = await source.loadCycleInputs('XAUUSD', fixture.slot);
      if (result.status !== 'OK') throw new Error(JSON.stringify(result));
      expect(result.bundle).toEqual(readFixtureBundle(fixture));
      expect(result.provenance).toMatchObject({
        origin: 'fixture',
        slot: fixture.slot,
        dataStatus: 'FRESH',
        retuning: false,
        collected: { M5: true, M15: true },
        refusals: [],
        notes: [`${fixture.stem}.bundle.json`],
      });
      expect(result.provenance.barCounts).toEqual({
        M5: result.bundle.bars.M5.length,
        M15: result.bundle.bars.M15.length,
      });
      expect(slotToIso(result.provenance.statsSlot.M15)).toBe(
        result.bundle.stats_slot.M15
      );
    });

    it('is a bundle with no bar that is open at its slot (rule 2)', async () => {
      const bundle = readFixtureBundle(fixture);
      expect(bundleProblems(bundle)).toEqual([]);
      expect(barsNotClosed(bundle)).toEqual([]);
      expect(isoToSlot(bundle.cycle_slot)).toBe(fixture.slot);
    });

    it('is read afresh each time: a caller’s edit of one result never reaches the next', async () => {
      const first = await source.loadCycleInputs('XAUUSD', fixture.slot);
      if (first.status !== 'OK') throw new Error('x');
      first.bundle.bars.M5.length = 0;
      const second = await source.loadCycleInputs('XAUUSD', fixture.slot);
      if (second.status !== 'OK') throw new Error('x');
      expect(second.bundle.bars.M5.length).toBeGreaterThan(0);
    });
  }
);

describe('what it is not given, or is given wrong', () => {
  it('a slot with no stored bundle is NOT_READY', async () => {
    const slot = FIXTURE_SLOTS[0].slot + 300;
    expect(await source.loadCycleInputs('XAUUSD', slot)).toEqual({
      status: 'NOT_READY',
      reason: 'CYCLE_NOT_READY',
      slot,
      detail: `no fixture bundle for slot ${slot} (${slotToIso(slot).replace(':', '')}.bundle.json)`,
    });
  });

  it('a folder that does not exist has no bundles', async () => {
    const none = new FixtureInputsSource(
      path.join(os.tmpdir(), 'no-such-fixtures-folder')
    );
    expect(
      await none.loadCycleInputs('XAUUSD', FIXTURE_SLOTS[0].slot)
    ).toMatchObject({
      status: 'NOT_READY',
      reason: 'CYCLE_NOT_READY',
    });
  });

  it.each([['EURUSD'], ['']])('refuses the symbol %p', async (symbol) => {
    await expect(
      source.loadCycleInputs(symbol, FIXTURE_SLOTS[0].slot)
    ).rejects.toThrow(RangeError);
  });

  it.each([[FIXTURE_SLOTS[0].slot + 1], [1.5], [NaN], [-300]])(
    'refuses %p as a slot',
    async (slot) => {
      await expect(source.loadCycleInputs('XAUUSD', slot)).rejects.toThrow(
        RangeError
      );
    }
  );

  describe('a folder with damaged files', () => {
    let dir: string;
    const fixture = FIXTURE_SLOTS[0];
    const file = () => path.join(dir, `${fixture.stem}.bundle.json`);

    beforeEach(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-source-'));
    });
    afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

    it('a file that is not a cycle bundle is INVALID_CYCLE_ROW, and says what is wrong', async () => {
      const bundle = readFixtureBundle(fixture);
      (bundle as unknown as Record<string, unknown>)['retuning'] = 'no';
      delete (bundle as unknown as Record<string, unknown>)['stats_slot'];
      fs.writeFileSync(file(), JSON.stringify(bundle));
      const result = await new FixtureInputsSource(dir).loadCycleInputs(
        'XAUUSD',
        fixture.slot
      );
      expect(result).toMatchObject({
        status: 'NOT_READY',
        reason: 'INVALID_CYCLE_ROW',
      });
      expect((result as { detail: string }).detail).toMatch(
        /missing key: stats_slot.*retuning must be a boolean/
      );
    });

    it('a file that holds another slot than its name says is INVALID_CYCLE_ROW', async () => {
      const bundle = readFixtureBundle(FIXTURE_SLOTS[1]);
      fs.writeFileSync(file(), JSON.stringify(bundle));
      const result = await new FixtureInputsSource(dir).loadCycleInputs(
        'XAUUSD',
        fixture.slot
      );
      expect(result).toMatchObject({
        status: 'NOT_READY',
        reason: 'INVALID_CYCLE_ROW',
      });
      expect((result as { detail: string }).detail).toContain(
        '2026-09-28T14:15Z'
      );
    });

    it('a file that is not JSON throws: that is a damaged checkout, not a data condition', async () => {
      fs.writeFileSync(file(), '{not json');
      await expect(
        new FixtureInputsSource(dir).loadCycleInputs('XAUUSD', fixture.slot)
      ).rejects.toThrow(SyntaxError);
    });
  });

  it('names the file of a slot the way the folder does (Windows forbids ":" in a file name)', () => {
    expect(FixtureInputsSource.stem(FIXTURE_SLOTS[0].slot)).toBe(
      '2026-09-18T2055Z'
    );
    expect(
      fs.existsSync(path.join(FIXTURES_DIR, '2026-09-18T2055Z.bundle.json'))
    ).toBe(true);
  });
});

const maybe = pythonAvailable() ? describe : describe.skip;
maybe(
  'through the real runner (needs Python with PyYAML and jsonschema)',
  () => {
    jest.setTimeout(120_000);

    it.each(FIXTURE_SLOTS.map((f) => [f.name, f] as const))(
      '%s: the fixture source’s bundle gives exactly the stored cycle',
      async (_name, fixture) => {
        const loaded = await source.loadCycleInputs('XAUUSD', fixture.slot);
        if (loaded.status !== 'OK') throw new Error('x');
        const cli = runCycleCli(loaded.bundle);
        expect(cli.status).toBe(0);
        const stored = readFixtureCycle(fixture);
        expect(cli.result!.inputs_sha256).toBe(stored.inputs_sha256);
        expect(cli.result!.results).toEqual(stored.results);
      }
    );
  }
);
