/**
 * @jest-environment node
 */

/**
 * Who may call the intake routes (build step 6 part 5; plan part 5): the flag first (off by
 * default, and off means 404 to everybody, signed in or not), then the session (401), then the
 * tier (403), and only then is the body read, and the thread, the profile and the quota checked.
 * Both routes are held to the same table. After a refusal NOTHING later has been read: no body,
 * no profile, no database, no model, no knowledge service.
 */

jest.mock('@/lib/auth/session', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .sessionModule()
);
jest.mock('@/lib/i18n/server-locale', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .localeModule()
);
jest.mock('@/lib/engine4/store/profile-store', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .profileStoreModule()
);
jest.mock('@/lib/active-indicator/gateway-client', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .gatewayModule()
);
jest.mock('@/lib/db/market-prisma', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .marketPrismaModule()
);
jest.mock('@/lib/platform/metering/ledger-port', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .ledgerPortModule()
);

import * as instantRoute from '@/app/api/intake/instant/route';
import * as typedRoute from '@/app/api/intake/route';
import { GATE_ORDER, INTAKE_VERSION, LOCALES } from '@/lib/intake';
import { makeFake } from '../../lib/intake/helpers/ports';
import { runIntakeRoute } from '@/lib/intake/server/respond';

import {
  ENV,
  calls,
  installFetch,
  post,
  resetAll,
  resetNetwork,
  signIn,
  signOut,
  state,
  STORED_PROFILE,
} from './helpers/mocks';

const ORIGINAL_ENV = process.env;
let fetchSpy: jest.SpyInstance;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, ...ENV };
  resetAll();
  resetNetwork();
  fetchSpy = installFetch();
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
  jest.restoreAllMocks();
});

interface Call {
  name: string;
  run: (body?: unknown, headers?: Record<string, string>) => Promise<Response>;
  body: unknown;
}

const TYPED_BODY = { question: 'Should I buy gold now' };
const INSTANT_BODY = { kind: 'INSTANT_M5_INSPECT' };

const BOTH: Call[] = [
  {
    name: 'POST /api/intake',
    body: TYPED_BODY,
    run: (body = TYPED_BODY, headers) =>
      typedRoute.POST(post('/api/intake', body, headers)),
  },
  {
    name: 'POST /api/intake/instant',
    body: INSTANT_BODY,
    run: (body = INSTANT_BODY, headers) =>
      instantRoute.POST(post('/api/intake/instant', body, headers)),
  },
];

function nothingWasTouched(): void {
  expect(calls.readProfile).not.toHaveBeenCalled();
  expect(calls.gateway).not.toHaveBeenCalled();
  expect(calls.database).not.toHaveBeenCalled();
  expect(fetchSpy).not.toHaveBeenCalled();
}

async function bodyOf(response: Response): Promise<any> {
  return response.json();
}

