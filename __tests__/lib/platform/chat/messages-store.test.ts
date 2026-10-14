/**
 * @jest-environment node
 */

import { buildRefusal } from '@/lib/intake';
import {
  MESSAGE_LIST_MAX,
  MESSAGE_ROLES,
  MESSAGE_TEXT_MAX,
  appendExchange,
  listMessages,
} from '@/lib/platform/chat/messages-store';
import type { ExchangeInput } from '@/lib/platform/chat/messages-store';
import { messageExpiry } from '@/lib/platform/traces/retention';

import {
  OTHER_USER_ID,
  REQUEST_ID,
  SLOT_SECONDS,
  T0,
  THREAD_ID,
  USER_ID,
  actionResult,
  answerResult,
  fixedResult,
  reportResult,
  withPath,
} from '../../reply/helpers/fixtures';
import { FakeChatClient } from '../helpers/fakes';

// the stores import the database client at load time; these tests pass their own
jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));

function world(over: Record<string, unknown> = {}) {
  const fake = new FakeChatClient();
  const thread = fake.seedThread({ id: THREAD_ID, user_id: USER_ID, ...over });
  return { fake, thread };
}

const exchange = (over: Partial<ExchangeInput> = {}): ExchangeInput => ({
  userId: USER_ID,
  threadId: THREAD_ID,
  requestId: REQUEST_ID,
  user: { kind: 'TYPED', text: 'Is gold going up?', intent: 'DIRECTION' },
  reply: reportResult(),
  now: T0,
  ...over,
});

const append = (fake: FakeChatClient, over: Partial<ExchangeInput> = {}) =>
  appendExchange(exchange(over), { client: fake.client() });

describe('appendExchange: a report', () => {
  it('writes the question and the reply as messages 1 and 2 and says what it wrote', async () => {
    const { fake } = world();
    const result = await append(fake);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.user).toMatchObject({
      thread_id: THREAD_ID,
      seq: 1,
      request_id: REQUEST_ID,
      role: 'USER',
      kind: 'TYPED',
      intent: 'DIRECTION',
      body_text: 'Is gold going up?',
      cycle_slot: SLOT_SECONDS,
    });
    expect(result.user.body_json ?? null).toBeNull();
    expect(result.assistant).toMatchObject({
      thread_id: THREAD_ID,
      seq: 2,
      request_id: REQUEST_ID,
      role: 'ASSISTANT',
      kind: 'REPORT1',
      intent: 'DIRECTION',
      body_text: null,
      cycle_slot: SLOT_SECONDS,
    });
    expect(result.assistant.body_json).toEqual(reportResult());
  });

  it('dates both messages at the given time and lets them expire 12 months later', async () => {
    const { fake } = world();
    const result = await append(fake);
    if (!result.ok) throw new Error('not written');
    for (const row of [result.user, result.assistant]) {
      expect(row.created_at).toEqual(T0);
      expect(row.expires_at).toEqual(messageExpiry(T0));
      expect(row.expires_at.toISOString()).toBe('2027-09-18T21:00:12.345Z');
    }
  });

  it('updates the thread: two more messages, one more report, the bias, the cycle, the preview and the time', async () => {
    const { fake } = world();
    await append(fake);
    expect(fake.threads.get(THREAD_ID)).toMatchObject({
      message_count: 2,
      report_count: 1,
      last_bias: 'LONG',
      last_cycle_slot: SLOT_SECONDS,
      last_message_at: T0,
    });
    expect(fake.threads.get(THREAD_ID)?.last_preview).toBe(
      reportResult().report.headline
    );
  });

  it('numbers the next exchange 3 and 4', async () => {
    const { fake } = world();
    await append(fake);
    const second = await append(fake, {
      requestId: 'req-7f3a9c1e-0002',
      reply: withPath(
        reportResult(),
        'provenance.request_id',
        'req-7f3a9c1e-0002'
      ),
    });
    if (!second.ok) throw new Error('not written');
    expect([second.user.seq, second.assistant.seq]).toEqual([3, 4]);
    expect(fake.threads.get(THREAD_ID)).toMatchObject({
      message_count: 4,
      report_count: 2,
    });
  });

  it('puts the user id in the thread query, so a thread of another trader is not found', async () => {
    const { fake } = world({ user_id: OTHER_USER_ID });
    expect(await append(fake)).toEqual({ ok: false, code: 'NOT_FOUND' });
    expect(fake.messages).toEqual([]);
    expect(fake.threads.get(THREAD_ID)?.message_count).toBe(0);
  });
});

