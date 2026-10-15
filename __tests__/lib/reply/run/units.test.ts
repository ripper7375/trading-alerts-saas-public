/**
 * @jest-environment node
 */

/**
 * The small pieces of the orchestrator (build step 7 part 7a), one by one: what a model call
 * becomes in the books and the trace, the stage tracker and its order rules, and the messages that
 * ask the model again.
 */

import {
  REPLY_STAGES,
  validateStreamOrder,
} from '@/lib/reply/contracts/stage-events';
import type { StageEvent } from '@/lib/reply/contracts/stage-events';
import type { ModelCallResult } from '@/lib/reply/gateway/types';
import { summarizeSpend } from '@/lib/reply/meter/reserve-plan';
import {
  answerTokens,
  callRecordOf,
  spentOf,
  totalCost,
  wasSent,
} from '@/lib/reply/run/calls';
import {
  MAX_LISTED,
  checkRetryMessage,
  issueLines,
  schemaRetryMessage,
} from '@/lib/reply/run/regenerate';
import { CLIENT_REQUEST_ID, requestIdOf } from '@/lib/reply/run/request-id';
import { EventedRecorder, StageTracker } from '@/lib/reply/run/stages';

const answer = (
  over: Partial<Extract<ModelCallResult, { ok: true }>> = {}
): ModelCallResult => ({
  ok: true,
  text: '{}',
  model: 'vendor/model',
  served_model: null,
  host: null,
  generation_id: null,
  response_mode: 'JSON_SCHEMA',
  finish_reason: 'stop',
  usage: {
    prompt_tokens: 1_000,
    completion_tokens: 200,
    cached_tokens: 0,
    cost_micro_usd: 1_500,
    cost_flag: null,
  },
  latency_ms: 123.6,
  attempts: 1,
  ...over,
});
const failure = (code: string, attempts = 1): ModelCallResult => ({
  ok: false,
  code: code as never,
  model: 'vendor/model',
  latency_ms: 40,
  attempts,
});
const usage = (
  prompt: number | null,
  completion: number | null,
  cached: number | null,
  cost: number | null
) => ({
  prompt_tokens: prompt,
  completion_tokens: completion,
  cached_tokens: cached,
  cost_micro_usd: cost,
  cost_flag: cost === null ? ('COST_ESTIMATED' as const) : null,
});

describe('what a call becomes in the books', () => {
  it('an answer is a paid call with the gateway figures', () => {
    expect(spentOf(answer())).toEqual({
      model: 'vendor/model',
      costMicroUsd: 1_500,
      promptTokens: 1_000,
      completionTokens: 200,
    });
  });

  it('a cost the provider did not report stays unknown, so the whole hold is charged', () => {
    const call = spentOf(answer({ usage: usage(1, 1, null, null) }))!;
    expect(call.costMicroUsd).toBeNull();
    expect(summarizeSpend([call]).actualUnits).toBeNull();
  });

  it('a call that gave no answer is not paid for', () => {
    expect(spentOf(failure('TIMEOUT'))).toBeNull();
    expect(spentOf(failure('HTTP_503'))).toBeNull();
  });

  it('a call refused before anything was sent is not a call', () => {
    expect(wasSent(failure('CONTEXT_TOO_LARGE', 0))).toBe(false);
    expect(wasSent(failure('TIMEOUT', 1))).toBe(true);
    expect(wasSent(answer())).toBe(true);
  });
});

