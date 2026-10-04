import * as fs from 'fs';
import * as path from 'path';
import { SynReadingValidator } from '../src/sensors/syn-validator';
import synSchema from '../src/sensors/syn-output-1.schema.json';
import { ENGINE_DIR, FIXTURE_SLOTS } from './helpers/cycle-fixtures';
import { pythonAvailable, pythonJson } from './helpers/kit-runner';
import { storedSynthesis } from './helpers/sensors-worker-world';

/**
 * The SYN reading check before a row is written (build step 4 part 5). Three things can go wrong without anything failing
 * loudly, and each has a block below (they are the three of `sensors-envelope-validator.spec.ts`, for `syn-output/1`):
 *
 *   1. The gateway validates against a COPY of the engine's schema (Railway builds this package alone). If the copy is
 *      stale the gateway accepts or refuses the wrong readings.
 *   2. The validator is Ajv; the engine's tests use Python's jsonschema. A keyword the two read differently would show up
 *      as a reading one side accepts and the other refuses. The corpus pins Ajv's verdict to jsonschema's on every case.
 *   3. `strict` mode stays on, so a schema keyword nobody declared fails here.
 */

const SOURCE = path.join(
  ENGINE_DIR,
  'mcd_worker',
  'synthesis',
  'syn-output-1.schema.json'
);
const validator = new SynReadingValidator();

const storedReadings = FIXTURE_SLOTS.flatMap((fixture) =>
  storedSynthesis(fixture).readings.map(
    (r) => [`${fixture.name} ${r.profile}`, r.reading_json as string] as const
  )
);

describe('the copy of the schema', () => {
  it('is byte for byte the engine’s (`npm run sync:syn-output-schema` when it is not)', () => {
    const copy = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'sensors', 'syn-output-1.schema.json')
    );
    expect(fs.readFileSync(SOURCE).equals(copy)).toBe(true);
  });

  it('is the 2020-12 schema of syn-output/1', () => {
    expect(synSchema.$schema).toBe(
      'https://json-schema.org/draft/2020-12/schema'
    );
    expect(synSchema.$id).toBe('syn-output/1');
  });

  it('is copied by a script that is wired into package.json and points at the engine’s file', () => {
    const scripts = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
    ).scripts;
    expect(scripts['sync:syn-output-schema']).toBe(
      'node scripts/sync-syn-output-schema.js'
    );
    const script = fs.readFileSync(
      path.join(__dirname, '..', 'scripts', 'sync-syn-output-schema.js'),
      'utf8'
    );
    expect(script).toContain('mcd_worker/synthesis/syn-output-1.schema.json');
    expect(script).toContain('src/sensors/syn-output-1.schema.json');
  });
});

describe('SynReadingValidator.check', () => {
  it.each(storedReadings)('accepts the stored reading %s', (_name, text) => {
    const checked = validator.check(text);
    expect(checked.ok).toBe(true);
    if (checked.ok)
      expect(checked.reading['schema_version']).toBe('syn-output/1');
  });

  it('returns the parsed reading, not the text', () => {
    const [, text] = storedReadings[0];
    const checked = validator.check(text);
    expect(checked.ok && checked.reading).toEqual(JSON.parse(text));
  });

  it('refuses text that is not JSON, naming the root', () => {
    const checked = validator.check('{"mcd_id":');
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.problems[0]).toMatch(/^<root>: not JSON/);
  });

  it.each([['[]'], ['null'], ['"text"'], ['5'], ['{}']])(
    'refuses %s',
    (text) => {
      expect(validator.check(text).ok).toBe(false);
    }
  );

  it('names each problem with its place and lists them in a stable order', () => {
    const damaged = JSON.parse(storedReadings[0][1]);
    delete damaged.rule_id;
    damaged.bias = 'UP';
    damaged.extra = 1;
    const checked = validator.check(JSON.stringify(damaged));
    expect(checked.ok).toBe(false);
    if (!checked.ok) {
      expect([...checked.problems].sort()).toEqual(checked.problems);
      expect(checked.problems.join('\n')).toMatch(
        /<root>: must have required property 'rule_id'/
      );
      expect(checked.problems.join('\n')).toMatch(
        /\/bias: must be equal to one of the allowed values/
      );
      expect(checked.problems.join('\n')).toMatch(
        /must NOT have additional properties/
      );
    }
  });

  it('checks again every time: one bad reading does not spoil the next', () => {
    expect(validator.check('{}').ok).toBe(false);
    expect(validator.check(storedReadings[0][1]).ok).toBe(true);
  });
});

