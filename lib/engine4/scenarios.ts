/**
 * The three scenarios of architecture 6.7: Conservative, Normal, Aggressive.
 *
 * Normal is the target RRR; Conservative and Aggressive sit one notch (0.25,
 * D5) below and above it. All three share one lot and one stop; only the
 * target moves. A scenario that would fall outside 1.50 to 3.50 is LEFT OUT,
 * and so is an Aggressive that would pass 2.50 on a counter-trend SETUP
 * (ADR-064: the cap follows the setup as well as the profile). If the profile's
 * RRR is itself above the cap on a counter-trend setup, Normal is lowered to
 * the cap and the result says so (`normalCapped`); that gap-fill is flagged in
 * the part 1 hand-off.
 *
 * @module lib/engine4/scenarios
 */

import { Rational, readPositive } from './exact';
import { PROFILE_BOUNDS } from './profile';
import { sizeSetup, targetAt } from './sizing';
import { Engine4InputError } from './types';
import type {
  OmittedReason,
  OmittedScenario,
  Scenario,
  ScenarioName,
  ScenarioOptions,
  ScenarioSet,
  SizingInput,
} from './types';

/** D5: the scenario notch. */
export const RRR_NOTCH = '0.25';

/**
 * Size a setup and build its scenarios. When the lot is an UNDERFLOW the
 * targets are still worked out (distances and prices do not need a lot) and
 * every `netProfit` is null.
 */
export function buildScenarios(
  input: SizingInput,
  options: ScenarioOptions
): ScenarioSet {
  if (typeof options.counterTrend !== 'boolean') {
    throw new Engine4InputError(
      'BAD_OPTION',
      'counterTrend must be true or false',
      'counterTrend'
    );
  }
  const floor = Rational.of(PROFILE_BOUNDS.targetRrr.min);
  const ceiling = Rational.of(PROFILE_BOUNDS.targetRrr.max);
  const cap = Rational.of(PROFILE_BOUNDS.counterTrendRrrCap);
  const notch = Rational.of(RRR_NOTCH);

  const profileRrr = readPositive('targetRrr', options.targetRrr);
  if (profileRrr.lt(floor) || profileRrr.gt(ceiling)) {
    throw new Engine4InputError(
      'OUT_OF_RANGE',
      `targetRrr must be from ${PROFILE_BOUNDS.targetRrr.min} to ${PROFILE_BOUNDS.targetRrr.max}`,
      'targetRrr'
    );
  }

  const sizing = sizeSetup(input);
  const normalCapped = options.counterTrend && profileRrr.gt(cap);
  const normalRrr = normalCapped ? cap : profileRrr;

  const candidates: [ScenarioName, Rational][] = [
    ['CONSERVATIVE', normalRrr.sub(notch)],
    ['NORMAL', normalRrr],
    ['AGGRESSIVE', normalRrr.add(notch)],
  ];

  const scenarios: Scenario[] = [];
  const omitted: OmittedScenario[] = [];
  for (const [name, rrr] of candidates) {
    let reason: OmittedReason | null = null;
    if (rrr.lt(floor)) {
      reason = 'BELOW_MIN_RRR';
    } else if (options.counterTrend && rrr.gt(cap)) {
      reason = 'ABOVE_COUNTER_TREND_CAP';
    } else if (rrr.gt(ceiling)) {
      reason = 'ABOVE_MAX_RRR';
    }
    if (reason === null) {
      scenarios.push({ name, rrr, target: targetAt(sizing, rrr.toString()) });
    } else {
      omitted.push({ name, rrr, reason });
    }
  }

  return {
    sizing,
    counterTrend: options.counterTrend,
    normalRrr,
    normalCapped,
    scenarios,
    omitted,
  };
}
