/**
 * @jest-environment node
 */

import {
  MAX_DEPTH,
  MAX_ISSUES,
  Issues,
  at,
  bool,
  exactObject,
  hasOwn,
  isRecord,
  join,
  keysMatching,
  list,
  mcdIdsAscending,
  mcdNumber,
  num,
  oneOf,
  sameList,
  text,
} from '@/lib/intake/check';

describe('Issues', () => {
  it('collects problems in order and says whether there are any', () => {
    const issues = new Issues();
    expect(issues.any).toBe(false);
    issues.add('a', 'WRONG_TYPE', 'x');
    issues.add('b', 'TOO_LONG', 'y');
    expect(issues.any).toBe(true);
    expect(issues.list.map((i) => i.path)).toEqual(['a', 'b']);
  });

  it('stops growing at a limit, so a hostile input cannot make a huge answer', () => {
    const issues = new Issues();
    for (let i = 0; i < MAX_ISSUES + 50; i += 1)
      issues.add(`p${i}`, 'WRONG_TYPE', 'x');
    expect(issues.list).toHaveLength(MAX_ISSUES);
    expect(MAX_ISSUES).toBe(60);
  });

  it('says a missing value once: a path reported REQUIRED gets no second report', () => {
    const issues = new Issues();
    issues.add('a', 'REQUIRED', 'is required');
    issues.add('a', 'WRONG_TYPE', 'must be a string');
    issues.add('a.b', 'WRONG_TYPE', 'a different path');
    issues.add('a', 'REQUIRED', 'again');
    expect(issues.list.map((i) => `${i.path}:${i.code}`)).toEqual([
      'a:REQUIRED',
      'a.b:WRONG_TYPE',
      'a:REQUIRED',
    ]);
  });
});

describe('paths', () => {
  it('join keys with dots and indexes with brackets', () => {
    expect(join('', 'a')).toBe('a');
    expect(join('a', 'b')).toBe('a.b');
    expect(at('a.b', 3)).toBe('a.b[3]');
    expect(at('', 0)).toBe('[0]');
  });
});

describe('isRecord and hasOwn', () => {
  it('accept a plain object only', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord(Object.create(null))).toBe(true);
    for (const value of [
      null,
      undefined,
      [],
      'x',
      1,
      true,
      new Map(),
      new Date(),
      () => 1,
      new (class A {})(),
    ]) {
      expect(isRecord(value)).toBe(false);
    }
  });

  it('see an own key and not one on the prototype', () => {
    expect(hasOwn({ a: 1 }, 'a')).toBe(true);
    expect(hasOwn({ a: 1 }, 'toString')).toBe(false);
    expect(hasOwn(JSON.parse('{"__proto__":1}') as object, '__proto__')).toBe(
      true
    );
  });
});

describe('exactObject', () => {
  it('reports every missing and every unknown key', () => {
    const issues = new Issues();
    const record = exactObject({ a: 1, z: 2 }, 'p', ['a', 'b'], issues);
    expect(record).toEqual({ a: 1, z: 2 });
    expect(issues.list).toEqual([
      expect.objectContaining({ path: 'p.b', code: 'REQUIRED' }),
      expect.objectContaining({ path: 'p.z', code: 'UNKNOWN_KEY' }),
    ]);
  });

  it('counts a key whose value is undefined as missing', () => {
    const issues = new Issues();
    exactObject({ a: undefined }, '', ['a'], issues);
    expect(issues.list).toEqual([
      expect.objectContaining({ path: 'a', code: 'REQUIRED' }),
    ]);
  });

  it('accepts null as a value', () => {
    const issues = new Issues();
    exactObject({ a: null }, '', ['a'], issues);
    expect(issues.any).toBe(false);
  });

  it('refuses what is not an object', () => {
    for (const value of [null, undefined, [], 'x', 3]) {
      const issues = new Issues();
      expect(exactObject(value, 'p', [], issues)).toBeUndefined();
      expect(issues.list).toEqual([
        expect.objectContaining({ path: 'p', code: 'WRONG_TYPE' }),
      ]);
    }
  });
});

