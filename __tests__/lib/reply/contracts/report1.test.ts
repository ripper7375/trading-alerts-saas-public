/**
 * @jest-environment node
 */

import {
  ENGINE_SOURCES,
  REPORT1_KEYS,
  REPORT1_LIMITS,
  REPORT1_SECTIONS,
  REPORT1_SECTION_IDS,
  report1Texts,
  validateReport1,
} from '@/lib/reply/contracts/report1';
import type { Report1Model } from '@/lib/reply/contracts/report1';

import {
  REPORT_01,
  STORED_REPORTS,
  VALUE_IDS,
  clone,
  contextFor,
  summary,
  withPath,
  without,
} from '../helpers/fixtures';

const check = (value: unknown, context = {}) => validateReport1(value, context);
const codes = (value: unknown, context = {}) => summary(check(value, context));

describe('the three stored reports (the real cycles)', () => {
  it.each(STORED_REPORTS)(
    'cycle %s passes with the context of its own packet',
    (prefix, report) => {
      const result = check(report, contextFor(prefix));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toEqual(report);
    }
  );

  it.each(STORED_REPORTS)(
    'cycle %s passes on shape alone',
    (_prefix, report) => {
      expect(check(report).ok).toBe(true);
    }
  );

  it('refuses a zone the cycle does not have: cycle 02 has none, 01 has Z1 and Z2', () => {
    expect(codes(REPORT_01, contextFor('02'))).toContain('zones[0]:NOT_ONE_OF');
    expect(
      codes(withPath(REPORT_01, 'zones', ['Z3']), contextFor('01'))
    ).toEqual(['zones[0]:NOT_ONE_OF']);
  });
});

describe('the five keys', () => {
  it('are exactly headline, zones, rationale, watch and risks', () => {
    expect([...REPORT1_KEYS]).toEqual([
      'headline',
      'zones',
      'rationale',
      'watch',
      'risks',
    ]);
  });

  it.each(REPORT1_KEYS)('%s is required', (key) => {
    expect(codes(without(REPORT_01, key))).toEqual([`${key}:REQUIRED`]);
  });

  it('refuses a key that is not one of them', () => {
    expect(codes({ ...REPORT_01, summary: 'x' })).toEqual([
      'summary:UNKNOWN_KEY',
    ]);
  });

  it.each([
    'direction',
    'bias',
    'side',
    'signal',
    'recommendation',
    'trend_relation',
    'archetype',
    'rule_id',
    'stand_aside',
  ])('has no direction: %s is refused for what it is', (key) => {
    expect(codes({ ...REPORT_01, [key]: 'LONG' })).toEqual([
      `${key}:FORBIDDEN_KEY`,
    ]);
  });

  it('refuses direction written inside a line too', () => {
    const value = withPath(REPORT_01, 'rationale[0]', {
      text: 'x',
      cites: [],
      bias: 'LONG',
    });
    expect(codes(value)).toEqual(['rationale[0].bias:UNKNOWN_KEY']);
  });

  it.each([null, undefined, [], 'text', 4, true])(
    'refuses %j as a whole report',
    (value) => {
      expect(codes(value)).toEqual([':WRONG_TYPE']);
    }
  );

  it('refuses a wrong type in each field', () => {
    expect(codes({ ...REPORT_01, headline: 4 })).toEqual([
      'headline:WRONG_TYPE',
    ]);
    expect(codes({ ...REPORT_01, zones: 'Z1' })).toEqual(['zones:WRONG_TYPE']);
    expect(codes({ ...REPORT_01, rationale: {} })).toEqual([
      'rationale:WRONG_TYPE',
    ]);
    expect(codes({ ...REPORT_01, watch: null })).toEqual(['watch:WRONG_TYPE']);
    expect(codes({ ...REPORT_01, risks: 'none' })).toEqual([
      'risks:WRONG_TYPE',
    ]);
  });
});

