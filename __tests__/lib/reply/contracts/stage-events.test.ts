/**
 * @jest-environment node
 */

import { buildRefusal } from '@/lib/intake';
import {
  EVENT_TYPES,
  MAX_STAGE_MS,
  REPLY_ERROR_CODES,
  REPLY_STAGES,
  STAGE_STATUSES,
  decodeStream,
  encodeEvent,
  isTerminal,
  validateStreamEvent,
  validateStreamOrder,
} from '@/lib/reply/contracts/stage-events';
import type {
  ErrorEvent,
  RefusalEvent,
  ResultEvent,
  StageEvent,
  StreamEvent,
} from '@/lib/reply/contracts/stage-events';

import {
  REQUEST_ID,
  answerResult,
  clone,
  reportResult,
  summary,
  withPath,
  without,
} from '../helpers/fixtures';
import { damageProblems } from '../helpers/damage';

const stage = (
  name: StageEvent['stage'],
  status: StageEvent['status'],
  ms: number | null = status === 'DONE' ? 10 : null
): StageEvent => ({ type: 'stage', stage: name, status, ms });

const result: ResultEvent = {
  type: 'result',
  request_id: REQUEST_ID,
  result: reportResult(),
};
const refusal: RefusalEvent = {
  type: 'refusal',
  request_id: REQUEST_ID,
  refusal: buildRefusal(
    'QUOTA_INSUFFICIENT',
    'en-US',
    'Your monthly allowance is used up.'
  ),
};
const error: ErrorEvent = {
  type: 'error',
  request_id: REQUEST_ID,
  code: 'PERSISTENCE_FAILED',
  retryable: true,
};

const codes = (value: unknown) => summary(validateStreamEvent(value));

describe('the words', () => {
  it('lists the six stages in the order they run', () => {
    expect([...REPLY_STAGES]).toEqual([
      'GATE',
      'UNDERSTAND',
      'DATA',
      'CONTEXT',
      'MODEL',
      'CHECKS',
    ]);
    expect([...STAGE_STATUSES]).toEqual(['STARTED', 'DONE', 'SKIPPED']);
    expect([...EVENT_TYPES]).toEqual(['stage', 'result', 'refusal', 'error']);
    expect([...REPLY_ERROR_CODES]).toEqual([
      'INTERNAL',
      'LEDGER_UNAVAILABLE',
      'PERSISTENCE_FAILED',
    ]);
  });

  it('knows which events end a stream', () => {
    expect(isTerminal(stage('GATE', 'STARTED'))).toBe(false);
    for (const event of [result, refusal, error])
      expect(isTerminal(event)).toBe(true);
  });
});

