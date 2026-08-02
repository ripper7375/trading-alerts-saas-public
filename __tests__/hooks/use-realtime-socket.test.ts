/**
 * Tests for use-realtime-socket (F8, Session 4B-17) — the real
 * socket.io-client hook that replaced the retired raw-WebSocket
 * hooks/use-websocket.ts.
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import { useRealtimeSocket } from '@/hooks/use-realtime-socket';

const mockDisconnect = jest.fn();
let capturedHandlers: Record<string, (...args: unknown[]) => void>;

function makeFakeSocket(): {
  on: jest.Mock;
  disconnect: jest.Mock;
} {
  capturedHandlers = {};
  return {
    on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
      capturedHandlers[event] = handler;
    }),
    disconnect: mockDisconnect,
  };
}

const mockIo = jest.fn();
jest.mock('socket.io-client', () => ({
  io: (...args: unknown[]) => mockIo(...args),
}));

let sessionStatus = 'authenticated';
jest.mock('next-auth/react', () => ({
  useSession: () => ({ status: sessionStatus }),
}));

const originalFetch = global.fetch;

describe('useRealtimeSocket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStatus = 'authenticated';
    mockIo.mockImplementation(() => makeFakeSocket());
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'a-jwe', url: 'http://op-service.test' }),
    }) as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('does nothing when the session is not authenticated', async () => {
    sessionStatus = 'unauthenticated';
    renderHook(() => useRealtimeSocket());

    await act(async () => {
      await Promise.resolve();
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockIo).not.toHaveBeenCalled();
  });

  it('fetches a token from /api/realtime/token and connects with it in the auth payload', async () => {
    renderHook(() => useRealtimeSocket());

    await waitFor(() => expect(mockIo).toHaveBeenCalled());

    expect(global.fetch).toHaveBeenCalledWith('/api/realtime/token');
    expect(mockIo).toHaveBeenCalledWith('http://op-service.test', {
      auth: { token: 'a-jwe' },
      transports: ['websocket', 'polling'],
    });
  });

  it('does not connect if the token endpoint returns a non-OK response', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false }) as unknown as typeof fetch;

    renderHook(() => useRealtimeSocket());

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockIo).not.toHaveBeenCalled();
  });

  it('routes notification and alert_fired events to their callbacks', async () => {
    const onNotification = jest.fn();
    const onAlertFired = jest.fn();
    renderHook(() => useRealtimeSocket({ onNotification, onAlertFired }));

    await waitFor(() => expect(mockIo).toHaveBeenCalled());

    const notification = {
      id: 'n1',
      type: 'ALERT' as const,
      title: 't',
      body: 'b',
      priority: 'HIGH' as const,
      createdAt: '2026-08-02T00:00:00.000Z',
    };
    const marker = {
      symbol: 'XAUUSD',
      timeframe: 'M5',
      levelId: 'l',
      levelPrice: 1,
      touchPrice: 1,
      time: 1,
    };

    act(() => {
      capturedHandlers['notification']?.(notification);
      capturedHandlers['alert_fired']?.(marker);
    });

    expect(onNotification).toHaveBeenCalledWith(notification);
    expect(onAlertFired).toHaveBeenCalledWith(marker);
  });

  it('tracks isConnected/isAuthenticated across connect/authenticated/disconnect events', async () => {
    const { result } = renderHook(() => useRealtimeSocket());

    await waitFor(() => expect(mockIo).toHaveBeenCalled());

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);

    act(() => {
      capturedHandlers['connect']?.();
      capturedHandlers['authenticated']?.();
    });
    await waitFor(() => expect(result.current.isConnected).toBe(true));
    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      capturedHandlers['disconnect']?.();
    });
    await waitFor(() => expect(result.current.isConnected).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('disconnects the socket on unmount', async () => {
    const { unmount } = renderHook(() => useRealtimeSocket());
    await waitFor(() => expect(mockIo).toHaveBeenCalled());

    unmount();

    expect(mockDisconnect).toHaveBeenCalled();
  });
});
