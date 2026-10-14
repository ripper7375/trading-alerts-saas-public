/**
 * @jest-environment node
 */

import type { ThreadCursor } from '@/lib/platform/chat/threads-store';
import {
  THREAD_LIST_DEFAULT,
  THREAD_LIST_MAX,
  createThread,
  deleteThread,
  getThread,
  listThreads,
  renameThread,
} from '@/lib/platform/chat/threads-store';

import { OTHER_USER_ID, USER_ID } from '../../reply/helpers/fixtures';
import { FakeChatClient } from '../helpers/fakes';

// the stores import the database client at load time; these tests pass their own
jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));

const input = (over: Record<string, unknown> = {}) => ({
  userId: USER_ID,
  symbol: 'XAUUSD',
  traderType: 'DAY_TRADER' as const,
  title: 'XAUUSD · LONG · 18 SEP 20:55',
  ...over,
});

describe('createThread', () => {
  it('makes a thread for the trader, with an AUTO title and no messages yet', async () => {
    const fake = new FakeChatClient();
    const result = await createThread(input(), { client: fake.client() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.thread).toMatchObject({
      user_id: USER_ID,
      symbol: 'XAUUSD',
      title: 'XAUUSD · LONG · 18 SEP 20:55',
      title_source: 'AUTO',
      trader_type: 'DAY_TRADER',
      message_count: 0,
      report_count: 0,
      last_bias: null,
      last_preview: '',
    });
    expect(fake.threads.size).toBe(1);
  });

  it.each([
    ['no user', { userId: '' }, 'MISSING_USER'],
    ['a symbol in lower case', { symbol: 'xauusd' }, 'BAD_SYMBOL'],
    ['an empty symbol', { symbol: '' }, 'BAD_SYMBOL'],
    ['a symbol of 25 characters', { symbol: 'A'.repeat(25) }, 'BAD_SYMBOL'],
    ['an unknown trader type', { traderType: 'INVESTOR' }, 'BAD_TRADER_TYPE'],
    ['an empty title', { title: '   ' }, 'TITLE_EMPTY'],
    ['a title of 81 characters', { title: 'x'.repeat(81) }, 'TITLE_TOO_LONG'],
  ])('refuses %s and writes nothing', async (_name, over, code) => {
    const fake = new FakeChatClient();
    const result = await createThread(input(over), { client: fake.client() });
    expect(result).toEqual({ ok: false, code });
    expect(fake.threads.size).toBe(0);
    expect(fake.log).toEqual([]);
  });

  it('accepts a symbol of 24 characters with a dot and a digit, and a title of 80', async () => {
    const fake = new FakeChatClient();
    expect(
      (
        await createThread(input({ symbol: 'A.B1'.padEnd(24, 'C') }), {
          client: fake.client(),
        })
      ).ok
    ).toBe(true);
    expect(
      (
        await createThread(input({ title: 'x'.repeat(80) }), {
          client: fake.client(),
        })
      ).ok
    ).toBe(true);
  });

  it('cleans the title the way the trader`s own is cleaned', async () => {
    const fake = new FakeChatClient();
    const result = await createThread(input({ title: '  XAUUSD   LONG ' }), {
      client: fake.client(),
    });
    expect(result.ok && result.thread.title).toBe('XAUUSD LONG');
  });
});

describe('getThread', () => {
  it('returns the trader`s thread and null for another trader`s, as for one that is not there', async () => {
    const fake = new FakeChatClient();
    const mine = fake.seedThread({ user_id: USER_ID });
    const theirs = fake.seedThread({ user_id: OTHER_USER_ID });
    expect(
      (await getThread(USER_ID, mine.id, { client: fake.client() }))?.id
    ).toBe(mine.id);
    expect(
      await getThread(USER_ID, theirs.id, { client: fake.client() })
    ).toBeNull();
    expect(
      await getThread(USER_ID, 'cm0nothing', { client: fake.client() })
    ).toBeNull();
  });

  it('asks nothing for an empty id and answers null', async () => {
    const fake = new FakeChatClient();
    expect(await getThread('', 'x', { client: fake.client() })).toBeNull();
    expect(await getThread(USER_ID, '', { client: fake.client() })).toBeNull();
    expect(fake.log).toEqual([]);
  });
});

describe('listThreads', () => {
  const T = (minute: number) => new Date(Date.UTC(2026, 8, 18, 21, minute, 0));

  function seeded(): FakeChatClient {
    const fake = new FakeChatClient();
    fake.seedThread({ user_id: USER_ID, id: 'a', last_message_at: T(10) });
    fake.seedThread({ user_id: USER_ID, id: 'b', last_message_at: T(30) });
    fake.seedThread({ user_id: USER_ID, id: 'c', last_message_at: T(20) });
    fake.seedThread({ user_id: USER_ID, id: 'd', last_message_at: T(20) });
    fake.seedThread({
      user_id: OTHER_USER_ID,
      id: 'x',
      last_message_at: T(40),
    });
    return fake;
  }

  it('lists the trader`s threads, newest message first, ties by id descending, and none of another trader`s', async () => {
    const page = await listThreads(USER_ID, { client: seeded().client() });
    expect(page.threads.map((t) => t.id)).toEqual(['b', 'd', 'c', 'a']);
    expect(page.next).toBeNull();
  });

  it('pages by keyset, never skipping or repeating a thread, even where two share a time', async () => {
    const fake = seeded();
    const seen: string[] = [];
    let after: ThreadCursor | undefined;
    for (let i = 0; i < 10; i += 1) {
      const page = await listThreads(USER_ID, {
        client: fake.client(),
        limit: 1,
        after,
      });
      seen.push(...page.threads.map((t) => t.id));
      if (page.next === null) break;
      after = page.next;
    }
    expect(seen).toEqual(['b', 'd', 'c', 'a']);
  });

  it('gives a cursor only when there is more, and puts the user id in every query', async () => {
    const fake = seeded();
    const first = await listThreads(USER_ID, {
      client: fake.client(),
      limit: 2,
    });
    expect(first.threads.map((t) => t.id)).toEqual(['b', 'd']);
    expect(first.next).toEqual({ lastMessageAt: T(20), id: 'd' });
    const exact = await listThreads(USER_ID, {
      client: fake.client(),
      limit: 4,
    });
    expect(exact.next).toBeNull();
    const other = await listThreads(OTHER_USER_ID, { client: fake.client() });
    expect(other.threads.map((t) => t.id)).toEqual(['x']);
  });

  it('clamps the limit to 1..100 and defaults to 50', async () => {
    expect(THREAD_LIST_DEFAULT).toBe(50);
    expect(THREAD_LIST_MAX).toBe(100);
    const fake = new FakeChatClient();
    for (let i = 0; i < 120; i += 1) {
      fake.seedThread({
        user_id: USER_ID,
        id: `t${String(i).padStart(3, '0')}`,
        last_message_at: T(i % 60),
      });
    }
    expect(
      (await listThreads(USER_ID, { client: fake.client() })).threads
    ).toHaveLength(50);
    expect(
      (await listThreads(USER_ID, { client: fake.client(), limit: 1000 }))
        .threads
    ).toHaveLength(100);
    expect(
      (await listThreads(USER_ID, { client: fake.client(), limit: 0 })).threads
    ).toHaveLength(1);
    expect(
      (await listThreads(USER_ID, { client: fake.client(), limit: -5 })).threads
    ).toHaveLength(1);
    expect(
      (await listThreads(USER_ID, { client: fake.client(), limit: 2.9 }))
        .threads
    ).toHaveLength(2);
  });

  it('lists nothing, and asks nothing, for no user', async () => {
    const fake = seeded();
    expect(await listThreads('', { client: fake.client() })).toEqual({
      threads: [],
      next: null,
    });
    expect(fake.log).toEqual([]);
  });
});

describe('renameThread', () => {
  it('gives the thread the trader`s own title, with source USER', async () => {
    const fake = new FakeChatClient();
    const thread = fake.seedThread({ user_id: USER_ID });
    const result = await renameThread(USER_ID, thread.id, '  My gold  setup ', {
      client: fake.client(),
    });
    expect(result).toEqual({ ok: true, title: 'My gold setup' });
    expect(fake.threads.get(thread.id)).toMatchObject({
      title: 'My gold setup',
      title_source: 'USER',
    });
  });

  it('refuses an empty or over-long title without touching the thread', async () => {
    const fake = new FakeChatClient();
    const thread = fake.seedThread({ user_id: USER_ID });
    expect(
      await renameThread(USER_ID, thread.id, '\n\t ', { client: fake.client() })
    ).toEqual({ ok: false, code: 'TITLE_EMPTY' });
    expect(
      await renameThread(USER_ID, thread.id, 'x'.repeat(81), {
        client: fake.client(),
      })
    ).toEqual({ ok: false, code: 'TITLE_TOO_LONG' });
    expect(fake.threads.get(thread.id)?.title_source).toBe('AUTO');
  });

  it('says NOT_FOUND for a thread that is another trader`s, and changes nothing', async () => {
    const fake = new FakeChatClient();
    const theirs = fake.seedThread({ user_id: OTHER_USER_ID, title: 'Theirs' });
    expect(
      await renameThread(USER_ID, theirs.id, 'Mine now', {
        client: fake.client(),
      })
    ).toEqual({ ok: false, code: 'NOT_FOUND' });
    expect(fake.threads.get(theirs.id)?.title).toBe('Theirs');
    expect(
      await renameThread('', theirs.id, 'x', { client: fake.client() })
    ).toEqual({ ok: false, code: 'MISSING_USER' });
  });
});

describe('deleteThread', () => {
  it('deletes the trader`s thread and its messages with it, and says so', async () => {
    const fake = new FakeChatClient();
    const thread = fake.seedThread({ user_id: USER_ID });
    fake.messages.push({
      id: 'm1',
      thread_id: thread.id,
      seq: 1,
      request_id: 'r1',
      role: 'USER',
      kind: 'TYPED',
    } as never);
    expect(
      await deleteThread(USER_ID, thread.id, { client: fake.client() })
    ).toBe(true);
    expect(fake.threads.size).toBe(0);
    expect(fake.messages).toEqual([]);
  });

  it('does not delete another trader`s thread, and says false', async () => {
    const fake = new FakeChatClient();
    const theirs = fake.seedThread({ user_id: OTHER_USER_ID });
    expect(
      await deleteThread(USER_ID, theirs.id, { client: fake.client() })
    ).toBe(false);
    expect(fake.threads.size).toBe(1);
  });

  it('says false for a thread that is not there and for empty arguments, asking nothing for the latter', async () => {
    const fake = new FakeChatClient();
    expect(
      await deleteThread(USER_ID, 'cm0nothing', { client: fake.client() })
    ).toBe(false);
    expect(fake.log).toEqual(['chatThread.deleteMany']);
    const quiet = new FakeChatClient();
    expect(await deleteThread('', 'x', { client: quiet.client() })).toBe(false);
    expect(await deleteThread(USER_ID, '', { client: quiet.client() })).toBe(
      false
    );
    expect(quiet.log).toEqual([]);
  });
});

describe('listThreads: what it asks the database', () => {
  it('asks for one more than the page, to know if there is another page', async () => {
    const fake = new FakeChatClient();
    for (const id of ['a', 'b', 'c']) fake.seedThread({ user_id: USER_ID, id });
    const asked: number[] = [];
    const real = fake.chatThread.findMany;
    fake.chatThread.findMany = async (args) => {
      asked.push(args.take);
      return real(args);
    };
    await listThreads(USER_ID, { client: fake.client(), limit: 2 });
    await listThreads(USER_ID, { client: fake.client(), limit: 3 });
    expect(asked).toEqual([3, 4]);
  });

  it('says there is no next page when the page holds every thread that is left', async () => {
    const fake = new FakeChatClient();
    for (const id of ['a', 'b']) fake.seedThread({ user_id: USER_ID, id });
    const page = await listThreads(USER_ID, {
      client: fake.client(),
      limit: 2,
    });
    expect(page.threads).toHaveLength(2);
    expect(page.next).toBeNull();
    const short = await listThreads(USER_ID, {
      client: fake.client(),
      limit: 1,
    });
    expect(short.next).not.toBeNull();
  });
});
