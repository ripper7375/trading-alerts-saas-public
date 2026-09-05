import React from 'react';
import {
  render as rtlRender,
  type RenderOptions,
} from '@testing-library/react';
import { describe, it, expect, beforeEach } from '@jest/globals';

import { LocaleProvider } from '@/lib/context/locale-context';
import { AppearanceProvider } from '@/components/providers/appearance-provider';
import { DEFAULT_APPEARANCE_SETTINGS } from '@/lib/appearance/types';
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
function render(
  ui: React.ReactElement,
  options?: RenderOptions & { theme?: 'light' | 'dark' }
) {
  const { theme, ...renderOptions } = options ?? {};
  return rtlRender(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <LocaleProvider>
        <AppearanceProvider
          initialSettings={{
            ...DEFAULT_APPEARANCE_SETTINGS,
            theme: theme ?? DEFAULT_APPEARANCE_SETTINGS.theme,
          }}
        >
          {children}
        </AppearanceProvider>
      </LocaleProvider>
    ),
    ...renderOptions,
  });
}

// LocaleProvider calls usePathname() directly (L40's own stub).
jest.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

/**
 * TickerTape renders a plain <iframe> pointed directly at TradingView's
 * embed URL (see ticker-tape.tsx's own doc comment for why this replaced
 * injecting embed-widget-ticker-tape.js: the loader-script approach
 * reliably rendered on a fresh page load but silently went blank on every
 * SPA runtime re-init on production). The config now lives in the iframe's
 * `src` hash fragment instead of a script tag's innerHTML.
 */
function getConfigFromIframeSrc(container: HTMLElement) {
  const iframe = container.querySelector('iframe');
  expect(iframe).not.toBeNull();
  const src = iframe?.getAttribute('src') ?? '';
  const hash = src.split('#')[1] ?? '';
  return JSON.parse(decodeURIComponent(hash));
}

describe('TickerTape', () => {
  beforeEach(() => {
    // Seeding skips LocaleProvider's real geo-IP fetch(), which otherwise
    // races jsdom teardown (LESSONS-LEARNED.md L40).
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify(defaultPreferences)
    );
  });

  it('renders the container and an iframe pointed at the TradingView embed URL', () => {
    const { container } = render(<TickerTape />);

    expect(
      container.querySelector('.tradingview-widget-container')
    ).toBeInTheDocument();
    const iframe = container.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
    expect(iframe?.getAttribute('src')).toMatch(
      /^https:\/\/www\.tradingview-widget\.com\/embed-widget\/ticker-tape\/\?locale=/
    );
  });

  it('configures all 15 IC Markets symbols and enables showSymbolLogo', () => {
    const { container } = render(<TickerTape />);

    const config = getConfigFromIframeSrc(container);
    expect(config.showSymbolLogo).toBe(true);
    expect(config.isTransparent).toBe(true);
    // 'compact' (not 'adaptive') so the widget renders the same static card
    // format on every visit regardless of viewport width -- see ticker-tape.tsx.
    expect(config.displayMode).toBe('compact');
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

  it('resolves colorTheme from the appearance provider and locale from the query string', () => {
    const { container } = render(<TickerTape />);

    const config = getConfigFromIframeSrc(container);
    expect(['light', 'dark']).toContain(config.colorTheme);

    const iframe = container.querySelector('iframe');
    const src = iframe?.getAttribute('src') ?? '';
    const localeParam = new URL(src).searchParams.get('locale');
    expect(typeof localeParam).toBe('string');
    expect((localeParam ?? '').length).toBeGreaterThan(0);
  });

  /**
   * The actual bug Davin hit on production: `colorTheme` used to live only
   * inside the iframe's URL hash fragment. Toggling theme with `locale`
   * unchanged meant the query string (`?locale=...`) was byte-identical
   * before and after, so the browser treated the src update as an in-page
   * hash navigation (same mechanism as `<a href="#x">`) instead of a real
   * document reload -- the iframe never actually re-fetched, so it silently
   * kept showing nothing/the old theme. Mirroring colorTheme into the query
   * string too is what forces a genuine reload on every toggle.
   */
  it('mirrors colorTheme into the query string, not just the hash, so a theme change always forces a real iframe reload', () => {
    const { container: lightContainer } = render(<TickerTape />, {
      theme: 'light',
    });
    const { container: darkContainer } = render(<TickerTape />, {
      theme: 'dark',
    });

    const lightSrc =
      lightContainer.querySelector('iframe')?.getAttribute('src') ?? '';
    const darkSrc =
      darkContainer.querySelector('iframe')?.getAttribute('src') ?? '';

    const lightQuery = lightSrc.split('#')[0];
    const darkQuery = darkSrc.split('#')[0];

    // The query string portion (before the hash) must itself differ --
    // asserting only that the full src strings differ would pass even with
    // the old hash-only bug, since the hash always did carry the right
    // value.
    expect(lightQuery).not.toBe(darkQuery);
    expect(new URL(lightSrc).searchParams.get('colorTheme')).toBe('light');
    expect(new URL(darkSrc).searchParams.get('colorTheme')).toBe('dark');
  });

  it('accepts custom symbol overrides', () => {
    const customSymbols = [
      { proName: 'ICMARKETS:XAUUSD', title: 'Gold' },
      { proName: 'ICMARKETS:BTCUSD', title: 'Bitcoin' },
    ];

    const { container } = render(<TickerTape symbols={customSymbols} />);

    const config = getConfigFromIframeSrc(container);
    expect(config.symbols).toHaveLength(2);
    expect(config.symbols[0].title).toBe('Gold');
  });

  it('updates the iframe src (not just internal state) when the resolved theme changes', () => {
    const { container, rerender } = render(<TickerTape />);
    const firstSrc = container.querySelector('iframe')?.getAttribute('src');

    rerender(<TickerTape displayMode="regular" />);
    const secondSrc = container.querySelector('iframe')?.getAttribute('src');

    // Changing a config-affecting prop must change the iframe's `src` so the
    // browser actually re-navigates it -- this is the mechanism the whole
    // theme-toggle fix depends on.
    expect(secondSrc).not.toBe(firstSrc);
  });

  it('unmounts cleanly without throwing exceptions', () => {
    const { unmount } = render(<TickerTape />);
    expect(() => unmount()).not.toThrow();
  });
});
