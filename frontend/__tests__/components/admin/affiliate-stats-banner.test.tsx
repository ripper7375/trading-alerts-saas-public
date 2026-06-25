/**
 * AffiliateStatsBanner Component Tests
 *
 * Tests for the affiliate program statistics banner.
 * Part 14: Admin Dashboard Components
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';

import { AffiliateStatsBanner } from '@/components/admin/affiliate-stats-banner';

const defaultProps = {
  totalAffiliates: 50,
  activeAffiliates: 35,
  pendingAffiliates: 15,
  totalCommissionsPaid: 12500.0,
  pendingCommissions: 2500.0,
  totalCodesDistributed: 200,
  totalCodesUsed: 150,
};

describe('AffiliateStatsBanner Component', () => {
  // ============================================================================
  // Basic Rendering
  // ============================================================================
  describe('rendering', () => {
    it('should render three stat cards', () => {
      const { container } = render(<AffiliateStatsBanner {...defaultProps} />);
      const cards = container.querySelectorAll('[data-slot="card"]');
      expect(cards.length).toBe(3);
    });

    it('should render Total Affiliates stat', () => {
      render(<AffiliateStatsBanner {...defaultProps} />);
      expect(screen.getByText('Total Affiliates')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
    });

    it('should render Commissions Paid stat', () => {
      render(<AffiliateStatsBanner {...defaultProps} />);
      expect(screen.getByText('Commissions Paid')).toBeInTheDocument();
    });

    it('should render Codes Distributed stat', () => {
      render(<AffiliateStatsBanner {...defaultProps} />);
      expect(screen.getByText('Codes Distributed')).toBeInTheDocument();
      expect(screen.getByText('200')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Affiliate Statistics
  // ============================================================================
  describe('affiliate statistics', () => {
    it('should display total affiliate count', () => {
      render(<AffiliateStatsBanner {...defaultProps} />);
      expect(screen.getByText('50')).toBeInTheDocument();
    });

    it('should display active and pending breakdown', () => {
      render(<AffiliateStatsBanner {...defaultProps} />);
      expect(screen.getByText('35 active, 15 pending')).toBeInTheDocument();
    });

    it('should handle zero affiliates', () => {
      render(
        <AffiliateStatsBanner
          {...defaultProps}
          totalAffiliates={0}
          activeAffiliates={0}
          pendingAffiliates={0}
        />
      );
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('0 active, 0 pending')).toBeInTheDocument();
    });

    it('should handle large affiliate counts', () => {
      render(
        <AffiliateStatsBanner
          {...defaultProps}
          totalAffiliates={1000}
          activeAffiliates={800}
          pendingAffiliates={200}
        />
      );
      expect(screen.getByText('1000')).toBeInTheDocument();
      expect(screen.getByText('800 active, 200 pending')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Commission Statistics
  // ============================================================================
  describe('commission statistics', () => {
    it('should format commission amount with currency symbol', () => {
      render(<AffiliateStatsBanner {...defaultProps} />);
      expect(screen.getByText('$12,500.00')).toBeInTheDocument();
    });

    it('should display pending commissions', () => {
      render(<AffiliateStatsBanner {...defaultProps} />);
      expect(screen.getByText('$2,500.00 pending')).toBeInTheDocument();
    });

    it('should handle zero commissions', () => {
      render(
        <AffiliateStatsBanner
          {...defaultProps}
          totalCommissionsPaid={0}
          pendingCommissions={0}
        />
      );
      expect(screen.getByText('$0.00')).toBeInTheDocument();
      expect(screen.getByText('$0.00 pending')).toBeInTheDocument();
    });

    it('should handle large commission amounts', () => {
      render(
        <AffiliateStatsBanner
          {...defaultProps}
          totalCommissionsPaid={1000000}
          pendingCommissions={50000}
        />
      );
      expect(screen.getByText('$1,000,000.00')).toBeInTheDocument();
    });

    it('should handle decimal commission amounts', () => {
      render(
        <AffiliateStatsBanner
          {...defaultProps}
          totalCommissionsPaid={1234.56}
          pendingCommissions={78.9}
        />
      );
      expect(screen.getByText('$1,234.56')).toBeInTheDocument();
      expect(screen.getByText('$78.90 pending')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Code Statistics
  // ============================================================================
  describe('code statistics', () => {
    it('should display total codes distributed', () => {
      render(<AffiliateStatsBanner {...defaultProps} />);
      expect(screen.getByText('200')).toBeInTheDocument();
    });

    it('should display codes used with percentage', () => {
      render(<AffiliateStatsBanner {...defaultProps} />);
      expect(screen.getByText('150 used (75%)')).toBeInTheDocument();
    });

    it('should calculate correct usage percentage', () => {
      render(
        <AffiliateStatsBanner
          {...defaultProps}
          totalCodesDistributed={100}
          totalCodesUsed={25}
        />
      );
      expect(screen.getByText('25 used (25%)')).toBeInTheDocument();
    });

    it('should handle 100% usage', () => {
      render(
        <AffiliateStatsBanner
          {...defaultProps}
          totalCodesDistributed={100}
          totalCodesUsed={100}
        />
      );
      expect(screen.getByText('100 used (100%)')).toBeInTheDocument();
    });

    it('should handle 0% usage', () => {
      render(
        <AffiliateStatsBanner
          {...defaultProps}
          totalCodesDistributed={100}
          totalCodesUsed={0}
        />
      );
      expect(screen.getByText('0 used (0%)')).toBeInTheDocument();
    });

    it('should handle zero codes distributed', () => {
      render(
        <AffiliateStatsBanner
          {...defaultProps}
          totalCodesDistributed={0}
          totalCodesUsed={0}
        />
      );
      // Should show 0% when no codes distributed (avoid division by zero)
      expect(screen.getByText('0 used (0%)')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Layout
  // ============================================================================
  describe('layout', () => {
    it('should have grid layout', () => {
      const { container } = render(<AffiliateStatsBanner {...defaultProps} />);
      const grid = container.firstChild;
      expect(grid).toHaveClass('grid');
    });

    it('should have responsive columns', () => {
      const { container } = render(<AffiliateStatsBanner {...defaultProps} />);
      const grid = container.firstChild;
      expect(grid).toHaveClass('md:grid-cols-3');
    });

    it('should have gap between cards', () => {
      const { container } = render(<AffiliateStatsBanner {...defaultProps} />);
      const grid = container.firstChild;
      expect(grid).toHaveClass('gap-4');
    });
  });

  // ============================================================================
  // Typography
  // ============================================================================
  describe('typography', () => {
    it('should display value in bold', () => {
      const { container } = render(<AffiliateStatsBanner {...defaultProps} />);
      const boldElements = container.querySelectorAll('.font-bold');
      expect(boldElements.length).toBe(3); // One for each card
    });

    it('should display value in large text', () => {
      const { container } = render(<AffiliateStatsBanner {...defaultProps} />);
      const largeText = container.querySelectorAll('.text-2xl');
      expect(largeText.length).toBe(3);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================
  describe('edge cases', () => {
    it('should handle all zeros', () => {
      render(
        <AffiliateStatsBanner
          totalAffiliates={0}
          activeAffiliates={0}
          pendingAffiliates={0}
          totalCommissionsPaid={0}
          pendingCommissions={0}
          totalCodesDistributed={0}
          totalCodesUsed={0}
        />
      );
      // Should render without errors
      expect(screen.getByText('Total Affiliates')).toBeInTheDocument();
    });

    it('should handle very large numbers', () => {
      render(
        <AffiliateStatsBanner
          totalAffiliates={999999}
          activeAffiliates={500000}
          pendingAffiliates={499999}
          totalCommissionsPaid={9999999.99}
          pendingCommissions={1000000.0}
          totalCodesDistributed={1000000}
          totalCodesUsed={500000}
        />
      );
      expect(screen.getByText('999999')).toBeInTheDocument();
      expect(screen.getByText('$9,999,999.99')).toBeInTheDocument();
    });
  });
});
