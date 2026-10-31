/**
 * Size guards that run BEFORE zod looks at a single element.
 *
 * Why they exist: zod 3 (the major this app runs) applies `.max()` only after it has parsed every
 * element, so `z.array(x).max(10)` still costs time and memory in proportion to the input. Measured
 * with 2,000,000 elements: about 350 ms and 170 MB for one request body. The fix shipped in zod
 * 4.6.6 changes the v4 code only; the `zod/v3` compatibility layer behaves like zod 3.
 *
 * A `z.custom` check in front of the real schema rejects an oversized input in constant time, and
 * `.pipe` does not run the real schema once it has failed. The real schema keeps its own `.max()`
 * for the exact bound. The size of the request body itself is still limited by the platform.
 */
import { z } from 'zod';

export function boundedArray<T extends z.ZodTypeAny>(
  item: T,
  max: number,
  min = 0
) {
  const arraySchema =
    min > 0 ? z.array(item).min(min).max(max) : z.array(item).max(max);
  return z
    .custom<unknown>((value) => !Array.isArray(value) || value.length <= max, {
      message: `At most ${max} items are allowed`,
    })
    .pipe(arraySchema);
}

export function boundedRecord<T extends z.ZodTypeAny>(
  value: T,
  maxKeys: number
) {
  return z
    .custom<unknown>(
      (input) =>
        typeof input !== 'object' ||
        input === null ||
        Array.isArray(input) ||
        Object.keys(input).length <= maxKeys,
      { message: `At most ${maxKeys} keys are allowed` }
    )
    .pipe(z.record(value));
}
