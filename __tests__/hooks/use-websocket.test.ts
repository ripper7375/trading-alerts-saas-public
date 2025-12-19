/**
 * Tests for use-websocket hook
 * @description Unit tests for WebSocket connection management
 */

import { renderHook, act } from '@testing-library/react';
import { useWebSocket } from '@/hooks/use-websocket';

// Mock next-auth/react
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: { user: { id: 'test-user-id', email: 'test@example.com' } },
    status: 'authenticated',
  })),
}));

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(public url: string) {
    // Simulate connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 0);
  }

  send = jest.fn();
  close = jest.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  });

  // Helper to simulate incoming messages
  simulateMessage(data: unknown): void {
    if (this.onmessage) {
      this.onmessage(
        new MessageEvent('message', { data: JSON.stringify(data) })
      );
    }
  }

  // Helper to simulate errors
  simulateError(): void {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

// Store reference to mock instance
let mockWsInstance: MockWebSocket | null = null;

beforeEach(() => {
  mockWsInstance = null;
  (global as Record<string, unknown>).WebSocket = jest.fn((url: string) => {
    mockWsInstance = new MockWebSocket(url);
    return mockWsInstance;
  });
  Object.assign((global as Record<string, unknown>).WebSocket, {
    CONNECTING: MockWebSocket.CONNECTING,
    OPEN: MockWebSocket.OPEN,
    CLOSING: MockWebSocket.CLOSING,
    CLOSED: MockWebSocket.CLOSED,
  });
});

afterEach(() => {
  jest.clearAllMocks();
  mockWsInstance = null;
});

describe('useWebSocket Hook', () => {
  describe('return value', () => {
    it('should return isConnected boolean', () => {
      const { result } = renderHook(() => useWebSocket());
      expect(typeof result.current.isConnected).toBe('boolean');
    });

    it('should return isAuthenticated boolean', () => {
      const { result } = renderHook(() => useWebSocket());
      expect(typeof result.current.isAuthenticated).toBe('boolean');
    });

    it('should return sendMessage function', () => {
      const { result } = renderHook(() => useWebSocket());
      expect(typeof result.current.sendMessage).toBe('function');
    });

    it('should return disconnect function', () => {
      const { result } = renderHook(() => useWebSocket());
      expect(typeof result.current.disconnect).toBe('function');
    });

    it('should return reconnect function', () => {
      const { result } = renderHook(() => useWebSocket());
      expect(typeof result.current.reconnect).toBe('function');
    });

    it('should return markNotificationRead function', () => {
      const { result } = renderHook(() => useWebSocket());
      expect(typeof result.current.markNotificationRead).toBe('function');
    });
  });

  describe('initialization', () => {
    it('should start with disconnected state', () => {
      const { result } = renderHook(() => useWebSocket());
      // Initially disconnected before WebSocket connects
      expect(result.current.isConnected).toBe(false);
    });

    it('should start with unauthenticated state', () => {
      const { result } = renderHook(() => useWebSocket());
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('connection lifecycle', () => {
    it('should attempt to connect when session is authenticated', () => {
      renderHook(() => useWebSocket());

      // WebSocket constructor should be called
      expect(global.WebSocket).toHaveBeenCalled();
    });

    it('should create WebSocket with expected URL pattern', () => {
      renderHook(() => useWebSocket());

      // WebSocket should be created with a URL
      expect(global.WebSocket).toHaveBeenCalledWith(expect.any(String));
    });
  });

  describe('disconnect', () => {
    it('should have disconnect function that can be called', () => {
      const { result } = renderHook(() => useWebSocket());

      // Disconnect should be callable without error
      expect(() => result.current.disconnect()).not.toThrow();
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('reconnect', () => {
    it('should have reconnect function available', async () => {
      const { result } = renderHook(() => useWebSocket());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Reconnect function should be callable without error
      expect(() => result.current.reconnect()).not.toThrow();
    });
  });

  describe('sendMessage', () => {
    it('should have sendMessage function available', async () => {
      const { result } = renderHook(() => useWebSocket());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // SendMessage function should be callable without error
      expect(() =>
        result.current.sendMessage({ type: 'test', data: { foo: 'bar' } })
      ).not.toThrow();
    });
  });

  describe('markNotificationRead', () => {
    it('should have markNotificationRead function available', async () => {
      const { result } = renderHook(() => useWebSocket());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // markNotificationRead function should be callable without error
      expect(() =>
        result.current.markNotificationRead('notification-123')
      ).not.toThrow();
    });
  });

  describe('callbacks', () => {
    it('should accept onConnectionChange callback option', () => {
      const onConnectionChange = jest.fn();
      const { result } = renderHook(() => useWebSocket({ onConnectionChange }));

      // Hook should accept callbacks without error
      expect(typeof result.current.disconnect).toBe('function');
    });

    it('should accept onNotification callback option', () => {
      const onNotification = jest.fn();
      const { result } = renderHook(() => useWebSocket({ onNotification }));

      expect(typeof result.current.disconnect).toBe('function');
    });

    it('should accept onNotificationRead callback option', () => {
      const onNotificationRead = jest.fn();
      const { result } = renderHook(() => useWebSocket({ onNotificationRead }));

      expect(typeof result.current.disconnect).toBe('function');
    });

    it('should accept autoReconnect option', () => {
      const { result } = renderHook(() =>
        useWebSocket({ autoReconnect: false })
      );

      expect(typeof result.current.disconnect).toBe('function');
    });

    it('should accept reconnectInterval option', () => {
      const { result } = renderHook(() =>
        useWebSocket({ reconnectInterval: 10000 })
      );

      expect(typeof result.current.disconnect).toBe('function');
    });
  });

  describe('cleanup', () => {
    it('should handle unmount gracefully', () => {
      const { unmount } = renderHook(() => useWebSocket());

      // Unmount should not throw
      expect(() => unmount()).not.toThrow();
    });
  });
});
