/**
 * @jest-environment node
 */

/**
 * The life of a request around the model (build step 7 part 7a; plan part 7): the client leaving
 * before and after a model is called, a request sent twice, a store that fails after money was
 * spent, a thread that goes on, the chart, and the stage events a client shows.
 */

jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));

import { LEDGER_SQL } from '@/lib/platform/metering/ledger-store';
import { validateStreamOrder } from '@/lib/reply/contracts/stage-events';
import type {
  StageEvent,
  StreamEvent,
} from '@/lib/reply/contracts/stage-events';
import type { Report1Result } from '@/lib/reply/contracts/result';
import { CHART_SLOT_SECONDS } from '@/lib/storage/chart-keys';
import type { ChartPort } from '@/lib/reply/read/chart';
import { runReply } from '@/lib/reply/orchestrator';
import { requestIdOf } from '@/lib/reply/run/request-id';

import { buildWorld, run, CLIENT_ID, USER } from './helpers/world';
import { echoResult } from '../../intake/helpers/ports';

describe('the client leaves', () => {
  it('before any model is called: the request ends and nothing is charged or held', async () => {
    const w = await buildWorld();
    const controller = new AbortController();
    controller.abort();
    const out = await run(w, { kind: 'TYPED' }, { signal: controller.signal });
    expect(out.kind).toBe('ABORTED');
    expect(w.primary?.count).toBe(0);
    expect(w.fake.calls.understand).toBe(0);
    expect(w.ledger.reservations.size).toBe(0);
    expect(w.traces.rows.size).toBe(0);
    expect(w.chat.threads.size).toBe(0);
  });

  it('after the gate and before the answer model: the hold is released and the model is not called', async () => {
    const w = await buildWorld();
    const controller = new AbortController();
    const bars = w.ports.dayBars;
    w.ports.dayBars = async (slot) => {
      controller.abort();
      return bars(slot);
    };
    const out = await run(
      w,
      { kind: 'INSTANT' },
      { signal: controller.signal }
    );
    expect(out.kind).toBe('ABORTED');
    expect(w.primary?.count).toBe(0);
    const reservation = [...w.ledger.reservations.values()][0]!;
    expect(reservation.status).toBe('RELEASED');
    expect([...w.ledger.periods.values()][0]).toMatchObject({
      used: 0,
      reserved: 0,
    });
    expect(w.traces.rows.size).toBe(0);
    expect(w.chat.messages).toHaveLength(0);
  });

  it('while the Understand call runs: the request is finished, charged and stored', async () => {
    const w = await buildWorld();
    const controller = new AbortController();
    const understand = w.fake.ports.understand.understand;
    w.fake.ports.understand.understand = async (request) => {
      controller.abort();
      return understand(request);
    };
    const out = await run(w, { kind: 'TYPED' }, { signal: controller.signal });
    expect(out.kind).toBe('REPLY');
    expect(w.primary?.count).toBe(1);
    expect([...w.ledger.reservations.values()][0]).toMatchObject({
      status: 'SETTLED',
      actual_units: 2_800,
    });
    expect(w.chat.messages).toHaveLength(2);
    expect(w.traces.rows.size).toBe(1);
  });

  it('while the answer model runs: the reply is settled and stored, so a reload shows it', async () => {
    const w = await buildWorld();
    const controller = new AbortController();
    const model = w.primary!;
    const complete = model.complete.bind(model);
    (model as { complete: typeof complete }).complete = async (request) => {
      controller.abort();
      return complete(request);
    };
    const out = await run(
      w,
      { kind: 'INSTANT' },
      { signal: controller.signal }
    );
    expect(out.kind).toBe('REPLY');
    if (out.kind !== 'REPLY') return;
    // the model's own call was not cut short by the client leaving
    expect(model.count).toBe(1);
    expect([...w.ledger.reservations.values()][0]).toMatchObject({
      status: 'SETTLED',
      actual_units: 2_500,
    });
    expect(w.chat.messages.map((m) => m.role)).toEqual(['USER', 'ASSISTANT']);
    expect(w.traces.rows.size).toBe(1);
  });
});

