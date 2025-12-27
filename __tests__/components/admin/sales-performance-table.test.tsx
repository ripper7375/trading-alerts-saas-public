/**
 * SalesPerformanceTable Component Tests
 *
 * Tests for the sales performance table component.
 * Part 14: Admin Dashboard Components
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';

import { SalesPerformanceTable } from '@/components/admin/sales-performance-table';

const mockAffiliates = [
  {
    id: 'aff-1',
    name: 'John Smith',
    email: 'john@example.com',
    sales: 150,
    conversionRate: 15.5,
    commissionsEarned: 4500.0,
    rank: 1,
  },
  {
    id: 'aff-2',
    name: 'Jane Doe',
    email: 'jane@example.com',
    sales: 120,
    conversionRate: 12.3,
    commissionsEarned: 3600.0,
    rank: 2,
  },
  {
    id: 'aff-3',
    name: 'Bob Wilson',
    email: 'bob@example.com',
    sales: 100,
    conversionRate: 10.0,
    commissionsEarned: 3000.0,
    rank: 3,
  },
  {
    id: 'aff-4',
    name: 'Alice Brown',
    email: 'alice@example.com',
    sales: 80,
    conversionRate: 8.5,
    commissionsEarned: 2400.0,
    rank: 4,
  },
];

describe('SalesPerformanceTable Component', () => {
  // ============================================================================
  // Basic Rendering
  // ============================================================================
  describe('rendering', () => {
    it('should render the table', () => {
      render(<SalesPerformanceTable affiliates={mockAffiliates} />);
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('should render table headers', () => {
      render(<SalesPerformanceTable affiliates={mockAffiliates} />);
      expect(screen.getByText('Rank')).toBeInTheDocument();
      expect(screen.getByText('Affiliate')).toBeInTheDocument();
      expect(screen.getByText('Sales')).toBeInTheDocument();
      expect(screen.getByText('Conversion Rate')).toBeInTheDocument();
      expect(screen.getByText('Commissions')).toBeInTheDocument();
    });

    it('should render affiliate names', () => {
      render(<SalesPerformanceTable affiliates={mockAffiliates} />);
      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('Bob Wilson')).toBeInTheDocument();
      expect(screen.getByText('Alice Brown')).toBeInTheDocument();
    });

    it('should render affiliate emails', () => {
      render(<SalesPerformanceTable affiliates={mockAffiliates} />);
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Rank Badges
  // ============================================================================
  describe('rank badges', () => {
    it('should display 1st place badge with gold medal', () => {
      render(<SalesPerformanceTable affiliates={mockAffiliates} />);
      expect(screen.getByText('🥇 1st')).toBeInTheDocument();
    });

    it('should display 2nd place badge with silver medal', () => {
      render(<SalesPerformanceTable affiliates={mockAffiliates} />);
      expect(screen.getByText('🥈 2nd')).toBeInTheDocument();
    });

    it('should display 3rd place badge with bronze medal', () => {
      render(<SalesPerformanceTable affiliates={mockAffiliates} />);
      expect(screen.getByText('🥉 3rd')).toBeInTheDocument();
    });

    it('should display numeric rank for 4th and beyond', () => {
      render(<SalesPerformanceTable affiliates={mockAffiliates} />);
      expect(screen.getByText('#4')).toBeInTheDocument();
    });

    it('should have gold styling for 1st place', () => {
      render(<SalesPerformanceTable affiliates={mockAffiliates} />);
      const firstBadge = screen.getByText('🥇 1st');
      expect(firstBadge).toHaveClass('bg-yellow-400', 'text-yellow-900');
    });

    it('should have silver styling for 2nd place', () => {
      render(<SalesPerformanceTable affiliates={mockAffiliates} />);
      const secondBadge = screen.getByText('🥈 2nd');
      expect(secondBadge).toHaveClass('bg-gray-300', 'text-gray-900');
    });

    it('should have bronze styling for 3rd place', () => {
      render(<SalesPerformanceTable affiliates={mockAffiliates} />);
      const thirdBadge = screen.getByText('🥉 3rd');
      expect(thirdBadge).toHaveClass('bg-orange-400', 'text-orange-900');
    });
  });

  // ============================================================================
  // Sales Data
  // ============================================================================
  describe('sales data', () => {
    it('should display sales counts', () => {
      render(<SalesPerformanceTable affiliates={mockAffiliates} />);
      expect(screen.getByText('150')).toBeInTheDocument();
      expect(screen.getByText('120')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('80')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Conversion Rate
  // ============================================================================
  describe('conversion rate', () => {
    it('should display conversion rates with percentage', () => {
      render(<SalesPerformanceTable affiliates={mockAffiliates} />);
      expect(screen.getByText('15.5%')).toBeInTheDocument();
      expect(screen.getByText('12.3%')).toBeInTheDocument();
      expect(screen.getByText('10.0%')).toBeInTheDocument();
      expect(screen.getByText('8.5%')).toBeInTheDocument();
    });

    it('should have green color for conversion rate >= 10%', () => {
      render(<SalesPerformanceTable affiliates={mockAffiliates} />);
      const highRate = screen.getByText('15.5%');
      expect(highRate).toHaveClass('text-green-600');
    });

    it('should not have green color for conversion rate < 10%', () => {
      render(<SalesPerformanceTable affiliates={mockAffiliates} />);
      const lowRate = screen.getByText('8.5%');
      expect(lowRate).not.toHaveClass('text-green-600');
    });
  });

  // ============================================================================
  // Commissions
  // ============================================================================
  describe('commissions', () => {
    it('should display commissions with currency formatting', () => {
      render(<SalesPerformanceTable affiliates={mockAffiliates} />);
      expect(screen.getByText('$4,500.00')).toBeInTheDocument();
      expect(screen.getByText('$3,600.00')).toBeInTheDocument();
      expect(screen.getByText('$3,000.00')).toBeInTheDocument();
      expect(screen.getByText('$2,400.00')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Empty State
  // ============================================================================
  describe('empty state', () => {
    it('should show empty message when no affiliates', () => {
      render(<SalesPerformanceTable affiliates={[]} />);
      expect(
        screen.getByText('No performance data available')
      ).toBeInTheDocument();
    });

    it('should still render table structure when empty', () => {
      render(<SalesPerformanceTable affiliates={[]} />);
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Table Structure
  // ============================================================================
  describe('table structure', () => {
    it('should have horizontal scroll wrapper', () => {
      const { container } = render(
        <SalesPerformanceTable affiliates={mockAffiliates} />
      );
      expect(container.querySelector('.overflow-x-auto')).toBeInTheDocument();
    });

    it('should have styled header row', () => {
      const { container } = render(
        <SalesPerformanceTable affiliates={mockAffiliates} />
      );
      const thead = container.querySelector('thead');
      expect(thead).toHaveClass('border-b', 'bg-muted/50');
    });

    it('should have hover effect on data rows', () => {
      const { container } = render(
        <SalesPerformanceTable affiliates={mockAffiliates} />
      );
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
    it('should handle single affiliate', () => {
      render(<SalesPerformanceTable affiliates={[mockAffiliates[0]]} />);
      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.getByText('🥇 1st')).toBeInTheDocument();
    });

    it('should handle affiliate with long name', () => {
      const longNameAffiliate = [
        {
          ...mockAffiliates[0],
          name: 'Very Long Name That Might Cause Layout Issues',
        },
      ];
      render(<SalesPerformanceTable affiliates={longNameAffiliate} />);
      expect(
        screen.getByText('Very Long Name That Might Cause Layout Issues')
      ).toBeInTheDocument();
    });

    it('should handle zero sales', () => {
      const zeroSalesAffiliate = [
        {
          ...mockAffiliates[0],
          sales: 0,
          conversionRate: 0,
          commissionsEarned: 0,
        },
      ];
      render(<SalesPerformanceTable affiliates={zeroSalesAffiliate} />);
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('0.0%')).toBeInTheDocument();
      expect(screen.getByText('$0.00')).toBeInTheDocument();
    });

    it('should handle large commission amounts', () => {
      const largeCommissionAffiliate = [
        {
          ...mockAffiliates[0],
          commissionsEarned: 999999.99,
        },
      ];
      render(<SalesPerformanceTable affiliates={largeCommissionAffiliate} />);
      expect(screen.getByText('$999,999.99')).toBeInTheDocument();
    });

    it('should handle 5th rank and beyond', () => {
      const fifthRankAffiliate = [
        {
          ...mockAffiliates[0],
          rank: 5,
        },
      ];
      render(<SalesPerformanceTable affiliates={fifthRankAffiliate} />);
      expect(screen.getByText('#5')).toBeInTheDocument();
    });
  });
});