describe('appendExchange: the other replies', () => {
  const answer = withPath(answerResult(), 'thread_id', THREAD_ID);
  const fixed = fixedResult();
  const action = actionResult();

  it('an answer: no report counted, the last bias kept, the cycle and the preview from the answer', async () => {
    const { fake } = world({
      last_bias: 'SHORT',
      last_cycle_slot: SLOT_SECONDS - 300,
      report_count: 1,
      message_count: 2,
    });
    for (const [k, v] of [
      ['m1', 1],
      ['m2', 2],
    ] as const) {
      fake.messages.push({
        id: k,
        thread_id: THREAD_ID,
        seq: v,
        request_id: `r${v}`,
        role: v === 1 ? 'USER' : 'ASSISTANT',
        kind: 'x',
      } as never);
    }
    const result = await append(fake, {
      reply: answer,
      user: { kind: 'TYPED', text: 'What is UOEDT?', intent: 'EXPLAIN' },
    });
    expect(result.ok).toBe(true);
    expect(fake.threads.get(THREAD_ID)).toMatchObject({
      message_count: 4,
      report_count: 1,
      last_bias: 'SHORT',
      last_cycle_slot: SLOT_SECONDS,
    });
    expect(fake.threads.get(THREAD_ID)?.last_preview).toBe(
      answerResult().answer.text
    );
    if (result.ok) expect(result.assistant.kind).toBe('ANSWER');
  });

  it('a fixed answer with a direction sets the bias; the preview is the question', async () => {
    const { fake } = world();
    const result = await append(fake, { reply: fixed });
    expect(result.ok).toBe(true);
    expect(fake.threads.get(THREAD_ID)).toMatchObject({
      last_bias: 'LONG',
      report_count: 0,
    });
    expect(fake.threads.get(THREAD_ID)?.last_preview).toBe('Is gold going up?');
    if (result.ok) expect(result.assistant.kind).toBe('FIXED_ANSWER');
  });

  it('a fixed answer without a direction (stale data) keeps the last bias', async () => {
    const { fake } = world({ last_bias: 'SHORT' });
    const stale = withPath(
      withPath(fixed, 'fixed.reason', 'DATA_STALE'),
      'fixed.direction',
      null
    );
    await append(fake, { reply: stale });
    expect(fake.threads.get(THREAD_ID)?.last_bias).toBe('SHORT');
  });

  it('an action: no bias, the preview is the question, the kind is ACTION', async () => {
    const { fake } = world();
    const result = await append(fake, {
      reply: withPath(action, 'thread_id', THREAD_ID),
      user: { kind: 'TYPED', text: 'Open the trade setup', intent: 'REPORT_2' },
    });
    expect(result.ok).toBe(true);
    expect(fake.threads.get(THREAD_ID)).toMatchObject({
      last_bias: null,
      last_preview: 'Open the trade setup',
    });
    if (result.ok) expect(result.assistant.kind).toBe('ACTION');
  });

  it('an instant prompt has no question to show: a fixed answer or an action leaves the preview the thread had', async () => {
    for (const reply of [fixedResult(), actionResult()]) {
      const { fake } = world({ last_preview: 'Earlier headline' });
      const result = await append(fake, {
        reply: withPath(reply, 'thread_id', THREAD_ID),
        user: { kind: 'INSTANT', intent: 'INSTANT_M5_INSPECT' },
      });
      expect(result.ok).toBe(true);
      expect(fake.threads.get(THREAD_ID)?.last_preview).toBe(
        'Earlier headline'
      );
    }
  });

  it('a refusal: kept as the reply, the preview is its text, no cycle', async () => {
    const { fake } = world({ last_cycle_slot: SLOT_SECONDS });
    const refusal = buildRefusal(
      'QUOTA_INSUFFICIENT',
      'en-US',
      'Your monthly allowance is used up.'
    );
    const result = await append(fake, { reply: refusal });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.assistant).toMatchObject({
      kind: 'REFUSAL',
      cycle_slot: null,
    });
    expect(result.assistant.body_json).toEqual(refusal);
    expect(fake.threads.get(THREAD_ID)).toMatchObject({
      last_preview: 'Your monthly allowance is used up.',
      last_cycle_slot: SLOT_SECONDS,
    });
  });

  it('a reply with no cycle (none could be read) leaves the thread`s cycle alone and the rows without one', async () => {
    const { fake } = world({ last_cycle_slot: SLOT_SECONDS - 300 });
    const result = await append(fake, {
      reply: withPath(reportResult(), 'stamp.as_of', null),
    });
    if (!result.ok) throw new Error('not written');
    expect(result.assistant.cycle_slot).toBeNull();
    expect(result.user.cycle_slot).toBeNull();
    expect(fake.threads.get(THREAD_ID)?.last_cycle_slot).toBe(
      SLOT_SECONDS - 300
    );
  });
});

