/**
 * Market Data Channel API with the active-indicator setting resolved from the
 * gateway (build step 2 part 6; rule 6, ADR-010).
 *
 * The gateway is mocked at the network edge only (`fetch`), and its answers are
 * the REAL contract fixtures written by the gateway's own spec
 * (railway-gateway/test/fixtures/cycles-current-*.json), so the real client, the
 * real parser and the real route run together against the gateway's actual output.
 * The existing, flag-off behaviour is covered by market-data-channel.test.ts and
 * must not change.
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import { TextEncoder, TextDecoder } from 'util';
Object.assign(global, { TextEncoder, TextDecoder });

class MockRequest {
  url: string;
  method: string;
  headers: Headers;
  constructor(url: string, init?: RequestInit) {
    this.url = url;
    this.method = init?.method || 'GET';
    this.headers = new Headers(init?.headers);
  }
}
global.Request = MockRequest as unknown as typeof Request;

const mockGetServerSession = jest.fn();
jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));
jest.mock('@/lib/auth/auth-options', () => ({
  __esModule: true,
  authOptions: {},
}));

const mockFindMany = jest.fn();
jest.mock('@/lib/db/market-prisma', () => ({
  __esModule: true,
  marketPrisma: {
    marketDataV6: { findMany: (...args: unknown[]) => mockFindMany(...args) },
  },
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

class MockOperationServiceError extends Error {
  status: number;
  body: Record<string, unknown>;
  constructor(status: number, body: Record<string, unknown>) {
    super(String(body.message ?? 'error'));
    this.status = status;
    this.body = body;
  }
}
const mockShouldUseOpService = jest.fn().mockReturnValue(false);
jest.mock('@/lib/operation-service/flags', () => ({
  __esModule: true,
  shouldUseOperationServiceForMarketDataChannel: () => mockShouldUseOpService(),
}));
const mockForward = jest.fn();
jest.mock('@/lib/operation-service/write-routes', () => ({
  __esModule: true,
  OperationServiceError: MockOperationServiceError,
  forwardRequestToOperationService: (...args: unknown[]) =>
    mockForward(...args),
}));

const fixture = (name: string) =>
  JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '../../railway-gateway/test/fixtures', name),
      'utf8'
    )
  );
const BEFORE = fixture('cycles-current-before-flip.json');
const AFTER = fixture('cycles-current-after-flip.json');
const T: number = AFTER.cycle.slot;

const mockFetch = jest.fn();
const gatewayAnswers = (body: unknown, status = 200) =>
  mockFetch.mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  });

const PRO = { user: { id: 'user-123', tier: 'PRO' } };
const makeRequest = (query = '') =>
  new MockRequest(
    `http://localhost/api/market-data/channel${query}`
  ) as unknown as Request;

/** A bar row carrying every source's channel columns, valued by source so the one read is recognisable. */
function row(timestamp: number) {
  const values: Record<string, number> = {};
  [
    ['best_fit_a', 1000],
    ['best_fit_b', 1100],
    ['cherry_a', 1200],
    ['cherry_b', 1300],
    ['most_recent', 1400],
    ['non_a', 1500],
    ['non_b', 1600],
  ].forEach(([source, base]) => {
    values[`${source}_uoedt`] = (base as number) + 2;
    values[`${source}_base_fl`] = (base as number) + 1;
    values[`${source}_loedt`] = base as number;
  });
  values['fractal_uoedt'] = 1802;
  values['fractal_best_fl'] = 1801;
  values['fractal_loedt'] = 1800;
  return { timestamp, ...values };
}

const ORIGINAL_ENV = { ...process.env };

