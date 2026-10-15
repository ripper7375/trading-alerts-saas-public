/**
 * @jest-environment node
 */

/**
 * The corners of the orchestrator that the mutation check of part 7a found untested: the
 * arguments it passes, the log codes support reads, the stored rows of failures, the chart rule's
 * history test, the thread title, and the edges of the extra call. Each test names a thing a
 * wrong line would change.
 */

jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));

import type {
  FixedAnswerResult,
  Report1Result,
} from '@/lib/reply/contracts/result';
import { badJson, plantLiteral } from '@/lib/reply/gateway/fixture';
import type { FixtureScript } from '@/lib/reply/gateway/fixture';
import { REPLY_DEADLINE_MS } from '@/lib/reply/orchestrator';
import { HoldStopped } from '@/lib/reply/run/hold';
import { requestIdOf } from '@/lib/reply/run/request-id';
import { MIN_EXTRA_CALL_MS } from '@/lib/reply/run/answer-step';

import { echoResult } from '../../intake/helpers/ports';
import { modelReportFor } from '../report1/helpers/report1-fixtures';
import {
  CLIENT_ID,
  GOLDENS,
  USER,
  buildWorld,
  run,
  type ReplyWorld,
} from './helpers/world';

const reply = (text: string, cost = 2_500): FixtureScript => ({
  kind: 'REPLY',
  text,
  usage: {
    prompt_tokens: 14_000,
    completion_tokens: 300,
    cost_micro_usd: cost,
  },
});
const logCodes = (w: ReplyWorld): string[] => w.logs.map((l) => l.code);
const SLOT = Date.UTC(2026, 8, 18, 20, 55) / 1000;

async function goodTexts() {
  const probe = await buildWorld();
  const good = JSON.stringify(modelReportFor(probe.packet, probe.dictionary));
  return { good, wrong: plantLiteral(good, '{LAST_PRICE}', '4999.99') };
}

