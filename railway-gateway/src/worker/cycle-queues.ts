/**
 * Names and job options for the cycle manifest flow (ADR-009).
 *
 * The manifest job lives in the SAME queue as the price rows, market-data-sync.
 * That queue has exactly one processing loop, so a job runs only after the one
 * before it has finished: a manifest enqueued after a slot's rows runs after
 * those rows have been stored. (The loop count is the thing to protect: Bull
 * starts one loop per `process()` call, summed over named handlers, so a second
 * named handler would let a manifest run alongside a row. MarketDataProcessor
 * therefore registers ONE wildcard handler and dispatches on job.name.)
 */
export const MARKET_DATA_QUEUE = 'market-data-sync';
export const MARKET_DATA_JOB = 'process';
export const CYCLE_MANIFEST_JOB = 'cycle-manifest';

/**
 * The cycle-ready signal for build step 3's sensor worker (ADR-016). Keyed by
 * the slot: `XAUUSD_<slot>`. Nothing consumes it yet, so until step 3 the jobs
 * wait in Redis (about 288 a day).
 */
export const CYCLE_READY_QUEUE = 'cycle-ready';
export const CYCLE_READY_JOB = 'cycle-ready';

/** The retry policy every lane of this gateway uses (see gateway.module.ts). */
export const LANE_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 500,
} as const;

export function manifestJobId(symbol: string, slot: number): string {
  return `cycle_manifest_${symbol}_${slot}`;
}

export function manifestRecheckJobId(
  symbol: string,
  slot: number,
  check: number
): string {
  return `${manifestJobId(symbol, slot)}_check_${check}`;
}

export function cycleReadyJobId(symbol: string, slot: number): string {
  return `${symbol}_${slot}`;
}
