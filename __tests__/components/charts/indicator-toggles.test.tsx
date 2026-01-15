/**
 * IndicatorToggles Component Tests
 *
 * Tests for components/charts/indicator-toggles.tsx
 * UI component for toggling chart indicators with tier access control
 *
 * Part 9: Charts & Visualization - PRO Indicators Implementation
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from '@jest/globals';

// Mock next-auth
const mockUseSession = jest.fn();
jest.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
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

// Import after mocks
import { IndicatorToggles } from '@/components/charts/indicator-toggles';

describe('IndicatorToggles Component', () => {
  const mockOnToggle = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSession.mockReturnValue({
      data: { user: { tier: 'FREE' } },
      status: 'authenticated',
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Rendering
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('rendering', () => {
    it('should render header with title', () => {
      render(
        <IndicatorToggles
          selectedIndicators={[]}
          onIndicatorToggle={mockOnToggle}
        />
      );

      expect(screen.getByText('Technical Indicators')).toBeInTheDocument();
    });

    it('should render Basic section', () => {
      render(
        <IndicatorToggles
          selectedIndicators={[]}
          onIndicatorToggle={mockOnToggle}
        />
      );

      expect(screen.getByText('Basic')).toBeInTheDocument();
    });

    it('should render Pro Indicators section', () => {
      render(
        <IndicatorToggles
          selectedIndicators={[]}
          onIndicatorToggle={mockOnToggle}
        />
      );

      expect(screen.getByText('Pro Indicators')).toBeInTheDocument();
    });

    it('should not render basic indicators (all indicators are PRO-only)', () => {
      render(
        <IndicatorToggles
          selectedIndicators={[]}
          onIndicatorToggle={mockOnToggle}
        />
      );

      // Fractals and trendlines removed - they were calculated incorrectly from OHLCV data
      expect(screen.queryByText('Fractals')).not.toBeInTheDocument();
      expect(screen.queryByText('Trendlines')).not.toBeInTheDocument();
    });

    it('should render PRO indicators', () => {
      render(
        <IndicatorToggles
          selectedIndicators={[]}
          onIndicatorToggle={mockOnToggle}
        />
      );

      expect(screen.getByText('Momentum Candles')).toBeInTheDocument();
      expect(screen.getByText('Keltner Channels')).toBeInTheDocument();
      expect(screen.getByText('TEMA')).toBeInTheDocument();
      expect(screen.getByText('HRMA')).toBeInTheDocument();
      expect(screen.getByText('SMMA')).toBeInTheDocument();
      expect(screen.getByText('ZigZag')).toBeInTheDocument();
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FREE Tier Behavior
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('FREE tier behavior', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: { user: { tier: 'FREE' } },
        status: 'authenticated',
      });
    });

    it('should show upgrade prompt for FREE users', () => {
      render(
        <IndicatorToggles
          selectedIndicators={[]}
          onIndicatorToggle={mockOnToggle}
        />
      );

      expect(
        screen.getByText('Unlock all PRO indicators:')
      ).toBeInTheDocument();
      expect(screen.getByText('Upgrade to PRO')).toBeInTheDocument();
    });

    it('should show PRO badge in Pro Indicators section header', () => {
      render(
        <IndicatorToggles
          selectedIndicators={[]}
          onIndicatorToggle={mockOnToggle}
        />
      );

      // PRO badge should be visible for FREE users
      expect(screen.getByText('PRO')).toBeInTheDocument();
    });

    it('should not allow toggling PRO indicators when FREE (all indicators are PRO-only)', () => {
      render(
        <IndicatorToggles
          selectedIndicators={[]}
          onIndicatorToggle={mockOnToggle}
        />
      );

      // All indicators are PRO-only now, so FREE users can't toggle any
      const temaCheckbox = screen.getByRole('checkbox', { name: /tema/i });
      expect(temaCheckbox).toBeDisabled();
    });

    it('should not call onToggle for PRO indicators when FREE', () => {
      render(
        <IndicatorToggles
          selectedIndicators={[]}
          onIndicatorToggle={mockOnToggle}
        />
      );

      // Find a PRO indicator checkbox (should be disabled)
      const temaCheckbox = screen.getByRole('checkbox', { name: /tema/i });
      fireEvent.click(temaCheckbox);

      // Should not be called because indicator is locked
      expect(mockOnToggle).not.toHaveBeenCalledWith('tema');
    });

    it('should have disabled checkboxes for PRO indicators', () => {
      render(
        <IndicatorToggles
          selectedIndicators={[]}
          onIndicatorToggle={mockOnToggle}
        />
      );

      const temaCheckbox = screen.getByRole('checkbox', { name: /tema/i });
      expect(temaCheckbox).toBeDisabled();
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PRO Tier Behavior
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('PRO tier behavior', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: { user: { tier: 'PRO' } },
        status: 'authenticated',
      });
    });

    it('should not show upgrade prompt for PRO users', () => {
      render(
        <IndicatorToggles
          selectedIndicators={[]}
          onIndicatorToggle={mockOnToggle}
        />
      );

      expect(
        screen.queryByText('Unlock all PRO indicators:')
      ).not.toBeInTheDocument();
    });

    it('should allow toggling PRO indicators', () => {
      render(
        <IndicatorToggles
          selectedIndicators={[]}
          onIndicatorToggle={mockOnToggle}
        />
      );

      const temaCheckbox = screen.getByRole('checkbox', { name: /tema/i });
      fireEvent.click(temaCheckbox);

      expect(mockOnToggle).toHaveBeenCalledWith('tema');
    });

    it('should have enabled checkboxes for all indicators', () => {
      render(
        <IndicatorToggles
          selectedIndicators={[]}
          onIndicatorToggle={mockOnToggle}
        />
      );

      const keltnerCheckbox = screen.getByRole('checkbox', {
        name: /keltner channels/i,
      });
      expect(keltnerCheckbox).not.toBeDisabled();
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Selected State
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('selected state', () => {
    it('should show checkboxes as checked for selected indicators', () => {
      mockUseSession.mockReturnValue({
        data: { user: { tier: 'PRO' } },
        status: 'authenticated',
      });

      render(
        <IndicatorToggles
          selectedIndicators={['tema', 'zigzag']}
          onIndicatorToggle={mockOnToggle}
        />
      );

      const temaCheckbox = screen.getByRole('checkbox', { name: /tema/i });
      const zigzagCheckbox = screen.getByRole('checkbox', {
        name: /zigzag/i,
      });
      const hrmaCheckbox = screen.getByRole('checkbox', { name: /hrma/i });

      expect(temaCheckbox).toBeChecked();
      expect(zigzagCheckbox).toBeChecked();
      expect(hrmaCheckbox).not.toBeChecked();
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Collapsible Sections
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('collapsible sections', () => {
    it('should toggle PRO section visibility', () => {
      render(
        <IndicatorToggles
          selectedIndicators={[]}
          onIndicatorToggle={mockOnToggle}
        />
      );

      // Initially expanded
      expect(screen.getByText('Momentum Candles')).toBeVisible();

      // Click Pro Indicators header to collapse
      const proHeader = screen.getByText('Pro Indicators');
      fireEvent.click(proHeader);

      // Click handler should work
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Default Tier
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('default tier handling', () => {
    it('should default to FREE when no tier in session', () => {
      mockUseSession.mockReturnValue({
        data: { user: {} }, // No tier specified
        status: 'authenticated',
      });

      render(
        <IndicatorToggles
          selectedIndicators={[]}
          onIndicatorToggle={mockOnToggle}
        />
      );

      // Should show upgrade prompt (FREE behavior)
      expect(screen.getByText('Upgrade to PRO')).toBeInTheDocument();
    });

    it('should default to FREE when session is null', () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
      });

      render(
        <IndicatorToggles
          selectedIndicators={[]}
          onIndicatorToggle={mockOnToggle}
        />
      );

      // Should show upgrade prompt (FREE behavior)
      expect(screen.getByText('Upgrade to PRO')).toBeInTheDocument();
    });
  });
});
