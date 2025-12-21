/**
 * PnLSummaryCards Component Tests
 *
 * Tests for the P&L summary cards component.
 * Part 14: Admin Dashboard Components
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';

import { PnLSummaryCards } from '@/components/admin/pnl-summary-cards';

const defaultProps = {
  grossRevenue: 50000.00,
  discounts: 5000.00,
  netRevenue: 45000.00,
  totalCommissions: 9000.00,
  netProfit: 36000.00,
  profitMargin: 72.0,
};

describe('PnLSummaryCards Component', () => {
  // ============================================================================
  // Basic Rendering
  // ============================================================================
  describe('rendering', () => {
    it('should render three cards', () => {
      const { container } = render(<PnLSummaryCards {...defaultProps} />);
      const cards = container.querySelectorAll('[data-slot="card"]');
      expect(cards.length).toBe(3);
    });

    it('should render Revenue card', () => {
      render(<PnLSummaryCards {...defaultProps} />);
      expect(screen.getByText('Revenue')).toBeInTheDocument();
    });

    it('should render Costs card', () => {
      render(<PnLSummaryCards {...defaultProps} />);
      expect(screen.getByText('Costs')).toBeInTheDocument();
    });

    it('should render Profit card', () => {
      render(<PnLSummaryCards {...defaultProps} />);
      expect(screen.getByText('Profit')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Revenue Section
  // ============================================================================
  describe('revenue section', () => {
    it('should display gross revenue label', () => {
      render(<PnLSummaryCards {...defaultProps} />);
      expect(screen.getByText('Gross Revenue')).toBeInTheDocument();
    });

    it('should display gross revenue value', () => {
      render(<PnLSummaryCards {...defaultProps} />);
      expect(screen.getByText('$50,000.00')).toBeInTheDocument();
    });

    it('should display discounts label', () => {
      render(<PnLSummaryCards {...defaultProps} />);
      expect(screen.getByText('Discounts Given')).toBeInTheDocument();
    });

    it('should display discounts with negative sign', () => {
      render(<PnLSummaryCards {...defaultProps} />);
      expect(screen.getByText('-$5,000.00')).toBeInTheDocument();
    });

    it('should display net revenue label', () => {
      render(<PnLSummaryCards {...defaultProps} />);
      expect(screen.getByText('Net Revenue')).toBeInTheDocument();
    });

    it('should display net revenue value', () => {
      render(<PnLSummaryCards {...defaultProps} />);
      expect(screen.getByText('$45,000.00')).toBeInTheDocument();
    });

    it('should have orange styling for discounts', () => {
      render(<PnLSummaryCards {...defaultProps} />);
      const discountValue = screen.getByText('-$5,000.00');
      expect(discountValue).toHaveClass('text-orange-600');
    });

    it('should have semibold styling for net revenue', () => {
      render(<PnLSummaryCards {...defaultProps} />);
      const netRevenueValue = screen.getByText('$45,000.00');
      expect(netRevenueValue).toHaveClass('font-semibold');
    });
  });

  // ============================================================================
  // Costs Section
  // ============================================================================
  describe('costs section', () => {
    it('should display total commissions label', () => {
      render(<PnLSummaryCards {...defaultProps} />);
      expect(screen.getByText('Total Commissions')).toBeInTheDocument();
    });

    it('should display total commissions value', () => {
      render(<PnLSummaryCards {...defaultProps} />);
      expect(screen.getByText('$9,000.00')).toBeInTheDocument();
    });

    it('should display commission rate', () => {
      render(<PnLSummaryCards {...defaultProps} />);
      expect(screen.getByText('Commission Rate')).toBeInTheDocument();
      expect(screen.getByText('20%')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Profit Section
  // ============================================================================
  describe('profit section', () => {
    it('should display net profit label', () => {
      render(<PnLSummaryCards {...defaultProps} />);
      expect(screen.getByText('Net Profit')).toBeInTheDocument();
    });

    it('should display net profit value', () => {
      render(<PnLSummaryCards {...defaultProps} />);
      expect(screen.getByText('$36,000.00')).toBeInTheDocument();
    });

    it('should display profit margin label', () => {
      render(<PnLSummaryCards {...defaultProps} />);
      expect(screen.getByText('Profit Margin')).toBeInTheDocument();
    });

    it('should display profit margin value', () => {
      render(<PnLSummaryCards {...defaultProps} />);
      expect(screen.getByText('72.0%')).toBeInTheDocument();
    });

    it('should have green styling for positive profit', () => {
      render(<PnLSummaryCards {...defaultProps} />);
      const netProfitValue = screen.getByText('$36,000.00');
      expect(netProfitValue).toHaveClass('text-green-600');
    });

    it('should have green styling for positive margin', () => {
      render(<PnLSummaryCards {...defaultProps} />);
      const marginValue = screen.getByText('72.0%');
      expect(marginValue).toHaveClass('text-green-600');
    });

    it('should have red styling for negative profit', () => {
      render(
        <PnLSummaryCards
          {...defaultProps}
          netProfit={-5000}
          profitMargin={-10}
        />
      );
      // formatCurrency produces $-5,000.00 for negative values
      const netProfitValue = screen.getByText('$-5,000.00');
      expect(netProfitValue).toHaveClass('text-red-600');
    });

    it('should have red styling for negative margin', () => {
      render(
        <PnLSummaryCards
          {...defaultProps}
          netProfit={-5000}
          profitMargin={-10.5}
        />
      );
      const marginValue = screen.getByText('-10.5%');
      expect(marginValue).toHaveClass('text-red-600');
    });
  });

  // ============================================================================
  // Currency Formatting
  // ============================================================================
  describe('currency formatting', () => {
    it('should format with dollar sign', () => {
      render(<PnLSummaryCards {...defaultProps} />);
      expect(screen.getByText('$50,000.00')).toBeInTheDocument();
    });

    it('should format with two decimal places', () => {
      render(
        <PnLSummaryCards
          {...defaultProps}
          grossRevenue={1234.5}
        />
      );
      expect(screen.getByText('$1,234.50')).toBeInTheDocument();
    });

    it('should format with thousand separators', () => {
      render(
        <PnLSummaryCards
          {...defaultProps}
          grossRevenue={1000000}
        />
      );
      expect(screen.getByText('$1,000,000.00')).toBeInTheDocument();
    });

    it('should handle zero values', () => {
      render(
        <PnLSummaryCards
          grossRevenue={0}
          discounts={0}
          netRevenue={0}
          totalCommissions={0}
          netProfit={0}
          profitMargin={0}
        />
      );
      expect(screen.getAllByText('$0.00').length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Percentage Formatting
  // ============================================================================
  describe('percentage formatting', () => {
    it('should format margin with one decimal place', () => {
      // 72.56 rounds to 72.6 (avoiding floating point issues with 72.55)
      render(<PnLSummaryCards {...defaultProps} profitMargin={72.56} />);
      expect(screen.getByText('72.6%')).toBeInTheDocument();
    });

    it('should handle whole number margins', () => {
      render(<PnLSummaryCards {...defaultProps} profitMargin={50} />);
      expect(screen.getByText('50.0%')).toBeInTheDocument();
    });

    it('should handle zero margin', () => {
      render(<PnLSummaryCards {...defaultProps} profitMargin={0} />);
      expect(screen.getByText('0.0%')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Layout
  // ============================================================================
  describe('layout', () => {
    it('should have grid layout', () => {
      const { container } = render(<PnLSummaryCards {...defaultProps} />);
      const grid = container.firstChild;
      expect(grid).toHaveClass('grid');
    });

    it('should have responsive three columns', () => {
      const { container } = render(<PnLSummaryCards {...defaultProps} />);
      const grid = container.firstChild;
      expect(grid).toHaveClass('md:grid-cols-3');
    });

    it('should have gap between cards', () => {
      const { container } = render(<PnLSummaryCards {...defaultProps} />);
      const grid = container.firstChild;
      expect(grid).toHaveClass('gap-4');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================
  describe('edge cases', () => {
    it('should handle all zeros', () => {
      render(
        <PnLSummaryCards
          grossRevenue={0}
          discounts={0}
          netRevenue={0}
          totalCommissions={0}
          netProfit={0}
          profitMargin={0}
        />
      );
      expect(screen.getByText('Revenue')).toBeInTheDocument();
      expect(screen.getByText('Costs')).toBeInTheDocument();
      expect(screen.getByText('Profit')).toBeInTheDocument();
    });

    it('should handle very large amounts', () => {
      render(
        <PnLSummaryCards
          grossRevenue={9999999.99}
          discounts={999999.99}
          netRevenue={9000000}
          totalCommissions={1800000}
          netProfit={7200000}
          profitMargin={80}
        />
      );
      expect(screen.getByText('$9,999,999.99')).toBeInTheDocument();
    });

    it('should handle decimal precision', () => {
      render(
        <PnLSummaryCards
          grossRevenue={1234.567}
          discounts={123.456}
          netRevenue={1111.111}
          totalCommissions={222.222}
          netProfit={888.889}
          profitMargin={80.123}
        />
      );
      // Should format to 2 decimal places
      expect(screen.getByText('$1,234.57')).toBeInTheDocument();
    });

    it('should handle exactly zero profit with green styling', () => {
      render(<PnLSummaryCards {...defaultProps} netProfit={0} profitMargin={0} />);
      const zeroProfit = screen.getByText('$0.00');
      expect(zeroProfit).toHaveClass('text-green-600');
    });
  });
});