describe('appendExchange: the trader`s message', () => {
  it('an instant prompt has an intent and no text', async () => {
    const { fake } = world();
    const result = await append(fake, {
      user: { kind: 'INSTANT', intent: 'INSTANT_M15_INSPECT' },
    });
    if (!result.ok) throw new Error('not written');
    expect(result.user).toMatchObject({
      kind: 'INSTANT',
      intent: 'INSTANT_M15_INSPECT',
      body_text: null,
    });
    expect(result.assistant.intent).toBe('INSTANT_M15_INSPECT');
  });

  it('a typed question whose intent is not known yet has none', async () => {
    const { fake } = world();
    const result = await append(fake, {
      user: { kind: 'TYPED', text: 'hello', intent: null },
    });
    if (!result.ok) throw new Error('not written');
    expect(result.user.intent).toBeNull();
    expect(result.assistant.intent).toBeNull();
  });

  it.each([
    ['a blank question', { kind: 'TYPED', text: '   ', intent: 'DIRECTION' }],
    ['an empty question', { kind: 'TYPED', text: '', intent: 'DIRECTION' }],
    [
      'a question over 2,000 characters',
      {
        kind: 'TYPED',
        text: 'x'.repeat(MESSAGE_TEXT_MAX + 1),
        intent: 'DIRECTION',
      },
    ],
    [
      'an intent that is not an intent',
      { kind: 'TYPED', text: 'hi', intent: 'OUT_OF_SCOPE' },
    ],
    [
      'an instant prompt with a typed intent',
      { kind: 'INSTANT', intent: 'DIRECTION' },
    ],
    ['a question that is not text', { kind: 'TYPED', text: 4, intent: null }],
  ])('refuses %s', async (_name, user) => {
    const { fake } = world();
    expect(await append(fake, { user: user as never })).toEqual({
      ok: false,
      code: 'BAD_MESSAGE',
    });
    expect(fake.log).toEqual([]);
  });

  it('accepts a question of exactly 2,000 characters', async () => {
    const { fake } = world();
    const result = await append(fake, {
      user: { kind: 'TYPED', text: 'x'.repeat(MESSAGE_TEXT_MAX), intent: null },
    });
    expect(result.ok).toBe(true);
  });
});

describe('appendExchange: what it refuses before it writes', () => {
  it.each([
    ['no user', { userId: '' }, 'MISSING_USER'],
    ['a request id with a space', { requestId: 'has space' }, 'BAD_REQUEST_ID'],
    ['an empty request id', { requestId: '' }, 'BAD_REQUEST_ID'],
    [
      'a request id of 65 characters',
      { requestId: 'r'.repeat(65) },
      'BAD_REQUEST_ID',
    ],
    ['no thread id', { threadId: '' }, 'NOT_FOUND'],
  ])('%s', async (_name, over, code) => {
    const { fake } = world();
    expect(await append(fake, over as never)).toEqual({ ok: false, code });
    expect(fake.log).toEqual([]);
  });

  it('a reply that fails its contract, with the issues', async () => {
    const { fake } = world();
    const result = await append(fake, {
      reply: { ...reportResult(), extra: 1 },
    });
    expect(result).toMatchObject({ ok: false, code: 'INVALID_REPLY' });
    expect(fake.log).toEqual([]);
  });

  it('a reply with the equity or the commission in a key', async () => {
    const { fake } = world();
    const result = await append(fake, {
      reply: withPath(reportResult(), 'report.zones[0].commission', 4),
    });
    expect(result).toMatchObject({ ok: false, code: 'FORBIDDEN_KEY' });
    expect(fake.log).toEqual([]);
  });

  it('a reply made for another request or another thread', async () => {
    const { fake } = world();
    expect(
      await append(fake, {
        reply: withPath(
          reportResult(),
          'provenance.request_id',
          'req-other-0002'
        ),
      })
    ).toEqual({
      ok: false,
      code: 'REPLY_MISMATCH',
    });
    expect(
      await append(fake, {
        reply: withPath(
          reportResult(),
          'thread_id',
          'cm0thread000000000000000999'
        ),
      })
    ).toEqual({
      ok: false,
      code: 'REPLY_MISMATCH',
    });
    expect(fake.log).toEqual([]);
  });
});