describe('what a call becomes in the trace', () => {
  it('an answer carries its usage, and its latency in whole milliseconds', () => {
    expect(callRecordOf('ANSWER', answer())).toEqual({
      role: 'ANSWER',
      model: 'vendor/model',
      outcome: 'OK',
      attempts: 1,
      tokens_prompt: 1_000,
      tokens_completion: 200,
      tokens_cached: 0,
      cost_micro_usd: 1_500,
      cost_estimated: false,
      latency_ms: 124,
    });
  });

  it('says when the cost is ours and not the provider', () => {
    const estimated = answer({ usage: usage(1, 1, 0, null) });
    expect(callRecordOf('ANSWER', estimated).cost_estimated).toBe(true);
  });

  it('takes the outcome the caller found when it read the reply', () => {
    expect(callRecordOf('ANSWER', answer(), 'BAD_JSON').outcome).toBe(
      'BAD_JSON'
    );
    expect(callRecordOf('REGENERATE', answer(), 'BAD_SCHEMA').outcome).toBe(
      'BAD_SCHEMA'
    );
  });

  it('a timeout is a TIMEOUT and any other failure an ERROR, with no usage', () => {
    expect(callRecordOf('FALLBACK', failure('TIMEOUT'))).toMatchObject({
      role: 'FALLBACK',
      outcome: 'TIMEOUT',
      tokens_prompt: null,
      tokens_completion: null,
      tokens_cached: null,
      cost_micro_usd: null,
      cost_estimated: false,
      latency_ms: 40,
    });
    expect(callRecordOf('ANSWER', failure('HTTP_500')).outcome).toBe('ERROR');
    expect(callRecordOf('ANSWER', failure('UNREACHABLE')).outcome).toBe(
      'ERROR'
    );
  });

  it('keeps attempts within what the contract accepts (1 to 5)', () => {
    expect(callRecordOf('ANSWER', answer({ attempts: 0 })).attempts).toBe(1);
    expect(callRecordOf('ANSWER', answer({ attempts: 9 })).attempts).toBe(5);
    expect(callRecordOf('ANSWER', failure('TIMEOUT', 0)).attempts).toBe(1);
    expect(callRecordOf('ANSWER', failure('TIMEOUT', 9)).attempts).toBe(5);
  });

  it('never reports a negative latency', () => {
    expect(callRecordOf('ANSWER', answer({ latency_ms: -5 })).latency_ms).toBe(
      0
    );
    expect(
      callRecordOf('ANSWER', { ...failure('TIMEOUT'), latency_ms: -5 })
        .latency_ms
    ).toBe(0);
  });
});

describe('the sums of the model group', () => {
  const records = [
    callRecordOf('UNDERSTAND', answer({ usage: usage(800, 100, 0, 300) })),
    callRecordOf('ANSWER', answer()),
    callRecordOf(
      'REGENERATE',
      answer({ usage: usage(1_100, 250, 400, 1_700) })
    ),
  ];

  it('tokens are summed over the calls that wrote an answer, the Understand call left out', () => {
    expect(answerTokens(records)).toEqual({
      prompt: 2_100,
      completion: 450,
      cached: 400,
    });
  });

  it('a call that did not say makes the sum unknown', () => {
    const unknown = callRecordOf(
      'ANSWER',
      answer({ usage: usage(null, 1, 0, null) })
    );
    expect(answerTokens([unknown])).toEqual({
      prompt: null,
      completion: 1,
      cached: 0,
    });
    expect(totalCost([...records, unknown])).toBeNull();
  });

  it('a reply that was read as bad still wrote an answer: its figures count', () => {
    const bad = [
      callRecordOf(
        'ANSWER',
        answer({ usage: usage(100, 10, 0, 40) }),
        'BAD_JSON'
      ),
      callRecordOf(
        'REGENERATE',
        answer({ usage: usage(120, 12, 0, 50) }),
        'BAD_SCHEMA'
      ),
    ];
    expect(answerTokens(bad)).toEqual({
      prompt: 220,
      completion: 22,
      cached: 0,
    });
    expect(totalCost(bad)).toBe(90);
  });

  it('a timeout is not an answer, in the tokens or in the cost', () => {
    const mixed = [
      callRecordOf('ANSWER', failure('TIMEOUT')),
      callRecordOf('FALLBACK', answer({ usage: usage(100, 10, 0, 40) })),
    ];
    expect(answerTokens(mixed)).toEqual({
      prompt: 100,
      completion: 10,
      cached: 0,
    });
    expect(totalCost(mixed)).toBe(40);
  });

  it('a call that failed with an error is not an answer either, in the tokens or in the cost', () => {
    const mixed = [
      callRecordOf('ANSWER', failure('UPSTREAM_ERROR')),
      callRecordOf('FALLBACK', answer({ usage: usage(100, 10, 0, 40) })),
    ];
    expect(mixed[0]!.outcome).toBe('ERROR');
    expect(answerTokens(mixed)).toEqual({
      prompt: 100,
      completion: 10,
      cached: 0,
    });
    expect(totalCost(mixed)).toBe(40);
    expect(
      answerTokens([callRecordOf('ANSWER', failure('UPSTREAM_ERROR'))])
    ).toEqual({ prompt: null, completion: null, cached: null });
  });

  it('is empty when no model wrote an answer', () => {
    const none = { prompt: null, completion: null, cached: null };
    expect(answerTokens([])).toEqual(none);
    expect(answerTokens([callRecordOf('ANSWER', failure('TIMEOUT'))])).toEqual(
      none
    );
    expect(answerTokens([records[0]!])).toEqual(none);
  });

  it('the cost is the sum over the calls that answered, the Understand call included; failures are not in it', () => {
    expect(totalCost(records)).toBe(300 + 1_500 + 1_700);
    expect(
      totalCost([...records, callRecordOf('FALLBACK', failure('HTTP_500'))])
    ).toBe(3_500);
    expect(totalCost([])).toBeNull();
    expect(totalCost([callRecordOf('ANSWER', failure('TIMEOUT'))])).toBeNull();
  });
});

