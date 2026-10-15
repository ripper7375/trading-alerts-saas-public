/**
 * @jest-environment node
 */

import {
  ACTION_TYPES,
  ARCHETYPES,
  FIXED_REASONS,
  INVALIDATION_BASES,
  LEVEL_KINDS,
  RESULT_KINDS,
  RESULT_LIMITS,
  RESULT_NOTES,
  ZONE_BIASES,
  validateReplyResult,
} from '@/lib/reply/contracts/result';

import {
  actionResult,
  answerResult,
  clone,
  fixedResult,
  reportResult,
  summary,
  withPath,
  without,
} from '../helpers/fixtures';

const codes = (value: unknown) => summary(validateReplyResult(value));
const ch = (code: number): string => String.fromCodePoint(code);

const EXAMPLES = [
  ['REPORT1', reportResult()],
  ['ANSWER', answerResult()],
  ['FIXED_ANSWER', fixedResult()],
  ['ACTION', actionResult()],
] as const;

describe('reply-result/1', () => {
  it.each(EXAMPLES)('accepts a %s result', (_kind, result) => {
    expect(validateReplyResult(result)).toEqual({ ok: true, value: result });
  });

  it('knows exactly four kinds', () => {
    expect([...RESULT_KINDS]).toEqual([
      'REPORT1',
      'ANSWER',
      'FIXED_ANSWER',
      'ACTION',
    ]);
    expect(EXAMPLES.map(([kind]) => kind)).toEqual([...RESULT_KINDS]);
  });

  it.each([null, undefined, [], 'x', 4])(
    'refuses %j as a whole result',
    (value) => {
      expect(codes(value)).toEqual([':WRONG_TYPE']);
    }
  );

  it('refuses a kind it does not know and names it', () => {
    expect(codes({ ...reportResult(), kind: 'REPORT2' })).toEqual(
      expect.arrayContaining(['kind:NOT_ONE_OF'])
    );
    expect(codes(without(reportResult(), 'kind'))).toEqual(
      expect.arrayContaining(['kind:REQUIRED'])
    );
  });

  describe('the fields every kind has', () => {
    const base = [
      'schema',
      'kind',
      'thread_id',
      'reply_locale',
      'intent',
      'stamp',
      'disclaimer_version',
      'provenance',
      'checks',
      'changes',
      'notes',
    ];
    it.each(base)('%s is required', (key) => {
      expect(codes(without(answerResult(), key))).toContain(`${key}:REQUIRED`);
    });

    it('refuses an unknown key at the top and in each nested object', () => {
      const result = reportResult();
      expect(codes({ ...result, extra: 1 })).toEqual(['extra:UNKNOWN_KEY']);
      expect(codes(withPath(result, 'stamp.extra', 1))).toEqual([
        'stamp.extra:UNKNOWN_KEY',
      ]);
      expect(codes(withPath(result, 'provenance.extra', 1))).toEqual([
        'provenance.extra:UNKNOWN_KEY',
      ]);
      expect(codes(withPath(result, 'checks.extra', 1))).toEqual([
        'checks.extra:UNKNOWN_KEY',
      ]);
      expect(codes(withPath(result, 'report.extra', 1))).toEqual([
        'report.extra:UNKNOWN_KEY',
      ]);
      expect(codes(withPath(result, 'report.direction.extra', 1))).toEqual([
        'report.direction.extra:UNKNOWN_KEY',
      ]);
      expect(codes(withPath(result, 'report.zones[0].extra', 1))).toEqual([
        'report.zones[0].extra:UNKNOWN_KEY',
      ]);
    });

    it('requires the schema id', () => {
      expect(codes({ ...answerResult(), schema: 'reply-result/2' })).toEqual([
        'schema:NOT_ONE_OF',
      ]);
    });

    it('requires a real thread id, a locale and an intent', () => {
      expect(codes({ ...answerResult(), thread_id: 'has space' })).toEqual([
        'thread_id:BAD_FORMAT',
      ]);
      expect(codes({ ...answerResult(), reply_locale: 'xx' })).toEqual([
        'reply_locale:NOT_ONE_OF',
      ]);
      expect(codes({ ...answerResult(), intent: 'OUT_OF_SCOPE' })).toEqual([
        'intent:NOT_ONE_OF',
      ]);
    });

    it('refuses a kind-specific key of another kind', () => {
      expect(codes({ ...answerResult(), report: composedOf() })).toEqual([
        'report:UNKNOWN_KEY',
      ]);
      expect(
        codes({ ...reportResult(), answer: { text: 'x', cites: [] } })
      ).toEqual(['answer:UNKNOWN_KEY']);
    });
  });

  describe('the stamp, the provenance and the checks', () => {
    it('takes a null slot (no cycle could be read) and refuses a made-up one', () => {
      expect(codes(withPath(answerResult(), 'stamp.as_of', null))).toEqual([]);
      expect(
        codes(withPath(answerResult(), 'stamp.as_of', '2026-02-30T10:00Z'))
      ).toEqual(['stamp.as_of:BAD_FORMAT']);
      expect(
        codes(withPath(answerResult(), 'stamp.as_of', '2026-09-18T20:56Z'))
      ).toEqual(['stamp.as_of:BAD_FORMAT']);
    });

    it('takes the five data statuses and the two flags only', () => {
      for (const status of [
        'FRESH',
        'DELAYED',
        'STALE',
        'MARKET_CLOSED',
        'UNKNOWN',
      ]) {
        expect(
          codes(withPath(answerResult(), 'stamp.data_status', status))
        ).toEqual([]);
      }
      expect(
        codes(withPath(answerResult(), 'stamp.data_status', 'LATE'))
      ).toEqual(['stamp.data_status:NOT_ONE_OF']);
      expect(
        codes(
          withPath(answerResult(), 'stamp.flags', [
            'SENSORS_NOT_LIVE',
            'GATEWAY_UNREACHABLE',
          ])
        )
      ).toEqual([]);
      expect(
        codes(withPath(answerResult(), 'stamp.flags', ['SOMETHING_ELSE']))
      ).toEqual(['stamp.flags[0]:NOT_ONE_OF']);
      expect(
        codes(
          withPath(answerResult(), 'stamp.flags', [
            'SENSORS_NOT_LIVE',
            'SENSORS_NOT_LIVE',
          ])
        )
      ).toEqual(['stamp.flags[1]:DUPLICATE']);
    });

    it('takes a model slug or null, and versions', () => {
      expect(codes(withPath(answerResult(), 'provenance.model', null))).toEqual(
        []
      );
      expect(
        codes(withPath(answerResult(), 'provenance.model', 'has space'))
      ).toEqual(['provenance.model:BAD_FORMAT']);
      expect(
        codes(
          withPath(answerResult(), 'provenance.prompt_version', 'bad version!')
        )
      ).toEqual(['provenance.prompt_version:BAD_FORMAT']);
      expect(codes(withPath(answerResult(), 'disclaimer_version', ''))).toEqual(
        ['disclaimer_version:TOO_SHORT']
      );
    });

    it('counts flagged numbers up to 200 and at most one regeneration', () => {
      expect(
        codes(
          withPath(
            answerResult(),
            'checks.numbers_flagged',
            RESULT_LIMITS.numbersFlagged
          )
        )
      ).toEqual([]);
      expect(
        codes(
          withPath(
            answerResult(),
            'checks.numbers_flagged',
            RESULT_LIMITS.numbersFlagged + 1
          )
        )
      ).toEqual(['checks.numbers_flagged:OUT_OF_RANGE']);
      expect(
        codes(withPath(answerResult(), 'checks.numbers_flagged', -1))
      ).toEqual(['checks.numbers_flagged:OUT_OF_RANGE']);
      expect(
        codes(withPath(answerResult(), 'checks.regenerations', 1))
      ).toEqual([]);
      expect(
        codes(withPath(answerResult(), 'checks.regenerations', 2))
      ).toEqual(['checks.regenerations:OUT_OF_RANGE']);
      expect(
        codes(withPath(answerResult(), 'checks.numbers_flagged', 1.5))
      ).toEqual(['checks.numbers_flagged:WRONG_TYPE']);
    });

    it('takes changes of state codes, at most 16', () => {
      const change = { mcd_id: 'MCD2', from: 'MCD2_UP_IN_CORRIDOR', to: null };
      expect(codes(withPath(answerResult(), 'changes', [change]))).toEqual([]);
      expect(
        codes(
          withPath(
            answerResult(),
            'changes',
            Array.from({ length: 16 }, () => change)
          )
        )
      ).toEqual([]);
      expect(
        codes(
          withPath(
            answerResult(),
            'changes',
            Array.from({ length: 17 }, () => change)
          )
        )
      ).toEqual(['changes:TOO_MANY']);
      expect(
        codes(
          withPath(answerResult(), 'changes', [{ ...change, mcd_id: 'MCD0' }])
        )
      ).toEqual(['changes[0].mcd_id:BAD_FORMAT']);
      expect(
        codes(
          withPath(answerResult(), 'changes', [{ ...change, from: 'bad code' }])
        )
      ).toEqual(['changes[0].from:BAD_FORMAT']);
    });

    it('takes the notes a reply makes about its inputs: two codes, none twice', () => {
      expect([...RESULT_NOTES]).toEqual([
        'CHART_OTHER_CYCLE',
        'CHART_UNAVAILABLE',
      ]);
      for (const notes of [
        [],
        ['CHART_OTHER_CYCLE'],
        ['CHART_UNAVAILABLE'],
        ['CHART_OTHER_CYCLE', 'CHART_UNAVAILABLE'],
      ]) {
        expect(codes(withPath(answerResult(), 'notes', notes))).toEqual([]);
      }
      expect(
        codes(
          withPath(answerResult(), 'notes', [
            'CHART_UNAVAILABLE',
            'CHART_UNAVAILABLE',
          ])
        )
      ).toEqual(['notes[1]:DUPLICATE']);
      expect(codes(withPath(answerResult(), 'notes', ['BORED']))).toEqual([
        'notes[0]:NOT_ONE_OF',
      ]);
      expect(
        codes(withPath(answerResult(), 'notes', 'CHART_UNAVAILABLE'))
      ).toEqual(['notes:WRONG_TYPE']);
      expect(
        codes(
          withPath(answerResult(), 'notes', [
            'CHART_OTHER_CYCLE',
            'CHART_UNAVAILABLE',
            'CHART_UNAVAILABLE',
          ])
        )
      ).toEqual(['notes:TOO_MANY']);
    });
  });

  describe('REPORT1', () => {
    it('keeps the direction a closed object of the synthesis reading', () => {
      const result = reportResult();
      for (const key of [
        'bias',
        'trend_relation',
        'rule_id',
        'archetype',
        'stand_aside',
        'profile',
      ]) {
        expect(codes(without(result, `report.direction.${key}`))).toEqual([
          `report.direction.${key}:REQUIRED`,
        ]);
      }
      expect(codes(withPath(result, 'report.direction.bias', 'UP'))).toEqual([
        'report.direction.bias:NOT_ONE_OF',
      ]);
      expect(
        codes(withPath(result, 'report.direction.archetype', 'E'))
      ).toEqual(['report.direction.archetype:NOT_ONE_OF']);
      expect(
        codes(withPath(result, 'report.direction.archetype', null))
      ).toEqual([]);
      expect(
        codes(withPath(result, 'report.direction.trend_relation', null))
      ).toEqual([]);
      expect(
        codes(withPath(result, 'report.direction.rule_id', 'R1 bad'))
      ).toEqual(['report.direction.rule_id:BAD_FORMAT']);
      expect(
        codes(withPath(result, 'report.direction.rule_id', 'NO_MATCH'))
      ).toEqual([]);
    });

    it('holds the headline and the lines to their limits', () => {
      const result = reportResult();
      expect(
        codes(
          withPath(
            result,
            'report.headline',
            'h'.repeat(RESULT_LIMITS.headline)
          )
        )
      ).toEqual([]);
      expect(
        codes(
          withPath(
            result,
            'report.headline',
            'h'.repeat(RESULT_LIMITS.headline + 1)
          )
        )
      ).toEqual(['report.headline:TOO_LONG']);
      expect(
        codes(
          withPath(
            result,
            'report.watch[0].text',
            'w'.repeat(RESULT_LIMITS.lineText)
          )
        )
      ).toEqual([]);
      expect(
        codes(
          withPath(
            result,
            'report.watch[0].text',
            'w'.repeat(RESULT_LIMITS.lineText + 1)
          )
        )
      ).toEqual(['report.watch[0].text:TOO_LONG']);
    });

    it('holds the lists to their counts', () => {
      const result = reportResult();
      const line = { text: 'x', cites: [] };
      expect(
        codes(
          withPath(
            result,
            'report.alignment.lines',
            Array.from({ length: 6 }, () => line)
          )
        )
      ).toEqual([]);
      expect(
        codes(
          withPath(
            result,
            'report.alignment.lines',
            Array.from({ length: 7 }, () => line)
          )
        )
      ).toEqual(['report.alignment.lines:TOO_MANY']);
      expect(
        codes(
          withPath(
            result,
            'report.watch',
            Array.from({ length: 9 }, () => line)
          )
        )
      ).toEqual([]);
      expect(
        codes(
          withPath(
            result,
            'report.watch',
            Array.from({ length: 10 }, () => line)
          )
        )
      ).toEqual(['report.watch:TOO_MANY']);
      expect(
        codes(
          withPath(
            result,
            'report.risks',
            Array.from({ length: 6 }, () => line)
          )
        )
      ).toEqual(['report.risks:TOO_MANY']);
      expect(
        codes(
          withPath(
            result,
            'report.levels',
            Array.from({ length: 41 }, () => result.report.levels[0])
          )
        )
      ).toEqual(['report.levels:TOO_MANY']);
      expect(
        codes(
          withPath(
            result,
            'report.alignment.channels',
            Array.from({ length: 5 }, () => result.report.alignment.channels[0])
          )
        )
      ).toEqual(['report.alignment.channels:TOO_MANY']);
    });

    it('lets a resolved line carry bidirectional isolates around a price, and nothing that hides text', () => {
      const result = reportResult();
      const isolated = `above ${ch(0x2066)}4,367.25${ch(0x2069)} now`;
      expect(codes(withPath(result, 'report.watch[0].text', isolated))).toEqual(
        []
      );
      for (const bad of [
        '\n',
        ch(0x202e),
        ch(0xfeff),
        ch(0xe0041),
        ch(0x2028),
        ch(0),
      ]) {
        expect(
          codes(withPath(result, 'report.watch[0].text', `a${bad}b`))
        ).toEqual(['report.watch[0].text:BAD_FORMAT']);
      }
    });

    it('refuses a placeholder that was never filled', () => {
      expect(
        codes(
          withPath(
            reportResult(),
            'report.watch[0].text',
            'below {Z1.invalidation}'
          )
        )
      ).toEqual(['report.watch[0].text:BAD_FORMAT']);
    });

    it('takes zones as the engines stored them: closed, in order, none twice, low not above high', () => {
      const result = reportResult();
      const zone = result.report.zones[0]!;
      for (const key of Object.keys(zone)) {
        expect(codes(without(result, `report.zones[0].${key}`))).toEqual([
          `report.zones[0].${key}:REQUIRED`,
        ]);
      }
      expect(codes(withPath(result, 'report.zones', [zone, zone]))).toEqual([
        'report.zones[1]:DUPLICATE',
      ]);
      expect(codes(withPath(result, 'report.zones[0].low', 4400))).toEqual([
        'report.zones[0].low:INCONSISTENT',
      ]);
      expect(
        codes(withPath(result, 'report.zones[0].bias', 'NEUTRAL'))
      ).toEqual(['report.zones[0].bias:NOT_ONE_OF']);
      expect(
        codes(withPath(result, 'report.zones[0].invalidation_basis', 'GUESS'))
      ).toEqual(['report.zones[0].invalidation_basis:NOT_ONE_OF']);
      expect(codes(withPath(result, 'report.zones[0].runway', null))).toEqual(
        []
      );
      expect(
        codes(withPath(result, 'report.zones[0].next_opposing_price', null))
      ).toEqual([]);
      expect(
        codes(withPath(result, 'report.zones[0].stop_distance', -1))
      ).toEqual(['report.zones[0].stop_distance:OUT_OF_RANGE']);
      expect(codes(withPath(result, 'report.zones[0].zone_id', 'Z6'))).toEqual([
        'report.zones[0].zone_id:BAD_FORMAT',
      ]);
      expect(
        codes(
          withPath(
            result,
            'report.zones',
            Array.from({ length: 6 }, (_, i) => ({
              ...zone,
              zone_id: `Z${(i % 5) + 1}`,
            }))
          )
        )
      ).toContain('report.zones:TOO_MANY');
    });

    it('takes channels and levels as closed objects', () => {
      const result = reportResult();
      expect(
        codes(withPath(result, 'report.alignment.channels[0].timeframe', 'H1'))
      ).toEqual(['report.alignment.channels[0].timeframe:NOT_ONE_OF']);
      expect(
        codes(withPath(result, 'report.alignment.channels[0].status', 'GOOD'))
      ).toEqual(['report.alignment.channels[0].status:NOT_ONE_OF']);
      expect(
        codes(withPath(result, 'report.alignment.channels[0].mcd_id', 'MCD0'))
      ).toEqual(['report.alignment.channels[0].mcd_id:BAD_FORMAT']);
      expect(
        codes(withPath(result, 'report.alignment.channels[0].state_code', null))
      ).toEqual([]);
      expect(codes(withPath(result, 'report.levels[0].kind', 'OTHER'))).toEqual(
        ['report.levels[0].kind:NOT_ONE_OF']
      );
      expect(
        codes(withPath(result, 'report.levels[0].timeframe', null))
      ).toEqual([]);
      expect(
        codes(withPath(result, 'report.levels[0].id', 'lower.case'))
      ).toEqual(['report.levels[0].id:BAD_FORMAT']);
      expect(
        codes(withPath(result, 'report.levels[0].price', '4367.25'))
      ).toEqual(['report.levels[0].price:WRONG_TYPE']);
    });

    it('takes the news block: its status, its age and a closed event', () => {
      const result = reportResult();
      const event = {
        event_id: 'evt-1',
        name: 'US CPI',
        time: '2026-09-18T21:30:00Z',
        currency: 'USD',
        importance: 'HIGH',
        approximate: false,
        tier1: true,
      };
      expect(codes(withPath(result, 'report.news.items', [event]))).toEqual([]);
      expect(
        codes(withPath(result, 'report.news.status', 'UNAVAILABLE'))
      ).toEqual([]);
      expect(codes(withPath(result, 'report.news.status', 'OFFLINE'))).toEqual([
        'report.news.status:NOT_ONE_OF',
      ]);
      expect(
        codes(withPath(result, 'report.news.calendar_age_seconds', null))
      ).toEqual([]);
      expect(
        codes(withPath(result, 'report.news.calendar_age_seconds', -5))
      ).toEqual(['report.news.calendar_age_seconds:OUT_OF_RANGE']);
      expect(
        codes(
          withPath(result, 'report.news.items', [
            { ...event, time: 'tomorrow' },
          ])
        )
      ).toEqual(['report.news.items[0].time:BAD_FORMAT']);
      expect(
        codes(withPath(result, 'report.news.items', [{ ...event, extra: 1 }]))
      ).toEqual(['report.news.items[0].extra:UNKNOWN_KEY']);
      expect(
        codes(
          withPath(
            result,
            'report.news.items',
            Array.from({ length: 51 }, () => event)
          )
        )
      ).toEqual(['report.news.items:TOO_MANY']);
    });
  });

  describe('ANSWER', () => {
    it('takes text up to its limit and an action or none', () => {
      expect(
        codes(
          withPath(
            answerResult(),
            'answer.text',
            'x'.repeat(RESULT_LIMITS.answerText)
          )
        )
      ).toEqual([]);
      expect(
        codes(
          withPath(
            answerResult(),
            'answer.text',
            'x'.repeat(RESULT_LIMITS.answerText + 1)
          )
        )
      ).toEqual(['answer.text:TOO_LONG']);
      expect(
        codes(withPath(answerResult(), 'action', actionResult().action))
      ).toEqual([]);
      expect(codes(without(answerResult(), 'action'))).toEqual(
        expect.arrayContaining(['action:REQUIRED'])
      );
    });
  });

  describe('FIXED_ANSWER', () => {
    it('knows its seven reasons', () => {
      expect([...FIXED_REASONS]).toEqual([
        'DATA_STALE',
        'WORDING_FAILED',
        'SCHEMA_FAILED',
        'MODEL_UNAVAILABLE',
        'DEADLINE',
        'MARKET_CLOSED',
        'NO_SYNTHESIS',
      ]);
      expect(codes(withPath(fixedResult(), 'fixed.reason', 'BORED'))).toEqual([
        'fixed.reason:NOT_ONE_OF',
      ]);
    });

    it('has no direction when the data stopped, and may have none otherwise', () => {
      const stale = withPath(fixedResult(), 'fixed.reason', 'DATA_STALE');
      expect(codes(stale)).toEqual(['fixed.direction:INCONSISTENT']);
      expect(codes(withPath(stale, 'fixed.direction', null))).toEqual([]);
      expect(codes(withPath(fixedResult(), 'fixed.direction', null))).toEqual(
        []
      );
    });

    it('has no direction when there is no synthesis reading either, and keeps one for a closed market', () => {
      const none = withPath(fixedResult(), 'fixed.reason', 'NO_SYNTHESIS');
      expect(codes(none)).toEqual(['fixed.direction:INCONSISTENT']);
      expect(codes(withPath(none, 'fixed.direction', null))).toEqual([]);
      // the last session's picture is a direction: the stamp says it is last session's
      expect(
        codes(withPath(fixedResult(), 'fixed.reason', 'MARKET_CLOSED'))
      ).toEqual([]);
    });

    it('carries the board as ids, statuses and state codes alone', () => {
      expect(
        codes(withPath(fixedResult(), 'fixed.board[0].summary', 'free text'))
      ).toEqual(['fixed.board[0].summary:UNKNOWN_KEY']);
      expect(
        codes(withPath(fixedResult(), 'fixed.board[0].status', 'GOOD'))
      ).toEqual(['fixed.board[0].status:NOT_ONE_OF']);
      expect(
        codes(
          withPath(
            fixedResult(),
            'fixed.board',
            Array.from({ length: 17 }, () => fixedResult().fixed.board[0])
          )
        )
      ).toEqual(['fixed.board:TOO_MANY']);
    });
  });

  describe('ACTION', () => {
    it('opens the trade setup for a cycle, a trader type and zones', () => {
      expect(
        codes(withPath(actionResult(), 'action.type', 'PLACE_ORDER'))
      ).toEqual(['action.type:NOT_ONE_OF']);
      expect(
        codes(withPath(actionResult(), 'action.cycle_slot', 'now'))
      ).toEqual(['action.cycle_slot:BAD_FORMAT']);
      expect(
        codes(withPath(actionResult(), 'action.trader_type', 'INVESTOR'))
      ).toEqual(['action.trader_type:NOT_ONE_OF']);
      expect(
        codes(withPath(actionResult(), 'action.zone_ids', ['Z1', 'Z1']))
      ).toEqual(['action.zone_ids[1]:DUPLICATE']);
      expect(
        codes(withPath(actionResult(), 'action.zone_ids', ['Z7']))
      ).toEqual(['action.zone_ids[0]:BAD_FORMAT']);
      expect(codes(withPath(actionResult(), 'action.zone_ids', []))).toEqual(
        []
      );
    });

    it('needs its action (not null)', () => {
      expect(codes(withPath(actionResult(), 'action', null))).toEqual([
        'action:WRONG_TYPE',
      ]);
    });
  });

  it('does not change what it is given', () => {
    const result = reportResult();
    const before = JSON.stringify(result);
    validateReplyResult(result);
    validateReplyResult(withPath(result, 'report.headline', ''));
    expect(JSON.stringify(result)).toBe(before);
    expect(clone(result)).toEqual(result);
  });
});

