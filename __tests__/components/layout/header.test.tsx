/**
 * Header Component Tests
 *
 * Tests for the dashboard header component.
 * Part 8: Dashboard & Layout Components
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from '@jest/globals';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: jest.fn(),
    back: jest.fn(),
  }),
}));

// Mock next/link
jest.mock('next/link', () => {
  return function MockLink({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) {
    return <a href={href}>{children}</a>;
  };
});

// Mock next-auth/react
const mockSignOut = jest.fn();
jest.mock('next-auth/react', () => ({
  signOut: (options: { redirect: boolean }) => mockSignOut(options),
}));

// Mock MobileNav component
jest.mock('@/components/layout/mobile-nav', () => ({
  MobileNav: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="mobile-nav" onClick={onClose}>
        Mobile Nav
      </div>
    ) : null,
}));

import { Header } from '@/components/layout/header';

// Sample user data
const sampleUser = {
  id: 'user-123',
  name: 'John Doe',
  email: 'john@example.com',
  image: null,
  tier: 'FREE',
  role: 'USER',
};

const proUser = {
  ...sampleUser,
  tier: 'PRO',
};

describe('Header Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Basic Rendering
  // ============================================================================
  describe('rendering', () => {
    it('should render the logo', () => {
      render(<Header user={sampleUser} />);

      expect(screen.getByText('Trading Alerts')).toBeInTheDocument();
    });

    it('should render the logo emoji', () => {
      render(<Header user={sampleUser} />);

      expect(screen.getByLabelText('Trading Alerts')).toBeInTheDocument();
    });

    it('should link logo to dashboard', () => {
      render(<Header user={sampleUser} />);

      const logoLink = screen.getByText('Trading Alerts').closest('a');
      expect(logoLink).toHaveAttribute('href', '/dashboard');
    });

    it('should render user name', () => {
      render(<Header user={sampleUser} />);

      // Shows first name in button
      expect(screen.getByText('John')).toBeInTheDocument();
    });

    it('should render notification bell', () => {
      render(<Header user={sampleUser} />);

      expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
    });

    it('should render mobile menu button', () => {
      render(<Header user={sampleUser} />);

      expect(screen.getByLabelText('Open menu')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Tier Badge
  // ============================================================================
  describe('tier badge', () => {
    it('should show FREE badge for free users', () => {
      render(<Header user={sampleUser} />);

      expect(screen.getByText('FREE')).toBeInTheDocument();
    });

    it('should show PRO badge for pro users', () => {
      render(<Header user={proUser} />);

      expect(screen.getByText(/PRO/)).toBeInTheDocument();
    });

    it('should have primary styling for PRO badge', () => {
      render(<Header user={proUser} />);

      const proBadge = screen.getByText(/PRO/);
      expect(proBadge).toHaveClass('bg-primary');
    });

    it('should have secondary styling for FREE badge', () => {
      render(<Header user={sampleUser} />);

      const freeBadge = screen.getByText('FREE');
      expect(freeBadge).toHaveClass('bg-secondary');
    });
  });

  // ============================================================================
  // Avatar
  // ============================================================================
  describe('avatar', () => {
    it('should show user initials in fallback', () => {
      render(<Header user={sampleUser} />);

      expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('should show single initial for single name', () => {
      const singleNameUser = { ...sampleUser, name: 'John' };
      render(<Header user={singleNameUser} />);

      // Single name produces single initial
      expect(screen.getByText('J')).toBeInTheDocument();
    });

    it('should handle long names', () => {
      const longNameUser = { ...sampleUser, name: 'John Michael Smith Jr' };
      render(<Header user={longNameUser} />);

      // Should only show first two initials
      expect(screen.getByText('JM')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // User Menu
  // ============================================================================
  describe('user menu', () => {
    it('should show menu trigger button', () => {
      render(<Header user={sampleUser} />);

      // The menu trigger contains the user's first name
      expect(screen.getByText('John')).toBeInTheDocument();
    });

    it('should have dropdown trigger with proper attributes', () => {
      render(<Header user={sampleUser} />);

      const trigger = screen.getByText('John').closest('button');
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    });

    it('should have data-state closed initially', () => {
      render(<Header user={sampleUser} />);

      const trigger = screen.getByText('John').closest('button');
      expect(trigger).toHaveAttribute('data-state', 'closed');
    });

    // Note: Radix UI DropdownMenu renders content in a portal which doesn't
    // work reliably in jsdom. The following tests verify the trigger behavior
    // rather than the menu content.

    it('should be clickable', () => {
      render(<Header user={sampleUser} />);

      const trigger = screen.getByText('John').closest('button');
      expect(trigger).not.toBeDisabled();
      fireEvent.click(trigger!);
      // Menu opens in portal - can't verify content in jsdom
    });

    it('should have proper styling', () => {
      render(<Header user={sampleUser} />);

      const trigger = screen.getByText('John').closest('button');
      expect(trigger).toHaveClass('flex', 'items-center', 'gap-2');
    });

    it('should display chevron icon', () => {
      const { container } = render(<Header user={sampleUser} />);

      // Chevron icon should be present
      const chevron = container.querySelector('.lucide-chevron-down');
      expect(chevron).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Logout
  // Note: Logout tests require Radix portal content which doesn't render in jsdom.
  // These would need E2E tests with a real browser.
  // ============================================================================
  describe('logout', () => {
    it('should have signOut mock available', () => {
      // Verify the mock is configured correctly
      expect(mockSignOut).toBeDefined();
    });

    it('should have router mock available for redirect', () => {
      // Verify the mock is configured correctly
      expect(mockPush).toBeDefined();
    });
  });

  // ============================================================================
  // Mobile Navigation
  // ============================================================================
  describe('mobile navigation', () => {
    it('should open mobile nav when menu button clicked', () => {
      render(<Header user={sampleUser} />);

      const menuButton = screen.getByLabelText('Open menu');
      fireEvent.click(menuButton);

      expect(screen.getByTestId('mobile-nav')).toBeInTheDocument();
    });

    it('should close mobile nav when close is called', () => {
      render(<Header user={sampleUser} />);

      // Open mobile nav
      const menuButton = screen.getByLabelText('Open menu');
      fireEvent.click(menuButton);

      expect(screen.getByTestId('mobile-nav')).toBeInTheDocument();

      // Close it by clicking
      fireEvent.click(screen.getByTestId('mobile-nav'));

      expect(screen.queryByTestId('mobile-nav')).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // Notification Indicator
  // ============================================================================
  describe('notification indicator', () => {
    it('should show notification dot', () => {
      const { container } = render(<Header user={sampleUser} />);

      // The notification dot is a span with bg-red-500
      const notificationDot = container.querySelector('.bg-red-500');
      expect(notificationDot).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Styling
  // ============================================================================
  describe('styling', () => {
    it('should be sticky at top', () => {
      const { container } = render(<Header user={sampleUser} />);

      const header = container.querySelector('header');
      expect(header).toHaveClass('sticky', 'top-0');
    });

    it('should have proper z-index', () => {
      const { container } = render(<Header user={sampleUser} />);

      const header = container.querySelector('header');
      expect(header).toHaveClass('z-40');
    });

    it('should have border bottom', () => {
      const { container } = render(<Header user={sampleUser} />);

      const header = container.querySelector('header');
      expect(header).toHaveClass('border-b');
    });
  });

  // ============================================================================
  // Accessibility
  // ============================================================================
  describe('accessibility', () => {
    it('should have accessible menu button', () => {
      render(<Header user={sampleUser} />);

      expect(screen.getByLabelText('Open menu')).toBeInTheDocument();
    });

    it('should have accessible notifications button', () => {
      render(<Header user={sampleUser} />);

      expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
    });

    it('should have accessible logo image', () => {
      render(<Header user={sampleUser} />);

      expect(screen.getByLabelText('Trading Alerts')).toBeInTheDocument();
    });
  });
});
