/**
 * MT5 WebSocket Hook for Real-Time Indicator Data
 *
 * React hook for subscribing to real-time MT5 indicator data
 * via WebSocket connection to Flask MT5 Service (Part 6).
 *
 * Usage:
 *   const { data, connected, error } = useMT5WebSocket('EURUSD', 'M5');
 *
 * Features:
 * - Automatic connection management
 * - Auto-reconnect on disconnect
 * - Subscription management
 * - Real-time data updates
 * - Error handling
 *
 * Part 6: Flask MT5 Service WebSocket Integration
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { MT5IndicatorData } from '@/types/indicator';

// ============================================================================
// Configuration
// ============================================================================

const MT5_WS_URL = process.env['NEXT_PUBLIC_MT5_WS_URL'] || 'http://localhost:5001';
const RECONNECT_DELAY = 3000; // 3 seconds
const MAX_RECONNECT_ATTEMPTS = 5;

// ============================================================================
// Types
// ============================================================================

interface MT5WebSocketState {
  data: MT5IndicatorData | null;
  connected: boolean;
  error: string | null;
  loading: boolean;
}

interface WebSocketMessage {
  symbol: string;
  timeframe: string;
  data: MT5IndicatorData;
  timestamp: number;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Subscribe to real-time MT5 indicator data via WebSocket
 *
 * @param symbol - Trading symbol (e.g., 'EURUSD')
 * @param timeframe - Timeframe (e.g., 'M5', 'H1')
 * @param enabled - Enable/disable connection (default: true)
 * @returns WebSocket state with data, connection status, and error
 */
export function useMT5WebSocket(
  symbol: string,
  timeframe: string,
  enabled: boolean = true
): MT5WebSocketState & {
  reconnect: () => void;
  disconnect: () => void;
} {
  const socketRef = useRef<Socket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [state, setState] = useState<MT5WebSocketState>({
    data: null,
    connected: false,
    error: null,
    loading: false,
  });

  // ============================================================================
  // Connection Management
  // ============================================================================

  const connect = useCallback(() => {
    if (!enabled || socketRef.current?.connected) {
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      // Create Socket.IO client
      const socket = io(MT5_WS_URL, {
        transports: ['websocket', 'polling'], // Try WebSocket first, fallback to polling
        reconnection: true,
        reconnectionDelay: RECONNECT_DELAY,
        reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
        timeout: 10000,
      });

      socketRef.current = socket;

      // ============================================================================
      // Event Handlers
      // ============================================================================

      socket.on('connect', () => {
        console.log('[MT5 WebSocket] Connected to Flask MT5 Service');
        reconnectAttemptsRef.current = 0;

        setState((prev) => ({
          ...prev,
          connected: true,
          loading: false,
          error: null,
        }));

        // Subscribe to symbol/timeframe
        socket.emit('subscribe', { symbol, timeframe });
      });

      socket.on('disconnect', (reason: string) => {
        console.log('[MT5 WebSocket] Disconnected:', reason);

        setState((prev) => ({
          ...prev,
          connected: false,
          loading: false,
          error: `Disconnected: ${reason}`,
        }));

        // Auto-reconnect if not intentional disconnect
        if (reason === 'io server disconnect') {
          // Server disconnected, try to reconnect
          setTimeout(() => socket.connect(), RECONNECT_DELAY);
        }
      });

      socket.on('connect_error', (error: Error) => {
        console.error('[MT5 WebSocket] Connection error:', error);

        reconnectAttemptsRef.current += 1;

        setState((prev) => ({
          ...prev,
          connected: false,
          loading: false,
          error: `Connection error: ${error.message}`,
        }));

        // Stop trying after max attempts
        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          console.error('[MT5 WebSocket] Max reconnection attempts reached');
          socket.disconnect();
        }
      });

      socket.on('subscribed', (data: { symbol: string; timeframe: string; room: string; timestamp: number }) => {
        console.log('[MT5 WebSocket] Subscribed to:', data);
      });

      socket.on('unsubscribed', (data: { symbol: string; timeframe: string; room: string; timestamp: number }) => {
        console.log('[MT5 WebSocket] Unsubscribed from:', data);
      });

      socket.on('initial_data', (message: WebSocketMessage) => {
        console.log('[MT5 WebSocket] Received initial data');

        setState((prev) => ({
          ...prev,
          data: message.data,
          loading: false,
        }));
      });

      socket.on('indicator_update', (message: WebSocketMessage) => {
        console.log('[MT5 WebSocket] Received indicator update');

        setState((prev) => ({
          ...prev,
          data: message.data,
        }));
      });

      socket.on('error', (error: { message: string }) => {
        console.error('[MT5 WebSocket] Server error:', error);

        setState((prev) => ({
          ...prev,
          error: error.message,
        }));
      });

    } catch (error) {
      console.error('[MT5 WebSocket] Failed to create socket:', error);

      setState((prev) => ({
        ...prev,
        connected: false,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [symbol, timeframe, enabled]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      // Unsubscribe before disconnecting
      socketRef.current.emit('unsubscribe', { symbol, timeframe });
      socketRef.current.disconnect();
      socketRef.current = null;

      setState((prev) => ({
        ...prev,
        connected: false,
        data: null,
      }));
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, [symbol, timeframe]);

  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    setTimeout(connect, 1000);
  }, [connect, disconnect]);

  // ============================================================================
  // Effects
  // ============================================================================

  // Connect on mount or when symbol/timeframe changes
  useEffect(() => {
    if (enabled) {
      connect();
    }

    // Cleanup on unmount or dependency change
    return () => {
      disconnect();
    };
  }, [symbol, timeframe, enabled, connect, disconnect]);

  // Heartbeat to keep connection alive
  useEffect(() => {
    if (!socketRef.current?.connected) {
      return;
    }

    const heartbeatInterval = setInterval(() => {
      socketRef.current?.emit('ping');
    }, 25000); // Every 25 seconds

    return () => clearInterval(heartbeatInterval);
  }, [state.connected]);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    ...state,
    reconnect,
    disconnect,
  };
}
