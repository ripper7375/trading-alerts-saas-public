/**
 * @jest-environment node
 */

/**
 * The server side of the ports (build step 7 part 7a): the switches, the stores as ports over
 * in-memory clients (so the real stores' validation runs), the thread check of the gate, and the
 * production wiring with its edges mocked.
 */

jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));
jest.mock('@/lib/db/market-prisma', () => ({ marketPrisma: {} }));
jest.mock('@/lib/storage/r2', () => ({
  getChartStamp: jest.fn(),
  getChartImage: jest.fn(),
}));
jest.mock('@/lib/intake/server/access', () => ({
  productionPorts: jest.fn(),
}));
// the real ledger would reach the database; the allowance it is asked with is what is checked
const ledgerCalls: { reserve: unknown[] } = { reserve: [] };
jest.mock('@/lib/platform/metering/ledger-port', () => ({
  createLedgerPort: () => ({
    balance: jest.fn(),
    reserve: async (query: unknown) => {
      ledgerCalls.reserve.push(query);
      return { ok: false, code: 'BAD_INPUT' };
    },
    settle: jest.fn(),
    release: jest.fn(),
  }),
}));
jest.mock('@/lib/reply/read/snapshot-at', () => ({
  readSnapshotAt: jest.fn(),
}));
jest.mock('@/lib/reply/read/day-bars', () => ({ readDayBars: jest.fn() }));

import { productionPorts } from '@/lib/intake/server/access';
import { readDayBars } from '@/lib/reply/read/day-bars';
import { readSnapshotAt } from '@/lib/reply/read/snapshot-at';
import { createThreadPort } from '@/lib/platform/chat/thread-port';
import { SENSOR_ROSTER } from '@/lib/intake';
import type { IntakePorts } from '@/lib/intake';
import type { AiModel } from '@/config/ai-models';
import {
  REPLY_ALLOWED_USER_IDS_ENV,
  REPLY_ENABLED_ENV,
  allowListSession,
  allowedUserIds,
  isReplyEnabled,
  passesAllowList,
} from '@/lib/reply/server/flags';
import {
  CHART_TOKENS_CEILING,
  PROMPT_TOKENS_CEILING,
  createReplyPorts,
  requestBounds,
} from '@/lib/reply/server/ports';
import {
  HISTORY_WINDOW,
  createThreadsPort,
  createTracesPort,
  issueDetail,
} from '@/lib/reply/server/store-ports';
import { callWorstCaseUnits } from '@/lib/reply/meter/estimate';
import { buildTrace, quietChecks } from '@/lib/reply/run/trace';
import { TraceRecorder } from '@/lib/reply/contracts/intake';
import { composeFixedAnswer } from '@/lib/reply/report1/fixed-answer';

import { makeFake } from '../../intake/helpers/ports';
import { FakeChatClient, FakeTraceClient } from '../../platform/helpers/fakes';
import { goldenPacket } from '../context/helpers/context-fixtures';
import {
  AUDIT_KEY,
  PRICED_A,
  PRICED_B,
  UNDERSTAND_TARGET,
} from './helpers/world';

void SENSOR_ROSTER;

