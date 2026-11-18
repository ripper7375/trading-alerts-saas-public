/**
 * @jest-environment node
 */
/**
 * Chat bot worker text limit
 * (infra/contabo-chat-stack/apps/bot-worker/src/limits.ts and worker.ts).
 *
 * The server checks a message before it enqueues it; the worker repeats the
 * length check because a job is the last stop before quota is spent and the
 * provider bills for the text. worker.ts opens Redis connections and a BullMQ
 * worker when it is imported, so those are replaced here and the job processor
 * it registers is called directly.
 */
const mockGetLlmReply = jest.fn();
const mockCheckQuota = jest.fn();
const mockWorkerState: {
  processor?: (job: unknown) => Promise<{
    socketId: string;
    errorCode?: string;
    message: { sender: string; text: string; id: string };
  }>;
} = {};

function mockRedisModule() {
  return {
    __esModule: true,
    default: class FakeRedis {},
  };
}

function mockBullmqModule() {
  return {
    __esModule: true,
    Worker: class FakeWorker {
      constructor(_name: string, processor: (job: unknown) => Promise<never>) {
        mockWorkerState.processor = processor;
      }
      on(): this {
        return this;
      }
      async close(): Promise<void> {}
    },
  };
}

jest.mock('dotenv/config', () => ({}), { virtual: true });
jest.mock('ioredis', () => mockRedisModule());
jest.mock('bullmq', () => mockBullmqModule());
jest.mock(
  '../../../infra/contabo-chat-stack/apps/bot-worker/src/llmClient',
  () => ({
    __esModule: true,
    getLlmReply: (...args: unknown[]) => mockGetLlmReply(...args),
  })
);
jest.mock(
  '../../../infra/contabo-chat-stack/apps/bot-worker/src/quota',
  () => ({
    __esModule: true,
    checkAndIncrementAuthQuota: (...args: unknown[]) => mockCheckQuota(...args),
  })
);

import path from 'path';

import {
  MAX_MESSAGE_TEXT_LENGTH,
  REJECTED_TEXT_MESSAGE,
  isProcessableText,
} from '../../../infra/contabo-chat-stack/apps/bot-worker/src/limits';
import { MAX_CLIENT_MESSAGE_LENGTH } from '../../../infra/contabo-chat-stack/apps/server/src/types';

const workerSrcDir = path.resolve(
  __dirname,
  '../../../infra/contabo-chat-stack/apps/bot-worker/src'
);

function resolveFromWorker(specifier: string): string | null {
  try {
    return require.resolve(specifier, { paths: [workerSrcDir] });
  } catch {
    return null;
  }
}

function loadWorker(): NonNullable<typeof mockWorkerState.processor> {
  // worker.ts registers shutdown handlers on the process; keep them out of Jest's.
  const onSpy = jest.spyOn(process, 'on').mockImplementation(() => process);
  try {
    jest.isolateModules(() => {
      // apps/bot-worker may carry its own nested node_modules alongside root's;
      // mock the exact file paths that worker.ts resolves from its directory.
      const dotenvPath = resolveFromWorker('dotenv/config');
      if (dotenvPath) jest.doMock(dotenvPath, () => ({}));
      const ioredisPath = resolveFromWorker('ioredis');
      if (ioredisPath) jest.doMock(ioredisPath, () => mockRedisModule());
      const bullmqPath = resolveFromWorker('bullmq');
      if (bullmqPath) jest.doMock(bullmqPath, () => mockBullmqModule());
      require('../../../infra/contabo-chat-stack/apps/bot-worker/src/worker');
    });
  } finally {
    onSpy.mockRestore();
  }
  if (!mockWorkerState.processor)
    throw new Error('worker did not register a processor');
  return mockWorkerState.processor;
}

