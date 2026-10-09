/**
 * A seeded random source for property tests, in BigInt so it gives the same
 * sequence on every machine and never touches a float (splitmix64).
 */

const MASK = (1n << 64n) - 1n;

export interface Rng {
  /** an integer from `low` to `high`, both included */
  int(low: bigint, high: bigint): bigint;
  /** one element of a non-empty list */
  pick<T>(items: readonly T[]): T;
  /** true about `percent` times in a hundred */
  chance(percent: bigint): boolean;
}

export function makeRng(seed: bigint): Rng {
  let state = seed & MASK;
  const next = (): bigint => {
    state = (state + 0x9e3779b97f4a7c15n) & MASK;
    let z = state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK;
    return z ^ (z >> 31n);
  };
  const int = (low: bigint, high: bigint): bigint =>
    low + (next() % (high - low + 1n));
  return {
    int,
    pick<T>(items: readonly T[]): T {
      const index = Number(int(0n, BigInt(items.length) - 1n));
      return items[index] as T;
    },
    chance: (percent: bigint): boolean => int(1n, 100n) <= percent,
  };
}

/** `units` hundredths (or `places` decimals) as decimal text, e.g. 123456n, 2 -> "1234.56". */
export function decimalText(units: bigint, places: number): string {
  const scale = 10n ** BigInt(places);
  const whole = units / scale;
  const fraction = (scale + (units % scale)).toString().slice(1);
  return places === 0 ? whole.toString() : `${whole}.${fraction}`;
}
