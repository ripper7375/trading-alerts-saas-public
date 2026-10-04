import * as fs from 'fs';
import * as path from 'path';
import {
  EntryZoneRow,
  INVALIDATION_BASES,
  MAX_ZONES,
  MIN_STOP_DISTANCE,
  PRICE_TOLERANCE,
  READING_CHECKS,
  SYNTHESIS_PROFILES,
  SynthesisReadingRow,
  ZONE_CHECKS,
  prepareSynthesis,
  readingRowProblems,
  sha256,
  zoneRowProblems,
} from '../src/sensors/synthesis-rows';
import { SynReadingValidator } from '../src/sensors/syn-validator';
import synSchema from '../src/sensors/syn-output-1.schema.json';
import { ENGINE_DIR, FIXTURE_SLOTS } from './helpers/cycle-fixtures';
import {
  Doc,
  ROW_CASES,
  RowCase,
  contextOf,
  storedReadingRow,
  zoneRowFrom,
} from './helpers/synthesis-rows';
import {
  unitResult,
  unitResultWithSynthesis,
} from './helpers/sensors-worker-world';

/**
 * The rows of the SYN tables and the TypeScript twin of their 25 CHECK constraints (build step 4 part 5).
 *
 * Decision 3 of the part 4 hand-off, option (a), approved: the writer judges every reading, every zone and every
 * rule the database would apply BEFORE the single atomic transaction, because a row that breaks a CHECK would undo the
 * sensors' rows with it. Three things can go wrong without anything failing loudly, and each has a block below:
 *
 *   1. The twin drifts from the migration (a CHECK added, renamed or loosened in the SQL and not here): the names are compared
 *      with the migration's, and the constants with `zone_params.yaml`.
 *   2. The twin accepts what the database refuses: a corpus of rows, each broken in one way, is fed to the twin here and
 *      to a real PostgreSQL in `sensors-synthesis.pg.spec.ts`; both must refuse the same rows under the same name.
 *   3. The mapping from the engine's result to the rows is wrong: the rows are compared with an independent mapping.
 */

const MIGRATION = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    '..',
    'prisma',
    'migrations',
    '20261004000000_add_synthesis_tables',
    'migration.sql'
  ),
  'utf8'
);
const checkNames = (table: string) =>
  [
    ...MIGRATION.matchAll(
      new RegExp(`ALTER TABLE "${table}" ADD CONSTRAINT "(\\w+)" CHECK`, 'g')
    ),
  ].map((m) => m[1]);

const validator = new SynReadingValidator();
const checkReading = (text: string) => validator.check(text);

// ---------------------------------------------------------------- the twin and the migration

describe('the twin of the CHECK constraints', () => {
  it('names exactly the constraints of the migration, table by table, in its order', () => {
    expect([...READING_CHECKS]).toEqual(checkNames('synthesis_readings'));
    expect([...ZONE_CHECKS]).toEqual(checkNames('entry_zones'));
    expect(READING_CHECKS.length + ZONE_CHECKS.length).toBe(25);
  });

  it('is exercised: every one of the 25 has a row in the corpus that only it is there to refuse', () => {
    const named = new Set(ROW_CASES.map((c) => c.constraint));
    for (const name of [...READING_CHECKS, ...ZONE_CHECKS])
      expect(named).toContain(name);
    expect(ROW_CASES.some((c) => c.constraint === null)).toBe(true);
  });

  describe.each(
    ROW_CASES.map((c): [string, RowCase] => [`${c.kind}: ${c.label}`, c])
  )('%s', (_label, c) => {
    const problems = () =>
      c.kind === 'reading'
        ? readingRowProblems(c.build() as unknown as SynthesisReadingRow)
        : zoneRowProblems(c.build() as unknown as EntryZoneRow);

    it(
      c.constraint === null
        ? 'is accepted'
        : `is refused, and ${c.constraint} is named`,
      () => {
        const found = problems();
        if (c.constraint === null) expect(found).toEqual([]);
        else {
          expect(found.length).toBeGreaterThan(0);
          expect(found.some((p) => p.startsWith(`${c.constraint}: `))).toBe(
            true
          );
          // every problem names a constraint of the table it is about
          const names: readonly string[] =
            c.kind === 'reading' ? READING_CHECKS : ZONE_CHECKS;
          for (const problem of found)
            expect(names).toContain(problem.split(': ')[0]);
        }
      }
    );
  });
});

// ---------------------------------------------------------------- the constants are decisions held in three places

