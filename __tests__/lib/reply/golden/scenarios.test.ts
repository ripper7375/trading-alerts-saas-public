/**
 * @jest-environment node
 */

/**
 * The golden scenarios of the reply path as DATA (build step 7 part 10; architecture 7.6 and 7.7,
 * ADR-078 and ADR-079; plan finding S7-F17): what the file holds, that its validator refuses what it
 * should, and that the scenario table IS the ten rows of 7.6.
 *
 * What the scenarios do when they are run through the orchestrator is `eval-gate.test.ts` and
 * `golden/acceptance-5-14.test.ts`; what a person signs is `golden-tool.test.ts`.
 */

import { readFileSync } from 'fs';
import { join, resolve } from 'path';

import {
  DEGRADED_ROWS,
  SCENARIO_SET,
  cellsOf,
  isScored,
  localesOf,
  scenarioById,
  scenarioSetProblems,
  scenarioSetSha256,
} from '@/lib/reply/eval/scenarios';
import type { Scenario } from '@/lib/reply/eval/scenarios';
import { EVAL_LOCALES } from '@/lib/reply/eval/languages';

const tool = require('../../../../scripts/reply/golden-tool.js') as {
  DEGRADED_ROWS: [number, string, string][];
  structureProblems: (file: unknown) => string[];
};

const ROOT = resolve(__dirname, '..', '..', '..', '..');
const file = (): Record<string, unknown> =>
  JSON.parse(
    readFileSync(join(ROOT, 'config/reply/golden/scenarios.v1.json'), 'utf8')
  ) as Record<string, unknown>;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe('the shipped scenario set', () => {
  it("is valid for the TypeScript validator and for the tool's", () => {
    expect(scenarioSetProblems(file())).toEqual([]);
    expect(tool.structureProblems(file())).toEqual([]);
  });

  it('has about 24 scenarios or more, each with a unique id', () => {
    expect(SCENARIO_SET.scenarios.length).toBeGreaterThanOrEqual(24);
    expect(new Set(SCENARIO_SET.scenarios.map((s) => s.id)).size).toBe(
      SCENARIO_SET.scenarios.length
    );
  });

  it('holds the 16 stored golden cycles, each for BOTH trader types, FRESH, in all 19 locales', () => {
    const cycles = SCENARIO_SET.scenarios.filter((s) => s.family === 'CYCLE');
    expect(cycles.map((s) => s.cycle)).toEqual(
      Array.from({ length: 16 }, (_, i) => String(i + 1).padStart(2, '0'))
    );
    for (const scenario of cycles) {
      expect([...scenario.traders].sort()).toEqual(['DAY_TRADER', 'SCALPER']);
      expect(scenario.locales).toBe('ALL');
      expect(scenario.overlay).toEqual({ status: 'FRESH', retuning: false });
      expect(scenario.source).toBe('MODEL');
      expect(scenario.expect.outcome).toBe('REPORT1');
      expect(scenario.expect.direction).toBe('SYN');
    }
  });

  it('covers every data status of 5.3 and the retuning flag', () => {
    const statuses = new Set(
      SCENARIO_SET.scenarios.map((s) => s.overlay.status)
    );
    expect([...statuses].sort()).toEqual([
      'DELAYED',
      'FRESH',
      'MARKET_CLOSED',
      'STALE',
    ]);
    expect(SCENARIO_SET.scenarios.some((s) => s.overlay.retuning)).toBe(true);
  });

  it('has the four planted failures, the listed phrase in all 19 locales', () => {
    const planted = SCENARIO_SET.scenarios.filter(
      (s) => s.family === 'PLANTED'
    );
    expect(planted.map((s) => s.condition).sort()).toEqual([
      'PLANT_BAD_JSON',
      'PLANT_BAD_ZONE',
      'PLANT_BANNED_PHRASE',
      'PLANT_WRONG_PRICE',
    ]);
    const phrase = planted.find((s) => s.condition === 'PLANT_BANNED_PHRASE')!;
    expect(localesOf(phrase)).toEqual(EVAL_LOCALES);
    expect(planted.every((s) => s.source === 'FIXTURE')).toBe(true);
  });

  it('has the Free tier demo scenario in all 19 locales, written by the model under test', () => {
    const demo = SCENARIO_SET.scenarios.filter((s) => s.family === 'DEMO');
    expect(demo.map((s) => s.id)).toEqual(['M01']);
    expect(demo[0]!.locales).toBe('ALL');
    expect(demo[0]!.source).toBe('MODEL');
    expect(demo[0]!.intent).toBe('INSTANT_M5_INSPECT');
  });
});

