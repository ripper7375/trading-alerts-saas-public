/**
 * @jest-environment node
 */

/**
 * Who may call the intake routes, and the real edges behind the pipeline's ports (build step 6
 * part 5): the flag that is exactly `true`, the session as the only source of the user and the
 * tier, and the adapters the production ports are made of.
 */

jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));
jest.mock('@/lib/auth/session', () => ({ getSession: jest.fn() }));
jest.mock('@/lib/i18n/server-locale', () => ({ getServerLanguage: jest.fn() }));
jest.mock('@/lib/engine4/store/profile-store', () => {
  class StoredProfileError extends Error {}
  return { readProfile: jest.fn(), StoredProfileError };
});
jest.mock('@/lib/intake/read/snapshot', () => ({ readSnapshot: jest.fn() }));
jest.mock('@/lib/intake/read/events', () => ({
  readUpcomingEvents: jest.fn(),
}));

import { getSession } from '@/lib/auth/session';
import { readProfile } from '@/lib/engine4/store/profile-store';
import { getServerLanguage } from '@/lib/i18n/server-locale';
import { THREAD_ID } from '@/lib/intake';
import { readUpcomingEvents } from '@/lib/intake/read/events';
import { readSnapshot } from '@/lib/intake/read/snapshot';
import {
  entitlementPort,
  gatePorts,
  isInstantPromptsEnabled,
  isIntakeEnabled,
  productionPorts,
  profilePort,
  quotaPort,
  sessionPort,
  threadPort,
} from '@/lib/intake/server/access';
import type { Balance, LedgerPort } from '@/lib/reply/meter/quota-port';
import { replyText } from '@/lib/intake/server/reply';

const ORIGINAL_ENV = process.env;

afterEach(() => {
  process.env = ORIGINAL_ENV;
  jest.restoreAllMocks();
  jest.mocked(getSession).mockReset();
  jest.mocked(getServerLanguage).mockReset();
  jest.mocked(readProfile).mockReset();
  jest.mocked(readSnapshot).mockReset();
  jest.mocked(readUpcomingEvents).mockReset();
});

describe('the flags are exactly the text true', () => {
  const NOT_TRUE = [
    '',
    'TRUE',
    'True',
    '1',
    'yes',
    'on',
    ' true',
    'true ',
    'false',
    'truee',
    'enabled',
  ];

  it('INTAKE_ENABLED', () => {
    expect(isIntakeEnabled({ INTAKE_ENABLED: 'true' })).toBe(true);
    expect(isIntakeEnabled({})).toBe(false);
    expect(isIntakeEnabled({ INTAKE_ENABLED: undefined })).toBe(false);
    for (const value of NOT_TRUE) {
      expect(isIntakeEnabled({ INTAKE_ENABLED: value })).toBe(false);
    }
    // the other flag does not turn this one on
    expect(isIntakeEnabled({ INTAKE_INSTANT_PROMPTS_ENABLED: 'true' })).toBe(
      false
    );
  });

  it('INTAKE_INSTANT_PROMPTS_ENABLED', () => {
    expect(
      isInstantPromptsEnabled({ INTAKE_INSTANT_PROMPTS_ENABLED: 'true' })
    ).toBe(true);
    expect(isInstantPromptsEnabled({})).toBe(false);
    for (const value of NOT_TRUE) {
      expect(
        isInstantPromptsEnabled({ INTAKE_INSTANT_PROMPTS_ENABLED: value })
      ).toBe(false);
    }
    expect(isInstantPromptsEnabled({ INTAKE_ENABLED: 'true' })).toBe(false);
  });

  it('read the process environment by default', () => {
    process.env = {
      ...ORIGINAL_ENV,
      INTAKE_ENABLED: 'true',
      INTAKE_INSTANT_PROMPTS_ENABLED: 'true',
    };
    expect(isIntakeEnabled()).toBe(true);
    expect(isInstantPromptsEnabled()).toBe(true);
    process.env = { ...ORIGINAL_ENV, INTAKE_ENABLED: 'false' };
    delete process.env['INTAKE_INSTANT_PROMPTS_ENABLED'];
    expect(isIntakeEnabled()).toBe(false);
    expect(isInstantPromptsEnabled()).toBe(false);
  });

  it('are off in the environment of the tests (set nowhere)', () => {
    expect(ORIGINAL_ENV['INTAKE_ENABLED']).toBeUndefined();
    expect(ORIGINAL_ENV['INTAKE_INSTANT_PROMPTS_ENABLED']).toBeUndefined();
  });
});

