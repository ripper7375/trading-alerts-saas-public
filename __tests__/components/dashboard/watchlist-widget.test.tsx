/**
 * WatchlistWidget Component Tests
 *
 * Tests for the dashboard watchlist widget.
 * Part 8: Dashboard & Layout Components
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';

import { WatchlistWidget } from '@/components/dashboard/watchlist-widget';

// Mock next/link
jest.mock('next/link', () => {
  return function MockLink({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  };
});

// Sample watchlist data
const sampleItems = [
  {
    id: 'item-1',
    symbol: 'XAUUSD',
    timeframe: 'H1',
    currentPrice: 2040.5,
    change: 15.2,
    changePercent: 0.75,
    status: 'approaching' as const,
    lastUpdated: '2024-01-15T10:00:00Z',
  },
  {
    id: 'item-2',
    symbol: 'EURUSD',
    timeframe: 'M15',
    currentPrice: 1.085,
    change: -0.002,
    changePercent: -0.18,
    status: 'neutral' as const,
    lastUpdated: '2024-01-15T09:45:00Z',
  },
  {
    id: 'item-3',
    symbol: 'GBPUSD',
    timeframe: 'D1',
    currentPrice: 1.265,
    change: 0.005,
    changePercent: 0.4,
    status: 'away' as const,
    lastUpdated: '2024-01-15T09:30:00Z',
  },
];

describe('WatchlistWidget Component', () => {
  // ============================================================================
  // Basic Rendering
  // ============================================================================
  describe('rendering', () => {
    it('should render the component title', () => {
      render(<WatchlistWidget items={sampleItems} />);

      expect(screen.getByText('Watchlist')).toBeInTheDocument();
    });

    it('should render watchlist items when provided', () => {
      render(<WatchlistWidget items={sampleItems} />);

      expect(screen.getByText('XAUUSD')).toBeInTheDocument();
      expect(screen.getByText('EURUSD')).toBeInTheDocument();
      expect(screen.getByText('GBPUSD')).toBeInTheDocument();
    });

    it('should render Add button', () => {
      render(<WatchlistWidget items={sampleItems} />);

      expect(screen.getByText('Add')).toBeInTheDocument();
    });

    it('should link Add button to add page', () => {
      render(<WatchlistWidget items={sampleItems} />);

      const addLink = screen.getByText('Add').closest('a');
      expect(addLink).toHaveAttribute('href', '/dashboard/watchlist/add');
    });

    it('should render View All button when items exist', () => {
      render(<WatchlistWidget items={sampleItems} />);

      expect(screen.getByText('View All')).toBeInTheDocument();
    });

    it('should link View All to watchlist page', () => {
      render(<WatchlistWidget items={sampleItems} />);

      const viewAllLink = screen.getByText('View All').closest('a');
      expect(viewAllLink).toHaveAttribute('href', '/dashboard/watchlist');
    });
  });

  // ============================================================================
  // Item Details
  // ============================================================================
  describe('item details', () => {
    it('should display symbol', () => {
      render(<WatchlistWidget items={[sampleItems[0]]} />);

      expect(screen.getByText('XAUUSD')).toBeInTheDocument();
    });

    it('should display timeframe', () => {
      render(<WatchlistWidget items={[sampleItems[0]]} />);

      expect(screen.getByText('H1')).toBeInTheDocument();
    });

    it('should display current price formatted', () => {
      render(<WatchlistWidget items={[sampleItems[0]]} />);

      expect(screen.getByText('$2040.50')).toBeInTheDocument();
    });

    it('should display positive change percent in green', () => {
      render(<WatchlistWidget items={[sampleItems[0]]} />);

      const changeText = screen.getByText('+0.75%');
      // Class is on parent div, not the span
      expect(changeText.closest('div')).toHaveClass('text-green-600');
    });

    it('should display negative change percent in red', () => {
      render(<WatchlistWidget items={[sampleItems[1]]} />);

      const changeText = screen.getByText('-0.18%');
      // Class is on parent div, not the span
      expect(changeText.closest('div')).toHaveClass('text-red-600');
    });
  });

  // ============================================================================
  // Status Badges
  // ============================================================================
  describe('status badges', () => {
    it('should show Approaching badge for approaching status', () => {
      render(<WatchlistWidget items={[sampleItems[0]]} />);

      expect(screen.getByText('Approaching')).toBeInTheDocument();
    });

    it('should not show badge for neutral status', () => {
      render(<WatchlistWidget items={[sampleItems[1]]} />);

      expect(screen.queryByText('Approaching')).not.toBeInTheDocument();
    });

    it('should not show badge for away status', () => {
      render(<WatchlistWidget items={[sampleItems[2]]} />);

      expect(screen.queryByText('Approaching')).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // Links
  // ============================================================================
  describe('navigation links', () => {
    it('should link items to chart page with symbol and timeframe', () => {
      render(<WatchlistWidget items={[sampleItems[0]]} />);

      const itemLink = screen.getByText('XAUUSD').closest('a');
      expect(itemLink).toHaveAttribute(
        'href',
        '/dashboard/charts?symbol=XAUUSD&timeframe=H1'
      );
    });
  });

  // ============================================================================
  // Empty State
  // ============================================================================
  describe('empty state', () => {
    it('should show empty state when no items', () => {
      render(<WatchlistWidget items={[]} />);

      expect(screen.getByText('No symbols in watchlist')).toBeInTheDocument();
    });

    it('should show CTA message in empty state', () => {
      render(<WatchlistWidget items={[]} />);

      expect(
        screen.getByText('Add symbols to track their price movements')
      ).toBeInTheDocument();
    });

    it('should show Add Symbol button in empty state', () => {
      render(<WatchlistWidget items={[]} />);

      expect(screen.getByText('Add Symbol')).toBeInTheDocument();
    });

    it('should link add button to add page in empty state', () => {
      render(<WatchlistWidget items={[]} />);

      const addButton = screen.getByText('Add Symbol').closest('a');
      expect(addButton).toHaveAttribute('href', '/dashboard/watchlist/add');
    });

    it('should not show View All in empty state', () => {
      render(<WatchlistWidget items={[]} />);

      expect(screen.queryByText('View All')).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // Max Items Limit
  // ============================================================================
  describe('maxItems limit', () => {
    const manyItems = Array.from({ length: 10 }, (_, i) => ({
      id: `item-${i}`,
      symbol: `SYM${i}`,
      timeframe: 'H1',
      currentPrice: 100 + i,
      change: i,
      changePercent: i * 0.1,
      lastUpdated: new Date().toISOString(),
    }));

    it('should show only 5 items by default', () => {
      render(<WatchlistWidget items={manyItems} />);

      expect(screen.getByText('SYM0')).toBeInTheDocument();
      expect(screen.getByText('SYM4')).toBeInTheDocument();
      expect(screen.queryByText('SYM5')).not.toBeInTheDocument();
    });

    it('should respect custom maxItems prop', () => {
      render(<WatchlistWidget items={manyItems} maxItems={3} />);

      expect(screen.getByText('SYM0')).toBeInTheDocument();
      expect(screen.getByText('SYM2')).toBeInTheDocument();
      expect(screen.queryByText('SYM3')).not.toBeInTheDocument();
    });

    it('should show all items when maxItems exceeds count', () => {
      render(<WatchlistWidget items={sampleItems} maxItems={10} />);

      expect(screen.getByText('XAUUSD')).toBeInTheDocument();
      expect(screen.getByText('EURUSD')).toBeInTheDocument();
      expect(screen.getByText('GBPUSD')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Price Update Indicator
  // ============================================================================
  describe('price update indicator', () => {
    it('should show prices updated message when items exist', () => {
      render(<WatchlistWidget items={sampleItems} />);

      expect(
        screen.getByText('Prices updated automatically')
      ).toBeInTheDocument();
    });

    it('should not show update message in empty state', () => {
      render(<WatchlistWidget items={[]} />);

      expect(
        screen.queryByText('Prices updated automatically')
      ).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // Styling
  // ============================================================================
  describe('styling', () => {
    it('should have proper card structure', () => {
      const { container } = render(<WatchlistWidget items={sampleItems} />);

      expect(container.querySelector('.bg-white')).toBeInTheDocument();
    });

    it('should have hover state on items', () => {
      const { container } = render(<WatchlistWidget items={sampleItems} />);

      const itemLink = container.querySelector('a[href*="charts"]');
      expect(itemLink).toHaveClass('hover:bg-gray-50');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================
  describe('edge cases', () => {
    it('should handle zero change', () => {
      const zeroChangeItem = {
        ...sampleItems[0],
        change: 0,
        changePercent: 0,
      };

      render(<WatchlistWidget items={[zeroChangeItem]} />);

      expect(screen.getByText('+0.00%')).toBeInTheDocument();
    });

    it('should handle very large prices', () => {
      const largePriceItem = {
        ...sampleItems[0],
        currentPrice: 99999.99,
      };

      render(<WatchlistWidget items={[largePriceItem]} />);

      expect(screen.getByText('$99999.99')).toBeInTheDocument();
    });

    it('should handle very small prices', () => {
      const smallPriceItem = {
        ...sampleItems[0],
        currentPrice: 0.01,
      };

      render(<WatchlistWidget items={[smallPriceItem]} />);

      expect(screen.getByText('$0.01')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Accessibility
  // ============================================================================
  describe('accessibility', () => {
    it('should have accessible symbol names', () => {
      render(<WatchlistWidget items={sampleItems} />);

      sampleItems.forEach((item) => {
        expect(screen.getByText(item.symbol)).toBeInTheDocument();
      });
    });

    it('should have sr-only text for Add button on mobile', () => {
      render(<WatchlistWidget items={sampleItems} />);

      const srOnlyText = screen.getByText('Add');
      expect(srOnlyText).toBeInTheDocument();
    });
  });
});
