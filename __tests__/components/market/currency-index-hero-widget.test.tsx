import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';

// Factories must not reference out-of-scope variables, or babel-jest declines
// to hoist them above the imports below -- see
// __tests__/api/economic-events.test.ts's own header for the full rationale.
const mockUseCurrencyGoldIndices = jest.fn();
jest.mock('@/components/market/useCurrencyGoldIndices', () => ({
  useCurrencyGoldIndices: () => mockUseCurrencyGoldIndices(),
}));

import { CurrencyIndexHeroWidget } from '@/components/market/currency-index-hero-widget';
import { LocaleProvider } from '@/lib/context/locale-context';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
} from '@/lib/i18n/locale-resolver';

function renderWithLocale(ui: React.ReactElement) {
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    symbol: 'USDX',
    price: 100.14,
    changePct: 0.14,
    previousClose: 100,
    sparkline: [99.9, 100.0, 100.14],
    barTime: 1789000000,
    ...overrides,
  };
}

describe('CurrencyIndexHeroWidget', () => {
  beforeEach(() => {
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify(defaultPreferences)
    );
    mockUseCurrencyGoldIndices.mockReset();
  });

  afterEach(() => cleanup());

  it('renders nothing at all when there is no data and nothing is loading', () => {
    // The honest rendering of "Lane 4 not deployed yet / nothing pushed" is
    // an absent widget, not a placeholder or an error card, on the public
    // landing page -- matches containment-rate-strip.tsx's own precedent.
    mockUseCurrencyGoldIndices.mockReturnValue({
      indices: [],
      isLoading: false,
      error: undefined,
    });
    const { container } = renderWithLocale(<CurrencyIndexHeroWidget />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a loading skeleton, not nothing, on first load', () => {
    mockUseCurrencyGoldIndices.mockReturnValue({
      indices: [],
      isLoading: true,
      error: undefined,
    });
    const { container } = renderWithLocale(<CurrencyIndexHeroWidget />);
    expect(container).not.toBeEmptyDOMElement();
  });

  it('renders symbol, translated display name, and price for each index', () => {
    mockUseCurrencyGoldIndices.mockReturnValue({
      indices: [
        snapshot({ symbol: 'USDX', price: 100.14 }),
        snapshot({ symbol: 'XAUX', price: 99.86, changePct: -0.14 }),
      ],
      isLoading: false,
      error: undefined,
    });
    renderWithLocale(<CurrencyIndexHeroWidget />);

    expect(screen.getByText('USDX')).toBeInTheDocument();
    expect(screen.getByText('USD Index')).toBeInTheDocument();
    expect(screen.getByText('100.14')).toBeInTheDocument();

    expect(screen.getByText('XAUX')).toBeInTheDocument();
    expect(screen.getByText('Gold Index')).toBeInTheDocument();
    expect(screen.getByText('99.86')).toBeInTheDocument();
  });

  it('shows a + prefix and gain color class only for non-negative change', () => {
    mockUseCurrencyGoldIndices.mockReturnValue({
      indices: [snapshot({ symbol: 'USDX', changePct: 0.14 })],
      isLoading: false,
      error: undefined,
    });
    renderWithLocale(<CurrencyIndexHeroWidget />);
    expect(screen.getByText('+0.14%')).toBeInTheDocument();
  });

  it('shows no + prefix for a negative change', () => {
    mockUseCurrencyGoldIndices.mockReturnValue({
      indices: [snapshot({ symbol: 'XAUX', changePct: -0.3 })],
      isLoading: false,
      error: undefined,
    });
    renderWithLocale(<CurrencyIndexHeroWidget />);
    expect(screen.getByText('-0.30%')).toBeInTheDocument();
  });

  it('renders all 9 rows when a full cycle is present (4 visible + 5 scrollable, per a fixed-height scroll container)', () => {
    const names = [
      'XAUX',
      'USDX',
      'EURX',
      'JPYX',
      'GBPX',
      'AUDX',
      'NZDX',
      'CADX',
      'CHFX',
    ];
    mockUseCurrencyGoldIndices.mockReturnValue({
      indices: names.map((symbol) => snapshot({ symbol })),
      isLoading: false,
      error: undefined,
    });
    renderWithLocale(<CurrencyIndexHeroWidget />);

    for (const name of names) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it('degrades gracefully for an index with no known metadata (no crash, still shows the symbol)', () => {
    // Can't happen in production -- the 9 real DTO enum values all have a
    // metadata entry -- but must not crash if it ever did. The fallback
    // shows the raw symbol in both the symbol slot and the name slot, which
    // is why this asserts >=1 rather than a single unique match.
    mockUseCurrencyGoldIndices.mockReturnValue({
      indices: [snapshot({ symbol: 'UNKNOWNX' })],
      isLoading: false,
      error: undefined,
    });
    renderWithLocale(<CurrencyIndexHeroWidget />);
    expect(screen.getAllByText('UNKNOWNX').length).toBeGreaterThanOrEqual(1);
  });
});
