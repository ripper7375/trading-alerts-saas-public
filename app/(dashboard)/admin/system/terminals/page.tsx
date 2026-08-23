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
    muted: 'border-border bg-card',
    warning: 'border-amber-600/40 bg-amber-500/10',
    danger: 'border-red-600/40 bg-red-600/10',
  } as const;

  return (
    <Card className={toneClasses[tone]}>
      <CardHeader>
        <CardTitle className="text-foreground">{title}</CardTitle>
        <CardDescription className="text-muted-foreground">
          {message}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" size="sm" onClick={onRetry}>
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
          <h1 className="text-2xl font-bold text-foreground">
            Terminals &amp; Flask API
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live reachability of the MT5 terminal fleet (flask-api).
          </p>
        </div>
        {lastChecked && (
          <span className="text-xs text-muted-foreground">
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
            <Card className="border-border bg-card">
              <CardHeader>
                <CardDescription className="text-muted-foreground">
                  Overall Status
                </CardDescription>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Badge
                    className={
                      data.health.status === 'ok'
                        ? 'bg-emerald-600 text-white hover:bg-emerald-600'
                        : data.health.status === 'degraded'
                          ? 'bg-amber-600 text-white hover:bg-amber-600'
                          : 'bg-red-600 text-white hover:bg-red-600'
                    }
                  >
                    {data.health.status.toUpperCase()}
                  </Badge>
                  <span className="text-sm font-normal text-muted-foreground">
                    v{data.health.version}
                  </span>
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border bg-card">
              <CardHeader>
                <CardDescription className="text-muted-foreground">
                  Connected Terminals
                </CardDescription>
                <CardTitle className="text-foreground">
                  {data.health.connected_terminals} /{' '}
                  {data.health.total_terminals}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border bg-card">
              <CardHeader>
                <CardDescription className="text-muted-foreground">
                  Avg Response Time
                </CardDescription>
                <CardTitle className="text-foreground">
                  {data.stats
                    ? `${Math.round(data.stats.avg_response_time_ms)} ms`
                    : '—'}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-foreground">
                Terminal Sessions
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Real-time connection status per MT5 terminal.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
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
                          className="border-border/50 border-b text-foreground"
                        >
                          <td className="py-2 pr-4 font-medium">{symbol}</td>
                          <td className="py-2 pr-4 text-muted-foreground">
                            {terminal.terminal_id}
                          </td>
                          <td className="py-2 pr-4">
                            <Badge
                              className={
                                terminal.connected
                                  ? 'bg-emerald-600 text-white hover:bg-emerald-600'
                                  : 'bg-red-600 text-white hover:bg-red-600'
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
                          <td className="py-2 text-muted-foreground">
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
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">
                  Most Problematic Terminals (24h)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-foreground">
                  {data.stats.most_problematic_terminals.map((t) => (
                    <li
                      key={t.terminal_id}
                      className="border-border/50 flex items-center justify-between border-b pb-2"
                    >
                      <span>
                        {t.symbol} ({t.terminal_id})
                      </span>
                      <span className="text-muted-foreground">
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
