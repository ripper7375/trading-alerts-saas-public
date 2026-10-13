/**
 * @jest-environment node
 */

/**
 * The dispatch matrix (`config/intake/dispatch-matrix.v1.json`, `lib/intake/matrix.ts`,
 * ADR-036): the committed file is read strictly, has a row for each of the ten intents, and
 * says what architecture 4.5 and the plan's decisions D2 and D10 say. A bad file is refused
 * with every problem and its path.
 */

import {
  DISPATCH_MATRIX,
  EXTRA_SELECTORS,
  INTENTS,
  KNOWLEDGE_DOMAINS,
  NOTE_MAX_CHARS,
  PLAYBOOK_SCOPES,
  ROUTING_VERSION,
  matrixRow,
  parseMatrix,
} from '@/lib/intake';

import matrixFile from '@/config/intake/dispatch-matrix.v1.json';

import { clone } from './helpers/packets';

const file = (): Record<string, any> =>
  clone(matrixFile) as Record<string, any>;
const problems = (raw: unknown): string[] => {
  const parsed = parseMatrix(raw);
  return parsed.ok ? [] : parsed.issues.map((i) => `${i.path}: ${i.code}`);
};

describe('the committed matrix', () => {
  it('parses, and is the version the code names', () => {
    expect(parseMatrix(matrixFile).ok).toBe(true);
    expect(DISPATCH_MATRIX.version).toBe(ROUTING_VERSION);
    expect(DISPATCH_MATRIX.schema).toBe('dispatch-matrix/1');
  });

  it('has one row for each of the ten intents and no other', () => {
    expect(Object.keys(DISPATCH_MATRIX.intents)).toEqual([...INTENTS]);
    expect(INTENTS).toHaveLength(10);
  });

  it('says what architecture 4.5 says about the always set', () => {
    for (const intent of INTENTS) {
      const gives = intent !== 'REPORT_2' && intent !== 'OUT_OF_SCOPE';
      expect(matrixRow(intent).always).toBe(gives);
    }
  });

  it('says what 4.5 and D10 say about the sensors beyond the always set', () => {
    const extra = Object.fromEntries(
      INTENTS.map((i) => [i, matrixRow(i).extra])
    );
    expect(extra).toEqual({
      DIRECTION: 'NONE',
      ENTRY_TIMING: 'ZONE_SOURCES',
      EXIT_TARGETS: 'TARGET_SIDE_LEVELS',
      RISK_SIZING: 'NONE',
      EXPLAIN: 'TERM_OWNERS',
      NEWS: 'NONE',
      REPORT_2: 'NONE',
      OUT_OF_SCOPE: 'NONE',
      INSTANT_M5_INSPECT: 'TIMEFRAME_CHANNEL',
      INSTANT_M15_INSPECT: 'TIMEFRAME_CHANNEL',
    });
  });

  it('says what 4.5 and D10 say about the knowledge domains', () => {
    const knowledge = Object.fromEntries(
      INTENTS.map((i) => [i, [matrixRow(i).domains, matrixRow(i).playbooks]])
    );
    expect(knowledge).toEqual({
      DIRECTION: [['D3', 'D5'], 'M_STAR'],
      ENTRY_TIMING: [['D3'], 'M_STAR'],
      EXIT_TARGETS: [['D4'], 'M_STAR'],
      RISK_SIZING: [['D4', 'D5'], 'NONE'],
      EXPLAIN: [['D1'], 'NONE'],
      NEWS: [['D5'], 'NONE'],
      REPORT_2: [[], 'NONE'],
      OUT_OF_SCOPE: [[], 'NONE'],
      INSTANT_M5_INSPECT: [['D1', 'D3'], 'M_STAR'],
      INSTANT_M15_INSPECT: [['D1', 'D3'], 'M_STAR'],
    });
  });

  it('lists its domains in the order D1 to D5 and uses only known selectors', () => {
    for (const intent of INTENTS) {
      const row = matrixRow(intent);
      const positions = row.domains.map((d) => KNOWLEDGE_DOMAINS.indexOf(d));
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
      expect(EXTRA_SELECTORS).toContain(row.extra);
      expect(PLAYBOOK_SCOPES).toContain(row.playbooks);
      expect(row.note.length).toBeGreaterThan(0);
      expect(row.note.length).toBeLessThanOrEqual(NOTE_MAX_CHARS);
    }
  });

  it('uses each selector for exactly the intents D2 and D10 name', () => {
    const using = (selector: string) =>
      INTENTS.filter((i) => matrixRow(i).extra === selector);
    expect(using('ZONE_SOURCES')).toEqual(['ENTRY_TIMING']);
    expect(using('TARGET_SIDE_LEVELS')).toEqual(['EXIT_TARGETS']);
    expect(using('TERM_OWNERS')).toEqual(['EXPLAIN']);
    expect(using('TIMEFRAME_CHANNEL')).toEqual([
      'INSTANT_M5_INSPECT',
      'INSTANT_M15_INSPECT',
    ]);
  });
});

