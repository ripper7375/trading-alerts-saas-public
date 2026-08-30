/**
 * lib/socket-client.ts tests (Session 14-2, Decision 2). Wire contract frozen
 * at Session 14-0, proven live at Session 14-1.
 */

let capturedHandlers: Record<string, (...args: unknown[]) => void>;
const mockEmit = jest.fn();

function makeFakeSocket() {
  capturedHandlers = {};
  return {
    on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
      capturedHandlers[event] = handler;
    }),
    emit: mockEmit,
  };
}

const mockIo = jest.fn();
jest.mock('socket.io-client', () => ({
  io: (...args: unknown[]) => mockIo(...args),
}));

const originalFetch = global.fetch;
const originalEnv = process.env;

describe('chatSocketManager — offline / unconfigured', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv, NEXT_PUBLIC_SOCKET_CHAT_URL: '' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('sendMessage() degrades to the canned fallback generator when never connected', async () => {
    const { chatSocketManager } = await import('@/lib/socket-client');
    const onFallbackReply = jest.fn();

    const userMsg = chatSocketManager.sendMessage(
      'I have a question about PRO subscription',
      'PRO Subscription',
      onFallbackReply
    );

    expect(userMsg.sender).toBe('user');
    expect(mockEmit).not.toHaveBeenCalled();

    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(onFallbackReply).toHaveBeenCalledTimes(1);
    const reply = onFallbackReply.mock.calls[0][0];
    expect(reply.sender).toBe('bot');
    expect(reply.text).toMatch(/PRO Tier/);
  }, 10000);

  it('initSocket() no-ops and never calls io() when NEXT_PUBLIC_SOCKET_CHAT_URL is unset', async () => {
    const { chatSocketManager } = await import('@/lib/socket-client');
    const socket = await chatSocketManager.initSocket();

    expect(socket).toBeNull();
    expect(mockIo).not.toHaveBeenCalled();
  });
});

describe('chatSocketManager — connected', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SOCKET_CHAT_URL: 'https://chat-api.davintrade.app',
    };
    mockIo.mockImplementation(() => makeFakeSocket());
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        token: 'signed-jwt',
        url: 'https://chat-api.davintrade.app',
      }),
    }) as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
  });

  it('fetches /api/chat/token before connecting and passes it in the auth payload', async () => {
    const { chatSocketManager } = await import('@/lib/socket-client');
    await chatSocketManager.initSocket();

    expect(global.fetch).toHaveBeenCalledWith('/api/chat/token');
    expect(mockIo).toHaveBeenCalledWith(
      'https://chat-api.davintrade.app',
      expect.objectContaining({
        auth: { token: 'signed-jwt' },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      })
    );
  });

  it('registers listeners for connect/disconnect/support_message/bot_typing/chat_error and forwards them to callbacks', async () => {
    const { chatSocketManager } = await import('@/lib/socket-client');
    const onMessage = jest.fn();
    const onTyping = jest.fn();
    const onError = jest.fn();
    const onConnectionChange = jest.fn();

    await chatSocketManager.initSocket({
      onMessage,
      onTyping,
      onError,
      onConnectionChange,
    });

    expect(Object.keys(capturedHandlers).sort()).toEqual(
      [
        'bot_typing',
        'chat_error',
        'connect',
        'disconnect',
        'support_message',
      ].sort()
    );

    capturedHandlers['connect']();
    expect(onConnectionChange).toHaveBeenCalledWith(true);

    capturedHandlers['bot_typing']({ isTyping: true });
    expect(onTyping).toHaveBeenCalledWith(true);

    capturedHandlers['support_message']({
      id: 'bot-1',
      sender: 'bot',
      text: 'Hi there',
      timestamp: '2026-08-30T00:00:00.000Z',
    });
    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'bot-1', text: 'Hi there' })
    );

    capturedHandlers['chat_error']({
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Guest message limit reached',
    });
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'RATE_LIMIT_EXCEEDED' })
    );
  });

  it('sendMessage() emits client_message without a client-asserted sender field once connected', async () => {
    const { chatSocketManager } = await import('@/lib/socket-client');
    await chatSocketManager.initSocket();
    capturedHandlers['connect']();

    chatSocketManager.sendMessage('How much is PRO?', 'PRO Subscription');

    expect(mockEmit).toHaveBeenCalledTimes(1);
    const [event, payload] = mockEmit.mock.calls[0];
    expect(event).toBe('client_message');
    expect(payload).not.toHaveProperty('sender');
    expect(payload).toEqual(
      expect.objectContaining({
        text: 'How much is PRO?',
        topic: 'PRO Subscription',
      })
    );
    expect(typeof payload.id).toBe('string');
    expect(typeof payload.timestamp).toBe('string');
  });
});