function composedOf() {
  return clone(reportResult().report);
}

describe('the limits and the fixed lists are what the contract says', () => {
  it('pins the bounds on what the server composes', () => {
    expect(RESULT_LIMITS).toEqual({
      lineText: 480,
      headline: 400,
      alignmentLines: 6,
      watchLines: 9,
      riskLines: 5,
      levels: 40,
      boardLines: 16,
      channels: 4,
      changes: 16,
      answerText: 1200,
      numbersFlagged: 200,
      eventName: 160,
    });
  });

  it('pins the lists a result chooses from', () => {
    expect([...ARCHETYPES]).toEqual(['A', 'B', 'C', 'D']);
    expect([...ZONE_BIASES]).toEqual(['LONG', 'SHORT']);
    expect([...INVALIDATION_BASES]).toEqual([
      'LEVEL',
      'MINIMUM_STOP',
      'NO_LEVEL',
    ]);
    expect([...LEVEL_KINDS]).toEqual(['CHANNEL', 'CONTEXT']);
    expect([...ACTION_TYPES]).toEqual(['OPEN_TRADE_SETUP']);
  });

  it.each([...ARCHETYPES])('takes archetype %s in the direction line', (a) => {
    expect(
      codes(withPath(reportResult(), 'report.direction.archetype', a))
    ).toEqual([]);
  });
});

