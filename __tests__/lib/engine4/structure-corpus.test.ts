/**
 * @jest-environment node
 */

/**
 * The structure-level twin held to the Python zone builder (build step 5, part 2).
 *
 * Two corpora, both made by the real builder:
 *  1. the 31 zones of the 16 golden scenarios Davin signed off (three are real
 *     stored cycles, among them the 18 Sep one);
 *  2. 495 zones of 160 random worlds (`scripts/engine4/structure_worlds.py`), with
 *     sub-cent prices, ties and levels exactly on the $13 floor.
 * For every zone the invalidation and the next opposing level are rebuilt from
 * the LEVELS ALONE and must equal what the builder stored. The expected values
 * are also worked out here, with plain loops and none of the library's helpers
 * beyond exact arithmetic, so a mistake shared by the twin and its own tests
 * cannot hide.
 *
 * Then the stored 18 Sep cycle end to end (the reader, the stop choices, the room
 * and the badge), with the three ways its bundle can fail.
 */

import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  ZONES_1,
  Rational,
  badgeContextFromReading,
  buildScenarios,
  buildStopChoices,
  decideBadge,
  groupStopOptions,
  levelsFromReadings,
  nextOpposingLevel,
  roomAhead,
  srLevelsFromContext,
  stopOptions,
  toStructure,
  zoneDisagreement,
  zoneFromStored,
  zoneInvalidation,
} from '@/lib/engine4';
import type { Level, LevelOrigin, SizingInput, ZoneInput } from '@/lib/engine4';
import { readStructureLevels } from '@/lib/engine4/read/structure-levels';

import {
  REPO_ROOT,
  bundleRow,
  fakeClient,
  fakeRowsFor,
  loadGoldens,
  readingsOf,
  type Golden,
} from './helpers/stored';

jest.mock('@/lib/db/market-prisma', () => ({ marketPrisma: {} }));

const r = (text: string): Rational => Rational.of(text);
const THIRTEEN = r('13');
const BUFFER = r('0.5');

const sideOf = (bias: string): 'BUY' | 'SELL' =>
  bias === 'LONG' ? 'BUY' : 'SELL';

/** The invalidation, worked out again from the text of ADR-032 and decision D7 (a). */
function expectedInvalidation(structure: Level[], zone: ZoneInput) {
  const long = zone.bias === 'LONG';
  const past = structure.filter((l) =>
    long ? l.price.lt(zone.low) : l.price.gt(zone.high)
  );
  if (past.length === 0) {
    return {
      basis: 'NO_LEVEL',
      price: (long
        ? zone.referencePrice.sub(THIRTEEN)
        : zone.referencePrice.add(THIRTEEN)
      ).roundTo(2),
    };
  }
  const nearest = past.reduce((best, l) =>
    (long ? l.price.gt(best.price) : l.price.lt(best.price)) ? l : best
  );
  const fromLevel = long
    ? nearest.price.sub(BUFFER)
    : nearest.price.add(BUFFER);
  const distance = long
    ? zone.referencePrice.sub(fromLevel)
    : fromLevel.sub(zone.referencePrice);
  if (distance.gte(THIRTEEN))
    return { basis: 'LEVEL', price: fromLevel.roundTo(2) };
  return {
    basis: 'MINIMUM_STOP',
    price: (long
      ? zone.referencePrice.sub(THIRTEEN)
      : zone.referencePrice.add(THIRTEEN)
    ).roundTo(2),
  };
}

/** The price of the nearest level strictly beyond the reference price, or null. */
function expectedOpposingPrice(
  structure: Level[],
  zone: ZoneInput
): Rational | null {
  const long = zone.bias === 'LONG';
  const beyond = structure
    .filter((l) =>
      long ? l.price.gt(zone.referencePrice) : l.price.lt(zone.referencePrice)
    )
    .map((l) => l.price);
  if (beyond.length === 0) return null;
  return beyond.reduce((best, p) =>
    (long ? p.lt(best) : p.gt(best)) ? p : best
  );
}