describe('the scenario table IS the ten rows of architecture 7.6', () => {
  const doc = readFileSync(
    join(ROOT, 'docs/STACK-D-ARCHITECTURE.md'),
    'utf8'
  ).replace(/\r\n/g, '\n');
  const section = doc.slice(
    doc.indexOf('### 7.6 Degraded modes'),
    doc.indexOf('### 7.7')
  );
  const rows = section
    .split('\n')
    .filter(
      (line) =>
        line.startsWith('| ') &&
        !line.startsWith('| Failure') &&
        !line.startsWith('| ---')
    )
    .map((line) =>
      line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim())
    );

  it('quotes the ten rows of the document, word for word', () => {
    expect(rows).toHaveLength(10);
    expect(DEGRADED_ROWS).toHaveLength(10);
    DEGRADED_ROWS.forEach((row, index) => {
      expect(row.row).toBe(index + 1);
      expect(row.failure).toBe(rows[index]![0]);
      expect(row.response).toBe(rows[index]![1]);
    });
  });

  it('is the same ten rows in the review tool', () => {
    expect(
      tool.DEGRADED_ROWS.map(([row, failure, response]) => ({
        row,
        failure,
        response,
      }))
    ).toEqual(DEGRADED_ROWS);
  });

  it('has at least one scenario for each row, two for row 6 (one model down, both down) and row 1 (direction refused, explain answered)', () => {
    for (const { row } of DEGRADED_ROWS) {
      const held = SCENARIO_SET.scenarios.filter((s) => s.row === row);
      expect(held.length).toBeGreaterThanOrEqual(1);
      expect(held.every((s) => s.family === 'DEGRADED')).toBe(true);
    }
    expect(
      SCENARIO_SET.scenarios
        .filter((s) => s.row === 6)
        .map((s) => s.condition)
        .sort()
    ).toEqual(['BOTH_MODELS_DOWN', 'MODEL_DOWN']);
    expect(SCENARIO_SET.scenarios.filter((s) => s.row === 1)).toHaveLength(2);
    // nothing outside the DEGRADED family claims a row
    expect(
      SCENARIO_SET.scenarios.filter(
        (s) => s.row !== null && s.family !== 'DEGRADED'
      )
    ).toEqual([]);
  });

  it('says what each row does, in the terms of the architecture', () => {
    const expectOf = (id: string) => scenarioById(id)!.expect;
    expect(expectOf('D01')).toMatchObject({
      outcome: 'FIXED_ANSWER',
      fixed_reason: 'DATA_STALE',
      direction: 'NONE',
      model_calls: { min: 0, max: 0 },
    });
    expect(expectOf('D01b')).toMatchObject({ outcome: 'ANSWER' });
    expect(expectOf('D02')).toMatchObject({
      outcome: 'REPORT1',
      direction: 'SYN',
    });
    expect(expectOf('D04')).toMatchObject({ notes: ['CHART_OTHER_CYCLE'] });
    expect(expectOf('D06')).toMatchObject({
      fallback_used: true,
      model_calls: { min: 2, max: 2 },
    });
    expect(expectOf('D06b')).toMatchObject({
      outcome: 'FIXED_ANSWER',
      fixed_reason: 'MODEL_UNAVAILABLE',
    });
    expect(expectOf('D07')).toMatchObject({
      outcome: 'REFUSED',
      refusal: 'QUOTA_INSUFFICIENT',
      model_calls: { min: 0, max: 0 },
    });
    expect(expectOf('D09')).toMatchObject({ news_status: 'LATE' });
    expect(expectOf('D10')).toMatchObject({
      outcome: 'ACTION',
      model_calls: { min: 0, max: 0 },
    });
  });
});

describe('cells', () => {
  it('are a scenario, a trader type, a locale and a pass, in a fixed order', () => {
    const one = cellsOf(SCENARIO_SET.scenarios, 1);
    const two = cellsOf(SCENARIO_SET.scenarios, 2);
    expect(two).toHaveLength(one.length * 2);
    expect(one[0]).toEqual({
      scenario: 'G01',
      trader: 'DAY_TRADER',
      locale: 'en-US',
      pass: 1,
    });
    expect(one[1]!.locale).toBe('en-GB');
    expect(
      new Set(one.map((c) => `${c.scenario}.${c.trader}.${c.locale}.${c.pass}`))
        .size
    ).toBe(one.length);
    expect(one).toHaveLength(680);
  });

  it('count toward a language score only when a model writes a clean reply in all 19 locales', () => {
    const scored = SCENARIO_SET.scenarios.filter(isScored).map((s) => s.id);
    expect(scored).toEqual([
      ...Array.from(
        { length: 16 },
        (_, i) => `G${String(i + 1).padStart(2, '0')}`
      ),
      'O01',
      'M01',
    ]);
    // a staged failure, a request that never reaches a model, a fallback and a regeneration never count
    for (const id of [
      'D01',
      'D06',
      'D06b',
      'D07',
      'D10',
      'P01',
      'P02',
      'P03',
      'P04',
    ]) {
      expect(isScored(scenarioById(id)!)).toBe(false);
    }
    // one locale only: it would lower English's score and nobody else's
    expect(isScored(scenarioById('D02')!)).toBe(false);
  });
});

