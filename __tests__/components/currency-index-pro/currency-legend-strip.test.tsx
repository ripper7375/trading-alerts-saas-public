/**
 * CurrencyLegendStrip -- the per-currency show/hide toggles under the
 * /pro/currency-index chart, and the detail-modal entry point beside them.
 */
import React from 'react';
import {
  fireEvent,
  render as rtlRender,
  screen,
  within,
} from '@testing-library/react';
import { describe, it, expect, beforeEach } from '@jest/globals';

import { LocaleProvider } from '@/lib/context/locale-context';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
} from '@/lib/i18n/locale-resolver';
import type { CurrencyCode } from '@/lib/currency-index-pro/pairs';
import type { CurrencyIndexChartData } from '@/components/currency-index-pro/hooks/use-currency-index-chart';

// 'jest' deliberately not imported from @jest/globals (hoisted factories).
jest.mock('next/navigation', () => ({
  usePathname: () => '/pro/currency-index',
}));
jest.mock('@/components/providers/appearance-provider', () => ({
  useChartAppearance: () => ({
    resolvedTheme: 'dark',
    gridOpacityDecimal: 0.1,
  }),
}));

import { CurrencyLegendStrip } from '@/components/currency-index-pro/chart/currency-legend-strip';

const data: CurrencyIndexChartData = {
  timeframe: 'M15',
  serverTime: 0,
  todaySessionOpen: null,
  corridor: null,
  highImpactNews: [],
  series: {
    USDX: [{ barTime: 1000, changePct: 0.25 }],
    JPYX: [{ barTime: 1000, changePct: -0.4 }],
  },
};

function renderStrip(hidden: CurrencyCode[] = []) {
  const handlers = {
    onSelectCurrency: jest.fn(),
    onToggleCurrency: jest.fn(),
    onShowAll: jest.fn(),
    onHideAll: jest.fn(),
  };
  rtlRender(
    <CurrencyLegendStrip
      data={data}
      hiddenCurrencies={new Set(hidden)}
      {...handlers}
    />,
    {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <LocaleProvider>{children}</LocaleProvider>
      ),
    }
  );
  return handlers;
}

const toggle = (currency: string) =>
  screen.getByRole('button', { name: `${currency} line` });

describe('CurrencyLegendStrip', () => {
  beforeEach(() => {
    // Seeding skips LocaleProvider's real geo-IP fetch() (L40).
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify(defaultPreferences)
    );
  });

  it('gives each of the 8 currencies a pressed show/hide toggle by default', () => {
    renderStrip();
    const group = screen.getByRole('group', { name: 'Currency lines' });
    for (const c of ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD']) {
      const button = within(group).getByRole('button', { name: `${c} line` });
      expect(button).toHaveAttribute('aria-pressed', 'true');
      expect(button).toHaveAttribute('title', `Hide ${c} line`);
    }
  });

  it('marks a hidden currency as not pressed, and keeps its value readable', () => {
    renderStrip(['JPY']);
    expect(toggle('JPY')).toHaveAttribute('aria-pressed', 'false');
    expect(toggle('JPY')).toHaveAttribute('title', 'Show JPY line');
    expect(toggle('USD')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('-0.40%')).toBeInTheDocument();
  });

  it('toggles the line without opening the detail modal', () => {
    const handlers = renderStrip();
    fireEvent.click(toggle('EUR'));
    expect(handlers.onToggleCurrency).toHaveBeenCalledWith('EUR');
    expect(handlers.onSelectCurrency).not.toHaveBeenCalled();
  });

  it('still opens the HRMA/SMMA detail from the rest of the chip, hidden or not', () => {
    const handlers = renderStrip(['USD']);
    fireEvent.click(screen.getByRole('button', { name: /USD\s*\+0\.25%/ }));
    expect(handlers.onSelectCurrency).toHaveBeenCalledWith('USD');
    expect(handlers.onToggleCurrency).not.toHaveBeenCalled();
  });

  it('offers Show all and Hide all, each disabled when it would do nothing', () => {
    const allShown = renderStrip();
    expect(screen.getByRole('button', { name: 'Show all' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Hide all' }));
    expect(allShown.onHideAll).toHaveBeenCalledTimes(1);
  });

  it('enables Show all once any line is hidden, and disables Hide all when all are', () => {
    const handlers = renderStrip([
      'USD',
      'EUR',
      'GBP',
      'JPY',
      'AUD',
      'CAD',
      'CHF',
      'NZD',
    ]);
    expect(screen.getByRole('button', { name: 'Hide all' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Show all' }));
    expect(handlers.onShowAll).toHaveBeenCalledTimes(1);
  });
});
