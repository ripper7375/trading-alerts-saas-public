import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type {
  CycleRunResult,
  SynthesisRunResult,
} from '../src/sensors/cycle-run-result';
import { PythonCycleRunner } from '../src/sensors/python-runner';
import { SynReadingValidator } from '../src/sensors/syn-validator';
import {
  prepareSynthesis,
  readingRowProblems,
  sha256,
  zoneRowProblems,
} from '../src/sensors/synthesis-rows';
import {
  ENGINE_DIR,
  FIXTURE_SLOTS,
  readFixtureBundle,
} from './helpers/cycle-fixtures';
import { pythonAvailable } from './helpers/kit-runner';
import { Doc } from './helpers/synthesis-rows';

/**
 * The golden scenarios of build step 4 part 7 (architecture 7.7), as the gateway sees them.
 *
 * `mcd_worker/golden/` holds 16 cycles whose expected outputs Davin signs off. The engine's own suite (`test_golden.py`) rebuilds them and holds
 * the set to the rules table; this spec holds the same files to the GATEWAY's write path, which is the other side of the contract:
 *
 *   1. every expected reading is accepted by the gateway's `syn-output/1` validator and every row it would make for the two SYN tables
 *      passes the TypeScript twin of the database's 25 CHECKs, so nothing the golden set approves could be refused on the way to the table
 *      (`prepareSynthesis` is the real path: the same function the worker's writer calls);
 *   2. the three REAL scenarios are made again by the real Python runner from the stored bundles, and the SYN texts and hashes equal the
 *      golden ones byte for byte (a golden file and the engine cannot drift apart without this failing);
 *   3. the files that carry a sign-off are well formed and a signed scenario still matches its recorded hashes.
 *
 * Nothing here writes into the golden folder, and the sign-off itself is never required: the release gate is the engine's
 * `golden check --require-approved`.
 */

const GOLDEN_DIR = path.join(ENGINE_DIR, 'mcd_worker', 'golden');
const PROFILES = ['DAY_TRADER', 'SCALPER'] as const;
const validator = new SynReadingValidator();

interface Scenario {
  id: string;
  dir: string;
  scenario: Doc;
  expected: Doc;
  approval: Doc;
  scenarioText: string;
  expectedText: string;
}

const lf = (text: string): string => text.replace(/\r\n/g, '\n');
const read = (file: string): string => lf(fs.readFileSync(file, 'utf8'));

function loadScenarios(): Scenario[] {
  return fs
    .readdirSync(GOLDEN_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((id) => {
      const dir = path.join(GOLDEN_DIR, id);
      const scenarioText = read(path.join(dir, 'scenario.json'));
      const expectedText = read(path.join(dir, 'expected.json'));
      return {
        id,
        dir,
        scenario: JSON.parse(scenarioText) as Doc,
        expected: JSON.parse(expectedText) as Doc,
        approval: JSON.parse(read(path.join(dir, 'approval.json'))) as Doc,
        scenarioText,
        expectedText,
      };
    });
}

const SCENARIOS = loadScenarios();

/** The `synthesis` section and the few fields of a runner result that the writer's checks read. */
function resultOf(s: Scenario): CycleRunResult {
  return {
    schema_version: 'mcd-cycle-result/1',
    runner_version: '1.0.0',
    symbol: 'XAUUSD',
    cycle_slot: s.expected['cycle_slot'],
    inputs_sha256: s.expected['inputs_sha256'],
    bundle_canonical_json: null,
    retuning: { observed: false, enforced: false, applied: false },
    flags: {},
    order: [],
    gate: null,
    results: [],
    runtime: { python: '3.11.9', timings_ms: {}, synthesis_ms: 48.8 },
    synthesis: s.expected['synthesis'] as SynthesisRunResult,
  } as unknown as CycleRunResult;
}

const slotOf = (iso: string): number =>
  Date.parse(iso.replace('Z', ':00Z')) / 1000;

describe('the golden folder', () => {
  it('holds the numbered scenarios, each with its four files', () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(14);
    expect(SCENARIOS.map((s) => s.id.slice(0, 2))).toEqual(
      SCENARIOS.map((_, i) => String(i + 1).padStart(2, '0'))
    );
    for (const s of SCENARIOS) {
      expect(fs.readdirSync(s.dir).sort()).toEqual([
        'approval.json',
        'expected.json',
        'review.md',
        'scenario.json',
      ]);
      expect(s.scenario['id']).toBe(s.id);
      expect(s.expected['scenario']).toBe(s.id);
    }
  });

  it('is not part of the sensor kit the image ships', () => {
    const kit = path.join(__dirname, '..', 'sensors');
    const found: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (/golden/i.test(entry.name)) found.push(path.join(dir, entry.name));
        if (entry.isDirectory()) walk(path.join(dir, entry.name));
      }
    };
    walk(kit);
    expect(found).toEqual([]);
  });
});