describe('text', () => {
  const run = (value: unknown, rule?: Parameters<typeof text>[3]) => {
    const issues = new Issues();
    return { out: text(value, 'p', issues, rule), issues: issues.list };
  };

  it('returns the string when it fits, and the first problem otherwise', () => {
    expect(run('abc').out).toBe('abc');
    expect(run(5).issues[0]).toMatchObject({ code: 'WRONG_TYPE' });
    expect(run('').issues[0]).toMatchObject({ code: 'TOO_SHORT' }); // a minimum of one by default
    expect(run('', { min: 0 }).out).toBe('');
    expect(run('abc', { max: 3 }).out).toBe('abc');
    expect(run('abcd', { max: 3 }).issues[0]).toMatchObject({
      code: 'TOO_LONG',
    });
    expect(run('ab', { min: 3 }).issues[0]).toMatchObject({
      code: 'TOO_SHORT',
    });
    expect(run('abc', { pattern: /^[a-z]+$/ }).out).toBe('abc');
    expect(run('ab1', { pattern: /^[a-z]+$/ }).issues[0]).toMatchObject({
      code: 'BAD_FORMAT',
    });
  });
});

describe('oneOf, bool, num, list', () => {
  it('oneOf takes only the listed strings', () => {
    const issues = new Issues();
    expect(oneOf('b', 'p', ['a', 'b'] as const, issues)).toBe('b');
    expect(oneOf('c', 'p', ['a', 'b'] as const, issues)).toBeUndefined();
    expect(oneOf(1, 'p', ['a', 'b'] as const, issues)).toBeUndefined();
    expect(issues.list.map((i) => i.code)).toEqual([
      'NOT_ONE_OF',
      'WRONG_TYPE',
    ]);
  });

  it('bool takes true and false only', () => {
    const issues = new Issues();
    expect(bool(true, 'p', issues)).toBe(true);
    expect(bool(false, 'p', issues)).toBe(false);
    expect(bool(0, 'p', issues)).toBeUndefined();
    expect(bool('true', 'p', issues)).toBeUndefined();
    expect(bool(null, 'p', issues)).toBeUndefined();
    expect(issues.list).toHaveLength(3);
  });

  it('num takes finite numbers within the rule', () => {
    const issues = new Issues();
    expect(num(1.5, 'p', issues)).toBe(1.5);
    expect(num(NaN, 'p', issues)).toBeUndefined();
    expect(num(Infinity, 'p', issues)).toBeUndefined();
    expect(num('1', 'p', issues)).toBeUndefined();
    expect(num(1.5, 'p', issues, { integer: true })).toBeUndefined();
    expect(num(2, 'p', issues, { integer: true })).toBe(2);
    expect(num(0.009, 'p', issues, { min: 0.01 })).toBeUndefined();
    expect(num(0.01, 'p', issues, { min: 0.01 })).toBe(0.01);
    expect(num(11, 'p', issues, { max: 10 })).toBeUndefined();
    expect(num(10, 'p', issues, { max: 10 })).toBe(10);
    expect(issues.list.map((i) => i.code)).toEqual([
      'WRONG_TYPE',
      'WRONG_TYPE',
      'WRONG_TYPE',
      'WRONG_TYPE',
      'OUT_OF_RANGE',
      'OUT_OF_RANGE',
    ]);
  });

  it('list takes arrays within the bounds', () => {
    const issues = new Issues();
    expect(list([1, 2], 'p', issues, { max: 2 })).toEqual([1, 2]);
    expect(list([1, 2, 3], 'p', issues, { max: 2 })).toBeUndefined();
    expect(list([], 'p', issues, { max: 2, min: 1 })).toBeUndefined();
    expect(list({}, 'p', issues, { max: 2 })).toBeUndefined();
    expect(list(null, 'p', issues, { max: 2 })).toBeUndefined();
    expect(issues.list.map((i) => i.code)).toEqual([
      'TOO_MANY',
      'TOO_SHORT',
      'WRONG_TYPE',
      'WRONG_TYPE',
    ]);
  });
});