describe('one event', () => {
  it.each([
    ['a started stage', stage('GATE', 'STARTED')],
    ['a done stage', stage('MODEL', 'DONE', 5200)],
    ['a skipped stage', stage('UNDERSTAND', 'SKIPPED')],
    ['a result', result],
    ['a refusal', refusal],
    ['an error', error],
  ])('accepts %s', (_name, event) => {
    expect(validateStreamEvent(event)).toEqual({ ok: true, event });
  });

  it.each([null, undefined, [], 'x', 4])('refuses %j', (value) => {
    expect(codes(value)).toEqual([':WRONG_TYPE']);
  });

  it('refuses a type it does not know', () => {
    expect(codes({ type: 'token', text: 'x' })).toEqual(['type:NOT_ONE_OF']);
    expect(codes({})).toEqual(['type:REQUIRED']);
    expect(codes({ type: 4 })).toEqual(['type:WRONG_TYPE']);
  });

  describe('stage', () => {
    it('refuses an unknown stage or status, an extra key and a missing one', () => {
      expect(codes({ ...stage('GATE', 'STARTED'), stage: 'DOOR' })).toEqual([
        'stage:NOT_ONE_OF',
      ]);
      expect(codes({ ...stage('GATE', 'STARTED'), status: 'RUNNING' })).toEqual(
        ['status:NOT_ONE_OF']
      );
      expect(codes({ ...stage('GATE', 'STARTED'), extra: 1 })).toEqual([
        'extra:UNKNOWN_KEY',
      ]);
      expect(codes(without(stage('GATE', 'STARTED'), 'ms'))).toEqual([
        'ms:REQUIRED',
      ]);
    });

    it('has a time on DONE only', () => {
      expect(codes(stage('GATE', 'DONE', 0))).toEqual([]);
      expect(codes(stage('GATE', 'DONE', MAX_STAGE_MS))).toEqual([]);
      expect(codes(stage('GATE', 'DONE', MAX_STAGE_MS + 1))).toEqual([
        'ms:OUT_OF_RANGE',
      ]);
      expect(codes(stage('GATE', 'DONE', -1))).toEqual(['ms:OUT_OF_RANGE']);
      expect(codes(stage('GATE', 'DONE', 1.5))).toEqual(['ms:WRONG_TYPE']);
      expect(codes(stage('GATE', 'DONE', null))).toEqual(['ms:WRONG_TYPE']);
      expect(codes({ ...stage('GATE', 'STARTED'), ms: 5 })).toEqual([
        'ms:INCONSISTENT',
      ]);
      expect(codes({ ...stage('GATE', 'SKIPPED'), ms: 5 })).toEqual([
        'ms:INCONSISTENT',
      ]);
    });
  });

  describe('result', () => {
    it('checks the reply inside it, at its own path', () => {
      expect(codes(withPath(result, 'result.report.headline', ''))).toEqual([
        'result.report.headline:TOO_SHORT',
      ]);
      expect(
        codes(withPath(result, 'result', { ...answerResult(), extra: 1 }))
      ).toEqual(['result.extra:UNKNOWN_KEY']);
    });

    it('must name the request the reply is about', () => {
      expect(codes(withPath(result, 'request_id', 'req-other-0002'))).toEqual([
        'result.provenance.request_id:INCONSISTENT',
      ]);
      expect(codes(withPath(result, 'request_id', 'bad id'))).toEqual([
        'request_id:BAD_FORMAT',
      ]);
    });
  });

  describe('refusal', () => {
    it('is the intake refusal, checked by its own contract', () => {
      expect(codes(withPath(refusal, 'refusal.stage', 'DOOR'))).toEqual([
        'refusal.stage:INCONSISTENT',
      ]);
      expect(codes(withPath(refusal, 'refusal.code', 'GO_AWAY'))).toEqual(
        expect.arrayContaining(['refusal.code:NOT_ONE_OF'])
      );
      expect(codes(withPath(refusal, 'refusal.reply', ''))).toEqual([
        'refusal.reply:TOO_SHORT',
      ]);
    });
  });

  describe('error', () => {
    it('has a code from the list and says whether to retry', () => {
      expect(codes({ ...error, code: 'OOPS' })).toEqual(['code:NOT_ONE_OF']);
      expect(codes({ ...error, retryable: 'yes' })).toEqual([
        'retryable:WRONG_TYPE',
      ]);
      expect(codes(without(error, 'request_id'))).toEqual([
        'request_id:REQUIRED',
      ]);
      for (const code of REPLY_ERROR_CODES) {
        expect(codes({ ...error, code })).toEqual([]);
      }
    });
  });
});

