/**
 * Query-string pagination that can never hand Prisma a NaN or a negative number.
 *
 * `Number('abc')` is NaN and `Math.min(Math.max(NaN, 1), 500)` is still NaN, so
 * `?limit=abc` used to reach `take: NaN` (a 500). Bad input falls back to the
 * default; it is clamped, never rejected, so a stale client link still loads.
 *
 * Same behaviour as operation-service/src/common/pagination.util.ts; the two
 * services are built alone on Railway, so the code is copied, not shared.
 */

function toInteger(raw: unknown): number {
  // Express hands back an array for a repeated key (`?limit=1&limit=2`): not a number.
  if (typeof raw !== 'string' || raw.trim() === '') return Number.NaN;
  return Number.parseInt(raw, 10);
}

/** A page size in `1..maxLimit`; `defaultLimit` when absent or not a number. */
export function parsePageLimit(
  raw: unknown,
  defaultLimit: number,
  maxLimit: number
): number {
  const parsed = toInteger(raw);
  return Number.isFinite(parsed)
    ? Math.min(Math.max(parsed, 1), maxLimit)
    : defaultLimit;
}

/** A row offset of at least 0; 0 when absent or not a number. */
export function parsePageOffset(raw: unknown): number {
  const parsed = toInteger(raw);
  return Number.isFinite(parsed)
    ? Math.min(Math.max(parsed, 0), Number.MAX_SAFE_INTEGER)
    : 0;
}
