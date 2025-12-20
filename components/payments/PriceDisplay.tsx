'use client';

/**
 * Price Display Component
 *
 * Displays price in local currency with USD equivalent:
 * - Fetches exchange rate from API
 * - Shows local currency prominently
 * - Shows USD equivalent in smaller text
 * - Displays exchange rate information
 *
 * Business logic extracted from seed component:
 * seed-code/v0-components/part-18-price-display-component
 *
 * @module components/payments/PriceDisplay
 */

import { useState, useEffect } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import type { DLocalCurrency } from '@/types/dlocal';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface PriceDisplayProps {
  /** Amount in USD */
  usdAmount: number;
  /** Target currency for conversion */
  currency: DLocalCurrency;
  /** Whether to show compact version */
  compact?: boolean;
  /** Whether to show exchange rate refresh button */
  showRefresh?: boolean;
}

interface ConversionResult {
  localAmount: number;
  exchangeRate: number;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS (from seed component)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const CURRENCY_SYMBOLS: Record<DLocalCurrency, string> = {
  INR: '₹',
  NGN: '₦',
  PKR: 'Rs',
  VND: '₫',
  IDR: 'Rp',
  THB: '฿',
  ZAR: 'R',
  TRY: '₺',
};

const CURRENCY_NAMES: Record<DLocalCurrency, string> = {
  INR: 'Indian Rupee',
  NGN: 'Nigerian Naira',
  PKR: 'Pakistani Rupee',
  VND: 'Vietnamese Dong',
  IDR: 'Indonesian Rupiah',
  THB: 'Thai Baht',
  ZAR: 'South African Rand',
  TRY: 'Turkish Lira',
};

// Fallback rates (used if API fails)
const FALLBACK_RATES: Record<DLocalCurrency, number> = {
  INR: 83.0,
  NGN: 780.0,
  PKR: 278.0,
  VND: 24500.0,
  IDR: 15600.0,
  THB: 35.0,
  ZAR: 18.5,
  TRY: 32.0,
};

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS (from seed component)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function formatLocalAmount(
  amount: number,
  currency: DLocalCurrency
): string {
  // VND and IDR don't use decimals
  const decimals = currency === 'VND' || currency === 'IDR' ? 0 : 2;

  return amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatUsdAmount(amount: number): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function PriceDisplay({
  usdAmount,
  currency,
  compact = false,
  showRefresh = true,
}: PriceDisplayProps): React.ReactElement {
  const [conversion, setConversion] = useState<ConversionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchConversion = async (): Promise<void> => {
    try {
      setError(null);

      const res = await fetch(
        `/api/payments/dlocal/convert?amount=${usdAmount}&currency=${currency}`
      );

      if (!res.ok) {
        throw new Error('Failed to fetch conversion');
      }

      const data = await res.json();

      setConversion({
        localAmount: data.localAmount,
        exchangeRate: data.exchangeRate,
      });
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch currency conversion:', err);
      // Use fallback rate
      const fallbackRate = FALLBACK_RATES[currency];
      setConversion({
        localAmount: usdAmount * fallbackRate,
        exchangeRate: fallbackRate,
      });
      setLastUpdated(new Date());
      setError('Using estimated rate');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchConversion();
  }, [usdAmount, currency]);

  const handleRefresh = (): void => {
    setRefreshing(true);
    fetchConversion();
  };

  const getTimeSinceUpdate = (): string => {
    if (!lastUpdated) return '';

    const minutes = Math.floor((Date.now() - lastUpdated.getTime()) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return `${minutes} minutes ago`;

    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    return `${hours} hours ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Calculating price...
      </div>
    );
  }

  if (!conversion) {
    return (
      <div className="text-sm text-destructive">
        Unable to calculate price. Please try again.
      </div>
    );
  }

  const symbol = CURRENCY_SYMBOLS[currency];
  const currencyName = CURRENCY_NAMES[currency];

  if (compact) {
    return (
      <div className="text-right">
        <div className="text-2xl font-bold">
          {symbol}
          {formatLocalAmount(conversion.localAmount, currency)}
        </div>
        <div className="text-sm text-muted-foreground">
          ${formatUsdAmount(usdAmount)} USD
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Main price */}
      <div>
        <div className="text-3xl font-bold">
          {symbol}
          {formatLocalAmount(conversion.localAmount, currency)}
        </div>
        <div className="text-sm text-muted-foreground">{currencyName}</div>
      </div>

      {/* USD equivalent */}
      <div className="text-lg text-muted-foreground">
        ≈ ${formatUsdAmount(usdAmount)} USD
      </div>

      {/* Exchange rate info */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-muted px-2 py-1">
          1 USD = {formatLocalAmount(conversion.exchangeRate, currency)}{' '}
          {currency}
        </span>

        {showRefresh && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 hover:bg-muted/80 disabled:opacity-50"
            aria-label="Refresh exchange rate"
          >
            <RefreshCw
              className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
        )}
      </div>

      {/* Last updated */}
      {lastUpdated && (
        <p className="text-xs italic text-muted-foreground">
          Updated {getTimeSinceUpdate()}
          {error && <span className="ml-1 text-yellow-600">({error})</span>}
        </p>
      )}
    </div>
  );
}