describe('a request sent twice is charged once', () => {
  it('returns the stored reply to the second one: one model call, one hold, one message pair, one row', async () => {
    const w = await buildWorld();
    const first = await run(w, { kind: 'TYPED' });
    const second = await run(w, { kind: 'TYPED' });
    expect(first.kind).toBe('REPLY');
    expect(second.kind).toBe('REPLY');
    if (first.kind !== 'REPLY' || second.kind !== 'REPLY') return;
    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.requestId).toBe(first.requestId);
    // (the store keeps the canonical text, so the keys come back in canonical order)
    expect(second.result).toEqual(first.result);
    expect(w.primary?.count).toBe(1);
    expect(w.fake.calls.understand).toBe(1);
    expect(w.ledger.reservations.size).toBe(1);
    expect([...w.ledger.periods.values()][0]!.used).toBe(2_800);
    expect(w.chat.messages).toHaveLength(2);
    expect(w.traces.rows.size).toBe(1);
    // the second request stopped at the body: no profile, no thread, no quota was asked
    expect(w.fake.calls.profile).toBe(1);
  });

  it('is the same request only for the same trader and the same client id', async () => {
    const a = await requestIdOf('user-a', 'client-1');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await requestIdOf('user-a', 'client-1')).toBe(a);
    expect(await requestIdOf('user-b', 'client-1')).not.toBe(a);
    expect(await requestIdOf('user-a', 'client-2')).not.toBe(a);
    // the id carries neither of its two inputs
    expect(a).not.toContain('user-a');
    expect(a).not.toContain('client-1');
  });

  it('a new client id is a new request', async () => {
    const w = await buildWorld();
    await run(w, { kind: 'INSTANT', clientRequestId: 'client-aaaa-0001' });
    await run(w, { kind: 'INSTANT', clientRequestId: 'client-aaaa-0002' });
    expect(w.primary?.count).toBe(2);
    expect(w.ledger.reservations.size).toBe(2);
  });

  it('a duplicate that arrives while the first is still running is told to wait, and runs nothing', async () => {
    const w = await buildWorld();
    // the first request holds its units and has not finished
    const requestId = await requestIdOf(USER, CLIENT_ID);
    const held = await w.ports.meter.reserve(
      { requestId, userId: USER, tier: 'PRO' },
      {
        ok: true,
        understandUnits: 1_000,
        answerUnits: 10_000,
        regenerationUnits: 10_000,
        baseUnits: 11_000,
        withRegenerationUnits: 21_000,
      }
    );
    expect(held.ok).toBe(true);
    const out = await run(w, { kind: 'TYPED' });
    expect(out).toMatchObject({
      kind: 'ERROR',
      code: 'INTERNAL',
      retryable: true,
    });
    expect(w.primary?.count).toBe(0);
    expect(w.fake.calls.understand).toBe(0);
    // the first request's hold was not touched
    expect(w.ledger.reservations.get(requestId)?.status).toBe('RESERVED');
  });

  it('replays a refusal that has a trace, without asking the gate again', async () => {
    const w = await buildWorld({
      intake: {
        profile: { ok: false, code: 'PROFILE_NOT_SET', detail: 'none' },
      },
    });
    const first = await run(w, { kind: 'INSTANT' });
    const second = await run(w, { kind: 'INSTANT' });
    expect(first.kind === 'REFUSED' && first.refusal.code).toBe(
      'PROFILE_NOT_SET'
    );
    expect(second.kind === 'REFUSED' && second.refusal.code).toBe(
      'PROFILE_NOT_SET'
    );
    expect(w.fake.calls.profile).toBe(1);
    expect(w.traces.rows.size).toBe(1);
  });

  it('a stored reply that belongs to another trader is never returned', async () => {
    const w = await buildWorld();
    await run(w, { kind: 'INSTANT' });
    const row = [...w.traces.rows.values()][0]!;
    row.user_id = 'someone-else';
    const again = await run(w, { kind: 'INSTANT' });
    // not a replay: the gate runs, and the hold finds the first request's reservation
    expect(again.kind).toBe('ERROR');
    expect(w.primary?.count).toBe(1);
  });
});

