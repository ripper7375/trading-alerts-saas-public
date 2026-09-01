/**
 * Unit Tests: CommissionTable Component
 * Tests the affiliate commissions table component
 *
 * @module __tests__/components/affiliate/commission-table.test
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';
import {
  CommissionTable,
  type CommissionTableProps,
} from '@/components/affiliate/commission-table';
import { LocaleProvider } from '@/lib/context/locale-context';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/locale-resolver';

jest.mock('next/navigation', () => ({
  usePathname: () => '/affiliate/dashboard/commissions',
}));

// CommissionTable calls useLocale() -- needs a LocaleProvider ancestor
// (LESSONS-LEARNED.md L40). Pre-seed US/USD preferences so formatCurrency()
// reproduces this file's pre-existing literal "$X.XX" assertions.
beforeEach(() => {
  localStorage.setItem(
    LOCALE_STORAGE_KEY,
    JSON.stringify({
      countryCode: 'US',
      language: 'en-US',
      timezone: 'America/New_York',
      dateFormat: 'MDY',
      timeFormat: '12h',
      currency: 'USD',
    })
  );
});

function renderCT(
  commissions: CommissionTableProps['commissions']
): ReturnType<typeof render> {
  return render(
    <LocaleProvider>
      <CommissionTable commissions={commissions} />
    </LocaleProvider>
  );
}

describe('CommissionTable Component', () => {
  const mockCommissions = [
    {
      id: '1',
      commissionAmount: 4.64,
      status: 'PENDING' as const,
      earnedAt: new Date('2024-01-15'),
      paidAt: null,
      affiliateCode: { code: 'TEST1234' },
    },
    {
      id: '2',
      commissionAmount: 4.64,
      status: 'PAID' as const,
      earnedAt: new Date('2024-01-10'),
      paidAt: new Date('2024-02-01'),
      affiliateCode: { code: 'TEST5678' },
    },
    {
      id: '3',
      commissionAmount: 4.64,
      status: 'APPROVED' as const,
      earnedAt: new Date('2024-01-20'),
      paidAt: null,
      affiliateCode: { code: 'TEST9012' },
    },
  ];

  describe('Basic Rendering', () => {
    it('should render commissions table', () => {
      renderCT(mockCommissions);

      expect(screen.getByText('TEST1234')).toBeInTheDocument();
      expect(screen.getByText('TEST5678')).toBeInTheDocument();
      expect(screen.getByText('TEST9012')).toBeInTheDocument();
    });

    it('should render table headers', () => {
      renderCT(mockCommissions);

      expect(screen.getByText('Code')).toBeInTheDocument();
      expect(screen.getByText('Amount')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Earned')).toBeInTheDocument();
      expect(screen.getByText('Paid')).toBeInTheDocument();
    });

    it('should render as a table element', () => {
      renderCT(mockCommissions);

      expect(screen.getByRole('table')).toBeInTheDocument();
    });
  });

  describe('Amount Formatting', () => {
    it('should format amounts correctly with dollar sign', () => {
      renderCT(mockCommissions);

      expect(screen.getAllByText('$4.64')).toHaveLength(3);
    });

    it('should format amounts with two decimal places', () => {
      const commission = {
        ...mockCommissions[0],
        commissionAmount: 10,
      };
      renderCT([commission]);

      expect(screen.getByText('$10.00')).toBeInTheDocument();
    });

    it('should handle small amounts', () => {
      const commission = {
        ...mockCommissions[0],
        commissionAmount: 0.5,
      };
      renderCT([commission]);

      expect(screen.getByText('$0.50')).toBeInTheDocument();
    });

    it('should handle large amounts', () => {
      const commission = {
        ...mockCommissions[0],
        commissionAmount: 1234.56,
      };
      renderCT([commission]);

      // formatCurrency() rounds to 0 decimals and adds a thousands
      // separator once the converted amount reaches 1000 (same rule the
      // BI dashboards use) -- a real, intentional precision change from
      // the old manual `$${amount.toFixed(2)}`, not a regression.
      expect(screen.getByText('$1,235')).toBeInTheDocument();
    });
  });

  describe('Status Badges', () => {
    it('should show PENDING status badge', () => {
      renderCT([mockCommissions[0]]);

      const statusBadge = screen.getByText('PENDING');
      expect(statusBadge).toBeInTheDocument();
      expect(statusBadge.className).toMatch(/amber/i);
    });

    it('should show PAID status badge', () => {
      renderCT([mockCommissions[1]]);

      const statusBadge = screen.getByText('PAID');
      expect(statusBadge).toBeInTheDocument();
      expect(statusBadge.className).toMatch(/green/i);
    });

    it('should show APPROVED status badge', () => {
      renderCT([mockCommissions[2]]);

      const statusBadge = screen.getByText('APPROVED');
      expect(statusBadge).toBeInTheDocument();
      expect(statusBadge.className).toMatch(/blue/i);
    });

    it('should handle CANCELLED status', () => {
      const cancelledCommission = {
        ...mockCommissions[0],
        status: 'CANCELLED' as const,
      };
      renderCT([cancelledCommission]);

      expect(screen.getByText('CANCELLED')).toBeInTheDocument();
    });
  });

  describe('Date Formatting', () => {
    it('should format earned date correctly', () => {
      renderCT(mockCommissions);

      // formatDate() renders the seeded MDY preference, not the old
      // date-fns 'MMM d, yyyy' format.
      expect(screen.getByText('01/15/2024')).toBeInTheDocument();
      expect(screen.getByText('01/10/2024')).toBeInTheDocument();
    });

    it('should show dash for unpaid commissions', () => {
      renderCT([mockCommissions[0]]);

      const rows = screen.getAllByRole('row');
      const dataRow = rows[1];
      expect(within(dataRow).getByText('-')).toBeInTheDocument();
    });

    it('should show paid date when commission was paid', () => {
      renderCT([mockCommissions[1]]);

      expect(screen.getByText('02/01/2024')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should handle empty commissions array', () => {
      renderCT([]);

      expect(screen.getByText(/no commissions/i)).toBeInTheDocument();
    });

    it('should not render table when no commissions', () => {
      renderCT([]);

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('Code Display', () => {
    it('should apply monospace font to code column', () => {
      renderCT(mockCommissions);

      const codeCell = screen.getByText('TEST1234');
      expect(codeCell.className).toContain('font-mono');
    });

    it('should display affiliate code from nested object', () => {
      renderCT(mockCommissions);

      expect(screen.getByText('TEST1234')).toBeInTheDocument();
    });
  });

  describe('Amount Styling', () => {
    it('should emphasize amount values', () => {
      renderCT(mockCommissions);

      const amountCells = screen.getAllByText('$4.64');
      amountCells.forEach((cell) => {
        expect(cell.className).toMatch(/font-semibold|font-bold/);
      });
    });
  });

  describe('Multiple Commissions', () => {
    it('should render all commissions in order', () => {
      renderCT(mockCommissions);

      const rows = screen.getAllByRole('row');
      // 1 header row + 3 data rows
      expect(rows).toHaveLength(4);
    });

    it('should render correct data for each row', () => {
      renderCT(mockCommissions);

      const table = screen.getByRole('table');
      const rows = within(table).getAllByRole('row');

      expect(within(rows[1]).getByText('TEST1234')).toBeInTheDocument();
      expect(within(rows[2]).getByText('TEST5678')).toBeInTheDocument();
      expect(within(rows[3]).getByText('TEST9012')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper table structure', () => {
      renderCT(mockCommissions);

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader')).toHaveLength(5);
      expect(screen.getAllByRole('row')).toHaveLength(4);
    });

    it('should have accessible header cells', () => {
      renderCT(mockCommissions);

      const headers = screen.getAllByRole('columnheader');
      expect(headers[0]).toHaveTextContent('Code');
      expect(headers[1]).toHaveTextContent('Amount');
      expect(headers[2]).toHaveTextContent('Status');
    });
  });

  describe('Clawback rows (davintrade-vat-stack follow-up)', () => {
    it('shows a Clawback badge and negative amount in red for a clawback row', () => {
      const clawback = {
        id: '4',
        commissionAmount: -5.8,
        status: 'APPROVED' as const,
        earnedAt: new Date('2024-02-01'),
        paidAt: null,
        affiliateCode: { code: 'TEST1234' },
        clawbackOfCommissionId: 'commission-original-1',
      };
      renderCT([clawback]);

      expect(screen.getByText('Clawback')).toBeInTheDocument();
      const amountCell = screen.getByText('-$5.80');
      expect(amountCell).toBeInTheDocument();
      expect(amountCell.className).toMatch(/red/i);
      // The underlying status badge is still shown alongside it.
      expect(screen.getByText('APPROVED')).toBeInTheDocument();
    });

    it('does not show a Clawback badge for a normal commission', () => {
      renderCT([mockCommissions[0]]);

      expect(screen.queryByText('Clawback')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle commission with zero amount', () => {
      const zeroCommission = {
        ...mockCommissions[0],
        commissionAmount: 0,
      };
      renderCT([zeroCommission]);

      expect(screen.getByText('$0.00')).toBeInTheDocument();
    });

    it('should handle very precise decimal amounts', () => {
      const preciseCommission = {
        ...mockCommissions[0],
        commissionAmount: 4.644,
      };
      renderCT([preciseCommission]);

      // Should round to 2 decimal places
      expect(screen.getByText('$4.64')).toBeInTheDocument();
    });
  });
});
