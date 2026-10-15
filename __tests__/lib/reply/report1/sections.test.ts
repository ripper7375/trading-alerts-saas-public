/**
 * @jest-environment node
 */

/**
 * The parts of a reply that are the engines' alone (build step 7 part 5; decision D10): direction,
 * the channels, the levels, the entry zones, the news and the board. Each is copied from what the
 * packet carries; a damaged part is refused with its reason, never repaired.
 */

import { buildValueDictionary } from '@/lib/reply/checks/value-dictionary';
import type { ValueDictionary } from '@/lib/reply/checks/value-dictionary';
import type { IntakePacket } from '@/lib/reply/contracts/intake';
import { RESULT_LIMITS } from '@/lib/reply/contracts/result';
import {
  boardLines,
  channelLines,
  directionLine,
  levelLines,
  newsBlock,
  zoneLines,
} from '@/lib/reply/report1/sections';

import { fixtureFor } from '../checks/helpers/checks-fixtures';
import { packetOf, worldOf } from './helpers/report1-fixtures';

type Rec = Record<string, any>;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const ref = (patch: Rec = {}): Rec => ({
  name: 'sr_9',
  tf: 'M15',
  price: 4401.25,
  origin: 'sr_levels',
  ...patch,
});

/** The 18 Sep packet with one zone Z1 that the test shapes, and the dictionary built from it. */
async function craft(
  mutate: (zone: Rec) => void
): Promise<{ packet: IntakePacket; dictionary: ValueDictionary }> {
  const fx = await fixtureFor('01');
  const packet = clone(fx.packet) as IntakePacket;
  const synthesis = packet.readings.synthesis as NonNullable<
    IntakePacket['readings']['synthesis']
  >;
  const zone = synthesis.zones[0] as Rec;
  mutate(zone);
  synthesis.zones = [zone];
  return { packet, dictionary: buildValueDictionary(packet, fx.dayBars) };
}

const contextOf = (packet: IntakePacket, dictionary: ValueDictionary) =>
  levelLines(packet, dictionary).filter((level) => level.kind === 'CONTEXT');

// ---------------------------------------------------------------------------

