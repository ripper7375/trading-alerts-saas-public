import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from '@jest/globals';

/**
 * Regression: the landing page painted dark while its hero image (which
 * reads useChartAppearance().resolvedTheme) showed the light artwork,
 * until a reload. next-themes' <ThemeProvider> was still mounted in
 * app/providers.tsx with its own theme seeded from localStorage, and its
 * passive effect re-applied that stale value to <html> AFTER
 * AppearanceProvider had applied the server-resolved one.
 */

jest.mock('next-auth/react', () => ({
  __esModule: true,
  SessionProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

jest.mock('@/app/actions/appearance', () => ({
  __esModule: true,
  saveAppearanceAction: jest.fn(),
}));

jest.mock('@/components/chat-widget/chat-context', () => ({
  __esModule: true,
  SupportChatProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
jest.mock('@/components/chat-widget/floating-chat-trigger', () => ({
  __esModule: true,
  FloatingChatTrigger: () => null,
}));
jest.mock('@/components/chat-widget/support-chat-widget', () => ({
  __esModule: true,
  SupportChatWidget: () => null,
}));

let mockSearch = '';
jest.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

import { Providers } from '@/app/providers';
import { useChartAppearance } from '@/components/providers/appearance-provider';
import {
  DEFAULT_APPEARANCE_SETTINGS,
  type AppearanceSettings,
} from '@/lib/appearance/types';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
} from '@/lib/i18n/locale-resolver';

function ThemeProbe() {
  const { resolvedTheme } = useChartAppearance();
  return <span data-testid="probe">{resolvedTheme}</span>;
}

const lightSettings: AppearanceSettings = {
  ...DEFAULT_APPEARANCE_SETTINGS,
  theme: 'light',
};

function htmlTheme(): 'dark' | 'light' | 'none' {
  const cl = document.documentElement.classList;
  if (cl.contains('dark')) return 'dark';
  if (cl.contains('light')) return 'light';
  return 'none';
}

describe('Providers theme ownership', () => {
  beforeEach(() => {
    // jsdom has no matchMedia; a theme library that needs it must be able
    // to run, so this test fails on the theme, not on a missing API.
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    });
    mockSearch = '';
    localStorage.clear();
    // Seeding skips LocaleProvider's real geo-IP fetch() (L40).
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify(defaultPreferences)
    );
    document.documentElement.classList.remove('dark', 'light');
  });

  it('keeps <html> on the server-resolved theme even when localStorage holds a stale one', async () => {
    // A value left by an earlier visit (the old dark default, or another
    // account on this browser), painted by the old inline script.
    localStorage.setItem('davintrade-theme', 'dark');
    document.documentElement.classList.add('dark');

    render(
      <Providers initialAppearance={lightSettings}>
        <ThemeProbe />
      </Providers>
    );

    // Let every passive effect (including any theme library's) flush.
    await waitFor(() => {
      expect(screen.getByTestId('probe')).toHaveTextContent('light');
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(htmlTheme()).toBe('light');
    expect(screen.getByTestId('probe')).toHaveTextContent('light');
  });

  it('applies a ?theme= override to both the page class and resolvedTheme', async () => {
    mockSearch = 'theme=dark';

    render(
      <Providers initialAppearance={lightSettings}>
        <ThemeProbe />
      </Providers>
    );

    await waitFor(() => {
      expect(screen.getByTestId('probe')).toHaveTextContent('dark');
    });
    expect(htmlTheme()).toBe('dark');
  });
});
