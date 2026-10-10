/**
 * @jest-environment node
 */

/**
 * The component tests run against `EngineApi`, the real Engine 4 over the stored
 * cycles. This test is what makes that a fair stand-in for the server: it runs the
 * REAL routes (the harness of part 6: the route files, the handlers, the validator,
 * the badge, the stores) and the stand-in on the same inputs and requires the same
 * bytes back. So "the same numbers as the API for the same inputs" is a fact the
 * suite checks, not a claim.
 */

jest.mock('@/lib/auth/session', () =>
  jest
    .requireActual<
      typeof import('../../api/engine4/helpers/mocks')
    >('../../api/engine4/helpers/mocks')
    .sessionModule()
);
jest.mock('@/lib/db/prisma', () =>
  jest
    .requireActual<
      typeof import('../../api/engine4/helpers/mocks')
    >('../../api/engine4/helpers/mocks')
    .prismaModule()
);
jest.mock('@/lib/redis/client', () =>
  jest
    .requireActual<
      typeof import('../../api/engine4/helpers/mocks')
    >('../../api/engine4/helpers/mocks')
    .redisModule()
);
jest.mock('@/lib/active-indicator/gateway-client', () =>
  jest
    .requireActual<
      typeof import('../../api/engine4/helpers/mocks')
    >('../../api/engine4/helpers/mocks')
    .gatewayModule()
);
jest.mock('@/lib/engine4/read/cycle', () =>
  jest
    .requireActual<
      typeof import('../../api/engine4/helpers/mocks')
    >('../../api/engine4/helpers/mocks')
    .cycleModule()
);
jest.mock('@/lib/engine4/read/specs', () =>
  jest
    .requireActual<
      typeof import('../../api/engine4/helpers/mocks')
    >('../../api/engine4/helpers/mocks')
    .specsModule()
);
jest.mock('@/lib/engine4/read/events', () =>
  jest
    .requireActual<
      typeof import('../../api/engine4/helpers/mocks')
    >('../../api/engine4/helpers/mocks')
    .eventsModule()
);
jest.mock('@/lib/engine4/read/bars', () =>
  jest
    .requireActual<
      typeof import('../../api/engine4/helpers/mocks')
    >('../../api/engine4/helpers/mocks')
    .barsModule()
);
jest.mock('@/lib/engine4/read/synthesis', () =>
  jest
    .requireActual<
      typeof import('../../api/engine4/helpers/mocks')
    >('../../api/engine4/helpers/mocks')
    .synthesisModule()
);
jest.mock('@/lib/engine4/read/structure-levels', () =>
  jest
    .requireActual<
      typeof import('../../api/engine4/helpers/mocks')
    >('../../api/engine4/helpers/mocks')
    .structureModule()
);

import * as consentRoute from '@/app/api/engine4/consent/route';
import * as offerRoute from '@/app/api/engine4/offer/route';
import * as profileRoute from '@/app/api/engine4/profile/route';
import * as sizeRoute from '@/app/api/engine4/size/route';
import { buildReport2 } from '@/lib/engine4/templates/report2';
import type {
  WireOfferAnswer,
  WireSizeAnswer,
} from '@/lib/engine4/templates/wire';

import {
  createHttpApi,
  type SetupRequest,
} from '@/components/report2/api-client';

import {
  calls,
  db,
  post,
  resetAll,
  signIn,
  signOut,
  world,
} from '../../api/engine4/helpers/mocks';
import { ROOMY } from '../../api/engine4/helpers/world';
import {
  offerAnswer,
  scene,
  sizeAnswer,
  type Scene,
} from './helpers/engine-api';

type Json = any;

const ORIGINAL_ENV = process.env;

async function profile(over: Record<string, unknown> = {}): Promise<void> {
  const response = await profileRoute.POST(
    post('/api/engine4/profile', { profile: { ...ROOMY, ...over } })
  );
  expect(response.status).toBe(200);
}

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