describe('the order of a stream', () => {
  const order = (events: StreamEvent[]) =>
    validateStreamOrder(events).map((i) => `${i.path}:${i.code}`);

  const full: StreamEvent[] = [
    stage('GATE', 'STARTED'),
    stage('GATE', 'DONE'),
    stage('UNDERSTAND', 'STARTED'),
    stage('UNDERSTAND', 'DONE'),
    stage('DATA', 'STARTED'),
    stage('DATA', 'DONE'),
    stage('CONTEXT', 'STARTED'),
    stage('CONTEXT', 'DONE'),
    stage('MODEL', 'STARTED'),
    stage('MODEL', 'DONE'),
    stage('CHECKS', 'STARTED'),
    stage('CHECKS', 'DONE'),
    result,
  ];

  it('accepts a full run, a refusal at the gate, a stage left open by the error, and a lone terminal', () => {
    expect(order(full)).toEqual([]);
    expect(
      order([stage('GATE', 'STARTED'), stage('GATE', 'DONE'), refusal])
    ).toEqual([]);
    expect(
      order([
        stage('GATE', 'STARTED'),
        stage('GATE', 'DONE'),
        stage('UNDERSTAND', 'STARTED'),
        error,
      ])
    ).toEqual([]);
    expect(order([result])).toEqual([]);
    expect(
      order([
        stage('UNDERSTAND', 'SKIPPED'),
        stage('DATA', 'STARTED'),
        stage('DATA', 'DONE'),
        result,
      ])
    ).toEqual([]);
  });

  it('refuses an empty stream', () => {
    expect(order([])).toEqual([':TOO_SHORT']);
  });

  it('wants exactly one terminal event, and last', () => {
    expect(order([stage('GATE', 'STARTED'), stage('GATE', 'DONE')])).toEqual([
      ':REQUIRED',
    ]);
    expect(order([result, error])).toEqual(['[0]:INCONSISTENT', ':DUPLICATE']);
    expect(order([result, stage('GATE', 'STARTED')])).toEqual([
      '[0]:INCONSISTENT',
      '[1]:INCONSISTENT',
    ]);
    expect(order([refusal, result])).toEqual([
      '[0]:INCONSISTENT',
      ':DUPLICATE',
    ]);
  });

  it('wants the stages in order and each started once', () => {
    expect(
      order([
        stage('MODEL', 'STARTED'),
        stage('MODEL', 'DONE'),
        stage('GATE', 'STARTED'),
        stage('GATE', 'DONE'),
        result,
      ])
    ).toEqual(['[2]:NOT_SORTED']);
    expect(
      order([
        stage('GATE', 'STARTED'),
        stage('GATE', 'DONE'),
        stage('GATE', 'STARTED'),
        result,
      ])
    ).toEqual(['[2]:DUPLICATE']);
  });

  it('wants a stage started before it is done', () => {
    expect(order([stage('GATE', 'DONE'), result])).toEqual([
      '[0]:INCONSISTENT',
    ]);
    expect(
      order([stage('GATE', 'STARTED'), stage('DATA', 'DONE'), result])
    ).toEqual(expect.arrayContaining(['[1]:INCONSISTENT']));
  });

  it('does not start a stage while another is open', () => {
    expect(
      order([
        stage('GATE', 'STARTED'),
        stage('DATA', 'STARTED'),
        stage('DATA', 'DONE'),
        result,
      ])
    ).toEqual(['[1]:INCONSISTENT']);
    expect(
      order([stage('GATE', 'STARTED'), stage('DATA', 'SKIPPED'), result])
    ).toEqual(['[1]:INCONSISTENT']);
  });

  it('does not skip a stage it already started, or one that comes earlier', () => {
    expect(
      order([
        stage('GATE', 'STARTED'),
        stage('GATE', 'DONE'),
        stage('GATE', 'SKIPPED'),
        result,
      ])
    ).toEqual(['[2]:DUPLICATE']);
    expect(
      order([
        stage('DATA', 'STARTED'),
        stage('DATA', 'DONE'),
        stage('GATE', 'SKIPPED'),
        result,
      ])
    ).toEqual(['[2]:NOT_SORTED']);
  });
});

describe('the NDJSON text', () => {
  const body = (events: StreamEvent[]) => events.map(encodeEvent).join('');

  it('writes one line per event, with a newline, and keys in order', () => {
    const line = encodeEvent(stage('GATE', 'STARTED'));
    expect(line).toBe(
      '{"ms":null,"stage":"GATE","status":"STARTED","type":"stage"}\n'
    );
    expect(line.endsWith('\n')).toBe(true);
    expect(line.slice(0, -1)).not.toContain('\n');
  });

  it('round-trips a whole stream', () => {
    const events = [
      stage('GATE', 'STARTED'),
      stage('GATE', 'DONE', 12),
      stage('UNDERSTAND', 'SKIPPED'),
      {
        type: 'result',
        request_id: REQUEST_ID,
        result: answerResult(),
      } as StreamEvent,
    ];
    const decoded = decodeStream(body(events));
    expect(decoded).toEqual({ ok: true, events });
  });

  it('accepts an empty body as no events, which is then an invalid stream', () => {
    const decoded = decodeStream('');
    expect(decoded.ok).toBe(false);
    expect(decoded.events).toEqual([]);
  });

  it('reports a cut stream (no newline at the end)', () => {
    const text = body([stage('GATE', 'STARTED'), result]).slice(0, -1);
    const decoded = decodeStream(text);
    expect(decoded.ok).toBe(false);
    if (!decoded.ok)
      expect(decoded.issues.map((i) => i.code)).toContain('BAD_FORMAT');
  });

  it('reports a blank line, a line that is not JSON and an invalid event, each at its line', () => {
    const good = encodeEvent(stage('GATE', 'STARTED'));
    const decoded = decodeStream(
      `${good}\nnot json\n${JSON.stringify({ type: 'token' })}\n`
    );
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) {
      expect(decoded.issues.map((i) => `${i.path}:${i.code}`)).toEqual([
        '[1]:BAD_FORMAT',
        '[2]:BAD_FORMAT',
        '[3].type:NOT_ONE_OF',
      ]);
    }
  });

  it('reports the order once every line is a valid event', () => {
    const decoded = decodeStream(body([result, error]));
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) {
      expect(decoded.issues.map((i) => i.code)).toEqual([
        'INCONSISTENT',
        'DUPLICATE',
      ]);
      expect(decoded.events).toHaveLength(2);
    }
  });

  it('never throws on hostile text', () => {
    for (const text of [
      '\n',
      '{',
      '[]\n',
      '"x"\n',
      'null\n',
      '{"type":null}\n',
      '\u0000\n',
    ]) {
      expect(() => decodeStream(text)).not.toThrow();
      expect(decodeStream(text).ok).toBe(false);
    }
    expect(clone({})).toEqual({});
  });
});

