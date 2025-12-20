/**
 * PriceDisplay Component Tests
 *
 * Tests the price display functionality:
 * - Shows loading state
 * - Displays local currency amount
 * - Displays USD equivalent
 * - Displays exchange rate
 * - Handles refresh
 * - Uses fallback rates on API failure
 *
 * @module __tests__/components/payments/PriceDisplay.test
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { PriceDisplay } from '@/components/payments/PriceDisplay';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('PriceDisplay', () => {
  const defaultProps = {
    usdAmount: 29.0,
    currency: 'INR' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        localAmount: 2407.48,
        exchangeRate: 83.0,
      }),
    });
  });

  describe('loading state', () => {
    it('should display loading state initially', () => {
      render(<PriceDisplay {...defaultProps} />);

      expect(screen.getByText(/calculating price/i)).toBeInTheDocument();
    });
  });

  describe('display', () => {
    it('should display local currency amount after loading', async () => {
      render(<PriceDisplay {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/₹2,407\.48/)).toBeInTheDocument();
      });
    });

    it('should display USD equivalent', async () => {
      render(<PriceDisplay {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/≈ \$29\.00 USD/)).toBeInTheDocument();
      });
    });

    it('should display exchange rate', async () => {
      render(<PriceDisplay {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/1 USD = 83\.00 INR/)).toBeInTheDocument();
      });
    });

    it('should display currency name', async () => {
      render(<PriceDisplay {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Indian Rupee')).toBeInTheDocument();
      });
    });

    it('should display last updated time', async () => {
      render(<PriceDisplay {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/updated just now/i)).toBeInTheDocument();
      });
    });
  });

  describe('compact mode', () => {
    it('should show compact display when compact=true', async () => {
      render(<PriceDisplay {...defaultProps} compact />);

      await waitFor(() => {
        // Should show price without currency name
        expect(screen.getByText(/₹2,407\.48/)).toBeInTheDocument();
        expect(screen.queryByText('Indian Rupee')).not.toBeInTheDocument();
      });
    });
  });

  describe('refresh functionality', () => {
    it('should show refresh button by default', async () => {
      render(<PriceDisplay {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /refresh/i })
        ).toBeInTheDocument();
      });
    });

    it('should hide refresh button when showRefresh=false', async () => {
      render(<PriceDisplay {...defaultProps} showRefresh={false} />);

      await waitFor(() => {
        expect(
          screen.queryByRole('button', { name: /refresh/i })
        ).not.toBeInTheDocument();
      });
    });

    it('should call API again when refresh is clicked', async () => {
      render(<PriceDisplay {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
      });

      // Initial call
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Click refresh
      fireEvent.click(screen.getByRole('button', { name: /refresh/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('API integration', () => {
    it('should call the convert API with correct parameters', async () => {
      render(<PriceDisplay usdAmount={1.99} currency="NGN" />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/payments/dlocal/convert?amount=1.99&currency=NGN'
        );
      });
    });

    it('should update when currency changes', async () => {
      const { rerender } = render(<PriceDisplay {...defaultProps} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      rerender(<PriceDisplay usdAmount={29.0} currency="NGN" />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(mockFetch).toHaveBeenLastCalledWith(
          '/api/payments/dlocal/convert?amount=29&currency=NGN'
        );
      });
    });

    it('should update when amount changes', async () => {
      const { rerender } = render(<PriceDisplay {...defaultProps} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      rerender(<PriceDisplay usdAmount={1.99} currency="INR" />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('error handling', () => {
    it('should use fallback rate on API failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API error'));

      render(<PriceDisplay {...defaultProps} />);

      await waitFor(() => {
        // Fallback rate for INR is 83.0
        // 29 * 83 = 2407
        expect(screen.getByText(/₹2,407\.00/)).toBeInTheDocument();
      });
    });

    it('should show estimated rate warning on API failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API error'));

      render(<PriceDisplay {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/using estimated rate/i)).toBeInTheDocument();
      });
    });
  });

  describe('currency formatting', () => {
    it('should format VND without decimals', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          localAmount: 710500,
          exchangeRate: 24500,
        }),
      });

      render(<PriceDisplay usdAmount={29.0} currency="VND" />);

      await waitFor(() => {
        // VND should not have decimal places
        expect(screen.getByText(/₫710,500/)).toBeInTheDocument();
      });
    });

    it('should format IDR without decimals', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          localAmount: 452400,
          exchangeRate: 15600,
        }),
      });

      render(<PriceDisplay usdAmount={29.0} currency="IDR" />);

      await waitFor(() => {
        // IDR should not have decimal places
        expect(screen.getByText(/Rp452,400/)).toBeInTheDocument();
      });
    });
  });
});
