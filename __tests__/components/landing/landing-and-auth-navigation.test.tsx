import React from 'react';
import {
  render as rtlRender,
  screen,
  cleanup,
  fireEvent,
} from '@testing-library/react';

const mockUseSession = jest.fn();
jest.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
  signOut: jest.fn(),
}));

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/components/auth/login-form', () => {
  return function MockLoginForm() {
    return <div data-testid="mock-login-form">Login Form</div>;
  };
});

import { LandingHero } from '@/components/landing/landing-hero';
import { MarketingNavbar } from '@/components/marketing/marketing-navbar';
import LoginPage from '@/app/(auth)/login/page';
import { LocaleProvider } from '@/lib/context/locale-context';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
} from '@/lib/i18n/locale-resolver';

function renderWithLocale(ui: React.ReactElement) {
  return rtlRender(<LocaleProvider>{ui}</LocaleProvider>);
}

describe('Landing and Auth Navigation (Items 1 & 2)', () => {
  beforeEach(() => {
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify(defaultPreferences)
    );
    mockUseSession.mockReset();
    mockPush.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Item 1: LandingHero CTA button navigation', () => {
    it('navigates to sign in page (/login) when not logged in', () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
      });

      renderWithLocale(<LandingHero />);

      const getStartedBtn = screen.getByRole('button', {
        name: /Get Started Free/i,
      });
      const link = getStartedBtn.closest('a');
      expect(link).toHaveAttribute('href', '/login');
    });

    it('navigates to workbench page (/free) when logged in as FREE tier', () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            name: 'FreeUser',
            email: 'free@example.com',
            tier: 'FREE',
          },
        },
        status: 'authenticated',
      });

      renderWithLocale(<LandingHero />);

      const getStartedBtn = screen.getByRole('button', {
        name: /Get Started Free/i,
      });
      const link = getStartedBtn.closest('a');
      expect(link).toHaveAttribute('href', '/free');
    });

    it('navigates to workbench page (/terminal) when logged in as PRO tier', () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            name: 'ProUser',
            email: 'pro@example.com',
            tier: 'PRO',
          },
        },
        status: 'authenticated',
      });

      renderWithLocale(<LandingHero />);

      const getStartedBtn = screen.getByRole('button', {
        name: /Get Started Free/i,
      });
      const link = getStartedBtn.closest('a');
      expect(link).toHaveAttribute('href', '/terminal');
    });
  });

  describe('MarketingNavbar Auth Navigation (Once clicked, navigate to 2 /login)', () => {
    it('points both Log In and Get Started to /login on desktop and mobile', () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
      });

      const { container } = renderWithLocale(<MarketingNavbar />);

      const logInLinks = screen.getAllByRole('link', { name: /Log In/i });
      expect(logInLinks.length).toBeGreaterThanOrEqual(1);
      for (const logInLink of logInLinks) {
        expect(logInLink).toHaveAttribute('href', '/login');
      }

      const getStartedLink = screen.getByRole('link', {
        name: /Get Started$/i,
      });
      expect(getStartedLink).toHaveAttribute('href', '/login');

      // Open mobile drawer
      const mobileToggle = container.querySelector('button.md\\:hidden');
      if (mobileToggle) {
        fireEvent.click(mobileToggle);
        const mobileGetStartedLink = screen.getByRole('link', {
          name: /Get Started Free/i,
        });
        expect(mobileGetStartedLink).toHaveAttribute('href', '/login');
      }
    });
  });

  describe('Item 2: LoginPage Already Signed In view', () => {
    it('renders LoginForm when unauthenticated', () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
      });

      renderWithLocale(<LoginPage />);
      expect(screen.getByTestId('mock-login-form')).toBeInTheDocument();
    });

    it('renders "Go to Workbench" instead of "Go to Dashboard" when authenticated', () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            name: 'AkeAke',
            email: 'akeake@example.com',
            tier: 'PRO',
          },
        },
        status: 'authenticated',
      });

      renderWithLocale(<LoginPage />);

      expect(screen.getByText('Already Signed In')).toBeInTheDocument();
      expect(screen.getByText(/AkeAke/i)).toBeInTheDocument();

      expect(screen.queryByText(/Go to Dashboard/i)).not.toBeInTheDocument();

      const workbenchLink = screen.getByRole('link', {
        name: /Go to Workbench/i,
      });
      expect(workbenchLink).toBeInTheDocument();
      expect(workbenchLink).toHaveAttribute('href', '/terminal');
    });

    it('links "Go to Workbench" to /free for FREE tier user', () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            name: 'AkeAke',
            email: 'akeake@example.com',
            tier: 'FREE',
          },
        },
        status: 'authenticated',
      });

      renderWithLocale(<LoginPage />);

      const workbenchLink = screen.getByRole('link', {
        name: /Go to Workbench/i,
      });
      expect(workbenchLink).toHaveAttribute('href', '/free');
    });
  });
});
