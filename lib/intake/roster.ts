/**
 * The sensor roster: which sensors exist, what each one is, and which one is the
 * primary sensor of a trader type (architecture 4.4 and 2.13, ADR-040 and ADR-041).
 *
 * The roster is GENERATED from the MCD registries by `scripts/intake/build_roster.py`
 * and committed as `config/intake/sensor-roster.json`; nothing in this folder lists
 * a sensor by hand. The primary sensor is read from the registry rung
 * (`primary_structure`), never named: MCD1 is the Day Trader's and MCD2 the
 * Scalper's today only because their registries say so. A sensor added later (MCD4)
 * appears by adding a registry row and rebuilding the roster.
 *
 * `parseRoster` is strict and reports every problem; the committed file is parsed
 * at load and a bad file stops the module, because a roster that is wrong would
 * route every request wrongly. A test keeps the file equal to a rebuild.
 *
 * @module lib/intake/roster
 */

import rosterFile from '@/config/intake/sensor-roster.json';

import {
  Issues,
  at,
  exactObject,
  isRecord,
  list,
  mcdIdsAscending,
  oneOf,
  text,
  join,
  type Issue,
} from './check';
import { SENSOR_ROSTER_SCHEMA } from './version';

/** The two trader types a registry gives a rung for (the keys of `rung`). */
export const TRADER_TYPES = ['DAY_TRADER', 'SCALPER'] as const;
export type TraderType = (typeof TRADER_TYPES)[number];

export const TIMEFRAMES = ['M5', 'M15'] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export const SENSOR_KINDS = ['gate', 'independent', 'derived'] as const;
export type SensorKind = (typeof SENSOR_KINDS)[number];

export const SENSOR_FLAGS = ['off', 'shadow', 'live'] as const;
export type SensorFlag = (typeof SENSOR_FLAGS)[number];

/** The rung that makes a sensor the primary one for a trader type (standard 9.3). */
export const PRIMARY_RUNG = 'primary_structure';

export const MCD_ID_PATTERN = /^MCD([0-9]|1[0-5])$/;

export interface RosterSensor {
  mcd_id: string;
  name: string;
  kind: SensorKind;
  timeframes: Timeframe[];
  depends_on: string[];
  uses_channel: Timeframe[];
  /** the rung per trader type; empty for a gate */
  rung: Partial<Record<TraderType, string>>;
  /** the trader types this sensor is the primary sensor of */
  primary_for: TraderType[];
  /** a gate (MCD0) is not a board line; its defects show as reasons on the channel sensors */
  on_board: boolean;
  /** the committed flag of the worker configuration (what runs is the stored row's flag) */
  flag: SensorFlag;
  /**
   * The level names its states report (UOEDT, baseline, LOEDT). The glossary (part 3)
   * adds the other terms and names an owner for each.
   */
  owned_terms: string[];
  state_codes: string[];
}

export interface Roster {
  schema: typeof SENSOR_ROSTER_SCHEMA;
  synthesis: { flag: SensorFlag; rules_version: string };
  sensors: RosterSensor[];
}

export type RosterParse =
  | { ok: true; roster: Roster }
  | { ok: false; issues: Issue[] };

const NAME_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function enumList<T extends string>(
  value: unknown,
  path: string,
  allowed: readonly T[],
  issues: Issues,
  rule: { min: number; max: number }
): T[] {
  const items = list(value, path, issues, rule);
  if (items === undefined) return [];
  const out: T[] = [];
  items.forEach((item, index) => {
    const found = oneOf(item, at(path, index), allowed, issues);
    if (found === undefined) return;
    if (out.includes(found)) {
      issues.add(at(path, index), 'DUPLICATE', `${found} appears twice`);
    } else {
      out.push(found);
    }
  });
  return out;
}

