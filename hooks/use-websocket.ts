'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useRef, useState, useCallback } from 'react';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface WebSocketMessage {
  type: string;
  data: Record<string, unknown>;
}

interface NotificationData {
  id: string;
  type: 'ALERT' | 'SUBSCRIPTION' | 'PAYMENT' | 'SYSTEM';
  title: string;
  body: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  link?: string;
  createdAt: string;
}

interface UseWebSocketOptions {
  /** Callback when a new notification is received */
  onNotification?: (notification: NotificationData) => void;
  /** Callback when connection status changes */
  onConnectionChange?: (connected: boolean) => void;
  /** Callback when a notification is marked as read (from another tab) */
  onNotificationRead?: (notificationId: string) => void;
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Reconnect interval in ms (default: 5000) */
  reconnectInterval?: number;
}

interface UseWebSocketReturn {
  /** Whether the WebSocket is currently connected */
  isConnected: boolean;
  /** Whether the client is authenticated with the server */
  isAuthenticated: boolean;
  /** Send a message to the server */
  sendMessage: (message: WebSocketMessage) => void;
  /** Manually disconnect */
  disconnect: () => void;
  /** Manually reconnect */
  reconnect: () => void;
  /** Notify server that a notification was read */
  markNotificationRead: (notificationId: string) => void;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WEBSOCKET HOOK
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * React hook for WebSocket connection to receive real-time notifications
 *
 * Features:
 * - Automatic connection management
 * - Authentication using NextAuth session
 * - Auto-reconnect on disconnect
 * - Ping/pong for keep-alive
 * - Cross-tab notification sync
 *
 * @example
 * ```tsx
 * function NotificationProvider({ children }) {
 *   const { isConnected } = useWebSocket({
 *     onNotification: (notification) => {
 *       console.log('New notification:', notification);
 *       // Show toast, update badge, etc.
 *     },
 *   });
 *
 *   return <div>{children}</div>;
 * }
 * ```
 */
export function useWebSocket(
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const {
    onNotification,
    onConnectionChange,
    onNotificationRead,
    autoReconnect = true,
    reconnectInterval = 5000,
  } = options;

  const { data: session, status } = useSession();
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const MAX_RECONNECT_ATTEMPTS = 10;
  const PING_INTERVAL = 30000; // 30 seconds

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback((): void => {
    // Don't connect if not authenticated or already connected
    if (status !== 'authenticated' || !session?.user?.id) {
      return;
    }

    // Don't reconnect if already connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsUrl = process.env['NEXT_PUBLIC_WS_URL'] || 'ws://localhost:3001';

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = (): void => {
        console.info('WebSocket connected');
        setIsConnected(true);
        onConnectionChange?.(true);
        reconnectAttemptsRef.current = 0;

        // Authenticate with the server
        ws.send(
          JSON.stringify({
            type: 'authenticate',
            data: { token: session.user.id },
          })
        );

        // Start ping interval for keep-alive
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping', data: {} }));
          }
        }, PING_INTERVAL);
      };

      ws.onmessage = (event: MessageEvent): void => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data as string);

          switch (message.type) {
            case 'authenticated':
              setIsAuthenticated(true);
              console.info('WebSocket authenticated');
              break;

            case 'notification':
              if (message.data && typeof message.data === 'object') {
                const notificationData = (
                  message.data as { data?: NotificationData }
                ).data;
                if (notificationData) {
                  onNotification?.(notificationData);
                }
              }
              break;

            case 'notification_read':
              if (message.data && typeof message.data === 'object') {
                const readData = message.data as { notificationId?: string };
                if (readData.notificationId) {
                  onNotificationRead?.(readData.notificationId);
                }
              }
              break;

            case 'pong':
              // Keep-alive response received
              break;

            case 'error':
              console.error('WebSocket error from server:', message.data);
              break;

            default:
              console.warn('Unknown WebSocket message type:', message.type);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = (): void => {
        console.info('WebSocket disconnected');
        setIsConnected(false);
        setIsAuthenticated(false);
        onConnectionChange?.(false);

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Attempt reconnect if enabled
        if (
          autoReconnect &&
          reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS
        ) {
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(
            reconnectInterval * Math.pow(1.5, reconnectAttemptsRef.current - 1),
            30000
          );
          console.info(
            `Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`
          );
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = (error: Event): void => {
        console.error('WebSocket error:', error);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }, [
    session,
    status,
    autoReconnect,
    reconnectInterval,
    onNotification,
    onConnectionChange,
    onNotificationRead,
  ]);

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = useCallback((): void => {
    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Clear ping interval
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsAuthenticated(false);
  }, []);

  /**
   * Manually reconnect
   */
  const reconnect = useCallback((): void => {
    reconnectAttemptsRef.current = 0;
    disconnect();
    setTimeout(connect, 100);
  }, [connect, disconnect]);

  /**
   * Send a message to the server
   */
  const sendMessage = useCallback((message: WebSocketMessage): void => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('Cannot send message: WebSocket not connected');
    }
  }, []);

  /**
   * Notify server that a notification was read
   */
  const markNotificationRead = useCallback(
    (notificationId: string): void => {
      sendMessage({
        type: 'notification_read',
        data: { notificationId },
      });
    },
    [sendMessage]
  );

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (status === 'authenticated') {
      connect();
    }

    return (): void => {
      disconnect();
    };
  }, [status, connect, disconnect]);

  return {
    isConnected,
    isAuthenticated,
    sendMessage,
    disconnect,
    reconnect,
    markNotificationRead,
  };
}

export default useWebSocket;
