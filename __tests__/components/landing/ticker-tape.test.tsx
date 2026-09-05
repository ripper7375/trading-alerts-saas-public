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
  __resetTickerTapeCacheForTests,
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
    // TickerTape's iframe src is cached at module scope, not component
    // state (see ticker-tape.tsx's doc comment for why) -- reset it so each
    // test starts from a clean "first ever page load" instead of inheriting
    // whatever an earlier test already cached.
    __resetTickerTapeCacheForTests();
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

  it('captures whichever theme is active on the very first render', () => {
    const { container: lightContainer } = render(<TickerTape />, {
      theme: 'light',
    });
    expect(getConfigFromIframeSrc(lightContainer).colorTheme).toBe('light');

    // A real "first ever load" only happens once per tab -- reset the cache
    // to simulate a second, independent tab rather than a remount within
    // the same one (see the next test for that case).
    __resetTickerTapeCacheForTests();

    const { container: darkContainer } = render(<TickerTape />, {
      theme: 'dark',
    });
    expect(getConfigFromIframeSrc(darkContainer).colorTheme).toBe('dark');
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

  /**
   * Deliberate design, not a gap: live-following a later theme/locale/prop
   * change was tried and reliably reproduced as unreliable against the real
   * embed (see ticker-tape.tsx's module doc comment for the full
   * investigation) -- slow to update, and at times stuck on the old theme,
   * even though every individual mechanism tested correctly in isolation.
   * The `src` is locked at mount and must stay that way regardless of what
   * changes afterward, so the widget never has to survive a runtime re-init
   * at all.
   */
  it('keeps the iframe src locked after a plain rerender, even when props change', () => {
    const { container, rerender } = render(<TickerTape />, {
      theme: 'light',
    });
    const firstSrc = container.querySelector('iframe')?.getAttribute('src');

    rerender(<TickerTape displayMode="regular" />);
    const secondSrc = container.querySelector('iframe')?.getAttribute('src');

    expect(secondSrc).toBe(firstSrc);
  });

  /**
   * The actual failure mode Davin hit: saving a theme change calls
   * cookies().set() inside a Server Action, which Next.js treats as cause to
   * refresh the route -- re-suspending the <Suspense> boundary this widget
   * lives in and remounting it as a genuinely new component instance, not
   * just a rerender of the existing one. A component-local useState lazy
   * initializer re-runs on that remount (proven live: the iframe's new src
   * carried the new theme); the module-level cache must not.
   */
  it('keeps the iframe src locked across a real unmount + remount within the same session', () => {
    const { container, unmount } = render(<TickerTape />, { theme: 'light' });
    const firstSrc = container.querySelector('iframe')?.getAttribute('src');
    unmount();

    // No __resetTickerTapeCacheForTests() here -- this is the whole point:
    // a fresh component instance, same tab/module session, dark theme now
    // active, must still resolve to the value cached before the remount.
    const { container: remounted } = render(<TickerTape />, {
      theme: 'dark',
    });
    const secondSrc = remounted.querySelector('iframe')?.getAttribute('src');

    expect(secondSrc).toBe(firstSrc);
    expect(getConfigFromIframeSrc(remounted).colorTheme).toBe('light');
  });

  it('unmounts cleanly without throwing exceptions', () => {
    const { unmount } = render(<TickerTape />);
    expect(() => unmount()).not.toThrow();
  });
});