describe('every golden reading and zone, through the gateway’s own checks', () => {
  it.each(SCENARIOS.map((s) => [s.id, s] as const))(
    '%s: prepareSynthesis refuses nothing and makes the rows of both trader types',
    (_id, s) => {
      const made = prepareSynthesis({
        symbol: 'XAUUSD',
        slot: slotOf(s.expected['cycle_slot']),
        result: resultOf(s),
        evaluatedAt: slotOf(s.expected['cycle_slot']) + 31,
        checkReading: (text) => validator.check(text),
      });
      expect(made.ran).toBe(true);
      expect(made.error).toBeNull();
      expect(made.refused).toEqual([]);
      expect(made.readings.map((r) => r.profile)).toEqual([...PROFILES]);
      const section = s.expected['synthesis'] as SynthesisRunResult;
      for (const profile of PROFILES) {
        const stored = section.readings.find((r) => r.profile === profile)!;
        const row = made.readings.find((r) => r.profile === profile)!;
        expect(row.reading_json).toBe(stored.reading_json);
        expect(row.reading_sha256).toBe(sha256(stored.reading_json as string));
        expect(row.zones_json).toBe(stored.zones_json);
        expect(row.zones_sha256).toBe(sha256(stored.zones_json));
        expect(row.zone_count).toBe(JSON.parse(stored.zones_json).length);
        expect(row.guard_problems).toEqual([]);
        expect(readingRowProblems(row)).toEqual([]);
        const zones = made.zones.filter((z) => z.profile === profile);
        expect(zones.map((z) => z.zone_id)).toEqual(
          JSON.parse(stored.zones_json).map((z: Doc) => z['zone_id'])
        );
        for (const zone of zones) expect(zoneRowProblems(zone)).toEqual([]);
      }
    }
  );

  it.each(SCENARIOS.map((s) => [s.id, s] as const))(
    '%s: the modal pills are the reference prices of the stored zone rows, in rank order',
    (_id, s) => {
      const section = s.expected['synthesis'] as SynthesisRunResult;
      for (const profile of PROFILES) {
        const stored = section.readings.find((r) => r.profile === profile)!;
        const zones = (JSON.parse(stored.zones_json) as Doc[]).sort(
          (a, b) => a['rank'] - b['rank']
        );
        expect(s.expected['pills'][profile]).toEqual(
          zones.map((z) => z['reference_price'])
        );
        expect(s.expected['pills'][profile].length).toBeLessThanOrEqual(5);
        if (zones.length === 0)
          expect(s.expected['pills'][profile]).toEqual([]);
      }
    }
  );

  it('every zone of the set is at least $13 from its invalidation, and none is stored for a stand-aside', () => {
    let zones = 0;
    let standAsides = 0;
    for (const s of SCENARIOS) {
      const section = s.expected['synthesis'] as SynthesisRunResult;
      for (const item of section.readings) {
        const reading = JSON.parse(item.reading_json as string) as Doc;
        const rows = JSON.parse(item.zones_json) as Doc[];
        if (reading['stand_aside']) {
          standAsides += 1;
          expect(rows).toEqual([]);
          expect(reading['zones']).toEqual([]);
        }
        for (const z of rows) {
          zones += 1;
          expect(
            Math.abs(z['reference_price'] - z['invalidation_price'])
          ).toBeGreaterThanOrEqual(13 - 1e-9);
        }
      }
    }
    expect(zones).toBeGreaterThan(20);
    expect(standAsides).toBeGreaterThanOrEqual(6);
  });
});

