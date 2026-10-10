/**
 * @jest-environment node
 */

import { createHash } from 'crypto';

import {
  CanonicalError,
  canonicalJson,
  canonicalSha256,
  sha256Hex,
} from '@/lib/intake';

import { describePython, runPython } from './helpers/python';

function catchCanonical(value: unknown): CanonicalError {
  try {
    canonicalJson(value);
  } catch (error) {
    if (error instanceof CanonicalError) return error;
    throw error;
  }
  throw new Error('canonicalJson did not throw');
}

describe('canonicalJson', () => {
  it('writes keys in ascending order and no whitespace', () => {
    expect(canonicalJson({ b: [true, null, 'x'], a: 1 })).toBe(
      '{"a":1,"b":[true,null,"x"]}'
    );
    expect(canonicalJson({ z: { y: 2, x: 1 }, a: [{ d: 4, c: 3 }] })).toBe(
      '{"a":[{"c":3,"d":4}],"z":{"x":1,"y":2}}'
    );
    expect(canonicalJson([])).toBe('[]');
    expect(canonicalJson({})).toBe('{}');
    expect(canonicalJson(null)).toBe('null');
    expect(canonicalJson('é')).toBe('"é"');
  });

  it('gives one text however the keys were built', () => {
    const a = { one: 1, two: { b: 2, a: 1 }, three: [{ y: 1, x: 2 }] };
    const b = { three: [{ x: 2, y: 1 }], two: { a: 1, b: 2 }, one: 1 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  it('keeps the order of an array', () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });

  it('orders keys by UTF-16 code unit, as RFC 8785 does', () => {
    expect(canonicalJson({ z: 1, a: 2, é: 3, '9': 4, '10': 5 })).toBe(
      '{"10":5,"9":4,"a":2,"z":1,"é":3}'
    );
    // a surrogate pair (U+1F600, D83D DE00) sorts BEFORE U+FFFF in UTF-16, after it by code point
    const text = canonicalJson({ '￿': 1, '😀': 2 });
    expect(text.indexOf('😀')).toBeLessThan(text.indexOf('￿'));
  });

  it('writes numbers and strings as JSON.stringify does', () => {
    for (const number of [
      0,
      -0,
      1,
      1.5,
      -2.25,
      0.1 + 0.2,
      1e21,
      1e-7,
      123456789012345680000,
      Number.MAX_SAFE_INTEGER,
    ]) {
      expect(canonicalJson(number)).toBe(JSON.stringify(number));
    }
    expect(canonicalJson(-0)).toBe('0');
    expect(canonicalJson(1.0)).toBe('1');
    for (const string of [
      '',
      'a"b',
      'a\\b',
      'line\nbreak',
      '\u0000\u001f',
      '\ud800',
      '日本語',
      '😀',
    ]) {
      expect(canonicalJson(string)).toBe(JSON.stringify(string));
    }
    expect(canonicalJson('\ud800')).toBe('"\\ud800"'); // a lone surrogate stays valid JSON
  });

  it('keeps a key called __proto__ that came out of JSON.parse', () => {
    const parsed = JSON.parse('{"__proto__":{"x":1},"a":2}') as unknown;
    expect(canonicalJson(parsed)).toBe('{"__proto__":{"x":1},"a":2}');
  });

  it('accepts an object with no prototype and a value used twice', () => {
    const bare = Object.create(null) as Record<string, unknown>;
    bare['k'] = 1;
    expect(canonicalJson(bare)).toBe('{"k":1}');
    const shared = { n: 1 };
    expect(canonicalJson({ a: shared, b: shared, c: [shared, shared] })).toBe(
      '{"a":{"n":1},"b":{"n":1},"c":[{"n":1},{"n":1}]}'
    );
  });

  it('refuses what JSON would silently change, and says where', () => {
    const cases: [unknown, string, string][] = [
      [undefined, 'UNDEFINED', '(root)'],
      [{ a: undefined }, 'UNDEFINED', 'a'],
      [[1, undefined], 'UNDEFINED', '[1]'],
      [{ a: { b: [0, 1, undefined] } }, 'UNDEFINED', 'a.b[2]'],
      [NaN, 'NOT_FINITE', '(root)'],
      [Infinity, 'NOT_FINITE', '(root)'],
      [{ x: -Infinity }, 'NOT_FINITE', 'x'],
      [10n, 'BIGINT', '(root)'],
      [{ f: () => 1 }, 'FUNCTION', 'f'],
      [Symbol('s'), 'SYMBOL', '(root)'],
      [new Date(0), 'NOT_PLAIN', '(root)'],
      [new Map(), 'NOT_PLAIN', '(root)'],
      [new Set([1]), 'NOT_PLAIN', '(root)'],
      [{ d: new Date(0) }, 'NOT_PLAIN', 'd'],
      [new (class Box {})(), 'NOT_PLAIN', '(root)'],
    ];
    for (const [value, code, where] of cases) {
      const error = catchCanonical(value);
      expect(error.code).toBe(code);
      expect(error.message.startsWith(`${where}:`)).toBe(true);
      expect(error.name).toBe('CanonicalError');
    }
  });

  it('refuses a value that contains itself, but not one used twice', () => {
    const loop: Record<string, unknown> = { a: 1 };
    loop['self'] = loop;
    expect(catchCanonical(loop).code).toBe('CYCLE');
    const list: unknown[] = [];
    list.push([list]);
    expect(catchCanonical(list).code).toBe('CYCLE');
  });

  it('refuses nesting deeper than 32 levels, and accepts 32', () => {
    const nest = (depth: number): unknown => {
      let value: unknown = 1;
      for (let i = 0; i < depth; i += 1) value = [value];
      return value;
    };
    expect(() => canonicalJson(nest(32))).not.toThrow();
    expect(catchCanonical(nest(33)).code).toBe('TOO_DEEP');
    expect(catchCanonical(nest(10_000)).code).toBe('TOO_DEEP');
  });
});

describe('sha256Hex', () => {
  it('matches the published test vectors', async () => {
    expect(await sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
    expect(
      await sha256Hex(
        'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'
      )
    ).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  });

  it('equals Node’s own hash of the UTF-8 bytes, for text of every script', async () => {
    const samples = [
      'é',
      '日本語のテキスト',
      'مرحبا',
      'สวัสดี',
      '😀🎉',
      'a'.repeat(10_000),
      '\u0000\ud800x',
    ];
    // a few hundred pseudo-random strings: a small linear congruential generator, fixed seed
    let state = 12345;
    const next = (): number => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return state;
    };
    for (let i = 0; i < 300; i += 1) {
      let s = '';
      const length = next() % 80;
      for (let j = 0; j < length; j += 1)
        s += String.fromCharCode(32 + (next() % 3000));
      samples.push(s);
    }
    for (const sample of samples) {
      const expected = createHash('sha256')
        .update(Buffer.from(sample, 'utf8'))
        .digest('hex');
      expect(await sha256Hex(sample)).toBe(expected);
    }
  });

  it('is 64 lowercase hex characters', async () => {
    expect(await sha256Hex('x')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('canonicalSha256', () => {
  it('is stable under a repeated hash and under a reordering of keys', async () => {
    const a = { one: 1, two: { b: 2, a: 1 } };
    const b = { two: { a: 1, b: 2 }, one: 1 };
    const first = await canonicalSha256(a);
    expect(await canonicalSha256(a)).toBe(first);
    expect(await canonicalSha256(b)).toBe(first);
    expect(first).toBe(
      createHash('sha256').update(canonicalJson(a), 'utf8').digest('hex')
    );
  });

  it('changes with any one character of the value', async () => {
    const base = await canonicalSha256({ price: 4367.2, id: 'Z1' });
    expect(await canonicalSha256({ price: 4367.21, id: 'Z1' })).not.toBe(base);
    expect(await canonicalSha256({ price: 4367.2, id: 'Z2' })).not.toBe(base);
    expect(
      await canonicalSha256({ price: 4367.2, id: 'Z1', extra: null })
    ).not.toBe(base);
  });

  it('rejects what canonicalJson rejects', async () => {
    await expect(canonicalSha256({ a: undefined })).rejects.toBeInstanceOf(
      CanonicalError
    );
  });
});

describePython('canonicalJson against Python', () => {
  it('writes the same text as json.dumps(sort_keys) for text and whole numbers within the BMP', () => {
    const samples: unknown[] = [
      {
        b: [1, 2, { z: 'é', a: null }],
        a: true,
        c: 'line\nbreak "quoted" \\ slash',
      },
      { '10': 1, '9': 2, a: { y: [], x: {} } },
      [1, -2, 3000000000, 'x', false],
      { مفتاح: 'قيمة', 日本: '語' },
    ];
    const script = [
      'import json, sys',
      'docs = json.load(sys.stdin)',
      'out = [json.dumps(d, sort_keys=True, separators=(",", ":"), ensure_ascii=False) for d in docs]',
      'sys.stdout.write(json.dumps(out, ensure_ascii=True))',
    ].join('\n');
    const run = runPython(['-c', script], { input: JSON.stringify(samples) });
    expect(run.status).toBe(0);
    const python = JSON.parse(run.stdout) as string[];
    expect(python).toEqual(samples.map((sample) => canonicalJson(sample)));
  });
});