describe('the request id', () => {
  it('is 64 hex digits and fits the id columns', async () => {
    const id = await requestIdOf('u', 'c');
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(CLIENT_REQUEST_ID.test(id)).toBe(true);
  });

  it('what a client id may be', () => {
    expect(CLIENT_REQUEST_ID.test('3f0c8a52-1d4e-4c7a-9b0e-5a6d7c8e9f10')).toBe(
      true
    );
    expect(CLIENT_REQUEST_ID.test('a'.repeat(64))).toBe(true);
    for (const bad of [
      '',
      'a'.repeat(65),
      'has space',
      'a/b',
      'a.b',
      '<x>',
      'é',
    ]) {
      expect(CLIENT_REQUEST_ID.test(bad)).toBe(false);
    }
  });

  it('does not let two inputs run together (a user id that ends where the other begins)', async () => {
    expect(await requestIdOf('ab', 'c')).not.toBe(await requestIdOf('a', 'bc'));
  });
});

describe('the stage tracker', () => {
  function track(): {
    tracker: StageTracker;
    events: StageEvent[];
    tick: (ms: number) => void;
  } {
    const events: StageEvent[] = [];
    let now = 1_000;
    const tracker = new StageTracker(
      (e) => events.push(e),
      () => now
    );
    return { tracker, events, tick: (ms) => (now += ms) };
  }
  const summary = (events: StageEvent[]): string[] =>
    events.map(
      (e) => `${e.stage}:${e.status}${e.ms === null ? '' : `:${e.ms}`}`
    );

  it('starts a stage, finishes it when the next begins, and times it', () => {
    const { tracker, events, tick } = track();
    tracker.enter('GATE');
    tick(7);
    tracker.enter('UNDERSTAND');
    tick(30);
    tracker.close();
    expect(summary(events)).toEqual([
      'GATE:STARTED',
      'GATE:DONE:7',
      'UNDERSTAND:STARTED',
      'UNDERSTAND:DONE:30',
    ]);
    expect(tracker.current).toBeNull();
  });

  it('skips the stages that never began when a later one starts', () => {
    const { tracker, events } = track();
    tracker.enter('GATE');
    tracker.enter('DATA');
    expect(summary(events)).toEqual([
      'GATE:STARTED',
      'GATE:DONE:0',
      'UNDERSTAND:SKIPPED',
      'DATA:STARTED',
    ]);
  });

  it('says which stage is open, the first one included', () => {
    const { tracker } = track();
    expect(tracker.current).toBeNull();
    tracker.enter('GATE');
    expect(tracker.current).toBe('GATE');
    tracker.enter('CHECKS');
    expect(tracker.current).toBe('CHECKS');
  });

  it('a stage that comes first skips every stage before it, the first included', () => {
    const { tracker, events } = track();
    tracker.enter('CONTEXT');
    expect(summary(events)).toEqual([
      'GATE:SKIPPED',
      'UNDERSTAND:SKIPPED',
      'DATA:SKIPPED',
      'CONTEXT:STARTED',
    ]);
  });

  it('ignores a stage that is already open or already past, so the order can never be broken', () => {
    const { tracker, events } = track();
    tracker.enter('GATE');
    tracker.enter('DATA');
    tracker.enter('DATA');
    tracker.enter('GATE');
    tracker.enter('UNDERSTAND');
    expect(events).toHaveLength(4);
    expect(tracker.current).toBe('DATA');
  });

  it('skips the rest when no model is needed, and what it emits is a valid stream', () => {
    const { tracker, events } = track();
    for (const stage of ['GATE', 'UNDERSTAND', 'DATA', 'CONTEXT'] as const) {
      tracker.enter(stage);
    }
    tracker.skipRest();
    expect(summary(events).slice(-3)).toEqual([
      'CONTEXT:DONE:0',
      'MODEL:SKIPPED',
      'CHECKS:SKIPPED',
    ]);
    expect(
      validateStreamOrder([
        ...events,
        { type: 'error', request_id: 'r', code: 'INTERNAL', retryable: false },
      ])
    ).toEqual([]);
    // nothing can start after the rest were skipped, whichever stage is asked for
    const before = events.length;
    for (const stage of REPLY_STAGES) tracker.enter(stage);
    expect(events).toHaveLength(before);
    expect(tracker.current).toBeNull();
  });

  it('knows which client stage each intake stage belongs to', () => {
    const expected: Record<string, string> = {
      GATE: 'GATE',
      DOOR: 'UNDERSTAND',
      UNDERSTAND: 'UNDERSTAND',
      SCOPE: 'UNDERSTAND',
      SNAPSHOT: 'DATA',
      DATA: 'DATA',
      EVENTS: 'DATA',
      BOARD: 'DATA',
      ROUTE: 'DATA',
      RETRIEVE: 'CONTEXT',
      ASSEMBLE: 'CONTEXT',
    };
    for (const [name, stage] of Object.entries(expected)) {
      expect(StageTracker.stageOf(name as never)).toBe(stage);
    }
    expect(REPLY_STAGES).toHaveLength(6);
  });

  it('a recorder tells the tracker which stage it is in, and still times it for the trace', async () => {
    const events: StageEvent[] = [];
    let now = 0;
    const clock = () => (now += 5);
    const tracker = new StageTracker((e) => events.push(e), clock);
    const recorder = new EventedRecorder(
      {
        requestId: 'r',
        route: 'typed',
        method: 'POST',
        startedAt: '2026-10-15T00:00:00.000Z',
        clock,
      },
      tracker
    );
    await recorder.stage('GATE', async () => 1);
    await recorder.stage('SNAPSHOT', async () => 2);
    // (the clock moves five on every reading, so the times are checked as times)
    expect(summary(events).map((line) => line.replace(/:\d+$/, ':ms'))).toEqual(
      ['GATE:STARTED', 'GATE:DONE:ms', 'UNDERSTAND:SKIPPED', 'DATA:STARTED']
    );
    expect(events[1]!.ms).toBeGreaterThan(0);
    expect(recorder.snapshot().timings.stages.map((s) => s.name)).toEqual([
      'GATE',
      'SNAPSHOT',
    ]);
  });
});

