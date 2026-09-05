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

// TickerTape calls useLocale() (needs LocaleProvider). AppearanceProvider is
// wrapped too because the surrounding landing page mounts under it -- same
// shadow-render pattern as __tests__/components/economic-calendar-widget
// .test.tsx (LESSONS-LEARNED.md L40).
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
 * TickerTape mounts BOTH themes as stacked iframes and picks between them in
 * CSS (see ticker-tape.tsx's own doc comment for why re-theming a single
 * iframe at runtime does not work with this widget). Config for each lives
 * in that iframe's `src` hash fragment.
 */
function getIframe(container: HTMLElement, theme: 'light' | 'dark') {
  const iframe = container.querySelector(
    `iframe[data-ticker-theme="${theme}"]`
  );
  expect(iframe).not.toBeNull();
  return iframe as HTMLIFrameElement;
}

function getConfig(container: HTMLElement, theme: 'light' | 'dark') {
  const src = getIframe(container, theme).getAttribute('src') ?? '';
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
    // The resolved locale is cached at module scope, not in component state
    // (see ticker-tape.tsx) -- reset so each test starts from a clean "first
    // ever page load".
    __resetTickerTapeCacheForTests();
  });

  it('renders both a light and a dark iframe, each pointed at the TradingView embed URL', () => {
    const { container } = render(<TickerTape />);

    expect(
      container.querySelector('.tradingview-widget-container')
    ).toBeInTheDocument();
    expect(container.querySelectorAll('iframe')).toHaveLength(2);

    for (const theme of ['light', 'dark'] as const) {
      expect(getIframe(container, theme).getAttribute('src')).toMatch(
        /^https:\/\/www\.tradingview-widget\.com\/embed-widget\/ticker-tape\/\?locale=/
      );
    }
  });

  /**
   * The whole fix: the theme is chosen in CSS off the `.dark` class on
   * <html>, so flipping it never touches either iframe. If these two ever
   * stop being complementary, a theme toggle would show both or neither.
   */
  it('drives theme selection purely through complementary dark: opacity classes', () => {
    const { container } = render(<TickerTape />);

    const light = getIframe(container, 'light');
    const dark = getIframe(container, 'dark');

    expect(light.className).toContain('opacity-100');
    expect(light.className).toContain('dark:opacity-0');
    expect(dark.className).toContain('opacity-0');
    expect(dark.className).toContain('dark:opacity-100');
  });

  it('configures each iframe with its own colorTheme and nothing else differing', () => {
    const { container } = render(<TickerTape />);

    const lightConfig = getConfig(container, 'light');
    const darkConfig = getConfig(container, 'dark');

    expect(lightConfig.colorTheme).toBe('light');
    expect(darkConfig.colorTheme).toBe('dark');

    // Everything except colorTheme must match, so the two stacked iframes are
    // pixel-for-pixel interchangeable.
    const { colorTheme: _l, ...lightRest } = lightConfig;
    const { colorTheme: _d, ...darkRest } = darkConfig;
    expect(lightRest).toEqual(darkRest);
  });

  it('configures all 15 IC Markets symbols and enables showSymbolLogo', () => {
    const { container } = render(<TickerTape />);

    const config = getConfig(container, 'light');
    expect(config.showSymbolLogo).toBe(true);
    // Opaque on purpose: with isTransparent:true the widget paints no
    // background and depends on showing through, which rendered the dark
    // widget's light text over a white canvas in a real browser. Each widget
    // painting its own theme-matched background is what keeps the strip
    // readable in both modes -- see ticker-tape.tsx.
    expect(config.isTransparent).toBe(false);
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

  it('resolves locale into the query string', () => {
    const { container } = render(<TickerTape />);

    const src = getIframe(container, 'light').getAttribute('src') ?? '';
    const localeParam = new URL(src).searchParams.get('locale');
    expect(typeof localeParam).toBe('string');
    expect((localeParam ?? '').length).toBeGreaterThan(0);
  });

  it('accepts custom symbol overrides on both iframes', () => {
    const customSymbols = [
      { proName: 'ICMARKETS:XAUUSD', title: 'Gold' },
      { proName: 'ICMARKETS:BTCUSD', title: 'Bitcoin' },
    ];

    const { container } = render(<TickerTape symbols={customSymbols} />);

    for (const theme of ['light', 'dark'] as const) {
      const config = getConfig(container, theme);
      expect(config.symbols).toHaveLength(2);
      expect(config.symbols[0].title).toBe('Gold');
    }
  });

  /**
   * Both srcs must be byte-stable for the tab's lifetime. Saving a theme
   * change calls cookies().set() in a Server Action, which refreshes the
   * route; this widget is deliberately mounted outside the landing page's
   * Suspense boundary so that refresh shouldn't remount it, but even if
   * something does, re-navigating these iframes is exactly the unreliable
   * path this design exists to avoid.
   */
  it('keeps both iframe srcs identical across a rerender and a full remount', () => {
    const { container, rerender, unmount } = render(<TickerTape />, {
      theme: 'light',
    });
    const firstLight = getIframe(container, 'light').getAttribute('src');
    const firstDark = getIframe(container, 'dark').getAttribute('src');

    rerender(<TickerTape />);
    expect(getIframe(container, 'light').getAttribute('src')).toBe(firstLight);
    expect(getIframe(container, 'dark').getAttribute('src')).toBe(firstDark);

    unmount();

    // Fresh component instance, dark theme now active -- srcs must not move,
    // since theme is a CSS concern here, not a URL concern.
    const { container: remounted } = render(<TickerTape />, { theme: 'dark' });
    expect(getIframe(remounted, 'light').getAttribute('src')).toBe(firstLight);
    expect(getIframe(remounted, 'dark').getAttribute('src')).toBe(firstDark);
  });

  it('unmounts cleanly without throwing exceptions', () => {
    const { unmount } = render(<TickerTape />);
    expect(() => unmount()).not.toThrow();
  });
});
