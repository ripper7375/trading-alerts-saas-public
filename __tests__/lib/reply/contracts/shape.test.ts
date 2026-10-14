/**
 * @jest-environment node
 */

import { Issues } from '@/lib/reply/contracts/intake';
import {
  CITE_ID,
  DIRECTION_KEY,
  FORBIDDEN_TEXT_CHARS,
  MAX_CITES,
  MAX_PLACEHOLDERS_PER_TEXT,
  MAX_ZONES,
  VALUE_ID,
  ZONE_ID,
  checkCites,
  checkLines,
  checkZoneIds,
  contextOfPacket,
  exactModelObject,
  modelText,
  scanPlaceholders,
} from '@/lib/reply/contracts/shape';

import { VALUE_IDS, clone, packetFor } from '../helpers/fixtures';

/** A character by code point (the file tools turn `\u` escapes into the characters themselves). */
const ch = (code: number): string => String.fromCodePoint(code);

const run = <T>(fn: (issues: Issues) => T): { value: T; issues: string[] } => {
  const issues = new Issues();
  const value = fn(issues);
  return {
    value,
    issues: issues.list.map((i) => `${i.path}:${i.code}`),
  };
};

describe('VALUE_ID, the id of a value in braces', () => {
  it.each([
    'LAST_PRICE',
    'MCD2.baseline',
    'MCD2.UOEDT',
    'Z1.invalidation',
    'DAY.high',
    'MCD15.sr_1',
    'Z1.a.b.c',
    'A',
    'A'.repeat(24),
    `MCD2.${'x'.repeat(32)}`,
  ])('accepts %s', (id) => {
    expect(VALUE_ID.test(id)).toBe(true);
  });

  it.each([
    '',
    'lower',
    '1MCD',
    'MCD2.',
    '.baseline',
    'MCD2..baseline',
    'MCD2.base line',
    'MCD2.base-line',
    'MCD2.a.b.c.d',
    'A'.repeat(25),
    `MCD2.${'x'.repeat(33)}`,
    'MCD2.é',
    ' MCD2',
    'MCD2 ',
    'MCD2\n',
  ])('refuses %j', (id) => {
    expect(VALUE_ID.test(id)).toBe(false);
  });
});

describe('scanPlaceholders', () => {
  it('lists the well-formed ids in order, repeats kept', () => {
    expect(
      scanPlaceholders('a {MCD2.baseline} b {Z1.invalidation} {MCD2.baseline}')
    ).toEqual({
      ids: ['MCD2.baseline', 'Z1.invalidation', 'MCD2.baseline'],
      faults: [],
    });
    expect(scanPlaceholders('{A}{B}')).toEqual({ ids: ['A', 'B'], faults: [] });
    expect(scanPlaceholders('no braces at all')).toEqual({
      ids: [],
      faults: [],
    });
    expect(scanPlaceholders('')).toEqual({ ids: [], faults: [] });
  });

  it.each([
    ['a stray open brace', 'price { is', 1],
    ['a stray close brace', 'price } is', 1],
    ['an empty placeholder', 'price {} is', 1],
    ['a placeholder with spaces', 'price { MCD2.baseline } is', 1],
    ['a lower-case head', 'price {mcd2.baseline} is', 1],
    ['a nested pair', 'price {{MCD2.baseline}} is', 2],
    ['an unterminated one', 'price {MCD2.baseline is', 1],
    ['a number in braces', 'price {4367.25} is', 1],
    ['two bad ones', '{} {x}', 2],
  ])('names the fault in %s', (_name, text, faults) => {
    expect(scanPlaceholders(text).faults).toHaveLength(faults);
  });

  it('does not list a malformed placeholder as an id', () => {
    expect(scanPlaceholders('{x} {MCD2.baseline}').ids).toEqual([
      'MCD2.baseline',
    ]);
  });
});

