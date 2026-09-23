/**
 * Affiliate-facing minimum payout (DECISION-LOG F83, spec §8A.2)
 *
 * The admin-editable minimum payout reaches the register, dashboard and
 * resources pages through useAffiliateConfig().minimumPayoutUsd — no page
 * reads AFFILIATE_CONFIG.MINIMUM_PAYOUT or a literal 50 any more. A mocked
 * minimum of 75 must render as $75 on all three.
 */

import { render as rtlRender, screen } from '@testing-library/react';
import React from 'react';

import AffiliateDashboardPage from '@/app/affiliate/dashboard/page';
import AffiliateResourcesPage from '@/app/affiliate/dashboard/resources/page';
import AffiliateRegisterPage from '@/app/affiliate/register/page';
import { LocaleProvider } from '@/lib/context/locale-context';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/locale-resolver';

jest.mock('@/lib/hooks/useAffiliateConfig', () => ({
  useAffiliateConfig: () => ({
    config: undefined,
    discountPercent: 20,
    commissionPercent: 25,
    codesPerMonth: 15,
    regularPrice: 29,
    threeDayPrice: 1.99,
    minimumPayoutUsd: 75,
    calculateDiscountedPrice: (p: number) => p * 0.8,
    calculateCommissionAmount: (p: number) => p * 0.8 * 0.25,
    calculateDiscountAmount: (p: number) => p * 0.2,
    isLoading: false,
    error: undefined,
  }),
}));

jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 'user-1', role: 'USER', isAffiliate: false } },
    status: 'authenticated',
  }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/affiliate/dashboard',
}));

function render(ui: React.ReactElement) {
  return rtlRender(ui, { wrapper: LocaleProvider });
}

describe('affiliate pages show the admin-set minimum payout ($75)', () => {
  beforeEach(() => {
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify({
        countryCode: 'US',
        language: 'en-US',
        timezone: 'America/New_York',
        dateFormat: 'MDY',
        timeFormat: '12h',
        currency: 'USD',
      })
    );
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.startsWith('/api/affiliate/dashboard/stats')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            activeCodes: 3,
            usedCodes: 2,
            expiredCodes: 0,
            totalEarnings: 120,
            pendingBalance: 40,
            paidBalance: 80,
            conversionRate: 40,
          }),
        } as Response);
      }
      if (url.startsWith('/api/affiliate/dashboard/resources')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ codes: [], assets: [] }),
        } as Response);
      }
      return new Promise<Response>(() => {});
    }) as unknown as typeof fetch;
  });

  it('register page: terms consent and benefits list', async () => {
    render(<AffiliateRegisterPage />);

    expect(
      await screen.findByText(
        /payouts are processed monthly for balances over \$75\./
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('- Monthly automated payouts for balances over $75')
    ).toBeInTheDocument();
    expect(screen.queryByText(/over \$50/)).not.toBeInTheDocument();
    // commission % goes through the same fixed-key + placeholder path
    expect(
      screen.getByText(/earn 25% commission on referrals/)
    ).toBeInTheDocument();
  });

  it('dashboard page: monthly payout line', async () => {
    render(<AffiliateDashboardPage />);

    expect(
      await screen.findByText(
        /Payouts are processed monthly for balances over \$75/
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/balances over \$50/)).not.toBeInTheDocument();
  });

  it('resources page: minimum payout FAQ', async () => {
    render(<AffiliateResourcesPage />);

    expect(
      await screen.findByText(/Balances need to reach \$75/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/reach \$50/)).not.toBeInTheDocument();
    // D8 (pre-session, spec §8A.5): commission % and codes/month also come
    // from the hook, not the deprecated AFFILIATE_CONFIG constants.
    expect(screen.getByText(/You earn 25% of net revenue/)).toBeInTheDocument();
    expect(screen.getByText(/Up to 15 new codes/)).toBeInTheDocument();
  });
});
