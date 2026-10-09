/**
 * Loader and reader for the independent oracle's fixture
 * (`scripts/engine4/oracle.py` -> `fixtures/sizing-oracle.json`).
 *
 * Every figure in the fixture is TEXT: a decimal ("90.24") or a quotient of
 * two decimals ("10000/150400"). Nothing here parses a JSON number.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { Rational } from '@/lib/engine4';
import type { SizingInput, SymbolSpecInput } from '@/lib/engine4';

export interface OracleSpec {
  contract_size: string;
  volume_min: string;
  volume_step: string;
  volume_max: string;
  typical_spread: string;
  point: string;
}

export interface OracleInput {
  side: 'BUY' | 'SELL';
  entry: string;
  stop_distance: string;
  equity: string;
  risk_pct: string;
  max_leverage: string;
  commission: string;
  spec: OracleSpec;
  target_rrr: string;
  max_risk_pct: string;
  min_sld: string;
  structural_stops: string[];
}

export interface OracleSizing {
  status: 'OK' | 'UNDERFLOW';
  causes: string[];
  limited_by: string;
  fill_price: string;
  spread_price: string;
  loss_per_ounce: string;
  loss_per_lot: string;
  max_lot_by_leverage: string;
  lot_at_stop: string;
  raw_lot: string;
  declared_risk: string;
  declared_risk_2dp: string;
  stop_price: string;
  stop_price_2dp: string;
  stop_chart_level: string;
  stop_chart_level_2dp: string;
  lot: string | null;
  actual_risk?: string;
  actual_risk_2dp?: string;
  actual_risk_pct?: string;
  actual_risk_pct_2dp?: string;
  leverage_used?: string;
  leverage_used_3dp?: string;
}

export interface OracleTarget {
  name?: string;
  rrr: string;
  gain_per_ounce: string;
  target_distance: string;
  target_distance_2dp: string;
  target_price: string;
  target_price_2dp: string;
  target_chart_level: string;
  target_chart_level_2dp: string;
  net_profit: string | null;
  net_profit_2dp: string | null;
}

export interface OracleScenarioSet {
  normal_rrr: string;
  normal_capped: boolean;
  scenarios: (OracleTarget & { name: string })[];
  omitted: { name: string; rrr: string; reason: string }[];
}

export interface OracleUnderflow {
  causes: string[];
  min_lot_loss: string;
  min_lot_risk_pct: string;
  options: Record<string, string>[];
  facts: Record<string, string>[];
}

export interface OracleCase {
  id: string;
  kind: string;
  note: string;
  input: OracleInput;
  sizing: OracleSizing;
  with_trend: OracleScenarioSet;
  counter_trend: OracleScenarioSet;
  underflow: OracleUnderflow | null;
}

export interface OracleFixture {
  generator: {
    script: string;
    script_sha256: string;
    seed: number;
    arithmetic: string;
    case_count: number;
    format: string;
  };
  cases: OracleCase[];
}

export const FIXTURE_PATH = join(
  __dirname,
  '..',
  'fixtures',
  'sizing-oracle.json'
);

let cached: OracleFixture | undefined;

export function loadOracle(): OracleFixture {
  if (cached === undefined) {
    cached = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as OracleFixture;
  }
  return cached;
}

/** "10000/150400" or "90.24" as an exact value. */
export function expected(text: string): Rational {
  const slash = text.indexOf('/');
  if (slash < 0) return Rational.of(text);
  return Rational.of(text.slice(0, slash)).div(
    Rational.of(text.slice(slash + 1))
  );
}

export function specOf(spec: OracleSpec): SymbolSpecInput {
  return {
    contractSize: spec.contract_size,
    volumeMin: spec.volume_min,
    volumeStep: spec.volume_step,
    volumeMax: spec.volume_max,
    typicalSpread: spec.typical_spread,
    point: spec.point,
  };
}

export function toSizingInput(input: OracleInput): SizingInput {
  return {
    side: input.side,
    entry: input.entry,
    stopDistance: input.stop_distance,
    equity: input.equity,
    riskPct: input.risk_pct,
    maxLeverage: input.max_leverage,
    commission: input.commission,
    spec: specOf(input.spec),
  };
}

/**
 * Compare an engine value with the oracle's text, exactly. A difference is
 * pushed to `problems` with its label so one failing case lists everything
 * that is wrong with it.
 */
export function sameValue(
  problems: string[],
  label: string,
  actual: Rational | null | undefined,
  oracleText: string | null | undefined
): void {
  if (oracleText === null || oracleText === undefined) {
    if (actual !== null && actual !== undefined) {
      problems.push(
        `${label}: engine has ${actual.toString()}, oracle has none`
      );
    }
    return;
  }
  if (actual === null || actual === undefined) {
    problems.push(`${label}: engine has none, oracle has ${oracleText}`);
    return;
  }
  const want = expected(oracleText);
  if (!actual.eq(want)) {
    problems.push(
      `${label}: engine ${actual.toString()} but oracle ${want.toString()}`
    );
  }
}

/** Compare a rounded display string with the oracle's. */
export function sameText(
  problems: string[],
  label: string,
  actual: string | null | undefined,
  oracleText: string | null | undefined
): void {
  if ((actual ?? null) !== (oracleText ?? null)) {
    problems.push(`${label}: engine "${actual}" but oracle "${oracleText}"`);
  }
}