describe('modelText', () => {
  const rule = { max: 20 };

  it('accepts plain text and returns it', () => {
    const { value, issues } = run((i) =>
      modelText('Price holds', 'p', i, rule)
    );
    expect(value).toBe('Price holds');
    expect(issues).toEqual([]);
  });

  it('holds the length at its boundary', () => {
    expect(run((i) => modelText('x'.repeat(20), 'p', i, rule)).issues).toEqual(
      []
    );
    expect(run((i) => modelText('x'.repeat(21), 'p', i, rule)).issues).toEqual([
      'p:TOO_LONG',
    ]);
    expect(run((i) => modelText('', 'p', i, rule)).issues).toEqual([
      'p:TOO_SHORT',
    ]);
  });

  it('refuses a blank text, whatever the blank is', () => {
    for (const blank of ['   ', ' ', ch(0x00a0), ch(0x3000), ch(0x2003)]) {
      expect(run((i) => modelText(blank, 'p', i, rule)).issues).toEqual([
        'p:TOO_SHORT',
      ]);
    }
  });

  it('refuses what is not a string', () => {
    for (const value of [null, undefined, 4, {}, [], true]) {
      expect(run((i) => modelText(value, 'p', i, rule)).issues).toEqual([
        'p:WRONG_TYPE',
      ]);
    }
  });

  it.each([
    ['a newline', '\n'],
    ['a tab', '\t'],
    ['a NUL', ch(0)],
    ['DEL', ch(0x7f)],
    ['a C1 control', ch(0x85)],
    ['the line separator', ch(0x2028)],
    ['the paragraph separator', ch(0x2029)],
    ['a right-to-left override', ch(0x202e)],
    ['a left-to-right embedding', ch(0x202a)],
    ['a pop directional formatting', ch(0x202c)],
    ['a first strong isolate', ch(0x2068)],
    ['a left-to-right isolate', ch(0x2066)],
    ['a pop directional isolate', ch(0x2069)],
    ['the byte order mark', ch(0xfeff)],
    ['a tag character', ch(0xe0041)],
    ['the first tag character', ch(0xe0000)],
    ['the last tag character', ch(0xe007f)],
  ])('refuses %s anywhere in the text', (_name, bad) => {
    for (const text of [`a${bad}b`, `${bad}ab`, `ab${bad}`]) {
      expect(run((i) => modelText(text, 'p', i, rule)).issues).toEqual([
        'p:BAD_FORMAT',
      ]);
    }
  });

  it.each([
    ['a zero-width non-joiner (Persian, Urdu)', ch(0x200c)],
    ['a zero-width joiner', ch(0x200d)],
    ['a left-to-right mark', ch(0x200e)],
    ['a right-to-left mark (Arabic)', ch(0x200f)],
    ['an Arabic letter mark', ch(0x061c)],
    ['a no-break space', ch(0x00a0)],
  ])('allows %s in a text with other characters', (_name, mark) => {
    expect(run((i) => modelText(`a${mark}b`, 'p', i, rule)).issues).toEqual([]);
  });

  it('counts the characters of a text in other scripts like any other', () => {
    expect(run((i) => modelText('سعر الذهب', 'p', i, rule)).issues).toEqual([]);
    expect(run((i) => modelText('ราคาทองคำ', 'p', i, rule)).issues).toEqual([]);
    expect(
      run((i) => modelText('金价'.repeat(10), 'p', i, rule)).issues
    ).toEqual([]);
    expect(
      run((i) => modelText('金价'.repeat(11), 'p', i, rule)).issues
    ).toEqual(['p:TOO_LONG']);
  });

  it('reports a malformed brace and does not return the text', () => {
    const { value, issues } = run((i) =>
      modelText('a { b', 'p', i, { max: 50 })
    );
    expect(value).toBeUndefined();
    expect(issues).toEqual(['p:BAD_FORMAT']);
  });

  it('allows eight placeholders and refuses nine', () => {
    const eight = Array.from(
      { length: MAX_PLACEHOLDERS_PER_TEXT },
      () => '{A}'
    ).join(' ');
    const nine = `${eight} {A}`;
    expect(run((i) => modelText(eight, 'p', i, { max: 200 })).issues).toEqual(
      []
    );
    expect(run((i) => modelText(nine, 'p', i, { max: 200 })).issues).toEqual([
      'p:TOO_MANY',
    ]);
  });

  it('checks the placeholders against the context, and not without one', () => {
    const known = new Set(['MCD2.baseline']);
    expect(
      run((i) => modelText('at {MCD2.baseline}', 'p', i, { max: 50 }, known))
        .issues
    ).toEqual([]);
    expect(
      run((i) => modelText('at {MCD2.other}', 'p', i, { max: 50 }, known))
        .issues
    ).toEqual(['p:NOT_ONE_OF']);
    expect(
      run((i) =>
        modelText('at {MCD2.other} {MCD2.other}', 'p', i, { max: 50 }, known)
      ).issues
    ).toEqual(['p:NOT_ONE_OF']);
    expect(
      run((i) => modelText('at {MCD2.other}', 'p', i, { max: 50 })).issues
    ).toEqual([]);
  });
});

