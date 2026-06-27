/**
 * Tests for the pure fired-marker store.
 */

import {
  capList,
  FiredMarkerStore,
} from '@/components/charts/drawing/firedMarkers';

describe('capList', () => {
  it('keeps the most recent N items', () => {
    expect(capList([1, 2, 3, 4, 5], 3)).toEqual([3, 4, 5]);
    expect(capList([1, 2], 5)).toEqual([1, 2]);
  });
});

describe('FiredMarkerStore', () => {
  it('accumulates markers and stamps createdAt', () => {
    const store = new FiredMarkerStore();
    const list = store.add({ time: 100, price: 2050, levelId: 'line' }, 42);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      time: 100,
      price: 2050,
      levelId: 'line',
      createdAt: 42,
    });
  });

  it('caps to the configured maximum', () => {
    const store = new FiredMarkerStore(2);
    store.add({ time: 1, price: 1, levelId: 'a' }, 1);
    store.add({ time: 2, price: 2, levelId: 'b' }, 2);
    const list = store.add({ time: 3, price: 3, levelId: 'c' }, 3);
    expect(list.map((m) => m.levelId)).toEqual(['b', 'c']);
  });

  it('clear empties the store', () => {
    const store = new FiredMarkerStore();
    store.add({ time: 1, price: 1, levelId: 'a' }, 1);
    expect(store.clear()).toEqual([]);
    expect(store.list()).toEqual([]);
  });
});
