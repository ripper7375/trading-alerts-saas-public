/**
 * The ids of the values the prompt shows (build step 7 part 2; architecture 5.7, plan section 4).
 *
 * The model writes WORDS and never a number: where a price, a distance or a time belongs it
 * writes the id of the value in braces (`{MCD2.baseline}`), and the server fills it (part 5). So
 * the prompt must show the model which ids exist, beside the values they stand for. This file is
 * the ONE place those ids are named, and the renderers call it; the value dictionary of part 4
 * (`buildValueDictionary`) must produce exactly these ids, with their kinds and tolerances, and a
 * part 4 test should hold every id in an assembled prompt to the dictionary. Nothing here knows a
 * kind, a tolerance or a distance: that is the dictionary's.
 *
 * THE VOCABULARY
 *  - `LAST_PRICE`, `DAY.open`, `DAY.high`, `DAY.low`: fixed; the static rules name them, so the
 *    OHLC block itself carries no ids and stays exactly the format of 5.5;
 *  - `PROFILE.max_risk_pct`, `.max_leverage`, `.target_rrr`, `.min_sld`: fixed, and shown beside
 *    their values on the profile line;
 *  - `MCD2.baseline`: a level of a sensor's envelope, by its own name when the name is unique in
 *    that envelope, `MCD3.M5.UOEDT` (timeframe first) when two levels share a name;
 *  - `Z1.low`, `Z1.high`, `Z1.reference`, `Z1.invalidation`, `Z1.stop_distance`, `Z1.runway`:
 *    the fields of a stored entry zone;
 *  - `EVENT1.time`: the time of the n-th event of the packet's calendar block.
 *
 * Every id fits the contract's grammar (`VALUE_ID` of `contracts/shape.ts`); a level whose name
 * cannot form an id is shown WITHOUT one, so it cannot be quoted.
 *
 * Pure.
 *
 * @module lib/reply/context/values
 */

import { VALUE_ID } from '../contracts/shape';

export const LAST_PRICE_ID = 'LAST_PRICE';
export const DAY_IDS = {
  open: 'DAY.open',
  high: 'DAY.high',
  low: 'DAY.low',
} as const;

export const PROFILE_FIELDS = [
  'max_risk_pct',
  'max_leverage',
  'target_rrr',
  'min_sld',
] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];

export const ZONE_FIELDS = [
  'low',
  'high',
  'reference',
  'invalidation',
  'stop_distance',
  'runway',
] as const;
export type ZoneField = (typeof ZONE_FIELDS)[number];

/**
 * The fixed ids the static rules list, in the order they are listed. The profile ids are not
 * among them: the profile line carries each one beside its value.
 */
export const FIXED_VALUE_IDS: readonly string[] = [
  LAST_PRICE_ID,
  DAY_IDS.open,
  DAY_IDS.high,
  DAY_IDS.low,
];

const NAME_PART = /^[A-Za-z0-9][A-Za-z0-9_]{0,31}$/;

export function profileValueId(field: ProfileField): string {
  return `PROFILE.${field}`;
}

export function zoneValueId(zoneId: string, field: ZoneField): string | null {
  const id = `${zoneId}.${field}`;
  return VALUE_ID.test(id) ? id : null;
}

export function eventValueId(position: number): string | null {
  if (!Number.isInteger(position) || position < 1) return null;
  const id = `EVENT${position}.time`;
  return VALUE_ID.test(id) ? id : null;
}

export interface LevelName {
  name: string;
  tf: string;
}

/**
 * The id of each level of one sensor's envelope, in the envelope's order; `null` for a level
 * that cannot be quoted (a name that does not fit the grammar, or two levels that are the same
 * name on the same timeframe).
 */
export function levelValueIds(
  mcdId: string,
  levels: readonly LevelName[]
): (string | null)[] {
  const byName = new Map<string, number>();
  const byTimeframeName = new Map<string, number>();
  for (const level of levels) {
    byName.set(level.name, (byName.get(level.name) ?? 0) + 1);
    const key = `${level.tf}.${level.name}`;
    byTimeframeName.set(key, (byTimeframeName.get(key) ?? 0) + 1);
  }
  return levels.map((level) => {
    if (!NAME_PART.test(level.name)) return null;
    let id: string;
    if (byName.get(level.name) === 1) {
      id = `${mcdId}.${level.name}`;
    } else {
      if (!NAME_PART.test(level.tf)) return null;
      if (byTimeframeName.get(`${level.tf}.${level.name}`) !== 1) return null;
      id = `${mcdId}.${level.tf}.${level.name}`;
    }
    return VALUE_ID.test(id) ? id : null;
  });
}