describe('FORBIDDEN_TEXT_CHARS', () => {
  it('is a global-safe regular expression (a .test call never keeps state)', () => {
    expect(FORBIDDEN_TEXT_CHARS.global).toBe(false);
    expect(FORBIDDEN_TEXT_CHARS.test('a\nb')).toBe(true);
    expect(FORBIDDEN_TEXT_CHARS.test('a\nb')).toBe(true);
  });
});

describe('checkCites', () => {
  const cites = (value: unknown, context = {}) =>
    run((i) => checkCites(value, 'c', i, context));

  it.each(['MCD1', 'MCD9', 'MCD10', 'MCD15', 'Z1', 'Z5', 'SYN'])(
    'accepts %s',
    (id) => {
      expect(cites([id])).toEqual({ value: [id], issues: [] });
    }
  );

  it.each([
    'MCD0',
    'MCD16',
    'MCD01',
    'MCD',
    'Z0',
    'Z6',
    'Z10',
    'syn',
    'SYN2',
    'MCD1 ',
    4,
    null,
  ])('refuses %j', (id) => {
    expect(cites([id]).issues).toHaveLength(1);
  });

  it('holds the count at its boundary', () => {
    const ok = ['MCD1', 'MCD2', 'MCD3', 'Z1'];
    expect(ok).toHaveLength(MAX_CITES);
    expect(cites(ok).issues).toEqual([]);
    expect(cites([...ok, 'Z2']).issues).toEqual(['c:TOO_MANY']);
    expect(cites([]).issues).toEqual([]);
  });

  it('refuses a cite twice and names the second', () => {
    expect(cites(['MCD1', 'MCD1']).issues).toEqual(['c[1]:DUPLICATE']);
  });

  it('refuses what is not a list', () => {
    for (const value of ['MCD1', {}, null, 3]) {
      expect(cites(value).issues).toEqual(['c:WRONG_TYPE']);
    }
  });

  it('refuses an id the packet does not have, given a context, and not without one', () => {
    expect(cites(['MCD4']).issues).toEqual([]);
    expect(cites(['MCD4'], { citeIds: ['MCD1'] }).issues).toEqual([
      'c[0]:NOT_ONE_OF',
    ]);
    expect(cites(['MCD1'], { citeIds: ['MCD1'] }).issues).toEqual([]);
    expect(cites(['MCD1'], { citeIds: [] }).issues).toEqual([
      'c[0]:NOT_ONE_OF',
    ]);
  });
});

