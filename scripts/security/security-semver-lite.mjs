// Minimal semantic-version helpers for the security pipeline (no dependencies).
//
// Covers what the engine needs: ordering versions, testing a version against an
// npm-style range, listing the lowest versions a range admits, spotting an exact
// pin and deciding whether an upgrade crosses a breaking boundary. It is not a
// full semver implementation: build metadata is ignored and prerelease ranges
// are handled in the common cases only.

const FULL_VERSION =
  /^\s*=?v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?\s*$/;

/**
 * Parses a complete `X.Y.Z[-pre]` version. Returns null for anything else.
 * @param {unknown} text
 * @returns {{ major: number, minor: number, patch: number, pre: string[] } | null}
 */
export function parseVersion(text) {
  const m = FULL_VERSION.exec(String(text ?? ''));
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    pre: m[4] ? m[4].split('.') : [],
  };
}

const asVersion = (v) => (typeof v === 'string' ? parseVersion(v) : v);

function comparePre(a, b) {
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1; // a release is above its prereleases
  if (b.length === 0) return -1;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if (a[i] === undefined) return -1;
    if (b[i] === undefined) return 1;
    const aNum = /^\d+$/.test(a[i]);
    const bNum = /^\d+$/.test(b[i]);
    if (aNum && bNum) {
      const diff = Number(a[i]) - Number(b[i]);
      if (diff !== 0) return diff < 0 ? -1 : 1;
    } else if (aNum) {
      return -1;
    } else if (bNum) {
      return 1;
    } else if (a[i] !== b[i]) {
      return a[i] < b[i] ? -1 : 1;
    }
  }
  return 0;
}

/**
 * Orders two versions: -1, 0 or 1, or null when either is not a version.
 * @param {string | object} a
 * @param {string | object} b
 * @returns {-1 | 0 | 1 | null}
 */
export function compareVersions(a, b) {
  const x = asVersion(a);
  const y = asVersion(b);
  if (!x || !y) return null;
  for (const key of ['major', 'minor', 'patch']) {
    if (x[key] !== y[key]) return x[key] < y[key] ? -1 : 1;
  }
  return comparePre(x.pre, y.pre);
}

/** The highest of the parseable versions, or null. */
export function maxVersion(versions) {
  let best = null;
  for (const v of versions) {
    if (!parseVersion(v)) continue;
    if (best === null || compareVersions(v, best) > 0) best = v;
  }
  return best;
}

/** Strips a leading `v` or `=` and surrounding space: `v24.1.0` -> `24.1.0`. */
export function cleanVersion(text) {
  const m = FULL_VERSION.exec(String(text ?? ''));
  return m ? `${m[1]}.${m[2]}.${m[3]}${m[4] ? `-${m[4]}` : ''}` : null;
}

/**
 * True when moving from `from` to `to` crosses a breaking boundary: a new
 * major, or, below 1.0.0, a new minor.
 */
export function isBreakingUpgrade(from, to) {
  const a = asVersion(from);
  const b = asVersion(to);
  if (!a || !b) return false;
  if (b.major !== a.major) return b.major > a.major;
  if (a.major === 0) return b.minor > a.minor;
  return false;
}

/** True for a range that is a single exact version (`2.4.0`, `=2.4.0`). */
export function isExactPin(range) {
  return FULL_VERSION.test(String(range ?? '').trim());
}

// --- ranges -----------------------------------------------------------

function parsePartial(token) {
  const m =
    /^v?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(
      token
    );
  if (!m) return null;
  const num = (s) => (s === undefined || /^[xX*]$/.test(s) ? null : Number(s));
  const major = num(m[1]);
  // a wildcard hides everything after it
  const minor = major === null ? null : num(m[2]);
  const patch = minor === null ? null : num(m[3]);
  return { major, minor, patch, pre: m[4] ? m[4].split('.') : [] };
}

const v = (major, minor, patch, pre = []) => ({ major, minor, patch, pre });
const ZERO_PRE = ['0'];

// Comparators are [operator, version]; the operators are >=, >, <, <= and =.
function desugar(op, p) {
  if (p.major === null) return op === '<' ? [['<', v(0, 0, 0, ZERO_PRE)]] : [];
  const m = p.major;
  const n = p.minor;
  const q = p.patch;
  switch (op) {
    case '':
    case '=':
      if (n === null)
        return [
          ['>=', v(m, 0, 0)],
          ['<', v(m + 1, 0, 0, ZERO_PRE)],
        ];
      if (q === null)
        return [
          ['>=', v(m, n, 0)],
          ['<', v(m, n + 1, 0, ZERO_PRE)],
        ];
      return [['=', v(m, n, q, p.pre)]];
    case '>':
      if (n === null) return [['>=', v(m + 1, 0, 0)]];
      if (q === null) return [['>=', v(m, n + 1, 0)]];
      return [['>', v(m, n, q, p.pre)]];
    case '>=':
      return [['>=', v(m, n ?? 0, q ?? 0, p.pre)]];
    case '<':
      return [['<', v(m, n ?? 0, q ?? 0, p.pre.length ? p.pre : ZERO_PRE)]];
    case '<=':
      if (n === null) return [['<', v(m + 1, 0, 0, ZERO_PRE)]];
      if (q === null) return [['<', v(m, n + 1, 0, ZERO_PRE)]];
      return [['<=', v(m, n, q, p.pre)]];
    case '~':
    case '~>':
      if (n === null)
        return [
          ['>=', v(m, 0, 0)],
          ['<', v(m + 1, 0, 0, ZERO_PRE)],
        ];
      return [
        ['>=', v(m, n, q ?? 0, p.pre)],
        ['<', v(m, n + 1, 0, ZERO_PRE)],
      ];
    case '^': {
      const low = ['>=', v(m, n ?? 0, q ?? 0, p.pre)];
      if (m > 0 || n === null) return [low, ['<', v(m + 1, 0, 0, ZERO_PRE)]];
      if (n > 0 || q === null) return [low, ['<', v(0, n + 1, 0, ZERO_PRE)]];
      return [low, ['<', v(0, 0, q + 1, ZERO_PRE)]];
    }
    default:
      return null;
  }
}