function checkZone(levels: Level[], zone: ZoneInput): string[] {
  const problems: string[] = [];
  const structure = toStructure(levels);
  const want = expectedInvalidation(structure, zone);

  // the stored invalidation is what the rule gives
  if (want.basis !== zone.invalidationBasis)
    problems.push(`basis ${zone.invalidationBasis} vs ${want.basis}`);
  if (!want.price.eq(zone.invalidationPrice))
    problems.push(`price ${zone.invalidationPrice} vs ${want.price}`);
  if (zone.invalidationBasis !== 'LEVEL') {
    // the exact $13 rule
    const gap = zone.referencePrice.sub(zone.invalidationPrice).abs();
    if (!gap.eq(THIRTEEN))
      problems.push(`a raised stop is ${gap} from the reference price`);
  }

  // the twin gives the same, and names the same level
  const twin = zoneInvalidation(levels, zone);
  if (twin.basis !== zone.invalidationBasis)
    problems.push(`twin basis ${twin.basis}`);
  if (!twin.price.eq(zone.invalidationPrice))
    problems.push(`twin price ${twin.price}`);
  if (!twin.stopDistance.eq(zone.stopDistance))
    problems.push(`twin stop ${twin.stopDistance}`);

  // the next opposing level
  const wantOpposing = expectedOpposingPrice(structure, zone);
  const stored = zone.nextOpposingLevel;
  if ((wantOpposing === null) !== (stored === null))
    problems.push('opposing level present on one side only');
  if (wantOpposing !== null && stored !== null) {
    if (!wantOpposing.eq(stored.price))
      problems.push(`opposing ${stored.price} vs ${wantOpposing}`);
    const runway = wantOpposing.sub(zone.referencePrice).abs();
    if (zone.runway === null || !zone.runway.eq(runway))
      problems.push('runway');
    if (
      zone.runwayRatio === null ||
      !zone.runwayRatio.eq(runway.div(zone.stopDistance).roundTo(2))
    ) {
      problems.push('runway ratio');
    }
  }
  const ahead = roomAhead(levels, sideOf(zone.bias), zone.referencePrice);
  if (
    ahead.level?.name !== stored?.name ||
    ahead.level?.tf !== stored?.tf ||
    ahead.level?.origin !== stored?.origin
  ) {
    problems.push('roomAhead names another level');
  }
  const next = nextOpposingLevel(
    levels,
    sideOf(zone.bias),
    zone.referencePrice
  );
  if (next?.name !== stored?.name)
    problems.push('nextOpposingLevel names another level');

  // the whole check in one call
  const disagreement = zoneDisagreement(levels, zone);
  if (disagreement.length > 0)
    problems.push(`zoneDisagreement: ${disagreement.join('; ')}`);

  // the pipeline: every LEVEL invalidation is among the stop options, at the zone's entry and the floor
  const side = sideOf(zone.bias);
  const options = stopOptions(levels, {
    side,
    entry: zone.referencePrice,
    minSld: THIRTEEN,
  });
  if (
    zone.invalidationBasis === 'LEVEL' &&
    !options.some((o) => o.stopPrice.eq(zone.invalidationPrice))
  ) {
    problems.push(
      'the stored LEVEL invalidation is not among the stop options'
    );
  }
  const choices = buildStopChoices({
    zone,
    entry: zone.referencePrice,
    minSld: THIRTEEN,
    structure: { complete: true, levels, problems: [] },
  });
  if (choices.mode !== 'STRUCTURE') problems.push(`mode ${choices.mode}`);
  const wantKind =
    zone.invalidationBasis === 'LEVEL' ? 'ZONE_INVALIDATION' : 'MINIMUM_STOP';
  if (choices.preselected.kind !== wantKind)
    problems.push(`preselected ${choices.preselected.kind}`);
  if (
    choices.preselected.kind === 'ZONE_INVALIDATION' &&
    choices.preselected.option === null
  ) {
    problems.push('the pre-selected invalidation is not one of the options');
  }
  return problems;
}

