/**
 * @jest-environment node
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import {
  BIASES,
  BOARD_STATUSES,
  DATA_FLAGS,
  DATA_STATUSES,
  ENGLISH_MAX_CHARS,
  EVENTS_MAX_ITEMS,
  EVENTS_SCOPES,
  EVENTS_STATUSES,
  INTAKE_PACKET_SCHEMA,
  KNOWLEDGE_CHUNK_MAX_CHARS,
  KNOWLEDGE_DOMAINS,
  KNOWLEDGE_MAX_CHUNKS,
  KNOWLEDGE_MAX_EXPANSIONS,
  KNOWLEDGE_STATUSES,
  LANGUAGE_FAMILIES,
  LOCALES,
  PACKET_INTENTS,
  PACKET_SYMBOL,
  QUESTION_MAX_CHARS,
  QUESTION_SOURCES,
  SENSOR_STATUSES,
  SYN_STATES,
  TIMEFRAMES,
  TRADER_TYPES,
  TRADING_STYLES,
  TREND_RELATIONS,
  UNDERSTAND_INTENTS,
  UNDERSTAND_RESULT_SCHEMA,
  validatePacket,
  type Issue,
} from '@/lib/intake';

import {
  GOLDENS,
  allGoldenPackets,
  clone,
  packetFromGolden,
} from './helpers/packets';
import { REPO_ROOT, describePython, runPython } from './helpers/python';
import { UNDERSTAND_CASES } from './helpers/understand-cases';
import {
  at,
  deleteAt,
  retrace,
  setAt,
  structured,
  structuredObjects,
  type Any,
} from './helpers/walk';

const PACKET_SCHEMA_FILE = join(
  REPO_ROOT,
  'config',
  'intake',
  'intake-packet-1.schema.json'
);
const UNDERSTAND_SCHEMA_FILE = join(
  REPO_ROOT,
  'config',
  'intake',
  'understand-result-1.schema.json'
);
const VERDICTS = join(__dirname, 'helpers', 'schema_verdicts.py');

const readSchema = (file: string): Any =>
  JSON.parse(readFileSync(file, 'utf8')) as Any;

interface Verdict {
  ok: boolean;
  errors?: string[];
}

/** What the JSON Schema says about each document (one Python process for the lot). */
function verdicts(schemaFile: string, documents: unknown[]): Verdict[] {
  const dir = mkdtempSync(join(tmpdir(), 'schema-'));
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

const golden = (prefix: string) => {
  const found = GOLDENS.find((g) => g.id.startsWith(prefix));
  if (found === undefined) throw new Error(`no golden ${prefix}`);
  return found;
};

// ---------------------------------------------------------------------------------------
// The schema files, read as data (no Python needed)
// ---------------------------------------------------------------------------------------

describe('the JSON Schema files', () => {
  const packet = readSchema(PACKET_SCHEMA_FILE);
  const understand = readSchema(UNDERSTAND_SCHEMA_FILE);
  const defs = packet['$defs'] as Record<string, Any>;

  it('carry the ids the TypeScript uses', () => {
    expect(packet['$id']).toBe(INTAKE_PACKET_SCHEMA);
    expect(packet['properties']['schema']['const']).toBe(INTAKE_PACKET_SCHEMA);
    expect(packet['properties']['symbol']['const']).toBe(PACKET_SYMBOL);
    expect(understand['$id']).toBe(UNDERSTAND_RESULT_SCHEMA);
    expect(understand['properties']['schema']['const']).toBe(
      UNDERSTAND_RESULT_SCHEMA
    );
  });

  it('resolve every reference and leave no definition unused', () => {
    const text = JSON.stringify(packet);
    const used = new Set(
      [...text.matchAll(/"\$ref":"#\/\$defs\/([A-Za-z0-9]+)"/g)].map(
        (m) => m[1]
      )
    );
    for (const name of used) expect(Object.keys(defs)).toContain(name);
    for (const name of Object.keys(defs)) expect(used).toContain(name);
  });

  it('list the same enumerations as the TypeScript constants', () => {
    expect(packet['properties']['intent']['enum']).toEqual([...PACKET_INTENTS]);
    expect(defs['locale']['enum']).toEqual([...LOCALES]);
    expect(defs['language']['enum']).toEqual([...LANGUAGE_FAMILIES, 'und']);
    expect(defs['dataStatus']['enum']).toEqual([...DATA_STATUSES]);
    expect(defs['sensorStatus']['enum']).toEqual([...SENSOR_STATUSES]);
    expect(defs['boardStatus']['enum']).toEqual([...BOARD_STATUSES]);
    expect(defs['bias']['enum']).toEqual([...BIASES]);
    expect(defs['biasOrNull']['enum']).toEqual([...BIASES, null]);
    expect(defs['question']['properties']['source']['enum']).toEqual([
      ...QUESTION_SOURCES,
    ]);
    expect(defs['profile']['properties']['trader_type']['enum']).toEqual([
      ...TRADER_TYPES,
    ]);
    expect(defs['profile']['properties']['style']['enum']).toEqual([
      ...TRADING_STYLES,
    ]);
    expect(defs['data']['properties']['flags']['items']['enum']).toEqual([
      ...DATA_FLAGS,
    ]);
    expect(
      defs['board']['properties']['syn']['properties']['state']['enum']
    ).toEqual([...SYN_STATES]);
    expect(
      defs['board']['properties']['syn']['properties']['trend_relation']['enum']
    ).toEqual([...TREND_RELATIONS, null]);
    expect(defs['synReading']['properties']['trend_relation']['enum']).toEqual([
      ...TREND_RELATIONS,
      null,
    ]);
    expect(defs['chunk']['properties']['domain']['enum']).toEqual([
      ...KNOWLEDGE_DOMAINS,
    ]);
    expect(defs['chunk']['properties']['timeframe']['enum']).toEqual([
      ...TIMEFRAMES,
      null,
    ]);
    expect(defs['knowledge']['properties']['status']['enum']).toEqual([
      ...KNOWLEDGE_STATUSES,
    ]);
    expect(defs['events']['properties']['status']['enum']).toEqual([
      ...EVENTS_STATUSES,
    ]);
    expect(defs['events']['properties']['scope']['enum']).toEqual([
      ...EVENTS_SCOPES,
    ]);
    expect(understand['properties']['intent']['enum']).toEqual([
      ...UNDERSTAND_INTENTS,
    ]);
    expect(understand['properties']['language']['enum']).toEqual([
      ...LANGUAGE_FAMILIES,
      'und',
    ]);
  });

  it('use the same limits as the TypeScript constants', () => {
    const question = defs['question']['properties'];
    expect(question['original']['maxLength']).toBe(QUESTION_MAX_CHARS);
    expect(question['english']['maxLength']).toBe(ENGLISH_MAX_CHARS);
    expect(understand['properties']['english']['maxLength']).toBe(
      ENGLISH_MAX_CHARS
    );
    expect(defs['knowledge']['properties']['chunks']['maxItems']).toBe(
      KNOWLEDGE_MAX_CHUNKS
    );
    expect(defs['knowledge']['properties']['expansions']['maxItems']).toBe(
      KNOWLEDGE_MAX_EXPANSIONS
    );
    expect(defs['chunk']['properties']['text']['maxLength']).toBe(
      KNOWLEDGE_CHUNK_MAX_CHARS
    );
    expect(defs['events']['properties']['items']['maxItems']).toBe(
      EVENTS_MAX_ITEMS
    );
  });

  it('require exactly the fields of a packet made by the code', () => {
    const base = packetFromGolden(golden('01')) as Any;
    const keys = (value: Any): string[] => Object.keys(value).sort();
    const required = (def: Any): string[] => [...def['required']].sort();
    expect(required(packet)).toEqual(keys(base));
    expect(required(defs['question'])).toEqual(keys(base.question));
    expect(required(defs['profile'])).toEqual(keys(base.profile));
    expect(required(defs['data'])).toEqual(keys(base.data));
    expect(required(defs['board'])).toEqual(keys(base.board));
    expect(required(defs['board']['properties']['syn'])).toEqual(
      keys(base.board.syn)
    );
    expect(required(defs['board']['properties']['sensors']['items'])).toEqual(
      keys(base.board.sensors[0])
    );
    expect(required(defs['readings'])).toEqual(keys(base.readings));
    expect(
      required(defs['readings']['properties']['sensors']['items'])
    ).toEqual(keys(base.readings.sensors[0]));
    expect(
      required(defs['readings']['properties']['synthesis']['anyOf'][1])
    ).toEqual(keys(base.readings.synthesis));
    expect(required(defs['knowledge'])).toEqual(keys(base.knowledge));
    expect(required(defs['chunk'])).toEqual(keys(base.knowledge.chunks[0]));
    expect(required(defs['events'])).toEqual(keys(base.events));
    expect(required(defs['events']['properties']['items']['items'])).toEqual(
      keys(base.events.items[0])
    );
    expect(required(defs['trace'])).toEqual(keys(base.trace));
    expect(required(understand)).toEqual([
      'english',
      'intent',
      'language',
      'schema',
      'symbols',
      'timeframes',
    ]);
  });

  it('refuse the equity and the commission as a key name, in the free-form documents', () => {
    expect(defs['allowedKey']['not']['pattern']).toBe(
      '[eE][qQ][uU][iI][tT][yY]|[cC][oO][mM][mM][iI][sS][sS][iI][oO][nN]'
    );
    for (const name of ['envelope', 'synReading', 'zone', 'jsonValue']) {
      const text = JSON.stringify(defs[name]);
      expect(text).toContain('#/$defs/allowedKey');
    }
  });
});

// ---------------------------------------------------------------------------------------
// The packet schema against validatePacket
// ---------------------------------------------------------------------------------------

/** Rules the schema does not express; a payload only these break is accepted by the schema. */
function explainedByCrossFieldRules(issue: Issue): boolean {
  if (['INCONSISTENT', 'NOT_SORTED', 'DUPLICATE'].includes(issue.code))
    return true;
  // the roster knows which sensors exist and which states each one reports
  if (
    issue.code === 'NOT_ONE_OF' &&
    /^board\.sensors\[\d+\]\.(mcd_id|state_code)$/.test(issue.path)
  ) {
    return true;
  }
  // what a status needs is a rule between fields
  if (issue.code === 'REQUIRED' && issue.path === 'knowledge') return true;
  if (
    issue.code === 'TOO_SHORT' &&
    /^(board\.sensors\[\d+\]\.reasons|knowledge\.chunks)$/.test(issue.path)
  ) {
    return true;
  }
  if (
    issue.code === 'REQUIRED' &&
    /^(knowledge\.index_build_id|events\.calendar_age_seconds)$/.test(
      issue.path
    )
  ) {
    return true;
  }
  return false;
}

describePython('the packet schema and validatePacket', () => {
  const BASES = [
    packetFromGolden(golden('01'), { traderType: 'DAY_TRADER' }),
    packetFromGolden(golden('14'), {
      traderType: 'DAY_TRADER',
      intent: 'NEWS',
    }),
    packetFromGolden(golden('02'), {
      traderType: 'SCALPER',
      intent: 'INSTANT_M5_INSPECT',
      interfaceLocale: 'pt-BR',
      question: { language: 'pt', reply_locale: 'pt-BR' },
    }),
  ];

  it('is a valid Draft 2020-12 schema, and so is the Understand schema', () => {
    expect(verdicts(PACKET_SCHEMA_FILE, [])).toEqual([]);
    expect(verdicts(UNDERSTAND_SCHEMA_FILE, [])).toEqual([]);
  });

  it('accepts every packet made from a golden cycle, as validatePacket does', () => {
    const all = allGoldenPackets().map(({ packet }) => packet);
    const results = verdicts(PACKET_SCHEMA_FILE, [...all, ...BASES]);
    expect(results).toHaveLength(35);
    results.forEach((verdict, index) => {
      expect({ index, ...verdict }).toEqual({ index, ok: true });
    });
    for (const packet of [...all, ...BASES]) {
      expect(validatePacket(packet).ok).toBe(true);
    }
  });

  it('never refuses what validatePacket accepts, and agrees on the shape of every damaged copy', () => {
    const payloads: { what: string; value: Any }[] = [];
    BASES.forEach((base, b) => {
      // a field missing
      for (const { path, parent } of structured(base)) {
        if (Array.isArray(parent)) continue;
        const value = clone(base) as Any;
        deleteAt(value, path);
        payloads.push({ what: `base ${b}: delete ${path}`, value });
      }
      // a field that is not part of the contract
      for (const path of structuredObjects(base)) {
        const value = clone(base) as Any;
        at(value, path)['surprise'] = 1;
        payloads.push({ what: `base ${b}: add to ${path || '(root)'}`, value });
      }
      // a field of the wrong type
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
        payloads.push({ what: `base ${b}: wrong type at ${path}`, value });
      }
      // the equity and the commission, in the documents the worker wrote
      const places: [string, (p: Any) => Any][] = [
        ['envelope', (p) => p.readings.sensors[0]?.envelope],
        ['envelope details', (p) => p.readings.sensors[0]?.envelope?.details],
        ['envelope level', (p) => p.readings.sensors[0]?.envelope?.levels?.[0]],
        ['syn reading', (p) => p.readings.synthesis?.reading],
        ['syn input', (p) => p.readings.synthesis?.reading?.inputs?.MCD1],
        ['zone', (p) => p.readings.synthesis?.zones?.[0]],
        [
          'zone level',
          (p) => p.readings.synthesis?.zones?.[0]?.source_levels?.[0],
        ],
      ];
      for (const [name, pick] of places) {
        for (const key of [
          'equity',
          'commission',
          'Equity',
          'account_commission',
        ]) {
          const value = clone(base) as Any;
          const target = pick(value);
          if (target === undefined) continue;
          target[key] = 1;
          payloads.push({ what: `base ${b}: ${key} in ${name}`, value });
        }
      }
    });
    expect(payloads.length).toBeGreaterThan(700);

    const schema = verdicts(
      PACKET_SCHEMA_FILE,
      payloads.map(({ value }) => value)
    );
    let bothRefuse = 0;
    let onlyTheCode = 0;
    const unexplained: string[] = [];
    payloads.forEach(({ what, value }, index) => {
      const ts = validatePacket(value);
      const verdict = schema[index] as Verdict;
      if (ts.ok) {
        // the schema is never stricter than the code
        if (!verdict.ok)
          unexplained.push(
            `${what}: the schema refused a packet the code accepts`
          );
        return;
      }
      if (!verdict.ok) {
        bothRefuse += 1;
        return;
      }
      onlyTheCode += 1;
      const rest = ts.issues.filter(
        (issue) => !explainedByCrossFieldRules(issue)
      );
      if (rest.length > 0) {
        unexplained.push(
          `${what}: the schema accepts it, the code refuses it for ${rest
            .map((i) => `${i.path} [${i.code}]`)
            .join(', ')}`
        );
      }
    });
    expect(unexplained).toEqual([]);
    // not vacuous: nearly every damaged copy is refused by BOTH
    expect(bothRefuse).toBeGreaterThan(payloads.length * 0.8);
    expect(onlyTheCode + bothRefuse).toBe(payloads.length);
  });

  it('does not express the rules between fields, which is why validatePacket exists', () => {
    const base = BASES[0] as Any;
    const cases: [string, Any][] = [
      [
        'the reply locale is not the one rule D1 gives',
        retrace({
          ...clone(base),
          question: { ...base.question, reply_locale: 'en-GB' },
        }),
      ],
      [
        'the board says VALID over a CAUTIONARY envelope',
        (() => {
          const p = clone(base);
          p.board.sensors[0].status = 'VALID';
          return retrace(p);
        })(),
      ],
      [
        'the readings in full are not the sensors of M*',
        (() => {
          const p = clone(base);
          p.readings.m_star = ['MCD1'];
          return retrace(p);
        })(),
      ],
      [
        'the trace is not what the packet says',
        (() => {
          const p = clone(base);
          p.trace.language = 'th';
          return p;
        })(),
      ],
      [
        'the scope of the events does not follow the intent',
        (() => {
          const p = clone(base);
          p.events.scope = 'UPCOMING_ALL';
          return retrace(p);
        })(),
      ],
      [
        'the status is UNKNOWN without the flag that says why',
        (() => {
          const p = clone(base);
          p.data.status = 'UNKNOWN';
          return retrace(p);
        })(),
      ],
      [
        'Report 2 carries readings',
        (() => {
          const p = clone(base);
          p.intent = 'REPORT_2';
          p.knowledge = null;
          return retrace(p);
        })(),
      ],
      [
        'a board line for the gate',
        (() => {
          const p = clone(base);
          p.board.sensors[0].mcd_id = 'MCD0';
          return retrace(p);
        })(),
      ],
      [
        'a state code of another sensor',
        (() => {
          const p = clone(base);
          p.board.sensors[0].state_code = 'MCD2_UP_IN_CORRIDOR';
          return retrace(p);
        })(),
      ],
      [
        'two chunks with the same id',
        (() => {
          const p = clone(base);
          p.knowledge.chunks[1].id = p.knowledge.chunks[0].id;
          return retrace(p);
        })(),
      ],
      [
        'zones in another order than the reading names them',
        (() => {
          const p = clone(base);
          p.readings.synthesis.zones.reverse();
          return retrace(p);
        })(),
      ],
      [
        'an unavailable calendar that lists events',
        (() => {
          const p = clone(base);
          p.events.status = 'UNAVAILABLE';
          p.events.calendar_age_seconds = null;
          return retrace(p);
        })(),
      ],
      [
        'SENSORS_NOT_LIVE with live sensors on the board',
        (() => {
          const p = clone(base);
          p.data.flags = ['SENSORS_NOT_LIVE'];
          return retrace(p);
        })(),
      ],
      [
        'an instant prompt with typed text',
        (() => {
          const p = clone(BASES[2] as Any);
          p.question.original = 'hello';
          return retrace(p);
        })(),
      ],
      [
        'a SYN line that is not running but has a rule',
        (() => {
          const p = clone(base);
          p.board.syn.state = 'NOT_RUNNING';
          return retrace(p);
        })(),
      ],
    ];
    const schema = verdicts(
      PACKET_SCHEMA_FILE,
      cases.map(([, value]) => value)
    );
    cases.forEach(([what, value], index) => {
      expect({
        what,
        schema: (schema[index] as Verdict).ok,
        code: validatePacket(value).ok,
      }).toEqual({
        what,
        schema: true,
        code: false,
      });
    });
  });

  it('refuses the equity and the commission in a key, as the code does', () => {
    const base = BASES[0] as Any;
    const value = clone(base);
    value.readings.sensors[1].envelope.details.nested = [{ account_equity: 1 }];
    const [verdict] = verdicts(PACKET_SCHEMA_FILE, [value]);
    expect(verdict?.ok).toBe(false);
    expect(validatePacket(value).ok).toBe(false);
    // and not for the word in a value
    const harmless = clone(base);
    harmless.readings.sensors[1].envelope.commentary = 'equity and commission';
    expect(verdicts(PACKET_SCHEMA_FILE, [harmless])[0]?.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------
// The Understand schema (its TypeScript validator is checked against it in understand-parity.test.ts)
// ---------------------------------------------------------------------------------------

describePython('the Understand schema (understand-result/1)', () => {
  it('accepts and refuses what a person labelled', () => {
    const results = verdicts(
      UNDERSTAND_SCHEMA_FILE,
      UNDERSTAND_CASES.map(([, value]) => value)
    );
    UNDERSTAND_CASES.forEach(([what, , want], index) => {
      expect({ what, ok: (results[index] as Verdict).ok }).toEqual({
        what,
        ok: want,
      });
    });
    expect(UNDERSTAND_CASES.length).toBeGreaterThan(50);
  });
});
