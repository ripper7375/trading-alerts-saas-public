/**
 * The small toolkit the hand-written validators of this folder share (the packet,
 * the refusal and the roster). There is no `ajv` here on purpose (plan assumption
 * A4): a validator is plain code that reads an `unknown`, reports EVERY problem
 * with the path it was found at, and never throws.
 *
 * Internal to `lib/intake`: not exported from the barrel.
 *
 * @module lib/intake/check
 */

export type IssueCode =
  | 'REQUIRED'
  | 'UNKNOWN_KEY'
  | 'WRONG_TYPE'
  | 'NOT_ONE_OF'
  | 'BAD_FORMAT'
  | 'TOO_SHORT'
  | 'TOO_LONG'
  | 'TOO_MANY'
  | 'OUT_OF_RANGE'
  | 'DUPLICATE'
  | 'NOT_SORTED'
  | 'FORBIDDEN_KEY'
  | 'TOO_DEEP'
  | 'INCONSISTENT';

export interface Issue {
  /** where: `readings.sensors[0].envelope.status`; the empty string is the root */
  path: string;
  code: IssueCode;
  message: string;
}

/** A report stops growing here: a hostile input must not make a huge answer. */
export const MAX_ISSUES = 60;

/** Nesting deeper than this is refused by every walker of this folder. */
export const MAX_DEPTH = 32;

export class Issues {
  readonly list: Issue[] = [];

  /**
   * Add a problem. A path that was reported as missing gets no second report for
   * the value that is not there (a wrong type, not one of the allowed values).
   */
  add(path: string, code: IssueCode, message: string): void {
    if (this.list.length >= MAX_ISSUES) return;
    if (
      code !== 'REQUIRED' &&
      this.list.some(
        (issue) => issue.path === path && issue.code === 'REQUIRED'
      )
    ) {
      return;
    }
    this.list.push({ path, code, message });
  }

  get any(): boolean {
    return this.list.length > 0;
  }
}

export const join = (path: string, key: string): string =>
  path === '' ? key : `${path}.${key}`;

export const at = (path: string, index: number): string => `${path}[${index}]`;

/** A plain JSON object: not null, not an array, not a class instance. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export const hasOwn = (record: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key);

/**
 * Check that `value` is an object with exactly these keys: every one of
 * `required` present, and no other. Returns the record when it is an object
 * (even if keys are missing, so the caller can go on and report more). A key
 * whose value is `undefined` is missing: JSON has no such value.
 */
export function exactObject(
  value: unknown,
  path: string,
  required: readonly string[],
  issues: Issues
): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    issues.add(path, 'WRONG_TYPE', 'must be an object');
    return undefined;
  }
  for (const key of required) {
    if (!hasOwn(value, key) || value[key] === undefined) {
      issues.add(join(path, key), 'REQUIRED', 'is required');
    }
  }
  for (const key of Object.keys(value)) {
    if (!required.includes(key)) {
      issues.add(
        join(path, key),
        'UNKNOWN_KEY',
        'is not a field of this object'
      );
    }
  }
  return value;
}

export interface StringRule {
  min?: number;
  max?: number;
  pattern?: RegExp;
}

/** A string within the rule, or undefined (and an issue). */
export function text(
  value: unknown,
  path: string,
  issues: Issues,
  rule: StringRule = {}
): string | undefined {
  if (typeof value !== 'string') {
    issues.add(path, 'WRONG_TYPE', 'must be a string');
    return undefined;
  }
  const min = rule.min ?? 1;
  if (value.length < min) {
    issues.add(path, 'TOO_SHORT', `must have at least ${min} character(s)`);
    return undefined;
  }
  if (rule.max !== undefined && value.length > rule.max) {
    issues.add(path, 'TOO_LONG', `must have at most ${rule.max} characters`);
    return undefined;
  }
  if (rule.pattern !== undefined && !rule.pattern.test(value)) {
    issues.add(path, 'BAD_FORMAT', `must match ${rule.pattern.source}`);
    return undefined;
  }
  return value;
}