describe('direction', () => {
  it("is the synthesis reading's, field for field", () => {
    expect(directionLine(packetOf('01'))).toEqual({
      ok: true,
      value: {
        bias: 'LONG',
        trend_relation: 'COUNTER_TREND',
        rule_id: 'R1_MACRO_COUNTER_TREND_RALLY',
        archetype: 'C',
        stand_aside: false,
        profile: 'DAY_TRADER',
      },
    });
  });

  it('has no source when the packet carries no synthesis reading', () => {
    const packet = packetOf('01');
    const none = {
      ...packet,
      readings: { ...packet.readings, synthesis: null },
    };
    expect(directionLine(none)).toEqual({
      ok: false,
      failure: {
        code: 'NO_SYNTHESIS',
        detail: 'the packet carries no synthesis reading',
      },
    });
  });

  const BROKEN: [string, (reading: Rec) => void, string][] = [
    [
      'an unknown bias',
      (r) => (r['bias'] = 'UP'),
      'the reading has no bias the contract knows',
    ],
    [
      'no bias',
      (r) => delete r['bias'],
      'the reading has no bias the contract knows',
    ],
    [
      'a numeric bias',
      (r) => (r['bias'] = 1),
      'the reading has no bias the contract knows',
    ],
    [
      'an unknown trend relation',
      (r) => (r['trend_relation'] = 'SIDEWAYS'),
      'the trend relation is not one the contract knows',
    ],
    [
      'a numeric trend relation',
      (r) => (r['trend_relation'] = 1),
      'the trend relation is not one the contract knows',
    ],
    [
      'a malformed rule id',
      (r) => (r['rule_id'] = 'rule one'),
      'the rule id is missing or malformed',
    ],
    [
      'no rule id',
      (r) => delete r['rule_id'],
      'the rule id is missing or malformed',
    ],
    [
      'a numeric rule id',
      (r) => (r['rule_id'] = 4),
      'the rule id is missing or malformed',
    ],
    [
      'an unknown archetype',
      (r) => (r['archetype'] = 'Z'),
      'the archetype is not one the contract knows',
    ],
    [
      'a numeric archetype',
      (r) => (r['archetype'] = 1),
      'the archetype is not one the contract knows',
    ],
    [
      'no stand-aside flag',
      (r) => delete r['stand_aside'],
      'the stand-aside flag is missing',
    ],
    [
      'a stand-aside flag that is text',
      (r) => (r['stand_aside'] = 'no'),
      'the stand-aside flag is missing',
    ],
  ];

  it.each(BROKEN)(
    'is refused with %s, and says why',
    (_what, damage, detail) => {
      const packet = clone(packetOf('01'));
      damage((packet.readings.synthesis as any).reading);
      expect(directionLine(packet)).toEqual({
        ok: false,
        failure: { code: 'BAD_SYNTHESIS', detail },
      });
    }
  );

  it('takes every archetype, every bias and every trend relation of the contract', () => {
    for (const archetype of ['A', 'B', 'C', 'D', null]) {
      for (const bias of ['LONG', 'SHORT', 'NEUTRAL', 'STAND_ASIDE']) {
        for (const relation of ['WITH_TREND', 'COUNTER_TREND', null]) {
          const packet = clone(packetOf('01'));
          Object.assign((packet.readings.synthesis as any).reading, {
            archetype,
            bias,
            trend_relation: relation,
          });
          expect(directionLine(packet)).toMatchObject({
            ok: true,
            value: { archetype, bias, trend_relation: relation },
          });
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------

describe('the channels', () => {
  it('are the M15 and the M5 channel sensors of the board, with their statuses', () => {
    expect(channelLines(packetOf('01'))).toEqual([
      {
        mcd_id: 'MCD1',
        timeframe: 'M15',
        status: 'CAUTIONARY',
        state_code: 'MCD1_DOWN_UPPER_BREAKOUT',
        bias: 'LONG',
      },
      {
        mcd_id: 'MCD2',
        timeframe: 'M5',
        status: 'CAUTIONARY',
        state_code: 'MCD2_UP_IN_CORRIDOR',
        bias: 'LONG',
      },
    ]);
  });

  it('are found wherever they sit on the board: a sensor that is not a channel before them does not stop the search', () => {
    const packet = clone(packetOf('01'));
    const [m1, m2, m3] = packet.board.sensors;
    packet.board.sensors = [m3, m1, m2] as typeof packet.board.sensors;
    expect(channelLines(packet).map((c) => c.mcd_id)).toEqual(['MCD1', 'MCD2']);
  });

  it('skip a sensor the roster does not know and a gate that has no line on the board', () => {
    const packet = clone(packetOf('01'));
    const line = (id: string) => ({ ...packet.board.sensors[0], mcd_id: id });
    packet.board.sensors = [
      line('MCD9'),
      line('MCD0'),
      ...packet.board.sensors,
    ] as typeof packet.board.sensors;
    expect(channelLines(packet).map((c) => c.mcd_id)).toEqual(['MCD1', 'MCD2']);
  });

  it('list an unavailable channel with its status and no state, never dropped (ADR-040)', () => {
    const packet = clone(packetOf('01'));
    packet.board.sensors[1] = {
      mcd_id: 'MCD2',
      status: 'ABSENT',
      state_code: null,
      bias: null,
      summary: null,
      reasons: ['NO_ROW'],
    };
    expect(channelLines(packet)[1]).toEqual({
      mcd_id: 'MCD2',
      timeframe: 'M5',
      status: 'ABSENT',
      state_code: null,
      bias: null,
    });
  });

  it('are none when the sensors are not live', () => {
    const packet = clone(packetOf('01'));
    packet.board.sensors = [];
    expect(channelLines(packet)).toEqual([]);
  });

  it('keep at most the four the result holds', () => {
    const packet = clone(packetOf('01'));
    const one = packet.board
      .sensors[0] as (typeof packet.board.sensors)[number];
    packet.board.sensors = Array.from({ length: 6 }, () => one);
    expect(channelLines(packet)).toHaveLength(RESULT_LIMITS.channels);
    expect(RESULT_LIMITS.channels).toBe(4);
  });
});

// ---------------------------------------------------------------------------

describe('the levels', () => {
  it('are the channel geometry and the context levels of the 18 Sep cycle, highest first, ties by id', async () => {
    const { packet, dictionary } = await worldOf('01');
    expect(
      levelLines(packet, dictionary).map(
        (l) => `${l.id}|${l.kind}|${l.timeframe}|${l.name}|${l.price}`
      )
    ).toEqual([
      'MCD2.UOEDT|CHANNEL|M5|UOEDT|4384.23',
      'MCD3.M5.UOEDT|CHANNEL|M5|UOEDT|4384.23',
      'Z1.next_opposing|CONTEXT|M15|sr_1|4369.57',
      'MCD2.baseline|CHANNEL|M5|baseline|4367.2',
      'MCD3.M5.baseline|CHANNEL|M5|baseline|4367.2',
      'Z1.invalidation_level|CONTEXT|M15|sr_2|4350.92',
      'MCD2.LOEDT|CHANNEL|M5|LOEDT|4350.16',
      'MCD3.M5.LOEDT|CHANNEL|M5|LOEDT|4350.16',
      'Z2.invalidation_level|CONTEXT|M15|sr_3|4334.56',
      'MCD1.UOEDT|CHANNEL|M15|UOEDT|4279.46',
      'MCD3.M15.UOEDT|CHANNEL|M15|UOEDT|4279.46',
      'MCD1.baseline|CHANNEL|M15|baseline|4214.17',
      'MCD3.M15.baseline|CHANNEL|M15|baseline|4214.17',
      'MCD1.LOEDT|CHANNEL|M15|LOEDT|4126.24',
      'MCD3.M15.LOEDT|CHANNEL|M15|LOEDT|4126.24',
    ]);
  });

  it('come out in the same order whatever order the sensors were given in', async () => {
    const { packet, dictionary } = await worldOf('01');
    const reversed = clone(packet);
    reversed.readings.sensors.reverse();
    expect(levelLines(reversed, dictionary)).toEqual(
      levelLines(packet, dictionary)
    );
  });

  it('give a level two zones name to the first zone in rank order', async () => {
    const { packet, dictionary } = await worldOf('01');
    const reversed = clone(packet);
    (reversed.readings.synthesis as any).zones.reverse();
    const sr2 = (p: IntakePacket) =>
      levelLines(p, dictionary).find((l) => l.name === 'sr_2')?.id;
    expect(sr2(packet)).toBe('Z1.invalidation_level');
    expect(sr2(reversed)).toBe('Z2.next_opposing');
  });

  it('list a context level once, though several zones and refs name it', async () => {
    const { packet, dictionary } = await worldOf('01');
    const names = contextOf(packet, dictionary).map((l) => l.name);
    expect(names).toEqual(['sr_1', 'sr_2', 'sr_3']); // sr_1 and sr_2 are named by two refs each
  });

  it('leave out a level the dictionary does not hold at that price, and keep one within a billionth', async () => {
    const { packet, dictionary } = await worldOf('01');
    const shifted = (by: number): ValueDictionary => {
      const entries = dictionary.entries.map((e) =>
        e.id === 'MCD2.baseline' ? { ...e, value: e.value + by } : e
      );
      return { entries, byId: new Map(entries.map((e) => [e.id, e])) };
    };
    const has = (d: ValueDictionary) =>
      levelLines(packet, d).some((l) => l.id === 'MCD2.baseline');
    expect(has(dictionary)).toBe(true);
    expect(has(shifted(1e-10))).toBe(true);
    expect(has(shifted(0.01))).toBe(false);
    expect(has(shifted(0.5))).toBe(false);
    expect(has(shifted(-0.5))).toBe(false);
    // a level whose entry is not a price is not a level either
    const asDistance = {
      entries: dictionary.entries.map((e) =>
        e.id === 'MCD2.baseline' ? { ...e, kind: 'DISTANCE' as const } : e
      ),
      byId: new Map<string, any>(),
    };
    asDistance.byId = new Map(asDistance.entries.map((e) => [e.id, e]));
    expect(has(asDistance)).toBe(false);
  });

  it('give a timeframe the contract does not know no timeframe', async () => {
    const fx = await fixtureFor('01');
    const packet = clone(fx.packet) as IntakePacket;
    const sensor = packet.readings.sensors.find(
      (s) => s.mcd_id === 'MCD2'
    ) as Rec;
    sensor['envelope']['levels'][0]['tf'] = 'H1';
    const dictionary = buildValueDictionary(packet, fx.dayBars);
    const odd = levelLines(packet, dictionary).find(
      (l) => l.price === 4384.23 && l.id.startsWith('MCD2')
    );
    expect(odd).toMatchObject({ timeframe: null, name: 'UOEDT' });
  });

  it('quote a level whose name is too long to form an id by its position', async () => {
    const fx = await fixtureFor('01');
    const packet = clone(fx.packet) as IntakePacket;
    const sensor = packet.readings.sensors.find(
      (s) => s.mcd_id === 'MCD2'
    ) as Rec;
    const long = 'channel'.repeat(5); // 35 characters: a level name may be 40, a part of an id 32
    sensor['envelope']['levels'][1]['name'] = long;
    const dictionary = buildValueDictionary(packet, fx.dayBars);
    const level = levelLines(packet, dictionary).find((l) => l.name === long);
    expect(level).toMatchObject({
      id: 'MCD2.lvl_2',
      kind: 'CHANNEL',
      price: 4367.2,
    });
  });

  it('leave out a level whose name the line cannot show safely (it comes back quoted)', async () => {
    const fx = await fixtureFor('01');
    const packet = clone(fx.packet) as IntakePacket;
    const sensor = packet.readings.sensors.find(
      (s) => s.mcd_id === 'MCD2'
    ) as Rec;
    sensor['envelope']['levels'][1]['name'] = '_hidden';
    const dictionary = buildValueDictionary(packet, fx.dayBars);
    expect(
      levelLines(packet, dictionary).some(
        (l) => l.price === 4367.2 && l.id.startsWith('MCD2')
      )
    ).toBe(false);
  });

  it('leave out a level whose name the result cannot carry', async () => {
    const fx = await fixtureFor('01');
    const packet = clone(fx.packet) as IntakePacket;
    const sensor = packet.readings.sensors.find(
      (s) => s.mcd_id === 'MCD2'
    ) as Rec;
    sensor['envelope']['levels'][1]['name'] = 'x'.repeat(41);
    const dictionary = buildValueDictionary(packet, fx.dayBars);
    expect(
      levelLines(packet, dictionary).some((l) => l.name.startsWith('xxxx'))
    ).toBe(false);
  });

  describe('the context levels of a zone', () => {
    it("are named by the zone's refs: its invalidation level, its next opposing level and its confluence", async () => {
      const { packet, dictionary } = await craft((zone) => {
        zone['invalidation_level'] = ref({ name: 'sr_7', price: 4300.5 });
        zone['next_opposing_level'] = ref({ name: 'sr_8', price: 4400.5 });
        zone['confluence_levels'] = [
          ref({ name: 'sr_9', price: 4410.5 }),
          ref({ name: 'sr_10', price: 4420.5 }),
        ];
      });
      expect(
        contextOf(packet, dictionary).map((l) => `${l.id}|${l.name}|${l.price}`)
      ).toEqual([
        'Z1.confluence_2|sr_10|4420.5',
        'Z1.confluence_1|sr_9|4410.5',
        'Z1.next_opposing|sr_8|4400.5',
        'Z1.invalidation_level|sr_7|4300.5',
      ]);
    });

    it('are the same level once: the first ref to name it gives its id', async () => {
      const same = ref({ name: 'sr_5', price: 4390.75 });
      const { packet, dictionary } = await craft((zone) => {
        zone['invalidation_level'] = same;
        zone['next_opposing_level'] = { ...same };
        zone['confluence_levels'] = [{ ...same }];
      });
      expect(contextOf(packet, dictionary).map((l) => l.id)).toEqual([
        'Z1.invalidation_level',
      ]);
    });

    it('go on to the refs after one that repeats a level already listed', async () => {
      const same = ref({ name: 'sr_5', price: 4390.75 });
      const { packet, dictionary } = await craft((zone) => {
        zone['invalidation_level'] = same;
        zone['next_opposing_level'] = { ...same };
        zone['confluence_levels'] = [ref({ name: 'sr_6', price: 4388.5 })];
      });
      expect(contextOf(packet, dictionary).map((l) => l.id)).toEqual([
        'Z1.invalidation_level',
        'Z1.confluence_1',
      ]);
    });

    it('stay two levels when the timeframe, the name or the price differs', async () => {
      const { packet, dictionary } = await craft((zone) => {
        zone['invalidation_level'] = ref({
          name: 'sr_5',
          tf: 'M15',
          price: 4390.75,
        });
        zone['next_opposing_level'] = ref({
          name: 'sr_5',
          tf: 'M5',
          price: 4390.75,
        });
        zone['confluence_levels'] = [
          ref({ name: 'sr_6', tf: 'M15', price: 4390.75 }),
          ref({ name: 'sr_5', tf: 'M15', price: 4391.75 }),
        ];
      });
      expect(contextOf(packet, dictionary)).toHaveLength(4);
    });

    it('survive a damaged ref before them: the next ref is still read', async () => {
      const { packet, dictionary } = await craft((zone) => {
        zone['invalidation_level'] = null;
        zone['next_opposing_level'] = ref({ name: 'sr_8', price: 4400.5 });
        zone['confluence_levels'] = [
          null,
          'text',
          ref({ name: 'sr_9', price: 4410.5 }),
        ];
      });
      expect(contextOf(packet, dictionary).map((l) => l.id)).toEqual([
        'Z1.confluence_3',
        'Z1.next_opposing',
      ]);
    });

    const DAMAGED: [string, Rec | null | string][] = [
      ['a ref that is not an object', 'sr_8'],
      ['a ref that is null', null],
      ['a name that is not text', ref({ name: 8 })],
      ['no name', ref({ name: undefined })],
      ['a name the result cannot carry', ref({ name: 'bad name!' })],
      ['a name that is empty', ref({ name: '' })],
      ['a price that is not a number', ref({ price: '4401.25' })],
      ['a price that is not finite', ref({ price: Number.POSITIVE_INFINITY })],
      ['no price', ref({ price: undefined })],
      ['no origin', ref({ origin: undefined })],
      ['an origin that is not text', ref({ origin: 7 })],
      [
        'a sensor as its origin (its level is listed from the envelope)',
        ref({ origin: 'MCD2' }),
      ],
      ['a sensor with more digits as its origin', ref({ origin: 'MCD12' })],
    ];

    it.each(DAMAGED)(
      'leaves out %s and keeps the rest',
      async (_what, damaged) => {
        const { packet, dictionary } = await craft((zone) => {
          zone['invalidation_level'] = damaged;
          zone['next_opposing_level'] = ref({ name: 'sr_8', price: 4400.5 });
          zone['confluence_levels'] = [];
        });
        expect(contextOf(packet, dictionary).map((l) => l.id)).toEqual([
          'Z1.next_opposing',
        ]);
      }
    );

    it('leave out a ref whose dictionary entry is missing or at another price', async () => {
      const { packet, dictionary } = await craft((zone) => {
        zone['invalidation_level'] = ref({ name: 'sr_7', price: 4300.5 });
        zone['next_opposing_level'] = ref({ name: 'sr_8', price: 4400.5 });
        zone['confluence_levels'] = [];
      });
      const without = (id: string): ValueDictionary => {
        const entries = dictionary.entries.filter((e) => e.id !== id);
        return { entries, byId: new Map(entries.map((e) => [e.id, e])) };
      };
      expect(
        contextOf(packet, without('Z1.invalidation_level')).map((l) => l.id)
      ).toEqual(['Z1.next_opposing']);
      const moved = {
        entries: dictionary.entries.map((e) =>
          e.id === 'Z1.next_opposing' ? { ...e, value: e.value + 1 } : e
        ),
        byId: new Map<string, any>(),
      };
      moved.byId = new Map(moved.entries.map((e) => [e.id, e]));
      expect(contextOf(packet, moved).map((l) => l.id)).toEqual([
        'Z1.invalidation_level',
      ]);
    });

    it('never lets a ref with no price pass for a dictionary entry that happens to be zero', async () => {
      const { packet, dictionary } = await craft((zone) => {
        zone['invalidation_level'] = ref({ price: 'not a price' });
        zone['next_opposing_level'] = null;
        zone['confluence_levels'] = [];
      });
      const zero = {
        id: 'Z1.invalidation_level',
        kind: 'PRICE' as const,
        value: 0,
        tolerance: 0.05,
        addressable: false,
      };
      const entries = [...dictionary.entries, zero];
      const withZero = {
        entries,
        byId: new Map(entries.map((e) => [e.id, e])),
      };
      expect(contextOf(packet, withZero)).toEqual([]);
    });

    it('give a ref with no timeframe no timeframe, and keep it', async () => {
      const { packet, dictionary } = await craft((zone) => {
        zone['invalidation_level'] = ref({
          name: 'sr_7',
          price: 4300.5,
          tf: undefined,
        });
        zone['next_opposing_level'] = null;
        zone['confluence_levels'] = [];
      });
      expect(contextOf(packet, dictionary)).toEqual([
        {
          id: 'Z1.invalidation_level',
          kind: 'CONTEXT',
          timeframe: null,
          name: 'sr_7',
          price: 4300.5,
        },
      ]);
    });

    it('are none from a zone with no id, or one whose id cannot start a value id, and a zone without confluence is fine', async () => {
      const noId = await craft((zone) => {
        delete zone['zone_id'];
        zone['invalidation_level'] = ref({ name: 'sr_7', price: 4300.5 });
      });
      expect(contextOf(noId.packet, noId.dictionary)).toEqual([]);
      const odd = await craft((zone) => {
        zone['zone_id'] = 'z 1';
        zone['next_opposing_level'] = ref({ name: 'sr_8', price: 4400.5 });
      });
      expect(contextOf(odd.packet, odd.dictionary)).toEqual([]);
      const bare = await craft((zone) => {
        delete zone['confluence_levels'];
        zone['next_opposing_level'] = ref({ name: 'sr_8', price: 4400.5 });
      });
      expect(
        contextOf(bare.packet, bare.dictionary).map((l) => l.id)
      ).toContain('Z1.next_opposing');
      const notAList = await craft((zone) => {
        zone['invalidation_level'] = null;
        zone['confluence_levels'] = { 0: ref() };
        zone['next_opposing_level'] = ref({ name: 'sr_8', price: 4400.5 });
      });
      expect(
        contextOf(notAList.packet, notAList.dictionary).map((l) => l.id)
      ).toEqual(['Z1.next_opposing']);
    });
  });

  it('are none when the packet has no readings and no synthesis', async () => {
    const { packet, dictionary } = await worldOf('01');
    const bare = {
      ...packet,
      readings: { m_star: [], sensors: [], synthesis: null },
    };
    expect(levelLines(bare, dictionary)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe('the zones', () => {
  const fail = (code: string, detail: string) => ({
    ok: false,
    failure: { code, detail },
  });
  const zonesOf = async (
    mutate: (zone: Rec) => void,
    chosen: string[] = ['Z1']
  ) => {
    const { packet } = await craft(mutate);
    return zoneLines(packet, chosen);
  };

  it('are the stored zones the model picked, in its order', async () => {
    const { packet } = await worldOf('01');
    const picked = zoneLines(packet, ['Z2', 'Z1']);
    expect(picked.ok && picked.value.map((z) => z.zone_id)).toEqual([
      'Z2',
      'Z1',
    ]);
    expect(zoneLines(packet, [])).toEqual({ ok: true, value: [] });
  });

  it('refuse a zone the reading does not have, and say which', async () => {
    const { packet } = await worldOf('01');
    expect(zoneLines(packet, ['Z4'])).toEqual(
      fail('UNKNOWN_ZONE', 'Z4 is not a zone of this reading')
    );
    expect(zoneLines(packet, ['Z1', 'Z4'])).toEqual(
      fail('UNKNOWN_ZONE', 'Z4 is not a zone of this reading')
    );
    const none = {
      ...packet,
      readings: { ...packet.readings, synthesis: null },
    };
    expect(zoneLines(none, ['Z1'])).toEqual(
      fail('UNKNOWN_ZONE', 'Z1 is not a zone of this reading')
    );
    expect(zoneLines(none, [])).toEqual({ ok: true, value: [] });
  });

  const DAMAGE: [string, (z: Rec) => void, string][] = [
    [
      'a bias that is not a side',
      (z) => (z['bias'] = 'NEUTRAL'),
      'Z1: the bias is not LONG or SHORT',
    ],
    ['no bias', (z) => delete z['bias'], 'Z1: the bias is not LONG or SHORT'],
    [
      'an unknown basis',
      (z) => (z['invalidation_basis'] = 'GUESS'),
      'Z1: the invalidation basis is not one the contract knows',
    ],
    [
      'no basis',
      (z) => delete z['invalidation_basis'],
      'Z1: the invalidation basis is not one the contract knows',
    ],
    [
      'a negative low',
      (z) => (z['low'] = -1),
      'Z1: a price of the zone is missing or not a number',
    ],
    [
      'a high that is text',
      (z) => (z['high'] = '1'),
      'Z1: a price of the zone is missing or not a number',
    ],
    [
      'no reference price',
      (z) => delete z['reference_price'],
      'Z1: a price of the zone is missing or not a number',
    ],
    [
      'no invalidation price',
      (z) => delete z['invalidation_price'],
      'Z1: a price of the zone is missing or not a number',
    ],
    [
      'an infinite stop distance',
      (z) => (z['stop_distance'] = Number.POSITIVE_INFINITY),
      'Z1: a price of the zone is missing or not a number',
    ],
    [
      'a negative stop distance',
      (z) => (z['stop_distance'] = -0.5),
      'Z1: a price of the zone is missing or not a number',
    ],
    [
      'a band that starts above where it ends',
      (z) => ((z['low'] = 4400), (z['high'] = 4399.99)),
      'Z1: the band starts above where it ends',
    ],
    [
      'a runway that is text',
      (z) => (z['runway'] = 'far'),
      'Z1: the runway or the next opposing level is not a number',
    ],
    [
      'a negative runway',
      (z) => (z['runway'] = -1),
      'Z1: the runway or the next opposing level is not a number',
    ],
    [
      'a negative runway ratio',
      (z) => (z['runway_ratio'] = -0.1),
      'Z1: the runway or the next opposing level is not a number',
    ],
    [
      'a next opposing level at a negative price',
      (z) => (z['next_opposing_level'] = { price: -1 }),
      'Z1: the runway or the next opposing level is not a number',
    ],
    [
      'sources that are not a list',
      (z) => (z['source_sensors'] = 'MCD2'),
      'Z1: the source sensors are not a list of sensor ids',
    ],
    [
      'a source that is not a sensor',
      (z) => (z['source_sensors'] = ['MCD99']),
      'Z1: the source sensors are not a list of sensor ids',
    ],
    [
      'a source that is the gate',
      (z) => (z['source_sensors'] = ['MCD0']),
      'Z1: the source sensors are not a list of sensor ids',
    ],
    [
      'a good source and a bad one',
      (z) => (z['source_sensors'] = ['MCD2', 'MCD99']),
      'Z1: the source sensors are not a list of sensor ids',
    ],
    [
      'a bad source and a good one',
      (z) => (z['source_sensors'] = ['MCD99', 'MCD2']),
      'Z1: the source sensors are not a list of sensor ids',
    ],
    [
      'a source twice',
      (z) => (z['source_sensors'] = ['MCD2', 'MCD2']),
      'Z1: the source sensors are not a list of sensor ids',
    ],
    [
      'a source that is a number',
      (z) => (z['source_sensors'] = [2]),
      'Z1: the source sensors are not a list of sensor ids',
    ],
    [
      'a confluence count that is not whole',
      (z) => (z['confluence_count'] = 1.5),
      'Z1: the confluence count is not a whole number up to 64',
    ],
    [
      'a confluence count over 64',
      (z) => (z['confluence_count'] = 65),
      'Z1: the confluence count is not a whole number up to 64',
    ],
    [
      'a negative confluence count',
      (z) => (z['confluence_count'] = -1),
      'Z1: the confluence count is not a whole number up to 64',
    ],
    [
      'a confluence count that is text',
      (z) => (z['confluence_count'] = '2'),
      'Z1: the confluence count is not a whole number up to 64',
    ],
  ];

  it.each(DAMAGE)(
    'refuse %s, and say what is wrong',
    async (_what, damage, detail) => {
      expect(await zonesOf(damage)).toEqual(fail('BAD_ZONE', detail));
    }
  );

  it('refuse a zone whose id is not one of Z1 to Z5', async () => {
    expect(await zonesOf((z) => (z['zone_id'] = 'ZZ'), ['ZZ'])).toEqual(
      fail('BAD_ZONE', 'a stored zone has no zone id')
    );
    expect(await zonesOf((z) => (z['zone_id'] = 'Z6'), ['Z6'])).toEqual(
      fail('BAD_ZONE', 'a stored zone has no zone id')
    );
  });

  it('take zero where zero is a figure: a price, a stop, a runway, a ratio, a count', async () => {
    const zeros = await zonesOf((z) => {
      Object.assign(z, {
        low: 0,
        high: 0,
        reference_price: 0,
        invalidation_price: 0,
        stop_distance: 0,
        runway: 0,
        runway_ratio: 0,
        next_opposing_level: { price: 0 },
        confluence_count: 0,
        source_sensors: [],
      });
    });
    expect(zeros).toMatchObject({
      ok: true,
      value: [
        {
          low: 0,
          high: 0,
          reference_price: 0,
          invalidation_price: 0,
          stop_distance: 0,
          runway: 0,
          runway_ratio: 0,
          next_opposing_price: 0,
          confluence_count: 0,
          source_sensors: [],
        },
      ],
    });
  });

  it('take a band of no width, a fractional stop and the biggest count', async () => {
    const edge = await zonesOf((z) => {
      Object.assign(z, {
        low: 4400,
        high: 4400,
        stop_distance: 0.5,
        runway: 0.25,
        confluence_count: 64,
      });
    });
    expect(edge).toMatchObject({
      ok: true,
      value: [
        {
          low: 4400,
          high: 4400,
          stop_distance: 0.5,
          runway: 0.25,
          confluence_count: 64,
        },
      ],
    });
  });

  it('take all fifteen sensors as sources, once each', async () => {
    const all = Array.from({ length: 15 }, (_, i) => `MCD${i + 1}`);
    const fifteen = await zonesOf((z) => (z['source_sensors'] = all));
    expect(fifteen).toMatchObject({
      ok: true,
      value: [{ source_sensors: all }],
    });
  });

  it('take a missing runway, ratio and next level as none', async () => {
    const none = await zonesOf((z) => {
      delete z['runway'];
      delete z['runway_ratio'];
      delete z['next_opposing_level'];
    });
    expect(none).toMatchObject({
      ok: true,
      value: [{ runway: null, runway_ratio: null, next_opposing_price: null }],
    });
    const nulls = await zonesOf((z) => {
      z['runway'] = null;
      z['runway_ratio'] = null;
      z['next_opposing_level'] = { name: 'x', price: null };
    });
    expect(nulls).toMatchObject({
      ok: true,
      value: [{ runway: null, next_opposing_price: null }],
    });
  });

  it('share nothing with the packet', async () => {
    const { packet } = await worldOf('01');
    const picked = zoneLines(packet, ['Z1']);
    if (!picked.ok) throw new Error('refused');
    picked.value[0]?.source_sensors.push('MCD3');
    expect((packet.readings.synthesis as any).zones[0].source_sensors).toEqual([
      'MCD2',
    ]);
  });
});

// ---------------------------------------------------------------------------

describe('the news and the board', () => {
  it('carry the calendar as the packet has it, and share nothing with it', () => {
    const packet = clone(packetOf('01'));
    const block = newsBlock(packet);
    expect(block).toEqual({
      status: 'OK',
      calendar_age_seconds: 120,
      items: packet.events.items,
    });
    block.items.push(block.items[0] as (typeof block.items)[number]);
    (block.items[0] as Rec)['approximate'] = true;
    expect(packet.events.items).toHaveLength(1);
    expect((packet.events.items[0] as Rec)['approximate']).toBe(false);
  });

  it('is the id, the status and the state code of each sensor and nothing else', () => {
    const packet = packetOf('01');
    expect(boardLines(packet)).toEqual([
      {
        mcd_id: 'MCD1',
        status: 'CAUTIONARY',
        state_code: 'MCD1_DOWN_UPPER_BREAKOUT',
      },
      {
        mcd_id: 'MCD2',
        status: 'CAUTIONARY',
        state_code: 'MCD2_UP_IN_CORRIDOR',
      },
      {
        mcd_id: 'MCD3',
        status: 'CAUTIONARY',
        state_code: 'MCD3_NON_CONSOLIDATED_TREND_CONFLICT',
      },
    ]);
  });

  it('lists an absent sensor with no state, keeps the order, and holds at most sixteen', () => {
    const packet = clone(packetOf('01'));
    packet.board.sensors[0] = {
      mcd_id: 'MCD1',
      status: 'ABSENT',
      state_code: null,
      bias: null,
      summary: null,
      reasons: ['NO_ROW'],
    };
    expect(boardLines(packet)[0]).toEqual({
      mcd_id: 'MCD1',
      status: 'ABSENT',
      state_code: null,
    });
    const one = packet.board
      .sensors[1] as (typeof packet.board.sensors)[number];
    packet.board.sensors = Array.from({ length: 20 }, () => one);
    expect(boardLines(packet)).toHaveLength(16);
    expect(RESULT_LIMITS.boardLines).toBe(16);
  });

  it('leaves out a line whose id is not a sensor the result can name', () => {
    const packet = clone(packetOf('01'));
    const line = packet.board
      .sensors[0] as (typeof packet.board.sensors)[number];
    packet.board.sensors = [
      { ...line, mcd_id: 'MCD0' },
      { ...line, mcd_id: 'MCD16' },
      { ...line, mcd_id: 'sensor' },
      line,
    ];
    expect(boardLines(packet).map((l) => l.mcd_id)).toEqual(['MCD1']);
  });

  it('is empty when the sensors are not live', () => {
    const packet = clone(packetOf('01'));
    packet.board.sensors = [];
    expect(boardLines(packet)).toEqual([]);
  });
});