describe('checkZoneIds', () => {
  const zones = (value: unknown, context = {}) =>
    run((i) => checkZoneIds(value, 'z', i, context));

  it('accepts Z1 to Z5 and an empty list', () => {
    expect(zones(['Z1', 'Z2', 'Z3', 'Z4', 'Z5']).issues).toEqual([]);
    expect(zones([]).issues).toEqual([]);
  });

  it('refuses Z0, Z6, a sensor id and other shapes', () => {
    for (const id of ['Z0', 'Z6', 'MCD1', 'z1', 'Z1 ', 1]) {
      expect(zones([id]).issues).toHaveLength(1);
    }
  });

  it('holds the count and the repeats', () => {
    expect(MAX_ZONES).toBe(5);
    expect(zones(['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z1']).issues).toEqual([
      'z:TOO_MANY',
    ]);
    expect(zones(['Z1', 'Z2', 'Z1']).issues).toEqual(['z[2]:DUPLICATE']);
  });

  it('refuses a zone the reading does not have, given a context', () => {
    expect(zones(['Z3']).issues).toEqual([]);
    expect(zones(['Z3'], { zoneIds: ['Z1', 'Z2'] }).issues).toEqual([
      'z[0]:NOT_ONE_OF',
    ]);
    expect(zones(['Z1'], { zoneIds: [] }).issues).toEqual(['z[0]:NOT_ONE_OF']);
  });

  it('has patterns that agree with the zone limit of the synthesis', () => {
    expect(ZONE_ID.test('Z5')).toBe(true);
    expect(ZONE_ID.test('Z6')).toBe(false);
    expect(CITE_ID.test('Z5')).toBe(true);
  });
});

describe('checkLines', () => {
  const rule = { min: 1, max: 2, textMax: 30 };
  const lines = (value: unknown, context = {}) =>
    run((i) => checkLines(value, 'l', i, rule, context));

  it('returns the lines it checked', () => {
    const value = [{ text: 'M5 holds', cites: ['MCD2'] }];
    expect(lines(value)).toEqual({ value, issues: [] });
  });

  it('holds the count at its boundaries', () => {
    const line = { text: 'x', cites: [] };
    expect(lines([]).issues).toEqual(['l:TOO_SHORT']);
    expect(lines([line, line]).issues).toEqual([]);
    expect(lines([line, line, line]).issues).toEqual(['l:TOO_MANY']);
  });

  it('refuses an extra key, a missing key and a wrong type, at the line', () => {
    expect(lines([{ text: 'x', cites: [], extra: 1 }]).issues).toEqual([
      'l[0].extra:UNKNOWN_KEY',
    ]);
    expect(lines([{ text: 'x' }]).issues).toEqual(['l[0].cites:REQUIRED']);
    expect(lines([{ cites: [] }]).issues).toEqual(['l[0].text:REQUIRED']);
    expect(lines(['x']).issues).toEqual(['l[0]:WRONG_TYPE']);
    expect(lines([{ text: 4, cites: [] }]).issues).toEqual([
      'l[0].text:WRONG_TYPE',
    ]);
  });

  it('passes the placeholders and the cites to the context', () => {
    const context = { valueIds: ['A'], citeIds: ['MCD1'] };
    expect(lines([{ text: '{A}', cites: ['MCD1'] }], context).issues).toEqual(
      []
    );
    expect(lines([{ text: '{B}', cites: ['MCD1'] }], context).issues).toEqual([
      'l[0].text:NOT_ONE_OF',
    ]);
    expect(lines([{ text: '{A}', cites: ['MCD2'] }], context).issues).toEqual([
      'l[0].cites[0]:NOT_ONE_OF',
    ]);
  });

  it('applies the text limit of the rule to each line', () => {
    expect(lines([{ text: 'x'.repeat(30), cites: [] }]).issues).toEqual([]);
    expect(lines([{ text: 'x'.repeat(31), cites: [] }]).issues).toEqual([
      'l[0].text:TOO_LONG',
    ]);
  });
});

