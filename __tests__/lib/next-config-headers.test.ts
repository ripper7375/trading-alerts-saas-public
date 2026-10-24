/**
 * @jest-environment node
 *
 * T2-e: the security headers `next.config.js` sends, in production and in
 * development (HDR-01, HDR-02, HDR-07).
 *
 * Production drops 'unsafe-eval' and the local development service
 * (localhost:3001) from the CSP; development keeps both (React's debugging
 * needs eval there). The legacy X-XSS-Protection header is sent in neither.
 */

type Header = { key: string; value: string };
type HeaderRule = { source: string; headers: Header[] };
type NextConfigFile = { headers: () => Promise<HeaderRule[]> };

const PRODUCTION_ONLY_BANS = [
  "'unsafe-eval'",
  'localhost:3001',
  'ws://localhost',
  'http://localhost',
];

async function headersFor(
  nodeEnv: 'production' | 'development'
): Promise<Map<string, string>> {
  const original = process.env['NODE_ENV'];
  Reflect.set(process.env, 'NODE_ENV', nodeEnv);
  try {
    let loaded: NextConfigFile | undefined;
    jest.isolateModules(() => {
      loaded = require('../../next.config.js') as NextConfigFile;
    });
    const rules = await (loaded as NextConfigFile).headers();
    const everywhere = rules.find((rule) => rule.source === '/:path*');
    if (!everywhere) throw new Error('no catch-all header rule');
    return new Map(everywhere.headers.map((h) => [h.key, h.value]));
  } finally {
    if (original === undefined) {
      Reflect.deleteProperty(process.env, 'NODE_ENV');
    } else {
      Reflect.set(process.env, 'NODE_ENV', original);
    }
  }
}

function directive(csp: string, name: string): string {
  const found = csp
    .split('; ')
    .find((part) => part === name || part.startsWith(`${name} `));
  if (!found) throw new Error(`CSP has no ${name} directive`);
  return found;
}

describe('security headers: production', () => {
  let headers: Map<string, string>;
  beforeAll(async () => {
    headers = await headersFor('production');
  });

  it('sends no X-XSS-Protection', () => {
    expect(headers.has('X-XSS-Protection')).toBe(false);
  });

  it('sends two-year HSTS with subdomains and preload', () => {
    expect(headers.get('Strict-Transport-Security')).toBe(
      'max-age=63072000; includeSubDomains; preload'
    );
  });

  it('has no unsafe-eval and no local development origin anywhere in the CSP', () => {
    const csp = headers.get('Content-Security-Policy') as string;
    for (const banned of PRODUCTION_ONLY_BANS) {
      expect(csp).not.toContain(banned);
    }
  });

  it('keeps unsafe-inline for scripts (Next.js bootstrap) and every third-party origin', () => {
    const csp = headers.get('Content-Security-Policy') as string;
    const script = directive(csp, 'script-src');

    expect(script).toBe(
      "script-src 'self' 'unsafe-inline' https://js.stripe.com https://checkout.stripe.com https://s3.tradingview.com https://challenges.cloudflare.com"
    );
    const connect = directive(csp, 'connect-src');
    for (const origin of [
      'https://api.stripe.com',
      'https://operation-service-production.up.railway.app',
      'wss://operation-service-production.up.railway.app',
      'https://chat-api.davintrade.app',
      'wss://chat-api.davintrade.app',
      'https://*.vercel-analytics.com',
      'https://ipapi.co',
      'https://*.tradingview.com',
    ]) {
      expect(connect).toContain(origin);
    }
    expect(directive(csp, 'frame-src')).toContain('https://js.stripe.com');
    expect(directive(csp, 'frame-src')).toContain(
      'https://www.tradingview-widget.com'
    );
  });

  it('keeps the rest of the headers and the framing / object restrictions', () => {
    const csp = headers.get('Content-Security-Policy') as string;

    expect(headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('Referrer-Policy')).toBe(
      'strict-origin-when-cross-origin'
    );
    expect(headers.get('Permissions-Policy')).toContain('camera=()');
    expect(directive(csp, 'frame-ancestors')).toBe("frame-ancestors 'self'");
    expect(directive(csp, 'object-src')).toBe("object-src 'none'");
    expect(directive(csp, 'base-uri')).toBe("base-uri 'self'");
    expect(directive(csp, 'form-action')).toBe("form-action 'self'");
  });
});

describe('CODE-15: the Cloudflare Turnstile origin', () => {
  const ORIGIN = 'https://challenges.cloudflare.com';

  it.each(['production', 'development'] as const)(
    'is allowed to run its script and to be framed, in %s, and nowhere else',
    async (nodeEnv) => {
      const csp = (await headersFor(nodeEnv)).get(
        'Content-Security-Policy'
      ) as string;

      expect(directive(csp, 'script-src').split(' ')).toContain(ORIGIN);
      expect(directive(csp, 'frame-src').split(' ')).toContain(ORIGIN);
      for (const name of [
        'default-src',
        'style-src',
        'img-src',
        'font-src',
        'connect-src',
        'frame-ancestors',
        'form-action',
        'base-uri',
        'object-src',
      ]) {
        expect(directive(csp, name)).not.toContain('cloudflare.com');
      }
    }
  );

  it('opens neither directive wider than that origin (no wildcard)', async () => {
    const csp = (await headersFor('production')).get(
      'Content-Security-Policy'
    ) as string;

    expect(directive(csp, 'script-src')).not.toMatch(/\*\.cloudflare\.com/);
    expect(directive(csp, 'frame-src')).not.toMatch(/\*\.cloudflare\.com/);
    expect(directive(csp, 'frame-src')).toContain('https://js.stripe.com');
  });
});

describe('security headers: development', () => {
  let headers: Map<string, string>;
  beforeAll(async () => {
    headers = await headersFor('development');
  });

  it("keeps unsafe-eval for scripts (React's development debugging needs it)", () => {
    const csp = headers.get('Content-Security-Policy') as string;

    expect(directive(csp, 'script-src')).toBe(
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://checkout.stripe.com https://s3.tradingview.com https://challenges.cloudflare.com"
    );
  });

  it('keeps the local development service in connect-src', () => {
    const csp = headers.get('Content-Security-Policy') as string;
    const connect = directive(csp, 'connect-src');

    expect(connect).toContain('http://localhost:3001');
    expect(connect).toContain('ws://localhost:3001');
  });

  it('still sends no X-XSS-Protection and the same HSTS', () => {
    expect(headers.has('X-XSS-Protection')).toBe(false);
    expect(headers.get('Strict-Transport-Security')).toBe(
      'max-age=63072000; includeSubDomains; preload'
    );
  });
});

describe('the policies differ only where intended', () => {
  it('production equals development minus unsafe-eval and the localhost origins', async () => {
    const production = (await headersFor('production')).get(
      'Content-Security-Policy'
    ) as string;
    const development = (await headersFor('development')).get(
      'Content-Security-Policy'
    ) as string;

    const stripped = development
      .replace(" 'unsafe-eval'", '')
      .replace(' http://localhost:3001 ws://localhost:3001', '');

    expect(production).toBe(stripped);
    expect(production).not.toBe(development);
  });
});