describe('the switches', () => {
  it('REPLY_ENABLED turns the route on when it is exactly true, and nothing else does', () => {
    expect(isReplyEnabled({ [REPLY_ENABLED_ENV]: 'true' })).toBe(true);
    for (const value of [
      undefined,
      '',
      'TRUE',
      'True',
      '1',
      'yes',
      'on',
      ' true',
      'true ',
      'false',
    ]) {
      expect(isReplyEnabled({ [REPLY_ENABLED_ENV]: value })).toBe(false);
    }
    expect(isReplyEnabled({})).toBe(false);
    // the intake switch is another switch
    expect(isReplyEnabled({ INTAKE_ENABLED: 'true' })).toBe(false);
  });

  it('the allow-list is absent when the variable is, and then the tier alone decides', () => {
    expect(allowedUserIds({})).toBeNull();
    expect(passesAllowList({}, 'anyone')).toBe(true);
  });

  it('lists the traders named, trimmed, and nobody else', () => {
    const env = {
      [REPLY_ALLOWED_USER_IDS_ENV]: ' owner_1 , user@example:2,,  ',
    };
    expect([...allowedUserIds(env)!]).toEqual(['owner_1', 'user@example:2']);
    expect(passesAllowList(env, 'owner_1')).toBe(true);
    expect(passesAllowList(env, 'user@example:2')).toBe(true);
    expect(passesAllowList(env, 'owner')).toBe(false);
    expect(passesAllowList(env, 'someone-else')).toBe(false);
  });

  it('a variable that exists and names nobody lets nobody in', () => {
    for (const value of ['', '   ', ',', ' , ,']) {
      const env = { [REPLY_ALLOWED_USER_IDS_ENV]: value };
      expect(allowedUserIds(env)?.size).toBe(0);
      expect(passesAllowList(env, 'owner_1')).toBe(false);
    }
  });

  it('drops an entry that is not a user id', () => {
    const env = {
      [REPLY_ALLOWED_USER_IDS_ENV]: 'ok_1,has space,a/b,<x>,' + 'x'.repeat(129),
    };
    expect([...allowedUserIds(env)!]).toEqual(['ok_1']);
  });

  it('puts the allow-list in front of the session: a trader off it has no analyst', async () => {
    const inner = {
      current: jest.fn(async () => ({ userId: 'u-other', tier: 'PRO' })),
    };
    const env = { [REPLY_ALLOWED_USER_IDS_ENV]: 'u-owner' };
    await expect(allowListSession(inner, env).current()).resolves.toEqual({
      userId: 'u-other',
      tier: 'FREE',
    });
    inner.current.mockResolvedValue({ userId: 'u-owner', tier: 'PRO' });
    await expect(allowListSession(inner, env).current()).resolves.toEqual({
      userId: 'u-owner',
      tier: 'PRO',
    });
    // no list: the session is as it was; nobody signed in stays nobody
    await expect(allowListSession(inner, {}).current()).resolves.toEqual({
      userId: 'u-owner',
      tier: 'PRO',
    });
    inner.current.mockResolvedValue(null as never);
    await expect(allowListSession(inner, env).current()).resolves.toBeNull();
  });
});

