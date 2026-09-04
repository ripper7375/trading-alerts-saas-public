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
import { EconomicCalendarWidget } from '@/components/calendar/economic-calendar-widget';

// EconomicCalendarWidget calls useChartAppearance() (needs AppearanceProvider)
// and useLocale() (needs LocaleProvider) -- same shadow-render pattern as
// __tests__/components/charts/trading-chart.test.tsx (LESSONS-LEARNED.md L40).
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
  usePathname: () => '/econ-news',
}));

describe('EconomicCalendarWidget', () => {
  beforeEach(() => {
    // Seeding skips LocaleProvider's real geo-IP fetch(), which otherwise
    // races jsdom teardown (LESSONS-LEARNED.md L40).
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify(defaultPreferences)
    );
  });

  it('renders the widget container and TradingView attribution', () => {
    const { container } = render(<EconomicCalendarWidget height={600} />);

    expect(
      container.querySelector('.tradingview-widget-container')
    ).toBeInTheDocument();
    expect(
      container.querySelector('.tradingview-widget-copyright')
    ).toBeInTheDocument();
    expect(
      container.querySelector(
        'script[src="https://s3.tradingview.com/external-embedding/embed-widget-events.js"]'
      )
    ).toBeInTheDocument();
  });

  it('applies the requested importance and country filters to the embed config', () => {
    const { container } = render(
      <EconomicCalendarWidget
        height={600}
        importanceFilter="1"
        countryFilter="us,eu"
      />
    );

    const script = container.querySelector(
      'script[src="https://s3.tradingview.com/external-embedding/embed-widget-events.js"]'
    );
    const config = JSON.parse(script?.innerHTML ?? '{}');
    expect(config.importanceFilter).toBe('1');
    expect(config.countryFilter).toBe('us,eu');
  });

  it('unmounts without errors', () => {
    const { unmount } = render(<EconomicCalendarWidget height={600} />);
    expect(() => unmount()).not.toThrow();
  });
});
