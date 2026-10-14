/**
 * The small field validators the structured contracts share (`result.ts`, `stage-events.ts`,
 * `trace-fields.ts`): ids, versions, hashes, slots, bounded integers, code lists. Each one
 * reads an `unknown`, reports at the path it was found at, and returns the value or
 * undefined. They are the same shapes the SQL CHECKs of the trace and chat tables spell, so
 * the contract and the database agree (a test holds the patterns to the migration).
 *
 * Pure.
 *
 * @module lib/reply/contracts/fields
 */

import { at, list, num, text, secondsOfSlot } from './intake';
import type { Issues } from './intake';

/** A request id, a thread id, a message id: the shape `THREAD_ID` already fixes. */
export const ID = /^[A-Za-z0-9_-]{1,64}$/;
export const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;
export const SHA256 = /^[0-9a-f]{64}$/;
/** A model slug as OpenRouter writes it: `google/gemini-2.5-flash`, `vendor/model:variant`. */
export const MODEL_SLUG = /^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,119}$/;
/** A reason or flag code: `TERM_DROPPED`, `UPSTREAM_STALE:MCD1`. */
export const CODE = /^[A-Z][A-Z0-9_]{0,39}(:[A-Z0-9_]{1,40})?$/;
export const MCD = /^MCD([1-9]|1[0-5])$/;
export const STATE_CODE = /^MCD([0-9]|1[0-5])_[A-Z0-9_]+$/;
/** The rule the synthesis fired, or `NO_MATCH`. */
export const RULE_ID = /^(R[0-9]+S?_[A-Z0-9_]+|NO_MATCH)$/;
/** A version of the rules file (`draft-1`). */
export const RULES_VERSION = /^[a-z0-9][a-z0-9._-]*$/;
/** `2026-09-18T20:55:03Z` or with milliseconds, as `Date#toISOString` writes it. */
export const INSTANT =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,3})?Z$/;

export function idText(
  value: unknown,
  path: string,
  issues: Issues
): string | undefined {
  return text(value, path, issues, { pattern: ID });
}

export function versionText(
  value: unknown,
  path: string,
  issues: Issues
): string | undefined {
  return text(value, path, issues, { pattern: VERSION });
}

export function sha256Text(
  value: unknown,
  path: string,
  issues: Issues
): string | undefined {
  return text(value, path, issues, { pattern: SHA256 });
}

/** A cycle slot as the envelopes write it (`2026-09-18T20:55Z`), and a real one. */
export function slotText(
  value: unknown,
  path: string,
  issues: Issues
): string | undefined {
  if (typeof value !== 'string') {
    issues.add(path, 'WRONG_TYPE', 'must be a string');
    return undefined;
  }
  if (secondsOfSlot(value) === null) {
    issues.add(
      path,
      'BAD_FORMAT',
      'must be a cycle slot such as 2026-09-18T20:55Z'
    );
    return undefined;
  }
  return value;
}

/** A whole number within bounds (0 or more unless said). */
export function intIn(
  value: unknown,
  path: string,
  issues: Issues,
  max: number,
  min = 0
): number | undefined {
  return num(value, path, issues, { integer: true, min, max });
}

/** A list of codes (`CODE`), at most `max`, none twice. */
export function codeList(
  value: unknown,
  path: string,
  issues: Issues,
  max: number,
  pattern: RegExp = CODE
): string[] | undefined {
  const items = list(value, path, issues, { max });
  if (items === undefined) return undefined;
  const seen = new Set<string>();
  const out: string[] = [];
  items.forEach((item, index) => {
    const here = at(path, index);
    const code = text(item, here, issues, { pattern });
    if (code === undefined) return;
    if (seen.has(code)) {
      issues.add(here, 'DUPLICATE', `${code} appears twice`);
      return;
    }
    seen.add(code);
    out.push(code);
  });
  return out;
}

/** The largest value of a 32-bit INTEGER column. */
export const INT_MAX = 2_147_483_647;