describe('the threads port', () => {
  function world() {
    const chat = new FakeChatClient();
    return { chat, port: createThreadsPort({ client: chat.client() }) };
  }

  it('makes a thread with the id it was given, titled from the first answer', async () => {
    const { chat, port } = world();
    const made = await port.create({
      id: 'th_abc123',
      userId: 'u1',
      symbol: 'XAUUSD',
      traderType: 'DAY_TRADER',
      intent: 'DIRECTION',
      bias: 'LONG',
      cycleSlot: Date.UTC(2026, 8, 18, 20, 55) / 1000,
    });
    expect(made).toEqual({ ok: true });
    const thread = chat.threads.get('th_abc123')!;
    expect(thread).toMatchObject({
      user_id: 'u1',
      title_source: 'AUTO',
      trader_type: 'DAY_TRADER',
    });
    expect(thread.title).toBe('XAUUSD · LONG · 18 SEP 20:55');
  });

  it('says why a thread could not be made', async () => {
    const { port } = world();
    await expect(
      port.create({
        id: 'bad id',
        userId: 'u1',
        symbol: 'XAUUSD',
        traderType: 'DAY_TRADER',
        intent: 'DIRECTION',
        bias: null,
        cycleSlot: null,
      })
    ).resolves.toEqual({ ok: false, code: 'BAD_ID' });
  });

  it('reads a thread of the trader with the latest messages as history, and nothing of anybody else', async () => {
    const { chat, port } = world();
    const mine = chat.seedThread({
      user_id: 'u1',
      message_count: 0,
      last_cycle_slot: 1_790_000_100,
    });
    const empty = await port.context('u1', mine.id);
    expect(empty.thread).toEqual({
      id: mine.id,
      lastCycleSlot: 1_790_000_100,
      messageCount: 0,
    });
    expect(empty.history).toEqual([]);
    await expect(port.context('someone-else', mine.id)).resolves.toEqual({
      thread: null,
      history: [],
    });
    await expect(port.context('u1', 'th-missing')).resolves.toEqual({
      thread: null,
      history: [],
    });
  });

  it('reads only the latest messages of a long thread', async () => {
    const { chat, port } = world();
    const thread = chat.seedThread({ user_id: 'u1', message_count: 100 });
    for (let seq = 1; seq <= 100; seq += 1) {
      chat.messages.push({
        id: `m${seq}`,
        thread_id: thread.id,
        seq,
        request_id: `r${Math.ceil(seq / 2)}`,
        role: seq % 2 === 1 ? 'USER' : 'ASSISTANT',
        kind: seq % 2 === 1 ? 'TYPED' : 'ANSWER',
        intent: 'EXPLAIN',
        body_text: seq % 2 === 1 ? `q${seq}` : null,
        body_json: null,
        cycle_slot: 1_790_000_100,
        created_at: chat.now,
        expires_at: chat.now,
      });
    }
    const { history } = await port.context('u1', thread.id);
    expect(history).toHaveLength(HISTORY_WINDOW);
    expect(history[0]!.seq).toBe(100 - HISTORY_WINDOW + 1);
    expect(history[history.length - 1]!.seq).toBe(100);
    expect(history[0]).toEqual({
      seq: 71,
      role: 'USER',
      kind: 'TYPED',
      intent: 'EXPLAIN',
      body_text: 'q71',
      body_json: null,
      cycle_slot: 1_790_000_100,
    });
  });

  it('files an exchange, refuses a reply that is not the request’s, and discards a thread', async () => {
    const { chat, port } = world();
    const thread = chat.seedThread({ user_id: 'u1' });
    const packet = goldenPacket('01');
    const made = composeFixedAnswer({
      packet,
      reason: 'MODEL_UNAVAILABLE',
      dictionary: null,
      frame: {
        threadId: thread.id,
        requestId: 'req-1',
        model: null,
        promptVersion: null,
        regenerations: 0,
        changes: [],
        notes: [],
      },
    });
    if (!made.ok) throw new Error('fixture');
    const base = {
      userId: 'u1',
      threadId: thread.id,
      requestId: 'req-1',
      reply: made.value,
      nowMs: Date.UTC(2026, 8, 18, 21, 0, 0),
    };
    await expect(
      port.append({
        ...base,
        user: { kind: 'TYPED', text: 'direction?', intent: 'DIRECTION' },
      })
    ).resolves.toEqual({ ok: true });
    expect(chat.messages.map((m) => m.role)).toEqual(['USER', 'ASSISTANT']);
    // the same request again is a duplicate, said with its code
    await expect(
      port.append({
        ...base,
        user: { kind: 'TYPED', text: 'direction?', intent: 'DIRECTION' },
      })
    ).resolves.toMatchObject({ ok: false, code: 'DUPLICATE_REQUEST' });
    // a reply filed under a request it was not made for
    await expect(
      port.append({
        ...base,
        requestId: 'req-2',
        user: { kind: 'INSTANT', intent: 'INSTANT_M5_INSPECT' },
      })
    ).resolves.toMatchObject({ ok: false, code: 'REPLY_MISMATCH' });
    // another trader's thread is not found
    await expect(
      port.append({
        ...base,
        userId: 'u2',
        requestId: 'req-1',
        user: { kind: 'TYPED', text: 'x', intent: null },
      })
    ).resolves.toMatchObject({ ok: false, code: 'NOT_FOUND' });

    await expect(port.discard('u2', thread.id)).resolves.toBe(false);
    await expect(port.discard('u1', thread.id)).resolves.toBe(true);
    expect(chat.threads.size).toBe(0);
    expect(chat.messages).toHaveLength(0);
  });
});