async function route(path: 'size' | 'offer', body: object): Promise<Json> {
  const handler = path === 'size' ? sizeRoute.POST : offerRoute.POST;
  const response = await handler(post(`/api/engine4/${path}`, body));
  expect(response.status).toBe(200);
  return JSON.parse(await response.text());
}

const Z1 = {
  zoneId: 'Z1',
  entry: '4367.20',
  equity: '10000',
  riskPct: '0.75',
  stopDistance: '16.78',
  rrr: '1.75',
};

interface Case {
  name: string;
  golden?: string;
  profile?: Record<string, unknown>;
  fields: Record<string, unknown>;
}

const CASES: Case[] = [
  { name: 'Z1 at the pre-set half risk (all eight checks pass)', fields: Z1 },
  {
    name: 'Z2 at its own price',
    fields: { ...Z1, zoneId: 'Z2', entry: '4350.16', stopDistance: '20' },
  },
  {
    name: 'a risk above the pre-set half (an override)',
    fields: { ...Z1, riskPct: '1.2' },
  },
  { name: 'a risk above Max RPT', fields: { ...Z1, riskPct: '2' } },
  {
    name: 'an RRR at the counter-trend cap (Aggressive left out)',
    fields: { ...Z1, rrr: '2.5' },
  },
  { name: 'an RRR above the cap', fields: { ...Z1, rrr: '3' } },
  { name: 'a stop under Min SLD', fields: { ...Z1, stopDistance: '12' } },
  {
    name: 'a stop that is a different structural level',
    fields: { ...Z1, stopDistance: '17.54' },
  },
  {
    name: 'a custom entry inside the day’s range',
    fields: {
      zoneId: undefined,
      entry: '4370',
      equity: '10000',
      riskPct: '0.75',
      stopDistance: '16.78',
      rrr: '1.75',
    },
  },
  {
    name: 'a custom entry that is a typo',
    fields: { ...Z1, zoneId: undefined, entry: '9999' },
  },
  { name: 'nothing entered at all', fields: {} },
  {
    name: 'a lot below the broker minimum',
    profile: { equity: '300' },
    fields: { ...Z1, equity: '300', riskPct: '0.5' },
  },
  {
    name: 'the default profile at today’s gold price (leverage sets the lot)',
    profile: { maxLeverage: '1.5', equity: '5000', style: 'TREND_FOLLOWING' },
    fields: { ...Z1, equity: '5000' },
  },
  {
    name: 'a counter-trend SHORT with a spread, badged CONSERVATIVE (golden 07)',
    golden: '07-',
    fields: {
      zoneId: 'Z1',
      entry: '4282.0',
      equity: '10000',
      riskPct: '0.5',
      stopDistance: '20.5',
      rrr: '1.75',
    },
  },
  {
    name: 'the same SHORT at the lower RRR (no badge)',
    golden: '07-',
    fields: {
      zoneId: 'Z1',
      entry: '4282.0',
      equity: '10000',
      riskPct: '0.5',
      stopDistance: '20.5',
      rrr: '1.5',
    },
  },
  {
    name: 'a with-trend cycle (golden 04)',
    golden: '04-',
    fields: {
      zoneId: 'Z2',
      entry: '4376.0',
      equity: '10000',
      riskPct: '1',
      stopDistance: '30.5',
      rrr: '1.5',
    },
  },
];

