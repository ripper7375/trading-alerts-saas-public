/**
 * Engine 4 lot sizing: the ten steps of architecture 6.7, exact.
 *
 * Contract figures come from `symbol_specs` (6.9), never from a constant in
 * this file: the table's "100 oz a lot" is only for readability, so a changed
 * contract size or lot step changes the lot with no code change.
 *
 * SPREAD (D3, approved with the step 5 plan). Chart prices are bid prices and
 * S is the typical spread as a price (`typical_spread` x `point`).
 *  - BUY fills at the ask (entry + S) and exits on the bid. The loss per ounce
 *    at the stop is SLD + S; the gain per ounce at a target T away is T - S.
 *    The stop and the target trigger on the bid, so their chart levels are the
 *    prices of steps 7 and 9.
 *  - SELL fills on the bid (entry). Its stop and target trigger on the ask, so
 *    the loss and the gain per ounce are SLD and T, and the chart (bid) levels
 *    where they trigger are the stop price and the target price MINUS S.
 * With S = 0 every line below is the 6.7 table.
 *
 * One reading that is mine and is flagged in the hand-off: the leverage steps
 * (1 and 4) use the FILL price (entry + S for a BUY), the price the position is
 * opened at, so "leverage used never above the limit" holds for the real fill.
 * With S = 0 the two readings are the same number.
 *
 * Two lot rules that go beyond the table: the broker's maximum lot is a third
 * limit in step 3, and a lot below the broker's minimum is NEVER rounded up to
 * it (6.8): the result is UNDERFLOW, with no lot. `underflow.ts` says what
 * the trader may do about it.
 *
 * @module lib/engine4/sizing
 */

import {
  Rational,
  readNonNegative,
  readPositive,
  type DecimalLike,
} from './exact';
import { Engine4InputError } from './types';
import type {
  LimitingFactor,
  ResolvedSymbolSpec,
  SizingInput,
  SizingResult,
  SymbolSpecInput,
  TargetPlan,
  UnderflowCause,
} from './types';

const HUNDRED = Rational.int(100n);

/**
 * Validate a `symbol_specs` row for sizing. A row that contradicts itself is
 * refused rather than guessed at: the minimum lot must sit on the lot step (so
 * "round down to the step" and "at least the minimum" cannot disagree) and the
 * maximum must not be below the minimum.
 */
export function resolveSymbolSpec(spec: SymbolSpecInput): ResolvedSymbolSpec {
  const contractSize = readPositive('spec.contractSize', spec.contractSize);
  const volumeMin = readPositive('spec.volumeMin', spec.volumeMin);
  const volumeStep = readPositive('spec.volumeStep', spec.volumeStep);
  const volumeMax = readPositive('spec.volumeMax', spec.volumeMax);
  const typicalSpread = readNonNegative(
    'spec.typicalSpread',
    spec.typicalSpread
  );
  const point = readPositive('spec.point', spec.point);

  if (!volumeMin.div(volumeStep).isInteger()) {
    throw new Engine4InputError(
      'BAD_SPEC',
      'spec.volumeMin is not a multiple of spec.volumeStep',
      'spec.volumeMin'
    );
  }
  if (volumeMax.lt(volumeMin)) {
    throw new Engine4InputError(
      'BAD_SPEC',
      'spec.volumeMax is below spec.volumeMin',
      'spec.volumeMax'
    );
  }
  return {
    contractSize,
    volumeMin,
    volumeStep,
    volumeMax,
    typicalSpread,
    point,
    spreadPrice: typicalSpread.mul(point),
  };
}

/**
 * Steps 1 to 7 of 6.7: everything that does not depend on the target.
 * Throws `Engine4InputError` for a figure that cannot be used; an underflow
 * is a RESULT (`status: 'UNDERFLOW'`).
 */