describe('how many items a list may hold', () => {
  const line = (n: number) => ({ text: `line ${n}`, cites: [] });
  const level = (n: number) => ({
    id: `MCD2.level${n}`,
    kind: 'CHANNEL',
    timeframe: 'M5',
    name: `level${n}`,
    price: 4000 + n,
  });
  const channel = (n: number) => ({
    mcd_id: `MCD${n + 1}`,
    timeframe: 'M5',
    status: 'CAUTIONARY',
    state_code: null,
    bias: null,
  });
  const change = (n: number) => ({
    mcd_id: `MCD${(n % 15) + 1}`,
    from: null,
    to: null,
  });
  const board = (n: number) => ({
    mcd_id: `MCD${(n % 15) + 1}`,
    status: 'ABSENT',
    state_code: null,
  });
  const many = (count: number, make: (n: number) => unknown) =>
    Array.from({ length: count }, (_, n) => make(n));

  it.each([
    ['report.watch', RESULT_LIMITS.watchLines, line, reportResult],
    ['report.risks', RESULT_LIMITS.riskLines, line, reportResult],
    [
      'report.alignment.lines',
      RESULT_LIMITS.alignmentLines,
      line,
      reportResult,
    ],
    ['report.levels', RESULT_LIMITS.levels, level, reportResult],
    [
      'report.alignment.channels',
      RESULT_LIMITS.channels,
      channel,
      reportResult,
    ],
    ['changes', RESULT_LIMITS.changes, change, reportResult],
    ['fixed.board', RESULT_LIMITS.boardLines, board, fixedResult],
    ['fixed.levels', RESULT_LIMITS.levels, level, fixedResult],
  ] as const)('%s: up to %d, no more', (path, limit, make, base) => {
    expect(codes(withPath(base(), path, many(limit, make)))).toEqual([]);
    expect(codes(withPath(base(), path, many(limit + 1, make)))).toEqual([
      `${path}:TOO_MANY`,
    ]);
    expect(codes(withPath(base(), path, []))).toEqual([]);
  });

  it('holds at most 15 source sensors in a zone, and at most 4 cites in a line or an answer', () => {
    const sensors = (n: number) =>
      Array.from({ length: n }, (_, i) => `MCD${(i % 15) + 1}`);
    const zonePath = 'report.zones[0].source_sensors';
    expect(codes(withPath(reportResult(), zonePath, sensors(15)))).toEqual([]);
    expect(codes(withPath(reportResult(), zonePath, sensors(16)))).toEqual([
      `${zonePath}:TOO_MANY`,
    ]);
    const cites = ['MCD1', 'MCD2', 'MCD3', 'MCD4', 'MCD5'];
    const linePath = 'report.watch[0].cites';
    expect(
      codes(withPath(reportResult(), linePath, cites.slice(0, 4)))
    ).toEqual([]);
    expect(codes(withPath(reportResult(), linePath, cites))).toEqual([
      `${linePath}:TOO_MANY`,
    ]);
    expect(
      codes(withPath(answerResult(), 'answer.cites', cites.slice(0, 4)))
    ).toEqual([]);
    expect(codes(withPath(answerResult(), 'answer.cites', cites))).toEqual([
      'answer.cites:TOO_MANY',
    ]);
  });
});

