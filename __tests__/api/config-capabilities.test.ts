/** @jest-environment node */
/**
 * Public GET /api/config/capabilities (M1.0): what the product can do today,
 * for davintrade.com. Only `live` capabilities may be advertised there, so
 * every status here has to be true of this codebase and its flags.
 */
import { GET } from '@/app/api/config/capabilities/route';

const KEYS = ['REPLY_ENABLED', 'REPLY_ALLOWED_USER_IDS'] as const;
const saved = KEYS.map((key) => [key, process.env[key]] as const);

interface Capability {
  status: 'live' | 'beta' | 'planned';
  available: boolean;
}

interface Body {
  schemaVersion: number;
  asOf: string;
  tiers: {
    symbols: string[];
    timeframes: string[];
    free: Record<string, unknown>;
    pro: Record<string, unknown>;
  };
  capabilities: Record<string, Capability>;
}

async function getBody(): Promise<{ response: Response; body: Body }> {
  const response = await GET();
  return { response, body: (await response.json()) as Body };
}

beforeEach(() => {
  for (const key of KEYS) delete process.env[key];
});

afterAll(() => {
  for (const [key, value] of saved) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('GET /api/config/capabilities', () => {
  it('reports the tier snapshot from the tier constants', async () => {
    const { response, body } = await getBody();

    expect(response.status).toBe(200);
    expect(body.schemaVersion).toBe(1);
    expect(new Date(body.asOf).toISOString()).toBe(body.asOf);
    expect(body.tiers).toEqual({
      symbols: ['XAUUSD'],
      timeframes: ['M5', 'M15'],
      free: { maxActiveAlerts: 0 },
      pro: { maxActiveAlerts: 100, trialDays: 7 },
    });
  });

  it('reports each capability while the Stack D flags are off', async () => {
    const { body } = await getBody();

    const live = { status: 'live', available: true };
    const planned = { status: 'planned', available: false };
    expect(body.capabilities).toEqual({
      interactiveAiAnalyst: planned,
      dualModelPatternConfluence: planned,
      priceBreachAlerts: live,
      multiTimeframeCharts: live,
      dataExport: planned,
      prioritySupport: planned,
    });
  });

  it('reports the AI analyst live only when enabled for everybody', async () => {
    process.env['REPLY_ENABLED'] = 'true';
    const { body } = await getBody();
    expect(body.capabilities['interactiveAiAnalyst']).toEqual({
      status: 'live',
      available: true,
    });
  });

  it.each(['user-1', ''])(
    'reports beta while the staging allow-list is set (%j)',
    async (list) => {
      process.env['REPLY_ENABLED'] = 'true';
      process.env['REPLY_ALLOWED_USER_IDS'] = list;
      const { body } = await getBody();
      expect(body.capabilities['interactiveAiAnalyst']).toEqual({
        status: 'beta',
        available: false,
      });
      expect(JSON.stringify(body)).not.toContain('user-1');
    }
  );

  it.each(['TRUE', '1', 'yes'])(
    'treats REPLY_ENABLED=%s as off',
    async (value) => {
      process.env['REPLY_ENABLED'] = value;
      const { body } = await getBody();
      expect(body.capabilities['interactiveAiAnalyst']?.status).toBe('planned');
    }
  );

  it('is cached for five minutes and names no environment variable', async () => {
    const { response, body } = await getBody();

    expect(response.headers.get('Cache-Control')).toBe(
      'public, s-maxage=300, stale-while-revalidate=60'
    );
    expect(JSON.stringify(body)).not.toMatch(/REPLY_|SECRET|postgres|redis/i);
  });
});
