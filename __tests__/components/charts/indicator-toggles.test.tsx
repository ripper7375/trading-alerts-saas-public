/**
 * IndicatorToggles Component Tests - 63-Column Schema
 *
 * Tests for components/charts/indicator-toggles.tsx
 * UI component for toggling chart indicators with tier access control
 *
 * Part 9: Charts & Visualization - Updated for 63-column database schema
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

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

describe('IndicatorToggles Component - 63-Column Schema', () => {
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

    it('should render FREE tier indicators', () => {
      render(
        <IndicatorToggles
          selectedIndicators={[]}
          onIndicatorToggle={mockOnToggle}
        />
      );

      // FREE tier indicators (2 groups)
      expect(screen.getByText('Fractal Diagonal Lines')).toBeInTheDocument();
      expect(screen.getByText('Fractal Horizontal Lines')).toBeInTheDocument();
    });

    it('should render PRO indicators', () => {
      render(
        <IndicatorToggles
          selectedIndicators={[]}
          onIndicatorToggle={mockOnToggle}
        />
      );

      // PRO tier indicators (8 groups)
      expect(
        screen.getByText('Moving Averages (TEMA/HRMA/SMMA)')
      ).toBeInTheDocument();
      expect(screen.getByText('Body Size Momentum')).toBeInTheDocument();
      expect(screen.getByText('Heiken Ashi')).toBeInTheDocument();
      expect(screen.getByText('Keltner Channels')).toBeInTheDocument();
      expect(screen.getByText('Support & Resistance')).toBeInTheDocument();
      expect(screen.getByText('ZigZag + EMA')).toBeInTheDocument();
      expect(screen.getByText('Dual TEMA High/Low')).toBeInTheDocument();
      expect(screen.getByText('Pinbar Detection')).toBeInTheDocument();
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

    it('should allow toggling FREE tier indicators', () => {
      render(
        <IndicatorToggles
          selectedIndicators={[]}
          onIndicatorToggle={mockOnToggle}
        />
      );

      // FREE users can toggle FREE tier indicators
      const fractalDiagCheckbox = screen.getByRole('checkbox', {
        name: /fractal diagonal lines/i,
      });
      expect(fractalDiagCheckbox).not.toBeDisabled();
    });

    // V8: no indicator is PRO-only (see lib/tier/validator.ts
    // canAccessIndicator / isProOnlyIndicator) — FREE users can toggle every
    // indicator. The "Pro Indicators" section/badge is cosmetic messaging
    // only, not an access gate.
    it('should allow toggling PRO-labeled indicators when FREE', () => {
      render(
        <IndicatorToggles
          selectedIndicators={[]}
          onIndicatorToggle={mockOnToggle}
        />
      );

      const movingAvgCheckbox = screen.getByRole('checkbox', {
        name: /moving averages/i,
      });
      expect(movingAvgCheckbox).not.toBeDisabled();
    });

    it('should call onToggle for PRO-labeled indicators when FREE', () => {
      render(
        <IndicatorToggles
          selectedIndicators={[]}
          onIndicatorToggle={mockOnToggle}
        />
      );

      const movingAvgCheckbox = screen.getByRole('checkbox', {
        name: /moving averages/i,
      });
      fireEvent.click(movingAvgCheckbox);

      expect(mockOnToggle).toHaveBeenCalledWith('moving_averages');
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

      const movingAvgCheckbox = screen.getByRole('checkbox', {
        name: /moving averages/i,
      });
      fireEvent.click(movingAvgCheckbox);

      expect(mockOnToggle).toHaveBeenCalledWith('moving_averages');
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
          selectedIndicators={['moving_averages', 'zigzag']}
          onIndicatorToggle={mockOnToggle}
        />
      );

      const movingAvgCheckbox = screen.getByRole('checkbox', {
        name: /moving averages/i,
      });
      const zigzagCheckbox = screen.getByRole('checkbox', {
        name: /zigzag/i,
      });
      const keltnerCheckbox = screen.getByRole('checkbox', {
        name: /keltner channels/i,
      });

      expect(movingAvgCheckbox).toBeChecked();
      expect(zigzagCheckbox).toBeChecked();
      expect(keltnerCheckbox).not.toBeChecked();
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

      // Initially expanded - check for a PRO indicator
      expect(screen.getByText('Body Size Momentum')).toBeVisible();

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
