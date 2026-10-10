/**
 * @jest-environment node
 */

/**
 * Who may call the Engine 4 routes (build step 5, part 6; plan A4).
 *
 * The flag first (off by default, and off means 404 to everybody, signed in or not),
 * then the session (401), then the tier (403: Report 2 is Pro only). Each of the five
 * handlers is held to the same table. After a refusal NOTHING has been read: no
 * session when the flag is off, no reader, no Redis, no write.
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
jest.mock('@/lib/engine4/read/cycle', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .cycleModule()
);
jest.mock('@/lib/engine4/read/specs', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .specsModule()
);
jest.mock('@/lib/engine4/read/events', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .eventsModule()
);
jest.mock('@/lib/engine4/read/bars', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .barsModule()
);
jest.mock('@/lib/engine4/read/synthesis', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .synthesisModule()
);
jest.mock('@/lib/engine4/read/structure-levels', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .structureModule()
);

import * as consentRoute from '@/app/api/engine4/consent/route';
import * as offerRoute from '@/app/api/engine4/offer/route';
import * as profileRoute from '@/app/api/engine4/profile/route';
import * as sizeRoute from '@/app/api/engine4/size/route';
import { ENGINE4_VERSION } from '@/lib/engine4';

import {
  calls,
  db,
  get,
  post,
  redis,
  resetAll,
  signIn,
  signOut,
  world,
} from './helpers/mocks';

const ORIGINAL_ENV = process.env;

interface Call {
  name: string;
  run: () => Promise<Response>;
}

/** Every route and method, each sent a well-formed request. */
const ALL: Call[] = [
  {
    name: 'GET /profile',
    run: () => profileRoute.GET(get('/api/engine4/profile')),
  },
  {
    name: 'POST /profile',
    run: () => profileRoute.POST(post('/api/engine4/profile', { profile: {} })),
  },
  {
    name: 'POST /offer',
    run: () => offerRoute.POST(post('/api/engine4/offer', {})),
  },
  {
    name: 'POST /size',
    run: () => sizeRoute.POST(post('/api/engine4/size', { cycleSlot: 1 })),
  },
  {
    name: 'POST /consent',
    run: () => consentRoute.POST(post('/api/engine4/consent', {})),
  },
];

function nothingWasTouched(): void {
  expect(calls.gateway).not.toHaveBeenCalled();
  expect(calls.snapshot).not.toHaveBeenCalled();
  expect(calls.specs).not.toHaveBeenCalled();
  expect(calls.calendar).not.toHaveBeenCalled();
  expect(calls.bars).not.toHaveBeenCalled();
  expect(calls.detail).not.toHaveBeenCalled();
  expect(calls.structure).not.toHaveBeenCalled();
  expect(redis.calls).toEqual([]);
  expect(db.calls).toEqual([]);
  expect(db.history).toEqual([]);
  expect(db.consents).toEqual([]);
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, ENGINE4_REPORT2_ENABLED: 'true' };
  jest.spyOn(Date, 'now').mockImplementation(() => world.nowMs);
  resetAll();
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('the flag (ENGINE4_REPORT2_ENABLED)', () => {
  test.each([
    ['unset', undefined],
    ['false', 'false'],
    ['empty', ''],
    ['TRUE', 'TRUE'],
    ['1', '1'],
    ['yes', 'yes'],
    ['padded', ' true '],
  ])('%s is off', async (_label, value) => {
    if (value === undefined) delete process.env['ENGINE4_REPORT2_ENABLED'];
    else process.env['ENGINE4_REPORT2_ENABLED'] = value;
    signIn('PRO');
    for (const call of ALL) {
      const response = await call.run();
      const body = await response.json();
      expect([call.name, response.status]).toEqual([call.name, 404]);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FEATURE_DISABLED');
    }
    // not even the session is looked at: a switched-off feature tells nobody anything
    expect(calls.getSession).not.toHaveBeenCalled();
    nothingWasTouched();
  });

  test('is off for a signed-out visitor, a Free trader and a Pro trader alike', async () => {
    delete process.env['ENGINE4_REPORT2_ENABLED'];
    for (const who of [
      () => signOut(),
      () => signIn('FREE'),
      () => signIn('PRO'),
    ]) {
      who();
      const response = await profileRoute.GET(get('/api/engine4/profile'));
      expect(response.status).toBe(404);
    }
  });

  test('is on only for the exact text true', async () => {
    signIn('PRO');
    const response = await profileRoute.GET(get('/api/engine4/profile'));
    expect(response.status).toBe(200);
  });
});

describe('the session', () => {
  test.each(ALL.map((call) => [call.name, call] as const))(
    '%s is 401 without a session',
    async (_name, call) => {
      signOut();
      const response = await call.run();
      const body = await response.json();
      expect(response.status).toBe(401);
      expect(body.error.code).toBe('UNAUTHENTICATED');
      expect(calls.getSession).toHaveBeenCalledTimes(1);
      nothingWasTouched();
    }
  );

  test('a session without a user id is no session', async () => {
    calls.getSession.mockImplementation(async () => ({ user: { id: '' } }));
    expect((await profileRoute.GET(get('/api/engine4/profile'))).status).toBe(
      401
    );
    calls.getSession.mockImplementation(async () => ({ user: {} }));
    expect((await profileRoute.GET(get('/api/engine4/profile'))).status).toBe(
      401
    );
    calls.getSession.mockImplementation(async () => ({}));
    expect((await profileRoute.GET(get('/api/engine4/profile'))).status).toBe(
      401
    );
  });

  test('a user id in the body, a query string or a header is never read', async () => {
    signOut();
    const response = await profileRoute.POST(
      post(
        '/api/engine4/profile?userId=user_pro_1',
        { userId: 'user_pro_1', profile: {} },
        { 'x-user-id': 'user_pro_1', authorization: 'Bearer user_pro_1' }
      )
    );
    expect(response.status).toBe(401);
  });
});

