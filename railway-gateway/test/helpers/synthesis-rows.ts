import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { isoToSlot } from '../../src/sensors/inputs/stats-slot';
import {
  FIXTURES_DIR,
  FIXTURE_SLOTS,
  FixtureSlot,
  readFixtureCycle,
} from './cycle-fixtures';

/**
 * Rows of `synthesis_readings` and `entry_zones` made from the engine's own `fixtures/<slot>.synthesis.json` (build step 4
 * parts 4 and 5): what the engine writes, and the mapping to the columns. The part 4 gated spec writes them to a real
 * PostgreSQL; the unit specs of the pre-validating writer and the gated parity spec use the same rows, so the three agree
 * on what a valid row is. The mapping here is written independently of `src/sensors/synthesis-rows.ts`, which is what makes
 * a comparison of the two worth something.
 */

export const sha256 = (text: string) =>
  createHash('sha256').update(text).digest('hex');

// ---------------------------------------------------------------- what the engine writes

export interface StoredProfile {
  profile: string;
  reading_json: string | null;
  reading_sha256: string | null;
  zones_json: string;
  zones_sha256: string;
  zones_reason: string | null;
  guard_problems: string[];
}

export interface StoredSynthesis {
  flag: string;
  rules_version: string;
  rules_sha256: string;
  zones_version: string;
  zones_sha256: string;
  reference_price: number | null;
  error: string | null;
  readings: StoredProfile[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Doc = Record<string, any>;

export function readStored(fixture: FixtureSlot): StoredSynthesis {
  return JSON.parse(
    fs.readFileSync(
      path.join(FIXTURES_DIR, `${fixture.stem}.synthesis.json`),
      'utf8'
    )
  );
}

export interface Context {
  synthesis: StoredSynthesis;
  inputs_sha256: string;
  runner_version: string;
}

export function contextOf(fixture: FixtureSlot): Context {
  const cycle = readFixtureCycle(fixture);
  return {
    synthesis: readStored(fixture),
    inputs_sha256: cycle.inputs_sha256,
    runner_version: cycle.runner_version,
  };
}

/**
 * The columns of a `synthesis_readings` row: from the reading's document, its text and its
 * zone rows. The scalar columns are read OUT of the document, so they agree with it by
 * construction; a test that wants a column to disagree overrides it afterwards.
 */
export function readingRowFrom(
  doc: Doc,
  text: string,
  zones: Doc[],
  zonesText: string,
  ctx: Context,
  zonesReason: string | null
): Doc {
  const slot = isoToSlot(doc['cycle_slot']) as number;
  return {
    symbol: 'XAUUSD',
    cycle_slot: slot,
    profile: doc['profile'],
    flag: 'shadow',
    rules_version: doc['rules_version'],
    rules_sha256: doc['rules_sha256'],
    rule_id: doc['rule_id'],
    branch_id: doc['branch_id'],
    status: doc['status'],
    status_reasons: doc['status_reasons'],
    data_status: doc['data_status'],
    archetype: doc['archetype'],
    bias: doc['bias'],
    trend_relation: doc['trend_relation'],
    stand_aside: doc['stand_aside'],
    reading_json: text,
    reading: JSON.parse(text),
    reading_sha256: sha256(text),
    zone_count: zones.length,
    zones_reason: zones.length > 0 ? null : zonesReason,
    zones_json: zonesText,
    zones_sha256: sha256(zonesText),
    zone_params_version: ctx.synthesis.zones_version,
    zone_params_sha256: ctx.synthesis.zones_sha256,
    reference_price: ctx.synthesis.reference_price,
    guard_problems: [],
    inputs_sha256: ctx.inputs_sha256,
    retuning_observed: false,
    retuning_applied: false,
    runner_version: ctx.runner_version,
    python_version: '3.11.9',
    duration_ms: 48.8,
    evaluated_at: slot + 31,
  };
}

/** The `synthesis_readings` row of a stored profile result, with the engine's own text and hash. */
export function storedReadingRow(ctx: Context, profile: string): Doc {
  const stored = ctx.synthesis.readings.find((r) => r.profile === profile)!;
  const text = stored.reading_json!;
  const zones: Doc[] = JSON.parse(stored.zones_json);
  return readingRowFrom(
    JSON.parse(text),
    text,
    zones,
    stored.zones_json,
    ctx,
    stored.zones_reason
  );
}

/** A reading made from a changed document: its text, copy, hash and columns are made consistent again. */
export function changedReadingRow(
  ctx: Context,
  profile: string,
  change: (doc: Doc) => void,
  zones?: Doc[],
  zonesReason: string | null = 'NO_ZONE_SOURCES'
): Doc {
  const stored = ctx.synthesis.readings.find((r) => r.profile === profile)!;
  const doc: Doc = JSON.parse(stored.reading_json!);
  change(doc);
  const zoneRows: Doc[] = zones ?? JSON.parse(stored.zones_json);
  return readingRowFrom(
    doc,
    JSON.stringify(doc),
    zoneRows,
    JSON.stringify(zoneRows),
    ctx,
    zonesReason
  );
}

/** The columns of an `entry_zones` row, read out of one zone row of `zones_json`. */
export function zoneRowFrom(zone: Doc, over: Doc = {}): Doc {
  return {
    symbol: 'XAUUSD',
    cycle_slot: isoToSlot(zone['cycle_slot']),
    profile: zone['profile'],
    zone_id: zone['zone_id'],
    rank: zone['rank'],
    bias: zone['bias'],
    low: zone['low'],
    high: zone['high'],
    reference_price: zone['reference_price'],
    source_sensors: zone['source_sensors'],
    confluence_count: zone['confluence_count'],
    invalidation_price: zone['invalidation_price'],
    invalidation_basis: zone['invalidation_basis'],
    stop_distance: zone['stop_distance'],
    next_opposing_price: zone['next_opposing_level']
      ? zone['next_opposing_level']['price']
      : null,
    runway: zone['runway'],
    runway_ratio: zone['runway_ratio'],
    levels: {
      source_levels: zone['source_levels'],
      confluence_levels: zone['confluence_levels'],
      invalidation_level: zone['invalidation_level'],
      next_opposing_level: zone['next_opposing_level'],
    },
    zone_params_version: zone['zones_version'],
    zone_params_sha256: zone['zones_sha256'],
    ...over,
  };
}

export const V1 = FIXTURE_SLOTS[0];
export const V3 = FIXTURE_SLOTS[1];
export const V4 = FIXTURE_SLOTS[2];

/** The first zone of the 18 Sep Day Trader reading: a LONG zone with a runway and a level behind it. */
export function longZone(ctx: Context = contextOf(V1)): Doc {
  const stored = ctx.synthesis.readings.find(
    (r) => r.profile === 'DAY_TRADER'
  )!;
  return JSON.parse(stored.zones_json)[0];
}

// ---------------------------------------------------------------- a corpus: rows the database must accept or refuse, one rule at a time

/**
 * One row, valid or damaged in one way. `constraint` is the CHECK that is meant to refuse it (`null`: the row is valid and
 * must be accepted). The corpus is shared on purpose: `test/sensors-synthesis-rows.spec.ts` feeds every case to the
 * TypeScript twin of the CHECKs, `test/sensors-synthesis.pg.spec.ts` feeds the same cases to a real PostgreSQL, and
 * together they hold the twin to the database: whatever the database refuses, the twin refuses first, under the same name.
 */
export interface RowCase {
  label: string;
  kind: 'reading' | 'zone';
  /** The name of the CHECK constraint that refuses the row; `null` for a row both must accept. */
  constraint: string | null;
  build: () => Doc;
  /** Why the database cannot be asked (Prisma will not send the value); the twin is still asked. */
  dbSkip?: string;
}

const ctxV1 = () => contextOf(V1);
const zoneOf = (ctx: Context, profile: string, index = 0): Doc =>
  JSON.parse(
    ctx.synthesis.readings.find((r) => r.profile === profile)!.zones_json
  )[index];

function readingCase(
  label: string,
  constraint: string | null,
  build: () => Doc,
  dbSkip?: string
): RowCase {
  return { label, kind: 'reading', constraint, build, dbSkip };
}

function zoneCase(
  label: string,
  constraint: string | null,
  build: () => Doc
): RowCase {
  return { label, kind: 'zone', constraint, build };
}

const R = 'synthesis_readings_';
const Z = 'entry_zones_';
const base = () => zoneRowFrom(longZone());
const noRunway = (): Doc => ({
  ...base(),
  next_opposing_price: null,
  runway: null,
  runway_ratio: null,
  levels: { ...(base()['levels'] as Doc), next_opposing_level: null },
});
const atEntry = (entry: number, over: Doc = {}): Doc => ({
  ...noRunway(),
  reference_price: entry,
  invalidation_price: Number((entry - 16.78).toFixed(2)),
  ...over,
});

/** The documents of readings with other contents than the stored ones: a stand-aside reading, a VALID one. */
const standAside = (d: Doc): void => {
  d['status'] = 'INVALID';
  d['status_reasons'] = ['UPSTREAM_STALE:MCD1'];
  d['bias'] = 'STAND_ASIDE';
  d['stand_aside'] = true;
  d['archetype'] = null;
  d['trend_relation'] = null;
  d['zones'] = [];
};

const readingColumnOverrides: Array<[string, unknown]> = [
  ['profile', 'SCALPER'],
  ['cycle_slot', 1790000100],
  ['rules_version', 'draft-2'],
  ['rules_sha256', 'a'.repeat(64)],
  ['rule_id', 'R9_SOMETHING_ELSE'],
  ['branch_id', 'OTHER_BRANCH'],
  ['branch_id', null],
  ['status', 'INVALID'],
  ['status_reasons', ['MCD0_DEFECT_M5']],
  ['status_reasons', []],
  ['data_status', 'STALE'],
  ['archetype', 'A'],
  ['archetype', null],
  ['bias', 'SHORT'],
  ['trend_relation', 'WITH_TREND'],
  ['trend_relation', null],
  ['stand_aside', true],
];

export const ROW_CASES: RowCase[] = [
  // ---- valid readings
  ...FIXTURE_SLOTS.flatMap((fixture) =>
    ['DAY_TRADER', 'SCALPER'].map((profile) =>
      readingCase(`the stored ${fixture.name} ${profile} reading`, null, () =>
        storedReadingRow(contextOf(fixture), profile)
      )
    )
  ),
  readingCase('the flag live', null, () => ({
    ...storedReadingRow(ctxV1(), 'DAY_TRADER'),
    flag: 'live',
  })),
  readingCase('a VALID reading with no reasons', null, () =>
    changedReadingRow(ctxV1(), 'DAY_TRADER', (d) => {
      d['status'] = 'VALID';
      d['status_reasons'] = [];
    })
  ),
  readingCase(
    'a stand-aside reading with no zones and a data reason',
    null,
    () =>
      changedReadingRow(
        ctxV1(),
        'DAY_TRADER',
        standAside,
        [],
        'NOT_DIRECTIONAL'
      )
  ),
  readingCase(
    'the reading copy spelt with its keys in another order',
    null,
    () => {
      const row = storedReadingRow(ctxV1(), 'DAY_TRADER');
      return {
        ...row,
        reading: Object.fromEntries(
          Object.entries(JSON.parse(row['reading_json'])).reverse()
        ),
      };
    }
  ),
  // ---- readings: one rule broken
  ...['off', 'Shadow', ''].map((flag) =>
    readingCase(
      `the flag ${JSON.stringify(flag)}`,
      R + 'flag_is_shadow_or_live',
      () => ({
        ...storedReadingRow(ctxV1(), 'DAY_TRADER'),
        flag,
      })
    )
  ),
  readingCase('a third trader type', R + 'profile_is_known', () =>
    changedReadingRow(ctxV1(), 'DAY_TRADER', (d) => (d['profile'] = 'SWING'))
  ),
  readingCase(
    'stand_aside true with a direction',
    R + 'stand_aside_is_the_bias',
    () =>
      changedReadingRow(ctxV1(), 'DAY_TRADER', (d) => (d['stand_aside'] = true))
  ),
  readingCase(
    'bias STAND_ASIDE with stand_aside false',
    R + 'stand_aside_is_the_bias',
    () =>
      changedReadingRow(
        ctxV1(),
        'DAY_TRADER',
        (d) => (d['bias'] = 'STAND_ASIDE')
      )
  ),
  readingCase('six zones', R + 'zone_count_range', () => {
    const six = Array.from({ length: 6 }, (_, i) => ({
      ...longZone(ctxV1()),
      zone_id: `Z${i + 1}`,
      rank: i + 1,
    }));
    return changedReadingRow(
      ctxV1(),
      'DAY_TRADER',
      (d) => (d['zones'] = six.map((z) => z['zone_id'])),
      six
    );
  }),
  readingCase('a negative zone count', R + 'zone_count_range', () => ({
    ...changedReadingRow(
      ctxV1(),
      'DAY_TRADER',
      (d) => (d['zones'] = []),
      [],
      'NO_ZONE_SOURCES'
    ),
    zone_count: -1,
  })),
  readingCase('zones for a neutral reading', R + 'zones_need_a_direction', () =>
    changedReadingRow(ctxV1(), 'DAY_TRADER', (d) => {
      d['bias'] = 'NEUTRAL';
      d['trend_relation'] = null;
    })
  ),
  readingCase(
    'a reason for having no zones, with two zones',
    R + 'zones_reason_follows_the_count',
    () => ({
      ...storedReadingRow(ctxV1(), 'DAY_TRADER'),
      zones_reason: 'NO_ZONE_SOURCES',
    })
  ),
  readingCase(
    'no zones and no reason',
    R + 'zones_reason_follows_the_count',
    () =>
      changedReadingRow(
        ctxV1(),
        'DAY_TRADER',
        (d) => (d['zones'] = []),
        [],
        null
      )
  ),
  readingCase(
    'a NULL list column',
    R + 'list_columns_not_null',
    () => ({
      ...storedReadingRow(ctxV1(), 'DAY_TRADER'),
      guard_problems: null,
    }),
    'Prisma will not send NULL for a list column'
  ),
  readingCase(
    'a VALID reading with a reason',
    R + 'reasons_follow_the_status',
    () =>
      changedReadingRow(ctxV1(), 'DAY_TRADER', (d) => {
        d['status'] = 'VALID';
        d['status_reasons'] = ['MCD0_DEFECT_M5'];
      })
  ),
  readingCase(
    'a CAUTIONARY reading with no reason',
    R + 'reasons_follow_the_status',
    () =>
      changedReadingRow(ctxV1(), 'DAY_TRADER', (d) => {
        d['status'] = 'CAUTIONARY';
        d['status_reasons'] = [];
      })
  ),
  readingCase(
    'a wrong reading hash',
    R + 'reading_text_is_its_copy_and_hash',
    () => ({
      ...storedReadingRow(ctxV1(), 'DAY_TRADER'),
      reading_sha256: 'f'.repeat(64),
    })
  ),
  readingCase(
    'a reading hash in capitals',
    R + 'reading_text_is_its_copy_and_hash',
    () => {
      const row = storedReadingRow(ctxV1(), 'DAY_TRADER');
      return {
        ...row,
        reading_sha256: String(row['reading_sha256']).toUpperCase(),
      };
    }
  ),
  readingCase(
    'a JSONB copy of another document',
    R + 'reading_text_is_its_copy_and_hash',
    () => {
      const row = storedReadingRow(ctxV1(), 'DAY_TRADER');
      const other = JSON.parse(row['reading_json']) as Doc;
      other['summary_line'] = 'Another summary, same fields';
      return { ...row, reading: other };
    }
  ),
  readingCase(
    'a wrong zones hash',
    R + 'zones_text_is_its_count_and_hash',
    () => ({
      ...storedReadingRow(ctxV1(), 'DAY_TRADER'),
      zones_sha256: '0'.repeat(64),
    })
  ),
  readingCase(
    'a zone text of one row for two zones',
    R + 'zones_text_is_its_count_and_hash',
    () => {
      const row = storedReadingRow(ctxV1(), 'DAY_TRADER');
      const one = JSON.stringify([JSON.parse(row['zones_json'])[0]]);
      return { ...row, zones_json: one, zones_sha256: sha256(one) };
    }
  ),
  readingCase(
    'a zone text that is not a list',
    R + 'zones_text_is_its_count_and_hash',
    () => {
      const noZones = changedReadingRow(
        ctxV1(),
        'DAY_TRADER',
        (d) => (d['zones'] = []),
        [],
        'NO_ZONE_SOURCES'
      );
      const text = '{"zones":[]}';
      return { ...noZones, zones_json: text, zones_sha256: sha256(text) };
    }
  ),
  ...readingColumnOverrides.map(([column, value]) =>
    readingCase(
      `the column ${column} = ${JSON.stringify(value)} against the reading`,
      R + 'columns_repeat_the_reading',
      () => ({
        ...storedReadingRow(ctxV1(), 'DAY_TRADER'),
        [column]: value,
      })
    )
  ),
  readingCase(
    'a reading that lists one zone id for two zone rows',
    R + 'columns_repeat_the_reading',
    () => changedReadingRow(ctxV1(), 'DAY_TRADER', (d) => (d['zones'] = ['Z1']))
  ),
  // ---- valid zones
  ...FIXTURE_SLOTS.flatMap((fixture) =>
    ['DAY_TRADER', 'SCALPER'].flatMap((profile) => {
      const ctx = contextOf(fixture);
      const zones = JSON.parse(
        ctx.synthesis.readings.find((r) => r.profile === profile)!.zones_json
      ) as Doc[];
      return zones.map((_, index) =>
        zoneCase(
          `the stored ${fixture.name} ${profile} zone ${index + 1}`,
          null,
          () => zoneRowFrom(zoneOf(contextOf(fixture), profile, index))
        )
      );
    })
  ),
  zoneCase('a stop of exactly 13', null, () => ({
    ...base(),
    invalidation_price: Number((longZone()['reference_price'] - 13).toFixed(2)),
    stop_distance: 13,
    invalidation_basis: 'MINIMUM_STOP',
  })),
  zoneCase('a zone with no level beyond the entry', null, noRunway),
  zoneCase('the entry on the high edge', null, () =>
    atEntry(longZone()['high'])
  ),
  zoneCase('the entry on the low edge', null, () => atEntry(longZone()['low'])),
  zoneCase('a zone of one price', null, () =>
    atEntry(longZone()['reference_price'], {
      low: longZone()['reference_price'],
      high: longZone()['reference_price'],
    })
  ),
  zoneCase('no level past the zone (NO_LEVEL)', null, () => ({
    ...base(),
    invalidation_basis: 'NO_LEVEL',
    invalidation_price: Number((longZone()['reference_price'] - 13).toFixed(2)),
    stop_distance: 13,
    levels: { ...(base()['levels'] as Doc), invalidation_level: null },
  })),
  zoneCase('five zones, ranked 1 to 5', null, () => ({
    ...base(),
    rank: 5,
    zone_id: 'Z5',
  })),
  // ---- zones: one rule broken
  zoneCase('a third trader type', Z + 'profile_is_known', () => ({
    ...base(),
    profile: 'SWING',
  })),
  ...['NEUTRAL', 'STAND_ASIDE', 'long'].map((bias) =>
    zoneCase(`the bias ${bias}`, Z + 'bias_is_a_direction', () => ({
      ...base(),
      bias,
    }))
  ),
  ...(
    [
      [0, 'Z0'],
      [6, 'Z6'],
      [1, 'Z2'],
      [2, 'Z1'],
      [1, 'z1'],
      [1, ' Z1'],
    ] as const
  ).map(([rank, zone_id]) =>
    zoneCase(
      `rank ${rank} with id ${JSON.stringify(zone_id)}`,
      Z + 'rank_and_id',
      () => ({ ...base(), rank, zone_id })
    )
  ),
  zoneCase('a low price of zero', Z + 'prices_are_positive', () => ({
    ...base(),
    low: 0,
  })),
  zoneCase('a negative low price', Z + 'prices_are_positive', () => ({
    ...base(),
    low: -1,
  })),
  zoneCase(
    'an invalidation of zero that the stop distance agrees with',
    Z + 'prices_are_positive',
    () => ({
      ...base(),
      invalidation_price: 0,
      stop_distance: longZone()['reference_price'],
    })
  ),
  zoneCase(
    'the entry above the zone',
    Z + 'reference_price_is_inside_the_zone',
    () => ({
      ...base(),
      reference_price: longZone()['high'] + 0.01,
    })
  ),
  zoneCase(
    'the entry below the zone',
    Z + 'reference_price_is_inside_the_zone',
    () => ({
      ...base(),
      reference_price: longZone()['low'] - 0.01,
    })
  ),
  zoneCase(
    'a LONG invalidated above its entry',
    Z + 'invalidation_is_beyond_the_reference_price',
    () => ({
      ...base(),
      invalidation_price: 4385.0,
    })
  ),
  zoneCase(
    'a SHORT invalidated below its entry',
    Z + 'invalidation_is_beyond_the_reference_price',
    () => {
      const short = zoneRowFrom(zoneOf(contextOf(V4), 'DAY_TRADER'));
      return {
        ...short,
        zone_id: 'Z2',
        rank: 2,
        invalidation_price: short['reference_price'] - 20,
      };
    }
  ),
  zoneCase('a stop of 12.99', Z + 'stop_distance_is_at_least_13', () => ({
    ...base(),
    invalidation_price: Number(
      (longZone()['reference_price'] - 12.99).toFixed(2)
    ),
    stop_distance: 12.99,
  })),
  zoneCase(
    'a stop distance that is not the distance',
    Z + 'stop_distance_is_the_distance',
    () => ({
      ...base(),
      stop_distance: 20,
    })
  ),
  zoneCase(
    'a stop distance a cent off',
    Z + 'stop_distance_is_the_distance',
    () => ({
      ...base(),
      stop_distance: 16.79 + 0.005,
    })
  ),
  ...['GUESS', 'level', ''].map((basis) =>
    zoneCase(
      `the invalidation basis ${JSON.stringify(basis)}`,
      Z + 'invalidation_basis_is_known',
      () => ({
        ...base(),
        invalidation_basis: basis,
      })
    )
  ),
  zoneCase('no source sensor', Z + 'sources_not_empty', () => ({
    ...base(),
    source_sensors: [],
  })),
  zoneCase('no confluence', Z + 'confluence_at_least_the_source', () => ({
    ...base(),
    confluence_count: 0,
    levels: { ...(base()['levels'] as Doc), confluence_levels: [] },
  })),
  zoneCase(
    'a runway and a ratio with no opposing price',
    Z + 'runway_is_all_or_nothing',
    () => ({
      ...base(),
      next_opposing_price: null,
      levels: { ...(base()['levels'] as Doc), next_opposing_level: null },
    })
  ),
  zoneCase(
    'an opposing price with no runway',
    Z + 'runway_is_all_or_nothing',
    () => ({ ...base(), runway: null })
  ),
  zoneCase('a runway with no ratio', Z + 'runway_is_all_or_nothing', () => ({
    ...base(),
    runway_ratio: null,
  })),
  zoneCase(
    'a ratio with no runway and no opposing price',
    Z + 'runway_is_all_or_nothing',
    () => ({
      ...noRunway(),
      runway_ratio: 0.14,
    })
  ),
  zoneCase('a runway of zero', Z + 'runway_is_all_or_nothing', () => ({
    ...base(),
    runway: 0,
  })),
  zoneCase('a negative ratio', Z + 'runway_is_all_or_nothing', () => ({
    ...base(),
    runway_ratio: -0.01,
  })),
  zoneCase(
    'an opposing level below a LONG',
    Z + 'runway_is_the_distance_to_the_opposing_level',
    () => ({
      ...base(),
      next_opposing_price: longZone()['reference_price'] - 5,
      runway: 5,
    })
  ),
  zoneCase(
    'a runway that is not the distance',
    Z + 'runway_is_the_distance_to_the_opposing_level',
    () => ({
      ...base(),
      runway: 3,
    })
  ),
  ...[
    'source_levels',
    'confluence_levels',
    'invalidation_level',
    'next_opposing_level',
  ].map((part) =>
    zoneCase(
      `the audit document without ${part}`,
      Z + 'levels_match_the_columns',
      () => {
        const { [part]: _dropped, ...rest } = base()['levels'] as Doc;
        void _dropped;
        return { ...base(), levels: rest };
      }
    )
  ),
  zoneCase(
    'the audit document an empty list',
    Z + 'levels_match_the_columns',
    () => ({ ...base(), levels: [] })
  ),
  zoneCase(
    'the audit document a list of the four names',
    Z + 'levels_match_the_columns',
    () => ({
      ...base(),
      levels: Object.keys(base()['levels'] as Doc),
    })
  ),
  zoneCase(
    'a confluence count that is not the number of levels',
    Z + 'levels_match_the_columns',
    () => ({
      ...base(),
      levels: {
        ...(base()['levels'] as Doc),
        confluence_levels: (base()['levels'] as Doc)['confluence_levels'].slice(
          1
        ),
      },
    })
  ),
  zoneCase(
    'an opposing level in the document and no opposing price',
    Z + 'levels_match_the_columns',
    () => ({
      ...noRunway(),
      levels: { ...(base()['levels'] as Doc) },
    })
  ),
  zoneCase(
    'no invalidation level for a LEVEL basis',
    Z + 'levels_match_the_columns',
    () => ({
      ...base(),
      levels: { ...(base()['levels'] as Doc), invalidation_level: null },
    })
  ),
];
