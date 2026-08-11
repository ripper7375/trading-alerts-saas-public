'use client';

import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface AdminTerminalStatus {
  connected: boolean;
  terminal_id: string;
  last_check: string;
  error?: string;
  uptime_percentage?: number;
  reconnect_count?: number;
  last_error?: string;
}

interface AdminHealthResponse {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  total_terminals: number;
  connected_terminals: number;
  terminals: Record<string, AdminTerminalStatus>;
}

interface TerminalStats {
  total_uptime_percentage: number;
  total_reconnects_24h: number;
  avg_response_time_ms: number;
  terminals_by_status: {
    connected: number;
    disconnected: number;
    reconnecting: number;
  };
  most_problematic_terminals: Array<{
    terminal_id: string;
    symbol: string;
    reconnect_count: number;
    uptime: number;
  }>;
}

type TerminalsApiResponse =
  | { status: 'not_configured'; message: string }
  | { status: 'restricted'; message: string }
  | { status: 'offline'; message: string }
  | { status: 'degraded'; message: string }
  | {
      status: 'online';
      health: AdminHealthResponse;
      stats: TerminalStats | null;
    };

const POLL_INTERVAL_MS = 30000;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STATUS ALERT CARD
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function StatusAlertCard({
  title,
  message,
  tone,
  onRetry,
}: {
  title: string;
  message: string;
  tone: 'muted' | 'warning' | 'danger';
  onRetry: () => void;
}): React.ReactElement {
  const toneClasses = {
    muted: 'border-gray-700 bg-gray-800/50',
    warning: 'border-amber-700 bg-amber-950/30',
    danger: 'border-red-800 bg-red-950/30',
  } as const;

  return (
    <Card className={toneClasses[tone]}>
      <CardHeader>
        <CardTitle className="text-white">{title}</CardTitle>
        <CardDescription className="text-gray-400">{message}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="border-gray-600 text-gray-200 hover:bg-gray-700"
        >
          Retry now
        </Button>
      </CardContent>
    </Card>
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TERMINALS PAGE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Terminals & Flask API Monitor - Client Component (Session 6-11, B2-14)
 *
 * Performs a real, live reachability check against flask-api's admin
 * terminal endpoints on every load and every 30s thereafter. Renders
 * real telemetry when online; an honest, non-alarming status card for
 * every other real outcome (no admin key configured, key rejected,
 * service unreachable, non-2xx) -- never a fabricated "operational" state.
 */
export default function AdminSystemTerminalsPage(): React.ReactElement {
  const [data, setData] = useState<TerminalsApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const fetchStatus = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/admin/system/terminals', {
        cache: 'no-store',
      });
      const body = (await response.json()) as TerminalsApiResponse;
      setData(body);
      setLastChecked(new Date());
    } catch {
      setData({
        status: 'offline',
        message: 'Unable to reach the terminals status endpoint.',
      });
      setLastChecked(new Date());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    const interval = setInterval(() => {
      void fetchStatus();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Terminals &amp; Flask API
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Live reachability of the MT5 terminal fleet (flask-api).
          </p>
        </div>
        {lastChecked && (
          <span className="text-xs text-gray-500">
            Last checked {lastChecked.toLocaleTimeString()}
          </span>
        )}
      </div>

      {isLoading && !data && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {data?.status === 'not_configured' && (
        <StatusAlertCard
          title="API Key Not Configured"
          message={data.message}
          tone="muted"
          onRetry={() => void fetchStatus()}
        />
      )}

      {data?.status === 'restricted' && (
        <StatusAlertCard
          title="Restricted Access"
          message={data.message}
          tone="warning"
          onRetry={() => void fetchStatus()}
        />
      )}

      {data?.status === 'offline' && (
        <StatusAlertCard
          title="Service Unavailable — Attempting Reconnection"
          message={data.message}
          tone="danger"
          onRetry={() => void fetchStatus()}
        />
      )}

      {data?.status === 'degraded' && (
        <StatusAlertCard
          title="Service Degraded"
          message={data.message}
          tone="warning"
          onRetry={() => void fetchStatus()}
        />
      )}

      {data?.status === 'online' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="border-gray-700 bg-gray-800">
              <CardHeader>
                <CardDescription className="text-gray-400">
                  Overall Status
                </CardDescription>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Badge
                    className={
                      data.health.status === 'ok'
                        ? 'bg-green-600 text-white'
                        : data.health.status === 'degraded'
                          ? 'bg-amber-600 text-white'
                          : 'bg-red-600 text-white'
                    }
                  >
                    {data.health.status.toUpperCase()}
                  </Badge>
                  <span className="text-sm font-normal text-gray-400">
                    v{data.health.version}
                  </span>
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-gray-700 bg-gray-800">
              <CardHeader>
                <CardDescription className="text-gray-400">
                  Connected Terminals
                </CardDescription>
                <CardTitle className="text-white">
                  {data.health.connected_terminals} /{' '}
                  {data.health.total_terminals}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-gray-700 bg-gray-800">
              <CardHeader>
                <CardDescription className="text-gray-400">
                  Avg Response Time
                </CardDescription>
                <CardTitle className="text-white">
                  {data.stats
                    ? `${Math.round(data.stats.avg_response_time_ms)} ms`
                    : '—'}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card className="border-gray-700 bg-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Terminal Sessions</CardTitle>
              <CardDescription className="text-gray-400">
                Real-time connection status per MT5 terminal.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-700 text-gray-400">
                      <th className="pb-2 pr-4">Symbol</th>
                      <th className="pb-2 pr-4">Terminal</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2 pr-4">Uptime</th>
                      <th className="pb-2 pr-4">Reconnects</th>
                      <th className="pb-2">Last Check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.health.terminals).map(
                      ([symbol, terminal]) => (
                        <tr
                          key={symbol}
                          className="border-b border-gray-700/50 text-gray-200"
                        >
                          <td className="py-2 pr-4 font-medium">{symbol}</td>
                          <td className="py-2 pr-4 text-gray-400">
                            {terminal.terminal_id}
                          </td>
                          <td className="py-2 pr-4">
                            <Badge
                              className={
                                terminal.connected
                                  ? 'bg-green-600 text-white'
                                  : 'bg-red-600 text-white'
                              }
                            >
                              {terminal.connected
                                ? 'Connected'
                                : 'Disconnected'}
                            </Badge>
                          </td>
                          <td className="py-2 pr-4">
                            {terminal.uptime_percentage !== undefined
                              ? `${terminal.uptime_percentage.toFixed(1)}%`
                              : '—'}
                          </td>
                          <td className="py-2 pr-4">
                            {terminal.reconnect_count ?? '—'}
                          </td>
                          <td className="py-2 text-gray-400">
                            {new Date(terminal.last_check).toLocaleString()}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {data.stats && data.stats.most_problematic_terminals.length > 0 && (
            <Card className="border-gray-700 bg-gray-800">
              <CardHeader>
                <CardTitle className="text-white">
                  Most Problematic Terminals (24h)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-300">
                  {data.stats.most_problematic_terminals.map((t) => (
                    <li
                      key={t.terminal_id}
                      className="flex items-center justify-between border-b border-gray-700/50 pb-2"
                    >
                      <span>
                        {t.symbol} ({t.terminal_id})
                      </span>
                      <span className="text-gray-400">
                        {t.reconnect_count} reconnects · {t.uptime.toFixed(1)}%
                        uptime
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
