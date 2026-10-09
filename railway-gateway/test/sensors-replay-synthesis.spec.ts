import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { SynthesisRunResult } from '../src/sensors/cycle-run-result';
import {
  CycleReplayReport,
  CycleReplayer,
  REPLAY_USAGE,
  ReplayCliOptions,
  StoredCycle,
  StoredSynthesisProfile,
  compareSynthesisProfile,
  formatReplayReport,
  loadFixtureCycle,
  loadStoredCycle,
  mcdIdsInWorkerConfig,
  replayWorkerConfig,
  rulesVersionInWorkerConfig,
  rulesVersionToAsk,
  runReplayCommand,
  storedSynthesisProblems,
} from '../src/sensors/replay';
import { slotToIso } from '../src/sensors/inputs/stats-slot';
import {
  ENGINE_DIR,
  FIXTURES_DIR,
  FIXTURE_SLOTS,
  FixtureSlot,
  readFixtureCycle,
} from './helpers/cycle-fixtures';
import {
  ENGINE_MCD_IDS,
  RecordingRunner,
  answering,
  asWrittenBy,
  fakeReplayDatabase,
  makeTempRoot,
  profileAsWrittenByRules,
  resultEqualTo,
  rowsOf,
  sectionOf,
  storedCycle,
  withProfile,
  withReading,
  withSynthesis,
  withTamperedText,
} from './helpers/replay-world';
import {
  outputOf,
  sha256,
  storedSynthesis,
  unitResultWithSynthesis,
} from './helpers/sensors-worker-world';

/**
 * Replay of the SYN readings and entry zones (build step 4 part 6): what is compared, and how the four answers are told apart for
 * a trader type's reading the way they are for an envelope. The fake runner stands in for Python wherever the question is about the
 * comparison; the last block runs the real engine, on the three stored cycles and on copies of the engine folder with another rules file.
 */

const [V1] = FIXTURE_SLOTS;
const PYTHON = process.env['SENSOR_PYTHON'] ?? 'python';
const SETTINGS = {
  python: PYTHON,
  engineDir: ENGINE_DIR,
  runnerTimeoutMs: 120_000,
};
const DAY = 'DAY_TRADER';
const SCALP = 'SCALPER';

const syn = (
  fixture: FixtureSlot = V1,
  form: 'database' | 'fixture' = 'database'
) => withSynthesis(storedCycle(fixture), fixture, form);
const profileOf = (cycle: StoredCycle, name: string): StoredSynthesisProfile =>
  (cycle.synthesis as { profiles: StoredSynthesisProfile[] }).profiles.find(
    (p) => p.profile === name
  ) as StoredSynthesisProfile;

/** A section with one trader type's reading text changed and its hash made to agree (a runner that is consistent with itself). */
function readingChanged(
  section: SynthesisRunResult,
  profile: string,
  change: (text: string) => string
): SynthesisRunResult {
  return {
    ...section,
    readings: section.readings.map((r) =>
      r.profile === profile
        ? {
            ...r,
            reading_json: change(r.reading_json as string),
            reading_sha256: sha256(change(r.reading_json as string)),
          }
        : r
    ),
  };
}

function zonesChanged(
  section: SynthesisRunResult,
  profile: string,
  change: (text: string) => string
): SynthesisRunResult {
  return {
    ...section,
    readings: section.readings.map((r) =>
      r.profile === profile
        ? {
            ...r,
            zones_json: change(r.zones_json),
            zones_sha256: sha256(change(r.zones_json)),
          }
        : r
    ),
  };
}

// ====================================================================== the configuration

describe('the worker configuration of a SYN replay', () => {
  const FOUR = new Map([
    ['MCD0', 'shadow'],
    ['MCD1', 'shadow'],
    ['MCD2', 'shadow'],
    ['MCD3', 'shadow'],
  ]);

  it('turns SYN on under the stored flag and names the stored rules version, with quoted values', () => {
    const text = replayWorkerConfig(ENGINE_MCD_IDS, FOUR, {
      flag: 'shadow',
      rulesVersion: 'draft-1',
    });
    expect(text).toBe(
      [
        'schema: mcd-worker-config/1',
        'flags:',
        "  MCD0: 'shadow'",
        "  MCD1: 'shadow'",
        "  MCD2: 'shadow'",
        "  MCD3: 'shadow'",
        "  SYN: 'shadow'",
        'synthesis:',
        "  rules_version: 'draft-1'",
        '',
      ].join('\n')
    );
    expect(mcdIdsInWorkerConfig(text)).toEqual(ENGINE_MCD_IDS);
  });

  it('writes the live flag as stored, and leaves the rules line out when no version is to be named', () => {
    const text = replayWorkerConfig(ENGINE_MCD_IDS, FOUR, {
      flag: 'live',
      rulesVersion: null,
    });
    expect(text).toContain("  SYN: 'live'");
    expect(text).not.toContain('synthesis:');
    expect(text).not.toContain('rules_version');
  });

  it('has no SYN line without synthesis: the replay of a cycle without SYN rows leaves synthesis off, as it always did', () => {
    const text = replayWorkerConfig(ENGINE_MCD_IDS, FOUR);
    expect(text).not.toContain('SYN');
    expect(text).toBe(replayWorkerConfig(ENGINE_MCD_IDS, FOUR, null));
  });

  it('doubles a quote inside a value, so a stored version cannot break out of the YAML string', () => {
    const text = replayWorkerConfig(ENGINE_MCD_IDS, FOUR, {
      flag: 'shadow',
      rulesVersion: "draft'1",
    });
    expect(text).toContain("  rules_version: 'draft''1'");
  });
});

describe('rulesVersionInWorkerConfig and rulesVersionToAsk', () => {
  it('reads the committed worker_config.yaml: draft-1', () => {
    const text = fs.readFileSync(
      path.join(ENGINE_DIR, 'mcd_worker', 'worker_config.yaml'),
      'utf8'
    );
    expect(rulesVersionInWorkerConfig(text)).toBe('draft-1');
  });

  it.each([
    ["synthesis:\n  rules_version: 'draft-2'\n", 'draft-2'],
    ['synthesis:\n  rules_version: "draft-3"  # a comment\n', 'draft-3'],
    ['synthesis:\r\n  rules_version: draft-4\r\n', 'draft-4'],
    ['flags:\n  MCD0: off\n', null],
    ['synthesis:\n  other: 1\n', null],
    ['other:\n  rules_version: draft-9\nsynthesis:\n  x: 1\n', null],
    ['synthesis:\n  rules_version:\nflags:\n  a: b\n', null],
    ['synthesis:\nflags:\n  rules_version: draft-9\n', null],
    ['', null],
  ])('%j gives %j', (text, expected) => {
    expect(rulesVersionInWorkerConfig(text)).toBe(expected);
  });

  it('asks for the stored version while the engine has its file, or when it cannot tell', () => {
    expect(
      rulesVersionToAsk('draft-1', {
        available: ['draft-1', 'draft-2'],
        current: 'draft-2',
      })
    ).toBe('draft-1');
    expect(
      rulesVersionToAsk('draft-1', { available: null, current: 'draft-2' })
    ).toBe('draft-1');
  });

  it('asks for the engine’s current version once the stored one’s file is gone, and for none when there is none', () => {
    expect(
      rulesVersionToAsk('draft-1', {
        available: ['draft-2'],
        current: 'draft-2',
      })
    ).toBe('draft-2');
    expect(
      rulesVersionToAsk('draft-1', { available: [], current: null })
    ).toBeNull();
  });
});

// ====================================================================== a stored SYN row on its own