describe('the constants of the twin are the migration’s and the zone parameters’ (a change is a new decision and a new migration)', () => {
  const params = fs.readFileSync(
    path.join(ENGINE_DIR, 'mcd_worker', 'synthesis', 'zone_params.yaml'),
    'utf8'
  );
  const parameter = (name: string): number => {
    const match = new RegExp(`^  ${name}:\\n    value: ([0-9.]+)`, 'm').exec(
      params
    );
    if (!match) throw new Error(`parameter ${name} not found`);
    return Number(match[1]);
  };

  it('zone_params.yaml min_stop_distance is the 13 the database refuses less than, and the twin’s', () => {
    expect(parameter('min_stop_distance')).toBe(13);
    expect(MIN_STOP_DISTANCE).toBe(parameter('min_stop_distance'));
    expect(MIGRATION).toContain(
      `CHECK ("stop_distance" >= ${parameter('min_stop_distance')})`
    );
  });

  it('zone_params.yaml max_zones is the 5 the database caps rank and zone_count at, and the twin’s', () => {
    expect(parameter('max_zones')).toBe(5);
    expect(MAX_ZONES).toBe(parameter('max_zones'));
    expect(MIGRATION).toContain(
      `"rank" BETWEEN 1 AND ${parameter('max_zones')}`
    );
    expect(MIGRATION).toContain(
      `CHECK ("zone_count" BETWEEN 0 AND ${parameter('max_zones')})`
    );
  });

  it('zone_params.yaml price_decimals is the cent grid whose half is the tolerance of the two distance checks', () => {
    const decimals = parameter('price_decimals');
    expect(decimals).toBe(2);
    expect(PRICE_TOLERANCE).toBeCloseTo(0.5 * 10 ** -decimals, 12);
    const uses = MIGRATION.match(/< 0[.]005/g) ?? [];
    expect(uses).toHaveLength(2);
  });

  it('the three invalidation words are the engine’s and the database’s', () => {
    const zones = fs.readFileSync(
      path.join(ENGINE_DIR, 'mcd_worker', 'synthesis', 'zones.py'),
      'utf8'
    );
    const python = [...zones.matchAll(/^BASIS_\w+ = "(\w+)"/gm)].map(
      (m) => m[1]
    );
    expect([...INVALIDATION_BASES].sort()).toEqual([...python].sort());
    for (const word of INVALIDATION_BASES)
      expect(MIGRATION).toContain(`'${word}'`);
  });

  it('the two trader types are the schema’s', () => {
    const profile = (
      synSchema.properties as unknown as { profile: { enum: string[] } }
    ).profile.enum;
    expect([...SYNTHESIS_PROFILES]).toEqual(profile);
  });
});

// ---------------------------------------------------------------- the rows made from the engine's result

const evaluatedAt = (slot: number) => slot + 31;

function prepared(
  fixtureIndex: number,
  change?: (
    section: ReturnType<typeof unitResultWithSynthesis>['synthesis']
  ) => void
) {
  const fixture = FIXTURE_SLOTS[fixtureIndex];
  const result = unitResultWithSynthesis(fixture, (section) =>
    change?.(section)
  );
  return {
    fixture,
    result,
    made: prepareSynthesis({
      symbol: 'XAUUSD',
      slot: fixture.slot,
      result,
      evaluatedAt: evaluatedAt(fixture.slot),
      checkReading,
    }),
  };
}