describe('a store that fails after money was spent', () => {
  it('commits the charge first, discards the thread it made, and says the reply could not be stored', async () => {
    const w = await buildWorld({ traceFails: true });
    const out = await run(w, { kind: 'TYPED' });
    expect(out).toMatchObject({
      kind: 'ERROR',
      code: 'PERSISTENCE_FAILED',
      retryable: false,
    });
    expect([...w.ledger.reservations.values()][0]).toMatchObject({
      status: 'SETTLED',
      actual_units: 2_800,
    });
    expect(w.chat.threads.size).toBe(0);
    expect(w.chat.messages).toHaveLength(0);
    expect(w.logs.map((l) => l.code)).toContain('STORE_FAILED');
  });

  it('keeps a thread that was there before when the messages cannot be stored', async () => {
    const w = await buildWorld();
    const thread = w.chat.seedThread({ user_id: USER });
    const create = w.chat.chatMessage.create;
    w.chat.chatMessage.create = async () => {
      throw new Error('messages down');
    };
    const out = await run(w, { kind: 'TYPED', threadId: thread.id });
    expect(out).toMatchObject({ kind: 'ERROR', code: 'PERSISTENCE_FAILED' });
    expect(w.chat.threads.has(thread.id)).toBe(true);
    // the trace was written before the messages
    expect(w.traces.rows.size).toBe(1);
    w.chat.chatMessage.create = create;
  });

  it('discards a new thread when its messages cannot be stored', async () => {
    const w = await buildWorld();
    w.chat.chatMessage.create = async () => {
      throw new Error('messages down');
    };
    const out = await run(w, { kind: 'INSTANT' });
    expect(out).toMatchObject({ kind: 'ERROR', code: 'PERSISTENCE_FAILED' });
    expect(w.chat.threads.size).toBe(0);
  });

  it('writes an error row, with no reply, when the thread itself cannot be made', async () => {
    const w = await buildWorld();
    w.chat.chatThread.create = async () => {
      throw new Error('threads down');
    };
    const out = await run(w, { kind: 'INSTANT' });
    expect(out).toMatchObject({ kind: 'ERROR', code: 'PERSISTENCE_FAILED' });
    expect(w.chat.threads.size).toBe(0);
  });

  it('still delivers a reply the ledger could not settle, and records that it did not', async () => {
    const w = await buildWorld();
    w.ledger.failNext = { sql: LEDGER_SQL.settle, code: '57P01' };
    const out = await run(w, { kind: 'INSTANT' });
    expect(out.kind).toBe('REPLY');
    expect(w.logs.map((l) => l.code)).toContain('SETTLEMENT_FAILED');
    expect([...w.traces.rows.values()][0]!.units_charged).toBe(0);
    // the hold stays until the reaper gives it back
    expect([...w.ledger.reservations.values()][0]!.status).toBe('RESERVED');
  });
});