describe('sameList', () => {
  it('compares length, order and each item strictly', () => {
    expect(sameList([], [])).toBe(true);
    expect(sameList(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameList(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(sameList(['a'], ['a', 'b'])).toBe(false);
    expect(sameList(['a', 'b'], ['a'])).toBe(false);
    expect(sameList([1], ['1'])).toBe(false);
  });
});

describe('MCD ids', () => {
  it('have a number, read as a number and not as text', () => {
    expect(mcdNumber('MCD0')).toBe(0);
    expect(mcdNumber('MCD10')).toBe(10);
    for (const bad of ['MCD', 'MCD100', 'mcd1', 'XMCD1', 'MCD1x', '', 'SYN']) {
      expect(mcdNumber(bad)).toBeNaN();
    }
  });

  it('must come in ascending numeric order, none twice (MCD10 follows MCD9)', () => {
    const run = (ids: string[]) => {
      const issues = new Issues();
      mcdIdsAscending(ids, 'p', issues);
      return issues.list.map((i) => `${i.path}:${i.code}`);
    };
    expect(run(['MCD1', 'MCD2', 'MCD9', 'MCD10'])).toEqual([]);
    expect(run(['MCD2', 'MCD1'])).toEqual(['p[1]:NOT_SORTED']);
    expect(run(['MCD10', 'MCD9'])).toEqual(['p[1]:NOT_SORTED']);
    expect(run(['MCD1', 'MCD1'])).toEqual(['p[1]:DUPLICATE']);
    expect(run([])).toEqual([]);
    expect(run(['MCD1'])).toEqual([]);
  });
});

describe('keysMatching', () => {
  const equity = /equity/i;

  it('finds a key at any depth, inside arrays too, with its path', () => {
    const value = {
      a: { Equity: 1 },
      b: [{ c: 1 }, { d: { account_equity: 2 } }],
      e: [[{ EQUITY: 3 }]],
      f: 'equity in a value is not a key',
    };
    expect(keysMatching(value, equity)).toEqual([
      'a.Equity',
      'b[1].d.account_equity',
      'e[0][0].EQUITY',
    ]);
  });

  it('finds nothing in scalars and in objects without the key', () => {
    for (const value of [
      null,
      undefined,
      'equity',
      5,
      [],
      {},
      { a: [1, 2, { b: null }] },
    ]) {
      expect(keysMatching(value, equity)).toEqual([]);
    }
  });

  it('reports nesting beyond the limit and does not walk it', () => {
    let deep: unknown = { equity: 1 };
    for (let i = 0; i < MAX_DEPTH + 5; i += 1) deep = { a: deep };
    const issues = new Issues();
    expect(keysMatching(deep, equity, issues)).toEqual([]);
    expect(issues.list).toEqual([
      expect.objectContaining({ code: 'TOO_DEEP' }),
    ]);
    // a hostile depth does not overflow the stack
    let hostile: unknown = {};
    for (let i = 0; i < 20_000; i += 1) hostile = { a: hostile };
    expect(() => keysMatching(hostile, equity, new Issues())).not.toThrow();
  });

  it('finds a key held by an object at exactly 32 levels down, and reports one level more', () => {
    const wrap = (
      levels: number,
      wrapper: (inner: unknown) => unknown
    ): unknown => {
      let value: unknown = { equity: 1 };
      for (let i = 0; i < levels; i += 1) value = wrapper(value);
      return value;
    };
    const inObject = (inner: unknown): unknown => ({ a: inner });
    const inArray = (inner: unknown): unknown => [inner];
    for (const wrapper of [inObject, inArray]) {
      const atLimit = new Issues();
      expect(
        keysMatching(wrap(MAX_DEPTH, wrapper), equity, atLimit)
      ).toHaveLength(1);
      expect(atLimit.any).toBe(false);
      const over = new Issues();
      expect(keysMatching(wrap(MAX_DEPTH + 1, wrapper), equity, over)).toEqual(
        []
      );
      expect(over.list).toEqual([
        expect.objectContaining({ code: 'TOO_DEEP' }),
      ]);
    }
    expect(MAX_DEPTH).toBe(32);
  });
});
