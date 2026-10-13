/**
 * @jest-environment node
 */

/**
 * What the board and the router read out of a stored reading (`lib/intake/facts.ts`).
 *
 * Every sensor envelope and every synthesis reading of the 16 golden scenarios and the three
 * stored cycles must pass, and must give back exactly what the document says. Every way a
 * reading can be wrong in a way the packet validator would refuse must be refused here first,
 * with a reason, so the reader can list the sensor as unavailable instead of the whole
 * packet failing later.
 */

import {
  SENSOR_ROSTER,
  isUsable,
  orderedMcdIds,
  sensorFactsOf,
  synthesisFactsOf,
  type SensorFacts,
} from '@/lib/intake';

import { clone } from './helpers/packets';
import { goldenWorlds, storedWorlds } from './helpers/world';

const WORLDS = [...goldenWorlds(), ...storedWorlds()];
const GATE = new Set(
  SENSOR_ROSTER.sensors.filter((s) => !s.on_board).map((s) => s.mcd_id)
);

const envelopeOf = (json: string): Record<string, any> =>
  JSON.parse(json) as Record<string, any>;

describe('the sensors of every stored world', () => {
  const cases = WORLDS.flatMap((world) =>
    world.sensors
      .filter((sensor) => !GATE.has(sensor.mcd_id))
      .map((sensor) => ({ world, sensor }))
  );

  it('covers the 16 golden scenarios and 3 stored cycles', () => {
    expect(WORLDS).toHaveLength(19);
    expect(cases.length).toBeGreaterThan(40);
  });

  it.each(cases.map((c) => [`${c.world.name} ${c.sensor.mcd_id}`, c]))(
    '%s gives its facts',
    (_name, { world, sensor }) => {
      const envelope = envelopeOf(sensor.envelope_json);
      const result = sensorFactsOf(envelope, {
        mcd_id: sensor.mcd_id,
        slot: world.slotIso,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const facts = result.facts;
      expect(facts.mcd_id).toBe(sensor.mcd_id);
      expect(facts.status).toBe(envelope['status']);
      expect(facts.state_code).toBe(envelope['state_code']);
      expect(facts.bias).toBe(envelope['bias']);
      expect(facts.summary).toBe(envelope['summary_line']);
      expect(facts.reasons).toEqual(envelope['status_reasons']);
      expect(facts.levels).toEqual(
        (envelope['levels'] as { price: number }[]).map((l) => l.price)
      );
      // state code and bias exactly when the sensor is usable
      expect(facts.state_code === null).toBe(!isUsable(facts.status));
      expect(facts.bias === null).toBe(!isUsable(facts.status));
    }
  );
});

describe('a sensor reading that must be refused', () => {
  const world = goldenWorlds()[0]!; // 01: MCD1 CAUTIONARY, MCD2 CAUTIONARY, MCD3 CAUTIONARY
  const ok = (id: string): Record<string, any> =>
    envelopeOf(world.sensors.find((s) => s.mcd_id === id)!.envelope_json);
  const stale = (): Record<string, any> =>
    envelopeOf(
      goldenWorlds()
        .find((w) => w.name.startsWith('14-'))!
        .sensors.find((s) => s.mcd_id === 'MCD1')!.envelope_json
    );
  const slot = world.slotIso;
  const facts = (envelope: unknown, id = 'MCD1', at = slot) =>
    sensorFactsOf(envelope, { mcd_id: id, slot: at });

  const REFUSED: [string, (e: Record<string, any>) => unknown, string][] = [
    ['not an object', () => 'text', 'not an object'],
    ['an array', () => [], 'not an object'],
    ['null', () => null, 'not an object'],
    [
      'another schema',
      (e) => ({ ...e, schema_version: 'mcd-output/2' }),
      'mcd-output/1',
    ],
    ['another sensor', (e) => ({ ...e, mcd_id: 'MCD2' }), 'MCD2'],
    [
      'another cycle',
      (e) => ({ ...e, cycle_slot: '2026-09-18T20:50Z' }),
      'cycle',
    ],
    [
      'a status the board does not know',
      (e) => ({ ...e, status: 'FINE' }),
      'status',
    ],
    [
      'reasons that are not a list',
      (e) => ({ ...e, status_reasons: 'MCD0_DEFECT_M15' }),
      'reasons',
    ],
    [
      'a reason that is not a code',
      (e) => ({ ...e, status_reasons: ['not a code'] }),
      'reasons',
    ],
    [
      'more than twelve reasons',
      (e) => ({ ...e, status_reasons: Array(13).fill('A') }),
      'reasons',
    ],
    [
      'a CAUTIONARY reading with no reason',
      (e) => ({ ...e, status_reasons: [] }),
      'gives no reason',
    ],
    ['levels that are not a list', (e) => ({ ...e, levels: 4367 }), 'levels'],
    [
      'a level that is not an object',
      (e) => ({ ...e, levels: [4367] }),
      'levels',
    ],
    [
      'a level with a text price',
      (e) => ({ ...e, levels: [{ price: '4367' }] }),
      'levels',
    ],
    [
      'a level with an infinite price',
      (e) => ({ ...e, levels: [{ price: Infinity }] }),
      'levels',
    ],
    ['no summary', (e) => ({ ...e, summary_line: undefined }), 'summary'],
    ['an empty summary', (e) => ({ ...e, summary_line: '' }), 'summary'],
    [
      'a summary of 81 characters',
      (e) => ({ ...e, summary_line: 'x'.repeat(81) }),
      'summary',
    ],
    ['no state code', (e) => ({ ...e, state_code: null }), 'state code'],
    [
      'a malformed state code',
      (e) => ({ ...e, state_code: 'down_breakout' }),
      'state code',
    ],
    [
      'a state code of 49 characters',
      (e) => ({ ...e, state_code: `MCD1_${'A'.repeat(44)}` }),
      'state code',
    ],
    [
      'a state of another sensor',
      (e) => ({ ...e, state_code: 'MCD2_UP_IN_CORRIDOR' }),
      'is not a state of MCD1',
    ],
    [
      'a state the roster does not know',
      (e) => ({ ...e, state_code: 'MCD1_SIDEWAYS_GONE' }),
      'is not a state of MCD1',
    ],
    ['no bias', (e) => ({ ...e, bias: null }), 'bias'],
    ['an unknown bias', (e) => ({ ...e, bias: 'UP' }), 'bias'],
  ];

  it.each(REFUSED)('refuses %s', (_name, change, reason) => {
    const result = facts(change(clone(ok('MCD1'))));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain(reason);
  });

  describe('an unavailable reading (golden 14: MCD1 is STALE)', () => {
    const staleSlot = goldenWorlds().find((w) =>
      w.name.startsWith('14-')
    )!.slotIso;
    const staleFacts = (envelope: unknown) =>
      facts(envelope, 'MCD1', staleSlot);

    it('is accepted as stored: this is the control for the refusals below', () => {
      const result = staleFacts(stale());
      expect(result.ok).toBe(true);
      expect(result.ok && result.facts).toMatchObject({
        status: 'STALE',
        state_code: null,
        bias: null,
        reasons: ['NO_STATS_AT_SLOT'],
      });
    });

    it.each([
      ['a state code', { state_code: 'MCD1_UP_IN_CORRIDOR' }],
      ['a bias', { bias: 'LONG' }],
      ['both', { state_code: 'MCD1_UP_IN_CORRIDOR', bias: 'LONG' }],
    ])('refuses it with %s', (_name, change) => {
      expect(staleFacts({ ...clone(stale()), ...change })).toEqual({
        ok: false,
        reason: 'a STALE reading has a state code or a bias',
      });
      expect(
        staleFacts({ ...clone(stale()), status: 'INVALID', ...change })
      ).toEqual({
        ok: false,
        reason: 'a INVALID reading has a state code or a bias',
      });
    });

    it('refuses it when it gives no reason', () => {
      expect(staleFacts({ ...clone(stale()), status_reasons: [] })).toEqual({
        ok: false,
        reason: 'a STALE reading gives no reason',
      });
    });
  });

  it('names the cycle in the refusal of an envelope of another cycle', () => {
    expect(
      facts({ ...clone(ok('MCD1')), cycle_slot: '2026-09-18T20:50Z' })
    ).toEqual({
      ok: false,
      reason:
        'the envelope is of cycle 2026-09-18T20:50Z, not 2026-09-18T20:55Z',
    });
  });

  it('holds the reasons to 12, and a level to being an object with a price', () => {
    const base = clone(ok('MCD1'));
    expect(
      facts({ ...base, status_reasons: Array(12).fill('MCD0_DEFECT_M15') }).ok
    ).toBe(true);
    expect(
      facts({ ...base, status_reasons: Array(13).fill('MCD0_DEFECT_M15') })
    ).toEqual({
      ok: false,
      reason: 'the reasons are not a list of reason codes',
    });
    for (const levels of [[null], [{ price: null }], [{ name: 'x' }], 'x']) {
      expect(facts({ ...base, levels })).toEqual({
        ok: false,
        reason: 'the levels are not a list of prices',
      });
    }
    expect(facts({ ...base, levels: [] }).ok).toBe(true);
  });

  it('holds a state code to 48 characters before it asks the roster', () => {
    const base = clone(ok('MCD1'));
    const at48 = `MCD1_${'A'.repeat(43)}`;
    const at49 = `MCD1_${'A'.repeat(44)}`;
    expect(facts({ ...base, state_code: at48 })).toEqual({
      ok: false,
      reason: `${at48} is not a state of MCD1`,
    });
    expect(facts({ ...base, state_code: at49 })).toEqual({
      ok: false,
      reason: 'the state code is missing or malformed',
    });
  });

  it('accepts a VALID reading with no reason, and one with reasons', () => {
    const valid = { ...clone(ok('MCD1')), status: 'VALID', status_reasons: [] };
    expect(facts(valid).ok).toBe(true);
    expect(facts({ ...valid, status_reasons: ['MCD0_DEFECT_M15'] }).ok).toBe(
      true
    );
  });

  it('accepts a summary of exactly 80 characters and refuses one of 81', () => {
    const base = clone(ok('MCD1'));
    expect(facts({ ...base, summary_line: 'x'.repeat(80) }).ok).toBe(true);
    expect(facts({ ...base, summary_line: 'x'.repeat(81) }).ok).toBe(false);
  });

  it('reads the state against the roster it is given', () => {
    // a sensor the roster does not list has no state codes to belong to
    const stranger = { ...clone(ok('MCD1')), mcd_id: 'MCD9' };
    expect(facts(stranger, 'MCD9').ok).toBe(false);
  });

  it('names the problem and not the document', () => {
    const result = facts({ ...clone(ok('MCD1')), bias: 'UP' });
    expect(result).toEqual({ ok: false, reason: expect.any(String) });
    expect(JSON.stringify(result)).not.toContain('MCD1_DOWN');
  });
});

describe('the synthesis readings of every stored world', () => {
  const cases = WORLDS.flatMap((world) =>
    world.synthesis.map((row) => ({ world, row }))
  );

  it.each(cases.map((c) => [`${c.world.name} ${c.row.profile}`, c]))(
    '%s gives its facts',
    (_name, { world, row }) => {
      const reading = JSON.parse(row.reading_json) as Record<string, any>;
      const zones = JSON.parse(row.zones_json) as Record<string, any>[];
      const result = synthesisFactsOf(reading, zones, row.reference_price, {
        profile: row.profile,
        slot: world.slotIso,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const facts = result.facts;
      expect(facts.rule_id).toBe(reading['rule_id']);
      expect(facts.bias).toBe(reading['bias']);
      expect(facts.status).toBe(reading['status']);
      expect(facts.trend_relation).toBe(reading['trend_relation']);
      expect(facts.summary).toBe(reading['summary_line']);
      expect(facts.reference_price).toBe(row.reference_price);
      expect(facts.zone_sources).toEqual(
        orderedMcdIds(zones.flatMap((z) => z['source_sensors'] as string[]))
      );
      expect(facts.entry_price).toBe(
        zones.length === 0 ? null : zones[0]?.['reference_price']
      );
    }
  );

  it('has a zone source for every stored zone of the signed-off cycles', () => {
    const withZones = cases.filter((c) => c.row.zone_count > 0);
    expect(withZones.length).toBeGreaterThanOrEqual(20);
    for (const { row } of withZones) {
      for (const zone of JSON.parse(row.zones_json) as Record<string, any>[]) {
        expect(zone['source_sensors'].length).toBeGreaterThan(0);
      }
    }
  });
});

describe('a synthesis reading that must be refused', () => {
  const world = goldenWorlds()[0]!;
  const row = world.synthesis.find((r) => r.profile === 'DAY_TRADER')!;
  const reading = (): Record<string, any> =>
    clone(JSON.parse(row.reading_json));
  const zones = (): Record<string, any>[] => clone(JSON.parse(row.zones_json));
  const expected = { profile: 'DAY_TRADER' as const, slot: world.slotIso };
  const facts = (
    r: unknown,
    z: unknown[] = zones(),
    price: number | null = 4378.31
  ) => synthesisFactsOf(r, z, price, expected);

  it('accepts the stored reading', () => {
    expect(facts(reading()).ok).toBe(true);
  });

  const REFUSED: [string, (r: Record<string, any>) => unknown, string][] = [
    ['not an object', () => 'text', 'the reading is not an object'],
    ['null', () => null, 'the reading is not an object'],
    [
      'another schema',
      (r) => ({ ...r, schema_version: 'syn-output/2' }),
      'the reading is not syn-output/1',
    ],
    ['not SYN', (r) => ({ ...r, mcd_id: 'MCD1' }), 'the reading is not SYN'],
    [
      'the other trader type',
      (r) => ({ ...r, profile: 'SCALPER' }),
      'the reading is of SCALPER, not DAY_TRADER',
    ],
    [
      'another cycle',
      (r) => ({ ...r, cycle_slot: '2026-09-18T20:50Z' }),
      'the reading is of cycle 2026-09-18T20:50Z, not 2026-09-18T20:55Z',
    ],
    [
      'an unknown status',
      (r) => ({ ...r, status: 'FINE' }),
      'the status is not one the board knows',
    ],
    [
      'no rule id',
      (r) => ({ ...r, rule_id: null }),
      'the rule id is missing or malformed',
    ],
    [
      'a malformed rule id',
      (r) => ({ ...r, rule_id: 'rule one' }),
      'the rule id is missing or malformed',
    ],
    [
      'a rule id of 61 characters',
      (r) => ({ ...r, rule_id: `R1_${'A'.repeat(58)}` }),
      'the rule id is missing or malformed',
    ],
    [
      'an unknown bias',
      (r) => ({ ...r, bias: 'UP' }),
      'the bias is missing or unknown',
    ],
    [
      'an unknown trend relation',
      (r) => ({ ...r, trend_relation: 'SIDEWAYS' }),
      'the trend relation is unknown',
    ],
    [
      'an empty summary',
      (r) => ({ ...r, summary_line: '' }),
      'the summary is not 1 to 120 characters',
    ],
    [
      'a summary of 121 characters',
      (r) => ({ ...r, summary_line: 'x'.repeat(121) }),
      'the summary is not 1 to 120 characters',
    ],
    [
      'no list of zones',
      (r) => ({ ...r, zones: 'Z1' }),
      'the reading does not list its zones',
    ],
  ];
  it.each(REFUSED)('refuses %s', (_name, change, reason) => {
    expect(facts(change(reading()))).toEqual({ ok: false, reason });
  });

  it('accepts a rule id of exactly 60 characters', () => {
    expect(facts({ ...reading(), rule_id: `R1_${'A'.repeat(57)}` }).ok).toBe(
      true
    );
  });

  it('accepts a summary of exactly 120 characters', () => {
    expect(facts({ ...reading(), summary_line: 'x'.repeat(120) }).ok).toBe(
      true
    );
  });

  it('accepts a missing trend relation as null', () => {
    expect(facts({ ...reading(), trend_relation: null }).ok).toBe(true);
  });

  it.each([0, -1, NaN, Infinity])(
    'refuses a reference price of %p',
    (price) => {
      expect(facts(reading(), zones(), price)).toEqual({
        ok: false,
        reason: 'the reference price is not a positive number',
      });
    }
  );

  it('accepts the smallest prices: a cent, and one', () => {
    for (const price of [0.01, 1]) {
      const result = facts(reading(), zones(), price);
      expect(result.ok && result.facts.reference_price).toBe(price);
    }
  });

  it('accepts no reference price', () => {
    const result = facts(reading(), zones(), null);
    expect(result.ok && result.facts.reference_price).toBeNull();
  });

  it('refuses zones that are not the ones the reading names', () => {
    const reason =
      'the zones are not the ones the reading names, in the same order';
    expect(facts(reading(), zones().reverse())).toEqual({ ok: false, reason });
    expect(facts(reading(), zones().slice(1))).toEqual({ ok: false, reason });
    expect(facts(reading(), [])).toEqual({ ok: false, reason });
  });

  describe('a zone that is broken', () => {
    const change = (edit: (z: Record<string, any>) => unknown) => {
      const list = zones();
      list[0] = edit(list[0]!) as Record<string, any>;
      return facts(reading(), list);
    };

    it.each([
      ['a string', () => 'Z1', 'a zone is not an object'],
      ['null', () => null, 'a zone is not an object'],
      [
        'an id that is not Z1 to Z5',
        (z: any) => ({ ...z, zone_id: 'Z9' }),
        'a zone has no valid id',
      ],
      [
        'an id with a prefix',
        (z: any) => ({ ...z, zone_id: 'xZ1' }),
        'a zone has no valid id',
      ],
      [
        'an id with a suffix',
        (z: any) => ({ ...z, zone_id: 'Z1x' }),
        'a zone has no valid id',
      ],
      [
        'an id that is a number',
        (z: any) => ({ ...z, zone_id: 1 }),
        'a zone has no valid id',
      ],
      [
        'sources as text',
        (z: any) => ({ ...z, source_sensors: 'MCD2' }),
        'Z1 does not name its source sensors',
      ],
      [
        'sources as null',
        (z: any) => ({ ...z, source_sensors: null }),
        'Z1 does not name its source sensors',
      ],
      [
        'sources as an object',
        (z: any) => ({ ...z, source_sensors: {} }),
        'Z1 does not name its source sensors',
      ],
      [
        'a source that is not a sensor',
        (z: any) => ({ ...z, source_sensors: ['sr_levels'] }),
        'Z1 does not name its source sensors',
      ],
      [
        'a source with a prefix',
        (z: any) => ({ ...z, source_sensors: ['xMCD1'] }),
        'Z1 does not name its source sensors',
      ],
      [
        'a source that is a number',
        (z: any) => ({ ...z, source_sensors: [1] }),
        'Z1 does not name its source sensors',
      ],
      [
        'no reference price',
        (z: any) => ({ ...z, reference_price: null }),
        'Z1 has no valid reference price',
      ],
      [
        'a zero reference price',
        (z: any) => ({ ...z, reference_price: 0 }),
        'Z1 has no valid reference price',
      ],
      [
        'a negative reference price',
        (z: any) => ({ ...z, reference_price: -4 }),
        'Z1 has no valid reference price',
      ],
      [
        'an infinite reference price',
        (z: any) => ({ ...z, reference_price: Infinity }),
        'Z1 has no valid reference price',
      ],
    ])('refuses %s', (_name, edit, reason) => {
      expect(change(edit)).toEqual({ ok: false, reason });
    });

    it('accepts a reference price of a cent and a zone with no source', () => {
      expect(change((z) => ({ ...z, reference_price: 0.01 })).ok).toBe(true);
      const result = change((z) => ({ ...z, source_sensors: [] }));
      expect(result.ok && result.facts.zone_sources).toEqual(
        // the second zone still names its source
        orderedMcdIds((zones()[1]!['source_sensors'] as string[]) ?? [])
      );
    });
  });
});

describe('orderedMcdIds', () => {
  it('sorts by the number, drops repeats and strangers', () => {
    expect(
      orderedMcdIds([
        'MCD10',
        'MCD2',
        'MCD2',
        'sr_1',
        'MCD1',
        'MCD16',
        'mcd3',
        '',
      ])
    ).toEqual(['MCD1', 'MCD2', 'MCD10']);
  });

  it('takes any iterable', () => {
    expect(orderedMcdIds(new Set(['MCD3', 'MCD1']))).toEqual(['MCD1', 'MCD3']);
    expect(orderedMcdIds([])).toEqual([]);
  });
});

describe('isUsable', () => {
  it.each([
    ['VALID', true],
    ['CAUTIONARY', true],
    ['INVALID', false],
    ['STALE', false],
    ['ABSENT', false],
  ] as const)('%s is %s', (status, usable) => {
    expect(isUsable(status)).toBe(usable);
  });
});

// keep the type used: a facts value can be built by hand
export const _typeCheck: SensorFacts | null = null;