describe('a matrix that must be refused', () => {
  it('accepts a copy of the committed file', () => {
    expect(problems(file())).toEqual([]);
  });

  it.each([
    ['not an object', 'text', ['']],
    ['an array', [], ['']],
    ['null', null, ['']],
  ])('refuses %s', (_name, raw, paths) => {
    expect(problems(raw).map((p) => p.split(':')[0])).toEqual(paths);
  });

  it('refuses another schema, a bad version and extra or missing top keys', () => {
    expect(problems({ ...file(), schema: 'dispatch-matrix/2' })).toContain(
      'schema: NOT_ONE_OF'
    );
    expect(problems({ ...file(), version: 'Routing V1' })).toContain(
      'version: BAD_FORMAT'
    );
    expect(problems({ ...file(), version: '' })).toContain(
      'version: TOO_SHORT'
    );
    expect(problems({ ...file(), extra: 1 })).toContain('extra: UNKNOWN_KEY');
    const missing = file();
    delete missing['version'];
    expect(problems(missing)).toContain('version: REQUIRED');
  });

  it('refuses intents that are not an object', () => {
    expect(problems({ ...file(), intents: [] })).toContain(
      'intents: WRONG_TYPE'
    );
  });

  it('refuses a missing intent and an unknown intent', () => {
    const missing = file();
    delete missing['intents']['NEWS'];
    expect(problems(missing)).toContain('intents.NEWS: REQUIRED');
    const extra = file();
    extra['intents']['VOICE'] = extra['intents']['NEWS'];
    expect(problems(extra)).toContain('intents.VOICE: UNKNOWN_KEY');
  });

  const CHANGES: [string, (row: Record<string, any>) => void, string][] = [
    [
      'always as text',
      (r) => {
        r['always'] = 'yes';
      },
      'always: WRONG_TYPE',
    ],
    [
      'an unknown selector',
      (r) => {
        r['extra'] = 'ALL_SENSORS';
      },
      'extra: NOT_ONE_OF',
    ],
    [
      'an unknown playbook scope',
      (r) => {
        r['playbooks'] = 'ALL';
      },
      'playbooks: NOT_ONE_OF',
    ],
    [
      'a note that is not text',
      (r) => {
        r['note'] = 4;
      },
      'note: WRONG_TYPE',
    ],
    [
      'an empty note',
      (r) => {
        r['note'] = '';
      },
      'note: TOO_SHORT',
    ],
    [
      'a note that is too long',
      (r) => {
        r['note'] = 'x'.repeat(NOTE_MAX_CHARS + 1);
      },
      'note: TOO_LONG',
    ],
    [
      'domains that are not a list',
      (r) => {
        r['domains'] = 'D3';
      },
      'domains: WRONG_TYPE',
    ],
    [
      'an unknown domain',
      (r) => {
        r['domains'] = ['D9'];
      },
      'domains[0]: NOT_ONE_OF',
    ],
    [
      'a repeated domain',
      (r) => {
        r['domains'] = ['D3', 'D3'];
      },
      'domains[1]: DUPLICATE',
    ],
    [
      'domains out of order',
      (r) => {
        r['domains'] = ['D5', 'D3'];
      },
      'domains[1]: NOT_SORTED',
    ],
    [
      'six domains',
      (r) => {
        r['domains'] = ['D1', 'D2', 'D3', 'D4', 'D5', 'D5'];
      },
      'domains: TOO_MANY',
    ],
    [
      'an extra key',
      (r) => {
        r['weight'] = 1;
      },
      'weight: UNKNOWN_KEY',
    ],
  ];
  it.each(CHANGES)('refuses %s', (_name, change, expected) => {
    const raw = file();
    change(raw['intents']['DIRECTION']);
    expect(problems(raw)).toContain(`intents.DIRECTION.${expected}`);
  });

  it('refuses a missing key of a row', () => {
    const raw = file();
    delete raw['intents']['DIRECTION']['extra'];
    expect(problems(raw)).toContain('intents.DIRECTION.extra: REQUIRED');
  });

  it('refuses a row that is not an object', () => {
    const raw = file();
    raw['intents']['DIRECTION'] = 'NONE';
    expect(problems(raw)).toContain('intents.DIRECTION: WRONG_TYPE');
  });

  it.each(['REPORT_2', 'OUT_OF_SCOPE'] as const)(
    'refuses %s with readings, extra sensors or knowledge',
    (intent) => {
      const withAlways = file();
      withAlways['intents'][intent]['always'] = true;
      expect(problems(withAlways)).toContain(
        `intents.${intent}.always: INCONSISTENT`
      );

      const withExtra = file();
      withExtra['intents'][intent]['extra'] = 'ZONE_SOURCES';
      expect(problems(withExtra)).toContain(
        `intents.${intent}.extra: INCONSISTENT`
      );

      const withDomain = file();
      withDomain['intents'][intent]['domains'] = ['D1'];
      expect(problems(withDomain)).toContain(`intents.${intent}: INCONSISTENT`);

      const withPlaybooks = file();
      withPlaybooks['intents'][intent]['playbooks'] = 'M_STAR';
      expect(problems(withPlaybooks)).toContain(
        `intents.${intent}: INCONSISTENT`
      );
    }
  );

  it('refuses any other intent without the always set (ADR-041)', () => {
    const raw = file();
    raw['intents']['RISK_SIZING']['always'] = false;
    expect(problems(raw)).toContain('intents.RISK_SIZING.always: INCONSISTENT');
  });

  it('holds the version name to its pattern and its 40 characters', () => {
    expect(problems({ ...file(), version: 'routing-v1!' })).toContain(
      'version: BAD_FORMAT'
    );
    expect(problems({ ...file(), version: 'routing-v1 ' })).toContain(
      'version: BAD_FORMAT'
    );
    expect(problems({ ...file(), version: 'a'.repeat(40) })).toEqual([]);
    expect(problems({ ...file(), version: 'a'.repeat(41) })).toContain(
      'version: TOO_LONG'
    );
  });

  it('holds a note to 240 characters', () => {
    const raw = file();
    raw['intents']['NEWS']['note'] = 'x'.repeat(240);
    expect(problems(raw)).toEqual([]);
    raw['intents']['NEWS']['note'] = 'x'.repeat(241);
    expect(problems(raw)).toEqual(['intents.NEWS.note: TOO_LONG']);
    expect(NOTE_MAX_CHARS).toBe(240);
  });

  it('reports an unknown domain once, and does not read it as out of order', () => {
    const raw = file();
    raw['intents']['DIRECTION']['domains'] = ['D3', 'D9'];
    expect(problems(raw)).toEqual(['intents.DIRECTION.domains[1]: NOT_ONE_OF']);
    raw['intents']['DIRECTION']['domains'] = ['D9', 'D1'];
    expect(problems(raw)).toEqual(['intents.DIRECTION.domains[0]: NOT_ONE_OF']);
  });

  it('reports domains that are not a list once, also on an intent that names no knowledge', () => {
    const raw = file();
    raw['intents']['REPORT_2']['domains'] = 'D1';
    expect(problems(raw)).toEqual(['intents.REPORT_2.domains: WRONG_TYPE']);
  });

  it('says why an always set is wrong, in the words of the rule broken', () => {
    const report = file();
    report['intents']['REPORT_2']['always'] = true;
    const risk = file();
    risk['intents']['RISK_SIZING']['always'] = false;
    const message = (raw: unknown) => {
      const parsed = parseMatrix(raw);
      return parsed.ok ? '' : parsed.issues.map((i) => i.message).join('|');
    };
    expect(message(report)).toContain(
      'REPORT_2 carries no readings, so it has no always set'
    );
    expect(message(risk)).toContain(
      'only Report 2 and Out of scope go without the always set'
    );
  });

  it('reports every problem, not only the first', () => {
    const raw = file();
    raw['intents']['DIRECTION']['extra'] = 'X';
    raw['intents']['NEWS']['playbooks'] = 'Y';
    raw['version'] = '';
    expect(problems(raw).length).toBeGreaterThanOrEqual(3);
  });
});