const pythonSuite = pythonAvailable() ? describe : describe.skip;

pythonSuite('the real scenarios, made again by the real Python runner', () => {
  jest.setTimeout(300_000);
  let dir: string;
  let config: string;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'golden-real-'));
    config = path.join(dir, 'shadow-syn.yaml');
    fs.writeFileSync(
      config,
      "schema: mcd-worker-config/1\nflags:\n  MCD0: 'shadow'\n  MCD1: 'shadow'\n  MCD2: 'shadow'\n  MCD3: 'shadow'\n  SYN: 'shadow'\nsynthesis:\n  rules_version: 'draft-1'\n"
    );
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  const real = SCENARIOS.filter((s) => s.scenario['kind'] === 'cycle');

  it('there are three, one for each stored cycle', () => {
    expect(real.map((s) => s.scenario['bundle'])).toEqual(
      FIXTURE_SLOTS.map((f) => f.stem)
    );
  });

  it.each(real.map((s) => [s.id, s] as const))(
    '%s: the SYN texts, hashes and zones equal the golden ones byte for byte, and so do the sensors’ envelopes',
    async (_id, s) => {
      const fixture = FIXTURE_SLOTS.find(
        (f) => f.stem === s.scenario['bundle']
      )!;
      const run = await new PythonCycleRunner({
        python: process.env['SENSOR_PYTHON'] ?? 'python',
        engineDir: ENGINE_DIR,
        runnerTimeoutMs: 120_000,
        workerConfigPath: config,
      }).run({
        bundle: readFixtureBundle(fixture) as unknown,
        retuningEnforced: false,
      });
      const result = run.result;
      expect(result.inputs_sha256).toBe(s.expected['inputs_sha256']);
      expect(result.synthesis).toEqual(s.expected['synthesis']);
      expect(
        result.results.map((r) => ({
          mcd_id: r.mcd_id,
          status: r.status,
          state_code: r.state_code,
          bias: r.bias,
          envelope_sha256: r.envelope_sha256,
          envelope_json: r.envelope_json,
        }))
      ).toEqual(s.expected['sensors']);
    }
  );
});

describe('the sign-off files', () => {
  it.each(SCENARIOS.map((s) => [s.id, s] as const))(
    '%s: approval.json is well formed, and a signed scenario still matches the hashes it was signed with',
    (_id, s) => {
      const a = s.approval;
      expect(Object.keys(a).sort()).toEqual(
        [
          'approved_by',
          'approved_on',
          'expected_sha256',
          'note',
          'scenario',
          'scenario_sha256',
          'schema',
          'status',
        ].sort()
      );
      expect(a['schema']).toBe('golden-approval/1');
      expect(a['scenario']).toBe(s.id);
      expect(['PENDING', 'APPROVED']).toContain(a['status']);
      if (a['status'] === 'PENDING') {
        expect(a['approved_by']).toBeNull();
        expect(a['approved_on']).toBeNull();
      } else {
        expect(typeof a['approved_by']).toBe('string');
        expect(a['approved_by'].trim()).not.toBe('');
        expect(a['approved_on']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(a['scenario_sha256']).toBe(sha256(s.scenarioText));
        expect(a['expected_sha256']).toBe(sha256(s.expectedText));
      }
    }
  );
});
