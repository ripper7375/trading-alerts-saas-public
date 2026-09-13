import React from 'react';
import {
  render as rtlRender,
  screen,
  type RenderOptions,
} from '@testing-library/react';
import { describe, it, expect, beforeEach } from '@jest/globals';

import { LocaleProvider } from '@/lib/context/locale-context';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
} from '@/lib/i18n/locale-resolver';
import { ProFeatureLinks } from '@/components/sidebar/pro-feature-links';

// LocaleProvider calls usePathname() (LESSONS-LEARNED.md L40).
jest.mock('next/navigation', () => ({
  usePathname: () => '/terminal',
}));

function render(ui: React.ReactElement, options?: RenderOptions) {
  return rtlRender(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <LocaleProvider>{children}</LocaleProvider>
    ),
    ...options,
  });
}

describe('ProFeatureLinks', () => {
  beforeEach(() => {
    // Seeding skips LocaleProvider's real geo-IP fetch() (L40).
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify(defaultPreferences)
    );
  });

  it('links a PRO user straight to both PRO pages', () => {
    render(<ProFeatureLinks locked={false} />);

    expect(
      screen.getByRole('link', { name: /28-Pair Screener/ })
    ).toHaveAttribute('href', '/pro/currency-index');
    expect(
      screen.getByRole('link', { name: /Currency Index Comparison PRO/ })
    ).toHaveAttribute('href', '/pro/currency-index/compare');
    expect(screen.queryByText('Upgrade to PRO')).not.toBeInTheDocument();
  });

  it('locks both for the FREE workbench: padlock overlay, upgrade destination, feature name still announced', () => {
    render(<ProFeatureLinks locked />);

    const screener = screen.getByRole('link', {
      name: '28-Pair Screener -- Upgrade to PRO',
    });
    const comparison = screen.getByRole('link', {
      name: 'Currency Index Comparison PRO -- Upgrade to PRO',
    });
    expect(screener).toHaveAttribute('href', '/pricing');
    expect(comparison).toHaveAttribute('href', '/pricing');
    expect(screen.getAllByText('Upgrade to PRO')).toHaveLength(2);
    // The feature name stays on screen under the frosted overlay.
    expect(screener).toHaveTextContent('28-Pair Screener');
  });

  it('keeps both reachable, with names, when the sidebar is collapsed', () => {
    const { rerender } = render(<ProFeatureLinks locked={false} isCollapsed />);
    expect(
      screen.getByRole('link', { name: '28-Pair Screener' })
    ).toHaveAttribute('href', '/pro/currency-index');

    rerender(<ProFeatureLinks locked isCollapsed />);
    expect(
      screen.getByRole('link', { name: '28-Pair Screener -- Upgrade to PRO' })
    ).toHaveAttribute('href', '/pricing');
  });
});
