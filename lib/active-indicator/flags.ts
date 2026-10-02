/**
 * Feature flag for the active-indicator setting (build step 2 part 6).
 *
 * Off (the default): the channel route behaves exactly as before, taking the
 * variant from the query string and defaulting to `best_fit_a`. On: the route asks
 * the gateway which channel indicator is active for the timeframe and uses that,
 * ignoring any `variant` in the request, so the chart overlay is on the same
 * indicator as the sensors and the renderer (rule 6).
 *
 * Turn it on only after the part 2 migration is applied, the gateway with
 * `GET /api/v1/cycles/current` is deployed, and `MARKET_GATEWAY_URL` and
 * `MARKET_GATEWAY_API_KEY` are set here. Until then it stays off and nothing changes.
 *
 * @module lib/active-indicator/flags
 */

export function shouldResolveActiveIndicatorFromGateway(): boolean {
  return process.env['ACTIVE_INDICATOR_FROM_GATEWAY'] === 'true';
}