describe('the validator refuses a damaged file (and so does the review tool)', () => {
  const damage: [string, (f: any) => void][] = [
    [
      'another schema',
      (f) => {
        f.schema = 'golden-reply/2';
      },
    ],
    [
      'a scenario without a field',
      (f) => {
        delete f.scenarios[0].rule;
      },
    ],
    [
      'a field it does not know',
      (f) => {
        f.scenarios[0].extra = 1;
      },
    ],
    [
      'a repeated id',
      (f) => {
        f.scenarios[1].id = f.scenarios[0].id;
      },
    ],
    [
      'a bad id',
      (f) => {
        f.scenarios[0].id = 'X1';
      },
    ],
    [
      'another family',
      (f) => {
        f.scenarios[0].family = 'OTHER';
      },
    ],
    [
      'a cycle that does not exist',
      (f) => {
        f.scenarios[0].cycle = '17';
      },
    ],
    [
      'no trader type',
      (f) => {
        f.scenarios[0].traders = [];
      },
    ],
    [
      'a repeated trader type',
      (f) => {
        f.scenarios[0].traders = ['DAY_TRADER', 'DAY_TRADER'];
      },
    ],
    [
      'an unknown trader type',
      (f) => {
        f.scenarios[0].traders = ['SWING'];
      },
    ],
    [
      'a locale of 19 that is not one',
      (f) => {
        f.scenarios[0].locales = ['xx'];
      },
    ],
    [
      'an empty locale list',
      (f) => {
        f.scenarios[0].locales = [];
      },
    ],
    [
      'an intent the suite does not run',
      (f) => {
        f.scenarios[0].intent = 'RISK_SIZING';
      },
    ],
    [
      'a source that is neither',
      (f) => {
        f.scenarios[0].source = 'HUMAN';
      },
    ],
    [
      'an unknown condition',
      (f) => {
        f.scenarios[0].condition = 'ON_FIRE';
      },
    ],
    [
      'an overlay without a status',
      (f) => {
        f.scenarios[0].overlay = { retuning: false };
      },
    ],
    [
      'a row of 11',
      (f) => {
        f.scenarios[0].row = 11;
      },
    ],
    [
      'an outcome that is not one',
      (f) => {
        f.scenarios[0].expect.outcome = 'MAYBE';
      },
    ],
    [
      'a fixed answer with no reason',
      (f) => {
        f.scenarios[0].expect.outcome = 'FIXED_ANSWER';
      },
    ],
    [
      'a reason on a report',
      (f) => {
        f.scenarios[0].expect.fixed_reason = 'DATA_STALE';
      },
    ],
    [
      'a refusal on a report',
      (f) => {
        f.scenarios[0].expect.refusal = 'X';
      },
    ],
    [
      'more model calls than three',
      (f) => {
        f.scenarios[0].expect.model_calls = { min: 0, max: 4 };
      },
    ],
    [
      'a minimum above the maximum',
      (f) => {
        f.scenarios[0].expect.model_calls = { min: 2, max: 1 };
      },
    ],
    [
      'two regenerations',
      (f) => {
        f.scenarios[0].expect.regenerations = 2;
      },
    ],
    [
      'a negative number flagged',
      (f) => {
        f.scenarios[0].expect.numbers_flagged = -1;
      },
    ],
    [
      'a direction that is neither',
      (f) => {
        f.scenarios[0].expect.direction = 'LONG';
      },
    ],
    [
      'a note the contract does not have',
      (f) => {
        f.scenarios[0].expect.notes = ['CHART_ON_FIRE'];
      },
    ],
    [
      'a repeated note',
      (f) => {
        f.scenarios[0].expect.notes = [
          'CHART_OTHER_CYCLE',
          'CHART_OTHER_CYCLE',
        ];
      },
    ],
    [
      'an events status that does not exist',
      (f) => {
        f.scenarios[0].expect.news_status = 'SLEEPING';
      },
    ],
    [
      'scenarios that are not a list',
      (f) => {
        f.scenarios = {};
      },
    ],
  ];

  it.each(damage)('%s', (_name, change) => {
    const broken = clone(file());
    change(broken);
    expect(scenarioSetProblems(broken).length).toBeGreaterThan(0);
    expect(tool.structureProblems(broken).length).toBeGreaterThan(0);
  });
});

describe('the scenario set hash', () => {
  it('changes with a scenario and with a world, and with nothing else', async () => {
    const worlds = { '01.DAY_TRADER': 'a'.repeat(64) };
    const base = await scenarioSetSha256(SCENARIO_SET, worlds);
    expect(base).toMatch(/^[0-9a-f]{64}$/);
    expect(await scenarioSetSha256(SCENARIO_SET, { ...worlds })).toBe(base);
    const changed = clone(SCENARIO_SET);
    (changed.scenarios[0] as Scenario).title += '!';
    expect(await scenarioSetSha256(changed, worlds)).not.toBe(base);
    expect(
      await scenarioSetSha256(SCENARIO_SET, { '01.DAY_TRADER': 'b'.repeat(64) })
    ).not.toBe(base);
    // the order the worlds are given in does not matter
    expect(await scenarioSetSha256(SCENARIO_SET, { b: '1', a: '2' })).toBe(
      await scenarioSetSha256(SCENARIO_SET, { a: '2', b: '1' })
    );
  });
});
