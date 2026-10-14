/**
 * @jest-environment node
 */

import { validateAnswer } from '@/lib/reply/contracts/answer';
import { validateReport1 } from '@/lib/reply/contracts/report1';
import { validateReplyResult } from '@/lib/reply/contracts/result';
import {
  validateReplyTrace,
  validateRiskGroup,
} from '@/lib/reply/contracts/trace-fields';

import { damageProblems, isUnder, spotsOf } from '../helpers/damage';
import type { Checked } from '../helpers/damage';
import {
  ANSWER,
  STORED_REPORTS,
  actionResult,
  answerResult,
  contextFor,
  fixedResult,
  makeTrace,
  reportResult,
  riskGroup,
  withPath,
} from '../helpers/fixtures';

describe('every place of a valid value is reported where it is', () => {
  it.each([
    ['a Report 1 result', reportResult()],
    ['an Answer result', answerResult()],
    ['a Fixed answer result', fixedResult()],
    ['an Action result', actionResult()],
  ] as const)('%s', (_name, example) => {
    // `kind` decides which other keys the result must have, so its damage is reported there too
    expect(
      damageProblems(example, validateReplyResult, { skip: ['kind'] })
    ).toEqual([]);
  });

  it('a trace', () => {
    expect(
      damageProblems(makeTrace(), validateReplyTrace, {
        // the number of regenerations is the number of calls after the first: a rule across both
        related: ['checks.regenerations'],
        // the status of a sensor is a map: a sensor that is not in the roster has no entry
        optional: /^data.sensor_statuses./,
      })
    ).toEqual([]);
  });
});

/** The examples above leave the optional parts empty; these fill them, so those are walked too. */
const FULL_REPORT = (() => {
  let result = withPath(reportResult(), 'report.news', {
    status: 'OK',
    calendar_age_seconds: 300,
    items: [
      {
        event_id: 'ff-2026-09-18-cpi',
        name: 'US CPI y/y',
        time: '2026-09-18T12:30:00Z',
        currency: 'USD',
        importance: 'High',
        approximate: false,
        tier1: true,
      },
    ],
  });
  result = withPath(result, 'changes', [
    { mcd_id: 'MCD1', from: 'MCD1_UP_IN_CORRIDOR', to: 'MCD1_DOWN' },
    { mcd_id: 'MCD2', from: null, to: null },
  ]);
  result = withPath(result, 'stamp.flags', ['SENSORS_NOT_LIVE']);
  return withPath(result, 'report.levels[1].timeframe', null);
})();

const ANSWER_WITH_ACTION = withPath(
  answerResult(),
  'action',
  actionResult().action
);

const FULL_TRACE = (() => {
  let trace = withPath(makeTrace(), 'knowledge.missed', {
    intent: 'EXPLAIN',
    m_star: ['MCD1'],
    reply_locale: 'de',
    chunk_count: 0,
    packet_sha256: 'e'.repeat(64),
  });
  trace = withPath(trace, 'risk', {
    ...riskGroup(),
    overrides: ['DEFECT_FLAG'],
  });
  return withPath(trace, 'checks.fixed_reason', 'WORDING_FAILED');
})();

describe('the parts the examples leave empty are reported where they are, too', () => {
  it('a Report 1 result with a news event, changes, a flag and a context level', () => {
    expect(
      damageProblems(FULL_REPORT, validateReplyResult, { skip: ['kind'] })
    ).toEqual([]);
  });

  it('an Answer result that opens the Trade Setup', () => {
    expect(
      damageProblems(ANSWER_WITH_ACTION, validateReplyResult, {
        skip: ['kind'],
      })
    ).toEqual([]);
  });

  it('a trace with a missed-knowledge record, a risk group and a fixed reason', () => {
    expect(
      damageProblems(FULL_TRACE, validateReplyTrace, {
        related: ['checks.regenerations'],
        optional: /^data.sensor_statuses./,
      })
    ).toEqual([]);
  });

  it('a risk group on its own', () => {
    expect(
      damageProblems(
        { ...riskGroup(), overrides: ['DEFECT_FLAG'] },
        validateRiskGroup
      )
    ).toEqual([]);
  });
});

describe('every place of a model output is reported where it is', () => {
  it.each(STORED_REPORTS)('Report 1: %s', (name, report) => {
    expect(
      damageProblems(report, (value) =>
        validateReport1(value, contextFor(name))
      )
    ).toEqual([]);
  });

  it('Answer', () => {
    expect(damageProblems(ANSWER, (value) => validateAnswer(value))).toEqual(
      []
    );
  });
});