function checkSensor(
  value: unknown,
  path: string,
  ids: readonly string[],
  issues: Issues
): void {
  const record = exactObject(
    value,
    path,
    [
      'mcd_id',
      'name',
      'kind',
      'timeframes',
      'depends_on',
      'uses_channel',
      'rung',
      'primary_for',
      'on_board',
      'flag',
      'owned_terms',
      'state_codes',
    ],
    issues
  );
  if (record === undefined) return;

  const mcdId = text(record['mcd_id'], join(path, 'mcd_id'), issues, {
    pattern: MCD_ID_PATTERN,
  });
  text(record['name'], join(path, 'name'), issues, { max: 80 });
  const kind = oneOf(record['kind'], join(path, 'kind'), SENSOR_KINDS, issues);
  enumList(record['timeframes'], join(path, 'timeframes'), TIMEFRAMES, issues, {
    min: 1,
    max: TIMEFRAMES.length,
  });
  enumList(
    record['uses_channel'],
    join(path, 'uses_channel'),
    TIMEFRAMES,
    issues,
    { min: 0, max: TIMEFRAMES.length }
  );
  const dependsOn = list(
    record['depends_on'],
    join(path, 'depends_on'),
    issues,
    {
      max: 16,
    }
  );
  dependsOn?.forEach((dependency, index) => {
    const where = at(join(path, 'depends_on'), index);
    if (typeof dependency !== 'string' || !ids.includes(dependency)) {
      issues.add(
        where,
        'NOT_ONE_OF',
        'must be the id of a sensor of the roster'
      );
    } else if (dependency === mcdId) {
      issues.add(where, 'INCONSISTENT', 'a sensor cannot depend on itself');
    }
  });

  // the rung: a gate has none, every other sensor has one per trader type
  const rungPath = join(path, 'rung');
  const rungValue = record['rung'];
  const rungs: Partial<Record<TraderType, string>> = {};
  if (!isRecord(rungValue)) {
    issues.add(rungPath, 'WRONG_TYPE', 'must be an object');
  } else if (kind === 'gate') {
    if (Object.keys(rungValue).length > 0) {
      issues.add(rungPath, 'INCONSISTENT', 'a gate has no rung');
    }
  } else {
    for (const key of Object.keys(rungValue)) {
      if (!(TRADER_TYPES as readonly string[]).includes(key)) {
        issues.add(join(rungPath, key), 'UNKNOWN_KEY', 'is not a trader type');
      }
    }
    for (const traderType of TRADER_TYPES) {
      const rung = text(
        rungValue[traderType],
        join(rungPath, traderType),
        issues,
        {
          max: 60,
          pattern: NAME_TOKEN,
        }
      );
      if (rung !== undefined) rungs[traderType] = rung;
    }
  }

  const primaryFor = enumList(
    record['primary_for'],
    join(path, 'primary_for'),
    TRADER_TYPES,
    issues,
    { min: 0, max: TRADER_TYPES.length }
  );
  const derived = TRADER_TYPES.filter((t) => rungs[t] === PRIMARY_RUNG);
  if (
    kind !== undefined &&
    (primaryFor.length !== derived.length ||
      derived.some((t, i) => primaryFor[i] !== t))
  ) {
    issues.add(
      join(path, 'primary_for'),
      'INCONSISTENT',
      `must be the trader types whose rung is ${PRIMARY_RUNG}`
    );
  }

  if (typeof record['on_board'] !== 'boolean') {
    issues.add(join(path, 'on_board'), 'WRONG_TYPE', 'must be true or false');
  } else if (kind !== undefined && record['on_board'] !== (kind !== 'gate')) {
    issues.add(
      join(path, 'on_board'),
      'INCONSISTENT',
      'is false for a gate and true for every other sensor'
    );
  }
  oneOf(record['flag'], join(path, 'flag'), SENSOR_FLAGS, issues);

  const terms = list(record['owned_terms'], join(path, 'owned_terms'), issues, {
    max: 32,
  });
  terms?.forEach((term, index) =>
    text(term, at(join(path, 'owned_terms'), index), issues, { max: 40 })
  );

  const codes = list(record['state_codes'], join(path, 'state_codes'), issues, {
    max: 64,
    min: 1,
  });
  const seen = new Set<string>();
  codes?.forEach((code, index) => {
    const where = at(join(path, 'state_codes'), index);
    const found = text(code, where, issues, {
      max: 48,
      pattern: /^MCD([0-9]|1[0-5])_[A-Z0-9_]+$/,
    });
    if (found === undefined) return;
    if (mcdId !== undefined && !found.startsWith(`${mcdId}_`)) {
      issues.add(where, 'INCONSISTENT', `must start with ${mcdId}_`);
    }
    if (seen.has(found))
      issues.add(where, 'DUPLICATE', `${found} appears twice`);
    seen.add(found);
  });
}

