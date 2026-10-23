/**
 * @jest-environment node
 *
 * CODE-03 (WS-1): the disbursement admin layout names the payout provider in
 * its header and sidebar. Outside development and test, when the provider is
 * not named (the monolith's intended production state: money-service owns
 * payouts), the layout must still render and say so, instead of throwing.
 */

import { renderToStaticMarkup } from 'react-dom/server';

const mockGetSession = jest.fn();
jest.mock('@/lib/auth/session', () => ({
  __esModule: true,
  getSession: () => mockGetSession(),
}));

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: { user: { findUnique: jest.fn() } },
}));

jest.mock('@/lib/disbursement/settings', () => ({
  __esModule: true,
  getDisbursementSettings: async () => ({ effectiveEnabled: true }),
}));

jest.mock('@/lib/i18n/server-locale', () => ({
  __esModule: true,
  getServerLanguage: async () => 'en-US',
}));

jest.mock('@/lib/i18n/get-dictionary', () => ({
  __esModule: true,
  getDictionary: () => ({}),
}));

jest.mock('next/navigation', () => ({
  __esModule: true,
  redirect: jest.fn(),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    require('react').createElement('a', { href }, children),
}));

import DisbursementLayout from '@/app/admin/disbursement/layout';

type EnvKey = 'NODE_ENV' | 'DISBURSEMENT_PROVIDER' | 'VERCEL_ENV';
const KEYS: EnvKey[] = ['NODE_ENV', 'DISBURSEMENT_PROVIDER', 'VERCEL_ENV'];

// NODE_ENV is typed read-only in Next; same pattern as redirect-callback.test.ts
function setEnv(key: EnvKey, value: string | undefined): void {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, key);
  } else {
    Reflect.set(process.env, key, value);
  }
}

async function renderLayout(): Promise<string> {
  const element = await DisbursementLayout({ children: null });
  return renderToStaticMarkup(element);
}

describe('app/admin/disbursement/layout — payout provider display (CODE-03)', () => {
  const saved = new Map<EnvKey, string | undefined>();

  beforeEach(() => {
    for (const key of KEYS) saved.set(key, process.env[key]);
    setEnv('VERCEL_ENV', undefined);
    mockGetSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', name: 'Admin' },
    });
  });

  afterEach(() => {
    for (const key of KEYS) setEnv(key, saved.get(key));
    mockGetSession.mockReset();
  });

  it('renders and says the provider is not configured in production when it is unset', async () => {
    setEnv('NODE_ENV', 'production');
    setEnv('DISBURSEMENT_PROVIDER', undefined);

    const html = await renderLayout();

    expect(html).toContain('UNCONFIGURED');
    expect(html).toContain('Not configured');
    expect(html).not.toContain('MOCK (testing)');
  });

  it('does not present MOCK as the provider in production when MOCK is named', async () => {
    setEnv('NODE_ENV', 'production');
    setEnv('DISBURSEMENT_PROVIDER', 'MOCK');

    const html = await renderLayout();

    expect(html).toContain('UNCONFIGURED');
    expect(html).not.toContain('MOCK (testing)');
  });

  it('shows Wise when it is configured in production', async () => {
    setEnv('NODE_ENV', 'production');
    setEnv('DISBURSEMENT_PROVIDER', 'WISE');

    const html = await renderLayout();

    expect(html).toContain('>WISE<');
    expect(html).not.toContain('UNCONFIGURED');
  });

  it('still shows MOCK (testing) in test when nothing is set', async () => {
    setEnv('NODE_ENV', 'test');
    setEnv('DISBURSEMENT_PROVIDER', undefined);

    const html = await renderLayout();

    expect(html).toContain('MOCK (testing)');
    expect(html).not.toContain('UNCONFIGURED');
  });
});