// ---------------------------------------------------------------- parity with the engine's validator

const real = pythonAvailable() ? describe : describe.skip;

real('Ajv against the engine’s jsonschema, case by case', () => {
  jest.setTimeout(120_000);

  type Damage = [string, (r: any) => void]; // eslint-disable-line @typescript-eslint/no-explicit-any
  const required: string[] = synSchema.required as string[];

  const damages: Damage[] = [
    ...required.map((key): Damage => [`missing ${key}`, (r) => delete r[key]]),
    ['an unknown key', (r) => (r.surprise = true)],
    ['schema_version 2', (r) => (r.schema_version = 'syn-output/2')],
    ['mcd_id MCD1', (r) => (r.mcd_id = 'MCD1')],
    ['profile SWING', (r) => (r.profile = 'SWING')],
    [
      'profile in lower case',
      (r) => (r.profile = String(r.profile).toLowerCase()),
    ],
    ['cycle_slot with a space', (r) => (r.cycle_slot = '2026-09-18 20:55')],
    ['cycle_slot off the grid', (r) => (r.cycle_slot = '2026-09-18T20:57Z')],
    ['cycle_slot a number', (r) => (r.cycle_slot = 1789764900)],
    ['rules_version in capitals', (r) => (r.rules_version = 'Draft-1')],
    ['rules_sha256 too short', (r) => (r.rules_sha256 = 'abc')],
    [
      'rules_sha256 in capitals',
      (r) => (r.rules_sha256 = String(r.rules_sha256).toUpperCase()),
    ],
    ['rule_id in lower case', (r) => (r.rule_id = 'r1_something')],
    [
      'rule_id NO_MATCH with a direction',
      (r) => ((r.rule_id = 'NO_MATCH'), (r.branch_id = null)),
    ],
    ['a rule with no branch', (r) => (r.branch_id = null)],
    ['branch_id a number', (r) => (r.branch_id = 3)],
    ['status MAYBE', (r) => (r.status = 'MAYBE')],
    ['status VALID with reasons left in', (r) => (r.status = 'VALID')],
    [
      'status CAUTIONARY with no reasons',
      (r) => ((r.status = 'CAUTIONARY'), (r.status_reasons = [])),
    ],
    ['status INVALID with a direction', (r) => (r.status = 'INVALID')],
    ['status_reasons a string', (r) => (r.status_reasons = 'A_B')],
    ['status_reasons repeated', (r) => (r.status_reasons = ['A_B', 'A_B'])],
    ['status_reasons holding a number', (r) => (r.status_reasons = [1])],
    [
      'status_reasons in lower case',
      (r) => (r.status_reasons = ['mcd0_defect']),
    ],
    ['data_status OLD', (r) => (r.data_status = 'OLD')],
    ['data_status INPUTS_REFUSED', (r) => (r.data_status = 'INPUTS_REFUSED')],
    ['archetype E', (r) => (r.archetype = 'E')],
    ['a direction with no archetype', (r) => (r.archetype = null)],
    ['bias UP', (r) => (r.bias = 'UP')],
    [
      'bias NEUTRAL with a trend relation',
      (r) => ((r.bias = 'NEUTRAL'), (r.stand_aside = false)),
    ],
    ['trend_relation SIDEWAYS', (r) => (r.trend_relation = 'SIDEWAYS')],
    ['a direction with no trend relation', (r) => (r.trend_relation = null)],
    ['stand_aside with a direction', (r) => (r.stand_aside = true)],
    ['stand_aside as text', (r) => (r.stand_aside = 'false')],
    ['bias STAND_ASIDE and stand_aside false', (r) => (r.bias = 'STAND_ASIDE')],
    [
      'stand_aside with zones',
      (r) => ((r.bias = 'STAND_ASIDE'), (r.stand_aside = true)),
    ],
    ['inputs a list', (r) => (r.inputs = [])],
    [
      'inputs holding MCD16',
      (r) => (r.inputs.MCD16 = r.inputs.MCD1 ?? Object.values(r.inputs)[0]),
    ],
    [
      'inputs holding a bad key',
      (r) => (r.inputs.X = Object.values(r.inputs)[0]),
    ],
    [
      'an input with no envelope_sha256',
      (r) => delete Object.values<any>(r.inputs)[0].envelope_sha256,
    ], // eslint-disable-line @typescript-eslint/no-explicit-any
    [
      'an input with an unknown key',
      (r) => (Object.values<any>(r.inputs)[0].surprise = 1),
    ], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['reasons empty', (r) => (r.reasons = [])],
    ['reasons holding a number', (r) => (r.reasons = [1])],
    ['reasons holding an empty text', (r) => (r.reasons = [''])],
    ['six zones', (r) => (r.zones = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z1'])],
    ['zones repeated', (r) => (r.zones = ['Z1', 'Z1'])],
    ['zone Z6', (r) => (r.zones = ['Z6'])],
    ['zone z1', (r) => (r.zones = ['z1'])],
    ['summary_line empty', (r) => (r.summary_line = '')],
    ['summary_line 81 characters', (r) => (r.summary_line = 'x'.repeat(81))],
    ['summary_line a number', (r) => (r.summary_line = 1)],
    ['the whole thing a list', () => undefined],
  ];

  it('gives the same verdict as jsonschema on every damaged copy of the stored readings and of a stand-aside one', () => {
    const standAside = JSON.parse(storedReadings[0][1]);
    Object.assign(standAside, {
      status: 'INVALID',
      status_reasons: ['UPSTREAM_STALE:MCD1'],
      bias: 'STAND_ASIDE',
      stand_aside: true,
      archetype: null,
      trend_relation: null,
      zones: [],
    });
    const bases: Array<readonly [string, string]> = [
      ...storedReadings.filter((_, i) => i % 2 === 0),
      ['stand-aside', JSON.stringify(standAside)],
    ];
    const cases: Array<{ name: string; text: string }> = [];
    for (const [baseName, baseText] of bases) {
      cases.push({ name: `${baseName}: untouched`, text: baseText });
      for (const [label, damage] of damages) {
        const copy = JSON.parse(baseText);
        if (label === 'the whole thing a list') {
          cases.push({
            name: `${baseName}: ${label}`,
            text: JSON.stringify([copy]),
          });
          continue;
        }
        try {
          damage(copy);
        } catch {
          continue; // a damage that does not apply to this base (an input that is not there)
        }
        cases.push({
          name: `${baseName}: ${label}`,
          text: JSON.stringify(copy),
        });
      }
    }
    const python = pythonJson<boolean[]>(
      `
import json, sys
from jsonschema import Draft202012Validator
schema = json.load(open("mcd_worker/synthesis/syn-output-1.schema.json", encoding="utf-8"))
validator = Draft202012Validator(schema)
texts = json.load(sys.stdin)
print(json.dumps([validator.is_valid(json.loads(t)) for t in texts]))
`,
      cases.map((c) => c.text)
    );
    const disagreements: string[] = [];
    cases.forEach((c, i) => {
      const ajv = validator.check(c.text).ok;
      if (ajv !== python[i])
        disagreements.push(`${c.name}: Ajv ${ajv}, jsonschema ${python[i]}`);
    });
    expect(disagreements).toEqual([]);
    // the corpus really has both kinds of verdict, and a lot of each
    expect(python.filter(Boolean).length).toBeGreaterThanOrEqual(bases.length);
    expect(python.filter((v) => !v).length).toBeGreaterThan(100);
  });
});
