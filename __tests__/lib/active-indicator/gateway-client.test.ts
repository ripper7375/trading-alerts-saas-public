/**
 * lib/active-indicator: the source list and column mapping, the gateway client's
 * contract parser (against the gateway's own fixtures), and its failure mapping.
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import { shouldResolveActiveIndicatorFromGateway } from '@/lib/active-indicator/flags';
import {
  GatewayError,
  fetchActiveIndicatorHistory,
  fetchCurrentCycle,
  parseCurrentCycle,
  setActiveIndicator,
} from '@/lib/active-indicator/gateway-client';
import { resolveActiveChannel } from '@/lib/active-indicator/resolve';
import {
  CHANNEL_SOURCES,
  channelColumns,
  isActiveIndicatorTimeframe,
  isChannelSource,
} from '@/lib/active-indicator/sources';
import { CENTROID_VARIANTS } from '@/types/indicator';

const gatewayFixture = (name: string) =>
  JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '../../../railway-gateway/test/fixtures', name),
      'utf8'
    )
  );
const BEFORE = gatewayFixture('cycles-current-before-flip.json');
const AFTER = gatewayFixture('cycles-current-after-flip.json');
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

describe('the channel sources', () => {
  it('are the seven centroid variants and the fractal EDT, in the gateway’s order', () => {
    expect([...CHANNEL_SOURCES]).toEqual([...CENTROID_VARIANTS, 'fractal_edt']);
    expect(CHANNEL_SOURCES).toHaveLength(8);
  });

  it('isChannelSource accepts exactly them', () => {
    for (const s of CHANNEL_SOURCES) expect(isChannelSource(s)).toBe(true);
    for (const s of [
      'fractal',
      'resistance',
      'support',
      'sr_levels',
      'sr2_levels',
      '',
      'BEST_FIT_A',
      null,
      undefined,
      7,
    ]) {
      expect(isChannelSource(s)).toBe(false);
    }
  });

  it('the timeframes are M5 and M15', () => {
    expect(isActiveIndicatorTimeframe('M5')).toBe(true);
    expect(isActiveIndicatorTimeframe('M15')).toBe(true);
    for (const t of ['m5', 'H1', '', null, undefined])
      expect(isActiveIndicatorTimeframe(t)).toBe(false);
  });

  describe('channelColumns', () => {
    it('the centroid variants share one naming', () => {
      expect(channelColumns('cherry_a')).toEqual({
        upper: 'cherry_a_uoedt',
        mid: 'cherry_a_base_fl',
        lower: 'cherry_a_loedt',
      });
    });

    it('the fractal EDT names its lines differently', () => {
      expect(channelColumns('fractal_edt')).toEqual({
        upper: 'fractal_uoedt',
        mid: 'fractal_best_fl',
        lower: 'fractal_loedt',
      });
    });

    it('every column it names exists on the market_data_v6 model (a wrong name would read as an empty channel)', () => {
      const schema = fs.readFileSync(
        path.join(__dirname, '../../../prisma/market-data/schema.prisma'),
        'utf8'
      );
      const model = schema.slice(schema.indexOf('model MarketDataV6'));
      const body = model.slice(0, model.indexOf('\n}'));
      const columns = new Set(
        body
          .split('\n')
          .map((l) => l.trim().split(/\s+/)[0])
          .filter(Boolean)
      );
      for (const source of CHANNEL_SOURCES) {
        const c = channelColumns(source);
        for (const name of [c.upper, c.mid, c.lower]) {
          expect([source, name, columns.has(name)]).toEqual([
            source,
            name,
            true,
          ]);
        }
      }
    });
  });
});

describe('the flag', () => {
  const original = process.env['ACTIVE_INDICATOR_FROM_GATEWAY'];
  afterEach(() => {
    if (original === undefined)
      delete process.env['ACTIVE_INDICATOR_FROM_GATEWAY'];
    else process.env['ACTIVE_INDICATOR_FROM_GATEWAY'] = original;
  });

  it('is on only for the exact string "true"', () => {
    for (const [value, expected] of [
      [undefined, false],
      ['', false],
      ['false', false],
      ['TRUE', false],
      ['1', false],
      ['yes', false],
      ['true', true],
    ] as const) {
      if (value === undefined)
        delete process.env['ACTIVE_INDICATOR_FROM_GATEWAY'];
      else process.env['ACTIVE_INDICATOR_FROM_GATEWAY'] = value;
      expect([value, shouldResolveActiveIndicatorFromGateway()]).toEqual([
        value,
        expected,
      ]);
    }
  });
});

describe('parseCurrentCycle (the contract the gateway’s spec writes)', () => {
  it('accepts both fixtures and returns them unchanged', () => {
    expect(parseCurrentCycle(BEFORE)).toEqual(BEFORE);
    expect(parseCurrentCycle(AFTER)).toEqual(AFTER);
  });

  it('accepts the answer to ?slot= (the VPS renderer’s call), whose basis is REQUESTED_SLOT', () => {
    const renderer = gatewayFixture(
      'cycles-current-renderer-before-ready.json'
    );
    expect(renderer.activeIndicators.basis).toBe('REQUESTED_SLOT');
    expect(parseCurrentCycle(renderer)).toEqual(renderer);
  });

  it('accepts no cycle at all, and a timeframe with no setting', () => {
    const body = clone(AFTER);
    body.cycle = null;
    body.activeIndicators.basis = 'WALL_CLOCK';
    body.activeIndicators.byTimeframe.M15 = null;
    expect(parseCurrentCycle(body).cycle).toBeNull();
    expect(parseCurrentCycle(body).activeIndicators.byTimeframe.M15).toBeNull();
  });

  const mutate = (change: (b: ReturnType<typeof clone>) => void) => () => {
    const body = clone(AFTER) as Record<string, any>;
    change(body);
    return body;
  };
  it.each([
    ['not an object', () => 'text'],
    ['an array', () => []],
    ['null', () => null],
    [
      'another contract version',
      mutate((b) => (b.contract = 'cycles-current/2')),
    ],
    ['no contract', mutate((b) => delete b.contract)],
    ['a non-integer now', mutate((b) => (b.now = 1.5))],
    ['a cycle that is not an object', mutate((b) => (b.cycle = 'x'))],
    [
      'a cycle status a cycle can never have',
      mutate((b) => (b.cycle.status = 'STALE')),
    ],
    ['a cycle without timings', mutate((b) => delete b.cycle.timings)],
    [
      'a non-integer ready time',
      mutate((b) => (b.cycle.timings.readyAt = '2026')),
    ],
    [
      'a retuning flag that is text',
      mutate((b) => (b.cycle.retuning = 'false')),
    ],
    ['an unknown data status', mutate((b) => (b.dataStatus.status = 'GREAT'))],
    ['no data status reason', mutate((b) => delete b.dataStatus.reason)],
    ['no active indicators', mutate((b) => delete b.activeIndicators)],
    ['an unknown basis', mutate((b) => (b.activeIndicators.basis = 'GUESS'))],
    [
      'a missing timeframe',
      mutate((b) => delete b.activeIndicators.byTimeframe.M15),
    ],
    [
      'a source this build does not know',
      mutate((b) => (b.activeIndicators.byTimeframe.M5.source = 'brand_new')),
    ],
    [
      'a setting that describes the other timeframe',
      mutate((b) => (b.activeIndicators.byTimeframe.M5.timeframe = 'M15')),
    ],
    [
      'a setting without an author',
      mutate((b) => delete b.activeIndicators.byTimeframe.M5.setBy),
    ],
    [
      'a setting with a non-integer slot',
      mutate((b) => (b.activeIndicators.byTimeframe.M5.effectiveSlot = 'T')),
    ],
  ])('rejects %s', (_label, make) => {
    expect(() => parseCurrentCycle(make())).toThrow(GatewayError);
    try {
      parseCurrentCycle(make());
    } catch (error) {
      expect((error as GatewayError).kind).toBe('BAD_RESPONSE');
    }
  });
});

describe('the client', () => {
  const ORIGINAL_ENV = { ...process.env };
  const mockFetch = jest.fn();
  const reply = (body: unknown, status = 200) => ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  });

  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof fetch;
    process.env['MARKET_GATEWAY_URL'] = 'https://gateway.example.test///';
    process.env['MARKET_GATEWAY_API_KEY'] = 'test_key_not_a_secret';
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.useRealTimers();
  });

  const kindOf = async (call: () => Promise<unknown>) => {
    try {
      await call();
    } catch (error) {
      return (error as GatewayError).kind;
    }
    return 'NO ERROR';
  };

  it('needs both the URL and the key, and names what is missing without sending anything', async () => {
    for (const name of ['MARKET_GATEWAY_URL', 'MARKET_GATEWAY_API_KEY']) {
      process.env = {
        ...ORIGINAL_ENV,
        MARKET_GATEWAY_URL: 'https://g.test',
        MARKET_GATEWAY_API_KEY: 'k',
      };
      delete process.env[name];
      expect(await kindOf(fetchCurrentCycle)).toBe('NOT_CONFIGURED');
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('strips trailing slashes, sends the key as a Bearer token and asks for no caching', async () => {
    mockFetch.mockResolvedValue(reply(AFTER));
    await fetchCurrentCycle();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://gateway.example.test/api/v1/cycles/current');
    expect(init).toMatchObject({ method: 'GET', cache: 'no-store' });
    expect(init.headers).toEqual({
      Authorization: 'Bearer test_key_not_a_secret',
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('gives up after five seconds and says TIMEOUT', async () => {
    jest.useFakeTimers();
    mockFetch.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        })
    );
    const pending = kindOf(fetchCurrentCycle);
    await jest.advanceTimersByTimeAsync(4999);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(2);
    expect(await pending).toBe('TIMEOUT');
  });

  it.each([
    [
      'a network failure',
      () => mockFetch.mockRejectedValue(new Error('ECONNREFUSED')),
      'UNREACHABLE',
    ],
    ['401', () => mockFetch.mockResolvedValue(reply({}, 401)), 'REJECTED'],
    ['403', () => mockFetch.mockResolvedValue(reply({}, 403)), 'REJECTED'],
    ['404', () => mockFetch.mockResolvedValue(reply({}, 404)), 'REJECTED'],
    ['429', () => mockFetch.mockResolvedValue(reply({}, 429)), 'REJECTED'],
    ['500', () => mockFetch.mockResolvedValue(reply({}, 500)), 'SERVER_ERROR'],
    ['503', () => mockFetch.mockResolvedValue(reply({}, 503)), 'SERVER_ERROR'],
    [
      'an answer that is not JSON',
      () =>
        mockFetch.mockResolvedValue({
          status: 200,
          ok: true,
          json: async () => {
            throw new Error('x');
          },
        }),
      'BAD_RESPONSE',
    ],
    [
      'an answer off the contract',
      () =>
        mockFetch.mockResolvedValue(reply({ contract: 'cycles-current/9' })),
      'BAD_RESPONSE',
    ],
  ])('%s is %s', async (_label, arrange, kind) => {
    arrange();
    expect(await kindOf(fetchCurrentCycle)).toBe(kind);
  });

  it.each([[401], [403]])(
    'a %i tells the operator the API key was rejected, and carries the status',
    async (status) => {
      mockFetch.mockResolvedValue(reply({}, status));
      let caught: GatewayError | null = null;
      try {
        await fetchCurrentCycle();
      } catch (error) {
        caught = error as GatewayError;
      }
      expect(caught).toBeInstanceOf(GatewayError);
      expect(caught!.message).toMatch(/rejected the configured API key/);
      expect(caught!.status).toBe(status);
    }
  );

  describe('resolveActiveChannel', () => {
    it('the setting for the timeframe at the cycle the gateway reports', async () => {
      mockFetch.mockResolvedValue(reply(AFTER));
      expect(await resolveActiveChannel('M5')).toEqual({
        timeframe: 'M5',
        source: 'cherry_a',
        effectiveSlot: AFTER.cycle.slot,
        resolvedAtSlot: AFTER.cycle.slot,
        basis: 'CYCLE',
      });
      expect((await resolveActiveChannel('M15')).source).toBe('non_b');
    });

    it('a timeframe with no setting is an error, never a default', async () => {
      const body = clone(AFTER);
      body.activeIndicators.byTimeframe.M5 = null;
      mockFetch.mockResolvedValue(reply(body));
      expect(await kindOf(() => resolveActiveChannel('M5'))).toBe(
        'BAD_RESPONSE'
      );
    });
  });

  describe('the settings history', () => {
    const history = {
      now: 100,
      earliestSettableSlot: 300,
      settings: [AFTER.activeIndicators.byTimeframe.M5],
    };

    it('builds the query from its options', async () => {
      mockFetch.mockResolvedValue(reply(history));
      await fetchActiveIndicatorHistory({ timeframe: 'M5', limit: 20 });
      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://gateway.example.test/api/v1/active-indicator?timeframe=M5&limit=20'
      );
      mockFetch.mockClear();
      await fetchActiveIndicatorHistory();
      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://gateway.example.test/api/v1/active-indicator'
      );
    });

    it('parses it, and rejects a row that is off the contract', async () => {
      mockFetch.mockResolvedValue(reply(history));
      expect((await fetchActiveIndicatorHistory()).settings).toHaveLength(1);
      mockFetch.mockResolvedValue(
        reply({ ...history, settings: [{ nonsense: 1 }] })
      );
      expect(await kindOf(fetchActiveIndicatorHistory)).toBe('BAD_RESPONSE');
      mockFetch.mockResolvedValue(reply({ ...history, settings: 'x' }));
      expect(await kindOf(fetchActiveIndicatorHistory)).toBe('BAD_RESPONSE');
    });
  });

  describe('setActiveIndicator', () => {
    const input = {
      timeframe: 'M5' as const,
      source: 'cherry_a' as const,
      effectiveSlot: 1789563600,
      setBy: 'admin@example.test (admin-1)',
      reason: 'rehearsal',
    };

    it('posts JSON with the key and returns the setting', async () => {
      mockFetch.mockResolvedValue(
        reply(
          { status: 'SET', setting: AFTER.activeIndicators.byTimeframe.M5 },
          201
        )
      );
      const outcome = await setActiveIndicator(input);
      expect(outcome.status).toBe('SET');
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://gateway.example.test/api/v1/active-indicator');
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({
        Authorization: 'Bearer test_key_not_a_secret',
        'Content-Type': 'application/json',
      });
      expect(JSON.parse(init.body as string)).toEqual(input);
    });

    it('a REFUSED 400 is an outcome with its reason, not an error', async () => {
      mockFetch.mockResolvedValue(
        reply(
          { status: 'REFUSED', reason: 'SLOT_TOO_FAR', detail: 'a week' },
          400
        )
      );
      expect(await setActiveIndicator(input)).toEqual({
        status: 'REFUSED',
        reason: 'SLOT_TOO_FAR',
        detail: 'a week',
      });
    });

    it('any other 400 is the gateway rejecting the request: an error', async () => {
      mockFetch.mockResolvedValue(
        reply({ message: ['effectiveSlot must be an integer'] }, 400)
      );
      expect(await kindOf(() => setActiveIndicator(input))).toBe('REJECTED');
    });

    it('a body that is neither SET nor REFUSED is off the contract', async () => {
      mockFetch.mockResolvedValue(reply({ status: 'MAYBE' }, 201));
      expect(await kindOf(() => setActiveIndicator(input))).toBe(
        'BAD_RESPONSE'
      );
    });

    it('omits an empty reason', async () => {
      mockFetch.mockResolvedValue(
        reply(
          { status: 'SET', setting: AFTER.activeIndicators.byTimeframe.M5 },
          201
        )
      );
      await setActiveIndicator({ ...input, reason: null });
      expect(
        JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string)
      ).not.toHaveProperty('reason');
    });
  });
});