describe('the routes are off by default', () => {
  it('exports POST and nothing else, on both routes', () => {
    expect(Object.keys(typedRoute).sort()).toEqual(['POST', 'dynamic']);
    expect(Object.keys(instantRoute).sort()).toEqual(['POST', 'dynamic']);
    expect(typedRoute.dynamic).toBe('force-dynamic');
    expect(instantRoute.dynamic).toBe('force-dynamic');
  });

  it.each(BOTH)(
    '$name answers 404 to everybody when the flag is not set',
    async ({ run }) => {
      delete process.env['INTAKE_ENABLED'];
      for (const who of ['anonymous', 'free', 'pro'] as const) {
        who === 'anonymous'
          ? signOut()
          : signIn(who === 'free' ? 'FREE' : 'PRO');
        const response = await run();
        expect(response.status).toBe(404);
        const body = await bodyOf(response);
        expect(body).toMatchObject({
          success: false,
          error: { code: 'FEATURE_DISABLED', message: 'Not found' },
          trace: { outcome: 'DISABLED', intake_version: null, tier: null },
        });
        expect(body).not.toHaveProperty('refusal');
        expect(body).not.toHaveProperty('packet');
      }
      expect(calls.getSession).not.toHaveBeenCalled();
      nothingWasTouched();
    }
  );

  it.each(['false', 'TRUE', 'True', '1', 'yes', ' true', 'true ', ''])(
    'stays off when INTAKE_ENABLED is %j: only the text true turns it on',
    async (value) => {
      process.env['INTAKE_ENABLED'] = value;
      signIn('PRO');
      for (const { run } of BOTH) {
        const response = await run();
        expect(response.status).toBe(404);
        expect((await bodyOf(response)).error.code).toBe('FEATURE_DISABLED');
      }
      nothingWasTouched();
    }
  );

  it('the instant-prompt flag is not a lock on the route', async () => {
    process.env['INTAKE_INSTANT_PROMPTS_ENABLED'] = '';
    signIn('PRO');
    const response = await instantRoute.POST(
      post('/api/intake/instant', INSTANT_BODY)
    );
    expect(response.status).toBe(200);
    delete process.env['INTAKE_ENABLED'];
    process.env['INTAKE_INSTANT_PROMPTS_ENABLED'] = 'true';
    const off = await instantRoute.POST(
      post('/api/intake/instant', INSTANT_BODY)
    );
    expect(off.status).toBe(404);
  });

  it('every answer carries the trace, the request id and no cache', async () => {
    delete process.env['INTAKE_ENABLED'];
    const response = await typedRoute.POST(post('/api/intake', TYPED_BODY));
    const body = await bodyOf(response);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Content-Type')).toBe(
      'application/json; charset=utf-8'
    );
    expect(response.headers.get('X-Request-Id')).toBe(body.trace.request_id);
    expect(body.trace.request_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.trace).toMatchObject({
      route: 'typed',
      method: 'POST',
      units_charged: 0,
    });
    expect(Date.parse(body.trace.started_at)).not.toBeNaN();
  });
});

describe('then the session and the tier, before the body is read', () => {
  it.each(BOTH)(
    '$name: nobody signed in is 401, with the reply in the language of the interface',
    async ({ run }) => {
      state.locale = 'ja';
      signOut();
      const response = await run();
      expect(response.status).toBe(401);
      const body = await bodyOf(response);
      expect(body.error).toEqual({
        code: 'NOT_SIGNED_IN',
        message: 'You must be signed in.',
      });
      expect(body.refusal).toMatchObject({
        schema: 'intake-refusal/1',
        code: 'NOT_SIGNED_IN',
        stage: 'GATE',
        reply_locale: 'ja',
      });
      expect(body.refusal.reply.length).toBeGreaterThan(0);
      expect(body.trace).toMatchObject({
        outcome: 'REFUSED',
        refusal_code: 'NOT_SIGNED_IN',
        tier: null,
        interface_locale: 'ja',
      });
      nothingWasTouched();
    }
  );

  it.each(BOTH)('$name: a signed-in Free trader is 403', async ({ run }) => {
    signIn('FREE');
    const response = await run();
    expect(response.status).toBe(403);
    const body = await bodyOf(response);
    expect(body.error.code).toBe('TIER_REQUIRED');
    expect(body.refusal.code).toBe('TIER_REQUIRED');
    expect(body.trace.tier).toBe('FREE');
    nothingWasTouched();
  });

  it.each(BOTH)(
    '$name: a session with no tier is treated as Free',
    async ({ run }) => {
      signIn(undefined);
      expect((await run()).status).toBe(403);
      nothingWasTouched();
    }
  );

  it.each(BOTH)(
    '$name: a refusal at the session or the tier never reads the body, whatever is wrong with it',
    async ({ run }) => {
      // a body that would be a 415, a 413 and a 400 if it were read
      for (const [who, status] of [
        [() => signOut(), 401],
        [() => signIn('FREE'), 403],
      ] as const) {
        who();
        expect(
          (await run('not json', { 'content-type': 'text/plain' })).status
        ).toBe(status);
        expect((await run('x'.repeat(100_000))).status).toBe(status);
      }
    }
  );

  it('answers in the language of the interface setting, whichever of the 19', async () => {
    signOut();
    const replies = new Set<string>();
    for (const locale of LOCALES) {
      state.locale = locale;
      const response = await typedRoute.POST(post('/api/intake', TYPED_BODY));
      const body = await bodyOf(response);
      expect(body.refusal.reply_locale).toBe(locale);
      replies.add(body.refusal.reply);
    }
    expect(replies.size).toBeGreaterThanOrEqual(16);
  });

  it('a session that cannot be read is nobody signed in, not a crash', async () => {
    calls.getSession.mockRejectedValue(new Error('session store down'));
    const response = await typedRoute.POST(post('/api/intake', TYPED_BODY));
    expect(response.status).toBe(401);
    expect(JSON.stringify(await bodyOf(response))).not.toContain(
      'session store down'
    );
  });
});

