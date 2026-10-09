/**
 * Lots below the broker minimum (architecture 6.8, and D4 for the leverage twin).
 *
 * A lot is NEVER rounded up to the minimum: one 0.01 lot may lose three times
 * what the trader chose to risk. This module says what the trader may do about
 * it, and every offer stays inside the trader's own limits:
 *
 *  - RAISE_RISK: only when the risk one minimum lot needs is at or under the
 *    profile's Max RPT (and the leverage limit is not what blocks the lot). The
 *    risk to enter is rounded UP to 0.01%, so entering it really buys a lot.
 *  - NEARER_STRUCTURAL_STOP: only a stop the caller offers that is nearer than
 *    the current one and at or beyond Min SLD; no arbitrary tightening. Each is
 *    re-sized, so the lot and the risk shown are what would happen.
 *  - DECLINE: always.
 *
 * Equity is the trader's real balance. "This setup needs at least $X of equity"
 * is a FACT (`facts`), never an option: no offer carries an equity figure, and
 * no offer raises the leverage limit (D4). When the leverage limit is what
 * blocks the lot, raising risk or tightening the stop cannot help, so the offers
 * are DECLINE alone and the fact says what equity would be enough.
 *
 * @module lib/engine4/underflow
 */

import { Rational, readPositive } from './exact';
import { resolveSymbolSpec, sizeSetup } from './sizing';
import { Engine4InputError } from './types';
import type {
  SizingInput,
  UnderflowContext,
  UnderflowFact,
  UnderflowHelp,
  UnderflowOption,
} from './types';

const HUNDRED = Rational.int(100n);
const RISK_ROUNDING_STEP = Rational.fromFraction(1n, 100n);

/**
 * What can be done about a lot below the broker minimum, or null when the lot
 * is fine. Throws `Engine4InputError` when the chosen risk is above Max RPT.
 */
export function underflowHelp(
  input: SizingInput,
  context: UnderflowContext
): UnderflowHelp | null {
  const sizing = sizeSetup(input);
  if (sizing.status === 'OK') return null;

  const spec = resolveSymbolSpec(input.spec);
  const equity = readPositive('equity', input.equity);
  const maxLeverage = readPositive('maxLeverage', input.maxLeverage);
  const maxRiskPct = readPositive('maxRiskPct', context.maxRiskPct);
  const minSld = readPositive('minSld', context.minSld);

  if (maxRiskPct.gt(HUNDRED) || sizing.declaredRiskPct.gt(maxRiskPct)) {
    throw new Engine4InputError(
      'OUT_OF_RANGE',
      'riskPct is above the Max RPT of the profile',
      'riskPct'
    );
  }

  const blockedByRisk = sizing.causes.includes('RISK');
  const blockedByLeverage = sizing.causes.includes('LEVERAGE');

  const minLotLoss = spec.volumeMin.mul(sizing.lossPerLot);
  const minLotRiskPct = minLotLoss.div(equity).mul(HUNDRED);

  const options: UnderflowOption[] = [];

  // Raising risk or tightening the stop can only help when the risk limit,
  // and not the leverage limit, is what blocks a minimum lot.
  if (blockedByRisk && !blockedByLeverage) {
    const riskPct = minLotRiskPct.ceilToMultiple(RISK_ROUNDING_STEP);
    if (riskPct.lte(maxRiskPct)) {
      const raised = sizeSetup({ ...input, riskPct: riskPct.toString() });
      if (raised.status === 'OK') {
        options.push({
          kind: 'RAISE_RISK',
          riskPct,
          riskPctExact: minLotRiskPct,
          lot: raised.lot,
          actualRisk: raised.actualRisk,
        });
      }
    }

    const offered: Rational[] = [];
    for (const raw of context.structuralStopDistances ?? []) {
      offered.push(readPositive('structuralStopDistances', raw));
    }
    offered.sort((a, b) => a.cmp(b));
    let previous: Rational | null = null;
    for (const distance of offered) {
      if (previous !== null && previous.eq(distance)) continue;
      previous = distance;
      if (distance.lt(minSld) || distance.gte(sizing.stopDistance)) continue;
      const nearer = sizeSetup({ ...input, stopDistance: distance.toString() });
      if (nearer.status === 'OK') {
        options.push({
          kind: 'NEARER_STRUCTURAL_STOP',
          stopDistance: distance,
          lot: nearer.lot,
          actualRisk: nearer.actualRisk,
          actualRiskPct: nearer.actualRiskPct,
        });
      }
    }
  }
  options.push({ kind: 'DECLINE' });

  const facts: UnderflowFact[] = [];
  if (blockedByRisk) {
    facts.push({
      kind: 'EQUITY_NEEDED_FOR_RISK',
      equity: minLotLoss.div(sizing.declaredRiskPct).mul(HUNDRED),
      atRiskPct: sizing.declaredRiskPct,
    });
  }
  if (blockedByLeverage) {
    facts.push({
      kind: 'EQUITY_NEEDED_FOR_LEVERAGE',
      equity: spec.volumeMin
        .mul(sizing.fillPrice)
        .mul(spec.contractSize)
        .div(maxLeverage),
      atMaxLeverage: maxLeverage,
    });
  }

  return {
    causes: sizing.causes,
    minLotLoss,
    minLotRiskPct,
    options,
    facts,
  };
}
