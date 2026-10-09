/**
 * The stored data Engine 4's structure tests read: the golden scenarios and the
 * stored cycles of the Python worker (`davintrade-stack-d-and-e/engine-1-5-new/
 * mcd_worker/`), and a fake database client made from them.
 *
 * Nothing here invents market data. A golden scenario is a cycle whose output
 * Davin signed off; its `expected.json` holds the sensors' final envelopes (the
 * ones synthesis read) and the zones the builder made from them.
 *
 * A note on hashes: the worker hashes a bundle's CANONICAL text, which a
 * TypeScript test cannot reproduce byte for byte (a float is written another way
 * in JavaScript and in Python). So the fake rows below store the bundle file as
 * it is and its own SHA-256. The reader only checks a row against itself, so that
 * is what the tests exercise. The sensors' envelopes ARE the worker's canonical
 * text, and their stored hashes are the worker's own.
 */

import { createHash } from 'crypto';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { gzipSync } from 'zlib';

import type {
  CycleInputRow,
  McdOutputRow,
  StructureClient,
} from '@/lib/engine4';

export const REPO_ROOT = join(__dirname, '..', '..', '..', '..');
export const WORKER = join(
  REPO_ROOT,
  'davintrade-stack-d-and-e',
  'engine-1-5-new',
  'mcd_worker'
);

export const sha256Hex = (data: string | Uint8Array): string =>
  createHash('sha256').update(data).digest('hex');

/** `2026-09-18T20:55Z` as unix seconds. */
export function slotSeconds(iso: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})Z$/.exec(iso);
  if (match === null) throw new Error(`not a cycle slot: ${iso}`);
  const [, y, mo, d, h, mi] = match.map((part) => Number(part)) as number[];
  return Date.UTC(y as number, (mo as number) - 1, d, h, mi) / 1000;
}

export interface StoredSensor {
  mcd_id: string;
  status: string;
  envelope_json: string;
  envelope_sha256: string;
}

export interface GoldenReading {
  profile: string;
  reading: Record<string, unknown>;
  readingJson: string;
  zones: Record<string, unknown>[];
}

export interface Golden {
  id: string;
  /** a stored real cycle (01 to 03) rather than a synthetic one */
  real: boolean;
  slot: string;
  sensors: StoredSensor[];
  /** the bundle's `context_levels`, or the scenario's own; null when there are none */
  context: unknown;
  readings: GoldenReading[];
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

export function loadGoldens(): Golden[] {
  const dir = join(WORKER, 'golden');
  const out: Golden[] = [];
  for (const name of readdirSync(dir).sort()) {
    if (!/^\d\d-/.test(name)) continue;
    const scenario = readJson(join(dir, name, 'scenario.json'));
    const expected = readJson(join(dir, name, 'expected.json'));
    const real = scenario['kind'] === 'cycle';
    let context: unknown = null;
    if (real) {
      const bundle = readJson(
        join(WORKER, 'fixtures', `${String(scenario['bundle'])}.bundle.json`)
      );
      context = bundle['context_levels'] ?? null;
    } else {
      context = scenario['context_levels'] ?? null;
    }
    const synthesis = expected['synthesis'] as {
      readings: { profile: string; reading_json: string; zones_json: string }[];
    };
    out.push({
      id: name,
      real,
      slot: String(expected['cycle_slot']),
      sensors: expected['sensors'] as StoredSensor[],
      context,
      readings: synthesis.readings.map((r) => ({
        profile: r.profile,
        readingJson: r.reading_json,
        reading: JSON.parse(r.reading_json) as Record<string, unknown>,
        zones: JSON.parse(r.zones_json) as Record<string, unknown>[],
      })),
    });
  }
  return out;
}

/** The sensors' parsed envelopes by MCD id: what the zone builder was handed. */
export function readingsOf(golden: Golden): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const sensor of golden.sensors) {
    out[sensor.mcd_id] = JSON.parse(sensor.envelope_json);
  }
  return out;
}

// -- a fake database client ---------------------------------------------------

export interface FakeCycle {
  slot: number;
  mcdRows: McdOutputRow[];
  cycleRow: CycleInputRow | null;
}

/** Rows as the sensor worker would have stored them for a stored real cycle. */
export function fakeRowsFor(bundleName: string): {
  slot: number;
  mcdRows: McdOutputRow[];
  cycleRow: CycleInputRow;
  bundleText: string;
} {
  const cycle = readJson(join(WORKER, 'fixtures', `${bundleName}.cycle.json`));
  const bundleText = readFileSync(
    join(WORKER, 'fixtures', `${bundleName}.bundle.json`),
    'utf8'
  );
  const inputsSha = sha256Hex(bundleText);
  const results = cycle['results'] as {
    mcd_id: string;
    status: string;
    envelope_json: string;
    envelope_sha256: string;
  }[];
  return {
    slot: slotSeconds(String(cycle['cycle_slot'])),
    bundleText,
    mcdRows: results.map((r) => ({
      mcd_id: r.mcd_id,
      status: r.status,
      envelope_json: r.envelope_json,
      envelope_sha256: r.envelope_sha256,
      inputs_sha256: inputsSha,
    })),
    cycleRow: bundleRow(bundleText),
  };
}

/** A `market_cycle_inputs` row for a bundle text, as the worker stores one. */
export function bundleRow(text: string): CycleInputRow {
  const bytes = Buffer.from(text, 'utf8');
  return {
    bundle_gz: gzipSync(bytes),
    bundle_encoding: 'gzip',
    bundle_bytes: bytes.length,
    inputs_sha256: sha256Hex(bytes),
  };
}

export interface FakeClientCalls {
  mcdWhere: unknown[];
  mcdSelect: unknown[];
  bundleWhere: unknown[];
  bundleSelect: unknown[];
}

/**
 * A client that answers from memory the way the two Prisma queries would.
 * `failMcd` / `failBundle` make a call reject, to show the reader reports a
 * database error instead of throwing it.
 */
export function fakeClient(
  cycle: FakeCycle,
  options: { failMcd?: boolean; failBundle?: boolean } = {}
): { client: StructureClient; calls: FakeClientCalls } {
  const calls: FakeClientCalls = {
    mcdWhere: [],
    mcdSelect: [],
    bundleWhere: [],
    bundleSelect: [],
  };
  const client: StructureClient = {
    mcdOutput: {
      findMany: async (args) => {
        calls.mcdWhere.push(args.where);
        calls.mcdSelect.push(args.select);
        if (options.failMcd) throw new Error('connection refused');
        if (args.where.cycle_slot !== cycle.slot) return [];
        return cycle.mcdRows.filter((row) =>
          args.where.mcd_id.in.includes(row.mcd_id)
        );
      },
    },
    marketCycleInput: {
      findFirst: async (args) => {
        calls.bundleWhere.push(args.where);
        calls.bundleSelect.push(args.select);
        if (options.failBundle) throw new Error('connection refused');
        return args.where.cycle_slot === cycle.slot ? cycle.cycleRow : null;
      },
    },
  };
  return { client, calls };
}
