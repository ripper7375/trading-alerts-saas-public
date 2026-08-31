/**
 * Price Display (mobile reference)
 *
 * Mobile version of the monolith's components/payments/PriceDisplay.tsx --
 * shows the plan price converted into a dLocal country's local currency,
 * using the same static reference rates as the country/payment selectors
 * (no live conversion API in this seed app).
 */

import type { DLocalCurrency } from '@/types/dlocal';
import {
  CURRENCY_NAMES,
  CURRENCY_SYMBOLS,
  FALLBACK_RATES,
} from '@/lib/dlocal/constants';

interface PriceDisplayProps {
  usdAmount: number;
  currency: DLocalCurrency;
}

function formatLocalAmount(amount: number, currency: DLocalCurrency): string {
  const decimals = currency === 'VND' || currency === 'IDR' ? 0 : 2;
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function PriceDisplay({ usdAmount, currency }: PriceDisplayProps) {
  const rate = FALLBACK_RATES[currency];
  const localAmount = usdAmount * rate;
  const symbol = CURRENCY_SYMBOLS[currency];

  return (
    <div className="space-y-1">
      <div className="text-2xl font-bold">
        {symbol}
        {formatLocalAmount(localAmount, currency)}
      </div>
      <div className="text-xs text-muted-foreground">
        {CURRENCY_NAMES[currency]} · ≈ ${usdAmount.toFixed(2)} USD
      </div>
      <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
        1 USD ≈ {formatLocalAmount(rate, currency)} {currency} (reference rate)
      </span>
    </div>
  );
}
