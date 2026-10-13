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

import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import type { DLocalCurrency } from '@/types/dlocal';
import { useLocale } from '@/lib/context/locale-context';
import { CURRENCY_USD_RATES } from '@/lib/country-config';

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
  AED: 'AED',
  BRL: 'R$',
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
  AED: 'UAE Dirham',
  BRL: 'Brazilian Real',
};

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS (from seed component)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function formatLocalAmount(amount: number, currency: DLocalCurrency): string {
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
  const { t, formatRelativeTime, usdRates } = useLocale();
  const [conversion, setConversion] = useState<ConversionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeRequest = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);
  const activeTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const sharedRate = usdRates?.rates[currency];

  const fetchConversion = useCallback(async (): Promise<void> => {
    activeRequest.current?.abort();
    clearTimeout(activeTimeout.current);
    const request = new AbortController();
    activeRequest.current = request;
    const sequence = ++requestSequence.current;
    let timedOut = false;
    const isCurrent = (): boolean =>
      sequence === requestSequence.current &&
      activeRequest.current === request &&
      (timedOut || !request.signal.aborted);
    let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      deadlineTimer = setTimeout(() => {
        timedOut = true;
        request.abort();
        reject(new Error('Conversion timed out'));
      }, 10_000);
      activeTimeout.current = deadlineTimer;
    });
    try {
      setError(null);
      const data = (await Promise.race([
        (async () => {
          const response = await fetch(
            `/api/payments/dlocal/convert?amount=${usdAmount}&currency=${currency}`,
            { cache: 'no-store', signal: request.signal }
          );
          if (!response.ok) throw new Error('Failed to fetch conversion');
          return response.json();
        })(),
        deadline,
      ])) as Partial<ConversionResult> & { currency?: string };
      if (
        typeof data.localAmount !== 'number' ||
        !Number.isFinite(data.localAmount) ||
        data.localAmount < 0 ||
        typeof data.exchangeRate !== 'number' ||
        !Number.isFinite(data.exchangeRate) ||
        data.exchangeRate <= 0 ||
        (data.currency !== undefined && data.currency !== currency)
      )
        throw new Error('Invalid conversion');
      if (!isCurrent()) return;
      setConversion({
        localAmount: data.localAmount,
        exchangeRate: data.exchangeRate,
      });
      setLastUpdated(new Date());
    } catch {
      if (!isCurrent()) return;
      // Estimate with the current shared snapshot, then the canonical fixed rates.
      const rate = sharedRate ?? CURRENCY_USD_RATES[currency] ?? 1;
      setConversion({
        localAmount: Math.round(usdAmount * rate * 100) / 100,
        exchangeRate: rate,
      });
      setLastUpdated(new Date());
      setError(t('payments.using_estimated_rate', 'Using estimated rate'));
    } finally {
      clearTimeout(deadlineTimer);
      if (activeRequest.current === request) activeTimeout.current = undefined;
      if (isCurrent()) {
        setLoading(false);
        setRefreshing(false);
      }
      if (activeRequest.current === request) activeRequest.current = null;
    }
  }, [usdAmount, currency, sharedRate, t]);

  useEffect(() => {
    setLoading(true);
    void fetchConversion();
    return () => {
      activeRequest.current?.abort();
      requestSequence.current += 1;
      clearTimeout(activeTimeout.current);
    };
  }, [fetchConversion, usdRates?.fetchedAt]);

  const handleRefresh = (): void => {
    setRefreshing(true);
    void fetchConversion();
  };
  const getTimeSinceUpdate = (): string => {
    if (!lastUpdated) return '';
    const minutes = Math.floor((Date.now() - lastUpdated.getTime()) / 60000);
    return formatRelativeTime(minutes);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('payments.calculating_price', 'Calculating price...')}
      </div>
    );
  }

  if (!conversion) {
    return (
      <div className="text-sm text-destructive">
        {t(
          'payments.unable_to_calculate',
          'Unable to calculate price. Please try again.'
        )}
      </div>
    );
  }

  const symbol = CURRENCY_SYMBOLS[currency];
  const currencyName = CURRENCY_NAMES[currency];

  if (compact) {
    return (
      <div className="text-right">
        <div className="break-words text-xl font-bold sm:text-2xl">
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
        <div className="text-sm text-muted-foreground">{t(currencyName)}</div>
      </div>

      {/* USD equivalent */}
      <div className="text-lg text-muted-foreground">
        ≈ ${formatUsdAmount(usdAmount)} USD
      </div>

      {/* Exchange rate info */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-muted px-2 py-1">
          {t('payments.one_usd_equals', '1 USD =')}{' '}
          {formatLocalAmount(conversion.exchangeRate, currency)} {currency}
        </span>

        {showRefresh && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="hover:bg-muted/80 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 disabled:opacity-50"
            aria-label={t(
              'payments.refresh_exchange_rate',
              'Refresh exchange rate'
            )}
          >
            <RefreshCw
              className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`}
            />
            {t('Refresh')}
          </button>
        )}
      </div>

      {/* Last updated */}
      {lastUpdated && (
        <p className="text-xs italic text-muted-foreground">
          {t('payments.updated', 'Updated')} {getTimeSinceUpdate()}
          {error && <span className="ml-1 text-yellow-600">({error})</span>}
        </p>
      )}
    </div>
  );
}
