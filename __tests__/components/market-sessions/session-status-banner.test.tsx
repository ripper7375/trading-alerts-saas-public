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

describe('SessionStatusBanner', () => {
  beforeEach(() => {
    // Seeding skips LocaleProvider's real geo-IP fetch(), which otherwise
    // races jsdom teardown (LESSONS-LEARNED.md L40).
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
