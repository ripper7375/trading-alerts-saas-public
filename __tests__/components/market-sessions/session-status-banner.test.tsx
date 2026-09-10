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
import { SessionStatusBanner } from '@/components/market-sessions/session-status-banner';

// SessionStatusBanner calls useLocale() -- shadow-render wrapper per
// LESSONS-LEARNED.md L40.
function render(ui: React.ReactElement, options?: RenderOptions) {
  return rtlRender(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <LocaleProvider>{children}</LocaleProvider>
    ),
    ...options,
  });
}

// LocaleProvider calls usePathname() directly (L40's own stub).
jest.mock('next/navigation', () => ({
  usePathname: () => '/terminal',
}));

/**
 * The clock is pinned for every test. Without that, this suite's result
 * would depend on the wall-clock time the CI runner happened to start --
 * green on a Wednesday afternoon, red on a Saturday.
 */
function renderAt(iso: string) {
  jest.setSystemTime(new Date(iso));
  const result = render(<SessionStatusBanner />);
  // Flush the mount effect that performs the first computation.
  act(() => {
    jest.advanceTimersByTime(0);
  });
  return result;
}

/** No upcoming event: the news row must not render at all. */
function mockNoEvents() {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ events: [] }),
  }) as unknown as typeof fetch;
}

function mockEvent(overrides: Record<string, unknown> = {}) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      events: [
        {
          valueId: '1',
          eventId: '840010013',
          eventName: 'Non-Farm Employment Change',
          // 2026-01-14T13:30:00Z, 90 minutes after the pinned clock below.
          eventTime: 1768397400,
          currency: 'USD',
          countryCode: 'US',
          importance: 'HIGH',
          forecastValue: null,
          previousValue: 0.0,
          digits: 2,
          timeMode: 0,
          sourceUrl: null,
          ...overrides,
        },
      ],
    }),
  }) as unknown as typeof fetch;
}

describe('SessionStatusBanner', () => {
  beforeEach(() => {
    // Seeding skips LocaleProvider's real geo-IP fetch(), which otherwise
    // races jsdom teardown (LESSONS-LEARNED.md L40).
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify(defaultPreferences)
    );
    mockNoEvents();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    localStorage.clear();
  });

  it('headlines the active session while it trades', () => {
    // Wed 2026-01-14 12:00 UTC -> London 12:00 GMT, inside 08:00-17:00.
    renderAt('2026-01-14T12:00:00Z');

    expect(screen.getByText('GB London Session')).toBeInTheDocument();
    expect(screen.getByText('SESSION CLOSES IN')).toBeInTheDocument();
    // London closes 17:00 GMT, five hours out.
    expect(screen.getByText('05:00:00')).toBeInTheDocument();
  });

  it('headlines New York during the London/New York overlap', () => {
    // Wed 2026-01-14 15:00 UTC -> New York 10:00 EST, London 15:00 GMT.
    renderAt('2026-01-14T15:00:00Z');
    expect(screen.getByText('US New York Session')).toBeInTheDocument();
  });

  it('shows the weekend closure rather than a session', () => {
    // Sat 2026-01-17 01:00 UTC -> Tokyo 10:00 JST, which a naive clock
    // would render as an open Tokyo session.
    renderAt('2026-01-17T01:00:00Z');

    expect(screen.getByText('Market Closed')).toBeInTheDocument();
    expect(screen.getByText('MARKET REOPENS IN')).toBeInTheDocument();
    expect(screen.queryByText(/Session$/)).not.toBeInTheDocument();
  });

  it('counts the weekend reopen in days', () => {
    // Sat 2026-01-17 01:00 UTC -> reopen Sun 17:00 EST = Sun 22:00 UTC,
    // which is 1 day 21 hours out.
    renderAt('2026-01-17T01:00:00Z');
    expect(screen.getByText('1d 21:00:00')).toBeInTheDocument();
  });

  it('ticks the countdown down once a second', () => {
    renderAt('2026-01-14T12:00:00Z');
    expect(screen.getByText('05:00:00')).toBeInTheDocument();

    // advanceTimersByTime moves the mocked Date too, so it alone gets us to
    // 12:00:03. Calling setSystemTime as well would double-count the jump.
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(screen.getByText('04:59:57')).toBeInTheDocument();
  });

  it('re-renders across a session boundary without a reload', () => {
    // One second before the New York open (13:00 UTC = 08:00 EST).
    renderAt('2026-01-14T12:59:59Z');
    expect(screen.getByText('GB London Session')).toBeInTheDocument();

    // 12:59:59 + 2s = 13:00:01 UTC, one second past the 08:00 EST open.
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(screen.getByText('US New York Session')).toBeInTheDocument();
  });

  it('marks each centre open or closed for assistive tech', () => {
    renderAt('2026-01-14T12:00:00Z');

    expect(screen.getByLabelText('London: Open')).toBeInTheDocument();
    expect(screen.getByLabelText('Tokyo: Closed')).toBeInTheDocument();
    expect(screen.getByLabelText('Sydney: Closed')).toBeInTheDocument();
    expect(screen.getByLabelText('New York: Closed')).toBeInTheDocument();
  });

  it('clears its interval on unmount', () => {
    const { unmount } = renderAt('2026-01-14T12:00:00Z');
    expect(() => {
      unmount();
      jest.advanceTimersByTime(5000);
    }).not.toThrow();
  });
});