describe('the committed file stops the module when it is wrong', () => {
  const load = (doctored: unknown): void => {
    jest.isolateModules(() => {
      jest.doMock('@/config/intake/dispatch-matrix.v1.json', () => doctored);
      require('@/lib/intake/matrix');
    });
  };

  it('loads the committed file without a word', () => {
    expect(() => load(clone(matrixFile))).not.toThrow();
  });

  it('refuses a file that does not parse, and names its first five problems with their paths', () => {
    const raw = clone(matrixFile) as Record<string, any>;
    for (const intent of Object.keys(raw['intents']))
      raw['intents'][intent]['extra'] = 'ALL';
    expect(() => load(raw)).toThrow(
      /^config\/intake\/dispatch-matrix\.v1\.json is not a valid matrix \(intents\.DIRECTION\.extra: must be one of [^;]*; intents\.ENTRY_TIMING\.extra: [^;]*; intents\.EXIT_TARGETS\.extra: [^;]*; intents\.RISK_SIZING\.extra: [^;]*; intents\.EXPLAIN\.extra: [^;]*\)$/
    );
  });

  it('names the root as (root) when the file is not an object', () => {
    expect(() => load([])).toThrow(
      'is not a valid matrix ((root): must be an object)'
    );
  });

  it('refuses a file whose version is not the one the code names', () => {
    expect(() => load({ ...clone(matrixFile), version: 'routing-v9' })).toThrow(
      'is version routing-v9; the code names routing-v1'
    );
  });
});
