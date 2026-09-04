import React from 'react';
import {
  render as rtlRender,
  screen,
  waitFor,
  type RenderOptions,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from '@jest/globals';

// ThemeToggleButton's click handler calls saveSettings() ->
// saveAppearanceAction(), a Server Action that touches next/headers'
// cookies()/getSession()/prisma -- mocked the same way
// __tests__/app/actions/appearance.test.ts already establishes.
const mockCookieStore = { set: jest.fn() };
jest.mock('next/headers', () => ({
  __esModule: true,
  cookies: jest.fn(() => Promise.resolve(mockCookieStore)),
}));

const mockGetSession = jest.fn();
jest.mock('@/lib/auth/session', () => ({
  __esModule: true,
  getSession: () => mockGetSession(),
}));

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    userAppearance: {
      upsert: jest.fn(),
    },
  },
}));

// LocaleProvider calls usePathname() directly (LESSONS-LEARNED.md L40).
jest.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

import { LocaleProvider } from '@/lib/context/locale-context';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
} from '@/lib/i18n/locale-resolver';
import { AppearanceProvider } from '@/components/providers/appearance-provider';
import { ThemeToggleButton } from '@/components/marketing/theme-toggle-button';

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

describe('ThemeToggleButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue(null);
    // Seeding skips LocaleProvider's real geo-IP fetch() (L40).
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify(defaultPreferences)
    );
  });

  it('shows a moon icon and offers to switch to dark mode by default (Light Clean Mode default)', () => {
    render(<ThemeToggleButton />);

    expect(
      screen.getByRole('button', { name: 'Switch to dark mode' })
    ).toBeInTheDocument();
  });

  it('toggles the <html> class and the button label on click', async () => {
    const user = userEvent.setup();
    render(<ThemeToggleButton />);

    await user.click(
      screen.getByRole('button', { name: 'Switch to dark mode' })
    );

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Switch to light mode' })
    ).toBeInTheDocument();
  });

  it('persists the choice via the guest-safe cookie so anonymous visitors keep it on reload', async () => {
    const user = userEvent.setup();
    render(<ThemeToggleButton />);

    await user.click(
      screen.getByRole('button', { name: 'Switch to dark mode' })
    );

    await waitFor(() => {
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'davintrade-appearance',
        expect.stringContaining('"theme":"dark"'),
        expect.any(Object)
      );
    });
  });
});
