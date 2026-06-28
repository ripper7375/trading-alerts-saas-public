/**
 * Client API wrapper for line-touch alerts (list / pause-resume / delete).
 * Injectable fetch for testing.
 *
 * @module components/charts/drawing/alertsApi
 */

type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }
) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

export interface LineAlertDTO {
  id: string; // DrawingAlert id
  targetLevel: string;
  direction: string;
  tolerance: number;
  cooldownSec: number;
  oneShot: boolean;
  alert: {
    id: string;
    name: string | null;
    isActive: boolean;
    lastTriggered: string | null;
    triggerCount: number;
  };
  drawing: { type: string; symbol: string; timeframe: string };
}

export interface AlertsApi {
  list(symbol: string, timeframe: string): Promise<LineAlertDTO[]>;
  setActive(id: string, isActive: boolean): Promise<boolean>;
  remove(id: string): Promise<boolean>;
}

export function createAlertsApi(fetchImpl?: FetchLike): AlertsApi {
  const doFetch: FetchLike =
    fetchImpl ?? (globalThis.fetch as unknown as FetchLike);

  return {
    async list(symbol, timeframe) {
      try {
        const res = await doFetch(
          `/api/alerts/line?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`
        );
        if (!res.ok) return [];
        const data = (await res.json()) as { alerts?: LineAlertDTO[] };
        return data.alerts ?? [];
      } catch {
        return [];
      }
    },

    async setActive(id, isActive) {
      try {
        const res = await doFetch(`/api/alerts/line/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },

    async remove(id) {
      try {
        const res = await doFetch(`/api/alerts/line/${id}`, {
          method: 'DELETE',
        });
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}
