/**
 * @jest-environment node
 */

import { VALUE_ID } from '@/lib/reply/contracts/shape';
import {
  DAY_IDS,
  FIXED_VALUE_IDS,
  LAST_PRICE_ID,
  PROFILE_FIELDS,
  ZONE_FIELDS,
  eventValueId,
  levelValueIds,
  profileValueId,
  zoneValueId,
} from '@/lib/reply/context/values';

describe('the fixed ids', () => {
  it('are the last price and the three values of the day line', () => {
    expect(LAST_PRICE_ID).toBe('LAST_PRICE');
    expect(DAY_IDS).toEqual({
      open: 'DAY.open',
      high: 'DAY.high',
      low: 'DAY.low',
    });
    expect(FIXED_VALUE_IDS).toEqual([
      'LAST_PRICE',
      'DAY.open',
      'DAY.high',
      'DAY.low',
    ]);
  });

  it('fit the grammar of a value id', () => {
    for (const id of FIXED_VALUE_IDS) expect(VALUE_ID.test(id)).toBe(true);
  });
});

describe('profileValueId', () => {
  it('names the four profile values the model may quote', () => {
    expect(PROFILE_FIELDS).toEqual([
      'max_risk_pct',
      'max_leverage',
      'target_rrr',
      'min_sld',
    ]);
    expect(PROFILE_FIELDS.map(profileValueId)).toEqual([
      'PROFILE.max_risk_pct',
      'PROFILE.max_leverage',
      'PROFILE.target_rrr',
      'PROFILE.min_sld',
    ]);
    for (const field of PROFILE_FIELDS)
      expect(VALUE_ID.test(profileValueId(field))).toBe(true);
  });
});

describe('zoneValueId', () => {
  it('names the six fields of a stored zone', () => {
    expect(ZONE_FIELDS).toEqual([
      'low',
      'high',
      'reference',
      'invalidation',
      'stop_distance',
      'runway',
    ]);
    expect(zoneValueId('Z1', 'invalidation')).toBe('Z1.invalidation');
    expect(zoneValueId('Z5', 'stop_distance')).toBe('Z5.stop_distance');
    for (const field of ZONE_FIELDS)
      expect(VALUE_ID.test(zoneValueId('Z2', field) as string)).toBe(true);
  });

  it('gives no id for a zone id that cannot form one', () => {
    expect(zoneValueId('zone one', 'low')).toBeNull();
    expect(zoneValueId('', 'low')).toBeNull();
    expect(zoneValueId('z1', 'low')).toBeNull();
    expect(zoneValueId('Z1\n@@', 'low')).toBeNull();
  });
});

describe('eventValueId', () => {
  it('numbers the events from one', () => {
    expect(eventValueId(1)).toBe('EVENT1.time');
    expect(eventValueId(12)).toBe('EVENT12.time');
    expect(VALUE_ID.test(eventValueId(50) as string)).toBe(true);
  });

  it('gives no id for a position so large that the head would not fit the grammar', () => {
    expect(eventValueId(1e20)).toBeNull();
    expect(eventValueId(10 ** 15)).toBe('EVENT1000000000000000.time');
  });

  it('gives no id for a position that is not a counting number', () => {
    for (const bad of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(eventValueId(bad)).toBeNull();
    }
  });
});

describe('levelValueIds', () => {
  it("uses the level's own name when it is the only one of that name", () => {
    expect(
      levelValueIds('MCD2', [
        { name: 'UOEDT', tf: 'M5' },
        { name: 'baseline', tf: 'M5' },
        { name: 'LOEDT', tf: 'M5' },
      ])
    ).toEqual(['MCD2.UOEDT', 'MCD2.baseline', 'MCD2.LOEDT']);
  });

  it('puts the timeframe first when two levels of one envelope share a name', () => {
    expect(
      levelValueIds('MCD3', [
        { name: 'UOEDT', tf: 'M15' },
        { name: 'baseline', tf: 'M15' },
        { name: 'UOEDT', tf: 'M5' },
        { name: 'baseline', tf: 'M5' },
        { name: 'extra', tf: 'M5' },
      ])
    ).toEqual([
      'MCD3.M15.UOEDT',
      'MCD3.M15.baseline',
      'MCD3.M5.UOEDT',
      'MCD3.M5.baseline',
      'MCD3.extra',
    ]);
  });

  it('gives no id to levels that are the same name on the same timeframe: they cannot be told apart', () => {
    expect(
      levelValueIds('MCD3', [
        { name: 'UOEDT', tf: 'M5' },
        { name: 'UOEDT', tf: 'M5' },
        { name: 'UOEDT', tf: 'M15' },
      ])
    ).toEqual([null, null, 'MCD3.M15.UOEDT']);
  });

  it('gives no id to a name that cannot be quoted', () => {
    const names = [
      '',
      'with space',
      'dash-ed',
      '_lead',
      'é',
      'x'.repeat(33),
      'a.b',
      'a\nb',
    ];
    expect(
      levelValueIds(
        'MCD1',
        names.map((name) => ({ name, tf: 'M15' }))
      )
    ).toEqual(names.map(() => null));
    expect(
      levelValueIds('MCD1', [{ name: 'x'.repeat(32), tf: 'M15' }])
    ).toEqual([`MCD1.${'x'.repeat(32)}`]);
  });

  it('gives no id to a duplicate whose timeframe cannot be quoted', () => {
    expect(
      levelValueIds('MCD3', [
        { name: 'UOEDT', tf: 'bad tf' },
        { name: 'UOEDT', tf: 'M5' },
      ])
    ).toEqual([null, 'MCD3.M5.UOEDT']);
  });

  it("gives no id when the envelope's own id could not be a head", () => {
    expect(levelValueIds('mcd2', [{ name: 'UOEDT', tf: 'M5' }])).toEqual([
      null,
    ]);
  });

  it('is empty for no levels, and every id it gives fits the grammar', () => {
    expect(levelValueIds('MCD2', [])).toEqual([]);
    const ids = levelValueIds('MCD3', [
      { name: 'UOEDT', tf: 'M15' },
      { name: 'UOEDT', tf: 'M5' },
    ]);
    for (const id of ids) expect(VALUE_ID.test(id as string)).toBe(true);
  });
});
