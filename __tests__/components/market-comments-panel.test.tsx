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
import MarketCommentsPanel from '@/components/market-comments-panel';
import type { Tier } from '@/lib/tier-config';

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

/**
 * The session banner is PRO-only by design: `seed-code`'s /free treatment
 * locks this whole panel behind an overlay whose copy names "Session
 * Countdowns" explicitly. That gate was briefly missing, so it is pinned
 * here rather than left to a reviewer to notice again.
 */
function renderPanel(tier: Tier) {
  // Wed 2026-01-14 12:00 UTC -> London 12:00 GMT, an open session, so the
  // PRO case has something unambiguous to assert on.
  jest.setSystemTime(new Date('2026-01-14T12:00:00Z'));
  const result = render(
    <MarketCommentsPanel tier={tier} onOpenUpgradeModal={() => {}} />
  );
  act(() => {
    jest.advanceTimersByTime(0);
  });
  return result;
}

describe('MarketCommentsPanel -- session banner tier gate', () => {
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

  it('shows the session banner on PRO', () => {
    renderPanel('PRO');
    expect(screen.getByText('GB London Session')).toBeInTheDocument();
    expect(screen.getByText('SESSION CLOSES IN')).toBeInTheDocument();
  });

  it('hides the session banner on FREE', () => {
    renderPanel('FREE');
    expect(screen.queryByText('GB London Session')).not.toBeInTheDocument();
    expect(screen.queryByText('SESSION CLOSES IN')).not.toBeInTheDocument();
    // No session flags leak through either.
    expect(screen.queryByLabelText(/London:/)).not.toBeInTheDocument();
  });

  it('renders FREE tier unavailable list and Upgrade to PRO CTA', () => {
    renderPanel('FREE');
    expect(screen.getByText('FREE Tier')).toBeInTheDocument();
    expect(screen.getByText('Market Comments')).toBeInTheDocument();
    expect(screen.getByText('Market Session')).toBeInTheDocument();
    expect(screen.getByText('High Impact News and Events')).toBeInTheDocument();
    expect(screen.getByText('Market Context Analysis')).toBeInTheDocument();
    expect(screen.getByText('Trade Setup Analysis')).toBeInTheDocument();
    expect(screen.getByText('EDT Quality Metrics')).toBeInTheDocument();
    expect(
      screen.getByText('are unavailable for FREE Tier')
    ).toBeInTheDocument();
    const upgradeBtn = screen.getByRole('link', { name: /Upgrade to PRO/i });
    expect(upgradeBtn).toHaveAttribute('href', '/pricing');
  });

  it('renders PRO tier coming soon empty state', () => {
    renderPanel('PRO');
    expect(screen.getByText('PRO Tier')).toBeInTheDocument();
    expect(
      screen.getByText('Live Market Comments Coming Soon')
    ).toBeInTheDocument();
    expect(screen.getByText('Get priority access on PRO')).toBeInTheDocument();
  });
});