describe('the numbers of a zone and a level', () => {
  const zone = (patch: Record<string, unknown>) =>
    codes(
      withPath(reportResult(), 'report.zones[0]', {
        ...reportResult().report.zones[0],
        ...patch,
      })
    );

  it('a band may be one price wide, never upside down', () => {
    expect(zone({ low: 4366, high: 4366 })).toEqual([]);
    expect(zone({ low: 4366.01, high: 4366 })).toEqual([
      'report.zones[0].low:INCONSISTENT',
    ]);
  });

  it('a price is zero or more', () => {
    expect(zone({ low: 0, high: 5 })).toEqual([]);
    expect(zone({ stop_distance: 0 })).toEqual([]);
    expect(zone({ stop_distance: -0.01 })).toEqual([
      'report.zones[0].stop_distance:OUT_OF_RANGE',
    ]);
    expect(
      codes(withPath(reportResult(), 'report.levels[0].price', 0))
    ).toEqual([]);
    expect(
      codes(withPath(reportResult(), 'report.levels[0].price', -1))
    ).toEqual(['report.levels[0].price:OUT_OF_RANGE']);
  });

  it('a zone has 0 to 64 confluences', () => {
    expect(zone({ confluence_count: 0 })).toEqual([]);
    expect(zone({ confluence_count: 64 })).toEqual([]);
    expect(zone({ confluence_count: 65 })).toEqual([
      'report.zones[0].confluence_count:OUT_OF_RANGE',
    ]);
  });

  it('a state code is at most 48 characters', () => {
    const code = (n: number) => `MCD1_${'A'.repeat(n - 5)}`;
    const path = 'report.alignment.channels[0].state_code';
    expect(codes(withPath(reportResult(), path, code(48)))).toEqual([]);
    expect(codes(withPath(reportResult(), path, code(49)))).toEqual([
      `${path}:TOO_LONG`,
    ]);
  });

  it('a level name is 1 to 40 letters, digits and underscores', () => {
    const name = (value: string) =>
      codes(withPath(reportResult(), 'report.levels[0].name', value));
    expect(name('a')).toEqual([]);
    expect(name('A_9'.repeat(13) + 'x')).toEqual([]);
    expect(name('x'.repeat(40))).toEqual([]);
    expect(name('x'.repeat(41))).toEqual(['report.levels[0].name:BAD_FORMAT']);
    for (const bad of ['a b', 'a-b', 'a.b', 'é', 'a\n']) {
      expect(name(bad)).toEqual(['report.levels[0].name:BAD_FORMAT']);
    }
    expect(name('')).toEqual(['report.levels[0].name:TOO_SHORT']);
  });
});