describe('the damage walk', () => {
  type Flaw = 'typo' | 'lenient' | 'elsewhere' | 'wrong-code' | 'refuses-all';
  const example = { name: 'x', inner: { n: 1, list: [{ k: 'a' }] } };

  /** A small validator by hand, with one flaw at a time put in. */
  const validator =
    (flaw?: Flaw) =>
    (value: unknown): Checked => {
      const issues: { path: string; code: string }[] = [];
      const add = (path: string, code: string): void => {
        issues.push({ path, code });
      };
      const isObject = (v: unknown): v is Record<string, unknown> =>
        typeof v === 'object' && v !== null && !Array.isArray(v);
      /** a required key of an object: where it is missing, and the type check of what is there */
      const need = (
        record: Record<string, unknown>,
        key: string,
        path: string,
        isRight: (v: unknown) => boolean
      ): void => {
        if (!(key in record))
          add(path, flaw === 'wrong-code' ? 'GONE' : 'REQUIRED');
        else if (!isRight(record[key])) add(path, 'WRONG_TYPE');
      };
      if (!isObject(value)) {
        add('', 'WRONG_TYPE');
      } else {
        for (const key of Object.keys(value)) {
          if (!['name', 'inner'].includes(key)) add(key, 'UNKNOWN_KEY');
        }
        need(value, 'name', flaw === 'typo' ? 'nme' : 'name', (v) => {
          const right = typeof v === 'string';
          if (!right && flaw === 'elsewhere') add('inner', 'WRONG_TYPE');
          return right;
        });
        if (!('inner' in value)) add('inner', 'REQUIRED');
        else if (!isObject(value['inner'])) {
          if (flaw !== 'lenient') add('inner', 'WRONG_TYPE');
        } else {
          const inner = value['inner'];
          need(inner, 'n', 'inner.n', (v) => typeof v === 'number');
          need(inner, 'list', 'inner.list', Array.isArray);
          if (Array.isArray(inner['list'])) {
            inner['list'].forEach((item, i) => {
              if (!isObject(item)) add(`inner.list[${i}]`, 'WRONG_TYPE');
              else
                need(
                  item,
                  'k',
                  `inner.list[${i}].k`,
                  (v) => typeof v === 'string'
                );
            });
          }
        }
      }
      if (flaw === 'refuses-all') add('', 'NO');
      return { ok: issues.length === 0, issues };
    };

  it('lists every key and array item with its path', () => {
    expect(spotsOf(example)).toEqual([
      { path: 'name', container: false, keyed: true },
      { path: 'inner', container: true, keyed: true },
      { path: 'inner.n', container: false, keyed: true },
      { path: 'inner.list', container: true, keyed: true },
      { path: 'inner.list[0]', container: true, keyed: false },
      { path: 'inner.list[0].k', container: false, keyed: true },
    ]);
    expect(spotsOf('leaf')).toEqual([]);
    expect(spotsOf([])).toEqual([]);
  });

  it('knows what is at a place and what is inside it', () => {
    expect(isUnder('a.b', 'a.b')).toBe(true);
    expect(isUnder('a.b.c', 'a.b')).toBe(true);
    expect(isUnder('a.b[0]', 'a.b')).toBe(true);
    expect(isUnder('a.bc', 'a.b')).toBe(false);
    expect(isUnder('a', 'a.b')).toBe(false);
    expect(isUnder('', 'a')).toBe(false);
  });

  it('finds nothing wrong with a validator that names every place right', () => {
    expect(damageProblems(example, validator())).toEqual([]);
  });

  it('finds a path that is misnamed', () => {
    const problems = damageProblems(example, validator('typo'));
    expect(problems).toContain(
      'name as an object: issues elsewhere: nme:WRONG_TYPE'
    );
  });

  it('finds a container that accepts a string', () => {
    expect(damageProblems(example, validator('lenient'))).toContain(
      'inner as a string: accepted'
    );
  });

  it('finds an issue reported outside the damaged place', () => {
    expect(damageProblems(example, validator('elsewhere'))).toContain(
      'name as an object: issues elsewhere: inner:WRONG_TYPE'
    );
  });

  it('finds a missing key that is not reported as REQUIRED', () => {
    expect(damageProblems(example, validator('wrong-code'))).toContain(
      'name as no key: no name:REQUIRED in name:GONE'
    );
  });

  it('will not walk an example the validator already refuses', () => {
    const problems = damageProblems(example, validator('refuses-all'));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^the example itself is refused: :NO$/);
  });

  it('leaves out the places it is told to skip, tolerates related places and optional keys', () => {
    expect(
      damageProblems(example, validator('elsewhere'), { related: ['inner'] })
    ).toEqual([]);
    expect(
      damageProblems(example, validator('typo'), { skip: ['name'] })
    ).toEqual([]);
    // a validator that lets a key go missing: a problem, unless the key may be absent
    const loose = (value: unknown): Checked => {
      const r = validator()(value);
      const issues = (r.issues ?? []).filter((i) => i.code !== 'REQUIRED');
      return { ok: issues.length === 0, issues };
    };
    expect(damageProblems(example, loose)).toContain(
      'name as no key: accepted'
    );
    expect(
      damageProblems(example, loose, { optional: /^name$/ })
    ).not.toContain('name as no key: accepted');
  });
});
