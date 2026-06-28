/**
 * Drawing persistence — loads saved drawings and autosaves changes to the
 * /api/drawings endpoints.
 *
 * The engine emits the full snapshot list once per discrete action (finalize,
 * drag-end, delete), so this layer diffs against the last-known state to derive
 * create / update / delete calls. Engine marks keep a local id for the session;
 * a local→server id map translates for update/delete requests.
 *
 * `fetchImpl` is injectable for testing.
 *
 * @module components/charts/drawing/persistence
 */

import type { MarkSnapshot } from './geometry';

type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }
) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

interface DrawingDTO {
  id: string;
  type: string;
  anchors: unknown;
  style: unknown;
}

export interface DrawingPersistence {
  load(): Promise<MarkSnapshot[]>;
  sync(snapshots: MarkSnapshot[]): Promise<void>;
  /** Server drawing id for a local mark id (awaits any in-flight create). */
  resolveServerId(localId: string): Promise<string | null>;
}

function serialize(snap: MarkSnapshot): string {
  return JSON.stringify({
    type: snap.type,
    anchors: snap.anchors,
    style: snap.style,
  });
}

export function createDrawingPersistence(
  symbol: string,
  timeframe: string,
  fetchImpl?: FetchLike
): DrawingPersistence {
  const doFetch: FetchLike =
    fetchImpl ?? (globalThis.fetch as unknown as FetchLike);

  // localId -> last serialized snapshot (known-persisted state)
  const known = new Map<string, string>();
  // localId -> server drawing id
  const serverIds = new Map<string, string>();
  // localId -> in-flight create promise (resolves to server id or null)
  const creating = new Map<string, Promise<string | null>>();

  async function resolveServerId(localId: string): Promise<string | null> {
    const existing = serverIds.get(localId);
    if (existing) return existing;
    const pending = creating.get(localId);
    if (pending) return pending;
    return null;
  }

  async function create(snap: MarkSnapshot, ser: string): Promise<void> {
    known.set(snap.id, ser);
    const promise = (async (): Promise<string | null> => {
      try {
        const res = await doFetch('/api/drawings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol,
            timeframe,
            type: snap.type,
            anchors: snap.anchors,
            style: snap.style,
          }),
        });
        if (!res.ok) {
          known.delete(snap.id); // allow retry on next change
          return null;
        }
        const data = (await res.json()) as { drawing?: DrawingDTO };
        const id = data.drawing?.id ?? null;
        if (id) serverIds.set(snap.id, id);
        return id;
      } catch (error) {
        known.delete(snap.id);
        console.error('drawing create failed:', error);
        return null;
      }
    })();
    creating.set(snap.id, promise);
    await promise;
    creating.delete(snap.id);
  }

  async function update(snap: MarkSnapshot, ser: string): Promise<void> {
    const serverId = await resolveServerId(snap.id);
    if (!serverId) return;
    try {
      const res = await doFetch(`/api/drawings/${serverId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anchors: snap.anchors, style: snap.style }),
      });
      if (res.ok) known.set(snap.id, ser);
    } catch (error) {
      console.error('drawing update failed:', error);
    }
  }

  async function remove(localId: string): Promise<void> {
    const serverId = await resolveServerId(localId);
    known.delete(localId);
    serverIds.delete(localId);
    if (!serverId) return;
    try {
      await doFetch(`/api/drawings/${serverId}`, { method: 'DELETE' });
    } catch (error) {
      console.error('drawing delete failed:', error);
    }
  }

  return {
    async load(): Promise<MarkSnapshot[]> {
      try {
        const res = await doFetch(
          `/api/drawings?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`
        );
        if (!res.ok) return [];
        const data = (await res.json()) as { drawings?: DrawingDTO[] };
        const rows = data.drawings ?? [];
        const snaps: MarkSnapshot[] = rows.map((d) => ({
          id: d.id,
          type: d.type as MarkSnapshot['type'],
          anchors: d.anchors as MarkSnapshot['anchors'],
          style: d.style as MarkSnapshot['style'],
        }));
        // Seed known state so loaded marks aren't re-created on first edit.
        for (const snap of snaps) {
          known.set(snap.id, serialize(snap));
          serverIds.set(snap.id, snap.id);
        }
        return snaps;
      } catch (error) {
        console.error('drawing load failed:', error);
        return [];
      }
    },

    resolveServerId,

    async sync(snapshots: MarkSnapshot[]): Promise<void> {
      const currentIds = new Set(snapshots.map((s) => s.id));

      // Deletes: previously-known ids no longer present.
      for (const localId of [...known.keys()]) {
        if (!currentIds.has(localId)) await remove(localId);
      }

      // Creates + updates.
      for (const snap of snapshots) {
        const ser = serialize(snap);
        if (!known.has(snap.id)) {
          await create(snap, ser);
        } else if (known.get(snap.id) !== ser) {
          await update(snap, ser);
        }
      }
    },
  };
}