describe('prepareSynthesis on the three stored cycles', () => {
  it.each(FIXTURE_SLOTS.map((f, i) => [f.name, i] as const))(
    '%s: both readings and every zone, equal to an independent mapping of the stored files',
    (_name, index) => {
      const { fixture, result, made } = prepared(index);
      const ctx = contextOf(fixture);
      // the stub runner result hashes a stand-in bundle text; every other column is the stored file's
      const withHash = (row: Doc): Doc => ({
        ...row,
        inputs_sha256: result.inputs_sha256,
      });
      expect(made.ran).toBe(true);
      expect(made.refused).toEqual([]);
      expect(made.error).toBeNull();
      expect(made.readings).toEqual(
        ctx.synthesis.readings.map((r) =>
          withHash(storedReadingRow(ctx, r.profile))
        )
      );
      expect(made.zones).toEqual(
        ctx.synthesis.readings.flatMap((r) =>
          (JSON.parse(r.zones_json) as Doc[]).map((z) => zoneRowFrom(z))
        )
      );
    }
  );

  it('18 Sep gives 2 readings and 4 zones, 28 Sep 14:15 gives 2 readings and none, 28 Sep 23:15 gives 2 and 4', () => {
    const counts = FIXTURE_SLOTS.map((_, i) => {
      const { made } = prepared(i);
      return [made.readings.length, made.zones.length];
    });
    expect(counts).toEqual([
      [2, 4],
      [2, 0],
      [2, 4],
    ]);
  });

  it('a reading with no zones keeps its reason; a reading with zones has none', () => {
    const none = prepared(1).made.readings;
    expect(none.map((r) => [r.zone_count, r.zones_reason])).toEqual([
      [0, 'NO_ZONE_SOURCES'],
      [0, 'NO_ZONE_SOURCES'],
    ]);
    const some = prepared(0).made.readings;
    expect(some.map((r) => [r.zone_count, r.zones_reason])).toEqual([
      [2, null],
      [2, null],
    ]);
  });

  it('the rows carry the cycle’s identity: the slot as unix seconds, the bundle hash, RETUNING, the runner and the run', () => {
    const { fixture, result, made } = prepared(0);
    for (const row of made.readings) {
      expect(row.symbol).toBe('XAUUSD');
      expect(row.cycle_slot).toBe(fixture.slot);
      expect(row.flag).toBe('shadow');
      expect(row.inputs_sha256).toBe(result.inputs_sha256);
      expect([row.retuning_observed, row.retuning_applied]).toEqual([
        result.retuning.observed,
        result.retuning.applied,
      ]);
      expect(row.runner_version).toBe(result.runner_version);
      expect(row.python_version).toBe('3.11.9');
      expect(row.duration_ms).toBe(48.8);
      expect(row.evaluated_at).toBe(evaluatedAt(fixture.slot));
    }
    for (const row of made.zones) expect(row.cycle_slot).toBe(fixture.slot);
  });

  it('a live synthesis writes the flag live', () => {
    const { made } = prepared(0, (section) => {
      section!.flag = 'live';
    });
    expect(made.readings.map((r) => r.flag)).toEqual(['live', 'live']);
  });

  it('does not change the result it is given', () => {
    const fixture = FIXTURE_SLOTS[0];
    const result = unitResultWithSynthesis(fixture);
    const before = JSON.stringify(result);
    prepareSynthesis({
      symbol: 'XAUUSD',
      slot: fixture.slot,
      result,
      evaluatedAt: 1,
      checkReading,
    });
    expect(JSON.stringify(result)).toBe(before);
  });
});