describe('sessionPort', () => {
  const current = (session: unknown) =>
    sessionPort(async () => session as never).current();

  it('gives the user and the tier of the session', async () => {
    await expect(current({ user: { id: 'u1', tier: 'PRO' } })).resolves.toEqual(
      { userId: 'u1', tier: 'PRO' }
    );
    await expect(
      current({ user: { id: 'u2', tier: 'FREE' } })
    ).resolves.toEqual({ userId: 'u2', tier: 'FREE' });
  });

  it.each([
    ['no session', null],
    ['no user', {}],
    ['no id', { user: { tier: 'PRO' } }],
    ['an empty id', { user: { id: '', tier: 'PRO' } }],
    ['a null id', { user: { id: null, tier: 'PRO' } }],
    ['a numeric id', { user: { id: 7, tier: 'PRO' } }],
  ])('is nobody with %s', async (_name, session) => {
    await expect(current(session)).resolves.toBeNull();
  });

  it.each([undefined, null, '', 'pro', 'ADMIN', 'TRIAL', 7])(
    'treats the tier %j as Free: access is never granted by a gap',
    async (tier) => {
      await expect(current({ user: { id: 'u1', tier } })).resolves.toEqual({
        userId: 'u1',
        tier: 'FREE',
      });
    }
  );

  it('uses the server’s session by default', async () => {
    jest
      .mocked(getSession)
      .mockResolvedValue({ user: { id: 'u9', tier: 'PRO' } } as never);
    await expect(sessionPort().current()).resolves.toEqual({
      userId: 'u9',
      tier: 'PRO',
    });
    expect(getSession).toHaveBeenCalledTimes(1);
  });
});

describe('entitlementPort (the entitlement table, architecture 7.3)', () => {
  it('lets Pro in and keeps Free out: the live analyst is Pro’s, the Free tier has the recorded demo', () => {
    expect(entitlementPort.allows('PRO')).toBe(true);
    expect(entitlementPort.allows('FREE')).toBe(false);
  });

  it.each(['pro', 'ADMIN', '', 'TRIAL'])(
    'does not let the tier %j in',
    (tier) => {
      expect(entitlementPort.allows(tier)).toBe(false);
    }
  );
});

describe('threadPort (decision D6 (a): no store, so well-formed is all it can check)', () => {
  const check = (threadId: string | null) =>
    threadPort.check({ userId: 'u', threadId, symbol: 'XAUUSD' });

  it('accepts no thread', async () => {
    await expect(check(null)).resolves.toEqual({ ok: true, threadId: null });
  });

  it.each(['thread-1', 'a', 'A_b-9', 'x'.repeat(64), '0123456789'])(
    'accepts %s',
    async (id) => {
      await expect(check(id)).resolves.toEqual({ ok: true, threadId: id });
    }
  );

  it.each([
    '',
    'has space',
    'x'.repeat(65),
    '../etc',
    'a/b',
    'ä',
    'a.b',
    'a:b',
    '<script>',
    'id\n',
  ])('refuses %j', async (id) => {
    await expect(check(id)).resolves.toEqual({ ok: false });
  });

  it('uses the packet’s own rule for what a thread id is', () => {
    expect(THREAD_ID.test('thread-1')).toBe(true);
  });
});

describe('profilePort', () => {
  it('gives the six-field projection of the stored profile', async () => {
    jest.mocked(readProfile).mockResolvedValue({
      profile: {
        traderType: 'SCALPER',
        style: 'TREND_FOLLOWING',
        maxRiskPct: '1',
        maxLeverage: '5',
        targetRrr: '2',
        equity: '12345',
        minSld: '13',
        commission: '4',
      },
    } as never);
    const read = await profilePort.read('user-1');
    expect(read).toEqual({
      ok: true,
      profile: {
        trader_type: 'SCALPER',
        style: 'TREND_FOLLOWING',
        max_risk_pct: '1',
        max_leverage: '5',
        target_rrr: '2',
        min_sld: '13',
      },
    });
    expect(readProfile).toHaveBeenCalledWith('user-1');
    expect(JSON.stringify(read)).not.toMatch(/12345|equity|commission/i);
  });

  it('is PROFILE_NOT_SET for a trader with no profile', async () => {
    jest.mocked(readProfile).mockResolvedValue(null);
    await expect(profilePort.read('user-1')).resolves.toMatchObject({
      ok: false,
      code: 'PROFILE_NOT_SET',
    });
  });

  it('does not throw for a database that fails', async () => {
    jest.mocked(readProfile).mockRejectedValue(new Error('down'));
    await expect(profilePort.read('user-1')).resolves.toMatchObject({
      ok: false,
      code: 'DATABASE_ERROR',
    });
  });
});