/**
 * The news row exists to replace seed-code's hardcoded countdown with a real
 * one. Its most important property is therefore what it does with NO data:
 * disappear, rather than render a placeholder counting down to nothing.
 */
describe('SessionStatusBanner — news row', () => {
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
  });

  /** Renders and flushes the hook's fetch, which resolves as a microtask. */
  async function renderWithEvents(iso: string) {
    jest.setSystemTime(new Date(iso));
    const result = render(<SessionStatusBanner />);
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    return result;
  }

  it('renders no news row when nothing is scheduled', async () => {
    mockNoEvents();
    await renderWithEvents('2026-01-14T12:00:00Z');
    expect(screen.queryByText(/UPCOMING HIGH IMPACT/)).not.toBeInTheDocument();
    // ...but the session half is unaffected
    expect(screen.getByText('GB London Session')).toBeInTheDocument();
  });

  it('renders no news row when the request is refused', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 403 }) as unknown as typeof fetch;
    await renderWithEvents('2026-01-14T12:00:00Z');
    expect(screen.queryByText(/UPCOMING HIGH IMPACT/)).not.toBeInTheDocument();
  });

  it('renders no news row when the request throws', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    await renderWithEvents('2026-01-14T12:00:00Z');
    expect(screen.queryByText(/UPCOMING HIGH IMPACT/)).not.toBeInTheDocument();
  });

  it('counts down to a real event', async () => {
    mockEvent();
    await renderWithEvents('2026-01-14T12:00:00Z');

    expect(screen.getByText(/UPCOMING HIGH IMPACT/)).toBeInTheDocument();
    expect(screen.getByText('Non-Farm Employment Change')).toBeInTheDocument();
    // 13:30Z minus the pinned 12:00Z
    expect(screen.getByText('01:30:00')).toBeInTheDocument();
  });

  it('marks an imprecise event time with ~ rather than implying seconds', async () => {
    // A non-zero time_mode means upstream knows only the day, or is estimating.
    mockEvent({ timeMode: 1 });
    await renderWithEvents('2026-01-14T12:00:00Z');
    expect(screen.getByText('~01:30:00')).toBeInTheDocument();
  });

  it('shows the currency so a EUR print is not read as a dollar one', async () => {
    mockEvent({ currency: 'EUR', eventName: 'ECB Rate Decision' });
    await renderWithEvents('2026-01-14T12:00:00Z');
    expect(screen.getByText(/EUR/)).toBeInTheDocument();
    expect(screen.getByText('ECB Rate Decision')).toBeInTheDocument();
  });

  it('aborts its in-flight request on unmount', async () => {
    const abort = jest.fn();
    const OriginalAbortController = global.AbortController;
    global.AbortController = class {
      signal = {} as AbortSignal;
      abort = abort;
    } as unknown as typeof AbortController;

    mockEvent();
    const { unmount } = await renderWithEvents('2026-01-14T12:00:00Z');
    unmount();

    expect(abort).toHaveBeenCalled();
    global.AbortController = OriginalAbortController;
  });
});
