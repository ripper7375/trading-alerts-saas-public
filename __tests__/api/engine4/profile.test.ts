/**
 * @jest-environment node
 */

/**
 * GET and POST /api/engine4/profile (build step 5, part 6).
 *
 * The profile is read from and written to the trader's OWN rows (the id comes from
 * the session, nothing else), validated by `validateProfile` before anything is
 * written, and a change appends a history snapshot together with the move of the
 * current profile. The stores run for real against the in-memory stand-in.
 */

jest.mock('@/lib/auth/session', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .sessionModule()
);
jest.mock('@/lib/db/prisma', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .prismaModule()
);
jest.mock('@/lib/redis/client', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .redisModule()
);
jest.mock('@/lib/active-indicator/gateway-client', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .gatewayModule()
);

import * as route from '@/app/api/engine4/profile/route';
import { PROFILE_DEFAULTS } from '@/lib/engine4';
import { hashUserId, resolveAuditKey } from '@/lib/engine4/store/user-hash';

import {
  USER_ID,
  db,
  get,
  post,
  resetAll,
  signIn,
  world,
} from './helpers/mocks';
import { ROOMY } from './helpers/world';

const ORIGINAL_ENV = process.env;
const env = (): Record<string, string | undefined> =>
  process.env as Record<string, string | undefined>;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, ENGINE4_REPORT2_ENABLED: 'true' };
  jest.spyOn(Date, 'now').mockImplementation(() => world.nowMs);
  resetAll();
  signIn('PRO');
});

afterEach(() => jest.restoreAllMocks());
afterAll(() => {
  process.env = ORIGINAL_ENV;
});

const save = (profile: unknown, extra: object = {}): Promise<Response> =>
  route.POST(post('/api/engine4/profile', { profile, ...extra }));

describe('GET', () => {
  test('a trader with no profile gets the defaults to pre-fill the card, marked as not stored', async () => {
    const response = await route.GET(get('/api/engine4/profile'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      stored: false,
      profile: PROFILE_DEFAULTS,
      snapshotId: null,
      updatedAt: null,
    });
    expect(db.history).toEqual([]);
  });

  test('a trader with a profile gets it back, with the snapshot it was written as', async () => {
    const saved = await (await save(ROOMY)).json();
    const body = await (await route.GET(get('/api/engine4/profile'))).json();
    expect(body.stored).toBe(true);
    expect(body.profile).toEqual(ROOMY);
    expect(body.snapshotId).toBe(saved.snapshotId);
    expect(body.updatedAt).toBe('2026-10-10T08:00:00.000Z');
  });

  test('never shows another trader`s profile', async () => {
    await save(ROOMY);
    signIn('PRO', 'user_pro_2');
    const body = await (await route.GET(get('/api/engine4/profile'))).json();
    expect(body.stored).toBe(false);
    expect(body.profile).toEqual(PROFILE_DEFAULTS);
  });
});