describe('a text the server made', () => {
  const headline = (value: string) =>
    codes(withPath(reportResult(), 'report.headline', value));

  it('is not blank', () => {
    expect(headline('   ')).toEqual(['report.headline:TOO_SHORT']);
    expect(headline('\t')).toEqual(['report.headline:TOO_SHORT']);
    expect(headline(' x ')).toEqual([]);
  });

  it.each([
    ['a control character', true, ch(0x0)],
    ['a line break', true, '\n'],
    ['DEL', true, ch(0x7f)],
    ['a C1 control', true, ch(0x85)],
    ['a line separator', true, ch(0x2028)],
    ['a paragraph separator', true, ch(0x2029)],
    ['a left-to-right embedding', true, ch(0x202a)],
    ['a right-to-left override', true, ch(0x202e)],
    ['a byte order mark', true, ch(0xfeff)],
    ['the first tag character', true, ch(0xe0000)],
    ['the last tag character', true, ch(0xe007f)],
    ['an open brace', true, '{'],
    ['a close brace', true, '}'],
    ['a hyphenation point', false, ch(0x2027)],
    ['a narrow no-break space', false, ch(0x202f)],
    ['a per mille sign', false, ch(0x2030)],
    ['the code point after the tag block', false, ch(0xe0080)],
    ['the code point before the tag block', false, ch(0xdffff)],
    ['an emoji', false, ch(0x1f4c8)],
    ['a Thai letter', false, ch(0x0e01)],
  ])('%s (refused: %s)', (_name, refused, char) => {
    expect(headline(`up ${char} down`)).toEqual(
      refused ? ['report.headline:BAD_FORMAT'] : []
    );
  });
});

