/**
 * @jest-environment node
 */
/**
 * Unit Tests: NextAuth `redirect` callback (open-redirect guard)
 * Tests authOptions.callbacks.redirect in lib/auth/auth-options.ts
 *
 * The callback runs after sign-in and OAuth with a caller-influenced
 * `callbackUrl`. It must only ever return a destination on this site.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// The real Prisma client is not needed to read the callback.
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {},
}));

import { authOptions } from '@/lib/auth/auth-options';

const BASE = 'https://davintrade.app';

const ENV_KEYS = [
  'NODE_ENV',
  'VERCEL_ENV',
  'VERCEL_URL',
  'VERCEL_BRANCH_URL',
] as const;

type EnvKey = (typeof ENV_KEYS)[number];

function setEnv(key: EnvKey, value: string | undefined): void {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, key);
  } else {
    Reflect.set(process.env, key, value);
  }
}

async function redirect(url: string, baseUrl: string = BASE): Promise<string> {
  const callback = authOptions.callbacks?.redirect;
  if (!callback) {
    throw new Error('authOptions.callbacks.redirect is not configured');
  }
  return callback({ url, baseUrl });
}

describe('authOptions.callbacks.redirect', () => {
  const saved = new Map<EnvKey, string | undefined>();

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved.set(key, process.env[key]);
    }
    // A production deployment unless a test says otherwise
    setEnv('NODE_ENV', 'production');
    setEnv('VERCEL_ENV', 'production');
    setEnv('VERCEL_URL', undefined);
    setEnv('VERCEL_BRANCH_URL', undefined);
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      setEnv(key, saved.get(key));
    }
  });

  describe('relative paths', () => {
    it.each([
      '/login?callbackUrl=%2Fdashboard',
      '/verify-2fa',
      '/dashboard',
      '/',
    ])('allows %s and resolves it against baseUrl', async (path) => {
      await expect(redirect(path)).resolves.toBe(`${BASE}${path}`);
    });

    it.each([
      ['//evil.com', 'protocol-relative'],
      ['//evil.com/dashboard', 'protocol-relative with a path'],
      ['/\\evil.com', 'backslash after the slash'],
      ['/dashboard\\..\\evil', 'backslash inside the path'],
    ])('rejects %s (%s)', async (url) => {
      await expect(redirect(url)).resolves.toBe(BASE);
    });
  });

  describe('absolute URLs', () => {
    it('allows the exact baseUrl origin', async () => {
      await expect(redirect(`${BASE}/dashboard?tab=1`)).resolves.toBe(
        `${BASE}/dashboard?tab=1`
      );
    });

    it('allows www when baseUrl is the apex host', async () => {
      await expect(
        redirect('https://www.davintrade.app/dashboard')
      ).resolves.toBe('https://www.davintrade.app/dashboard');
    });

    it('allows the apex host when baseUrl is www', async () => {
      await expect(
        redirect(
          'https://davintrade.app/dashboard',
          'https://www.davintrade.app'
        )
      ).resolves.toBe('https://davintrade.app/dashboard');
    });

    it.each([
      ['https://davintrade.app.evil.com/dashboard', 'suffix spoof'],
      ['https://evil-davintrade.app/dashboard', 'prefix spoof'],
      ['https://davintrade.app@evil.com/dashboard', 'userinfo trick'],
      ['https://evil.com/https://davintrade.app', 'baseUrl inside the path'],
      ['https://sub.davintrade.app/dashboard', 'sibling subdomain'],
      ['http://davintrade.app/dashboard', 'scheme downgrade'],
      ['http://www.davintrade.app/dashboard', 'scheme downgrade on www'],
      ['https://www.davintrade.app:8443/dashboard', 'www on another port'],
      ['https://davintrade.app:8443/dashboard', 'apex on another port'],
      ['https://evil.com', 'unrelated host'],
      ['javascript:alert(1)', 'javascript: URL'],
      ['data:text/html,<script>alert(1)</script>', 'data: URL'],
    ])('rejects %s (%s)', async (url) => {
      await expect(redirect(url)).resolves.toBe(BASE);
    });

    it.each(['not a url', '', 'dashboard'])(
      'falls back to baseUrl for the malformed value %p',
      async (url) => {
        await expect(redirect(url)).resolves.toBe(BASE);
      }
    );
  });

  describe('*.vercel.app hosts', () => {
    it('rejects an arbitrary *.vercel.app host', async () => {
      await expect(redirect('https://evil-phishing.vercel.app')).resolves.toBe(
        BASE
      );
    });

    it('rejects an arbitrary *.vercel.app host on a preview deployment', async () => {
      setEnv('VERCEL_ENV', 'preview');
      setEnv('VERCEL_URL', 'trading-alerts-abc123.vercel.app');

      await expect(
        redirect('https://evil-phishing.vercel.app/dashboard')
      ).resolves.toBe(BASE);
    });

    it('allows VERCEL_URL and VERCEL_BRANCH_URL exactly, on a preview deployment', async () => {
      setEnv('VERCEL_ENV', 'preview');
      setEnv('VERCEL_URL', 'trading-alerts-abc123.vercel.app');
      setEnv('VERCEL_BRANCH_URL', 'trading-alerts-git-feature.vercel.app');

      await expect(
        redirect('https://trading-alerts-abc123.vercel.app/dashboard')
      ).resolves.toBe('https://trading-alerts-abc123.vercel.app/dashboard');
      await expect(
        redirect('https://trading-alerts-git-feature.vercel.app/dashboard')
      ).resolves.toBe(
        'https://trading-alerts-git-feature.vercel.app/dashboard'
      );
    });

    it('rejects the preview host over http, and as a suffix or prefix', async () => {
      setEnv('VERCEL_ENV', 'preview');
      setEnv('VERCEL_URL', 'trading-alerts-abc123.vercel.app');

      await expect(
        redirect('http://trading-alerts-abc123.vercel.app/dashboard')
      ).resolves.toBe(BASE);
      await expect(
        redirect('https://trading-alerts-abc123.vercel.app.evil.com/')
      ).resolves.toBe(BASE);
      await expect(
        redirect('https://x-trading-alerts-abc123.vercel.app/')
      ).resolves.toBe(BASE);
    });

    it.each(['production', 'development', undefined])(
      'rejects VERCEL_URL when VERCEL_ENV is %p',
      async (vercelEnv) => {
        setEnv('VERCEL_ENV', vercelEnv);
        setEnv('VERCEL_URL', 'trading-alerts-abc123.vercel.app');
        setEnv('VERCEL_BRANCH_URL', 'trading-alerts-git-feature.vercel.app');

        await expect(
          redirect('https://trading-alerts-abc123.vercel.app/dashboard')
        ).resolves.toBe(BASE);
        await expect(
          redirect('https://trading-alerts-git-feature.vercel.app/dashboard')
        ).resolves.toBe(BASE);
      }
    );
  });

  describe('localhost', () => {
    it.each([
      'http://localhost:3000/callback',
      'http://127.0.0.1:3000/callback',
      'https://localhost/callback',
    ])('rejects %s when NODE_ENV is production', async (url) => {
      setEnv('NODE_ENV', 'production');

      await expect(redirect(url)).resolves.toBe(BASE);
    });

    it.each(['development', 'test'])(
      'allows localhost and 127.0.0.1 when NODE_ENV is %s',
      async (nodeEnv) => {
        setEnv('NODE_ENV', nodeEnv);

        await expect(redirect('http://localhost:3001/callback')).resolves.toBe(
          'http://localhost:3001/callback'
        );
        await expect(redirect('http://127.0.0.1:3000/callback')).resolves.toBe(
          'http://127.0.0.1:3000/callback'
        );
      }
    );

    it('allows localhost when NODE_ENV is unset', async () => {
      setEnv('NODE_ENV', undefined);

      await expect(redirect('http://localhost:3000/callback')).resolves.toBe(
        'http://localhost:3000/callback'
      );
    });

    it('still refuses a non-http(s) scheme on localhost outside production', async () => {
      setEnv('NODE_ENV', 'development');

      await expect(
        redirect('javascript://localhost/%0Aalert(1)')
      ).resolves.toBe(BASE);
    });

    it('does not treat a look-alike host as localhost', async () => {
      setEnv('NODE_ENV', 'development');

      await expect(
        redirect('http://localhost.evil.com/callback')
      ).resolves.toBe(BASE);
      await expect(
        redirect('http://127.0.0.1.evil.com/callback')
      ).resolves.toBe(BASE);
    });
  });
});
