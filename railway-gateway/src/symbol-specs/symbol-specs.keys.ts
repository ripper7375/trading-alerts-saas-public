/**
 * Names for the symbol-specs lane (build step 2 part 8; ADR-066,
 * STACK-D-ARCHITECTURE.md section 6.9): the queue, the job, and the job id.
 *
 * The lane has a queue of its own, like the economic calendar and the
 * statistics, so a backlog or a failure here can never delay price ingestion.
 * Kept in one place because three files must agree on them: the controller that
 * enqueues, the processor that handles, and the module that registers the queue.
 * A processor registered under a different NAME than the one the controller
 * enqueues leaves every job failing with "Missing process handler" while the
 * endpoint still answers 200 (the 2026-07-05 audit finding).
 */
export const SYMBOL_SPECS_QUEUE = 'symbol-specs-sync';
export const SYMBOL_SPECS_JOB = 'process';

/**
 * The idempotency key: which symbol, observed when. It is the same pair the
 * table is unique on, so a push retry re-delivers the same key and a genuinely
 * new observation is a different job. The contract limits `symbol` to letters,
 * digits, '.', '_' and '-', so the id is safe in Redis and is never an integer
 * (Bull refuses integer-looking custom ids).
 */
export function symbolSpecJobId(symbol: string, capturedAt: number): string {
  return `${symbol}_${capturedAt}`;
}