describe('a news event', () => {
  const EVENT = {
    event_id: 'ff-2026-09-18-cpi',
    name: 'US CPI y/y',
    time: '2026-09-18T12:30:00Z',
    currency: 'USD',
    importance: 'High',
    approximate: false,
    tier1: true,
  };
  const item = (patch: Record<string, unknown>) =>
    codes(
      withPath(reportResult(), 'report.news', {
        status: 'OK',
        calendar_age_seconds: 300,
        items: [{ ...EVENT, ...patch }],
      })
    );
  const bad = (key: string) => [`report.news.items[0].${key}:BAD_FORMAT`];

  it('is accepted whole', () => {
    expect(item({})).toEqual([]);
  });

  it('has an id of 1 to 80 characters that starts with a letter or a digit', () => {
    expect(item({ event_id: 'a' })).toEqual([]);
    expect(item({ event_id: `a${'b._:-'.repeat(15)}z`.slice(0, 80) })).toEqual(
      []
    );
    expect(item({ event_id: 'a'.repeat(80) })).toEqual([]);
    for (const value of ['a'.repeat(81), '.a', '-a', 'a b', 'a\n', ' a']) {
      expect(item({ event_id: value })).toEqual(bad('event_id'));
    }
    expect(item({ event_id: '' })).toEqual([
      'report.news.items[0].event_id:TOO_SHORT',
    ]);
  });

  it('has a UTC time to the second, and nothing around it', () => {
    for (const value of [
      '2026-09-18T12:30Z',
      '2026-09-18T12:30:00',
      '2026-09-18 12:30:00Z',
      'x2026-09-18T12:30:00Z',
      '2026-09-18T12:30:00Zx',
      '2026-09-18T12:30:00Z\n',
      '2026-09-18T12:30:00.5Z',
    ]) {
      expect(item({ time: value })).toEqual(bad('time'));
    }
  });

  it('has a currency of 2 to 5 capital letters', () => {
    for (const value of ['EU', 'USD', 'XAUUS', 'ABCDE']) {
      expect(item({ currency: value })).toEqual([]);
    }
    for (const value of [
      'U',
      'ABCDEF',
      'usd',
      'US1',
      'USD\n',
      ' USD',
      'xUSD',
    ]) {
      expect(item({ currency: value })).toEqual(bad('currency'));
    }
  });

  it('has an importance of 1 to 20 letters and underscores', () => {
    for (const value of ['H', 'High', 'NON_ECONOMIC', 'a'.repeat(20)]) {
      expect(item({ importance: value })).toEqual([]);
    }
    for (const value of [
      'a'.repeat(21),
      'High!',
      'a b',
      '1',
      'High\n',
      ' High',
    ]) {
      expect(item({ importance: value })).toEqual(bad('importance'));
    }
    expect(item({ importance: '' })).toEqual([
      'report.news.items[0].importance:TOO_SHORT',
    ]);
  });

  it('has a name of at most 160 characters, and flags that are true or false', () => {
    expect(item({ name: 'n'.repeat(RESULT_LIMITS.eventName) })).toEqual([]);
    expect(item({ name: 'n'.repeat(RESULT_LIMITS.eventName + 1) })).toEqual([
      'report.news.items[0].name:TOO_LONG',
    ]);
    expect(item({ approximate: 'no' })).toEqual([
      'report.news.items[0].approximate:WRONG_TYPE',
    ]);
    expect(item({ tier1: 1 })).toEqual([
      'report.news.items[0].tier1:WRONG_TYPE',
    ]);
  });
});

