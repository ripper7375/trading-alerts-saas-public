/**
 * The badge (architecture 6.5, ADR-063): from synthesis and from room.
 *
 * | Condition                                           | Badge        |
 * | No scenario fits before the next level              | No badge     |
 * | Counter-trend or conflict                           | Conservative |
 * | With the trend; room >= Normal RRR                  | Normal       |
 * | With the trend on M5 and M15; room >= Aggressive RRR | Aggressive   |
 *
 * "A badge only goes to a scenario whose target sits before the next level"
 * (strictly before, decision D8). No model chooses it and no WACS threshold is
 * involved.
 *
 * How the table is read here (flagged in the part 2 hand-off; each is a few
 * lines):
 *  - The SYN reading gives the setup's row. COUNTER_TREND is its
 *    `trend_relation`. A conflict is MCD3 reporting
 *    `MCD3_NON_CONSOLIDATED_TREND_CONFLICT` (the M15 and M5 slopes differ).
 *    "With the trend on M5 and M15" is a WITH_TREND reading in which both channel
 *    sensors, MCD1 (M15) and MCD2 (M5), vote the reading's own direction.
 *  - The table names the HIGHEST badge a row allows. The badge is the highest
 *    scenario at or below that cap whose target fits: with the trend and room
 *    for Conservative only, the badge is Conservative.
 *  - If no scenario at or below the cap exists or fits (a counter-trend setup
 *    whose profile RRR is the 1.50 floor has no Conservative scenario) there is
 *    no badge, and the reason says so.
 *
 * @module lib/engine4/badge
 */

import { isRecord, type Level } from './levels';
import { targetFitsBefore } from './room';
import type { Scenario, ScenarioName, Side } from './types';

export type TrendRelation = 'WITH_TREND' | 'COUNTER_TREND';

/** What the badge needs to know about the SYN reading. */
export interface BadgeContext {
  trendRelation: TrendRelation;
  /** MCD3 reports a trend conflict: the M15 and M5 slopes differ */
  conflict: boolean;
  /** both channel sensors (MCD1 on M15, MCD2 on M5) vote the reading's own direction */
  trendOnBothTimeframes: boolean;
}

/** The rows of the table that give a badge. */
export type BadgeRow =
  | 'COUNTER_TREND'
  | 'CONFLICT'
  | 'WITH_TREND'
  | 'WITH_TREND_BOTH_TIMEFRAMES';

export type NoBadgeReason = 'NO_SCENARIO_FITS' | 'NO_SCENARIO_WITHIN_STYLE';

export interface BadgeResult {
  /** the scenario that carries the badge, or null */
  badge: ScenarioName | null;
  /** the table row the setup is in */
  row: BadgeRow;
  /** the highest badge that row allows */
  cap: ScenarioName;
  /** the scenarios whose target sits strictly before the next opposing level, lowest first */
  fitting: ScenarioName[];
  noBadgeReason: NoBadgeReason | null;
  /** the level the targets were measured against, named in the report; null when there is none */
  nextLevel: Level | null;
}

const ORDER: readonly ScenarioName[] = ['CONSERVATIVE', 'NORMAL', 'AGGRESSIVE'];

/** The badges a cap allows, highest first. */
const BELOW_CAP: Readonly<Record<ScenarioName, readonly ScenarioName[]>> = {
  CONSERVATIVE: ['CONSERVATIVE'],
  NORMAL: ['NORMAL', 'CONSERVATIVE'],
  AGGRESSIVE: ['AGGRESSIVE', 'NORMAL', 'CONSERVATIVE'],
};

/**
 * The badge context of a parsed `syn-output/1` reading, or null when the
 * reading has no direction (nothing to badge: Report 2 is not offered).
 */
export function badgeContextFromReading(reading: unknown): BadgeContext | null {
  if (!isRecord(reading)) return null;
  const relation = reading['trend_relation'];
  const bias = reading['bias'];
  if (
    (relation !== 'WITH_TREND' && relation !== 'COUNTER_TREND') ||
    (bias !== 'LONG' && bias !== 'SHORT')
  ) {
    return null;
  }
  const inputs = isRecord(reading['inputs']) ? reading['inputs'] : {};
  const field = (sensor: string, key: string): unknown => {
    const record = inputs[sensor];
    return isRecord(record) ? record[key] : null;
  };
  return {
    trendRelation: relation,
    conflict:
      field('MCD3', 'state_code') === 'MCD3_NON_CONSOLIDATED_TREND_CONFLICT',
    trendOnBothTimeframes:
      relation === 'WITH_TREND' &&
      field('MCD1', 'bias') === bias &&
      field('MCD2', 'bias') === bias,
  };
}

function rowOf(context: BadgeContext): BadgeRow {
  if (context.trendRelation === 'COUNTER_TREND') return 'COUNTER_TREND';
  if (context.conflict) return 'CONFLICT';
  return context.trendOnBothTimeframes
    ? 'WITH_TREND_BOTH_TIMEFRAMES'
    : 'WITH_TREND';
}

function capOf(row: BadgeRow): ScenarioName {
  if (row === 'COUNTER_TREND' || row === 'CONFLICT') return 'CONSERVATIVE';
  return row === 'WITH_TREND' ? 'NORMAL' : 'AGGRESSIVE';
}

export interface BadgeInput {
  side: Side;
  context: BadgeContext;
  /** the scenarios offered (part 1's `buildScenarios`), each with its target's chart level */
  scenarios: readonly Scenario[];
  /** the next opposing level beyond the entry (`nextOpposingLevel`), or null when nothing lies beyond it */
  nextLevel: Level | null;
}

/** Decide the badge. */
export function decideBadge(input: BadgeInput): BadgeResult {
  const row = rowOf(input.context);
  const cap = capOf(row);
  const fitting = ORDER.filter((name) =>
    input.scenarios.some(
      (scenario) =>
        scenario.name === name &&
        targetFitsBefore(
          input.side,
          scenario.target.targetChartLevel,
          input.nextLevel
        )
    )
  );
  const base = { row, cap, fitting, nextLevel: input.nextLevel };
  if (fitting.length === 0) {
    return { ...base, badge: null, noBadgeReason: 'NO_SCENARIO_FITS' };
  }
  const badge = BELOW_CAP[cap].find((name) => fitting.includes(name));
  return badge === undefined
    ? { ...base, badge: null, noBadgeReason: 'NO_SCENARIO_WITHIN_STYLE' }
    : { ...base, badge, noBadgeReason: null };
}