describe('appendExchange: the transaction', () => {
  it('a request id used twice is DUPLICATE_REQUEST, and the second try changes nothing, not even the counts', async () => {
    const { fake } = world();
    await append(fake);
    const before =
      JSON.stringify([...fake.threads.values()]) +
      JSON.stringify(fake.messages);
    const again = await append(fake, { now: new Date(T0.getTime() + 60_000) });
    expect(again).toEqual({ ok: false, code: 'DUPLICATE_REQUEST' });
    expect(
      JSON.stringify([...fake.threads.values()]) + JSON.stringify(fake.messages)
    ).toBe(before);
    expect(fake.threads.get(THREAD_ID)?.message_count).toBe(2);
    expect(fake.messages).toHaveLength(2);
  });

  it('a failure of the second message undoes the first message and the thread update, and is thrown', async () => {
    const { fake } = world();
    const real = fake.chatMessage.create;
    let calls = 0;
    fake.chatMessage.create = async (args) => {
      calls += 1;
      if (calls === 2) throw new Error('connection lost');
      return real(args);
    };
    await expect(append(fake)).rejects.toThrow('connection lost');
    expect(fake.messages).toEqual([]);
    expect(fake.threads.get(THREAD_ID)).toMatchObject({
      message_count: 0,
      report_count: 0,
      last_bias: null,
    });
  });

  it('does one thread update (it returns the count), and two creates, in one transaction', async () => {
    const { fake } = world();
    await append(fake);
    expect(fake.log).toEqual([
      '$transaction',
      'chatThread.update',
      'chatMessage.create',
      'chatMessage.create',
    ]);
  });

  it('asks the update for the count and nothing else, for this thread and this trader', async () => {
    const { fake } = world();
    const real = fake.chatThread.update;
    const seen: unknown[] = [];
    fake.chatThread.update = async (args) => {
      seen.push([args.where, args.select]);
      return real(args);
    };
    await append(fake);
    expect(seen).toEqual([
      [{ id: THREAD_ID, user_id: USER_ID }, { message_count: true }],
    ]);
  });

  it('reads "the thread is not there" from the P2025 error only: any other failure is thrown', async () => {
    for (const failure of [
      new Error('connection lost'),
      Object.assign(new Error('foreign key'), { code: 'P2003' }),
      Object.assign(new Error('timeout'), { code: 'P2028' }),
    ]) {
      const { fake } = world();
      fake.chatThread.update = async () => {
        throw failure;
      };
      await expect(append(fake)).rejects.toBe(failure);
      expect(fake.messages).toEqual([]);
    }
    const { fake } = world();
    fake.chatThread.update = async () => {
      throw Object.assign(new Error('gone'), { code: 'P2025' });
    };
    expect(await append(fake)).toEqual({ ok: false, code: 'NOT_FOUND' });
  });
});

