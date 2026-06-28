/**
 * Tests for the line-alerts client API (list / pause / delete) with a fetch mock.
 */

import {
  createAlertsApi,
  type LineAlertDTO,
} from '@/components/charts/drawing/alertsApi';

type Call = { url: string; method: string; body?: unknown };

function mockFetch(rows: LineAlertDTO[] = [], ok = true) {
  const calls: Call[] = [];
  const fn = async (
    url: string,
    init?: { method?: string; body?: string }
  ): Promise<{ ok: boolean; json: () => Promise<unknown> }> => {
    const method = init?.method ?? 'GET';
    calls.push({
      url,
      method,
      body: init?.body ? JSON.parse(init.body) : undefined,
    });
    return { ok, json: async () => ({ alerts: rows }) };
  };
  return { fn, calls };
}

const sample: LineAlertDTO = {
  id: 'da1',
  targetLevel: 'line',
  direction: 'either',
  tolerance: 0,
  cooldownSec: 60,
  oneShot: false,
  alert: {
    id: 'a1',
    name: 'support',
    isActive: true,
    lastTriggered: null,
    triggerCount: 0,
  },
  drawing: { type: 'HLINE', symbol: 'XAUUSD', timeframe: 'M10' },
};

describe('alertsApi', () => {
  it('lists alerts for a symbol/timeframe', async () => {
    const { fn, calls } = mockFetch([sample]);
    const api = createAlertsApi(fn);
    const list = await api.list('XAUUSD', 'M10');
    expect(list).toHaveLength(1);
    expect(calls[0]?.url).toContain('symbol=XAUUSD');
    expect(calls[0]?.url).toContain('timeframe=M10');
  });

  it('PATCHes isActive on pause/resume', async () => {
    const { fn, calls } = mockFetch();
    const api = createAlertsApi(fn);
    const ok = await api.setActive('da1', false);
    expect(ok).toBe(true);
    expect(calls[0]).toMatchObject({
      url: '/api/alerts/line/da1',
      method: 'PATCH',
      body: { isActive: false },
    });
  });

  it('DELETEs an alert', async () => {
    const { fn, calls } = mockFetch();
    const api = createAlertsApi(fn);
    const ok = await api.remove('da1');
    expect(ok).toBe(true);
    expect(calls[0]).toMatchObject({
      url: '/api/alerts/line/da1',
      method: 'DELETE',
    });
  });

  it('returns [] when the list request fails', async () => {
    const { fn } = mockFetch([], false);
    const api = createAlertsApi(fn);
    expect(await api.list('XAUUSD', 'M10')).toEqual([]);
  });
});
