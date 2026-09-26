/**
 * Annual PRO plan (2026-09-26): /pricing's Monthly/Annual toggle is priced
 * from SystemConfig (affiliate_base_price, affiliate_annual_price) and hands
 * the choice to /checkout; dLocal receipts name the annual plan.
 */
import { fireEvent, render, screen } from '@testing-library/react';

import { TierComparison } from '@/components/pricing/tier-comparison';
import { planDescription } from '@/lib/billing/dlocal-receipt';

let mockCurrency = 'USD';
jest.mock('@/lib/context/locale-context', () => ({
  useLocale: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    formatCurrency: (usd: number) => `$${usd.toFixed(2)}`,
    currency: mockCurrency,
    language: 'en-US',
  }),
}));

// SystemConfig values deliberately differ from the $29 / $290 defaults.
jest.mock('@/lib/hooks/useAffiliateConfig', () => ({
  useAffiliateConfig: () => ({
    regularPrice: 30,
    annualPrice: 300,
    annualSavingsPercent: 17,
  }),
}));

describe('annual plan on /pricing', () => {
  it('starts on monthly and links to the monthly checkout', () => {
    render(<TierComparison />);
    expect(screen.getByText('$30.00')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Upgrade to PRO Now/ })
    ).toHaveAttribute('href', '/checkout');
  });

  it('shows the SystemConfig annual price and preselects it at checkout', () => {
    render(<TierComparison />);
    fireEvent.click(screen.getByRole('radio', { name: /Annual Billing/ }));

    expect(screen.getByText('$25.00')).toBeInTheDocument(); // 300 / 12
    expect(screen.getByText('$300.00 billed once a year')).toBeInTheDocument();
    expect(screen.getByText('Save 17%')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Upgrade to PRO Now/ })
    ).toHaveAttribute('href', '/checkout?billing=yearly');
  });
});

describe('approximate local price note', () => {
  afterEach(() => {
    mockCurrency = 'USD';
  });

  it('is hidden when prices are shown in USD', () => {
    render(<TierComparison />);
    expect(screen.queryByText(/are approximate/)).not.toBeInTheDocument();
  });

  it('names the USD card charge for the chosen period', () => {
    mockCurrency = 'GBP';
    render(<TierComparison />);
    expect(screen.getByText(/Prices in GBP are approximate/)).toHaveTextContent(
      'charged in USD ($30.00 / month)'
    );

    fireEvent.click(screen.getByRole('radio', { name: /Annual Billing/ }));
    expect(screen.getByText(/Prices in GBP are approximate/)).toHaveTextContent(
      'charged in USD ($300.00 / year)'
    );
  });
});

describe('dLocal receipt plan names', () => {
  it('names each plan', () => {
    expect(planDescription('YEARLY')).toBe('Trading Alerts PRO - Annual');
    expect(planDescription('MONTHLY')).toBe('Trading Alerts PRO - Monthly');
    expect(planDescription('THREE_DAY')).toBe('Trading Alerts PRO - 3 Day');
  });
});