describe('exactModelObject', () => {
  const object = (value: unknown) =>
    run((i) => exactModelObject(value, '', ['a', 'b'], i));

  it('accepts exactly its keys', () => {
    expect(object({ a: 1, b: 2 }).issues).toEqual([]);
  });

  it('reports a missing key as REQUIRED and an extra one as UNKNOWN_KEY', () => {
    expect(object({ a: 1 }).issues).toEqual(['b:REQUIRED']);
    expect(object({ a: 1, b: 2, c: 3 }).issues).toEqual(['c:UNKNOWN_KEY']);
  });

  it.each([
    'direction',
    'bias',
    'side',
    'signal',
    'stance',
    'call',
    'recommendation',
    'action_side',
    'trend',
    'trend_relation',
    'archetype',
    'rule',
    'rule_id',
    'stand_aside',
    'Direction',
    'BIAS',
  ])('reports %s as a FORBIDDEN_KEY, not an unknown key', (key) => {
    expect(object({ a: 1, b: 2, [key]: 'LONG' }).issues).toEqual([
      `${key}:FORBIDDEN_KEY`,
    ]);
  });

  it('does not take a longer word for a direction key', () => {
    expect(DIRECTION_KEY.test('directions')).toBe(false);
    expect(DIRECTION_KEY.test('biased')).toBe(false);
    expect(object({ a: 1, b: 2, sidekick: 1 }).issues).toEqual([
      'sidekick:UNKNOWN_KEY',
    ]);
  });

  it('names the path of a nested object', () => {
    const issues = new Issues();
    exactModelObject(
      { a: 1, b: 2, bias: 'LONG' },
      'report',
      ['a', 'b'],
      issues
    );
    expect(issues.list.map((i) => `${i.path}:${i.code}`)).toEqual([
      'report.bias:FORBIDDEN_KEY',
    ]);
  });

  it('refuses what is not a plain object', () => {
    for (const value of [null, [], 'x', 4, undefined]) {
      expect(object(value).issues).toEqual([':WRONG_TYPE']);
    }
  });
});

describe('contextOfPacket', () => {
  it('lists the zones, what may be cited, the value ids and the reply locale', () => {
    const packet = packetFor('01');
    const context = contextOfPacket(packet, VALUE_IDS);
    expect(context.zoneIds).toEqual(['Z1', 'Z2']);
    expect([...(context.citeIds ?? [])].sort()).toEqual(
      ['MCD1', 'MCD2', 'MCD3', 'SYN', 'Z1', 'Z2'].sort()
    );
    expect(context.valueIds).toEqual(VALUE_IDS);
    expect(context.replyLocale).toBe(packet.question.reply_locale);
  });

  it('never lets the gate be cited', () => {
    const cites = contextOfPacket(packetFor('01')).citeIds ?? [];
    expect(cites).not.toContain('MCD0');
  });

  it('has no zones for a reading that has none, and no value ids unless they are given', () => {
    const context = contextOfPacket(packetFor('02'));
    expect(context.zoneIds).toEqual([]);
    expect('valueIds' in context).toBe(false);
  });

  it('does not offer the synthesis when the packet has no reading of it', () => {
    const packet = clone(packetFor('01'));
    packet.readings.synthesis = null;
    const context = contextOfPacket(packet);
    expect(context.citeIds).not.toContain('SYN');
    expect(context.zoneIds).toEqual([]);
  });
});