describe('GET /api/market-data/channel with ACTIVE_INDICATOR_FROM_GATEWAY on', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockShouldUseOpService.mockReturnValue(false);
    mockGetServerSession.mockResolvedValue(PRO);
    mockFindMany.mockResolvedValue([row(100)]);
    process.env['ACTIVE_INDICATOR_FROM_GATEWAY'] = 'true';
    process.env['MARKET_GATEWAY_URL'] = 'https://gateway.example.test/';
    process.env['MARKET_GATEWAY_API_KEY'] = 'test_key_not_a_secret';
    global.fetch = mockFetch as unknown as typeof fetch;
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.restoreAllMocks();
  });

  async function call(query = '') {
    const { GET } = await import('@/app/api/market-data/channel/route');
    const response = await GET(makeRequest(query) as never);
    return { status: response.status, data: await response.json() };
  }

  describe('the overlay follows the setting, at the cycle’s slot', () => {
    it('before the flip: the M5 channel of best_fit_a, with the setting it came from', async () => {
      gatewayAnswers(BEFORE);
      const { status, data } = await call('?timeframe=M5');
      expect(status).toBe(200);
      expect(data.variant).toBe('best_fit_a');
      expect(data.points).toEqual([
        { time: 100, upper: 1002, mid: 1001, lower: 1000 },
      ]);
      expect(data.activeIndicator).toEqual({
        source: 'best_fit_a',
        effectiveSlot: 0,
        resolvedAtSlot: T - 300,
        basis: 'CYCLE',
      });
    });

    it('at the flip: the M5 channel of cherry_a', async () => {
      gatewayAnswers(AFTER);
      const { status, data } = await call('?timeframe=M5');
      expect(status).toBe(200);
      expect(data.variant).toBe('cherry_a');
      expect(data.points).toEqual([
        { time: 100, upper: 1202, mid: 1201, lower: 1200 },
      ]);
      expect(data.activeIndicator).toEqual({
        source: 'cherry_a',
        effectiveSlot: T,
        resolvedAtSlot: T,
        basis: 'CYCLE',
      });
    });

    it('the same route, the cycle before T then the cycle at T: it flips from the one to the other, and only then', async () => {
      gatewayAnswers(BEFORE);
      const first = await call('?timeframe=M5');
      gatewayAnswers(AFTER);
      const second = await call('?timeframe=M5');
      expect([first.data.variant, second.data.variant]).toEqual([
        'best_fit_a',
        'cherry_a',
      ]);
    });

    it('M15 follows its own setting, which the M5 flip did not touch', async () => {
      gatewayAnswers(AFTER);
      const { data } = await call('?timeframe=M15');
      expect(data.variant).toBe('non_b');
      expect(data.points).toEqual([
        { time: 100, upper: 1602, mid: 1601, lower: 1600 },
      ]);
    });

    it('the fractal EDT is a channel source too, and has its own column names', async () => {
      const body = JSON.parse(JSON.stringify(AFTER));
      body.activeIndicators.byTimeframe.M5.source = 'fractal_edt';
      gatewayAnswers(body);
      const { data } = await call('?timeframe=M5');
      expect(data.variant).toBe('fractal_edt');
      expect(data.points).toEqual([
        { time: 100, upper: 1802, mid: 1801, lower: 1800 },
      ]);
    });

    it('a `variant` in the request is ignored: the setting decides', async () => {
      gatewayAnswers(AFTER);
      const { status, data } = await call('?timeframe=M5&variant=non_b');
      expect(status).toBe(200);
      expect(data.variant).toBe('cherry_a');
      // even one that would be a 400 without the setting
      const bogus = await call('?timeframe=M5&variant=not_a_variant');
      expect(bogus.status).toBe(200);
      expect(bogus.data.variant).toBe('cherry_a');
    });

    it('asks the gateway with the service key, never cached, and trims a trailing slash from the base URL', async () => {
      gatewayAnswers(AFTER);
      await call('?timeframe=M5');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://gateway.example.test/api/v1/cycles/current');
      expect(init.method).toBe('GET');
      expect(init.cache).toBe('no-store');
      expect((init.headers as Record<string, string>)['Authorization']).toBe(
        'Bearer test_key_not_a_secret'
      );
    });

    it('the channel query itself is unchanged: the same symbol, timeframe, order and limit', async () => {
      gatewayAnswers(AFTER);
      await call('?timeframe=M5&limit=50');
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { symbol: 'XAUUSD', timeframe: 'M5' },
        orderBy: { timestamp: 'desc' },
        take: 50,
      });
    });
  });

  describe('when the gateway cannot say, the route says so: it never shows a different indicator', () => {
    const unavailable = async () => {
      const { status, data } = await call('?timeframe=M5');
      expect(status).toBe(503);
      expect(data).toMatchObject({
        success: false,
        error: 'Active indicator unavailable',
      });
      expect(data.points).toBeUndefined();
      expect(mockFindMany).not.toHaveBeenCalled();
    };

    it('not configured (no URL or no key)', async () => {
      delete process.env['MARKET_GATEWAY_URL'];
      await unavailable();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('unreachable', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
      await unavailable();
    });

    it('timed out', async () => {
      const abort = new Error('aborted');
      abort.name = 'AbortError';
      mockFetch.mockRejectedValue(abort);
      await unavailable();
    });

    it('the key is rejected (401)', async () => {
      gatewayAnswers({ message: 'Invalid API key' }, 401);
      await unavailable();
    });

    it('the gateway fails (500)', async () => {
      gatewayAnswers({}, 500);
      await unavailable();
    });

    it('an answer that is not the contract (another version)', async () => {
      gatewayAnswers({ ...AFTER, contract: 'cycles-current/2' });
      await unavailable();
    });

    it('an answer with a source this build does not know', async () => {
      const body = JSON.parse(JSON.stringify(AFTER));
      body.activeIndicators.byTimeframe.M5.source = 'brand_new_indicator';
      gatewayAnswers(body);
      await unavailable();
    });

    it('an answer that is not JSON', async () => {
      mockFetch.mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => {
          throw new Error('Unexpected token <');
        },
      });
      await unavailable();
    });

    it('no setting for the timeframe (the starting rows are missing): unknown, not a default', async () => {
      const body = JSON.parse(JSON.stringify(AFTER));
      body.activeIndicators.byTimeframe.M5 = null;
      gatewayAnswers(body);
      await unavailable();
    });

    it('logs why, for the operator', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
      await call('?timeframe=M5');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('active indicator unavailable (UNREACHABLE)')
      );
    });
  });

  describe('the gate keeps its order: nobody calls the gateway for a request that is refused anyway', () => {
    it('not signed in: 401 and no gateway call', async () => {
      mockGetServerSession.mockResolvedValue(null);
      const { status } = await call('?timeframe=M5');
      expect(status).toBe(401);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('FREE tier: 403 with the upsell and no gateway call', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'u', tier: 'FREE' },
      });
      const { status, data } = await call('?timeframe=M5');
      expect(status).toBe(403);
      expect(data.error).toBe('Multi-timeframe visualization is a PRO feature');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('an unsupported timeframe: 400 and no gateway call', async () => {
      const { status } = await call('?timeframe=H1');
      expect(status).toBe(400);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('an unsupported symbol: 400 and no gateway call', async () => {
      const { status } = await call('?symbol=EURUSD&timeframe=M5');
      expect(status).toBe(400);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('with the operation-service forwarding flag on, the indicator is still the setting’s', () => {
    beforeEach(() => {
      mockShouldUseOpService.mockReturnValue(true);
      mockForward.mockResolvedValue({ status: 200, body: { success: true } });
    });

    it('replaces the variant in the forwarded query with the active one', async () => {
      gatewayAnswers(AFTER);
      await call('?timeframe=M5&variant=non_b&limit=50');
      expect(mockForward).toHaveBeenCalledTimes(1);
      const forwarded = new URLSearchParams(
        (mockForward.mock.calls[0][1] as string).split('?')[1]
      );
      expect(forwarded.get('variant')).toBe('cherry_a');
      expect(forwarded.get('timeframe')).toBe('M5');
      expect(forwarded.get('limit')).toBe('50');
      expect(mockForward.mock.calls[0][1] as string).toMatch(
        /^\/market-data\/channel\?/
      );
    });

    it('adds the variant when the request had none', async () => {
      gatewayAnswers(BEFORE);
      await call('?timeframe=M5');
      const forwarded = new URLSearchParams(
        (mockForward.mock.calls[0][1] as string).split('?')[1]
      );
      expect(forwarded.get('variant')).toBe('best_fit_a');
    });

    it('does not forward when the gateway cannot say: 503', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
      const { status } = await call('?timeframe=M5');
      expect(status).toBe(503);
      expect(mockForward).not.toHaveBeenCalled();
    });
  });
});

describe('with the flag off (the default) the gateway is never asked', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockShouldUseOpService.mockReturnValue(false);
    mockGetServerSession.mockResolvedValue(PRO);
    mockFindMany.mockResolvedValue([row(100)]);
    delete process.env['ACTIVE_INDICATOR_FROM_GATEWAY'];
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it.each([[undefined], ['false'], ['1'], ['TRUE']])(
    'ACTIVE_INDICATOR_FROM_GATEWAY=%p: the request’s variant is used, with no network call',
    async (value) => {
      if (value !== undefined)
        process.env['ACTIVE_INDICATOR_FROM_GATEWAY'] = value;
      const { GET } = await import('@/app/api/market-data/channel/route');
      const response = await GET(
        makeRequest('?timeframe=M5&variant=cherry_b') as never
      );
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.variant).toBe('cherry_b');
      expect(data.activeIndicator).toBeUndefined();
      expect(mockFetch).not.toHaveBeenCalled();
    }
  );
});
