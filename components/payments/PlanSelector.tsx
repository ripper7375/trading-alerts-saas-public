'use client';

/**
 * Plan Selector Component
 *
 * Displays plan cards for selection:
 * - 3-Day Trial plan - only for eligible users in dLocal countries
 * - Monthly plan - always available
 * - Annual plan - always available, billed once a year
 *
 * Prices are fetched from SystemConfig via useAffiliateConfig hook.
 *
 * @module components/payments/PlanSelector
 */

import { Check, Clock, Star } from 'lucide-react';
import type { DLocalCurrency, PlanType } from '@/types/dlocal';
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';
import { cn } from '@/lib/utils';
import { useLocale } from '@/lib/context/locale-context';
import { formatCurrencyAmount } from '@/lib/country-config';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface PlanSelectorProps {
  /** Currently selected plan */
  value: PlanType;
  /** Callback when plan is selected */
  onChange: (plan: PlanType) => void;
  /** Whether user is eligible for 3-day plan */
  canUseThreeDayPlan: boolean;
  /** Whether to show the 3-day plan option */
  showThreeDayPlan: boolean;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /**
   * Currency the plan is charged in (the dLocal country's). Prices then show
   * in it rather than the display currency, so the cards agree with the
   * total: Thailand with English (UK) chosen showed £ cards over a ฿ total.
   */
  currency?: DLocalCurrency;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function PlanSelector({
  value,
  onChange,
  canUseThreeDayPlan,
  showThreeDayPlan,
  disabled = false,
  currency,
}: PlanSelectorProps): React.ReactElement {
  const {
    t,
    formatCurrency: formatDisplayCurrency,
    language,
    usdRates,
  } = useLocale();
  const formatCurrency = (amountInUSD: number): string =>
    currency
      ? formatCurrencyAmount(amountInUSD, {
          currency,
          language,
          rates: usdRates?.rates,
        })
      : formatDisplayCurrency(amountInUSD);
  // Get dynamic prices from SystemConfig
  const { regularPrice, threeDayPrice, annualPrice, annualSavingsPercent } =
    useAffiliateConfig();

  const handlePlanSelect = (plan: PlanType): void => {
    if (disabled) return;
    if (plan === 'THREE_DAY' && !canUseThreeDayPlan) return;
    onChange(plan);
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">
        {t('checkout.choose_plan', 'Choose your plan')}
      </label>

      <div
        className={cn(
          'grid gap-3 sm:gap-4',
          showThreeDayPlan
            ? 'grid-cols-1 md:grid-cols-3'
            : 'grid-cols-1 md:grid-cols-2'
        )}
        role="radiogroup"
        aria-label={t('payments.select_plan_aria', 'Select a plan')}
      >
        {/* 3-Day Plan */}
        {showThreeDayPlan && (
          <button
            type="button"
            onClick={() => handlePlanSelect('THREE_DAY')}
            disabled={disabled || !canUseThreeDayPlan}
            className={cn(
              'relative flex h-full flex-col justify-between rounded-lg border-2 p-3.5 text-left transition-all sm:p-4',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              value === 'THREE_DAY' && canUseThreeDayPlan
                ? 'border-purple-500 bg-purple-50 dark:border-purple-500 dark:bg-purple-950/30'
                : 'border-border bg-card hover:border-purple-300 dark:hover:border-purple-700',
              (!canUseThreeDayPlan || disabled) &&
                'cursor-not-allowed opacity-50'
            )}
            role="radio"
            aria-checked={value === 'THREE_DAY'}
            aria-disabled={!canUseThreeDayPlan || disabled}
          >
            <div>
              {/* One-time badge */}
              <div className="absolute -top-2.5 right-2 max-w-[calc(100%-1rem)]">
                <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:border dark:border-purple-800/40 dark:bg-purple-950/60 dark:text-purple-300">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {t('checkout.one_time_offer', 'One-time offer')}
                  </span>
                </span>
              </div>

              <div className="flex items-center justify-between gap-1.5">
                <span className="text-base font-bold text-foreground sm:text-lg">
                  {t('checkout.three_day_trial', '3-Day Trial')}
                </span>
                {value === 'THREE_DAY' && canUseThreeDayPlan && (
                  <Check
                    className="h-5 w-5 shrink-0 text-purple-600 dark:text-purple-400"
                    aria-hidden="true"
                  />
                )}
              </div>

              <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
                <span className="break-words text-xl font-bold tracking-tight text-purple-600 dark:text-purple-400 sm:text-2xl">
                  {formatCurrency(threeDayPrice)}
                </span>
              </div>
            </div>

            <p className="mt-2.5 break-words text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {canUseThreeDayPlan
                ? t(
                    'checkout.three_day_desc',
                    '3 days of PRO access to try before you buy'
                  )
                : t(
                    'checkout.three_day_ineligible',
                    'You have already used this offer or are not eligible'
                  )}
            </p>
          </button>
        )}

        {/* Monthly Plan */}
        <button
          type="button"
          onClick={() => handlePlanSelect('MONTHLY')}
          disabled={disabled}
          className={cn(
            'relative flex h-full flex-col justify-between rounded-lg border-2 p-3.5 text-left transition-all sm:p-4',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            value === 'MONTHLY'
              ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30'
              : 'border-border bg-card hover:border-blue-300 dark:hover:border-blue-700',
            disabled && 'cursor-not-allowed opacity-50'
          )}
          role="radio"
          aria-checked={value === 'MONTHLY'}
          aria-disabled={disabled}
        >
          <div>
            {/* Best value badge */}
            <div className="absolute -top-2.5 right-2 max-w-[calc(100%-1rem)]">
              <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:border dark:border-blue-800/40 dark:bg-blue-950/60 dark:text-blue-300">
                <Star className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {t('checkout.best_value', 'Best Value')}
                </span>
              </span>
            </div>

            <div className="flex items-center justify-between gap-1.5">
              <span className="text-base font-bold text-foreground sm:text-lg">
                {t('checkout.monthly', 'Monthly')}
              </span>
              {value === 'MONTHLY' && (
                <Check
                  className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400"
                  aria-hidden="true"
                />
              )}
            </div>

            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
              <span className="break-words text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400 sm:text-2xl">
                {formatCurrency(regularPrice)}
              </span>
              <span className="whitespace-nowrap text-xs font-normal text-muted-foreground sm:text-sm">
                /{t('checkout.month', 'month')}
              </span>
            </div>
          </div>

          <p className="mt-2.5 break-words text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {t(
              'checkout.monthly_desc',
              'Full PRO access with discount code support'
            )}
          </p>
        </button>

        {/* Annual Plan */}
        <button
          type="button"
          onClick={() => handlePlanSelect('YEARLY')}
          disabled={disabled}
          className={cn(
            'relative flex h-full flex-col justify-between rounded-lg border-2 p-3.5 text-left transition-all sm:p-4',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            value === 'YEARLY'
              ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/30'
              : 'border-border bg-card hover:border-emerald-300 dark:hover:border-emerald-700',
            disabled && 'cursor-not-allowed opacity-50'
          )}
          role="radio"
          aria-checked={value === 'YEARLY'}
          aria-disabled={disabled}
        >
          <div>
            {annualSavingsPercent > 0 && (
              <div className="absolute -top-2.5 right-2 max-w-[calc(100%-1rem)]">
                <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border dark:border-emerald-800/40 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <span className="truncate">
                    {t('pricing.save_percent', 'Save {percent}%').replace(
                      '{percent}',
                      String(annualSavingsPercent)
                    )}
                  </span>
                </span>
              </div>
            )}

            <div className="flex items-center justify-between gap-1.5">
              <span className="text-base font-bold text-foreground sm:text-lg">
                {t('checkout.annual', 'Annual')}
              </span>
              {value === 'YEARLY' && (
                <Check
                  className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
              )}
            </div>

            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
              <span className="break-words text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 sm:text-2xl">
                {formatCurrency(annualPrice)}
              </span>
              <span className="whitespace-nowrap text-xs font-normal text-muted-foreground sm:text-sm">
                /{t('checkout.year', 'year')}
              </span>
            </div>
          </div>

          <p className="mt-2.5 break-words text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {t(
              'checkout.annual_desc',
              '12 months of PRO access in one payment, with discount code support'
            )}
          </p>
        </button>
      </div>
    </div>
  );
}
