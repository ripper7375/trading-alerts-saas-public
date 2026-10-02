import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  CycleManifest,
  TimeframeCycle,
} from '../../src/cycle/cycle-manifest.contract';

/**
 * Manifests for a promote rehearsal: the real sender's two fixtures (an M5-only
 * slot and an M15 refresh slot), moved along the slot axis and retuned. Same
 * contract, same field shapes, so what the gateway does with them is what it does
 * with a manifest from the VPS. Shared by promote-retuning.spec.ts (an in-memory
 * store) and promote-retuning.pg.spec.ts (a real Postgres).
 */

export function fixture(name: string): CycleManifest {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'fixtures', name), 'utf8')
  );
}
export const plain = fixture('cycle-manifest-plain-slot.json'); // 20:55, M5 only
export const refresh = fixture('cycle-manifest-refresh-slot.json'); // 21:00, M5 and M15

/** The slot k cycles after the first one. Every third one (k = 1, 4, 7, ...) refreshes M15. */
export const S = (k: number): number => plain.slot + 300 * k;

const TIME_KEYS = [
  'started_at',
  'validated_at',
  'export_mtime',
  'oldest_bar_ts',
  'newest_bar_ts',
] as const;

const sha = (...parts: string[]): string =>
  createHash('sha256').update(parts.join('|')).digest('hex');

export interface Tuning {
  terminal?: string;
  /** Seed of every config_hash: the same seed is the same tuning. */
  tuning?: string;
  modes?: Record<string, 'DYNAMIC' | 'FROZEN'>;
  /** The re-push count the sender reports; null or absent: the field is left out. */
  repush?: number | null;
}

function tune(
  section: TimeframeCycle,
  timeframe: string,
  seed: string,
  modes?: Tuning['modes']
): void {
  for (const source of Object.keys(section.config_hashes)) {
    section.config_hashes[source] = sha(seed, timeframe, source);
  }
  if (modes) section.source_modes = { ...modes };
}

/** A contract-valid manifest for the slot: M5 always, M15 on :00 :15 :30 :45. */
export function manifestAt(slot: number, o: Tuning = {}): CycleManifest {
  const m: CycleManifest = JSON.parse(JSON.stringify(plain));
  const shift = slot - plain.slot;
  const seed = o.tuning ?? 'a';

  const m5 = m.timeframes.M5;
  m5.collection_cycle_id += shift / 300;
  for (const key of TIME_KEYS) m5[key] += shift;
  tune(m5, 'M5', seed, o.modes);

  if (slot % 900 === 0) {
    const m15: TimeframeCycle = JSON.parse(
      JSON.stringify(refresh.timeframes.M15)
    );
    const shift15 = slot - refresh.slot;
    m15.collection_cycle_id += shift15 / 900;
    for (const key of TIME_KEYS) m15[key] += shift15;
    tune(m15, 'M15', seed, o.modes);
    m.timeframes.M15 = m15;
  }

  m.slot = slot;
  m.built_at += shift;
  m.mt5_terminal = o.terminal ?? 'MT5-A';
  if (o.repush === undefined || o.repush === null) {
    delete m.repush_rows_unsent;
  } else {
    m.repush_rows_unsent = o.repush;
  }
  return m;
}

export const B = { terminal: 'MT5-B', tuning: 'b' } as const; // the standby, promoted