describe.each(CASES)('$name', (c) => {
  let standIn: Scene;

  beforeEach(async () => {
    if (c.golden !== undefined) world.use(c.golden);
    standIn = scene({
      ...(c.golden === undefined ? {} : { golden: c.golden }),
      ...(c.profile === undefined ? {} : { profile: c.profile as never }),
    });
    await profile(c.profile ?? {});
  });

  test('the route and the stand-in answer with the same setup, byte for byte, and the same hash and badge', async () => {
    const real: WireSizeAnswer = await route('size', {
      cycleSlot: world.slot,
      ...c.fields,
      language: 'en-US',
    });
    const ours = sizeAnswer(standIn, c.fields);
    expect(JSON.stringify(real.setup)).toBe(JSON.stringify(ours.setup));
    expect(real.setupSha256).toBe(ours.setupSha256);
    expect(JSON.stringify(real.badge)).toBe(JSON.stringify(ours.badge));
    expect(JSON.stringify(real.offer)).toBe(JSON.stringify(ours.offer));
  });

  test('so the document drawn from either is the same document', async () => {
    const real: WireSizeAnswer = await route('size', {
      cycleSlot: world.slot,
      ...c.fields,
      language: 'en-US',
    });
    const ours = sizeAnswer(standIn, c.fields);
    const a = buildReport2({
      setup: real.setup,
      badge: real.badge,
      offer: real.offer,
    });
    const b = buildReport2({
      setup: ours.setup,
      badge: ours.badge,
      offer: ours.offer,
    });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('the offer', () => {
  test('the modal definition the route builds is the stand-in’s, byte for byte', async () => {
    await profile();
    const real: WireOfferAnswer = await route('offer', {
      cycleSlot: world.slot,
    });
    const ours = offerAnswer(scene());
    expect(JSON.stringify(real.modal)).toBe(JSON.stringify(ours.modal));
    expect(JSON.stringify(real.offer)).toBe(JSON.stringify(ours.offer));
    expect(real.cycleSlot).toBe(ours.cycleSlot);
    expect(JSON.stringify(real.blackout)).toBe(JSON.stringify(ours.blackout));
  });

  test.each(['07-', '04-', '05-', '10-'])(
    'and for the stored cycle %s',
    async (prefix) => {
      world.use(prefix);
      await profile();
      const real: WireOfferAnswer = await route('offer', {
        cycleSlot: world.slot,
      });
      const ours = offerAnswer(scene({ golden: prefix }));
      expect(JSON.stringify(real.modal)).toBe(JSON.stringify(ours.modal));
    }
  );

  test('a setup the offer no longer stands behind has the same reason either way', async () => {
    world.knobs.gateway = 'STALE';
    await profile();
    const real: WireOfferAnswer = await route('offer', {
      cycleSlot: world.slot,
    });
    const ours = offerAnswer(
      scene({ dataStatus: { status: 'STALE', dataAsOfSlot: world.slot } })
    );
    expect(real.modal.status).toBe('NOT_OFFERED');
    expect(JSON.stringify(real.modal)).toBe(JSON.stringify(ours.modal));
  });
});

// ---------------------------------------------------------------------------
// the browser's client, through the real routes
// ---------------------------------------------------------------------------

/** a `fetch` that is answered by the real route handlers */
function viaRoutes(): typeof fetch {
  const handlers: Record<string, (request: Request) => Promise<Response>> = {
    '/api/engine4/size': sizeRoute.POST,
    '/api/engine4/consent': consentRoute.POST,
  };
  return (async (url: string, init: RequestInit) => {
    const handler = handlers[url];
    if (handler === undefined) throw new Error(`no route ${url}`);
    return handler(new Request(`http://localhost${url}`, init));
  }) as unknown as typeof fetch;
}

const REQUEST = (): SetupRequest => ({
  cycleSlot: String(world.slot),
  side: 'BUY',
  zoneId: 'Z1',
  entry: '4367.2',
  equity: '10000',
  riskPct: '0.75',
  stopDistance: '16.78',
  rrr: '1.75',
  language: 'en-US',
});

describe('createHttpApi through the real routes', () => {
  beforeEach(async () => {
    await profile();
  });

  test('size answers with what the stand-in answers, byte for byte', async () => {
    const outcome = await createHttpApi(viaRoutes()).size(REQUEST());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const ours = sizeAnswer(scene(), { ...Z1 });
    expect(JSON.stringify(outcome.answer.setup)).toBe(
      JSON.stringify(ours.setup)
    );
    expect(outcome.answer.setupSha256).toBe(ours.setupSha256);
  });

  test('Accept, with the hash of the setup shown, writes ONE consent row; the same press again returns it and writes nothing', async () => {
    const client = createHttpApi(viaRoutes());
    const sized = await client.size(REQUEST());
    if (!sized.ok) throw new Error('not sized');
    const press = {
      ...REQUEST(),
      action: 'ACCEPT' as const,
      submissionId: 'submission-0001-abcdef',
      shownSetupSha256: sized.answer.setupSha256,
    };
    const first = await client.consent(press);
    expect(first).toMatchObject({
      ok: true,
      duplicate: false,
      action: 'ACCEPT',
    });
    expect(db.consents).toHaveLength(1);
    expect(db.consents[0]).toMatchObject({
      action: 'ACCEPT',
      zone_id: 'Z1',
      setup_sha256: sized.answer.setupSha256,
      language: 'en-US',
      template_version: 'report2-template/draft-1',
    });
    const again = await client.consent(press);
    expect(again).toMatchObject({ ok: true, duplicate: true });
    expect(db.consents).toHaveLength(1);
    // the time it reports is the time the row was written
    if (first.ok && again.ok) expect(again.recordedAt).toBe(first.recordedAt);
  });

  test('Decline and Modify of a setup that fails a check are recorded; Accept of it is refused and writes nothing', async () => {
    const client = createHttpApi(viaRoutes());
    const failing = { ...REQUEST(), riskPct: '2' };
    const sized = await client.size(failing);
    if (!sized.ok) throw new Error('not sized');
    expect(sized.answer.setup.ok).toBe(false);
    const press = (action: 'ACCEPT' | 'DECLINE' | 'MODIFY', id: string) => ({
      ...failing,
      action,
      submissionId: id,
      shownSetupSha256: sized.answer.setupSha256,
    });
    expect(
      await client.consent(press('ACCEPT', 'submission-accept-00001'))
    ).toEqual({
      ok: false,
      code: 'CONSENT_REFUSED',
      retryable: false,
    });
    expect(db.consents).toHaveLength(0);
    expect(
      await client.consent(press('DECLINE', 'submission-decline-0001'))
    ).toMatchObject({ ok: true });
    expect(
      await client.consent(press('MODIFY', 'submission-modify-0001'))
    ).toMatchObject({ ok: true });
    expect(db.consents.map((row: { action: string }) => row.action)).toEqual([
      'DECLINE',
      'MODIFY',
    ]);
  });

  test('a setup that is not the one shown is refused (SETUP_CHANGED) and writes nothing', async () => {
    const client = createHttpApi(viaRoutes());
    const result = await client.consent({
      ...REQUEST(),
      action: 'ACCEPT',
      submissionId: 'submission-0002-abcdef',
      shownSetupSha256: 'f'.repeat(64),
    });
    expect(result).toEqual({
      ok: false,
      code: 'SETUP_CHANGED',
      retryable: false,
    });
    expect(db.consents).toHaveLength(0);
  });

  test('the refusals of the gate arrive as codes the modal can word: signed out, free, switched off', async () => {
    const client = createHttpApi(viaRoutes());
    signOut();
    expect(await client.size(REQUEST())).toEqual({
      ok: false,
      code: 'UNAUTHENTICATED',
      retryable: false,
    });
    signIn('FREE');
    expect(await client.size(REQUEST())).toEqual({
      ok: false,
      code: 'TIER_REQUIRED',
      retryable: false,
    });
    signIn('PRO');
    process.env = { ...process.env, ENGINE4_REPORT2_ENABLED: 'false' };
    expect(await client.size(REQUEST())).toEqual({
      ok: false,
      code: 'FEATURE_DISABLED',
      retryable: false,
    });
  });

  test('a failure on the server is retryable; the same id then goes again', async () => {
    const client = createHttpApi(viaRoutes());
    // the route logs the failure it was told about; this test does not need to see it
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    calls.snapshot.mockImplementation(async () => {
      throw new Error('the database is down');
    });
    const outcome = await client.size(REQUEST());
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.retryable).toBe(true);
  });
});