describe('storedSynthesisProblems: a stored SYN row that disagrees with itself', () => {
  const problems = (
    change: (p: StoredSynthesisProfile) => StoredSynthesisProfile,
    slot = V1.slot
  ): string[] =>
    storedSynthesisProblems(change(profileOf(syn(V1), DAY)), 'XAUUSD', slot);
  const contains = (list: string[], text: string): boolean =>
    list.some((p) => p.includes(text));

  it.each(
    FIXTURE_SLOTS.flatMap((f) =>
      (['database', 'fixture'] as const).flatMap((form) =>
        [DAY, SCALP].map((profile) => [f.name, form, profile, f] as const)
      )
    )
  )(
    'the real stored rows agree with themselves: %s, %s, %s',
    (_n, form, profile, fixture) => {
      const row = profileOf(syn(fixture, form), profile);
      expect(storedSynthesisProblems(row, 'XAUUSD', fixture.slot)).toEqual([]);
    }
  );

  it('a fixture row has no zone_count and no entry_zones rows to hold the text to, and a database row does', () => {
    expect(profileOf(syn(V1, 'fixture'), DAY)).toMatchObject({
      zoneCount: null,
      zoneRows: null,
    });
    expect(profileOf(syn(V1), DAY)).toMatchObject({ zoneCount: 2 });
    expect(profileOf(syn(V1), DAY).zoneRows).toHaveLength(2);
  });

  it('a reading that does not hash to its own hash', () => {
    const list = problems((p) => ({
      ...p,
      readingJson: (p.readingJson as string).replace('LONG', 'LONGS'),
    }));
    expect(list).toContain(
      'reading_json does not hash to the stored reading_sha256'
    );
  });

  it('a reading that is not JSON, and one that is JSON and not an object', () => {
    expect(
      problems((p) => ({
        ...p,
        readingJson: 'nope',
        readingSha256: sha256('nope'),
      }))
    ).toEqual(['reading_json is not JSON']);
    expect(
      problems((p) => ({
        ...p,
        readingJson: '[]',
        readingSha256: sha256('[]'),
      }))
    ).toContain('reading_json is not an object');
  });

  it.each([
    ['another MCD', '"mcd_id":"SYN"', '"mcd_id":"MCD1"', 'the reading is MCD1'],
    [
      'the other trader type',
      '"profile":"DAY_TRADER"',
      '"profile":"SCALPER"',
      'the reading is for SCALPER',
    ],
  ])('a reading of %s under the same hash', (_n, from, to, message) => {
    const list = problems((p) => {
      const text = (p.readingJson as string).replace(from, to);
      expect(text).not.toBe(p.readingJson);
      return { ...p, readingJson: text, readingSha256: sha256(text) };
    });
    expect(list).toContain(message);
  });

  it('a reading for another slot', () => {
    expect(
      contains(
        problems((p) => p, V1.slot + 300),
        'the reading is for slot 2026-09-18T20:55Z'
      )
    ).toBe(true);
  });

  it('a rules version or rules hash column that is not the reading’s', () => {
    expect(problems((p) => ({ ...p, rulesVersion: 'draft-9' }))).toContain(
      "rules_version draft-9 is not the reading's draft-1"
    );
    expect(problems((p) => ({ ...p, rulesSha256: '0'.repeat(64) }))).toContain(
      "rules_sha256 is not the reading's"
    );
  });

  it('a reading hash with no reading text, and a withheld reading (a fixture) that is clean', () => {
    expect(
      problems((p) => ({ ...p, readingJson: null, readingSha256: 'abc' }))
    ).toContain('reading_sha256 is set and there is no reading text');
    expect(
      problems((p) => ({
        ...p,
        readingJson: null,
        readingSha256: null,
        zonesJson: '[]',
        zonesSha256: sha256('[]'),
        zoneCount: null,
        zoneRows: null,
      }))
    ).toEqual([]);
  });

  it('zones that do not hash to their own hash, and zones that are not a list', () => {
    expect(
      problems((p) => ({
        ...p,
        zonesJson: p.zonesJson.replace('4363.79', '4363.78'),
      }))
    ).toContain('zones_json does not hash to the stored zones_sha256');
    expect(
      problems((p) => ({ ...p, zonesJson: '{}', zonesSha256: sha256('{}') }))
    ).toContain('zones_json: zones_json is not a list');
  });

  it('a zone that carries other zone parameters than the row says', () => {
    const list = problems((p) => ({ ...p, zoneParamsVersion: 'zones-9' }));
    // every zone of the text carries the old parameters' identity, and is numbered from 1
    expect(list.map((p) => p.slice(0, p.indexOf(': zones_version')))).toEqual([
      'zones_json: zone 1',
      'zones_json: zone 2',
    ]);
  });

  it('a reading that names other zones than zones_json lists', () => {
    const list = problems((p) => {
      const zones = JSON.parse(p.zonesJson) as unknown[];
      const text = JSON.stringify([zones[0]]);
      return {
        ...p,
        zonesJson: text,
        zonesSha256: sha256(text),
        zoneCount: 1,
        zoneRows: (p.zoneRows as unknown[]).slice(0, 1) as never,
      };
    });
    expect(list).toContain(
      'the reading names zones ["Z1","Z2"], zones_json lists ["Z1"]'
    );
  });

  it('a zone_count that is not the number of zones', () => {
    expect(problems((p) => ({ ...p, zoneCount: 5 }))).toContain(
      'zone_count is 5 and zones_json lists 2'
    );
  });

  describe('the entry_zones rows against the zones_json beside the reading', () => {
    const rows = (p: StoredSynthesisProfile) =>
      p.zoneRows as NonNullable<StoredSynthesisProfile['zoneRows']>;

    it('a changed price', () => {
      const list = problems((p) => ({
        ...p,
        zoneRows: [{ ...rows(p)[0], low: rows(p)[0].low + 0.01 }, rows(p)[1]],
      }));
      expect(list).toHaveLength(1);
      expect(list[0]).toMatch(
        /^entry_zones: Z1 low is 4363\.8\d* in entry_zones and 4363\.79 in zones_json$/
      );
    });

    it('a zone that is in zones_json and not in the table, and one that is in the table and not in zones_json', () => {
      expect(
        problems((p) => ({ ...p, zoneRows: rows(p).slice(0, 1) }))
      ).toContain('entry_zones: Z2 is in zones_json and not in entry_zones');
      expect(
        problems((p) => ({
          ...p,
          zoneRows: [...rows(p), { ...rows(p)[1], zone_id: 'Z3', rank: 3 }],
        }))
      ).toContain('entry_zones: Z3 is in entry_zones and not in zones_json');
    });

    it('the audit document and the list of source sensors', () => {
      expect(
        problems((p) => ({
          ...p,
          zoneRows: [
            {
              ...rows(p)[0],
              levels: { ...(rows(p)[0].levels as object), extra: 1 },
            },
            rows(p)[1],
          ],
        }))
      ).toContain('entry_zones: Z1 levels differ from zones_json');
      expect(
        problems((p) => ({
          ...p,
          zoneRows: [{ ...rows(p)[0], source_sensors: ['MCD1'] }, rows(p)[1]],
        }))
      ).toContain('entry_zones: Z1 source_sensors differ from zones_json');
    });

    it.each([
      ['profile', 'SCALPER'],
      ['rank', 9],
      ['bias', 'SHORT'],
      ['low', 1],
      ['high', 2],
      ['reference_price', 3],
      ['confluence_count', 9],
      ['invalidation_price', 4],
      ['invalidation_basis', 'NO_LEVEL'],
      ['stop_distance', 5],
      ['next_opposing_price', 6],
      ['runway', 7],
      ['runway_ratio', 8],
      ['zone_params_version', 'zones-9'],
      ['zone_params_sha256', 'f'.repeat(64)],
    ])('a changed %s is found, named, and nothing else is', (key, value) => {
      const list = problems((p) => ({
        ...p,
        zoneRows: [{ ...rows(p)[0], [key]: value }, rows(p)[1]],
      }));
      expect(list).toHaveLength(1);
      expect(list[0]).toMatch(
        new RegExp(
          `^entry_zones: Z1 ${key} is .* in entry_zones and .* in zones_json$`
        )
      );
    });

    it('five differences are all listed and nothing is said to be more; six say one more', () => {
      const five = problems((p) => ({
        ...p,
        zoneRows: [
          {
            ...rows(p)[0],
            low: 1,
            high: 2,
            stop_distance: 3,
            rank: 9,
            bias: 'SHORT',
          },
          rows(p)[1],
        ],
      }));
      expect(five).toHaveLength(5);
      expect(five.some((d) => d.includes('more'))).toBe(false);
      const six = problems((p) => ({
        ...p,
        zoneRows: [
          {
            ...rows(p)[0],
            low: 1,
            high: 2,
            stop_distance: 3,
            rank: 9,
            bias: 'SHORT',
            confluence_count: 9,
          },
          rows(p)[1],
        ],
      }));
      expect(six).toHaveLength(6);
      expect(six[5]).toBe('entry_zones: and 1 more');
    });

    it('says the first five differences and how many more there are', () => {
      const list = problems((p) => ({
        ...p,
        zoneRows: [
          {
            ...rows(p)[0],
            low: 1,
            high: 2,
            stop_distance: 3,
            rank: 9,
            bias: 'SHORT',
            confluence_count: 9,
            invalidation_price: 1,
          },
          rows(p)[1],
        ],
      }));
      expect(list).toHaveLength(6);
      expect(list[5]).toBe('entry_zones: and 2 more');
    });
  });
});