function job(text: unknown, tier: 'GUEST' | 'FREE' | 'PRO' = 'GUEST') {
  return {
    id: 'job-1',
    data: {
      socketId: 'socket-1',
      user: { userId: tier === 'GUEST' ? 'guest_socket-1' : 'user-1', tier },
      payload: {
        id: 'usr-1',
        text,
        timestamp: '2026-11-01T12:34:56.789Z',
      },
    },
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  mockWorkerState.processor = undefined;
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('limits', () => {
  it('uses the same length limit as the server', () => {
    expect(MAX_MESSAGE_TEXT_LENGTH).toBe(MAX_CLIENT_MESSAGE_LENGTH);
    expect(MAX_MESSAGE_TEXT_LENGTH).toBe(1000);
  });

  it('accepts a non-blank string up to the limit', () => {
    expect(isProcessableText('hello')).toBe(true);
    expect(isProcessableText('a'.repeat(MAX_MESSAGE_TEXT_LENGTH))).toBe(true);
  });

  it.each([
    ['one character over', 'a'.repeat(MAX_MESSAGE_TEXT_LENGTH + 1)],
    [
      'padding that adds up to over the limit',
      `${'a'.repeat(MAX_MESSAGE_TEXT_LENGTH)} `,
    ],
    ['an empty string', ''],
    ['whitespace only', ' \n\t '],
    ['undefined', undefined],
    ['null', null],
    ['a number', 42],
    ['an object', { length: 5 }],
    ['an array of strings', ['hello']],
  ])('refuses %s', (_label, text) => {
    expect(isProcessableText(text)).toBe(false);
  });

  it('names the limit in the message it sends back', () => {
    expect(REJECTED_TEXT_MESSAGE).toContain('1,000 characters');
  });
});

describe('worker job processor', () => {
  it.each([
    ['an over-long text', 'a'.repeat(MAX_MESSAGE_TEXT_LENGTH + 1)],
    ['a blank text', '   '],
    ['a text that is not a string', { text: 'hello' }],
  ])(
    'answers %s without spending quota or calling the LLM',
    async (_label, text) => {
      const processor = loadWorker();

      const result = await processor(job(text, 'PRO'));

      expect(result.socketId).toBe('socket-1');
      expect(result.errorCode).toBe('SERVER_ERROR');
      expect(result.message.sender).toBe('bot');
      expect(result.message.text).toBe(REJECTED_TEXT_MESSAGE);
      expect(mockCheckQuota).not.toHaveBeenCalled();
      expect(mockGetLlmReply).not.toHaveBeenCalled();
    }
  );

  it('passes a text at the limit to the quota check and the LLM', async () => {
    mockCheckQuota.mockResolvedValue({ exceeded: false });
    mockGetLlmReply.mockResolvedValue('a reply');
    const processor = loadWorker();
    const text = 'a'.repeat(MAX_MESSAGE_TEXT_LENGTH);

    const result = await processor(job(text, 'PRO'));

    expect(mockCheckQuota).toHaveBeenCalledTimes(1);
    expect(mockGetLlmReply).toHaveBeenCalledWith(text);
    expect(result.errorCode).toBeUndefined();
    expect(result.message.text).toBe('a reply');
  });

  it('still reports an exhausted quota as before for a valid text', async () => {
    mockCheckQuota.mockResolvedValue({ exceeded: true });
    const processor = loadWorker();

    const result = await processor(job('hello', 'PRO'));

    expect(result.errorCode).toBe('QUOTA_EXCEEDED');
    expect(mockGetLlmReply).not.toHaveBeenCalled();
  });

  it('still reports a failed LLM call as before for a valid text', async () => {
    mockCheckQuota.mockResolvedValue({ exceeded: false });
    mockGetLlmReply.mockRejectedValue(new Error('provider down'));
    const processor = loadWorker();

    const result = await processor(job('hello'));

    expect(result.errorCode).toBe('SERVER_ERROR');
    expect(result.message.text).not.toBe(REJECTED_TEXT_MESSAGE);
  });
});