describe('the limits, each at its boundary', () => {
  const line = (n = 1) => ({ text: `line ${'x'.repeat(n)}`, cites: [] });

  it('the headline', () => {
    expect(
      codes({ ...REPORT_01, headline: 'h'.repeat(REPORT1_LIMITS.headline) })
    ).toEqual([]);
    expect(
      codes({ ...REPORT_01, headline: 'h'.repeat(REPORT1_LIMITS.headline + 1) })
    ).toEqual(['headline:TOO_LONG']);
    expect(codes({ ...REPORT_01, headline: '' })).toEqual([
      'headline:TOO_SHORT',
    ]);
  });

  it('the text of a line', () => {
    const at = (n: number) =>
      withPath(REPORT_01, 'rationale[0].text', 'x'.repeat(n));
    expect(codes(at(REPORT1_LIMITS.lineText))).toEqual([]);
    expect(codes(at(REPORT1_LIMITS.lineText + 1))).toEqual([
      'rationale[0].text:TOO_LONG',
    ]);
  });

  it('the number of rationale lines: 1 to 6', () => {
    expect(codes({ ...REPORT_01, rationale: [] })).toEqual([
      'rationale:TOO_SHORT',
    ]);
    expect(codes({ ...REPORT_01, rationale: [line()] })).toEqual([]);
    expect(
      codes({
        ...REPORT_01,
        rationale: Array.from({ length: 6 }, () => line()),
      })
    ).toEqual([]);
    expect(
      codes({
        ...REPORT_01,
        rationale: Array.from({ length: 7 }, () => line()),
      })
    ).toEqual(['rationale:TOO_MANY']);
  });

  it('the number of watch lines: 1 to 4', () => {
    expect(codes({ ...REPORT_01, watch: [] })).toEqual(['watch:TOO_SHORT']);
    expect(
      codes({ ...REPORT_01, watch: Array.from({ length: 4 }, () => line()) })
    ).toEqual([]);
    expect(
      codes({ ...REPORT_01, watch: Array.from({ length: 5 }, () => line()) })
    ).toEqual(['watch:TOO_MANY']);
  });

  it('the number of risk lines: 0 to 5', () => {
    expect(codes({ ...REPORT_01, risks: [] })).toEqual([]);
    expect(
      codes({ ...REPORT_01, risks: Array.from({ length: 5 }, () => line()) })
    ).toEqual([]);
    expect(
      codes({ ...REPORT_01, risks: Array.from({ length: 6 }, () => line()) })
    ).toEqual(['risks:TOO_MANY']);
  });

  it('the zones: none to five, none twice', () => {
    expect(codes({ ...REPORT_01, zones: [] })).toEqual([]);
    expect(
      codes({ ...REPORT_01, zones: ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'] })
    ).toEqual([]);
    expect(
      codes({ ...REPORT_01, zones: ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z1'] })
    ).toEqual(['zones:TOO_MANY']);
    expect(codes({ ...REPORT_01, zones: ['Z1', 'Z1'] })).toEqual([
      'zones[1]:DUPLICATE',
    ]);
  });

  it('all the texts together: 2,400 characters', () => {
    // headline 160 + 1 rationale + 1 watch lines of 240: fill the budget exactly, then one over
    const fill = (extra: number): Report1Model => ({
      headline: 'h'.repeat(160),
      zones: [],
      rationale: Array.from({ length: 6 }, () => ({
        text: 'r'.repeat(240),
        cites: [],
      })),
      watch: [{ text: 'w'.repeat(240), cites: [] }],
      risks: [{ text: 'k'.repeat(240 - extra), cites: [] }],
    });
    // 160 + 6*240 + 240 + 240 = 2080: still under the cap
    expect(codes(fill(0))).toEqual([]);
    const over: Report1Model = {
      headline: 'h'.repeat(160),
      zones: [],
      rationale: Array.from({ length: 6 }, () => ({
        text: 'r'.repeat(240),
        cites: [],
      })),
      watch: Array.from({ length: 4 }, () => ({
        text: 'w'.repeat(240),
        cites: [],
      })),
      risks: Array.from({ length: 5 }, () => ({
        text: 'k'.repeat(240),
        cites: [],
      })),
    };
    // 160 + 15*240 = 3760 > 2400
    expect(codes(over)).toEqual([':TOO_LONG']);
  });

  it('the total is judged exactly at 2,400, not before', () => {
    const make = (lastLength: number): Report1Model => ({
      headline: 'h'.repeat(160),
      zones: [],
      rationale: Array.from({ length: 6 }, () => ({
        text: 'r'.repeat(240),
        cites: [],
      })),
      watch: Array.from({ length: 3 }, () => ({
        text: 'w'.repeat(240),
        cites: [],
      })),
      risks: [{ text: 'k'.repeat(lastLength), cites: [] }],
    });
    // 160 + 9*240 = 2320, so the last line may be 80 characters long
    expect(codes(make(80))).toEqual([]);
    expect(codes(make(81))).toEqual([':TOO_LONG']);
  });
});

describe('the words in a line', () => {
  it('refuses a malformed placeholder', () => {
    expect(
      codes(withPath(REPORT_01, 'rationale[0].text', 'above {MCD2.baseline'))
    ).toEqual(['rationale[0].text:BAD_FORMAT']);
  });

  it('refuses a placeholder the cycle does not have, given a context, and not without one', () => {
    const value = withPath(
      REPORT_01,
      'rationale[0].text',
      'above {MCD2.nothing}'
    );
    expect(codes(value)).toEqual([]);
    expect(codes(value, contextFor('01'))).toEqual([
      'rationale[0].text:NOT_ONE_OF',
    ]);
  });

  it('refuses a placeholder in the headline that the cycle does not have', () => {
    const value = withPath(REPORT_01, 'headline', 'price {PRICE_NOW}');
    expect(codes(value, contextFor('01'))).toEqual(['headline:NOT_ONE_OF']);
  });

  it('refuses a cite outside the packet and a repeated cite', () => {
    expect(
      codes(
        withPath(REPORT_01, 'rationale[0].cites', ['MCD7']),
        contextFor('01')
      )
    ).toEqual(['rationale[0].cites[0]:NOT_ONE_OF']);
    expect(
      codes(withPath(REPORT_01, 'rationale[0].cites', ['MCD2', 'MCD2']))
    ).toEqual(['rationale[0].cites[1]:DUPLICATE']);
    expect(codes(withPath(REPORT_01, 'rationale[0].cites', ['MCD0']))).toEqual([
      'rationale[0].cites[0]:BAD_FORMAT',
    ]);
  });

  it('refuses a raw number with a control character in it', () => {
    expect(
      codes(withPath(REPORT_01, 'watch[0].text', 'line one\nline two'))
    ).toEqual(['watch[0].text:BAD_FORMAT']);
  });

  it('reports every problem at once, with its own path', () => {
    const value = clone(REPORT_01) as unknown as Record<string, unknown>;
    value['headline'] = '';
    value['zones'] = ['Z9'];
    value['bias'] = 'LONG';
    expect(codes(value)).toEqual([
      'bias:FORBIDDEN_KEY',
      'headline:TOO_SHORT',
      'zones[0]:BAD_FORMAT',
    ]);
  });
});

describe('report1Texts', () => {
  it('lists every text with its path, in reading order', () => {
    expect(report1Texts(REPORT_01).map((t) => t.path)).toEqual([
      'headline',
      'rationale[0].text',
      'rationale[1].text',
      'rationale[2].text',
      'watch[0].text',
      'watch[1].text',
      'risks[0].text',
      'risks[1].text',
    ]);
    expect(report1Texts(REPORT_01)[0]?.text).toBe(REPORT_01.headline);
  });
});

describe('the six sections of the report (decision D10)', () => {
  it('are the six of 5.7, numbered in order', () => {
    expect(REPORT1_SECTIONS.map((s) => [s.number, s.id])).toEqual([
      [1, 'SUMMARY'],
      [2, 'ALIGNMENT'],
      [3, 'LEVELS'],
      [4, 'ZONES'],
      [5, 'WHAT_WOULD_CHANGE'],
      [6, 'RISKS_AND_NEWS'],
    ]);
    expect(REPORT1_SECTIONS.map((s) => s.id)).toEqual([...REPORT1_SECTION_IDS]);
  });

  it('are fed by every field of the model, each by exactly one', () => {
    const fed = REPORT1_SECTIONS.flatMap((s) => [...s.model]);
    expect([...fed].sort()).toEqual([...REPORT1_KEYS].sort());
    expect(new Set(fed).size).toBe(fed.length);
  });

  it('use every engine source at least once, and none that does not exist', () => {
    const used = REPORT1_SECTIONS.flatMap((s) => [...s.engine]);
    expect(new Set(used)).toEqual(new Set(ENGINE_SOURCES));
  });

  it('give the levels to the engines alone and the changes to the model alone', () => {
    const section = (id: string) => REPORT1_SECTIONS.find((s) => s.id === id)!;
    expect(section('LEVELS').model).toEqual([]);
    expect(section('WHAT_WOULD_CHANGE').engine).toEqual([]);
    expect(section('SUMMARY').engine).toEqual(['SYN_DIRECTION']);
  });

  it('take no direction field from the model: direction comes from the synthesis alone', () => {
    const modelFields = REPORT1_SECTIONS.flatMap((s) => [...s.model]);
    expect(modelFields).not.toContain('direction');
    expect(REPORT1_SECTIONS.find((s) => s.id === 'SUMMARY')?.engine).toContain(
      'SYN_DIRECTION'
    );
  });
});

describe('the fixture context', () => {
  it('has the value ids the stored reports place', () => {
    for (const [, report] of STORED_REPORTS) {
      for (const { text } of report1Texts(report)) {
        for (const id of text.matchAll(/\{([^{}]+)\}/g)) {
          expect(VALUE_IDS).toContain(id[1]);
        }
      }
    }
  });
});