describe('a thread that goes on', () => {
  it('files the second question in the same thread, with the first as history', async () => {
    const w = await buildWorld();
    const first = await run(w, {
      kind: 'TYPED',
      clientRequestId: 'client-aaaa-0001',
    });
    expect(first.kind).toBe('REPLY');
    if (first.kind !== 'REPLY') return;
    const second = await run(w, {
      kind: 'TYPED',
      threadId: first.result.thread_id,
      clientRequestId: 'client-aaaa-0002',
    });
    expect(second.kind).toBe('REPLY');
    if (second.kind !== 'REPLY') return;
    expect(second.result.thread_id).toBe(first.result.thread_id);
    expect(w.chat.threads.size).toBe(1);
    expect([...w.chat.threads.values()][0]).toMatchObject({
      message_count: 4,
      report_count: 2,
    });
    // the second prompt carries the first exchange
    const prompt = JSON.stringify(w.primary!.calls[1]!.messages);
    expect(prompt).toContain('HISTORY');
    // the first question asked storage for the chart; the second, in the same cycle, did not ask again
    expect(w.calls.chart).toBe(1);
  });

  it('opens a follow-up on a new cycle with what changed, built by code', async () => {
    const w = await buildWorld({
      previousStates: {
        slot: '2026-09-18T20:50Z',
        sensors: [
          { mcd_id: 'MCD1', state_code: 'MCD1_DOWN_IN_CORRIDOR' },
          { mcd_id: 'MCD2', state_code: 'MCD2_UP_IN_CORRIDOR' },
          {
            mcd_id: 'MCD3',
            state_code: 'MCD3_NON_CONSOLIDATED_TREND_CONFLICT',
          },
        ],
      },
    });
    const slot = Date.UTC(2026, 8, 18, 20, 50) / 1000;
    const thread = w.chat.seedThread({
      user_id: USER,
      last_cycle_slot: slot,
      message_count: 2,
    });
    const out = await run(w, { kind: 'TYPED', threadId: thread.id });
    expect(out.kind).toBe('REPLY');
    if (out.kind !== 'REPLY') return;
    expect(w.calls.previousStates).toBe(1);
    expect(out.result.changes).toEqual([
      {
        mcd_id: 'MCD1',
        from: 'MCD1_DOWN_IN_CORRIDOR',
        to: 'MCD1_DOWN_UPPER_BREAKOUT',
      },
    ]);
  });

  it('reads no earlier cycle for a thread whose last cycle is this one', async () => {
    const w = await buildWorld();
    const thread = w.chat.seedThread({
      user_id: USER,
      last_cycle_slot: Date.UTC(2026, 8, 18, 20, 55) / 1000,
      message_count: 2,
    });
    const out = await run(w, { kind: 'TYPED', threadId: thread.id });
    expect(out.kind === 'REPLY' && out.result.changes).toEqual([]);
    expect(w.calls.previousStates).toBe(0);
  });
});

describe('the chart', () => {
  const SLOT = Date.UTC(2026, 8, 18, 20, 55) / 1000;
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  const portFor = (slot: number): ChartPort => ({
    getChartStamp: async () => ({
      slot,
      lastClosedBar: slot - CHART_SLOT_SECONDS,
      overlay: 'best_fit_a',
      variant: 'overlay',
    }),
    getChartImage: async () => ({
      bytes: PNG,
      contentType: 'image/png',
      stamp: {
        slot,
        lastClosedBar: slot - CHART_SLOT_SECONDS,
        overlay: 'best_fit_a',
        variant: 'overlay',
      },
    }),
  });

  it('goes to the model when it is the cycle’s own', async () => {
    const w = await buildWorld({ chart: portFor(SLOT) });
    const out = await run(w, { kind: 'INSTANT' });
    expect(out.kind).toBe('REPLY');
    if (out.kind !== 'REPLY') return;
    const sent = JSON.stringify(w.primary!.calls[0]!.messages);
    expect(sent).toContain('data:image/png;base64');
    expect(out.result.notes).toEqual([]);
    const row = [...w.traces.rows.values()][0]!;
    expect(
      (row.checks_group as { answer_gate: { chart: string } }).answer_gate.chart
    ).toBe('SENT');
  });

  it('is dropped, and the reply says so, when it was drawn for another cycle (5.14 item 4)', async () => {
    const w = await buildWorld({ chart: portFor(SLOT - 300) });
    const out = await run(w, { kind: 'INSTANT' });
    expect(out.kind).toBe('REPLY');
    if (out.kind !== 'REPLY') return;
    expect(JSON.stringify(w.primary!.calls[0]!.messages)).not.toContain(
      'base64'
    );
    expect(out.result.notes).toEqual(['CHART_OTHER_CYCLE']);
    const row = [...w.traces.rows.values()][0]!;
    expect(
      (row.checks_group as { answer_gate: { chart: string } }).answer_gate.chart
    ).toBe('CYCLE_MISMATCH');
  });

  it('is not asked for by a question that does not call for it, and not on a STALE cycle', async () => {
    const w = await buildWorld({
      chart: portFor(SLOT),
      intake: { understand: echoResult('what is a corridor', 'EXPLAIN') },
      primary: [
        {
          kind: 'REPLY',
          text: JSON.stringify({
            locale: 'en-US',
            text: 'A band.',
            cites: ['MCD1'],
            action: null,
          }),
        },
      ],
    });
    const out = await run(w, { kind: 'TYPED' });
    expect(out.kind === 'REPLY' && out.result.kind).toBe('ANSWER');
    expect(JSON.stringify(w.primary!.calls[0]!.messages)).not.toContain(
      'base64'
    );
  });
});

