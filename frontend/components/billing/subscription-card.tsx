'use client';

/**
 * Subscription Card Component
 *
 * Displays current subscription status with:
 * - Tier badge (FREE/PRO)
 * - Price information
 * - Included features
 * - Next billing date (PRO only)
 * - Payment method details (PRO only)
 * - Upgrade/Cancel buttons
 * - Optimistic UI for cancel action
 *
 * @module components/billing/subscription-card
 */

import {
  Calendar,
  CreditCard,
  Check,
  Globe,
  RefreshCw,
  Undo2,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useCallback, useRef, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';
import type { PaymentProvider } from '@/types/dlocal';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface PaymentMethod {
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
}

interface SubscriptionCardProps {
  /** User's current tier */
  tier: 'FREE' | 'PRO';
  /** Subscription status */
  status?: string;
  /** Next billing date (ISO string) */
  currentPeriodEnd?: string | null;
  /** Trial end date (ISO string) */
  trialEnd?: string | null;
  /** Whether subscription will cancel at period end */
  cancelAtPeriodEnd?: boolean;
  /** Payment method details */
  paymentMethod?: PaymentMethod | null;
  /** Payment provider (STRIPE or DLOCAL) */
  paymentProvider?: PaymentProvider;
  /** Plan type for dLocal (THREE_DAY or MONTHLY) */
  planType?: string;
  /** Callback when upgrade button is clicked */
  onUpgrade: () => void;
  /** Callback when cancel button is clicked - can return a Promise for optimistic UI */
  onCancel: () => void | Promise<void>;
  /** Whether actions are loading */
  isLoading?: boolean;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Helper function to generate tier config with dynamic PRO price
const getTierConfig = (proPrice: number) =>
  ({
    FREE: {
      label: 'FREE',
      price: '$0/month',
      badgeColor: 'bg-gray-100 text-gray-800',
      borderColor: '',
      features: ['5 symbols', '3 timeframes', '5 alerts', '5 watchlist items'],
    },
    PRO: {
      label: 'PRO',
      price: `$${proPrice}/month`,
      badgeColor: 'bg-blue-100 text-blue-800',
      borderColor: 'border-2 border-blue-500',
      features: [
        '15 symbols',
        '9 timeframes',
        '20 alerts',
        '50 watchlist items',
        'Priority support',
      ],
    },
  }) as const;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Subscription Card Component
 *
 * @param props - Component props
 * @returns React element
 *
 * @example
 * <SubscriptionCard
 *   tier="PRO"
 *   status="active"
 *   currentPeriodEnd="2024-02-01T00:00:00.000Z"
 *   paymentMethod={{ brand: "visa", last4: "4242", expiryMonth: 12, expiryYear: 2025 }}
 *   onUpgrade={() => handleUpgrade()}
 *   onCancel={() => handleCancel()}
 * />
 */
export function SubscriptionCard({
  tier,
  status,
  currentPeriodEnd,
  trialEnd,
  cancelAtPeriodEnd = false,
  paymentMethod,
  paymentProvider,
  planType,
  onUpgrade,
  onCancel,
  isLoading = false,
}: SubscriptionCardProps): React.ReactElement {
  // Get dynamic PRO price from SystemConfig
  const { regularPrice } = useAffiliateConfig();

  // Optimistic cancel state
  const [optimisticCancelPending, setOptimisticCancelPending] = useState(false);
  const [showUndoCancel, setShowUndoCancel] = useState(false);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Combine prop state with optimistic state
  const effectiveCancelAtPeriodEnd = cancelAtPeriodEnd || optimisticCancelPending;

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  // Optimistic cancel handler
  const handleOptimisticCancel = useCallback(async (): Promise<void> => {
    // Optimistically show cancellation
    setOptimisticCancelPending(true);
    setShowUndoCancel(true);

    // Clear previous timeout
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }

    // Auto-hide undo after 5 seconds
    undoTimeoutRef.current = setTimeout(() => {
      setShowUndoCancel(false);
    }, 5000);

    try {
      // Call the parent's onCancel
      await Promise.resolve(onCancel());
      // If successful, the parent will update cancelAtPeriodEnd prop
    } catch (error) {
      // Rollback on error
      setOptimisticCancelPending(false);
      setShowUndoCancel(false);
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
      console.error('Failed to cancel subscription:', error);
    }
  }, [onCancel]);

  // Undo cancel (optimistic - clears local state, actual reactivation would need API)
  const handleUndoCancel = useCallback((): void => {
    // Clear timeout
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }

    // Revert optimistic state
    setOptimisticCancelPending(false);
    setShowUndoCancel(false);

    // Note: In a real app, you'd call an API to reactivate the subscription
    // For now, this just reverts the local UI state
  }, []);

  const isPro = tier === 'PRO';
  const TIER_CONFIG = getTierConfig(regularPrice);
  const config = TIER_CONFIG[tier];
  const isDLocal = paymentProvider === 'DLOCAL';
  const isThreeDayPlan = planType === 'THREE_DAY';

  // Format dates
  const formattedBillingDate = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  const formattedTrialEnd = trialEnd
    ? new Date(trialEnd).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  // Capitalize card brand
  const cardBrand = paymentMethod?.brand
    ? paymentMethod.brand.charAt(0).toUpperCase() + paymentMethod.brand.slice(1)
    : null;

  return (
    <Card className={isPro ? config.borderColor : ''}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Current Subscription</CardTitle>
          <Badge className={config.badgeColor}>{config.label}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Price */}
        <div>
          <p className="text-sm text-muted-foreground mb-1">Price</p>
          <p className="text-3xl font-bold">{config.price}</p>
        </div>

        {/* Trial Notice */}
        {formattedTrialEnd && status === 'trialing' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Trial Period:</strong> Your free trial ends on{' '}
              {formattedTrialEnd}
            </p>
          </div>
        )}

        {/* Cancellation Notice */}
        {effectiveCancelAtPeriodEnd && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              <strong>Cancellation Scheduled:</strong> Your subscription will
              end on {formattedBillingDate}
            </p>
          </div>
        )}

        {/* Undo Cancel Banner */}
        {showUndoCancel && (
          <div className="flex items-center justify-between bg-gray-800 text-white px-4 py-3 rounded-lg animate-in slide-in-from-top-2">
            <span className="text-sm">Subscription cancellation scheduled</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUndoCancel}
              className="text-white hover:text-white hover:bg-gray-700"
            >
              <Undo2 className="h-4 w-4 mr-2" />
              Undo
            </Button>
          </div>
        )}

        {/* Features */}
        <div>
          <p className="text-sm text-muted-foreground mb-2">Includes</p>
          <ul className="space-y-1">
            {config.features.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Billing Info (PRO only) */}
        {isPro && formattedBillingDate && !effectiveCancelAtPeriodEnd && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>Next billing: {formattedBillingDate}</span>
          </div>
        )}

        {/* Payment Method (PRO only - Stripe) */}
        {isPro && paymentMethod && !isDLocal && (
          <div className="flex items-center gap-2 text-sm">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span>
              {cardBrand} ending in {paymentMethod.last4}
            </span>
            <span className="text-muted-foreground">
              (expires {paymentMethod.expiryMonth}/{paymentMethod.expiryYear})
            </span>
          </div>
        )}

        {/* Payment Provider (PRO only - dLocal) */}
        {isPro && isDLocal && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Globe className="h-4 w-4 text-purple-600" />
              <span>Paid via dLocal (Local Payment Methods)</span>
            </div>

            {/* Manual Renewal Notice for dLocal */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <RefreshCw className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-purple-800">
                    <strong>Manual Renewal Required:</strong> dLocal payments do
                    not auto-renew.
                  </p>
                  <p className="text-xs text-purple-700 mt-1">
                    {isThreeDayPlan
                      ? 'Your 3-day trial is a one-time offer. Subscribe to monthly for continued access.'
                      : `Please renew before ${formattedBillingDate} to maintain access.`}
                  </p>
                  <Link
                    href="/checkout"
                    className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-purple-700 hover:text-purple-900"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Renew Now
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          {!isPro ? (
            <Button
              onClick={onUpgrade}
              disabled={isLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? 'Loading...' : 'Upgrade to PRO'}
            </Button>
          ) : (
            <>
              {!effectiveCancelAtPeriodEnd && (
                <Button
                  variant="destructive"
                  onClick={handleOptimisticCancel}
                  disabled={isLoading || optimisticCancelPending}
                  className="flex-1"
                >
                  {isLoading || optimisticCancelPending
                    ? 'Cancelling...'
                    : 'Cancel Subscription'}
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