export function parseRoster(raw: unknown): RosterParse {
  const issues = new Issues();
  const record = exactObject(
    raw,
    '',
    ['schema', 'synthesis', 'sensors'],
    issues
  );
  if (record === undefined) return { ok: false, issues: issues.list };

  if (record['schema'] !== SENSOR_ROSTER_SCHEMA) {
    issues.add('schema', 'NOT_ONE_OF', `must be ${SENSOR_ROSTER_SCHEMA}`);
  }
  const synthesis = exactObject(
    record['synthesis'],
    'synthesis',
    ['flag', 'rules_version'],
    issues
  );
  if (synthesis !== undefined) {
    oneOf(synthesis['flag'], 'synthesis.flag', SENSOR_FLAGS, issues);
    text(synthesis['rules_version'], 'synthesis.rules_version', issues, {
      max: 40,
      pattern: /^[a-z0-9][a-z0-9._-]*$/,
    });
  }

  const sensors = list(record['sensors'], 'sensors', issues, {
    min: 1,
    max: 16,
  });
  if (sensors !== undefined) {
    const ids = sensors.map((s) =>
      isRecord(s) && typeof s['mcd_id'] === 'string' ? s['mcd_id'] : ''
    );
    mcdIdsAscending(
      ids.filter((id) => id !== ''),
      'sensors',
      issues
    );
    sensors.forEach((sensor, index) =>
      checkSensor(sensor, at('sensors', index), ids, issues)
    );

    // exactly one primary sensor per trader type among the sensors on the board
    for (const traderType of TRADER_TYPES) {
      const claimants = sensors.filter(
        (s) =>
          isRecord(s) &&
          s['on_board'] === true &&
          Array.isArray(s['primary_for']) &&
          s['primary_for'].includes(traderType)
      );
      if (claimants.length !== 1) {
        issues.add(
          'sensors',
          'INCONSISTENT',
          `${traderType} needs exactly one primary sensor (rung ${PRIMARY_RUNG}); found ${claimants.length}`
        );
      }
    }
  }

  return issues.any
    ? { ok: false, issues: issues.list }
    : { ok: true, roster: record as unknown as Roster };
}

function loadCommittedRoster(): Roster {
  const parsed = parseRoster(rosterFile as unknown);
  if (!parsed.ok) {
    const first = parsed.issues
      .slice(0, 5)
      .map((issue) => `${issue.path || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(
      `config/intake/sensor-roster.json is not a valid roster (${first}). Rebuild it: python scripts/intake/build_roster.py`
    );
  }
  return parsed.roster;
}

/** The committed roster, parsed once. */
export const SENSOR_ROSTER: Roster = loadCommittedRoster();

/** The sensors that have a line on the board (every one but a gate), in id order. */
export function boardSensors(roster: Roster = SENSOR_ROSTER): RosterSensor[] {
  return roster.sensors.filter((sensor) => sensor.on_board);
}

export function sensorById(
  id: string,
  roster: Roster = SENSOR_ROSTER
): RosterSensor | undefined {
  return roster.sensors.find((sensor) => sensor.mcd_id === id);
}

/**
 * The sensors on the board whose rung for `traderType` is the primary one. A parsed
 * roster has exactly one; a roster being drafted (a registry row added) may have
 * more, and this is how that is seen.
 */
export function primarySensors(
  traderType: TraderType,
  roster: Roster = SENSOR_ROSTER
): RosterSensor[] {
  return boardSensors(roster).filter((sensor) =>
    sensor.primary_for.includes(traderType)
  );
}

/** The primary sensor of a trader type: always in full (ADR-041). */
export function primarySensor(
  traderType: TraderType,
  roster: Roster = SENSOR_ROSTER
): RosterSensor {
  const candidates = primarySensors(traderType, roster);
  const [only] = candidates;
  if (only === undefined || candidates.length !== 1) {
    throw new Error(
      `${traderType} needs exactly one primary sensor; the roster has ${candidates.length}`
    );
  }
  return only;
}
