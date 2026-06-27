'use client';

/**
 * AlertsPanel — lists the user's line-touch alerts for the current
 * symbol/timeframe with pause/resume and delete, plus tier usage.
 *
 * @module components/charts/drawing/AlertsPanel
 */

import { Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState, type JSX } from 'react';

import { Switch } from '@/components/ui/switch';

import { createAlertsApi, type LineAlertDTO } from './alertsApi';
import { alertUsage, drawingUsage, type Tier } from './tierUsage';

interface AlertsPanelProps {
  symbol: string;
  timeframe: string;
  tier: Tier;
  drawingCount: number;
  refreshKey: number;
  onClose: () => void;
}

const api = createAlertsApi();

export function AlertsPanel({
  symbol,
  timeframe,
  tier,
  drawingCount,
  refreshKey,
  onClose,
}: AlertsPanelProps): JSX.Element {
  const [alerts, setAlerts] = useState<LineAlertDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    const list = await api.list(symbol, timeframe);
    setAlerts(list);
    setLoading(false);
  }, [symbol, timeframe]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const togglePause = async (a: LineAlertDTO): Promise<void> => {
    const next = !a.alert.isActive;
    setAlerts((prev) =>
      prev.map((x) =>
        x.id === a.id ? { ...x, alert: { ...x.alert, isActive: next } } : x
      )
    );
    const ok = await api.setActive(a.id, next);
    if (!ok) void load(); // revert on failure
  };

  const remove = async (a: LineAlertDTO): Promise<void> => {
    setAlerts((prev) => prev.filter((x) => x.id !== a.id));
    const ok = await api.remove(a.id);
    if (!ok) void load();
  };

  const au = alertUsage(tier, alerts.length);
  const du = drawingUsage(tier, drawingCount);

  return (
    <div className="absolute right-2 top-2 z-10 flex max-h-[90%] w-72 flex-col rounded-lg border border-[#2a2e39] bg-[#1e222d]/95 text-[#d1d4dc] shadow-lg">
      <div className="flex items-center justify-between border-b border-[#2a2e39] px-3 py-2">
        <span className="text-sm font-semibold">Alerts</span>
        <button
          type="button"
          aria-label="Close alerts panel"
          className="rounded p-1 hover:bg-[#2a2e39]"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex gap-3 border-b border-[#2a2e39] px-3 py-2 text-xs text-[#9aa0aa]">
        <span className={au.atLimit ? 'text-[#ef5350]' : ''}>
          Alerts {au.label}
        </span>
        <span className={du.atLimit ? 'text-[#ef5350]' : ''}>
          Drawings {du.label}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="px-3 py-4 text-sm text-[#9aa0aa]">Loading…</p>
        ) : alerts.length === 0 ? (
          <p className="px-3 py-4 text-sm text-[#9aa0aa]">
            No alerts on this chart yet.
          </p>
        ) : (
          <ul className="divide-y divide-[#2a2e39]">
            {alerts.map((a) => (
              <li key={a.id} className="flex items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {a.alert.name || a.targetLevel}
                  </p>
                  <p className="text-xs text-[#9aa0aa]">
                    {a.drawing.type} · {a.direction}
                    {a.alert.triggerCount > 0
                      ? ` · fired ${a.alert.triggerCount}×`
                      : ''}
                  </p>
                </div>
                <Switch
                  checked={a.alert.isActive}
                  onCheckedChange={() => void togglePause(a)}
                  aria-label={a.alert.isActive ? 'Pause alert' : 'Resume alert'}
                />
                <button
                  type="button"
                  aria-label="Delete alert"
                  className="rounded p-1 text-[#ef5350] hover:bg-[#2a2e39]"
                  onClick={() => void remove(a)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
