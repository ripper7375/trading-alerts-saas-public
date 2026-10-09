/**
 * @jest-environment node
 */

/**
 * The adapter from an `entry_zones` row to a zone (build step 5, part 3).
 *
 * `entry_zones` holds the same zones as a synthesis reading's `zones_json`, as
 * flat columns plus a `levels` JSON. The rows below are made the way the
 * gateway makes them (`zoneRowOf` in `railway-gateway/src/sensors/
 * synthesis-rows.ts`) from the 31 zones of the signed-off golden scenarios, and
 * the adapter must read each one as exactly the zone `zoneFromStored` reads
 * from the `zones_json` it came from.
 */

import { zoneFromEntryRow, zoneFromStored } from '@/lib/engine4';

import { entryRowOf, loadGoldens } from './helpers/stored';

type Doc = Record<string, unknown>;

const stored: { id: string; profile: string; doc: Doc }[] = [];
for (const golden of loadGoldens()) {
  for (const reading of golden.readings) {
    for (const doc of reading.zones) {
      stored.push({ id: golden.id, profile: reading.profile, doc });
    }
  }
}

describe('the golden zones', () => {
  test('there are zones to read, on both sides and on every basis', () => {
    expect(stored.length).toBeGreaterThanOrEqual(31);
    expect(new Set(stored.map((s) => s.doc['bias']))).toEqual(
      new Set(['LONG', 'SHORT'])
    );
    expect(
      new Set(stored.map((s) => s.doc['invalidation_basis'])).size
    ).toBeGreaterThanOrEqual(2);
  });

  test.each(
    stored.map(
      (s, i) =>
        [
          `${s.id} ${s.profile} ${String(s.doc['zone_id'])} (#${i})`,
          s.doc,
        ] as const
    )
  )('a row of %s reads as the zone zoneFromStored reads', (_label, doc) => {
    const fromStored = zoneFromStored(doc);
    expect(fromStored).not.toBeNull();
    // through JSON, as the `levels` column comes back from the database
    const row = JSON.parse(JSON.stringify(entryRowOf(doc))) as Doc;
    const fromRow = zoneFromEntryRow(row);
    expect(fromRow).not.toBeNull();
    expect(JSON.stringify(fromRow)).toBe(JSON.stringify(fromStored));
  });

  test('a zone with nothing beyond it has no next opposing level on either side', () => {
    // none of the 31 golden zones is the last level on its side, so this one is made: the builder
    // stores null for the level, the runway and the ratio, and the row has a null flat price
    const doc = {
      ...stored[0]!.doc,
      next_opposing_level: null,
      runway: null,
      runway_ratio: null,
    };
    const row = entryRowOf(doc);
    expect(row['next_opposing_price']).toBeNull();
    const zone = zoneFromEntryRow(row);
    expect(zone).not.toBeNull();
    expect(zone?.nextOpposingLevel).toBeNull();
    expect(zone?.runway).toBeNull();
    expect(JSON.stringify(zone)).toBe(JSON.stringify(zoneFromStored(doc)));
  });
});

describe('a row that is not well formed is not a zone', () => {
  const doc = stored.find((s) => s.doc['next_opposing_level'] !== null)!.doc;
  const good = (): Doc => JSON.parse(JSON.stringify(entryRowOf(doc))) as Doc;
  const withLevels = (over: Doc): Doc => ({
    ...good(),
    levels: { ...(good()['levels'] as Doc), ...over },
  });
  const withoutLevel = (key: string): Doc => {
    const row = good();
    delete (row['levels'] as Doc)[key];
    return row;
  };

  test('the row itself reads', () => {
    expect(zoneFromEntryRow(good())).not.toBeNull();
  });

  test.each([null, undefined, 'row', 5, [], true])(
    '%p is not a row',
    (value) => {
      expect(zoneFromEntryRow(value)).toBeNull();
    }
  );

  test.each([
    ['levels missing', { ...good(), levels: undefined }],
    ['levels null', { ...good(), levels: null }],
    ['levels a list', { ...good(), levels: [] }],
    ['levels text', { ...good(), levels: '{}' }],
    ['no invalidation_level key', withoutLevel('invalidation_level')],
    ['no next_opposing_level key', withoutLevel('next_opposing_level')],
    [
      'an invalidation level that is not a level',
      withLevels({ invalidation_level: { price: 1 } }),
    ],
    [
      'a next level that is not a level',
      withLevels({ next_opposing_level: 'x' }),
    ],
  ])('refuses %s', (_label, row) => {
    expect(zoneFromEntryRow(row)).toBeNull();
  });

  test.each([
    ['a zone id', { zone_id: 'Z9' }],
    ['a zone id that is not its rank', { rank: 2 }],
    ['a bias', { bias: 'UP' }],
    ['a missing price', { low: undefined }],
    ['a price of zero', { reference_price: 0 }],
    ['an invalidation price as text', { invalidation_price: 'low' }],
    ['a basis', { invalidation_basis: 'GUESS' }],
    ['a missing stop distance', { stop_distance: null }],
    ['a runway that is not a number', { runway: 'far' }],
    ['a missing runway column', { runway: undefined }],
  ])('refuses a bad %s', (_label, over) => {
    expect(zoneFromEntryRow({ ...good(), ...over })).toBeNull();
  });

  test('refuses a flat next_opposing_price that is not the level in `levels`', () => {
    const row = good();
    const price = row['next_opposing_price'] as number;
    expect(
      zoneFromEntryRow({ ...row, next_opposing_price: price + 0.01 })
    ).toBeNull();
    expect(zoneFromEntryRow({ ...row, next_opposing_price: null })).toBeNull();
    expect(
      zoneFromEntryRow({ ...row, next_opposing_price: 'near' })
    ).toBeNull();
    expect(
      zoneFromEntryRow({ ...row, next_opposing_price: undefined })
    ).toBeNull();
  });

  test('refuses a flat price where `levels` says nothing lies beyond', () => {
    const none = {
      ...doc,
      next_opposing_level: null,
      runway: null,
      runway_ratio: null,
    };
    const row = JSON.parse(JSON.stringify(entryRowOf(none))) as Doc;
    expect(zoneFromEntryRow(row)).not.toBeNull();
    expect(zoneFromEntryRow({ ...row, next_opposing_price: 4300 })).toBeNull();
    expect(
      zoneFromEntryRow({ ...row, next_opposing_price: undefined })
    ).toBeNull();
  });
});