function parseSimple(token) {
  const m = /^(>=|<=|>|<|=|\^|~>|~)?(.*)$/.exec(token);
  const partial = parsePartial(m[2]);
  if (!partial) return null;
  return desugar(m[1] ?? '', partial);
}

/**
 * Parses an npm-style range into OR-ed sets of AND-ed comparators. Returns
 * null for a range it does not understand (a tag, a URL, a workspace link).
 */
export function parseRange(range) {
  let text = String(range ?? '').trim();
  if (text === '' || text === 'latest') text = '*';
  // `1.2.3 - 2.3.4` -> `>=1.2.3 <=2.3.4`
  text = text.replace(
    /(\S+)\s+-\s+(\S+)/g,
    (_, lo, hi) => `>=${lo.replace(/^v/, '')} <=${hi.replace(/^v/, '')}`
  );
  // `>= 1.2.3` -> `>=1.2.3`
  text = text.replace(/(>=|<=|>|<|=|\^|~>|~)\s+/g, '$1');
  const sets = [];
  for (const part of text.split('||')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    const comparators = [];
    if (tokens.length === 0) tokens.push('*');
    for (const token of tokens) {
      const parsed = parseSimple(token);
      if (parsed === null) return null;
      comparators.push(...parsed);
    }
    sets.push(comparators);
  }
  return sets;
}

function testComparator(version, [op, bound]) {
  const c = compareVersions(version, bound);
  switch (op) {
    case '>=':
      return c >= 0;
    case '>':
      return c > 0;
    case '<':
      return c < 0;
    case '<=':
      return c <= 0;
    default:
      return c === 0;
  }
}

/**
 * True when `version` satisfies `range`. A prerelease version only satisfies a
 * set that names a prerelease of the same major.minor.patch.
 * @param {string} version
 * @param {string} range
 */
export function satisfies(version, range) {
  const ver = parseVersion(version);
  const sets = parseRange(range);
  if (!ver || !sets) return false;
  return sets.some((set) => {
    if (!set.every((comparator) => testComparator(ver, comparator))) {
      return false;
    }
    if (ver.pre.length === 0) return true;
    return set.some(
      ([, bound]) =>
        bound.pre.length > 0 &&
        bound.major === ver.major &&
        bound.minor === ver.minor &&
        bound.patch === ver.patch
    );
  });
}

const format = (ver) =>
  `${ver.major}.${ver.minor}.${ver.patch}${
    ver.pre.length > 0 && !(ver.pre.length === 1 && ver.pre[0] === '0')
      ? `-${ver.pre.join('.')}`
      : ''
  }`;

/**
 * The lowest version each OR-ed set of a range admits (its highest lower
 * bound), as strings. A set with no lower bound admits `0.0.0`. An exclusive
 * bound (`>1.2.3`) is reported as that version.
 * @param {string} range
 * @returns {string[]}
 */
export function lowerBounds(range) {
  const sets = parseRange(range);
  if (!sets) return [];
  const out = [];
  for (const set of sets) {
    let low = v(0, 0, 0);
    for (const [op, bound] of set) {
      if (op === '>=' || op === '>' || op === '=') {
        if (compareVersions(bound, low) > 0) low = bound;
      }
    }
    out.push(format(low));
  }
  return out;
}

const inSet = (ver, set) =>
  set.every((comparator) => testComparator(ver, comparator));

/**
 * Versions that end a *vulnerable* range: the first release after each OR-ed
 * window that contains `installed` (every window when `installed` is null). A
 * window with no upper bound has no fix. `<=X` is reported as the next patch
 * `X.Y.(Z+1)`, an approximation.
 *
 * @param {string} range the vulnerable range of an advisory
 * @param {string | null} installed
 * @returns {string[]}
 */
export function upperBoundFixes(range, installed = null) {
  const sets = parseRange(range);
  if (!sets) return [];
  const ver = installed === null ? null : parseVersion(installed);
  const out = [];
  for (const set of sets) {
    if (ver && !inSet(ver, set)) continue;
    let best = null;
    for (const [op, bound] of set) {
      if (op !== '<' && op !== '<=' && op !== '=') continue;
      const candidate =
        op === '<'
          ? format(bound)
          : format(v(bound.major, bound.minor, bound.patch + 1));
      if (best === null || compareVersions(candidate, best) < 0) {
        best = candidate;
      }
    }
    if (best !== null) out.push(best);
  }
  return out;
}
