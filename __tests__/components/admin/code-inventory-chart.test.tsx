/**
 * CodeInventoryChart Component Tests
 *
 * Tests for the code inventory chart component.
 * Part 14: Admin Dashboard Components
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';

import { CodeInventoryChart } from '@/components/admin/code-inventory-chart';

const mockData = {
  active: 500,
  used: 300,
  expired: 100,
  cancelled: 50,
};

describe('CodeInventoryChart Component', () => {
  // ============================================================================
  // Basic Rendering
  // ============================================================================
  describe('rendering', () => {
    it('should render the card title', () => {
      render(<CodeInventoryChart data={mockData} />);
      expect(screen.getByText('Code Inventory')).toBeInTheDocument();
    });

    it('should render total codes', () => {
      render(<CodeInventoryChart data={mockData} />);
      expect(screen.getByText('Total Codes:')).toBeInTheDocument();
      expect(screen.getByText('950')).toBeInTheDocument();
    });

    it('should render all segments', () => {
      render(<CodeInventoryChart data={mockData} />);
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Used')).toBeInTheDocument();
      expect(screen.getByText('Expired')).toBeInTheDocument();
      expect(screen.getByText('Cancelled')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Segment Values and Percentages
  // ============================================================================
  describe('segment values', () => {
    it('should display Active segment count and percentage', () => {
      render(<CodeInventoryChart data={mockData} />);
      // 500/950 = 52.6%
      expect(screen.getByText(/500.*52\.6%/)).toBeInTheDocument();
    });

    it('should display Used segment count and percentage', () => {
      render(<CodeInventoryChart data={mockData} />);
      // 300/950 = 31.6%
      expect(screen.getByText(/300.*31\.6%/)).toBeInTheDocument();
    });

    it('should display Expired segment count and percentage', () => {
      render(<CodeInventoryChart data={mockData} />);
      // 100/950 = 10.5%
      expect(screen.getByText(/100.*10\.5%/)).toBeInTheDocument();
    });

    it('should display Cancelled segment count and percentage', () => {
      render(<CodeInventoryChart data={mockData} />);
      // 50/950 = 5.3%
      expect(screen.getByText(/50.*5\.3%/)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Color Coding
  // ============================================================================
  describe('color coding', () => {
    it('should have green text for Active', () => {
      render(<CodeInventoryChart data={mockData} />);
      const activeLabel = screen.getByText('Active');
      expect(activeLabel).toHaveClass('text-green-600');
    });

    it('should have blue text for Used', () => {
      render(<CodeInventoryChart data={mockData} />);
      const usedLabel = screen.getByText('Used');
      expect(usedLabel).toHaveClass('text-blue-600');
    });

    it('should have orange text for Expired', () => {
      render(<CodeInventoryChart data={mockData} />);
      const expiredLabel = screen.getByText('Expired');
      expect(expiredLabel).toHaveClass('text-orange-600');
    });

    it('should have red text for Cancelled', () => {
      render(<CodeInventoryChart data={mockData} />);
      const cancelledLabel = screen.getByText('Cancelled');
      expect(cancelledLabel).toHaveClass('text-red-600');
    });
  });

  // ============================================================================
  // Utilization Rate
  // ============================================================================
  describe('utilization rate', () => {
    it('should display Utilization Rate label', () => {
      render(<CodeInventoryChart data={mockData} />);
      expect(screen.getByText('Utilization Rate:')).toBeInTheDocument();
    });

    it('should calculate utilization rate correctly', () => {
      render(<CodeInventoryChart data={mockData} />);
      // used / (active + used + expired) = 300 / (500 + 300 + 100) = 33.3%
      expect(screen.getByText('33.3%')).toBeInTheDocument();
    });

    it('should display utilization description', () => {
      render(<CodeInventoryChart data={mockData} />);
      expect(
        screen.getByText('Percentage of distributed codes that have been used')
      ).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Empty State
  // ============================================================================
  describe('empty state', () => {
    it('should show empty message when all values are zero', () => {
      render(
        <CodeInventoryChart
          data={{ active: 0, used: 0, expired: 0, cancelled: 0 }}
        />
      );
      expect(screen.getByText('No codes distributed yet')).toBeInTheDocument();
    });

    it('should still render card title in empty state', () => {
      render(
        <CodeInventoryChart
          data={{ active: 0, used: 0, expired: 0, cancelled: 0 }}
        />
      );
      expect(screen.getByText('Code Inventory')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Filtering Zero Segments
  // ============================================================================
  describe('zero segment filtering', () => {
    it('should not display segments with zero values', () => {
      render(
        <CodeInventoryChart
          data={{ active: 100, used: 50, expired: 0, cancelled: 0 }}
        />
      );
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Used')).toBeInTheDocument();
      expect(screen.queryByText('Expired')).not.toBeInTheDocument();
      expect(screen.queryByText('Cancelled')).not.toBeInTheDocument();
    });

    it('should handle only one non-zero segment', () => {
      render(
        <CodeInventoryChart
          data={{ active: 100, used: 0, expired: 0, cancelled: 0 }}
        />
      );
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText(/100.*100\.0%/)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Bar Chart Rendering
  // ============================================================================
  describe('bar chart', () => {
    it('should render progress bars', () => {
      const { container } = render(<CodeInventoryChart data={mockData} />);
      const bars = container.querySelectorAll('.rounded-full.bg-muted');
      expect(bars.length).toBeGreaterThan(0);
    });

    it('should have transition animation class on bars', () => {
      const { container } = render(<CodeInventoryChart data={mockData} />);
      const animatedBars = container.querySelectorAll(
        '.transition-all.duration-500'
      );
      expect(animatedBars.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Large Numbers
  // ============================================================================
  describe('large numbers', () => {
    it('should format large numbers with locale string', () => {
      render(
        <CodeInventoryChart
          data={{ active: 10000, used: 5000, expired: 2000, cancelled: 1000 }}
        />
      );
      expect(screen.getByText('18,000')).toBeInTheDocument();
    });

    it('should handle very large total', () => {
      render(
        <CodeInventoryChart
          data={{
            active: 500000,
            used: 300000,
            expired: 100000,
            cancelled: 50000,
          }}
        />
      );
      expect(screen.getByText('950,000')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================
  describe('edge cases', () => {
    it('should handle all values equal', () => {
      render(
        <CodeInventoryChart
          data={{ active: 100, used: 100, expired: 100, cancelled: 100 }}
        />
      );
      expect(screen.getByText('400')).toBeInTheDocument();
      // Each should be 25%
      const percentages = screen.getAllByText(/25\.0%/);
      expect(percentages.length).toBe(4);
    });

    it('should handle single non-zero value', () => {
      render(
        <CodeInventoryChart
          data={{ active: 0, used: 0, expired: 0, cancelled: 100 }}
        />
      );
      expect(screen.getByText('Cancelled')).toBeInTheDocument();
      expect(screen.getByText(/100\.0%/)).toBeInTheDocument();
    });
  });
});