describe('listMessages', () => {
  async function filled() {
    const w = world();
    await append(w.fake);
    const second = await append(w.fake, {
      requestId: 'req-7f3a9c1e-0002',
      reply: withPath(
        withPath(answerResult(), 'thread_id', THREAD_ID),
        'provenance.request_id',
        'req-7f3a9c1e-0002'
      ),
      user: { kind: 'TYPED', text: 'What is UOEDT?', intent: 'EXPLAIN' },
    });
    expect(second.ok).toBe(true);
    return w;
  }

  it('returns a thread`s messages in order of their sequence', async () => {
    const { fake } = await filled();
    const rows = await listMessages(USER_ID, THREAD_ID, {
      client: fake.client(),
    });
    expect(rows?.map((m) => m.seq)).toEqual([1, 2, 3, 4]);
    expect(rows?.map((m) => m.role)).toEqual([
      'USER',
      'ASSISTANT',
      'USER',
      'ASSISTANT',
    ]);
    expect(rows?.map((m) => m.kind)).toEqual([
      'TYPED',
      'REPORT1',
      'TYPED',
      'ANSWER',
    ]);
  });

  it('returns null for a thread that is not the trader`s, as for one that is not there, and asks for no messages', async () => {
    const { fake } = await filled();
    fake.log.length = 0;
    expect(
      await listMessages(OTHER_USER_ID, THREAD_ID, { client: fake.client() })
    ).toBeNull();
    expect(
      await listMessages(USER_ID, 'cm0nothing', { client: fake.client() })
    ).toBeNull();
    expect(fake.log).toEqual(['chatThread.findFirst', 'chatThread.findFirst']);
  });

  it('returns only what comes after a sequence number, and clamps the limit to 1..200', async () => {
    const { fake } = await filled();
    expect(
      (
        await listMessages(USER_ID, THREAD_ID, {
          client: fake.client(),
          afterSeq: 1,
        })
      )?.map((m) => m.seq)
    ).toEqual([2, 3, 4]);
    expect(
      await listMessages(USER_ID, THREAD_ID, {
        client: fake.client(),
        afterSeq: 4,
      })
    ).toEqual([]);
    expect(
      await listMessages(USER_ID, THREAD_ID, {
        client: fake.client(),
        limit: 1,
      })
    ).toHaveLength(1);
    expect(
      await listMessages(USER_ID, THREAD_ID, {
        client: fake.client(),
        limit: 0,
      })
    ).toHaveLength(1);
    expect(
      await listMessages(USER_ID, THREAD_ID, {
        client: fake.client(),
        limit: 5000,
      })
    ).toHaveLength(4);
    expect(MESSAGE_LIST_MAX).toBe(200);
  });

  it('asks nothing for empty arguments', async () => {
    const fake = new FakeChatClient();
    expect(
      await listMessages('', THREAD_ID, { client: fake.client() })
    ).toBeNull();
    expect(
      await listMessages(USER_ID, '', { client: fake.client() })
    ).toBeNull();
    expect(fake.log).toEqual([]);
  });
});

describe('what the message store is made of', () => {
  it('knows two roles', () => {
    expect([...MESSAGE_ROLES]).toEqual(['USER', 'ASSISTANT']);
  });

  it('takes a request id of 1 to 64 letters, digits, underscores and hyphens', async () => {
    for (const requestId of ['a', 'r'.repeat(64), 'req_1-A']) {
      const { fake } = world();
      const result = await append(fake, {
        requestId,
        reply: withPath(reportResult(), 'provenance.request_id', requestId),
      });
      expect(result.ok).toBe(true);
    }
    for (const requestId of ['', 'r'.repeat(65), 'a b', 'a.b', 'a\n', 'é']) {
      const { fake } = world();
      expect(await append(fake, { requestId })).toEqual({
        ok: false,
        code: 'BAD_REQUEST_ID',
      });
    }
  });

  it('reads a thread in order, for this trader, asking only what it needs', async () => {
    const { fake } = world();
    await append(fake);
    const owned: unknown[] = [];
    const read: unknown[] = [];
    const realFirst = fake.chatThread.findFirst;
    const realMany = fake.chatMessage.findMany;
    fake.chatThread.findFirst = async (args) => {
      owned.push(args);
      return realFirst(args);
    };
    fake.chatMessage.findMany = async (args) => {
      read.push(args);
      return realMany(args);
    };
    await listMessages(USER_ID, THREAD_ID, { client: fake.client() });
    expect(owned).toEqual([
      { where: { id: THREAD_ID, user_id: USER_ID }, select: { id: true } },
    ]);
    expect(read).toEqual([
      {
        where: { thread_id: THREAD_ID },
        orderBy: { seq: 'asc' },
        take: MESSAGE_LIST_MAX,
      },
    ]);
  });
});