describe('the traces port', () => {
  function validTrace() {
    const packet = JSON.parse(JSON.stringify(goldenPacket('01')));
    packet.knowledge.index_build_id = `kb-${'ab'.repeat(16)}`;
    let t = 0;
    const recorder = new TraceRecorder({
      requestId: 'x',
      route: 'typed',
      method: 'POST',
      startedAt: '2026-09-18T20:57:00.000Z',
      clock: () => (t += 1),
    });
    const made = composeFixedAnswer({
      packet,
      reason: 'MODEL_UNAVAILABLE',
      dictionary: null,
      frame: {
        threadId: 'th-1',
        requestId: 'r'.repeat(10),
        model: null,
        promptVersion: null,
        regenerations: 0,
        changes: [],
        notes: [],
      },
    });
    if (!made.ok) throw new Error('fixture');
    const trace = buildTrace({
      request: {
        kind: 'TYPED',
        question: 'q',
        threadId: null,
        clientRequestId: 'client-1',
      },
      requestId: 'r'.repeat(10),
      tier: 'PRO',
      threadId: 'th-1',
      intake: recorder.snapshot(),
      packet,
      intent: packet.intent,
      replyLocale: 'en-US',
      startedAt: '2026-09-18T20:57:00.000Z',
      totalMs: 5,
      deadlineHit: false,
      stages: [],
      shape: 'NONE',
      gate: null,
      checks: quietChecks('NONE', null, 'MODEL_UNAVAILABLE', null),
      fixedReason: 'MODEL_UNAVAILABLE',
      directionEqualsSyn: null,
      calls: [],
      model: null,
      promptVersion: null,
      fallbackUsed: false,
      components: null,
      cycleBlockSha256: null,
      packetSha256: 'c'.repeat(64),
      unitsCharged: 0,
      outcome: 'FIXED_ANSWER',
    });
    return { trace, reply: made.value };
  }

  it('writes a trace and finds it by request id with the owner and the stored reply', async () => {
    const client = new FakeTraceClient();
    const port = createTracesPort({ client, key: AUDIT_KEY });
    const { trace, reply } = validTrace();
    await expect(port.write({ userId: 'u1', trace, reply })).resolves.toEqual({
      ok: true,
    });
    const found = await port.find('r'.repeat(10));
    expect(found).toMatchObject({ userId: 'u1', outcome: 'FIXED_ANSWER' });
    expect(JSON.parse(found!.replyJson!)).toMatchObject({
      kind: 'FIXED_ANSWER',
    });
    await expect(port.find('nope')).resolves.toBeNull();
  });

  it('says where a refused trace was wrong, by path and code, and never by value', async () => {
    const client = new FakeTraceClient();
    const port = createTracesPort({ client, key: AUDIT_KEY });
    const { trace, reply } = validTrace();
    const broken = JSON.parse(JSON.stringify(trace));
    broken.knowledge.index_build_id = 'build-0001';
    const out = await port.write({ userId: 'u1', trace: broken, reply });
    expect(out).toEqual({
      ok: false,
      code: 'INVALID_TRACE',
      detail: 'knowledge.index_build_id BAD_FORMAT',
    });
    expect(client.rows.size).toBe(0);
  });

  it('lets a database error through for the orchestrator to judge', async () => {
    const client = new FakeTraceClient();
    client.requestTrace.create = async () => {
      throw new Error('down');
    };
    const port = createTracesPort({ client, key: AUDIT_KEY });
    const { trace, reply } = validTrace();
    await expect(port.write({ userId: 'u1', trace, reply })).rejects.toThrow(
      'down'
    );
  });

  it('the detail of an issue list is short and has no values', () => {
    expect(issueDetail(undefined)).toBe('');
    expect(issueDetail([])).toBe('');
    expect(issueDetail([{ path: '', code: 'WRONG_TYPE' }])).toBe(
      '(root) WRONG_TYPE'
    );
    const many = Array.from({ length: 9 }, (_, i) => ({
      path: `p${i}`,
      code: 'X',
    }));
    expect(issueDetail(many).split('; ')).toHaveLength(5);
  });
});

