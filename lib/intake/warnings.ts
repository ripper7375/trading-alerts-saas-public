/**
 * Warnings: the sensors a question can never route out (architecture 4.4 point 2, ADR-041,
 * plan decision D2 b).
 *
 * A warning is a USABLE sensor (VALID or CAUTIONARY, so it has a bias) that either
 *  - says STAND_ASIDE, or
 *  - says LONG while the synthesis is SHORT, or SHORT while it is LONG.
 *
 * Readings that are not warnings, on purpose:
 *  - NEUTRAL: it takes no side, so it opposes nothing;
 *  - a sensor that is INVALID, STALE or ABSENT: it says nothing, and the board already lists
 *    it as unavailable;
 *  - anything that "opposes" a synthesis that itself stands aside, is NEUTRAL, or is not
 *    running: there is no direction to oppose. A sensor that says STAND_ASIDE is a warning
 *    whatever the synthesis says.
 *
 * Pure: no I/O, no clock.
 *
 * @module lib/intake/warnings
 */

import { isUsable, orderedMcdIds, type SensorFacts } from './facts';
import type { Bias } from './packet';

export const WARNING_KINDS = ['STAND_ASIDE', 'OPPOSES_SYNTHESIS'] as const;
export type WarningKind = (typeof WARNING_KINDS)[number];

export interface Warning {
  mcd_id: string;
  kind: WarningKind;
}

/** LONG against SHORT or SHORT against LONG; nothing else is an opposition. */
export function opposes(a: Bias | null, b: Bias | null): boolean {
  return (a === 'LONG' && b === 'SHORT') || (a === 'SHORT' && b === 'LONG');
}

/**
 * The warnings among `sensors`, in the order of the MCD number. `synthesisBias` is the
 * bias of the trader's synthesis reading, or null when the synthesis is not running.
 */
export function findWarnings(
  sensors: Iterable<Pick<SensorFacts, 'mcd_id' | 'status' | 'bias'>>,
  synthesisBias: Bias | null
): Warning[] {
  const found = new Map<string, Warning>();
  for (const sensor of sensors) {
    if (!isUsable(sensor.status)) continue;
    if (sensor.bias === 'STAND_ASIDE') {
      found.set(sensor.mcd_id, { mcd_id: sensor.mcd_id, kind: 'STAND_ASIDE' });
    } else if (opposes(sensor.bias, synthesisBias)) {
      found.set(sensor.mcd_id, {
        mcd_id: sensor.mcd_id,
        kind: 'OPPOSES_SYNTHESIS',
      });
    }
  }
  return orderedMcdIds(found.keys()).map((id) => found.get(id) as Warning);
}