describe('the limits and the words of an event', () => {
  it('pins the longest stage time at ten minutes', () => {
    expect(MAX_STAGE_MS).toBe(600_000);
    expect(codes(stage('MODEL', 'DONE', 600_000))).toEqual([]);
    expect(codes(stage('MODEL', 'DONE', 600_001))).toEqual(['ms:OUT_OF_RANGE']);
  });
});

describe('where an event reports what is wrong inside it', () => {
  it('names the request id of each kind of event', () => {
    const badId = 'has space';
    expect(codes({ ...error, request_id: badId })).toEqual([
      'request_id:BAD_FORMAT',
    ]);
    expect(codes({ ...refusal, request_id: badId })).toEqual([
      'request_id:BAD_FORMAT',
    ]);
    expect(codes({ ...result, request_id: badId })).toEqual([
      'request_id:BAD_FORMAT',
    ]);
  });

  it('puts the path of the result under "result", and a result that is no object at "result"', () => {
    expect(codes({ ...result, result: null })).toEqual(['result:WRONG_TYPE']);
    expect(codes(withPath(result, 'result.stamp.retuning', 'yes'))).toEqual([
      'result.stamp.retuning:WRONG_TYPE',
    ]);
  });

  it('puts the path of the refusal under "refusal", and a refusal that is no object at "refusal"', () => {
    expect(codes({ ...refusal, refusal: null })).toEqual([
      'refusal:WRONG_TYPE',
    ]);
    expect(codes(withPath(refusal, 'refusal.code', 'NOPE'))).toEqual([
      'refusal.code:NOT_ONE_OF',
    ]);
  });

  it('wants the result to be the one that was asked for', () => {
    expect(codes({ ...result, request_id: 'req-other' })).toEqual([
      'result.provenance.request_id:INCONSISTENT',
    ]);
  });

  it('is not ok exactly when it has issues, whatever it is given', () => {
    for (const value of [null, 4, 'x', [], {}, { type: 'token' }, result]) {
      const checked = validateStreamEvent(value);
      expect(checked.ok).toBe(!('issues' in checked));
      if (!checked.ok) expect(checked.issues.length).toBeGreaterThan(0);
    }
  });
});

describe('every place of an event is reported where it is', () => {
  it.each([
    ['a done stage', stage('MODEL', 'DONE', 5200)],
    ['an error', error],
    ['a refusal', refusal],
    ['a result', result],
  ] as const)('%s', (_name, event) => {
    expect(
      damageProblems(event, validateStreamEvent, {
        // the kind of the result decides which keys it has; the id of the event is the id of the result
        skip: ['result.kind'],
        related: ['result.provenance.request_id'],
      })
    ).toEqual([]);
  });
});