// ====================================================================== one trader type against the replay

describe('compareSynthesisProfile: one stored SYN reading against what the replay gave', () => {
  const stored = (fixture = V1, name = DAY): StoredSynthesisProfile =>
    profileOf(syn(fixture), name);
  const section = (fixture = V1): SynthesisRunResult =>
    storedSynthesis(fixture);
  const compare = (
    s: SynthesisRunResult | undefined,
    sensors = { versionChanged: [] as string[], diverged: [] as string[] },
    row = stored()
  ) => compareSynthesisProfile(row, 'XAUUSD', V1.slot, s, sensors);

  it('is VERIFIED when reading, zones, reason, guard problems and reference price are equal, and says what it compared', () => {
    const r = compare(section());
    expect(r).toMatchObject({
      profile: DAY,
      verdict: 'VERIFIED',
      readingEqual: true,
      zonesEqual: true,
      difference: null,
      zoneCount: { stored: 2, replayed: 2 },
      storedRulesVersion: 'draft-1',
      replayedRulesVersion: 'draft-1',
      storedZoneParamsVersion: 'zones-1',
      replayedZoneParamsVersion: 'zones-1',
    });
    expect(r.storedReadingSha256).toBe(r.replayedReadingSha256);
    expect(r.storedZonesSha256).toBe(r.replayedZonesSha256);
    expect(r.detail).toMatch(
      /^reading text and SHA-256 equal \(\d+ characters\), 2 zone\(s\) text and SHA-256 equal$/
    );
  });

  it.each(FIXTURE_SLOTS.map((f) => [f.name, f] as const))(
    'both trader types of the real stored cycle are VERIFIED: %s',
    (_name, fixture) => {
      for (const name of [DAY, SCALP]) {
        expect(
          compareSynthesisProfile(
            stored(fixture, name),
            'XAUUSD',
            fixture.slot,
            section(fixture)
          ).verdict
        ).toBe('VERIFIED');
      }
    }
  );

  it('a fixture row (it has no zone_count column) counts its stored zones from the text', () => {
    const row = profileOf(syn(V1, 'fixture'), DAY);
    expect(row.zoneCount).toBeNull();
    expect(compare(section(), undefined, row).zoneCount).toEqual({
      stored: 2,
      replayed: 2,
    });
  });

  it('a stored row that disagrees with itself is not compared at all', () => {
    const row = {
      ...stored(),
      readingJson: (stored().readingJson as string).replace('LONG', 'LONGS'),
    };
    const r = compare(section(), undefined, row);
    expect(r).toMatchObject({
      verdict: 'STORED_READING_CORRUPT',
      readingEqual: null,
      zonesEqual: null,
      replayedReadingSha256: null,
    });
    expect(r.detail).toContain('the stored row disagrees with itself');
  });

  it('a replay without a synthesis section, with a section that says synthesis stopped, and without this trader type', () => {
    expect(compare(undefined)).toMatchObject({
      verdict: 'LOGIC_DIVERGENCE',
      detail:
        'the replay made no synthesis section, and DAY_TRADER has a stored reading',
    });
    expect(
      compare({ ...section(), error: 'SYNTHESIS_ERROR', readings: [] })
    ).toMatchObject({
      verdict: 'LOGIC_DIVERGENCE',
      replayedRulesVersion: 'draft-1',
      detail:
        'synthesis stopped in the replay (SYNTHESIS_ERROR) and made no reading, and DAY_TRADER has a stored one',
    });
    expect(
      compare({
        ...section(),
        readings: section().readings.filter((r) => r.profile !== DAY),
      }).detail
    ).toBe(
      'the replay produced no reading for DAY_TRADER, which has a stored one'
    );
  });

  describe('the answer is not "it differs": versions first', () => {
    it('another rules version is VERSION_MISMATCH, not a divergence', () => {
      const r = compare({
        ...section(),
        rules_version: 'draft-2',
        rules_sha256: 'f'.repeat(64),
      });
      expect(r).toMatchObject({
        verdict: 'VERSION_MISMATCH',
        replayedRulesVersion: 'draft-2',
        detail: 'the rules are draft-2 now, the reading was made with draft-1',
      });
    });

    it('other zone parameters’ version is VERSION_MISMATCH too, and both are said together', () => {
      expect(compare({ ...section(), zones_version: 'zones-2' }).detail).toBe(
        'the zone parameters are zones-2 now, the zones were made with zones-1'
      );
      expect(
        compare({
          ...section(),
          zones_version: 'zones-2',
          rules_version: 'draft-2',
        }).detail
      ).toBe(
        'the rules are draft-2 now, the reading was made with draft-1; the zone parameters are zones-2 now, the zones were made with zones-1'
      );
    });

    it('the same version and a rules file that hashes differently is a LOGIC_DIVERGENCE: the file changed without a new version', () => {
      const r = compare({ ...section(), rules_sha256: 'e'.repeat(64) });
      expect(r.verdict).toBe('LOGIC_DIVERGENCE');
      expect(r.detail).toContain('the rules draft-1 hash to');
      expect(r.detail).toContain(
        'the rules file changed without a new version'
      );
    });

    it('the same version and zone parameters that hash differently is a LOGIC_DIVERGENCE: zone_params.yaml changed without a new version', () => {
      const r = compare({ ...section(), zones_sha256: 'd'.repeat(64) });
      expect(r.verdict).toBe('LOGIC_DIVERGENCE');
      expect(r.detail).toContain(
        'zone_params.yaml changed without a new version'
      );
    });

    it('a runner whose reported hash is not the hash of its own text is a divergence, for the reading and for the zones', () => {
      const bad = section();
      bad.readings = bad.readings.map((r) =>
        r.profile === DAY
          ? {
              ...r,
              reading_sha256: '0'.repeat(64),
              zones_sha256: '1'.repeat(64),
            }
          : r
      );
      const r = compare(bad);
      expect(r.verdict).toBe('LOGIC_DIVERGENCE');
      expect(r.detail).toContain(
        `the runner reports reading_sha256 ${'0'.repeat(64)}`
      );
      expect(r.detail).toContain(
        `the runner reports zones_sha256 ${'1'.repeat(64)}`
      );
    });
  });

  describe('the same versions and another result', () => {
    it('another reading is a LOGIC_DIVERGENCE located in the reading, with the zones equal', () => {
      const r = compare(
        readingChanged(section(), DAY, (t) =>
          t.replace('"bias":"LONG"', '"bias":"SHORT"')
        )
      );
      expect(r).toMatchObject({
        verdict: 'LOGIC_DIVERGENCE',
        readingEqual: false,
        zonesEqual: true,
      });
      expect(r.difference).toMatchObject({ in: 'reading' });
      expect(r.difference?.stored).toContain('LONG');
      expect(r.difference?.replayed).toContain('SHORT');
      expect(r.detail).toBe(
        'the same rules draft-1 and zone parameters zones-1 gave another result: the reading text differs'
      );
    });

    it('other zones are a LOGIC_DIVERGENCE located in the zones, with the reading equal', () => {
      const r = compare(
        zonesChanged(section(), DAY, (t) => t.replace('"rank":1', '"rank":7'))
      );
      expect(r).toMatchObject({
        verdict: 'LOGIC_DIVERGENCE',
        readingEqual: true,
        zonesEqual: false,
      });
      expect(r.difference).toMatchObject({ in: 'zones' });
      expect(r.detail).toContain('the zones text differs');
    });

    it('another reason for having no zones, other guard problems and another reference price are each named', () => {
      const s = section();
      s.readings = s.readings.map((r) =>
        r.profile === DAY
          ? {
              ...r,
              zones_reason: 'NOT_DIRECTIONAL',
              guard_problems: ['ZONES: Z1: x'],
            }
          : r
      );
      s.reference_price = 4378.32;
      const r = compare(s);
      expect(r.verdict).toBe('LOGIC_DIVERGENCE');
      expect(r.detail).toContain(
        'zones_reason is NOT_DIRECTIONAL, stored null'
      );
      expect(r.detail).toContain('the guard problems differ');
      expect(r.detail).toContain(
        'the reference price is 4378.32, stored 4378.31'
      );
    });

    it('a reading the engine withheld on one side only is a divergence, and on both sides is the same', () => {
      const withheld = (
        row: StoredSynthesisProfile
      ): StoredSynthesisProfile => ({
        ...row,
        readingJson: null,
        readingSha256: null,
        zonesJson: '[]',
        zonesSha256: sha256('[]'),
        zonesReason: 'READING_REFUSED',
        zoneCount: null,
        zoneRows: null,
      });
      const s = section();
      s.readings = s.readings.map((r) =>
        r.profile === DAY
          ? {
              ...r,
              reading_json: null,
              reading_sha256: null,
              zones_json: '[]',
              zones_sha256: sha256('[]'),
              zones_reason: 'READING_REFUSED',
            }
          : r
      );
      expect(compare(s, undefined, withheld(stored()))).toMatchObject({
        verdict: 'VERIFIED',
        detail:
          'reading withheld on both sides, 0 zone(s) text and SHA-256 equal',
      });
      const one = compare(s);
      expect(one.verdict).toBe('LOGIC_DIVERGENCE');
      expect(one.detail).toContain('the reading is withheld on one side only');
      expect(one.difference).toMatchObject({ in: 'zones' });
    });
  });

  describe('a reading that reads the sensors follows them', () => {
    const changed = (): SynthesisRunResult =>
      readingChanged(section(), DAY, (t) =>
        t.replace('"bias":"LONG"', '"bias":"SHORT"')
      );

    it('a changed reading beside a sensor with another evaluator version is VERSION_MISMATCH, and names the sensor', () => {
      const r = compare(changed(), {
        versionChanged: ['MCD1', 'MCD2'],
        diverged: [],
      });
      expect(r.verdict).toBe('VERSION_MISMATCH');
      expect(r.detail).toContain(
        'MCD1, MCD2 answer with another evaluator version now'
      );
      expect(r.detail).toContain('the reading text differs');
    });

    it('one sensor reads as "answers" and a reading that did not change stays VERIFIED beside a changed sensor', () => {
      expect(
        compare(changed(), { versionChanged: ['MCD1'], diverged: [] }).detail
      ).toContain('MCD1 answers with another evaluator version now');
      expect(
        compare(section(), { versionChanged: ['MCD1'], diverged: [] }).verdict
      ).toBe('VERIFIED');
    });

    it('a changed reading beside a diverged sensor is a LOGIC_DIVERGENCE that says so', () => {
      const r = compare(changed(), { versionChanged: [], diverged: ['MCD2'] });
      expect(r.verdict).toBe('LOGIC_DIVERGENCE');
      expect(r.detail).toContain(
        '(MCD2 diverged too, and synthesis reads their readings)'
      );
    });
  });
});