describe('prepareSynthesis: what it leaves out', () => {
  it('a result with no synthesis section (the SYN flag is off) gives nothing and says it did not run', () => {
    const fixture = FIXTURE_SLOTS[0];
    const made = prepareSynthesis({
      symbol: 'XAUUSD',
      slot: fixture.slot,
      result: unitResult(fixture),
      evaluatedAt: 1,
      checkReading,
    });
    expect(made).toEqual({
      ran: false,
      readings: [],
      zones: [],
      refused: [],
      error: null,
    });
  });

  it('an engine error gives no rows and no refusal: the engine already said why', () => {
    const { made } = prepared(0, (section) => {
      section!.error = 'SYNTHESIS_ERROR';
      section!.readings = [];
    });
    expect(made).toMatchObject({
      ran: true,
      readings: [],
      zones: [],
      refused: [],
      error: 'SYNTHESIS_ERROR',
    });
  });

  it.each([
    ['no readings list', (s: Doc) => delete s['readings']],
    ['a flag that is off', (s: Doc) => (s['flag'] = 'off')],
    [
      'a text where the reference price should be',
      (s: Doc) => (s['reference_price'] = '4378.31'),
    ],
    [
      'a reading entry that is not an object',
      (s: Doc) => (s['readings'] = [1]),
    ],
    [
      'the same profile twice',
      (s: Doc) => (s['readings'] = [s['readings'][0], s['readings'][0]]),
    ],
  ])('a section with %s is refused whole, as ALL', (_label, damage) => {
    const { made } = prepared(0, (section) =>
      damage(section as unknown as Doc)
    );
    expect(made.readings).toEqual([]);
    expect(made.zones).toEqual([]);
    expect(made.refused).toHaveLength(1);
    expect(made.refused[0]).toMatchObject({
      profile: 'ALL',
      source: 'GATEWAY',
    });
  });

  it('a reading the engine withheld is left out as an ENGINE refusal with the engine’s problems; the other trader type is written', () => {
    const { made } = prepared(0, (section) => {
      const day = section!.readings[0];
      day.reading_json = null;
      day.reading_sha256 = null;
      day.guard_problems = ['SCHEMA: summary_line: too long'];
    });
    expect(made.readings.map((r) => r.profile)).toEqual(['SCALPER']);
    expect(made.zones.every((z) => z.profile === 'SCALPER')).toBe(true);
    expect(made.zones).toHaveLength(2);
    expect(made.refused).toEqual([
      {
        profile: 'DAY_TRADER',
        source: 'ENGINE',
        problems: [
          'DAY_TRADER: the engine withheld the reading',
          'SCHEMA: summary_line: too long',
        ],
      },
    ]);
  });

  const damages: Array<[string, (day: Doc, section: Doc) => void, RegExp]> = [
    [
      'a reading text that does not hash to its hash',
      (day) => (day['reading_sha256'] = 'f'.repeat(64)),
      /reading_json does not hash to reading_sha256/,
    ],
    [
      'a reading that breaks syn-output/1',
      (day) => {
        const doc = JSON.parse(day['reading_json']);
        doc['bias'] = 'UP';
        day['reading_json'] = JSON.stringify(doc);
        day['reading_sha256'] = sha256(day['reading_json']);
      },
      /DAY_TRADER: the reading breaks syn-output\/1: \/bias/,
    ],
    [
      'a reading for another slot',
      (day) => {
        const doc = JSON.parse(day['reading_json']);
        doc['cycle_slot'] = '2026-09-18T21:00Z';
        day['reading_json'] = JSON.stringify(doc);
        day['reading_sha256'] = sha256(day['reading_json']);
      },
      /the reading is for slot 2026-09-18T21:00Z, not 2026-09-18T20:55Z/,
    ],
    [
      'a reading for the other trader type',
      (day) => {
        const doc = JSON.parse(day['reading_json']);
        doc['profile'] = 'SCALPER';
        day['reading_json'] = JSON.stringify(doc);
        day['reading_sha256'] = sha256(day['reading_json']);
      },
      /the reading is for SCALPER/,
    ],
    [
      'a reading made with other rules than the section says',
      (day) => {
        const doc = JSON.parse(day['reading_json']);
        doc['rules_version'] = 'draft-2';
        day['reading_json'] = JSON.stringify(doc);
        day['reading_sha256'] = sha256(day['reading_json']);
      },
      /rules_version differs from the section's/,
    ],
    [
      'a reading made with other rules than the section says (checksum)',
      (day) => {
        const doc = JSON.parse(day['reading_json']);
        doc['rules_sha256'] = 'a'.repeat(64);
        day['reading_json'] = JSON.stringify(doc);
        day['reading_sha256'] = sha256(day['reading_json']);
      },
      /rules_sha256 differs from the section's/,
    ],
    [
      'a zone built with other parameters than the section says (version)',
      (day) => rewriteZones(day, (z) => (z['zones_version'] = 'zones-2')),
      /zones_version differs from the section's/,
    ],
    [
      'a zone text that does not hash to its hash',
      (day) => (day['zones_sha256'] = '0'.repeat(64)),
      /zones_json does not hash to zones_sha256/,
    ],
    [
      'a zone text that is not a list',
      (day) => {
        day['zones_json'] = '{"zones":[]}';
        day['zones_sha256'] = sha256(day['zones_json']);
      },
      /zones_json is not a list/,
    ],
    [
      'a zone of another slot',
      (day) =>
        rewriteZones(day, (z) => (z['cycle_slot'] = '2026-09-18T21:00Z')),
      /cycle_slot is not 2026-09-18T20:55Z/,
    ],
    [
      'a zone of the other trader type',
      (day) => rewriteZones(day, (z) => (z['profile'] = 'SCALPER')),
      /profile is not DAY_TRADER/,
    ],
    [
      'a zone built with other parameters than the section says',
      (day) => rewriteZones(day, (z) => (z['zones_sha256'] = 'a'.repeat(64))),
      /zones_sha256 differs from the section's/,
    ],
    [
      'a zone the reading does not name',
      (day) =>
        rewriteZones(day, (z) => ((z['zone_id'] = 'Z2'), (z['rank'] = 2)), 0),
      /the reading names Z1, the zone row is Z2/,
    ],
    [
      'a zone row with a text where a price should be',
      (day) => rewriteZones(day, (z) => (z['low'] = '4363.79')),
      /low must be a number/,
    ],
    [
      'a zone with a stop distance under 13, which the engine’s guard would not let through (the twin of the database CHECK is the last line)',
      (day) =>
        rewriteZones(day, (z) => {
          z['invalidation_price'] = Number(
            (z['reference_price'] - 12.99).toFixed(2)
          );
          z['stop_distance'] = 12.99;
        }),
      /entry_zones_stop_distance_is_at_least_13/,
    ],
    [
      'a trader type that does not exist',
      (day) => (day['profile'] = 'SWING'),
      /SWING: not a trader type/,
    ],
  ];

  it.each(damages)(
    '%s: that trader type is left out whole (reading and zones), the other is written, and the problem names it',
    (_label, damage, expected) => {
      const { made } = prepared(0, (section) => {
        const s = section as unknown as Doc;
        damage(s['readings'][0], s);
      });
      expect(made.refused).toHaveLength(1);
      expect(made.refused[0].source).toBe('GATEWAY');
      expect(made.refused[0].problems.join('\n')).toMatch(expected);
      expect(made.readings.map((r) => r.profile)).toEqual(['SCALPER']);
      expect(made.zones.map((z) => [z.profile, z.zone_id])).toEqual([
        ['SCALPER', 'Z1'],
        ['SCALPER', 'Z2'],
      ]);
    }
  );

  it('a reading with no zone and no reason for having none is refused by the twin (the schema cannot see the column)', () => {
    const { made } = prepared(1, (section) => {
      section!.readings[0].zones_reason = null;
    });
    expect(made.readings.map((r) => r.profile)).toEqual(['SCALPER']);
    expect(made.refused).toHaveLength(1);
    expect(made.refused[0].problems.join('\n')).toContain(
      'synthesis_readings_zones_reason_follows_the_count'
    );
  });

  it('a reading with zones and a reason for having none is refused by the twin', () => {
    const { made } = prepared(0, (section) => {
      section!.readings[0].zones_reason = 'NO_ZONE_SOURCES';
    });
    expect(made.readings.map((r) => r.profile)).toEqual(['SCALPER']);
    expect(made.refused[0].problems.join('\n')).toContain(
      'synthesis_readings_zones_reason_follows_the_count'
    );
  });

  it('an engine error is honoured even when readings are left in the section: nothing is written', () => {
    const { made } = prepared(0, (section) => {
      section!.error = 'SYNTHESIS_ERROR';
    });
    expect(made.readings).toEqual([]);
    expect(made.zones).toEqual([]);
    expect(made.error).toBe('SYNTHESIS_ERROR');
  });

  it('RETUNING observed and applied are the result’s, each its own', () => {
    const fixture = FIXTURE_SLOTS[0];
    const result = unitResultWithSynthesis(fixture);
    result.retuning = { observed: true, enforced: true, applied: false };
    const first = prepareSynthesis({
      symbol: 'XAUUSD',
      slot: fixture.slot,
      result,
      evaluatedAt: 1,
      checkReading,
    });
    expect(
      first.readings.map((r) => [r.retuning_observed, r.retuning_applied])
    ).toEqual([
      [true, false],
      [true, false],
    ]);
    result.retuning = { observed: true, enforced: true, applied: true };
    const second = prepareSynthesis({
      symbol: 'XAUUSD',
      slot: fixture.slot,
      result,
      evaluatedAt: 1,
      checkReading,
    });
    expect(
      second.readings.map((r) => [r.retuning_observed, r.retuning_applied])
    ).toEqual([
      [true, true],
      [true, true],
    ]);
  });

  it('both trader types refused leaves nothing, and two refusals', () => {
    const { made } = prepared(0, (section) => {
      for (const r of section!.readings) r.zones_sha256 = '0'.repeat(64);
    });
    expect(made.readings).toEqual([]);
    expect(made.zones).toEqual([]);
    expect(made.refused.map((r) => r.profile)).toEqual([
      'DAY_TRADER',
      'SCALPER',
    ]);
  });
});

/** Change the zone rows of a profile result and keep its text and hash consistent, so only the change is wrong. */
function rewriteZones(
  profile: Doc,
  change: (zone: Doc) => void,
  index?: number
): void {
  const zones = JSON.parse(profile['zones_json']) as Doc[];
  (index === undefined ? zones : [zones[index]]).forEach(change);
  profile['zones_json'] = JSON.stringify(zones);
  profile['zones_sha256'] = sha256(profile['zones_json']);
}
