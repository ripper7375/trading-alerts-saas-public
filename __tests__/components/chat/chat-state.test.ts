/**
 * @jest-environment node
 */

/**
 * The reducer of the chat panel (build step 7 part 8), played with the REAL recorded answers of the
 * message route: every recorded stream, event by event, and every recorded refusal. The properties
 * that matter: a request in flight always ends (no terminal action leaves `flight` set), every stage
 * is a state of its own, a retry is the same request and not a second bubble, and what the meter and
 * the picker read is never a guess.
 */

import {
  analysesLeft,
  chatReducer,
  chosenModel,
  emptyStages,
  initialChatState,
  isBusy,
  shareLeft,
  type ChatAction,
  type ChatState,
} from '@/components/chat/chat-state';
import { STAGES } from '@/components/chat/limits';
import type { AskInput, ChatInfo, PickerModel } from '@/components/chat/types';
import { failureFromBody } from '@/components/chat/wire';

import { RECORDED, resultOf } from './helpers/fake-fetch';

const TYPED: AskInput = {
  kind: 'TYPED',
  question: 'What is the direction of gold now?',
};
const INSTANT: AskInput = { kind: 'INSTANT', intent: 'INSTANT_M15_INSPECT' };

const reduce = (
  actions: ChatAction[],
  from: ChatState = initialChatState()
): ChatState => actions.reduce(chatReducer, from);

const send = (
  id = 'c-1',
  input: AskInput = TYPED,
  retry = false
): ChatAction => ({
  type: 'SEND_STARTED',
  clientRequestId: id,
  input,
  retry,
});

const play = (
  name: string,
  id = 'c-1',
  input: AskInput = TYPED
): ChatAction[] => {
  const exchange = RECORDED[name];
  if (exchange === undefined || exchange.kind !== 'STREAM')
    throw new Error(`${name}`);
  return [
    send(id, input),
    ...exchange.events.map(
      (event): ChatAction =>
        (event as { type: string }).type === 'stage'
          ? { type: 'STAGE', event: event as never }
          : { type: 'TERMINAL', event: event as never }
    ),
  ];
};

const info = (
  overrides: Partial<ChatInfo['quota']> = {},
  models?: PickerModel[]
): ChatInfo => ({
  models: models ?? [
    {
      slug: 'a/a',
      name: 'A',
      multiplier: 1,
      vision: true,
      units_per_msg: 18_000,
      default: false,
    },
    {
      slug: 'b/b',
      name: 'B',
      multiplier: 3,
      vision: false,
      units_per_msg: null,
      default: true,
    },
  ],
  quota: {
    configured: true,
    month: '2026-10',
    limit_units: 20_000_000,
    used_units: 10_000_000,
    reserved_units: 0,
    available_units: 10_000_000,
    ...overrides,
  },
  profile: { trader_type: 'DAY_TRADER' },
  cycle: { slot: '2026-09-18T20:55Z', data_status: 'FRESH' },
});

describe('the start', () => {
  it('has nothing on screen, nothing in flight, and has read nothing yet', () => {
    expect(initialChatState()).toEqual({
      infoStatus: 'idle',
      info: null,
      threadId: null,
      items: [],
      flight: null,
      modelSlug: null,
      next: 1,
    });
    expect(isBusy(initialChatState())).toBe(false);
  });

  it('every stage waits', () => {
    expect(Object.keys(emptyStages())).toEqual([...STAGES]);
    expect(Object.values(emptyStages()).every((s) => s === 'PENDING')).toBe(
      true
    );
  });
});

describe('the state route', () => {
  it('loading, then loaded', () => {
    const loading = reduce([{ type: 'INFO_LOADING' }]);
    expect(loading.infoStatus).toBe('loading');
    const loaded = chatReducer(loading, { type: 'INFO_LOADED', info: info() });
    expect(loaded).toMatchObject({ infoStatus: 'ready', info: info() });
  });

  it('a route that is not on is "unavailable"; any other failure is an error', () => {
    expect(
      reduce([{ type: 'INFO_FAILED', reason: 'DISABLED' }]).infoStatus
    ).toBe('unavailable');
    expect(reduce([{ type: 'INFO_FAILED', reason: 'FAILED' }]).infoStatus).toBe(
      'error'
    );
    expect(
      reduce([{ type: 'INFO_FAILED', reason: 'NETWORK' }]).infoStatus
    ).toBe('error');
  });

  it('a failed reload keeps what was read before', () => {
    const state = reduce([
      { type: 'INFO_LOADED', info: info() },
      { type: 'INFO_LOADING' },
      { type: 'INFO_FAILED', reason: 'NETWORK' },
    ]);
    expect(state.info).toEqual(info());
    expect(state.infoStatus).toBe('error');
  });
});

