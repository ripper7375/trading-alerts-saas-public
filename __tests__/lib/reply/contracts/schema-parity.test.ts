/**
 * @jest-environment node
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { LOCALES } from '@/lib/intake';
import {
  ANSWER_ACTIONS,
  ANSWER_KEYS,
  ANSWER_LIMITS,
  validateAnswer,
} from '@/lib/reply/contracts/answer';
import {
  REPORT1_KEYS,
  REPORT1_LIMITS,
  validateReport1,
} from '@/lib/reply/contracts/report1';
import {
  CITE_ID,
  MAX_CITES,
  MAX_ZONES,
  SCHEMA_TEXT_PATTERN,
  VALUE_ID,
  ZONE_ID,
} from '@/lib/reply/contracts/shape';
import type { Issue } from '@/lib/reply/contracts/intake';
import { ANSWER_SCHEMA, REPORT1_SCHEMA } from '@/lib/reply/version';

import {
  REPO_ROOT,
  describePython,
  runPython,
} from '../../intake/helpers/python';
import {
  at,
  deleteAt,
  setAt,
  structured,
  structuredObjects,
} from '../../intake/helpers/walk';
import { ANSWER, REPORT_01, STORED_REPORTS, clone } from '../helpers/fixtures';

type Any = any;

const REPORT_FILE = join(REPO_ROOT, 'config', 'reply', 'report1-1.schema.json');
const ANSWER_FILE = join(REPO_ROOT, 'config', 'reply', 'answer-1.schema.json');
const VERDICTS = join(
  REPO_ROOT,
  '__tests__',
  'lib',
  'intake',
  'helpers',
  'schema_verdicts.py'
);

const readSchema = (file: string): Any =>
  JSON.parse(readFileSync(file, 'utf8')) as Any;

interface Verdict {
  ok: boolean;
  errors?: string[];
}

/** What the JSON Schema says about each document (one Python process for the lot). */
function verdicts(schemaFile: string, documents: unknown[]): Verdict[] {
  const dir = mkdtempSync(join(tmpdir(), 'reply-schema-'));
  try {
    const file = join(dir, 'documents.json');
    writeFileSync(file, JSON.stringify(documents));
    const run = runPython([VERDICTS, schemaFile, file]);
    if (run.status !== 0) throw new Error(run.stderr || `exit ${run.status}`);
    return JSON.parse(run.stdout) as Verdict[];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const ch = (code: number): string => String.fromCodePoint(code);

// ---------------------------------------------------------------------------------------
// The schema files, read as data (no Python needed)
// ---------------------------------------------------------------------------------------

describe('report1-1.schema.json', () => {
  const schema = readSchema(REPORT_FILE);
  const defs = schema['$defs'] as Record<string, Any>;

  it('carries the id of the contract and is closed', () => {
    expect(schema['$id']).toBe(REPORT1_SCHEMA);
    expect(schema['title']).toBe(REPORT1_SCHEMA);
    expect(schema['additionalProperties']).toBe(false);
    expect(defs['line']['additionalProperties']).toBe(false);
  });

  it('requires exactly the five keys, in no other place', () => {
    expect([...schema['required']].sort()).toEqual([...REPORT1_KEYS].sort());
    expect(Object.keys(schema['properties']).sort()).toEqual(
      [...REPORT1_KEYS].sort()
    );
    expect([...defs['line']['required']].sort()).toEqual(['cites', 'text']);
  });

  it('has no direction field of any name', () => {
    const text =
      JSON.stringify(schema.properties) +
      JSON.stringify(defs['line']['properties']);
    for (const word of [
      'direction',
      'bias',
      'side',
      'signal',
      'archetype',
      'rule_id',
      'trend',
    ]) {
      expect(text.toLowerCase()).not.toContain(`"${word}"`);
    }
  });

  it('uses the limits of the TypeScript contract', () => {
    const p = schema['properties'];
    expect(defs['headlineText']['maxLength']).toBe(REPORT1_LIMITS.headline);
    expect(defs['lineText']['maxLength']).toBe(REPORT1_LIMITS.lineText);
    expect(defs['headlineText']['minLength']).toBe(1);
    expect(defs['lineText']['minLength']).toBe(1);
    for (const key of ['rationale', 'watch', 'risks'] as const) {
      expect({ key, min: p[key]['minItems'], max: p[key]['maxItems'] }).toEqual(
        {
          key,
          min: REPORT1_LIMITS[key].min,
          max: REPORT1_LIMITS[key].max,
        }
      );
      expect(p[key]['items']).toEqual({ $ref: '#/$defs/line' });
    }
    expect(p['zones']['maxItems']).toBe(MAX_ZONES);
    expect(p['zones']['uniqueItems']).toBe(true);
    expect(defs['cites']['maxItems']).toBe(MAX_CITES);
    expect(defs['cites']['uniqueItems']).toBe(true);
  });

  it('uses the patterns of the TypeScript contract', () => {
    expect(schema['properties']['zones']['items']['pattern']).toBe(
      ZONE_ID.source
    );
    expect(defs['cites']['items']['pattern']).toBe(CITE_ID.source);
    expect(defs['plainText']['pattern']).toBe(SCHEMA_TEXT_PATTERN);
    expect(defs['placeholders']['pattern']).toBe(
      `^([^{}]|\\{${VALUE_ID.source.slice(1, -1)}\\})*$`
    );
    expect(defs['notBlank']['pattern']).toBe('\\S');
  });

  it('resolves every reference and leaves no definition unused', () => {
    const text = JSON.stringify(schema);
    const used = new Set(
      [...text.matchAll(/"\$ref":"#\/\$defs\/([A-Za-z0-9]+)"/g)].map(
        (m) => m[1]
      )
    );
    for (const name of used) expect(Object.keys(defs)).toContain(name);
    for (const name of Object.keys(defs)) expect(used).toContain(name);
  });
});

describe('answer-1.schema.json', () => {
  const schema = readSchema(ANSWER_FILE);
  const defs = schema['$defs'] as Record<string, Any>;

  it('carries the id of the contract and is closed', () => {
    expect(schema['$id']).toBe(ANSWER_SCHEMA);
    expect(schema['title']).toBe(ANSWER_SCHEMA);
    expect(schema['additionalProperties']).toBe(false);
  });

  it('requires exactly the four keys', () => {
    expect([...schema['required']].sort()).toEqual([...ANSWER_KEYS].sort());
    expect(Object.keys(schema['properties']).sort()).toEqual(
      [...ANSWER_KEYS].sort()
    );
  });

  it('lists the 19 locales of the interface, and the closed list of actions', () => {
    expect(defs['locale']['enum']).toEqual([...LOCALES]);
    expect(defs['locale']['enum']).toHaveLength(19);
    expect(schema['properties']['action']['enum']).toEqual([
      ...ANSWER_ACTIONS,
      null,
    ]);
  });

  it('uses the limits and the patterns of the TypeScript contract', () => {
    expect(schema['properties']['text']['maxLength']).toBe(ANSWER_LIMITS.text);
    expect(schema['properties']['text']['minLength']).toBe(1);
    expect(schema['properties']['cites']['maxItems']).toBe(MAX_CITES);
    expect(schema['properties']['cites']['items']['pattern']).toBe(
      CITE_ID.source
    );
    expect(defs['plainText']['pattern']).toBe(SCHEMA_TEXT_PATTERN);
    expect(defs['placeholders']['pattern']).toBe(
      `^([^{}]|\\{${VALUE_ID.source.slice(1, -1)}\\})*$`
    );
  });

  it('resolves every reference and leaves no definition unused', () => {
    const text = JSON.stringify(schema);
    const used = new Set(
      [...text.matchAll(/"\$ref":"#\/\$defs\/([A-Za-z0-9]+)"/g)].map(
        (m) => m[1]
      )
    );
    for (const name of used) expect(Object.keys(defs)).toContain(name);
    for (const name of Object.keys(defs)) expect(used).toContain(name);
  });
});

// ---------------------------------------------------------------------------------------
// The schemas against the validators
// ---------------------------------------------------------------------------------------

/**
 * Rules the schema does not express. A document that only these break is accepted by the
 * schema and refused by the code: that is what `validateReport1` and `validateAnswer` are
 * for. (Rules that need the packet do not arise here: no context is given.)
 */
function onlyTheCodeKnows(issue: Issue): boolean {
  if (issue.code === 'TOO_MANY' && /placeholders/.test(issue.message))
    return true;
  if (issue.code === 'TOO_LONG' && issue.path === '') return true;
  // tag characters: Python's `re` has no \u{...}
  if (issue.code === 'BAD_FORMAT' && /plain text/.test(issue.message))
    return true;
  return false;
}

interface Payload {
  what: string;
  value: Any;
}

/** One-field-at-a-time damage of a base document, the way the packet parity test does it. */
function damaged(base: Any, label: string): Payload[] {
  const out: Payload[] = [];
  for (const { path, parent } of structured(base)) {
    if (Array.isArray(parent)) continue;
    const value = clone(base) as Any;
    deleteAt(value, path);
    out.push({ what: `${label}: delete ${path}`, value });
  }
  for (const path of structuredObjects(base)) {
    const value = clone(base) as Any;
    at(value, path)['surprise'] = 1;
    out.push({ what: `${label}: add to ${path || '(root)'}`, value });
  }
  for (const { path, value: leaf } of structured(base)) {
    if (typeof leaf === 'object' && leaf !== null) continue;
    const wrong =
      typeof leaf === 'string'
        ? 12345
        : typeof leaf === 'number'
          ? 'x'
          : typeof leaf === 'boolean'
            ? 'no'
            : 0;
    const value = clone(base) as Any;
    setAt(value, path, wrong);
    out.push({ what: `${label}: wrong type at ${path}`, value });
  }
  return out;
}

/** Hand-made damage: each case names whether the schema should refuse it too. */
function targeted(): { what: string; value: Any; schemaRefuses: boolean }[] {
  const report = (patch: (r: Any) => void): Any => {
    const r = clone(REPORT_01) as Any;
    patch(r);
    return r;
  };
  const longLine = (n: number) => ({ text: 'x'.repeat(n), cites: [] });
  return [
    {
      what: 'a direction key',
      value: report((r) => (r.direction = 'LONG')),
      schemaRefuses: true,
    },
    {
      what: 'a bias key',
      value: report((r) => (r.bias = 'LONG')),
      schemaRefuses: true,
    },
    {
      what: 'a newline in a line',
      value: report((r) => (r.rationale[0].text = 'a\nb')),
      schemaRefuses: true,
    },
    {
      what: 'a NUL in a line',
      value: report((r) => (r.rationale[0].text = `a${ch(0)}b`)),
      schemaRefuses: true,
    },
    {
      what: 'a DEL in a line',
      value: report((r) => (r.rationale[0].text = `a${ch(0x7f)}b`)),
      schemaRefuses: true,
    },
    {
      what: 'a C1 control in a line',
      value: report((r) => (r.rationale[0].text = `a${ch(0x85)}b`)),
      schemaRefuses: true,
    },
    {
      what: 'a line separator',
      value: report((r) => (r.rationale[0].text = `a${ch(0x2028)}b`)),
      schemaRefuses: true,
    },
    {
      what: 'a right-to-left override',
      value: report((r) => (r.rationale[0].text = `a${ch(0x202e)}b`)),
      schemaRefuses: true,
    },
    {
      what: 'a bidirectional isolate',
      value: report((r) => (r.rationale[0].text = `a${ch(0x2066)}b`)),
      schemaRefuses: true,
    },
    {
      what: 'a byte order mark',
      value: report((r) => (r.rationale[0].text = `a${ch(0xfeff)}b`)),
      schemaRefuses: true,
    },
    {
      what: 'a tag character',
      value: report((r) => (r.rationale[0].text = `a${ch(0xe0041)}b`)),
      schemaRefuses: false,
    },
    {
      what: 'a stray open brace',
      value: report((r) => (r.watch[0].text = 'a { b')),
      schemaRefuses: true,
    },
    {
      what: 'a stray close brace',
      value: report((r) => (r.watch[0].text = 'a } b')),
      schemaRefuses: true,
    },
    {
      what: 'nested braces',
      value: report((r) => (r.watch[0].text = 'a {{MCD2.baseline}} b')),
      schemaRefuses: true,
    },
    {
      what: 'an empty placeholder',
      value: report((r) => (r.watch[0].text = 'a {} b')),
      schemaRefuses: true,
    },
    {
      what: 'a lower-case placeholder',
      value: report((r) => (r.watch[0].text = 'a {mcd2.baseline} b')),
      schemaRefuses: true,
    },
    {
      what: 'a placeholder with a space',
      value: report((r) => (r.watch[0].text = 'a { MCD2.baseline } b')),
      schemaRefuses: true,
    },
    {
      what: 'nine placeholders',
      value: report(
        (r) =>
          (r.watch[0].text = Array.from({ length: 9 }, () => '{A}').join(' '))
      ),
      schemaRefuses: false,
    },
    {
      what: 'a blank line',
      value: report((r) => (r.watch[0].text = '   ')),
      schemaRefuses: true,
    },
    {
      what: 'a headline of 161',
      value: report((r) => (r.headline = 'h'.repeat(161))),
      schemaRefuses: true,
    },
    {
      what: 'a line of 241',
      value: report((r) => (r.watch[0].text = 'x'.repeat(241))),
      schemaRefuses: true,
    },
    {
      what: 'no rationale',
      value: report((r) => (r.rationale = [])),
      schemaRefuses: true,
    },
    {
      what: 'no watch',
      value: report((r) => (r.watch = [])),
      schemaRefuses: true,
    },
    {
      what: 'seven rationale lines',
      value: report(
        (r) => (r.rationale = Array.from({ length: 7 }, () => longLine(3)))
      ),
      schemaRefuses: true,
    },
    {
      what: 'six risks',
      value: report(
        (r) => (r.risks = Array.from({ length: 6 }, () => longLine(3)))
      ),
      schemaRefuses: true,
    },
    {
      what: 'a repeated cite',
      value: report((r) => (r.rationale[0].cites = ['MCD1', 'MCD1'])),
      schemaRefuses: true,
    },
    {
      what: 'five cites',
      value: report(
        (r) => (r.rationale[0].cites = ['MCD1', 'MCD2', 'MCD3', 'Z1', 'Z2'])
      ),
      schemaRefuses: true,
    },
    {
      what: 'the gate as a cite',
      value: report((r) => (r.rationale[0].cites = ['MCD0'])),
      schemaRefuses: true,
    },
    {
      what: 'MCD16 as a cite',
      value: report((r) => (r.rationale[0].cites = ['MCD16'])),
      schemaRefuses: true,
    },
    {
      what: 'Z6 as a zone',
      value: report((r) => (r.zones = ['Z6'])),
      schemaRefuses: true,
    },
    {
      what: 'a repeated zone',
      value: report((r) => (r.zones = ['Z1', 'Z1'])),
      schemaRefuses: true,
    },
    {
      what: 'six zones',
      value: report((r) => (r.zones = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z1'])),
      schemaRefuses: true,
    },
    {
      what: 'texts that add up to 2,401',
      value: report((r) => {
        r.headline = 'h'.repeat(160);
        r.rationale = Array.from({ length: 6 }, () => longLine(240));
        r.watch = Array.from({ length: 3 }, () => longLine(240));
        r.risks = [longLine(81)];
      }),
      schemaRefuses: false,
    },
  ];
}

describePython('the schemas against the validators', () => {
  it('are valid Draft 2020-12 schemas', () => {
    expect(verdicts(REPORT_FILE, [])).toEqual([]);
    expect(verdicts(ANSWER_FILE, [])).toEqual([]);
  });

  it('accept the three stored reports and the answer, as the validators do', () => {
    const reports = STORED_REPORTS.map(([, report]) => report);
    const results = verdicts(REPORT_FILE, reports);
    expect(results).toEqual(reports.map(() => ({ ok: true })));
    for (const report of reports) expect(validateReport1(report).ok).toBe(true);
    expect(verdicts(ANSWER_FILE, [ANSWER])).toEqual([{ ok: true }]);
    expect(validateAnswer(ANSWER).ok).toBe(true);
  });

  it('never refuse what validateReport1 accepts, and agree on the shape of every damaged copy', () => {
    const payloads: Payload[] = [];
    STORED_REPORTS.forEach(([prefix, report]) =>
      payloads.push(...damaged(report, prefix))
    );
    expect(payloads.length).toBeGreaterThan(80);
    const schema = verdicts(
      REPORT_FILE,
      payloads.map((p) => p.value)
    );
    let bothRefuse = 0;
    const unexplained: string[] = [];
    payloads.forEach(({ what, value }, index) => {
      const ts = validateReport1(value);
      const verdict = schema[index] as Verdict;
      if (ts.ok) {
        if (!verdict.ok)
          unexplained.push(
            `${what}: the schema refused a report the code accepts`
          );
        return;
      }
      if (!verdict.ok) {
        bothRefuse += 1;
        return;
      }
      const rest = ts.issues.filter((issue) => !onlyTheCodeKnows(issue));
      if (rest.length > 0) {
        unexplained.push(
          `${what}: the schema accepts it, the code refuses it for ${rest.map((i) => `${i.path} [${i.code}]`).join(', ')}`
        );
      }
    });
    expect(unexplained).toEqual([]);
    expect(bothRefuse).toBeGreaterThan(payloads.length * 0.9);
  });

  it('agree on the shape of every damaged answer', () => {
    const payloads = damaged(ANSWER, 'answer');
    expect(payloads.length).toBeGreaterThan(8);
    const schema = verdicts(
      ANSWER_FILE,
      payloads.map((p) => p.value)
    );
    const unexplained: string[] = [];
    payloads.forEach(({ what, value }, index) => {
      const ts = validateAnswer(value);
      const verdict = schema[index] as Verdict;
      if (ts.ok) {
        if (!verdict.ok)
          unexplained.push(
            `${what}: the schema refused an answer the code accepts`
          );
      } else if (verdict.ok) {
        const rest = ts.issues.filter((issue) => !onlyTheCodeKnows(issue));
        if (rest.length > 0)
          unexplained.push(
            `${what}: only the code refuses it for ${rest.map((i) => i.path).join(', ')}`
          );
      }
    });
    expect(unexplained).toEqual([]);
  });

  it('agree, case by case, on what each hand-made damage does (and which are the code alone)', () => {
    const cases = targeted();
    const schema = verdicts(
      REPORT_FILE,
      cases.map((c) => c.value)
    );
    cases.forEach(({ what, value, schemaRefuses }, index) => {
      expect({
        what,
        code: validateReport1(value).ok,
        schema: (schema[index] as Verdict).ok,
      }).toEqual({
        what,
        code: false,
        schema: !schemaRefuses,
      });
    });
    // the ones the schema cannot see are exactly the rules the code adds
    expect(cases.filter((c) => !c.schemaRefuses).map((c) => c.what)).toEqual([
      'a tag character',
      'nine placeholders',
      'texts that add up to 2,401',
    ]);
  });

  it('agree on the answers a person would write', () => {
    const answer = (patch: (a: Any) => void): Any => {
      const a = clone(ANSWER) as Any;
      patch(a);
      return a;
    };
    const cases: [string, Any, boolean][] = [
      ['a null action', answer((a) => (a.action = null)), true],
      [
        'the trade setup action',
        answer((a) => (a.action = 'OPEN_TRADE_SETUP')),
        true,
      ],
      ['an unlisted action', answer((a) => (a.action = 'PLACE_ORDER')), false],
      ['no action key', answer((a) => delete a.action), false],
      ['a locale of the 19', answer((a) => (a.locale = 'pt-BR')), true],
      ['a locale that is not', answer((a) => (a.locale = 'ru')), false],
      ['a text of 800', answer((a) => (a.text = 'x'.repeat(800))), true],
      ['a text of 801', answer((a) => (a.text = 'x'.repeat(801))), false],
      ['a direction key', answer((a) => (a.direction = 'LONG')), false],
      ['a newline', answer((a) => (a.text = 'a\nb')), false],
      ['a brace', answer((a) => (a.text = 'a {')), false],
    ];
    const schema = verdicts(
      ANSWER_FILE,
      cases.map(([, value]) => value)
    );
    cases.forEach(([what, value, ok], index) => {
      expect({
        what,
        code: validateAnswer(value).ok,
        schema: (schema[index] as Verdict).ok,
      }).toEqual({
        what,
        code: ok,
        schema: ok,
      });
    });
  });
});
