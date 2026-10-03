import * as fs from 'fs';
import * as path from 'path';
import { EnvelopeValidator } from '../src/sensors/envelope-validator';
import envelopeSchema from '../src/sensors/mcd-output-1.schema.json';
import {
  ENGINE_DIR,
  FIXTURE_SLOTS,
  readFixtureCycle,
} from './helpers/cycle-fixtures';
import { pythonAvailable, pythonJson } from './helpers/kit-runner';

/**
 * The envelope check before a row is written (build step 3 part 4). Three things can go wrong
 * without anything failing loudly, and each has a block below:
 *
 *   1. The gateway validates against a COPY of the kit's schema (Railway builds this package
 *      alone). If the copy is stale the gateway accepts or refuses the wrong envelopes.
 *   2. The validator is Ajv; the kit's tests use Python's jsonschema. A keyword the two read
 *      differently would show up as an envelope one side accepts and the other refuses. The corpus
 *      pins Ajv's verdict to jsonschema's on every case.
 *   3. `strict` mode stays on, so a schema keyword nobody declared fails here.
 */

const SOURCE = path.join(ENGINE_DIR, 'mcd_common', 'mcd-output-1.schema.json');
const validator = new EnvelopeValidator();

const storedEnvelopes = FIXTURE_SLOTS.flatMap((fixture) =>
  readFixtureCycle(fixture).results.map(
    (r) => [`${fixture.name} ${r.mcd_id}`, r.envelope_json] as const
  )
);

describe('the copy of the schema', () => {
  it('is byte for byte the kit’s (`npm run sync:mcd-output-schema` when it is not)', () => {
    const copy = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'sensors', 'mcd-output-1.schema.json')
    );
    expect(fs.readFileSync(SOURCE).equals(copy)).toBe(true);
  });

  it('is the 2020-12 schema of mcd-output/1', () => {
    expect(envelopeSchema.$schema).toBe(
      'https://json-schema.org/draft/2020-12/schema'
    );
    expect(envelopeSchema.$id).toBe('mcd-output/1');
  });
});

describe('EnvelopeValidator.check', () => {
  it.each(storedEnvelopes)('accepts the stored envelope %s', (_name, text) => {
    const checked = validator.check(text);
    expect(checked.ok).toBe(true);
    if (checked.ok)
      expect(checked.envelope['schema_version']).toBe('mcd-output/1');
  });

  it('returns the parsed envelope, not the text', () => {
    const [, text] = storedEnvelopes[0];
    const checked = validator.check(text);
    expect(checked.ok && checked.envelope).toEqual(JSON.parse(text));
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
    const damaged = JSON.parse(storedEnvelopes[0][1]);
    delete damaged.mcd_id;
    damaged.status = 'MAYBE';
    damaged.extra = 1;
    const checked = validator.check(JSON.stringify(damaged));
    expect(checked.ok).toBe(false);
    if (!checked.ok) {
      expect([...checked.problems].sort()).toEqual(checked.problems);
      // a problem at the top of the envelope is placed at <root>, like the kit's
      expect(
        checked.problems.some((p) =>
          p.startsWith("<root>: must have required property 'mcd_id'")
        )
      ).toBe(true);
      expect(checked.problems.join('\n')).toMatch(
        /\/status: must be equal to one of the allowed values/
      );
      expect(checked.problems.join('\n')).toMatch(
        /must have required property 'mcd_id'/
      );
      expect(checked.problems.join('\n')).toMatch(
        /must NOT have additional properties/
      );
    }
  });

  it('checks again every time: one bad envelope does not spoil the next', () => {
    expect(validator.check('{}').ok).toBe(false);
    expect(validator.check(storedEnvelopes[0][1]).ok).toBe(true);
  });
});

// ---------------------------------------------------------------- parity with the kit's validator

const real = pythonAvailable() ? describe : describe.skip;

