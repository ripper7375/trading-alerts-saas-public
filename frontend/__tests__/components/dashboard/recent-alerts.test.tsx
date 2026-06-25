/**
 * RecentAlerts Component Tests
 *
 * Tests for the dashboard recent alerts widget.
 * Part 8: Dashboard & Layout Components
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';

import { RecentAlerts } from '@/components/dashboard/recent-alerts';

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

// Sample alert data
const sampleAlerts = [
  {
    id: 'alert-1',
    status: 'watching' as const,
    title: 'XAUUSD Price Alert',
    symbol: 'XAUUSD',
    timeframe: 'H1',
    targetPrice: 2050.0,
    currentPrice: 2040.5,
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'alert-2',
    status: 'triggered' as const,
    title: 'EURUSD Breakout',
    symbol: 'EURUSD',
    timeframe: 'M15',
    targetPrice: 1.09,
    currentPrice: 1.092,
    createdAt: '2024-01-15T09:30:00Z',
  },
  {
    id: 'alert-3',
    status: 'paused' as const,
    title: 'GBPUSD Support',
    symbol: 'GBPUSD',
    timeframe: 'D1',
    targetPrice: 1.26,
    currentPrice: 1.265,
    createdAt: '2024-01-15T08:00:00Z',
  },
];

describe('RecentAlerts Component', () => {
  // ============================================================================
  // Basic Rendering
  // ============================================================================
  describe('rendering', () => {
    it('should render the component title', () => {
      render(<RecentAlerts alerts={sampleAlerts} />);

      expect(screen.getByText('Recent Alerts')).toBeInTheDocument();
    });

    it('should render alerts when provided', () => {
      render(<RecentAlerts alerts={sampleAlerts} />);

      expect(screen.getByText('XAUUSD Price Alert')).toBeInTheDocument();
      expect(screen.getByText('EURUSD Breakout')).toBeInTheDocument();
      expect(screen.getByText('GBPUSD Support')).toBeInTheDocument();
    });

    it('should render View All button when alerts exist', () => {
      render(<RecentAlerts alerts={sampleAlerts} />);

      expect(screen.getByText('View All')).toBeInTheDocument();
    });

    it('should link View All to alerts page', () => {
      render(<RecentAlerts alerts={sampleAlerts} />);

      const viewAllLink = screen.getByText('View All').closest('a');
      expect(viewAllLink).toHaveAttribute('href', '/alerts');
    });
  });

  // ============================================================================
  // Status Display
  // ============================================================================
  describe('status display', () => {
    it('should show Watching status badge', () => {
      render(<RecentAlerts alerts={[sampleAlerts[0]]} />);

      expect(screen.getByText('Watching')).toBeInTheDocument();
    });

    it('should show Triggered status badge', () => {
      render(<RecentAlerts alerts={[sampleAlerts[1]]} />);

      expect(screen.getByText('Triggered')).toBeInTheDocument();
    });

    it('should show Paused status badge', () => {
      render(<RecentAlerts alerts={[sampleAlerts[2]]} />);

      expect(screen.getByText('Paused')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Alert Details
  // ============================================================================
  describe('alert details', () => {
    it('should display symbol and timeframe', () => {
      render(<RecentAlerts alerts={[sampleAlerts[0]]} />);

      // Symbol appears in title and details - check both exist
      const xauusdElements = screen.getAllByText(/XAUUSD/);
      expect(xauusdElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/H1/)).toBeInTheDocument();
    });

    it('should display target price', () => {
      render(<RecentAlerts alerts={[sampleAlerts[0]]} />);

      expect(screen.getByText(/Target: \$2050\.00/)).toBeInTheDocument();
    });

    it('should display current price', () => {
      render(<RecentAlerts alerts={[sampleAlerts[0]]} />);

      expect(screen.getByText(/Current: \$2040\.50/)).toBeInTheDocument();
    });

    it('should calculate and display distance percentage', () => {
      render(<RecentAlerts alerts={[sampleAlerts[0]]} />);

      // Distance = (2050 - 2040.50) / 2040.50 * 100 = 0.47%
      const distanceElement = screen.getByText(/Distance:/);
      expect(distanceElement).toBeInTheDocument();
    });

    it('should show positive distance in green', () => {
      render(<RecentAlerts alerts={[sampleAlerts[0]]} />);

      // Target > Current, so positive distance
      const distanceText = screen.getByText(/\+0\.47%/);
      expect(distanceText).toHaveClass('text-green-600');
    });

    it('should show negative distance in red', () => {
      const alertWithNegativeDistance = {
        ...sampleAlerts[0],
        targetPrice: 2030.0,
        currentPrice: 2040.5,
      };

      render(<RecentAlerts alerts={[alertWithNegativeDistance]} />);

      // Target < Current, so negative distance
      const distanceText = screen.getByText(/-0\.51%/);
      expect(distanceText).toHaveClass('text-red-600');
    });
  });

  // ============================================================================
  // Empty State
  // ============================================================================
  describe('empty state', () => {
    it('should show empty state when no alerts', () => {
      render(<RecentAlerts alerts={[]} />);

      expect(screen.getByText('No alerts yet')).toBeInTheDocument();
    });

    it('should show CTA message in empty state', () => {
      render(<RecentAlerts alerts={[]} />);

      expect(
        screen.getByText('Set up alerts to get notified of price movements')
      ).toBeInTheDocument();
    });

    it('should show Create Alert button in empty state', () => {
      render(<RecentAlerts alerts={[]} />);

      expect(screen.getByText('Create Your First Alert')).toBeInTheDocument();
    });

    it('should link create button to new alert page', () => {
      render(<RecentAlerts alerts={[]} />);

      const createButton = screen
        .getByText('Create Your First Alert')
        .closest('a');
      expect(createButton).toHaveAttribute('href', '/alerts/new');
    });

    it('should not show View All in empty state', () => {
      render(<RecentAlerts alerts={[]} />);

      expect(screen.queryByText('View All')).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // Max Alerts Limit
  // ============================================================================
  describe('maxAlerts limit', () => {
    const manyAlerts = Array.from({ length: 10 }, (_, i) => ({
      id: `alert-${i}`,
      status: 'watching' as const,
      title: `Alert ${i + 1}`,
      symbol: 'XAUUSD',
      timeframe: 'H1',
      targetPrice: 2000 + i,
      currentPrice: 1990 + i,
      createdAt: new Date().toISOString(),
    }));

    it('should show only 5 alerts by default', () => {
      render(<RecentAlerts alerts={manyAlerts} />);

      expect(screen.getByText('Alert 1')).toBeInTheDocument();
      expect(screen.getByText('Alert 5')).toBeInTheDocument();
      expect(screen.queryByText('Alert 6')).not.toBeInTheDocument();
    });

    it('should respect custom maxAlerts prop', () => {
      render(<RecentAlerts alerts={manyAlerts} maxAlerts={3} />);

      expect(screen.getByText('Alert 1')).toBeInTheDocument();
      expect(screen.getByText('Alert 3')).toBeInTheDocument();
      expect(screen.queryByText('Alert 4')).not.toBeInTheDocument();
    });

    it('should show all alerts when maxAlerts exceeds count', () => {
      render(<RecentAlerts alerts={sampleAlerts} maxAlerts={10} />);

      expect(screen.getByText('XAUUSD Price Alert')).toBeInTheDocument();
      expect(screen.getByText('EURUSD Breakout')).toBeInTheDocument();
      expect(screen.getByText('GBPUSD Support')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Styling
  // ============================================================================
  describe('styling', () => {
    it('should have proper card structure', () => {
      const { container } = render(<RecentAlerts alerts={sampleAlerts} />);

      expect(container.querySelector('.bg-white')).toBeInTheDocument();
    });

    it('should have colored border based on status', () => {
      const { container } = render(<RecentAlerts alerts={[sampleAlerts[0]]} />);

      // Watching status should have blue border
      const alertItem = container.querySelector('.border-l-blue-500');
      expect(alertItem).toBeInTheDocument();
    });

    it('should have green border for triggered status', () => {
      const { container } = render(<RecentAlerts alerts={[sampleAlerts[1]]} />);

      const alertItem = container.querySelector('.border-l-green-500');
      expect(alertItem).toBeInTheDocument();
    });

    it('should have gray border for paused status', () => {
      const { container } = render(<RecentAlerts alerts={[sampleAlerts[2]]} />);

      const alertItem = container.querySelector('.border-l-gray-400');
      expect(alertItem).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Accessibility
  // ============================================================================
  describe('accessibility', () => {
    it('should have accessible alert titles', () => {
      render(<RecentAlerts alerts={sampleAlerts} />);

      sampleAlerts.forEach((alert) => {
        expect(screen.getByText(alert.title)).toBeInTheDocument();
      });
    });

    it('should have proper heading structure', () => {
      render(<RecentAlerts alerts={sampleAlerts} />);

      // The title should be in a heading or title element
      const title = screen.getByText('Recent Alerts');
      expect(title).toBeInTheDocument();
    });
  });
});
