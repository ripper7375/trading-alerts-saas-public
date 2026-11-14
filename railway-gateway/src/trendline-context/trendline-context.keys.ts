/**
 * Names for the trendline-context lane (TRENDLINE-CONTEXT-BLUEPRINT.md,
 * Layer 1 / policy): the queue, the job, the job id, and the feature flag.
 *
 * A lane of its own, like symbol-specs and the economic calendar, so a
 * backlog or a failure here can never delay price ingestion. Kept in one
 * place because the controller that enqueues and the processor that
 * handles must agree on the job NAME -- a mismatch here leaves every job
 * failing with "Missing process handler" while the endpoint still answers
 * 200 (the same 2026-07-05 audit finding symbol-specs.keys.ts documents).
 *
 * @module trendline-context/trendline-context.keys
 */

export const TRENDLINE_POLICY_QUEUE = 'trendline-policy-sync';
export const TRENDLINE_POLICY_JOB = 'process';

/**
 * Whether the trendline-context module is enabled at all. Exactly `true`
 * turns it on; anything else (unset, `TRUE`, `1`, `yes`) leaves it off.
 * OFF is the default and the rollback (see TrendlineContextModule.register()).
 */
export function trendlineContextEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return env.TRENDLINE_CONTEXT_ENABLED === 'true';
}

/**
 * The idempotency key for one Publish: which symbol, published when. A
 * push retry re-delivers the same key; a genuinely new session (a later
 * Publish) is a different job. Matches the uniqueness the processor itself
 * enforces at the database (symbol, published_at) so a retry and a real
 * new session can never be confused.
 */
export function trendlinePolicyJobId(
  symbol: string,
  publishedAt: number
): string {
  return `${symbol}_${publishedAt}`;
}
