import React from 'react';
import {
  render as rtlRender,
  screen,
  act,
  type RenderOptions,
} from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import { LocaleProvider } from '@/lib/context/locale-context';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
} from '@/lib/i18n/locale-resolver';
import { ContainmentRateStrip } from '@/components/market-sessions/containment-rate-strip';

// ContainmentRateStrip calls useLocale() -- shadow-render wrapper per
// LESSONS-LEARNED.md L40.
function render(ui: React.ReactElement, options?: RenderOptions) {
  return rtlRender(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <LocaleProvider>{children}</LocaleProvider>
    ),
    ...options,
  });
}

jest.mock('next/navigation', () => ({
  usePathname: () => '/terminal',
}));

const originalFetch = global.fetch;

function mockRates(rates: Array<Record<string, unknown>>) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ rates }),
  }) as unknown as typeof fetch;
}

async function renderStrip() {
  const result = render(<ContainmentRateStrip />);
  await act(async () => {
    await Promise.resolve();
  });
  return result;
}

describe('ContainmentRateStrip', () => {
  beforeEach(() => {
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify(defaultPreferences)
    );
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    localStorage.clear();
    global.fetch = originalFetch;
  });

  it('renders nothing when there is no data yet', async () => {
    mockRates([]);
    const { container } = await renderStrip();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the request is refused', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 403 }) as unknown as typeof fetch;
    const { container } = await renderStrip();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when every row has a null containment_rate', async () => {
    // A source captured before it had an EDT Channel block, or a cycle that
    // simply did not populate the field -- must not fabricate a 0% reading.
    mockRates([
      {
        symbol: 'XAUUSD',
        timeframe: 'M15',
        source: 'fractal_edt',
        capturedAt: 1768392000,
        containmentRate: null,
        containmentCount: null,
        containmentN: null,
      },
    ]);
    const { container } = await renderStrip();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a real containment-rate row, rounded and humanized', async () => {
    mockRates([
      {
        symbol: 'XAUUSD',
        timeframe: 'M15',
        source: 'best_fit_a',
        capturedAt: 1768392000,
        containmentRate: 94.2,
        containmentCount: 47,
        containmentN: 50,
      },
    ]);
    await renderStrip();

    expect(screen.getByText('EDT Channel Containment')).toBeInTheDocument();
    expect(screen.getByText(/M15 · best fit a/)).toBeInTheDocument();
    expect(screen.getByText('94%')).toBeInTheDocument();
  });

  it('drops only the null rows, keeps the real ones', async () => {
    mockRates([
      {
        symbol: 'XAUUSD',
        timeframe: 'M5',
        source: 'cherry_a',
        capturedAt: 1768392000,
        containmentRate: null,
        containmentCount: null,
        containmentN: null,
      },
      {
        symbol: 'XAUUSD',
        timeframe: 'M15',
        source: 'cherry_b',
        capturedAt: 1768392000,
        containmentRate: 61.7,
        containmentCount: 30,
        containmentN: 50,
      },
    ]);
    await renderStrip();

    expect(screen.queryByText(/cherry a/)).not.toBeInTheDocument();
    expect(screen.getByText(/M15 · cherry b/)).toBeInTheDocument();
    expect(screen.getByText('62%')).toBeInTheDocument();
    // The M5 row was the one with a null rate -- confirm it is absent, not
    // just that its text happens not to match above.
    expect(screen.queryByText(/M5/)).not.toBeInTheDocument();
  });
});