describe('then the body, only for a Pro trader', () => {
  const PRO = (): void => signIn('PRO');

  it.each(BOTH)('$name: wrong media type is 415', async ({ run }) => {
    PRO();
    const response = await run('{}', { 'content-type': 'text/plain' });
    expect(response.status).toBe(415);
    const body = await bodyOf(response);
    expect(body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(body).not.toHaveProperty('refusal');
    expect(body.trace).toMatchObject({
      outcome: 'REQUEST_FAILED',
      tier: 'PRO',
    });
    nothingWasTouched();
  });

  it.each(BOTH)('$name: a body over 8 KiB is 413', async ({ run }) => {
    PRO();
    const response = await run({
      question: 'x'.repeat(9_000),
      kind: 'INSTANT_M5_INSPECT',
    });
    expect(response.status).toBe(413);
    expect((await bodyOf(response)).error.code).toBe('PAYLOAD_TOO_LARGE');
    nothingWasTouched();
  });

  it.each(BOTH)(
    '$name: a body that is not JSON, or not an object, is 400',
    async ({ run }) => {
      PRO();
      for (const text of ['hello', '[1]', 'null', '']) {
        const response = await run(text);
        expect(response.status).toBe(400);
        expect((await bodyOf(response)).error.code).toBe('BAD_REQUEST');
      }
      nothingWasTouched();
    }
  );

  it('a typed question that is not text is 400', async () => {
    PRO();
    for (const question of [42, null, ['q'], { q: 1 }]) {
      const response = await typedRoute.POST(post('/api/intake', { question }));
      expect(response.status).toBe(400);
      expect((await bodyOf(response)).error.message).toBe(
        'question must be text.'
      );
    }
    expect((await typedRoute.POST(post('/api/intake', {}))).status).toBe(400);
    nothingWasTouched();
  });

  it('an instant label that is not one of the two is 400', async () => {
    PRO();
    for (const kind of [
      'DIRECTION',
      'REPORT_2',
      '',
      5,
      null,
      'instant_m5_inspect',
    ]) {
      const response = await instantRoute.POST(
        post('/api/intake/instant', { kind })
      );
      expect(response.status).toBe(400);
    }
    expect(
      (await instantRoute.POST(post('/api/intake/instant', {}))).status
    ).toBe(400);
    nothingWasTouched();
  });

  it('a thread id that is not text is 400', async () => {
    PRO();
    const response = await typedRoute.POST(
      post('/api/intake', { ...TYPED_BODY, threadId: 5 })
    );
    expect(response.status).toBe(400);
    nothingWasTouched();
  });
});

describe('then the thread, the profile and the quota', () => {
  it.each(BOTH)(
    '$name: a thread id that is not one is 422 and the profile is not read',
    async ({ run, body: sent }) => {
      signIn('PRO');
      const response = await run({
        ...(sent as object),
        threadId: 'not a thread id',
      });
      expect(response.status).toBe(422);
      const body = await bodyOf(response);
      expect(body.error.code).toBe('THREAD_INVALID');
      expect(body.refusal.stage).toBe('GATE');
      expect(calls.readProfile).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    }
  );

  it.each(BOTH)(
    '$name: no confirmed profile is 409, asking the trader to confirm it',
    async ({ run, body }) => {
      signIn('PRO');
      state.profile = null;
      state.locale = 'de';
      const response = await run(body);
      expect(response.status).toBe(409);
      const answer = await bodyOf(response);
      expect(answer.error.code).toBe('PROFILE_NOT_SET');
      expect(answer.refusal).toMatchObject({
        code: 'PROFILE_NOT_SET',
        reply_locale: 'de',
      });
      expect(calls.readProfile).toHaveBeenCalledWith(expect.any(String));
      expect(calls.gateway).not.toHaveBeenCalled();
      expect(calls.database).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    }
  );

  it.each(BOTH)(
    '$name: the profile is read for the user of the session, never for one the body names',
    async ({ run, body }) => {
      signIn('PRO', 'the-real-user');
      await run({
        ...(body as object),
        userId: 'victim',
        user: { id: 'victim' },
        tier: 'PRO',
        language: 'ar',
        symbol: 'EURUSD',
      });
      expect(calls.readProfile).toHaveBeenCalledTimes(1);
      expect(calls.readProfile).toHaveBeenCalledWith('the-real-user');
    }
  );

  it('a stored profile that no longer passes its own validator is asked to be confirmed again', async () => {
    signIn('PRO');
    state.profile = { ...STORED_PROFILE, style: 'SIDEWAYS' };
    const response = await typedRoute.POST(post('/api/intake', TYPED_BODY));
    expect(response.status).toBe(409);
    expect((await bodyOf(response)).error.code).toBe('PROFILE_NOT_SET');
  });

  it('a profile store that fails is the feature being unavailable, 503, without its message', async () => {
    signIn('PRO');
    calls.readProfile.mockRejectedValue(
      new Error('connection to db-prod-7 refused')
    );
    const response = await typedRoute.POST(post('/api/intake', TYPED_BODY));
    expect(response.status).toBe(503);
    const text = JSON.stringify(await bodyOf(response));
    expect(text).toContain('FEATURE_UNAVAILABLE');
    expect(text).not.toContain('db-prod-7');
  });
});

describe('the status order, end to end (404, 401, 403, 409, 429)', () => {
  const GATE_STATUS = [404, 401, 403, 422, 409, 429];

  it('is the order the plan says, with the quota last', () => {
    expect(GATE_ORDER).toEqual([
      'NOT_SIGNED_IN',
      'TIER_REQUIRED',
      'THREAD_INVALID',
      'PROFILE_NOT_SET',
      'QUOTA_INSUFFICIENT',
    ]);
    expect(GATE_STATUS).toEqual([404, 401, 403, 422, 409, 429]);
  });

  it('breaking one step and every later one gives the status of the first', async () => {
    const statuses: number[] = [];
    // flag off, nobody signed in, Free, a bad thread, no profile (the quota is a port test below)
    delete process.env['INTAKE_ENABLED'];
    statuses.push(
      (
        await typedRoute.POST(
          post('/api/intake', { ...TYPED_BODY, threadId: 'bad id' })
        )
      ).status
    );
    process.env['INTAKE_ENABLED'] = 'true';
    signOut();
    state.profile = null;
    statuses.push(
      (
        await typedRoute.POST(
          post('/api/intake', { ...TYPED_BODY, threadId: 'bad id' })
        )
      ).status
    );
    signIn('FREE');
    statuses.push(
      (
        await typedRoute.POST(
          post('/api/intake', { ...TYPED_BODY, threadId: 'bad id' })
        )
      ).status
    );
    signIn('PRO');
    statuses.push(
      (
        await typedRoute.POST(
          post('/api/intake', { ...TYPED_BODY, threadId: 'bad id' })
        )
      ).status
    );
    statuses.push(
      (await typedRoute.POST(post('/api/intake', TYPED_BODY))).status
    );
    expect(statuses).toEqual([404, 401, 403, 422, 409]);
  });

  it('the quota refusal comes last: 429, with the reply in each of the 19 interface languages', async () => {
    for (const label of [
      'INSTANT_M5_INSPECT',
      'INSTANT_M15_INSPECT',
    ] as const) {
      for (const locale of LOCALES) {
        const fake = makeFake({ quota: false, locale });
        const response = await runIntakeRoute(
          {
            route: 'instant',
            request: post('/api/intake/instant', { kind: label }),
          },
          { ports: fake.ports }
        );
        expect(response.status).toBe(429);
        const body = await bodyOf(response);
        expect(body.error.code).toBe('QUOTA_INSUFFICIENT');
        expect(body.refusal).toMatchObject({
          code: 'QUOTA_INSUFFICIENT',
          stage: 'GATE',
          reply_locale: locale,
        });
        expect(body.refusal.reply.length).toBeGreaterThan(0);
        // before any model call: nothing after the pre-check was reached
        expect(fake.calls.quota).toBe(1);
        expect(fake.calls.understand).toBe(0);
        expect(fake.calls.snapshot).toBe(0);
        expect(fake.calls.events).toBe(0);
        expect(fake.calls.knowledge).toBe(0);
        expect(body.trace.units_charged).toBe(0);
      }
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  describe('the quota is the ledger’s floor check (build step 7 part 6)', () => {
    it.each(BOTH)(
      '$name: an empty account is 429 QUOTA_INSUFFICIENT, and no model and no knowledge service was reached',
      async ({ run }) => {
        signIn('PRO');
        state.available = 0;
        const response = await run();
        expect(response.status).toBe(429);
        const body = await bodyOf(response);
        expect(body.error.code).toBe('QUOTA_INSUFFICIENT');
        expect(body.refusal).toMatchObject({
          code: 'QUOTA_INSUFFICIENT',
          stage: 'GATE',
        });
        expect(body.trace.units_charged).toBe(0);
        // the ledger was asked once, for the allowance of the environment
        expect(calls.ledgerBalance).toHaveBeenCalledTimes(1);
        expect(calls.ledgerBalance.mock.calls[0]?.[0]).toMatchObject({
          allowanceUnits: 5_000_000,
        });
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(calls.gateway).not.toHaveBeenCalled();
      }
    );

    it.each(BOTH)(
      '$name: with PRO_MONTHLY_UNITS unset every request is refused 429, and the ledger is not read (decision D4: fail closed)',
      async ({ run }) => {
        signIn('PRO');
        delete process.env['PRO_MONTHLY_UNITS'];
        const response = await run();
        expect(response.status).toBe(429);
        expect((await bodyOf(response)).error.code).toBe('QUOTA_INSUFFICIENT');
        expect(calls.ledgerBalance).not.toHaveBeenCalled();
        expect(fetchSpy).not.toHaveBeenCalled();
      }
    );

    it.each(BOTH)(
      '$name: a ledger that cannot be read is FEATURE_UNAVAILABLE, never a free pass',
      async ({ run }) => {
        signIn('PRO');
        state.available = 'THROWS';
        const response = await run();
        const body = await bodyOf(response);
        expect(response.status).not.toBe(200);
        expect(body.error.code).toBe('FEATURE_UNAVAILABLE');
        expect(body.trace.problems).toEqual(['QUOTA_PORT_ERROR']);
        expect(JSON.stringify(body)).not.toContain('could not be reached');
        expect(fetchSpy).not.toHaveBeenCalled();
      }
    );

    it('a balance of one unit still passes the floor while nothing is priced', async () => {
      signIn('PRO');
      state.available = 1;
      const response = await instantRoute.POST(
        post('/api/intake/instant', INSTANT_BODY)
      );
      expect(response.status).toBe(200);
    });

    it.each(BOTH)(
      '$name: a Free trader is refused at the tier (403) before the ledger is read',
      async ({ run }) => {
        signIn('FREE');
        const response = await run();
        expect(response.status).toBe(403);
        expect(calls.ledgerBalance).not.toHaveBeenCalled();
      }
    );
  });

  it('the trace names the version of the intake rules only for a request that got as far as a packet', async () => {
    signIn('PRO');
    const refused = await bodyOf(
      await typedRoute.POST(
        post('/api/intake', { ...TYPED_BODY, threadId: 'bad id' })
      )
    );
    expect(refused.trace.intake_version).toBeNull();
    const answered = await bodyOf(
      await typedRoute.POST(post('/api/intake', TYPED_BODY))
    );
    expect(answered.trace.intake_version).toBe(INTAKE_VERSION);
  });
});