real('Ajv against the kit’s jsonschema, case by case', () => {
  jest.setTimeout(120_000);

  type Damage = [string, (e: any) => void];
  const required: string[] = envelopeSchema.required as string[];

  const damages: Damage[] = [
    ...required.map((key): Damage => [`missing ${key}`, (e) => delete e[key]]),
    ['an unknown key', (e) => (e.surprise = true)],
    ['status MAYBE', (e) => (e.status = 'MAYBE')],
    [
      'status in lower case',
      (e) => (e.status = String(e.status).toLowerCase()),
    ],
    ['status INVALID with the reading left in', (e) => (e.status = 'INVALID')],
    [
      'status VALID with no state_code',
      (e) => ((e.status = 'VALID'), (e.state_code = null)),
    ],
    [
      'status STALE with a state',
      (e) => ((e.status = 'STALE'), (e.state_code = 'MCD2_UP')),
    ],
    ['schema_version 2', (e) => (e.schema_version = 'mcd-output/2')],
    ['cycle_slot with a space', (e) => (e.cycle_slot = '2026-09-18 20:55')],
    ['cycle_slot off the grid', (e) => (e.cycle_slot = '2026-09-18T20:57Z')],
    ['cycle_slot empty', (e) => (e.cycle_slot = '')],
    ['cycle_slot a number', (e) => (e.cycle_slot = 1789764900)],
    ['mcd_id MCD16', (e) => (e.mcd_id = 'MCD16')],
    ['mcd_id lower case', (e) => (e.mcd_id = 'mcd1')],
    ['mcd_id a number', (e) => (e.mcd_id = 1)],
    ['evaluator_version with two parts', (e) => (e.evaluator_version = '2.0')],
    ['evaluator_version with a v', (e) => (e.evaluator_version = 'v2.0.0')],
    ['depends_on a string', (e) => (e.depends_on = 'MCD1')],
    ['depends_on repeated', (e) => (e.depends_on = ['MCD1', 'MCD1'])],
    ['depends_on holding a bad id', (e) => (e.depends_on = ['X'])],
    ['status_reasons a string', (e) => (e.status_reasons = 'A')],
    ['status_reasons repeated', (e) => (e.status_reasons = ['A_B', 'A_B'])],
    ['status_reasons empty', (e) => (e.status_reasons = [])],
    ['status_reasons holding a number', (e) => (e.status_reasons = [1])],
    ['bias UP', (e) => (e.bias = 'UP')],
    ['bias a number', (e) => (e.bias = 3)],
    ['state_code a number', (e) => (e.state_code = 7)],
    ['summary_line far too long', (e) => (e.summary_line = 'x'.repeat(5000))],
    ['summary_line a number', (e) => (e.summary_line = 1)],
    ['commentary null', (e) => (e.commentary = null)],
    ['commentary far too long', (e) => (e.commentary = 'y'.repeat(20000))],
    ['levels a string', (e) => (e.levels = 'none')],
    ['levels holding a number', (e) => (e.levels = [1, 2])],
    ['details a list', (e) => (e.details = [])],
    [
      'active_indicator holding a number',
      (e) => (e.active_indicator = { M5: 1 }),
    ],
    ['config_hash holding a number', (e) => (e.config_hash = { sr: 1 })],
    [
      'last_closed_bar holding a number',
      (e) => (e.last_closed_bar = { M5: 1 }),
    ],
    ['the whole thing a list', () => undefined],
  ];

  it('gives the same verdict as jsonschema on every damaged copy of every kind of envelope', () => {
    // one envelope of each status the kit can write: the stored (VALID or CAUTIONARY) ones, and an INVALID and a STALE one
    const unavailable = pythonJson<string[]>(
      `
import json
from mcd_common import envelope as env, reason_codes as rc
slot = "2026-09-18T20:55Z"
print(json.dumps([
    env.canonical_json(env.canonical(env.invalid("MCD2", "2.0.1", slot, [rc.SANITY_FAILED], depends_on=()))),
    env.canonical_json(env.canonical(env.stale("MCD3", "1.0.0", slot, [rc.DATA_STALE], depends_on=("MCD1", "MCD2")))),
]))
`
    );
    const bases: Array<[string, string]> = [
      ...storedEnvelopes.filter((_, i) => i % 4 !== 0).slice(0, 4),
      ['kit INVALID', unavailable[0]],
      ['kit STALE', unavailable[1]],
    ] as Array<[string, string]>;

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
        damage(copy);
        cases.push({
          name: `${baseName}: ${label}`,
          text: JSON.stringify(copy),
        });
      }
    }

    // six base envelopes, each untouched once and damaged 17 + 37 ways: the corpus must not shrink unnoticed
    expect(cases).toHaveLength(6 * (1 + 17 + 37));

    const kit = pythonJson<boolean[]>(
      `
import json, sys
from jsonschema import Draft202012Validator
schema = json.load(open("mcd_common/mcd-output-1.schema.json", encoding="utf-8"))
validator = Draft202012Validator(schema)
texts = json.load(sys.stdin)
print(json.dumps([validator.is_valid(json.loads(t)) for t in texts]))
`,
      cases.map((c) => c.text)
    );
    expect(kit).toHaveLength(cases.length);

    const disagreements = cases
      .map((c, i) => ({
        name: c.name,
        ajv: validator.check(c.text).ok,
        kit: kit[i],
      }))
      .filter((c) => c.ajv !== c.kit);
    expect(disagreements).toEqual([]);

    // the corpus is only evidence if it holds both kinds of verdict, and a lot of the refusals
    const accepted = kit.filter(Boolean).length;
    expect(accepted).toBeGreaterThanOrEqual(bases.length);
    expect(cases.length - accepted).toBeGreaterThanOrEqual(bases.length * 25);
    // every untouched base is accepted by both
    cases.forEach((c, i) => {
      if (c.name.endsWith(': untouched'))
        expect([c.name, kit[i]]).toEqual([c.name, true]);
    });
  });
});
