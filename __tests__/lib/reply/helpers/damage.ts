/**
 * Damage every place of a valid value, one place at a time, and check that the validator
 * reports the damage WHERE it is.
 *
 * A validator that names the wrong path (a typo in a field name, a join that drops a level)
 * passes every test that only counts issues. This walks the whole example instead: at each
 * place it puts an object nothing accepts, a string, a null, and (for a key) takes the key out,
 * and demands that every issue the validator gives for it sits at that place or below it.
 */

import { clone, summary } from './fixtures';
import type { Any } from './fixtures';

export type Checked = {
  ok: boolean;
  issues?: { path: string; code: string }[];
};

export interface Spot {
  path: string;
  /** an object or an array: a string in its place has to be refused */
  container: boolean;
  /** a key of an object (it can be taken out), not an item of an array */
  keyed: boolean;
}

const isContainer = (value: unknown): boolean =>
  typeof value === 'object' && value !== null;

/** Every key and array item of a value, with its path (`a.b[0].c`), containers and leaves alike. */
export function spotsOf(value: unknown): Spot[] {
  const spots: Spot[] = [];
  const visit = (node: unknown, path: string): void => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => {
        const here = `${path}[${index}]`;
        spots.push({ path: here, container: isContainer(item), keyed: false });
        visit(item, here);
      });
    } else if (isContainer(node)) {
      for (const [key, item] of Object.entries(node as object)) {
        const here = path === '' ? key : `${path}.${key}`;
        spots.push({ path: here, container: isContainer(item), keyed: true });
        visit(item, here);
      }
    }
  };
  visit(value, '');
  return spots;
}

/** Is `issuePath` the place itself or something inside it? */
export const isUnder = (issuePath: string, place: string): boolean =>
  issuePath === place ||
  issuePath.startsWith(`${place}.`) ||
  issuePath.startsWith(`${place}[`);

/** A copy of `base` with `path` set to `value`, or taken out when `value` is `TAKE_OUT`. */
const TAKE_OUT = Symbol('take out');

function damagedCopy(base: unknown, path: string, value: unknown): unknown {
  const copy = clone(base) as Any;
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let node = copy;
  for (const part of parts.slice(0, -1)) node = node[part];
  const last = parts[parts.length - 1] as string;
  if (value === TAKE_OUT) delete node[last];
  else node[last] = value;
  return copy;
}

/**
 * What is wrong with how `check` reports damage to `base`: one line for each broken
 * expectation, empty when the validator names every place right.
 */
export function damageProblems(
  base: unknown,
  check: (value: unknown) => Checked,
  options: {
    /** places not damaged at all (a field that decides what the rest of the value must be) */
    skip?: readonly string[];
    /** places whose damage is also reported at these other places, on purpose (a rule across two fields) */
    related?: readonly string[];
    /** keys that may be absent: the keys of a map, not the fields of a record */
    optional?: RegExp;
  } = {}
): string[] {
  const problems: string[] = [];
  const baseline = check(base);
  if (!baseline.ok) {
    return [`the example itself is refused: ${summary(baseline).join(', ')}`];
  }
  for (const spot of spotsOf(base)) {
    if (options.skip?.includes(spot.path)) continue;
    const attempts: [string, unknown, boolean][] = [
      // an object no field accepts: always refused, and only at the place
      ['an object', { damaged: true }, true],
      // a string: refused wherever a string is not the value; a container must refuse it
      ['a string', 'damaged', spot.container],
      ['null', null, false],
    ];
    const absentOk = options.optional?.test(spot.path) === true;
    if (spot.keyed && !absentOk) attempts.push(['no key', TAKE_OUT, true]);
    for (const [what, value, mustRefuse] of attempts) {
      const result = check(damagedCopy(base, spot.path, value));
      const issues = summary(result);
      const here = `${spot.path} as ${what}`;
      if (mustRefuse && result.ok) problems.push(`${here}: accepted`);
      const stray = issues.filter((line) => {
        const path = line.slice(0, line.lastIndexOf(':'));
        return (
          !isUnder(path, spot.path) &&
          !(options.related ?? []).some((other) => isUnder(path, other))
        );
      });
      if (stray.length > 0) {
        problems.push(`${here}: issues elsewhere: ${stray.join(', ')}`);
      }
      if (value === TAKE_OUT && !issues.includes(`${spot.path}:REQUIRED`)) {
        problems.push(
          `${here}: no ${spot.path}:REQUIRED in ${issues.join(', ')}`
        );
      }
    }
  }
  return problems;
}
