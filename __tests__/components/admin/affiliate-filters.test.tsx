/**
 * AffiliateFilters Component Tests
 *
 * Tests for the affiliate filters component.
 * Part 14: Admin Dashboard Components
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, jest } from '@jest/globals';

import { AffiliateFilters } from '@/components/admin/affiliate-filters';

const mockHandlers = {
  onStatusChange: jest.fn(),
  onCountryChange: jest.fn(),
  onPaymentMethodChange: jest.fn(),
};

describe('AffiliateFilters Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Basic Rendering
  // ============================================================================
  describe('rendering', () => {
    it('should render three select dropdowns', () => {
      render(<AffiliateFilters {...mockHandlers} />);
      const triggers = screen.getAllByRole('combobox');
      expect(triggers.length).toBe(3);
    });

    it('should render status select', () => {
      render(<AffiliateFilters {...mockHandlers} />);
      expect(screen.getByText('All Statuses')).toBeInTheDocument();
    });

    it('should render country select', () => {
      render(<AffiliateFilters {...mockHandlers} />);
      expect(screen.getByText('All Countries')).toBeInTheDocument();
    });

    it('should render payment method select', () => {
      render(<AffiliateFilters {...mockHandlers} />);
      expect(screen.getByText('All Payment Methods')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Status Filter
  // ============================================================================
  describe('status filter', () => {
    it('should show ACTIVE status option', () => {
      render(<AffiliateFilters {...mockHandlers} status="ACTIVE" />);
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('should show PENDING_VERIFICATION status option', () => {
      render(<AffiliateFilters {...mockHandlers} status="PENDING_VERIFICATION" />);
      expect(screen.getByText('Pending Verification')).toBeInTheDocument();
    });

    it('should show SUSPENDED status option', () => {
      render(<AffiliateFilters {...mockHandlers} status="SUSPENDED" />);
      expect(screen.getByText('Suspended')).toBeInTheDocument();
    });

    it('should show INACTIVE status option', () => {
      render(<AffiliateFilters {...mockHandlers} status="INACTIVE" />);
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Country Filter
  // ============================================================================
  describe('country filter', () => {
    it('should show US option', () => {
      render(<AffiliateFilters {...mockHandlers} country="US" />);
      expect(screen.getByText('United States')).toBeInTheDocument();
    });

    it('should show UK option', () => {
      render(<AffiliateFilters {...mockHandlers} country="UK" />);
      expect(screen.getByText('United Kingdom')).toBeInTheDocument();
    });

    it('should show CA option', () => {
      render(<AffiliateFilters {...mockHandlers} country="CA" />);
      expect(screen.getByText('Canada')).toBeInTheDocument();
    });

    it('should show AU option', () => {
      render(<AffiliateFilters {...mockHandlers} country="AU" />);
      expect(screen.getByText('Australia')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Payment Method Filter
  // ============================================================================
  describe('payment method filter', () => {
    it('should show BANK_TRANSFER option', () => {
      render(<AffiliateFilters {...mockHandlers} paymentMethod="BANK_TRANSFER" />);
      expect(screen.getByText('Bank Transfer')).toBeInTheDocument();
    });

    it('should show PAYPAL option', () => {
      render(<AffiliateFilters {...mockHandlers} paymentMethod="PAYPAL" />);
      expect(screen.getByText('PayPal')).toBeInTheDocument();
    });

    it('should show CRYPTOCURRENCY option', () => {
      render(<AffiliateFilters {...mockHandlers} paymentMethod="CRYPTOCURRENCY" />);
      expect(screen.getByText('Cryptocurrency')).toBeInTheDocument();
    });

    it('should show WISE option', () => {
      render(<AffiliateFilters {...mockHandlers} paymentMethod="WISE" />);
      expect(screen.getByText('Wise')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Default Values
  // ============================================================================
  describe('default values', () => {
    it('should default to All Statuses when no status provided', () => {
      render(<AffiliateFilters {...mockHandlers} />);
      expect(screen.getByText('All Statuses')).toBeInTheDocument();
    });

    it('should default to All Countries when no country provided', () => {
      render(<AffiliateFilters {...mockHandlers} />);
      expect(screen.getByText('All Countries')).toBeInTheDocument();
    });

    it('should default to All Payment Methods when no payment method provided', () => {
      render(<AffiliateFilters {...mockHandlers} />);
      expect(screen.getByText('All Payment Methods')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Layout
  // ============================================================================
  describe('layout', () => {
    it('should have flex layout with wrap', () => {
      const { container } = render(<AffiliateFilters {...mockHandlers} />);
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('flex', 'flex-wrap', 'gap-4');
    });

    it('should have fixed width triggers', () => {
      const { container } = render(<AffiliateFilters {...mockHandlers} />);
      const triggers = container.querySelectorAll('[data-slot="select-trigger"]');
      triggers.forEach(trigger => {
        expect(trigger).toHaveClass('w-[180px]');
      });
    });
  });

  // ============================================================================
  // With All Props
  // ============================================================================
  describe('with all props', () => {
    it('should display all selected values', () => {
      render(
        <AffiliateFilters
          {...mockHandlers}
          status="ACTIVE"
          country="US"
          paymentMethod="PAYPAL"
        />
      );
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('United States')).toBeInTheDocument();
      expect(screen.getByText('PayPal')).toBeInTheDocument();
    });
  });
});
