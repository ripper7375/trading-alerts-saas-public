/**
 * PnLBreakdownTable Component Tests
 *
 * Tests for the P&L breakdown table component.
 * Part 14: Admin Dashboard Components
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';

import { PnLBreakdownTable } from '@/components/admin/pnl-breakdown-table';

const mockData = [
  {
    month: 'January 2024',
    sales: 150,
    grossRevenue: 45000,
    discounts: 4500,
    netRevenue: 40500,
    commissions: 8100,
    profit: 32400,
    margin: 80.0,
  },
  {
    month: 'February 2024',
    sales: 175,
    grossRevenue: 52500,
    discounts: 5250,
    netRevenue: 47250,
    commissions: 9450,
    profit: 37800,
    margin: 80.0,
  },
];

describe('PnLBreakdownTable Component', () => {
  // ============================================================================
  // Basic Rendering
  // ============================================================================
  describe('rendering', () => {
    it('should render the table', () => {
      render(<PnLBreakdownTable data={mockData} />);
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('should render table headers', () => {
      render(<PnLBreakdownTable data={mockData} />);
      expect(screen.getByText('Month')).toBeInTheDocument();
      expect(screen.getByText('Sales')).toBeInTheDocument();
      expect(screen.getByText('Gross Revenue')).toBeInTheDocument();
      expect(screen.getByText('Discounts')).toBeInTheDocument();
      expect(screen.getByText('Net Revenue')).toBeInTheDocument();
      expect(screen.getByText('Commissions')).toBeInTheDocument();
      expect(screen.getByText('Profit')).toBeInTheDocument();
      expect(screen.getByText('Margin')).toBeInTheDocument();
    });

    it('should render month names', () => {
      render(<PnLBreakdownTable data={mockData} />);
      expect(screen.getByText('January 2024')).toBeInTheDocument();
      expect(screen.getByText('February 2024')).toBeInTheDocument();
    });

    it('should render sales counts', () => {
      render(<PnLBreakdownTable data={mockData} />);
      expect(screen.getByText('150')).toBeInTheDocument();
      expect(screen.getByText('175')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Currency Formatting
  // ============================================================================
  describe('currency formatting', () => {
    it('should format gross revenue with dollar sign', () => {
      render(<PnLBreakdownTable data={mockData} />);
      expect(screen.getByText('$45,000.00')).toBeInTheDocument();
      expect(screen.getByText('$52,500.00')).toBeInTheDocument();
    });

    it('should format discounts with negative sign', () => {
      render(<PnLBreakdownTable data={mockData} />);
      expect(screen.getByText('-$4,500.00')).toBeInTheDocument();
      expect(screen.getByText('-$5,250.00')).toBeInTheDocument();
    });

    it('should format net revenue', () => {
      render(<PnLBreakdownTable data={mockData} />);
      expect(screen.getByText('$40,500.00')).toBeInTheDocument();
      expect(screen.getByText('$47,250.00')).toBeInTheDocument();
    });

    it('should format commissions with negative sign', () => {
      render(<PnLBreakdownTable data={mockData} />);
      expect(screen.getByText('-$8,100.00')).toBeInTheDocument();
      expect(screen.getByText('-$9,450.00')).toBeInTheDocument();
    });

    it('should format profit', () => {
      render(<PnLBreakdownTable data={mockData} />);
      expect(screen.getByText('$32,400.00')).toBeInTheDocument();
      expect(screen.getByText('$37,800.00')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Margin Formatting
  // ============================================================================
  describe('margin formatting', () => {
    it('should format margin with percentage', () => {
      render(<PnLBreakdownTable data={mockData} />);
      expect(screen.getAllByText('80.0%').length).toBeGreaterThan(0);
    });

    it('should show negative margin correctly', () => {
      const dataWithNegativeMargin = [{ ...mockData[0], margin: -10.5 }];
      render(<PnLBreakdownTable data={dataWithNegativeMargin} />);
      expect(screen.getByText('-10.5%')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Color Coding
  // ============================================================================
  describe('color coding', () => {
    it('should have orange color for discounts', () => {
      render(<PnLBreakdownTable data={mockData} />);
      const discounts = screen.getByText('-$4,500.00');
      expect(discounts).toHaveClass('text-orange-600');
    });

    it('should have orange color for commissions', () => {
      render(<PnLBreakdownTable data={mockData} />);
      const commissions = screen.getByText('-$8,100.00');
      expect(commissions).toHaveClass('text-orange-600');
    });

    it('should have green color for positive profit', () => {
      render(<PnLBreakdownTable data={mockData} />);
      const profit = screen.getByText('$32,400.00');
      expect(profit).toHaveClass('text-green-600');
    });

    it('should have red color for negative profit', () => {
      const dataWithNegativeProfit = [{ ...mockData[0], profit: -5000 }];
      render(<PnLBreakdownTable data={dataWithNegativeProfit} />);
      // Value appears in both data row and total row
      const profits = screen.getAllByText('$-5,000.00');
      expect(profits[0]).toHaveClass('text-red-600');
    });

    it('should have green color for positive margin', () => {
      render(<PnLBreakdownTable data={mockData} />);
      const margins = screen.getAllByText('80.0%');
      margins.forEach((margin) => {
        expect(margin).toHaveClass('text-green-600');
      });
    });

    it('should have red color for negative margin', () => {
      const dataWithNegativeMargin = [{ ...mockData[0], margin: -15.0 }];
      render(<PnLBreakdownTable data={dataWithNegativeMargin} />);
      const margin = screen.getByText('-15.0%');
      expect(margin).toHaveClass('text-red-600');
    });
  });

  // ============================================================================
  // Totals Row
  // ============================================================================
  describe('totals row', () => {
    it('should render Total label', () => {
      render(<PnLBreakdownTable data={mockData} />);
      expect(screen.getByText('Total')).toBeInTheDocument();
    });

    it('should calculate total sales', () => {
      render(<PnLBreakdownTable data={mockData} />);
      // 150 + 175 = 325
      expect(screen.getByText('325')).toBeInTheDocument();
    });

    it('should calculate total gross revenue', () => {
      render(<PnLBreakdownTable data={mockData} />);
      // 45000 + 52500 = 97500
      expect(screen.getByText('$97,500.00')).toBeInTheDocument();
    });

    it('should calculate total discounts', () => {
      render(<PnLBreakdownTable data={mockData} />);
      // 4500 + 5250 = 9750
      expect(screen.getByText('-$9,750.00')).toBeInTheDocument();
    });

    it('should calculate total net revenue', () => {
      render(<PnLBreakdownTable data={mockData} />);
      // 40500 + 47250 = 87750
      expect(screen.getByText('$87,750.00')).toBeInTheDocument();
    });

    it('should calculate total commissions', () => {
      render(<PnLBreakdownTable data={mockData} />);
      // 8100 + 9450 = 17550
      expect(screen.getByText('-$17,550.00')).toBeInTheDocument();
    });

    it('should calculate total profit', () => {
      render(<PnLBreakdownTable data={mockData} />);
      // 32400 + 37800 = 70200
      expect(screen.getByText('$70,200.00')).toBeInTheDocument();
    });

    it('should show dash for total margin', () => {
      render(<PnLBreakdownTable data={mockData} />);
      expect(screen.getByText('-')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Empty State
  // ============================================================================
  describe('empty state', () => {
    it('should show empty message when no data', () => {
      render(<PnLBreakdownTable data={[]} />);
      expect(
        screen.getByText('No data available for this period')
      ).toBeInTheDocument();
    });

    it('should still render table structure when empty', () => {
      render(<PnLBreakdownTable data={[]} />);
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Table Structure
  // ============================================================================
  describe('table structure', () => {
    it('should have horizontal scroll wrapper', () => {
      const { container } = render(<PnLBreakdownTable data={mockData} />);
      expect(container.querySelector('.overflow-x-auto')).toBeInTheDocument();
    });

    it('should have styled header row', () => {
      const { container } = render(<PnLBreakdownTable data={mockData} />);
      const thead = container.querySelector('thead');
      expect(thead).toHaveClass('border-b', 'bg-muted/50');
    });

    it('should have styled footer row', () => {
      const { container } = render(<PnLBreakdownTable data={mockData} />);
      const tfoot = container.querySelector('tfoot');
      expect(tfoot).toHaveClass('border-t', 'bg-muted/50', 'font-medium');
    });

    it('should have hover effect on data rows', () => {
      const { container } = render(<PnLBreakdownTable data={mockData} />);
      const rows = container.querySelectorAll('tbody tr');
      rows.forEach((row) => {
        expect(row).toHaveClass('hover:bg-muted/25');
      });
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================
  describe('edge cases', () => {
    it('should handle zero values', () => {
      const zeroData = [
        {
          month: 'March 2024',
          sales: 0,
          grossRevenue: 0,
          discounts: 0,
          netRevenue: 0,
          commissions: 0,
          profit: 0,
          margin: 0,
        },
      ];
      render(<PnLBreakdownTable data={zeroData} />);
      expect(screen.getByText('March 2024')).toBeInTheDocument();
      expect(screen.getAllByText('$0.00').length).toBeGreaterThan(0);
    });

    it('should handle very large numbers', () => {
      const largeData = [
        {
          month: 'April 2024',
          sales: 10000,
          grossRevenue: 9999999.99,
          discounts: 999999.99,
          netRevenue: 9000000,
          commissions: 1800000,
          profit: 7200000,
          margin: 80.0,
        },
      ];
      render(<PnLBreakdownTable data={largeData} />);
      // May appear multiple times due to totals row
      expect(screen.getAllByText('$9,999,999.99').length).toBeGreaterThan(0);
    });

    it('should handle single row', () => {
      render(<PnLBreakdownTable data={[mockData[0]]} />);
      expect(screen.getByText('January 2024')).toBeInTheDocument();
      expect(screen.queryByText('February 2024')).not.toBeInTheDocument();
    });
  });
});