describe('quotaPort (build step 7 part 6: the floor check of the quota ledger replaces the pass-through)', () => {
  const NOW = Date.UTC(2026, 9, 15, 10, 0, 0);
  const balanceOf = (available: number): Balance => ({
    limit: 5_000_000,
    used: 5_000_000 - available,
    reserved: 0,
    available,
  });
  function ledger(available: number) {
    const balance = jest.fn(async () => balanceOf(available));
    const port: LedgerPort = {
      balance,
      reserve: jest.fn(),
      settle: jest.fn(),
      release: jest.fn(),
    };
    return { port, balance };
  }
  const ask = (tier: string, kind: 'TYPED' | 'INSTANT' = 'TYPED') => ({
    userId: 'u',
    tier,
    kind,
  });

  it('refuses everything while PRO_MONTHLY_UNITS is unset (decision D4: fail closed), and does not ask the ledger', async () => {
    const { port, balance } = ledger(5_000_000);
    const quota = quotaPort({}, { ledger: port, now: () => NOW });
    for (const kind of ['TYPED', 'INSTANT'] as const) {
      await expect(quota.precheck(ask('PRO', kind))).resolves.toEqual({
        allowed: false,
      });
    }
    expect(balance).not.toHaveBeenCalled();
  });

  it.each(['', '0', '-5', '1.5', '1e6', 'many', ' 5000'])(
    'a damaged PRO_MONTHLY_UNITS (%j) is no allowance either',
    async (value) => {
      const { port, balance } = ledger(5_000_000);
      const quota = quotaPort(
        { PRO_MONTHLY_UNITS: value },
        { ledger: port, now: () => NOW }
      );
      await expect(quota.precheck(ask('PRO'))).resolves.toEqual({
        allowed: false,
      });
      expect(balance).not.toHaveBeenCalled();
    }
  );

  it('with an allowance, lets a Pro trader through while the balance reaches the floor, asking the ledger for this trader, this instant and the allowance', async () => {
    const { port, balance } = ledger(5_000_000);
    const quota = quotaPort(
      { PRO_MONTHLY_UNITS: '5000000' },
      { ledger: port, now: () => NOW }
    );
    await expect(quota.precheck(ask('PRO'))).resolves.toEqual({
      allowed: true,
    });
    expect(balance).toHaveBeenCalledWith({
      userId: 'u',
      nowMs: NOW,
      allowanceUnits: 5_000_000,
    });
  });

  it('refuses an empty account before the Understand call is paid for', async () => {
    const { port } = ledger(0);
    const quota = quotaPort(
      { PRO_MONTHLY_UNITS: '5000000' },
      { ledger: port, now: () => NOW }
    );
    for (const kind of ['TYPED', 'INSTANT'] as const) {
      await expect(quota.precheck(ask('PRO', kind))).resolves.toEqual({
        allowed: false,
      });
    }
  });

  it('the Free tier has no units (ADR-072): refused whatever the allowance, and the ledger is not asked', async () => {
    const { port, balance } = ledger(5_000_000);
    const quota = quotaPort(
      { PRO_MONTHLY_UNITS: '5000000' },
      { ledger: port, now: () => NOW }
    );
    for (const tier of ['FREE', 'pro', 'ADMIN', '']) {
      await expect(quota.precheck(ask(tier))).resolves.toEqual({
        allowed: false,
      });
    }
    expect(balance).not.toHaveBeenCalled();
  });

  it('while no model is priced the floor is one unit: a balance of one is enough and nothing is not', async () => {
    const env = { PRO_MONTHLY_UNITS: '5000000' };
    await expect(
      quotaPort(env, { ledger: ledger(1).port, now: () => NOW }).precheck(
        ask('PRO')
      )
    ).resolves.toEqual({ allowed: true });
    await expect(
      quotaPort(env, { ledger: ledger(0).port, now: () => NOW }).precheck(
        ask('PRO')
      )
    ).resolves.toEqual({ allowed: false });
  });

  it('a ledger that fails fails the check: it never lets a request through for free', async () => {
    const port: LedgerPort = {
      balance: async () => {
        throw new Error('database down');
      },
      reserve: jest.fn(),
      settle: jest.fn(),
      release: jest.fn(),
    };
    const quota = quotaPort(
      { PRO_MONTHLY_UNITS: '5000000' },
      { ledger: port, now: () => NOW }
    );
    await expect(quota.precheck(ask('PRO'))).rejects.toThrow('database down');
  });

  it('reads the clock by default', async () => {
    const { port, balance } = ledger(5_000_000);
    const before = Date.now();
    await quotaPort(
      { PRO_MONTHLY_UNITS: '5000000' },
      { ledger: port }
    ).precheck(ask('PRO'));
    const nowMs = (balance.mock.calls[0] as unknown as [{ nowMs: number }])[0]
      .nowMs;
    expect(nowMs).toBeGreaterThanOrEqual(before);
    expect(nowMs).toBeLessThanOrEqual(Date.now());
  });

  it('is not the pass-through any more: with the allowance unset a Pro trader is refused', async () => {
    const quota = quotaPort({}, { ledger: ledger(5_000_000).port });
    await expect(quota.precheck(ask('PRO'))).resolves.toEqual({
      allowed: false,
    });
  });
});