describe('a request, from its start to its end', () => {
  it('shows the question, puts the request in flight and starts every stage waiting', () => {
    const state = reduce([send()]);
    expect(state.items).toEqual([{ id: 'm1', kind: 'USER', input: TYPED }]);
    expect(state.flight).toEqual({
      clientRequestId: 'c-1',
      input: TYPED,
      stages: emptyStages(),
    });
    expect(isBusy(state)).toBe(true);
  });

  it('a stage event changes that stage and no other', () => {
    const state = reduce([
      send(),
      {
        type: 'STAGE',
        event: { type: 'stage', stage: 'DATA', status: 'STARTED', ms: null },
      },
    ]);
    expect(state.flight?.stages).toEqual({ ...emptyStages(), DATA: 'STARTED' });
  });

  it('a stage event with nothing in flight is ignored', () => {
    const state = chatReducer(initialChatState(), {
      type: 'STAGE',
      event: { type: 'stage', stage: 'GATE', status: 'STARTED', ms: null },
    });
    expect(state).toEqual(initialChatState());
  });

  it('plays the recorded report: the stages in order, then the card, the thread and the end of the flight', () => {
    const during = reduce(play('report1-long').slice(0, 4));
    expect(during.flight?.stages).toMatchObject({
      GATE: 'DONE',
      UNDERSTAND: 'STARTED',
    });
    const done = reduce(play('report1-long'));
    expect(done.flight).toBeNull();
    expect(done.items.map((i) => i.kind)).toEqual(['USER', 'RESULT']);
    const item = done.items[1];
    expect(item).toMatchObject({
      kind: 'RESULT',
      requestId: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(done.threadId).toBe(resultOf('report1-long').thread_id);
  });

  it('a button press skips the Understand stage and the reducer says so', () => {
    const state = reduce(play('report1-short-instant', 'c-2', INSTANT));
    expect(state.items[0]).toEqual({ id: 'm1', kind: 'USER', input: INSTANT });
    expect(state.flight).toBeNull();
    const skipped = reduce(
      play('report1-short-instant', 'c-2', INSTANT).slice(0, 4)
    );
    expect(skipped.flight?.stages.UNDERSTAND).toBe('SKIPPED');
  });

  it('the data stopped: the stages after it are skipped and the card is the fixed answer', () => {
    const state = reduce(play('fixed-stale'));
    expect(state.items[1]).toMatchObject({
      kind: 'RESULT',
      result: { kind: 'FIXED_ANSWER' },
    });
    expect(state.flight).toBeNull();
  });

  it('a refusal in the stream ends the flight and keeps the thread as it was', () => {
    const state = reduce(play('refusal-out-of-scope'));
    expect(state.items[1]).toMatchObject({
      kind: 'REFUSAL',
      quota: null,
      refusal: { code: 'OUT_OF_SCOPE' },
    });
    expect(state.flight).toBeNull();
    expect(state.threadId).toBeNull();
  });

  it('an error event ends the flight and remembers what to send again', () => {
    const state = reduce(play('error-persistence', 'c-9'));
    expect(state.items[1]).toMatchObject({
      kind: 'ERROR',
      code: 'PERSISTENCE_FAILED',
      retryable: false,
      clientRequestId: 'c-9',
      input: TYPED,
      requestId: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(state.flight).toBeNull();
  });

  it('every recorded stream ends the flight, and the ids of the items are all different', () => {
    for (const name of Object.keys(RECORDED)) {
      if (RECORDED[name]?.kind !== 'STREAM') continue;
      const state = reduce(play(name));
      expect({ name, flight: state.flight }).toEqual({ name, flight: null });
      const ids = state.items.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('the thread is the reply’s, and the next question goes into it', () => {
    const state = reduce([
      ...play('report1-long', 'c-1'),
      ...play('answer', 'c-2').slice(0, 1),
    ]);
    expect(state.threadId).toBe(resultOf('report1-long').thread_id);
    expect(state.items.map((i) => i.kind)).toEqual(['USER', 'RESULT', 'USER']);
  });
});

describe('a request that failed on the way', () => {
  const failed = (
    failure: Parameters<typeof failureFromBody>[0] extends never
      ? never
      : unknown,
    input = TYPED
  ) =>
    reduce([
      send('c-3', input),
      {
        type: 'SEND_FAILED',
        failure: failure as never,
        clientRequestId: 'c-3',
        input,
      },
    ]);

  it('the answer before the stream, with a balance, is a refusal with the numbers', () => {
    const exchange = RECORDED['refusal-quota'];
    if (exchange?.kind !== 'JSON') throw new Error('x');
    const state = failed(failureFromBody(exchange.status, exchange.body));
    expect(state.flight).toBeNull();
    expect(state.items[1]).toMatchObject({
      kind: 'REFUSAL',
      refusal: { code: 'QUOTA_INSUFFICIENT' },
      quota: {
        limit_units: 20_000_000,
        available_units: 30_000,
        needed_units: 44_302,
      },
    });
  });

  it.each([
    [{ kind: 'NETWORK' }, 'NETWORK', true],
    [{ kind: 'BAD_STREAM' }, 'BAD_STREAM', true],
    [
      { kind: 'FAILED', status: 503, code: 'INTERNAL', requestId: 'r1' },
      'INTERNAL',
      true,
    ],
    [
      { kind: 'FAILED', status: 500, code: 'INTERNAL', requestId: null },
      'INTERNAL',
      true,
    ],
    [
      { kind: 'FAILED', status: 400, code: 'BAD_REQUEST', requestId: null },
      'BAD_REQUEST',
      false,
    ],
    [
      {
        kind: 'FAILED',
        status: 413,
        code: 'PAYLOAD_TOO_LARGE',
        requestId: null,
      },
      'PAYLOAD_TOO_LARGE',
      false,
    ],
  ])('%j is an error card (%s), retryable: %s', (failure, code, retryable) => {
    const state = failed(failure);
    expect(state.flight).toBeNull();
    expect(state.items[1]).toMatchObject({
      kind: 'ERROR',
      code,
      retryable,
      clientRequestId: 'c-3',
      input: TYPED,
    });
  });

  it('the trader’s own stop leaves a note and ends the flight', () => {
    const state = failed({ kind: 'ABORTED' });
    expect(state.items.map((i) => i.kind)).toEqual(['USER', 'CANCELLED']);
    expect(state.flight).toBeNull();
  });

  it('a route that is not switched on takes the question it just showed away and says "unavailable"', () => {
    const state = failed({ kind: 'DISABLED' });
    expect(state.items).toEqual([]);
    expect(state.infoStatus).toBe('unavailable');
    expect(state.flight).toBeNull();
  });

  it('that never removes an item that is not the question', () => {
    const state = reduce([
      ...play('report1-long', 'c-1'),
      {
        type: 'SEND_FAILED',
        failure: { kind: 'DISABLED' },
        clientRequestId: 'c-2',
        input: TYPED,
      },
    ]);
    expect(state.items.map((i) => i.kind)).toEqual(['USER', 'RESULT']);
  });

  it('every way out of "in flight" leaves nothing in flight', () => {
    const failures = [
      { kind: 'ABORTED' },
      { kind: 'NETWORK' },
      { kind: 'BAD_STREAM' },
      { kind: 'DISABLED' },
      { kind: 'FAILED', status: 500, code: 'INTERNAL', requestId: null },
    ];
    for (const failure of failures) {
      expect(failed(failure).flight).toBeNull();
    }
  });
});

describe('Try again', () => {
  it('is the same request: no second bubble, the error it answers goes, the same id is in flight', () => {
    const errored = reduce([
      send('c-5'),
      {
        type: 'SEND_FAILED',
        failure: { kind: 'NETWORK' },
        clientRequestId: 'c-5',
        input: TYPED,
      },
    ]);
    expect(errored.items.map((i) => i.kind)).toEqual(['USER', 'ERROR']);
    const again = chatReducer(errored, send('c-5', TYPED, true));
    expect(again.items.map((i) => i.kind)).toEqual(['USER']);
    expect(again.flight?.clientRequestId).toBe('c-5');
    expect(again.flight?.stages).toEqual(emptyStages());
  });

  it('leaves an error of another request alone', () => {
    const errored = reduce([
      send('c-5'),
      {
        type: 'SEND_FAILED',
        failure: { kind: 'NETWORK' },
        clientRequestId: 'c-5',
        input: TYPED,
      },
    ]);
    const again = chatReducer(errored, send('c-6', TYPED, true));
    expect(again.items.map((i) => i.kind)).toEqual(['USER', 'ERROR']);
  });
});

describe('the model and the thread', () => {
  it('picking a model is remembered; a new thread clears the conversation and the flight but keeps what was read', () => {
    const state = reduce([
      { type: 'INFO_LOADED', info: info() },
      { type: 'SELECT_MODEL', slug: 'a/a' },
      ...play('report1-long'),
      { type: 'NEW_THREAD' },
    ]);
    expect(state.modelSlug).toBe('a/a');
    expect(state.items).toEqual([]);
    expect(state.threadId).toBeNull();
    expect(state.flight).toBeNull();
    expect(state.info).toEqual(info());
  });

  it('a new thread in flight drops the flight', () => {
    expect(reduce([send(), { type: 'NEW_THREAD' }]).flight).toBeNull();
  });
});

describe('chosenModel', () => {
  const state = (
    modelSlug: string | null,
    models?: PickerModel[]
  ): ChatState => ({
    ...initialChatState(),
    modelSlug,
    info: info({}, models),
  });

  it('is the one picked', () =>
    expect(chosenModel(state('a/a'))?.slug).toBe('a/a'));
  it('is the default when none is picked', () =>
    expect(chosenModel(state(null))?.slug).toBe('b/b'));
  it('is the default when the one picked is no longer offered', () =>
    expect(chosenModel(state('gone/gone'))?.slug).toBe('b/b'));
  it('is the first when there is no default', () => {
    const models = info().models.map((m) => ({ ...m, default: false }));
    expect(chosenModel(state(null, models))?.slug).toBe('a/a');
  });
  it('is nothing when no model passed, and before the state is read', () => {
    expect(chosenModel(state(null, []))).toBeNull();
    expect(chosenModel(initialChatState())).toBeNull();
  });
});

describe('shareLeft and analysesLeft: never a guess', () => {
  it.each([
    [{ available_units: 0 }, 0],
    [{ available_units: 10_000_000 }, 0.5],
    [{ available_units: 20_000_000 }, 1],
    [{ available_units: 30_000_000 }, 1],
    [{ available_units: -5 }, 0],
  ])('the share with %j is %s', (quota, share) => {
    expect(shareLeft(info(quota))).toBe(share);
  });

  it.each([
    [{ configured: false }],
    [{ limit_units: null }],
    [{ limit_units: 0 }],
    [{ available_units: null }],
  ])('the share is unknown with %j', (quota) => {
    expect(shareLeft(info(quota))).toBeNull();
  });

  it('the share is unknown before the state is read', () => {
    expect(shareLeft(null)).toBeNull();
  });

  const measured = info().models[0] as PickerModel;
  const unmeasured = info().models[1] as PickerModel;

  it('analyses left is what is free divided by the MEASURED cost of a message, rounded down', () => {
    expect(analysesLeft(info(), measured)).toBe(555);
    expect(analysesLeft(info({ available_units: 17_999 }), measured)).toBe(0);
    expect(analysesLeft(info({ available_units: 18_000 }), measured)).toBe(1);
  });

  it('analyses left is unknown while the cost is not measured, and with no model, and with no balance', () => {
    expect(analysesLeft(info(), unmeasured)).toBeNull();
    expect(analysesLeft(info(), null)).toBeNull();
    expect(analysesLeft(info({ available_units: null }), measured)).toBeNull();
    expect(analysesLeft(null, measured)).toBeNull();
    expect(analysesLeft(info(), { ...measured, units_per_msg: 0 })).toBeNull();
    expect(analysesLeft(info(), { ...measured, units_per_msg: -1 })).toBeNull();
  });

  it('is never negative', () => {
    expect(analysesLeft(info({ available_units: -100 }), measured)).toBe(0);
  });
});
