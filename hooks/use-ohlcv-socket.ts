'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface OhlcvCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface OhlcvSocketData {
  symbol: string;
  timeframe: string;
  ohlcv: OhlcvCandle[];
  metadata: {
    timestamp: number;
    bars: number;
    bars_requested?: number;
    bars_received?: number;
    tier?: string;
    terminal_id?: string;
  };
}

export interface UseOhlcvSocketResult {
  data: OhlcvSocketData | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

/**
 * useOhlcvSocket
 *
 * Connects to the Flask MT5 Socket.IO server and subscribes to real-time
 * OHLCV updates for the given symbol/timeframe.
 *
 * The Flask backend checks for new data every 0.25s and pushes only when
 * the bar timestamp advances (new candle) OR the current bar's close price
 * changes (live tick). This keeps bandwidth proportional to actual market
 * activity rather than a fixed polling interval.
 *
 * No Redis required — works with a single Flask instance (eventlet mode).
 *
 * @param symbol    - Trading symbol (e.g. 'EURUSD')
 * @param timeframe - Timeframe string (e.g. 'M5', 'H1')
 *
 * @example
 * const { data, isConnected, isLoading, error } = useOhlcvSocket('EURUSD', 'H1');
 */
export function useOhlcvSocket(
  symbol: string,
  timeframe: string
): UseOhlcvSocketResult {
  const socketRef = useRef<Socket | null>(null);

  const [data, setData] = useState<OhlcvSocketData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const wsUrl =
      process.env.NEXT_PUBLIC_MT5_WS_URL ?? 'http://localhost:5001';

    const socket = io(wsUrl, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setError(null);
      socket.emit('subscribe', { symbol, timeframe });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (err: Error) => {
      setError(`Connection failed: ${err.message}`);
      setIsLoading(false);
    });

    // Initial full dataset sent immediately after subscription
    socket.on('initial_data', (payload: { data: OhlcvSocketData }) => {
      setData(payload.data);
      setIsLoading(false);
    });

    // Subsequent pushes whenever the bar changes or close price ticks
    socket.on('ohlcv_update', (payload: { data: OhlcvSocketData }) => {
      setData(payload.data);
      setIsLoading(false);
    });

    socket.on('error', (payload: { message: string }) => {
      setError(payload.message);
      setIsLoading(false);
    });

    return () => {
      socket.emit('unsubscribe', { symbol, timeframe });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [symbol, timeframe]);

  return { data, isConnected, isLoading, error };
}