describe('gatePorts', () => {
  it('turns the flag on and off with the environment it is given', () => {
    expect(
      gatePorts({ INTAKE_ENABLED: 'true' }, async () => null).enabled()
    ).toBe(true);
    expect(gatePorts({}, async () => null).enabled()).toBe(false);
  });

  it('reads the session it is given', async () => {
    const ports = gatePorts({ INTAKE_ENABLED: 'true' }, async () => ({
      user: { id: 'u3', tier: 'PRO' },
    }));
    await expect(ports.session.current()).resolves.toEqual({
      userId: 'u3',
      tier: 'PRO',
    });
    expect(ports.entitlement).toBe(entitlementPort);
    expect(ports.thread).toBe(threadPort);
    expect(ports.profile).toBe(profilePort);
    // the quota is the ledger's floor check: with the allowance unset in this environment it refuses
    await expect(
      ports.quota.precheck({ userId: 'u3', tier: 'PRO', kind: 'TYPED' })
    ).resolves.toEqual({ allowed: false });
  });
});

describe('productionPorts', () => {
  const ENV = {
    INTAKE_ENABLED: 'true',
    KNOWLEDGE_SERVICE_URL: 'https://knowledge.example.internal',
    KNOWLEDGE_SERVICE_KEY: 'k-knowledge',
    INTAKE_UNDERSTAND_API_KEY: 'k-model',
    INTAKE_UNDERSTAND_MODEL: 'vendor/model',
  };
  const REQUEST = {
    intent: 'DIRECTION' as const,
    question_en: 'Should I buy gold now',
    m_star: ['MCD1'],
    state_codes: ['MCD1_UP_IN_CORRIDOR'],
    routing_version: 'routing-v1',
  };

  it('has the flag from the environment it is given, and the fixed replies', () => {
    expect(productionPorts({}).gate.enabled()).toBe(false);
    expect(productionPorts(ENV).gate.enabled()).toBe(true);
    expect(productionPorts({}).reply).toBe(replyText);
  });

  it('reads the interface setting from the language the app already stores', async () => {
    jest.mocked(getServerLanguage).mockResolvedValue('ja');
    await expect(productionPorts({}).interfaceLocale()).resolves.toBe('ja');
    expect(getServerLanguage).toHaveBeenCalledTimes(1);
  });

  it('reads the clock', () => {
    const before = Date.now();
    const now = productionPorts({}).now();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });

  it('asks the readers for the snapshot and the calendar with the request and nothing else', async () => {
    const ports = productionPorts({});
    await ports.snapshot({ traderType: 'SCALPER' });
    expect(readSnapshot).toHaveBeenCalledTimes(1);
    expect(jest.mocked(readSnapshot).mock.calls[0]).toEqual([
      { traderType: 'SCALPER' },
    ]);
    await ports.events({ nowSeconds: 1_800_000_000, scope: 'UPCOMING_ALL' });
    expect(jest.mocked(readUpcomingEvents).mock.calls[0]).toEqual([
      { nowSeconds: 1_800_000_000, scope: 'UPCOMING_ALL' },
    ]);
  });

  it('is not configured without the environment: no knowledge, no model, and nothing sent', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const ports = productionPorts({});
    await expect(ports.knowledge.search(REQUEST)).resolves.toMatchObject({
      knowledge: { status: 'UNAVAILABLE' },
      problems: ['KNOWLEDGE_NOT_CONFIGURED'],
    });
    await expect(
      ports.understand.understand({
        version: 'understand-1',
        system: 's',
        user: '{}',
      })
    ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('calls the knowledge service and the model the environment names', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (url) =>
        String(url).includes('/search')
          ? new Response(
              JSON.stringify({
                status: 'EMPTY',
                index_build_id: 'b1',
                chunks: [],
                expansions: [],
              })
            )
          : new Response(
              JSON.stringify({ choices: [{ message: { content: '{"x":1}' } }] })
            )
      );
    const ports = productionPorts(ENV);
    await expect(ports.knowledge.search(REQUEST)).resolves.toMatchObject({
      knowledge: { status: 'EMPTY', index_build_id: 'b1' },
    });
    await expect(
      ports.understand.understand({
        version: 'understand-1',
        system: 's',
        user: '{}',
      })
    ).resolves.toBe('{"x":1}');
    const urls = fetchSpy.mock.calls.map((call) => String(call[0]));
    expect(urls).toEqual([
      'https://knowledge.example.internal/search',
      'https://openrouter.ai/api/v1/chat/completions',
    ]);
  });
});
