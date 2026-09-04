import React from 'react';
import {
  render as rtlRender,
  type RenderOptions,
} from '@testing-library/react';
import { describe, it, expect, beforeEach } from '@jest/globals';

import { LocaleProvider } from '@/lib/context/locale-context';
import { AppearanceProvider } from '@/components/providers/appearance-provider';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
} from '@/lib/i18n/locale-resolver';
import {
  TickerTape,
  DEFAULT_TICKER_SYMBOLS,
} from '@/components/landing/ticker-tape';

// TickerTape calls useChartAppearance() (needs AppearanceProvider) and
// useLocale() (needs LocaleProvider) -- same shadow-render pattern as
// __tests__/components/economic-calendar-widget.test.tsx (LESSONS-LEARNED.md L40).
function render(ui: React.ReactElement, options?: RenderOptions) {
  return rtlRender(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <LocaleProvider>
        <AppearanceProvider>{children}</AppearanceProvider>
      </LocaleProvider>
    ),
    ...options,
  });
}

// LocaleProvider calls usePathname() directly (L40's own stub).
jest.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

describe('TickerTape', () => {
  beforeEach(() => {
    // Seeding skips LocaleProvider's real geo-IP fetch(), which otherwise
    // races jsdom teardown (LESSONS-LEARNED.md L40).
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify(defaultPreferences)
    );
  });

  it('renders the container and mounts the TradingView ticker-tape script', () => {
    const { container } = render(<TickerTape />);

    expect(
      container.querySelector('.tradingview-widget-container')
    ).toBeInTheDocument();
    expect(
      container.querySelector(
        'script[src="https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js"]'
      )
    ).toBeInTheDocument();
  });

  it('configures all 15 IC Markets symbols and enables showSymbolLogo', () => {
    const { container } = render(<TickerTape />);

    const script = container.querySelector(
      'script[src="https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js"]'
    );
    expect(script).not.toBeNull();

    const config = JSON.parse(script?.innerHTML ?? '{}');
    expect(config.showSymbolLogo).toBe(true);
    expect(config.isTransparent).toBe(true);
    expect(config.displayMode).toBe('adaptive');
    expect(config.symbols).toHaveLength(15);
    expect(config.symbols).toEqual(DEFAULT_TICKER_SYMBOLS);
    expect(config.symbols[0].proName).toBe('ICMARKETS:AUDUSD');
    expect(config.symbols[1].proName).toBe('ICMARKETS:BTCUSD');
    expect(config.symbols[6].proName).toBe('ICMARKETS:USTEC');
    expect(config.symbols[6].title).toBe('NAS100');
  });

  it('keeps DEFAULT_TICKER_SYMBOLS alphabetized by display title', () => {
    const titles = DEFAULT_TICKER_SYMBOLS.map((s) => s.title);
    const sorted = [...titles].sort((a, b) => a.localeCompare(b));
    expect(titles).toEqual(sorted);
  });

  it('resolves colorTheme and locale from the app appearance/locale providers', () => {
    const { container } = render(<TickerTape />);

    const script = container.querySelector(
      'script[src="https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js"]'
    );
    const config = JSON.parse(script?.innerHTML ?? '{}');
    expect(['light', 'dark']).toContain(config.colorTheme);
    expect(typeof config.locale).toBe('string');
    expect(config.locale.length).toBeGreaterThan(0);
  });

  it('accepts custom symbol overrides', () => {
    const customSymbols = [
      { proName: 'ICMARKETS:XAUUSD', title: 'Gold' },
      { proName: 'ICMARKETS:BTCUSD', title: 'Bitcoin' },
    ];

    const { container } = render(<TickerTape symbols={customSymbols} />);

    const script = container.querySelector(
      'script[src="https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js"]'
    );
    const config = JSON.parse(script?.innerHTML ?? '{}');
    expect(config.symbols).toHaveLength(2);
    expect(config.symbols[0].title).toBe('Gold');
  });

  it('unmounts cleanly without throwing exceptions', () => {
    const { unmount } = render(<TickerTape />);
    expect(() => unmount()).not.toThrow();
  });
});