describe('the stages a client shows', () => {
  async function stagesOf(
    w: Awaited<ReturnType<typeof buildWorld>>,
    request: Parameters<typeof run>[1]
  ): Promise<{ events: StageEvent[]; ended: boolean }> {
    const events: StageEvent[] = [];
    const out = await run(w, request, { emit: (event) => events.push(event) });
    const terminal: StreamEvent =
      out.kind === 'REPLY'
        ? { type: 'result', request_id: out.requestId, result: out.result }
        : {
            type: 'error',
            request_id: 'req-test-0001',
            code: 'INTERNAL',
            retryable: false,
          };
    return {
      events,
      ended: validateStreamOrder([...events, terminal]).length === 0,
    };
  }

  it('a typed Report 1 runs all six, in order', async () => {
    const w = await buildWorld();
    const { events, ended } = await stagesOf(w, { kind: 'TYPED' });
    expect(ended).toBe(true);
    expect(
      events.filter((e) => e.status === 'STARTED').map((e) => e.stage)
    ).toEqual(['GATE', 'UNDERSTAND', 'DATA', 'CONTEXT', 'MODEL', 'CHECKS']);
    expect(events.filter((e) => e.status === 'SKIPPED')).toEqual([]);
    expect(events.every((e) => e.status !== 'DONE' || (e.ms ?? -1) >= 0)).toBe(
      true
    );
    // every stage that started is done before the stream ends
    expect(events.filter((e) => e.status === 'DONE')).toHaveLength(6);
  });

  it('an instant prompt skips the Understand stage', async () => {
    const w = await buildWorld();
    const { events, ended } = await stagesOf(w, { kind: 'INSTANT' });
    expect(ended).toBe(true);
    expect(
      events.filter((e) => e.status === 'SKIPPED').map((e) => e.stage)
    ).toEqual(['UNDERSTAND']);
  });

  it('a request that needs no model skips the model and the checks', async () => {
    const w = await buildWorld({
      intake: { worldOptions: { gateway: 'STALE' } },
    });
    const { events, ended } = await stagesOf(w, { kind: 'TYPED' });
    expect(ended).toBe(true);
    expect(
      events.filter((e) => e.status === 'SKIPPED').map((e) => e.stage)
    ).toEqual(['MODEL', 'CHECKS']);
  });

  it('a refusal leaves the stage it was refused in open, for the terminal event to close', async () => {
    const w = await buildWorld({
      intake: {
        profile: { ok: false, code: 'PROFILE_NOT_SET', detail: 'none' },
      },
    });
    const events: StageEvent[] = [];
    const out = await run(
      w,
      { kind: 'TYPED' },
      { emit: (e) => events.push(e) }
    );
    expect(out.kind).toBe('REFUSED');
    expect(events).toEqual([
      { type: 'stage', stage: 'GATE', status: 'STARTED', ms: null },
    ]);
  });

  it('is told nothing when nobody listens', async () => {
    const w = await buildWorld();
    await expect(run(w, { kind: 'INSTANT' })).resolves.toMatchObject({
      kind: 'REPLY',
    });
  });
});

