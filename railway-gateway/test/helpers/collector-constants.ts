import * as fs from 'fs';
import * as path from 'path';

/**
 * The few constants of the VPS collector that the cycle module must agree with,
 * read from its source rather than restated, the way dto-contract.spec.ts reads
 * the gateway contract. If someone edits the collector, a spec fails here
 * instead of the two sides quietly drifting apart.
 */
const COLLECTOR_PATH = path.join(
  __dirname,
  '../../../backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/export_collector_validator_v2.py'
);

export interface CollectorConstants {
  cycleIntervalSec: number;
  tfSecondsM5: number;
  tfSecondsM15: number;
  maxAttemptsPerCycle: number;
  retryWaitSec: number;
  maxBarLagMultiplier: number;
}

function intAfter(source: string, pattern: RegExp, label: string): number {
  const match = pattern.exec(source);
  if (!match) throw new Error(`collector constant not found: ${label}`);
  return Number(match[1]);
}

export function readCollectorConstants(): CollectorConstants {
  const source = fs.readFileSync(COLLECTOR_PATH, 'utf8');
  const tf =
    /^TF_SECONDS\s*=\s*\{\s*'M5':\s*(\d+),\s*'M15':\s*(\d+)\s*\}/m.exec(source);
  if (!tf) throw new Error('collector constant not found: TF_SECONDS');
  return {
    cycleIntervalSec: intAfter(
      source,
      /^CYCLE_INTERVAL_SEC\s*=\s*(\d+)/m,
      'CYCLE_INTERVAL_SEC'
    ),
    tfSecondsM5: Number(tf[1]),
    tfSecondsM15: Number(tf[2]),
    maxAttemptsPerCycle: intAfter(
      source,
      /^MAX_ATTEMPTS_PER_CYCLE\s*=\s*(\d+)/m,
      'MAX_ATTEMPTS_PER_CYCLE'
    ),
    retryWaitSec: intAfter(
      source,
      /^RETRY_WAIT_SEC\s*=\s*(\d+)/m,
      'RETRY_WAIT_SEC'
    ),
    maxBarLagMultiplier: intAfter(
      source,
      /^MAX_BAR_LAG_MULTIPLIER\s*=\s*(\d+)/m,
      'MAX_BAR_LAG_MULTIPLIER'
    ),
  };
}