describe('the gate’s thread check, over the chat store', () => {
  it('passes no thread, the trader’s own thread for this symbol, and nothing else, with one answer for the rest', async () => {
    const chat = new FakeChatClient();
    const port = createThreadPort({ client: chat.client() });
    const mine = chat.seedThread({ user_id: 'u1' });
    const other = chat.seedThread({ user_id: 'u2' });
    const gold = (userId: string, threadId: string | null) =>
      port.check({ userId, threadId, symbol: 'XAUUSD' });
    await expect(gold('u1', null)).resolves.toEqual({
      ok: true,
      threadId: null,
    });
    await expect(gold('u1', mine.id)).resolves.toEqual({
      ok: true,
      threadId: mine.id,
    });
    await expect(gold('u1', other.id)).resolves.toEqual({ ok: false });
    await expect(gold('u1', 'th-none')).resolves.toEqual({ ok: false });
    chat.log.length = 0;
    await expect(gold('u1', 'bad id')).resolves.toEqual({ ok: false });
    // an id that is not an id never reaches the store
    expect(chat.log).toEqual([]);
    await expect(
      port.check({ userId: 'u1', threadId: mine.id, symbol: 'XAUUSD' })
    ).resolves.toEqual({ ok: true, threadId: mine.id });
    chat.threads.get(mine.id)!.symbol = 'EURUSD';
    await expect(gold('u1', mine.id)).resolves.toEqual({ ok: false });
  });

  it('lets a store that cannot be read throw', async () => {
    const chat = new FakeChatClient();
    chat.chatThread.findFirst = async () => {
      throw new Error('down');
    };
    const port = createThreadPort({ client: chat.client() });
    await expect(
      port.check({ userId: 'u', threadId: 'th-1', symbol: 'XAUUSD' })
    ).rejects.toThrow('down');
  });
});

describe('the bounds of a request', () => {
  const row = (target: typeof PRICED_A): AiModel =>
    target as unknown as AiModel;
  const ENV = { INTAKE_UNDERSTAND_MODEL: 'understand-vendor/small' };

  it('the answer is the full budget plus a chart on the dearer of the pair, and the Understand call is at its ceiling', () => {
    const cheap = row({ ...PRICED_A, price_in: 1, price_out: 2 });
    const dear = row({ ...PRICED_B, price_in: 3, price_out: 9 });
    for (const plan of [
      { primary: cheap, fallback: dear },
      { primary: dear, fallback: cheap },
    ]) {
      const bounds = requestBounds(ENV, 'TYPED', plan)!;
      expect(bounds.answer.price).toEqual({ price_in: 3, price_out: 9 });
      expect(bounds.answer.promptTokens).toBe(PROMPT_TOKENS_CEILING);
      expect(bounds.answer.imageTokens).toBe(CHART_TOKENS_CEILING);
      expect(bounds.understand).not.toBeNull();
      expect(bounds.understand!.promptTokens).toBe(5_000);
      expect(bounds.understand!.maxOutputTokens).toBe(
        UNDERSTAND_TARGET.max_output_tokens
      );
    }
    expect(PROMPT_TOKENS_CEILING).toBe(19_600);
    expect(CHART_TOKENS_CEILING).toBe(1_500);
  });

  it('an instant prompt has no Understand call', () => {
    const plan = { primary: row(PRICED_A), fallback: null };
    const bounds = requestBounds({}, 'INSTANT', plan)!;
    expect(bounds.understand).toBeNull();
    expect(callWorstCaseUnits(bounds.answer)).not.toBeNull();
  });

  it('is nothing when no model is launched', () => {
    expect(
      requestBounds(ENV, 'TYPED', { primary: null, fallback: null })
    ).toBeNull();
    expect(
      requestBounds(ENV, 'INSTANT', { primary: null, fallback: null })
    ).toBeNull();
  });

  it('is nothing when a model of the pair has no price, or a typed question has no Understand model', () => {
    const unpriced = row({ ...PRICED_A, price_in: null });
    expect(
      requestBounds(ENV, 'INSTANT', { primary: unpriced, fallback: null })
    ).toBeNull();
    expect(
      requestBounds(ENV, 'INSTANT', {
        primary: row(PRICED_A),
        fallback: unpriced,
      })
    ).toBeNull();
    const plan = { primary: row(PRICED_A), fallback: null };
    expect(requestBounds({}, 'TYPED', plan)).toBeNull();
    expect(
      requestBounds({ INTAKE_UNDERSTAND_MODEL: '   ' }, 'TYPED', plan)
    ).toBeNull();
    // with the real registry nothing has passed yet, so nothing is launched
    expect(requestBounds(ENV, 'TYPED')).toBeNull();
  });
});