describe('POST', () => {
  test('saves the profile and appends the first snapshot in one transaction', async () => {
    const response = await save(ROOMY);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, stored: true, changed: true });
    expect(body.profile).toEqual(ROOMY);
    expect(body.snapshotId).toMatch(/^[0-9a-f-]{36}$/);
    expect(db.transactions).toBe(1);
    expect(db.history).toHaveLength(1);
    expect(db.history[0]).toMatchObject({
      id: body.snapshotId,
      user_id: USER_ID,
      max_risk_pct: '1.5',
      max_leverage: '5',
      equity: '10000',
    });
    expect(db.prefs.get(USER_ID)).toMatchObject({
      snapshot_id: body.snapshotId,
    });
  });

  test('writes the keyed hash of the user id and the version of the key with the snapshot', async () => {
    await save(ROOMY);
    const expected = hashUserId(USER_ID, resolveAuditKey());
    expect(db.history[0]).toMatchObject({
      user_id_hash: expected.hash,
      key_version: expected.keyVersion,
    });
    expect(db.history[0]!.user_id_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(db.history[0]!.user_id_hash).not.toContain(USER_ID);
  });

  test('saving the profile the trader already has writes nothing', async () => {
    const first = await (await save(ROOMY)).json();
    const again = await (await save(ROOMY)).json();
    expect(again).toMatchObject({
      changed: false,
      snapshotId: first.snapshotId,
    });
    expect(db.history).toHaveLength(1);
  });

  test('a changed profile appends another snapshot and keeps the first', async () => {
    const first = await (await save(ROOMY)).json();
    const second = await (await save({ ...ROOMY, equity: '12000' })).json();
    expect(second.changed).toBe(true);
    expect(second.snapshotId).not.toBe(first.snapshotId);
    expect(db.history.map((row) => row.equity)).toEqual(['10000', '12000']);
    expect(db.prefs.get(USER_ID)).toMatchObject({
      snapshot_id: second.snapshotId,
      equity: '12000',
    });
  });

  test('numbers sent as numbers are stored as the canonical text of the number', async () => {
    const body = await (
      await save({ ...ROOMY, maxRiskPct: 1.25, equity: 12500.5, minSld: 15 })
    ).json();
    expect(body.profile).toMatchObject({
      maxRiskPct: '1.25',
      equity: '12500.5',
      minSld: '15',
    });
  });

  test('refuses an invalid profile with every problem, and writes nothing', async () => {
    const response = await save({
      ...ROOMY,
      maxRiskPct: '3',
      maxLeverage: '6',
      targetRrr: '1.2',
      style: 'YOLO',
    });
    const body = await response.json();
    expect(response.status).toBe(422);
    expect(body.error.code).toBe('INVALID_PROFILE');
    const fields = (body.error.details.issues as { field: string }[]).map(
      (issue) => issue.field
    );
    expect(fields).toEqual(
      expect.arrayContaining([
        'maxRiskPct',
        'maxLeverage',
        'targetRrr',
        'style',
      ])
    );
    expect(db.history).toEqual([]);
    expect(db.prefs.size).toBe(0);
    expect(db.transactions).toBe(0);
  });

  test('every bound is held at its line', async () => {
    const accepted: [string, string][] = [
      ['maxRiskPct', '0.5'],
      ['maxRiskPct', '2'],
      ['maxLeverage', '5'],
      ['targetRrr', '1.5'],
      ['targetRrr', '3.5'],
    ];
    for (const [field, value] of accepted) {
      resetAll();
      signIn('PRO');
      const response = await save({ ...ROOMY, [field]: value });
      expect([field, value, response.status]).toEqual([field, value, 200]);
    }
    const refused: [string, string][] = [
      ['maxRiskPct', '0.49'],
      ['maxRiskPct', '2.01'],
      ['maxLeverage', '5.01'],
      ['maxLeverage', '0'],
      ['targetRrr', '1.49'],
      ['targetRrr', '3.51'],
      ['equity', '0'],
      ['minSld', '0'],
      ['commission', '-1'],
    ];
    for (const [field, value] of refused) {
      resetAll();
      signIn('PRO');
      const response = await save({ ...ROOMY, [field]: value });
      expect([field, value, response.status]).toEqual([field, value, 422]);
    }
  });

  test('a missing metric is refused as REQUIRED, not filled in from the defaults', async () => {
    const { equity: _equity, ...rest } = ROOMY;
    const response = await save(rest);
    const body = await response.json();
    expect(response.status).toBe(422);
    expect(body.error.details.issues).toEqual([
      expect.objectContaining({ field: 'equity', code: 'REQUIRED' }),
    ]);
    expect(db.history).toEqual([]);
  });

  test('fields that are not the eight metrics are ignored, and the owner is always the session', async () => {
    const response = await route.POST(
      post('/api/engine4/profile', {
        userId: 'user_victim',
        user_id: 'user_victim',
        snapshotId: 'forged-snapshot',
        snapshot_id: 'forged-snapshot',
        user_id_hash: 'f'.repeat(64),
        key_version: 99,
        updatedAt: '1999-01-01T00:00:00.000Z',
        profile: {
          ...ROOMY,
          userId: 'user_victim',
          snapshotId: 'forged-snapshot',
        },
      })
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.snapshotId).not.toBe('forged-snapshot');
    expect(db.history).toHaveLength(1);
    expect(db.history[0]).toMatchObject({ user_id: USER_ID, key_version: 1 });
    expect(db.history[0]!.user_id_hash).not.toBe('f'.repeat(64));
    expect(db.prefs.has('user_victim')).toBe(false);
    expect(db.prefs.get(USER_ID)).toMatchObject({ equity: '10000' });
  });

  test('a __proto__ key in the JSON is only text: it changes no profile and pollutes nothing', async () => {
    const text = JSON.stringify({ profile: ROOMY }).replace(
      '{"traderType"',
      '{"__proto__":{"equity":"1","polluted":true},"traderType"'
    );
    expect(text).toContain('__proto__');
    const response = await route.POST(post('/api/engine4/profile', text));
    expect(response.status).toBe(200);
    expect(db.prefs.get(USER_ID)).toMatchObject({ equity: '10000' });
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  test.each([
    ['missing', {}],
    ['a string', { profile: 'x' }],
    ['an array', { profile: [] }],
    ['null', { profile: null }],
  ])('a profile that is %s is a 400', async (_label, payload) => {
    const response = await route.POST(post('/api/engine4/profile', payload));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  test('without the audit key nothing is written and the answer is a plain 503', async () => {
    const quiet = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    env()['NODE_ENV'] = 'production';
    delete env()['ENGINE4_AUDIT_HMAC_KEY'];
    const response = await save(ROOMY);
    const text = await response.text();
    expect(response.status).toBe(503);
    expect(JSON.parse(text).error.code).toBe('AUDIT_NOT_CONFIGURED');
    expect(text).not.toContain('ENGINE4_AUDIT_HMAC_KEY');
    expect(db.history).toEqual([]);
    expect(db.prefs.size).toBe(0);
    expect(quiet).toHaveBeenCalled();
  });

  test('a database failure rolls back, answers a plain 500, and leaks nothing', async () => {
    const quiet = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    db.failUpsert = true;
    const response = await save(ROOMY);
    const text = await response.text();
    expect(response.status).toBe(500);
    expect(JSON.parse(text).error).toEqual({
      code: 'INTERNAL',
      message: 'Something went wrong on our side.',
    });
    expect(text).not.toContain('upsert');
    expect(db.history).toEqual([]);
    expect(quiet).toHaveBeenCalled();
  });

  test('the trace names the stage it spent time in', async () => {
    const body = await (await save(ROOMY)).json();
    expect(body.trace.route).toBe('profile');
    expect(
      body.trace.timings.stages.map((s: { name: string }) => s.name)
    ).toEqual(['save']);
  });
});
