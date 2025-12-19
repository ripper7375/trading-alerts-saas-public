/**
 * Unit Tests: CommissionTable Component
 * Tests the affiliate commissions table component
 *
 * @module __tests__/components/affiliate/commission-table.test
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';
import { CommissionTable } from '@/components/affiliate/commission-table';

// Mock date-fns format
jest.mock('date-fns', () => ({
  format: (date: Date, formatStr: string) => {
    const d = new Date(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  },
}));

describe('CommissionTable Component', () => {
  const mockCommissions = [
    {
      id: '1',
      amount: 4.64,
      status: 'PENDING' as const,
      earnedAt: new Date('2024-01-15'),
      paidAt: null,
      affiliateCode: { code: 'TEST1234' },
    },
    {
      id: '2',
      amount: 4.64,
      status: 'PAID' as const,
      earnedAt: new Date('2024-01-10'),
      paidAt: new Date('2024-02-01'),
      affiliateCode: { code: 'TEST5678' },
    },
    {
      id: '3',
      amount: 4.64,
      status: 'APPROVED' as const,
      earnedAt: new Date('2024-01-20'),
      paidAt: null,
      affiliateCode: { code: 'TEST9012' },
    },
  ];

  describe('Basic Rendering', () => {
    it('should render commissions table', () => {
      render(<CommissionTable commissions={mockCommissions} />);

      expect(screen.getByText('TEST1234')).toBeInTheDocument();
      expect(screen.getByText('TEST5678')).toBeInTheDocument();
      expect(screen.getByText('TEST9012')).toBeInTheDocument();
    });

    it('should render table headers', () => {
      render(<CommissionTable commissions={mockCommissions} />);

      expect(screen.getByText('Code')).toBeInTheDocument();
      expect(screen.getByText('Amount')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Earned')).toBeInTheDocument();
      expect(screen.getByText('Paid')).toBeInTheDocument();
    });

    it('should render as a table element', () => {
      render(<CommissionTable commissions={mockCommissions} />);

      expect(screen.getByRole('table')).toBeInTheDocument();
    });
  });

  describe('Amount Formatting', () => {
    it('should format amounts correctly with dollar sign', () => {
      render(<CommissionTable commissions={mockCommissions} />);

      expect(screen.getAllByText('$4.64')).toHaveLength(3);
    });

    it('should format amounts with two decimal places', () => {
      const commission = {
        ...mockCommissions[0],
        amount: 10,
      };
      render(<CommissionTable commissions={[commission]} />);

      expect(screen.getByText('$10.00')).toBeInTheDocument();
    });

    it('should handle small amounts', () => {
      const commission = {
        ...mockCommissions[0],
        amount: 0.5,
      };
      render(<CommissionTable commissions={[commission]} />);

      expect(screen.getByText('$0.50')).toBeInTheDocument();
    });

    it('should handle large amounts', () => {
      const commission = {
        ...mockCommissions[0],
        amount: 1234.56,
      };
      render(<CommissionTable commissions={[commission]} />);

      expect(screen.getByText('$1234.56')).toBeInTheDocument();
    });
  });

  describe('Status Badges', () => {
    it('should show PENDING status badge', () => {
      render(<CommissionTable commissions={[mockCommissions[0]]} />);

      const statusBadge = screen.getByText('PENDING');
      expect(statusBadge).toBeInTheDocument();
      expect(statusBadge.className).toMatch(/yellow/i);
    });

    it('should show PAID status badge', () => {
      render(<CommissionTable commissions={[mockCommissions[1]]} />);

      const statusBadge = screen.getByText('PAID');
      expect(statusBadge).toBeInTheDocument();
      expect(statusBadge.className).toMatch(/green/i);
    });

    it('should show APPROVED status badge', () => {
      render(<CommissionTable commissions={[mockCommissions[2]]} />);

      const statusBadge = screen.getByText('APPROVED');
      expect(statusBadge).toBeInTheDocument();
      expect(statusBadge.className).toMatch(/blue/i);
    });

    it('should handle CANCELLED status', () => {
      const cancelledCommission = {
        ...mockCommissions[0],
        status: 'CANCELLED' as const,
      };
      render(<CommissionTable commissions={[cancelledCommission]} />);

      expect(screen.getByText('CANCELLED')).toBeInTheDocument();
    });
  });

  describe('Date Formatting', () => {
    it('should format earned date correctly', () => {
      render(<CommissionTable commissions={mockCommissions} />);

      expect(screen.getByText('Jan 15, 2024')).toBeInTheDocument();
      expect(screen.getByText('Jan 10, 2024')).toBeInTheDocument();
    });

    it('should show dash for unpaid commissions', () => {
      render(<CommissionTable commissions={[mockCommissions[0]]} />);

      const rows = screen.getAllByRole('row');
      const dataRow = rows[1];
      expect(within(dataRow).getByText('-')).toBeInTheDocument();
    });

    it('should show paid date when commission was paid', () => {
      render(<CommissionTable commissions={[mockCommissions[1]]} />);

      expect(screen.getByText('Feb 1, 2024')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should handle empty commissions array', () => {
      render(<CommissionTable commissions={[]} />);

      expect(screen.getByText(/no commissions/i)).toBeInTheDocument();
    });

    it('should not render table when no commissions', () => {
      render(<CommissionTable commissions={[]} />);

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('Code Display', () => {
    it('should apply monospace font to code column', () => {
      render(<CommissionTable commissions={mockCommissions} />);

      const codeCell = screen.getByText('TEST1234');
      expect(codeCell.className).toContain('font-mono');
    });

    it('should display affiliate code from nested object', () => {
      render(<CommissionTable commissions={mockCommissions} />);

      expect(screen.getByText('TEST1234')).toBeInTheDocument();
    });
  });

  describe('Amount Styling', () => {
    it('should emphasize amount values', () => {
      render(<CommissionTable commissions={mockCommissions} />);

      const amountCells = screen.getAllByText('$4.64');
      amountCells.forEach((cell) => {
        expect(cell.className).toMatch(/font-semibold|font-bold/);
      });
    });
  });

  describe('Multiple Commissions', () => {
    it('should render all commissions in order', () => {
      render(<CommissionTable commissions={mockCommissions} />);

      const rows = screen.getAllByRole('row');
      // 1 header row + 3 data rows
      expect(rows).toHaveLength(4);
    });

    it('should render correct data for each row', () => {
      render(<CommissionTable commissions={mockCommissions} />);

      const table = screen.getByRole('table');
      const rows = within(table).getAllByRole('row');

      expect(within(rows[1]).getByText('TEST1234')).toBeInTheDocument();
      expect(within(rows[2]).getByText('TEST5678')).toBeInTheDocument();
      expect(within(rows[3]).getByText('TEST9012')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper table structure', () => {
      render(<CommissionTable commissions={mockCommissions} />);

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader')).toHaveLength(5);
      expect(screen.getAllByRole('row')).toHaveLength(4);
    });

    it('should have accessible header cells', () => {
      render(<CommissionTable commissions={mockCommissions} />);

      const headers = screen.getAllByRole('columnheader');
      expect(headers[0]).toHaveTextContent('Code');
      expect(headers[1]).toHaveTextContent('Amount');
      expect(headers[2]).toHaveTextContent('Status');
    });
  });

  describe('Edge Cases', () => {
    it('should handle commission with zero amount', () => {
      const zeroCommission = {
        ...mockCommissions[0],
        amount: 0,
      };
      render(<CommissionTable commissions={[zeroCommission]} />);

      expect(screen.getByText('$0.00')).toBeInTheDocument();
    });

    it('should handle very precise decimal amounts', () => {
      const preciseCommission = {
        ...mockCommissions[0],
        amount: 4.644,
      };
      render(<CommissionTable commissions={[preciseCommission]} />);

      // Should round to 2 decimal places
      expect(screen.getByText('$4.64')).toBeInTheDocument();
    });
  });
});
