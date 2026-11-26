/**
 * Feature truth (M1.0, decision Q3): the web pages claim only what the product
 * does today. No Data Export, no Priority Support, no e-mail/push/SMS alerts
 * (alerts are in-app), no Market Comments feed (Stack E is not built), and the
 * AI Analyst only where it is enabled for everybody.
 */
import { render, screen } from '@testing-library/react';

import PricingPage from '@/app/(marketing)/pricing/page';
import PrivacySettingsPage from '@/app/settings/privacy/page';
import { LandingPricing } from '@/components/landing/landing-pricing';
import { TierComparison } from '@/components/pricing/tier-comparison';

jest.mock('@/lib/context/locale-context', () => ({
  useLocale: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    formatCurrency: (usd: number) => `$${usd.toFixed(2)}`,
    currency: 'USD',
    language: 'en-US',
  }),
}));

jest.mock('@/lib/hooks/useAffiliateConfig', () => ({
  useAffiliateConfig: () => ({
    discountPercent: 20,
    regularPrice: 30,
    annualPrice: 300,
    annualSavingsPercent: 17,
    calculateDiscountedPrice: (price: number) => price * 0.8,
  }),
}));

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const FALSE_CLAIMS = [
  /data export/i,
  /priority support/i,
  /email\/push/i,
  /market comments/i,
];
const AI_CLAIMS = [/AI Analyst/i, /AI Token/i];

const page = (): string => document.body.textContent ?? '';

describe('TierComparison', () => {
  it('claims no feature that does not exist', () => {
    render(<TierComparison />);

    for (const claim of [...FALSE_CLAIMS, ...AI_CLAIMS]) {
      expect(page()).not.toMatch(claim);
    }
    expect(page()).toContain('In-App Alert Notifications');
    expect(page()).toContain('Alerts & multi-timeframe visualization');
  });

  it('shows the AI Analyst rows when the analyst is enabled', () => {
    render(<TierComparison aiAnalystEnabled />);

    expect(screen.getByText('Interactive AI Analyst')).toBeInTheDocument();
    expect(screen.getByText('Monthly AI Token Quota')).toBeInTheDocument();
    expect(
      screen.getByText('Interactive AI Analyst (500k Tokens/Mo)')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Read-Only AI Analyst (Chat Locked)')
    ).toBeInTheDocument();
    for (const claim of FALSE_CLAIMS) expect(page()).not.toMatch(claim);
  });
});

describe('/pricing', () => {
  const KEYS = ['REPLY_ENABLED', 'REPLY_ALLOWED_USER_IDS'] as const;
  const saved = KEYS.map((key) => [key, process.env[key]] as const);

  beforeEach(() => {
    for (const key of KEYS) delete process.env[key];
  });

  afterAll(() => {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('hides the AI Analyst while the flag is off', () => {
    render(<PricingPage />);
    expect(page()).not.toMatch(/AI Analyst/);
  });

  it('keeps it hidden during the staging allow-list', () => {
    process.env['REPLY_ENABLED'] = 'true';
    process.env['REPLY_ALLOWED_USER_IDS'] = 'user-1';
    render(<PricingPage />);
    expect(page()).not.toMatch(/AI Analyst/);
  });

  it('shows it once the analyst is on for everybody', () => {
    process.env['REPLY_ENABLED'] = 'true';
    render(<PricingPage />);
    expect(screen.getByText('Interactive AI Analyst')).toBeInTheDocument();
  });
});

describe('landing pricing', () => {
  it('states the real alert limits', () => {
    render(<LandingPricing />);

    expect(page()).not.toContain('5 Standard Alert Rules');
    expect(page()).not.toMatch(/unlimited/i);
    expect(page()).toContain('0 Active Alerts (PRO Exclusive)');
    expect(page()).toContain('Up to 100 Sub-500ms Price Breach Alerts');
  });
});

describe('privacy settings', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as never;
  });

  it('asks the trader to e-mail for a copy of their data', () => {
    render(<PrivacySettingsPage />);

    expect(
      screen.getByRole('link', { name: /Email us to request your data/ })
    ).toHaveAttribute(
      'href',
      'mailto:privacy@davintrade.app?subject=Data%20Export%20Request'
    );
    expect(
      screen.queryByRole('button', { name: /Request Data Export/ })
    ).not.toBeInTheDocument();
    expect(page()).not.toMatch(/download link/i);
  });
});
