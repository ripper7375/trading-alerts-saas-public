/**
 * The landing page (T3-b): only the pricing section waits behind a Suspense
 * boundary (it reads `useSearchParams()` for `?ref=`); the ticker, the hero and
 * the features are in the first paint whatever the pricing section is doing.
 *
 * @module __tests__/pages/marketing/landing-page.test
 */

import { use } from 'react';
import { act, render, screen } from '@testing-library/react';

let mockPricingSuspended = false;
const mockForever = new Promise<never>(() => {});

jest.mock('@/components/landing/ticker-tape', () => ({
  TickerTape: () => <div data-testid="ticker" />,
}));
jest.mock('@/components/landing/landing-hero', () => ({
  LandingHero: () => <section data-testid="hero" />,
}));
jest.mock('@/components/landing/landing-features', () => ({
  LandingFeatures: () => <section data-testid="features" />,
}));
jest.mock('@/components/landing/landing-pricing', () => ({
  LandingPricing: () => {
    if (mockPricingSuspended) use(mockForever);
    return <section id="pricing" data-testid="pricing" />;
  },
}));

import LandingPage from '@/app/(marketing)/page';

beforeEach(() => {
  mockPricingSuspended = false;
});

/** Awaited, so React is not told that a suspended render went unawaited. */
async function renderLanding(): Promise<void> {
  await act(async () => {
    render(<LandingPage />);
  });
}

describe('the landing page', () => {
  it('renders every section when the pricing section is ready', async () => {
    await renderLanding();
    for (const id of ['ticker', 'hero', 'features', 'pricing']) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('shows the hero, the features and the ticker while pricing is still suspended', async () => {
    mockPricingSuspended = true;
    await renderLanding();

    expect(screen.getByTestId('ticker')).toBeInTheDocument();
    expect(screen.getByTestId('hero')).toBeInTheDocument();
    expect(screen.getByTestId('features')).toBeInTheDocument();
    expect(screen.queryByTestId('pricing')).toBeNull();
  });

  it('holds the pricing anchor and a section-sized placeholder meanwhile', async () => {
    mockPricingSuspended = true;
    await renderLanding();

    const fallback = document.querySelector('#pricing[aria-busy="true"]');
    expect(fallback).not.toBeNull();
    // Not the old full-screen spinner that covered the hero too.
    expect(fallback).not.toHaveClass('min-h-screen');
    expect(fallback).toHaveClass('min-h-[40rem]');
  });

  it('keeps the hero outside the placeholder', async () => {
    mockPricingSuspended = true;
    await renderLanding();
    const fallback = document.querySelector('#pricing[aria-busy="true"]');
    expect(fallback?.contains(screen.getByTestId('hero'))).toBe(false);
    expect(fallback?.contains(screen.getByTestId('features'))).toBe(false);
  });
});
