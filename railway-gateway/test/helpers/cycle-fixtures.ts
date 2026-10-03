import * as fs from 'fs';
import * as path from 'path';
import type { CycleInputsBundle } from '../../src/sensors/inputs/bundle-types';
import { isoToSlot } from '../../src/sensors/inputs/stats-slot';

/**
 * The stored cycle fixtures of the Python cycle runner (build step 3, part 1):
 * `davintrade-stack-d-and-e/engine-1-5-new/mcd_worker/fixtures/`, one shared bundle
 * per slot (`<slot>.bundle.json`) and what the runner made of it (`<slot>.cycle.json`).
 * The slots are the three real cycles the MCDs were certified on: v1, v3 and v4.
 *
 * These specs read files outside the package, like six existing gateway specs
 * (railway-gateway is built alone on Railway, which runs no tests).
 */
export const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
export const ENGINE_DIR = path.join(
  REPO_ROOT,
  'davintrade-stack-d-and-e',
  'engine-1-5-new'
);
export const FIXTURES_DIR = path.join(ENGINE_DIR, 'mcd_worker', 'fixtures');

export interface FixtureSlot {
  name: 'v1' | 'v3' | 'v4';
  iso: string;
  stem: string;
  slot: number;
}

const make = (name: FixtureSlot['name'], iso: string): FixtureSlot => ({
  name,
  iso,
  stem: iso.replace(':', ''),
  slot: isoToSlot(iso) as number,
});

export const FIXTURE_SLOTS: readonly FixtureSlot[] = [
  make('v1', '2026-09-18T20:55Z'),
  make('v3', '2026-09-28T14:15Z'),
  make('v4', '2026-09-28T23:15Z'),
];

export function readFixtureBundle(fixture: FixtureSlot): CycleInputsBundle {
  return JSON.parse(
    fs.readFileSync(
      path.join(FIXTURES_DIR, `${fixture.stem}.bundle.json`),
      'utf8'
    )
  );
}

/** One reading of the stored expected cycle. */
export interface StoredReading {
  mcd_id: string;
  flag: string;
  evaluator_version: string;
  status: string;
  state_code: string | null;
  bias: string | null;
  envelope_json: string;
  envelope_sha256: string;
  evaluator_envelope_sha256: string;
  inherited_reasons: string[];
  guard_problems: string[];
}

export interface StoredCycle {
  schema_version: string;
  runner_version: string;
  symbol: string;
  cycle_slot: string;
  inputs_sha256: string;
  retuning: { observed: boolean; enforced: boolean; applied: boolean };
  flags: Record<string, string>;
  order: string[];
  results: StoredReading[];
}

export function readFixtureCycle(fixture: FixtureSlot): StoredCycle {
  return JSON.parse(
    fs.readFileSync(
      path.join(FIXTURES_DIR, `${fixture.stem}.cycle.json`),
      'utf8'
    )
  );
}