export function sizeSetup(input: SizingInput): SizingResult {
  if (input.side !== 'BUY' && input.side !== 'SELL') {
    throw new Engine4InputError(
      'BAD_OPTION',
      'side must be BUY or SELL',
      'side'
    );
  }
  const spec = resolveSymbolSpec(input.spec);
  const entry = readPositive('entry', input.entry);
  const stopDistance = readPositive('stopDistance', input.stopDistance);
  const equity = readPositive('equity', input.equity);
  const riskPct = readPositive('riskPct', input.riskPct);
  const maxLeverage = readPositive('maxLeverage', input.maxLeverage);
  const commission = readNonNegative('commission', input.commission);

  if (riskPct.gt(HUNDRED)) {
    throw new Engine4InputError(
      'OUT_OF_RANGE',
      'riskPct cannot be above 100',
      'riskPct'
    );
  }

  const isBuy = input.side === 'BUY';
  const spreadPrice = spec.spreadPrice;
  const fillPrice = isBuy ? entry.add(spreadPrice) : entry;
  const lossPerOunce = isBuy ? stopDistance.add(spreadPrice) : stopDistance;
  const lossPerLot = lossPerOunce.mul(spec.contractSize).add(commission);

  // step 7
  const stopPrice = isBuy ? entry.sub(stopDistance) : entry.add(stopDistance);
  if (!stopPrice.isPositive()) {
    throw new Engine4InputError(
      'OUT_OF_RANGE',
      'the stop price is not above zero',
      'stopDistance'
    );
  }
  const stopChartLevel = isBuy ? stopPrice : stopPrice.sub(spreadPrice);

  // step 1: Max lot = (Max leverage x Equity) / (Entry x contract)
  const maxLotByLeverage = maxLeverage
    .mul(equity)
    .div(fillPrice.mul(spec.contractSize));
  // step 5 and step 2: Lot@SLD = (RPT x Equity) / (SLD x contract + Commission)
  const declaredRiskPct = riskPct;
  const declaredRisk = riskPct.div(HUNDRED).mul(equity);
  const lotAtStop = declaredRisk.div(lossPerLot);

  // step 3: the least of the three limits, then DOWN to the lot step
  const rawLot = Rational.min(maxLotByLeverage, lotAtStop, spec.volumeMax);
  const limitedBy: LimitingFactor = rawLot.eq(lotAtStop)
    ? 'RISK'
    : rawLot.eq(maxLotByLeverage)
      ? 'LEVERAGE'
      : 'BROKER_MAX';
  const lot = rawLot.floorToMultiple(spec.volumeStep);

  const basis = {
    side: input.side,
    contractSize: spec.contractSize,
    commission,
    entry,
    spreadPrice,
    fillPrice,
    stopDistance,
    lossPerOunce,
    lossPerLot,
    maxLotByLeverage,
    lotAtStop,
    rawLot,
    declaredRisk,
    declaredRiskPct,
    stopPrice,
    stopChartLevel,
  };

  if (lot.lt(spec.volumeMin)) {
    const causes: UnderflowCause[] = [];
    if (lotAtStop.lt(spec.volumeMin)) causes.push('RISK');
    if (maxLotByLeverage.lt(spec.volumeMin)) causes.push('LEVERAGE');
    if (causes.length === 0) {
      // The minimum lot is on the step and the maximum is not below it, so a
      // lot under the minimum can only come from one of the two limits.
      throw new Error('sizeSetup: underflow with no cause');
    }
    return { ...basis, status: 'UNDERFLOW', causes, lot: null };
  }

  const actualRisk = lot.mul(lossPerLot);
  return {
    ...basis,
    status: 'OK',
    lot,
    limitedBy,
    // step 4: (Lot x contract x Entry) / Equity, at the price the order fills
    leverageUsed: lot.mul(spec.contractSize).mul(fillPrice).div(equity),
    // step 6
    actualRisk,
    actualRiskPct: actualRisk.div(equity).mul(HUNDRED),
  };
}

/**
 * Steps 8 to 10 of 6.7 for one RRR: the target distance, the target price and
 * the net profit, with RRR defined as net profit / actual loss (ADR-065), both
 * after commission and rounding. The lot and the stop come from `sizing`.
 */
export function targetAt(sizing: SizingResult, rrr: DecimalLike): TargetPlan {
  const ratio = readPositive('rrr', rrr);
  const isBuy = sizing.side === 'BUY';

  // profit per ounce that makes net profit exactly RRR x the loss at the stop:
  // gain x contract - commission = RRR x (loss x contract + commission)
  const gainPerOunce = ratio
    .mul(sizing.lossPerOunce)
    .add(
      sizing.commission.mul(ratio.add(Rational.ONE)).div(sizing.contractSize)
    );

  // step 8: a BUY also has to cover the spread it pays on the way in
  const targetDistance = isBuy
    ? gainPerOunce.add(sizing.spreadPrice)
    : gainPerOunce;
  // step 9
  const targetPrice = isBuy
    ? sizing.entry.add(targetDistance)
    : sizing.entry.sub(targetDistance);
  if (!targetPrice.isPositive()) {
    throw new Engine4InputError(
      'OUT_OF_RANGE',
      'the target price is not above zero',
      'rrr'
    );
  }
  const targetChartLevel = isBuy
    ? targetPrice
    : targetPrice.sub(sizing.spreadPrice);

  // step 10: Lot x contract x gain - Commission x Lot
  const netProfit =
    sizing.lot === null
      ? null
      : sizing.lot
          .mul(sizing.contractSize)
          .mul(gainPerOunce)
          .sub(sizing.commission.mul(sizing.lot));

  return {
    rrr: ratio,
    targetDistance,
    targetPrice,
    targetChartLevel,
    gainPerOunce,
    netProfit,
  };
}

/** Size a setup and give the target for one RRR: the whole table in one call. */
export function sizeWithTarget(
  input: SizingInput,
  rrr: DecimalLike
): { sizing: SizingResult; target: TargetPlan } {
  const sizing = sizeSetup(input);
  return { sizing, target: targetAt(sizing, rrr) };
}
