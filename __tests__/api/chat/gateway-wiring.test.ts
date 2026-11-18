/**
 * @jest-environment node
 */
/**
 * How the chat gateway uses its checks
 * (infra/contabo-chat-stack/apps/server/src/index.ts).
 *
 * index.ts starts an HTTP server, Socket.IO and Redis connections when it is
 * imported, so those are replaced here and the handlers it registers are called
 * directly. security.ts and types.ts are the real ones, so what is tested is
 * the wiring: which check runs first, and what reaches the queue.
 */
type Handler = (...args: unknown[]) => unknown;

const mockState: {
  middleware?: (
    socket: unknown,
    next: (error?: Error) => void
  ) => Promise<void>;
  onConnection?: (socket: unknown) => void;
} = {};
const mockQueueAdd = jest.fn();
const mockCheckGuest = jest.fn();
const mockCheckHandshake = jest.fn();
const mockVerifyChatToken = jest.fn();

jest.mock('dotenv/config', () => ({}), { virtual: true });
jest.mock(
  'express',
  () => ({
    __esModule: true,
    default: () => ({ get: jest.fn() }),
  }),
  { virtual: true }
);
jest.mock('http', () => ({
  __esModule: true,
  default: {
    createServer: () => ({ listen: jest.fn(), close: jest.fn() }),
  },
}));
jest.mock(
  'socket.io',
  () => ({
    __esModule: true,
    Server: class FakeServer {
      use(middleware: never): void {
        mockState.middleware = middleware;
      }
      on(event: string, handler: never): void {
        if (event === 'connection') mockState.onConnection = handler;
      }
      to(): { emit: jest.Mock } {
        return { emit: jest.fn() };
      }
      close(): void {}
    },
  }),
  { virtual: true }
);
jest.mock(
  'bullmq',
  () => ({
    __esModule: true,
    Job: { fromId: jest.fn() },
  }),
  { virtual: true }
);
jest.mock('../../../infra/contabo-chat-stack/apps/server/src/queue', () => ({
  __esModule: true,
  CHAT_QUEUE_NAME: 'chat-jobs',
  chatQueue: { add: (...args: unknown[]) => mockQueueAdd(...args) },
  chatQueueEvents: { on: jest.fn() },
}));
jest.mock(
  '../../../infra/contabo-chat-stack/apps/server/src/redisClient',
  () => ({
    __esModule: true,
    createRedisConnection: () => ({}),
  })
);
jest.mock('../../../infra/contabo-chat-stack/apps/server/src/auth', () => ({
  __esModule: true,
  verifyChatToken: (...args: unknown[]) => mockVerifyChatToken(...args),
  guestIdentity: (socketId: string) => ({
    userId: `guest_${socketId}`,
    tier: 'GUEST',
  }),
}));
jest.mock(
  '../../../infra/contabo-chat-stack/apps/server/src/rateLimiter',
  () => ({
    __esModule: true,
    checkGuestRateLimit: (...args: unknown[]) => mockCheckGuest(...args),
    checkHandshakeRateLimit: (...args: unknown[]) =>
      mockCheckHandshake(...args),
  })
);

interface FakeSocket {
  id: string;
  handshake: {
    headers: Record<string, string>;
    address: string;
    auth: Record<string, unknown>;
  };
  data: Record<string, unknown>;
  emit: jest.Mock;
  on: jest.Mock;
  handlers: Record<string, Handler>;
}

function fakeSocket(
  headers: Record<string, string> = { 'x-real-ip': '203.0.113.50' },
  auth: Record<string, unknown> = {}
): FakeSocket {
  const socket: FakeSocket = {
    id: 'AbCdEfGhIjKlMnOpQrSt',
    handshake: { headers, address: '127.0.0.1', auth },
    data: {},
    emit: jest.fn(),
    on: jest.fn(),
    handlers: {},
  };
  socket.on.mockImplementation((event: string, handler: Handler) => {
    socket.handlers[event] = handler;
  });
  return socket;
}

const VALID_MESSAGE = {
  id: 'usr-1730000000000-a1b2',
  text: 'How much is PRO?',
  topic: 'Product Info',
  timestamp: '2026-11-01T12:34:56.789Z',
};