describe('the limits and the characters of a model text, at their edges', () => {
  it('pins the placeholder limit', () => {
    expect(MAX_PLACEHOLDERS_PER_TEXT).toBe(8);
  });

  it.each([
    ['U+2028 line separator', 0x2028],
    ['U+2029 paragraph separator', 0x2029],
    ['U+202A left-to-right embedding', 0x202a],
    ['U+202B right-to-left embedding', 0x202b],
    ['U+202C pop directional formatting', 0x202c],
    ['U+202D left-to-right override', 0x202d],
    ['U+202E right-to-left override', 0x202e],
    ['U+2066 left-to-right isolate', 0x2066],
    ['U+2067 right-to-left isolate', 0x2067],
    ['U+2068 first strong isolate', 0x2068],
    ['U+2069 pop directional isolate', 0x2069],
    ['U+FEFF byte order mark', 0xfeff],
    ['U+E0000 first tag character', 0xe0000],
    ['U+E0041 a tag letter', 0xe0041],
    ['U+E007F last tag character', 0xe007f],
    ['U+0000 control', 0x0],
    ['U+001F control', 0x1f],
    ['U+007F delete', 0x7f],
    ['U+009F last C1 control', 0x9f],
  ])('refuses %s', (_name, code) => {
    expect(FORBIDDEN_TEXT_CHARS.test(`a${ch(code)}b`)).toBe(true);
  });

  it.each([
    ['U+0020 space', 0x20],
    ['U+00A0 no-break space', 0xa0],
    ['U+061C Arabic letter mark', 0x61c],
    ['U+200C zero width non-joiner', 0x200c],
    ['U+200D zero width joiner', 0x200d],
    ['U+200E left-to-right mark', 0x200e],
    ['U+200F right-to-left mark', 0x200f],
    ['U+2027 hyphenation point', 0x2027],
    ['U+202F narrow no-break space', 0x202f],
    ['U+2030 per mille sign', 0x2030],
    ['U+2065 before the isolates', 0x2065],
    ['U+206A after the isolates', 0x206a],
    ['U+2070 superscript zero', 0x2070],
    ['U+FEFE before the byte order mark', 0xfefe],
    ['U+DFFFF before the tag block', 0xdffff],
    ['U+E0080 after the tag block', 0xe0080],
    ['an emoji', 0x1f4c8],
  ])('allows %s', (_name, code) => {
    expect(FORBIDDEN_TEXT_CHARS.test(`a${ch(code)}b`)).toBe(false);
  });
});

describe('scanPlaceholders: what it says about a fault', () => {
  it('names a stray brace and where it is', () => {
    expect(scanPlaceholders('a { b').faults).toEqual(['a stray "{" at 2']);
    expect(scanPlaceholders('ab }').faults).toEqual(['a stray "}" at 3']);
  });

  it('names a placeholder that is no value id, cut at 40 characters', () => {
    expect(scanPlaceholders('x {not valid}').faults).toEqual([
      '"{not valid}" at 2 is not a value id',
    ]);
    const long = 'q'.repeat(60);
    expect(scanPlaceholders(`{${long}}`).faults).toEqual([
      `"{${'q'.repeat(40)}}" at 0 is not a value id`,
    ]);
    expect(scanPlaceholders('{}').faults).toEqual([
      '"{}" at 0 is not a value id',
    ]);
  });
});

describe('DIRECTION_KEY is a whole word, in any case', () => {
  it.each(['direction', 'BIAS', 'Side', 'rule_id', 'stand_aside'])(
    'takes %s',
    (key) => {
      expect(DIRECTION_KEY.test(key)).toBe(true);
    }
  );

  it.each([
    'xdirection',
    'my_bias',
    'biases',
    'rule_ids',
    'a stance',
    'sidekick',
    ' bias',
    'bias ',
    'bias\n',
  ])('does not take %j', (key) => {
    expect(DIRECTION_KEY.test(key)).toBe(false);
  });
});

describe('a bad id in a list is reported once and does not count as chosen', () => {
  it('cites: a bad id gives BAD_FORMAT only, even with a packet to check against', () => {
    const context = { citeIds: ['MCD1'] };
    const { value, issues } = run((i) =>
      checkCites(['bad!', 'MCD1'], 'c', i, context)
    );
    expect(issues).toEqual(['c[0]:BAD_FORMAT']);
    expect(value).toEqual(['MCD1']);
  });

  it('zone ids: a bad id gives BAD_FORMAT only, even with a packet to check against', () => {
    const context = { zoneIds: ['Z1'] };
    const { value, issues } = run((i) =>
      checkZoneIds(['Z9', 'Z1'], 'z', i, context)
    );
    expect(issues).toEqual(['z[0]:BAD_FORMAT']);
    expect(value).toEqual(['Z1']);
  });
});
