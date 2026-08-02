'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface RealtimeNotification {
  id: string;
  type: 'ALERT' | 'SUBSCRIPTION' | 'PAYMENT' | 'SYSTEM';
  title: string;
  body: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  link?: string;
  createdAt: string;
}

/** Payload for an "alert fired here" chart marker. */
export interface AlertFiredMarker {
  symbol: string;
  timeframe: string;
  levelId: string;
  levelPrice: number;
  touchPrice: number;
  time: number;
}

interface UseRealtimeSocketOptions {
  /** Called on every realtime-pushed notification (bell badge update). */
  onNotification?: (notification: RealtimeNotification) => void;
  /** Called when a line-touch alert fires (chart marker). */
  onAlertFired?: (marker: AlertFiredMarker) => void;
}

interface UseRealtimeSocketReturn {
  isConnected: boolean;
  isAuthenticated: boolean;
}

interface TokenResponse {
  token: string;
  url: string;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REALTIME SOCKET HOOK
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Real socket.io-client connection to operation-service's RealtimeGateway
 * (F8, Session 4B-17) — alert-fired notifications only (chart markers +
 * the notification bell's live badge). Replaces the retired
 * hooks/use-websocket.ts (raw WebSocket, never actually reachable in
 * production — this session's order `## Raw facts` #1-#3).
 *
 * Fetches a short-lived-in-practice (session-length) auth token from
 * `/api/realtime/token` (server-side proxy reading the httpOnly session
 * cookie — the browser never reads it directly) and presents it in the
 * socket.io `auth` handshake payload, matching Socket.IO's own documented
 * auth pattern rather than the old code's post-connect `authenticate`
 * message round-trip.
 */
export function useRealtimeSocket(
  options: UseRealtimeSocketOptions = {}
): UseRealtimeSocketReturn {
  const { status } = useSession();
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  // Refs so a caller passing a new inline callback each render doesn't tear
  // down and reconnect the socket — only `status` should do that.
  const onNotificationRef = useRef(options.onNotification);
  const onAlertFiredRef = useRef(options.onAlertFired);
  onNotificationRef.current = options.onNotification;
  onAlertFiredRef.current = options.onAlertFired;

  useEffect(() => {
    if (status !== 'authenticated') return;

    let cancelled = false;

    async function connect(): Promise<void> {
      try {
        const response = await fetch('/api/realtime/token');
        if (!response.ok || cancelled) return;

        const { token, url } = (await response.json()) as TokenResponse;
        if (cancelled) return;

        const socket = io(url, {
          auth: { token },
          transports: ['websocket', 'polling'],
        });
        socketRef.current = socket;

        socket.on('connect', () => setIsConnected(true));
        socket.on('disconnect', () => {
          setIsConnected(false);
          setIsAuthenticated(false);
        });
        socket.on('authenticated', () => setIsAuthenticated(true));
        socket.on('connect_error', (error: Error) => {
          console.error('Realtime socket connect error:', error.message);
        });
        socket.on('error', (data: { message?: string }) => {
          console.error('Realtime socket error:', data?.message);
        });
        socket.on('notification', (notification: RealtimeNotification) => {
          onNotificationRef.current?.(notification);
        });
        socket.on('alert_fired', (marker: AlertFiredMarker) => {
          onAlertFiredRef.current?.(marker);
        });
      } catch (error) {
        console.error('Failed to establish realtime socket:', error);
      }
    }

    void connect();

    return (): void => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setIsAuthenticated(false);
    };
  }, [status]);

  return { isConnected, isAuthenticated };
}

export default useRealtimeSocket;