/** A string that is one of `allowed`, or undefined (and an issue). */
export function oneOf<T extends string>(
  value: unknown,
  path: string,
  allowed: readonly T[],
  issues: Issues
): T | undefined {
  if (typeof value !== 'string') {
    issues.add(path, 'WRONG_TYPE', 'must be a string');
    return undefined;
  }
  const found = allowed.find((candidate) => candidate === value);
  if (found === undefined) {
    issues.add(path, 'NOT_ONE_OF', `must be one of ${allowed.join(', ')}`);
  }
  return found;
}

export function bool(
  value: unknown,
  path: string,
  issues: Issues
): boolean | undefined {
  if (typeof value !== 'boolean') {
    issues.add(path, 'WRONG_TYPE', 'must be true or false');
    return undefined;
  }
  return value;
}

/** A finite number, optionally an integer, optionally within bounds. */
export function num(
  value: unknown,
  path: string,
  issues: Issues,
  rule: { integer?: boolean; min?: number; max?: number } = {}
): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    issues.add(path, 'WRONG_TYPE', 'must be a finite number');
    return undefined;
  }
  if (rule.integer === true && !Number.isInteger(value)) {
    issues.add(path, 'WRONG_TYPE', 'must be a whole number');
    return undefined;
  }
  if (
    (rule.min !== undefined && value < rule.min) ||
    (rule.max !== undefined && value > rule.max)
  ) {
    issues.add(path, 'OUT_OF_RANGE', 'is outside the allowed range');
    return undefined;
  }
  return value;
}

/** An array within a length bound, or undefined (and an issue). */
export function list(
  value: unknown,
  path: string,
  issues: Issues,
  rule: { max: number; min?: number }
): unknown[] | undefined {
  if (!Array.isArray(value)) {
    issues.add(path, 'WRONG_TYPE', 'must be an array');
    return undefined;
  }
  if (value.length > rule.max) {
    issues.add(path, 'TOO_MANY', `must have at most ${rule.max} item(s)`);
    return undefined;
  }
  if (rule.min !== undefined && value.length < rule.min) {
    issues.add(path, 'TOO_SHORT', `must have at least ${rule.min} item(s)`);
    return undefined;
  }
  return value;
}

/** Whether two arrays of strings hold the same items in the same order. */
export function sameList(
  a: readonly unknown[],
  b: readonly unknown[]
): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

/** `MCD7` to 7: the number in an MCD id, for ordering. NaN for anything else. */
export function mcdNumber(id: string): number {
  const match = /^MCD(\d{1,2})$/.exec(id);
  return match === null ? NaN : Number(match[1]);
}

/** MCD ids in strictly ascending numeric order, none repeated. */
export function mcdIdsAscending(
  ids: readonly string[],
  path: string,
  issues: Issues
): void {
  for (let i = 1; i < ids.length; i += 1) {
    const previous = ids[i - 1] as string;
    const current = ids[i] as string;
    if (current === previous) {
      issues.add(at(path, i), 'DUPLICATE', `${current} appears twice`);
    } else if (mcdNumber(current) < mcdNumber(previous)) {
      issues.add(
        at(path, i),
        'NOT_SORTED',
        'must come in ascending order of the MCD number'
      );
    }
  }
}

/**
 * The paths of every key under `value` (any depth, objects inside arrays too)
 * whose name matches `forbidden`. A structure deeper than MAX_DEPTH is reported
 * as such instead of being walked.
 */
export function keysMatching(
  value: unknown,
  forbidden: RegExp,
  issues?: Issues
): string[] {
  const found: string[] = [];
  const walk = (node: unknown, path: string, depth: number): void => {
    if (typeof node !== 'object' || node === null) return;
    if (depth > MAX_DEPTH) {
      issues?.add(
        path,
        'TOO_DEEP',
        `is nested deeper than ${MAX_DEPTH} levels`
      );
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, at(path, index), depth + 1));
      return;
    }
    for (const key of Object.keys(node)) {
      const here = join(path, key);
      if (forbidden.test(key)) found.push(here);
      walk((node as Record<string, unknown>)[key], here, depth + 1);
    }
  };
  walk(value, '', 0);
  return found;
}
