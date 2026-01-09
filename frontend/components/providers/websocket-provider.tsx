'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';

/**
 * WebSocket Provider
 *
 * Provides WebSocket connection management for real-time updates.
 *
 * Features:
 * - Connection state management
 * - Automatic reconnection with exponential backoff
 * - Message subscription system
 * - Heartbeat/ping to keep connection alive
 */

// Connection states
type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

// Message types
interface WebSocketMessage {
  type: string;
  data: unknown;
  timestamp: number;
}

// Subscriber callback type
type MessageSubscriber = (message: WebSocketMessage) => void;

// Context type
interface WebSocketContextType {
  state: ConnectionState;
  isConnected: boolean;
  send: (message: object) => void;
  subscribe: (type: string, callback: MessageSubscriber) => () => void;
  reconnect: () => void;
}

// Create context with default values
const WebSocketContext = createContext<WebSocketContextType>({
  state: 'disconnected',
  isConnected: false,
  send: () => {},
  subscribe: () => () => {},
  reconnect: () => {},
});

// Custom hook to use WebSocket context
export function useWebSocket(): WebSocketContextType {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}

// Provider props
interface WebSocketProviderProps {
  children: React.ReactNode;
  url?: string;
  enabled?: boolean;
}

// Reconnection configuration
const INITIAL_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

/**
 * WebSocket Provider Component
 */
export function WebSocketProvider({
  children,
  url = process.env['NEXT_PUBLIC_WS_URL'] || 'ws://localhost:3001',
  enabled = true,
}: WebSocketProviderProps): React.ReactElement {
  const [state, setState] = useState<ConnectionState>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const subscribersRef = useRef<Map<string, Set<MessageSubscriber>>>(new Map());
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!enabled || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setState('connecting');

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log('[WebSocket] Connected');
        setState('connected');
        reconnectAttemptRef.current = 0;

        // Start heartbeat
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, HEARTBEAT_INTERVAL);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          message.timestamp = Date.now();

          // Notify subscribers
          const subscribers = subscribersRef.current.get(message.type);
          if (subscribers) {
            subscribers.forEach((callback) => callback(message));
          }

          // Notify global subscribers (type: '*')
          const globalSubscribers = subscribersRef.current.get('*');
          if (globalSubscribers) {
            globalSubscribers.forEach((callback) => callback(message));
          }
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        setState('error');
      };

      ws.onclose = (event) => {
        console.log('[WebSocket] Disconnected:', event.code, event.reason);
        setState('disconnected');

        // Clear heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        // Schedule reconnection with exponential backoff
        if (enabled) {
          const delay = Math.min(
            INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptRef.current),
            MAX_RECONNECT_DELAY
          );
          reconnectAttemptRef.current++;

          console.log(`[WebSocket] Reconnecting in ${delay}ms...`);
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      setState('error');
    }
  }, [enabled, url]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    // Clear reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Clear heartbeat
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    // Close connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setState('disconnected');
  }, []);

  // Send message
  const send = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] Cannot send - not connected');
    }
  }, []);

  // Subscribe to message type
  const subscribe = useCallback(
    (type: string, callback: MessageSubscriber): (() => void) => {
      if (!subscribersRef.current.has(type)) {
        subscribersRef.current.set(type, new Set());
      }
      subscribersRef.current.get(type)!.add(callback);

      // Return unsubscribe function
      return () => {
        subscribersRef.current.get(type)?.delete(callback);
      };
    },
    []
  );

  // Manual reconnect
  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptRef.current = 0;
    connect();
  }, [connect, disconnect]);

  // Connect on mount
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  const value: WebSocketContextType = {
    state,
    isConnected: state === 'connected',
    send,
    subscribe,
    reconnect,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}
