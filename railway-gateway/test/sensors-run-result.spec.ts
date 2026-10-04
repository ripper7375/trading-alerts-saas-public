import {
  RunnerError,
  cycleResultProblems,
  parseCycleResult,
  synthesisSectionProblems,
} from '../src/sensors/cycle-run-result';
import { FIXTURE_SLOTS } from './helpers/cycle-fixtures';
import {
  storedSynthesis,
  unitResult,
  unitResultWithSynthesis,
} from './helpers/sensors-worker-world';

/**
 * What the worker accepts from the Python runner (`mcd-cycle-result/1`). The runner is the
 * authority on the shape; the worker reads only what it needs and refuses a result without it,
 * so a runner that changed under the worker is a loud failure and not a row with `undefined`.
 */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe('cycleResultProblems', () => {
  it.each(FIXTURE_SLOTS.map((f) => [f.name, f] as const))(
    'accepts the result built from the stored cycle %s',
    (_name, fixture) => {
      expect(cycleResultProblems(unitResult(fixture))).toEqual([]);
    }
  );

  it('accepts a reading made under the live flag as well as the shadow one', () => {
    const result = unitResult();
    result.results[0] = { ...result.results[0], flag: 'live' };
    expect(cycleResultProblems(result)).toEqual([]);
  });

  it('accepts a result with no reading (every MCD off) and a result with no bundle text (null with its hash)', () => {
    expect(cycleResultProblems({ ...unitResult(), results: [] })).toEqual([]);
    expect(
      cycleResultProblems({
        ...unitResult(),
        inputs_sha256: null,
        bundle_canonical_json: null,
      })
    ).toEqual([]);
  });

  const defects: Array<[string, (r: any) => void, RegExp]> = [
    ['not an object', () => undefined, /not an object/],
    [
      'a wrong schema_version',
      (r) => (r.schema_version = 'mcd-cycle-result/2'),
      /schema_version/,
    ],
    [
      'a missing runner_version',
      (r) => delete r.runner_version,
      /runner_version must be a string/,
    ],
    ['a numeric symbol', (r) => (r.symbol = 5), /symbol must be a string/],
    [
      'a missing cycle_slot',
      (r) => delete r.cycle_slot,
      /cycle_slot must be a string/,
    ],
    [
      'a numeric inputs_sha256',
      (r) => (r.inputs_sha256 = 1),
      /inputs_sha256 must be a string or null/,
    ],
    [
      'a missing bundle_canonical_json',
      (r) => delete r.bundle_canonical_json,
      /bundle_canonical_json must be a string or null/,
    ],
    [
      'a hash with no text',
      (r) => (r.bundle_canonical_json = null),
      /both set or both null/,
    ],
    [
      'a text with no hash',
      (r) => (r.inputs_sha256 = null),
      /both set or both null/,
    ],
    ['a missing retuning', (r) => delete r.retuning, /retuning must be/],
    [
      'a retuning with a number',
      (r) => (r.retuning.applied = 1),
      /retuning must be/,
    ],
    ['a missing runtime', (r) => delete r.runtime, /runtime must be/],
    [
      'a runtime with no python',
      (r) => delete r.runtime.python,
      /runtime must be/,
    ],
    [
      'results that are not a list',
      (r) => (r.results = {}),
      /results must be a list/,
    ],
    [
      'a reading that is not an object',
      (r) => (r.results[0] = 5),
      /results\[0\] is not an object/,
    ],
    [
      'a reading with no envelope_json',
      (r) => delete r.results[1].envelope_json,
      /results\[1\]\.envelope_json must be a string/,
    ],
    [
      'a reading with a numeric status',
      (r) => (r.results[0].status = 1),
      /results\[0\]\.status must be a string/,
    ],
    [
      'a reading with a numeric state_code',
      (r) => (r.results[0].state_code = 1),
      /state_code must be a string or null/,
    ],
    [
      'a reading whose reasons are not a list',
      (r) => (r.results[0].inherited_reasons = 'x'),
      /inherited_reasons must be a list of strings/,
    ],
    [
      'a reading whose problems hold a number',
      (r) => (r.results[0].guard_problems = [1]),
      /guard_problems must be a list of strings/,
    ],
    [
      'a flag that is off',
      (r) => (r.results[0].flag = 'off'),
      /flag must be shadow or live/,
    ],
    [
      'a flag that is missing',
      (r) => delete r.results[0].flag,
      /flag must be shadow or live/,
    ],
    [
      'the same MCD twice',
      (r) => (r.results[1].mcd_id = r.results[0].mcd_id),
      /appears twice/,
    ],
    [
      'no timing for an MCD',
      (r) => delete r.runtime.timings_ms.MCD2,
      /no number for MCD2/,
    ],
    [
      'a timing that is text',
      (r) => (r.runtime.timings_ms.MCD1 = '3'),
      /no number for MCD1/,
    ],
  ];

  it.each(defects)('refuses %s', (_name, damage, expected) => {
    const result = clone(unitResult());
    if (_name === 'not an object') {
      expect(cycleResultProblems(null)[0]).toMatch(expected);
      expect(cycleResultProblems([])[0]).toMatch(expected);
      expect(cycleResultProblems('text')[0]).toMatch(expected);
      return;
    }
    damage(result);
    expect(cycleResultProblems(result).join('; ')).toMatch(expected);
  });
});

