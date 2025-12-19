/**
 * Unit Tests: CodeTable Component
 * Tests the affiliate codes table component
 *
 * @module __tests__/components/affiliate/code-table.test
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';
import { CodeTable } from '@/components/affiliate/code-table';

// Mock date-fns format
jest.mock('date-fns', () => ({
  format: (date: Date, formatStr: string) => {
    const d = new Date(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  },
}));

describe('CodeTable Component', () => {
  const mockCodes = [
    {
      id: '1',
      code: 'ABCD1234',
      status: 'ACTIVE' as const,
      distributedAt: new Date('2024-01-01'),
      expiresAt: new Date('2024-01-31'),
      usedAt: null,
    },
    {
      id: '2',
      code: 'EFGH5678',
      status: 'USED' as const,
      distributedAt: new Date('2024-01-01'),
      expiresAt: new Date('2024-01-31'),
      usedAt: new Date('2024-01-15'),
    },
    {
      id: '3',
      code: 'IJKL9012',
      status: 'EXPIRED' as const,
      distributedAt: new Date('2023-12-01'),
      expiresAt: new Date('2023-12-31'),
      usedAt: null,
    },
  ];

  describe('Basic Rendering', () => {
    it('should render codes table', () => {
      render(<CodeTable codes={mockCodes} />);

      expect(screen.getByText('ABCD1234')).toBeInTheDocument();
      expect(screen.getByText('EFGH5678')).toBeInTheDocument();
      expect(screen.getByText('IJKL9012')).toBeInTheDocument();
    });

    it('should render table headers', () => {
      render(<CodeTable codes={mockCodes} />);

      expect(screen.getByText('Code')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Distributed')).toBeInTheDocument();
      expect(screen.getByText('Expires')).toBeInTheDocument();
      expect(screen.getByText('Used')).toBeInTheDocument();
    });

    it('should render as a table element', () => {
      render(<CodeTable codes={mockCodes} />);

      expect(screen.getByRole('table')).toBeInTheDocument();
    });
  });

  describe('Status Badges', () => {
    it('should show ACTIVE status badge', () => {
      render(<CodeTable codes={[mockCodes[0]]} />);

      const statusBadge = screen.getByText('ACTIVE');
      expect(statusBadge).toBeInTheDocument();
      expect(statusBadge.className).toMatch(/green/i);
    });

    it('should show USED status badge', () => {
      render(<CodeTable codes={[mockCodes[1]]} />);

      const statusBadge = screen.getByText('USED');
      expect(statusBadge).toBeInTheDocument();
      expect(statusBadge.className).toMatch(/blue/i);
    });

    it('should show EXPIRED status badge', () => {
      render(<CodeTable codes={[mockCodes[2]]} />);

      const statusBadge = screen.getByText('EXPIRED');
      expect(statusBadge).toBeInTheDocument();
      expect(statusBadge.className).toMatch(/gray/i);
    });

    it('should handle CANCELLED status', () => {
      const cancelledCode = {
        ...mockCodes[0],
        status: 'CANCELLED' as const,
      };
      render(<CodeTable codes={[cancelledCode]} />);

      expect(screen.getByText('CANCELLED')).toBeInTheDocument();
    });
  });

  describe('Date Formatting', () => {
    it('should format distributed date correctly', () => {
      render(<CodeTable codes={mockCodes} />);

      expect(screen.getAllByText(/Jan 1, 2024/).length).toBeGreaterThan(0);
    });

    it('should format expires date correctly', () => {
      render(<CodeTable codes={mockCodes} />);

      expect(screen.getAllByText(/Jan 31, 2024/).length).toBeGreaterThan(0);
    });

    it('should show dash for unused codes in Used column', () => {
      render(<CodeTable codes={[mockCodes[0]]} />);

      const rows = screen.getAllByRole('row');
      const dataRow = rows[1]; // First data row (skip header)
      expect(within(dataRow).getByText('-')).toBeInTheDocument();
    });

    it('should show used date when code was used', () => {
      render(<CodeTable codes={[mockCodes[1]]} />);

      expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should handle empty codes array', () => {
      render(<CodeTable codes={[]} />);

      expect(screen.getByText(/no codes/i)).toBeInTheDocument();
    });

    it('should not render table when no codes', () => {
      render(<CodeTable codes={[]} />);

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('should apply monospace font to code column', () => {
      render(<CodeTable codes={mockCodes} />);

      const codeCell = screen.getByText('ABCD1234');
      expect(codeCell.className).toContain('font-mono');
    });

    it('should apply proper table styling', () => {
      const { container } = render(<CodeTable codes={mockCodes} />);

      const tableWrapper = container.querySelector('.overflow-x-auto');
      expect(tableWrapper).toBeInTheDocument();
    });
  });

  describe('Code Display', () => {
    it('should display all code characters', () => {
      const longCode = {
        ...mockCodes[0],
        code: 'LONGCODE',
      };
      render(<CodeTable codes={[longCode]} />);

      expect(screen.getByText('LONGCODE')).toBeInTheDocument();
    });

    it('should preserve code case', () => {
      const mixedCase = {
        ...mockCodes[0],
        code: 'AbCd1234',
      };
      render(<CodeTable codes={[mixedCase]} />);

      expect(screen.getByText('AbCd1234')).toBeInTheDocument();
    });
  });

  describe('Multiple Codes', () => {
    it('should render all codes in order', () => {
      render(<CodeTable codes={mockCodes} />);

      const rows = screen.getAllByRole('row');
      // 1 header row + 3 data rows
      expect(rows).toHaveLength(4);
    });

    it('should render correct data for each row', () => {
      render(<CodeTable codes={mockCodes} />);

      const table = screen.getByRole('table');
      const rows = within(table).getAllByRole('row');

      // First data row should have ABCD1234
      expect(within(rows[1]).getByText('ABCD1234')).toBeInTheDocument();
      // Second data row should have EFGH5678
      expect(within(rows[2]).getByText('EFGH5678')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper table structure', () => {
      render(<CodeTable codes={mockCodes} />);

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader')).toHaveLength(5);
      expect(screen.getAllByRole('row')).toHaveLength(4);
    });

    it('should have accessible header cells', () => {
      render(<CodeTable codes={mockCodes} />);

      const headers = screen.getAllByRole('columnheader');
      expect(headers[0]).toHaveTextContent('Code');
      expect(headers[1]).toHaveTextContent('Status');
    });
  });
});