async function handshake(socket: FakeSocket): Promise<jest.Mock> {
  const next = jest.fn();
  await mockState.middleware!(socket, next);
  return next;
}

async function connect(socket: FakeSocket): Promise<void> {
  await handshake(socket);
  mockState.onConnection!(socket);
}

beforeAll(() => {
  const processSpy = jest
    .spyOn(process, 'on')
    .mockImplementation(() => process);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  try {
    jest.isolateModules(() => {
      require('../../../infra/contabo-chat-stack/apps/server/src/index');
    });
  } finally {
    processSpy.mockRestore();
  }
});

beforeEach(() => {
  mockQueueAdd.mockReset().mockResolvedValue({});
  mockCheckGuest.mockReset().mockResolvedValue({ allowed: true, remaining: 9 });
  mockCheckHandshake
    .mockReset()
    .mockResolvedValue({ allowed: true, remaining: 19 });
  mockVerifyChatToken.mockReset().mockReturnValue(null);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('handshake', () => {
  it('counts the connection by the X-Real-IP address, before the token is looked at', async () => {
    const socket = fakeSocket(
      {
        'x-real-ip': '203.0.113.50',
        'x-forwarded-for': 'client-supplied-text, 198.51.100.7',
      },
      { token: 'some.token' }
    );

    const next = await handshake(socket);

    expect(mockCheckHandshake).toHaveBeenCalledTimes(1);
    expect(mockCheckHandshake.mock.calls[0]![1]).toBe('203.0.113.50');
    expect(mockVerifyChatToken).toHaveBeenCalledWith('some.token');
    expect(mockCheckHandshake.mock.invocationCallOrder[0]).toBeLessThan(
      mockVerifyChatToken.mock.invocationCallOrder[0]!
    );
    expect(next).toHaveBeenCalledWith();
  });

  it('counts an IPv6 client by its /64', async () => {
    await handshake(
      fakeSocket({ 'x-real-ip': '2001:db8:abcd:12:1111:2222:3333:4444' })
    );
    await handshake(
      fakeSocket({ 'x-real-ip': '2001:db8:abcd:12:aaaa:bbbb:cccc:dddd' })
    );

    const keys = mockCheckHandshake.mock.calls.map((call) => call[1]);
    expect(keys).toEqual(['2001:db8:abcd:12::/64', '2001:db8:abcd:12::/64']);
  });

  it('refuses a connection over the limit without verifying its token', async () => {
    mockCheckHandshake.mockResolvedValue({ allowed: false, remaining: 0 });

    const next = await handshake(
      fakeSocket({ 'x-real-ip': '203.0.113.50' }, { token: 't' })
    );

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0]![0] as Error;
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('RATE_LIMIT_EXCEEDED');
    expect(mockVerifyChatToken).not.toHaveBeenCalled();
  });

  it('lets the connection through when the counter cannot be reached', async () => {
    mockCheckHandshake.mockRejectedValue(new Error('redis down'));

    const next = await handshake(
      fakeSocket({ 'x-real-ip': '203.0.113.50' }, { token: 't' })
    );

    expect(next).toHaveBeenCalledWith();
    expect(mockVerifyChatToken).toHaveBeenCalledWith('t');
  });

  it('still degrades a bad token to a guest, as before', async () => {
    mockVerifyChatToken.mockImplementation(() => {
      throw new Error('jwt expired');
    });
    const socket = fakeSocket(
      { 'x-real-ip': '203.0.113.50' },
      { token: 'expired' }
    );

    const next = await handshake(socket);

    expect(next).toHaveBeenCalledWith();
    expect(socket.data).toMatchObject({
      tokenWasInvalid: true,
      identity: { tier: 'GUEST' },
    });
  });
});

describe('client_message', () => {
  it.each([
    ['no payload', undefined],
    ['a string', 'hello'],
    ['an empty object', {}],
    ['a blank text', { ...VALID_MESSAGE, text: '   ' }],
    [
      'a text over 1,000 characters',
      { ...VALID_MESSAGE, text: 'a'.repeat(1001) },
    ],
    ['an id that is not safe', { ...VALID_MESSAGE, id: '../x' }],
    [
      'a topic that is not one of the chips',
      { ...VALID_MESSAGE, topic: 'Other' },
    ],
    [
      'a timestamp that is not ISO-8601',
      { ...VALID_MESSAGE, timestamp: 'now' },
    ],
  ])(
    'drops %s before the rate limiter and the queue',
    async (_label, payload) => {
      const socket = fakeSocket();
      await connect(socket);

      await socket.handlers['client_message']!(payload);

      expect(socket.emit).toHaveBeenCalledWith(
        'chat_error',
        expect.objectContaining({ code: 'SERVER_ERROR' })
      );
      expect(mockCheckGuest).not.toHaveBeenCalled();
      expect(mockQueueAdd).not.toHaveBeenCalled();
      expect(socket.emit).not.toHaveBeenCalledWith(
        'bot_typing',
        expect.anything()
      );
    }
  );

  it('checks a guest against the normalised address, then queues only the contract fields under a socket-scoped job id', async () => {
    const socket = fakeSocket({
      'x-real-ip': '203.0.113.50',
      'x-forwarded-for': 'client-supplied-text',
    });
    await connect(socket);

    await socket.handlers['client_message']!({
      ...VALID_MESSAGE,
      extra: 'x'.repeat(10_000),
      nested: { deep: true },
    });

    expect(mockCheckGuest.mock.calls[0]![1]).toBe('203.0.113.50');
    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
    const [queueName, jobData, options] = mockQueueAdd.mock.calls[0]!;
    expect(queueName).toBe('chat-jobs');
    expect(jobData).toEqual({
      socketId: 'AbCdEfGhIjKlMnOpQrSt',
      user: { userId: 'guest_AbCdEfGhIjKlMnOpQrSt', tier: 'GUEST' },
      payload: VALID_MESSAGE,
    });
    expect(Object.keys(jobData.payload).sort()).toEqual([
      'id',
      'text',
      'timestamp',
      'topic',
    ]);
    expect(options.jobId).toBe('AbCdEfGhIjKlMnOpQrSt.usr-1730000000000-a1b2');
    expect(options.jobId).not.toContain(':');
  });

  it('answers a guest over the hourly limit with RATE_LIMIT_EXCEEDED and queues nothing', async () => {
    mockCheckGuest.mockResolvedValue({ allowed: false, remaining: 0 });
    const socket = fakeSocket();
    await connect(socket);

    await socket.handlers['client_message']!(VALID_MESSAGE);

    expect(socket.emit).toHaveBeenCalledWith(
      'chat_error',
      expect.objectContaining({ code: 'RATE_LIMIT_EXCEEDED' })
    );
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('does not count a signed-in user against the guest address limit', async () => {
    mockVerifyChatToken.mockReturnValue({
      userId: 'user_1',
      name: 'Ada',
      tier: 'PRO',
    });
    const socket = fakeSocket(
      { 'x-real-ip': '203.0.113.50' },
      { token: 'good' }
    );
    await connect(socket);

    await socket.handlers['client_message']!(VALID_MESSAGE);

    expect(mockCheckGuest).not.toHaveBeenCalled();
    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
    expect(mockQueueAdd.mock.calls[0]![1].user).toEqual({
      userId: 'user_1',
      name: 'Ada',
      tier: 'PRO',
    });
  });

  it('gives two sockets that reuse one client id two different jobs', async () => {
    const first = fakeSocket();
    const second = fakeSocket();
    second.id = 'ZyXwVuTsRqPoNmLkJiHg';
    await connect(first);
    await connect(second);

    await first.handlers['client_message']!(VALID_MESSAGE);
    await second.handlers['client_message']!(VALID_MESSAGE);

    const ids = mockQueueAdd.mock.calls.map((call) => call[2].jobId);
    expect(new Set(ids).size).toBe(2);
  });

  it('reports a queue failure as SERVER_ERROR, as before', async () => {
    mockQueueAdd.mockRejectedValue(new Error('redis down'));
    const socket = fakeSocket();
    await connect(socket);

    await socket.handlers['client_message']!(VALID_MESSAGE);

    expect(socket.emit).toHaveBeenCalledWith(
      'chat_error',
      expect.objectContaining({ code: 'SERVER_ERROR' })
    );
  });
});