describe('the production ports', () => {
  const fake = makeFake({});
  beforeEach(() => {
    jest.mocked(productionPorts).mockReset();
    jest.mocked(productionPorts).mockReturnValue(fake.ports as IntakePorts);
  });

  it('switches the gate to REPLY_ENABLED and leaves the Understand model to the orchestrator', () => {
    const on = createReplyPorts({ REPLY_ENABLED: 'true' });
    const off = createReplyPorts({ INTAKE_ENABLED: 'true' });
    expect(on.intake.gate.enabled()).toBe(true);
    expect(off.intake.gate.enabled()).toBe(false);
    expect('understand' in on.intake).toBe(false);
    expect(productionPorts).toHaveBeenCalledWith({ REPLY_ENABLED: 'true' });
  });

  it('puts the allow-list in front of the session', async () => {
    const ports = createReplyPorts({
      REPLY_ENABLED: 'true',
      REPLY_ALLOWED_USER_IDS: 'someone',
    });
    await expect(ports.intake.gate.session.current()).resolves.toEqual({
      userId: 'user-pro-1',
      tier: 'FREE',
    });
    const open = createReplyPorts({ REPLY_ENABLED: 'true' });
    await expect(open.intake.gate.session.current()).resolves.toEqual({
      userId: 'user-pro-1',
      tier: 'PRO',
    });
  });

  it('gives each request an Understand port that fails closed with no key', async () => {
    const ports = createReplyPorts({ REPLY_ENABLED: 'true' });
    const seen: unknown[] = [];
    const understand = ports.understand({ onCall: (r) => seen.push(r) });
    await expect(
      understand.understand({ version: 'understand-1', system: 's', user: 'u' })
    ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
  });

  it('knows no launch model yet, so it can price nothing', () => {
    const ports = createReplyPorts({
      REPLY_ENABLED: 'true',
      INTAKE_UNDERSTAND_MODEL: 'x/y',
    });
    expect(ports.bounds('INSTANT')).toBeNull();
    expect(ports.bounds('TYPED')).toBeNull();
    expect(ports.models).toEqual({ primary: null, fallback: null });
  });

  it('the entitlement table decides the chart, and the ids it makes are ids', () => {
    const ports = createReplyPorts({});
    expect(ports.tierAllowsChart('PRO')).toBe(true);
    expect(ports.tierAllowsChart('FREE')).toBe(false);
    expect(ports.tierAllowsChart('nonsense')).toBe(false);
    const threads = new Set(
      Array.from({ length: 20 }, () => ports.newThreadId())
    );
    expect(threads.size).toBe(20);
    for (const id of threads) expect(id).toMatch(/^th_[0-9a-f]{32}$/);
    const anon = ports.anonymousRequestId();
    expect(anon).toMatch(/^anon_[0-9a-f]{32}$/);
    expect(anon).not.toBe(ports.anonymousRequestId());
    expect(/^[A-Za-z0-9_-]{1,64}$/.test(anon)).toBe(true);
  });

  it('holds a Pro trader to the monthly allowance and a Free one to none', async () => {
    const estimate = {
      ok: true as const,
      understandUnits: 1,
      answerUnits: 10,
      regenerationUnits: 10,
      baseUnits: 11,
      withRegenerationUnits: 21,
    };
    const ports = createReplyPorts({ PRO_MONTHLY_UNITS: '7777' });
    ledgerCalls.reserve.length = 0;
    await ports.meter.reserve(
      { requestId: 'r1', userId: 'u', tier: 'PRO' },
      estimate
    );
    expect(ledgerCalls.reserve.length).toBeGreaterThan(0);
    expect(ledgerCalls.reserve[0]).toMatchObject({
      allowanceUnits: 7_777,
      userId: 'u',
      requestId: 'r1',
    });
    // a Free trader has no allowance: nothing is reserved
    ledgerCalls.reserve.length = 0;
    await expect(
      ports.meter.reserve(
        { requestId: 'r2', userId: 'u', tier: 'FREE' },
        estimate
      )
    ).resolves.toEqual({ ok: false, code: 'NOT_METERED' });
    expect(ledgerCalls.reserve).toEqual([]);
    // and with no allowance set, nobody is metered
    await expect(
      createReplyPorts({}).meter.reserve(
        { requestId: 'r3', userId: 'u', tier: 'PRO' },
        estimate
      )
    ).resolves.toEqual({ ok: false, code: 'NOT_METERED' });
  });

  it('reads the day bars and the earlier cycle states for the slot it is given', async () => {
    const ports = createReplyPorts({});
    jest
      .mocked(readDayBars)
      .mockResolvedValue({ ok: true, bars: { symbol: 'XAUUSD' } as never });
    await expect(ports.dayBars('2026-09-18T20:55Z')).resolves.toEqual({
      ok: true,
      bars: { symbol: 'XAUUSD' },
    });
    expect(readDayBars).toHaveBeenCalledWith({ slot: '2026-09-18T20:55Z' });

    const states = { slot: '2026-09-18T20:50Z', sensors: [] };
    jest.mocked(readSnapshotAt).mockResolvedValueOnce({ ok: true, states });
    await expect(ports.previousStates('2026-09-18T20:50Z')).resolves.toBe(
      states
    );
    expect(readSnapshotAt).toHaveBeenCalledWith({ slot: '2026-09-18T20:50Z' });
    jest.mocked(readSnapshotAt).mockResolvedValueOnce({
      ok: false,
      code: 'DATABASE_ERROR',
      detail: 'down',
    });
    await expect(ports.previousStates('2026-09-18T20:50Z')).resolves.toBeNull();
  });

  it('a timer never keeps the process alive', () => {
    const unref = jest.fn();
    const handle = { unref };
    const spy = jest
      .spyOn(globalThis, 'setTimeout')
      .mockReturnValue(handle as never);
    const clear = jest
      .spyOn(globalThis, 'clearTimeout')
      .mockImplementation(() => undefined);
    try {
      const deadline = createReplyPorts({}).deadline(5_000);
      expect(spy).toHaveBeenCalledWith(expect.any(Function), 5_000);
      expect(unref).toHaveBeenCalledTimes(1);
      deadline.cancel();
      expect(clear).toHaveBeenCalledWith(handle);
    } finally {
      spy.mockRestore();
      clear.mockRestore();
    }
  });

  it('a deadline fires its signal when the time is up and is cleared by cancel', async () => {
    jest.useFakeTimers();
    try {
      const ports = createReplyPorts({});
      const soon = ports.deadline(1_000);
      expect(soon.signal.aborted).toBe(false);
      jest.advanceTimersByTime(999);
      expect(soon.signal.aborted).toBe(false);
      jest.advanceTimersByTime(1);
      expect(soon.signal.aborted).toBe(true);
      const cleared = ports.deadline(1_000);
      cleared.cancel();
      jest.advanceTimersByTime(5_000);
      expect(cleared.signal.aborted).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('logs a code and its detail, and nothing else', () => {
    const spy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      const ports = createReplyPorts({});
      ports.log('SOMETHING', { code: 'X' });
      ports.log('PLAIN');
      expect(spy.mock.calls).toEqual([
        ['[reply] SOMETHING', { code: 'X' }],
        ['[reply] PLAIN', {}],
      ]);
    } finally {
      spy.mockRestore();
    }
  });
});