describe('the 31 golden zones', () => {
  const goldens = loadGoldens();

  test('there are 16 scenarios and 31 zones: 22 behind a level, 4 raised to the minimum, 5 with no level', () => {
    expect(goldens).toHaveLength(16);
    const zones = goldens.flatMap((g) => g.readings.flatMap((x) => x.zones));
    expect(zones).toHaveLength(31);
    const count = (basis: string) =>
      zones.filter((z) => z['invalidation_basis'] === basis).length;
    expect(count('LEVEL')).toBe(22);
    expect(count('MINIMUM_STOP')).toBe(4);
    expect(count('NO_LEVEL')).toBe(5);
    expect(zones.filter((z) => z['bias'] === 'LONG')).toHaveLength(16);
    expect(zones.filter((z) => z['bias'] === 'SHORT')).toHaveLength(15);
  });

  function levelsOf(g: Golden): Level[] {
    return [
      ...levelsFromReadings(readingsOf(g)),
      ...srLevelsFromContext(g.context),
    ];
  }

  test.each(loadGoldens().map((g) => [g.id, g] as const))('%s', (_id, g) => {
    const levels = levelsOf(g);
    // the readings handed in are the ones the SYN readings name
    for (const entry of g.readings) {
      const inputs = entry.reading['inputs'] as Record<
        string,
        { envelope_sha256: string | null }
      >;
      for (const sensor of g.sensors) {
        const named = inputs[sensor.mcd_id]?.envelope_sha256;
        if (named !== undefined && named !== null) {
          expect(named).toBe(sensor.envelope_sha256);
        }
      }
    }
    const problems: string[] = [];
    for (const entry of g.readings) {
      for (const raw of entry.zones) {
        const zone = zoneFromStored(raw);
        if (zone === null) {
          problems.push(
            `${entry.profile} ${String(raw['zone_id'])}: not a zone`
          );
          continue;
        }
        for (const problem of checkZone(levels, zone)) {
          problems.push(`${entry.profile} ${zone.zoneId}: ${problem}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});

describe('160 random worlds made by the real Python builder', () => {
  interface World {
    id: string;
    p_ref: string;
    levels: [string, 'M5' | 'M15', string, LevelOrigin][];
    zones: Record<'LONG' | 'SHORT', Record<string, unknown>[]>;
    edge?: {
      bias: 'LONG' | 'SHORT';
      reference_price: string;
      behind: '12.50' | '12.49';
      level_price: string;
    };
  }
  const fixture = JSON.parse(
    readFileSync(join(__dirname, 'fixtures', 'structure-worlds.json'), 'utf8')
  ) as {
    generator: Record<string, string | number>;
    worlds: World[];
  };

  const sha = (path: string): string =>
    createHash('sha256')
      .update(readFileSync(path, 'utf8').replace(/\r\n/g, '\n'), 'utf8')
      .digest('hex');

  test('the fixture was made by this script and this builder, with these parameters', () => {
    expect(fixture.generator['script_sha256']).toBe(
      sha(join(REPO_ROOT, 'scripts', 'engine4', 'structure_worlds.py'))
    );
    expect(fixture.generator['builder_sha256']).toBe(
      sha(
        join(
          REPO_ROOT,
          'davintrade-stack-d-and-e',
          'engine-1-5-new',
          'mcd_worker',
          'synthesis',
          'zones.py'
        )
      )
    );
    expect(fixture.generator['zone_params_version']).toBe(ZONES_1.version);
    expect(fixture.generator['world_count']).toBe(fixture.worlds.length);
    expect(fixture.worlds).toHaveLength(160);
  });

  test("it is all text but the builder's own floats, and reaches every basis and both biases", () => {
    const zones = fixture.worlds.flatMap((w) => [
      ...w.zones.LONG,
      ...w.zones.SHORT,
    ]);
    expect(zones).toHaveLength(fixture.generator['zone_count'] as number);
    expect(zones.length).toBeGreaterThanOrEqual(450);
    const bases = new Set(zones.map((z) => z['invalidation_basis']));
    expect(bases).toEqual(new Set(['LEVEL', 'MINIMUM_STOP', 'NO_LEVEL']));
    expect(fixture.worlds.some((w) => w.zones.LONG.length > 0)).toBe(true);
    expect(fixture.worlds.some((w) => w.zones.SHORT.length > 0)).toBe(true);
    expect(zones.some((z) => z['next_opposing_level'] === null)).toBe(true);
    // levels with a part of a cent, to be rounded
    expect(
      fixture.worlds.some((w) =>
        w.levels.some(([, , price]) => /\.\d{3,}$/.test(price))
      )
    ).toBe(true);
  });

  test('every zone of every world: invalidation, next opposing level, runway, ratio, the stop options and the pre-selection', () => {
    const problems: string[] = [];
    let checked = 0;
    for (const world of fixture.worlds) {
      const levels: Level[] = world.levels.map(([name, tf, price, origin]) => ({
        name,
        tf,
        price: r(price),
        origin,
      }));
      for (const bias of ['LONG', 'SHORT'] as const) {
        for (const raw of world.zones[bias]) {
          const zone = zoneFromStored(raw);
          if (zone === null) {
            problems.push(`${world.id} ${bias}: a stored zone does not parse`);
            continue;
          }
          for (const problem of checkZone(levels, zone)) {
            problems.push(`${world.id} ${bias} ${zone.zoneId}: ${problem}`);
          }
          checked += 1;
        }
      }
      if (problems.length > 10) break;
    }
    expect(problems.slice(0, 10)).toEqual([]);
    expect(checked).toBe(fixture.generator['zone_count']);
  });

  test('a level exactly $12.50 behind the reference price keeps the $13 floor; $12.49 loses it', () => {
    // a stop $0.50 behind a level 12.50 away is exactly 13.00 from the reference price;
    // at 12.49 it would be 12.99, so the builder raises it to 13 and says MINIMUM_STOP
    let keeps = 0;
    let loses = 0;
    let edges = 0;
    for (const world of fixture.worlds) {
      const edge = world.edge;
      if (edge === undefined) continue;
      edges += 1;
      const zone = world.zones[edge.bias]
        .map((raw) => zoneFromStored(raw))
        .find(
          (z) => z !== null && z.referencePrice.eq(r(edge.reference_price))
        );
      expect(zone).toBeTruthy();
      if (!zone) continue;
      if (
        edge.behind === '12.50' &&
        zone.invalidationBasis === 'LEVEL' &&
        zone.stopDistance.eq(THIRTEEN)
      ) {
        keeps += 1;
      }
      if (
        edge.behind === '12.49' &&
        zone.invalidationBasis === 'MINIMUM_STOP'
      ) {
        expect(zone.stopDistance.eq(THIRTEEN)).toBe(true);
        loses += 1;
      }
    }
    expect(edges).toBeGreaterThanOrEqual(50);
    expect(keeps).toBeGreaterThanOrEqual(8);
    expect(loses).toBeGreaterThanOrEqual(8);
  });
});

// ---------------------------------------------------------------------------
// The stored 18 Sep cycle, end to end
// ---------------------------------------------------------------------------

describe('the stored 18 Sep cycle: stop options, room and badge (architecture 6.5, plan section 3)', () => {
  const golden = loadGoldens().find((g) => g.id.startsWith('01-'));
  if (golden === undefined) throw new Error('golden 01 is missing');
  const stored = fakeRowsFor('2026-09-18T2055Z');
  const NOW = stored.slot + 600;

  const dayTrader = golden.readings.find((x) => x.profile === 'DAY_TRADER');
  const scalper = golden.readings.find((x) => x.profile === 'SCALPER');
  if (dayTrader === undefined || scalper === undefined)
    throw new Error('readings');
  const z1 = zoneFromStored(dayTrader.zones[0]);
  if (z1 === null) throw new Error('Z1');

  const GOLD = {
    contractSize: '100',
    volumeMin: '0.01',
    volumeStep: '0.01',
    volumeMax: '100',
    typicalSpread: '0',
    point: '0.01',
  };
  /** The default profile (6.2) buying at Z1's reference price with a given stop. */
  const sizingFor = (stopDistance: string): SizingInput => ({
    side: 'BUY',
    entry: '4367.20',
    stopDistance,
    equity: '5000',
    riskPct: '1.5',
    maxLeverage: '1.5',
    commission: '4',
    spec: GOLD,
  });

  async function read() {
    const { client } = fakeClient({
      slot: stored.slot,
      mcdRows: stored.mcdRows,
      cycleRow: stored.cycleRow,
    });
    return readStructureLevels(
      { cycleSlot: stored.slot, nowSeconds: NOW },
      client
    );
  }

  test('Z1 is the zone the plan describes: LONG at 4367.20, invalidation 4350.42 behind M15 sr_2', () => {
    expect(z1.zoneId).toBe('Z1');
    expect(z1.referencePrice.toString()).toBe('4367.2');
    expect(z1.invalidationPrice.toString()).toBe('4350.42');
    expect(z1.invalidationBasis).toBe('LEVEL');
    expect(z1.stopDistance.toString()).toBe('16.78');
    expect(z1.nextOpposingLevel?.name).toBe('sr_1');
    expect(z1.runway?.toString()).toBe('2.37');
  });

  test('six stop options at the default Min SLD of $13, nearest first, each named', async () => {
    const structure = await read();
    expect(structure.complete).toBe(true);
    const choices = buildStopChoices({
      zone: z1,
      entry: '4367.20',
      minSld: '13',
      structure,
    });
    expect(choices.mode).toBe('STRUCTURE');
    expect(
      choices.structural.map((o) => [
        o.level.tf,
        o.level.name,
        o.level.price.toString(),
        o.stopPrice.toString(),
        o.stopDistance.toString(),
      ])
    ).toEqual([
      ['M15', 'sr_2', '4350.92', '4350.42', '16.78'],
      ['M5', 'LOEDT', '4350.16', '4349.66', '17.54'],
      ['M15', 'sr_3', '4334.56', '4334.06', '33.14'],
      ['M15', 'UOEDT', '4279.46', '4278.96', '88.24'],
      ['M15', 'baseline', '4214.17', '4213.67', '153.53'],
      ['M15', 'LOEDT', '4126.24', '4125.74', '241.46'],
    ]);
    expect(choices.structural.every((o) => o.alsoAt.length === 0)).toBe(true);
    // the zone's own invalidation is the pre-selected one, and it is the first option
    expect(choices.preselected.kind).toBe('ZONE_INVALIDATION');
    if (choices.preselected.kind === 'ZONE_INVALIDATION') {
      expect(choices.preselected.stopPrice.toString()).toBe('4350.42');
      expect(choices.preselected.option).toBe(choices.structural[0]);
    }
    // three in the modal, three under "more levels"
    const grouped = groupStopOptions(choices.structural);
    expect(grouped.primary).toHaveLength(3);
    expect(grouped.more).toHaveLength(3);
    expect(choices.custom.minDistance.toString()).toBe('13');
  });

  test('a Min SLD of $20 leaves five: the nearest two stops are 16.78 and 17.54 away', async () => {
    const structure = await read();
    const choices = buildStopChoices({
      zone: z1,
      entry: '4367.20',
      minSld: '20',
      structure,
    });
    expect(choices.structural.map((o) => o.stopDistance.toString())).toEqual([
      '33.14',
      '88.24',
      '153.53',
      '241.46',
    ]);
    expect(choices.preselected.kind).toBe('NEAREST_OPTION');
  });

  test('the room: the next opposing level is M15 sr_1 at 4369.57, 2.37 away', async () => {
    const structure = await read();
    const ahead = roomAhead(structure.levels, 'BUY', '4367.20');
    expect(ahead.level).toMatchObject({
      name: 'sr_1',
      tf: 'M15',
      origin: 'sr_levels',
    });
    expect(ahead.level?.price.toString()).toBe('4369.57');
    expect(ahead.room?.toString()).toBe('2.37');
  });

  test('NO BADGE, and the level named is 4369.57 (not the 4384.28 of the first sketch)', async () => {
    const structure = await read();
    const context = badgeContextFromReading(dayTrader.reading);
    expect(context).toEqual({
      trendRelation: 'COUNTER_TREND',
      conflict: true,
      trendOnBothTimeframes: false,
    });
    const level = nextOpposingLevel(structure.levels, 'BUY', '4367.20');
    const set = buildScenarios(sizingFor('16.78'), {
      targetRrr: '1.75',
      counterTrend: true,
    });
    // Conservative (1.50x) needs a target distance of 25.27, which is 4392.47: past the level
    expect(set.scenarios[0]?.name).toBe('CONSERVATIVE');
    expect(set.scenarios[0]?.target.targetDistance.toString()).toBe('25.27');
    expect(set.scenarios[0]?.target.targetChartLevel.toString()).toBe(
      '4392.47'
    );
    if (context === null) throw new Error('no context');
    const badge = decideBadge({
      side: 'BUY',
      context,
      scenarios: set.scenarios,
      nextLevel: level,
    });
    expect(badge.badge).toBeNull();
    expect(badge.noBadgeReason).toBe('NO_SCENARIO_FITS');
    expect(badge.fitting).toEqual([]);
    expect(badge.nextLevel?.price.toString()).toBe('4369.57');
  });

  test('no badge for any of the six stops, for either trader type, in either zone', async () => {
    const structure = await read();
    for (const entry of [dayTrader, scalper]) {
      const context = badgeContextFromReading(entry.reading);
      if (context === null) throw new Error('no context');
      for (const raw of entry.zones) {
        const zone = zoneFromStored(raw);
        if (zone === null) throw new Error('zone');
        const entryPrice = zone.referencePrice.toString();
        const level = nextOpposingLevel(structure.levels, 'BUY', entryPrice);
        const options = stopOptions(structure.levels, {
          side: 'BUY',
          entry: entryPrice,
          minSld: '13',
        });
        expect(options.length).toBeGreaterThanOrEqual(4);
        for (const option of options) {
          const set = buildScenarios(
            { ...sizingFor(option.stopDistance.toString()), entry: entryPrice },
            {
              targetRrr: '1.75',
              counterTrend: context.trendRelation === 'COUNTER_TREND',
            }
          );
          const badge = decideBadge({
            side: 'BUY',
            context,
            scenarios: set.scenarios,
            nextLevel: level,
          });
          expect(badge.badge).toBeNull();
        }
      }
    }
  });

  test("the Scalper's reading is with the trend but in conflict, so its row is the conflict row", () => {
    expect(badgeContextFromReading(scalper.reading)).toEqual({
      trendRelation: 'WITH_TREND',
      conflict: true,
      trendOnBothTimeframes: true,
    });
  });
});

describe("the 18 Sep cycle when its levels cannot be read: only the zone's own invalidation", () => {
  const golden = loadGoldens().find((g) => g.id.startsWith('01-'));
  const zone = zoneFromStored(golden?.readings[0]?.zones[0]);
  if (zone === null) throw new Error('Z1');
  const stored = fakeRowsFor('2026-09-18T2055Z');

  const cases: [
    string,
    () => Parameters<typeof fakeClient>[0],
    number,
    string,
  ][] = [
    [
      'missing bundle',
      () => ({ slot: stored.slot, mcdRows: stored.mcdRows, cycleRow: null }),
      stored.slot + 600,
      'BUNDLE_MISSING',
    ],
    [
      'expired bundle',
      () => ({ slot: stored.slot, mcdRows: stored.mcdRows, cycleRow: null }),
      stored.slot + 7_776_001,
      'BUNDLE_EXPIRED',
    ],
    [
      'tampered bundle',
      () => ({
        slot: stored.slot,
        mcdRows: stored.mcdRows,
        cycleRow: {
          ...bundleRow(stored.bundleText.replace('4369.57', '4369.58')),
          inputs_sha256: stored.cycleRow.inputs_sha256,
        },
      }),
      stored.slot + 600,
      'BUNDLE_TAMPERED',
    ],
    [
      'tampered reading',
      () => ({
        slot: stored.slot,
        mcdRows: stored.mcdRows.map((row) =>
          row.mcd_id === 'MCD2'
            ? {
                ...row,
                envelope_json: row.envelope_json.replace('4350.16', '4350.17'),
              }
            : row
        ),
        cycleRow: stored.cycleRow,
      }),
      stored.slot + 600,
      'SENSOR_READING_TAMPERED',
    ],
  ];

  test.each(cases)('%s', async (_name, build, now, code) => {
    const { client } = fakeClient(build());
    const structure = await readStructureLevels(
      { cycleSlot: stored.slot, nowSeconds: now },
      client
    );
    expect(structure.complete).toBe(false);
    expect(structure.problems.map((p) => p.code)).toEqual([code]);
    const choices = buildStopChoices({
      zone,
      entry: '4367.20',
      minSld: '13',
      structure,
    });
    expect(choices.mode).toBe('DEGRADED');
    expect(choices.degradedBy.map((p) => p.code)).toEqual([code]);
    // the zone's own stop, named as the zone names it, and no other level
    expect(choices.structural).toHaveLength(1);
    expect(choices.structural[0]?.stopPrice.toString()).toBe('4350.42');
    expect(choices.structural[0]?.stopDistance.toString()).toBe('16.78');
    expect(choices.structural[0]?.level).toMatchObject({
      name: 'sr_2',
      tf: 'M15',
    });
    expect(choices.preselected.kind).toBe('ZONE_INVALIDATION');
  });
});
