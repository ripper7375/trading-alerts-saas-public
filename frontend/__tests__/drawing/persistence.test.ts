/**
 * Tests for drawing persistence: load-seeding + diff-based autosave with
 * local->server id mapping. Uses an injected fetch mock.
 */

import type { MarkSnapshot } from '@/components/charts/drawing/geometry';
import { createDrawingPersistence } from '@/components/charts/drawing/persistence';

type Call = { url: string; method: string; body?: unknown };

function mockFetch(serverIdSeq: string[], loadRows: unknown[] = []) {
  const calls: Call[] = [];
  let seq = 0;
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
    if (method === 'GET') {
      return { ok: true, json: async () => ({ drawings: loadRows }) };
    }
    if (method === 'POST') {
      const id = serverIdSeq[seq] ?? `srv_${seq}`;
      seq += 1;
      return { ok: true, json: async () => ({ drawing: { id } }) };
    }
    return { ok: true, json: async () => ({ success: true }) };
  };
  return { fn, calls };
}

const style = { color: '#2962FF', lineWidth: 2, lineStyle: 'solid' as const };
function hline(id: string, price: number): MarkSnapshot {
  return { id, type: 'HLINE', anchors: [{ time: 0, price }], style };
}

describe('drawing persistence', () => {
  it('POSTs a new mark and maps its server id for later update/delete', async () => {
    const { fn, calls } = mockFetch(['srv_1']);
    const p = createDrawingPersistence('XAUUSD', 'M10', fn);

    await p.sync([hline('local_1', 1980)]); // create
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1);

    await p.sync([hline('local_1', 1990)]); // update (same local id)
    const patch = calls.find((c) => c.method === 'PATCH');
    expect(patch?.url).toBe('/api/drawings/srv_1'); // mapped to server id

    await p.sync([]); // delete
    const del = calls.find((c) => c.method === 'DELETE');
    expect(del?.url).toBe('/api/drawings/srv_1');
  });

  it('does not re-create a mark when nothing changed', async () => {
    const { fn, calls } = mockFetch(['srv_1']);
    const p = createDrawingPersistence('XAUUSD', 'M10', fn);
    await p.sync([hline('local_1', 1980)]);
    await p.sync([hline('local_1', 1980)]); // identical -> no-op
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(0);
  });

  it('load() seeds known state so loaded marks are not re-created', async () => {
    const rows = [
      { id: 'srv_A', type: 'HLINE', anchors: [{ time: 0, price: 100 }], style },
    ];
    const { fn, calls } = mockFetch([], rows);
    const p = createDrawingPersistence('XAUUSD', 'M10', fn);

    const loaded = await p.load();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.id).toBe('srv_A');

    // First edit emits the full list (incl. loaded mark) — must not POST it.
    await p.sync([{ ...hline('srv_A', 100) }]);
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);

    // Editing the loaded mark issues a PATCH against its server id.
    await p.sync([hline('srv_A', 105)]);
    expect(calls.find((c) => c.method === 'PATCH')?.url).toBe(
      '/api/drawings/srv_A'
    );
  });
});
