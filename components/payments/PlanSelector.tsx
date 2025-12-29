'use client';

/**
 * Plan Selector Component
 *
 * Displays plan cards for selection:
 * - 3-Day Trial plan - only for eligible users in dLocal countries
 * - Monthly plan - always available
 *
 * Prices are fetched from SystemConfig via useAffiliateConfig hook.
 *
 * @module components/payments/PlanSelector
 */

import { Check, Clock, Star } from 'lucide-react';
import type { PlanType } from '@/types/dlocal';
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';
import { cn } from '@/lib/utils';

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
}: PlanSelectorProps): React.ReactElement {
  // Get dynamic prices from SystemConfig
  const { regularPrice, threeDayPrice } = useAffiliateConfig();

  const handlePlanSelect = (plan: PlanType): void => {
    if (disabled) return;
    if (plan === 'THREE_DAY' && !canUseThreeDayPlan) return;
    onChange(plan);
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">Choose your plan</label>

      <div
        className={cn(
          'grid gap-4',
          showThreeDayPlan ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
        )}
        role="radiogroup"
        aria-label="Select a plan"
      >
        {/* 3-Day Plan */}
        {showThreeDayPlan && (
          <button
            type="button"
            onClick={() => handlePlanSelect('THREE_DAY')}
            disabled={disabled || !canUseThreeDayPlan}
            className={cn(
              'relative rounded-lg border-2 p-4 text-left transition-all',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              value === 'THREE_DAY' && canUseThreeDayPlan
                ? 'border-purple-500 bg-purple-50'
                : 'border-border hover:border-purple-300',
              (!canUseThreeDayPlan || disabled) &&
                'cursor-not-allowed opacity-50'
            )}
            role="radio"
            aria-checked={value === 'THREE_DAY'}
            aria-disabled={!canUseThreeDayPlan || disabled}
          >
            {/* One-time badge */}
            <div className="absolute -top-2 right-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                <Clock className="h-3 w-3" />
                One-time offer
              </span>
            </div>

            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">3-Day Trial</span>
                </div>
                <div className="text-2xl font-bold text-purple-600">
                  ${threeDayPrice.toFixed(2)}
                </div>
              </div>
              {value === 'THREE_DAY' && canUseThreeDayPlan && (
                <Check className="h-6 w-6 text-purple-600" aria-hidden="true" />
              )}
            </div>

            <p className="mt-2 text-sm text-muted-foreground">
              {canUseThreeDayPlan ? (
                <>3 days of PRO access to try before you buy</>
              ) : (
                <>You have already used this offer or are not eligible</>
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
            'relative rounded-lg border-2 p-4 text-left transition-all',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            value === 'MONTHLY'
              ? 'border-blue-500 bg-blue-50'
              : 'border-border hover:border-blue-300',
            disabled && 'cursor-not-allowed opacity-50'
          )}
          role="radio"
          aria-checked={value === 'MONTHLY'}
          aria-disabled={disabled}
        >
          {/* Best value badge */}
          <div className="absolute -top-2 right-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              <Star className="h-3 w-3" />
              Best Value
            </span>
          </div>

          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">Monthly</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">
                ${regularPrice.toFixed(2)}
                <span className="text-sm font-normal text-muted-foreground">
                  /month
                </span>
              </div>
            </div>
            {value === 'MONTHLY' && (
              <Check className="h-6 w-6 text-blue-600" aria-hidden="true" />
            )}
          </div>

          <p className="mt-2 text-sm text-muted-foreground">
            Full PRO access with discount code support
          </p>
        </button>
      </div>
    </div>
  );
}
