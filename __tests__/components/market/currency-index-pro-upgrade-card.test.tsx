import React from 'react';
import {
  render as rtlRender,
  screen,
  type RenderOptions,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from '@jest/globals';

import { LocaleProvider } from '@/lib/context/locale-context';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
} from '@/lib/i18n/locale-resolver';
import { CurrencyIndexProUpgradeCard } from '@/components/market/currency-index-pro-upgrade-card';

const push = jest.fn();
const useSessionMock = jest.fn();

// LocaleProvider calls usePathname() (LESSONS-LEARNED.md L40); the card itself
// calls useRouter().
jest.mock('next/navigation', () => ({
  usePathname: () => '/xaux-vs-usdx',
  useRouter: () => ({ push }),
}));
jest.mock('next-auth/react', () => ({
  useSession: () => useSessionMock(),
}));

function render(ui: React.ReactElement, options?: RenderOptions) {
  return rtlRender(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <LocaleProvider>{children}</LocaleProvider>
    ),
    ...options,
  });
}

const COMPARE = '/pro/currency-index/compare';

describe('CurrencyIndexProUpgradeCard', () => {
  beforeEach(() => {
    push.mockReset();
    useSessionMock.mockReset();
    // Seeding skips LocaleProvider's real geo-IP fetch() (L40).
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify(defaultPreferences)
    );
  });

  it('shows the PRO pitch copy', () => {
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' });
    render(<CurrencyIndexProUpgradeCard />);
    expect(
      screen.getByText(/Access 8 Currency Indexes \+ XAUX \(Gold Index\)/)
    ).toBeInTheDocument();
  });

  it('sends a signed-out visitor to sign in', async () => {
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' });
    render(<CurrencyIndexProUpgradeCard />);

    await userEvent.click(
      screen.getByRole('button', { name: /Upgrade to PRO/ })
    );

    expect(push).toHaveBeenCalledWith(
      `/login?callbackUrl=${encodeURIComponent(COMPARE)}`
    );
  });

  it('opens the upgrade gate for a FREE user instead of navigating', async () => {
    useSessionMock.mockReturnValue({
      data: { user: { id: 'u1', tier: 'FREE' } },
      status: 'authenticated',
    });
    render(<CurrencyIndexProUpgradeCard />);

    await userEvent.click(
      screen.getByRole('button', { name: /Upgrade to PRO/ })
    );

    expect(push).not.toHaveBeenCalled();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('PRO Subscriber Feature')).toBeInTheDocument();
  });

  it('takes a PRO user straight to the comparison page, labelled for someone who already has PRO', async () => {
    useSessionMock.mockReturnValue({
      data: { user: { id: 'u1', tier: 'PRO' } },
      status: 'authenticated',
    });
    render(<CurrencyIndexProUpgradeCard />);

    await userEvent.click(
      screen.getByRole('button', { name: /Open PRO Chart/ })
    );

    expect(push).toHaveBeenCalledWith(COMPARE);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does nothing while the session is still loading', () => {
    useSessionMock.mockReturnValue({ data: null, status: 'loading' });
    render(<CurrencyIndexProUpgradeCard />);

    expect(
      screen.getByRole('button', { name: /Upgrade to PRO/ })
    ).toBeDisabled();
    expect(push).not.toHaveBeenCalled();
  });
});
