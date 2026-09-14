import React from 'react';
import { render as rtlRender, screen, within } from '@testing-library/react';
import { describe, it, expect, beforeEach } from '@jest/globals';

import { LocaleProvider } from '@/lib/context/locale-context';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
} from '@/lib/i18n/locale-resolver';

let mockPathname = '/pro/currency-index/compare';
// 'jest' deliberately not imported from @jest/globals (hoisted factories).
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

import { ProPageNav } from '@/components/currency-index-pro/pro-page-nav';

function render() {
  return rtlRender(<ProPageNav />, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <LocaleProvider>{children}</LocaleProvider>
    ),
  });
}

describe('ProPageNav', () => {
  beforeEach(() => {
    // Seeding skips LocaleProvider's real geo-IP fetch() (L40).
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify(defaultPreferences)
    );
  });

  it('links AI Workbench to /terminal and 28-Pair Screener to the screener, in that order', () => {
    mockPathname = '/pro/currency-index/compare';
    render();
    const nav = screen.getByRole('navigation', { name: 'PRO pages' });
    const links = within(nav).getAllByRole('link');

    expect(links.map((l) => [l.textContent, l.getAttribute('href')])).toEqual([
      ['AI Workbench', '/terminal'],
      ['28-Pair Screener', '/pro/currency-index'],
    ]);
    links.forEach((l) => expect(l).not.toHaveAttribute('aria-current'));
  });

  it('marks the screener link as the current page on the screener', () => {
    mockPathname = '/pro/currency-index';
    render();
    expect(
      screen.getByRole('link', { name: '28-Pair Screener' })
    ).toHaveAttribute('aria-current', 'page');
    expect(
      screen.getByRole('link', { name: 'AI Workbench' })
    ).not.toHaveAttribute('aria-current');
  });
});