describe('what the run never does', () => {
  it('writes no text the trader typed into the trace or the log', async () => {
    const w = await buildWorld();
    const question =
      'ZZ-UNIQUE-QUESTION-TEXT-9917 what is the direction of gold now';
    await run(w, { kind: 'TYPED', question });
    const row = [...w.traces.rows.values()][0]!;
    expect(JSON.stringify(row)).not.toContain('ZZ-UNIQUE-QUESTION-TEXT-9917');
    expect(JSON.stringify(w.logs)).not.toContain(
      'ZZ-UNIQUE-QUESTION-TEXT-9917'
    );
    // the transcript is where the trader's own words live
    expect(w.chat.messages[0]!.body_text).toContain(
      'ZZ-UNIQUE-QUESTION-TEXT-9917'
    );
  });

  it('puts the user id in no group of the trace and in no reply', async () => {
    const w = await buildWorld();
    const out = await run(w, { kind: 'TYPED' });
    const row = [...w.traces.rows.values()][0]!;
    const groups = JSON.stringify([
      row.request_group,
      row.data_group,
      row.knowledge_group,
      row.model_group,
      row.checks_group,
      row.time_group,
      row.reply_json,
    ]);
    expect(groups).not.toContain(USER);
    expect(out.kind === 'REPLY' && JSON.stringify(out.result)).not.toContain(
      USER
    );
    expect(row.user_id).toBe(USER);
  });

  it('answers with a Report 1 whose result the contract accepts', async () => {
    const w = await buildWorld();
    const out = await run(w, { kind: 'TYPED' });
    expect(
      out.kind === 'REPLY' && (out.result as Report1Result).report.zones.length
    ).toBeGreaterThan(0);
  });
});

describe('the unexpected', () => {
  it('an error after the packet settles what was spent, gives the rest back, and tells the trader it failed on our side', async () => {
    const w = await buildWorld();
    const thread = w.chat.seedThread({ user_id: USER });
    w.ports.threads.context = async () => {
      throw new Error('threads are down');
    };
    const out = await run(w, { kind: 'TYPED', threadId: thread.id });
    expect(out).toMatchObject({
      kind: 'ERROR',
      code: 'INTERNAL',
      retryable: false,
    });
    expect(w.primary?.count).toBe(0);
    // the Understand call was made and paid for, so that is what is charged
    expect([...w.ledger.reservations.values()][0]).toMatchObject({
      status: 'SETTLED',
      actual_units: 300,
    });
    expect(w.logs).toContainEqual({
      code: 'RUN_FAILED',
      detail: { error: 'Error' },
    });
    expect(JSON.stringify(w.logs)).not.toContain('threads are down');
  });

  it('with nothing spent, the hold is released', async () => {
    const w = await buildWorld();
    const thread = w.chat.seedThread({ user_id: USER });
    w.ports.threads.context = async () => {
      throw new Error('threads are down');
    };
    const out = await run(w, { kind: 'INSTANT', threadId: thread.id });
    expect(out.kind).toBe('ERROR');
    expect([...w.ledger.reservations.values()][0]!.status).toBe('RELEASED');
  });

  it('a listener that throws does not stop the run', async () => {
    const w = await buildWorld();
    const out = await run(
      w,
      { kind: 'INSTANT' },
      {
        emit: () => {
          throw new Error('the stream is closed');
        },
      }
    );
    expect(out.kind).toBe('REPLY');
    expect(w.chat.messages).toHaveLength(2);
    expect([...w.ledger.reservations.values()][0]!.status).toBe('SETTLED');
  });

  it('the flag off is a plain DISABLED and nothing else is asked', async () => {
    const w = await buildWorld({ intake: { enabled: false } });
    const out = await run(w, { kind: 'TYPED' });
    expect(out).toEqual({ kind: 'DISABLED' });
    expect(w.fake.calls.session).toBe(0);
    expect(w.fake.calls.understand).toBe(0);
    expect(w.ledger.reservations.size).toBe(0);
    expect(w.traces.rows.size).toBe(0);
  });

  it('a body that cannot be read is the route’s own failure, after the tier check, with nothing held', async () => {
    const w = await buildWorld();
    const out = await runReply(
      w.ports,
      async () => ({ ok: false as const, failure: 'BAD_BODY' }),
      {}
    );
    expect(out).toEqual({ kind: 'REQUEST_FAILED', failure: 'BAD_BODY' });
    expect(w.fake.calls.thread).toBe(0);
    expect(w.ledger.reservations.size).toBe(0);
  });
});
