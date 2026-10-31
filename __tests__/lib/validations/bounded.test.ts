/**
 * boundedArray / boundedRecord: an oversized input is refused before any element is parsed.
 *
 * The "plain zod" test documents the reason (zod 3 parses every element before it applies
 * `.max()`). If it fails after a zod 4 migration, the guards in front of the schemas can go.
 */
import { z } from 'zod';

import { boundedArray, boundedRecord } from '@/lib/validations/bounded';

function countingString() {
  const calls = { n: 0 };
  const schema = z.string().refine(() => {
    calls.n += 1;
    return true;
  });
  return { schema, calls };
}

describe('boundedArray', () => {
  it('accepts an array within the bound and returns it', () => {
    const result = boundedArray(z.string(), 3).safeParse(['a', 'b']);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(['a', 'b']);
  });

  it('refuses an oversized array with one custom issue and parses no element', () => {
    const { schema, calls } = countingString();
    const result = boundedArray(schema, 5).safeParse(
      new Array(100_000).fill('x')
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0]?.code).toBe('custom');
    }
    expect(calls.n).toBe(0);
  });

  it('still validates the elements of an array within the bound', () => {
    const result = boundedArray(z.string(), 3).safeParse(['a', 7]);
    expect(result.success).toBe(false);
  });

  it('keeps the minimum when one is given', () => {
    expect(boundedArray(z.string(), 3, 1).safeParse([]).success).toBe(false);
    expect(boundedArray(z.string(), 3, 1).safeParse(['a']).success).toBe(true);
  });

  it('leaves a non-array to the array schema (invalid_type, not the size message)', () => {
    const result = boundedArray(z.string(), 3).safeParse('not an array');
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0]?.code).toBe('invalid_type');
  });

  it('works as an optional object field', () => {
    const schema = z.object({ ids: boundedArray(z.string(), 2).optional() });
    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ ids: ['a', 'b', 'c'] }).success).toBe(false);
  });

  it('CANARY: plain z.array(...).max(...) parses every element before it refuses (zod 3)', () => {
    const { schema, calls } = countingString();
    z.array(schema).max(5).safeParse(new Array(1_000).fill('x'));
    expect(calls.n).toBeGreaterThan(5);
  });
});

describe('boundedRecord', () => {
  const makeRecord = (keys: number) =>
    Object.fromEntries(Array.from({ length: keys }, (_, i) => [`k${i}`, i]));

  it('accepts a record within the bound', () => {
    const result = boundedRecord(z.unknown(), 3).safeParse({ a: 1, b: 'x' });
    expect(result.success).toBe(true);
  });

  it('refuses a record with too many keys and parses no value', () => {
    const { schema, calls } = countingString();
    const input = Object.fromEntries(
      Array.from({ length: 5_000 }, (_, i) => [`k${i}`, 'x'])
    );
    const result = boundedRecord(schema, 10).safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.code).toBe('custom');
    expect(calls.n).toBe(0);
  });

  it('accepts exactly the maximum and refuses one more', () => {
    expect(boundedRecord(z.unknown(), 4).safeParse(makeRecord(4)).success).toBe(
      true
    );
    expect(boundedRecord(z.unknown(), 4).safeParse(makeRecord(5)).success).toBe(
      false
    );
  });

  it('leaves null, arrays and scalars to z.record', () => {
    for (const bad of [null, [1, 2], 'text', 7]) {
      expect(boundedRecord(z.unknown(), 3).safeParse(bad).success).toBe(false);
    }
  });
});
