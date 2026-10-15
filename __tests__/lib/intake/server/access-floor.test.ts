/**
 * @jest-environment node
 */

/**
 * The floor of the gate's quota port, from the registry's dated prices (build step 7 part 6): which
 * models set it, that the cheapest wins whatever the order, and when the Understand call counts. The
 * registry has no priced model yet, so these tests give it some (the mutation check found that
 * nothing did).
 */

jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));
jest.mock('@/lib/auth/session', () => ({ getSession: jest.fn() }));
jest.mock('@/lib/i18n/server-locale', () => ({ getServerLanguage: jest.fn() }));
jest.mock('@/lib/engine4/store/profile-store', () => ({
  readProfile: jest.fn(),
  StoredProfileError: class extends Error {},
}));
jest.mock('@/lib/intake/read/snapshot', () => ({ readSnapshot: jest.fn() }));
jest.mock('@/lib/intake/read/events', () => ({
  readUpcomingEvents: jest.fn(),
}));

import { floorUnits } from '@/lib/reply/meter/estimate';
import type { LedgerPort } from '@/lib/reply/meter/quota-port';

const CALIBRATION = {
  digitsPerToken: 3,
  lettersPerToken: 4,
  cjkCharsPerToken: 1,
  otherCharsPerToken: 2,
  marginBp: 1_000,
};
const model = (price_in: number | null, price_out: number | null) => ({
  slug: 'vendor/model',
  price_in,
  price_out,
  max_output_tokens: 2_048,
  calibration: CALIBRATION,
});
const PRICED = model(0.5, 2);
const CHEAPER = model(0.1, 0.4);
const UNPRICED = model(null, null);

interface Registry {
  primary?: unknown;
  fallback?: unknown;
  picker?: unknown[];
  bySlug?: Record<string, unknown>;
}

function load(registry: Registry): typeof import('@/lib/intake/server/access') {
  let access: typeof import('@/lib/intake/server/access') | undefined;
  jest.isolateModules(() => {
    jest.doMock('@/lib/reply/gateway/registry', () => ({
      ...jest.requireActual('@/lib/reply/gateway/registry'),
      planLaunch: () => ({
        primary: registry.primary ?? null,
        fallback: registry.fallback ?? null,
      }),
      pickerModels: () => registry.picker ?? [],
      findModel: (slug: string) => registry.bySlug?.[slug],
    }));
    access = require('@/lib/intake/server/access');
  });
  jest.dontMock('@/lib/reply/gateway/registry');
  return access as typeof import('@/lib/intake/server/access');
}

const ledgerWith = (available: number): LedgerPort => ({
  balance: async () => ({
    limit: 5_000_000,
    used: 5_000_000 - available,
    reserved: 0,
    available,
  }),
  reserve: jest.fn(),
  settle: jest.fn(),
  release: jest.fn(),
});

/** Whether a request of this kind passes with this balance. */
async function passes(
  registry: Registry,
  available: number,
  kind: 'TYPED' | 'INSTANT',
  env: Record<string, string> = {}
): Promise<boolean> {
  const { quotaPort } = load(registry);
  const port = quotaPort(
    { PRO_MONTHLY_UNITS: '5000000', ...env },
    { ledger: ledgerWith(available), now: () => 1_800_000_000_000 }
  );
  return (await port.precheck({ userId: 'u', tier: 'PRO', kind })).allowed;
}

const answerFloor = (models: unknown[]) =>
  floorUnits({
    kind: 'INSTANT',
    understandModel: null,
    answerModels: models as never,
  });

afterEach(() => {
  jest.resetModules();
});

describe('the floor of an instant prompt is the cheapest priced answer model', () => {
  it('there is a floor above one unit once a model is priced (the control for everything below)', () => {
    expect(answerFloor([PRICED])).toBeGreaterThan(1);
    expect(answerFloor([CHEAPER])).toBeLessThan(answerFloor([PRICED]));
  });

  it.each([
    ['the default of the launch pair', { primary: PRICED }],
    ['the fallback of the launch pair', { fallback: PRICED }],
    ['a model of the picker', { picker: [PRICED] }],
  ])('%s sets it', async (_name, registry) => {
    const floor = answerFloor([PRICED]);
    expect(await passes(registry, floor, 'INSTANT')).toBe(true);
    expect(await passes(registry, floor - 1, 'INSTANT')).toBe(false);
  });

  it('the cheapest of the pair and the picker wins, whichever it is', async () => {
    const floor = answerFloor([CHEAPER]);
    for (const registry of [
      { primary: PRICED, fallback: CHEAPER },
      { primary: CHEAPER, fallback: PRICED },
      { primary: PRICED, picker: [CHEAPER] },
      { fallback: PRICED, picker: [PRICED, CHEAPER] },
    ]) {
      expect(await passes(registry, floor, 'INSTANT')).toBe(true);
      expect(await passes(registry, floor - 1, 'INSTANT')).toBe(false);
    }
  });

  it('an unpriced model does not set a floor, and the floor of nothing priced is one unit', async () => {
    expect(
      await passes({ primary: UNPRICED, picker: [UNPRICED] }, 1, 'INSTANT')
    ).toBe(true);
    expect(
      await passes({ primary: UNPRICED, picker: [UNPRICED] }, 0, 'INSTANT')
    ).toBe(false);
  });
});

describe('the Understand call counts for a typed question and not for an instant prompt', () => {
  const env = { INTAKE_UNDERSTAND_MODEL: 'vendor/understand' };
  const registry: Registry = {
    primary: PRICED,
    bySlug: { 'vendor/understand': CHEAPER },
  };
  const typedFloor = floorUnits({
    kind: 'TYPED',
    understandModel: CHEAPER as never,
    answerModels: [PRICED] as never,
  });

  it('the typed floor is above the instant one by the Understand call', async () => {
    const instantFloor = answerFloor([PRICED]);
    expect(typedFloor).toBeGreaterThan(instantFloor);
    expect(await passes(registry, typedFloor, 'TYPED', env)).toBe(true);
    expect(await passes(registry, typedFloor - 1, 'TYPED', env)).toBe(false);
    expect(await passes(registry, instantFloor, 'INSTANT', env)).toBe(true);
    expect(await passes(registry, instantFloor - 1, 'INSTANT', env)).toBe(
      false
    );
  });

  it('a model the environment names that the registry does not know adds nothing', async () => {
    const floor = answerFloor([PRICED]);
    expect(await passes({ primary: PRICED }, floor, 'TYPED', env)).toBe(true);
    expect(await passes({ primary: PRICED }, floor - 1, 'TYPED', env)).toBe(
      false
    );
  });

  it('with no model named the typed floor is the answer’s', async () => {
    const floor = answerFloor([PRICED]);
    expect(await passes(registry, floor, 'TYPED')).toBe(true);
    expect(await passes(registry, floor - 1, 'TYPED')).toBe(false);
  });
});