describe('the tier', () => {
  test.each(ALL.map((call) => [call.name, call] as const))(
    '%s is 403 for a Free trader',
    async (_name, call) => {
      signIn('FREE');
      const response = await call.run();
      const body = await response.json();
      expect(response.status).toBe(403);
      expect(body.error.code).toBe('TIER_REQUIRED');
      expect(body.trace.tier).toBe('FREE');
      nothingWasTouched();
    }
  );

  test('a missing or unknown tier is treated as Free, never as Pro', async () => {
    for (const tier of [undefined, null, 'ADMIN', 'pro', 'PRO ', 'TRIAL']) {
      signIn(tier as never);
      const response = await profileRoute.GET(get('/api/engine4/profile'));
      expect([tier, response.status]).toEqual([tier, 403]);
    }
  });

  test('a Pro trader gets in', async () => {
    signIn('PRO');
    const response = await profileRoute.GET(get('/api/engine4/profile'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.trace.tier).toBe('PRO');
  });

  test('a failing session lookup is a plain 500 that leaks nothing', async () => {
    const quiet = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    calls.getSession.mockImplementation(async () => {
      throw new Error('secret connection string postgres://admin:hunter2@db');
    });
    const response = await profileRoute.GET(get('/api/engine4/profile'));
    const text = await response.text();
    expect(response.status).toBe(500);
    expect(JSON.parse(text).error.code).toBe('INTERNAL');
    expect(text).not.toContain('hunter2');
    expect(text).not.toContain('postgres://');
    expect(quiet).toHaveBeenCalled();
  });
});

describe('the body', () => {
  beforeEach(() => signIn('PRO'));

  const send = (url: string, init: RequestInit): Promise<Response> =>
    offerRoute.POST(
      new Request(`http://localhost${url}`, { method: 'POST', ...init })
    );

  test('must be sent as application/json', async () => {
    for (const type of [
      'text/plain',
      'application/x-www-form-urlencoded',
      '',
    ]) {
      const response = await send('/api/engine4/offer', {
        headers: type === '' ? {} : { 'content-type': type },
        body: '{}',
      });
      const body = await response.json();
      expect([type, response.status]).toEqual([type, 415]);
      expect(body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    }
  });

  test('accepts a charset on the media type', async () => {
    const response = await send('/api/engine4/offer', {
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: '{}',
    });
    expect(response.status).not.toBe(415);
  });

  test.each([
    ['not JSON', 'nope'],
    ['empty', ''],
    ['an array', '[]'],
    ['a string', '"x"'],
    ['null', 'null'],
    ['a number', '5'],
  ])('%s is a 400', async (_label, text) => {
    const response = await send('/api/engine4/offer', {
      headers: { 'content-type': 'application/json' },
      body: text,
    });
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  test('is limited to 16 KiB (413), by the declared length and by the text', async () => {
    const declared = await send('/api/engine4/offer', {
      headers: {
        'content-type': 'application/json',
        'content-length': '999999',
      },
      body: '{}',
    });
    expect(declared.status).toBe(413);
    const real = await send('/api/engine4/offer', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ padding: 'x'.repeat(20_000) }),
    });
    expect(real.status).toBe(413);
    expect((await real.json()).error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  test('a body is read after the tier: a Free trader learns nothing about it', async () => {
    signIn('FREE');
    const response = await send('/api/engine4/offer', {
      headers: { 'content-type': 'text/plain' },
      body: 'not even json',
    });
    expect(response.status).toBe(403);
  });
});

describe('every answer', () => {
  test('is JSON, is never cached, and carries a trace with a fresh request id', async () => {
    signIn('PRO');
    const ids = new Set<string>();
    for (const call of [ALL[0]!, ALL[0]!, ALL[2]!]) {
      const response = await call.run();
      expect(response.headers.get('content-type')).toContain(
        'application/json'
      );
      expect(response.headers.get('cache-control')).toBe('no-store');
      const body = await response.json();
      expect(body.trace.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
      expect(body.trace.engine4Version).toBe(ENGINE4_VERSION);
      ids.add(body.trace.requestId as string);
    }
    expect(ids.size).toBe(3);
  });

  test('a refusal carries the trace too, and nothing but the code and a fixed message', async () => {
    signIn('FREE');
    const response = await offerRoute.POST(post('/api/engine4/offer', {}));
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(['error', 'success', 'trace']);
    expect(Object.keys(body.error).sort()).toEqual(['code', 'message']);
    expect(body.trace.route).toBe('offer');
    expect(body.trace.method).toBe('POST');
    expect(body.trace.timings.stages).toEqual([]);
  });

  test('the routes answer only the methods they were built for', () => {
    expect(
      Object.keys(profileRoute)
        .filter((k) => k === k.toUpperCase())
        .sort()
    ).toEqual(['GET', 'POST']);
    for (const route of [offerRoute, sizeRoute, consentRoute]) {
      expect(Object.keys(route).filter((k) => k === k.toUpperCase())).toEqual([
        'POST',
      ]);
      expect(route.dynamic).toBe('force-dynamic');
    }
    expect(profileRoute.dynamic).toBe('force-dynamic');
  });
});