describe('what the order rules say, in words', () => {
  const messages = (events: StreamEvent[]) =>
    validateStreamOrder(events).map((i) => `${i.path}:${i.code}:${i.message}`);

  it('says when a stream has no terminal event, and when it has two', () => {
    expect(messages([stage('GATE', 'STARTED'), stage('GATE', 'DONE')])).toEqual(
      [':REQUIRED:the stream has no terminal event']
    );
    expect(messages([result, error])).toEqual([
      '[0]:INCONSISTENT:nothing may follow a terminal event',
      ':DUPLICATE:the stream has more than one terminal event',
    ]);
    expect(messages([refusal, result, error])).toEqual([
      '[0]:INCONSISTENT:nothing may follow a terminal event',
      '[1]:INCONSISTENT:nothing may follow a terminal event',
      ':DUPLICATE:the stream has more than one terminal event',
    ]);
  });

  it('says which stage is wrong', () => {
    expect(
      messages([stage('GATE', 'DONE'), stage('GATE', 'STARTED'), result])
    ).toEqual([
      '[0]:INCONSISTENT:GATE is done without being started',
      '[1]:DUPLICATE:GATE is started twice',
    ]);
    expect(
      messages([
        stage('GATE', 'STARTED'),
        stage('GATE', 'STARTED'),
        stage('GATE', 'DONE'),
        result,
      ])
    ).toEqual([
      '[1]:DUPLICATE:GATE is started twice',
      '[1]:INCONSISTENT:GATE is still open',
    ]);
    expect(
      messages([stage('GATE', 'STARTED'), stage('GATE', 'SKIPPED'), result])
    ).toEqual([
      '[1]:DUPLICATE:GATE is skipped after it began',
      '[1]:INCONSISTENT:GATE is still open',
    ]);
    expect(
      messages([
        stage('MODEL', 'STARTED'),
        stage('MODEL', 'DONE'),
        stage('GATE', 'SKIPPED'),
        result,
      ])
    ).toEqual(['[2]:NOT_SORTED:GATE comes after a later stage']);
    expect(
      messages([
        stage('GATE', 'STARTED'),
        stage('UNDERSTAND', 'STARTED'),
        stage('UNDERSTAND', 'DONE'),
        result,
      ])
    ).toEqual(['[1]:INCONSISTENT:GATE is still open']);
  });

  it('lets a stage be skipped, and the first stage be any stage', () => {
    expect(
      messages([stage('MODEL', 'SKIPPED'), stage('CHECKS', 'STARTED'), error])
    ).toEqual([]);
    expect(messages([stage('GATE', 'SKIPPED'), result])).toEqual([]);
    expect(messages([stage('GATE', 'STARTED'), error])).toEqual([]);
  });
});

describe('the framing of a stream, line by line', () => {
  const two = [stage('GATE', 'STARTED'), error];
  const wire = (events: StreamEvent[]) => events.map(encodeEvent).join('');

  it('takes an empty body as no lines, not as a cut line', () => {
    const decoded = decodeStream('');
    expect(decoded.ok).toBe(false);
    expect(
      !decoded.ok && decoded.issues.map((i) => `${i.path}:${i.code}`)
    ).toEqual([':TOO_SHORT']);
  });

  it('reports a cut stream once, at the stream, and still reads the cut line', () => {
    const decoded = decodeStream(wire(two).slice(0, -1));
    expect(decoded.ok).toBe(false);
    expect(
      !decoded.ok &&
        decoded.issues.map((i) => `${i.path}:${i.code}:${i.message}`)
    ).toEqual([':BAD_FORMAT:the last line has no newline: the stream was cut']);
    expect(decoded.events).toEqual(two);
  });

  it('reads the last line when it has its newline, and reports a blank line inside', () => {
    expect(decodeStream(wire(two))).toEqual({ ok: true, events: two });
    const blank = decodeStream(
      `${encodeEvent(two[0] as StreamEvent)}\n${encodeEvent(two[1] as StreamEvent)}`
    );
    expect(blank.ok).toBe(false);
    expect(!blank.ok && blank.issues.map((i) => `${i.path}:${i.code}`)).toEqual(
      ['[1]:BAD_FORMAT']
    );
    expect(blank.events).toEqual(two);
  });

  it('puts a line that is no object at the line, and a wrong key under it', () => {
    const decoded = decodeStream(
      `5\n${JSON.stringify({ ...stage('GATE', 'STARTED'), stage: 'X' })}\n`
    );
    expect(
      !decoded.ok && decoded.issues.map((i) => `${i.path}:${i.code}`)
    ).toEqual(['[0]:WRONG_TYPE', '[1].stage:NOT_ONE_OF']);
  });

  it('puts the path of a result under the line, too', () => {
    const wrong = withPath(result, 'result.stamp.retuning', 'yes');
    const decoded = decodeStream(`${JSON.stringify(wrong)}\n`);
    expect(
      !decoded.ok && decoded.issues.map((i) => `${i.path}:${i.code}`)
    ).toEqual(['[0].result.stamp.retuning:WRONG_TYPE']);
  });
});