describe('what a clean run says', () => {
  it('logs nothing at all, and the trace of a primary-only run has no fallback and a real prompt', async () => {
    const w = await buildWorld();
    const out = await run(w, { kind: 'TYPED' });
    expect(out.kind).toBe('REPLY');
    expect(w.logs).toEqual([]);
    const row = [...w.traces.rows.values()][0]!;
    const model = row.model_group as {
      fallback_used: boolean;
      cycle_block_sha256: string;
      components: Record<string, number>;
      prompt_version: string;
    };
    expect(model.fallback_used).toBe(false);
    expect(model.cycle_block_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(model.prompt_version).toBe('prompts.v1');
    expect(model.components['BOARD_SYNTHESIS']).toBeGreaterThan(0);
    expect(model.components['OHLC']).toBeGreaterThan(0);
    expect(model.components['QUESTION']).toBeGreaterThan(0);
  });

  it('the thread is titled from the answer: the bias of a report, none for a short answer', async () => {
    const w = await buildWorld();
    await run(w, { kind: 'TYPED' });
    expect([...w.chat.threads.values()][0]!.title).toBe(
      'XAUUSD · LONG · 18 SEP 20:55'
    );

    const short = await buildWorld({
      intake: { understand: echoResult('what is a corridor', 'EXPLAIN') },
      primary: [
        reply(
          JSON.stringify({
            locale: 'en-US',
            text: 'A band.',
            cites: ['MCD1'],
            action: null,
          })
        ),
      ],
    });
    await run(short, { kind: 'TYPED' });
    expect([...short.chat.threads.values()][0]!.title).toBe(
      'XAUUSD · EXPLAIN · 18 SEP 20:55'
    );
  });

  it('a fixed answer that states a direction titles its thread with it, and one that does not does not', async () => {
    const live = await buildWorld({
      primary: [{ kind: 'FAIL', code: 'HTTP_500' }],
    });
    await run(live, { kind: 'TYPED' });
    expect([...live.chat.threads.values()][0]!.title).toBe(
      'XAUUSD · LONG · 18 SEP 20:55'
    );
    const row = [...live.traces.rows.values()][0]!;
    expect(
      (row.checks_group as { direction_equals_syn: boolean })
        .direction_equals_syn
    ).toBe(true);
    expect((row.model_group as { fallback_used: boolean }).fallback_used).toBe(
      false
    );
    expect(
      (row.checks_group as { schema_retries: number }).schema_retries
    ).toBe(0);

    const stale = await buildWorld({
      intake: { worldOptions: { gateway: 'STALE' } },
    });
    await run(stale, { kind: 'TYPED' });
    expect([...stale.chat.threads.values()][0]!.title).toBe(
      'XAUUSD · DIRECTION · 18 SEP 20:55'
    );
    const staleRow = [...stale.traces.rows.values()][0]!;
    expect(
      (staleRow.checks_group as { direction_equals_syn: null })
        .direction_equals_syn
    ).toBeNull();
    expect(
      (staleRow.model_group as { fallback_used: boolean }).fallback_used
    ).toBe(false);
    expect(
      Object.values(
        (staleRow.model_group as { components: Record<string, number> })
          .components
      ).every((n) => n === 0)
    ).toBe(true);
  });

  it('asks the thread store nothing for a request that names no thread', async () => {
    const w = await buildWorld();
    const context = jest.spyOn(w.ports.threads, 'context');
    await run(w, { kind: 'INSTANT' });
    expect(context).not.toHaveBeenCalled();
    const thread = w.chat.seedThread({ user_id: USER });
    await run(w, {
      kind: 'INSTANT',
      threadId: thread.id,
      clientRequestId: 'client-aaaa-0009',
    });
    expect(context).toHaveBeenCalledTimes(1);
    expect(context).toHaveBeenCalledWith(USER, thread.id);
  });
});

describe('what the model is asked', () => {
  it('a report is asked for the report schema and an answer for the answer schema, at a low temperature, with the size of the prompt', async () => {
    const w = await buildWorld();
    await run(w, { kind: 'INSTANT' });
    const request = w.primary!.calls[0]!;
    expect(request.response).toMatchObject({
      kind: 'JSON_SCHEMA',
      name: 'report1_v1',
    });
    expect(request.temperature).toBe(0.2);
    expect(request.max_output_tokens).toBe(4_096);
    expect(request.estimated_prompt_tokens).toBeGreaterThan(1_000);
    expect(request.estimated_prompt_tokens).toBeLessThan(19_600);

    const short = await buildWorld({
      intake: { understand: echoResult('what is a corridor', 'EXPLAIN') },
      primary: [
        reply(
          JSON.stringify({
            locale: 'en-US',
            text: 'A band.',
            cites: ['MCD1'],
            action: null,
          })
        ),
      ],
    });
    await run(short, { kind: 'TYPED' });
    expect(short.primary!.calls[0]!.response).toMatchObject({
      name: 'answer_v1',
    });
  });

  it('the second call is asked for a prompt that holds the first reply and the instruction', async () => {
    const t = await goodTexts();
    const w = await buildWorld({ primary: [reply(t.wrong), reply(t.good)] });
    await run(w, { kind: 'INSTANT' });
    const [first, second] = w.primary!.calls;
    expect(second!.estimated_prompt_tokens!).toBeGreaterThan(
      first!.estimated_prompt_tokens!
    );
  });
});

describe('the deadline', () => {
  it('is 55 seconds unless the run is told another, and the primary waits no longer than it', async () => {
    expect(REPLY_DEADLINE_MS).toBe(55_000);
    const a = await buildWorld();
    await run(a, { kind: 'INSTANT' });
    expect(a.calls.deadlineArgs).toEqual([55_000]);
    const b = await buildWorld();
    await run(b, { kind: 'INSTANT' }, { deadlineMs: 30_000 });
    expect(b.calls.deadlineArgs).toEqual([30_000]);
  });

  it('an extra call needs 12 seconds before the deadline, to the millisecond', async () => {
    const t = await goodTexts();
    expect(MIN_EXTRA_CALL_MS).toBe(12_000);
    const enough = await buildWorld({
      primary: [reply(t.wrong), reply(t.good)],
    });
    await run(enough, { kind: 'INSTANT' }, { deadlineMs: 12_000 });
    expect(enough.primary?.count).toBe(2);
    const short = await buildWorld({
      primary: [reply(t.wrong), reply(t.good)],
    });
    const out = await run(short, { kind: 'INSTANT' }, { deadlineMs: 11_999 });
    expect(short.primary?.count).toBe(1);
    // with no time for a second call the number is flagged and the reply is shown
    expect(
      out.kind === 'REPLY' && (out.result as Report1Result).checks
    ).toEqual({
      numbers_flagged: 1,
      regenerations: 0,
    });
  });
});

describe('the model step, corner by corner', () => {
  it('names why the models failed in the log', async () => {
    const w = await buildWorld({
      primary: [{ kind: 'FAIL', code: 'TIMEOUT' }],
      fallback: [{ kind: 'FAIL', code: 'HTTP_500' }],
    });
    await run(w, { kind: 'INSTANT' });
    expect(w.logs).toContainEqual({
      code: 'MODEL_FAILED',
      detail: { failure: 'HTTP_500' },
    });
  });

  it('a prompt that cannot fit the model window is not sent: the board-only answer, and the log says why', async () => {
    const w = await buildWorld({
      primaryTarget: {
        slug: 'fixture-a/recorded',
        vision: true,
        context_budget: 2_000,
        max_output_tokens: 4_096,
        json_schema: true,
        prompt_caching: 'AUTO',
        provider_only: null,
        price_in: 1,
        price_out: 4,
        calibration: { marginBp: 0, charsPerToken: 4 } as never,
      },
    });
    const out = await run(w, { kind: 'INSTANT' });
    expect(out.kind === 'REPLY' && out.result.kind).toBe('FIXED_ANSWER');
    expect(
      out.kind === 'REPLY' && (out.result as FixedAnswerResult).fixed.reason
    ).toBe('MODEL_UNAVAILABLE');
    expect(w.primary?.count).toBe(0);
    expect(w.logs.map((l) => l.code)).toContain('ASSEMBLE_REFUSED');
    // nothing was sent, so nothing was spent and the hold went back
    expect([...w.ledger.reservations.values()][0]!.status).toBe('RELEASED');
  });

  it('a schema retry that fails ends in the fixed answer and says so', async () => {
    const t = await goodTexts();
    const w = await buildWorld({
      primary: [reply(badJson(t.good)), { kind: 'FAIL', code: 'TIMEOUT' }],
    });
    const out = await run(w, { kind: 'INSTANT' });
    expect(
      out.kind === 'REPLY' && (out.result as FixedAnswerResult).fixed.reason
    ).toBe('SCHEMA_FAILED');
    expect(logCodes(w)).toContain('SCHEMA_RETRY_FAILED');
  });

  it('a schema failure with no second call is logged with no retries; with a second call, one', async () => {
    const t = await goodTexts();
    const none = await buildWorld({
      allowance: 50_000,
      primary: [reply('nope')],
    });
    await run(none, { kind: 'INSTANT' });
    expect(none.logs).toContainEqual({
      code: 'SCHEMA_FAILED',
      detail: { retries: 0 },
    });
    const one = await buildWorld({
      primary: [reply('nope'), reply('still nope')],
    });
    await run(one, { kind: 'INSTANT' });
    expect(one.logs).toContainEqual({
      code: 'SCHEMA_FAILED',
      detail: { retries: 1 },
    });
    void t;
  });

  it('a regeneration that is not valid JSON leaves the first reply to stand, and the bad call is classed', async () => {
    const t = await goodTexts();
    const w = await buildWorld({ primary: [reply(t.wrong), reply('{')] });
    const out = await run(w, { kind: 'INSTANT' });
    expect(
      out.kind === 'REPLY' && (out.result as Report1Result).checks
    ).toEqual({
      numbers_flagged: 1,
      regenerations: 1,
    });
    const calls = (
      [...w.traces.rows.values()][0]!.model_group as {
        calls: { outcome: string; role: string }[];
      }
    ).calls;
    expect(calls.map((c) => [c.role, c.outcome])).toEqual([
      ['ANSWER', 'OK'],
      ['REGENERATE', 'BAD_JSON'],
    ]);
  });
});

describe('the chart is asked for once a cycle', () => {
  function seed(
    w: ReplyWorld,
    rows: { role: string; kind: string; slot: number }[]
  ) {
    const thread = w.chat.seedThread({
      user_id: USER,
      message_count: rows.length,
    });
    rows.forEach((row, index) => {
      w.chat.messages.push({
        id: `m${index}`,
        thread_id: thread.id,
        seq: index + 1,
        request_id: `r${index}`,
        role: row.role,
        kind: row.kind,
        intent: 'DIRECTION',
        body_text: null,
        body_json: null,
        cycle_slot: row.slot,
        created_at: w.chat.now,
        expires_at: w.chat.now,
      });
    });
    return thread;
  }

  it.each([
    [
      'a report of this cycle is already there',
      [{ role: 'ASSISTANT', kind: 'REPORT1', slot: SLOT }],
      0,
    ],
    [
      'a report of an earlier cycle is not a report of this one',
      [{ role: 'ASSISTANT', kind: 'REPORT1', slot: SLOT - 300 }],
      1,
    ],
    [
      'a short answer of this cycle is not a report',
      [{ role: 'ASSISTANT', kind: 'ANSWER', slot: SLOT }],
      1,
    ],
    [
      'a message of the trader is not a report',
      [{ role: 'USER', kind: 'REPORT1', slot: SLOT }],
      1,
    ],
  ])('%s', async (_name, rows, chartReads) => {
    const w = await buildWorld();
    const thread = seed(w, rows);
    await run(w, { kind: 'TYPED', threadId: thread.id });
    expect(w.calls.chart).toBe(chartReads);
  });

  it('the first question of a new thread asks for it, the second of the same cycle does not', async () => {
    const w = await buildWorld();
    const first = await run(w, {
      kind: 'TYPED',
      clientRequestId: 'client-aaaa-0001',
    });
    expect(w.calls.chart).toBe(1);
    if (first.kind !== 'REPLY') throw new Error('no reply');
    await run(w, {
      kind: 'TYPED',
      threadId: first.result.thread_id,
      clientRequestId: 'client-aaaa-0002',
    });
    expect(w.calls.chart).toBe(1);
  });
});

describe('the day’s bars', () => {
  it('a day that cannot be read still gets a reply, and the log says what failed', async () => {
    const w = await buildWorld({ noBars: true });
    const out = await run(w, { kind: 'INSTANT' });
    expect(out.kind).toBe('REPLY');
    expect(w.logs).toContainEqual({
      code: 'DAY_BARS_UNAVAILABLE',
      detail: { code: 'DATABASE_ERROR' },
    });
    expect(JSON.stringify(w.primary!.calls[0]!.messages)).toContain('OHLC');
  });

  it('is read for a fixed answer on live data, which then shows the levels, and not on a stale cycle', async () => {
    // a live cycle whose synthesis is not running: there is no direction to state, but the sensors' levels are shown
    const world = { ...GOLDENS[0]!, synthesis: [] };
    const live = await buildWorld({ intake: { world } });
    const out = await run(live, { kind: 'TYPED' });
    expect(live.primary?.count).toBe(0);
    expect(live.calls.bars).toBe(1);
    // a request that needs no model never asks storage for a chart
    expect(live.calls.chart).toBe(0);
    const fixed =
      out.kind === 'REPLY' ? (out.result as FixedAnswerResult).fixed : null;
    expect(fixed?.reason).toBe('NO_SYNTHESIS');
    expect(fixed?.direction).toBeNull();
    expect(fixed?.levels.length).toBeGreaterThan(0);

    const stale = await buildWorld({
      intake: { worldOptions: { gateway: 'STALE' } },
    });
    await run(stale, { kind: 'TYPED' });
    expect(stale.calls.bars).toBe(0);
  });
});

describe('a request that fails in the intake path', () => {
  it('names the cause by kind and settles the hold', async () => {
    const plain = await buildWorld();
    plain.ports.intake.snapshot = async () => {
      throw new Error('market database down');
    };
    const out = await run(plain, { kind: 'INSTANT' });
    expect(out).toMatchObject({
      kind: 'ERROR',
      code: 'INTERNAL',
      retryable: false,
    });
    expect(plain.logs).toEqual([{ code: 'INTAKE_FAILED' }]);
    expect([...plain.ledger.reservations.values()][0]!.status).toBe('RELEASED');
    expect(plain.primary?.count).toBe(0);
    expect(JSON.stringify(plain.logs)).not.toContain('market database down');
  });

  it('a hold that stops the pipeline from inside is named', async () => {
    const w = await buildWorld();
    w.ports.intake.snapshot = async () => {
      throw new HoldStopped('TEST');
    };
    await run(w, { kind: 'INSTANT' });
    expect(w.logs).toEqual([{ code: 'HOLD_STOPPED' }]);
  });

  it('a packet that fails its own validator is named, and nothing is charged for it', async () => {
    const w = await buildWorld();
    w.fake.ports.knowledge.search = async () => ({
      knowledge: {
        status: 'OK',
        index_build_id: `kb-${'ab'.repeat(16)}`,
        chunks: [{ bogus: true } as never],
        expansions: [],
      },
      problems: [],
    });
    const out = await run(w, { kind: 'TYPED' });
    expect(out).toMatchObject({ kind: 'ERROR', code: 'INTERNAL' });
    expect(w.logs).toEqual([{ code: 'PACKET_INVALID' }]);
    expect(w.primary?.count).toBe(0);
  });

  it('an error that is not an Error is logged as unknown', async () => {
    const w = await buildWorld();
    const thread = w.chat.seedThread({ user_id: USER });
    w.ports.threads.context = async () => {
      throw 'not an error object';
    };
    await run(w, { kind: 'INSTANT', threadId: thread.id });
    expect(w.logs).toEqual([
      { code: 'RUN_FAILED', detail: { error: 'unknown' } },
    ]);
  });
});

describe('the request id of what the trader is told', () => {
  it('a request refused before its body was read has an id of its own; one refused after has the derived id', async () => {
    const early = await buildWorld({ intake: { session: null } });
    const refused = await run(early, { kind: 'TYPED' });
    expect(refused.kind === 'REFUSED' && refused.requestId).toBe(
      'anon-0000000000000001'
    );

    const late = await buildWorld({
      intake: {
        profile: { ok: false, code: 'PROFILE_NOT_SET', detail: 'none' },
      },
    });
    const out = await run(late, { kind: 'TYPED' });
    expect(out.kind === 'REFUSED' && out.requestId).toBe(
      await requestIdOf(USER, CLIENT_ID)
    );
  });

  it('a duplicate in flight, and a client that left, carry the derived id and say what they are', async () => {
    const w = await buildWorld();
    const requestId = await requestIdOf(USER, CLIENT_ID);
    await w.ports.meter.reserve(
      { requestId, userId: USER, tier: 'PRO' },
      {
        ok: true,
        understandUnits: 1,
        answerUnits: 10,
        regenerationUnits: 10,
        baseUnits: 11,
        withRegenerationUnits: 21,
      }
    );
    const dup = await run(w, { kind: 'TYPED' });
    expect(dup).toEqual({
      kind: 'ERROR',
      requestId,
      code: 'INTERNAL',
      retryable: true,
    });
    expect(w.logs).toContainEqual({
      code: 'DUPLICATE_REQUEST',
      detail: { status: 'RESERVED' },
    });

    const gone = await buildWorld();
    const controller = new AbortController();
    controller.abort();
    const aborted = await run(
      gone,
      { kind: 'TYPED' },
      { signal: controller.signal }
    );
    expect(aborted).toEqual({ kind: 'ABORTED', requestId });
  });

  it('a stored reply of another trader is not a replay: the hold finds the request taken', async () => {
    const w = await buildWorld();
    await run(w, { kind: 'INSTANT' });
    [...w.traces.rows.values()][0]!.user_id = 'someone-else';
    const again = await run(w, { kind: 'INSTANT' });
    expect(again.kind).toBe('ERROR');
    expect(logCodes(w)).toEqual(['DUPLICATE_REQUEST']);
  });
});

describe('a replay', () => {
  it('a lookup that fails does not stop the request', async () => {
    const w = await buildWorld();
    w.ports.traces.find = async () => {
      throw new Error('traces down');
    };
    const out = await run(w, { kind: 'INSTANT' });
    expect(out.kind).toBe('REPLY');
    expect(w.logs).toEqual([{ code: 'REPLAY_LOOKUP_FAILED' }]);
  });

  it('a stored row with no reply (an error row) cannot be replayed: the trader is told, and the log says why', async () => {
    const w = await buildWorld();
    w.chat.chatThread.create = async () => {
      throw new Error('threads down');
    };
    const first = await run(w, { kind: 'INSTANT' });
    expect(first).toMatchObject({ kind: 'ERROR', code: 'PERSISTENCE_FAILED' });
    const row = [...w.traces.rows.values()][0]!;
    expect(row).toMatchObject({
      outcome: 'ERROR',
      thread_id: null,
      reply_json: null,
      reply_sha256: null,
    });
    w.logs.length = 0;
    const again = await run(w, { kind: 'INSTANT' });
    expect(again).toMatchObject({
      kind: 'ERROR',
      code: 'INTERNAL',
      retryable: false,
    });
    expect(w.logs).toEqual([{ code: 'REPLAY_UNREADABLE' }]);
    // nothing new was asked of the model or the books
    expect(w.primary?.count).toBe(1);
    expect(w.ledger.reservations.size).toBe(1);
  });

  it('a replayed refusal comes back as the refusal it was, with the request id', async () => {
    const w = await buildWorld({
      intake: {
        profile: { ok: false, code: 'PROFILE_NOT_SET', detail: 'none' },
      },
    });
    const first = await run(w, { kind: 'INSTANT' });
    const second = await run(w, { kind: 'INSTANT' });
    expect(first.kind === 'REFUSED' && first.traced).toBe(true);
    expect(second).toMatchObject({
      kind: 'REFUSED',
      traced: true,
      quota: null,
      requestId: await requestIdOf(USER, CLIENT_ID),
    });
    expect(second.kind === 'REFUSED' && second.refusal).toEqual(
      first.kind === 'REFUSED' ? first.refusal : null
    );
  });
});

describe('when a store refuses (not throws)', () => {
  it('a trace the store refuses is logged with where it was wrong, and the new thread goes', async () => {
    const w = await buildWorld();
    w.ports.traces.write = async () => ({
      ok: false,
      code: 'INVALID_TRACE',
      detail: 'request.language BAD_FORMAT',
    });
    const out = await run(w, { kind: 'INSTANT' });
    expect(out).toMatchObject({ kind: 'ERROR', code: 'PERSISTENCE_FAILED' });
    expect(w.logs).toEqual([
      {
        code: 'TRACE_NOT_STORED',
        detail: {
          code: 'INVALID_TRACE',
          detail: 'request.language BAD_FORMAT',
        },
      },
    ]);
    expect(w.chat.threads.size).toBe(0);
    // charged all the same
    expect([...w.ledger.reservations.values()][0]!.status).toBe('SETTLED');
  });

  it('a refusal with no detail is logged with its code alone', async () => {
    const w = await buildWorld();
    w.ports.traces.write = async () => ({
      ok: false,
      code: 'MISSING_USER',
      detail: '',
    });
    await run(w, { kind: 'INSTANT' });
    expect(w.logs).toEqual([
      { code: 'TRACE_NOT_STORED', detail: { code: 'MISSING_USER' } },
    ]);
    const bare = await buildWorld();
    bare.ports.traces.write = async () => ({ ok: false, code: 'MISSING_USER' });
    await run(bare, { kind: 'INSTANT' });
    expect(bare.logs).toEqual([
      { code: 'TRACE_NOT_STORED', detail: { code: 'MISSING_USER' } },
    ]);
  });

  it('a thread the store refuses leaves an error row and no thread', async () => {
    const w = await buildWorld();
    w.ports.threads.create = async () => ({ ok: false, code: 'BAD_ID' });
    const out = await run(w, { kind: 'INSTANT' });
    expect(out).toMatchObject({ kind: 'ERROR', code: 'PERSISTENCE_FAILED' });
    expect(w.logs).toContainEqual({
      code: 'THREAD_NOT_STORED',
      detail: { code: 'BAD_ID' },
    });
    const row = [...w.traces.rows.values()][0]!;
    expect(row).toMatchObject({
      outcome: 'ERROR',
      thread_id: null,
      reply_json: null,
    });
    expect(w.chat.threads.size).toBe(0);
  });

  it('messages the store refuses are logged, and the new thread goes', async () => {
    const w = await buildWorld();
    w.ports.threads.append = async () => ({
      ok: false,
      code: 'DUPLICATE_REQUEST',
      detail: '',
    });
    const out = await run(w, { kind: 'INSTANT' });
    expect(out).toMatchObject({ kind: 'ERROR', code: 'PERSISTENCE_FAILED' });
    expect(w.logs).toEqual([
      { code: 'MESSAGES_NOT_STORED', detail: { code: 'DUPLICATE_REQUEST' } },
    ]);
    expect(w.chat.threads.size).toBe(0);
    expect(w.traces.rows.size).toBe(1);
  });

  it('a thread that cannot be discarded, and an error row that cannot be written, are logged and change nothing', async () => {
    const stuck = await buildWorld({ traceFails: true });
    stuck.ports.threads.discard = async () => {
      throw new Error('cannot delete');
    };
    const out = await run(stuck, { kind: 'INSTANT' });
    expect(out).toMatchObject({ kind: 'ERROR', code: 'PERSISTENCE_FAILED' });
    expect(logCodes(stuck)).toEqual(['STORE_FAILED', 'THREAD_DISCARD_FAILED']);

    const noRow = await buildWorld();
    noRow.ports.threads.create = async () => ({ ok: false, code: 'BAD_ID' });
    noRow.ports.traces.write = async () => {
      throw new Error('traces down');
    };
    const second = await run(noRow, { kind: 'INSTANT' });
    expect(second).toMatchObject({ kind: 'ERROR', code: 'PERSISTENCE_FAILED' });
    expect(logCodes(noRow)).toEqual([
      'THREAD_NOT_STORED',
      'ERROR_TRACE_NOT_STORED',
    ]);
  });

  it('a store that throws an error that is not an Error is named unknown', async () => {
    const w = await buildWorld();
    w.ports.traces.write = async () => {
      throw 'plain string';
    };
    await run(w, { kind: 'INSTANT' });
    expect(w.logs).toEqual([
      { code: 'STORE_FAILED', detail: { error: 'unknown' } },
    ]);
  });
});

describe('a refusal’s own trace', () => {
  it('says nothing was spent, no deadline, no model, and no calls', async () => {
    const w = await buildWorld({
      intake: {
        profile: { ok: false, code: 'PROFILE_NOT_SET', detail: 'none' },
      },
    });
    await run(w, { kind: 'INSTANT' });
    const row = [...w.traces.rows.values()][0]!;
    expect(row).toMatchObject({
      outcome: 'REFUSED',
      units_charged: 0,
      model: null,
    });
    expect(row.time_group).toMatchObject({ deadline_hit: false });
    expect(row.model_group).toMatchObject({
      fallback_used: false,
      calls: [],
      cost_micro_usd: null,
    });
    expect(row.checks_group).toMatchObject({
      shape: 'NONE',
      fixed_reason: null,
    });
  });

  it('a store that refuses it, or throws, changes nothing the trader is told', async () => {
    const refusing = await buildWorld({
      intake: {
        profile: { ok: false, code: 'PROFILE_NOT_SET', detail: 'none' },
      },
    });
    refusing.ports.traces.write = async () => ({
      ok: false,
      code: 'INVALID_TRACE',
      detail: 'x BAD',
    });
    const a = await run(refusing, { kind: 'INSTANT' });
    expect(a).toMatchObject({ kind: 'REFUSED', traced: false });
    expect(refusing.logs).toEqual([
      {
        code: 'REFUSAL_TRACE_NOT_STORED',
        detail: { code: 'INVALID_TRACE', detail: 'x BAD' },
      },
    ]);

    const throwing = await buildWorld({
      intake: {
        profile: { ok: false, code: 'PROFILE_NOT_SET', detail: 'none' },
      },
    });
    throwing.ports.traces.write = async () => {
      throw new Error('down');
    };
    const b = await run(throwing, { kind: 'INSTANT' });
    expect(b).toMatchObject({ kind: 'REFUSED', traced: false });
    expect(throwing.logs).toEqual([{ code: 'REFUSAL_TRACE_FAILED' }]);
  });

  it('a typed question refused as out of scope has no row, and the trader is told', async () => {
    const w = await buildWorld({
      intake: {
        understand: echoResult('direction of eurusd', 'DIRECTION', {
          symbols: ['EURUSD'],
        }),
      },
    });
    const out = await run(w, { kind: 'TYPED' });
    expect(out).toMatchObject({ kind: 'REFUSED', traced: false });
    expect(out.kind === 'REFUSED' && out.refusal.code).toBe('OUT_OF_SCOPE');
    expect(w.traces.rows.size).toBe(0);
    // the Understand call was paid for, the hold settles it
    expect([...w.ledger.reservations.values()][0]).toMatchObject({
      status: 'SETTLED',
      actual_units: 300,
    });
  });
});

describe('a stored row that is not a reply', () => {
  async function replayWith(replyJson: string) {
    const w = await buildWorld();
    w.chat.chatThread.create = async () => {
      throw new Error('threads down');
    };
    await run(w, { kind: 'INSTANT' });
    const row = [...w.traces.rows.values()][0]!;
    row.reply_json = replyJson;
    w.logs.length = 0;
    const again = await run(w, { kind: 'INSTANT' });
    return { w, again };
  }

  it.each([
    ['text that is not JSON', 'this is not json'],
    ['JSON that is neither a reply nor a refusal', '{"hello":1}'],
    ['JSON that is not an object', '[1,2,3]'],
  ])(
    '%s is not replayed: the trader is told and the log says why',
    async (_name, text) => {
      const { w, again } = await replayWith(text);
      expect(again).toMatchObject({
        kind: 'ERROR',
        code: 'INTERNAL',
        retryable: false,
      });
      expect(w.logs).toEqual([{ code: 'REPLAY_UNREADABLE' }]);
      expect(w.primary?.count).toBe(1);
    }
  );
});

describe('a failure before the body was read', () => {
  it('has no request id of its own to give, so it is given an anonymous one', async () => {
    const w = await buildWorld();
    w.fake.ports.gate.enabled = () => {
      throw new Error('flag store down');
    };
    const out = await run(w, { kind: 'INSTANT' });
    expect(out).toEqual({
      kind: 'ERROR',
      requestId: 'anon-0000000000000001',
      code: 'INTERNAL',
      retryable: false,
    });
    expect(w.logs).toEqual([{ code: 'INTAKE_FAILED' }]);
  });
});

describe('a thread id the thread store cannot use', () => {
  it('fails the run on our side: the reply is not made with a name the contract refuses, and what was paid is settled', async () => {
    const w = await buildWorld();
    w.ports.newThreadId = () => 'bad id';
    const out = await run(w, { kind: 'INSTANT' });
    expect(out).toMatchObject({
      kind: 'ERROR',
      code: 'INTERNAL',
      retryable: false,
    });
    expect(w.logs).toEqual([
      { code: 'RUN_FAILED', detail: { error: 'Error' } },
    ]);
    expect([...w.ledger.reservations.values()][0]).toMatchObject({
      status: 'SETTLED',
      actual_units: 2_500,
    });
    expect(w.traces.rows.size).toBe(0);
    expect(w.chat.threads.size).toBe(0);
  });
});

describe('a thread that was there before is never removed by a failed write', () => {
  it('not when the trace is refused', async () => {
    const w = await buildWorld();
    const thread = w.chat.seedThread({ user_id: USER });
    const discard = jest.spyOn(w.ports.threads, 'discard');
    w.ports.traces.write = async () => ({
      ok: false,
      code: 'INVALID_TRACE',
      detail: '',
    });
    const out = await run(w, { kind: 'INSTANT', threadId: thread.id });
    expect(out).toMatchObject({ kind: 'ERROR', code: 'PERSISTENCE_FAILED' });
    expect(discard).not.toHaveBeenCalled();
    expect(w.chat.threads.has(thread.id)).toBe(true);
  });

  it('not when the messages are refused', async () => {
    const w = await buildWorld();
    const thread = w.chat.seedThread({ user_id: USER });
    const discard = jest.spyOn(w.ports.threads, 'discard');
    w.ports.threads.append = async () => ({
      ok: false,
      code: 'DUPLICATE_REQUEST',
      detail: '',
    });
    const out = await run(w, { kind: 'INSTANT', threadId: thread.id });
    expect(out).toMatchObject({ kind: 'ERROR', code: 'PERSISTENCE_FAILED' });
    expect(discard).not.toHaveBeenCalled();
    expect(w.chat.threads.has(thread.id)).toBe(true);
  });

  it('and a thread this request made is discarded when either is refused', async () => {
    const trace = await buildWorld();
    trace.ports.traces.write = async () => ({
      ok: false,
      code: 'INVALID_TRACE',
      detail: '',
    });
    const discardA = jest.spyOn(trace.ports.threads, 'discard');
    await run(trace, { kind: 'INSTANT' });
    expect(discardA).toHaveBeenCalledTimes(1);

    const messages = await buildWorld();
    messages.ports.threads.append = async () => ({
      ok: false,
      code: 'DUPLICATE_REQUEST',
      detail: '',
    });
    const discardB = jest.spyOn(messages.ports.threads, 'discard');
    await run(messages, { kind: 'INSTANT' });
    expect(discardB).toHaveBeenCalledTimes(1);
  });
});

describe('what a store failure leaves in the log, exactly', () => {
  it('a trace write that throws is one STORE_FAILED, with no second attempt at an error row', async () => {
    const w = await buildWorld({ traceFails: true });
    await run(w, { kind: 'INSTANT' });
    expect(w.logs).toEqual([
      { code: 'STORE_FAILED', detail: { error: 'Error' } },
    ]);
  });

  it('a messages write that throws is one STORE_FAILED, and the trace row already written stays', async () => {
    const w = await buildWorld();
    w.ports.threads.append = async () => {
      throw new Error('messages down');
    };
    await run(w, { kind: 'INSTANT' });
    expect(w.logs).toEqual([
      { code: 'STORE_FAILED', detail: { error: 'Error' } },
    ]);
    expect(w.traces.rows.size).toBe(1);
  });
});

describe('a refusal that has no row says nothing', () => {
  it('a typed question refused at the gate, and one refused as out of scope, log nothing', async () => {
    const gate = await buildWorld({
      intake: {
        profile: { ok: false, code: 'PROFILE_NOT_SET', detail: 'none' },
      },
    });
    await run(gate, { kind: 'TYPED' });
    expect(gate.logs).toEqual([]);
    const scope = await buildWorld({
      intake: {
        understand: echoResult('direction of eurusd', 'DIRECTION', {
          symbols: ['EURUSD'],
        }),
      },
    });
    await run(scope, { kind: 'TYPED' });
    expect(scope.logs).toEqual([]);
  });

  it('an instant prompt refused at the gate has its row and logs nothing', async () => {
    const w = await buildWorld({
      intake: {
        profile: { ok: false, code: 'PROFILE_NOT_SET', detail: 'none' },
      },
    });
    await run(w, { kind: 'INSTANT' });
    expect(w.logs).toEqual([]);
    expect(w.traces.rows.size).toBe(1);
  });
});