describe('the messages that ask the model again', () => {
  it('names the literals that failed in the model own words, and what to do instead', () => {
    const text = checkRetryMessage({
      numbers: ['4999.99', '12:45'],
      wording: [],
    });
    expect(text).toContain('- 4999.99');
    expect(text).toContain('- 12:45');
    expect(text).toContain('{id} placeholder');
    expect(text).not.toContain('not allowed');
    expect(text).toContain('one JSON object');
  });

  it('names the kinds of phrase that were found', () => {
    const text = checkRetryMessage({
      numbers: [],
      wording: [{ category: 'GUARANTEE', phrase: 'guaranteed profit' }],
    });
    expect(text).toContain('- GUARANTEE: guaranteed profit');
    expect(text).toContain('not allowed');
    expect(text).not.toContain('These numbers');
  });

  it('lists at most a few of each, and cuts a long literal', () => {
    const many = Array.from({ length: 20 }, (_, i) => `${i}${'9'.repeat(60)}`);
    const text = checkRetryMessage({ numbers: many, wording: [] });
    expect(text.match(/^- /gm)).toHaveLength(MAX_LISTED);
    expect(text).toContain('…');
  });

  it('says what is wrong with the schema by path, without the values', () => {
    const lines = issueLines([
      {
        path: 'zones[0]',
        code: 'NOT_ONE_OF',
        message: 'must be one of Z1, Z2',
      },
      { path: '', code: 'WRONG_TYPE', message: 'must be an object' },
    ]);
    expect(lines).toEqual([
      'zones[0]: must be one of Z1, Z2',
      '(the reply): must be an object',
    ]);
    const text = schemaRetryMessage([
      { path: 'headline', code: 'TOO_LONG', message: 'is too long' },
    ]);
    expect(text).toContain('- headline: is too long');
    expect(schemaRetryMessage([])).not.toContain('What is wrong');
  });

  it('says exactly this to the model when numbers failed', () => {
    expect(checkRetryMessage({ numbers: ['4999.99'], wording: [] })).toBe(
      [
        'Your previous reply was not accepted.',
        'These numbers are not in the context you were given, so they cannot be shown:',
        '- 4999.99',
        'Write every figure as a {id} placeholder from the context. Do not type a figure yourself.',
        'Write the whole reply again as one JSON object with exactly the required keys and nothing else.',
      ].join('\n')
    );
  });

  it('says exactly this to the model when a phrase failed', () => {
    expect(
      checkRetryMessage({
        numbers: [],
        wording: [{ category: 'ADVICE', phrase: 'we *recommend*' }],
      })
    ).toBe(
      [
        'Your previous reply was not accepted.',
        'These kinds of phrase are not allowed:',
        '- ADVICE: we *recommend*',
        'Describe what the data shows. Do not advise, promise, rate a probability or press for speed.',
        'Write the whole reply again as one JSON object with exactly the required keys and nothing else.',
      ].join('\n')
    );
  });

  it('says exactly this to the model when the schema failed', () => {
    expect(
      schemaRetryMessage([
        { path: 'zones[0]', code: 'NOT_ONE_OF', message: 'must be one of Z1' },
      ])
    ).toBe(
      [
        'Your previous reply was not accepted: it is not valid JSON for the required schema.',
        'What is wrong:',
        '- zones[0]: must be one of Z1',
        'Write the whole reply again as one JSON object with exactly the required keys and nothing else.',
      ].join('\n')
    );
    expect(schemaRetryMessage([])).toBe(
      [
        'Your previous reply was not accepted: it is not valid JSON for the required schema.',
        'Write the whole reply again as one JSON object with exactly the required keys and nothing else.',
      ].join('\n')
    );
  });

  it('lists eight of each kind, and cuts a literal at 40 characters and a path line at 160', () => {
    expect(MAX_LISTED).toBe(8);
    const nine = Array.from({ length: 9 }, (_, i) => String(i + 1));
    expect(
      checkRetryMessage({ numbers: nine, wording: [] }).match(/^- /gm)
    ).toHaveLength(8);
    const exactly = '7'.repeat(40);
    expect(checkRetryMessage({ numbers: [exactly], wording: [] })).toContain(
      '- ' + exactly + '\n'
    );
    const over = '7'.repeat(41);
    const cut = checkRetryMessage({ numbers: [over], wording: [] });
    expect(cut).toContain('- ' + '7'.repeat(39) + '…\n');
    expect(cut).not.toContain('7'.repeat(40));
    const line = (n: number) =>
      issueLines([
        { path: 'p', code: 'WRONG_TYPE', message: 'm'.repeat(n) },
      ])[0]!;
    expect(Array.from(line(157)).length).toBe(160);
    expect(line(157)).not.toContain('…');
    expect(Array.from(line(158)).length).toBe(160);
    expect(line(158).endsWith('…')).toBe(true);
    expect(
      issueLines(
        Array.from({ length: 9 }, () => ({
          path: 'p',
          code: 'WRONG_TYPE' as const,
          message: 'm',
        }))
      )
    ).toHaveLength(8);
  });

  it('is the same message for the same failure', () => {
    const request = {
      numbers: ['1.23'],
      wording: [{ category: 'ADVICE' as const, phrase: 'we recommend' }],
    };
    expect(checkRetryMessage(request)).toBe(checkRetryMessage(request));
  });
});
