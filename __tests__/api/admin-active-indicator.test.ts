/**
 * Admin Active-Indicator API (build step 2 part 6; rule 6, ADR-010).
 *
 * The guard is the existing `requireAdmin` (mocked here, as in the other admin
 * route tests); the gateway is mocked at the network edge only (`fetch`), and the
 * real client and parsers run. The properties that matter: only an administrator
 * gets through, the author on the audit row is the signed-in administrator and can
 * never be supplied by the request, and the gateway's rules and refusals reach the
 * caller unchanged.
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import { TextEncoder, TextDecoder } from 'util';
Object.assign(global, { TextEncoder, TextDecoder });

import { AuthError } from '@/lib/auth/errors';

const mockRequireAdmin = jest.fn();
jest.mock('@/lib/auth/session', () => ({
  __esModule: true,
  requireAdmin: () => mockRequireAdmin(),
}));

jest.mock('next/server', () => ({
  __esModule: true,
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      json: async () => data,
      status: init?.status || 200,
    }),
  },
}));

const fixture = (name: string) =>
  JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '../../railway-gateway/test/fixtures', name),
      'utf8'
    )
  );
const AFTER = fixture('cycles-current-after-flip.json');
const T: number = AFTER.cycle.slot;

const ADMIN_SESSION = {
  user: { id: 'admin-1', email: 'admin@example.test', role: 'ADMIN' },
};
const mockFetch = jest.fn();
const ORIGINAL_ENV = { ...process.env };

const SETTING = {
  settingId: 'setting_0007',
  timeframe: 'M5',
  source: 'cherry_a',
  effectiveSlot: T + 3600,
  setBy: 'admin@example.test (admin-1)',
  reason: 'rehearsal',
  createdAt: T,
};

const reply = (body: unknown, status = 200) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
});

const post = (body: unknown) => ({ json: async () => body }) as never;
const postBroken = () =>
  ({
    json: async () => {
      throw new SyntaxError('Unexpected token');
    },
  }) as never;

const valid = () => ({
  timeframe: 'M5',
  source: 'cherry_a',
  effectiveSlot: T + 3600,
  reason: 'rehearsal',
});

describe('/api/admin/active-indicator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAdmin.mockResolvedValue(ADMIN_SESSION);
    process.env['MARKET_GATEWAY_URL'] = 'https://gateway.example.test';
    process.env['MARKET_GATEWAY_API_KEY'] = 'test_key_not_a_secret';
    global.fetch = mockFetch as unknown as typeof fetch;
    mockFetch.mockReset();
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.restoreAllMocks();
  });

  async function routes() {
    return import('@/app/api/admin/active-indicator/route');
  }

  describe('only an administrator gets in (the existing guard, unchanged)', () => {
    const refusals: Array<[string, () => void, number]> = [
      [
        'not signed in',
        () =>
          mockRequireAdmin.mockRejectedValue(
            new AuthError(
              'You must be logged in to access this resource',
              'UNAUTHORIZED',
              401
            )
          ),
        401,
      ],
      [
        'signed in but not an administrator',
        () =>
          mockRequireAdmin.mockRejectedValue(
            new AuthError(
              'You must be an administrator to access this resource',
              'ADMIN_REQUIRED',
              403
            )
          ),
        403,
      ],
      [
        'the guard itself failing',
        () => mockRequireAdmin.mockRejectedValue(new Error('db down')),
        403,
      ],
    ];

    it.each(refusals)('GET: %s', async (_label, arrange, status) => {
      arrange();
      const { GET } = await routes();
      const response = await GET();
      expect(response.status).toBe(status);
      expect((await response.json()).status).toBe('restricted');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it.each(refusals)(
      'POST: %s, and nothing reaches the gateway',
      async (_label, arrange, status) => {
        arrange();
        const { POST } = await routes();
        const response = await POST(post(valid()));
        expect(response.status).toBe(status);
        expect((await response.json()).status).toBe('restricted');
        expect(mockFetch).not.toHaveBeenCalled();
      }
    );
  });

  describe('GET: the audit trail and what is in force now', () => {
    function gatewayAnswers() {
      mockFetch.mockImplementation(async (url: string) =>
        url.endsWith('/api/v1/cycles/current')
          ? reply(AFTER)
          : reply({
              now: T + 70,
              earliestSettableSlot: T + 300,
              settings: [
                { ...SETTING, effectiveSlot: T, settingId: 'setting_0001' },
                {
                  settingId: 'seed_active_indicator_m5_best_fit_a',
                  timeframe: 'M5',
                  source: 'best_fit_a',
                  effectiveSlot: 0,
                  setBy: 'migration',
                  reason: 'ADR-010 starting value',
                  createdAt: 1700000000,
                },
              ],
            })
      );
    }

    it('returns the settings, the earliest settable slot and the setting in force at the current cycle', async () => {
      gatewayAnswers();
      const { GET } = await routes();
      const response = await GET();
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.status).toBe('ok');
      expect(body.earliestSettableSlot).toBe(T + 300);
      expect(
        body.settings.map((s: { settingId: string }) => s.settingId)
      ).toEqual(['setting_0001', 'seed_active_indicator_m5_best_fit_a']);
      expect(body.current).toMatchObject({
        cycleSlot: T,
        resolvedAtSlot: T,
        basis: 'CYCLE',
        dataStatus: 'FRESH',
      });
      expect(body.current.byTimeframe.M5.source).toBe('cherry_a');
    });

    it('asks the gateway with the service key', async () => {
      gatewayAnswers();
      const { GET } = await routes();
      await GET();
      const urls = mockFetch.mock.calls.map((c) => c[0]);
      expect(urls.sort()).toEqual([
        'https://gateway.example.test/api/v1/active-indicator',
        'https://gateway.example.test/api/v1/cycles/current',
      ]);
      for (const call of mockFetch.mock.calls) {
        expect((call[1] as RequestInit).headers).toMatchObject({
          Authorization: 'Bearer test_key_not_a_secret',
        });
      }
    });

    it('not configured: an honest 200 with the status, not an error', async () => {
      delete process.env['MARKET_GATEWAY_API_KEY'];
      const { GET } = await routes();
      const response = await GET();
      expect(response.status).toBe(200);
      expect((await response.json()).status).toBe('not_configured');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it.each([
      [
        'unreachable',
        () => mockFetch.mockRejectedValue(new Error('ECONNREFUSED')),
      ],
      ['a gateway error', () => mockFetch.mockResolvedValue(reply({}, 500))],
      ['a rejected key', () => mockFetch.mockResolvedValue(reply({}, 401))],
      [
        'an answer off the contract',
        () => mockFetch.mockResolvedValue(reply({ nonsense: true })),
      ],
    ])(
      '%s: a 200 with status unavailable and the reason',
      async (_label, arrange) => {
        arrange();
        const { GET } = await routes();
        const response = await GET();
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body.status).toBe('unavailable');
        expect(typeof body.message).toBe('string');
      }
    );
  });

  describe('POST: schedule a change', () => {
    it('201: sends the setting to the gateway with the administrator as its author, and returns what was written', async () => {
      mockFetch.mockResolvedValue(
        reply({ status: 'SET', setting: SETTING }, 201)
      );
      const { POST } = await routes();
      const response = await POST(post(valid()));
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body).toEqual({ status: 'set', setting: SETTING });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://gateway.example.test/api/v1/active-indicator');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({
        timeframe: 'M5',
        source: 'cherry_a',
        effectiveSlot: T + 3600,
        setBy: 'admin@example.test (admin-1)', // from the session
        reason: 'rehearsal',
      });
    });

    it('writes a server-log line saying who changed what, from which slot', async () => {
      mockFetch.mockResolvedValue(
        reply({ status: 'SET', setting: SETTING }, 201)
      );
      const { POST } = await routes();
      await POST(post(valid()));
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('M5 -> cherry_a')
      );
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('admin@example.test (admin-1)')
      );
    });

    it('a blank reason is not sent; a missing one neither', async () => {
      mockFetch.mockResolvedValue(
        reply({ status: 'SET', setting: { ...SETTING, reason: null } }, 201)
      );
      const { POST } = await routes();
      for (const reason of ['', '   ', undefined]) {
        const body = { ...valid(), reason };
        await POST(post(body));
      }
      for (const call of mockFetch.mock.calls) {
        expect(
          JSON.parse((call[1] as RequestInit).body as string)
        ).not.toHaveProperty('reason');
      }
    });

    it('the author is capped at the gateway’s limit, however long the email', async () => {
      mockRequireAdmin.mockResolvedValue({
        user: {
          id: 'admin-1',
          email: `${'x'.repeat(240)}@example.test`,
          role: 'ADMIN',
        },
      });
      mockFetch.mockResolvedValue(
        reply({ status: 'SET', setting: SETTING }, 201)
      );
      const { POST } = await routes();
      await POST(post(valid()));
      const sent = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      );
      expect(sent.setBy).toHaveLength(200);
    });

    it('an administrator with no email is still identified', async () => {
      mockRequireAdmin.mockResolvedValue({
        user: { id: 'admin-2', role: 'ADMIN' },
      });
      mockFetch.mockResolvedValue(
        reply({ status: 'SET', setting: SETTING }, 201)
      );
      const { POST } = await routes();
      await POST(post(valid()));
      const sent = JSON.parse(
        (mockFetch.mock.calls[0][1] as RequestInit).body as string
      );
      expect(sent.setBy).toBe('no-email (admin-2)');
    });

    it('refuses to take the author from the request: setBy is rejected, nothing is sent', async () => {
      const { POST } = await routes();
      const response = await POST(
        post({ ...valid(), setBy: 'someone.else@example.test' })
      );
      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.status).toBe('invalid');
      expect(body.errors.join(' ')).toMatch(/setBy is not accepted/);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it.each([
      ['an unknown field', { ...valid(), extra: 1 }, /unknown field extra/],
      ['an unknown timeframe', { ...valid(), timeframe: 'H1' }, /timeframe/],
      ['a lower-case timeframe', { ...valid(), timeframe: 'm5' }, /timeframe/],
      [
        'a statistics source that is not a channel indicator',
        { ...valid(), source: 'sr_levels' },
        /source/,
      ],
      [
        'a missing source',
        { timeframe: 'M5', effectiveSlot: T + 3600 },
        /source/,
      ],
      [
        'a slot that is text',
        { ...valid(), effectiveSlot: '2026-10-03' },
        /effectiveSlot/,
      ],
      [
        'a fractional slot',
        { ...valid(), effectiveSlot: T + 0.5 },
        /effectiveSlot/,
      ],
      [
        'a missing slot',
        { timeframe: 'M5', source: 'cherry_a' },
        /effectiveSlot/,
      ],
      ['a reason that is not text', { ...valid(), reason: 7 }, /reason/],
      [
        'a reason that is too long',
        { ...valid(), reason: 'x'.repeat(501) },
        /reason/,
      ],
    ])('400: %s, and nothing is sent', async (_label, body, mentions) => {
      const { POST } = await routes();
      const response = await POST(post(body));
      const data = await response.json();
      expect(response.status).toBe(400);
      expect(data.status).toBe('invalid');
      expect(data.errors.join(' ')).toMatch(mentions);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('400 with every problem at once, not one at a time', async () => {
      const { POST } = await routes();
      const response = await POST(
        post({ timeframe: 'H1', source: 'nope', effectiveSlot: 'x' })
      );
      expect((await response.json()).errors).toHaveLength(3);
    });

    it.each([
      ['an array', [valid()]],
      ['a string', 'M5'],
      ['null', null],
    ])('400 when the body is %s', async (_label, body) => {
      const { POST } = await routes();
      const response = await POST(post(body));
      expect(response.status).toBe(400);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('400 when the body is not JSON', async () => {
      const { POST } = await routes();
      const response = await POST(postBroken());
      expect(response.status).toBe(400);
      expect((await response.json()).errors[0]).toMatch(/not valid JSON/);
    });

    it('the gateway’s rules are the gateway’s: a refusal reaches the caller with its reason', async () => {
      mockFetch.mockResolvedValue(
        reply(
          {
            status: 'REFUSED',
            reason: 'SLOT_NOT_FUTURE',
            detail: 'effective slot 1 is not in the future',
          },
          400
        )
      );
      const { POST } = await routes();
      const response = await POST(post(valid()));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        status: 'refused',
        reason: 'SLOT_NOT_FUTURE',
        detail: 'effective slot 1 is not in the future',
      });
      expect(console.info).not.toHaveBeenCalled(); // nothing was changed, nothing is logged as changed
    });

    it('not configured: 503 and no call', async () => {
      delete process.env['MARKET_GATEWAY_URL'];
      const { POST } = await routes();
      const response = await POST(post(valid()));
      expect(response.status).toBe(503);
      expect((await response.json()).status).toBe('not_configured');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it.each([
      [
        'unreachable',
        () => mockFetch.mockRejectedValue(new Error('ECONNREFUSED')),
      ],
      ['a gateway error', () => mockFetch.mockResolvedValue(reply({}, 500))],
      ['a rejected key', () => mockFetch.mockResolvedValue(reply({}, 401))],
      [
        'the gateway rejecting the shape (an array of messages)',
        () =>
          mockFetch.mockResolvedValue(
            reply({ message: ['effectiveSlot must be an integer'] }, 400)
          ),
      ],
      [
        'an answer off the contract',
        () =>
          mockFetch.mockResolvedValue(
            reply({ status: 'SET', setting: { nonsense: true } }, 201)
          ),
      ],
    ])('502 when the gateway fails: %s', async (_label, arrange) => {
      arrange();
      const { POST } = await routes();
      const response = await POST(post(valid()));
      expect(response.status).toBe(502);
      expect((await response.json()).status).toBe('gateway_error');
      expect(console.info).not.toHaveBeenCalled();
    });
  });
});