describe('zones that cannot be told apart by an id they do not have', () => {
  const zones = () => reportResult().report.zones;

  it('two zones without a usable id are not "the same id twice"', () => {
    const first = { ...zones()[0], zone_id: 7 };
    const second = { ...zones()[0], zone_id: 7 };
    expect(
      codes(withPath(reportResult(), 'report.zones', [first, second]))
    ).toEqual([
      'report.zones[0].zone_id:WRONG_TYPE',
      'report.zones[1].zone_id:WRONG_TYPE',
    ]);
    const gone = without(zones()[0], 'zone_id');
    expect(
      codes(withPath(reportResult(), 'report.zones', [gone, gone]))
    ).toEqual([
      'report.zones[0].zone_id:REQUIRED',
      'report.zones[1].zone_id:REQUIRED',
    ]);
  });

  it('two zones with the same good id are, and are reported at the second', () => {
    expect(
      codes(withPath(reportResult(), 'report.zones', [zones()[0], zones()[0]]))
    ).toEqual(['report.zones[1]:DUPLICATE']);
  });
});

describe('what the stamp says about a flag it does not know', () => {
  it('names the flags it does know', () => {
    const checked = validateReplyResult(
      withPath(answerResult(), 'stamp.flags', ['SOMETHING_ELSE'])
    );
    expect(checked.ok).toBe(false);
    expect(!checked.ok && checked.issues).toEqual([
      {
        path: 'stamp.flags[0]',
        code: 'NOT_ONE_OF',
        message: 'must be one of SENSORS_NOT_LIVE, GATEWAY_UNREACHABLE',
      },
    ]);
  });
});