// ====================================================================== the cycle, on a fake runner

describe('CycleReplayer with SYN rows on a fake runner', () => {
  let tempRoot: string;
  beforeEach(() => {
    tempRoot = makeTempRoot();
  });
  afterEach(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const engine = {
    available: ['draft-1'] as string[] | null,
    current: 'draft-1' as string | null,
  };
  const replayer = (runner: RecordingRunner, rules = engine) =>
    new CycleReplayer(
      SETTINGS,
      runner.hooks(tempRoot, { rulesVersions: () => rules })
    );

  describe('a deterministic cycle', () => {
    it.each(FIXTURE_SLOTS.map((f) => [f.name, f] as const))(
      'is VERIFIED with both trader types and their zones, and says so: %s',
      async (_name, fixture) => {
        const stored = syn(fixture);
        const runner = answering(resultEqualTo(stored, fixture));
        const report = await replayer(runner).replay(stored);
        const zones = stored.synthesis!.profiles.reduce(
          (n, p) => n + (p.zoneCount ?? 0),
          0
        );

        expect(report.verdict).toBe('VERIFIED');
        expect(report.summary).toBe(
          `4 of 4 readings equal the stored ones, envelope text and SHA-256, byte for byte; 2 of 2 SYN readings and their ${zones} entry zone(s) equal the stored ones, text and SHA-256, byte for byte`
        );
        expect(report.synthesis).toMatchObject({
          state: 'REPLAYED',
          flag: 'shadow',
          rulesVersion: {
            stored: 'draft-1',
            requested: 'draft-1',
            replayed: 'draft-1',
          },
          notStored: [],
          withheld: [],
          zones: { stored: zones, replayed: zones },
        });
        expect(
          report.synthesis.profiles.map((p) => [p.profile, p.verdict])
        ).toEqual([
          [DAY, 'VERIFIED'],
          [SCALP, 'VERIFIED'],
        ]);
        expect(report.findings).toEqual([]);
      }
    );

    it('runs the sensors and synthesis under the stored flags and the stored rules version, and the configuration says so', async () => {
      const stored = syn(V1);
      const runner = answering(resultEqualTo(stored, V1));
      await replayer(runner).replay(stored);
      expect(runner.starts[0].config).toBe(
        [
          'schema: mcd-worker-config/1',
          'flags:',
          "  MCD0: 'shadow'",
          "  MCD1: 'shadow'",
          "  MCD2: 'shadow'",
          "  MCD3: 'shadow'",
          "  SYN: 'shadow'",
          'synthesis:',
          "  rules_version: 'draft-1'",
          '',
        ].join('\n')
      );
    });

    it('a live SYN flag on the rows is a live SYN flag in the replay', async () => {
      let stored = syn(V1);
      stored = withProfile(stored, DAY, (p) => ({ ...p, flag: 'live' }));
      stored = withProfile(stored, SCALP, (p) => ({ ...p, flag: 'live' }));
      const runner = answering(
        resultEqualTo(stored, V1, {
          synthesis: sectionOf(stored.synthesis!, { flag: 'live' }),
        })
      );
      const report = await replayer(runner).replay(stored);
      expect(runner.starts[0].config).toContain("  SYN: 'live'");
      expect(report.synthesis.flag).toBe('live');
      expect(report.verdict).toBe('VERIFIED');
    });

    it('a cycle without SYN rows is replayed with SYN off: no SYN line, no synthesis block, the summary of old', async () => {
      const stored = storedCycle(V1);
      const runner = answering(resultEqualTo(stored, V1));
      const report = await replayer(runner).replay(stored);
      expect(runner.starts[0].config).not.toContain('SYN');
      expect(runner.starts[0].config).not.toContain('synthesis');
      expect(report.synthesis).toMatchObject({
        state: 'NOT_STORED',
        profiles: [],
        flag: null,
      });
      expect(report.summary).toBe(
        '4 of 4 readings equal the stored ones, envelope text and SHA-256, byte for byte'
      );
    });

    it('asks the engine’s own folder which rules it has when no hook says (the real engine has draft-1)', async () => {
      const stored = syn(V1);
      const runner = answering(resultEqualTo(stored, V1));
      const report = await new CycleReplayer(
        SETTINGS,
        runner.hooks(tempRoot)
      ).replay(stored);
      expect(report.synthesis.rulesVersion.requested).toBe('draft-1');
    });
  });

  describe('(c) a rules version that is not the one that wrote the row', () => {
    const draft2 = (stored: StoredCycle): SynthesisRunResult => ({
      ...sectionOf(stored.synthesis!),
      rules_version: 'draft-2',
      rules_sha256: '2'.repeat(64),
    });

    it('draft-1 is gone and draft-2 is current: the replay asks for draft-2, and every trader type is a VERSION_MISMATCH, not a defect', async () => {
      const stored = syn(V1);
      const runner = answering(
        resultEqualTo(stored, V1, { synthesis: draft2(stored) })
      );
      const report = await replayer(runner, {
        available: ['draft-2'],
        current: 'draft-2',
      }).replay(stored);

      expect(runner.starts[0].config).toContain("  rules_version: 'draft-2'");
      expect(report.verdict).toBe('VERSION_MISMATCH');
      expect(report.synthesis.rulesVersion).toEqual({
        stored: 'draft-1',
        requested: 'draft-2',
        replayed: 'draft-2',
      });
      expect(report.synthesis.profiles.map((p) => p.verdict)).toEqual([
        'VERSION_MISMATCH',
        'VERSION_MISMATCH',
      ]);
      expect(report.mcds.every((m) => m.verdict === 'VERIFIED')).toBe(true);
      expect(report.summary).toContain(
        'SYN DAY_TRADER: the rules are draft-2 now, the reading was made with draft-1'
      );
    });

    it('draft-2 is deployed and draft-1 is still there: the replay asks for the stored draft-1 and the cycle is VERIFIED', async () => {
      const stored = syn(V1);
      const runner = answering(resultEqualTo(stored, V1));
      const report = await replayer(runner, {
        available: ['draft-1', 'draft-2'],
        current: 'draft-2',
      }).replay(stored);
      expect(runner.starts[0].config).toContain("  rules_version: 'draft-1'");
      expect(report.verdict).toBe('VERIFIED');
      expect(report.synthesis.rulesVersion.requested).toBe('draft-1');
    });

    it('rows written by an older rules version, whose file is gone, replay as VERSION_MISMATCH against the version that answers', async () => {
      let stored = syn(V1);
      for (const name of [DAY, SCALP])
        stored = withProfile(stored, name, (p) =>
          profileAsWrittenByRules(p, 'draft-0')
        );
      expect(profileOf(stored, DAY).rulesVersion).toBe('draft-0');
      expect(
        storedSynthesisProblems(profileOf(stored, DAY), 'XAUUSD', V1.slot)
      ).toEqual([]);
      const runner = answering(resultEqualTo(syn(V1), V1));
      const report = await replayer(runner, {
        available: ['draft-1'],
        current: 'draft-1',
      }).replay(stored);
      // draft-0 is not in the engine: the replay asks for the engine's own version instead
      expect(runner.starts[0].config).toContain("  rules_version: 'draft-1'");
      expect(report.synthesis.rulesVersion).toEqual({
        stored: 'draft-0',
        requested: 'draft-1',
        replayed: 'draft-1',
      });
      expect(
        report.synthesis.profiles.map((p) => [p.profile, p.verdict])
      ).toEqual([
        [DAY, 'VERSION_MISMATCH'],
        [SCALP, 'VERSION_MISMATCH'],
      ]);
      expect(report.verdict).toBe('VERSION_MISMATCH');
    });
  });

  describe('tampering, a rules-version change and a rules file edited under the same version are three different verdicts', () => {
    it('a tampered bundle is TAMPERED_BUNDLE and nothing is run', async () => {
      const stored = withTamperedText(syn(V1));
      const runner = answering(resultEqualTo(syn(V1), V1));
      const report = await replayer(runner).replay(stored);
      expect(report).toMatchObject({
        verdict: 'TAMPERED_BUNDLE',
        tamperReason: 'HASH',
      });
      expect(runner.requests).toEqual([]);
      expect(report.synthesis).toMatchObject({ state: 'STORED', profiles: [] });
    });

    it('a rules version that changed is VERSION_MISMATCH', async () => {
      const stored = syn(V1);
      const section = {
        ...sectionOf(stored.synthesis!),
        rules_version: 'draft-2',
        rules_sha256: '2'.repeat(64),
      };
      const report = await replayer(
        answering(resultEqualTo(stored, V1, { synthesis: section }))
      ).replay(stored);
      expect(report.verdict).toBe('VERSION_MISMATCH');
    });

    it('a rules file edited without a new version is LOGIC_DIVERGENCE', async () => {
      const stored = syn(V1);
      const section = {
        ...sectionOf(stored.synthesis!),
        rules_sha256: '2'.repeat(64),
      };
      const report = await replayer(
        answering(resultEqualTo(stored, V1, { synthesis: section }))
      ).replay(stored);
      expect(report.verdict).toBe('LOGIC_DIVERGENCE');
      expect(report.summary).toContain(
        'the rules file changed without a new version'
      );
    });

    it('another reading from the same rules is LOGIC_DIVERGENCE, located by trader type', async () => {
      const stored = syn(V1);
      const section = readingChanged(sectionOf(stored.synthesis!), SCALP, (t) =>
        t.replace('"bias":"LONG"', '"bias":"SHORT"')
      );
      const report = await replayer(
        answering(resultEqualTo(stored, V1, { synthesis: section }))
      ).replay(stored);
      expect(report.verdict).toBe('LOGIC_DIVERGENCE');
      expect(
        report.synthesis.profiles.map((p) => [p.profile, p.verdict])
      ).toEqual([
        [DAY, 'VERIFIED'],
        [SCALP, 'LOGIC_DIVERGENCE'],
      ]);
      expect(report.summary).toContain('SYN SCALPER:');
    });

    it('the order of the verdicts: a corrupt row outranks a version change, which outranks a divergence', async () => {
      // SCALPER diverges, DAY_TRADER has another rules version: VERSION_MISMATCH is the cycle's answer
      const stored = syn(V1);
      const section = readingChanged(sectionOf(stored.synthesis!), SCALP, (t) =>
        t.replace('"bias":"LONG"', '"bias":"SHORT"')
      );
      const mixed = { ...section, rules_version: 'draft-2' };
      const both = await replayer(
        answering(resultEqualTo(stored, V1, { synthesis: mixed }))
      ).replay(stored);
      expect(both.verdict).toBe('VERSION_MISMATCH');
      // a corrupt stored row beats both
      const corrupt = withProfile(stored, DAY, (p) => ({
        ...p,
        readingJson: (p.readingJson as string).replace('LONG', 'LONGS'),
      }));
      const worst = await replayer(
        answering(resultEqualTo(corrupt, V1, { synthesis: mixed }))
      ).replay(corrupt);
      expect(worst.verdict).toBe('STORED_READING_CORRUPT');
    });
  });

  describe('(c) a sensor that answers with another evaluator version', () => {
    it('a changed SYN reading beside it is VERSION_MISMATCH for the reading as well, with the sensor named', async () => {
      let stored = syn(V1);
      stored = withReading(stored, 'MCD1', (r) => asWrittenBy(r, '2.0.0'));
      const section = readingChanged(sectionOf(stored.synthesis!), DAY, (t) =>
        t.replace('"bias":"LONG"', '"bias":"SHORT"')
      );
      const report = await replayer(
        answering(resultEqualTo(stored, V1, { synthesis: section }))
      ).replay(stored);
      expect(report.verdict).toBe('VERSION_MISMATCH');
      expect(report.mcds.find((m) => m.mcdId === 'MCD1')?.verdict).toBe(
        'VERSION_MISMATCH'
      );
      const day = report.synthesis.profiles.find((p) => p.profile === DAY)!;
      expect(day.verdict).toBe('VERSION_MISMATCH');
      expect(day.detail).toContain(
        'MCD1 answers with another evaluator version now'
      );
    });

    it('an unchanged SYN reading beside a changed sensor is still VERIFIED, and the cycle is the sensor’s VERSION_MISMATCH alone', async () => {
      const stored = withReading(syn(V1), 'MCD1', (r) =>
        asWrittenBy(r, '2.0.0')
      );
      const report = await replayer(
        answering(resultEqualTo(stored, V1))
      ).replay(stored);
      expect(report.verdict).toBe('VERSION_MISMATCH');
      expect(
        report.synthesis.profiles.every((p) => p.verdict === 'VERIFIED')
      ).toBe(true);
    });
  });

  describe('a SYN row that disagrees with itself, or with the table beside it', () => {
    it('a reading that does not hash to its hash is STORED_READING_CORRUPT for the cycle, and the runner still ran', async () => {
      const stored = withProfile(syn(V1), DAY, (p) => ({
        ...p,
        readingJson: (p.readingJson as string).replace('LONG', 'LONGS'),
      }));
      const runner = answering(resultEqualTo(stored, V1));
      const report = await replayer(runner).replay(stored);
      expect(report.verdict).toBe('STORED_READING_CORRUPT');
      expect(report.summary).toContain(
        'SYN DAY_TRADER: the stored row disagrees with itself'
      );
      expect(runner.requests).toHaveLength(1);
    });

    it('an entry_zones row that is not what zones_json says is STORED_READING_CORRUPT', async () => {
      const stored = withProfile(syn(V1), DAY, (p) => ({
        ...p,
        zoneRows: [
          { ...p.zoneRows![0], high: p.zoneRows![0].high + 1 },
          p.zoneRows![1],
        ],
      }));
      const report = await replayer(
        answering(resultEqualTo(stored, V1))
      ).replay(stored);
      expect(report.verdict).toBe('STORED_READING_CORRUPT');
      expect(report.synthesis.profiles[0].detail).toContain(
        'entry_zones: Z1 high is'
      );
    });

    it('entry_zones rows and no synthesis_readings row at all are STORED_READING_CORRUPT too, for each trader type that has zones', async () => {
      const full = syn(V1);
      const orphaned: StoredCycle = {
        ...full,
        synthesis: {
          error: null,
          profiles: [],
          orphanZones: full.synthesis!.profiles.flatMap((p) => p.zoneRows!),
        },
      };
      const runner = answering(resultEqualTo(orphaned, V1));
      const report = await replayer(runner).replay(orphaned);
      expect(report.verdict).toBe('STORED_READING_CORRUPT');
      expect(report.synthesis.state).toBe('REPLAYED');
      expect(
        report.synthesis.profiles.map((p) => [p.profile, p.verdict])
      ).toEqual([
        [DAY, 'STORED_READING_CORRUPT'],
        [SCALP, 'STORED_READING_CORRUPT'],
      ]);
      // nothing to run SYN for: the configuration has no SYN line
      expect(runner.starts[0].config).not.toContain('SYN');
    });

    it('entry_zones rows of a trader type that has no synthesis_readings row are STORED_READING_CORRUPT', async () => {
      const stored = syn(V1);
      const scalper = profileOf(stored, SCALP);
      const orphaned: StoredCycle = {
        ...stored,
        synthesis: {
          error: null,
          profiles: stored.synthesis!.profiles.filter((p) => p.profile === DAY),
          orphanZones: scalper.zoneRows!,
        },
      };
      const report = await replayer(
        answering(resultEqualTo(orphaned, V1))
      ).replay(orphaned);
      expect(report.verdict).toBe('STORED_READING_CORRUPT');
      const orphan = report.synthesis.profiles.find(
        (p) => p.profile === SCALP
      )!;
      expect(orphan.verdict).toBe('STORED_READING_CORRUPT');
      expect(orphan.detail).toBe(
        'entry_zones holds 2 row(s) for SCALPER and synthesis_readings has no row for it'
      );
    });
  });

  describe('a SYN row that names other inputs, or was made under other settings', () => {
    it('a SYN row made from another bundle is TAMPERED_BUNDLE (the readings name other inputs), and the SYN row is named', async () => {
      const stored = withProfile(syn(V1), DAY, (p) => ({
        ...p,
        inputsSha256: 'f'.repeat(64),
      }));
      const runner = answering(resultEqualTo(syn(V1), V1));
      const report = await replayer(runner).replay(stored);
      expect(report).toMatchObject({
        verdict: 'TAMPERED_BUNDLE',
        tamperReason: 'READINGS_NAME_OTHER_INPUTS',
      });
      expect(report.summary).toContain('SYN DAY_TRADER was made from inputs');
      expect(runner.requests).toEqual([]);
    });

    it('a SYN row made under other RETUNING enforcement than the sensors’ is MIXED_RETUNING, and the SYN row is named', async () => {
      const stored = withProfile(syn(V1), SCALP, (p) => ({
        ...p,
        retuningApplied: true,
      }));
      const runner = answering(resultEqualTo(syn(V1), V1));
      const report = await replayer(runner).replay(stored);
      expect(report).toMatchObject({
        verdict: 'NOT_REPLAYABLE',
        cause: 'MIXED_RETUNING',
      });
      expect(report.summary).toContain('SYN SCALPER applied true');
      expect(runner.requests).toEqual([]);
    });

    it.each([
      ['flags', (p: StoredSynthesisProfile) => ({ ...p, flag: 'live' })],
      [
        'rules versions',
        (p: StoredSynthesisProfile) => ({ ...p, rulesVersion: 'draft-2' }),
      ],
      [
        'zone parameters',
        (p: StoredSynthesisProfile) => ({ ...p, zoneParamsVersion: 'zones-2' }),
      ],
    ])(
      'trader types made under different %s are NOT_REPLAYABLE (MIXED_SYNTHESIS): one run cannot reproduce both',
      async (_what, change) => {
        const stored = withProfile(syn(V1), SCALP, change);
        const runner = answering(resultEqualTo(syn(V1), V1));
        const report = await replayer(runner).replay(stored);
        expect(report).toMatchObject({
          verdict: 'NOT_REPLAYABLE',
          cause: 'MIXED_SYNTHESIS',
        });
        expect(report.summary).toContain(
          'DAY_TRADER: shadow, rules draft-1, zones zones-1'
        );
        expect(runner.requests).toEqual([]);
      }
    );
  });

  describe('what the replay makes that nothing stored', () => {
    it('a trader type with no stored row that the replay makes a reading for is a note, not a verdict (the gateway refused it, or the row is gone)', async () => {
      const full = syn(V1);
      const stored: StoredCycle = {
        ...full,
        synthesis: {
          error: null,
          profiles: full.synthesis!.profiles.filter((p) => p.profile === DAY),
          orphanZones: [],
        },
      };
      const runner = answering(resultEqualTo(full, V1));
      const report = await replayer(runner).replay(stored);
      expect(report.verdict).toBe('VERIFIED');
      expect(report.synthesis.notStored).toEqual([SCALP]);
      expect(report.synthesis.zones).toEqual({ stored: 2, replayed: 2 });
      expect(report.summary).toContain(
        '1 of 1 SYN readings and their 2 entry zone(s)'
      );
      expect(report.findings[0]).toContain(
        'the replay makes a SYN reading for SCALPER and none is stored'
      );
      expect(report.findings[0]).toContain('SYN_READING_REFUSED');
    });

    it('a trader type the replay withholds (its guard) and nothing stores agree: listed, no note', async () => {
      const full = syn(V1);
      const stored: StoredCycle = {
        ...full,
        synthesis: {
          error: null,
          profiles: full.synthesis!.profiles.filter((p) => p.profile === DAY),
          orphanZones: [],
        },
      };
      const section = sectionOf(full.synthesis!);
      section.readings = section.readings.map((r) =>
        r.profile === SCALP
          ? {
              ...r,
              reading_json: null,
              reading_sha256: null,
              zones_json: '[]',
              zones_sha256: sha256('[]'),
              zones_reason: 'READING_REFUSED',
            }
          : r
      );
      const report = await replayer(
        answering(resultEqualTo(full, V1, { synthesis: section }))
      ).replay(stored);
      expect(report.verdict).toBe('VERIFIED');
      expect(report.synthesis).toMatchObject({
        withheld: [SCALP],
        notStored: [],
      });
      expect(report.findings).toEqual([]);
    });
  });

  describe('the replay that makes no SYN reading', () => {
    it('a runner result without a synthesis section, where SYN rows are stored, is LOGIC_DIVERGENCE for each trader type', async () => {
      const stored = syn(V1);
      const report = await replayer(
        answering(resultEqualTo(storedCycle(V1), V1))
      ).replay(stored);
      expect(report.verdict).toBe('LOGIC_DIVERGENCE');
      expect(report.synthesis.profiles.map((p) => p.verdict)).toEqual([
        'LOGIC_DIVERGENCE',
        'LOGIC_DIVERGENCE',
      ]);
      expect(report.synthesis.rulesVersion.replayed).toBeNull();
    });

    it('a section that says synthesis stopped is LOGIC_DIVERGENCE too', async () => {
      const stored = syn(V1);
      const section = {
        ...sectionOf(stored.synthesis!),
        error: 'SYNTHESIS_ERROR',
        readings: [],
      };
      const report = await replayer(
        answering(resultEqualTo(stored, V1, { synthesis: section }))
      ).replay(stored);
      expect(report.verdict).toBe('LOGIC_DIVERGENCE');
      expect(report.summary).toContain(
        'synthesis stopped in the replay (SYNTHESIS_ERROR)'
      );
    });
  });

  describe('when there is nothing to compare', () => {
    it('a database without the SYN tables is replayed as before, with a note that says why no SYN row was looked for', async () => {
      const stored: StoredCycle = {
        ...storedCycle(V1),
        synthesisTablesMissing: true,
      };
      const runner = answering(resultEqualTo(stored, V1));
      const report = await replayer(runner).replay(stored);
      expect(report.verdict).toBe('VERIFIED');
      expect(report.synthesis.state).toBe('TABLES_MISSING');
      expect(report.findings).toHaveLength(1);
      expect(report.findings[0]).toContain(
        '20261004000000_add_synthesis_tables is not applied'
      );
      expect(runner.starts[0].config).not.toContain('SYN');
    });

    it('a fixture that records that synthesis stopped has nothing to compare: noted, and replayed with SYN off', async () => {
      const stored: StoredCycle = {
        ...storedCycle(V1),
        synthesis: { error: 'SYNTHESIS_ERROR', profiles: [], orphanZones: [] },
      };
      const runner = answering(resultEqualTo(stored, V1));
      const report = await replayer(runner).replay(stored);
      expect(report.verdict).toBe('VERIFIED');
      expect(report.synthesis.state).toBe('NOT_STORED');
      expect(report.findings[0]).toContain(
        'records that synthesis stopped (SYNTHESIS_ERROR)'
      );
      expect(runner.starts[0].config).not.toContain('SYN');
    });

    it('a cycle that cannot be replayed says its SYN rows are stored and not compared', async () => {
      const stored: StoredCycle = { ...syn(V1), bundle: null };
      const report = await replayer(
        answering(resultEqualTo(syn(V1), V1))
      ).replay(stored);
      expect(report).toMatchObject({
        verdict: 'NOT_REPLAYABLE',
        cause: 'NO_STORED_BUNDLE',
      });
      expect(report.synthesis).toMatchObject({
        state: 'STORED',
        flag: 'shadow',
        profiles: [],
      });
    });
  });

  describe('the text of the report', () => {
    const textOfReport = async (
      change: (s: StoredCycle) => [StoredCycle, SynthesisRunResult?]
    ): Promise<string> => {
      const [stored, section] = change(syn(V1));
      const result = resultEqualTo(
        stored,
        V1,
        section === undefined ? {} : { synthesis: section }
      );
      return formatReplayReport(
        await replayer(answering(result)).replay(stored)
      );
    };

    it('names the SYN flag, rules and zones, and each trader type with its hashes', async () => {
      const text = await textOfReport((s) => [s]);
      expect(text).toContain(
        'SYN   shadow flag, rules draft-1, 4 entry zone(s) stored'
      );
      expect(text).toMatch(
        /SYN DAY_TRADER {1,2}VERIFIED +reading sha256 stored [0-9a-f]{16}… replayed [0-9a-f]{16}… +zones 2 sha256 stored [0-9a-f]{16}… replayed [0-9a-f]{16}…/
      );
      expect(text).toMatch(/SYN SCALPER +VERIFIED/);
    });

    it('prints a rules version that changed as stored -> replayed, and where a reading first differs', async () => {
      const version = await textOfReport((s) => [
        s,
        { ...sectionOf(s.synthesis!), rules_version: 'draft-2' },
      ]);
      expect(version).toContain(
        'SYN   shadow flag, rules draft-1 -> draft-2, 4 entry zone(s) stored'
      );
      expect(version).toContain(
        'the rules are draft-2 now, the reading was made with draft-1'
      );
      const diverged = await textOfReport((s) => [
        s,
        readingChanged(sectionOf(s.synthesis!), DAY, (t) =>
          t.replace('"bias":"LONG"', '"bias":"SHORT"')
        ),
      ]);
      expect(diverged).toContain(
        'first difference in the reading at character'
      );
      expect(diverged).toContain('LOGIC_DIVERGENCE');
    });

    it('lists a trader type the engine withheld, and says nothing about SYN for a cycle without SYN rows', async () => {
      const none = formatReplayReport(
        await replayer(answering(resultEqualTo(storedCycle(V1), V1))).replay(
          storedCycle(V1)
        )
      );
      expect(none).not.toContain('SYN');
    });
  });

  it('deletes its temporary configuration when it is done, SYN or not', async () => {
    const stored = syn(V1);
    await replayer(answering(resultEqualTo(stored, V1))).replay(stored);
    expect(fs.readdirSync(tempRoot)).toEqual([]);
  });

  it('JSON carries the SYN part of the report', async () => {
    const stored = syn(V1);
    const report = await replayer(answering(resultEqualTo(stored, V1))).replay(
      stored
    );
    const parsed = JSON.parse(JSON.stringify(report)) as CycleReplayReport;
    expect(parsed.synthesis.profiles.map((p) => p.profile)).toEqual([
      DAY,
      SCALP,
    ]);
    expect(parsed.synthesis.profiles[0]).toMatchObject({
      verdict: 'VERIFIED',
      readingEqual: true,
      zonesEqual: true,
      difference: null,
    });
  });
});

// ====================================================================== reading what is stored

describe('loadStoredCycle: the two SYN tables, read with a select', () => {
  const stored = () => syn(V1);

  it('maps the reading rows and their zone rows, sorts the trader types and the zones, and asks for no more columns than it uses', async () => {
    const { input, outputs, synthesis, zones } = rowsOf(stored());
    const db = fakeReplayDatabase(input, outputs, {
      synthesis: [...synthesis].reverse(),
      zones: [...zones].reverse(),
    });
    const loaded = await loadStoredCycle(db.database, 'XAUUSD', V1.slot);

    expect(loaded).toEqual(stored());
    expect(loaded.synthesisTablesMissing).toBe(false);
    expect(db.findSynthesis).toHaveBeenCalledTimes(1);
    const reading = db.findSynthesis.mock.calls[0][0];
    expect(reading.where).toEqual({ symbol: 'XAUUSD', cycle_slot: V1.slot });
    expect(Object.keys(reading.select).sort()).toEqual(
      [
        'flag',
        'guard_problems',
        'inputs_sha256',
        'profile',
        'reading_json',
        'reading_sha256',
        'reference_price',
        'retuning_applied',
        'rules_sha256',
        'rules_version',
        'runner_version',
        'zone_count',
        'zone_params_sha256',
        'zone_params_version',
        'zones_json',
        'zones_reason',
        'zones_sha256',
      ].sort()
    );
    // the JSONB copy of the reading is not read: the text is the evidence
    expect(reading.select).not.toHaveProperty('reading');
    const zone = db.findZones.mock.calls[0][0];
    expect(zone.where).toEqual({ symbol: 'XAUUSD', cycle_slot: V1.slot });
    expect(Object.keys(zone.select)).toHaveLength(20);
    expect(zone.select).toHaveProperty('levels');
  });

  it('a cycle with no SYN row has synthesis null, and zone rows with no reading row are orphans', async () => {
    const { input, outputs, zones } = rowsOf(stored());
    const none = await loadStoredCycle(
      fakeReplayDatabase(input, outputs).database,
      'XAUUSD',
      V1.slot
    );
    expect(none.synthesis).toBeNull();
    const orphans = await loadStoredCycle(
      fakeReplayDatabase(input, outputs, { zones }).database,
      'XAUUSD',
      V1.slot
    );
    expect(orphans.synthesis?.profiles).toEqual([]);
    expect(orphans.synthesis?.orphanZones).toHaveLength(4);
  });

  it.each([
    ['Prisma P2021', { code: 'P2021', message: 'The table does not exist' }],
    ['PostgreSQL 42P01', { code: '42P01' }],
    [
      'a driver-adapter error',
      {
        meta: { driverAdapterError: { cause: { kind: 'TableDoesNotExist' } } },
      },
    ],
    ['a message', new Error('relation "synthesis_readings" does not exist')],
    [
      'a message about the database',
      new Error(
        'table public.entry_zones does not exist in the current database'
      ),
    ],
  ])(
    'a database without the tables (%s) gives synthesisTablesMissing, not a failure',
    async (_what, error) => {
      const { input, outputs } = rowsOf(storedCycle(V1));
      const db = fakeReplayDatabase(input, outputs, { fail: error });
      const loaded = await loadStoredCycle(db.database, 'XAUUSD', V1.slot);
      expect(loaded).toMatchObject({
        synthesis: null,
        synthesisTablesMissing: true,
      });
      expect(loaded.readings).toHaveLength(4);
    }
  );

  it.each([
    ['a lost connection', new Error('connection lost')],
    ['a permission error', { code: 'P1010', message: 'access denied' }],
    ['a non-error', 'oops'],
  ])(
    'any other failed read (%s) is a failure and is thrown',
    async (_what, error) => {
      const { input, outputs } = rowsOf(storedCycle(V1));
      const db = fakeReplayDatabase(input, outputs, { fail: error });
      await expect(
        loadStoredCycle(db.database, 'XAUUSD', V1.slot)
      ).rejects.toBe(error);
    }
  );

  it('maps each column of a reading row and of a zone row to its own field, none to another', async () => {
    const { input, outputs } = rowsOf(stored());
    const row = {
      profile: DAY,
      flag: 'live',
      rules_version: 'draft-7',
      rules_sha256: 'a'.repeat(64),
      zone_params_version: 'zones-7',
      zone_params_sha256: 'b'.repeat(64),
      reading_json: 'R',
      reading_sha256: 'c'.repeat(64),
      zones_json: 'Z',
      zones_sha256: 'd'.repeat(64),
      zones_reason: 'WHY',
      zone_count: 3,
      reference_price: 1.5,
      guard_problems: ['G'],
      inputs_sha256: 'e'.repeat(64),
      retuning_applied: true,
      runner_version: '9.9.9',
    };
    const zone = {
      ...rowsOf(stored()).zones[0],
      profile: DAY,
      zone_id: 'Z1',
      rank: 1,
    };
    const loaded = await loadStoredCycle(
      fakeReplayDatabase(input, outputs, { synthesis: [row], zones: [zone] })
        .database,
      'XAUUSD',
      V1.slot
    );
    expect(loaded.synthesis?.profiles[0]).toEqual({
      profile: DAY,
      flag: 'live',
      rulesVersion: 'draft-7',
      rulesSha256: 'a'.repeat(64),
      zoneParamsVersion: 'zones-7',
      zoneParamsSha256: 'b'.repeat(64),
      readingJson: 'R',
      readingSha256: 'c'.repeat(64),
      zonesJson: 'Z',
      zonesSha256: 'd'.repeat(64),
      zonesReason: 'WHY',
      zoneCount: 3,
      referencePrice: 1.5,
      guardProblems: ['G'],
      inputsSha256: 'e'.repeat(64),
      retuningApplied: true,
      runnerVersion: '9.9.9',
      zoneRows: [zone],
    });
    expect(loaded.synthesis?.orphanZones).toEqual([]);
  });

  it('zone rows are kept with the profile they name, in rank order, and the other profile’s are not mixed in', async () => {
    const { input, outputs, synthesis, zones } = rowsOf(stored());
    const loaded = await loadStoredCycle(
      fakeReplayDatabase(input, outputs, {
        synthesis,
        zones: [...zones].sort(
          (a, b) => (b['rank'] as number) - (a['rank'] as number)
        ),
      }).database,
      'XAUUSD',
      V1.slot
    );
    for (const p of loaded.synthesis!.profiles) {
      expect(p.zoneRows!.map((z) => [z.profile, z.rank])).toEqual([
        [p.profile, 1],
        [p.profile, 2],
      ]);
    }
  });

  it('a loaded cycle replays the same as the cycle it was built from', async () => {
    const built = stored();
    const rows = rowsOf(built);
    const loaded = await loadStoredCycle(
      fakeReplayDatabase(rows.input, rows.outputs, {
        synthesis: rows.synthesis,
        zones: rows.zones,
      }).database,
      'XAUUSD',
      V1.slot
    );
    const tempRoot = makeTempRoot();
    try {
      const report = await new CycleReplayer(
        SETTINGS,
        answering(resultEqualTo(built, V1)).hooks(tempRoot, {
          rulesVersions: () => ({ available: ['draft-1'], current: 'draft-1' }),
        })
      ).replay(loaded);
      expect(report.verdict).toBe('VERIFIED');
      expect(report.synthesis.profiles).toHaveLength(2);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

describe('loadFixtureCycle: the synthesis.json beside a fixture', () => {
  const tmp: string[] = [];
  const makeDir = (): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-syn-fixture-'));
    tmp.push(dir);
    return dir;
  };
  afterAll(() =>
    tmp.forEach((d) => fs.rmSync(d, { recursive: true, force: true }))
  );
  const copyFixture = (
    dir: string,
    kinds = ['bundle', 'cycle', 'synthesis']
  ): void => {
    for (const kind of kinds)
      fs.copyFileSync(
        path.join(FIXTURES_DIR, `${V1.stem}.${kind}.json`),
        path.join(dir, `${V1.stem}.${kind}.json`)
      );
  };

  it('reads the stored section: one stored profile per entry, each with the section’s flag, rules and zone parameters and the cycle’s inputs hash', () => {
    const loaded = loadFixtureCycle(FIXTURES_DIR, V1.slot);
    expect(loaded.synthesis?.error).toBeNull();
    expect(loaded.synthesis?.profiles.map((p) => p.profile)).toEqual([
      DAY,
      SCALP,
    ]);
    const first = loaded.synthesis!.profiles[0];
    expect(first).toMatchObject({
      flag: 'shadow',
      rulesVersion: 'draft-1',
      zoneParamsVersion: 'zones-1',
      zoneCount: null,
      zoneRows: null,
      retuningApplied: false,
      inputsSha256: loaded.bundle?.inputsSha256,
      runnerVersion: loaded.readings[0].runnerVersion,
    });
    expect(first.referencePrice).toBe(4378.31);
    expect(first.readingSha256).toBe(sha256(first.readingJson as string));
  });

  it('a fixture without a synthesis.json has no SYN rows stored (an older fixture folder replays as before)', () => {
    const dir = makeDir();
    copyFixture(dir, ['bundle', 'cycle']);
    expect(loadFixtureCycle(dir, V1.slot).synthesis).toBeNull();
  });

  it('a synthesis.json that is not what it should be throws and names the file', () => {
    const notJson = makeDir();
    copyFixture(notJson, ['bundle', 'cycle']);
    fs.writeFileSync(path.join(notJson, `${V1.stem}.synthesis.json`), '{oops');
    expect(() => loadFixtureCycle(notJson, V1.slot)).toThrow(
      `${V1.stem}.synthesis.json is not JSON`
    );
    const notSection = makeDir();
    copyFixture(notSection, ['bundle', 'cycle']);
    fs.writeFileSync(
      path.join(notSection, `${V1.stem}.synthesis.json`),
      '{"flag":"off"}'
    );
    expect(() => loadFixtureCycle(notSection, V1.slot)).toThrow(
      `${V1.stem}.synthesis.json is not a stored synthesis (`
    );
  });

  it('a section that records that synthesis stopped is loaded with its error and no profiles', () => {
    const dir = makeDir();
    copyFixture(dir, ['bundle', 'cycle']);
    const section = {
      ...storedSynthesis(V1),
      error: 'SYNTHESIS_ERROR',
      readings: [],
    };
    fs.writeFileSync(
      path.join(dir, `${V1.stem}.synthesis.json`),
      JSON.stringify(section)
    );
    expect(loadFixtureCycle(dir, V1.slot).synthesis).toEqual({
      error: 'SYNTHESIS_ERROR',
      profiles: [],
      orphanZones: [],
    });
  });
});

describe('runReplayCommand and the usage', () => {
  const options = (over: Partial<ReplayCliOptions>): ReplayCliOptions => ({
    db: false,
    fixtures: false,
    slots: [],
    symbol: 'XAUUSD',
    python: null,
    engineDir: null,
    fixturesDir: null,
    json: false,
    help: false,
    ...over,
  });
  let tempRoot: string;
  beforeEach(() => {
    tempRoot = makeTempRoot();
  });
  afterEach(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  it('--fixtures on a fake runner that answers each fixture’s SYN section: three VERIFIED, exit 0, SYN counted in the text', async () => {
    const runner = new RecordingRunner((request) => {
      const bundle = request.bundle as { cycle_slot: string };
      const fixture = FIXTURE_SLOTS.find(
        (f) => slotToIso(f.slot) === bundle.cycle_slot
      ) as FixtureSlot;
      return outputOf({
        ...unitResultWithSynthesis(fixture),
        inputs_sha256: readFixtureCycle(fixture).inputs_sha256,
      });
    });
    const result = await runReplayCommand(options({ fixtures: true }), {
      env: {},
      hooks: runner.hooks(tempRoot),
    });
    expect(
      result.reports.map((r) => [r.slot, r.verdict, r.synthesis.state])
    ).toEqual(FIXTURE_SLOTS.map((f) => [f.slot, 'VERIFIED', 'REPLAYED']));
    expect(result.exitCode).toBe(0);
    expect(result.text).toContain('3 cycle(s): 3 VERIFIED');
    expect(result.text.match(/2 of 2 SYN readings/g)).toHaveLength(3);
  });

  it('the usage says what SYN is compared and how a rules version differs from a divergence', () => {
    for (const word of [
      'synthesis_readings and entry_zones',
      'SYN readings',
      'entry_zones rows are not the zones_json',
      'rules version',
      'changed without a new version',
      'A cycle with no SYN rows is replayed with SYN off',
    ])
      expect(REPLAY_USAGE).toContain(word);
  });
});
