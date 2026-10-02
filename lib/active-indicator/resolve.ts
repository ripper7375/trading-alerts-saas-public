/**
 * Which channel indicator is active for a timeframe, as the gateway says it for
 * the newest READY cycle (rule 6, ADR-010). The one function the channel route
 * calls, so the overlay is on the same indicator as the sensors and the renderer.
 *
 * @module lib/active-indicator/resolve
 */

import { fetchCurrentCycle, GatewayError } from './gateway-client';
import type { ActiveIndicatorTimeframe, ChannelSource } from './sources';

export interface ResolvedChannel {
  timeframe: ActiveIndicatorTimeframe;
  source: ChannelSource;
  /** The slot the setting took effect at. */
  effectiveSlot: number;
  /** The slot it was resolved at: the newest READY cycle's, or the wall-clock slot when there is none. */
  resolvedAtSlot: number;
  basis: 'CYCLE' | 'WALL_CLOCK' | 'REQUESTED_SLOT';
}

/**
 * @throws {GatewayError} when the gateway cannot be reached or answers off-contract,
 *   or when it has no setting for the timeframe (`BAD_RESPONSE`: the migration's
 *   starting rows are missing, so "unknown" is reported, never defaulted).
 */
export async function resolveActiveChannel(
  timeframe: ActiveIndicatorTimeframe
): Promise<ResolvedChannel> {
  const current = await fetchCurrentCycle();
  const record = current.activeIndicators.byTimeframe[timeframe];
  if (record === null) {
    throw new GatewayError(
      'BAD_RESPONSE',
      `the gateway has no active indicator for ${timeframe}`
    );
  }
  return {
    timeframe,
    source: record.source,
    effectiveSlot: record.effectiveSlot,
    resolvedAtSlot: current.activeIndicators.resolvedAtSlot,
    basis: current.activeIndicators.basis,
  };
}
