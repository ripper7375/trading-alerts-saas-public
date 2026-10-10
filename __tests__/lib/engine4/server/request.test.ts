/**
 * @jest-environment node
 */

/**
 * Reading a request body and the few things the routes take from it (build step 5,
 * part 6). Every reader builds a new value from NAMED keys; nothing is spread, so a
 * field nobody asked for has nowhere to go.
 */

import {
  DEFAULT_LANGUAGE,
  MAX_BODY_CHARS,
  readConsentAction,
  readCycleSlot,
  readJsonBody,
  readLanguage,
  readProfileCandidate,
  readSetupFields,
  readShownSha256,
  readSubmissionId,
  readZoneId,
} from '@/lib/engine4/server/request';

const req = (
  body: string,
  headers: Record<string, string> = { 'content-type': 'application/json' }
): Request =>
  new Request('http://localhost/x', { method: 'POST', headers, body });

describe('readJsonBody', () => {
  test('reads a JSON object', async () => {
    expect(await readJsonBody(req('{"a":1}'))).toEqual({
      ok: true,
      body: { a: 1 },
    });
  });

  test.each([
    ['application/json', true],
    ['application/json; charset=utf-8', true],
    ['APPLICATION/JSON', true],
    ['application/json ;charset=utf-8', true],
    ['application/jsonp', false],
    ['application/json-patch+json', false],
    ['text/plain', false],
    ['text/json', false],
    ['multipart/form-data', false],
    ['', false],
  ])('the media type %p is %p', async (type, accepted) => {
    const headers: Record<string, string> =
      type === '' ? {} : { 'content-type': type };
    const read = await readJsonBody(req('{}', headers));
    expect(read.ok).toBe(accepted);
    if (!read.ok) expect(read.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  test('is limited in size by the declared length and by the text itself', async () => {
    const declared = await readJsonBody(
      req('{}', {
        'content-type': 'application/json',
        'content-length': String(MAX_BODY_CHARS + 1),
      })
    );
    expect(declared).toMatchObject({ ok: false, code: 'PAYLOAD_TOO_LARGE' });
    const text = JSON.stringify({ pad: 'x'.repeat(MAX_BODY_CHARS) });
    expect(await readJsonBody(req(text))).toMatchObject({
      ok: false,
      code: 'PAYLOAD_TOO_LARGE',
    });
    // exactly at the limit is accepted
    const pad = 'x'.repeat(MAX_BODY_CHARS - JSON.stringify({ p: '' }).length);
    const exact = JSON.stringify({ p: pad });
    expect(exact.length).toBe(MAX_BODY_CHARS);
    expect((await readJsonBody(req(exact))).ok).toBe(true);
  });

  test('a declared length that is not a number is ignored, the text decides', async () => {
    const read = await readJsonBody(
      req('{}', {
        'content-type': 'application/json',
        'content-length': 'abc',
      })
    );
    expect(read.ok).toBe(true);
  });

  test('a declared length is judged as a number: the limit itself is allowed, a longer one with a zero in it is not', async () => {
    const withLength = (length: string, body = '{}') =>
      readJsonBody(
        req(body, {
          'content-type': 'application/json',
          'content-length': length,
        })
      );
    expect((await withLength(String(MAX_BODY_CHARS))).ok).toBe(true);
    expect((await withLength('2')).ok).toBe(true);
    expect((await withLength('0')).ok).toBe(true);
    expect(await withLength('20000')).toMatchObject({
      ok: false,
      code: 'PAYLOAD_TOO_LARGE',
    });
    expect(await withLength('100000')).toMatchObject({
      ok: false,
      code: 'PAYLOAD_TOO_LARGE',
    });
  });

  test.each([['nope'], [''], ['[]'], ['"x"'], ['5'], ['null'], ['true']])(
    '%p is a 400',
    async (text) => {
      expect(await readJsonBody(req(text))).toMatchObject({
        ok: false,
        code: 'BAD_REQUEST',
      });
    }
  );

  test('a body that cannot be read is a 400', async () => {
    const broken = {
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => {
        throw new Error('stream error');
      },
    } as unknown as Request;
    expect(await readJsonBody(broken)).toMatchObject({
      ok: false,
      code: 'BAD_REQUEST',
    });
  });
});

describe('readCycleSlot', () => {
  const SLOT = 1_789_764_900;

  test('reads a number and digit text the same', () => {
    expect(readCycleSlot({ cycleSlot: SLOT }, true)).toEqual({
      ok: true,
      value: SLOT,
    });
    expect(readCycleSlot({ cycleSlot: String(SLOT) }, true)).toEqual({
      ok: true,
      value: SLOT,
    });
    expect(readCycleSlot({ cycleSlot: ` ${SLOT} ` }, true)).toEqual({
      ok: true,
      value: SLOT,
    });
    expect(readCycleSlot({ cycleSlot: BigInt(SLOT) }, true)).toEqual({
      ok: true,
      value: SLOT,
    });
  });

  test('absent is null when optional and a refusal when required', () => {
    expect(readCycleSlot({}, false)).toEqual({ ok: true, value: null });
    expect(readCycleSlot({ cycleSlot: null }, false)).toEqual({
      ok: true,
      value: null,
    });
    expect(readCycleSlot({}, true)).toMatchObject({ ok: false });
    expect(readCycleSlot({ cycleSlot: null }, true)).toMatchObject({
      ok: false,
    });
  });

  test('the largest cycle that fits a 32-bit column is the line', () => {
    expect(readCycleSlot({ cycleSlot: 2_147_483_400 }, true)).toEqual({
      ok: true,
      value: 2_147_483_400,
    });
    expect(readCycleSlot({ cycleSlot: 2_147_483_700 }, true)).toMatchObject({
      ok: false,
    });
  });

  test.each([
    [0],
    [-300],
    [1.5],
    [1_789_764_901],
    ['1789764901'],
    ['1e9'],
    ['0x10'],
    ['01789764900'],
    ['abc'],
    [''],
    ['300 300'],
    [{}],
    [[]],
    [[300]],
    [true],
    [Number.NaN],
    [Infinity],
  ])('%p is refused, required or not', (value) => {
    expect(readCycleSlot({ cycleSlot: value }, true)).toMatchObject({
      ok: false,
    });
    expect(readCycleSlot({ cycleSlot: value }, false)).toMatchObject({
      ok: false,
    });
  });

  test('only an own key is read', () => {
    const inherited = Object.create({ cycleSlot: SLOT }) as Record<
      string,
      unknown
    >;
    expect(readCycleSlot(inherited, true)).toMatchObject({ ok: false });
  });
});

describe('readZoneId', () => {
  test('reads a zone id, and absent or empty is null', () => {
    expect(readZoneId({ zoneId: 'Z1' })).toEqual({ ok: true, value: 'Z1' });
    expect(readZoneId({ zoneId: 'zone_1-b' })).toEqual({
      ok: true,
      value: 'zone_1-b',
    });
    expect(readZoneId({ zoneId: 'Z'.repeat(32) }).ok).toBe(true);
    // every character the pattern names: letters, all ten digits, - and _, and a single character
    for (const id of ['Z', 'z', 'Z0', 'Z9', 'Z29', 'a0_9-Z', '0123456789']) {
      expect(readZoneId({ zoneId: id })).toEqual({ ok: true, value: id });
    }
    for (const body of [{}, { zoneId: null }, { zoneId: '' }]) {
      expect(readZoneId(body)).toEqual({ ok: true, value: null });
    }
  });

  test.each([
    ['Z 1'],
    ['Z1/..'],
    ['Z'.repeat(33)],
    ['é'],
    [5],
    [{}],
    [['Z1']],
    [true],
  ])('%p is refused', (value) => {
    expect(readZoneId({ zoneId: value })).toMatchObject({ ok: false });
  });
});

describe('readSetupFields', () => {
  test('takes the seven named inputs and nothing else', () => {
    const body = JSON.parse(
      '{"side":"BUY","zoneId":"Z1","entry":"4367.2","equity":10000,"riskPct":"0.75","stopDistance":16.78,"rrr":"1.75",' +
        '"lot":"99","profile":{"maxRiskPct":"100"},"ok":true,"__proto__":{"entry":"1"}}'
    ) as Record<string, unknown>;
    expect(readSetupFields(body)).toEqual({
      side: 'BUY',
      zoneId: 'Z1',
      entry: '4367.2',
      equity: 10000,
      riskPct: '0.75',
      stopDistance: 16.78,
      rrr: '1.75',
    });
  });

  test('leaves out what is absent, and keeps null and empty so the validator can say so', () => {
    expect(readSetupFields({})).toEqual({});
    expect(readSetupFields({ entry: null, equity: '' })).toEqual({
      entry: null,
      equity: '',
    });
  });

  test('does not read an inherited key', () => {
    const inherited = Object.create({ entry: '1' }) as Record<string, unknown>;
    expect(readSetupFields(inherited)).toEqual({});
  });
});

describe('readProfileCandidate', () => {
  const ALL = {
    traderType: 'DAY_TRADER',
    style: 'BOTH',
    maxRiskPct: '1.5',
    maxLeverage: '5',
    targetRrr: '1.75',
    equity: '10000',
    minSld: '13',
    commission: '4',
  };

  test('takes the eight metrics and nothing else', () => {
    expect(
      readProfileCandidate({
        profile: { ...ALL, userId: 'x', snapshotId: 'y' },
      })
    ).toEqual({ ok: true, value: ALL });
  });

  test('a metric that is absent is absent (the validator says REQUIRED)', () => {
    const { equity: _equity, ...rest } = ALL;
    expect(readProfileCandidate({ profile: rest })).toEqual({
      ok: true,
      value: rest,
    });
  });

  test.each([[undefined], [null], ['x'], [5], [[]], [true]])(
    'a profile of %p is refused',
    (profile) => {
      expect(readProfileCandidate({ profile })).toMatchObject({ ok: false });
    }
  );
});

describe('readLanguage', () => {
  test('is the default when absent, and a supported code otherwise', () => {
    expect(DEFAULT_LANGUAGE).toBe('en-US');
    for (const body of [{}, { language: null }, { language: '' }]) {
      expect(readLanguage(body)).toEqual({ ok: true, value: 'en-US' });
    }
    for (const code of ['en-GB', 'ar', 'ur', 'zh-TW', 'pt-BR', 'tr']) {
      expect(readLanguage({ language: code })).toEqual({
        ok: true,
        value: code,
      });
    }
  });

  test.each([['xx'], ['en'], ['EN-US'], ['en-us'], [5], [{}], ['<script>']])(
    '%p is refused',
    (language) => {
      expect(readLanguage({ language })).toMatchObject({ ok: false });
    }
  );
});

describe('readSubmissionId', () => {
  test('is 16 to 64 letters, digits, - or _', () => {
    for (const id of [
      'a'.repeat(16),
      'a'.repeat(64),
      'press-00000001-abcdefghij',
      '0123456789ABCDEF_-',
    ]) {
      expect(readSubmissionId({ submissionId: id })).toEqual({
        ok: true,
        value: id,
      });
    }
    for (const id of [
      'a'.repeat(15),
      'a'.repeat(65),
      'has space aaaaaaaaa',
      'slash/aaaaaaaaaaaaa',
      '',
      5,
      null,
      undefined,
    ]) {
      expect(readSubmissionId({ submissionId: id })).toMatchObject({
        ok: false,
      });
    }
  });
});

describe('readShownSha256', () => {
  test('is 64 lowercase hex characters', () => {
    expect(readShownSha256({ shownSetupSha256: 'a'.repeat(64) })).toEqual({
      ok: true,
      value: 'a'.repeat(64),
    });
    for (const bad of [
      'A'.repeat(64),
      'a'.repeat(63),
      'a'.repeat(65),
      'g'.repeat(64),
      '',
      5,
      null,
      undefined,
    ]) {
      expect(readShownSha256({ shownSetupSha256: bad })).toMatchObject({
        ok: false,
      });
    }
  });
});

describe('readConsentAction', () => {
  test('is one of three upper-case words', () => {
    for (const a of ['ACCEPT', 'MODIFY', 'DECLINE'] as const) {
      expect(readConsentAction({ action: a })).toEqual({ ok: true, value: a });
    }
    for (const bad of [
      'accept',
      'CANCEL',
      'ACCEPT ',
      '',
      5,
      null,
      undefined,
      ['ACCEPT'],
    ]) {
      expect(readConsentAction({ action: bad })).toMatchObject({ ok: false });
    }
  });
});
