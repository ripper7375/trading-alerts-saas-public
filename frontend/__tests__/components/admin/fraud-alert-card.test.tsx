/**
 * FraudAlertCard Component Tests
 *
 * Tests for the fraud alert card component.
 * Part 14: Admin Dashboard Components
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';

import { FraudAlertCard } from '@/components/admin/FraudAlertCard';

const mockAlert = {
  id: 'alert-123',
  severity: 'HIGH' as const,
  pattern: 'Multiple Cards',
  description: 'User attempted to use 5 different cards in 24 hours',
  userId: 'user-456',
  userEmail: 'suspicious@example.com',
  country: 'United States',
  paymentMethod: 'Credit Card',
  amount: '299.00',
  currency: 'USD',
  createdAt: '2024-01-15T10:30:00Z',
  status: 'PENDING' as const,
};

describe('FraudAlertCard Component', () => {
  // ============================================================================
  // Basic Rendering
  // ============================================================================
  describe('rendering', () => {
    it('should render the alert card', () => {
      render(<FraudAlertCard alert={mockAlert} />);
      expect(screen.getByText('Multiple Cards')).toBeInTheDocument();
    });

    it('should render the description', () => {
      render(<FraudAlertCard alert={mockAlert} />);
      expect(
        screen.getByText('User attempted to use 5 different cards in 24 hours')
      ).toBeInTheDocument();
    });

    it('should render the user email', () => {
      render(<FraudAlertCard alert={mockAlert} />);
      expect(screen.getByText('suspicious@example.com')).toBeInTheDocument();
    });

    it('should render the country', () => {
      render(<FraudAlertCard alert={mockAlert} />);
      expect(screen.getByText('United States')).toBeInTheDocument();
    });

    it('should render payment info', () => {
      render(<FraudAlertCard alert={mockAlert} />);
      expect(
        screen.getByText('USD 299.00 via Credit Card')
      ).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Severity Badge
  // ============================================================================
  describe('severity badge', () => {
    it('should render HIGH severity', () => {
      render(<FraudAlertCard alert={mockAlert} />);
      expect(screen.getByText('HIGH')).toBeInTheDocument();
    });

    it('should render CRITICAL severity', () => {
      render(<FraudAlertCard alert={{ ...mockAlert, severity: 'CRITICAL' }} />);
      expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    });

    it('should render MEDIUM severity', () => {
      render(<FraudAlertCard alert={{ ...mockAlert, severity: 'MEDIUM' }} />);
      expect(screen.getByText('MEDIUM')).toBeInTheDocument();
    });

    it('should render LOW severity', () => {
      render(<FraudAlertCard alert={{ ...mockAlert, severity: 'LOW' }} />);
      expect(screen.getByText('LOW')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Status Display
  // ============================================================================
  describe('status display', () => {
    it('should render PENDING status with orange color', () => {
      render(<FraudAlertCard alert={mockAlert} />);
      const status = screen.getByText('PENDING');
      expect(status).toHaveClass('text-orange-600');
    });

    it('should render BLOCKED status with red color', () => {
      render(<FraudAlertCard alert={{ ...mockAlert, status: 'BLOCKED' }} />);
      const status = screen.getByText('BLOCKED');
      expect(status).toHaveClass('text-red-600');
    });

    it('should render DISMISSED status with gray color', () => {
      render(<FraudAlertCard alert={{ ...mockAlert, status: 'DISMISSED' }} />);
      const status = screen.getByText('DISMISSED');
      expect(status).toHaveClass('text-gray-600');
    });

    it('should render REVIEWED status with green color', () => {
      render(<FraudAlertCard alert={{ ...mockAlert, status: 'REVIEWED' }} />);
      const status = screen.getByText('REVIEWED');
      expect(status).toHaveClass('text-green-600');
    });
  });

  // ============================================================================
  // Date Formatting
  // ============================================================================
  describe('date formatting', () => {
    it('should format the date correctly', () => {
      render(<FraudAlertCard alert={mockAlert} />);
      // The date format is 'Jan 15, 10:30 AM' (or similar based on locale)
      expect(screen.getByText(/Jan/)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // View Link
  // ============================================================================
  describe('view link', () => {
    it('should render View button', () => {
      render(<FraudAlertCard alert={mockAlert} />);
      expect(screen.getByRole('link', { name: /view/i })).toBeInTheDocument();
    });

    it('should link to the alert detail page', () => {
      render(<FraudAlertCard alert={mockAlert} />);
      const link = screen.getByRole('link', { name: /view/i });
      expect(link).toHaveAttribute('href', '/admin/fraud-alerts/alert-123');
    });
  });

  // ============================================================================
  // Card Styling
  // ============================================================================
  describe('card styling', () => {
    it('should have hover shadow effect class', () => {
      const { container } = render(<FraudAlertCard alert={mockAlert} />);
      const card = container.querySelector('[data-slot="card"]');
      expect(card).toHaveClass('hover:shadow-md');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================
  describe('edge cases', () => {
    it('should handle long descriptions', () => {
      const longDescription = 'A'.repeat(500);
      render(
        <FraudAlertCard
          alert={{ ...mockAlert, description: longDescription }}
        />
      );
      expect(screen.getByText(longDescription)).toBeInTheDocument();
    });

    it('should handle special characters in email', () => {
      render(
        <FraudAlertCard
          alert={{ ...mockAlert, userEmail: 'user+test@example.com' }}
        />
      );
      expect(screen.getByText('user+test@example.com')).toBeInTheDocument();
    });

    it('should handle different currencies', () => {
      render(
        <FraudAlertCard
          alert={{ ...mockAlert, currency: 'EUR', amount: '199.50' }}
        />
      );
      expect(
        screen.getByText('EUR 199.50 via Credit Card')
      ).toBeInTheDocument();
    });

    it('should handle different payment methods', () => {
      render(
        <FraudAlertCard alert={{ ...mockAlert, paymentMethod: 'PayPal' }} />
      );
      expect(screen.getByText('USD 299.00 via PayPal')).toBeInTheDocument();
    });
  });
});