describe('parseCycleResult', () => {
  it('returns the result as the runner wrote it', () => {
    const result = unitResult();
    expect(parseCycleResult(JSON.stringify(result))).toEqual(result);
  });

  it('a result that is not JSON is an OUTPUT error that will not mend by retrying', () => {
    expect.assertions(3);
    try {
      parseCycleResult('Traceback (most recent call last):');
    } catch (error) {
      expect(error).toBeInstanceOf(RunnerError);
      expect((error as RunnerError).kind).toBe('OUTPUT');
      expect((error as RunnerError).retryable).toBe(false);
    }
  });

  it('a result of the wrong shape is an OUTPUT error that names the problems', () => {
    expect.assertions(2);
    try {
      parseCycleResult(
        JSON.stringify({ schema_version: 'mcd-cycle-result/1' })
      );
    } catch (error) {
      expect((error as RunnerError).kind).toBe('OUTPUT');
      expect((error as RunnerError).message).toMatch(
        /runner_version must be a string/
      );
    }
  });
});

// ---------------------------------------------------------------- the synthesis section (build step 4 part 5)

describe('the synthesis section of a result', () => {
  it.each(FIXTURE_SLOTS.map((f) => [f.name, f] as const))(
    'the stored section of %s is one the synthesis writer can use',
    (_name, fixture) => {
      expect(synthesisSectionProblems(storedSynthesis(fixture))).toEqual([]);
    }
  );

  it('a result with a synthesis section is a result, and so is one without (the SYN flag off)', () => {
    const fixture = FIXTURE_SLOTS[0];
    expect(cycleResultProblems(unitResultWithSynthesis(fixture))).toEqual([]);
    expect(cycleResultProblems(unitResult(fixture))).toEqual([]);
    expect(unitResult(fixture)).not.toHaveProperty('synthesis');
  });

  it('is read leniently: a malformed section does not make the result malformed, so a bug in synthesis cannot cost the cycle its sensor rows', () => {
    const fixture = FIXTURE_SLOTS[0];
    for (const junk of [
      null,
      5,
      'text',
      [],
      {},
      { flag: 'off' },
      { readings: 3 },
    ]) {
      const result = { ...unitResult(fixture), synthesis: junk };
      expect(cycleResultProblems(result)).toEqual([]);
      expect(parseCycleResult(JSON.stringify(result)).results).toHaveLength(4);
    }
  });

  const defects: Array<[string, (s: any) => void, RegExp]> = [
    ['no flag', (s) => delete s.flag, /synthesis.flag must be a string/],
    [
      'a flag that is off',
      (s) => (s.flag = 'off'),
      /flag must be shadow or live/,
    ],
    [
      'a flag that is a boolean',
      (s) => (s.flag = false),
      /flag must be a string/,
    ],
    [
      'no rules_version',
      (s) => delete s.rules_version,
      /rules_version must be a string/,
    ],
    [
      'a rules_sha256 that is a number',
      (s) => (s.rules_sha256 = 7),
      /rules_sha256 must be a string/,
    ],
    [
      'no zones_version',
      (s) => delete s.zones_version,
      /zones_version must be a string/,
    ],
    [
      'a zones_sha256 that is null',
      (s) => (s.zones_sha256 = null),
      /zones_sha256 must be a string/,
    ],
    [
      'a reference price that is text',
      (s) => (s.reference_price = '4378.31'),
      /reference_price must be a number or null/,
    ],

    [
      'an error that is a number',
      (s) => (s.error = 1),
      /error must be a string or null/,
    ],
    [
      'readings that are not a list',
      (s) => (s.readings = {}),
      /readings must be a list/,
    ],
    [
      'a reading entry that is a number',
      (s) => (s.readings = [3]),
      /readings\[0\] is not an object/,
    ],
    [
      'no profile',
      (s) => delete s.readings[0].profile,
      /readings\[0\].profile must be a string/,
    ],
    [
      'a reading_json that is a number',
      (s) => (s.readings[0].reading_json = 3),
      /reading_json must be a string or null/,
    ],
    [
      'a reading_sha256 that is undefined',
      (s) => delete s.readings[0].reading_sha256,
      /reading_sha256 must be a string or null/,
    ],
    [
      'no zones_json',
      (s) => delete s.readings[0].zones_json,
      /zones_json must be a string/,
    ],
    [
      'a zones_reason that is a number',
      (s) => (s.readings[0].zones_reason = 4),
      /zones_reason must be a string or null/,
    ],
    [
      'guard_problems that are not a list of text',
      (s) => (s.readings[0].guard_problems = [1]),
      /guard_problems must be a list of strings/,
    ],
    [
      'the same profile twice',
      (s) => (s.readings[1].profile = s.readings[0].profile),
      /appears twice/,
    ],
  ];

  it.each(defects)('names %s', (_label, damage, expected) => {
    const section = clone(storedSynthesis(FIXTURE_SLOTS[0]));
    damage(section);
    const problems = synthesisSectionProblems(section);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join('\n')).toMatch(expected);
  });

  it.each([[null], [5], ['text'], [[]], [undefined]])(
    '%p is not a section',
    (value) => {
      expect(synthesisSectionProblems(value)).toEqual([
        'synthesis is not an object',
      ]);
    }
  );

  it('accepts a section with no readings (an engine error) and a reading the engine withheld (null text and hash)', () => {
    const section = clone(storedSynthesis(FIXTURE_SLOTS[0]));
    section.error = 'SYNTHESIS_ERROR';
    section.readings = [];
    expect(synthesisSectionProblems(section)).toEqual([]);
    const withheld = clone(storedSynthesis(FIXTURE_SLOTS[0]));
    withheld.readings[0].reading_json = null;
    withheld.readings[0].reading_sha256 = null;
    expect(synthesisSectionProblems(withheld)).toEqual([]);
  });
});
